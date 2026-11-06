# C-003 — Le vérificateur de F1 casse sur `refonte-vivante` (registre vide sous esbuild)

- Gravité : **Majeur** (bloque l'intégration de tout module de F1 ; le code des modules n'est pas en cause)
- Où : `src/ateliers/verifier.mjs` (branche `claude/refonte-atelier-f1` @ `59056ad`)
- Responsable proposé : F1 (le CO l'a déjà signalé dans STATUT, T1 en donne la cause et un correctif testé)
- État : ouvert. Patch validé : [`C-003-verifier-f1.patch`](C-003-verifier-f1.patch)

## Constat

Sur F1 seule, `node src/ateliers/verifier.mjs` est vert (128 propriétés, 14 modules).
Une fois F1 fusionnée dans `claude/refonte-vivante` @ `f059f32` (fusion simulée sans
conflit, dans un worktree jetable), 14 modules sur 14 échouent à la même propriété :
« le manifeste suit le registre de S1 ».

## Preuve

```
$ git merge --no-commit --no-ff origin/claude/refonte-atelier-f1     # sur f059f32
Automatic merge went well
$ node src/ateliers/verifier.mjs
  ✗ le manifeste suit le registre de S1 (famille, action, verbes, mots-clés, niveau)
      Cannot read properties of undefined (reading 'argent')        (×14)
ÉCHEC — 14 propriété(s) de l'atelier ne tiennent pas (14 module(s)).
```

Deux causes, l'une cachant l'autre :

1. `verifier.mjs:86` importe `ACTIONS` depuis `src/refonte/navigation/registre`, qui
   ne l'exporte plus depuis S5 (il n'exporte que `REGISTRE`, `entreeDuRegistre`,
   `familleDe`). `ACTIONS[f]` plante.
2. Même avec `ACTIONS` reconstruit à partir de `REGISTRE_MODULES.familles`, la liste
   des actions reste vide : `src/refonte/modules/registre.ts` ramasse ses déclarations
   avec `import.meta.glob`, un mot de Vite. Sous esbuild il n'existe pas, le registre
   est **vide** (le fichier le dit lui-même, l.6-10) et `check:navigation` le contourne avec
   un plugin (`scripts/check-navigation.ts:57-83`).

   Conséquence plus large : avec un registre vide, les vérifications « id déjà pris »
   et « route déjà prise » (`verifier.mjs:139-140`) ne comparent plus à rien. Elles
   passeraient donc même si un module de F1 entrait en collision avec un module existant.

## Correctif proposé (testé)

Le patch joint fait deux choses : reprendre le plugin `import-meta-glob` de
`check:navigation` dans `charger()`, et reconstruire `ACTIONS` depuis
`REGISTRE_MODULES.familles`.

```
$ git apply C-003-verifier-f1.patch      # sur la fusion f059f32 + F1
$ node src/ateliers/verifier.mjs
OK — 128 propriétés tiennent, 14 module(s) d'atelier.
```

Les contrôles d'unicité des identifiants et des routes comparent alors au vrai registre
(non vide) et passent : aucun des 14 modules ne collisionne avec la pointe.

Le plus propre serait de factoriser le plugin dans `scripts/lib/` pour que
`check:navigation` et le vérificateur n'en aient qu'un.

## Ce que ce constat ne dit pas

Le patch n'a été appliqué que dans un worktree jetable de T1 ; rien n'est modifié sur
la branche de F1. Les tests de logique des modules, eux, ne dépendent pas du registre.
