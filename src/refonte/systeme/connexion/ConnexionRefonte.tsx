import React, { useEffect, useId, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../../auth/AuthContext';
import { bridge } from '../../../lib/bridge';
import { cleanErrorMessage, isRedirection } from '../../../lib/errorMessage';
import { useLangue } from '../../../i18n';
import { EDITION_PRODUCT_NAME, APP_VERSION } from '../../../edition/edition';
import { REGISTRE_MODULES } from '../../modules/registre';
import { useMots } from './i18n';
import './connexion.css';

/**
 * LA CONNEXION (G06) — l'interface seulement. L'authentification ne change pas.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Même logique que `src/screens/LoginScreen.tsx` (qui reste intact : l'édition cliente le monte encore) :
 * `login` puis, si le serveur exige un second facteur, `completeMfa` ; le mot de passe oublié
 * PRÉVIENT le prestataire (`forgotPassword`, réponse identique que l'adresse existe ou non) ; un refus
 * d'édition (`isRedirection`) se lit en gris. Seuls la présentation et la mise en page changent.
 *
 * Deux colonnes : à gauche la présentation (rien n'est lu dans l'espace avant la connexion : « 101 » et « 8 »
 * viennent du registre local, le reste est du texte fixe) ; à droite le formulaire de 360 px, centré.
 *
 * Le contrat que les contrôles de bout en bout attendent est conservé : `input[name="email"]`,
 * `input[name="password"]`, UN SEUL `button[type="submit"]` visible à la fois (les vues connexion, double
 * vérification et mot de passe oublié sont exclusives), et `name="password"` n'existe nulle part ailleurs.
 */

type Vue = 'connexion' | 'mfa' | 'oublie';
type Phase = 'repos' | 'envoi' | 'succes';

/** Un chiffre de présentation fixe, à faire valider : il est visible avant toute connexion, donc jamais lu dans la base. */
export const ORGANISATIONS_PRESENTEES = 12;

const EMAIL_COMPLET = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Le texte d'aide d'un champ e-mail, ou `null` quand il est correct. Fonction pure. */
export function aideEmail(email: string): 'erreur.email.vide' | 'erreur.email.incomplet' | null {
  const v = email.trim();
  if (!v) return 'erreur.email.vide';
  return EMAIL_COMPLET.test(v) ? null : 'erreur.email.incomplet';
}

function useEnLigne(): [boolean, () => void] {
  const [enLigne, setEnLigne] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const oui = () => setEnLigne(true);
    const non = () => setEnLigne(false);
    window.addEventListener('online', oui);
    window.addEventListener('offline', non);
    return () => {
      window.removeEventListener('online', oui);
      window.removeEventListener('offline', non);
    };
  }, []);
  // « Réessayer » relit l'état du réseau : aucune requête n'est faite avant la connexion.
  return [enLigne, () => setEnLigne(typeof navigator === 'undefined' ? true : navigator.onLine)];
}

