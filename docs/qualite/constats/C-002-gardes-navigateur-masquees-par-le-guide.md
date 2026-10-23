# C-002 — Les gardes navigateur sont aveuglées par la fenêtre de bienvenue

- Gravité : **Majeur** (pour la fiabilité des gardes, pas pour le produit)
- Où : `scripts/check-focus.mjs`, `check-cibles.mjs`, `check-largeur.mjs`, `check-etiquettes.mjs`, `check-contraste.mjs`
- Branche : `main` et `claude/refonte-vivante` (même défaut des deux côtés)
- État : contourné dans le bac à sable de T1 (`scripts/qualite/gardes-bac-a-sable.mjs`) ; correctif propre proposé ci-dessous

## Constat

Chaque garde ouvre un navigateur vierge et se connecte avec un compte d'essai.
Le produit retient « guide vu » dans `localStorage`, par compte
(`amn.guide.<quoi>.<email>`, `src/guide/memoire.ts`). Dans un navigateur neuf, la
fenêtre « Bienvenue — Tout votre travail, au même endroit » (1/3) s'ouvre et
reste ouverte sur **chaque écran** : `role=dialog`, `z-index` 290, 1280×900.

## Preuve

Même bundle, même données, deux conditions :

| Garde (édition cliente, `main`) | Sans marquer le guide | Guide marqué « vu » |
|---|---|---|
| `check:focus` | 277 « fenêtres sans focus » : « Compris », « Lun 19 », « Toutes »… ce ne sont pas des fenêtres | non relancé encore (voir SANTE.md) |
| `check:cibles` | `ÉCHEC : n'a pu ouvrir AUCUNE vue de détail` (sur `refonte-vivante`) ; 62 occurrences sur `main`, sans aucune vue de détail | 180 occurrences, vues de détail incluses |

Sonde (une page, après connexion) : la seule couche fixe de plus de 200×100 px
est ce dialogue.

```
#/agenda  DIV role=dialog aria-label="Tout votre travail, au même endroit" z=290 1280x900
#/clients DIV role=dialog aria-label="Tout votre travail, au même endroit" z=290 1280x900
```

`check:focus` appelle « calque » tout élément `position: fixed`, `z-index ≥ 50`,
plus de 200×100 px ; la fenêtre de bienvenue en est un et reste ouverte, donc chaque clic est
compté « sans focus ». Les autres gardes ne parviennent pas à cliquer sous le voile.

## Pourquoi ça ne se voyait pas

Non vérifié : c'est une hypothèse. Les auteurs ont peut-être lancé ces gardes
avec un compte dont le guide était déjà vu, ou le guide est apparu après elles.
Ici, tout est neuf à chaque lancement et rien n'a été fait pour le marquer.

## Correctif proposé

Dans chaque garde, juste après la connexion et avant la mesure, marquer le guide
comme vu :

```js
await page.evaluate((email) => {
  for (const q of ['general', 'profil', 'presentation']) localStorage.setItem(`amn.guide.${q}.${email}`, 'vu');
}, EMAIL);
await page.reload();
```

ou le factoriser dans `scripts/lib/` (là où vit déjà `vues-detail.mjs`). À mesurer
aussi, mais à part : une garde dédiée au guide lui-même (focus piégé dans la fenêtre,
fermeture par Échap), puisque ces contrôles ne le voient plus.

## Contournement actuel

`gardes-bac-a-sable.mjs` sert une copie du bundle dont `index.html` pose ces clés
pour les deux comptes factices. Aucun fichier existant n'est modifié.
