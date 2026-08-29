#!/usr/bin/env node
/**
 * UN SEUL EN-TÊTE D'ÉCRAN, ET IL EST RÉEL
 * ═══════════════════════════════════════
 *
 * `ScreenHeader` a été écrit pour donner « la même voix sur les trente-deux
 * écrans ». Mesuré avant d'y toucher : CINQ l'utilisaient. La refonte avait
 * été commencée et jamais finie, et trois tailles de titre coexistaient —
 * `text-3xl` ici, `text-2xl sm:text-3xl` là, celle du composant ailleurs.
 *
 * Rien n'était faux isolément. Ensemble, ça donnait trente-deux applications
 * qui se ressemblent vaguement, ce qui est exactement l'impression que
 * l'application donnait en l'ouvrant.
 *
 * Ce contrôle empêche la reprise du désordre :
 *
 *   1. un écran de travail passe par `ScreenHeader` — pas de `<h1>` fait main ;
 *   2. un relevé se calcule sur des DONNÉES, jamais sur une constante. Un
 *      en-tête qui annonce « 12 » en dur ment dès le lendemain, et c'est pire
 *      qu'un en-tête sans relevé ;
 *   3. `ScreenHeader` reste la seule source de la taille de titre.
 *
 *   npm run check:ecrans
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/*
  DEUX DOSSIERS, ET LE SECOND EST CELUI DE LA CLIENTE.

  Ce contrôle ne lisait que `src/screens/`. Or l'édition livrée aux clientes a
  ses écrans à elle, dans `src/business/`, et AUCUN ne passait par
  `ScreenHeader` : trois titres faits main, en `text-lg` — 18 px contre les 22
  à 24 du composant.

  L'ironie est complète : la refonte disait « la même voix sur les trente-deux
  écrans », le contrôle la faisait respecter sur ceux d'AMN DevSec, et
  l'édition qu'on VEND gardait la voix d'avant. Et le tableau du dessus
  affichait fièrement « 26 écrans migrés » — sur un dénominateur qui excluait
  les seuls écrans qu'une cliente voit.
*/
const DOSSIERS = ['src/screens', 'src/business'];
const failures = [];

/*
  Les écrans qui n'ont pas d'en-tête de travail, et pourquoi.

  Ce ne sont pas des exceptions de commodité : aucun n'est un écran qu'on
  « ouvre » depuis la navigation. Les nommer un par un vaut mieux qu'une règle
  automatique, qui finirait par absoudre le prochain oubli.
*/
const SANS_ENTETE = new Map([
  ['LoginScreen', 'la console d’accès : pas de navigation, pas de fil d’Ariane'],
  ['InvitationScreen', 'écran public d’activation, hors application'],
  ['GuestCallScreen', 'écran public d’appel, hors application'],
  ['HomeScreen', 'l’accueil est lui-même l’en-tête de l’application'],
  ['SettingsScreen', 'une suite de panneaux, sans liste à dénombrer'],
  ['GeneratorScreen', 'un atelier en étapes : le titre change à chaque étape'],
  ['SiteControlScreen', 'le bureau d’UN site : son en-tête porte le nom du site'],
  ['TeamScreen', 'un fil de conversation, pas une liste'],
  ['ControlTowerScreen', 'déjà migré, plusieurs en-têtes de section'],
  ['OrganizationsScreen', 'déjà migré'],
  ['PagesScreen', 'déjà migré'],
  ['PersonalBudgetScreen', 'déjà migré'],
  ['IncidentsScreen', 'déjà migré'],
  // src/business — l'édition cliente.
  ['HomeSoloScreen', 'l’accueil est lui-même l’en-tête de l’application'],
  ['BusinessLayout', 'une coque, pas un écran'],
  ['BusinessSidebar', 'une barre de navigation'],
  ['BusinessTopBar', 'une barre supérieure'],
  ['DayBand', 'une bande de contenu, montée DANS un écran'],
  ['SoloPulse', 'un encart de l’accueil'],
  ['AppointmentReminders', 'un encart de l’agenda'],
]);

const fichiers = DOSSIERS.flatMap((dossier) => {
  const dir = path.join(ROOT, dossier);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => ({ nom: f.replace(/\.tsx$/, ''), chemin: path.join(dir, f), dossier }));
});

let migres = 0;

