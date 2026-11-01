#!/usr/bin/env node
/**
 * TESTS DU CONTRÔLE DE FIDÉLITÉ (scripts/qualite/fidelite/).
 *
 * Un contrôle de fidélité qui laisse passer un décalage de 3 px, ou qui en
 * accuse un de 1 px, est pire que pas de contrôle : on cesse de le croire.
 * Ces tests fixent donc ce que « ± 2 px » veut dire, sur des images fabriquées
 * ici (aucune maquette n'est commitée : le dépôt est public).
 *
 *   node tests/fidelite/comparer.test.mjs
 *
 * Sort 1 au premier groupe en défaut, après avoir tout lancé.
 */
import zlib from 'node:zlib';
import { decoderPng, encoderPng } from '../../scripts/qualite/fidelite/png.mjs';
import { comparerImages, verifierTextes } from '../../scripts/qualite/fidelite/comparer.mjs';

const W = 1440;
const H = 900;
const defauts = [];
let verifies = 0;
const egal = (reel, attendu, message) => {
  verifies += 1;
  if (!Object.is(reel, attendu)) defauts.push(`${message} : obtenu ${reel}, attendu ${attendu}`);
};
const groupe = (nom, corps) => {
  const avant = defauts.length;
  const v0 = verifies;
  try { corps(); } catch (e) { defauts.push(`${nom} : exception ${e?.stack ?? e}`); }
  console.log(`${defauts.length === avant ? '✓' : '✗'} ${nom} — ${verifies - v0} vérification(s)`);
};

/* ── Une image qui ressemble à un écran : fond, carte à filet faible, champ, bouton clair, « texte » ── */

const peindre = (rgb, x0, y0, l, h, [r, g, b]) => {
  for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + l; x += 1) { const i = (y * W + x) * 3; rgb[i] = r; rgb[i + 1] = g; rgb[i + 2] = b; }
};
const cadre = (rgb, x0, y0, l, h, c) => {
  peindre(rgb, x0, y0, l, 1, c); peindre(rgb, x0, y0 + h - 1, l, 1, c);
  peindre(rgb, x0, y0, 1, h, c); peindre(rgb, x0 + l - 1, y0, 1, h, c);
};
/** Des « lettres » : petits blocs 4×7 clairs, espacés de 6 px, dont l'arête est à demi teintée (crénelage). */
const texte = (rgb, x0, y0, n, clair = [237, 237, 237]) => {
  for (let k = 0; k < n; k += 1) {
    const x = x0 + k * 6;
    if ((k * 7919) % 5 === 0) continue; // des espaces
    peindre(rgb, x, y0, 4, 7, clair);
    peindre(rgb, x - 1, y0, 1, 7, [112, 112, 112]);
    peindre(rgb, x + 4, y0, 1, 7, [112, 112, 112]);
  }
};
function ecran() {
  const rgb = new Uint8Array(W * H * 3);
  peindre(rgb, 0, 0, W, H, [12, 12, 13]); // fond
  peindre(rgb, 0, 0, 252, H, [16, 16, 17]); // barre latérale
  peindre(rgb, 251, 0, 1, H, [34, 34, 36]);
  peindre(rgb, 292, 100, 788, 400, [22, 22, 23]); // carte
  cadre(rgb, 292, 100, 788, 400, [35, 35, 37]); // filet faible : contraste 23 seulement
  peindre(rgb, 320, 160, 300, 44, [19, 19, 20]); // champ #131314
  cadre(rgb, 320, 160, 300, 44, [42, 42, 45]);
  peindre(rgb, 320, 420, 140, 36, [237, 237, 237]); // bouton primaire
  texte(rgb, 330, 300, 40);
  texte(rgb, 330, 330, 52);
  texte(rgb, 20, 80, 24);
  return { largeur: W, hauteur: H, rgb };
}
const copie = (img) => ({ largeur: img.largeur, hauteur: img.hauteur, rgb: new Uint8Array(img.rgb) });
/** Tout décaler de dx, dy (les bords répètent le pixel voisin). */
function decaler(img, dx, dy) {
  const out = new Uint8Array(img.rgb.length);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const sx = Math.min(W - 1, Math.max(0, x - dx));
    const sy = Math.min(H - 1, Math.max(0, y - dy));
    const i = (y * W + x) * 3; const j = (sy * W + sx) * 3;
    out[i] = img.rgb[j]; out[i + 1] = img.rgb[j + 1]; out[i + 2] = img.rgb[j + 2];
  }
  return { largeur: W, hauteur: H, rgb: out };
}

const ref = ecran();

