/**
 * Contrôle du SOCLE DE LA REFONTE — jetons, briques, réglage Mouvement.
 *
 * Sans navigateur, sans build, sans réseau : il répond avant qu'on ait lancé
 * quoi que ce soit, là où `check:contraste` demande un build servi et une
 * session.
 *
 *   1. LES CONTRASTES, lus dans `src/index.css` (jamais recopiés ici — la
 *      faute que `check:encres` traque), pour le graphite ET le thème clair :
 *        · les trois encres ≥ 4,5:1 sur chacune des cinq surfaces ;
 *        · chaque famille et chaque état : la base ≥ 3:1 (un trait, WCAG
 *          1.4.11), l'encre ≥ 4,5:1 sur les surfaces ET sur son propre fond
 *          léger posé sur chacune d'elles ;
 *        · les encres des boutons pleins ≥ 4,5:1 sur leur plein et leur survol ;
 *        · la bordure forte et l'anneau de focus ≥ 3:1.
 *      Et une règle de teinte : aucune famille, aucun état n'entre dans la
 *      plage de l'ambre (25–50°) ; seul `etat-danger` a droit au rouge.
 *   2. LES BRIQUES, rendues hors navigateur (`react-dom/server`) : rôles,
 *      liens ARIA, état de chargement, carte cliquable sans contenu de bloc.
 *      Ce qui demande un vrai DOM — le piège de focus, Échap — est tenu par
 *      `check:calques`, qui exerce la pile que la Modale emploie.
 *   3. LE RÉGLAGE MOUVEMENT : défaut selon le système, choix écrit, retour
 *      au système, traduction vers framer-motion.
 *
 *   npm run check:socle
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let echecs = 0;
let vus = 0;
const dit = async (nom: string, fn: () => void | Promise<void>) => {
  try {
    await fn();
    vus += 1;
    console.log(`  ✓ ${nom}`);
  } catch (err) {
    echecs += 1;
    console.error(`  ✗ ${nom}\n      ${(err as Error).message.split('\n').join('\n      ')}`);
  }
};

/* ── 1. Les jetons ────────────────────────────────────────────────────────── */

const feuille = fs.readFileSync(path.join(racine, 'src/index.css'), 'utf8');
const debutSocle = feuille.indexOf('LE SOCLE DE LA REFONTE (S0)');
assert.ok(debutSocle > 0, 'bloc du socle introuvable dans src/index.css');

/** Le contenu entre l'accolade qui suit `apres` et l'accolade fermante appariée. */
function bloc(apres: string, depuis = debutSocle): string {
  const i = feuille.indexOf(apres, depuis);
  assert.ok(i > 0, `bloc « ${apres} » introuvable`);
  const ouvre = feuille.indexOf('{', i);
  const ferme = feuille.indexOf('}', ouvre);
  return feuille.slice(ouvre + 1, ferme);
}
function declarations(texte: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const [, nom, valeur] of texte.matchAll(/(--color-[\w-]+):\s*([^;]+);/g)) m.set(nom, valeur.trim());
  return m;
}
const graphite = declarations(bloc('@theme'));
const clair = new Map([...graphite, ...declarations(bloc(":root[data-theme='clair']"))]);

type Rvb = [number, number, number];
const rvb = (hex: string): Rvb => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as Rvb;
};
const canal = (c: number) => {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]: Rvb) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
const rapport = (a: Rvb, b: Rvb) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const poser = (c: Rvb, fond: Rvb, alpha: number): Rvb => c.map((v, i) => Math.round(v * alpha + fond[i] * (1 - alpha))) as Rvb;
const teinte = ([r, g, b]: Rvb) => {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const M = Math.max(R, G, B);
  const d = M - Math.min(R, G, B);
  if (d === 0) return { h: 0, s: 0 };
  const h = M === R ? ((G - B) / d) % 6 : M === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d / (1 - Math.abs(M + Math.min(R, G, B) - 1)) };
};

