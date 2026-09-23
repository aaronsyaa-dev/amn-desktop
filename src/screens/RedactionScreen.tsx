import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Bloc, BoutonPrimaire, BoutonSecondaire, Calmes, CarteCalme, CarteReleves, Dominante, Ecran50, LigneBarre, PiedDominante, donnees } from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import { medianeNombres } from '../lib/cinquante/marketing';
import {
  type BrouillonRedaction,
  type MorceauBrouillon,
  type NatureEngagement,
  correctionsGardees,
  engagementDe,
  engagementEnAttente,
  lignesDesCorrections,
} from '../lib/cinquante/ajouts';
import { useLangue } from '../i18n';

/**
 * RÉDACTION — les ratures (`39i`).
 *
 * Le brouillon est rendu comme une page corrigée à la main : vos mots
 * restent, ce que l'assistant retire est barré, ce qu'il ajoute est souligné,
 * et chaque correction porte en marge sa raison. Rien n'est réécrit en
 * silence. Au-dessus, le texte auquel on répond reste visible.
 *
 * « Les ratures se lisent sans couleur » : barré et souligné suffisent ; la
 * couleur ne sert qu'à l'ambre de l'engagement. L'assistant ne publie
 * jamais : la publication est un geste de la personne.
 */

type B = BrouillonRedaction & { id: string; updatedAt: string };
type Correction = Extract<MorceauBrouillon, { type: 'correction' }>;

