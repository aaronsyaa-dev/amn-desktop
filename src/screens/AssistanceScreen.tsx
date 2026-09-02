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

  const enAttente = (demandes ?? []).filter((d) => d.status === 'pending').length;

  return (
    <section className="flex flex-col">
      <ScreenHeader
        eyebrow="Système · Assistance"
        title="Écrire à votre prestataire"
        description="Un message, un objet — et la réponse, ici, sous votre demande."
        stats={[
          { label: 'Demandes', value: demandes === null ? '…' : demandes.length },
          { label: 'À traiter', value: demandes === null ? '…' : enAttente },
        ]}
      />

      <StaggerGroup className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <StaggerItem className="lg:col-span-2">
          <section className="panel p-4">
            <p className="eyebrow mb-3">Nouveau message</p>
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">Objet</span>
              <input
                value={objet}
                maxLength={SUBJECT_MAX}
                onChange={(e) => setObjet(e.target.value)}
                placeholder="Par exemple : changer mon logo"
                className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none placeholder:text-text-muted md:min-h-0 md:py-2"
              />
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">Message</span>
              <textarea
                value={texte}
                maxLength={BODY_MAX}
                onChange={(e) => setTexte(e.target.value)}
                rows={6}
                placeholder="Dites ce qu’il vous faut, en quelques lignes."
                className="input-focus w-full resize-y border border-border bg-bg px-3 py-2 text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
              />
              <span className="mt-1 block text-right font-mono text-[10px] text-text-muted">
                {texte.length} / {BODY_MAX}
              </span>
            </label>
            {erreur && (
              <p className="mt-3 border border-warning/40 bg-warning-muted px-3 py-2 text-xs leading-relaxed text-text-primary">
                {erreur}
              </p>
            )}
            <button
              type="button"
              disabled={!pret}
              onClick={() => void envoyer()}
              className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 bg-accent px-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              {envoi ? <Loader2 size={15} className="animate-spin" /> : envoye ? <Check size={15} /> : <Send size={15} />}
              {envoye ? 'Envoyé — votre prestataire est prévenu' : 'Envoyer'}
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
              Votre demande arrive chez votre prestataire, qui la lit et vous répond ici. Rien ne part par
              courriel.
            </p>
          </section>
        </StaggerItem>

        <StaggerItem className="lg:col-span-3">
          <section className="panel p-4">
            <p className="eyebrow mb-3 flex items-center gap-2">
              <MessageSquareText size={13} strokeWidth={1.75} />
              Vos demandes
            </p>
            {demandes === null && !erreur && (
              <p className="flex items-center gap-2 text-xs text-text-muted">
                <Loader2 size={13} className="animate-spin" />
                Lecture…
              </p>
            )}
            {demandes !== null && demandes.length === 0 && (
              <p className="text-sm text-text-muted">Aucune demande pour l’instant.</p>
            )}
            {demandes !== null && demandes.length > 0 && (
              <ul className="flex flex-col gap-px bg-border">
                {demandes.map((d) => (
                  <li key={d.id} className="bg-surface px-3 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="min-w-0 text-sm text-text-primary">
                        <span className="mr-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                          {NATURE[d.kind]}
                        </span>
                        {d.subject}
                      </p>
                      <span
                        className={`font-mono text-[10px] uppercase tracking-wider ${
                          d.status === 'pending' ? 'text-text-primary' : 'text-text-muted'
                        }`}
                      >
                        {ETAT[d.status]} · {relativeTime(d.createdAt)}
                      </span>
                    </div>
                    {d.body && (
                      <p className="mt-1 max-w-prose whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">{d.body}</p>
                    )}
                    {d.reply && (
                      <div className="mt-2 border-l-2 border-border-strong pl-3">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                          Réponse{d.handledAt ? ` · ${relativeTime(d.handledAt)}` : ''}
                        </p>
                        <p className="mt-0.5 max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-text-primary">{d.reply}</p>
                      </div>
                    )}
                    {d.status === 'pending' && (
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-text-muted">
                        <MailQuestion size={12} />
                        En attente d’une réponse.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </StaggerItem>
      </StaggerGroup>
    </section>
  );
}
