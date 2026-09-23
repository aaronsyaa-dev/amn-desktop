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
  LigneBarre,
  PiedDominante,
  donnees,
} from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import { type Clause, type ContratGenere, type EnregistrementClausier, PLI_PX, plier } from '../lib/cinquante/juridique';
import type { Id } from '../lib/cinquante/guichet';
import { useLangue } from '../i18n';

/**
 * CLAUSIER — le pliage (`38a`).
 *
 * Le contrat rendu comme la feuille qui sera signée. À gauche (au-dessus sur
 * un téléphone), les cinq réponses qui le conditionnent. Chaque clause qui
 * s'applique est un paragraphe ; chaque clause exclue est REPLIÉE en un pli
 * de 18 px avec son numéro et sa raison — jamais supprimée. Le pli garde le
 * texte intégral, lisible au survol.
 *
 * La réponse « client » est comparée à la FICHE CLIENT réelle : une clause
 * obligatoire repliée par une réponse fausse est une contradiction, signalée
 * en ambre au lieu d'être tranchée.
 */

const REPONSES: Array<[keyof ContratGenere['reponses'], string]> = [
  ['client', 'Client'],
  ['duree', 'Durée'],
  ['lieu', 'Lieu'],
  ['paiement', 'Paiement'],
  ['soustraitance', 'Sous-traitance'],
];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function ClausierScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const tout = useCollection<EnregistrementClausier>('clauseContracts');
  const fiches = useCollection<{ name: string; company: string }>('clients');
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const clauses = useMemo(() => tout.filter((e): e is Id<Clause> & { updatedAt: string } => e.kind === 'clause'), [tout]);
  const contrats = useMemo(
    () => tout.filter((e): e is Id<ContratGenere> & { updatedAt: string } => e.kind === 'contrat').sort((a, b) => b.genereLe.localeCompare(a.genereLe)),
    [tout],
  );
  const contrat = contrats[0] ?? null;
  const fiche = contrat ? fiches.find((f) => [f.name, f.company].some((n) => n && n.trim().toLowerCase() === contrat.client.trim().toLowerCase())) ?? null : null;
  const p = contrat ? plier(clauses, contrat, fiche) : null;
  const vide = !contrat;
  const majDerniere = clauses.map((c) => c.majLe).filter((x): x is string => !!x).sort().pop();

  const deplier = async () => {
    if (!contrat || !p?.ambre) return;
    await upsert('clauseContracts', contrat.id, { ...donnees(contrat), depliees: [...(contrat.depliees ?? []), p.ambre.clause.numero] });
  };

  const description = vide
    ? t('m50.clauses.descriptionVide')
    : p?.ambre
      ? t('m50.clauses.description', { n: L(REPONSES.length, true) })
      : t('m50.clauses.descriptionJuste', { n: L(REPONSES.length, true) });

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.juridique'), module: t('m50.clauses.titre') })}
          title={t('m50.clauses.titre')}
          description={description}
          phraseVide={t('m50.clauses.phraseVide')}
        />
      </Bloc>

      <Dominante surtitre="Le contrat, tel qu’il sera signé" note={vide ? undefined : 'Clause exclue = repliée, jamais supprimée'}>
        {!contrat || !p ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Cinq réponses composeront ici le contrat, tel qu’il sera signé. Les clauses exclues resteront repliées entre les
            paragraphes, avec la raison de leur exclusion.
          </p>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-8">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-1 md:content-start">
                {REPONSES.map(([k, nom]) => {
                  const a = k === 'client' && !!p.ecart && !!p.ambre;
                  return (
                    <div key={k} data-signal-groupe={a ? 'pli-contredit' : undefined}>
                      <dt className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-text-muted">{nom}</dt>
                      <dd className={`mt-1 text-[13.5px] ${a ? 'font-semibold text-signal' : 'text-text-primary'}`}>{contrat.reponses[k]}</dd>
                    </div>
                  );
                })}
              </dl>
              <div className="min-w-0 bg-[#e8e6e0] px-5 py-6 text-[#1a1a1a] shadow-[0_30px_60px_-26px_rgba(0,0,0,1)] sm:px-7">
                <span className="block text-[17px] font-bold tracking-[-0.01em] text-[#0a0a0a]">{contrat.titre}</span>
                <div className="mt-4 flex flex-col gap-2">
                  {p.paragraphes.map((x) =>
                    x.replie ? (
                      <div
                        key={x.clause.numero}
                        data-signal-groupe={x === p.ambre ? 'pli-contredit' : undefined}
                        title={x.clause.texte}
                        className={`flex items-center gap-2.5 px-2.5 font-mono text-[9.5px] uppercase tracking-[0.08em] ${
                          x === p.ambre ? `bg-signal font-bold shadow-[0_0_28px_-7px_var(--color-signal-glow)] ${ENCRE_SURTITRE_PLAQUE}` : 'bg-[#d8d5ce] text-[#5c5a55]'
                        }`}
                        style={{ minHeight: PLI_PX }}
                      >
                        <span className="flex-none">Art. {x.clause.numero} · {x.clause.titre}</span>
                        <span className="normal-case tracking-normal [overflow-wrap:anywhere]">
                          repliée : {x.raison}
                          {x === p.ambre && p.ecart ? ` — la fiche dit ${p.ecart.fiche}` : ''}
                        </span>
                      </div>
                    ) : (
                      <p key={x.clause.numero} className="text-[13px] leading-[1.55]">
                        <span className="mr-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#5c5a55]">Art. {x.clause.numero} · {x.clause.titre}</span>
                        {x.clause.texte}
                      </p>
                    ),
                  )}
                </div>
              </div>
            </div>

            <PiedDominante action={p.ambre ? <BoutonSecondaire onClick={() => void deplier()}>Déplier l’article {p.ambre.clause.numero}</BoutonSecondaire> : undefined}>
              {p.ambre && p.ecart
                ? `La fiche de ${contrat.client} dit « ${p.ecart.fiche} », la réponse saisie « ${p.ecart.saisie} ». Pour ce cas, l’article ${p.ambre.clause.numero} (${p.ambre.clause.titre.toLowerCase()}) est obligatoire : le contrat ne peut pas partir sans lui.`
                : p.ambre
                  ? `L’article ${p.ambre.clause.numero} est obligatoire mais replié : le générateur ne tranche pas.`
                  : 'Les réponses correspondent à la fiche du client, et aucune clause obligatoire n’est repliée.'}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="La bibliothèque de clauses" note={clauses.length ? 'Contrats où elle figure' : undefined}>
          {clauses.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucune clause dans la bibliothèque.</p>
          ) : (
            (() => {
              const lignes = clauses
                .map((c) => ({ c, n: contrats.filter((k) => !plier([c], k, null).paragraphes[0].replie).length }))
                .sort((a, b) => b.n - a.n)
                .slice(0, 6);
              return lignes.map(({ c, n }, i) => (
                <LigneBarre key={c.id} nom={c.titre} part={n / Math.max(1, contrats.length)} valeur={n} derniere={i === lignes.length - 1} />
              ));
            })()
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Le clausier"
          releves={[
            { label: 'Contrats générés', valeur: contrats.length },
            { label: 'Clauses', valeur: clauses.length },
            { label: 'Dernière mise à jour', valeur: majDerniere ? MOIS[new Date(majDerniere).getMonth()] : '—' },
          ]}
        >
          Chaque clause porte sa source juridique, lisible depuis le pli.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
