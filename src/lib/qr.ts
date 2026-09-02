/**
 * UN ENCODEUR QR — mode octets, versions 1 à 10, niveaux L et M.
 *
 * Pourquoi l'écrire ici : l'application tourne hors ligne et n'embarque
 * aucune bibliothèque de codes-barres ; un QR pour une adresse de rendez-vous
 * ou une mini-page tient en quelques centaines d'octets, donc dans la version
 * 10 (271 octets en L). Ce qui est implémenté : ISO/IEC 18004, mode 8 bits,
 * Reed-Solomon sur GF(256), les huit masques et leur pénalité, l'information
 * de format et, dès la version 7, l'information de version. Rien de plus —
 * pas de mode alphanumérique ni de kanji, pas de version 11+.
 *
 * La sortie est une matrice booléenne carrée (`true` = module sombre), que
 * l'écran dessine en SVG net et exporte en PNG. `scripts/sondes/qr.py`
 * compare ces matrices, bit à bit, à celles de la bibliothèque Python
 * `qrcode` pour les mêmes entrées, version, niveau et masque.
 */

export type NiveauQr = 'L' | 'M';

/** Par version (index 1..10) : [octets de correction par bloc, blocs G1, données G1, blocs G2, données G2]. */
const BLOCS: Record<NiveauQr, number[][]> = {
  L: [[], [7, 1, 19, 0, 0], [10, 1, 34, 0, 0], [15, 1, 55, 0, 0], [20, 1, 80, 0, 0], [26, 1, 108, 0, 0], [18, 2, 68, 0, 0], [20, 2, 78, 0, 0], [24, 2, 97, 0, 0], [30, 2, 116, 0, 0], [18, 2, 68, 2, 69]],
  M: [[], [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0], [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]],
};
const ALIGNEMENT: number[][] = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const VERSION_MAX = 10;