const NATURE: Record<NatureEngagement, { note: string; pied: string; retirer: string }> = {
  geste: { note: 'Promesse ajoutée — à valider', pied: 'Le geste commercial', retirer: 'Retirer la promesse' },
  date: { note: 'Date promise — à valider', pied: 'La date', retirer: 'Retirer la date' },
  prix: { note: 'Prix ajouté — à valider', pied: 'Le prix', retirer: 'Retirer le prix' },
};
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function RedactionScreen() {
  const { t } = useLangue();
  const { upsert } = useSync();
  const tout = useCollection<BrouillonRedaction>('writingDrafts');
  const [maintenant] = useState(() => new Date());

  const brouillons = useMemo(() => tout.filter((e): e is B => e.kind === 'brouillon').sort((a, b) => b.creeLe.localeCompare(a.creeLe)), [tout]);
  /* Le brouillon montré : le plus récent qui attend encore une décision sur un engagement ; sinon le plus récent non publié. */
  const courant = brouillons.find((b) => !b.publieeLe && engagementEnAttente(b.morceaux) !== null) ?? brouillons.find((b) => !b.publieeLe) ?? brouillons[0] ?? null;
  const vide = brouillons.length === 0;
  const iAmbre = courant ? engagementEnAttente(courant.morceaux) : null;
  const ambre = iAmbre !== null && courant ? (courant.morceaux[iAmbre] as Correction) : null;
  const nature = ambre ? engagementDe(ambre.ajoute) : null;
  const lignes = courant ? lignesDesCorrections(courant.morceaux) : [];

  const decider = async (i: number, decision: 'acceptee' | 'refusee') => {
    if (!courant) return;
    await upsert('writingDrafts', courant.id, {
      ...donnees(courant),
      morceaux: courant.morceaux.map((m, k) => (k === i && m.type === 'correction' ? { ...m, decision } : m)),
    });
  };
  const publier = async () => {
    if (!courant) return;
    await upsert('writingDrafts', courant.id, { ...donnees(courant), publieeLe: new Date().toISOString() });
  };

  const moisIso = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`;
  const duMois = brouillons.filter((b) => b.creeLe.startsWith(moisIso));
  const publiees = brouillons.filter((b) => b.publieeLe?.startsWith(moisIso));
  const decidees = duMois.flatMap((b) => b.morceaux.filter((m): m is Correction => m.type === 'correction'));
  const tauxAcceptees = decidees.length ? Math.round((decidees.filter((m) => m.decision !== 'refusee').length / decidees.length) * 100) : null;
  const delais = publiees.map((b) => (new Date(b.publieeLe as string).getTime() - new Date(b.source.recuLe).getTime()) / 3_600_000);
  const delaiH = delais.length ? Math.round(medianeNombres(delais.map((d) => Math.round(d * 10))) / 10) : null;

  const pied = (() => {
    if (!courant) return '';
    if (ambre && nature)
      return `« ${ambre.ajoute?.trim()} » : l’assistant l’a ajouté, vous ne l’aviez pas écrit. La réponse tient sans cet ajout. ${NATURE[nature].pied} est à vous de décider, pas à l’assistant.`;
    if (courant.publieeLe) return `Réponse publiée par vous le ${new Date(courant.publieeLe).getDate()} ${MOIS[new Date(courant.publieeLe).getMonth()]}.`;
    const g = correctionsGardees(courant.morceaux);
    return `${g.gardees} correction${g.gardees > 1 ? 's' : ''} gardée${g.gardees > 1 ? 's' : ''} sur ${g.total}. Aucun engagement n’attend votre décision : la réponse peut partir.`;
  })();

  const description = vide ? t('m50.writing.descriptionVide') : ambre ? t('m50.writing.description') : t('m50.writing.descriptionSansEngagement');

  const ligneDe = new Map<number, number>();
  if (courant) courant.morceaux.forEach((m, i) => m.type === 'correction' && ligneDe.set(i, lignes[ligneDe.size]));
  const maxTotal = Math.max(1, ...brouillons.map((b) => correctionsGardees(b.morceaux).total));

  return (
    <Ecran50 vide={vide} premierJour={vide}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.outils'), module: t('m50.writing.titre') })}
          title={t('m50.writing.titre')}
          description={description}
          phraseVide={t('m50.writing.phraseVide')}
        />
      </Bloc>

      <Dominante surtitre="La réponse, avec les corrections de l’assistant" note={courant ? 'Barré = retiré · souligné = ajouté' : undefined}>
        {!courant ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Quand vous aurez écrit une réponse, l’assistant la relira ici : ce qu’il retire sera barré, ce qu’il ajoute
            souligné, et chaque correction dira pourquoi. Rien n’est réécrit en silence.
          </p>
        ) : (
          <>
            <div className="mb-[18px] border-l-2 border-[#4a4a48] bg-sunken px-4 py-3">
              <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">{courant.source.surtitre}</span>
              <span className="mt-1.5 block text-[13px] leading-[1.55] text-text-secondary">« {courant.source.texte} »</span>
            </div>

            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_200px]">
              <div className="bg-[#e8e6e0] px-5 py-[22px] text-[15px] leading-[1.85] text-[#1a1a1a] shadow-[0_30px_60px_-26px_rgba(0,0,0,1)] sm:px-6">
                {courant.morceaux.map((m, i) => {
                  if (m.type === 'texte') return <React.Fragment key={i}>{m.texte}</React.Fragment>;
                  const a = i === iAmbre;
                  return (
                    <React.Fragment key={i}>
                      {m.retire && m.decision !== 'refusee' && <s className="text-[#67655e]">{m.retire}</s>}
                      {m.retire && m.decision === 'refusee' && m.retire}
                      {m.retire && m.ajoute && m.decision !== 'refusee' && ' '}
                      {m.ajoute && m.decision !== 'refusee' && (
                        <u
                          data-signal-groupe={a ? 'engagement' : undefined}
                          className={a ? 'bg-[rgba(208,154,74,.3)] decoration-signal decoration-2 outline outline-2 outline-offset-2 outline-signal' : ''}
                        >
                          {m.ajoute}
                        </u>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
              <div className="flex flex-col gap-3.5 md:pt-3">
                {courant.morceaux.map((m, i) => {
                  if (m.type !== 'correction') return null;
                  const ligne = ligneDe.get(i);
                  const nat = engagementDe(m.ajoute);
                  if (i === iAmbre && nat)
                    return (
                      <span key={i} className="border-2 border-signal bg-[#1c1408] px-[11px] py-2.5 shadow-[0_0_28px_-7px_rgba(208,154,74,.85)]" data-signal-groupe="engagement">
                        <span className="block font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-signal">{NATURE[nat].note}</span>
                        <span className="mt-1 block text-[12px] text-text-body">{m.valeur ?? m.explication}</span>
                      </span>
                    );
                  return (
                    <span key={i}>
                      <span className="block font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-muted">
                        Ligne {ligne} · {m.raison}
                        {m.decision === 'refusee' ? ' · refusée' : nat && m.decision === 'acceptee' ? ' · acceptée' : ''}
                      </span>
                      <span className="mt-[3px] block text-[12px] text-text-secondary">{m.explication}</span>
                    </span>
                  );
                })}
              </div>
            </div>

            <PiedDominante
              action={
                ambre && iAmbre !== null ? (
                  <span className="flex flex-wrap gap-2">
                    <BoutonSecondaire onClick={() => void decider(iAmbre, 'refusee')}>{nature ? NATURE[nature].retirer : 'Retirer'}</BoutonSecondaire>
                    <BoutonSecondaire onClick={() => void decider(iAmbre, 'acceptee')}>La garder</BoutonSecondaire>
                  </span>
                ) : !courant.publieeLe ? (
                  <BoutonPrimaire onClick={() => void publier()}>Publier la réponse</BoutonPrimaire>
                ) : undefined
              }
            >
              {pied}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Les réponses du mois" note={duMois.length ? 'Corrections gardées' : undefined}>
          {duMois.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucune réponse rédigée ce mois-ci.</p>
          ) : (
            duMois.map((b, i) => {
              const g = correctionsGardees(b.morceaux);
              return <LigneBarre key={b.id} nom={b.titre} part={g.gardees / maxTotal} valeur={`${g.gardees} / ${g.total}`} derniere={i === duMois.length - 1} />;
            })
          )}
        </CarteCalme>
        <CarteReleves
          surtitre={MOIS[maintenant.getMonth()].replace(/^./, (x) => x.toUpperCase())}
          releves={[
            { label: 'Réponses publiées', valeur: publiees.length },
            { label: 'Corrections acceptées', valeur: tauxAcceptees === null ? '—' : `${tauxAcceptees} %` },
            { label: 'Délai de réponse', valeur: delaiH === null ? '—' : `${delaiH} h` },
          ]}
        >
          L’assistant n’a jamais la main sur la publication : il rend un brouillon corrigé.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
