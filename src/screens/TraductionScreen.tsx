import React, { useMemo } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Bloc,
  BoutonSecondaire,
  Calmes,
  CarteCalme,
  CarteReleves,
  Dominante,
  ENCRE_SURTITRE_PLAQUE,
  Ecran50,
  LigneRegistre,
  PiedDominante,
  donnees,
} from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import {
  type DocumentTraduit,
  type EnregistrementTraduction,
  type LangueCible,
  type TermeGlossaire,
  equivalent,
  mentionDe,
  mentionEnAttente,
  nombresAlteres,
} from '../lib/cinquante/ajouts';
import { useLangue } from '../i18n';

/**
 * TRADUCTION — l'interlinéaire (`39j`).
 *
 * Chaque ligne d'origine, et sa traduction juste en dessous, en plus petit et
 * en italique : on contrôle une traduction ligne à ligne, à l'endroit même.
 * Les termes du glossaire maison sont soulignés dans la traduction. Une
 * mention légale ne se traduit pas : elle se REMPLACE par son équivalent dans
 * le droit du pays du client, ou elle est signalée.
 */

type D = DocumentTraduit & { id: string; updatedAt: string };
type T = TermeGlossaire & { id: string; updatedAt: string };

const LANGUES: Record<LangueCible, { nom: string; adjectif: string }> = { de: { nom: 'allemand', adjectif: 'allemand' }, en: { nom: 'anglais', adjectif: 'anglais' } };
const PAYS: Record<string, string> = { CH: 'suisse', DE: 'allemand', BE: 'belge', GB: 'britannique', IT: 'italien', ES: 'espagnol' };

/** La traduction, avec les termes du glossaire soulignés là où ils sont rendus. */
function AvecGlossaire({ texte, termes }: { texte: string; termes: T[] }) {
  const trouves = termes.filter((g) => g.traduction && texte.includes(g.traduction));
  if (!trouves.length) return <>{texte}</>;
  const motif = new RegExp(`(${trouves.map((g) => g.traduction.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`);
  return (
    <>
      {texte.split(motif).map((morceau, i) => {
        const g = trouves.find((x) => x.traduction === morceau);
        return g ? (
          <u key={i} title={`Glossaire : ${g.terme} → ${g.traduction} (${g.validePar})`}>
            {morceau}
          </u>
        ) : (
          <React.Fragment key={i}>{morceau}</React.Fragment>
        );
      })}
    </>
  );
}

