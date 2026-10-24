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
 *   4. LE NOIR ET GRIS ET LA COQUILLE (session DS) : `src/socle/noir.css` dit
 *      ce que la direction de design a validé (fonds, bordures, encres, rayons,
 *      gabarits, familles, états) et ses deux écritures s'accordent ; les trois
 *      encres du texte tiennent 4,5:1 sur chaque fond, et les deux encres
 *      « discret » ne se posent JAMAIS en `color` ; les nouvelles briques et la
 *      coquille (barre latérale, en-tête, barre Ajmani) se rendent avec leurs
 *      rôles ARIA ; aucun personnage ni avatar d'Ajmani ; un seul bouton plein ;
 *      rien de la coquille n'entre dans le paquet de l'édition cliente ; le
 *      drapeau est éteint par défaut.
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

/* ── 4. Le noir et gris, les nouvelles briques, la coquille ───────────────── */

console.log('\nSocle de la refonte — noir et gris, briques, coquille\n');

const lireSrc = (rel: string) => fs.readFileSync(path.join(racine, rel), 'utf8');
const noir = lireSrc('src/socle/noir.css');
const sansCommentaires = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const brut = (nom: string): string => {
  const m = new RegExp(`${nom.replace(/[-]/g, '\\-')}:\\s*(#[0-9a-fA-F]{6}|[0-9]+px)\\s*;`).exec(noir);
  assert.ok(m, `${nom} absent de noir.css`);
  return m[1].toLowerCase();
};
const hexOf = (nom: string) => rvb(brut(nom));

await dit('noir.css : les jetons validés par la direction de design, valeur pour valeur', () => {
  const attendu: Record<string, string> = {
    '--socle-fond-page': '#0c0c0d', '--socle-fond-lateral': '#101011', '--socle-carte-haut': '#161617', '--socle-carte-bas': '#131314', '--socle-encart': '#141415', '--socle-champ': '#131314',
    '--socle-bord-lateral': '#222224', '--socle-bord-carte': '#232325', '--socle-bord-controle': '#28282b', '--socle-bord-entete': '#1d1d1f', '--socle-bord-ligne': '#19191b',
    '--socle-texte-1': '#ededed', '--socle-texte-2': '#a0a0a5', '--socle-texte-3': '#8a8a8e', '--socle-trait-discret': '#77777c', '--socle-trait-tres-discret': '#5f5f64',
    '--socle-primaire': '#ededed', '--socle-primaire-encre': '#0c0c0d',
    '--socle-fam-jour': '#8aa4d6', '--socle-fam-contacts': '#6fb7a8', '--socle-fam-ecrire': '#a79bdb', '--socle-fam-argent': '#8fbf7a', '--socle-fam-echanger': '#d98fa8', '--socle-fam-creer': '#d9a27a', '--socle-fam-outils': '#9a9aa0',
    '--socle-etat-succes': '#8fbf7a', '--socle-etat-attention': '#d9a27a', '--socle-etat-critique': '#e08a80', '--socle-etat-info': '#8aa4d6',
    '--socle-rayon-carte': '14px', '--socle-rayon-controle': '9px', '--socle-rayon-bouton': '10px', '--socle-rayon-pastille': '99px',
    '--socle-largeur-lateral': '252px', '--socle-hauteur-entete': '60px', '--socle-hauteur-ajmani': '48px',
  };
  for (const [nom, valeur] of Object.entries(attendu)) assert.equal(brut(nom), valeur, nom);
  assert.match(noir, /--socle-halo:\s*radial-gradient\(1000px 520px at 85% -10%, rgba\(255, 255, 255, 0\.045\), transparent 70%\)/);
});

