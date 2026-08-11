import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Lock, ShieldAlert, X } from 'lucide-react';
import { useSync, useCollection } from '../../state/SyncContext';
import { bridge } from '../../lib/bridge';
import { cleanErrorMessage } from '../../lib/errorMessage';
import { SaveIndicator } from '../SaveIndicator';
import { ACCENTS, DEFAULT_ACCENT_ID } from '../../lib/accent';
import type { AdminOrganization } from '../../shared/api';

/**
 * Le dossier d'une organisation cliente, vu d'AMN DevSec (BLOC E).
 *
 * Deux choses qui n'existaient nulle part, réunies parce qu'elles répondent à
 * la même question — « où est-ce que je gère CETTE cliente » :
 *
 *   1. **Les modules qui lui sont ouverts.** Décidés par le serveur et
 *      appliqués par son application. Ce n'est PAS une frontière de sécurité :
 *      ça retire des écrans, l'isolation des données reste celle d'amn-api.
 *   2. **Nos notes internes sur elle** — contact, historique, particularités.
 *      Elles vivent dans le tenant d'AMN DevSec, avec l'id de la cliente comme
 *      identifiant d'enregistrement. Elles ne sont donc jamais dans SES
 *      données : l'isolation par organisation qui existe déjà suffit à ce
 *      qu'elle ne puisse pas les lire, sans règle supplémentaire à ne pas
 *      oublier.
 */

/** Les modules réglables. Doit rester aligné sur `ORG_MODULES` d'amn-api. */
const TOGGLEABLE: { key: string; label: string }[] = [
  { key: 'agenda', label: 'Agenda' },
  { key: 'clients', label: 'Clients' },
  { key: 'invoices', label: 'Facturation' },
  { key: 'projects', label: 'Projets' },
  { key: 'tasks', label: 'Tâches' },
  { key: 'expenses', label: 'Dépenses' },
  { key: 'time', label: 'Temps' },
  { key: 'notes', label: 'Notes' },
  { key: 'media', label: 'Médias' },
  { key: 'reports', label: 'Rapports' },
  { key: 'vault', label: 'Coffre-fort' },
];

interface DossierData {
  body: string;
  updatedBy: string;
}

