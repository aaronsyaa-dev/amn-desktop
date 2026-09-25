# Reprise — maquettes de la page d'accueil d'AMN Desktop

Mis à jour par la session qui orchestre, à chaque étape. Si le travail s'est
arrêté (conteneur redémarré, limite de dépense), c'est d'ici qu'on repart.

## Où on en est

- Mise en place faite (25/09) : skill `amn` copié dans `.claude/skills/amn/`,
  boîte à outils dans `propositions/_lib/` (three r186, GSAP 3.15, Lenis,
  38 polices + Spectral, 15 modèles, capture du produit), gabarit, scripts
  `scripts/verifier-propositions.js` et `scripts/galerie-propositions.js`,
  CSP de `/propositions/(.*)` dans `vercel.json`, copie dans `dist/` par
  `scripts/build-web.mjs` (site web interne seulement).
- Cahier des charges : `propositions/_BRIEF.md`. Directions :
  `propositions/_directions.json` (4 : usiné dans la masse, le carnet, onze
  mots, le bureau rangé).
- Skill ponytail : téléchargement refusé par le contrôle de sécurité de la
  session ; ses principes (tels que décrits par Mohamed) sont écrits dans le
  cahier des charges.

## Ce qui reste

Voir le tableau d'état plus bas, tenu à jour après chaque étape.

| Maquette | Construite | Vérif. verte | Dernières notes (3D / ensemble / tél.) | Étape |
| --- | --- | --- | --- | --- |
| 01-usine-dans-la-masse | non | – | – | à construire |
| 02-le-carnet | non | – | – | à construire |
| 03-onze-mots | non | – | – | à construire |
| 04-le-bureau-range | non | – | – | à construire |

## Relancer

1. Vérifier l'état : `git log --oneline -5`, `ls propositions/`,
   `cat propositions/_notes.json`.
2. Re-vérifier chaque maquette touchée (une coupure laisse souvent une page à
   moitié modifiée) :
   `PLAYWRIGHT_CORE=<scratchpad>/node_modules/playwright-core node scripts/verifier-propositions.js --only=NN-nom`
   (playwright-core 1.47 est installé dans le scratchpad de la session, hors
   du dépôt ; ailleurs : `npm i playwright-core@1.47.2` dans un dossier à part).
3. Relancer le workflow (outil Workflow, `resumeFromRunId` + même script) ou,
   s'il est perdu, relancer la chaîne construire → critiquer → corriger pour
   les maquettes qui ne sont pas à 3D ≥ 9.
4. Après chaque étape : `node scripts/galerie-propositions.js`, commit, push.
