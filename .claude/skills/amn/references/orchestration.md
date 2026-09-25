# Produire beaucoup de maquettes avec des agents — ce qui a marché

Le 24/09/2026 : 27 maquettes 3D construites en une journée, quatre retenues
par Mohamed puis poussées de 7 à 9/10 par des tours de critique. Voici la
méthode, et ce qu'elle a coûté d'apprendre.

## La chaîne : construire → critiquer → corriger

1. **Un cahier des charges écrit** (`propositions/_BRIEF.md`) que chaque
   agent lit EN ENTIER : sujet, sections obligatoires, contraintes CSP,
   téléphone, règles de contenu, niveau attendu, commande de vérification.
   Sans lui, chaque agent réinvente les règles — et en oublie une.
2. **Une fiche par direction** (`_directions.json`) : idée, 3D, typographie,
   palette, modèle suggéré. Une direction = une idée forte poussée au bout.
3. **Construire** : un agent par direction, jusqu'au vérificateur VERT et des
   captures bureau + téléphone regardées.
4. **Critiquer** : un AUTRE agent, qui n'a pas écrit la page et ne la modifie
   pas. Il lance le vérificateur, regarde les captures, fait les siennes à
   plusieurs hauteurs de défilement, lit le code.
5. **Corriger** : un agent qui applique les défauts relevés, re-vérifie, et
   regarde les captures finales.
6. Pour les maquettes retenues : **jusqu'à 3 tours** critique → reprise, puis
   des tours supplémentaires tant que la 3D n'atteint pas 9.

Scripts réutilisables : `scripts/propositions-reprise/` (`relance-maquettes.js`,
`ameliorer-3d.js`, `prolonger-3d.js`) et l'état de reprise `REPRISE.md`.

## Le barème du critique — et pourquoi il est dur

Notes sur 10 : 3D, ensemble, téléphone. **9 = on le montrerait fièrement à
un client exigeant ; une 3D propre mais attendue vaut 6 ; une page propre
mais banale vaut 5.** Verdict « ok » seulement si vérificateur vert ET 3D ≥ 9
ET téléphone ≥ 8 ET aucune règle enfreinte.

Les défauts doivent être **concrets et actionnables** : où (fichier, section,
coordonnées à l'écran), quoi, comment corriger. « Améliorer la lumière » ne
sert à rien ; « une lumière rasante chaude à gauche pour dessiner les biseaux,
une bande nette dans l'environnement pour tracer un filet dans le vernis »
fait monter la note.

Ce que les critiques ont récompensé, sur les quatre retenues :
- une **première image qui est déjà une affiche** (Typo cinétique, Trame) ;
- des **matières crédibles au zoom** : laque avec filets de lumière, toile
  « photo macro », verre qui accroche un reflet ;
- une **chorégraphie au défilement qui raconte le concept** (une armure par
  section, une phrase par section, une salle par marque) ;
- le **téléphone traité comme l'écran principal**, pas comme un repli.

## Les règles qui évitent de perdre le travail

- **Un agent ne touche que son dossier**, et ne lance **aucune commande git
  qui écrit**. C'est la session principale qui enregistre (commit + push à
  chaque étape) : un conteneur qui redémarre efface tout ce qui n'est pas
  poussé.
- **Copie de sauvegarde avant chaque modification** (`/tmp/<agent>/<nom>/`,
  suffixes `.v1`, `.v2`…) : un réglage qui n'améliore pas se remet en place
  en une commande.
- **Un agent coupé en plein travail laisse une page à moitié modifiée.**
  Constaté : la Trame a perdu sa 3D sur téléphone (canvas vide) après une
  coupure. Après toute interruption, **re-vérifier chaque page touchée**
  avant d'annoncer quoi que ce soit.
- **Une critique vieillit.** Des défauts d'une critique de la veille avaient
  déjà été corrigés par une reprise coupée : l'agent suivant doit **vérifier
  avant de refaire**, et après deux passes de correction il faut une
  critique neuve, pas une troisième reprise sur l'ancienne liste.
- **Passes chronométrées** quand le temps est compté : « tu dois avoir FINI,
  page au vert, avant HHhMM ; ne commence pas une modification que tu ne peux
  pas finir ». Deux corrections sûres valent mieux que cinq à moitié faites.
  Un délai repoussé se transmet aux agents en cours par message.

## Les limites de la machine

- **4 cœurs.** Au-delà de ~8 agents simultanés, la charge dépasse 20 et
  chaque vérification (WebGL logiciel) devient très lente — une reprise a
  pris plus de deux heures sous une charge de 33. Viser 4 à 8 agents.
- **La limite de dépense mensuelle** peut couper toutes les chaînes d'un coup
  (arrivé le 24/09 vers 16h). Les workflows se reprennent ensuite là où ils
  étaient (`resumeFromRunId`, mêmes arguments) — d'où l'intérêt de garder les
  arguments dans des fichiers, pas seulement dans l'historique.
- **Le conteneur redémarre** (arrivé vers 13h50) : les workflows en cours
  meurent sans prévenir. Un point de contrôle programmé toutes les 60 min
  (vérifier `uptime`, relancer ce qui est mort) rattrape ça.
- Le dossier scratchpad de session est partagé par tous les agents :
  **un sous-dossier et un port par agent**, sinon ils écrasent leurs scripts.

## La galerie qui ne ment pas

`scripts/galerie-propositions.js` génère `propositions/index.html` à partir
des dossiers et de leur `meta.json`. Les pages non terminées (absentes de
`_finies.json`) restent visibles mais **grisées, « en construction — pas
encore vérifiée »**, et rangées après. Une page à moitié écrite présentée
comme finie, c'est la galerie qui ment.
