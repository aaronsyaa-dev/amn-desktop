import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Bloc, Calmes, CarteCalme, CarteReleves, Dominante, Ecran50, LigneBarre, PiedDominante } from '../components/cinquante-kit';
import { useCollection } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import { type EnregistrementSentiment, FENETRE_SENTIMENT_J, type SourceTexte, phrasesMeres } from '../lib/cinquante/marketing';
import { useLangue } from '../i18n';

/**
 * SENTIMENT — la phrase-mère (`35g`).
 *
 * L'analyse ne rend pas un score : elle rend UNE PHRASE. Les textes des
 * clients sont regroupés par ce qu'ils disent ; chaque groupe se résume en sa
 * phrase-mère, écrite avec les mots des clients (`motsAbsents` le vérifie :
 * une phrase qui emploierait un mot absent de ses variantes cède la place à
 * sa variante la plus récente, mot pour mot). La phrase dominante en 30 px,
 * ses variantes citées avec leur source et leur date.
 *
 * L'ambre — un filet de 3 px et le relevé « DITE N FOIS » — va à la
 * négative la plus fréquente ; sans phrase négative, l'écran n'a pas d'ambre.
 */

const SOURCE: Record<SourceTexte, string> = { nps: 'NPS', chatbot: 'Chatbot', message: 'Message', avis: 'Avis Google' };
const SOURCE_LONG: Record<SourceTexte, string> = {
  nps: 'Réponses au NPS',
  chatbot: 'Questions au chatbot',
  message: 'Messages',
  avis: 'Avis publics',
};
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const dateCourte = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`;
};
const VARIANTES_MONTREES = 6;

export function SentimentScreen() {
  const { t, langue } = useLangue();
  const tout = useCollection<EnregistrementSentiment>('sentimentTexts');
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const s = useMemo(() => phrasesMeres(tout, maintenant), [tout, maintenant]);
  const vide = s.textes.length === 0;
  const dom = s.dominante;

  const description = vide
    ? t('m50.sentiment.descriptionVide')
    : s.ambre
      ? t('m50.sentiment.description', { n: L(s.textes.length, true), fois: L(s.ambre.variantes.length) })
      : t('m50.sentiment.descriptionSansReproche', { n: L(s.textes.length, true) });

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.marketing'), module: t('m50.sentiment.titre') })}
          title={t('m50.sentiment.titre')}
          description={description}
          phraseVide={t('m50.sentiment.phraseVide')}
        />
      </Bloc>

      <Dominante
        surtitre={`Ce que disent vos clients · ${FENETRE_SENTIMENT_J} jours`}
        note={vide ? undefined : `${s.textes.length} textes · ${s.groupes.length} phrases-mères`}
      >
        {vide || !dom ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Les avis, les réponses au NPS, les messages et les questions au chatbot seront regroupés ici par ce qu’ils
            disent, chaque groupe résumé en une phrase écrite avec les mots mêmes des clients.
          </p>
        ) : (
          <>
            <div className="flex items-stretch gap-[22px]">
              <span
                data-signal-groupe={s.ambre ? 'phrase-mere' : undefined}
                className={`w-[3px] flex-none ${s.ambre ? 'bg-signal shadow-[0_0_28px_-7px_var(--color-signal-glow)]' : 'bg-border-strong'}`}
              />
              <div className="min-w-0 flex-1">
                <span
                  data-signal-groupe={s.ambre ? 'phrase-mere' : undefined}
                  className={`block font-mono text-[10px] font-bold uppercase tracking-[0.18em] ${s.ambre ? 'text-signal' : 'text-text-secondary'}`}
                >
                  Dite {dom.variantes.length} fois
                </span>
                <p className="mt-3 max-w-[30ch] text-[22px] font-bold leading-[1.22] tracking-[-0.025em] text-text-primary [text-wrap:pretty] sm:text-[30px]">
                  « {dom.affichee.replace(/^«\s*|\s*»$/g, '')} »
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {dom.variantes.slice(0, VARIANTES_MONTREES).map((v) => (
                <div key={v.id} className="border border-border-raised bg-[#151515] px-3.5 py-3">
                  <span className="block text-[13px] leading-[1.45] text-text-body [text-wrap:pretty]">« {v.texte} »</span>
                  <span className="tnum mt-2 block font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-muted">
                    {SOURCE[v.source]} · <span className="normal-case">{dateCourte(v.le)}</span>
                  </span>
                </div>
              ))}
            </div>
            {dom.variantes.length > VARIANTES_MONTREES && (
              <span className="mt-2.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
                + {dom.variantes.length - VARIANTES_MONTREES} autres variantes
              </span>
            )}

            {s.autres.length > 0 && (
              <div className="mt-[22px] flex flex-col gap-3 border-t border-border-raised pt-[18px]">
                {s.autres.slice(0, 3).map((g) => (
                  <div key={g.phrase.id} className="flex items-baseline gap-4">
                    <span className="tnum w-16 flex-none font-mono text-[12px] font-semibold text-text-secondary">× {g.variantes.length}</span>
                    <span className="text-[16px] font-semibold leading-[1.35] text-text-secondary">« {g.affichee.replace(/^«\s*|\s*»$/g, '')} »</span>
                  </div>
                ))}
              </div>
            )}

            <PiedDominante>
              {s.ambre
                ? `Les ${s.ambre.variantes.length} variantes disent la même chose avec d’autres mots. ${
                    s.ambre.tenue
                      ? 'La phrase-mère n’emploie que leurs mots.'
                      : 'Aucune synthèse ne tient mot pour mot : la variante la plus récente est citée telle quelle.'
                  }`
                : 'Aucune phrase négative sur la période : rien ne demande de réponse.'}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre={vide ? 'Les textes' : `Les ${s.textes.length} textes`} note={vide ? undefined : 'Par source'}>
          {vide ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun texte de client sur la période.</p>
          ) : (
            s.parSource.map((x, i) => (
              <LigneBarre key={x.source} nom={SOURCE_LONG[x.source]} part={x.n / Math.max(1, s.parSource[0].n)} valeur={x.n} derniere={i === s.parSource.length - 1} />
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre={`Les ${s.groupes.length} phrases-mères`}
          releves={[
            { label: 'Positives', valeur: s.polarites.positive },
            { label: 'Négatives', valeur: s.polarites.negative },
            { label: 'Neutres', valeur: s.polarites.neutre },
          ]}
        >
          Aucune phrase-mère n’est écrite par l’analyse : elle choisit parmi les mots des clients.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
