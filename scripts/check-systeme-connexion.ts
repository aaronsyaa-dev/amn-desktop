/**
 * Contrôle de la CONNEXION (G06, v3) — la vue, ses cotes et le contrat d'authentification, sans navigateur.
 *
 *   npm run check:systeme-connexion
 *
 * L'interface seulement : on vérifie que la logique d'origine est toujours appelée telle quelle (`login`,
 * `completeMfa`, `forgotPassword`), que les champs attendus par les contrôles de bout en bout sont là, et que la
 * carte ne montre que les méthodes qui existent.
 */
import path from 'node:path';
import * as esbuild from 'esbuild';
import { assert, creerEssais, lire, racine, sansCommentaires } from './lib/essai-socle.ts';

const { dit, fin } = creerEssais('Connexion (G06, v3)');

async function chargerVue<T>(code: string): Promise<T> {
  const construit = await esbuild.build({
    stdin: { contents: code, resolveDir: path.join(racine, 'scripts'), loader: 'tsx' },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    charset: 'utf8',
    jsx: 'automatic',
    tsconfig: path.join(racine, 'tsconfig.json'),
    loader: { '.css': 'empty' },
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', __AMN_EDITION__: '"internal"', __AMN_VERSION__: '"0.0.0"' },
    logLevel: 'silent',
  });
  return (await import(`data:text/javascript;charset=utf-8;base64,${Buffer.from(construit.outputFiles[0].text, 'utf8').toString('base64')}`)) as T;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const M = await chargerVue<any>(`
  import { createElement as h } from 'react';
  import { renderToStaticMarkup } from 'react-dom/server.browser';
  import { MemoryRouter } from 'react-router-dom';
  export { VueConnexion } from '../src/refonte/systeme/connexion/VueConnexion';
  export * as cadre from '../src/refonte/systeme/connexion/CadreConnexion';
  export { h };
  export const rendre = (el) => renderToStaticMarkup(h(MemoryRouter, null, el));
`);
const rien = () => undefined;
const base = (sur: Record<string, unknown> = {}) => ({
  produit: 'Produit',
  enLigne: true,
  onRelireReseau: rien,
  vue: 'connexion',
  envoi: false,
  parti: false,
  message: null,
  redirection: false,
  invalide: false,
  ids: { erreur: 'e', aideEmail: 'a', maj: 'm' },
  connexion: { email: '', onEmail: rien, mdp: '', onMdp: rien, montrer: false, onMontrer: rien, majuscules: false, onToucheMdp: rien, onQuitterMdp: rien, aide: null, onSoumettre: rien, onOublie: rien, focusInitial: true },
  mfa: null,
  oublie: { etat: 'saisie', chemin: 'manuel', adresseValide: false, onSoumettre: rien, onRetour: rien },
  acces: false,
  onAcces: rien,
  maintenant: new Date(2026, 9, 30, 8, 57),
  ...sur,
});
const vue = (sur: Record<string, unknown> = {}): string => M.rendre(M.h(M.VueConnexion, base(sur)));
const compter = (html: string, re: RegExp): number => (html.match(re) ?? []).length;

await dit('le fond : 4 orbites (236 / 340 / 460 / 600), 8 repères anonymes sur celle de 460, un seul en veille à -18°', () => {
  assert.deepEqual([...M.cadre.RAYONS_ORBITES], [236, 340, 460, 600]);
  assert.equal(M.cadre.ANGLES_REPERES.length, 8);
  const p = M.cadre.placeRepere(-18);
  assert.ok(Math.abs(p.x - 437.5) < 0.2 && Math.abs(p.y + 142.1) < 0.2, `(${p.x}, ${p.y})`);
  const html = vue();
  assert.match(html, /<div aria-hidden="true" class="cx-fond">/);
  assert.equal(compter(html, /<circle [^>]*class="cx-orbite"/g), 4);
  assert.equal(compter(html, /class="cx-repere"/g), 8);
  assert.equal(compter(html, /data-veille="true"/g), 1);
  assert.equal(compter(html, /data-mvt="balayage"/g), 1);
});

await dit('la date du poste : « Vendredi 30 octobre » et « 08:57 », depuis l’horloge locale', () => {
  assert.deepEqual(M.cadre.datePoste(new Date(2026, 9, 30, 8, 57), 'fr'), { jour: 'Vendredi 30 octobre', heure: '08:57' });
  assert.match(vue(), /<time class="cx-poste__heure">08:57<\/time>/);
});

await dit('la carte : marque, titre « Connexion » (aucun compte mémorisé sur le poste), la phrase, une seule h1', () => {
  const html = vue();
  assert.equal(compter(html, /<h1[ >]/g), 1);
  assert.match(html, /<h1 id="cx-titre" class="cx-titre">Connexion<\/h1>/);
  assert.match(html, />Tout votre travail, sous une seule main\.</);
  assert.match(html, /aria-labelledby="cx-titre"/);
});

await dit('les méthodes montrées sont celles qui existent : adresse et mot de passe ; ni clé d’accès, ni lien par e-mail, ni compte inventé', () => {
  const html = vue();
  assert.equal(compter(html, /name="email"/g), 1);
  assert.equal(compter(html, /name="password"/g), 1);
  assert.match(html, /<input id="cx-email"[^>]*autocomplete="username"[^>]*name="email"/i);
  assert.match(html, /<input id="cx-mdp"[^>]*autocomplete="current-password"[^>]*name="password"/i);
  assert.doesNotMatch(html, /clé d’accès|clé d'accès|Lien par e-mail|Bon retour|Compte enregistré|webauthn/i);
  assert.equal(compter(html, /type="submit"/g), 1, 'un seul bouton d’envoi visible');
  assert.equal(compter(html, /class="cx-valider/g), 1, 'un seul bouton primaire');
  assert.match(html, />Se connecter</);
  assert.match(html, />Oublié \?</);
  assert.match(html, />Afficher</);
});

await dit('le pied : l’édition SANS numéro de version, la pastille qui ne dit que le vrai, le lien d’aide ; plus d’indicateurs', () => {
  const html = vue();
  assert.match(html, />AMN DevSec · édition interne de l’équipe</);
  assert.doesNotMatch(html, /v\d+\.\d+|0\.0\.0/, 'pas de numéro de version (écart T1 G06.4)');
  assert.match(html, /class="cx-etat" data-ton="ok"[^>]*>[\s\S]*?La Garde veille[\s\S]*?connexion chiffrée/);
  assert.doesNotMatch(html, /tous les services sont en ligne/, 'aucun point d’état public : pas de statut inventé');
  assert.doesNotMatch(html, /<dl|cx-chiffres|H24|>101</, 'les indicateurs de l’ancienne colonne ont disparu');
  assert.match(html, /aria-expanded="false" class="cx-lien-aide cx-focus"[\s\S]*?Un souci pour entrer \? Écrire à l’équipe/);
  assert.match(html, /Pas encore de compte \?[\s\S]*?Demandez un accès à l’équipe/);
});

await dit('états : hors ligne (pastille orange et encart « Réessayer »), erreur annoncée, double vérification et oubli exclusifs', () => {
  const hl = vue({ enLigne: false });
  assert.match(hl, /class="cx-etat" data-ton="attention"[\s\S]*?Hors connexion[\s\S]*?reconnectez-vous au réseau/);
  assert.match(hl, /Vous êtes hors connexion\. Reconnectez-vous au réseau pour ouvrir votre espace\.[\s\S]*?>Réessayer</);
  const err = vue({ message: 'Identifiants refusés', invalide: true });
  assert.match(err, /role="alert" class="cx-erreur"/);
  assert.match(err, /aria-invalid="true"/);
  const mfa = vue({ vue: 'mfa', mfa: { email: 'x@exemple.test', secours: false, code: '', onCode: rien, onSoumettre: rien, onBasculer: rien } });
  assert.equal(compter(mfa, /type="submit"/g), 1);
  assert.doesNotMatch(mfa, /name="password"/);
  assert.match(mfa, /autocomplete="one-time-code"/i);
  const oubli = vue({ vue: 'oublie' });
  assert.equal(compter(oubli, /type="submit"/g), 1);
  assert.doesNotMatch(oubli, /name="password"|name="email"/);
});

await dit('cotes lues dans connexion.css : carte 404 (34 / 32 / 24, rayon 20), champs 52, bouton 48, pastille 36, marque 30 et 56', () => {
  const css = sansCommentaires(lire('src/refonte/systeme/connexion/connexion.css'));
  assert.match(css, /\.cx-carte \{[^}]*width: min\(404px, 100%\);[^}]*padding: 34px 32px 24px;[^}]*border-radius: 20px;[^}]*backdrop-filter: blur\(6px\)/);
  assert.match(css, /\.cx-centre \{[^}]*padding: 135px 16px 120px/);
  assert.match(css, /\.cx-champ \{[^}]*height: 52px;[^}]*border-radius: 12px/);
  assert.match(css, /\.cx-valider \{[^}]*height: 48px;[^}]*border-radius: 12px;[^}]*font-size: 14\.5px;[^}]*font-weight: 600/);
  assert.match(css, /\.cx-etat \{[^}]*height: 36px;[^}]*border-radius: 99px;[^}]*background: var\(--socle-connexion-pastille\)/);
  assert.match(css, /\.cx-marque__logo \{[^}]*width: 30px;[^}]*height: 30px;[^}]*border-radius: 8px/);
  assert.match(css, /\.cx-carte__logo \{[^}]*width: 56px;[^}]*height: 56px;[^}]*border-radius: 15px/);
  assert.match(css, /\.cx-titre \{ margin: 20px 0 0; font-size: 26px; font-weight: 600; letter-spacing: -0\.02em; line-height: 32px;/);
  assert.match(css, /\.cx-bas \{[^}]*bottom: 34px/);
});

