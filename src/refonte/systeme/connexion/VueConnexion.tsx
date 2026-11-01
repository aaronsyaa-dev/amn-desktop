import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { useLangue } from '../../../i18n';
import { CadreConnexion } from './CadreConnexion';
import { useMots } from './i18n';
import './connexion.css';

/**
 * LA CONNEXION (G06, v3) — LA VUE : la carte centrée et ses trois formulaires, sans aucune logique.
 * ═════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Tout arrive par les props depuis `ConnexionRefonte`, qui garde la logique d'origine telle quelle (`login`, puis
 * `completeMfa` si le serveur exige un second facteur ; `forgotPassword` pour l'oubli). Seules la présentation et
 * la mise en page changent.
 *
 * Les méthodes montrées sont celles qui EXISTENT : adresse e-mail et mot de passe (et la double vérification, le
 * mot de passe oublié). La clé d'accès, le lien par e-mail et le « compte enregistré sur ce poste » de l'image
 * n'existent pas dans le dépôt : ils ne sont pas dessinés (fiche G06 §8, « Sans compte mémorisé » et « Sans clé
 * d'accès »). Le titre est donc « Connexion », le champ d'adresse prend la place du compte mémorisé.
 *
 * Le contrat des contrôles de bout en bout est conservé : `input[name="email"]`, `input[name="password"]`, UN SEUL
 * `button[type="submit"]` visible à la fois (les vues sont exclusives), et `name="password"` n'existe nulle part ailleurs.
 */
export type CleAideEmail = 'erreur.email.vide' | 'erreur.email.incomplet';

export interface VueConnexionProps {
  produit: string;
  enLigne: boolean;
  onRelireReseau: () => void;
  vue: 'connexion' | 'mfa' | 'oublie';
  envoi: boolean;
  parti: boolean;
  /** Le message d'erreur déjà nettoyé, et sa nature (un refus d'édition se lit en gris). */
  message: string | null;
  redirection: boolean;
  invalide: boolean;
  ids: { erreur: string; aideEmail: string; maj: string };
  connexion: {
    email: string;
    onEmail: (v: string) => void;
    mdp: string;
    onMdp: (v: string) => void;
    montrer: boolean;
    onMontrer: () => void;
    majuscules: boolean;
    onToucheMdp: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onQuitterMdp: () => void;
    aide: CleAideEmail | null;
    onSoumettre: (e: React.FormEvent<HTMLFormElement>) => void;
    onOublie: () => void;
    champEmail?: React.Ref<HTMLInputElement>;
    champMdp?: React.Ref<HTMLInputElement>;
    /** Le champ d'adresse prend le focus à l'ouverture quand il est vide (fiche G06 §7). */
    focusInitial: boolean;
  };
  mfa: {
    email: string;
    secours: boolean;
    code: string;
    onCode: (v: string) => void;
    onSoumettre: (e: React.FormEvent<HTMLFormElement>) => void;
    onBasculer: () => void;
  } | null;
  oublie: {
    etat: 'saisie' | 'envoi' | 'fait';
    chemin: 'envoye' | 'manuel';
    adresseValide: boolean;
    onSoumettre: (e: React.FormEvent<HTMLFormElement>) => void;
    onRetour: () => void;
  };
  acces: boolean;
  onAcces: () => void;
  /** Pour l'aperçu : une heure fixe. */
  maintenant?: Date;
}

