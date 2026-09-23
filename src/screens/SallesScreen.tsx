import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Bloc, BoutonSecondaire, Calmes, CarteCalme, CarteReleves, Dominante, Ecran50, LigneRegistre, PiedDominante, donnees } from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import {
  type EnregistrementSalle,
  type EtatPiece,
  type PlanEtage,
  type PresenceSalle,
  type ReservationSalle,
  estFantome,
  etatPiece,
} from '../lib/cinquante/ajouts';
import { useLangue } from '../i18n';

/**
 * SALLES — le plan d'étage (`39h`).
 *
 * Les locaux vus de dessus, chaque pièce à sa place et dans ses proportions,
 * murs épais. L'état de chaque pièce À L'INSTANT est son remplissage : pleine
 * si quelqu'un y est, vide si elle est libre. Le plan est une grille à zones
 * nommées (`grid-template-areas`), jamais des positions absolues.
 *
 * Le matériel se réserve dans Matériel ; ici, on ne réserve que des lieux.
 */

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const heure = (iso: string | Date) => {
  const d = new Date(iso);
  return d.getMinutes() ? `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}` : `${d.getHours()} h`;
};
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const prenom = (nom: string) => nom.split(/\s+/)[0];
const OUVERTURE = { debutH: 8, finH: 18 };

function Piece({ nom, zone, e }: { nom: string; zone: string; e: EtatPiece }) {
  const fantome = e.etat === 'fantome';
  const pleine = e.etat === 'occupee';
  const [etiquette, detail] =
    e.etat === 'occupee'
      ? ['Occupée', `${prenom(e.presence.qui)}${e.jusqua ? ` · jusqu’à ${heure(e.jusqua)}` : ''}`]
      : e.etat === 'fantome'
        ? ['Réservée, vide', `réservée à ${heure(e.reservation.debut)} · personne depuis ${e.videDepuisMin} min`]
        : e.etat === 'reservee'
          ? ['Réservée', `${prenom(e.reservation.pour)} · attendu à ${heure(e.reservation.debut)}`]
          : ['Libre', e.prochaine ? `libre jusqu’à ${heure(e.prochaine.debut)}` : '—'];
  return (
    <div
      data-signal-groupe={fantome ? 'fantome' : undefined}
      className={`flex min-w-0 flex-col justify-between gap-2 border-2 px-3 py-3 sm:px-3.5 ${
        fantome
          ? 'border-dashed border-signal bg-[#1c1408] shadow-[0_0_28px_-7px_rgba(208,154,74,.85)]'
          : pleine
            ? 'border-border-strong bg-[#2b2b2b]'
            : 'border-border-strong bg-elevated'
      }`}
      style={{ gridArea: zone }}
    >
      <span className="text-[13px] font-semibold text-text-primary [overflow-wrap:anywhere] sm:text-[14px]">{nom}</span>
      <span>
        <span className={`block font-mono text-[9px] font-bold uppercase tracking-[0.12em] ${fantome ? 'text-signal' : pleine ? 'text-text-body' : 'text-text-muted'}`}>
          {etiquette}
        </span>
        <span className={`mt-[3px] block text-[11.5px] [text-wrap:pretty] ${fantome ? 'text-signal' : 'text-text-secondary'}`}>{detail}</span>
      </span>
    </div>
  );
}

