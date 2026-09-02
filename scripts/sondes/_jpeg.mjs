/* Ré-encode en JPEG (qualité 70, réduction ×0,5 au-delà de 1440 px) tous les PNG du dossier D, puis supprime les PNG. */
import fs from 'node:fs'; import path from 'node:path';
const { chromium } = await import('playwright-core');
const D = process.env.D || 'docs/captures';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await nav.newPage();
for (const f of fs.readdirSync(D).filter((f) => f.endsWith('.png'))) {
  const buf = fs.readFileSync(path.join(D, f));
  const { width, height } = await p.evaluate((src) => new Promise((r) => { const i = new Image(); i.onload = () => r({ width: i.naturalWidth, height: i.naturalHeight }); i.src = src; }), `data:image/png;base64,${buf.toString('base64')}`);
  const echelle = width > 1440 ? 0.5 : 1;
  await p.setViewportSize({ width: Math.round(width * echelle), height: Math.round(height * echelle) });
  await p.setContent(`<body style="margin:0;background:#0a0a0a"><img src="data:image/png;base64,${buf.toString('base64')}" style="width:${Math.round(width * echelle)}px;height:${Math.round(height * echelle)}px;display:block"></body>`);
  await p.screenshot({ path: path.join(D, f.replace(/\.png$/, '.jpg')), type: 'jpeg', quality: 70 });
  fs.unlinkSync(path.join(D, f));
}
await nav.close();
