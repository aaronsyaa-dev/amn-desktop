/**
 * LIRE ET ÉCRIRE UN PNG SANS DÉPENDANCE.
 *
 * Le contrôle de fidélité compare des captures de Chromium aux images de
 * référence des maquettes. Les deux sont des PNG 8 bits, RGB ou RGBA, non
 * entrelacés : c'est tout ce que ce module sait lire, et il refuse le reste
 * avec un message qui dit quoi faire, plutôt que de comparer n'importe quoi.
 * Node suffit (zlib), le dépôt n'a pas de bibliothèque d'image et n'en reçoit
 * pas pour cela.
 *
 * Les images sont rendues en RGB à plat (3 octets par pixel). Un canal alpha
 * éventuel est ignoré : une capture d'écran est opaque.
 */
import zlib from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** CRC-32 d'un tampon (zlib.crc32 existe depuis Node 22.2 ; la table sert de repli). */
const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = TABLE_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Lit un PNG : `{ largeur, hauteur, rgb }` où `rgb` est un Uint8Array de largeur × hauteur × 3 octets. */
export function decoderPng(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('ce fichier n’est pas un PNG');
  let pos = 8;
  let entete = null;
  const donnees = [];
  while (pos + 8 <= buf.length) {
    const longueur = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const corps = buf.subarray(pos + 8, pos + 8 + longueur);
    if (type === 'IHDR') {
      entete = {
        largeur: corps.readUInt32BE(0),
        hauteur: corps.readUInt32BE(4),
        profondeur: corps[8],
        type: corps[9],
        entrelace: corps[12],
      };
    } else if (type === 'IDAT') donnees.push(corps);
    else if (type === 'IEND') break;
    pos += 12 + longueur;
  }
  if (!entete) throw new Error('PNG sans en-tête');
  const { largeur, hauteur, profondeur, type, entrelace } = entete;
  if (profondeur !== 8 || (type !== 2 && type !== 6) || entrelace !== 0) {
    throw new Error(
      `PNG non pris en charge (profondeur ${profondeur}, type ${type}, entrelacé ${entrelace}) : il faut du RGB ou RGBA 8 bits non entrelacé. Réexportez l’image.`,
    );
  }
  const octets = type === 6 ? 4 : 3;
  const brut = zlib.inflateSync(Buffer.concat(donnees));
  const ligne = largeur * octets;
  if (brut.length < (ligne + 1) * hauteur) throw new Error('PNG tronqué');
  const sortie = new Uint8Array(largeur * hauteur * 3);
  let precedente = new Uint8Array(ligne);
  let courante = new Uint8Array(ligne);
  for (let y = 0; y < hauteur; y += 1) {
    const base = y * (ligne + 1);
    const filtre = brut[base];
    for (let i = 0; i < ligne; i += 1) {
      const x = brut[base + 1 + i];
      const a = i >= octets ? courante[i - octets] : 0;
      const b = precedente[i];
      const c = i >= octets ? precedente[i - octets] : 0;
      let v;
      if (filtre === 0) v = x;
      else if (filtre === 1) v = x + a;
      else if (filtre === 2) v = x + b;
      else if (filtre === 3) v = x + ((a + b) >> 1);
      else if (filtre === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error(`filtre PNG inconnu : ${filtre}`);
      courante[i] = v & 0xff;
    }
    for (let px = 0; px < largeur; px += 1) {
      const o = (y * largeur + px) * 3;
      sortie[o] = courante[px * octets];
      sortie[o + 1] = courante[px * octets + 1];
      sortie[o + 2] = courante[px * octets + 2];
    }
    [precedente, courante] = [courante, precedente];
  }
  return { largeur, hauteur, rgb: sortie };
}

function morceau(type, corps) {
  const tete = Buffer.alloc(8);
  tete.writeUInt32BE(corps.length, 0);
  tete.write(type, 4, 'latin1');
  const fin = Buffer.alloc(4);
  fin.writeUInt32BE(crc32(Buffer.concat([tete.subarray(4), corps])), 0);
  return Buffer.concat([tete, corps, fin]);
}

/** Écrit un PNG RGB 8 bits à partir de `rgb` (largeur × hauteur × 3 octets). */
export function encoderPng(largeur, hauteur, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const ligne = largeur * 3;
  const brut = Buffer.alloc((ligne + 1) * hauteur);
  for (let y = 0; y < hauteur; y += 1) {
    brut[y * (ligne + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * ligne, ligne).copy(brut, y * (ligne + 1) + 1);
  }
  return Buffer.concat([SIGNATURE, morceau('IHDR', ihdr), morceau('IDAT', zlib.deflateSync(brut, { level: 6 })), morceau('IEND', Buffer.alloc(0))]);
}