export function TraductionScreen() {
  const { t } = useLangue();
  const { upsert } = useSync();
  const tout = useCollection<EnregistrementTraduction>('translations');

  const documents = useMemo(() => tout.filter((e): e is D => e.kind === 'document').sort((a, b) => b.creeLe.localeCompare(a.creeLe)), [tout]);
  const termes = useMemo(() => tout.filter((e): e is T => e.kind === 'terme'), [tout]);
  const courant = documents.find((d) => mentionEnAttente(d.lignes) !== null) ?? documents[0] ?? null;
  const vide = documents.length === 0;
  const iAmbre = courant ? mentionEnAttente(courant.lignes) : null;
  const ligneAmbre = courant && iAmbre !== null ? courant.lignes[iAmbre] : null;
  const mention = ligneAmbre ? mentionDe(ligneAmbre.source) : null;
  const eq = ligneAmbre && courant ? equivalent(ligneAmbre.source, courant.pays, courant.langue) : null;
  const glossaire = courant ? termes.filter((g) => g.langue === courant.langue) : termes;

  const remplacer = async () => {
    if (!courant || iAmbre === null || !eq) return;
    await upsert('translations', courant.id, {
      ...donnees(courant),
      lignes: courant.lignes.map((l, i) => (i === iAmbre ? { ...l, traduction: eq.texte, remplacee: true } : l)),
    });
  };

  const langues = [...new Set(documents.map((d) => d.langue))].map((l) => LANGUES[l].nom);
  const pays = courant ? PAYS[courant.pays] ?? courant.pays : '';

  const pied = (() => {
    if (!courant) return '';
    if (ligneAmbre && mention)
      return `${mention.pourquoi} : traduite mot à mot, la mention ne veut rien dire pour un client ${pays}. ${
        eq ? eq.explication : 'Aucun équivalent n’est connu pour ce pays : la mention est signalée, à faire vérifier avant l’envoi.'
      }`;
    const alterees = courant.lignes.filter((l) => !l.remplacee && nombresAlteres(l.source, l.traduction).length > 0).length;
    return alterees
      ? `${alterees} ligne${alterees > 1 ? 's' : ''} ne reprenne${alterees > 1 ? 'nt' : ''} pas tels quels les montants, dates ou numéros de la source.`
      : 'Toutes les lignes sont traduites sous leur source, et les montants, dates et numéros sont repris tels quels.';
  })();

  const description = vide ? t('m50.translation.descriptionVide') : ligneAmbre ? t('m50.translation.description') : t('m50.translation.descriptionSansMention');

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.outils'), module: t('m50.translation.titre') })}
          title={t('m50.translation.titre')}
          description={description}
          phraseVide={t('m50.translation.phraseVide')}
        />
      </Bloc>

      <Dominante surtitre="Le document, ligne à ligne" note={courant ? `En clair = français · en italique = ${LANGUES[courant.langue].adjectif}` : undefined}>
        {!courant ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Un document traduit s’affichera ici ligne à ligne : l’original, et sa traduction glissée juste en dessous, pour
            relire les deux ensemble sans aller-retour.
          </p>
        ) : (
          <>
            <div className="bg-[#e8e6e0] px-5 pb-4 pt-5 shadow-[0_30px_60px_-26px_rgba(0,0,0,1)] sm:px-6">
              <span className="block pb-2 text-[16px] font-bold text-[#0a0a0a]">{courant.titre}</span>
              {courant.lignes.map((l, i) => {
                const a = i === iAmbre;
                const alteres = l.remplacee ? [] : nombresAlteres(l.source, l.traduction);
                if (a)
                  return (
                    <div
                      key={i}
                      data-signal-groupe="mention"
                      className="-mx-3 mt-2.5 bg-[rgba(208,154,74,.25)] px-3 py-2.5 shadow-[0_0_28px_-7px_rgba(208,154,74,.85)] outline outline-2 outline-signal"
                    >
                      <span className="block text-[14px] leading-[1.45] text-[#1a1a1a]">{l.source}</span>
                      <s className="mt-[3px] block text-[12.5px] italic leading-[1.45] text-[#5e4f36]">{l.traduction}</s>
                      <span className={`mt-1.5 block font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] ${ENCRE_SURTITRE_PLAQUE}`}>
                        Mention légale · à remplacer, pas à traduire
                      </span>
                    </div>
                  );
                return (
                  <div key={i} className={`py-2.5 ${i < courant.lignes.length - 1 ? 'border-b border-[#d4d2cc]' : ''}`}>
                    <span className="block text-[14px] leading-[1.45] text-[#1a1a1a]">{l.source}</span>
                    <span className="mt-[3px] block text-[12.5px] italic leading-[1.45] text-[#5a5852]">
                      <AvecGlossaire texte={l.traduction} termes={glossaire} />
                    </span>
                    {l.remplacee && <span className="mt-1 block font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#5c5a55]">Mention remplacée · droit {pays}</span>}
                    {alteres.length > 0 && (
                      <span className="mt-1 block font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#5c5a55]">À vérifier : {alteres.join(', ')} absent de la traduction</span>
                    )}
                  </div>
                );
              })}
            </div>

            <PiedDominante action={ligneAmbre && eq ? <BoutonSecondaire onClick={() => void remplacer()}>Remplacer la mention</BoutonSecondaire> : undefined}>{pied}</PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Le glossaire maison" note={glossaire.length ? 'Terme → traduction retenue' : undefined}>
          {glossaire.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun terme dans le glossaire.</p>
          ) : (
            glossaire.slice(0, 8).map((g, i, arr) => (
              <LigneRegistre key={g.id} colonnes="minmax(0,1fr) minmax(0,1fr) auto" derniere={i === arr.length - 1}>
                <span className="min-w-0 text-[13.5px] text-text-primary">{g.terme}</span>
                <span className="min-w-0 font-mono text-[11.5px] text-text-secondary [overflow-wrap:anywhere]">{g.traduction}</span>
                <span className="text-right font-mono text-[11.5px] text-text-secondary">{g.validePar.split(/\s+/)[0]}</span>
              </LigneRegistre>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Les traductions"
          releves={[
            { label: 'Documents traduits', valeur: documents.length },
            { label: 'Langues', valeur: langues.join(', ') || '—' },
            { label: 'Termes du glossaire', valeur: termes.length },
          ]}
        >
          Un terme du glossaire remplace toujours la traduction automatique.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