export function VueConnexion(p: VueConnexionProps) {
  const { t, langue } = useLangue();
  const { tm } = useMots();
  const { envoi, parti, message, redirection, invalide, ids, connexion: c } = p;
  const bloque = envoi || parti;

  const erreur = message ? (
    <p id={ids.erreur} role={redirection ? 'status' : 'alert'} className="cx-erreur" data-redirection={redirection || undefined}>
      <span aria-hidden className={`cx-point ${redirection ? 'cx-point--attention' : 'cx-point--critique'}`} />
      {message}
    </p>
  ) : null;

  const horsLigne = !p.enLigne ? (
    <div className="cx-hors-ligne" role="status">
      <span aria-hidden className="cx-point cx-point--attention" />
      <span>{tm('horsLigne')}</span>
      <button type="button" onClick={p.onRelireReseau} className="cx-lien-bouton cx-focus">
        {tm('reessayer')}
      </button>
    </div>
  ) : null;

  const note = (
    <p className="cx-note">
      <ShieldCheck aria-hidden size={14} />
      <span>{tm('form.note')}</span>
    </p>
  );

  let titre = tm('form.titre');
  let phrase: string | undefined = tm('carte.phrase');
  let contenu: React.ReactNode = null;

  if (p.vue === 'connexion') {
    contenu = (
      <form onSubmit={c.onSoumettre} noValidate aria-label={tm('form.titre')} className="cx-form">
        <div className="cx-groupe">
          <label htmlFor="cx-email" className="cx-etiquette">
            {tm('form.email')}
          </label>
          <div className="cx-champ" data-invalide={invalide || c.aide ? 'true' : undefined}>
            <Mail aria-hidden size={16} />
            <input
              ref={c.champEmail}
              id="cx-email"
              type="email"
              name="email"
              value={c.email}
              onChange={(e) => c.onEmail(e.target.value)}
              autoComplete="username"
              autoFocus={c.focusInitial}
              disabled={bloque}
              aria-invalid={invalide || c.aide ? true : undefined}
              aria-describedby={c.aide ? ids.aideEmail : undefined}
              required
            />
          </div>
          {c.aide && (
            <p id={ids.aideEmail} className="cx-aide" role="alert">
              {tm(c.aide)}
            </p>
          )}
        </div>

        <div className="cx-groupe cx-groupe--mdp">
          <label htmlFor="cx-mdp" className="cx-etiquette">
            {tm('form.mdp')}
          </label>
          <div className="cx-champ" data-invalide={invalide ? 'true' : undefined}>
            <input
              ref={c.champMdp}
              id="cx-mdp"
              type={c.montrer ? 'text' : 'password'}
              name="password"
              value={c.mdp}
              onChange={(e) => c.onMdp(e.target.value)}
              onKeyDown={c.onToucheMdp}
              onKeyUp={c.onToucheMdp}
              onBlur={c.onQuitterMdp}
              autoComplete="current-password"
              disabled={bloque}
              aria-invalid={invalide ? true : undefined}
              aria-describedby={[c.majuscules ? ids.maj : null, message ? ids.erreur : null].filter(Boolean).join(' ') || undefined}
              required
            />
            <button
              type="button"
              onClick={c.onMontrer}
              aria-pressed={c.montrer}
              aria-label={tm(c.montrer ? 'form.masquer.nom' : 'form.afficher.nom')}
              disabled={bloque}
              className="cx-afficher cx-focus"
            >
              {tm(c.montrer ? 'form.masquer' : 'form.afficher')}
            </button>
          </div>
          {c.majuscules && (
            <p id={ids.maj} className="cx-aide">
              {tm('verrMaj')}
            </p>
          )}
          {/* « Oublié ? » est APRÈS le champ dans l'ordre du document (tabulation : e-mail, mot de passe, Afficher, Oublié ?) et posé à droite de l'étiquette par la feuille. */}
          <button type="button" onClick={c.onOublie} aria-label={tm('form.oublie.nom')} disabled={bloque} className="cx-oublie cx-focus">
            {tm('form.oublie')}
          </button>
        </div>

        {erreur}

        <button type="submit" disabled={bloque} className="cx-valider cx-focus">
          {envoi ? <Loader2 aria-hidden size={16} className="cx-tourne" /> : <LogIn aria-hidden size={16} />}
          <span>{tm('form.valider')}</span>
        </button>
        <span role="status" className="sr-only">
          {envoi ? tm('form.enCours') : ''}
        </span>
        {horsLigne}
        {note}
      </form>
    );
  } else if (p.vue === 'mfa' && p.mfa) {
    const m = p.mfa;
    titre = t('connexion.mfa.titre');
    phrase = t(m.secours ? 'connexion.mfa.consigneSecours' : 'connexion.mfa.consigne');
    contenu = (
      <form onSubmit={m.onSoumettre} noValidate aria-label={t('connexion.mfa.titre')} className="cx-form">
        <p className="cx-aide cx-aide--courriel">{m.email}</p>
        <div className="cx-groupe">
          <label htmlFor="cx-code" className="cx-etiquette">
            {t(m.secours ? 'connexion.mfa.codeSecours' : 'connexion.mfa.code')}
          </label>
          <div className="cx-champ" data-invalide={invalide ? 'true' : undefined}>
            <ShieldCheck aria-hidden size={16} />
            <input
              id="cx-code"
              value={m.code}
              onChange={(e) => m.onCode(e.target.value)}
              autoComplete="one-time-code"
              inputMode={m.secours ? 'text' : 'numeric'}
              maxLength={m.secours ? 9 : 7}
              placeholder={m.secours ? 'XXXX-XXXX' : '000000'}
              autoFocus
              disabled={bloque}
              aria-invalid={invalide ? true : undefined}
              aria-describedby={message ? ids.erreur : undefined}
            />
          </div>
        </div>
        {erreur}
        <button type="submit" disabled={bloque || m.code.trim().length < 6} className="cx-valider cx-focus">
          {envoi && <Loader2 aria-hidden size={16} className="cx-tourne" />}
          <span>{t('connexion.mfa.valider')}</span>
        </button>
        <button type="button" onClick={m.onBasculer} className="cx-lien-bouton cx-lien-bouton--centre cx-focus">
          {t(m.secours ? 'connexion.mfa.utiliserApp' : 'connexion.mfa.utiliserSecours')}
        </button>
        {horsLigne}
        {note}
      </form>
    );
  } else if (p.vue === 'oublie') {
    const o = p.oublie;
    titre = t('connexion.oublie.titre');
    phrase = o.etat === 'fait' ? undefined : t('connexion.oublie.consigne');
    contenu = (
      <form onSubmit={o.onSoumettre} noValidate aria-label={t('connexion.oublie.titre')} className="cx-form">
        {o.etat === 'fait' ? (
          <p className="cx-consigne cx-consigne--fait" data-oublie={o.chemin} role="status">
            {t(o.chemin === 'envoye' ? 'connexion.oublie.faitCourriel' : 'connexion.oublie.fait')}
          </p>
        ) : (
          <>
            <div className="cx-groupe">
              <label htmlFor="cx-email-oublie" className="cx-etiquette">
                {tm('form.email')}
              </label>
              <div className="cx-champ">
                <Mail aria-hidden size={16} />
                <input id="cx-email-oublie" type="email" value={c.email} onChange={(e) => c.onEmail(e.target.value)} autoComplete="username" autoFocus />
              </div>
            </div>
            <button type="submit" disabled={o.etat === 'envoi' || !o.adresseValide} className="cx-valider cx-focus">
              {o.etat === 'envoi' && <Loader2 aria-hidden size={16} className="cx-tourne" />}
              <span>{t('connexion.oublie.envoyer')}</span>
            </button>
          </>
        )}
        <button type="button" onClick={o.onRetour} className="cx-lien-bouton cx-lien-bouton--centre cx-focus">
          {t('connexion.oublie.annuler')}
        </button>
        {note}
      </form>
    );
  }

  const sousCarte =
    p.vue === 'connexion' ? (
      <div className="cx-sous-carte">
        <p>
          <span>{tm('form.pasDeCompte')}</span>{' '}
          <button type="button" onClick={p.onAcces} aria-expanded={p.acces} className="cx-lien-bouton cx-focus">
            {tm('form.demander')}
          </button>
        </p>
        {p.acces && <p className="cx-aide cx-aide--acces">{tm('form.demander.texte')}</p>}
      </div>
    ) : null;

  return (
    <motion.main
      data-connexion
      data-refonte-police="inter"
      className="cx"
      initial={{ opacity: 0 }}
      animate={{ opacity: parti ? 0 : 1 }}
      transition={{ duration: parti ? 0.4 : 0.18 }}
    >
      <CadreConnexion produit={p.produit} titre={titre} phrase={phrase} enLigne={p.enLigne} langue={langue} sousCarte={sousCarte} maintenant={p.maintenant}>
        {contenu}
      </CadreConnexion>
    </motion.main>
  );
}
