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

## Sécurité : le dépôt est public

`aaronsyaa-dev/amn-desktop` est **public**. **Rien qui décrive une faille de
sécurité n'y est poussé.** Cela couvre :

- les documents (rapports, constats, tickets) ;
- les commentaires de code ;
- les messages de commit ;
- les noms de branche.

Concrètement :

- `docs/securite/**` reste **local ou dans un dépôt privé**. Le dossier est
  ignoré par `.gitignore` : ne le force pas avec `git add -f`.
- Dans `src/securite/**` et partout ailleurs, le code peut corriger, mais ses
  commentaires et ses commits ne décrivent ni la faille ni comment l'exploiter.
  Écris par exemple « durcit la validation de X », sans le scénario.
- Un constat de sécurité trouvé par une autre session va à S6, par un canal
  privé. Jamais dans `docs/qualite/` ni dans un rapport poussé.

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

## Les lots de la refonte (dossier de construction du 31 octobre)

Chaque lot a **une branche** `claude/refonte-<lot>` et **une section** dans [`STATUT.md`](STATUT.md), § 7 « Écrans ». Les branches, les sessions et l'ordre sont au § 2 de `STATUT.md`.

- **Départ** : crée ta branche depuis `claude/refonte-vivante` (LOT-00 : depuis `refonte-design-socle`, voir `STATUT.md` § 1.1). Les lots 01 à 09 ne démarrent qu'une fois LOT-00 fusionné.
- **`STATUT.md`** : tu ne modifies **que la section de ton lot** (§ 7), une ligne par écran, à chaque écran terminé : `à faire`, `en cours`, `fait` ou `écart` avec la raison en note. Le reste du fichier est au CO. Cela remplace « Les sessions ne modifient pas ce fichier » et la consigne du dossier de construction.
- **Écrans** (`STATUT.md` § 1.3) : un écran refondu est un nouveau composant dans `src/refonte/<lot>/`, qui réutilise les hooks et l'état existants. Tu ne modifies ni `src/screens/**` ni `appRoot.internal.tsx` : le mécanisme de substitution de LOT-00 s'en charge. Les écrans partagés avec l'édition cliente passent par une couture `@edition/*` dont le jumeau `.business` ne fait rien.
- **Socle** : `src/socle/**` est en lecture seule dès que LOT-00 est fusionné. Il manque un composant ou un jeton ? Note-le dans la section de ton lot et dis-le au CO, ne le contourne pas.
- **Registre** : tes écrans NOUVEAU s'ajoutent dans le fichier de ta famille, `src/refonte/modules/declarations/<famille>.ts`.
- **Maquettes** : les images du dossier restent **hors du dépôt**. Ne les committe pas, et ne les copie pas dans `docs/`.
- **Données** : jeux de données fictives uniquement. Les noms, montants et dates des images ne sont jamais codés en dur.
- **Preuve avant de rendre la main** : les gardes de « Avant de finir », plus la capture de chaque écran à 1440 × 900 comparée à son image (± 2 px). Un écart se note, il ne se tait pas.

## Fin de session

1. Écris ton rapport dans `docs/refonte/rapports/<session>.md` (ex.
   `S1-navigation.md`), d'après [`rapports/MODELE.md`](rapports/MODELE.md).
   Un fichier par session : ne touche pas au rapport d'une autre.
2. Commit, puis push de ta branche.
3. Message au CO : « branche `…` @ `<sha>`, rapport `docs/refonte/rapports/<session>.md` ».
