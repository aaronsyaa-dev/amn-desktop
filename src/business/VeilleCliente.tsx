import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useCollection } from '../state/SyncContext';
import { appointmentEnd, useAppointments } from '../state/useAppointments';
import { invoiceTotals, isoDay, useInvoices } from '../state/useInvoices';
import { dayKey } from '../lib/calendar';
import { useInactivite } from '../lib/useInactivite';
import {
  BANDE,
  EVENEMENT_APERCU,
  EVENEMENT_REGLAGES,
  MONTANT_MASQUE,
  derive,
  enModeNuit,
  lireReglagesVeille,
  masqueEffectif,
  surLaBande,
  traitMaintenant,
  type ReglagesVeille,
} from '../lib/veille';

/**
 * L'ÉCRAN DE VEILLE — la vitrine du jour (`41a`, ACCUEILS.md).
 *
 * Un affichage mural lisible à trois ou quatre mètres, SANS COQUILLE NI
 * ACTION : ni barre latérale, ni bouton, ni lien. Il ne supervise que
 * l'espace de la cliente et ne propose rien à faire.
 *
 * Règles, telles que le document les écrit :
 *   · déclenchement après le délai du poste (2, 5, 10 minutes ou jamais) ;
 *   · sortie au premier contact — et CE CONTACT NE DÉCLENCHE RIEN D'AUTRE :
 *     il est intercepté à la capture et le clic qui le suit est avalé ;
 *   · montants remplacés par « — € » et noms des clients tus quand le poste
 *     le demande ; rien de la famille Personnel, jamais ;
 *   · journée vide : « Plus rien aujourd'hui » en encre claire, pas d'ambre ;
 *   · après la fermeture : mode nuit, l'heure seule en #3a3a3a et la date ;
 *   · la composition glisse de ± 8 px toutes les dix minutes (marquage) ;
 *   · aucun texte sous 15 px hors surtitres (11–13 px, capitales espacées),
 *     tous les chiffres en JetBrains Mono.
 * L'ambre : l'heure du prochain rendez-vous et son bloc sur la bande.
 */
