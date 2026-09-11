import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { cleanErrorMessage } from '../lib/errorMessage';
import { Logo } from '../components/Logo';
import { useLangue } from '../i18n';

/**
 * CHOISIR UN NOUVEAU MOT DE PASSE — le lien reçu par courriel (L'Automatique, Bloc 6).
 *
 * Le serveur envoie `#/reinitialiser?token=…` quand le courrier est en ligne
 * (docs/EMAILS.md, amn-api). Même discipline que l'invitation : le jeton est lu
 * une fois puis retiré de l'adresse ; un jeton absent, inconnu, expiré ou déjà
 * servi produit la même réponse, et l'écran dit ce qui est vrai — « ce lien ne
 * vaut plus » — sans deviner pourquoi.
 */
const MIN_LENGTH = 8;

export function ReinitialisationScreen() {
  const { t } = useLangue();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
    const found = new URLSearchParams(query).get('token') ?? '';
    if (found) {
      setToken(found.trim());
      window.history.replaceState(null, '', `${window.location.pathname}#/reinitialiser`);
    }
  }, []);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirmation.length > 0 && confirmation !== password;
  const ready = useMemo(() => token.trim().length > 0 && password.length >= MIN_LENGTH && confirmation === password, [token, password, confirmation]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await bridge().remote.resetPassword(token.trim(), password);
      setDone(true);
      window.setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (err) {
      setError(cleanErrorMessage(err, t('reinit.erreur')));
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }} className="w-full max-w-md border border-border bg-surface p-6 sm:p-8">
        <Logo className="h-7 w-auto" />
        {done ? (
          <div className="mt-8 flex flex-col items-center text-center">
            <span className="flex h-12 w-12 items-center justify-center border border-accent text-accent"><Check size={24} strokeWidth={2.25} /></span>
            <h1 className="mt-4 text-xl font-bold tracking-tight text-text-primary">{t('reinit.fait')}</h1>
            <p className="mt-1 text-sm text-text-secondary">{t('reinit.faitSuite')}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted"><KeyRound size={13} strokeWidth={2} />{t('reinit.surtitre')}</div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-text-primary">{t('reinit.titre')}</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{t('reinit.aide')}</p>
            {!token && (
              <label className="mt-6 block">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('reinit.code')}</span>
                <input value={token} onChange={(e) => setToken(e.target.value)} autoFocus aria-label={t('reinit.code')} className="input-focus min-h-12 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
              </label>
            )}
            <label className="mt-5 block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('reinit.motDePasse')}</span>
              <div className="flex min-h-12 items-center border border-border bg-bg px-3">
                <input type={visible ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus={Boolean(token)} autoComplete="new-password" aria-label={t('reinit.motDePasse')} className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none" />
                <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? t('reinit.masquer') : t('reinit.afficher')} className="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center text-text-muted transition-colors hover:text-text-primary">
                  {visible ? <EyeOff size={15} strokeWidth={1.9} /> : <Eye size={15} strokeWidth={1.9} />}
                </button>
              </div>
              <span className={`mt-1 block font-mono text-[10px] uppercase tracking-widest ${tooShort ? 'text-danger' : 'text-text-muted'}`}>{t('reinit.minimum', { n: MIN_LENGTH })}</span>
            </label>
            <label className="mt-4 block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('reinit.confirmation')}</span>
              <input type={visible ? 'text' : 'password'} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="new-password" aria-label={t('reinit.confirmation')} className="input-focus min-h-12 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
              {mismatch && <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-danger">{t('reinit.differe')}</span>}
            </label>
            {error && (
              <div role="alert" className="mt-4 border border-danger/40 bg-danger-muted px-3 py-2">
                <p className="text-xs leading-relaxed text-danger">{error}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">{t('reinit.erreurSuite')}</p>
              </div>
            )}
            <button type="submit" disabled={!ready || busy} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 bg-accent text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40">
              {busy && <Loader2 size={16} className="animate-spin" />}{t('reinit.valider')}
            </button>
            <button type="button" onClick={() => navigate('/login', { replace: true })} className="mt-3 flex min-h-11 w-full items-center justify-center text-xs text-text-muted transition-colors hover:text-text-secondary">{t('reinit.retour')}</button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
