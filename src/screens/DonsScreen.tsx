import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Bloc,
  Calmes,
  CarteCalme,
  CarteReleves,
  Dominante,
  ENCRE_SURTITRE_PLAQUE,
  Ecran50,
  PiedDominante,
  hachure,
} from '../components/cinquante-kit';
import { useCollection } from '../state/SyncContext';
import { formatCentsCompact } from '../lib/money';
import { enLettres } from '../lib/cinquante/lettres';
import {
  type CampagneDons,
  type Contribution,
  type EnregistrementDons,
  type Id,
  contreparties,
  mediane,
  pont,
  previsionDons,
} from '../lib/cinquante/guichet';
import { useLangue } from '../i18n';

/**
 * DONS — le pont (`34c`).
 *
 * Chaque contribution est une planche posée d'une rive à l'autre, de largeur
 * `montant / objectif × 100 %`, dans l'ordre d'arrivée, en alternant deux
 * gris. Le trou entre le bout du tablier et l'autre rive, c'est ce qu'il reste
 * à trouver — il se voit sans lecture. La pile plantée dans la rivière marque
 * le seuil : en dessous, tout est remboursé.
 *
 * Les rives et le tablier partagent UNE grille `44px minmax(0,1fr) 44px`,
 * reprise telle quelle par l'axe des montants : une graduation recalée à la
 * main se serait décalée de la largeur d'une rive (README §0.6, règle 3).
 */
const GRILLE_PONT = 'grid grid-cols-[44px_minmax(0,1fr)_44px]';

function Pont({ camp, contributions }: { camp: CampagneDons; contributions: Id<Contribution>[] }) {
  const p = pont(camp, contributions);
  return (
    <>
      <div className={`${GRILLE_PONT} items-stretch`}>
        <span className="h-[150px] border-t-2 border-border-strong bg-[#1a1a1a]" aria-hidden />
        <div
          className="relative h-[150px] bg-[#0a0a0a]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 9px)' }}
          role="img"
          aria-label={`${contributions.length} contributions, ${formatCentsCompact(p.collecteCents)} sur ${formatCentsCompact(camp.objectifCents)}`}
        >
          {/* Le tablier : les planches, puis le trou — tout sur la même rangée de 40 px. */}
          <div className="absolute inset-x-0 top-0 flex h-10">
            {p.planches.map((pl) => (
              <span
                key={pl.id}
                className={`h-full flex-none border-r border-elevated ${pl.derniere ? 'bg-text-body' : pl.teinte ? 'bg-border-strong' : 'bg-[#4a4a48]'}`}
                style={{ width: `${pl.largeurPct.toFixed(3)}%` }}
              />
            ))}
            {p.trouCents > 0 && (
              <span
                data-signal-groupe="autre-rive"
                className="h-full flex-1"
                style={{
                  background: hachure('rgba(208,154,74,.55)', 9, 3),
                  backgroundColor: 'rgba(208,154,74,.12)',
                  boxShadow: 'inset 0 0 22px -6px rgba(208,154,74,.8)',
                }}
              />
            )}
          </div>
          {/* La pile du seuil, plantée dans la rivière à seuil / objectif. Elle reste grise. */}
          <span className="absolute bottom-0 top-10 w-1.5 -translate-x-1/2 bg-[#4a4a48]" style={{ left: `${p.seuilPct}%` }} />
          <span
            className="absolute bottom-2.5 -translate-x-1/2 whitespace-nowrap bg-[#0a0a0a] px-[7px] py-[3px] font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted"
            style={{ left: `${p.seuilPct}%` }}
          >
            Seuil · {formatCentsCompact(camp.seuilCents)}
          </span>
          {/* LA PLAQUE : dans la partie gauche du trou, sur une ligne, jamais sur la pile. */}
          {p.plaque && (
            <span
              data-signal-groupe="autre-rive"
              className="absolute top-[7px] flex h-[26px] items-center gap-2 whitespace-nowrap bg-signal px-2.5 shadow-[0_0_26px_-6px_var(--color-signal-glow)] [--plaque:5.5rem] sm:[--plaque:12.5rem]"
              /* La place de la plaque est réservée en largeur réelle, pas en
                 pourcentage : sur un téléphone, 26 % d'un tablier de 250 px ne
                 contiennent pas « pour l'autre rive », qui se retire alors. */
              style={{ left: `min(${p.plaque.gauchePct}%, calc(100% - var(--plaque)))` }}
            >
              <span className="tnum font-mono text-[13px] font-bold tracking-[-0.02em] text-signal-ink">{formatCentsCompact(p.trouCents)}</span>
              <span className={`font-mono text-[9px] font-bold uppercase tracking-[0.12em] max-sm:hidden ${ENCRE_SURTITRE_PLAQUE}`}>pour l’autre rive</span>
            </span>
          )}
        </div>
        <span className="h-[150px] border-t-2 border-border-strong bg-[#1a1a1a]" aria-hidden />
      </div>
      {/* L'axe des montants partage la grille du pont, rives comprises. */}
      <div className={`${GRILLE_PONT} mt-2.5`}>
        <span />
        <span className="relative h-[13px] font-mono text-[9.5px] tracking-[0.08em] text-text-muted">
          <span className="absolute left-0">0 €</span>
          {p.collectePct > 8 && p.collectePct < 92 && (
            <span className="tnum absolute -translate-x-1/2 text-text-body" style={{ left: `${p.collectePct}%` }}>
              {formatCentsCompact(p.collecteCents)}
            </span>
          )}
          <span className="absolute right-0">{formatCentsCompact(camp.objectifCents)}</span>
        </span>
        <span />
      </div>
    </>
  );
}

