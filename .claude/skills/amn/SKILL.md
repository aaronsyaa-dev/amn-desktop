---
name: amn
description: Le savoir-faire d'AMN pour construire des sites web spectaculaires en 3D temps réel (three.js, shaders, physique, GSAP) qui tiennent en ligne derrière une vraie politique de sécurité et sur un téléphone. À charger pour toute maquette ou page 3D, tout héros WebGL, toute animation au défilement ambitieuse, toute série de maquettes à produire avec des agents, ou pour améliorer la note 3D d'une page existante — sur ALLSTORE comme pour un client d'AMN.
---

# AMN — sites 3D spectaculaires qui tiennent en ligne

Tiré de la journée du 24-25/09/2026 : 27 maquettes 3D pour ALLSTORE, dont
quatre retenues puis poussées par des critiques indépendants jusqu'à **9/10
en 3D** (la Trame). Tout ce qui est écrit ici a été éprouvé ; les chiffres
sont mesurés, pas estimés.

## Les cinq règles qui décident de tout

1. **Tout est servi par le site.** La CSP interdit CDN, Google Fonts,
   `blob:`, wasm, `eval`. three.js, GSAP, Lenis, polices et modèles sont
   copiés dans `_lib/` ; les modèles en `.gltf` (jamais `.glb`), la physique
   écrite à la main. → `references/boite-a-outils.md`
2. **Le téléphone est l'écran principal.** Pixel ratio plafonné à 2, rendu en
   pause hors écran et onglet caché, une seule image sous mouvement réduit,
   un repli sans WebGL, aucun débordement à 390 px, le texte toujours lisible
   par-dessus la 3D.
3. **Vérifier dans les conditions réelles, puis REGARDER.** Le vérificateur
   sert la page avec la vraie CSP et mesure que le canvas n'est pas vide ;
   mais « vert » veut dire « c'est là », pas « c'est beau ». Les captures se
   regardent à l'œil, bureau et téléphone, à plusieurs hauteurs de défilement.
   → `references/verification.md`
4. **Celui qui juge n'est pas celui qui a fait.** Construire, puis faire
   critiquer par un autre agent avec un barème dur (9 = on le montre
   fièrement à un client exigeant ; propre mais attendu = 6), puis corriger.
   → `references/orchestration.md`
5. **Le contenu reste vrai.** Aucun chiffre, avis ou témoignage inventé ;
   mots interdits refusés **jusque dans les commentaires de code** par
   `verif-allegations.js` ; modèles CC-BY crédités sur la page.

## Démarrer une page 3D

1. Lire le cahier des charges du projet (pour ALLSTORE :
   `AMN-SITE-WEB/propositions/_BRIEF.md`).
2. Copier le gabarit (`propositions/_gabarit/index.html`) : carte d'import,
   renderer, environnement, chargeur, mouvement réduit. Ne jamais partir
   d'une page vide.
3. Choisir **une idée forte** et la pousser au bout : la 3D du héros doit
   être belle à l'arrêt ET en mouvement, et la chorégraphie au défilement doit
   raconter le concept (une section = un état de la scène).
4. Construire, `node scripts/verifier-propositions.js --only=<nom> --pleine`,
   regarder les captures, itérer jusqu'au vert.
5. Faire critiquer, corriger, re-critiquer.

## Ce qui fait passer une 3D de 7 à 9

Les critiques ont noté 7 des scènes propres et 9 celles-ci — le détail est
dans `references/techniques-3d.md` :

- **une matière qui tient au zoom** : relief par fil ou par biseau, reflet
  anisotrope ou vernis qui trace un filet de lumière, occlusion dans les
  creux — pas une texture plaquée ;
- **une lumière qui sculpte** : rasante et chaude pour dessiner les reliefs,
  jamais une douche frontale qui écrase le drapé et brûle les blancs ;
- **un mouvement qui a du poids** : physique maison (verlet, corps rigides),
  pose finale calculée d'avance puis rejointe par la physique, ressorts ;
- **une première image déjà composée comme une affiche** ;
- **zéro accident** : lettre qui se lit comme une autre, objet qui passe sur
  l'en-tête, texte recouvert pendant une animation, état intermédiaire raté.

## Avant d'annoncer « c'est fini »

- vérificateur vert, `verif-allegations.js` vert ;
- captures bureau + téléphone regardées, à plusieurs hauteurs ;
- mouvement réduit : une image fixe complète ; sans WebGL : pas de plantage ;
- poids du premier affichage sous 4,5 Mo ;
- crédits CC-BY présents, `noindex` si la page n'est pas publique ;
- après toute interruption d'un agent : **re-vérifier**, une coupure en
  plein travail laisse souvent une régression silencieuse.

Pièges déjà payés, à ne pas repayer : `references/pieges.md`.
