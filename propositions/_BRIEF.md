# Cahier des charges — maquettes de la page d'accueil d'AMN Desktop

Chaque maquette est une **proposition de design** pour la page d'accueil
d'**AMN Desktop**, le logiciel de gestion d'AMN DevSec. Elles vivent dans
`propositions/NN-nom/` à la racine du dépôt `amn-desktop`, ne sont pas
publiées, et se regardent sur l'aperçu Vercel de la branche (le build web les
copie dans `dist/propositions/`, jamais dans l'application installée).

Lis ce fichier EN ENTIER, puis le skill `.claude/skills/amn/` (SKILL.md et
`references/`), avant d'écrire une ligne.

## Le sujet

AMN DevSec, ce sont deux fondateurs de dix-huit ans : un développeur (Paris)
et un commercial (Antibes). Trois choses, un seul interlocuteur : **AMN
Desktop** (le logiciel), les sites web, la cybersécurité. Cette page ne parle
que du logiciel, avec au plus une ligne vers le reste.

- **Phrase clé : « Votre activité dans un seul outil. »**
- À qui : **les structures sans équipe technique** — un indépendant, un
  artisan sur chantier, un prestataire de services, une boutique, un
  organisateur d'événements, une association.
- Ce que le logiciel promet, et seulement ça : un compte, un espace ; les
  modules qu'il vous faut, ouverts selon votre métier ; la même chose sur le
  téléphone et l'ordinateur ; vos données séparées de tout le reste.