await dit('focus : anneau 2 px décalé de 2 sur ce qui se clique ; le champ au focus change de bord, sans anneau épais (G06.6)', () => {
  const css = sansCommentaires(lire('src/refonte/systeme/connexion/connexion.css'));
  assert.match(css, /\.cx-focus:focus-visible \{ outline: 2px solid var\(--color-socle-focus\); outline-offset: 2px; \}/);
  assert.match(css, /\.cx-champ:focus-within \{ border-color: var\(--socle-bord-champ\); \}/);
  const champs = [...css.matchAll(/\.cx-(?:champ|focus|valider|afficher|oublie)[^{]*\{[^}]*\}/g)].map((m) => m[0]).join('\n');
  assert.doesNotMatch(champs, /box-shadow:(?![^;]*inset)/, 'plus d’anneau épais autour des champs ni des boutons (le fond « inset » des champs préremplis n’en est pas un)');
});

await dit('lueur de la fiche (760 × 520 à 50 % 46 %, .035), vignette, mouvement coupé en réduit ; aucune couleur hex, chiffres tabulaires sur l’heure seulement', () => {
  const css = sansCommentaires(lire('src/refonte/systeme/connexion/connexion.css'));
  const noir = lire('src/socle/noir.css');
  assert.match(noir, /--socle-connexion-halo: radial-gradient\(760px 520px at 50% 46%, rgba\(255, 255, 255, 0\.035\), transparent 72%\);/);
  assert.match(css, /background: var\(--socle-connexion-halo\), var\(--socle-fond-page\);/);
  assert.match(css, /--sc-mvt-balayage: 40s;/);
  assert.match(css, /prefers-reduced-motion: reduce\)[^{]*\{[^}]*\}[^}]*\.cx-balayage \{ display: none; \}/);
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
  const racineCx = /:root\[data-ambiance='noir'\] \.cx \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.doesNotMatch(racineCx, /tabular-nums/, 'C11 : pas sur la racine de l’écran');
  assert.match(css, /\.cx-poste__heure \{[^}]*font-family: var\(--socle-police-mono\);[^}]*tabular-nums/);
});

