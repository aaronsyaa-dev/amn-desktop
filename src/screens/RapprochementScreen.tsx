import React, { useMemo } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Bloc, BoutonSecondaire, Calmes, CarteCalme, CarteReleves, Dominante, Ecran50, LigneRegistre, PiedDominante } from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import { formatCents, formatCentsCompact } from '../lib/money';
import { enLettres } from '../lib/cinquante/lettres';
import { type EnregistrementRapprochement, type LigneBanque, fermeture } from '../lib/cinquante/finance';
import type { Id } from '../lib/cinquante/guichet';
import { useLangue } from '../i18n';

/**
 * RAPPROCHEMENT — la fermeture éclair (`36e`).
 *
 * Le relevé et les écritures sont les deux rubans. Chaque paire rapprochée
 * s'emboîte au centre, dent contre dent ; le curseur s'arrête là où le
 * rapprochement cesse ; en dessous, chaque ligne sans partenaire s'écarte de
 * l'axe, du côté de son ruban, face à la place vide de ce qui manque.
 *
 * « Une paire ne se ferme que si le montant correspond exactement ; une
 * tolérance ne s'applique qu'aux frais bancaires et elle est affichée. »
 * « Créer l'écriture » écrit réellement l'écriture manquante : la ligne se
 * ferme alors d'elle-même, au montant exact.
 */

const GRILLE = 'grid grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)]';
const jj = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const signe = (c: number) => `${c < 0 ? '−' : '+'} ${formatCents(Math.abs(c)).replace(/\s?€$/, '')}`;

function Dents({ fermees }: { fermees: boolean }) {
  const colonne = (couleur: string) => (
    <span className="flex flex-col gap-[3px]">
      {[0, 1, 2].map((i) => (
        <span key={i} className={`h-[5px] w-2.5 ${couleur}`} />
      ))}
    </span>
  );
  return fermees ? (
    <span className="flex justify-center" aria-hidden>
      {colonne('bg-[#4a4a48]')}
      <span className="mt-1">{colonne('bg-text-muted')}</span>
    </span>
  ) : (
    <span className="flex justify-between px-1.5" aria-hidden>
      {colonne('bg-[#2b2b2b]')}
      {colonne('bg-[#2b2b2b]')}
    </span>
  );
}

