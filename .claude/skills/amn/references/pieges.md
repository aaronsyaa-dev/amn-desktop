# Pièges déjà payés — à ne pas repayer

Chacun a coûté du temps sur les maquettes d'ALLSTORE (24-25/09/2026). La
cause est donnée parce que c'est elle qui se retrouve ailleurs.

## En ligne, rien ne s'affiche

| Symptôme | Cause | Remède |
|---|---|---|
| modèle absent en ligne, présent en local | `.glb` à textures intégrées → URL `blob:` refusée par la CSP | `.gltf` + textures séparées |
| page blanche, erreur de module | three/GSAP pris sur un CDN | tout dans `_lib/`, carte d'import inline |
| police de secours partout | Google Fonts bloqué par `font-src 'self'` | `.woff2` servis par le site |
| « canvas vide » non détecté | la mesure portait sur la capture entière, texte compris | masquer tout sauf le canvas avant de mesurer |

## Le rendu ment

- **Le temps d'une image peut être négatif** : l'horodatage d'une image peut
  précéder le relancement de la boucle. Le tissu restait figé 20 images ;
  une inclinaison est partie à 30 000 rad. Toujours `dt = max(0, …)`.
- **Moyenne au lieu de médiane** pour juger l'appareil : un pic de
  compilation a figé le tissu dix secondes.
- **Compilation au premier dessin** (pilotes logiciels) : un objet est resté
  figé au milieu de l'écran le temps de compiler. Précompiler (dessin sur
  1 pixel) avant qu'il n'apparaisse.
- **Changer la taille du canvas efface l'image** : redessiner tout de suite.
- **Une matière partagée convertie une seule fois** : le second maillage
  sortait tout noir.
- **Ombre sautée une image sur deux** : un pan d'ombre à bord franc restait
  sur le mur.
- **Durées comptées en images** : sur un appareil lent, un anneau mettait
  deux secondes à apparaître. Compter en secondes.
- **Le premier appel du ResizeObserver** dessinait l'image la plus chère juste
  avant la première animation.
- **Halo par 4 décalages fixes** : traits fantômes le long des arêtes. 8
  prises sur un anneau tourné au hasard.
- **Trait plus fin qu'un pixel** (le câble d'un cintre) : l'objet paraissait
  flotter. Ligne d'1 px ajoutée ; l'objet traversant décalé de 3 cm.
- **Un remplacement de shader (`onBeforeCompile`) qui ne trouve pas sa
  cible échoue en silence** : le signaler par `console.error`.
- **AgX / ACES déplacent les couleurs de marque** (rouge terni, indigo
  lilas) : Khronos Neutral pour les couleurs franches.

## L'image se lit de travers

- **Une lettre en 3D peut se lire comme une autre** : en plongée, le dessus
  éclairé du pied d'un C fait la barre d'un G (« RAGONTE »). Assombrir les
  faces supérieures et baisser la caméra pour cette phrase.
- **Un accent peut se détacher** : un É incliné, noir sur un disque jaune,
  montrait un trait flottant. Poser les lettres accentuées droites et en
  couleur ; une lettre posée sur un accent flottait au-dessus de sa rangée.
- **Une pile de lettres dont les étages se recouvrent** : reculer chaque
  étage (z de −0,3) et le vérifier par une mesure (part visible de chaque
  lettre seule puis parmi les autres), pas à l'œil.
- **Un objet animé qui passe sur l'en-tête ou sur le texte** : borner les
  trajectoires hors de la colonne de texte et sous l'en-tête.
- **Un blanc brûlé** (254/255) : se mesure sur la capture ; ramené à ~237 il
  redevient une matière.

## GSAP et CSS

- **Une transition CSS sur `transform` se bat avec GSAP** : GSAP relit une
  valeur à mi-course et la prend pour position finale — un bouton est resté
  30 px trop bas. Pas de transition CSS sur `transform` tant que GSAP anime ;
  `fromTo` explicite, `clearProps`, puis une classe qui remet la transition
  pour le survol.
- **`once: true` sur un ScrollTrigger déjà dépassé au chargement** : plantage.
  `toggleActions: 'play none none none'`.
- **Un style accroché à une balise se casse quand on corrige le plan des
  titres** (voir CLAUDE.md).

## Les contrôles de contenu

- **`verif-allegations.js` lit les commentaires** : « cousue à la main » a
  été refusé comme « fait main » dans un shader. Écrire les commentaires
  comme du texte client.
- **Le cahier des charges qui LISTE les mots interdits se fait refuser** par
  le contrôle qui les cherche. Le nommer avec un `_` en tête
  (`_BRIEF.md`) : le contrôle saute ces fichiers.

## Le travail avec des agents

- **Conteneur redémarré** : tout ce qui n'est pas poussé est perdu, les
  workflows meurent sans prévenir. Commit + push à chaque étape, point de
  contrôle programmé.
- **Limite de dépense atteinte** : toutes les chaînes coupées en même temps,
  pages laissées à moitié modifiées. Re-vérifier chaque page touchée avant
  d'annoncer quoi que ce soit.
- **Critique périmée** : une liste de défauts dont la moitié a déjà été
  corrigée fait refaire du travail. Vérifier avant de corriger ; après deux
  passes, faire une critique neuve.
- **Agents qui partagent un dossier de travail** : ils écrasent leurs scripts
  de capture. Un sous-dossier et un port par agent.
- **Comparer deux réglages sur des images prises à des instants différents**
  d'une scène qui bouge (drapé, physique) ne prouve rien : figer le temps
  ou la graine.