await dit('la logique d’origine est inchangée et toujours appelée : login, completeMfa, forgotPassword, destination après connexion', () => {
  const src = sansCommentaires(lire('src/refonte/systeme/connexion/ConnexionRefonte.tsx'));
  assert.match(src, /const sortie = await login\(email, mdp\);/);
  assert.match(src, /await completeMfa\(\{ challenge: defi\.challenge, \.\.\.\(secours \? \{ backupCode: code\.trim\(\) \} : \{ code: code\.trim\(\) \}\) \}\);/);
  assert.match(src, /await bridge\(\)\.remote\.forgotPassword\(email\.trim\(\)\);/);
  assert.match(src, /destinationApresConnexion\(adresse\)/);
  assert.match(src, /<VueConnexion/);
  assert.doesNotMatch(src, /APP_VERSION|REGISTRE_MODULES|localStorage/);
  assert.match(lire('src/edition/appRoot.internal.tsx'), /<Route path="\/login" element=\{<ConnexionRefonte \/>\} \/>/);
});

await dit('aucun nom, aucune adresse réelle ni donnée d’exemple dans le dossier', () => {
  for (const f of ['ConnexionRefonte.tsx', 'VueConnexion.tsx', 'CadreConnexion.tsx', 'i18n.ts', 'connexion.css']) {
    assert.doesNotMatch(lire(`src/refonte/systeme/connexion/${f}`), /Aaron|amndevsec\.fr|Menna|@[a-z]+\.(fr|com)/i, f);
  }
});

fin();
