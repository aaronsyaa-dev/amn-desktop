import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, GripVertical, Plus, Sparkles, X } from 'lucide-react';
import {
  BUSINESS_PROFILES,
  FIELD_LABELS,
  FIELD_ORDER,
  MAX_EXTRA_FIELDS,
  configFromProfile,
  type OptionalFieldKey,
  type ProjectConfig,
} from '../../state/projectEngine';

/**
 * Le réglage du moteur pour cette organisation (BLOC A).
 *
 * Deux niveaux, dans cet ordre, parce que c'est l'ordre dans lequel on s'en
 * sert :
 *
 *   1. **Un profil métier** — un préréglage complet, appliqué en un geste.
 *      C'est ce qui permet de générer un desktop adapté à un métier sans rien
 *      régler à la main.
 *   2. **Les ajustements** — statuts, structures, champs affichés. Le profil
 *      n'est qu'un point de départ : à partir du moment où on touche un
 *      réglage, c'est le réglage qui fait foi, pas le profil.
 *
 * Ce qui n'est PAS ici, volontairement : la création de champs de type
 * arbitraire. Trois champs texte libres couvrent le besoin réel sans
 * construire un éditeur de schéma — voir la note de `projectEngine.ts`.
 */
export function ProjectConfigPanel({
  config,
  onSave,
  onClose,
}: {
  config: ProjectConfig;
  onSave: (next: ProjectConfig) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ProjectConfig>(() => structuredClone(config));
  const [newStructure, setNewStructure] = useState('');
  const [confirmProfile, setConfirmProfile] = useState<string | null>(null);

  const patch = (next: Partial<ProjectConfig>) => setDraft((prev) => ({ ...prev, ...next }));

  const applyProfile = (id: string) => {
    // Les structures déjà saisies survivent au changement de profil : ce sont
    // des données de l'organisation, pas un réglage — les perdre en essayant
    // un autre profil serait une mauvaise surprise irréversible.
    const fresh = configFromProfile(id);
    setDraft({ ...fresh, structures: draft.structures });
    setConfirmProfile(null);
  };

  const setStatusLabel = (index: number, label: string) => {
    const statuses = draft.statuses.map((s, i) => (i === index ? { ...s, label } : s));
    patch({ statuses });
  };

  const toggleDone = (index: number) => {
    const statuses = draft.statuses.map((s, i) => (i === index ? { ...s, done: !s.done } : s));
    patch({ statuses });
  };

  const moveStatus = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= draft.statuses.length) return;
    const statuses = [...draft.statuses];
    const [moved] = statuses.splice(index, 1);
    statuses.splice(target, 0, moved);
    patch({ statuses });
  };

  const addStatus = () => {
    const key = `statut-${Date.now().toString(36)}`;
    patch({ statuses: [...draft.statuses, { key, label: 'Nouveau statut' }] });
  };

  const removeStatus = (index: number) => {
    // Jamais zéro : un projet sans statut valide ne s'affiche nulle part.
    if (draft.statuses.length <= 1) return;
    patch({ statuses: draft.statuses.filter((_, i) => i !== index) });
  };

  const addStructure = () => {
    const value = newStructure.trim();
    if (!value || draft.structures.includes(value)) return;
    patch({ structures: [...draft.structures, value] });
    setNewStructure('');
  };

  const toggleField = (key: OptionalFieldKey) => {
    patch({
      fields: {
        ...draft.fields,
        [key]: { ...draft.fields[key], enabled: draft.fields[key]?.enabled === false },
      },
    });
  };

  const setFieldLabel = (key: OptionalFieldKey, label: string) => {
    patch({ fields: { ...draft.fields, [key]: { ...draft.fields[key], label } } });
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
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            Configuration des projets
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
          {/* ------------------------------------------------ profils ----- */}
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            <Sparkles size={11} strokeWidth={2} />
            Profil métier
          </p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Un préréglage complet, à appliquer puis à ajuster. Vos structures sont conservées.
          </p>

          <div className="mt-3 flex flex-col gap-2">
            {BUSINESS_PROFILES.map((profile) => {
              const current = draft.profileId === profile.id;
              const asking = confirmProfile === profile.id;
              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => (current ? undefined : asking ? applyProfile(profile.id) : setConfirmProfile(profile.id))}
                  onBlur={() => setConfirmProfile(null)}
                  className={`flex flex-col items-start gap-0.5 border px-3 py-2.5 text-left transition-colors ${
                    current
                      ? 'border-border-strong bg-accent-muted'
                      : asking
                        ? 'border-warning bg-warning-muted'
                        : 'border-border hover:border-border-strong'
                  }`}
                >
                  <span className="flex w-full items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{profile.label}</span>
                    {current && (
                      <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-text-muted">
                        Actif
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {asking ? 'Remplacer les statuts et les champs par ce profil ?' : profile.hint}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ------------------------------------------------ statuts ----- */}
          <div className="mt-6 border-t border-border pt-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Statuts, dans l’ordre du flux
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {draft.statuses.map((status, index) => (
                <div key={status.key} className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moveStatus(index, -1)}
                      disabled={index === 0}
                      aria-label="Monter"
                      className="px-1 text-text-muted transition-colors hover:text-text-primary disabled:opacity-25"
                    >
                      <GripVertical size={12} strokeWidth={2} />
                    </button>
                  </div>
                  <input
                    value={status.label}
                    onChange={(e) => setStatusLabel(index, e.target.value)}
                    className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-2.5 text-sm text-text-primary outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => toggleDone(index)}
                    title="Statut terminal : ne compte plus comme « en cours »"
                    className={`flex h-11 flex-shrink-0 items-center gap-1.5 border px-2 font-mono text-[9px] uppercase tracking-widest transition-colors ${
                      status.done
                        ? 'border-border-strong text-text-primary'
                        : 'border-border text-text-muted'
                    }`}
                  >
                    <span
                      className={`flex h-3 w-3 items-center justify-center border ${
                        status.done ? 'border-accent bg-accent text-bg' : 'border-border'
                      }`}
                    >
                      {status.done && <Check size={8} strokeWidth={4} />}
                    </span>
                    Fin
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStatus(index)}
                    disabled={draft.statuses.length <= 1}
                    aria-label="Retirer ce statut"
                    className="flex h-11 w-8 flex-shrink-0 items-center justify-center text-text-muted transition-colors hover:text-danger disabled:opacity-25"
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addStatus}
              className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 border border-dashed border-border font-mono text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:border-border-strong hover:text-text-secondary"
            >
              <Plus size={13} strokeWidth={2} />
              Ajouter un statut
            </button>
          </div>

          {/* --------------------------------------------- structures ----- */}
          <div className="mt-6 border-t border-border pt-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Structures
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              Vos entités, marques ou pôles. Laissez vide si vous n’en avez qu’une.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {draft.structures.map((structure) => (
                <span
                  key={structure}
                  className="flex items-center gap-1.5 border border-border px-2 py-1 text-xs text-text-primary"
                >
                  {structure}
                  <button
                    type="button"
                    onClick={() => patch({ structures: draft.structures.filter((s) => s !== structure) })}
                    aria-label={`Retirer ${structure}`}
                    className="text-text-muted transition-colors hover:text-danger"
                  >
                    <X size={11} strokeWidth={2.5} />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={newStructure}
                onChange={(e) => setNewStructure(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addStructure();
                  }
                }}
                placeholder="ex. Syraagensy"
                className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-3 text-sm text-text-primary outline-none"
              />
              <button
                type="button"
                onClick={addStructure}
                className="min-h-11 flex-shrink-0 border border-border px-3 font-mono text-[10px] uppercase tracking-widest text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                Ajouter
              </button>
            </div>
          </div>

          {/* -------------------------------------------------- champs ----- */}
          <div className="mt-6 border-t border-border pt-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Champs affichés
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {FIELD_ORDER.map((key) => {
                const on = draft.fields[key]?.enabled !== false;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleField(key)}
                      className="flex h-11 flex-shrink-0 items-center gap-2 px-1"
                      aria-label={`${on ? 'Masquer' : 'Afficher'} ${FIELD_LABELS[key]}`}
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center border ${
                          on ? 'border-accent bg-accent text-bg' : 'border-border'
                        }`}
                      >
                        {on && <Check size={11} strokeWidth={3} />}
                      </span>
                    </button>
                    <input
                      value={draft.fields[key]?.label ?? ''}
                      onChange={(e) => setFieldLabel(key, e.target.value)}
                      placeholder={FIELD_LABELS[key]}
                      disabled={!on}
                      className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-2.5 text-sm text-text-primary outline-none disabled:opacity-40"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* -------------------------------------------- champs libres ----- */}
          <div className="mt-6 border-t border-border pt-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Champs libres ({draft.extraFields.length}/{MAX_EXTRA_FIELDS})
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              Du texte, pour ce que le moteur ne prévoit pas — « n° de dossier », « interlocuteur ».
              <span className="text-text-muted">
                {' '}
                Volontairement limités : au-delà, ce n’est plus un réglage, c’est une base de données
                à concevoir.
              </span>
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {draft.extraFields.map((field, index) => (
                <div key={field.key} className="flex items-center gap-2">
                  <input
                    value={field.label}
                    onChange={(e) =>
                      patch({
                        extraFields: draft.extraFields.map((f, i) =>
                          i === index ? { ...f, label: e.target.value } : f,
                        ),
                      })
                    }
                    className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-2.5 text-sm text-text-primary outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => patch({ extraFields: draft.extraFields.filter((_, i) => i !== index) })}
                    aria-label="Retirer ce champ"
                    className="flex h-11 w-8 flex-shrink-0 items-center justify-center text-text-muted transition-colors hover:text-danger"
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
            {draft.extraFields.length < MAX_EXTRA_FIELDS && (
              <button
                type="button"
                onClick={() =>
                  patch({
                    extraFields: [
                      ...draft.extraFields,
                      { key: `libre-${Date.now().toString(36)}`, label: 'Nouveau champ' },
                    ],
                  })
                }
                className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 border border-dashed border-border font-mono text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:border-border-strong hover:text-text-secondary"
              >
                <Plus size={13} strokeWidth={2} />
                Ajouter un champ libre
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 gap-2 border-t border-border p-3">
          <button
            type="button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="min-h-11 flex-1 bg-accent px-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 border border-border px-4 text-xs uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary"
          >
            Annuler
          </button>
        </div>
      </motion.div>
    </div>
  );
}
