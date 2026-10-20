# Refonte vivante — règles communes

> À coller dans le prompt de chaque session. Tenu par le CO (chef d'orchestre).
> Version d'après le socle S0 fusionné (`9a6ffe7`). Mode d'emploi du socle :
> [`docs/refonte-socle.md`](../refonte-socle.md).

Piège de nommage : dans le code, `internal` = **AMN Business** (édition interne,
celle qu'on refond) et `business` = **AMN Desktop** (édition cliente). L'édition
cliente ne doit **jamais** changer pendant ce chantier.

## Branches

- Base : `claude/refonte-vivante`. Ta branche : `claude/refonte-<session>`
  (ex. `claude/refonte-s1-navigation`).
- Push autorisé sur **ta** branche seulement. Jamais `main`, pas de PR, pas de
  fusion toi-même : le CO fusionne.
- Ne lance pas l'app (ni `npm start`, ni `start:business`, ni `build:web`), ni
  aucun serveur. Aucune donnée réelle (Syraagensy, NWSY), aucun secret.

## Où écrire

- Ton code va dans `src/refonte/<ta-zone>/`, ou dans les fichiers de ta zone
  listés dans [`STATUT.md`](STATUT.md). Si tu dois en sortir, arrête-toi et
  demande au CO.
- **Socle** (`src/socle/**`) : utilise-le, ne le modifie pas.
  - Briques : `src/socle/ui` (`Bouton`, `Carte`, `Modale`, `Saisie`).
  - Couleur d'un bloc : `data-famille="jour|contacts|ecrire|argent|echanger|creer|outils"`,
    puis `var(--fam)`, `var(--fam-texte)`, `var(--fam-fond)`, `var(--fam-bord)`.
  - Attention : le rail partagé (`BarreRail.tsx`) pose aussi `data-famille`,
    avec ses propres clés (dont `outils`). Ne lis pas `--fam*` sur une tuile du
    rail sans accord du CO.
- **Séparation des éditions** : un fichier partagé par les deux éditions ne
  doit **jamais** importer `src/socle/**` ni `src/refonte/**` directement,
  sinon le code part dans le paquet client. Passe par une couture
  `@edition/*` : un fichier `.internal` qui fait le travail, et son jumeau
  `.business` qui ne fait rien (rend ses enfants, ou `null`). Exemple :
  `src/edition/socle.internal.tsx` / `socle.business.tsx`.
- **Textes** : dans `src/refonte/<ta-zone>/i18n.ts`, sur le modèle de
  `src/socle/i18n.ts` (l'anglais est le schéma, le français est typé contre
  lui). Pas de nouvelle clé dans `src/i18n/fr.ts` / `en.ts`.
- **Bus de moments** (`src/socle/moments.ts`) : `subscribe` librement dans le
  code interne. Un nouveau type de moment, ou un `emit` dans un fichier
  partagé, passe par le CO, et l'`emit` partagé se fait via `@edition/socle`
  (vide côté cliente).

## Fichiers sensibles

**Ajouts seulement**, et chaque ajout est signalé dans ton rapport :

- `src/index.css`, `src/renderer.tsx`, `src/App.tsx`
- `src/screens/SettingsScreen.tsx`
- `src/edition/socle.*.tsx`, `vite.edition.ts`, `tsconfig.json`, `tsconfig.business.json`
- `package.json` et `package-lock.json`
- `.github/workflows/editions.yml`
- `src/socle/moments.ts`

**Interdits sans accord du CO** :

- tout fichier `*.business.*`, sauf le jumeau vide d'une nouvelle couture ;
- `src/components/rail/BarreRail.tsx`, `src/components/MobileBottomNav.tsx` ;
- `src/assistant/**` ;
- `src/screens/**` hors de ta zone ;
- `docs/refonte/REGLES.md` et `docs/refonte/STATUT.md` (tenus par le CO).

## Avant de finir

Gardes sans réseau, toutes au vert :

```
npm run typecheck
npm run typecheck:business
npm run lint
npm run check:accueils
npm run check:socle
npm run check:moments
```

Plus tes propres `check:*`, s'il y en a, ajoutés à `editions.yml`.

## Fin de session

1. Écris ton rapport dans `docs/refonte/rapports/<session>.md` (ex.
   `S1-navigation.md`), d'après [`rapports/MODELE.md`](rapports/MODELE.md).
   Un fichier par session : ne touche pas au rapport d'une autre.
2. Commit, puis push de ta branche.
3. Message au CO : « branche `…` @ `<sha>`, rapport `docs/refonte/rapports/<session>.md` ».
