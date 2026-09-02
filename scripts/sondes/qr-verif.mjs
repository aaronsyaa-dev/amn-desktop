/* Compare l'encodeur maison à la référence Python, bit à bit, version et masque imposés. */
import { execFileSync } from 'node:child_process';
const { encoderQr } = await import('../../src/lib/qr.ts');
const cas = JSON.parse(execFileSync('python3', ['scripts/sondes/qr.py'], { encoding: 'utf-8' }));
let ok = 0; const echecs = [];
for (const c of cas) {
  const code = encoderQr(c.texte, { niveau: c.niveau, masque: c.masque });
  const mienne = code ? code.modules.map((l) => l.map((v) => (v ? '1' : '0')).join('')) : null;
  if (code && code.version === c.version && JSON.stringify(mienne) === JSON.stringify(c.matrice)) ok += 1;
  else echecs.push(`${c.texte.slice(0, 20)}… ${c.niveau} v${c.version} m${c.masque} → ${code ? `v${code.version} ${mienne.findIndex((l, i) => l !== c.matrice[i])}` : 'null'}`);
}
console.log(`QR : ${ok}/${cas.length} matrices identiques à la référence Python.`);
for (const e of echecs.slice(0, 8)) console.log('  ✗', e);
process.exit(echecs.length ? 1 : 0);