await dit('noir.css : les noms du socle S0 disent la même chose que les jetons bruts', () => {
  const paires: [string, string][] = [
    ['--color-socle-fond', '--socle-fond-page'], ['--color-bg', '--socle-fond-page'], ['--color-socle-surface', '--socle-carte-bas'], ['--color-socle-eleve', '--socle-carte-haut'], ['--color-socle-bord', '--socle-bord-carte'],
    ['--color-socle-texte', '--socle-texte-1'], ['--color-socle-texte-doux', '--socle-texte-3'], ['--color-socle-texte-discret', '--socle-texte-3'],
    ['--color-socle-primaire', '--socle-primaire'], ['--color-socle-primaire-encre', '--socle-primaire-encre'],
    ['--color-etat-succes', '--socle-etat-succes'], ['--color-etat-attention', '--socle-etat-attention'], ['--color-etat-danger', '--socle-etat-critique'], ['--color-etat-info', '--socle-etat-info'],
    ...['jour', 'contacts', 'ecrire', 'argent', 'echanger', 'creer', 'outils'].flatMap((f): [string, string][] => [[`--color-fam-${f}`, `--socle-fam-${f}`], [`--color-fam-${f}-texte`, `--socle-fam-${f}`]]),
  ];
  for (const [socle, brutNom] of paires) assert.equal(brut(socle), brut(brutNom), `${socle} ≠ ${brutNom}`);
});

const FONDS_TEXTE = ['--socle-fond-page', '--socle-fond-lateral', '--socle-carte-haut', '--socle-carte-bas', '--socle-encart', '--socle-champ'];
await dit('les trois encres du texte tiennent 4,5:1 sur chaque fond (le plancher : #8a8a8e)', () => {
  for (const encre of ['--socle-texte-1', '--socle-texte-2', '--socle-texte-3']) {
    for (const fond of [...FONDS_TEXTE, '--color-socle-survol']) {
      const r = rapport(hexOf(encre), hexOf(fond));
      assert.ok(r >= 4.5, `${encre} sur ${fond} : ${r.toFixed(2)}:1`);
    }
  }
});

await dit('familles et états : lisibles en texte (4,5:1) et en trait sur les fonds de carte', () => {
  const noms = ['--socle-fam-jour', '--socle-fam-contacts', '--socle-fam-ecrire', '--socle-fam-argent', '--socle-fam-echanger', '--socle-fam-creer', '--socle-fam-outils', '--socle-etat-succes', '--socle-etat-attention', '--socle-etat-critique', '--socle-etat-info'];
  for (const n of noms) for (const f of FONDS_TEXTE) assert.ok(rapport(hexOf(n), hexOf(f)) >= 4.5, `${n} sur ${f} : ${rapport(hexOf(n), hexOf(f)).toFixed(2)}:1`);
});

await dit('le bouton plein (#ededed sur #0c0c0d) et le focus tiennent leurs contrastes', () => {
  assert.ok(rapport(hexOf('--socle-primaire-encre'), hexOf('--socle-primaire')) >= 7);
  for (const f of FONDS_TEXTE) assert.ok(rapport(hexOf('--socle-texte-1'), hexOf(f)) >= 3, `focus sur ${f}`);
  assert.match(sansCommentaires(lireSrc('src/socle/ui/briques.css')), /\.sc-focus:focus-visible[\s\S]*?outline:\s*2px solid var\(--color-socle-focus\)/);
});

/** Un `color:` (la propriété exacte, pas `border-color` ni `text-decoration-color`) et sa valeur. */
function couleursDeTexte(css: string): string[] {
  return [...sansCommentaires(css).matchAll(/(?:^|[;{\s])color\s*:\s*([^;}]+)/g)].map((m) => m[1].trim());
}
const INTERDITS_EN_TEXTE = /trait-discret|trait-tres-discret|#77777c|#5f5f64|#777777|#5f5f5f/i;

