# Rapport de fin de session — LOT-00 Système et démarrage

## Résumé

1. Socle étendu : contrôles, situations, graphiques, archétypes, démo interne (`/dev/socle`).
2. Coquille : barre latérale (Vue d'ensemble, + N autres, Tous les modules, En ligne), en-tête, barre Ajmani, ⌘K, ⌘J, cloche.
3. Écrans système : H40, H41, H42, H47, H43, D02, G06, G05 — 8 sur 8 construits.
4. Redirection unique vers Démarrage à la toute première connexion.
5. Aucune capture : l'application n'a pas été lancée (consigne).

## Branche et sha

- Branche : `claude/refonte-socle`
- Partie de : `claude/refonte-design-socle`

## Fichiers sensibles ou hors zone

| Fichier | Changement | Pourquoi |
|---|---|---|
| `src/edition/appRoot.internal.tsx` | routes ajoutées, `ConnexionRefonte` sur `/login`, `FournisseurToasts` | interne seulement |
| `src/edition/navigation.internal.tsx` | export `TousLesModules` | D02 |
| `src/refonte/modules/declarations/*.ts` | noms de familles alignés sur les maquettes | D02 |
| `package.json`, `.github/workflows/editions.yml` | scripts `check:socle-*`, `check:systeme-*` | gardes du lot |

Aucun fichier de l'édition cliente (`*.business.*`) modifié.

## Gardes

Lancées avant/après : `typecheck`, `typecheck:business`, `lint`, `check:accueils`, `check:socle`, `check:moments`, `check:ajmani`, `check:navigation`, `check:garde-refonte`, `check:clavier`, `check:langue`, `check:modules` et tous les `check:*` sans navigateur : **identiques à la base** (`check:encres`, `check:migration`, `check:xss`, `check:visite`, `check:support` en échec avant comme après). Nouveaux : `check:socle-*` et `check:systeme-*` verts.

## Points à trancher

Voir « LOT-00 » dans `STATUT.md` (nouvelle coquille par défaut, G06 : phrase Garde et « 12 organisations », réglage d'organisation du métier, émetteurs mail/mobile).

## Ce qui n'a pas été vérifié

- Rendu réel et comparaison aux images ±2 px.
- Gardes à navigateur : `check:coquille`, `signal`, `mobile`, `contraste`, `focus`, `cibles`, `etiquettes`, `mouvement`, `xss`, `isolation`, `business`.
- `mailto:` dans Electron (peut être bloqué côté processus principal).
