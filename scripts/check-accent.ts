/**
 * Contrôle de contraste de la palette d'accent (BLOC C).
 *
 * Une couleur ajoutée « parce qu'elle est jolie » finit sur l'écran d'une
 * cliente, et un bouton dont le libellé ne se lit plus ne se remarque pas
 * depuis l'éditeur de code — il se remarque en visioconférence, chez elle.
 *
 * Deux rapports sont exigés, pas un : l'accent contre le FOND (sinon le bouton
 * disparaît) et le libellé contre l'ACCENT (sinon c'est le texte qui
 * disparaît). C'est ce second oubli qui produit les boutons jaunes à texte
 * blanc.
 *
 *   npm run check:accent
 */

import { ACCENTS, MIN_CONTRAST, auditAccent } from '../src/lib/accent.ts';

console.log(`Contraste de la palette d’accent — seuil WCAG AA ${MIN_CONTRAST}:1\n`);

let failed = 0;
for (const accent of ACCENTS) {
  const audit = auditAccent(accent);
  const line =
    `  ${audit.ok ? 'ok  ' : 'ÉCHEC'} ${accent.label.padEnd(10)} ` +
    `sur le fond ${audit.onBackground.toFixed(2)}:1 · ` +
    `libellé sur l’accent ${audit.labelOnAccent.toFixed(2)}:1`;
  if (audit.ok) console.log(line);
  else {
    console.error(line);
    failed += 1;
  }
}

console.log('');
if (failed > 0) {
  console.error(`ÉCHEC — ${failed} couleur(s) sous le seuil de lisibilité.`);
  process.exit(1);
}
console.log(`OK — les ${ACCENTS.length} couleurs proposées restent lisibles.`);