/* ── GF(256), polynôme primitif 0x11D ── */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function generateur(degre: number): number[] {
  let g = [1];
  for (let i = 0; i < degre; i += 1) {
    const suivant = new Array<number>(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j += 1) {
      suivant[j] ^= g[j];
      suivant[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = suivant;
  }
  return g;
}

function reedSolomon(donnees: number[], degre: number): number[] {
  const g = generateur(degre);
  const reste = new Array<number>(degre).fill(0);
  for (const d of donnees) {
    const facteur = d ^ reste[0];
    reste.shift();
    reste.push(0);
    if (facteur !== 0) for (let j = 0; j < degre; j += 1) reste[j] ^= mul(g[j + 1], facteur);
  }
  return reste;
}

/* ── Capacité et version ── */
function donneesTotales(version: number, niveau: NiveauQr): number {
  const [, b1, d1, b2, d2] = BLOCS[niveau][version];
  return b1 * d1 + b2 * d2;
}
export function capaciteOctets(version: number, niveau: NiveauQr): number {
  const compte = version >= 10 ? 16 : 8;
  return Math.floor((donneesTotales(version, niveau) * 8 - 4 - compte) / 8);
}
export function versionPour(octets: number, niveau: NiveauQr): number | null {
  for (let v = 1; v <= VERSION_MAX; v += 1) if (capaciteOctets(v, niveau) >= octets) return v;
  return null;
}

/* ── Flux de bits → mots de code (avec entrelacement) ── */
export function motsDeCode(octets: Uint8Array, version: number, niveau: NiveauQr): number[] {
  const bits: number[] = [];
  const pousser = (valeur: number, n: number) => { for (let i = n - 1; i >= 0; i -= 1) bits.push((valeur >> i) & 1); };
  pousser(0b0100, 4);
  pousser(octets.length, version >= 10 ? 16 : 8);
  for (const o of octets) pousser(o, 8);
  const total = donneesTotales(version, niveau) * 8;
  pousser(0, Math.min(4, total - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let k = 0; data.length < total / 8; k += 1) data.push(k % 2 === 0 ? 0xec : 0x11);

  const [ec, b1, d1, b2, d2] = BLOCS[niveau][version];
  const blocs: number[][] = [];
  const ecs: number[][] = [];
  let pos = 0;
  for (let i = 0; i < b1 + b2; i += 1) {
    const taille = i < b1 ? d1 : d2;
    const bloc = data.slice(pos, pos + taille);
    pos += taille;
    blocs.push(bloc);
    ecs.push(reedSolomon(bloc, ec));
  }
  const sortie: number[] = [];
  const maxData = Math.max(d1, d2);
  for (let i = 0; i < maxData; i += 1) for (const b of blocs) if (i < b.length) sortie.push(b[i]);
  for (let i = 0; i < ec; i += 1) for (const e of ecs) sortie.push(e[i]);
  return sortie;
}

/* ── La matrice ── */
type Matrice = boolean[][];
function creer(taille: number): { modules: Matrice; fonction: Matrice } {
  return {
    modules: Array.from({ length: taille }, () => new Array<boolean>(taille).fill(false)),
    fonction: Array.from({ length: taille }, () => new Array<boolean>(taille).fill(false)),
  };
}

function poser(m: { modules: Matrice; fonction: Matrice }, x: number, y: number, sombre: boolean) {
  m.modules[y][x] = sombre;
  m.fonction[y][x] = true;
}

function motifsFonction(m: { modules: Matrice; fonction: Matrice }, version: number) {
  const n = m.modules.length;
  const repere = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy += 1) for (let dx = -4; dx <= 4; dx += 1) {
      const x = cx + dx; const y = cy + dy;
      if (x < 0 || y < 0 || x >= n || y >= n) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      poser(m, x, y, d !== 2 && d !== 4);
    }
  };
  repere(3, 3); repere(n - 4, 3); repere(3, n - 4);
  for (let i = 8; i < n - 8; i += 1) { poser(m, i, 6, i % 2 === 0); poser(m, 6, i, i % 2 === 0); }
  const centres = ALIGNEMENT[version] ?? [];
  for (const cy of centres) for (const cx of centres) {
    if ((cx <= 8 && cy <= 8) || (cx >= n - 9 && cy <= 8) || (cx <= 8 && cy >= n - 9)) continue;
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) poser(m, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  poser(m, 8, n - 8, true);
  // Zones réservées : format (posé plus tard) et version (dès la 7).
  for (let i = 0; i < 9; i += 1) { if (i !== 6) { m.fonction[8][i] = true; m.fonction[i][8] = true; } }
  for (let i = 0; i < 8; i += 1) { m.fonction[8][n - 1 - i] = true; m.fonction[n - 1 - i][8] = true; }
  if (version >= 7) for (let i = 0; i < 6; i += 1) for (let j = 0; j < 3; j += 1) { m.fonction[i][n - 11 + j] = true; m.fonction[n - 11 + j][i] = true; }
}

function placerDonnees(m: { modules: Matrice; fonction: Matrice }, mots: number[]) {
  const n = m.modules.length;
  let bit = 0;
  const total = mots.length * 8;
  let montant = true;
  for (let droite = n - 1; droite >= 1; droite -= 2) {
    if (droite === 6) droite = 5;
    for (let k = 0; k < n; k += 1) {
      const y = montant ? n - 1 - k : k;
      for (const x of [droite, droite - 1]) {
        if (m.fonction[y][x]) continue;
        const valeur = bit < total ? (mots[bit >> 3] >> (7 - (bit & 7))) & 1 : 0;
        m.modules[y][x] = valeur === 1;
        bit += 1;
      }
    }
    montant = !montant;
  }
}

const MASQUES: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function appliquerMasque(modules: Matrice, fonction: Matrice, masque: number): Matrice {
  const f = MASQUES[masque];
  return modules.map((ligne, y) => ligne.map((v, x) => (fonction[y][x] ? v : v !== f(x, y))));
}

function bch(valeur: number, poly: number, bitsPoly: number, bitsTotal: number): number {
  // Division polynomiale classique : on aligne le générateur sur le bit de poids fort.
  let reste = valeur << (bitsPoly - 1);
  for (let i = bitsTotal - 1; i >= bitsPoly - 1; i -= 1) if ((reste >> i) & 1) reste ^= poly << (i - (bitsPoly - 1));
  return (valeur << (bitsPoly - 1)) | reste;
}

function ecrireFormat(modules: Matrice, niveau: NiveauQr, masque: number) {
  const n = modules.length;
  const bitsNiveau = niveau === 'L' ? 0b01 : 0b00;
  const format = bch((bitsNiveau << 3) | masque, 0b10100110111, 11, 15) ^ 0b101010000010010;
  const bit = (i: number) => ((format >> i) & 1) === 1;
  // Autour du repère haut-gauche.
  const coordsA: [number, number][] = [[0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8], [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0]];
  coordsA.forEach(([x, y], i) => { modules[y][x] = bit(14 - i); });
  // Copie : sous le repère haut-droit et à droite du repère bas-gauche.
  for (let i = 0; i < 8; i += 1) modules[8][n - 1 - i] = bit(i);
  for (let i = 8; i < 15; i += 1) modules[n - 15 + i][8] = bit(i);
}

function ecrireVersion(modules: Matrice, version: number) {
  if (version < 7) return;
  const n = modules.length;
  const info = bch(version, 0b1111100100101, 13, 18);
  for (let i = 0; i < 18; i += 1) {
    const b = ((info >> i) & 1) === 1;
    modules[Math.floor(i / 3)][n - 11 + (i % 3)] = b;
    modules[n - 11 + (i % 3)][Math.floor(i / 3)] = b;
  }
}

export function penalite(modules: Matrice): number {
  const n = modules.length;
  let score = 0;
  const serie = (lire: (i: number, j: number) => boolean) => {
    for (let i = 0; i < n; i += 1) {
      let run = 1;
      for (let j = 1; j < n; j += 1) {
        if (lire(i, j) === lire(i, j - 1)) { run += 1; if (j === n - 1 && run >= 5) score += run - 2; }
        else { if (run >= 5) score += run - 2; run = 1; }
      }
    }
  };
  serie((i, j) => modules[i][j]);
  serie((i, j) => modules[j][i]);
  for (let y = 0; y < n - 1; y += 1) for (let x = 0; x < n - 1; x += 1) {
    const v = modules[y][x];
    if (modules[y][x + 1] === v && modules[y + 1][x] === v && modules[y + 1][x + 1] === v) score += 3;
  }
  const motif = [true, false, true, true, true, false, true];
  const chercher = (lire: (i: number, j: number) => boolean) => {
    for (let i = 0; i < n; i += 1) for (let j = 0; j <= n - 7; j += 1) {
      let ok = true;
      for (let k = 0; k < 7 && ok; k += 1) if (lire(i, j + k) !== motif[k]) ok = false;
      if (!ok) continue;
      const clairAvant = j >= 4 && [1, 2, 3, 4].every((k) => !lire(i, j - k));
      const clairApres = j + 10 < n && [7, 8, 9, 10].every((k) => !lire(i, j + k));
      if (clairAvant || clairApres) score += 40;
    }
  };
  chercher((i, j) => modules[i][j]);
  chercher((i, j) => modules[j][i]);
  let sombres = 0;
  for (const ligne of modules) for (const v of ligne) if (v) sombres += 1;
  const pct = (sombres * 100) / (n * n);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

export interface CodeQr {
  version: number;
  niveau: NiveauQr;
  masque: number;
  taille: number;
  modules: Matrice;
}

/** Encode un texte (UTF-8). `null` si trop long pour la version 10. */
export function encoderQr(texte: string, options: { niveau?: NiveauQr; masque?: number } = {}): CodeQr | null {
  const niveau = options.niveau ?? 'M';
  const octets = new TextEncoder().encode(texte);
  const version = versionPour(octets.length, niveau);
  if (version === null) return null;
  const taille = 17 + version * 4;
  const m = creer(taille);
  motifsFonction(m, version);
  placerDonnees(m, motsDeCode(octets, version, niveau));
  const candidats = options.masque !== undefined ? [options.masque] : [0, 1, 2, 3, 4, 5, 6, 7];
  let meilleur: { masque: number; modules: Matrice; score: number } | null = null;
  for (const masque of candidats) {
    const modules = appliquerMasque(m.modules, m.fonction, masque);
    ecrireFormat(modules, niveau, masque);
    ecrireVersion(modules, version);
    const score = penalite(modules);
    if (!meilleur || score < meilleur.score) meilleur = { masque, modules, score };
  }
  if (!meilleur) return null;
  return { version, niveau, masque: meilleur.masque, taille, modules: meilleur.modules };
}

/** Le code en SVG (modules nets, marge de 4 modules — la « zone calme » de la norme). */
export function svgQr(code: CodeQr, options: { taillePx?: number; sombre?: string; clair?: string } = {}): string {
  const marge = 4;
  const total = code.taille + marge * 2;
  const px = options.taillePx ?? total * 8;
  const chemins: string[] = [];
  for (let y = 0; y < code.taille; y += 1) for (let x = 0; x < code.taille; x += 1) if (code.modules[y][x]) chemins.push(`M${x + marge} ${y + marge}h1v1h-1z`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="${options.clair ?? '#ffffff'}"/><path d="${chemins.join('')}" fill="${options.sombre ?? '#000000'}"/></svg>`;
}
