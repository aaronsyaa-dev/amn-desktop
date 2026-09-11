/**
 * Contrôle des encres recopiées.
 *
 * `src/index.css` porte les jetons de couleur de toute l'application, et son
 * en-tête documente pourquoi la sourdine y vaut #9a9a97 et non le #6b6b68 du
 * paquet de design : sous 4,5:1, ce gris n'est pas discret, il est illisible.
 *
 * Un écran qui RECOPIE la valeur d'un jeton dans une constante locale sort de
 * cette décision sans le dire. C'est arrivé : l'Accueil gardait sa propre
 * palette, dont les trois encres de texte étaient des copies. Deux étaient
 * exactes, la troisième était le #6b6b68 refusé — et l'écran rendait ses
 * surtitres à 3,35:1 pendant que le reste de l'application tenait 5,36 au
 * pire. Rien ne pouvait le signaler : une constante ne suit aucun jeton.
 *
 * `check:contraste` l'attrape aussi, mais seulement au bout d'un build, d'un
 * navigateur et d'une connexion — et seulement sur les écrans qu'il visite.
 * Ce contrôle-ci lit les fichiers, donc il répond avant qu'on ait construit.
 *
 * Il ne cherche PAS toute couleur en dur : un écran a le droit d'avoir sa
 * direction propre (l'Accueil garde son encre #050505 et son rouge, qui
 * n'existent nulle part ailleurs). Il cherche les valeurs qui SONT DÉJÀ des
 * jetons — celles-là ont une source, et la copie ne peut que s'en écarter.
 *
 *   npm run check:encres
 */
import fs from 'node:fs';
import path from 'node:path';

const RACINE = path.resolve(new URL('..', import.meta.url).pathname);
const CSS = path.join(RACINE, 'src/index.css');

/* Les valeurs du paquet de design que le dépôt a explicitement REFUSÉES, avec
   la raison — un contrôle qui dit « interdit » sans dire pourquoi se contourne
   au premier commit pressé. */
const REFUSEES = new Map([
  ['#6b6b68', 'sourdine du paquet de design — 3,79:1 sur le fond, sous le seuil WCAG AA ; voir l’en-tête de src/index.css'],
]);

/* On lit les jetons dans la feuille plutôt que de les redéclarer : une liste
   recopiée ici serait exactement la faute que ce fichier traque. */