const JOURS = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];
const MOIS = ['JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE'];
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const heures = (d: Date) => d.getHours() + d.getMinutes() / 60;
const euros = (c: number) => `${(c / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
const CONTACTS = ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'wheel'] as const;
const AVALES = ['click', 'mouseup', 'pointerup', 'touchend', 'keyup', 'contextmenu'] as const;

interface Intervention {
  clientName: string;
  at: string;
  closedAt: string;
}
interface Comptage {
  day: string;
  countedAt: string;
}

export function VeilleCliente() {
  const [reglages, setReglages] = useState<ReglagesVeille>(() => lireReglagesVeille());
  useEffect(() => {
    const maj = () => setReglages(lireReglagesVeille());
    window.addEventListener(EVENEMENT_REGLAGES, maj);
    window.addEventListener('storage', maj);
    return () => {
      window.removeEventListener(EVENEMENT_REGLAGES, maj);
      window.removeEventListener('storage', maj);
    };
  }, []);
  const { actif, declencher, reveiller } = useInactivite(reglages.delaiMin === 0 ? null : reglages.delaiMin * 60_000);

  /* L'aperçu demandé depuis Paramètres. */
  useEffect(() => {
    window.addEventListener(EVENEMENT_APERCU, declencher);
    return () => window.removeEventListener(EVENEMENT_APERCU, declencher);
  }, [declencher]);

  /*
    LE PREMIER CONTACT NE DÉCLENCHE RIEN. Intercepté à la CAPTURE sur la
    fenêtre — avant tout écouteur de l'écran d'en dessous —, il réveille et
    s'arrête là. Ce qui le suit dans la même seconde (le relâchement, le clic
    synthétisé, la touche relevée) est avalé aussi : un clic pour réveiller
    n'est jamais un clic sur un bouton.
  */
  const avalerJusqua = useRef(0);
  useEffect(() => {
    const contact = (e: Event) => {
      if (!actif) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      avalerJusqua.current = Date.now() + 1000;
      reveiller();
    };
    const avaler = (e: Event) => {
      if (Date.now() > avalerJusqua.current) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    for (const t of CONTACTS) window.addEventListener(t, contact, { capture: true, passive: false });
    for (const t of AVALES) window.addEventListener(t, avaler, { capture: true, passive: false });
    return () => {
      for (const t of CONTACTS) window.removeEventListener(t, contact, { capture: true });
      for (const t of AVALES) window.removeEventListener(t, avaler, { capture: true });
    };
  }, [actif, reveiller]);

  if (!actif) return null;
  return <Vitrine reglages={reglages} />;
}

function Vitrine({ reglages }: { reglages: ReglagesVeille }) {
  const { org } = useAuth();
  const { appointments } = useAppointments();
  const { invoices } = useInvoices();
  const interventions = useCollection<Intervention>('interventions');
  const comptages = useCollection<Comptage>('cashCounts');
  const [maintenant, setMaintenant] = useState(() => new Date());
  /* L'heure et le trait avancent À LA MINUTE : calés sur le changement de minute, pas sur l'ouverture. */
  useEffect(() => {
    let u: ReturnType<typeof setInterval> | undefined;
    const d = setTimeout(() => {
      setMaintenant(new Date());
      u = setInterval(() => setMaintenant(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      clearTimeout(d);
      if (u) clearInterval(u);
    };
  }, []);

  const t = maintenant.getTime();
  const masque = masqueEffectif(reglages);
  const nuit = enModeNuit(maintenant, reglages.fermetureH);
  const { x, y } = derive(t);
  const cle = dayKey(maintenant);
  const jourIso = isoDay(maintenant);
  const duJour = appointments.filter((a) => dayKey(new Date(a.startAt)) === cle).sort((a, b) => a.startAt.localeCompare(b.startAt));
  const prochain = duJour.find((a) => new Date(a.startAt).getTime() > t) ?? null;

  const payees = invoices.filter((f) => f.kind !== 'creditNote' && f.status === 'paid' && f.paidAt === jourIso);
  const encaisse = payees.reduce((s, f) => s + invoiceTotals(f).grossCents, 0);
  const route = interventions.find((i) => !i.closedAt && dayKey(new Date(i.at)) === cle && new Date(i.at).getTime() <= t) ?? null;
  const comptee = comptages.find((c) => c.day === jourIso) ?? null;

  const date = `${JOURS[maintenant.getDay()]} ${maintenant.getDate()} ${MOIS[maintenant.getMonth()]}`;

  return (
    <div className="fixed inset-0 z-[210] cursor-none overflow-hidden bg-[#030303] bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,.035),transparent_55%)]" role="presentation" aria-label="Écran de veille">
      <div className="absolute inset-0 transition-transform duration-[2000ms] ease-out" style={{ transform: `translate(${x}px, ${y}px)` }}>
        {nuit ? (
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <span className="tnum font-mono text-[clamp(96px,14vw,168px)] font-bold leading-[0.9] tracking-[-0.07em] text-[#3a3a3a]">{hhmm(maintenant)}</span>
            <span className="tnum font-mono text-[13px] tracking-[0.18em] text-[#3a3a3a]">{date}</span>
          </div>
        ) : (
          <div className="mx-auto flex h-full max-w-[1400px] flex-col px-5 py-6 sm:px-16 sm:py-[52px]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="flex items-center gap-3">
                <span className="souffle-veille h-[7px] w-[7px] rounded-full bg-text-primary" />
                <span className="font-mono text-[12px] font-medium tracking-[0.22em] text-text-muted">{(org?.name ?? 'Votre espace').toUpperCase()}</span>
              </span>
              <span className="tnum font-mono text-[13px] tracking-[0.18em] text-text-muted">{date}</span>
            </div>

            <div className="mt-6 flex flex-1 flex-col justify-between gap-6 sm:mt-12 sm:gap-10 lg:flex-row lg:items-start">
              <span className="tnum font-mono text-[clamp(88px,14vw,168px)] font-bold leading-[0.9] tracking-[-0.07em] text-text-primary">{hhmm(maintenant)}</span>
              <div className="w-full max-w-[430px] lg:mt-7">
                <span className="block font-mono text-[12px] font-medium tracking-[0.2em] text-text-muted">PROCHAIN RENDEZ-VOUS</span>
                {prochain ? (
                  <>
                    <span data-signal-groupe="prochain" className="tnum mt-3.5 block font-mono text-[44px] font-bold tracking-[-0.04em] text-signal">
                      {hhmm(new Date(prochain.startAt))}
                    </span>
                    <span className="mt-2 block text-[30px] font-bold leading-[1.15] tracking-[-0.02em] text-text-primary">
                      {masque ? `Rendez-vous de ${hhmm(new Date(prochain.startAt))}` : prochain.clientName || prochain.title}
                    </span>
                    {!masque && prochain.clientName && prochain.title && <span className="mt-2 block text-[18px] text-text-secondary">{prochain.title}</span>}
                  </>
                ) : (
                  <span className="mt-3.5 block text-[30px] font-bold leading-[1.15] tracking-[-0.02em] text-text-body">Plus rien aujourd’hui</span>
                )}
              </div>
            </div>

            <div className="mt-6 sm:mt-10">
              <div className="relative h-10 border border-border-row bg-[#0a0a0a] bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.035)_0_1px,transparent_1px_calc(100%/12))]">
                {duJour.map((a) => {
                  const p = surLaBande(heures(new Date(a.startAt)), a.durationMin / 60);
                  if (!p) return null;
                  const estProchain = a.id === prochain?.id;
                  const passe = appointmentEnd(a).getTime() <= t || new Date(a.startAt).getTime() <= t;
                  return (
                    <span
                      key={a.id}
                      data-signal-groupe={estProchain ? 'prochain' : undefined}
                      className={`absolute inset-y-0 ${estProchain ? 'bg-signal shadow-[0_0_30px_-4px_rgba(208,154,74,.8)]' : passe ? 'bg-border-raised' : 'bg-[#4a4a48]'}`}
                      style={{ left: `${p.gauche}%`, width: `${p.largeur}%` }}
                    />
                  );
                })}
                <span className="absolute -inset-y-3 w-0.5 bg-text-primary" style={{ left: `${traitMaintenant(heures(maintenant))}%` }} />
              </div>
              <div className="relative mt-3 h-4 font-mono text-[12px] tracking-[0.1em] text-[#4a4a48]">
                <span className="absolute left-0">{String(BANDE.debutH).padStart(2, '0')}</span>
                <span className="absolute left-1/3 -translate-x-1/2">12</span>
                <span className="absolute left-2/3 -translate-x-1/2">16</span>
                <span className="absolute right-0">{BANDE.finH}</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 border-t border-border-row pt-5 sm:mt-10 sm:grid-cols-3 sm:gap-10 sm:pt-[30px]">
              <Releve surtitre="ENCAISSÉ AUJOURD’HUI" valeur={masque ? MONTANT_MASQUE : euros(encaisse)} detail={payees.length === 0 ? 'rien encore' : `${payees.length} encaissement${payees.length > 1 ? 's' : ''}`} />
              <Releve
                surtitre="SUR LA ROUTE"
                valeur={route ? 'en intervention' : 'personne'}
                detail={route ? `${masque ? 'depuis' : `chez ${route.clientName} depuis`} ${hhmm(new Date(route.at))}` : 'aucune intervention en cours'}
              />
              <Releve surtitre="CAISSE" valeur={comptee ? 'comptée' : 'à compter'} detail={comptee ? `à ${hhmm(new Date(comptee.countedAt))}` : 'pas encore comptée aujourd’hui'} />
            </div>

            <span className="mt-5 self-end font-mono sm:mt-8 text-[11px] tracking-[0.16em] text-[#3a3a3a]">TOUCHEZ L’ÉCRAN POUR REPRENDRE</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Releve({ surtitre, valeur, detail }: { surtitre: string; valeur: string; detail: string }) {
  return (
    <span className="min-w-0">
      <span className="block font-mono text-[11px] font-medium tracking-[0.18em] text-[#4a4a48]">{surtitre}</span>
      <span className="tnum mt-2 block whitespace-nowrap font-mono text-[32px] sm:mt-3 font-semibold tracking-[-0.03em] text-text-body">{valeur}</span>
      <span className="mt-1.5 block text-[15px] text-text-muted">{detail}</span>
    </span>
  );
}
