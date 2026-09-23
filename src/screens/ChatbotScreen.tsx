import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Bloc,
  BoutonPrimaire,
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
import { useCollection, useSync } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import {
  type EnregistrementChatbot,
  type QuestionChatbot,
  type ReglageChatbot,
  faqEnCreux,
} from '../lib/cinquante/guichet';
import { useLangue } from '../i18n';

/**
 * CHATBOT — la FAQ en creux (`34e`).
 *
 * La FAQ rangée par sujet, en cinq colonnes. Chaque question posée est une
 * tuile de `52 + 4 × demandes` px : pleine quand la FAQ a répondu, en creux
 * pointillé — avec les mots mêmes du client — quand elle n'a pas su. Les cinq
 * en-têtes ont exactement la même hauteur (une ligne, `nowrap`) pour que les
 * piles partent de la même ligne et que les hauteurs se comparent.
 *
 * « Répondre à cette question » écrit la réponse dans la FAQ : le creux se
 * remplit sous les yeux, et l'ambre passe au creux suivant.
 */

const SUJET: Record<string, string> = {
  tarifs: 'Tarifs',
  prestations: 'Prestations',
  zone: 'Zone & horaires',
  rendezvous: 'Rendez-vous',
  paiement: 'Paiement',
};
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function ChatbotScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const tout = useCollection<EnregistrementChatbot>('chatbotQuestions');
  const [maintenant] = useState(() => new Date());
  const [reponse, setReponse] = useState('');
  const [ouvert, setOuvert] = useState(false);

  const f = useMemo(() => faqEnCreux(tout, maintenant), [tout, maintenant]);
  const reglage = tout.find((e): e is ReglageChatbot & { id: string; updatedAt: string } => e.kind === 'reglage');
  const reponses = tout.filter((e) => e.kind === 'question' && e.reponse).length;
  const vide = f.total === 0;
  const L = (n: number, maj = false) => enLettres(n, langue, maj);
  const creux = f.colonnes.flatMap((c) => c.tuiles).find((x) => x.id === f.creuxAmbre) ?? null;

  const repondre = async () => {
    if (!creux || !reponse.trim()) return;
    const brut = tout.find((e) => e.id === creux.id) as (QuestionChatbot & { id: string; updatedAt: string }) | undefined;
    if (!brut) return;
    await upsert('chatbotQuestions', brut.id, { ...donnees(brut), reponse: reponse.trim() });
    const le = new Date().toISOString();
    if (reglage) await upsert('chatbotQuestions', reglage.id, { ...donnees(reglage), faqMiseAJourLe: le });
    setReponse('');
    setOuvert(false);
  };

  const description = vide
    ? t('m50.chatbot.descriptionVide')
    : t('m50.chatbot.description', {
        total: L(f.total, true), faq: L(f.issues.faq), autres: L(f.total - f.issues.faq), fois: L(creux?.fois ?? 0),
      });

  const majLe = reglage ? new Date(reglage.faqMiseAJourLe) : null;

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.guichet'), module: t('m50.chatbot.titre') })}
          title={t('m50.chatbot.titre')}
          description={creux ? description : vide ? description : t('m50.chatbot.descriptionSansCreux', { total: L(f.total, true) })}
          phraseVide={t('m50.chatbot.phraseVide')}
        />
      </Bloc>

      <Dominante
        surtitre={`La FAQ, vue par ses questions · ${MOIS[maintenant.getMonth()]}`}
        note={vide ? undefined : 'Hauteur = fréquence · pointillé = sans réponse'}
      >
        {vide ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Les questions posées au chatbot se rangeront ici par sujet. Celles auxquelles la FAQ ne sait pas répondre
            resteront en creux, avec les mots mêmes du client.
          </p>
        ) : (
          <>
            {/* Cinq colonnes dès la tablette ; sur un téléphone, les sujets se
                suivent, et les hauteurs se comparent encore dans chacun. */}
            <div>
              <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-5 md:gap-3">
                {f.colonnes.map((c) => (
                  <div key={c.sujet} className="flex min-w-0 flex-col gap-1.5">
                    <div className="mb-1 border-b border-border-raised pb-2.5">
                      <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-text-secondary">{SUJET[c.sujet]}</span>
                      {/* Une ligne, toujours : les cinq en-têtes ont la même hauteur. */}
                      <span className="tnum mt-1 block truncate whitespace-nowrap font-mono text-[10px] text-text-muted">
                        {c.total} · {c.sansReponse} sans réponse
                      </span>
                    </div>
                    {c.tuiles.map((q) => {
                      const ambre = q.id === f.creuxAmbre;
                      return (
                        <div
                          key={q.id}
                          data-signal-groupe={ambre ? 'creux' : undefined}
                          className={`flex flex-col justify-between px-2.5 py-2 ${
                            ambre
                              ? 'border-2 border-dashed border-signal bg-[rgba(208,154,74,.07)] shadow-[0_0_26px_-8px_rgba(208,154,74,.7)]'
                              : q.creux
                                ? 'border border-dashed border-border-strong'
                                : 'border border-[#2b2b2b] bg-[#1a1a1a]'
                          }`}
                          style={{ height: q.hauteur }}
                          title={q.reponse ? `Réponse : ${q.reponse}` : 'Sans réponse dans la FAQ'}
                        >
                          <span className={`text-[12px] leading-[1.3] [text-wrap:pretty] ${ambre ? 'text-text-primary' : q.creux ? 'text-text-secondary' : 'text-text-body'}`}>
                            {q.texte}
                          </span>
                          <span className={`tnum font-mono text-[9.5px] tracking-[0.08em] ${ambre ? 'font-bold text-signal' : 'font-medium text-text-muted'}`}>
                            ×{q.fois}{q.creux ? ' · SANS RÉPONSE' : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {creux && (
              <PiedDominante
                action={
                  ouvert ? undefined : (
                    <BoutonSecondaire onClick={() => setOuvert(true)}>Répondre à cette question</BoutonSecondaire>
                  )
                }
              >
                {ouvert ? (
                  <span className="flex flex-col gap-2.5">
                    <span className="text-text-body">« {creux.texte} »</span>
                    <textarea
                      value={reponse}
                      onChange={(e) => setReponse(e.target.value)}
                      aria-label="La réponse que la FAQ donnera"
                      placeholder="La réponse que la FAQ donnera, telle qu’elle sera lue."
                      rows={2}
                      className="input-focus w-full border border-border-strong bg-sunken px-3 py-2 text-[13.5px] text-text-primary outline-none"
                    />
                    <span className="flex gap-2">
                      <BoutonPrimaire onClick={() => void repondre()} disabled={!reponse.trim()}>Ajouter à la FAQ</BoutonPrimaire>
                      <BoutonSecondaire onClick={() => { setOuvert(false); setReponse(''); }}>Annuler</BoutonSecondaire>
                    </span>
                  </span>
                ) : (
                  `${L(creux.fois, true)} personnes ont demandé « ${creux.texte} ». Le chatbot leur a répondu qu’il ne savait pas, et leur a proposé de laisser un message.`
                )}
              </PiedDominante>
            )}
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme
          surtitre={vide ? 'Ce que deviennent les questions' : `Ce que sont devenues les ${f.total} questions`}
          note={vide ? undefined : MOIS[maintenant.getMonth()]}
        >
          {vide ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucune question ce mois-ci.</p>
          ) : (
            [
              ['Réglées par la FAQ', f.issues.faq],
              ['Passées à un humain, par message', f.issues.humain],
              ['Laissées sans suite', f.issues['sans-suite']],
            ].map(([nom, n], i) => (
              <LigneBarre key={nom as string} nom={nom} part={(n as number) / Math.max(1, f.total)} valeur={n} derniere={i === 2} />
            ))
          )}
        </CarteCalme>
        <CarteReleves surtitre="Il ne répond qu’avec la FAQ" releves={[{ label: 'Réponses dans la FAQ', valeur: reponses }]}>
          Aucune réponse inventée, aucun prix donné en dehors de la grille. Quand la FAQ ne sait pas, il le dit et propose
          de laisser un message.
          {majLe && ` Dernière mise à jour de la FAQ : ${majLe.getDate()} ${MOIS[majLe.getMonth()]}.`}
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