export function SallesScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const tout = useCollection<EnregistrementSalle>('roomBookings');
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const plan = tout.find((e): e is PlanEtage & { id: string; updatedAt: string } => e.kind === 'plan') ?? null;
  const reservations = useMemo(() => tout.filter((e): e is ReservationSalle & { id: string; updatedAt: string } => e.kind === 'reservation'), [tout]);
  const presences = useMemo(() => tout.filter((e): e is PresenceSalle & { id: string; updatedAt: string } => e.kind === 'presence'), [tout]);
  const vide = !plan || plan.pieces.length === 0;

  const etats = (plan?.pieces ?? []).map((p) => ({ p, e: etatPiece(p.nom, reservations, presences, maintenant) }));
  /* Une seule pièce en ambre : celle qui attend depuis le plus longtemps. */
  const fantomes = etats.filter((x) => x.e.etat === 'fantome').sort((a, b) => (b.e.etat === 'fantome' ? b.e.videDepuisMin : 0) - (a.e.etat === 'fantome' ? a.e.videDepuisMin : 0));
  const ambre = fantomes[0] ?? null;
  const resAmbre = ambre && ambre.e.etat === 'fantome' ? (ambre.e.reservation as ReservationSalle & { id: string; updatedAt: string }) : null;

  const jour = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}-${String(maintenant.getDate()).padStart(2, '0')}`;
  const duJour = reservations.filter((r) => r.debut.slice(0, 10) === jour).sort((a, b) => a.debut.localeCompare(b.debut));

  /* Le mois : présence réelle rapportée aux heures d'ouverture écoulées, par pièce. */
  const moisIso = jour.slice(0, 7);
  const mesure = useMemo(() => {
    const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
    let ouvertMin = 0;
    for (let d = new Date(debutMois); d <= maintenant; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const a = new Date(d.getFullYear(), d.getMonth(), d.getDate(), OUVERTURE.debutH).getTime();
      const b = Math.min(new Date(d.getFullYear(), d.getMonth(), d.getDate(), OUVERTURE.finH).getTime(), maintenant.getTime());
      ouvertMin += Math.max(0, (b - a) / 60_000);
    }
    const presentMin = presences
      .filter((p) => p.arriveeLe.startsWith(moisIso))
      .reduce((s, p) => s + Math.max(0, ((p.departLe ? new Date(p.departLe) : maintenant).getTime() - new Date(p.arriveeLe).getTime()) / 60_000), 0);
    const pieces = plan?.pieces.length ?? 0;
    return pieces && ouvertMin ? Math.round((presentMin / (ouvertMin * pieces)) * 100) : null;
  }, [presences, plan, maintenant, moisIso]);
  const duMois = reservations.filter((r) => r.debut.startsWith(moisIso));
  const fantomesMois = duMois.filter((r) => estFantome(r, presences, maintenant)).length;
  const parPiece = new Map<string, number>();
  for (const r of duMois) parPiece.set(r.piece, (parPiece.get(r.piece) ?? 0) + 1);
  const demandee = [...parPiece.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const court = (nom: string) => plan?.pieces.find((p) => p.nom === nom)?.court ?? nom.toLowerCase();

  const prevenir = async () => {
    if (!resAmbre) return;
    await upsert('roomBookings', resAmbre.id, { ...donnees(resAmbre), prevenuLe: new Date().toISOString() });
    if (resAmbre.contact) window.location.href = `mailto:${resAmbre.contact}?subject=${encodeURIComponent(`${resAmbre.motif} — ${resAmbre.piece}`)}`;
  };

  const description = vide
    ? t('m50.rooms.descriptionVide')
    : ambre && ambre.e.etat === 'fantome'
      ? t('m50.rooms.description', { minutes: L(ambre.e.videDepuisMin) })
      : t('m50.rooms.descriptionSansFantome');

  const pied =
    ambre && ambre.e.etat === 'fantome'
      ? `${/^salle /i.test(ambre.p.nom) ? `La ${ambre.p.nom.charAt(0).toLowerCase()}${ambre.p.nom.slice(1)}` : ambre.p.nom} est réservée depuis ${heure(ambre.e.reservation.debut)} pour ${ambre.e.reservation.motif}, et personne n’est arrivé. Elle se libère d’elle-même à ${heure(ambre.e.liberationLe)}.${
          ambre.e.reservation.prevenuLe ? ` Un message est parti à ${prenom(ambre.e.reservation.pour)}.` : ''
        }`
      : etats.some((x) => x.e.etat === 'occupee')
        ? `${L(etats.filter((x) => x.e.etat === 'occupee').length, true)} pièce${etats.filter((x) => x.e.etat === 'occupee').length > 1 ? 's' : ''} sur ${L(etats.length)} occupée${
            etats.filter((x) => x.e.etat === 'occupee').length > 1 ? 's' : ''
          } en ce moment ; aucune réservation n’attend dans le vide.`
        : 'Toutes les pièces sont libres en ce moment.';

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.collectif'), module: t('m50.rooms.titre') })}
          title={t('m50.rooms.titre')}
          description={description}
          phraseVide={t('m50.rooms.phraseVide')}
        />
      </Bloc>

      <Dominante surtitre={`Les locaux · maintenant, ${hhmm(maintenant)}`} note={vide ? undefined : 'Pleine = quelqu’un y est · pointillé = réservée mais vide'}>
        {!plan || vide ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Les locaux se dessineront ici vus de dessus, pièce par pièce : pleine si quelqu’un y est, vide si elle est libre,
            avec qui l’occupe et jusqu’à quand.
          </p>
        ) : (
          <>
            <div
              className="grid gap-1.5 bg-border-strong p-1.5"
              style={{
                gridTemplateColumns: plan.colonnes,
                gridTemplateRows: plan.rangees.map((h) => `minmax(${h}px, auto)`).join(' '),
                gridTemplateAreas: plan.zones.map((z) => `'${z}'`).join(' '),
              }}
            >
              {etats.map((x) => (
                <Piece key={x.p.nom} nom={x.p.nom} zone={x.p.zone} e={x.e} />
              ))}
            </div>

            <PiedDominante
              action={resAmbre && !resAmbre.prevenuLe ? <BoutonSecondaire onClick={() => void prevenir()}>Prévenir {prenom(resAmbre.pour)}</BoutonSecondaire> : undefined}
            >
              {pied}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Aujourd’hui" note={duJour.length ? 'Pièce · créneau' : undefined}>
          {duJour.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucune réservation aujourd’hui.</p>
          ) : (
            duJour.map((r, i) => (
              <LigneRegistre key={r.id} colonnes="minmax(0,1fr) auto minmax(0,130px)" derniere={i === duJour.length - 1}>
                <span className="min-w-0 text-[13.5px] text-text-primary">{r.piece}</span>
                <span className="tnum font-mono text-[11.5px] text-text-secondary">
                  {heure(r.debut)} – {heure(r.fin)}
                </span>
                <span className="min-w-0 text-right font-mono text-[11.5px] text-text-secondary">{r.motif}</span>
              </LigneRegistre>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre={MOIS[maintenant.getMonth()].replace(/^./, (x) => x.toUpperCase())}
          releves={[
            { label: 'Occupation', valeur: mesure === null ? '—' : `${mesure} %` },
            { label: 'Réservations fantômes', valeur: fantomesMois },
            { label: 'La plus demandée', valeur: demandee ? court(demandee) : '—' },
          ]}
        >
          Une réservation fantôme n’empêche jamais une autre personne d’utiliser la pièce.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
