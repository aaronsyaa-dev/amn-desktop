import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Copy, Download, ExternalLink, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { cleanErrorMessage } from '../lib/errorMessage';
import { Logo } from '../components/Logo';
import type { WelcomeAccess, WelcomePreview } from '../shared/api';

/**
 * LE LIEN DE BIENVENUE — la première impression d'une cliente (Bloc 2)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Elle arrive ici par un lien unique, transmis par n'importe quel canal. La
 * page est publique : elle n'a pas encore de compte ouvert, et elle ne doit
 * rien avoir à comprendre. Trois temps, dans cet ordre, et l'ordre compte :
 *
 *   1. l'accueil — chez qui, un mot chaleureux, et ce qu'il va se passer ;
 *      la politique d'utilisation à accepter AVANT tout accès ;
 *   2. les accès — identifiant et mot de passe temporaire, affichés UNE fois,
 *      avec les deux portes : ouvrir l'application web, installer le bureau ;
 *   3. « j'ai bien reçu mes accès » — le lien meurt, et la page le dit.
 *
 * ## Ce qu'elle dit avant de montrer
 *
 * « Ce lien est à usage unique, notez vos accès » — écrit AVANT la
 * révélation, pas après. Une personne qui referme l'onglet par réflexe ne
 * doit pas découvrir trop tard que la page ne se rouvrira pas telle quelle
 * (elle se rouvre, mais avec un mot de passe NEUF — et elle le dit aussi).
 *
 * ## La grammaire est celle du Majordome
 *
 * Sobre, chaleureux, sans emphase, sans point d'exclamation. On félicite en
 * une phrase, on n'insiste pas. Le texte légal est un GABARIT clairement
 * marqué qu'Aaron remplace ; rien ici n'engage juridiquement.
 */

const POLITIQUE_GABARIT = `[GABARIT — À REMPLACER PAR LE TEXTE D'AARON]

Politique d'utilisation d'AMN Desktop.

1. L'espace de travail et les données qui y sont saisies appartiennent à votre organisation.
2. Vos accès sont personnels : un identifiant, un mot de passe, une personne.
3. Votre prestataire assure l'hébergement, la supervision et la sauvegarde de votre espace.
4. Vous pouvez demander l'export complet de vos données à tout moment.

[Fin du gabarit.]`;

type Etape = 'lecture' | 'accueil' | 'acces' | 'fini' | 'indisponible';

