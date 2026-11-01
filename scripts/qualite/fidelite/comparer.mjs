#!/usr/bin/env node
/**
 * CONTRÔLE DE FIDÉLITÉ — une capture contre l'image de référence de la maquette.
 *
 * La règle des fiches : un écran est fini quand il est identique à son image
 * « à ± 2 px ». Ce script en fait une mesure répétable, la même pour tous les
 * lots.
 *
 * ## Ce que « ± 2 px » veut dire ici
 *
 * Un pixel de la capture est ACCEPTÉ s'il existe, à 2 px ou moins de la même
 * place (en x et en y, soit un carré de 5 × 5), un pixel de la référence de la
 * même couleur. Et réciproquement pour les pixels de la référence. Un bord, un
 * texte, une icône décalés de 2 px au plus passent ; décalés de 3, ils ne
 * passent pas. Un élément absent ou en trop ne passe jamais.
 *
 * « La même couleur » n'a pas le même sens partout. Sur un aplat (un fond, une
 * carte) : à 2 niveaux sur 255 près, car les surfaces du socle ne diffèrent que de
 * 2 à 10 niveaux et une mauvaise teinte doit se voir. Sur un bord vif (une lettre) :
 * à 40 % du contraste local près, parce que le crénelage d'un texte posé à un
 * demi-pixel d'écart change de plusieurs dizaines de niveaux ; un filet faible
 * (contraste 23) garde donc une tolérance étroite et reste vu quand il bouge de 3 px.
 *
 * On ne compare pas pixel à pixel : deux rendus du même dessin diffèrent par
 * le crénelage des lettres, et un contrôle qui crie à chaque lettre finit
 * ignoré.
 *
 * ## Le verdict
 *
 * L'image est découpée en carrés de 48 px. Un carré est « en écart » quand plus
 * de 2 % de ses pixels ne sont pas acceptés. Aucun carré en écart : OK. Sinon
 * : À CORRIGER, avec les zones (carrés voisins regroupés), leur place dans la
 * coquille, leur nature (absent, en trop, différent) et, quand il y en a un,
 * le décalage probable.
 *
 * Les données d'exemple des maquettes (noms, montants, dates) sont fictives :
 * ce qu'elles font différer est à écarter avec `--ignorer`, ou à noter dans
 * STATUT.md comme écart justifié. Ce script ne devine pas.
 *
 *   node scripts/qualite/fidelite/comparer.mjs <capture.png> <reference.png> [options]
 *   node scripts/qualite/fidelite/comparer.mjs <capture.png> --id H41 --images <dossier-images>
 *
 * Options :
 *   --id <ID>             écran (déduit du nom de la référence sinon)
 *   --images <dossier>    dossier des images de référence : prend <ID>-*.png ou <ID>.png
 *   --sortie <dossier>    où écrire l'image des écarts (défaut : à côté de la capture)
 *   --rayon <px>          tolérance de position (défaut 2)
 *   --couleur <0-255>     tolérance de couleur sur un aplat, par canal (défaut 2)
 *   --contour <0-1>       tolérance sur un bord vif, en part du contraste local (défaut 0.4)
 *   --bloc <px>           taille des carrés (défaut 48) ; --taux <0-1> seuil par carré (défaut 0.02)
 *   --ignorer x,y,l,h     zone à écarter, en pixels absolus ; répétable
 *   --gabarit bureau|aucun  nomme les zones d'après la coquille (défaut bureau ; aucun pour
 *                         la connexion, le mobile, la tablette)
 *   --zones <n>           nombre de zones listées (défaut 8)
 *   --textes <_data.json> --texte-capture <capture.txt>   vérifie les textes de la maquette (indicatif)
 *   --json                sortie lisible par machine
 *
 * Sorties : 0 = ok, 1 = à corriger, 2 = erreur d'usage ou de fichier.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decoderPng, encoderPng } from './png.mjs';

/* ── La mesure ───────────────────────────────────────────────────────────── */

