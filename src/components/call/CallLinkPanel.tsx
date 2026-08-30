import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Link2, Loader2, MessageSquare, Trash2, X } from 'lucide-react';
import { bridge } from '../../lib/bridge';
import { PUBLIC_URL_MISSING, publicOrigin } from '../../lib/publicUrl';
import { cleanErrorMessage } from '../../lib/errorMessage';
import { useFocusALOuverture } from '../../lib/useFocusALOuverture';
import { callInvitationMessage } from '../../lib/callInvite';
import type { CallLink } from '../../shared/api';
import { useFermetureEchap } from '../../lib/useFermetureEchap';

/**
 * Émettre un lien d'appel pour quelqu'un qui n'a pas de compte (BLOC B.2).
 *
 * ## Le jeton ne s'affiche qu'une fois, et l'écran le dit
 *
 * amn-api n'en garde que l'empreinte. Un lien perdu ne se retrouve donc pas, il
 * se réémet — et c'est volontaire : un secret relisible à volonté n'est plus un
 * secret à usage unique. L'écran affiche l'adresse complète tout de suite, avec
 * un bouton de copie, et l'annonce clairement.
 *
 * ## La durée est un choix, pas un réglage caché
 *
 * Trois durées, en clair. Un lien d'appel s'envoie et s'utilise dans la foulée ;
 * proposer « 30 jours » inviterait à laisser traîner une porte ouverte.
 */

const DURATIONS = [
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 120, label: '2 h' },
];

/**
 * L'adresse à envoyer au prospect, ou `null` si le poste n'en connaît aucune.
 *
 * Elle se fabriquait avec `window.location.origin`, ce qui vaut `file://` dans
 * l'application INSTALLÉE — donc un chemin sur la machine d'Aaron, inutilisable
 * par qui que ce soit d'autre. Voir src/lib/publicUrl.ts pour le diagnostic
 * complet. On rend `null` plutôt qu'un lien faux : un lien faux s'envoie, et
 * personne ne comprend pourquoi il ne marche pas.
 */
function linkUrl(token: string): string | null {
  const origin = publicOrigin();
  if (!origin) return null;
  return `${origin}/#/appel?token=${encodeURIComponent(token)}`;
}

/**
 * L'adresse à envoyer, dans l'ordre où on peut lui faire confiance.
 *
 *   1. CELLE DU SERVEUR. Il est configuré une fois (`APP_PUBLIC_URL`) et
 *      répond à tous les postes ; c'est la seule source qui ne dépende pas de
 *      la façon dont l'installeur a été construit.
 *   2. À défaut, celle du poste — mais UNIQUEMENT si c'est une vraie adresse
 *      web, ce qui est le cas du build web et jamais celui de l'application
 *      installée.
 *   3. Sinon rien, et on explique. Une adresse fausse s'envoie et personne ne
 *      comprend pourquoi elle ne marche pas.
 */
function sendableUrl(created: { token: string; url: string | null }): string | null {
  return created.url ?? linkUrl(created.token);
}

function remaining(expiresAt: string): string {
  const ms = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'expiré';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `expire dans ${minutes} min`;
  return `expire dans ${Math.round(minutes / 60)} h`;
}