for (const { nom, chemin } of fichiers) {
  const src = fs.readFileSync(chemin, 'utf-8');
  const utilise = /<ScreenHeader\b/.test(src);
  if (utilise) migres += 1;

  /* ─── 1. Pas de titre fait main ───────────────────────────────────────── */

  /*
    On tolère un `<h1>` dans un écran QUI UTILISE DÉJÀ `ScreenHeader` : c'est
    alors un titre d'état particulier (« Scanner indisponible »), pas un
    en-tête concurrent.
  */
  const h1 = [...src.matchAll(/<h1\b[^>]*className="([^"]*)"/g)];
  if (!utilise && h1.length > 0 && !SANS_ENTETE.has(nom)) {
    failures.push(
      `${nom} écrit son titre à la main au lieu de passer par \`ScreenHeader\`. ` +
        `C'est ainsi que trois tailles de titre ont fini par coexister — rien de ` +
        `faux isolément, et ensemble une application qui ne se reconnaît pas.`,
    );
  }

  /* ─── 3. La taille du titre n'est décidée qu'à un endroit ─────────────── */

  /*
    Les écrans DISPENSÉS gardent leur titre : l'accueil assume un grand titre
    d'accueil, les Paramètres et le bureau d'un site ont le leur. Leur raison
    est nommée dans `SANS_ENTETE`, et c'est ce qui distingue une exception
    décidée d'un oubli. La règle vise donc les écrans de travail — y compris
    celui que quelqu'un écrira demain.
  */
  for (const m of SANS_ENTETE.has(nom) ? [] : h1) {
    if (!/text-(xl|2xl|3xl|4xl)\b/.test(m[1])) continue;
    // Un écran migré garde le droit à un titre d'état ; il ne doit simplement
    // pas reprendre les grandes tailles de l'ancien en-tête.
    if (/text-(3xl|4xl)\b/.test(m[1])) {
      failures.push(
        `${nom} pose un titre en \`${/text-(3xl|4xl)/.exec(m[1])[0]}\`. La taille ` +
          `du titre d'écran est décidée par \`ScreenHeader\` et par lui seul.`,
      );
    }
  }

  /* ─── 2. Un relevé se calcule ─────────────────────────────────────────── */

  /*
    Le bloc `stats` lu par CROCHETS ÉQUILIBRÉS, pas par une expression
    rationnelle paresseuse. Le premier jet s'arrêtait au premier `]}` d'une
    ligne — donc sur un `stats` écrit d'un seul tenant il débordait sur le
    reste du fichier et signalait comme « relevé figé » une option de filtre
    située cent lignes plus bas. Un contrôle qui invente une faute use la
    confiance aussi sûrement qu'un contrôle qui en rate une.
  */
  const debut = src.indexOf('stats={[');
  const bloc = debut === -1 ? null : (() => {
    let profondeur = 0;
    for (let i = debut + 'stats={'.length; i < src.length; i += 1) {
      if (src[i] === '[') profondeur += 1;
      else if (src[i] === ']') {
        profondeur -= 1;
        if (profondeur === 0) return [null, src.slice(debut, i)];
      }
    }
    return null;
  })();
  if (bloc) {
    /*
      Une valeur littérale — `value: 12`, `value: '3 sites'` — est un chiffre
      qui ment dès que les données bougent. Les seules constantes admises sont
      les marqueurs d'attente (`'…'`) et zéro, qui peut être un vrai décompte
      écrit à la main dans un cas dégradé.
    */
    for (const m of bloc[1].matchAll(/value:\s*([^,\n]+)/g)) {
      /*
        L'accolade fermante voyage avec la valeur quand le relevé tient sur une
        ligne : `value: 12 }`. Sans ce nettoyage, `/^\d+$/` échouait et le
        contrôle laissait passer exactement le cas pour lequel il existe —
        trouvé en le mutant, pas en le relisant.
      */
      const v = m[1].trim().replace(/[}\s]+$/, '');
      const litteral = /^(['"`]).*\1$/.test(v) || /^\d+$/.test(v);
      const tolere = v === "'…'" || v === '0';
      if (litteral && !tolere) {
        failures.push(
          `${nom} affiche un relevé FIGÉ : \`value: ${v}\`. Un relevé se calcule sur ` +
            `les données affichées, à chaque rendu — sinon il ment dès le lendemain, ` +
            `et un en-tête avec un chiffre faux est pire qu'un en-tête sans chiffre.`,
        );
      }
    }
  }
}

/* ─── Le composant lui-même reste la source ──────────────────────────────── */

const composant = fs.readFileSync(path.join(ROOT, 'src/components/ScreenHeader.tsx'), 'utf-8');
if (!/text-\[22px\][\s\S]{0,120}sm:text-2xl/.test(composant)) {
  failures.push(
    '`ScreenHeader` n’impose plus une taille de titre unique : la règle que ce ' +
      'contrôle fait respecter ailleurs n’a plus de source.',
  );
}

/* ─────────────────────────────── verdict ───────────────────────────────── */

if (failures.length > 0) {
  console.error('\nÉcrans : la voix commune s’est de nouveau dispersée.\n');
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}

console.log(
  `\nÉcrans : une seule voix.\n` +
    `  ${migres} écrans passent par ScreenHeader, ` +
    `${SANS_ENTETE.size - 5} en sont dispensés pour une raison nommée.`,
);