groupe('PNG : écriture puis lecture rendent les mêmes pixels', () => {
  const lu = decoderPng(encoderPng(W, H, ref.rgb));
  egal(lu.largeur, W, 'largeur');
  egal(lu.hauteur, H, 'hauteur');
  egal(Buffer.compare(Buffer.from(lu.rgb), Buffer.from(ref.rgb)), 0, 'pixels identiques');
});

groupe('PNG : les cinq filtres et l’alpha sont lus', () => {
  // On fabrique à la main un petit PNG RGBA 7×5 dont chaque ligne a son filtre (0 à 4), puis on relit.
  const w = 7; const h = 5; const o = 4;
  const pixels = new Uint8Array(w * h * o).map((_, i) => (i * 37 + (i >> 3) * 11) & 0xff);
  const lignes = [];
  for (let y = 0; y < h; y += 1) {
    const filtre = y % 5;
    const ligne = Buffer.alloc(1 + w * o);
    ligne[0] = filtre;
    for (let i = 0; i < w * o; i += 1) {
      const x = pixels[y * w * o + i];
      const a = i >= o ? pixels[y * w * o + i - o] : 0;
      const b = y > 0 ? pixels[(y - 1) * w * o + i] : 0;
      const c = i >= o && y > 0 ? pixels[(y - 1) * w * o + i - o] : 0;
      let pred = 0;
      if (filtre === 1) pred = a; else if (filtre === 2) pred = b; else if (filtre === 3) pred = (a + b) >> 1;
      else if (filtre === 4) { const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c); pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      ligne[1 + i] = (x - pred) & 0xff;
    }
    lignes.push(ligne);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const morceau = (type, corps) => { const t = Buffer.alloc(8); t.writeUInt32BE(corps.length, 0); t.write(type, 4, 'latin1'); return Buffer.concat([t, corps, Buffer.alloc(4)]); }; // le CRC n'est pas vérifié par le lecteur
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), morceau('IHDR', ihdr), morceau('IDAT', zlib.deflateSync(Buffer.concat(lignes))), morceau('IEND', Buffer.alloc(0))]);
  const lu = decoderPng(png);
  let bon = true;
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) for (let c = 0; c < 3; c += 1) if (lu.rgb[(y * w + x) * 3 + c] !== pixels[(y * w + x) * o + c]) bon = false;
  egal(bon, true, 'pixels RGB retrouvés après les filtres 0 à 4');
  let refus = '';
  try { decoderPng(Buffer.from('pas un png')); } catch (e) { refus = e.message; }
  egal(refus.includes('PNG'), true, 'un fichier qui n’est pas un PNG est refusé avec un message');
});

groupe('identique : ok', () => {
  const r = comparerImages(ref, copie(ref));
  egal(r.verdict, 'ok', 'verdict');
  egal(r.pixelsEcart, 0, 'aucun pixel en écart');
});

groupe('décalage jusqu’à 2 px (tout l’écran) : ok', () => {
  for (const [dx, dy] of [[1, 0], [0, 1], [2, 0], [0, 2], [2, 2], [-2, 1], [-1, -2]]) {
    egal(comparerImages(ref, decaler(ref, dx, dy)).verdict, 'ok', `décalé de ${dx},${dy}`);
  }
});

groupe('décalage de 3 px et plus : à corriger, avec le décalage retrouvé', () => {
  for (const [dx, dy] of [[3, 0], [0, 3], [-3, 0], [4, 2], [5, 5]]) {
    const r = comparerImages(ref, decaler(ref, dx, dy));
    egal(r.verdict, 'a corriger', `décalé de ${dx},${dy}`);
  }
  const r = comparerImages(ref, decaler(ref, 3, 0));
  const dec = r._zones.map((z) => z.decalage).filter(Boolean);
  egal(dec.length > 0, true, 'au moins une zone annonce un décalage');
  egal(dec.every((d) => d.dx === -3 && d.dy === 0), true, 'le décalage annoncé est (−3, 0) : la maquette est 3 px à gauche de la capture');
});

groupe('un filet faible (contraste 23) qui bouge : vu à 3 px, pas à 2 px', () => {
  const cap2 = copie(ref); const cap3 = copie(ref);
  for (const [cap, d] of [[cap2, 2], [cap3, 3]]) {
    peindre(cap.rgb, 292, 100, 788, 1, [22, 22, 23]); // on efface le filet du haut…
    peindre(cap.rgb, 292, 100 + d, 788, 1, [35, 35, 37]); // …et on le pose d px plus bas
  }
  egal(comparerImages(ref, cap2).verdict, 'ok', 'filet décalé de 2 px');
  egal(comparerImages(ref, cap3).verdict, 'a corriger', 'filet décalé de 3 px');
});