export function OrgDossierPanel({
  org,
  onClose,
  onSaved,
}: {
  org: AdminOrganization;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { upsert } = useSync();
  const dossiers = useCollection<DossierData>('orgDossier');
  const existing = dossiers.find((d) => d.id === org.id);

  const [notes, setNotes] = useState(existing?.body ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingModule, setPendingModule] = useState<string | null>(null);

  // `null` en base = tous les modules. On matérialise la liste pour l'affichage
  // seulement : enregistrer « tout coché » écrirait une liste explicite, ce qui
  // figerait cette organisation sur le catalogue d'aujourd'hui.
  const enabled = useMemo(
    () => (org.modules === null || org.modules === undefined ? null : new Set(org.modules)),
    [org.modules],
  );
  const isOn = (key: string) => (enabled === null ? true : enabled.has(key));

  /*
    Le champ se recale quand on change D'ORGANISATION, jamais quand le contenu
    distant bouge : se resynchroniser à chaque écriture de l'autre opérateur
    écraserait la phrase qu'on est en train de taper.

    `existing` est donc lu à travers une référence plutôt que mis en dépendance
    — même intention qu'un tableau de dépendances réduit, mais sans désactiver
    de règle de lint.
  */
  const latestBody = useRef(existing?.body ?? '');
  latestBody.current = existing?.body ?? '';
  useEffect(() => {
    setNotes(latestBody.current);
  }, [org.id]);

  const applyOrgAccent = async (accent: string) => {
    setError(null);
    try {
      await bridge().remote.admin.updateOrganization(org.id, { accent });
      onSaved();
    } catch (err) {
      setError(cleanErrorMessage(err, 'amn-api a refusé la couleur.'));
    }
  };

  const toggle = async (key: string) => {
    setError(null);
    setPendingModule(key);
    try {
      const base = enabled === null ? new Set(TOGGLEABLE.map((m) => m.key)) : new Set(enabled);
      if (base.has(key)) base.delete(key);
      else base.add(key);
      await bridge().remote.admin.updateOrganization(org.id, { modules: [...base] });
      onSaved();
    } catch (err) {
      setError(cleanErrorMessage(err, 'amn-api a refusé la modification.'));
    } finally {
      setPendingModule(null);
    }
  };

  const saveNotes = () => {
    setSavingNotes(true);
    upsert('orgDossier', org.id, { body: notes, updatedBy: '' } satisfies DossierData);
    window.setTimeout(() => setSavingNotes(false), 400);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="relative flex max-h-[88vh] w-full max-w-lg flex-col border border-border-strong bg-surface"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-text-primary">{org.name}</h2>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-muted">
              Dossier interne · non visible chez elle
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-text-secondary hover:text-text-primary"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {error && (
            <p className="mb-3 border border-danger/50 bg-danger-muted px-3 py-2 text-xs text-text-primary">
              {error}
            </p>
          )}

          {/* ------------------------------------------------- modules ----- */}
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Modules ouverts
          </p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Retire l’écran et sa navigation chez elle.{' '}
            <span className="text-text-muted">
              Ce n’est pas une barrière de sécurité : ses données restent isolées par organisation,
              comme celles de toutes les autres.
            </span>
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {TOGGLEABLE.map((module) => {
              const on = isOn(module.key);
              return (
                <button
                  key={module.key}
                  type="button"
                  disabled={pendingModule !== null}
                  onClick={() => void toggle(module.key)}
                  className={`flex min-h-11 items-center gap-2.5 border px-3 text-left text-sm transition-colors disabled:opacity-50 ${
                    on
                      ? 'border-border-strong text-text-primary'
                      : 'border-border text-text-muted'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 flex-shrink-0 items-center justify-center border ${
                      on ? 'border-accent bg-accent text-bg' : 'border-border'
                    }`}
                  >
                    {on && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="truncate">{module.label}</span>
                </button>
              );
            })}
          </div>

          {org.modules === null || org.modules === undefined ? (
            <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-text-muted">
              Aucun réglage : tous les modules du catalogue, y compris ceux à venir
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void bridge().remote.admin.updateOrganization(org.id, { modules: null }).then(onSaved)}
              className="mt-2 font-mono text-[9px] uppercase tracking-widest text-text-muted underline-offset-2 hover:text-text-secondary hover:underline"
            >
              Revenir à « tous les modules »
            </button>
          )}

          {/* -------------------------------------------------- accent ----- */}
          <div className="mt-6 border-t border-border pt-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Couleur d’accent
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              Un seul paramètre change — la structure noir et blanc reste.{' '}
              <span className="text-text-muted">
                Palette restreinte : chaque couleur est vérifiée lisible sur fond sombre.
              </span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ACCENTS.map((option) => {
                const on = (org.accent ?? DEFAULT_ACCENT_ID) === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => void applyOrgAccent(option.id)}
                    title={option.label}
                    aria-label={option.label}
                    className={`flex min-h-11 items-center gap-2 border px-2.5 transition-colors ${
                      on ? 'border-border-strong' : 'border-border hover:border-border-strong'
                    }`}
                  >
                    <span
                      className="h-4 w-4 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: option.value }}
                      aria-hidden
                    />
                    <span className="text-xs text-text-primary">{option.label}</span>
                    {on && <Check size={12} strokeWidth={3} className="text-text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ------------------------------------------------- dossier ----- */}
          <div className="mt-6 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                <Lock size={11} strokeWidth={2} />
                Notes internes
              </p>
              <SaveIndicator saved={!savingNotes && notes !== (existing?.body ?? '')} />
            </div>
            <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-text-secondary">
              <ShieldAlert size={13} strokeWidth={2} className="mt-0.5 flex-shrink-0 text-text-muted" />
              <span>
                Contact, historique, particularités. Conservées dans notre organisation, jamais dans
                la sienne — elle n’y a aucun accès, même en se connectant.
              </span>
            </p>
            <textarea
              rows={7}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              placeholder={
                'Interlocutrice principale, canal préféré…\n' +
                'Historique : migration, incidents, demandes en cours.\n' +
                'Particularités : facturation, délais, contraintes.'
              }
              className="input-focus mt-2 w-full resize-none border border-border bg-bg px-3 py-2 text-sm leading-relaxed text-text-primary outline-none"
            />
          </div>
        </div>

        <div className="flex flex-shrink-0 gap-2 border-t border-border p-3">
          <button
            type="button"
            onClick={() => {
              saveNotes();
              onClose();
            }}
            className="min-h-11 flex-1 bg-accent px-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            Enregistrer et fermer
          </button>
        </div>
      </motion.div>
    </div>
  );
}
