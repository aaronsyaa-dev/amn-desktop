import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Check, Copy, ImagePlus, Info, KeyRound, Link2, X } from 'lucide-react';
import { useOrgContext } from '../../state/OrgContextContext';
import { bridge } from '../../lib/bridge';
import { cleanErrorMessage } from '../../lib/errorMessage';
import { resizeImageToDataUrl } from '../../lib/imageResize';
import { OrgAvatar } from './OrgAvatar';
import type { OrgPlan } from '../../shared/api';

const EASE = [0.16, 1, 0.3, 1] as const;

/** Icône du rail : petite par destination, donc petite à la source. */
const LOGO_MAX_DIM = 160;
/** Marge sous le plafond d'amn-api (48 Ko), pour ne jamais être refusé de peu. */
const LOGO_MAX_CHARS = 44 * 1024;

type Handover = 'password' | 'invitation';

/**
 * Création d'une organisation cliente, depuis l'interface.
 *
 * Remplace `scripts/create-business-org.mjs`, qui demandait un terminal, le
 * jeton opérateur en variable d'environnement et une ligne de commande sans
 * faute de frappe — pour un geste qu'Aaron fera à chaque nouvelle cliente.
 *
 * Le formulaire dit ce que le script disait dans son aide, mais à l'endroit où
 * ça compte : la raison sociale est celle qui apparaîtra sur les devis de la
 * cliente, et c'est écrit sous le champ, pas dans une documentation.
 *
 * La remise de l'accès garde les deux options du script, parce qu'elles ne
 * servent pas la même situation :
 *   - un mot de passe temporaire se dicte au téléphone et ne périme pas ;
 *   - un lien d'activation laisse la cliente choisir son mot de passe, mais
 *     vaut 7 jours et ne s'utilise qu'une fois.
 */