export function DonsScreen() {
  const { t, langue } = useLangue();
  const tout = useCollection<EnregistrementDons>('donations');
  const [maintenant] = useState(() => new Date());

  // La campagne montrée : celle qui n'est pas close, sinon la plus récente.
  const camp = useMemo(() => {
    const c = tout.filter((e): e is Id<CampagneDons> & { updatedAt: string } => e.kind === 'campagne');
    return c.find((x) => new Date(x.clotureLe) >= maintenant) ?? c.sort((a, b) => b.clotureLe.localeCompare(a.clotureLe))[0] ?? null;
  }, [tout, maintenant]);
  const contributions = useMemo(
    () => (camp ? tout.filter((e): e is Id<Contribution> & { updatedAt: string } => e.kind === 'contribution' && e.campagneId === camp.id) : []),
    [tout, camp],
  );
  const vide = !camp;
  const L = (n: number, maj = false) => enLettres(n, langue, maj);
  const collecte = contributions.reduce((s, c) => s + c.montantCents, 0);
  const prev = camp ? previsionDons(camp, contributions, maintenant) : null;
  const paliers = camp ? contreparties(camp, contributions) : [];
  const maxPalier = Math.max(1, ...paliers.map((x) => x.n));

  const description = !camp || !prev
    ? t('m50.donations.descriptionVide')
    : t('m50.donations.description', {
        n: L(contributions.length, true), collecte: formatCentsCompact(collecte), objectif: formatCentsCompact(camp.objectifCents),
        jours: L(prev.joursRestants), seuil: formatCentsCompact(camp.seuilCents),
      });

  const phrasePrevision = !camp || !prev
    ? ''
    : prev.parJourCents === 0
      ? 'Aucune contribution depuis sept jours : le tablier n’avance plus.'
      : `Au rythme des sept derniers jours, ${formatCentsCompact(prev.parJourCents)} par jour, le tablier ${
          prev.joursPourSeuil === 0 ? 'a déjà passé le seuil' : prev.seuilAvantCloture ? `atteint le seuil dans ${L(prev.joursPourSeuil ?? 0)} jours` : 'n’atteint pas le seuil avant la clôture'
        } et ${prev.objectifAvantCloture ? 'touche l’autre rive avant la clôture' : 'n’atteint pas l’autre rive avant la clôture'}. Le seuil suffit à déclencher la campagne ; l’objectif, non.`;

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.guichet'), module: t('m50.donations.titre') })}
          title={t('m50.donations.titre')}
          description={description}
          phraseVide={t('m50.donations.phraseVide')}
        />
      </Bloc>

      {!camp ? (
        <Dominante surtitre="Le pont · une planche par contribution">
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Une collecte en ligne se lira ici comme un pont : chaque contribution y pose une planche, et le trou qui
            reste jusqu’à l’autre rive est ce qu’il manque.
          </p>
        </Dominante>
      ) : (
        <Dominante surtitre="Le pont · une planche par contribution" note="Largeur = montant · ordre = arrivée">
          <Pont camp={camp} contributions={contributions} />
          <PiedDominante>
            {phrasePrevision}
          </PiedDominante>
        </Dominante>
      )}

      <Calmes>
        <CarteCalme surtitre="Les contreparties" note={camp ? `Prises par les ${contributions.length} contributeurs` : undefined}>
          {paliers.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Les paliers de la campagne s’afficheront ici.</p>
          ) : (
            paliers.map((pl, i) => (
              <div key={pl.desCents} className={`grid grid-cols-[88px_minmax(0,1fr)_28px] items-center gap-x-3 gap-y-2 py-2.5 sm:grid-cols-[100px_minmax(0,1fr)_minmax(60px,150px)_32px] sm:gap-3.5 ${i < paliers.length - 1 ? 'border-b border-border-row' : ''}`}>
                <span className="tnum font-mono text-[11.5px] font-medium text-text-muted">
                  {i === 0 ? `moins de ${formatCentsCompact(paliers[1]?.desCents ?? 0)}` : `dès ${formatCentsCompact(pl.desCents)}`}
                </span>
                <span className="min-w-0 text-[13px] leading-snug text-text-primary">{pl.contrepartie}</span>
                <span className="h-1.5 bg-[#191919] max-sm:col-start-2 max-sm:row-start-2"><span className="block h-1.5 bg-[#4a4a48]" style={{ width: `${(pl.n / maxPalier) * 100}%` }} /></span>
                <span className="tnum text-right font-mono text-[12px] text-text-secondary max-sm:col-start-3 max-sm:row-start-1">{pl.n}</span>
              </div>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="La campagne"
          releves={[
            { label: 'Contributeurs', valeur: contributions.length },
            { label: 'Contribution médiane', valeur: formatCentsCompact(mediane(contributions.map((c) => c.montantCents))) },
            { label: 'Jours restants', valeur: prev?.joursRestants ?? '—' },
          ]}
        >
          {camp
            ? `Sous le seuil à la clôture, les ${contributions.length} contributions sont remboursées automatiquement.`
            : 'Sous le seuil à la clôture, toutes les contributions sont remboursées automatiquement.'}
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