await dit('« discret » et « très discret » ne sont jamais la couleur d’un texte (feuilles et classes)', () => {
  const css = ['src/socle/noir.css', 'src/socle/ui/briques.css', 'src/socle/coquille/coquille.css'];
  for (const f of css) for (const c of couleursDeTexte(lireSrc(f))) assert.ok(!INTERDITS_EN_TEXTE.test(c), `${f} : color: ${c}`);
  const sources = [...fichiersSous('src/socle'), ...fichiersSous('src/refonte/coquille'), ...fichiersSous('src/refonte/accueil')].filter((f) => /\.tsx?$/.test(f));
  for (const f of sources) {
    const src = lireSrc(f).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/text-\[var\(--socle-trait|text-\[#(77777c|5f5f64)\]|color:\s*['"]?(#77777c|#5f5f64|var\(--socle-trait)/i.test(src), `${f} pose une encre « discret » en texte`);
  }
});

function fichiersSous(dir: string): string[] {
  const sortie: string[] = [];
  for (const e of fs.readdirSync(path.join(racine, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) sortie.push(...fichiersSous(rel));
    else sortie.push(rel);
  }
  return sortie;
}

const entreeCoquille = {
  code: [
    "import { createElement as h } from 'react';",
    "import { renderToStaticMarkup } from 'react-dom/server.browser';",
    "import { MemoryRouter } from 'react-router-dom';",
    "import { TuileKpi, TuileAjouter, BarreProgression, AnneauProgression, CaseACocher, LigneTache, EtatVide, Etiquette, PastilleEtat, Avatar, PileAvatars, Squelette, LigneActivite, EtapeFranchie, Chargement, Raccourci } from '../src/socle/ui';",
    "import { BarreLaterale, EnTete, BarreAjmani } from '../src/socle/coquille';",
    "import { construireFil } from '../src/refonte/coquille/fil';",
    'export const rendre = (el) => renderToStaticMarkup(h(MemoryRouter, null, el));',
    'export { h, TuileKpi, TuileAjouter, BarreProgression, AnneauProgression, CaseACocher, LigneTache, EtatVide, Etiquette, PastilleEtat, Avatar, PileAvatars, Squelette, LigneActivite, EtapeFranchie, Chargement, Raccourci, BarreLaterale, EnTete, BarreAjmani, construireFil };',
  ].join('\n'),
};
const K = await charger<Record<string, any>>(entreeCoquille); // eslint-disable-line @typescript-eslint/no-explicit-any
const rendreK = K.rendre as (el: unknown) => string;
const hk = K.h as (type: unknown, props?: Record<string, unknown> | null, ...enfants: unknown[]) => unknown;

await dit('TuileKpi : libellé, valeur, variation et barre annoncée ; cliquable = un vrai bouton', () => {
  const r = rendreK(hk(K.TuileKpi, { libelle: 'Tâches d’équipe', valeur: 12, variation: '3 en cours', ton: 'succes', barre: 0.4, libelleBarre: 'Faites cette semaine' }));
  assert.match(r, /class="sc-kpi"/);
  assert.match(r, /role="progressbar"[^>]*aria-valuenow="40"/);
  assert.match(r, /data-ton="succes"/);
  const c = rendreK(hk(K.TuileKpi, { libelle: 'x', valeur: 1, onClick: () => undefined }));
  assert.match(c, /^<button[^>]*type="button"/);
  assert.match(rendreK(hk(K.TuileAjouter, { libelle: 'Ajouter une carte', onClick: () => undefined })), /^<button[^>]*data-vide="true"[^>]*>.*Ajouter une carte/);
});

await dit('barre et anneau : valeur bornée à 0–100, annoncée en pourcentage, redite en mots', () => {
  const b = rendreK(hk(K.BarreProgression, { valeur: 1.7, libelle: 'Journée', texte: '3 sur 3' }));
  assert.match(b, /aria-valuenow="100"/);
  assert.match(b, /aria-valuetext="3 sur 3"/);
  assert.match(b, /width:100%/);
  assert.match(rendreK(hk(K.BarreProgression, { valeur: -1, libelle: 'x' })), /aria-valuenow="0"/);
  const a = rendreK(hk(K.AnneauProgression, { valeur: 0.5, libelle: 'Journée', taille: 40, epaisseur: 4 }, '2/4'));
  assert.match(a, /role="progressbar"[^>]*aria-valuenow="50"/);
  assert.match(a, /stroke-dashoffset/);
  assert.match(a, /aria-hidden="true"/);
});

await dit('case à cocher et ligne de tâche : role="checkbox", état annoncé, lecture seule dite, 44 px de colonne d’heure', () => {
  const c = rendreK(hk(K.CaseACocher, { coche: true, libelle: 'Décocher : Appeler' }));
  assert.match(c, /role="checkbox"/);
  assert.match(c, /aria-checked="true"/);
  assert.match(c, /aria-label="Décocher : Appeler"/);
  assert.match(rendreK(hk(K.CaseACocher, { coche: false, lecture: true, libelle: 'x' })), /aria-disabled="true"/);
  const l = rendreK(hk(K.LigneTache, { titre: 'Rendez-vous Dupont', heure: '09:30', fait: false, libelleCase: 'Cocher', famille: 'jour', meta: 'Agenda', onOuvrir: () => undefined }));
  assert.match(l, /^<li[^>]*data-famille="jour"/);
  assert.match(l, /class="sc-ligne__heure">09:30</);
  assert.match(l, /<button[^>]*class="sc-ligne__corps sc-focus"/);
  assert.match(l, /class="sc-point" data-taille="6"/);
  const fait = rendreK(hk(K.LigneTache, { titre: 'x', fait: true, libelleCase: 'x' }));
  assert.match(fait, /data-fait="true"/);
});

await dit('état vide : une invitation (texte + action) ; chargement : annoncé une fois, squelettes muets', () => {
  const v = rendreK(hk(K.EtatVide, { titre: 'Rien ici', texte: 'Ajoutez votre premier client.', action: hk('button', null, 'Ajouter') }));
  assert.match(v, /Ajoutez votre premier client\./);
  assert.match(v, /<button>Ajouter<\/button>/);
  const c = rendreK(hk(K.Chargement, { libelle: 'Chargement…' }, hk(K.Squelette, { hauteur: 20 })));
  assert.match(c, /role="status"[^>]*aria-busy="true"/);
  assert.match(c, /class="sc-squelette"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*class="sc-squelette"/);
});

await dit('pastilles : l’état se dit en mots, l’avatar ne montre que des initiales, la pile se nomme', () => {
  assert.match(rendreK(hk(K.PastilleEtat, { etat: 'critique' }, 'Critique')), /data-etat="critique"[^>]*>Critique/);
  const av = rendreK(hk(K.Avatar, { nom: 'Aaron M.', taille: 24 }));
  assert.match(av, />AM</);
  assert.doesNotMatch(av, /<img|<svg/);
  const pile = rendreK(hk(K.PileAvatars, { noms: ['Aaron', 'Mohamed', 'Riyad', 'Harun'], max: 3, libelle: '4 en ligne' }));
  assert.match(pile, /role="img"[^>]*aria-label="4 en ligne"/);
  assert.match(pile, />\+1</);
  assert.match(rendreK(hk(K.Etiquette, { famille: 'argent' }, 'L’argent')), /data-famille="argent"/);
});

await dit('activité : la ligne dit qui et quand ; l’étape franchie est une carte, pas une animation', () => {
  const l = rendreK(hk(K.LigneActivite, { nom: 'Riyad', texte: 'Facture F-12 encaissée', quand: 'il y a 2 h', famille: 'argent' }));
  assert.match(l, /Riyad · il y a 2 h/);
  const e = rendreK(hk(K.EtapeFranchie, { libelle: 'Étape franchie', texte: '100 factures envoyées', quand: 'hier', famille: 'argent' }));
  assert.match(e, /class="sc-etape"/);
  assert.match(e, /100 factures envoyées/);
});

const FAMILLES_TEST = (actif: string | null) => [
  { cle: 'jour', nom: 'Ma journée', famille: 'jour', badge: 4, active: actif === 'jour', modules: [{ cle: 'home', libelle: 'Accueil', vers: '/', badge: 0, courant: actif === 'jour' }, { cle: 'tasks', libelle: 'Tâches', vers: '/tasks', badge: 4, courant: false }] },
  { cle: 'argent', nom: 'L’argent', famille: 'argent', badge: 2, active: actif === 'argent', modules: [{ cle: 'invoices', libelle: 'Facturation', vers: '/facturation', badge: 2, courant: actif === 'argent' }] },
];
const GARDE_TEST = { cle: 'garde', nom: 'La Garde et la supervision', famille: 'outils', badge: 0, active: false, modules: [{ cle: 'gardeSalle', libelle: 'La Garde', vers: '/garde', badge: 0, courant: false }] };
const LATERALE = (surcharges: Record<string, unknown> = {}) =>
  hk(K.BarreLaterale, { produit: 'Mon espace', familles: FAMILLES_TEST('jour'), garde: GARDE_TEST, nombreModules: 101, routeTousLesModules: '/tous-les-modules', enLigne: [{ cle: 'a', nom: 'Aaron', lieu: 'Accueil' }, { cle: 'b', nom: 'Mohamed', lieu: 'Facturation' }], presenceMontree: true, raccourciRecherche: '⌘ K', onRecherche: () => undefined, ouvert: false, onFermer: () => undefined, ...surcharges });

await dit('barre latérale : une seule navigation, la famille active déroulée, le module courant marqué', () => {
  const r = rendreK(LATERALE());
  assert.equal((r.match(/<aside/g) ?? []).length, 1);
  assert.match(r, /<aside[^>]*data-rail/);
  assert.equal((r.match(/<nav/g) ?? []).length, 1);
  assert.match(r, /Ma journée/);
  assert.match(r, /aria-expanded="true"[^>]*aria-controls="sc-sous-jour"/);
  assert.match(r, /aria-expanded="false"[^>]*aria-controls="sc-sous-argent"/);
  assert.match(r, /<a[^>]*aria-current="page"[^>]*>.*?Accueil/);
  assert.equal((r.match(/aria-current="page"/g) ?? []).length, 1);
  assert.doesNotMatch(r, /id="sc-sous-argent"/, 'une famille repliée ne montre pas ses modules');
});

await dit('barre latérale : la Garde à part (8e famille), « Tous les modules (101) », « En ligne » avec leur lieu, ⌘K', () => {
  const r = rendreK(LATERALE());
  assert.match(r, /sc-liste--garde[^>]*data-guide="supervision"/);
  assert.match(r, /La Garde et la supervision/);
  assert.match(r, /Tous les modules \(101\)/);
  assert.match(r, /href="\/tous-les-modules"/);
  assert.match(r, /En ligne.*· 2/);
  assert.match(r, /Mohamed.*sur Facturation/);
  assert.match(r, /data-guide="recherche"/);
  assert.match(r, /⌘ K/);
  const sans = rendreK(LATERALE({ garde: null, enLigne: [] }));
  assert.doesNotMatch(sans, /sc-liste--garde/, 'sans modules de la Garde, pas de huitième famille');
  assert.match(sans, /Personne d’autre n’est en ligne/);
  assert.match(rendreK(LATERALE({ presenceMontree: false, enLigne: [] })), /La présence est coupée/);
});

await dit('barre latérale : un compteur à zéro ne s’affiche pas, un compteur se dit en mots', () => {
  const r = rendreK(LATERALE({ familles: FAMILLES_TEST('argent') }));
  assert.match(r, /sc-compteur[^>]*title="4 à voir">4</);
  assert.match(r, /class="sr-only">4 à voir/.test(r) ? /./ : /4 à voir/);
  assert.equal((r.match(/sc-compteur/g) ?? []).length, 2, 'Ma journée (4, repliée) et Facturation (2) — pas de 0');
});

await dit('en-tête : fil d’Ariane en liste, dernière miette = page courante, pile « 3 en ligne », cloche, pastille de la Garde', () => {
  const entete = (surcharges: Record<string, unknown> = {}) =>
    hk(K.EnTete, { fil: [{ libelle: 'Ma journée', vers: '/' }, { libelle: 'Accueil' }], enLigne: ['Aaron', 'Mohamed', 'Riyad'], presenceMontree: true, notifications: 3, volet: () => 'volet', garde: { etat: 'calme', points: 0, vers: '/garde' }, onMenu: () => undefined, ...surcharges });
  const r = rendreK(entete());
  assert.match(r, /<header[^>]*data-socle="entete"/);
  assert.match(r, /<nav aria-label="Fil d’Ariane"[^>]*><ol>/);
  assert.match(r, /<li aria-current="page"><span>Accueil<\/span>/);
  assert.match(r, /role="img"[^>]*aria-label="3 en ligne"/);
  assert.match(r, /aria-label="Notifications, 3 à voir"/);
  assert.match(r, /sc-cloche__badge[^>]*>3</);
  assert.match(r, /La Garde veille, tout est en ordre/);
  assert.match(r, /data-etat="calme"/);
  assert.match(rendreK(entete({ garde: { etat: 'attention', points: 2, vers: '/garde' } })), /La Garde signale 2 point\(s\) à regarder/);
  assert.match(rendreK(entete({ garde: { etat: 'critique', points: 1, vers: '/garde' } })), /La Garde a une alerte critique/);
  assert.match(rendreK(entete({ garde: { etat: 'inconnu', points: 0, vers: '/garde' } })), /La Garde ne répond pas/);
  assert.doesNotMatch(rendreK(entete({ notifications: 0 })), /sc-cloche__badge/);
  assert.doesNotMatch(rendreK(entete({ enLigne: [] })), /sc-entete__presence/);
});

await dit('barre Ajmani : une barre de texte avec ⌘J — ni dessin, ni image, ni avatar', () => {
  const r = rendreK(hk(K.BarreAjmani, { onOuvrir: () => undefined, raccourci: '⌘ J' }));
  assert.match(r, /^<button[^>]*aria-haspopup="dialog"[^>]*aria-keyshortcuts="Control\+J Meta\+J"/);
  assert.match(r, /Demandez à Ajmani, ou dites ce que vous voulez faire/);
  assert.match(r, /⌘ J/);
  assert.doesNotMatch(r, /<svg|<img|<canvas|sc-avatar/);
});

await dit('le fil d’Ariane : famille puis écran ; la vue Tous les modules et l’inconnu ne laissent jamais le fil vide', () => {
  assert.deepEqual(K.construireFil('/facturation', { famille: 'L’argent', module: 'Facturation' }, 'Accueil'), [{ libelle: 'L’argent' }, { libelle: 'Facturation' }]);
  assert.deepEqual(K.construireFil('/tous-les-modules', null, 'Accueil', { route: '/tous-les-modules', libelle: 'Tous les modules' }), [{ libelle: 'Tous les modules' }]);
  assert.deepEqual(K.construireFil('/outils/mon-reglage', null, 'Accueil'), [{ libelle: 'Mon reglage' }]);
  assert.deepEqual(K.construireFil('/', null, 'Accueil'), [{ libelle: 'Accueil' }]);
});

await dit('la coquille tient à 400 px : tiroir sous 900 px, colonnes à minmax(0,1fr), rien qui force la largeur', () => {
  const css = sansCommentaires(lireSrc('src/socle/coquille/coquille.css'));
  assert.match(css, /@media \(max-width: 899\.98px\)/);
  assert.match(css, /@media \(max-width: 460px\)/);
  assert.match(css, /grid-template-columns: var\(--socle-largeur-lateral\) minmax\(0, 1fr\)/);
  assert.match(css, /\.sc-principal \{[^}]*min-width: 0;[^}]*overflow-x: hidden;/);
  assert.match(css, /\.sc-lateral \{[^}]*transform: translateX\(-102%\)/);
  assert.match(sansCommentaires(lireSrc('src/socle/ui/briques.css')), /\.sc-kpi \{[^}]*min-width: 0;/);
  for (const [fichier, bornes] of [['src/socle/coquille/coquille.css', /width:\s*(\d{4,})px/g], ['src/socle/ui/briques.css', /(?<!min-|max-)width:\s*(\d{4,})px/g]] as const) {
    const larges = [...sansCommentaires(lireSrc(fichier)).matchAll(bornes)].map((m) => m[1]);
    assert.deepEqual(larges, [], `${fichier} : une largeur fixe de plus de 999 px`);
  }
});

await dit('un seul bouton plein par écran : la coquille n’en pose aucun, la palette non plus', () => {
  for (const f of fichiersSous('src/socle/coquille').filter((x) => /\.tsx$/.test(x))) assert.doesNotMatch(lireSrc(f), /variante=["']primaire["']/, `${f} pose un bouton plein`);
});

await dit('Ajmani n’a ni tête, ni avatar, ni mascotte : aucun dessin dans la coquille, aucune image', () => {
  for (const f of [...fichiersSous('src/socle/coquille'), ...fichiersSous('src/refonte/coquille')].filter((x) => /\.tsx?$/.test(x))) {
    const src = lireSrc(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(src, /<img\b|<canvas\b|TeteTele|AjmaniPetit|Mascotte|Robot|<Avatar[^>]*ajmani/i, `${f}`);
  }
  assert.doesNotMatch(lireSrc('src/socle/coquille/BarreAjmani.tsx').replace(/\/\*[\s\S]*?\*\//g, ''), /lucide-react|<svg/);
});

await dit('la palette ⌘J : combobox + listbox, flèches, Entrée, Échap ; le calque est fixe à z-index 50', () => {
  const src = lireSrc('src/socle/coquille/PaletteAjmani.tsx');
  assert.match(src, /role="combobox"/);
  assert.match(src, /aria-activedescendant/);
  assert.match(src, /role="listbox"/);
  assert.match(src, /role="option"/);
  assert.match(src, /ArrowDown/);
  assert.match(src, /ArrowUp/);
  assert.match(src, /e\.key === 'Enter'/);
  assert.match(src, /useFermetureEchap\(ouverte, onFermer\)/);
  assert.match(sansCommentaires(lireSrc('src/socle/coquille/coquille.css')), /\.sc-voile \{[^}]*position: fixed;[^}]*z-index: 50;/);
  const glue = lireSrc('src/refonte/coquille/CoquilleRefonte.tsx');
  assert.match(glue, /addEventListener\('keydown', surTouche, true\)/, '⌘J se prend en phase de capture');
  assert.match(glue, /stopImmediatePropagation\(\)/);
});

await dit('éditions : rien de la coquille n’entre dans le paquet cliente ; son jumeau n’importe rien', () => {
  const jumeau = lireSrc('src/edition/coquille.business.tsx');
  const imports = [...jumeau.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  assert.deepEqual(imports.filter((i) => !/^react$/.test(i)), []);
  assert.ok(!/Ajmani/.test(jumeau.replace(/\/\*[\s\S]*?\*\//g, '')));
  const fautes: string[] = [];
  for (const f of fichiersSous('src').filter((x) => /\.(tsx?|css)$/.test(x))) {
    if (f.startsWith('src/socle/') || f.startsWith('src/refonte/') || /\.internal\.tsx?$/.test(f)) continue;
    const src = lireSrc(f);
    if (/(?:from|import)\s+['"][^'"]*(?:socle\/(?:coquille|noir|ui\/briques)|refonte\/coquille)/.test(src)) fautes.push(f);
  }
  assert.deepEqual(fautes, [], 'un fichier partagé importe la coquille sans passer par @edition/coquille');
  assert.match(lireSrc('src/components/AppLayout.tsx'), /from '@edition\/coquille'/);
  // Les Réglages (partagés) ne changent pas : la porte est `MouvementSection`, côté interne seulement.
  assert.doesNotMatch(lireSrc('src/screens/SettingsScreen.tsx'), /coquille/i, 'SettingsScreen (partagé) ne doit rien savoir de la coquille');
  assert.match(lireSrc('src/edition/socle.internal.tsx'), /<CoquilleSection \/>/);
});

await dit('le noir, les briques et la coquille ne se chargent qu’en édition interne (Ambiance.tsx), jamais depuis index.css', () => {
  const ambiance = lireSrc('src/refonte/accueil/Ambiance.tsx');
  for (const css of ['socle/noir.css', 'socle/ui/briques.css', 'socle/coquille/coquille.css']) assert.ok(ambiance.includes(css), `Ambiance.tsx ne charge pas ${css}`);
  assert.ok(!/noir\.css|briques\.css|coquille\.css|data-ambiance/.test(feuille), 'index.css (partagé) porte le noir');
});

const drapeau = await charger<{ lireCoquille: () => boolean; ecrireCoquille: (a: boolean) => void; CLE_COQUILLE: string }>('src/refonte/coquille/drapeau.ts');
await dit('le drapeau de la coquille : éteint par défaut, allumé sur ce poste seulement, un stockage refusé ne casse rien', () => {
  stockage.delete(drapeau.CLE_COQUILLE);
  assert.equal(drapeau.lireCoquille(), false, 'éteint par défaut');
  const avant = evenements;
  drapeau.ecrireCoquille(true);
  assert.equal(drapeau.lireCoquille(), true);
  assert.equal(stockage.get(drapeau.CLE_COQUILLE), 'noir');
  assert.equal(evenements, avant + 1, 'prévient les écouteurs');
  drapeau.ecrireCoquille(false);
  assert.equal(drapeau.lireCoquille(), false);
  assert.equal(stockage.has(drapeau.CLE_COQUILLE), false);
  stockage.set(drapeau.CLE_COQUILLE, 'autre chose');
  assert.equal(drapeau.lireCoquille(), false, 'une valeur inconnue = éteint');
  stockage.delete(drapeau.CLE_COQUILLE);
});

console.log('');
if (echecs > 0) {
  console.error(`ÉCHEC — ${echecs} propriété(s) du socle ne tiennent pas.`);
  process.exit(1);
}
console.log(`OK — ${vus} propriétés du socle tiennent.`);
// framer-motion garde une boucle d'images armée : on sort explicitement.
process.exit(0);