export function WelcomeScreen() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [apercu, setApercu] = useState<WelcomePreview | null>(null);
  const [acces, setAcces] = useState<WelcomeAccess | null>(null);
  const [etape, setEtape] = useState<Etape>('lecture');
  const [politiqueAcceptee, setPolitiqueAcceptee] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState<'identifiant' | 'motdepasse' | null>(null);
  const [motDePasseVisible, setMotDePasseVisible] = useState(true);

  // Le jeton est lu à l'arrivée — et à chaque nouveau lien collé dans la même
  // fenêtre — puis retiré de l'adresse : c'est un secret.
  useEffect(() => {
    const lire = () => {
      const hash = window.location.hash;
      const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
      const found = (new URLSearchParams(query).get('token') ?? '').trim();
      if (found) {
        setAcces(null);
        setPolitiqueAcceptee(false);
        setEtape('lecture');
        setToken(found);
        window.history.replaceState(null, '', `${window.location.pathname}#/bienvenue`);
      } else if (!window.location.hash.includes('token=')) {
        setEtape((e) => (e === 'lecture' ? 'indisponible' : e));
      }
    };
    lire();
    window.addEventListener('hashchange', lire);
    return () => window.removeEventListener('hashchange', lire);
  }, []);

  useEffect(() => {
    if (!token) return;
    let vivant = true;
    (async () => {
      try {
        const p = await bridge().remote.welcome.inspect(token);
        if (!vivant) return;
        setApercu(p);
        setEtape(p.status === 'ready' ? 'accueil' : 'indisponible');
      } catch (err) {
        if (!vivant) return;
        setErreur(cleanErrorMessage(err, 'Cette page n’a pas pu être ouverte.'));
        setEtape('indisponible');
      }
    })();
    return () => {
      vivant = false;
    };
  }, [token]);

  const reveler = async () => {
    if (!politiqueAcceptee || busy) return;
    setBusy(true);
    setErreur(null);
    try {
      const a = await bridge().remote.welcome.reveal(token);
      setAcces(a);
      setEtape('acces');
    } catch (err) {
      setErreur(cleanErrorMessage(err, 'Vos accès n’ont pas pu être affichés.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmer = async () => {
    if (busy) return;
    setBusy(true);
    setErreur(null);
    try {
      await bridge().remote.welcome.confirm(token);
      setEtape('fini');
    } catch (err) {
      setErreur(cleanErrorMessage(err, 'La confirmation n’a pas pu être enregistrée.'));
    } finally {
      setBusy(false);
    }
  };

  const copier = async (quoi: 'identifiant' | 'motdepasse', texte: string) => {
    try {
      await navigator.clipboard?.writeText(texte);
      setCopie(quoi);
      window.setTimeout(() => setCopie(null), 2000);
    } catch {
      /* presse-papiers refusé : le texte reste sélectionnable */
    }
  };

  const produit = apercu?.productName ?? acces?.productName ?? 'AMN Desktop';
  const prenom = apercu?.firstName ?? null;
  const salut = useMemo(() => (prenom ? `Bienvenue, ${prenom}.` : 'Bienvenue.'), [prenom]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="w-full max-w-lg border border-border bg-surface p-6 sm:p-8"
      >
        <Logo className="h-7 w-auto" />

        {etape === 'lecture' && (
          <p className="mt-8 flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 size={15} className="animate-spin" />
            Ouverture de votre lien…
          </p>
        )}

        {etape === 'indisponible' && (
          <div className="mt-8">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
              <ShieldCheck size={13} strokeWidth={2} />
              Lien de bienvenue
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-text-primary">
              {apercu?.status === 'used' ? 'Ce lien a déjà servi' : 'Ce lien n’est plus valable'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              {apercu?.status === 'used'
                ? 'Vos accès ont été remis et ce lien s’est détruit, comme prévu. Connectez-vous avec l’identifiant et le mot de passe que vous avez notés.'
                : 'Un lien de bienvenue expire au bout de sept jours et ne sert qu’une fois. Demandez-en un nouveau à votre prestataire.'}
            </p>
            {erreur && <p className="mt-3 text-xs text-text-muted">{erreur}</p>}
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="mt-6 flex min-h-12 w-full items-center justify-center bg-accent text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
            >
              Aller à la connexion
            </button>
          </div>
        )}

        {etape === 'accueil' && apercu && (
          <div className="mt-8">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
              <ShieldCheck size={13} strokeWidth={2} />
              {apercu.orgName} · {produit}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-text-primary">{salut}</h1>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              Votre espace de travail est prêt, et c’est une bonne nouvelle : à partir d’aujourd’hui,
              {' '}{apercu.orgName} a un endroit à elle. Cette page vous remet vos accès, puis se referme.
            </p>

            <div className="mt-5 border border-border bg-bg px-3 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Avant d’aller plus loin</p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                Ce lien est à <span className="text-text-primary">usage unique</span>. Vos accès
                s’afficheront une seule fois : notez-les avant de valider leur réception.
              </p>
            </div>

            <section className="mt-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Politique d’utilisation
              </p>
              <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap border border-border bg-bg p-3 font-sans text-[12px] leading-relaxed text-text-secondary">
                {POLITIQUE_GABARIT}
              </pre>
              <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={politiqueAcceptee}
                  onChange={(e) => setPolitiqueAcceptee(e.target.checked)}
                  className="mt-1 h-4 w-4 flex-shrink-0 accent-[var(--color-accent)]"
                />
                <span className="text-sm leading-relaxed text-text-primary">
                  J’ai lu la politique d’utilisation et je l’accepte.
                </span>
              </label>
            </section>

            {erreur && (
              <p role="alert" className="mt-4 border border-danger/40 bg-danger-muted px-3 py-2 text-xs leading-relaxed text-danger">
                {erreur}
              </p>
            )}

            <button
              type="button"
              disabled={!politiqueAcceptee || busy}
              onClick={() => void reveler()}
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 bg-accent text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              Afficher mes accès
            </button>
            {apercu.alreadyRevealed && (
              <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
                Vos accès ont déjà été affichés une fois sans être confirmés : les afficher à nouveau
                fabrique un nouveau mot de passe, et l’ancien ne vaudra plus rien.
              </p>
            )}
          </div>
        )}

        {etape === 'acces' && acces && (
          <div className="mt-8">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
              <KeyRound size={13} strokeWidth={2} />
              Vos accès · à noter maintenant
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-text-primary">Voici vos accès</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Ils ne seront plus affichés après votre confirmation. Le mot de passe est temporaire :
              l’application vous proposera d’en choisir un à vous.
            </p>

            <dl className="mt-5 flex flex-col gap-3">
              <div className="border border-border bg-bg px-3 py-2.5">
                <dt className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Identifiant</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all font-mono text-[13px] text-text-primary">{acces.email}</code>
                  <button
                    type="button"
                    onClick={() => void copier('identifiant', acces.email)}
                    className="flex min-h-11 flex-shrink-0 items-center gap-1.5 border border-border-strong px-2.5 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors hover:bg-surface-hover md:min-h-0 md:py-1.5"
                  >
                    {copie === 'identifiant' ? <Check size={12} /> : <Copy size={12} />}
                    {copie === 'identifiant' ? 'Copié' : 'Copier'}
                  </button>
                </dd>
              </div>
              <div className="border border-border bg-bg px-3 py-2.5">
                <dt className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Mot de passe temporaire</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all font-mono text-[13px] tracking-wide text-text-primary">
                    {motDePasseVisible ? acces.password : '•'.repeat(acces.password.length)}
                  </code>
                  <button
                    type="button"
                    onClick={() => setMotDePasseVisible((v) => !v)}
                    className="min-h-11 flex-shrink-0 px-2 font-mono text-[10px] uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary md:min-h-0"
                  >
                    {motDePasseVisible ? 'Masquer' : 'Afficher'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copier('motdepasse', acces.password)}
                    className="flex min-h-11 flex-shrink-0 items-center gap-1.5 border border-border-strong px-2.5 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors hover:bg-surface-hover md:min-h-0 md:py-1.5"
                  >
                    {copie === 'motdepasse' ? <Check size={12} /> : <Copy size={12} />}
                    {copie === 'motdepasse' ? 'Copié' : 'Copier'}
                  </button>
                </dd>
              </div>
            </dl>

            <section className="mt-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Pour commencer</p>
              <div className="mt-2 flex flex-col gap-2">
                {acces.appUrl && (
                  <a
                    href={`${acces.appUrl}/#/login`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-12 items-center justify-between gap-3 border border-border-strong bg-surface px-3 text-sm text-text-primary transition-colors hover:bg-surface-hover"
                  >
                    <span>Ouvrir {produit} dans le navigateur</span>
                    <ExternalLink size={15} className="flex-shrink-0 text-text-muted" />
                  </a>
                )}
                {acces.installer ? (
                  <a
                    href={acces.installer.url}
                    className="flex min-h-12 items-center justify-between gap-3 border border-border bg-surface px-3 text-sm text-text-primary transition-colors hover:bg-surface-hover"
                  >
                    <span>
                      Installer {produit} sur Windows
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">v{acces.installer.version}</span>
                    </span>
                    <Download size={15} className="flex-shrink-0 text-text-muted" />
                  </a>
                ) : (
                  <p className="text-[11px] leading-relaxed text-text-muted">
                    Sur Mac ou sur téléphone, le navigateur est le chemin : ajoutez la page à votre écran d’accueil.
                  </p>
                )}
              </div>
            </section>

            {erreur && (
              <p role="alert" className="mt-4 border border-danger/40 bg-danger-muted px-3 py-2 text-xs leading-relaxed text-danger">
                {erreur}
              </p>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmer()}
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 bg-accent text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              J’ai bien reçu mes accès
            </button>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-text-muted">
              En confirmant, ce lien se détruit. Vos accès, eux, restent valables.
            </p>
          </div>
        )}

        {etape === 'fini' && (
          <div className="mt-8 flex flex-col items-center text-center">
            <span className="flex h-12 w-12 items-center justify-center border border-accent text-accent">
              <Check size={24} strokeWidth={2.25} />
            </span>
            <h1 className="mt-4 text-xl font-bold tracking-tight text-text-primary">Ce lien est maintenant détruit</h1>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">
              Vos accès sont entre vos mains. Bienvenue chez vous.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="mt-6 flex min-h-12 w-full items-center justify-center bg-accent text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
            >
              Me connecter
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
