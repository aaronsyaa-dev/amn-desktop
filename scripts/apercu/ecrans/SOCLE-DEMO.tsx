/**
 * APERÇU « SOCLE-DEMO » — la page de démonstration du socle (`/dev/socle`, `PageDemoSocle`), telle quelle, sur
 * ses exemples génériques. Pas d'image de référence : la page sert de banc de mesure des briques du §4 (un script
 * Playwright jetable y lit le CSS calculé : rayons, bordures, tailles, rembourrages) et de contrôle visuel.
 *
 *   npm run apercu -- SOCLE-DEMO
 *   node scripts/qualite/fidelite/capturer.mjs --page /tmp/apercu/SOCLE-DEMO/index.html --sortie /tmp/apercu/SOCLE-DEMO.png
 *
 * La page est plus haute que 900 px : la capture n'en montre que le début ; la mesure, elle, lit tout le document.
 */
import React from 'react';
import '../../../src/refonte/accueil/Ambiance';
import { PageDemoSocle } from '../../../src/refonte/systeme/demo/PageDemoSocle';

export default function SocleDemo() {
  return <PageDemoSocle />;
}