export function RapprochementScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const tout = useCollection<EnregistrementRapprochement>('bankLines');
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const f = useMemo(() => fermeture(tout), [tout]);
  const vide = tout.filter((e) => e.kind !== 'regle').length === 0;
  const ouvertes = f.ouvertesBanque.length + f.ouvertesEcritures.length;
  const debut = [...f.paires.map((p) => p.banque.le), ...f.ouvertesBanque.map((l) => l.le)].sort()[0];
  const ambreBanque = f.ambre?.cote === 'banque' ? (f.ouvertesBanque.find((l) => l.id === f.ambre?.id) ?? null) : null;
  const ambreEcriture = f.ambre?.cote === 'ecriture' ? (f.ouvertesEcritures.find((l) => l.id === f.ambre?.id) ?? null) : null;

  const creerEcriture = async (l: Id<LigneBanque>) => {
    await upsert('bankLines', `ecr-${l.id}`, { kind: 'ecriture', le: l.le, libelle: l.libelle.replace(/^(PRLV|VIR|CB)\s+/i, '').toLowerCase().replace(/^./, (c) => c.toUpperCase()), montantCents: l.montantCents });
  };

  const description = vide
    ? t('m50.reconciliation.descriptionVide')
    : ouvertes
      ? t('m50.reconciliation.description', { paires: L(f.paires.length, true), ouvertes: L(ouvertes) })
      : t('m50.reconciliation.descriptionFermee', { paires: L(f.paires.length, true) });

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.finance'), module: t('m50.reconciliation.titre') })}
          title={t('m50.reconciliation.titre')}
          description={description}
          phraseVide={t('m50.reconciliation.phraseVide')}
        />
      </Bloc>

      <Dominante
        surtitre={debut ? `Relevé ↔ écritures · depuis le ${new Date(debut).getDate()} ${['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][new Date(debut).getMonth()]}` : 'Relevé ↔ écritures'}
        note={vide ? undefined : 'Fermé = rapproché · ouvert = sans partenaire'}
      >
        {vide ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Le relevé bancaire importé et vos écritures formeront ici les deux rubans d’une fermeture éclair : chaque paire
            rapprochée se ferme au centre, et ce qui reste sans partenaire s’écarte de l’axe.
          </p>
        ) : (
          <>
            <div className={`${GRILLE} mb-2.5`}>
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-text-muted">Relevé bancaire</span>
              <span />
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-text-muted">Écritures</span>
            </div>
            <div className="flex flex-col gap-1">
              {f.paires.map((p) => (
                <div key={p.banque.id} className={`${GRILLE} min-h-10 items-center`}>
                  <div className="flex justify-between gap-2.5 border border-border-raised bg-[#151515] px-[11px] py-2 max-sm:flex-col max-sm:gap-0.5">
                    <span className="tnum min-w-0 font-mono [overflow-wrap:anywhere] text-[11px] font-medium text-text-secondary">
                      {jj(p.banque.le)} {p.banque.libelle}
                    </span>
                    <span className="tnum flex-none font-mono text-[11.5px] font-semibold text-text-body">{signe(p.banque.montantCents)}</span>
                  </div>
                  <Dents fermees />
                  <div className="min-w-0 border border-border-raised [overflow-wrap:anywhere] bg-[#151515] px-[11px] py-2 text-[12px] text-text-secondary">
                    {p.ecriture.libelle}
                    {p.regle?.fraisBancaires && p.ecriture.montantCents !== p.banque.montantCents ? ` · ± ${formatCents(p.regle.toleranceCents)}` : ''}
                  </div>
                </div>
              ))}
              {/* Le curseur de la fermeture : là où le rapprochement cesse. */}
              <div className={`${GRILLE} my-2 items-center`}>
                <span className="h-px bg-border-raised" />
                <span className="h-[22px] w-[30px] justify-self-center border border-text-muted bg-[#4a4a48] shadow-[inset_0_1px_0_rgba(255,255,255,.14)]" />
                <span className="h-px bg-border-raised" />
              </div>
              {f.ouvertesBanque.map((l) => {
                const a = l.id === ambreBanque?.id;
                return (
                  <div key={l.id} className={`${GRILLE} min-h-10 items-center`}>
                    <div
                      data-signal-groupe={a ? 'ligne-ouverte' : undefined}
                      className={`mr-3 flex justify-between gap-2.5 border px-[11px] py-2 max-sm:flex-col max-sm:gap-0.5 sm:mr-[30px] ${
                        a ? 'border-signal bg-[#1c1408] shadow-[0_0_28px_-7px_var(--color-signal-glow)]' : 'border-border-raised bg-[#151515]'
                      }`}
                    >
                      <span className={`tnum min-w-0 font-mono [overflow-wrap:anywhere] text-[11px] font-medium ${a ? 'text-text-primary' : 'text-text-secondary'}`}>
                        {jj(l.le)} {l.libelle}
                      </span>
                      <span className={`tnum flex-none font-mono text-[11.5px] font-semibold ${a ? 'text-signal' : 'text-text-body'}`}>{signe(l.montantCents)}</span>
                    </div>
                    <Dents fermees={false} />
                    {a ? (
                      <div data-signal-groupe="ligne-ouverte" className="ml-3 whitespace-nowrap border border-dashed border-signal px-[11px] py-2 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-signal sm:ml-[30px]">
                        Aucune écriture
                      </div>
                    ) : (
                      <span />
                    )}
                  </div>
                );
              })}
              {f.ouvertesEcritures.map((e) => {
                const a = e.id === ambreEcriture?.id;
                return (
                  <div key={e.id} className={`${GRILLE} min-h-10 items-center`}>
                    {a ? (
                      <div data-signal-groupe="ligne-ouverte" className="mr-3 whitespace-nowrap border border-dashed border-signal px-[11px] py-2 text-right font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-signal sm:mr-[30px]">
                        Aucune ligne
                      </div>
                    ) : (
                      <span />
                    )}
                    <Dents fermees={false} />
                    <div
                      data-signal-groupe={a ? 'ligne-ouverte' : undefined}
                      className={`ml-3 min-w-0 border px-[11px] [overflow-wrap:anywhere] px-[11px] py-2 text-[12px] sm:ml-[30px] ${a ? 'border-signal bg-[#1c1408] text-text-primary' : 'border-border-raised bg-[#151515] text-text-secondary'}`}
                    >
                      {e.libelle} · {formatCents(Math.abs(e.montantCents)).replace(/\s?€$/, '')}
                    </div>
                  </div>
                );
              })}
            </div>

            <PiedDominante
              action={ambreBanque ? <BoutonSecondaire onClick={() => void creerEcriture(ambreBanque)}>Créer l’écriture</BoutonSecondaire> : undefined}
            >
              {ambreBanque
                ? `La ligne « ${ambreBanque.libelle} » de ${formatCentsCompact(Math.abs(ambreBanque.montantCents))} n’a pas d’écriture : c’est la plus lourde des ${L(ouvertes)} lignes ouvertes.`
                : ambreEcriture
                  ? `L’écriture « ${ambreEcriture.libelle} » de ${formatCentsCompact(Math.abs(ambreEcriture.montantCents))} n’a aucune ligne au relevé : elle n’est pas encore passée en banque.`
                  : 'La fermeture est close : chaque ligne du relevé a son écriture.'}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Les règles apprises" note={f.regles.length ? 'Libellé → compte' : undefined}>
          {f.regles.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucune règle apprise pour l’instant.</p>
          ) : (
            f.regles.map((r, i) => (
              <LigneRegistre key={r.id} colonnes="minmax(0,1fr) minmax(0,1fr) auto" derniere={i === f.regles.length - 1}>
                <span className="min-w-0 font-mono text-[11.5px] text-text-primary">{r.libelle}</span>
                <span className="min-w-0 text-[12.5px] text-text-secondary">{r.cible}</span>
                <span className="tnum text-right font-mono text-[11.5px] text-text-secondary">
                  {r.fraisBancaires && r.toleranceCents ? `± ${formatCents(r.toleranceCents)}` : 'exact'}
                </span>
              </LigneRegistre>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Le rapprochement"
          releves={[
            { label: 'Paires automatiques', valeur: f.paires.length },
            { label: 'Lignes ouvertes', valeur: ouvertes },
            { label: 'À justifier', valeur: formatCents(f.aJustifier) },
          ]}
        >
          Une paire ne se ferme qu’au montant exact ; seuls les frais bancaires ont une tolérance, et elle est affichée.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