const proche = (a, i, b, j, t) =>
  Math.abs(a[i] - b[j]) <= t && Math.abs(a[i + 1] - b[j + 1]) <= t && Math.abs(a[i + 2] - b[j + 2]) <= t;

/**
 * Pour chaque pixel et chaque canal, le plus petit et le plus grand de ses 9 voisins (3 × 3).
 * Un texte posé à une fraction de pixel près produit des valeurs INTERMÉDIAIRES entre celles de ses
 * voisins : c'est ce que ces fourchettes permettent d'accepter, sans quoi un écran juste décalé de
 * 0,5 px passerait pour faux.
 */
function fourchettes(rgb, w, h) {
  const mn = new Uint8Array(w * h * 3);
  const mx = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      for (let c = 0; c < 3; c += 1) {
        let lo = 255;
        let hi = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx += 1) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            const v = rgb[(yy * w + xx) * 3 + c];
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
        }
        mn[(y * w + x) * 3 + c] = lo;
        mx[(y * w + x) * 3 + c] = hi;
      }
    }
  }
  return { mn, mx };
}

/** Le pixel `i` de `a` est-il dans la fourchette (plus petit, plus grand) de ses voisins dans l'autre image, à `marge` près ? */
function dansLaFourchette(a, i, { mn, mx }, marge) {
  for (let c = 0; c < 3; c += 1) if (a[i + c] < mn[i + c] - marge || a[i + c] > mx[i + c] + marge) return false;
  return true;
}

/**
 * Marque, dans `a`, les pixels sans équivalent dans `b` à `rayon` px près.
 *
 * La tolérance de couleur n'est pas la même partout. Sur un aplat (un fond, une carte), elle est étroite
 * (`t`, 2 niveaux) : les surfaces du socle ne diffèrent que de 2 à 10 niveaux et une mauvaise teinte doit se voir.
 * Sur un bord vif (une lettre), le crénelage change de plusieurs dizaines de niveaux pour une demi-case de
 * décalage : la tolérance suit alors le contraste local (`proportion` de l'écart entre voisins). Un filet faible,
 * qui ne contraste que de 23, garde ainsi une tolérance d'environ 9 et reste vu quand il bouge de 3 px.
 */
function pixelsSansEquivalent(a, b, w, h, rayon, t, masque, bornesA, bornesB, proportion) {
  const e = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const p = y * w + x;
      if (masque && masque[p]) continue;
      const i = p * 3;
      if (proche(a, i, b, i, t)) continue;
      const contraste = Math.max(bornesA.mx[i] - bornesA.mn[i], bornesA.mx[i + 1] - bornesA.mn[i + 1], bornesA.mx[i + 2] - bornesA.mn[i + 2]);
      const tol = Math.max(t, Math.round(proportion * contraste));
      if (dansLaFourchette(a, i, bornesB, tol)) continue;
      let trouve = false;
      for (let dy = -rayon; dy <= rayon && !trouve; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -rayon; dx <= rayon; dx += 1) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          if (proche(a, i, b, (yy * w + xx) * 3, tol)) {
            trouve = true;
            break;
          }
        }
      }
      if (!trouve) e[p] = 1;
    }
  }
  return e;
}

