/* LE GARDE DES FAITS, CÔTÉ POSTE (Bloc 3 de l'Automatique) — `npm run check:reformuler`.
   Là où Ollama tourne, il reformule la réponse du Capitaine ; il ne peut pas inventer. Ce garde rejoue la fonction avec
   des modèles factices : un modèle fidèle est accepté ; un modèle qui change un nombre, ajoute un fait, perd un nom,
   s'exclame ou s'étale est rejeté et la phrase du Lexique revient telle quelle. */
import { reformulerSansInventer } from '../src/lib/reformuler.ts';

const original = 'Le certificat de jardin.fr (« Le Jardin d’Élise ») expire dans 3 jours ; je repasse à 08 h 15.';
const cas: [string, string, boolean][] = [
  ['fidèle', 'Le certificat de jardin.fr chez « Le Jardin d’Élise » arrive à échéance dans 3 jours ; je repasse à 08 h 15.', true],
  ['change un nombre', 'Le certificat de jardin.fr (« Le Jardin d’Élise ») expire dans 5 jours ; je repasse à 08 h 15.', false],
  ['ajoute un fait', 'Le certificat de jardin.fr (« Le Jardin d’Élise ») expire dans 3 jours, comme 12 autres ; je repasse à 08 h 15.', false],
  ['perd le nom', 'Le certificat expire dans 3 jours ; je repasse à 08 h 15.', false],
  ['s’exclame', 'Le certificat de jardin.fr (« Le Jardin d’Élise ») expire dans 3 jours ! Je repasse à 08 h 15.', false],
  ['s’étale', `${'Le certificat de jardin.fr (« Le Jardin d’Élise ») expire dans 3 jours ; je repasse à 08 h 15. '.repeat(3)}`, false],
  ['modèle muet', '', false],
];
let fautes = 0;
for (const [nom, sortie, accepte] of cas) {
  const r = await reformulerSansInventer(original, async () => sortie);
  const ok = accepte ? r !== original && r === sortie.trim() : r === original;
  if (!ok) { fautes += 1; console.error(`  ✗ ${nom} : ${accepte ? 'aurait dû être acceptée' : 'aurait dû être rejetée'} — « ${r.slice(0, 80)} »`); }
}
const enPanne = await reformulerSansInventer(original, async () => { throw new Error('Ollama absent'); });
if (enPanne !== original) { fautes += 1; console.error('  ✗ sans Ollama, la phrase du Lexique doit revenir telle quelle'); }
if (fautes) { console.error(`check:reformuler — ${fautes} manquement(s)`); process.exit(1); }
console.log(`check:reformuler — ${cas.length + 1} cas : le modèle local reformule sans inventer, et le Lexique revient dès qu’il invente, s’exclame, s’étale ou se tait.`);
