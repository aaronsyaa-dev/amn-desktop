import { declarerSubstitutions } from '../declarer';

/**
 * LOT-00 — Système : aucune substitution à déclarer aujourd'hui.
 *
 * Les écrans système de la refonte (notifications, démarrage, métier,
 * « Tous les modules » D02, connexion, veille) sont déjà montés par
 * `appRoot.internal.tsx` et par les coutures `@edition/navigation` et
 * `@edition/coquille` : la route d'origine EST l'écran refondu, il n'y a rien
 * d'honnête à substituer. Ce fichier reste comme modèle pour les autres lots
 * (un fichier `declarations/<lot>.tsx` chacun, voir `../declarer.ts`), par
 * exemple pour LOT-01 :
 *
 *   import { lazy } from 'react';
 *   import { declarerSubstitutions } from '../declarer';
 *
 *   export default declarerSubstitutions('jour', [
 *     // L'écran refondu des tâches, à la place de `/tasks` ; même garde que la route d'origine
 *     // en session de support (`module: 'tasks'`), où il est rendu à l'identique.
 *     { route: '/tasks', module: 'tasks', support: 'identique', composant: lazy(() => import('../../jour/PageTaches')) },
 *   ]);
 *
 * `npm run check:substitutions` monte une substitution factice sur le même
 * mécanisme, dans le contrôle seulement.
 */
export default declarerSubstitutions('systeme', []);
