import React, { useEffect, useId, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { bridge } from '../../../lib/bridge';
import { cleanErrorMessage, isRedirection } from '../../../lib/errorMessage';
import { useLangue } from '../../../i18n';
import { EDITION_PRODUCT_NAME } from '../../../edition/edition';
import { destinationApresConnexion } from '../premiereConnexion';
import { VueConnexion } from './VueConnexion';

/**
 * LA CONNEXION (G06) — l'interface seulement. L'authentification ne change pas.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Même logique que `src/screens/LoginScreen.tsx` (qui reste intact : l'édition cliente le monte encore) :
 * `login` puis, si le serveur exige un second facteur, `completeMfa` ; le mot de passe oublié
 * PRÉVIENT le prestataire (`forgotPassword`, réponse identique que l'adresse existe ou non) ; un refus
 * d'édition (`isRedirection`) se lit en gris. Seuls la présentation et la mise en page changent.
 *
 * v3 : une carte centrée sur un fond qui veille (`VueConnexion`, `CadreConnexion`) ; ce composant ne garde que l'état
 * et les gestes d'origine, recopiés tels quels, et passe tout à la vue. Avant la connexion, rien n'est lu dans
 * l'espace : ni chiffre, ni nom (l'ancienne colonne de présentation et ses indicateurs ont disparu avec la v3).
 *
 * Le contrat que les contrôles de bout en bout attendent est conservé : `input[name="email"]`,
 * `input[name="password"]`, UN SEUL `button[type="submit"]` visible à la fois (les vues connexion, double
 * vérification et mot de passe oublié sont exclusives), et `name="password"` n'existe nulle part ailleurs.
 */

type Vue = 'connexion' | 'mfa' | 'oublie';
type Phase = 'repos' | 'envoi' | 'succes';

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

  const reussir = (adresse: string) => {
    setPhase('succes');
    // Accueil réglé ; à la toute première connexion, Démarrage (H42).
    const destination = destinationApresConnexion(adresse);
    minuteur.current = window.setTimeout(() => navigate(destination, { replace: true }), 480);
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
      reussir(email);
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
      reussir(defi.email);
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
    <VueConnexion
      produit={produit}
      enLigne={enLigne}
      onRelireReseau={relireReseau}
      vue={vue}
      envoi={envoi}
      parti={parti}
      message={message}
      redirection={redirection}
      invalide={invalide}
      ids={{ erreur: idErreur, aideEmail: idAideEmail, maj: idMaj }}
      connexion={{
        email,
        onEmail: (v) => {
          setEmail(v);
          if (aide) setAide(null);
        },
        mdp,
        onMdp: setMdp,
        montrer,
        onMontrer: () => setMontrer((v) => !v),
        majuscules,
        onToucheMdp: surTouche,
        onQuitterMdp: () => setMajuscules(false),
        aide,
        onSoumettre: surConnexion,
        onOublie: () => {
          setErreur(null);
          setOublie('saisie');
          setVue('oublie');
        },
        champEmail,
        champMdp,
        focusInitial: !email,
      }}
      mfa={
        vue === 'mfa' && defi
          ? {
              email: defi.email,
              secours,
              code,
              onCode: setCode,
              onSoumettre: surCode,
              onBasculer: () => {
                setSecours((v) => !v);
                setCode('');
                setErreur(null);
              },
            }
          : null
      }
      oublie={{ etat: oublie, chemin: oublieChemin, adresseValide: EMAIL_COMPLET.test(email.trim()), onSoumettre: surOublie, onRetour: () => setVue('connexion') }}
      acces={acces}
      onAcces={() => setAcces((v) => !v)}
    />
  );
}
