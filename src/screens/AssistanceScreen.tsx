import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, MailQuestion, MessageSquareText, Send } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { bridge } from '../lib/bridge';
import { cleanErrorMessage } from '../lib/errorMessage';
import { relativeTime } from '../lib/time';
import type { SupportRequest } from '../shared/api';

/**
 * ASSISTANCE — écrire à son prestataire, et relire ce qu'il a répondu (Bloc 4)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Pas un chat : un message avec un objet, et l'historique de ses demandes
 * avec leur état. amn-api n'a aucun transport mail (audit du 1er septembre) ;
 * la demande arrive dans la file de la Tour de contrôle, un humain la lit,
 * et sa réponse s'affiche ICI, sous la demande. Rien ne prétend partir par
 * courriel.
 *
 * Trois états, lisibles d'un coup d'œil : à traiter, répondu, clos. Les
 * demandes de place et les mots de passe oubliés apparaissent aussi — ce sont
 * les mêmes lignes, vues de son côté.
 *
 * ## Ce qui domine : le dernier échange, question et réponse face à face
 *
 * L'écran était coupé en deux : le formulaire à gauche sur deux cinquièmes,
 * l'historique à droite sur trois. Le formulaire occupait donc le meilleur
 * emplacement de l'écran — alors qu'on écrit une fois et qu'on revient dix
 * fois lire. Et la réponse, quand elle arrivait, s'affichait en 14 px derrière
 * un filet, sous une demande de la même taille, au milieu d'une pile.
 *
 * L'échange le plus récent passe donc en tête : la demande en petit, la
 * réponse en grand, l'une sous l'autre comme une correspondance. S'il n'y a
 * pas encore de réponse, c'est l'attente qui se dit, avec son âge. Le reste
 * descend en registre, et le formulaire ferme l'écran.
 *
 * ## Pas de lettre à copier — c'est l'écart avec les Relances
 *
 * Les deux écrans montrent un texte en tête, et ils ne doivent pas se
 * ressembler pour autant. Une relance est un DOCUMENT qu'on emporte : elle est
 * posée en feuille, avec son geste de copie. Ici rien ne s'emporte : c'est une
 * CORRESPONDANCE, deux voix l'une sous l'autre, et la mise en page le dit —
 * la demande décalée et en sourdine, la réponse pleine.
 *
 * ## Pas d'ambre, et c'est un choix
 *
 * Cet écran ne demande aucune décision. Attendre une réponse est un état, pas
 * un geste ; lire une réponse arrivée n'est pas un arbitrage. Le seul geste
 * possible est d'écrire, et écrire n'est pas une urgence qu'un écran aurait à
 * signaler. Poser un ambre ici reviendrait à le poser sur « il y a du texte »,
 * et l'ambre finirait par ne plus rien vouloir dire ailleurs.
 */

const ETAT: Record<SupportRequest['status'], string> = {
  pending: 'À traiter',
  answered: 'Répondu',
  closed: 'Clos',
};

const NATURE: Record<SupportRequest['kind'], string> = {
  message: 'Message',
  seat: 'Place de plus',
  password_reset: 'Mot de passe oublié',
};

const SUBJECT_MAX = 120;
const BODY_MAX = 2000;