/** Décalage (dx, dy) qui ramène la capture sur la référence dans `zone`, ou `null`. */
function decalageProbable(ref, cap, w, h, zone, t) {
  // On ne regarde que les pixels qui ne sont pas le fond de la zone : le fond s'accorde avec tout.
  const compte = new Map();
  for (let y = zone.y; y < zone.y + zone.h; y += 1) {
    for (let x = zone.x; x < zone.x + zone.w; x += 1) {
      const i = (y * w + x) * 3;
      const k = (cap[i] << 16) | (cap[i + 1] << 8) | cap[i + 2];
      compte.set(k, (compte.get(k) ?? 0) + 1);
    }
  }
  let fond = 0;
  let max = -1;
  for (const [k, n] of compte) if (n > max) { max = n; fond = k; }
  const pts = [];
  for (let y = zone.y; y < zone.y + zone.h; y += 1) {
    for (let x = zone.x; x < zone.x + zone.w; x += 1) {
      const i = (y * w + x) * 3;
      if (((cap[i] << 16) | (cap[i + 1] << 8) | cap[i + 2]) !== fond) pts.push(x, y);
    }
  }
  const n = pts.length / 2;
  if (n < 30) return null;
  const pas = Math.max(1, Math.floor(n / 4000));
  const score = (dx, dy) => {
    let ok = 0;
    let tot = 0;
    for (let k = 0; k < pts.length; k += 2 * pas) {
      const x = pts[k] + dx;
      const y = pts[k + 1] + dy;
      tot += 1;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      if (proche(cap, (pts[k + 1] * w + pts[k]) * 3, ref, (y * w + x) * 3, t)) ok += 1;
    }
    return ok / tot;
  };
  const zero = score(0, 0);
  let meilleur = { dx: 0, dy: 0, s: zero };
  // Du plus proche au plus lointain : à score égal, le plus petit décalage gagne.
  const candidats = [];
  for (let dy = -12; dy <= 12; dy += 1) for (let dx = -12; dx <= 12; dx += 1) candidats.push([dx, dy]);
  candidats.sort((u, v) => Math.abs(u[0]) + Math.abs(u[1]) - (Math.abs(v[0]) + Math.abs(v[1])));
  for (const [dx, dy] of candidats) {
    const s = score(dx, dy);
    if (s > meilleur.s) meilleur = { dx, dy, s };
  }
  // Le décalage est annoncé seulement s'il explique l'essentiel de la zone et améliore nettement l'accord.
  return meilleur.s >= 0.6 && meilleur.s - zero >= 0.25 && (meilleur.dx !== 0 || meilleur.dy !== 0) ? { dx: meilleur.dx, dy: meilleur.dy } : null;
}

/**
 * La nature d'une zone : ce que l'une des deux images a de plus que l'autre.
 *
 * Les pixels « en trop » et « manquants » se compensent presque toujours (un bouton absent est un bloc clair de
 * moins dans la capture ET un bloc sombre de trop), on ne peut donc pas conclure de leur nombre. On mesure plutôt
 * l'ENCRE de chaque image dans la zone : les pixels qui diffèrent de la couleur qui entoure la zone (le fond, vu
 * dans un anneau de 4 px autour). Beaucoup plus d'encre dans la référence : l'élément manque à la capture.
 * Beaucoup plus dans la capture : il est en trop. Autant : il est là, mais différent. C'est une indication.
 */
function natureDeLaZone(ref, cap, w, h, z, t) {
  const compte = new Map();
  const x0 = Math.max(0, z.x - 4);
  const y0 = Math.max(0, z.y - 4);
  const x1 = Math.min(w - 1, z.x + z.w + 3);
  const y1 = Math.min(h - 1, z.y + z.h + 3);
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h) continue; // l'anneau seulement
      const i = (y * w + x) * 3;
      const k = (cap[i] << 16) | (cap[i + 1] << 8) | cap[i + 2];
      compte.set(k, (compte.get(k) ?? 0) + 1);
    }
  }
  if (compte.size === 0) return 'différent';
  let fond = 0;
  let max = -1;
  for (const [k, n] of compte) if (n > max) { max = n; fond = k; }
  const [fr, fg, fb] = [(fond >> 16) & 255, (fond >> 8) & 255, fond & 255];
  const encre = (img) => {
    let n = 0;
    for (let y = z.y; y < z.y + z.h; y += 1) for (let x = z.x; x < z.x + z.w; x += 1) {
      const i = (y * w + x) * 3;
      if (Math.abs(img[i] - fr) > t || Math.abs(img[i + 1] - fg) > t || Math.abs(img[i + 2] - fb) > t) n += 1;
    }
    return n;
  };
  const eRef = encre(ref);
  const eCap = encre(cap);
  const marge = 0.02 * z.w * z.h; // un peu d'encre ne fait pas un élément
  if (eRef > 1.5 * eCap + marge) return 'absent de la capture';
  if (eCap > 1.5 * eRef + marge) return 'en trop dans la capture';
  return 'différent';
}