Source de vérité pour tout texte : les pages du site public
(`/home/user/amn-site/service.html` et `prix.html` si le dossier existe dans ta
session ; sinon ce fichier, qui en reprend l'essentiel mot pour mot).

## Ce que chaque maquette doit contenir (une seule page, en français)

1. **En-tête** : « AMN Desktop » (le logo `../_lib/images/logo.svg` peut
   l'accompagner), une navigation par ancres internes, et le bouton
   « Demander un accès » vers `https://amndevsec.fr/contact`.
2. **Le héros, avec la 3D signature de la direction.** Titre : « Votre
   activité dans un seul outil. » Sous-titre possible : « Un compte, un
   espace. Les modules qu'il vous faut, ouverts selon votre métier. » Beau à
   l'arrêt ET en mouvement.
3. **Les onze modules** — les vrais, avec leur phrase (tu peux raccourcir,
   jamais ajouter une promesse) :
   - Accueil — Ce qui arrive aujourd'hui, ce qui traîne, ce qui vient d'être ajouté.
   - Agenda — Rendez-vous et disponibilités, à un clic dès l'ouverture.
   - Clients — Fiches clients et devis. Le devis part à votre raison sociale.
   - Facturation — Factures et encaissements. Le numéro n'est attribué qu'à
     l'émission, à la suite et sans trou ; une facture émise ne bouge plus.
   - Projets — Ce qui avance, et ce qui bloque.
   - Tâches — Ce qu'il reste à faire, avec commentaires et priorités.
   - Notes — Bloc-notes partagé avec votre organisation.
   - Médias — Photos de l'organisation, rattachées à un client.
   - Rapports — Comptes-rendus datés, rattachés à une tâche ou à une fiche
     client, et exportables.
   - Paramètres — Profil, notifications, et l'export de vos données : un
     fichier que vous emportez.
   - Coffre-fort — Mots de passe et accès, rangés à un seul endroit. Il reste
     sur l'appareil où vous l'avez rempli : jamais synchronisé, jamais
     sauvegardé par nous, jamais dans l'export. **Si tu parles de chiffrement,
     dis tout** : chiffré par le trousseau du système dans l'application
     installée, pas dans le navigateur.
   Deux modules sont toujours là : le coffre-fort et l'export de vos données.
4. **Selon votre métier** : « L'application contient soixante et onze modules.
   Huit sont là quoi qu'il arrive ; le reste s'ouvre selon votre activité. »
   Les cinq métiers, avec leurs modules :
   - Boutique en ligne : commandes, stock, fournisseurs, caisse du jour,
     fidélité, mini-page publique.
   - Prestataire de services : temps passé, projets, contrats, relances,
     rendez-vous en ligne.
   - Événementiel : événements, budgets par date, matériel, planning d'équipe.
   - Artisan sur chantier : devis, dépenses avec reçus, photos de chantier,
     tournées, SAV.
   - Collectif et association : messages internes, annonces, sondages,
     absences, caisse commune.
5. **Sur quoi ça tourne** : le navigateur (une adresse et votre compte
   suffisent) ; sur téléphone, « Ajouter à l'écran d'accueil » en fait une
   application ; une version Windows existe aussi, avec les mêmes données. Ce
   que vous ajoutez depuis le téléphone est là sur l'ordinateur, et l'inverse
   — sauf le coffre-fort, qui ne quitte jamais l'appareil.
6. **La séparation** : les outils de supervision d'AMN sont absents du
   logiciel livré ; votre espace ne contient rien qui concerne leur
   infrastructure ni un autre client.
7. **Les prix** (en euros, par mois, TVA non applicable, article 293 B du CGI) :
   Essential 49 € (1 place : accueil, agenda, clients, notes, paramètres et
   export, coffre-fort) · Comfort 89 € (5 places : tout Essential +
   facturation, projets, tâches, médias, surveillance des accès partagés) ·
   Prestige 169 € (10 places : tout Comfort + rapports et modules métier,
   demandes traitées en premier) · Custom : socle 59 € + modules à 9 € (notes,
   tâches, médias), 19 € (agenda, clients, projets, rapports), 39 €
   (facturation) · place supplémentaire + 15 € par mois · à l'année : Comfort
   890 € au lieu de 1 068 €, Prestige 1 690 € au lieu de 2 028 €. Au-delà de
   vingt-cinq personnes, sur devis. « Il n'y a pas de bouton pour payer sur
   cette page. »
8. **L'appel** : « Demander un accès » → `https://amndevsec.fr/contact` ;
   « Réponse écrite sous deux jours ouvrés. »
9. **Pied de page** : « AMN DevSec », la mention « Maquette de design — non
   publiée », l'attribution de tout modèle 3D CC-BY utilisé (voir plus bas).

Une vraie capture du logiciel existe : `../_lib/images/produit-accueil.webp`
(1120 × 596, aussi en `-800` et `-560`). Elle montre un **jeu de
démonstration** (« Atelier Vassiur », « Bonjour Claire », des clients
fictifs) : si tu l'affiches, écris à côté « Capture de l'application, données
de démonstration ». C'est la seule image du produit autorisée.

Plus un fichier **`meta.json`** dans le dossier :

```json
{ "titre": "Nom de la direction", "direction": "une phrase",
  "description": "deux ou trois phrases : l'idée, ce qui la rend forte",
  "technique": "ce que fait la 3D, en une phrase",
  "polices": ["…"], "modeles": ["…"] }
```

## ⛔ Contraintes techniques — la politique de sécurité

La page est servie avec la CSP déclarée pour `/propositions/(.*)` dans
`vercel.json` :
`default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`

Le site public d'AMN est plus strict (aucun script ni style inline) : **mets
ton JavaScript et ton CSS dans des fichiers `.js` / `.css` de ton dossier**,
et ne garde inline que la carte d'import. Une maquette retenue passera ainsi
en production sans être réécrite.

- **Tout est servi par le site.** Aucun CDN, aucun Google Fonts, aucune image
  externe, pas de `blob:`, pas de wasm, pas d'`eval`.
- **three.js r186** et ses modules : `../_lib/three/`. Carte d'import telle
  quelle :
  ```html
  <script type="importmap">
  { "imports": { "three": "../_lib/three/three.module.js",
                 "three/addons/": "../_lib/three/addons/" } }
  </script>
  ```
  Polices 3D pour `TextGeometry` : `../_lib/three/fonts/*.typeface.json`.
- **GSAP 3.15** et tous ses plugins : `../_lib/gsap/<nom>.min.js` (scripts
  classiques, `window.gsap`). **Lenis** : `../_lib/lenis/`.
- **Polices** : `<link rel="stylesheet" href="../_lib/fonts/<nom>.css">`, liste
  dans `../_lib/fonts/fonts.json`. Celles de la maison AMN : **Spectral**
  (titres, `spectral.css`, graisse 600), **Space Grotesk** (texte),
  **JetBrains Mono** (repères techniques). Une direction peut en choisir
  d'autres si son idée l'exige ; le titre en Spectral reste le lien avec la
  maison.
- **Modèles 3D** : uniquement `../_lib/modeles/` (licences dans
  `CREDITS.md` ; les CC-BY-4.0 se créditent en pied de page : « Modèle 3D :
  Nom — Auteur, CC BY 4.0 »). La 3D **procédurale** (géométrie, shaders,
  particules, simulation) est encouragée : c'est souvent la plus originale.
- Physique écrite à la main (ressorts, verlet, corps rigides) — voir
  `references/techniques-3d.md`.
- `<html lang="fr">`, **un seul `<h1>`**,
  `<meta name="robots" content="noindex, nofollow">`, `<title>` = « <titre de
  la direction> — AMN Desktop (maquette) », icône `../../icon.png`.

## Tenir sur un téléphone — c'est là que la page sera vue

- Aucun défilement horizontal à 390 px ; textes lisibles (12 px minimum) ;
  cibles tactiles d'au moins 44 px.
- `setPixelRatio(Math.min(devicePixelRatio, 2))` (1,5 si la scène est
  lourde) ; rendu **en pause** hors écran (IntersectionObserver) et onglet
  caché.
- Premier affichage sous **4,5 Mo non compressés**.
- **Gyroscope** si la direction s'y prête : `DeviceOrientationEvent.requestPermission()`
  au premier geste sur la scène (jamais au chargement), repos calibré, zone
  morte ; téléphone penché à droite → la scène part à gauche.
- **`prefers-reduced-motion: reduce`** : aucune boucle, une image fixe bien
  composée, tout le contenu lisible.
- **Sans WebGL**, la page ne plante pas : un fond statique prend le relais.
- Contrastes AA, focus clavier visible, `alt` sur les images, canvas en
  `aria-hidden="true"`, texte toujours lisible par-dessus la 3D.

## ⛔ Règles de contenu — non négociables

- **Aucun chiffre, avis, témoignage, note, client ou logo de client inventé.**
  AMN n'a pas encore de client payant : aucune page ne doit laisser croire le
  contraire (« ils nous font confiance », compteurs, étoiles). Les seuls
  nombres sont ceux de ce fichier.
- **Aucun outil interne présenté comme vendu** : pas de Scanner, Comply, SSL
  Monitor, Trackers, tour de contrôle, supervision de sites dans le logiciel.
- Voix d'AMN : franche, concrète, deuxième personne du pluriel (« vous »),
  mots ordinaires. Pas de superlatif creux, pas de « ce n'est pas X, c'est
  Y », au plus un tiret cadratin par section.
- Formules refusées par le vérificateur, **commentaires de code compris** :
  « solution innovante », « sur-mesure », « clés en main », « révolution… »,
  « leader », « n° 1 », « 100 % sécurisé », « inviolable », « infaillible »,
  « ils nous font confiance », « clients satisfaits », « nos clients »,
  « témoignage », « avis clients ». Écris les commentaires comme du texte
  public.
- Aucun logo ni nom d'une autre marque ; aucune photo de banque d'images ;
  aucune image externe.
- Pas de couleur vive par défaut : le monde d'AMN est **noir, argent, verre**
  (fond `#0a0a0a`, blanc cassé `#f2f2f0`, gris neutres). Le rouge `#ff4230`
  est réservé aux alertes. Une direction peut introduire une matière ou une
  couleur si elle est décidée et rare.

## Le niveau attendu

Chaque direction est **spectaculaire et reconnaissable** : le genre de page
qu'on montre à quelqu'un sur son téléphone. Une direction = une idée forte,
liée au sujet (« un seul outil »), poussée jusqu'au bout : 3D, matière,
lumière, typographie, mouvement, micro-interactions, chorégraphie au
défilement (une section = un état de la scène). Éviter les signatures de
« site fait par une IA » : dégradé violet, cartes identiques à ombre douce,
fondu d'apparition identique partout, icônes génériques, tout centré.

Barème du critique (sur 10 : 3D, ensemble, téléphone) : **9 = on la
montrerait fièrement à un client exigeant ; propre mais attendu = 6 ; propre
mais banal = 5.**

## Économie (principes « ponytail », niveau full)

Réutilise `../_lib/`, le gabarit `../_gabarit/index.html` et les techniques
de `references/techniques-3d.md` au lieu de les réécrire ; aucune nouvelle
dépendance ; pas d'abstraction inutile ; réponses courtes. Ces principes
portent sur le CODE : ils ne réduisent jamais l'ambition visuelle,
l'accessibilité, le mouvement réduit ni les vérifications.

## Vérifier avant de rendre

```bash
PLAYWRIGHT_CORE=/tmp/claude-0/-home-user-amn-desktop/446d47c6-15bb-5f64-9ce8-fd15cfedcbc3/scratchpad/node_modules/playwright-core \
  node scripts/verifier-propositions.js --only=NN-nom --etapes --pleine-dans=<ton dossier>/captures
```

Il sert la page avec la CSP, l'ouvre sur bureau, téléphone et en mouvement
réduit, et refuse : erreur de page ou de console, violation de CSP, 404,
**canvas vide à l'écran**, débordement horizontal, poids excessif, absence de
`noindex`, formule refusée. Captures : `propositions/_captures/` ; avec `--etapes`, une capture pleine
page et six écrans à 0, 20, 40, 60, 80 et 100 % de la hauteur, bureau et
téléphone, dans le dossier donné. **Regarde-les** (outil Read) à plusieurs hauteurs de
défilement : c'est à l'œil qu'on voit une section vide, un texte illisible
sur la 3D, une mise en page cassée à 390 px.

Le WebGL y est rendu en logiciel (SwiftShader) : lent mais fidèle. Une scène
à 2 images/s ici sera lourde sur un vieux téléphone — alléger.

## Règles de travail

- Ne rien modifier hors de ton dossier `propositions/NN-nom/`.
- Aucune commande git qui écrit (pas de add, commit, checkout, stash).
- Tes fichiers temporaires dans ton propre sous-dossier du scratchpad, avec
  ton propre port si tu lances un serveur.
- Copie de sauvegarde avant chaque grosse modification (`.v1`, `.v2`… dans
  ton dossier temporaire, pas dans `propositions/`).