export function AssistanceScreen() {
  const [demandes, setDemandes] = useState<SupportRequest[] | null>(null);
  const [objet, setObjet] = useState('');
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      setDemandes(await bridge().remote.assistance.list());
    } catch (err) {
      setErreur(cleanErrorMessage(err, 'Vos demandes n’ont pas pu être lues.'));
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  // La réponse arrive pendant que l'écran est ouvert : on relit, sans voile.
  useEffect(() => bridge().remote.onSupportAnswered?.(() => void charger()) ?? undefined, [charger]);

  const pret = objet.trim().length > 0 && texte.trim().length > 0 && !envoi;

  const envoyer = async () => {
    if (!pret) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await bridge().remote.assistance.send({ kind: 'message', subject: objet.trim(), body: texte.trim() });
      setObjet('');
      setTexte('');
      setEnvoye(true);
      window.setTimeout(() => setEnvoye(false), 4000);
      await charger();
    } catch (err) {
      setErreur(cleanErrorMessage(err, 'Le message n’a pas pu partir.'));
    } finally {
      setEnvoi(false);
    }
  };

  const toutes = demandes ?? [];
  const enAttente = toutes.filter((d) => d.status === 'pending').length;
  const repondues = toutes.filter((d) => d.reply).length;

  /*
    L'ÉCHANGE DE TÊTE.

    Une réponse arrivée passe devant une demande en attente, même plus récente :
    une réponse apporte quelque chose, une attente ne fait que durer. À défaut,
    la demande en attente la plus ANCIENNE — c'est elle qui dit depuis combien
    de temps le silence dure.
  */
  const parDate = [...toutes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const derniereReponse = parDate.find((d) => Boolean(d.reply)) ?? null;
  const plusVieilleAttente = [...toutes].reverse().find((d) => d.status === 'pending') ?? null;
  const tete = derniereReponse ?? plusVieilleAttente;
  const reste = parDate.filter((d) => d.id !== tete?.id);

  return (
    <section className="flex flex-col">
      <ScreenHeader
        eyebrow="Système · Assistance"
        title="Écrire à votre prestataire"
        description="Un message, un objet — et la réponse, ici, sous votre demande."
        stats={[
          { label: 'Demandes', value: demandes === null ? '…' : toutes.length },
          { label: 'À traiter', value: demandes === null ? '…' : enAttente },
          { label: 'Répondues', value: demandes === null ? '…' : repondues },
        ]}
      />

      <StaggerGroup className="mt-6 flex flex-col gap-4">
        {demandes === null && !erreur && (
          <StaggerItem>
            <p className="flex items-center gap-2 text-xs text-text-muted">
              <Loader2 size={13} className="animate-spin" />
              Lecture…
            </p>
          </StaggerItem>
        )}

        {/* L'ÉCHANGE DE TÊTE — la demande en sourdine, la réponse en grand. */}
        {tete && (
          <StaggerItem>
            <section className="panel-raised p-5 sm:p-6">
              <p className="eyebrow">
                {NATURE[tete.kind]} · {ETAT[tete.status]} · {relativeTime(tete.createdAt)}
              </p>
              <h2 className="mt-2 text-[19px] font-semibold leading-tight text-text-primary sm:text-[23px]">{tete.subject}</h2>
              {tete.body && (
                <p className="mt-2 max-w-prose whitespace-pre-wrap border-l-2 border-border pl-3 text-sm leading-relaxed text-text-muted">
                  {tete.body}
                </p>
              )}

              {tete.reply ? (
                <div className="mt-5">
                  <p className="eyebrow mb-2">
                    Réponse{tete.handledAt ? ` · ${relativeTime(tete.handledAt)}` : ''}
                  </p>
                  {/* La réponse à la taille où on lit vraiment : c'est elle
                      qu'on est venu chercher, pas la demande qu'on a écrite. */}
                  <p className="max-w-prose whitespace-pre-wrap text-[15px] leading-relaxed text-text-primary">{tete.reply}</p>
                </div>
              ) : (
                <p className="mt-5 flex items-center gap-2 text-sm text-text-secondary">
                  <MailQuestion size={14} strokeWidth={1.9} />
                  En attente d’une réponse depuis {relativeTime(tete.createdAt)}.
                </p>
              )}
            </section>
          </StaggerItem>
        )}

        {demandes !== null && toutes.length === 0 && (
          <StaggerItem>
            <p className="panel px-4 py-7 text-center text-sm text-text-secondary">
              Aucune demande pour l’instant. Le formulaire ci-dessous part chez votre prestataire.
            </p>
          </StaggerItem>
        )}

        {/* LE REGISTRE — les échanges précédents, question et réponse en une
            ligne chacune. On ne les relit pas, on les retrouve. */}
        {reste.length > 0 && (
          <StaggerItem>
            <section className="panel">
              <p className="eyebrow flex items-center gap-2 border-b border-border px-4 py-2.5">
                <MessageSquareText size={13} strokeWidth={1.9} />
                Les échanges précédents
              </p>
              <ul className="flex flex-col gap-px bg-border">
                {reste.map((d) => (
                  <li key={d.id} className="bg-surface px-4 py-2.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="min-w-0 flex-1">
                        <span className="mr-2 font-mono text-[9px] uppercase tracking-wider text-text-muted">{NATURE[d.kind]}</span>
                        <span className="text-sm text-text-primary">{d.subject}</span>
                      </p>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        {ETAT[d.status]} · {relativeTime(d.createdAt)}
                      </span>
                    </div>
                    {d.reply && (
                      <p className="mt-1 max-w-prose truncate border-l-2 border-border pl-3 text-xs leading-relaxed text-text-secondary">{d.reply}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </StaggerItem>
        )}

        {/* LE FORMULAIRE — en bas, et c'est voulu : on écrit une fois, on
            revient lire dix fois. */}
        <StaggerItem>
          <section className="panel p-4 sm:p-5">
            <p className="eyebrow mb-3">Nouveau message</p>
            <div className="grid gap-3 lg:grid-cols-2">
              <label className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">Objet</span>
                <input
                  value={objet}
                  maxLength={SUBJECT_MAX}
                  onChange={(e) => setObjet(e.target.value)}
                  placeholder="Par exemple : changer mon logo"
                  className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none placeholder:text-text-muted md:min-h-0 md:py-2"
                />
                <span className="mt-3 block text-[11px] leading-relaxed text-text-muted">
                  Votre demande arrive chez votre prestataire, qui la lit et vous répond ici. Rien ne part par
                  courriel.
                </span>
              </label>
              <label className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">Message</span>
                <textarea
                  value={texte}
                  maxLength={BODY_MAX}
                  onChange={(e) => setTexte(e.target.value)}
                  rows={5}
                  placeholder="Dites ce qu’il vous faut, en quelques lignes."
                  className="input-focus w-full resize-y border border-border bg-bg px-3 py-2 text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
                />
                <span className="mt-1 block text-right font-mono text-[10px] text-text-muted">
                  {texte.length} / {BODY_MAX}
                </span>
              </label>
            </div>
            {erreur && (
              <p className="mt-3 border border-warning/40 bg-warning-muted px-3 py-2 text-xs leading-relaxed text-text-primary">
                {erreur}
              </p>
            )}
            <button
              type="button"
              disabled={!pret}
              onClick={() => void envoyer()}
              className="mt-4 flex min-h-11 items-center justify-center gap-2 bg-accent px-5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40 sm:w-auto"
            >
              {envoi ? <Loader2 size={15} className="animate-spin" /> : envoye ? <Check size={15} /> : <Send size={15} />}
              {envoye ? 'Envoyé — votre prestataire est prévenu' : 'Envoyer'}
            </button>
          </section>
        </StaggerItem>
      </StaggerGroup>
    </section>
  );
}