const feuille = fs.readFileSync(CSS, 'utf8');
const jetons = new Map();
for (const [, nom, valeur] of feuille.matchAll(/^\s*(--color-[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/gm)) {
  jetons.set(valeur.toLowerCase(), nom);
}

const fichiers = [];
(function parcourir(dossier) {
  for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
    const complet = path.join(dossier, entree.name);
    if (entree.isDirectory()) parcourir(complet);
    else if (/\.(tsx?|jsx?)$/.test(entree.name)) fichiers.push(complet);
  }
})(path.join(RACINE, 'src'));

const fautes = [];
for (const fichier of fichiers) {
  const lignes = fs.readFileSync(fichier, 'utf8').split('\n');
  /*
    Un commentaire a le droit de CITER une valeur — c'est même ainsi qu'on
    documente un écart, et l'en-tête de l'Accueil cite justement le gris qu'il
    a cessé d'employer. Seul le CODE en est empêché.

    D'où le suivi de l'état « dans un bloc » plutôt qu'un test sur le début de
    ligne : un commentaire de plusieurs lignes n'a d'étoile qu'au bord, et la
    première version de ce contrôle signalait donc sa propre documentation.
  */
  let dansUnBloc = false;
  lignes.forEach((ligne, i) => {
    const nue = ligne.trim();
    const ouvre = ligne.lastIndexOf('/*');
    const ferme = ligne.lastIndexOf('*/');
    const etaitDansUnBloc = dansUnBloc;
    if (!dansUnBloc && ouvre !== -1 && ferme < ouvre) dansUnBloc = true;
    else if (dansUnBloc && ferme !== -1 && ferme > ouvre) dansUnBloc = false;
    if (etaitDansUnBloc || dansUnBloc) return;
    if (nue.startsWith('//') || nue.startsWith('/*') || nue.startsWith('*')) return;
    for (const [, brut] of ligne.matchAll(/(#[0-9a-fA-F]{6})\b/g)) {
      const valeur = brut.toLowerCase();
      const jeton = jetons.get(valeur);
      const refus = REFUSEES.get(valeur);
      if (!jeton && !refus) continue;
      fautes.push({
        fichier: path.relative(RACINE, fichier),
        ligne: i + 1,
        valeur: brut,
        refuse: Boolean(refus),
        raison: refus ?? `copie du jeton ${jeton} — écrivez var(${jeton}) ou l’utilitaire nommé`,
      });
    }
  });
}

/*
  DEUX GRAVITÉS, ET UNE SEULE FAIT ÉCHOUER.

  Une valeur REFUSÉE est un défaut : elle passe sous le seuil, quelqu'un ne
  lira pas le texte. Elle échoue partout, sans dispense possible.

  Une copie de jeton est une DETTE : la couleur est juste aujourd'hui, mais
  rien ne la fera bouger quand le jeton bougera. Le dépôt en compte 33, pour
  l'essentiel des valeurs arbitraires Tailwind (`border-[#161616]`) posées
  avant que les utilitaires nommés existent. Les convertir demande de rouvrir
  une quinzaine d'écrans et de les revoir un par un : c'est un chantier à
  part, pas un effet de bord.

  Elles sont donc ÉNUMÉRÉES plutôt qu'ignorées — même usage que `CONNUES` dans
  `check-contraste.mjs` et que les écrans dispensés de `check-ecrans.mjs`. La
  liste ne peut que raccourcir : une copie NOUVELLE n'y est pas, donc elle
  échoue. C'est ce qui distingue une dette d'un trou.
*/
const DETTE_CONNUE = new Set([
  'src/business/AgendaScreen.tsx:#161616',
  'src/business/BusinessSidebar.tsx:#121212',
  'src/client-context/ClientSidebar.tsx:#0d0d0d',
  'src/components/Logo.tsx:#2a2a2a',
  'src/components/Logo.tsx:#9a9a97',
  'src/components/Logo.tsx:#ffffff',
  'src/components/MobileBottomNav.tsx:#0d0d0d',
  'src/components/formulaire/Champ.tsx:#0b0b0b',
  'src/lib/accent.ts:#ededed',
  'src/lib/accent.ts:#ffffff',
  'src/lib/qr.ts:#ffffff',
  'src/screens/ChecklistsScreen.tsx:#161616',
  'src/screens/ChecklistsScreen.tsx:#1f1f1f',
  'src/screens/ClientsScreen.tsx:#161616',
  'src/screens/ClientsScreen.tsx:#3a3a3a',
  'src/screens/ContractsScreen.tsx:#161616',
  'src/screens/ContractsScreen.tsx:#1f1f1f',
  'src/screens/ContractsScreen.tsx:#3a3a3a',
  'src/screens/EquipmentBookingScreen.tsx:#161616',
  'src/screens/ExpensesScreen.tsx:#161616',
  'src/screens/MeetingsScreen.tsx:#161616',
  'src/screens/PrioritiesScreen.tsx:#0b0b0b',
  'src/screens/PrioritiesScreen.tsx:#161616',
  'src/screens/ProjectsScreen.tsx:#161616',
  'src/screens/QrScreen.tsx:#ffffff',
  'src/screens/RoutinesScreen.tsx:#161616',
  'src/screens/StockScreen.tsx:#161616',
  'src/screens/StockScreen.tsx:#3a3a3a',
  'src/screens/SubscriptionsScreen.tsx:#161616',
]);

const defauts = fautes.filter((f) => f.refuse);
const dettes = fautes.filter((f) => !f.refuse);
const dettesNouvelles = dettes.filter((f) => !DETTE_CONNUE.has(`${f.fichier}:${f.valeur.toLowerCase()}`));
const dettesReglees = [...DETTE_CONNUE].filter(
  (cle) => !dettes.some((f) => `${f.fichier}:${f.valeur.toLowerCase()}` === cle),
);

if (defauts.length > 0 || dettesNouvelles.length > 0) {
  for (const f of defauts) {
    console.error(`  ✗ ${f.fichier}:${f.ligne}  ${f.valeur}  — DÉFAUT`);
    console.error(`      ${f.raison}\n`);
  }
  for (const f of dettesNouvelles) {
    console.error(`  ✗ ${f.fichier}:${f.ligne}  ${f.valeur}  — copie nouvelle`);
    console.error(`      ${f.raison}\n`);
  }
  console.error('Une copie de jeton n’est pas une décision de design, c’est une occasion de');
  console.error('dérive : le jeton bouge, la copie reste, et l’écart ne se voit qu’à l’écran.');
  process.exit(1);
}

if (dettesReglees.length > 0) {
  console.log(`${dettesReglees.length} dette(s) réglée(s) — à retirer de DETTE_CONNUE :`);
  for (const c of dettesReglees) console.log(`  · ${c}`);
  console.log('');
}

console.log(
  `OK — ${fichiers.length} fichier(s) relus, ${jetons.size} jeton(s) de couleur, ` +
    `${REFUSEES.size} valeur(s) refusée(s). Aucun défaut ; ${dettes.length} copie(s) connue(s) en attente de conversion.`,
);
