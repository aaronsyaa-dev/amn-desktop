import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Bloc,
  BoutonSecondaire,
  Calmes,
  CarteCalme,
  CarteReleves,
  Dominante,
  Ecran50,
  LigneBarre,
  PiedDominante,
  donnees,
} from '../components/cinquante-kit';
import { uid, useCollection, useSync } from '../state/SyncContext';
import { formatCents, formatCentsCompact } from '../lib/money';
import { enLettres } from '../lib/cinquante/lettres';
import {
  type BilletVendu,
  type EnregistrementBilletterie,
  type EvenementBilletterie,
  type Id,
  TOURNIQUET,
  jourLocal,
  previsionRemplissage,
  tourniquet,
  ventesParJour,
} from '../lib/cinquante/guichet';
import { useLangue } from '../i18n';

/**
 * BILLETTERIE — le tourniquet (`34b`).
 *
 * Vu de dessus : un rotor à trois bras, un moyeu, et autour un cran par place
 * (`angle = 360 / jauge`). Une place vendue est un cran plein ; une place
 * libre, un cran vide cerclé d'ambre. On ne lit pas « 14 / 20 », on voit ce
 * qui reste ouvert.
 *
 * Le jour venu, le même tourniquet change de rôle : ses crans comptent les
 * ENTRÉES scannées à la porte, et le rotor tourne d'un tiers de tour à chaque
 * scan — le geste « Scanner une entrée » le fait tourner pour de vrai.
 */