export function CallLinkPanel({ onClose }: { onClose: () => void }) {
  // Échap ferme, comme partout ailleurs. Voir lib/useFermetureEchap.
  useFermetureEchap(true, onClose);

  const fenetre = useFocusALOuverture<HTMLDivElement>();
  const [links, setLinks] = useState<CallLink[]>([]);
  const [minutes, setMinutes] = useState(30);
  const [label, setLabel] = useState('');
  const [fresh, setFresh] = useState<{ url: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<'message' | 'url' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLinks(await bridge().remote.callLinks.list());
    } catch (err) {
      setError(cleanErrorMessage(err, 'Impossible de lire vos liens.'));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async () => {
    setBusy(true);
    setError(null);
    setCopied(null);
    try {
      const created = await bridge().remote.callLinks.create({ label: label.trim(), minutes });
      /*
        On ne peut plus refuser AVANT d'appeler : c'est la réponse du serveur qui
        porte l'adresse. Le jeton est donc bien créé, et s'il n'y a aucune adresse
        connue on le dit — le lien reste révocable dans la liste juste en dessous,
        donc rien n'est laissé en suspens.
      */
      const url = sendableUrl(created);
      if (!url) throw new Error(PUBLIC_URL_MISSING);
      setFresh({ url, expiresAt: created.expiresAt });
      setLabel('');
      await refresh();
    } catch (err) {
      setError(cleanErrorMessage(err, 'amn-api a refusé la création du lien.'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (what: 'message' | 'url') => {
    if (!fresh) return;
    const text =
      what === 'message' ? callInvitationMessage(fresh.url, fresh.expiresAt) : fresh.url;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('La copie automatique a échoué — sélectionnez le texte à la main.');
    }
  };

  const revoke = async (id: string) => {
    try {
      await bridge().remote.callLinks.revoke(id);
      await refresh();
    } catch (err) {
      setError(cleanErrorMessage(err, 'Impossible de révoquer ce lien.'));
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <motion.div
        ref={fenetre}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Lien d’appel"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col border border-border-strong bg-surface outline-none"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            <Link2 size={13} strokeWidth={2} />
            Lien d’appel
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center text-text-secondary hover:text-text-primary"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="text-xs leading-relaxed text-text-secondary">
            Envoyez cette adresse à quelqu’un qui n’a pas de compte. Elle ouvre une page d’appel
            dans son navigateur, ne sert qu’<strong className="font-semibold">une seule fois</strong>,
            et ne lui apprend rien sur vous tant que vous n’avez pas décroché.
          </p>

          <label className="mt-4 block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Pour qui ? (mémo privé, jamais montré au visiteur)
            </span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Prospect rencontré au salon"
              className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            />
          </label>

          <p className="mb-1 mt-4 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Valable
          </p>
          <div className="flex gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.minutes}
                type="button"
                onClick={() => setMinutes(d.minutes)}
                aria-pressed={minutes === d.minutes}
                className={`flex min-h-11 flex-1 items-center justify-center border text-sm transition-colors ${
                  minutes === d.minutes
                    ? 'border-accent bg-accent-muted text-text-primary'
                    : 'border-border text-text-secondary hover:border-border-strong'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void create()}
            disabled={busy}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 bg-accent text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            Générer le lien
          </button>

          {fresh && (
            <div className="mt-4 border border-accent/50 bg-accent-muted p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                À envoyer maintenant · {remaining(fresh.expiresAt)}
              </p>
              <p className="mt-1.5 break-all font-mono text-[11px] text-text-primary">{fresh.url}</p>

              {/*
                Le bouton principal copie un MESSAGE, pas l'adresse nue.

                La personne qui reçoit le lien ne verra jamais cet écran : un
                avertissement affiché ici ne la protège pas. La consigne doit
                donc partir avec le lien — c'est le seul endroit où elle atteint
                celui qui va coller l'adresse dans un moteur de recherche.
              */}
              <button
                type="button"
                onClick={() => void copy('message')}
                className="mt-2.5 flex min-h-12 w-full items-center justify-center gap-2 bg-accent text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
              >
                {copied === 'message' ? (
                  <Check size={15} strokeWidth={2.5} />
                ) : (
                  <MessageSquare size={15} strokeWidth={1.75} />
                )}
                {copied === 'message' ? 'Message copié' : 'Copier le message à envoyer'}
              </button>
              <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                Le message contient l’adresse <em>et</em> la consigne « à ouvrir directement, pas à
                rechercher ». C’est ce qui évite qu’elle finisse dans une barre de recherche.
              </p>

              <button
                type="button"
                onClick={() => void copy('url')}
                className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 border border-border text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                {copied === 'url' ? <Check size={14} strokeWidth={2.25} /> : <Copy size={14} strokeWidth={1.75} />}
                {copied === 'url' ? 'Adresse copiée' : 'Copier l’adresse seule'}
              </button>

              <p className="mt-2.5 text-xs leading-relaxed text-text-secondary">
                Cette adresse ne sera plus affichée. Elle n’est pas conservée en clair — si vous la
                perdez, générez-en une autre.
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-3 border border-danger/40 bg-danger-muted px-3 py-2 font-mono text-xs text-danger">
              {error}
            </p>
          )}

          {links.length > 0 && (
            <>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Vos liens récents
              </p>
              <div className="mt-2 flex flex-col divide-y divide-border/60 border border-border">
                {links.map((l) => (
                  <div key={l.id} className="flex min-h-12 items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-primary">{l.label || 'Sans mémo'}</p>
                      <p className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
                        {l.state === 'ready'
                          ? remaining(l.expiresAt)
                          : l.state === 'used'
                            ? 'utilisé'
                            : 'expiré'}
                      </p>
                    </div>
                    {l.state === 'ready' && (
                      <button
                        type="button"
                        onClick={() => void revoke(l.id)}
                        aria-label={`Révoquer le lien ${l.label || 'sans mémo'}`}
                        title="Révoquer ce lien"
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-text-muted transition-colors hover:text-danger"
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