const COQUILLE = { barre: 252, entete: 60, colonneDroite: 1060, barreAjmani: 900 - 20 - 46 };

/** Où tombe une zone dans la coquille du bureau (gabarit de 01-SOCLE-DESIGN.md §3). */
function placeDansLaCoquille(z) {
  const cx = z.x + z.w / 2;
  const cy = z.y + z.h / 2;
  if (cx < COQUILLE.barre) return 'barre latérale';
  if (cy < COQUILLE.entete) return 'en-tête';
  if (cy >= COQUILLE.barreAjmani) return 'barre Ajmani';
  if (cx >= COQUILLE.colonneDroite) return 'colonne droite';
  return 'zone principale';
}

/**
 * Compare `cap` à `ref` (deux `{ largeur, hauteur, rgb }`). Rend le résultat chiffré, sans I/O.
 * Les images doivent avoir la même taille.
 */
export function comparerImages(ref, cap, options = {}) {
  const { rayon = 2, couleur = 2, bloc = 48, taux = 0.02, contour = 0.4, ignorer = [], gabarit = 'bureau', zones: nbZones = 8 } = options;
  if (ref.largeur !== cap.largeur || ref.hauteur !== cap.hauteur) {
    return { erreur: `tailles différentes : référence ${ref.largeur}×${ref.hauteur}, capture ${cap.largeur}×${cap.hauteur}. Capturez à 1440 × 900.` };
  }
  const w = ref.largeur;
  const h = ref.hauteur;
  let masque = null;
  if (ignorer.length) {
    masque = new Uint8Array(w * h);
    for (const [x0, y0, l, hh] of ignorer) {
      for (let y = Math.max(0, y0); y < Math.min(h, y0 + hh); y += 1) for (let x = Math.max(0, x0); x < Math.min(w, x0 + l); x += 1) masque[y * w + x] = 1;
    }
  }
  const bornesRef = fourchettes(ref.rgb, w, h);
  const bornesCap = fourchettes(cap.rgb, w, h);
  const enTrop = pixelsSansEquivalent(cap.rgb, ref.rgb, w, h, rayon, couleur, masque, bornesCap, bornesRef, contour); // dans la capture, absent de la référence
  const manquant = pixelsSansEquivalent(ref.rgb, cap.rgb, w, h, rayon, couleur, masque, bornesRef, bornesCap, contour); // dans la référence, absent de la capture

  let pixelsEcart = 0;
  for (let p = 0; p < w * h; p += 1) if (enTrop[p] || manquant[p]) pixelsEcart += 1;

  // Carrés en écart.
  const bw = Math.ceil(w / bloc);
  const bh = Math.ceil(h / bloc);
  const mauvais = new Uint8Array(bw * bh);
  for (let by = 0; by < bh; by += 1) {
    for (let bx = 0; bx < bw; bx += 1) {
      let n = 0;
      let total = 0;
      for (let y = by * bloc; y < Math.min(h, (by + 1) * bloc); y += 1) {
        for (let x = bx * bloc; x < Math.min(w, (bx + 1) * bloc); x += 1) {
          const p = y * w + x;
          if (masque && masque[p]) continue;
          total += 1;
          if (enTrop[p] || manquant[p]) n += 1;
        }
      }
      if (total > 0 && n / total > taux) mauvais[by * bw + bx] = 1;
    }
  }

  // Zones : carrés en écart voisins (4 voisins), puis cadre resserré sur les pixels en écart.
  const vu = new Uint8Array(bw * bh);
  const zones = [];
  for (let s = 0; s < bw * bh; s += 1) {
    if (!mauvais[s] || vu[s]) continue;
    const pile = [s];
    vu[s] = 1;
    const carres = [];
    while (pile.length) {
      const c = pile.pop();
      carres.push(c);
      const cx = c % bw;
      const cy = (c - cx) / bw;
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
        const k = ny * bw + nx;
        if (mauvais[k] && !vu[k]) {
          vu[k] = 1;
          pile.push(k);
        }
      }
    }
    let x0 = w, y0 = h, x1 = -1, y1 = -1, seulCap = 0, seulRef = 0, union = 0;
    for (const c of carres) {
      const cx = c % bw;
      const cy = (c - cx) / bw;
      for (let y = cy * bloc; y < Math.min(h, (cy + 1) * bloc); y += 1) {
        for (let x = cx * bloc; x < Math.min(w, (cx + 1) * bloc); x += 1) {
          const p = y * w + x;
          if (!enTrop[p] && !manquant[p]) continue;
          union += 1;
          if (enTrop[p]) seulCap += 1;
          if (manquant[p]) seulRef += 1;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    const z = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, pixels: union, enTrop: seulCap, manquant: seulRef };
    z.part = z.pixels / (z.w * z.h);
    z.nature = natureDeLaZone(ref.rgb, cap.rgb, w, h, z, couleur);
    if (gabarit === 'bureau') {
      // Une zone qui couvre l'essentiel de l'écran n'a pas de « place » : c'est tout l'écran qui diffère.
      z.place = z.w * z.h > 0.6 * w * h ? 'presque tout l’écran' : placeDansLaCoquille(z);
      // Les coordonnées des fiches (_data) partent de la zone principale : x 0 à 252 px absolus, y 0 à 60.
      if (z.x >= COQUILLE.barre && z.y >= COQUILLE.entete) z.relatif = { x: z.x - COQUILLE.barre, y: z.y - COQUILLE.entete };
    }
    zones.push(z);
  }
  zones.sort((a, b) => b.pixels - a.pixels);
  // Le décalage n'a de sens que pour un élément présent des deux côtés.
  for (const z of zones.slice(0, nbZones)) if (z.nature === 'différent') z.decalage = decalageProbable(ref.rgb, cap.rgb, w, h, z, couleur);
  return {
    largeur: w,
    hauteur: h,
    rayon,
    couleur,
    contour,
    pixelsEcart,
    tauxEcart: pixelsEcart / (w * h),
    carresEnEcart: mauvais.reduce((s, v) => s + v, 0),
    zones,
    verdict: zones.length === 0 ? 'ok' : 'a corriger',
    _enTrop: enTrop,
    _manquant: manquant,
    _zones: zones.slice(0, nbZones),
  };
}

/** L'image des écarts : capture assombrie, en rouge ce qui est en trop, en bleu ce qui manque, cadres sur les zones. */
export function imageDesEcarts(cap, res) {
  const { largeur: w, hauteur: h } = cap;
  const out = new Uint8Array(w * h * 3);
  for (let p = 0; p < w * h; p += 1) {
    const i = p * 3;
    const g = Math.round((cap.rgb[i] + cap.rgb[i + 1] + cap.rgb[i + 2]) / 3 / 3);
    out[i] = out[i + 1] = out[i + 2] = g;
    if (res._enTrop[p]) { out[i] = 255; out[i + 1] = 60; out[i + 2] = 60; }
    if (res._manquant[p]) { out[i] = 60; out[i + 1] = 160; out[i + 2] = 255; }
  }
  for (const z of res._zones) {
    for (let t = 0; t < 2; t += 1) {
      for (let x = z.x - 2; x <= z.x + z.w + 1; x += 1) for (const y of [z.y - 2 + t, z.y + z.h + 1 - t]) if (x >= 0 && y >= 0 && x < w && y < h) { const i = (y * w + x) * 3; out[i] = 255; out[i + 1] = 220; out[i + 2] = 0; }
      for (let y = z.y - 2; y <= z.y + z.h + 1; y += 1) for (const x of [z.x - 2 + t, z.x + z.w + 1 - t]) if (x >= 0 && y >= 0 && x < w && y < h) { const i = (y * w + x) * 3; out[i] = 255; out[i + 1] = 220; out[i + 2] = 0; }
    }
  }
  return encoderPng(w, h, out);
}

/* ── Les textes de la maquette (indicatif) ───────────────────────────────── */

const normaliser = (s) => s.replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Les fragments de `_data/<ID>.json` (champ `text`, séparés par « | ») retrouvés dans le texte de la page. */
export function verifierTextes(donnees, texteCapture) {
  const page = normaliser(texteCapture);
  const fragments = [...new Set(String(donnees.text ?? '').split(' | ').map(normaliser).filter((f) => f.length >= 2))];
  const absents = fragments.filter((f) => !page.includes(f));
  return { total: fragments.length, trouves: fragments.length - absents.length, absents };
}

/* ── La ligne de commande ────────────────────────────────────────────────── */

const pourcent = (x) => `${(x * 100).toFixed(x < 0.1 ? 2 : 1).replace('.', ',')} %`;

function lireOptions(argv) {
  const o = { positionnels: [], ignorer: [] };
  const valeur = (i, nom) => {
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error(`--${nom} demande une valeur`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) { o.positionnels.push(a); continue; }
    const nom = a.slice(2);
    if (nom === 'json') o.json = true;
    else if (['id', 'images', 'sortie', 'gabarit', 'textes', 'texte-capture'].includes(nom)) { o[nom] = valeur(i, nom); i += 1; }
    else if (['rayon', 'couleur', 'contour', 'bloc', 'taux', 'zones'].includes(nom)) { o[nom] = Number(valeur(i, nom)); i += 1; }
    else if (nom === 'ignorer') {
      const r = valeur(i, nom).split(',').map(Number);
      if (r.length !== 4 || r.some((n) => !Number.isFinite(n))) throw new Error('--ignorer attend x,y,largeur,hauteur');
      o.ignorer.push(r);
      i += 1;
    } else throw new Error(`option inconnue : --${nom}`);
  }
  return o;
}

function trouverReference(o) {
  if (o.positionnels.length >= 2) return { fichier: o.positionnels[1], id: o.id ?? path.basename(o.positionnels[1]).replace(/\.png$/i, '').split('-')[0] };
  if (o.id && o.images) {
    const candidats = fs.readdirSync(o.images).filter((f) => f.endsWith('.png') && (f === `${o.id}.png` || f.startsWith(`${o.id}-`)));
    if (candidats.length === 1) return { fichier: path.join(o.images, candidats[0]), id: o.id };
    throw new Error(candidats.length === 0 ? `aucune image « ${o.id} » dans ${o.images}` : `plusieurs images pour « ${o.id} » : ${candidats.join(', ')}`);
  }
  throw new Error('il faut la référence : un second fichier, ou --id <ID> --images <dossier>');
}

function principal() {
  let o;
  try {
    o = lireOptions(process.argv.slice(2));
    if (o.positionnels.length < 1) throw new Error('usage : comparer.mjs <capture.png> <reference.png> [options]  (voir l’en-tête du fichier)');
    const { fichier: fichierRef, id } = trouverReference(o);
    const fichierCap = o.positionnels[0];
    const ref = decoderPng(fs.readFileSync(fichierRef));
    const cap = decoderPng(fs.readFileSync(fichierCap));
    const res = comparerImages(ref, cap, { rayon: o.rayon, couleur: o.couleur, contour: o.contour, bloc: o.bloc, taux: o.taux, ignorer: o.ignorer, gabarit: o.gabarit ?? 'bureau', zones: o.zones });
    if (res.erreur) throw new Error(res.erreur);

    let ecarts = null;
    if (res.verdict !== 'ok') {
      const dossier = o.sortie ?? path.dirname(path.resolve(fichierCap));
      fs.mkdirSync(dossier, { recursive: true });
      ecarts = path.join(dossier, `${id}-ecarts.png`);
      fs.writeFileSync(ecarts, imageDesEcarts(cap, res));
    }
    let textes = null;
    if (o.textes) {
      const donnees = JSON.parse(fs.readFileSync(o.textes, 'utf8'));
      const fichierTexte = o['texte-capture'] ?? fichierCap.replace(/\.png$/i, '.txt');
      if (!fs.existsSync(fichierTexte)) throw new Error(`texte de la capture introuvable : ${fichierTexte} (capturer.mjs l’écrit à côté du PNG)`);
      textes = verifierTextes(donnees, fs.readFileSync(fichierTexte, 'utf8'));
    }

    const zones = res._zones;
    if (o.json) {
      console.log(JSON.stringify({ ecran: id, verdict: res.verdict, taille: [res.largeur, res.hauteur], rayon: res.rayon, couleur: res.couleur, contour: res.contour, pixelsEnEcart: res.pixelsEcart, tauxEcart: res.tauxEcart, zonesTotal: res.zones.length, zones: zones.map(({ x, y, w, h, pixels, part, nature, place, relatif, decalage }) => ({ x, y, l: w, h, pixels, part, nature, place, relatif, decalage })), ignores: o.ignorer, imageEcarts: ecarts, textes }, null, 2));
    } else {
      const sortie = [];
      sortie.push(`${id} · ${res.largeur}×${res.hauteur} · ±${res.rayon} px, couleur ±${res.couleur}`);
      sortie.push(res.verdict === 'ok'
        ? `OK — ${pourcent(res.tauxEcart)} des pixels hors tolérance, aucune zone en écart`
        : `À CORRIGER — ${pourcent(res.tauxEcart)} des pixels en écart (${res.pixelsEcart.toLocaleString('fr-FR')} px), ${res.zones.length} zone${res.zones.length > 1 ? 's' : ''}`);
      zones.forEach((z, k) => {
        const lieu = z.place ? ` · ${z.place}${z.relatif ? ` (dans la zone principale : x ${z.relatif.x}, y ${z.relatif.y})` : ''}` : '';
        const dec = z.decalage ? ` · la maquette le place à ${z.decalage.dx >= 0 ? '+' : ''}${z.decalage.dx} px en x et ${z.decalage.dy >= 0 ? '+' : ''}${z.decalage.dy} px en y de la capture : déplacez-le de ces valeurs` : '';
        sortie.push(` ${k + 1}. x ${z.x}–${z.x + z.w - 1}, y ${z.y}–${z.y + z.h - 1} (${z.w}×${z.h})${lieu} · ${pourcent(z.part)} · ${z.nature}${dec}`);
      });
      if (res.zones.length > zones.length) sortie.push(` … et ${res.zones.length - zones.length} autre${res.zones.length - zones.length > 1 ? 's' : ''} (--zones ${res.zones.length})`);
      if (o.ignorer.length) sortie.push(`Zones écartées : ${o.ignorer.map((r) => r.join(',')).join(' ; ')}`);
      if (textes) {
        sortie.push(`Textes de la maquette : ${textes.trouves} sur ${textes.total} retrouvés${textes.absents.length ? ` — absents : ${textes.absents.slice(0, 6).map((t) => `« ${t.length > 40 ? `${t.slice(0, 40)}…` : t} »`).join(', ')}${textes.absents.length > 6 ? `, … (${textes.absents.length - 6} de plus)` : ''}` : ''}`);
        if (textes.absents.length) sortie.push('  (les noms, montants et dates d’exemple sont fictifs : leur absence est normale ; un libellé de l’interface absent ne l’est pas)');
      }
      if (ecarts) sortie.push(`Image des écarts (rouge : en trop, bleu : manquant, jaune : zones) : ${ecarts}`);
      console.log(sortie.join('\n'));
    }
    process.exit(res.verdict === 'ok' ? 0 : 1);
  } catch (e) {
    console.error(`Erreur : ${e.message}`);
    process.exit(2);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) principal();