/** Résout un jeton en couleur opaque, ou en { base, alpha } pour un `color-mix(... N%, transparent)`. */
function resoudre(jetons: Map<string, string>, nom: string): { c: Rvb; alpha: number } {
  const v = jetons.get(nom);
  assert.ok(v, `jeton absent : ${nom}`);
  if (/^#[0-9a-f]{6}$/i.test(v)) return { c: rvb(v), alpha: 1 };
  const mix = /^color-mix\(in srgb, var\((--color-[\w-]+)\) (\d+)%, transparent\)$/.exec(v);
  assert.ok(mix, `${nom} : valeur non lue par le contrôle (${v}) — écrivez un #rrggbb ou un color-mix(in srgb, var(--x) N%, transparent)`);
  return { c: resoudre(jetons, mix[1]).c, alpha: Number(mix[2]) / 100 };
}

const SURFACES = ['fond', 'creux', 'surface', 'eleve', 'survol'].map((s) => `--color-socle-${s}`);
const FAMILLES_CSS = [...new Set([...graphite.keys()].filter((k) => /^--color-fam-[a-z]+$/.test(k)))];
const ETATS_CSS = ['--color-etat-succes', '--color-etat-attention', '--color-etat-danger'];

console.log('Socle de la refonte — jetons\n');

for (const [theme, jetons] of [['graphite', graphite], ['clair', clair]] as const) {
  const surfaces = SURFACES.map((s) => ({ nom: s, c: resoudre(jetons, s).c }));
  const auPire = (encre: Rvb) => Math.min(...surfaces.map((s) => rapport(encre, s.c)));

  await dit(`${theme} : les encres du socle tiennent 4,5:1 sur les cinq surfaces`, () => {
    for (const e of ['texte', 'texte-doux', 'texte-discret']) {
      const r = auPire(resoudre(jetons, `--color-socle-${e}`).c);
      assert.ok(r >= 4.5, `socle-${e} : ${r.toFixed(2)}:1`);
    }
  });

  await dit(`${theme} : bordure forte et focus tiennent 3:1 (WCAG 1.4.11)`, () => {
    for (const e of ['bord-fort', 'focus']) {
      const r = auPire(resoudre(jetons, `--color-socle-${e}`).c);
      assert.ok(r >= 3, `socle-${e} : ${r.toFixed(2)}:1`);
    }
  });

  await dit(`${theme} : boutons pleins lisibles, au repos et au survol`, () => {
    for (const [encre, pleins] of [
      ['--color-socle-primaire-encre', ['--color-socle-primaire', '--color-socle-primaire-survol']],
      ['--color-etat-danger-encre', ['--color-etat-danger-plein', '--color-etat-danger-plein-survol']],
    ] as const) {
      for (const plein of pleins) {
        const r = rapport(resoudre(jetons, encre).c, resoudre(jetons, plein).c);
        assert.ok(r >= 4.5, `${encre} sur ${plein} : ${r.toFixed(2)}:1`);
      }
    }
  });

  await dit(`${theme} : ${FAMILLES_CSS.length} familles et ${ETATS_CSS.length} états — trait 3:1, encre 4,5:1, fond léger compris`, () => {
    for (const base of [...FAMILLES_CSS, ...ETATS_CSS]) {
      const b = resoudre(jetons, base).c;
      const t = resoudre(jetons, `${base}-texte`).c;
      const fond = resoudre(jetons, `${base}-fond`);
      resoudre(jetons, `${base}-bord`);
      assert.ok(auPire(b) >= 3, `${base} (trait) : ${auPire(b).toFixed(2)}:1`);
      assert.ok(auPire(t) >= 4.5, `${base}-texte : ${auPire(t).toFixed(2)}:1`);
      for (const s of surfaces) {
        const r = rapport(t, poser(fond.c, s.c, fond.alpha));
        assert.ok(r >= 4.5, `${base}-texte sur son fond léger posé sur ${s.nom} : ${r.toFixed(2)}:1`);
      }
    }
  });
}

await dit('les sept familles du code ont leurs jetons, leur règle data-famille et leur nom fr/en', async () => {
  const { FAMILLES } = await charger<{ FAMILLES: readonly string[] }>('src/socle/familles.ts');
  const { DICTIONNAIRES_SOCLE } = await charger<{ DICTIONNAIRES_SOCLE: Record<string, Record<string, string>> }>('src/socle/i18n.ts');
  assert.deepEqual([...FAMILLES].sort(), FAMILLES_CSS.map((f) => f.replace('--color-fam-', '')).sort());
  for (const f of FAMILLES) {
    assert.ok(feuille.includes(`[data-famille='${f}'] { --fam: var(--color-fam-${f});`), `règle [data-famille='${f}'] absente`);
    assert.ok(DICTIONNAIRES_SOCLE.fr[`famille.${f}`] && DICTIONNAIRES_SOCLE.en[`famille.${f}`], `nom de la famille ${f} manquant`);
  }
});

await dit('aucune famille ni aucun état dans la teinte de l’ambre ; le rouge au seul danger', () => {
  for (const jeton of [...FAMILLES_CSS, ...ETATS_CSS]) {
    for (const [theme, jetons] of [['graphite', graphite], ['clair', clair]] as const) {
      const { h, s } = teinte(resoudre(jetons, jeton).c);
      if (s < 0.15) continue; // un gris n'a pas de teinte
      assert.ok(h < 25 || h > 50, `${jeton} (${theme}) : ${h.toFixed(0)}°, dans la plage de l’ambre`);
      const rouge = h < 18 || h > 345;
      if (jeton !== '--color-etat-danger') assert.ok(!rouge, `${jeton} (${theme}) : ${h.toFixed(0)}°, dans le rouge du critique`);
    }
  }
});

await dit('les mots du socle : mêmes clés en fr et en, aucune vide, aucun point d’exclamation', async () => {
  const { DICTIONNAIRES_SOCLE } = await charger<{ DICTIONNAIRES_SOCLE: Record<string, Record<string, string>> }>('src/socle/i18n.ts');
  const { fr, en } = DICTIONNAIRES_SOCLE;
  assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort());
  for (const [langue, d] of Object.entries(DICTIONNAIRES_SOCLE)) {
    for (const [cle, v] of Object.entries(d)) {
      assert.ok(v.trim(), `${langue} ${cle} vide`);
      assert.ok(!v.includes('!'), `${langue} ${cle} : point d’exclamation`);
      if (langue === 'fr') assert.ok(!/[a-zà-ÿ]'[a-zà-ÿ]/i.test(v), `fr ${cle} : apostrophe droite`);
      if (langue === 'en') assert.ok(!/[«»’]/.test(v), `en ${cle} : typographie française`);
    }
  }
});

/* ── 2. Les briques ───────────────────────────────────────────────────────── */

/** Charge un module des sources (ou un bout de code, `{ code }`), construit par esbuild. */
async function charger<T>(entree: string | { code: string }): Promise<T> {
  const construit = await esbuild.build({
    ...(typeof entree === 'string'
      ? { entryPoints: [path.join(racine, entree)] }
      : { stdin: { contents: entree.code, resolveDir: path.join(racine, 'scripts'), loader: 'tsx' as const } }),
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    charset: 'utf8',
    jsx: 'automatic',
    tsconfig: path.join(racine, 'tsconfig.json'),
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', __AMN_EDITION__: '"internal"', __AMN_VERSION__: '"0.0.0"' },
    logLevel: 'silent',
  });
  return (await import(
    `data:text/javascript;charset=utf-8;base64,${Buffer.from(construit.outputFiles[0].text, 'utf8').toString('base64')}`
  )) as T;
}

console.log('\nSocle de la refonte — briques\n');

const entreeBriques = {
  code: [
    "import { createElement as h } from 'react';",
    "import { renderToStaticMarkup } from 'react-dom/server.browser';",
    "import { Bouton, Carte, Saisie } from '../src/socle/ui';",
    "import { ModaleEnPlace } from '../src/socle/ui/Modale';",
    'export const rendre = (el) => renderToStaticMarkup(el);',
    'export { h, Bouton, Carte, Saisie, ModaleEnPlace };',
  ].join('\n'),
};
type Briques = {
  rendre: (el: unknown) => string;
  h: (type: unknown, props?: Record<string, unknown> | null, ...enfants: unknown[]) => unknown;
  Bouton: unknown;
  Carte: unknown;
  Saisie: unknown;
  ModaleEnPlace: unknown;
};
const { rendre, h, Bouton, Carte, Saisie, ModaleEnPlace } = await charger<Briques>(entreeBriques);
const attr = (html: string, nom: string) => new RegExp(`${nom}="([^"]*)"`).exec(html)?.[1];

await dit('Bouton : un vrai bouton, type="button" par défaut, quatre variantes distinctes', () => {
  const rendus = ['primaire', 'secondaire', 'discret', 'danger'].map((v) => rendre(h(Bouton, { variante: v }, 'Enregistrer')));
  for (const r of rendus) {
    assert.match(r, /^<button[^>]*type="button"/);
    assert.match(r, /Enregistrer/);
    assert.match(r, /focus-visible:outline/);
  }
  assert.equal(new Set(rendus.map((r) => attr(r, 'class'))).size, 4);
  assert.match(rendre(h(Bouton, { type: 'submit' }, 'Envoyer')), /type="submit"/);
});

await dit('Bouton : le chargement bloque, s’annonce et garde le libellé', () => {
  const r = rendre(h(Bouton, { chargement: true }, 'Envoyer la facture'));
  assert.match(r, /disabled=""/);
  assert.match(r, /aria-busy="true"/);
  assert.match(r, /Chargement…/);
  assert.match(r, /Envoyer la facture/);
  assert.doesNotMatch(rendre(h(Bouton, null, 'Envoyer')), / aria-busy=| disabled=/);
});

await dit('Bouton : trois tailles distinctes, inactif sans ombre', () => {
  const tailles = ['petit', 'moyen', 'grand'].map((t) => attr(rendre(h(Bouton, { taille: t }, 'x')), 'class'));
  assert.equal(new Set(tailles).size, 3);
  assert.match(attr(rendre(h(Bouton, { variante: 'primaire' }, 'x')), 'class') ?? '', /disabled:shadow-none/);
});

await dit('Carte : famille posée en data-famille, titre en vrai titre', () => {
  const r = rendre(h(Carte, { famille: 'argent', surtitre: 'Factures', titre: 'À encaisser' }, 'trois factures'));
  assert.match(r, /^<section[^>]*data-famille="argent"/);
  assert.match(r, /<h2[^>]*>À encaisser<\/h2>/);
  assert.match(r, /var\(--fam\)/);
  assert.match(rendre(h(Carte, { as: 'article', niveauTitre: 3, titre: 'T' })), /^<article[^>]*>.*<h3/);
});

await dit('Carte cliquable : un bouton, sans contenu de bloc ni bouton imbriqué', () => {
  const r = rendre(h(Carte, { onClick: () => undefined, titre: 'Ouvrir', surtitre: 'S', actions: h('button', null, 'x') }, 'contenu'));
  assert.match(r, /^<button[^>]*type="button"/);
  assert.doesNotMatch(r, /<(div|p|h\d|section)\b/);
  assert.equal((r.match(/<button/g) ?? []).length, 1);
});

await dit('Saisie : étiquette reliée, aide et erreur décrites, invalide annoncé', () => {
  const r = rendre(h(Saisie, { id: 'montant', etiquette: 'Montant', aide: 'Hors taxes', erreur: 'Montant manquant', suffixe: '€' }));
  assert.match(r, /<label[^>]*for="montant"/);
  assert.equal(attr(r, 'aria-describedby'), 'montant-aide montant-erreur');
  assert.match(r, /aria-invalid="true"/);
  assert.match(r, /id="montant-erreur"[^>]*>Montant manquant/);
  const sans = rendre(h(Saisie, { etiquette: 'Nom' }));
  assert.doesNotMatch(sans, /aria-invalid|aria-describedby/);
  assert.equal(attr(sans, 'for'), attr(sans, 'id'));
});

await dit('Modale : dialogue modal titré et décrit, calque fixe z-50, bouton Fermer', () => {
  const r = rendre(h(ModaleEnPlace, { ouverte: true, onFermer: () => undefined, titre: 'Nouvelle facture', description: 'Trois champs' }, 'corps'));
  assert.match(r, /class="fixed inset-0 z-50/, 'la pile des calques reconnaît un calque à position fixed + z ≥ 50');
  assert.match(r, /role="dialog"/);
  assert.match(r, /aria-modal="true"/);
  const titre = attr(r, 'aria-labelledby');
  const desc = attr(r, 'aria-describedby');
  assert.ok(titre && r.includes(`<h2 id="${titre}"`), 'aria-labelledby ne désigne pas le titre');
  assert.ok(desc && r.includes(`<p id="${desc}"`), 'aria-describedby ne désigne pas la description');
  assert.match(r, /tabindex="-1"/);
  assert.match(r, /aria-label="Fermer"/);
  assert.equal(rendre(h(ModaleEnPlace, { ouverte: false, onFermer: () => undefined, titre: 'x' })), '');
  assert.doesNotMatch(rendre(h(ModaleEnPlace, { ouverte: true, onFermer: () => undefined, titre: 'x' })), /aria-describedby/);
});

await dit('Modale : branchée sur Échap et la pile des calques', () => {
  const src = fs.readFileSync(path.join(racine, 'src/socle/ui/Modale.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(src, /useFermetureEchap\(ouverte, onFermer\)/);
  assert.match(src, /useFocusALOuverture/);
  assert.match(src, /createPortal\(/);
});

/* ── 3. Le réglage Mouvement ──────────────────────────────────────────────── */

console.log('\nSocle de la refonte — réglage Mouvement\n');

const stockage = new Map<string, string>();
let systemeReduit = false;
let evenements = 0;
(globalThis as Record<string, unknown>).window = {
  localStorage: {
    getItem: (k: string) => stockage.get(k) ?? null,
    setItem: (k: string, v: string) => void stockage.set(k, v),
    removeItem: (k: string) => void stockage.delete(k),
  },
  matchMedia: () => ({ matches: systemeReduit }),
  dispatchEvent: () => {
    evenements += 1;
    return true;
  },
};
const m = await charger<{
  lireMouvement: () => string;
  ecrireMouvement: (n: string | null) => void;
  choixMouvement: () => string | null;
  configMotion: (n: string) => { reducedMotion: string; skipAnimations: boolean };
  CLE_MOUVEMENT: string;
}>('src/socle/mouvement.ts');

await dit('sans choix : « complet », ou « réduit » si le système demande moins', () => {
  systemeReduit = false;
  assert.equal(m.lireMouvement(), 'complet');
  systemeReduit = true;
  assert.equal(m.lireMouvement(), 'reduit');
});

await dit('un choix écrit l’emporte sur le système, dans les deux sens, et prévient', () => {
  const avant = evenements;
  systemeReduit = true;
  m.ecrireMouvement('complet');
  assert.equal(m.lireMouvement(), 'complet');
  assert.equal(stockage.get(m.CLE_MOUVEMENT), 'complet');
  systemeReduit = false;
  m.ecrireMouvement('aucun');
  assert.equal(m.lireMouvement(), 'aucun');
  assert.equal(evenements, avant + 2);
});

await dit('revenir au système efface le choix ; une valeur inconnue est ignorée', () => {
  m.ecrireMouvement(null);
  assert.equal(m.choixMouvement(), null);
  stockage.set(m.CLE_MOUVEMENT, 'turbo');
  systemeReduit = true;
  assert.equal(m.lireMouvement(), 'reduit');
});

await dit('traduction vers framer-motion : never / always / always + skipAnimations', () => {
  assert.deepEqual(m.configMotion('complet'), { reducedMotion: 'never', skipAnimations: false });
  assert.deepEqual(m.configMotion('reduit'), { reducedMotion: 'always', skipAnimations: false });
  assert.deepEqual(m.configMotion('aucun'), { reducedMotion: 'always', skipAnimations: true });
});

await dit('l’attribut data-mouvement a ses règles CSS (réduit, aucun)', () => {
  assert.match(feuille, /:root\[data-mouvement='reduit'\] \*/);
  assert.match(feuille, /:root\[data-mouvement='aucun'\] \*[\s\S]*?transition-duration: 0\.01ms !important/);
});

console.log('');
if (echecs > 0) {
  console.error(`ÉCHEC — ${echecs} propriété(s) du socle ne tiennent pas.`);
  process.exit(1);
}
console.log(`OK — ${vus} propriétés du socle tiennent.`);
// framer-motion garde une boucle d'images armée : on sort explicitement.
process.exit(0);