const JOUR_SEMAINE = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const dateCourte = (d: Date) => `${JOUR_SEMAINE[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
/** Termine une phrase sans doubler le point d'une abréviation (« sept. »). */
const point = (s: string) => (s.endsWith('.') ? s : `${s}.`);

function Tourniquet({ evt, billets, maintenant }: { evt: EvenementBilletterie; billets: BilletVendu[]; maintenant: Date }) {
  const t = tourniquet(evt, billets, maintenant);
  const T = TOURNIQUET;
  const ambre = t.mode === 'ventes' && t.libres > 0;
  const bras = [0, 120, 240].map((a) => {
    const r = ((a - 90) * Math.PI) / 180;
    return { x: Math.round(Math.cos(r) * T.brasLongueur), y: Math.round(Math.sin(r) * T.brasLongueur) };
  });
  return (
    <svg viewBox={T.viewBox} className="block h-auto w-full max-w-[320px]" role="img" aria-label={`${t.vendus} places vendues sur ${evt.jauge}`}>
      <circle r={164} fill="none" stroke="var(--color-border)" strokeWidth={1} />
      <g data-signal-groupe={ambre ? 'places-libres' : undefined} style={ambre ? { filter: 'drop-shadow(0 0 5px rgba(208,154,74,.35))' } : undefined}>
        {t.crans.map((c) => (
          <rect
            key={c.angle}
            x={-T.cranLargeur / 2}
            y={-T.cranRayon}
            width={T.cranLargeur}
            height={T.cranHauteur}
            transform={`rotate(${c.angle})`}
            fill={c.plein ? 'var(--color-text-body)' : 'none'}
            stroke={c.plein ? 'none' : ambre ? 'var(--color-signal)' : 'var(--color-border-strong)'}
            strokeWidth={c.plein ? 0 : 2}
          />
        ))}
      </g>
      {/* Le rotor tourne d'un tiers de tour par entrée scannée, le jour même. */}
      <g
        stroke="var(--color-border-strong)"
        strokeWidth={T.brasEpaisseur}
        strokeLinecap="round"
        style={{ transform: `rotate(${t.rotationRotor}deg)`, transition: 'transform 420ms cubic-bezier(.2,.8,.2,1)' }}
      >
        {bras.map((b) => (
          <path key={`${b.x},${b.y}`} d={`M0 0 L${b.x} ${b.y}`} />
        ))}
      </g>
      <circle r={T.rayonMoyeu} fill="var(--color-elevated)" stroke="#333" strokeWidth={2} />
      <g data-signal-groupe={ambre ? 'places-libres' : undefined} fill={ambre ? 'var(--color-signal)' : 'var(--color-text-primary)'} fontFamily="JetBrains Mono, monospace" fontWeight={700} textAnchor="middle">
        <text y={4} fontSize={40}>{t.mode === 'entrees' ? t.entrees : t.libres}</text>
        <text y={T.libelleY[0]} fontSize={8.5} letterSpacing={1.4}>{t.mode === 'entrees' ? 'ENTRÉES' : 'PLACES'}</text>
        <text y={T.libelleY[1]} fontSize={8.5} letterSpacing={1.4}>{t.mode === 'entrees' ? 'SCANNÉES' : t.libres > 0 ? 'À VENDRE' : 'VENDUES'}</text>
      </g>
    </svg>
  );
}

export function BilletterieScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const tout = useCollection<EnregistrementBilletterie>('ticketSales');
  const [maintenant, setMaintenant] = useState(() => new Date());

  const evenements = useMemo(
    () => tout.filter((e): e is Id<EvenementBilletterie> & { updatedAt: string } => e.kind === 'evenement'),
    [tout],
  );
  // L'événement montré : le prochain à venir, sinon le dernier passé.
  const evt = useMemo(() => {
    const aVenir = evenements.filter((e) => jourLocal(e.date) >= jourLocal(maintenant)).sort((a, b) => a.date.localeCompare(b.date));
    return aVenir[0] ?? [...evenements].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  }, [evenements, maintenant]);
  const billets = useMemo(
    () => (evt ? tout.filter((b): b is Id<BilletVendu> & { updatedAt: string } => b.kind === 'billet' && b.evenementId === evt.id) : []),
    [tout, evt],
  );
  const valides = billets.filter((b) => !b.rembourseLe);
  const vide = !evt;

  const tq = evt ? tourniquet(evt, billets, maintenant) : null;
  const prev = evt ? previsionRemplissage(evt, billets, maintenant) : null;
  const parJour = evt ? ventesParJour(evt, billets, maintenant) : [];
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const vendreAuGuichet = async () => {
    if (!evt || !tq || tq.libres <= 0) return;
    const tarif = evt.tarifs.find((tr) => valides.filter((b) => b.tarif === tr.nom).length < tr.quota) ?? evt.tarifs[evt.tarifs.length - 1];
    await upsert('ticketSales', uid('billet'), {
      kind: 'billet', evenementId: evt.id, tarif: tarif.nom, acheteur: 'Au guichet', profil: 'inconnu',
      venduLe: new Date().toISOString(), montantCents: tarif.prixCents, fraisCents: 0,
    } satisfies BilletVendu);
    setMaintenant(new Date());
  };
  const scannerUneEntree = async () => {
    const suivant = valides.find((b) => !b.scanneLe);
    if (!suivant) return;
    await upsert('ticketSales', suivant.id, { ...donnees(suivant), scanneLe: new Date().toISOString() });
    setMaintenant(new Date());
  };

  const encaisse = valides.reduce((s, b) => s + b.montantCents, 0);
  const frais = valides.reduce((s, b) => s + b.fraisCents, 0);
  const rembourses = billets.filter((b) => b.rembourseLe);
  const profils = (['client', 'prospect', 'inconnu'] as const).map((p) => valides.filter((b) => b.profil === p).length);
  const joursOuverture = evt ? parJour.length : 0;

  const description = !evt || !tq || !prev
    ? t('m50.ticketing.descriptionVide')
    : tq.libres === 0
      ? t('m50.ticketing.descriptionComplet', { vendus: L(tq.vendus, true), jauge: L(evt.jauge) })
      : prev.completLe && prev.avantLaDateJours !== null
        ? t('m50.ticketing.description', {
            vendus: L(tq.vendus, true), jauge: L(evt.jauge), jours: L(joursOuverture),
            complet: dateCourte(prev.completLe), avance: L(prev.avantLaDateJours),
          })
        : t('m50.ticketing.descriptionLent', { vendus: L(tq.vendus, true), jauge: L(evt.jauge), jours: L(joursOuverture) });

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.guichet'), module: t('m50.ticketing.titre') })}
          title={t('m50.ticketing.titre')}
          description={description}
          phraseVide={t('m50.ticketing.phraseVide')}
          stats={evt && tq ? [
            { label: t('m50.ticketing.stat.vendus'), value: tq.vendus },
            { label: t('m50.ticketing.stat.libres'), value: tq.libres, emphasis: tq.libres > 0 },
            { label: t('m50.ticketing.stat.encaisse'), value: formatCentsCompact(encaisse) },
          ] : []}
        />
      </Bloc>

      {!evt || !tq || !prev ? (
        <Dominante surtitre="Le tourniquet">
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Un événement payant apparaîtra ici avec un cran par place autour de son tourniquet. Les places vendues se
            remplissent ; le jour venu, les mêmes crans comptent les entrées à la porte.
          </p>
        </Dominante>
      ) : (
        <Dominante
          surtitre={`${evt.titre} · ${dateCourte(new Date(evt.date))}`}
          note={tq.mode === 'entrees' ? 'Aujourd’hui : un cran par entrée scannée' : 'Un cran par place · plein = vendu'}
        >
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,340px)_1fr]">
            <div className="flex justify-center">
              <Tourniquet evt={evt} billets={billets} maintenant={maintenant} />
            </div>
            <div className="min-w-0">
              <span className="eyebrow block text-text-secondary">Les billets</span>
              <div className="mt-3.5 flex flex-col">
                {evt.tarifs.map((tr) => {
                  const pris = valides.filter((b) => b.tarif === tr.nom).length;
                  return (
                    <div key={tr.nom} className="grid grid-cols-[auto_56px_minmax(60px,1fr)_auto] items-center gap-3.5 border-b border-border py-3">
                      <span className="whitespace-nowrap text-[13.5px] font-semibold text-text-primary">{tr.nom}</span>
                      <span className="tnum font-mono text-[12.5px] font-medium text-text-secondary">{formatCentsCompact(tr.prixCents)}</span>
                      <span className="flex gap-[3px]" aria-label={`${pris} sur ${tr.quota}`}>
                        {Array.from({ length: tr.quota }, (_, i) => (
                          <span key={i} className={`h-2.5 flex-1 border ${i < pris ? 'border-transparent bg-text-body' : 'border-[#333]'}`} />
                        ))}
                      </span>
                      <span className="text-right text-[12px] text-text-muted">
                        {pris >= tr.quota ? 'épuisé' : `${tr.quota - pris} restant${tr.quota - pris > 1 ? 's' : ''}`}
                      </span>
                    </div>
                  );
                })}
              </div>
              <span className="mt-[22px] block font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">
                Vendus par jour · depuis l’ouverture
              </span>
              <div className="mt-2.5 flex h-11 items-end gap-1.5">
                {parJour.map((n, i) => (
                  <span key={i} className="flex h-11 flex-1 flex-col-reverse gap-0.5" title={`${n} billet${n > 1 ? 's' : ''}`}>
                    {Array.from({ length: Math.min(3, n) }, (_, k) => (
                      <span key={k} className="h-3 bg-[#4a4a48]" />
                    ))}
                  </span>
                ))}
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-muted">
                <span>{dateCourte(new Date(evt.ouvertureLe))}</span>
                <span>aujourd’hui</span>
              </div>
            </div>
          </div>
          <PiedDominante
            action={
              tq.mode === 'entrees' ? (
                <BoutonSecondaire onClick={() => void scannerUneEntree()} disabled={tq.entrees >= valides.length}>
                  Scanner une entrée
                </BoutonSecondaire>
              ) : tq.libres > 0 ? (
                <BoutonSecondaire onClick={() => void vendreAuGuichet()}>Vendre une place au guichet</BoutonSecondaire>
              ) : undefined
            }
          >
            {tq.mode === 'entrees'
              ? `${tq.entrees} entrée${tq.entrees > 1 ? 's' : ''} sur ${tq.vendus} billets. Le rotor tourne d’un tiers de tour à chaque billet scanné.`
              : tq.libres === 0
                ? 'Le dernier cran est pris : la liste d’attente s’est ouverte d’elle-même.'
                : prev.completLe
                  ? `${prev.rythmeParJour.toFixed(1).replace('.', ',')} billet par jour en moyenne depuis l’ouverture : les ${L(tq.libres)} places restantes partent en ${L(prev.joursPourRemplir ?? 0)} jours, soit ${point(dateCourte(prev.completLe))}`
                  : 'Aucune vente depuis l’ouverture : pas de rythme sur lequel prévoir le remplissage.'}
          </PiedDominante>
        </Dominante>
      )}

      <Calmes>
        <CarteCalme surtitre={`Les ${valides.length} acheteurs`} note={vide ? undefined : 'Qui ils sont déjà pour vous'}>
          {valides.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun billet vendu pour l’instant.</p>
          ) : (
            <>
              {(['Clients actuels', 'Prospects', 'Inconnus'] as const).map((nom, i) => (
                <LigneBarre key={nom} nom={nom} part={profils[i] / Math.max(1, ...profils)} valeur={profils[i]} derniere={i === 2} />
              ))}
              <p className="mt-4 text-[13px] leading-[1.55] text-text-secondary">
                Le jour venu, le tourniquet compte les entrées à la porte, billet scanné après billet scanné.
              </p>
            </>
          )}
        </CarteCalme>
        <CarteReleves
          surtitre={evt ? evt.titre : 'L’événement'}
          releves={[
            { label: 'Encaissé', valeur: formatCentsCompact(encaisse) },
            { label: 'Frais de paiement', valeur: formatCents(frais) },
            { label: 'Remboursements', valeur: rembourses.length === 0 ? 'aucun' : formatCentsCompact(rembourses.reduce((s, b) => s + b.montantCents, 0)) },
          ]}
        >
          Une liste d’attente s’ouvre d’elle-même quand le dernier cran est pris.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
