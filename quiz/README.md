# Quiz du Murshid — Ibn ʿĀshir

Une page unique, `index.html`, qui contient tout : le décor, les 47 questions,
le moteur du quiz et le classement. Aucune dépendance, aucun compte, aucun
outil de construction. On l’ouvre, on entre son prénom, on joue.

```
quiz/
  index.html   ← toute l’application (≈ 80 Ko)
  mosquee.jpg  ← facultatif : la photo de fond (voir plus bas)
```

## Le contenu

Trois voies, reprises du vers d’ouverture d’Ibn ʿĀshir — *« sur la croyance
d’al-Ashʿarī, le fiqh de Mālik, et la voie de Junayd le cheminant »* :

| Voie | Questions | Matière |
|---|---|---|
| Croyance ashʿarite | 15 | les vingt attributs, le *kasb*, les *mutashābihāt*, les prophètes |
| Fiqh malikite | 17 | eaux, *wuḍūʾ*, *ghusl*, *tayammum*, prière, *sahw*, jeûne |
| Voie de l’imam Junayd | 15 | sobriété, *tawḥīd*, *fanāʾ* / *baqāʾ*, stations et états |
| **Parcours complet** | **20** | tirées des trois voies, une bonne réponse = un point |

Chaque question est suivie d’une explication courte, souvent avec l’appui
arabe. Les questions vont du plus simple au plus exigeant, et le parcours
complet respecte cette progression même s’il pioche au hasard.

La note est toujours ramenée sur 20.

## Mettre la photo de la mosquée

Par défaut, le fond est une **façade dessinée** (SVG, dans le fichier) inspirée
de la photo : ciel de nuit, lampe ambrée, arcs brisés, grille au premier plan.
Pour la vraie photo, au choix :

1. **Poser le fichier à côté** — nomme-le `mosquee.jpg` et place-le dans le
   même dossier que `index.html`. Rien d’autre à faire.
2. **Tout garder dans un seul fichier** — encode l’image et colle-la dans la
   constante `PHOTO`, en haut du script :

   ```bash
   echo "const PHOTO = \"data:image/jpeg;base64,$(base64 -w0 mosquee.jpg)\";"
   ```

   Compresse-la d’abord (1200 px de large, qualité 70 suffisent) : au-delà de
   300 Ko, le chargement sur mobile s’en ressent.

Tant que la photo est absente, le navigateur note dans sa console que
`mosquee.jpg` est introuvable — c’est sans conséquence, la façade dessinée
prend le relais.

## Le classement

L’application sait fonctionner de trois manières, et bascule toute seule.

**1. Sur l’appareil (par défaut).** Chaque prénom reçoit un identifiant, les
scores sont gardés en local. Aucun réglage.

**2. Partagé par le lien.** Le bouton *Partager* fabrique un lien qui
transporte les douze meilleurs scores connus (`#s=…`). Le téléphone qui l’ouvre
les fusionne avec les siens. De proche en proche, le groupe converge — sans
serveur.

**3. Commun et en direct.** Pour un vrai classement unique, ouvre
*Organisateur · classement partagé* depuis l’accueil et colle l’adresse d’une
base **Firebase Realtime Database** :

1. [console.firebase.google.com](https://console.firebase.google.com) → nouveau projet (gratuit, sans carte bancaire) ;
2. *Realtime Database* → *Créer une base de données* → **mode test** ;
3. copie l’adresse `https://…firebasedatabase.app` et colle-la dans l’écran Organisateur.

Le lien que tu partages ensuite contient le réglage (`?db=…&salle=…`) : les
participants n’ont rien à régler. Les scores arrivent en direct, par le flux
d’événements de Firebase, avec une relecture de secours toutes les huit
secondes. Un score gagné hors ligne repart tout seul au retour du réseau.

> Le mode test laisse la base ouverte en lecture et en écriture pendant trente
> jours. C’est voulu : personne n’a de compte à créer. N’y mets rien d’autre
> que ce quiz, et referme les règles quand la soirée est passée.

## Le mettre en ligne

Il faut une adresse publique pour que le lien s’ouvre depuis WhatsApp.

- **GitHub Pages** — *Settings → Pages*, branche `main`, dossier `/` :
  la page est servie sur `https://<compte>.github.io/<dépôt>/quiz/`.
- **Vercel / Netlify** — dépose le dossier `quiz/`, ou pointe le projet dessus.
- **N’importe quel hébergement** — copie les deux fichiers par FTP.

Pour une vignette dans l’aperçu WhatsApp, héberge une image et décommente la
balise `og:image` dans l’en-tête.

## Ce qui a été vérifié

Parcours complet et parcours par voie, de bout en bout ; trois joueurs sur un
même appareil, chacun avec son identifiant ; transmission des scores par le
lien puis fusion sur un second appareil ; absence de débordement horizontal en
320, 390, 430 et 1280 px de large ; aucune erreur JavaScript. La page
fonctionne sans les polices Google, qui ne sont qu’un embellissement.