export function CreateOrgDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { refreshOrganizations, enterOrganization } = useOrgContext();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState<OrgPlan>('business_standard');
  const [handover, setHandover] = useState<Handover>('password');
  const [logo, setLogo] = useState<string>('');
  const [logoError, setLogoError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    orgId: string;
    orgName: string;
    email: string;
    secret: string;
    kind: Handover;
    expiresAt?: string;
  } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setPlan('business_standard');
    setHandover('password');
    setLogo('');
    setLogoError(null);
    setError(null);
    setResult(null);
    setBusy(false);
    const timer = window.setTimeout(() => nameRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    setLogoError(null);
    try {
      // PNG d'abord, pour garder la transparence d'un logo. Si le résultat est
      // trop lourd (photo aplatie en PNG), on retombe sur du JPEG : mieux vaut
      // un fond blanc qu'un logo refusé.
      let dataUrl = await resizeImageToDataUrl(file, LOGO_MAX_DIM, 0.9, 'image/png');
      if (dataUrl.length > LOGO_MAX_CHARS) {
        dataUrl = await resizeImageToDataUrl(file, LOGO_MAX_DIM, 0.82, 'image/jpeg');
      }
      if (dataUrl.length > LOGO_MAX_CHARS) {
        setLogoError('Image trop lourde même réduite — choisissez un logo plus simple.');
        return;
      }
      setLogo(dataUrl);
    } catch {
      setLogoError('Image illisible.');
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) return setError('La raison sociale est obligatoire.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      return setError('Adresse email du compte propriétaire invalide.');
    }

    setBusy(true);
    try {
      const created = await bridge().remote.admin.createOrganization({
        name: trimmedName,
        ownerEmail: trimmedEmail,
        plan,
        logoDataUrl: logo || undefined,
      });
      if (!created.owner) throw new Error('Organisation créée sans compte propriétaire.');

      if (handover === 'password') {
        // Le mot de passe temporaire active le compte au passage : la cliente
        // se connecte avec, puis le change dans Paramètres.
        const reset = await bridge().remote.admin.resetPassword(
          created.organization.id,
          created.owner.id,
        );
        setResult({
          orgId: created.organization.id,
          orgName: created.organization.name,
          email: trimmedEmail,
          secret: reset.password,
          kind: 'password',
        });
      } else {
        if (!created.invitation) throw new Error('Aucun lien d’activation n’a été émis.');
        setResult({
          orgId: created.organization.id,
          orgName: created.organization.name,
          email: trimmedEmail,
          secret: created.invitation.token,
          kind: 'invitation',
          expiresAt: created.invitation.expiresAt,
        });
      }
      await refreshOrganizations();
    } catch (err) {
      setError(cleanErrorMessage(err, 'Création refusée.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <React.Fragment key="create-org">
          <motion.div
            key="create-org-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={busy ? undefined : onClose}
            className="fixed inset-0 z-[180] bg-black/70 backdrop-blur-[2px]"
            aria-hidden
          />
          <motion.div
            key="create-org-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Créer une organisation cliente"
            initial={{ opacity: 0, y: 20, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.99 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="elev-3 fixed inset-x-0 bottom-0 z-[181] max-h-[88vh] overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(32rem,calc(100vw-3rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-muted text-text-primary">
                  <Building2 size={17} strokeWidth={1.75} />
                </span>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-text-primary">
                    {result ? 'Organisation créée' : 'Nouvelle organisation cliente'}
                  </h2>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
                    {result ? 'Accès à remettre' : 'Compte propriétaire inclus'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                aria-label="Fermer"
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary disabled:opacity-40"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {result ? (
              <HandoverPanel
                result={result}
                onOpen={() => {
                  onClose();
                  void enterOrganization(result.orgId);
                }}
                onClose={onClose}
              />
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">Raison sociale</span>
                  <input
                    ref={nameRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Syraagensy"
                    className="input-focus rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary"
                  />
                  {/* Le point qui coûtait le plus cher à découvrir après coup :
                      ce nom part sur les devis de la cliente. */}
                  <span className="flex items-start gap-1.5 text-[11px] leading-relaxed text-text-muted">
                    <Info size={12} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" />
                    Ce nom apparaît dans son application <strong className="font-medium text-text-secondary">et en
                    émetteur sur les devis qu’elle imprime</strong>. Mettez sa vraie raison sociale, pas un surnom.
                  </span>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">
                    Email du compte propriétaire
                  </span>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="off"
                    placeholder="elle@exemple.fr"
                    className="input-focus rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary"
                  />
                </label>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">Logo (optionnel)</span>
                  <div className="flex items-center gap-3">
                    <OrgAvatar name={name || 'Organisation'} logoDataUrl={logo} size={44} />
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void pickLogo(e.target.files?.[0])}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                    >
                      <ImagePlus size={14} strokeWidth={1.75} />
                      {logo ? 'Changer' : 'Choisir un fichier'}
                    </button>
                    {logo && (
                      <button
                        type="button"
                        onClick={() => setLogo('')}
                        className="text-xs text-text-muted transition-colors hover:text-text-primary"
                      >
                        Retirer
                      </button>
                    )}
                  </div>
                  <span className="text-[11px] leading-relaxed text-text-muted">
                    Sert d’icône dans le rail. Sans logo, ce sont les initiales — c’est prévu, pas un
                    manque.
                  </span>
                  {logoError && <span className="text-[11px] text-danger">{logoError}</span>}
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">Édition</span>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as OrgPlan)}
                    className="input-focus rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="business_standard">AMN Business — standard</option>
                    <option value="business_premium">AMN Business — premium</option>
                  </select>
                </label>

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-xs font-medium text-text-secondary">
                    Remise de l’accès
                  </legend>
                  <HandoverChoice
                    checked={handover === 'password'}
                    onChange={() => setHandover('password')}
                    icon={<KeyRound size={14} strokeWidth={1.75} />}
                    title="Mot de passe temporaire"
                    detail="Se dicte au téléphone, ne périme pas. À changer dans ses Paramètres."
                  />
                  <HandoverChoice
                    checked={handover === 'invitation'}
                    onChange={() => setHandover('invitation')}
                    icon={<Link2 size={14} strokeWidth={1.75} />}
                    title="Lien d’activation"
                    detail="Elle choisit son mot de passe. Valable 7 jours, à usage unique."
                  />
                </fieldset>

                {error && (
                  <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-text-secondary">
                    {error}
                  </p>
                )}

                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={busy}
                    className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm text-text-secondary transition-colors hover:text-text-primary disabled:opacity-40"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-50"
                  >
                    {busy ? 'Création…' : 'Créer l’organisation'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}

function HandoverChoice({
  checked,
  onChange,
  icon,
  title,
  detail,
}: {
  checked: boolean;
  onChange: () => void;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
        checked ? 'border-border-strong bg-accent-muted' : 'border-border hover:border-border-strong'
      }`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="sr-only"
        name="handover"
      />
      <span className={`mt-0.5 ${checked ? 'text-text-primary' : 'text-text-muted'}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm text-text-primary">{title}</span>
        <span className="block text-[11px] leading-relaxed text-text-muted">{detail}</span>
      </span>
    </label>
  );
}

/**
 * L'écran de remise. Le secret n'est affiché qu'ici et qu'une fois : amn-api
 * n'en garde que l'empreinte, et il n'existe aucun moyen de le relire ensuite.
 * L'écran le dit, plutôt que de laisser l'opérateur fermer trop vite.
 */
function HandoverPanel({
  result,
  onOpen,
  onClose,
}: {
  result: {
    orgName: string;
    email: string;
    secret: string;
    kind: Handover;
    expiresAt?: string;
  };
  onOpen: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const copy = async () => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(result.secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError('Copie impossible — sélectionnez le texte et copiez-le à la main.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-bg p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
          {result.kind === 'password' ? 'Mot de passe temporaire' : 'Jeton d’activation'}
        </p>
        <div className="mt-2 flex items-start gap-2">
          <code className="min-w-0 flex-1 break-all font-mono text-sm text-text-primary">
            {result.secret}
          </code>
          <button
            type="button"
            onClick={() => void copy()}
            aria-label="Copier"
            className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-[10px] uppercase tracking-widest text-text-secondary transition-colors hover:text-text-primary"
          >
            {copied ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={2} />}
            {copied ? 'Copié' : 'Copier'}
          </button>
        </div>
        {copyError && <p className="mt-2 text-[11px] text-danger">{copyError}</p>}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        <dt className="text-text-muted">Organisation</dt>
        <dd className="text-text-primary">{result.orgName}</dd>
        <dt className="text-text-muted">Compte</dt>
        <dd className="text-text-primary">{result.email}</dd>
        {result.expiresAt && (
          <>
            <dt className="text-text-muted">Expire le</dt>
            <dd className="text-text-primary">
              {new Date(result.expiresAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </dd>
          </>
        )}
      </dl>

      <p className="rounded-lg border border-warning/40 bg-warning-muted px-3 py-2 text-[11px] leading-relaxed text-text-secondary">
        Affiché une seule fois — seule son empreinte est conservée. Transmettez-le de vive voix
        plutôt que par email, et faites-le changer à la première connexion.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          Fermer
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
        >
          Ouvrir son espace
        </button>
      </div>
    </div>
  );
}