export function ConnexionRefonte() {
  const { t } = useLangue();
  const { tm } = useMots();
  const { login, completeMfa, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [enLigne, relireReseau] = useEnLigne();

  const [vue, setVue] = useState<Vue>('connexion');
  const [phase, setPhase] = useState<Phase>('repos');
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [montrer, setMontrer] = useState(false);
  const [majuscules, setMajuscules] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [aide, setAide] = useState<'erreur.email.vide' | 'erreur.email.incomplet' | null>(null);
  const [defi, setDefi] = useState<{ challenge: string; email: string } | null>(null);
  const [code, setCode] = useState('');
  const [secours, setSecours] = useState(false);
  const [oublie, setOublie] = useState<'saisie' | 'envoi' | 'fait'>('saisie');
  const [oublieChemin, setOublieChemin] = useState<'envoye' | 'manuel'>('manuel');
  const [acces, setAcces] = useState(false);
  const champMdp = useRef<HTMLInputElement>(null);
  const champEmail = useRef<HTMLInputElement>(null);
  const idErreur = useId();
  const idAideEmail = useId();
  const idMaj = useId();
  const minuteur = useRef<number | null>(null);

  // Le mot de passe affiché repasse en masqué après 30 s sans frappe, et à chaque envoi.
  useEffect(() => {
    if (!montrer) return undefined;
    const id = window.setTimeout(() => setMontrer(false), 30_000);
    return () => window.clearTimeout(id);
  }, [montrer, mdp]);
  useEffect(() => () => {
    if (minuteur.current) window.clearTimeout(minuteur.current);
  }, []);

  if (isAuthenticated && phase !== 'succes') {
    const depuis = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';
    return <Navigate to={depuis} replace />;
  }

  const envoi = phase === 'envoi';
  const parti = phase === 'succes';
  const nombreModules = REGISTRE_MODULES.entrees.length;
  const nombreFamilles = REGISTRE_MODULES.familles.length;

  const reussir = () => {
    setPhase('succes');
    minuteur.current = window.setTimeout(() => navigate('/', { replace: true }), 480);
  };

  const surConnexion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErreur(null);
    const probleme = aideEmail(email);
    setAide(probleme);
    if (probleme === 'erreur.email.vide' || !mdp) {
      if (!mdp && !probleme) setErreur(t('connexion.champsRequis'));
      if (probleme) champEmail.current?.focus();
      else champMdp.current?.focus();
      return;
    }
    setPhase('envoi');
    setMontrer(false);
    try {
      const sortie = await login(email, mdp);
      if (sortie.kind === 'mfa') {
        // Second facteur dû : le défi reste en mémoire, jamais écrit nulle part.
        setDefi({ challenge: sortie.challenge, email: sortie.email });
        setVue('mfa');
        setPhase('repos');
        return;
      }
      reussir();
    } catch (err) {
      setPhase('repos');
      // Le mot de passe est vidé et le focus lui revient : on le retape, on ne le corrige pas.
      setMdp('');
      setErreur(err instanceof Error ? err.message : t('connexion.erreurGenerique'));
      window.setTimeout(() => champMdp.current?.focus(), 0);
    }
  };

  const surCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!defi) return;
    setErreur(null);
    setPhase('envoi');
    try {
      await completeMfa({ challenge: defi.challenge, ...(secours ? { backupCode: code.trim() } : { code: code.trim() }) });
      reussir();
    } catch (err) {
      setPhase('repos');
      setCode('');
      setErreur(err instanceof Error ? err.message : t('connexion.mfa.codeInvalide'));
    }
  };

  const surOublie = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (oublie !== 'saisie' || !EMAIL_COMPLET.test(email.trim())) return;
    setOublie('envoi');
    try {
      const r = await bridge().remote.forgotPassword(email.trim());
      setOublieChemin(r.courrier);
    } catch {
      /* la réponse est la même quoi qu'il arrive : le message final vaut */
    }
    setOublie('fait');
  };

  const surTouche = (e: React.KeyboardEvent<HTMLInputElement>) => setMajuscules(e.getModifierState?.('CapsLock') ?? false);
  const message = erreur ? cleanErrorMessage(erreur, t('connexion.erreurGenerique')) : null;
  const redirection = erreur ? isRedirection(erreur) : false;
  const invalide = Boolean(erreur) && !redirection;
  const produit = EDITION_PRODUCT_NAME;

  return (
    <motion.main
      data-connexion
      data-refonte-police="inter"
      className="cx"
      initial={{ opacity: 0 }}
      animate={{ opacity: parti ? 0 : 1 }}
      transition={{ duration: parti ? 0.4 : 0.18 }}
    >
      <aside className="cx-gauche" aria-label={produit}>
        <div className="cx-marque">
          <span aria-hidden className="cx-marque__logo">
            A
          </span>
          <span className="cx-marque__nom">{produit}</span>
        </div>

        <div className="cx-presentation">
          <p className="cx-pastille">
            <span aria-hidden className="cx-pastille__point" />
            {tm('gauche.pastille', { n: ORGANISATIONS_PRESENTEES })}
          </p>
          <h2 className="cx-titre-gauche">
            {tm('gauche.titre1')}
            <br />
            {tm('gauche.titre2')}
          </h2>
          <p className="cx-texte-gauche">{tm('gauche.texte')}</p>
          <dl className="cx-chiffres">
            <div>
              <dd>{nombreModules}</dd>
              <dt>{tm('gauche.modules')}</dt>
            </div>
            <div>
              <dd>{tm('gauche.h24')}</dd>
              <dt>{tm('gauche.supervision')}</dt>
            </div>
            <div>
              <dd>{nombreFamilles}</dd>
              <dt>{tm('gauche.familles')}</dt>
            </div>
          </dl>
          <p className="cx-edition">
            {tm('gauche.edition')} · v{APP_VERSION}
          </p>
        </div>
      </aside>

      <section className="cx-droite">
        <div className="cx-colonne">
          {!enLigne && (
            <div className="cx-hors-ligne" role="status">
              <span aria-hidden className="cx-point cx-point--attention" />
              <span>{tm('horsLigne')}</span>
              <button type="button" onClick={relireReseau} className="cx-lien-bouton">
                {tm('reessayer')}
              </button>
            </div>
          )}

          {vue === 'connexion' && (
            <form onSubmit={surConnexion} noValidate aria-label={tm('form.titre')} className="cx-form">
              <h1 className="cx-titre">{tm('form.titre')}</h1>
              <p className="cx-consigne">{tm('form.consigne')}</p>

              <div className="cx-groupe">
                <label htmlFor="cx-email" className="cx-etiquette">
                  {tm('form.email')}
                </label>
                <div className="cx-champ" data-invalide={invalide || aide ? 'true' : undefined}>
                  <Mail aria-hidden size={16} />
                  <input
                    ref={champEmail}
                    id="cx-email"
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (aide) setAide(null);
                    }}
                    autoComplete="email"
                    autoFocus={!email}
                    disabled={envoi || parti}
                    aria-invalid={invalide || aide ? true : undefined}
                    aria-describedby={aide ? idAideEmail : undefined}
                    required
                  />
                </div>
                {aide && (
                  <p id={idAideEmail} className="cx-aide" role="alert">
                    {tm(aide)}
                  </p>
                )}
              </div>

              <div className="cx-groupe cx-groupe--mdp">
                <label htmlFor="cx-mdp" className="cx-etiquette">
                  {tm('form.mdp')}
                </label>
                <div className="cx-champ" data-invalide={invalide ? 'true' : undefined}>
                  <Lock aria-hidden size={16} className="cx-champ__cadenas" />
                  <input
                    ref={champMdp}
                    id="cx-mdp"
                    type={montrer ? 'text' : 'password'}
                    name="password"
                    value={mdp}
                    onChange={(e) => setMdp(e.target.value)}
                    onKeyDown={surTouche}
                    onKeyUp={surTouche}
                    onBlur={() => setMajuscules(false)}
                    autoComplete="current-password"
                    disabled={envoi || parti}
                    aria-invalid={invalide ? true : undefined}
                    aria-describedby={[majuscules ? idMaj : null, message ? idErreur : null].filter(Boolean).join(' ') || undefined}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setMontrer((v) => !v)}
                    aria-pressed={montrer}
                    aria-label={tm(montrer ? 'form.masquer.nom' : 'form.afficher.nom')}
                    disabled={envoi || parti}
                    className="cx-afficher cx-focus"
                  >
                    {tm(montrer ? 'form.masquer' : 'form.afficher')}
                  </button>
                </div>
                {majuscules && (
                  <p id={idMaj} className="cx-aide">
                    {tm('verrMaj')}
                  </p>
                )}
                {/* « Oublié ? » est APRÈS le champ dans l'ordre du document (tabulation : e-mail, mot de passe, Afficher, Oublié ?) et posé à droite de l'étiquette par la feuille. */}
                <button
                  type="button"
                  onClick={() => {
                    setErreur(null);
                    setOublie('saisie');
                    setVue('oublie');
                  }}
                  aria-label={tm('form.oublie.nom')}
                  disabled={envoi || parti}
                  className="cx-oublie cx-focus"
                >
                  {tm('form.oublie')}
                </button>
              </div>

              {message && (
                <p id={idErreur} role={redirection ? 'status' : 'alert'} className="cx-erreur" data-redirection={redirection || undefined}>
                  <span aria-hidden className={`cx-point ${redirection ? 'cx-point--attention' : 'cx-point--critique'}`} />
                  {message}
                </p>
              )}

              <button type="submit" disabled={envoi || parti} className="cx-valider cx-focus">
                <span>{tm('form.valider')}</span>
                {envoi ? <Loader2 aria-hidden size={14} className="cx-tourne" /> : <ArrowRight aria-hidden size={14} />}
              </button>
              <span role="status" className="sr-only">
                {envoi ? tm('form.enCours') : ''}
              </span>

              <p className="cx-note">
                <ShieldCheck aria-hidden size={12} />
                <span>{tm('form.note')}</span>
              </p>
            </form>
          )}

          {vue === 'mfa' && defi && (
            <form onSubmit={surCode} noValidate aria-label={t('connexion.mfa.titre')} className="cx-form">
              <h1 className="cx-titre">{t('connexion.mfa.titre')}</h1>
              <p className="cx-consigne">{t(secours ? 'connexion.mfa.consigneSecours' : 'connexion.mfa.consigne')}</p>
              <p className="cx-aide cx-aide--courriel">{defi.email}</p>
              <div className="cx-groupe">
                <label htmlFor="cx-code" className="cx-etiquette">
                  {t(secours ? 'connexion.mfa.codeSecours' : 'connexion.mfa.code')}
                </label>
                <div className="cx-champ" data-invalide={invalide ? 'true' : undefined}>
                  <ShieldCheck aria-hidden size={16} />
                  <input
                    id="cx-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoComplete="one-time-code"
                    inputMode={secours ? 'text' : 'numeric'}
                    maxLength={secours ? 9 : 7}
                    placeholder={secours ? 'XXXX-XXXX' : '000000'}
                    autoFocus
                    disabled={envoi || parti}
                    aria-invalid={invalide ? true : undefined}
                    aria-describedby={message ? idErreur : undefined}
                  />
                </div>
              </div>
              {message && (
                <p id={idErreur} role="alert" className="cx-erreur">
                  <span aria-hidden className="cx-point cx-point--critique" />
                  {message}
                </p>
              )}
              <button type="submit" disabled={envoi || parti || code.trim().length < 6} className="cx-valider cx-focus">
                <span>{t('connexion.mfa.valider')}</span>
                {envoi && <Loader2 aria-hidden size={14} className="cx-tourne" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSecours((v) => !v);
                  setCode('');
                  setErreur(null);
                }}
                className="cx-lien-bouton cx-lien-bouton--centre cx-focus"
              >
                {t(secours ? 'connexion.mfa.utiliserApp' : 'connexion.mfa.utiliserSecours')}
              </button>
            </form>
          )}

          {vue === 'oublie' && (
            <form onSubmit={surOublie} noValidate aria-label={t('connexion.oublie.titre')} className="cx-form">
              <h1 className="cx-titre">{t('connexion.oublie.titre')}</h1>
              {oublie === 'fait' ? (
                <p className="cx-consigne cx-consigne--fait" data-oublie={oublieChemin} role="status">
                  {t(oublieChemin === 'envoye' ? 'connexion.oublie.faitCourriel' : 'connexion.oublie.fait')}
                </p>
              ) : (
                <>
                  <p className="cx-consigne">{t('connexion.oublie.consigne')}</p>
                  <div className="cx-groupe">
                    <label htmlFor="cx-email-oublie" className="cx-etiquette">
                      {tm('form.email')}
                    </label>
                    <div className="cx-champ">
                      <Mail aria-hidden size={16} />
                      <input
                        id="cx-email-oublie"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="username"
                        autoFocus
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={oublie === 'envoi' || !EMAIL_COMPLET.test(email.trim())} className="cx-valider cx-focus">
                    <span>{t('connexion.oublie.envoyer')}</span>
                    {oublie === 'envoi' && <Loader2 aria-hidden size={14} className="cx-tourne" />}
                  </button>
                </>
              )}
              <button type="button" onClick={() => setVue('connexion')} className="cx-lien-bouton cx-lien-bouton--centre cx-focus">
                {t('connexion.oublie.annuler')}
              </button>
            </form>
          )}

          {vue === 'connexion' && (
            <div className="cx-pied">
              <p>
                <span>{tm('form.pasDeCompte')}</span>{' '}
                <button type="button" onClick={() => setAcces((v) => !v)} aria-expanded={acces} className="cx-lien-bouton cx-focus">
                  {tm('form.demander')}
                </button>
              </p>
              {acces && <p className="cx-aide cx-aide--acces">{tm('form.demander.texte')}</p>}
            </div>
          )}
        </div>
      </section>
    </motion.main>
  );
}