groupe('un demi-pixel de crénelage (valeurs intermédiaires) : ok', () => {
  // Chaque colonne devient la moyenne d'elle-même et de sa voisine : ce que donne un texte posé à 0,5 px.
  const cap = copie(ref);
  for (let y = 0; y < H; y += 1) for (let x = 1; x < W; x += 1) for (let c = 0; c < 3; c += 1) cap.rgb[(y * W + x) * 3 + c] = Math.round((ref.rgb[(y * W + x) * 3 + c] + ref.rgb[(y * W + x - 1) * 3 + c]) / 2);
  egal(comparerImages(ref, cap).verdict, 'ok', 'moyenne de deux colonnes voisines');
});

groupe('couleur : un aplat d’une autre teinte se voit dès 3 niveaux', () => {
  for (const [d, attendu] of [[1, 'ok'], [2, 'ok'], [3, 'a corriger'], [8, 'a corriger']]) {
    const cap = copie(ref);
    // Les pixels de la carte (et seulement eux : le texte et le champ restent) prennent d niveaux de plus.
    for (let y = 101; y < 499; y += 1) for (let x = 293; x < 1079; x += 1) { const i = (y * W + x) * 3; if (cap.rgb[i] === 22 && cap.rgb[i + 1] === 22 && cap.rgb[i + 2] === 23) { cap.rgb[i] += d; cap.rgb[i + 1] += d; cap.rgb[i + 2] += d; } }
    egal(comparerImages(ref, cap).verdict, attendu, `carte plus claire de ${d} niveau(x)`);
  }
});

groupe('un élément absent ou en trop : à corriger, avec sa nature et sa place', () => {
  const sansBouton = copie(ref);
  peindre(sansBouton.rgb, 320, 420, 140, 36, [22, 22, 23]);
  const r = comparerImages(ref, sansBouton);
  egal(r.verdict, 'a corriger', 'bouton absent');
  egal(r.zones.length, 1, 'une seule zone');
  egal(r.zones[0].nature, 'absent de la capture', 'nature : absent');
  const z = r.zones[0];
  egal(z.x <= 320 && z.y <= 420 && z.x + z.w >= 460 && z.y + z.h >= 456, true, 'la zone couvre le bouton');
  egal(z.place, 'zone principale', 'place dans la coquille');
  egal(z.relatif.x, 320 - 252, 'x relatif à la zone principale');
  egal(z.relatif.y, 420 - 60, 'y relatif à la zone principale');

  const avecEnPlus = copie(ref);
  peindre(avecEnPlus.rgb, 700, 420, 140, 36, [237, 237, 237]);
  const s = comparerImages(ref, avecEnPlus);
  egal(s.zones.length, 1, 'élément en trop : une zone');
  egal(s.zones[0].nature, 'en trop dans la capture', 'nature : en trop');
});

groupe('--ignorer : une zone écartée ne compte plus', () => {
  const cap = copie(ref);
  peindre(cap.rgb, 320, 420, 140, 36, [22, 22, 23]);
  egal(comparerImages(ref, cap).verdict, 'a corriger', 'sans zone écartée');
  egal(comparerImages(ref, cap, { ignorer: [[310, 410, 170, 56]] }).verdict, 'ok', 'avec la zone écartée');
});

groupe('tailles différentes : erreur claire', () => {
  const petite = { largeur: 100, hauteur: 100, rgb: new Uint8Array(100 * 100 * 3) };
  const r = comparerImages(ref, petite);
  egal(typeof r.erreur, 'string', 'une erreur est rendue');
  egal(r.erreur.includes('1440'), true, 'elle rappelle la taille attendue');
});

groupe('textes de la maquette : retrouvés ou absents', () => {
  const donnees = { text: 'A | AMN Business | Se connecter | Afficher | 101 | modules | x' };
  const t = verifierTextes(donnees, 'AMN Business  Se connecter\n101 modules');
  egal(t.total, 5, 'fragments de deux lettres ou plus (« A » et « x » écartés)');
  egal(t.trouves, 4, 'retrouvés (espaces insécables et retours à la ligne normalisés)');
  egal(t.absents.join(), 'Afficher', 'le seul absent');
});

console.log(`\n${verifies} vérification(s) — ${defauts.length} défaut(s).`);
for (const d of defauts) console.log(`  ✗ ${d}`);
process.exit(defauts.length ? 1 : 0);
