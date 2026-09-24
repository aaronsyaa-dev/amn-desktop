# Du produit de développeur au produit que les clients adorent

Rapport du chantier « vision client », commencé le 24 septembre 2026. Point de
rollback : le tag `avant-vision-client`.

Ce document se remplit chantier par chantier. La première partie est écrite
AVANT toute modification : c'est ce que cinq personnes ont vécu en ouvrant le
produit tel qu'il était ce matin-là. Les captures sont dans
`docs/captures/vision-2026-09-24/`.

---


_État au 24 septembre 2026 — branche `claude/first-pr-github-setup-ltpqqo` depuis le tag `avant-vision-client`, 8 commits (180 files changed, 6296 insertions(+), 96 deletions(-)) ; côté serveur, la série `docs/patchs/amn-api-2026-09-24/` (six patchs, aussi sur la branche `claude/cinquante-modules` d'amn-api)._

## 1. Le parcours des cinq profils — avant

Cinq comptes réels ont été créés sur le bac à sable (`@exemple.test`), et
chaque écran a été ouvert dans un vrai navigateur, à 1280 px et à 390 px.

### 1.1 Lina, 14 ans, veut ranger ses devoirs et ses projets de classe

**Ce qu'elle voit.** Une page de connexion noire avec un logo. Puis un
Accueil qui dit « Bonsoir Lina — rien à signaler », un axe vide de 08 h à
20 h, un bouton « Poser un rendez-vous », et un encart : « les devis sans
réponse, les factures en retard et les stocks qui manquent viendront ici ».

**Où elle se perd.** Elle n'a ni devis, ni facture, ni stock, et elle ne sait
pas ce qu'est un devis. La barre latérale épingle « Clients » et
« Facturation » avant « Tâches ». Le rail de gauche dit `PI 4`, `CR 4`,
`PR 3`, `DO 4`, `PE 3`, `SY 5` : six codes, aucun mot. Elle ne devinera pas
que `PE` est la famille « Personnel », celle qui contient exactement ce qu'elle
cherche (Habitudes, Pomodoro, Objectifs perso).

**Ce qu'elle ne comprend pas.** « Découvrir » lui annonce « 116 modules,
23 ouverts, 93 disponibles » et lui dit d'écrire « à votre prestataire ». Elle
n'a pas de prestataire, elle a un compte.

**Où elle s'ennuie.** Tout est noir et gris. Quand elle termine une tâche,
rien ne se passe. Personne d'autre n'existe : ni ses camarades, ni un signe
que quelqu'un d'autre utilise ce produit.

**Ce qui lui manque.** Qu'on lui demande qui elle est et qu'on lui propose un
point de départ (« tes cours, tes devoirs, tes projets, tes habitudes »), un
guide qui montre où cliquer, un peu de couleur et de récompense.

**Ce qui marche déjà.** La première ouverture de Tâches affiche trois lignes
claires (ce que c'est, pour qui, un exemple) et un tableau À faire / En cours /
Fait qu'elle comprend. Le téléphone a une vraie barre du pouce.

### 1.2 Marco, plombier seul, n'a jamais utilisé d'outil de gestion

**Ce qu'il voit.** Le même Accueil du premier jour (« La nuit est calme,
Marco »). Clients : « Aucune fiche client — Créer une fiche ». Facturation :
un bandeau de première ouverture, puis des colonnes vides.

**Où il se perd.** Il ne sait pas par quoi commencer : un client, un devis, un
rendez-vous ? Rien ne lui dit que le chemin naturel est client → devis →
facture → encaissement, et rien ne le fait faire en deux minutes. Les mots
« Coffre-fort », « Formulaires », « Mini-page publique », « Membres — les
places de votre formule » ne lui parlent pas.

**Ce qui lui manque vraiment.** Interventions, Stock, Tournées — son
quotidien — ne sont pas dans la formule Standard (quinze modules). Il tombe sur
« Demander à votre prestataire ». Sur le chantier, il est sur son téléphone :
le produit y tient, mais rien n'est pensé pour lui d'abord.

**Comment il demande de l'aide.** L'écran Assistance « s'examine et envoie le
résultat » : c'est un diagnostic, pas un humain à qui parler. Il n'y a pas de
bouton « ? » dans l'édition cliente (il existe dans l'édition interne).

### 1.3 Nadia, gérante de Syraagensy, une équipe de trois

**Ce qu'elle voit.** Un Accueil propre, un Majordome qui lui dit ce qui s'est
passé pendant son absence, un moteur d'attention qui classe ce qui presse.
C'est le meilleur du produit.

**Où elle s'ennuie.** « Travailler longtemps dessus devient redondant » :
l'Accueil a toujours la même structure, la même palette, le même silence.
Les dix autres Accueils existent depuis hier, mais ils sont au fond de
Paramètres, et elle ne les trouvera pas seule.

**Où elle se sent seule.** Ses deux collègues n'apparaissent nulle part sur
l'Accueil : pas de « qui est là », pas de « ce que l'équipe a fait
aujourd'hui », pas de mot laissé à l'autre. La famille Collectif (messages,
groupes, annonces) n'est pas dans sa formule. Rien ne la relie à l'extérieur :
ni les autres clientes d'AMN, ni AMN DevSec autrement que par un formulaire.

**Ce qu'elle ne comprend pas.** La formule Standard a deux places pour trois
personnes ; l'écran Membres l'explique bien, mais elle le découvre après avoir
invité quelqu'un.

### 1.4 Un chef d'entreprise, plusieurs projets, plusieurs équipes (Groupe Vernet)

**Ce qu'il voit.** Projets, Tableau des projets, Tableau de bord, Matériel,
Salles, Flotte, Planning d'équipe : les pièces existent, chacune dans son
module.

**Où il se perd.** Aucune vue ne dit « qui travaille sur quoi cette semaine »
ni « quelle ressource est prise par quel projet ». Les modules ne se
connaissent pas entre eux : un projet ne sait pas quel véhicule il mobilise,
une salle ne sait pas pour quel projet elle est réservée. La hiérarchie de
décision n'existe pas dans l'édition cliente (Décisions est un module interne).
Ce parcours est repris en détail au chantier 6, avec une société simulée.

### 1.5 Mohamed et Riyad découvrent la supervision AMN Business

**Ce qu'ils voient.** L'Accueil interne : « Encore là, Design ? 9 sites hors
ligne — à regarder », une plaque « À prendre en premier », des points
d'attention. Puis, dans la barre latérale, dix-sept familles dans le même
rail : `PI`, `CR`, `GU`, `MK`, `PR`, `FI`, `CO`, `RH`, `LV`, `JU`, `OU`,
`PE`, `SY`, et — sous la ligne de flottaison, il faut faire défiler — `LG`,
`SU`, `PA`, `PD`.

**Où ils se perdent.** Ces quatre dernières familles sont toute la
supervision : La Garde, la Tour de contrôle, le Parc, les Produits. Elles ont
exactement la même tuile grise que Marketing ou Juridique. Le produit parle de
« trois espaces » (Poste de travail, Tour de contrôle, La Garde) dans la bande
d'état du bas, mais rien dans la barre ne les sépare.

**Ce qu'ils ne comprennent pas.** Le vocabulaire de la Garde est un monde en
soi : la Salle, le mur, une ronde, une remontée, la pile « À votre avis », la
Relève, la régence, le mandat, les paroles d'Ajmani, Vigie, Rempart. Chaque
écran a ses trois lignes de première ouverture, mais aucun lexique n'est à
portée de main, et « À votre avis » comme nom de module ne dit pas que c'est la
file des dossiers qui attendent un humain. Les instruments (« temps depuis le
dernier battement », « hors échelle », « la marche ») sont justes mais denses.

**Ce qui manque pour tout piloter.** La fiche d'organisation permet de
suspendre, changer de formule, ouvrir ou fermer un module, réémettre un accès.
Mais pour répondre à « cette cliente utilise-t-elle le produit, et quoi ? », il
faut recouper trois écrans. Le chantier 3 fait l'inventaire de ce qui reste
une boîte noire.

### 1.6 Ce que les cinq ont en commun

1. **Personne ne sait quoi faire en arrivant.** Il n'y a pas de premier pas
   guidé, ni de question « qui êtes-vous ».
2. **Le rail à deux lettres n'est lisible que par qui le connaît déjà.** Les
   noms n'apparaissent qu'au survol.
3. **Le produit est monochrome et silencieux.** Une seule couleur, l'ambre,
   réservée à la décision — c'est juste, mais rien d'autre ne respire.
4. **On y est seul.** Ni collègues, ni communauté, ni AMN DevSec à portée de
   main.
5. **Les explications existent (bandeau de première ouverture, cartes de
   modules) mais pour 70 modules sur 139** ; les 69 autres n'en ont pas, donc
   le bandeau ne s'affiche jamais pour eux.

---

## 2. Ce qui a été fait, chantier par chantier

### 2.1 L'onboarding (chantier 2)

**Ce qui existe maintenant** (`src/guide/`, monté dans les deux coquilles) :

- **« Qui êtes-vous ? »** au premier lancement d'un compte : quatre portes dans
  l'édition cliente (élève ou étudiant·e, seul·e, petite équipe, plusieurs
  équipes), deux dans l'édition interne (je supervise le parc, je travaille
  dans mon poste). Choisir applique le profil : les modules épinglés, ceux
  qu'on allège (Facturation n'a rien à faire dans la barre d'une collégienne),
  l'Accueil (la semaine dépliée pour une élève, les tiroirs pour un chef
  d'entreprise), et enregistre le profil SUR LE COMPTE (synchronisé) — il suit
  la personne d'un poste à l'autre. « Plus tard » est toujours possible.
- **La visite guidée générale** (8 étapes, 9 en interne) : un voile éteint
  l'écran, un projecteur découpe la cible, un curseur simulé glisse jusqu'à
  elle et « clique », une carte courte explique. On avance en cliquant à
  droite de l'écran, on recule à gauche, ← → au clavier, Échap pour passer.
  Sur téléphone, les étapes visent la barre du pouce et « Modules » au lieu
  de la colonne. Une cible absente est sautée, jamais montrée dans le vide.
- **La présentation de chaque module**, à sa première ouverture : le bandeau
  existant gagne « Me montrer », qui joue un tuto de cinq étapes lu sur
  l'écran lui-même (titre, relevés, geste principal, objet dominant, où
  revoir). Il marche pour les 139 modules sans écrire 139 scénarios — et les
  69 modules qui n'avaient pas de carte en ont une, tirée de leur ligne de
  catalogue.
- **« Vos premiers pas »** sur l'Accueil : trois ou quatre choses concrètes
  selon le profil, cochées par les données réelles (une tâche existe, un
  client existe, l'équipe compte deux personnes) — jamais à la main. Le
  panneau s'efface quand tout est fait, ou d'un clic.
- **Le point d'interrogation** dans la barre du haut des deux éditions
  (l'édition cliente n'en avait pas) : revoir la visite, me montrer cet écran,
  changer de profil, demander de l'aide. En interne, l'aide rapide existante
  devient une ligne de ce menu.
- **Paramètres → Guide** : tout se rejoue.

**Preuve** : `scratchpad/guide.mjs` a joué le premier lancement dans un vrai
navigateur pour Lina (profil élève, 1280 px), Marco (profil seul·e, 390 px)
et le compte interne (profil supervision) — question posée, visite complète,
premiers pas présents, tuto de module en cinq étapes, menu d'aide à quatre
gestes, aucune erreur de page. Captures dans
`docs/captures/vision-2026-09-24/apres/onboarding/`.

**Ce que ça change pour les cinq profils.** Lina choisit « élève », voit
Tâches, Agenda, Projets, Notes épinglés et Facturation disparaître de sa
barre ; ses premiers pas parlent de devoirs et de cours. Marco choisit
« seul·e » et lit : créer un client, faire un devis, poser un rendez-vous.
Mohamed choisit « je supervise » : la Salle, À votre avis, la Vue d'ensemble
et Organisations sont épinglés, et la visite lui montre les familles de
supervision à part (voir chantier 3).

**Règles tenues.** Aucun ambre dans le guide (le projecteur est en encre
claire : le voile éteint l'écran, la cible est le seul objet allumé — c'est
déjà le signal). `prefers-reduced-motion` : le curseur se pose sans glisser.
`check:accueils` vérifie maintenant aussi que les profils de guide ne
traversent pas les éditions.

**Déconstruction honnête.** Le tuto par module est générique : il montre
l'anatomie de l'écran, pas sa logique métier. Pour un écran comme le Cadran
ou le Radar, « l'objet principal » mérite une phrase spécifique — c'est un
brief pour Claude Design (§5) plus qu'un défaut de mécanique. La question
« Qui êtes-vous ? » a quatre portes ; « une association », « une école »
n'en ont pas et retombent sur « petite équipe » — à surveiller avec les
premiers retours.

### 2.2 La barre latérale et la supervision (chantier 3)

**Le constat, précisé.** Le rail à codes de deux lettres n'est pas un
défaut en soi : c'est un raccourci de poste, et une fois lu il tient dans
52 px sans rien cacher. Le défaut était double. (1) Personne ne dit ce que
les lettres veulent dire avant qu'on les ait apprises : l'infobulle native
arrive après une seconde, disparaît au moindre geste, et ne dit ni ce que
la famille contient, ni à quoi elle sert. (2) Dans l'édition interne, les
quatre familles qui ne sont pas « le quotidien d'un poste » — la Garde, la
Tour, le Parc, les Produits — étaient quatre tuiles grises parmi dix-sept,
placées en dernier ; Mohamed et Riyad ne pouvaient pas voir où commençait
« ce qu'AMN Business fait pour ses clientes », et le vocabulaire (ronde,
remontée, pile, Relève, mandat) n'était traduit nulle part.

**Ce qui a été fait, dans le système de design, sans le remplacer.** Le
rail garde exactement sa géométrie (52 px border-box, tuiles 38 × 38, codes
de deux lettres, deux plaques, aucun ambre — `check:coquille` vert sur les
deux éditions après le chantier : `9 écran(s)` cliente, `10 écran(s)`
interne). Quatre choses s'y ajoutent :

1. **La bulle du rail.** Au survol *ou au clavier* (focus), une bulle en
   portail dit le nom de la famille en toutes lettres, son nombre de
   modules, une phrase sur ce qu'elle sert (« Faire : stock,
   interventions, planning, temps, tournées. ») et ses quatre premiers
   modules. Tout de suite, sans délai. Preuve : `apres/barre/cliente-1-bulle.png`
   (Lina, tuile PR : « Production · 1 module · Faire : … · TEMPS ») et
   `interne-1-bulle.png` (tuile LG : « La Garde · 6 modules · Déléguer :
   les équipes qui veillent côté serveur… · LA SALLE · AJMANI · À VOTRE
   AVIS · LES BUREAUX … »). Au clavier : la bulle suit le focus (mesuré :
   « Documents 3 modules » puis « Parc 7 modules »). Les phrases des
   familles clientes vivent dans `rail/famillesHints.ts` (par code, donc
   valables dans les deux éditions) ; celles des familles de supervision
   vivent dans la barre interne uniquement, jamais dans le paquet cliente.
2. **L'index des familles.** Un bouton dans le pied de la barre («
   Index des familles », mémorisé par poste dans `amn.rail.index`) fait
   lister au panneau les familles *par leur nom*, la famille ouverte
   dépliée sous le sien avec ses modules. Le rail reste à gauche (même
   chemin rapide) ; seul le contenu du panneau change. Les profils de
   départ « élève » et « seul·e » l'allument d'office à l'arrivée (Lina
   voit « Pilotage · Production · Documents · Personnel · Système » en
   toutes lettres, `cliente-2-index.png`) ; on l'éteint d'un clic quand
   on connaît les codes. Le mode ne casse rien de la coquille : ses lignes
   de module sont les mêmes (`LigneModule`, marque, plaque, compteur).
3. **La supervision à part (interne).** Les familles dont l'espace n'est
   pas `workspace` viennent *en tête* du rail, groupées dans un nœud
   `data-guide="supervision"` (celui que la visite guidée interne
   pointait sans le trouver), séparées du quotidien par un filet, et
   leur tuile porte l'arête haute allumée — la signature de la Tour, et
   d'elle seule. Dans l'index et dans le tiroir du téléphone, deux titres :
   « Supervision des clientes » puis « Quotidien »
   (`interne-2-index.png`, `interne-7-mobile-familles.png`). Mesuré :
   17 tuiles, `garde* tour* parc* produits*` puis les treize du quotidien,
   4 tuiles dans le groupe.
4. **Le lexique de la supervision (interne).** Dans le menu « ? », une
   entrée « Lexique de la supervision » ouvre 22 termes en quatre
   familles (La Garde — déléguer ; la Tour — décider ; le Parc —
   surveiller ; les Produits — vendre), chacun avec sa définition en une
   phrase *et le lien vers l'écran où l'on agit* — c'est la règle du
   paquet appliquée au vocabulaire : rien n'est une boîte noire qu'on ne
   peut qu'observer. Preuve : `interne-5-lexique.png`, et le lien
   « → À votre avis » mène bien à `#/garde/pile`
   (`interne-6-lexique-vers-pile.png`). `check:business` confirme
   qu'aucun mot du lexique n'entre dans le paquet cliente (« aucune trace
   d'AMN DevSec, des produits, des comptes ou des jetons »).

**Un bug trouvé en chemin, et corrigé.** Les entrées du menu « ? » qui
ouvraient une fenêtre (l'aide rapide du chantier 2, puis le lexique)
portaient leur état *dans* le menu ; or le menu se ferme au premier
`mousedown` hors de lui — donc au premier clic *dans la fenêtre*, qui
démontait l'entrée et la fenêtre avec elle. Constaté au premier essai
(« après lien lexique : `#/` », la navigation n'avait pas eu lieu).
Corrigé par un motif simple : l'entrée *signale* (`amn:lexique`,
`amn:aide-rapide`), un hôte monté hors du menu *montre*, et le menu se
ferme sur tout clic d'une entrée. Vérifié : la fenêtre reste après un clic
dedans (`lexique encore là : 1`, `aide rapide encore là : 1`), le menu
est fermé, le lien navigue.

**Ce qu'AMN Business voit et pilote à la main, aujourd'hui — l'inventaire
honnête.** Vu de haut : `GET /organizations` (liste, résumé, page, logos),
`GET /organizations/:id/dossier` et `/pulse` (le pouls par collection :
dernière écriture, jours actifs sur 30, places, formule, ce que la cliente
nous a fermé), `GET /access-log` (qui est entré chez qui, mode support
compris), `GET /support-requests`. Piloté à la main, depuis le dossier
d'organisation (`org-rail/OrgDossierPanel.tsx`) ou l'écran Organisations :
créer, suspendre/réactiver (`PUT /status`), changer de formule (`PUT
/plan`), ouvrir ou fermer un module (`PUT /modules/:key`, `DELETE
/modules`), régler les places, poser des étiquettes (`PUT /tags`), gérer les
comptes (`POST /users`, mot de passe temporaire, `DELETE /users/:userId`),
invitations et liens de bienvenue, ouvrir une session de support
(`POST /support-session`, fermée par `DELETE`), agir en masse (`POST
/organizations/bulk`), supprimer (`DELETE /organizations/:id`), changer
le logo. Côté Garde : la pile « À votre avis » avec décision par point
(prévenir la cliente, renouveler avec elle, ouvrir le dossier, décision
libre), les bureaux, la Salle commune, le calendrier. **Ce qui reste une
boîte qu'on regarde sans y toucher** (à combler, §3) : la *ronde* elle-même
(on voit ce qu'elle a trouvé, on ne règle ni sa fréquence ni son périmètre
depuis l'interface) ; le *silence de nuit* et le *mandat* d'Ajmani (lus,
pas édités depuis l'écran) ; les seuils des remontées « critique » (dans
le code). Le lexique le dit tel quel — il ne promet pas un écran qui
n'existe pas.

**Déconstruction honnête.** L'index des familles est un *mode* de plus, et
chaque mode est une chose à expliquer ; il se justifie parce que c'est
celui qu'on quitte (on l'éteint quand on sait lire les codes), pas celui
qu'on garde. La bulle du rail ne s'affiche pas sur téléphone (rien ne se
survole) — le tiroir du téléphone donne déjà les noms en toutes lettres, ce
qui est la bonne réponse, mais l'expérience n'est pas la même sur les deux
supports. Le lanceur du téléphone (« Tous les modules ») montre un seul
espace à la fois, par décision antérieure du dépôt (« ne jamais remettre
dans une même surface ce que la séparation en espaces vient de démêler ») ;
sur téléphone, la supervision se rejoint donc par le tiroir, pas par le
lanceur — cohérent, mais à dire dans la visite guidée mobile. Le lexique est
un texte de plus à maintenir : quand un écran de la Garde changera de nom,
il faudra y penser (pas de garde-fou automatique aujourd'hui ; un contrôle
qui vérifie que chaque `to` du lexique existe dans le catalogue serait
trivial et manque — noté §3).

### 2.3 La vie, la couleur, la dimension sociale (chantier 4)

**Le constat, précisé.** « Il manque de ludicité et de couleur » et « on
s'y sent seul, coupé d'internet et des autres » sont deux phrases
différentes. La première parle de la matière de l'écran ; la seconde parle
de ce que le poste ne contient pas : d'autres personnes. Répondre à la
première par des couleurs partout aurait cassé la seule règle qui rend
l'ambre lisible. Répondre à la seconde par un réseau social aurait cassé
l'étanchéité qui fait le produit. Le chantier a fait cinq choses bornées,
chacune réversible d'un geste.

**1. Les teintes de familles** — une évolution du système de design,
documentée (`docs/systeme-de-design-teintes-2026-09-24.md`). Une teinte par
famille du rail (par code, stable dans les deux éditions), en jeton CSS
(`--famille-PI`…), qui dit *où je suis* et jamais *ce qui attend* : un point
de 6 px devant le surtitre de chaque écran, un filet de 2 px sur la bulle
du rail, un point devant les titres du lanceur. Jamais un fond, jamais un
bouton, jamais dans la coquille ; aucune n'approche l'ambre. Mesuré dans le
navigateur : `rgb(91, 141, 239)` sur Tâches (PI), `rgb(63, 179, 127)` sur
Clients (CR), le filet de la bulle PI de la même teinte que l'écran PI
(`apres/vie/nadia-11-clients-teinte.png`, `nadia-12-bulle-teinte.png`).
Éteintes dans Paramètres › Extensions, le point disparaît sans rechargement
(mesuré : « parti »). Un piège trouvé : déclarées dans le bloc `@theme` de
Tailwind, les variables n'étaient pas émises (le premier relevé donnait
`rgba(0, 0, 0, 0)`) — elles vivent dans un `:root` à part, avec la raison en
commentaire. `check:coquille` reste vert sur les deux éditions.

**2. La présence** (`components/Presence.tsx`, sur l'Accueil des deux
éditions). Qui de l'équipe est là maintenant (la présence réelle de la
socket, `onlineEmails`), avec un point vert sur l'avatar ; sinon combien
sont dans l'équipe ; et quand l'organisation n'a qu'une personne, la ligne
ne ment pas : « Vous êtes seul·e ici pour l'instant. Inviter quelqu'un ·
Passer au Hall · Écrire à votre prestataire »
(`nadia-1-accueil-presence.png`). Les invitations en attente sont dites
comme telles, pas comme « personne ». Aucune donnée d'une autre
organisation n'y passe.

**3. Le Hall** — l'espace commun entre organisations *volontaires*. C'est le
morceau qui touche à l'isolation entre organisations ; il est documenté à
part (`docs/le-hall-2026-09-24.md`) et testé à fond (7 tests dans
`amn-api/test/hall.test.js`, suite complète 473/473). L'essentiel :
- le consentement est un geste de propriétaire ou d'admin, révocable d'un
  geste ; sans lui, ni lecture ni écriture (403 `hall_non_rejoint`) ;
- ce qui sort vers les autres : le nom d'affichage choisi, la signature
  choisie par message, le texte, l'heure, le nombre d'organisations. Ce qui
  ne sort jamais : adresses, identifiants, nom légal si le nom d'affichage
  en diffère, et rien des collections — la vue d'un message a exactement six
  clés, vérifiées ;
- une session de support ne parle ni ne consent au nom d'une cliente (403,
  et le module est exclu du contexte de support côté poste) ; un invité lit
  mais n'écrit pas ;
- quitter efface ses messages pour les autres à l'instant (la lecture joint
  sur `left_at IS NULL`) ; les écrans ouverts relisent sur la trame
  `hall:rafraichir` — mesuré : le message de Marco disparaît chez Nadia
  sans qu'elle recharge (`nadia-13-hall-apres-depart.png`) ;
- le texte est stocké tel quel et rendu comme texte : `<img
  src=x onerror>` et `<b>` s'affichent en caractères, zéro nœud `img`/`b`
  dans le DOM (`nadia-4-hall-message.png`) ; 600 caractères, dix passages
  par personne par dix minutes, vide refusé ;
- signaler crée une demande d'assistance « Signalement dans le Hall » ;
  AMN DevSec masque par l'API d'administration (la ligne garde qui, quand,
  pourquoi), et le message disparaît pour tout le monde, autrice comprise ;
- la diffusion en direct passe par la socket de chaque participante, jamais
  un envoi à tous ; aucune copie locale hors ligne, exprès.
Parcours joué entre Syraagensy et Plomberie Marchetti : porte → rejoindre →
message → l'autre ne voit rien avant de rejoindre → voit après, sans
adresse ni nom légal → réponse arrivée en direct → signalement → départ.
Dans le catalogue des deux éditions, famille Collectif, toujours ouvert
(`ALWAYS_ON_MODULES`) : c'est une extension gratuite, pas un module de
formule.

**4. Les célébrations** (`components/Celebrations.tsx`). Les premières fois,
et rien d'autre : première tâche terminée, premier client, première facture
encaissée, premier projet — une phrase chaleureuse en toast, une fois
chacune, mémorisée par poste et par compte. Rien n'est coché à la main : la
collection franchit le seuil pendant que le poste est ouvert, et ce qui
existait à l'ouverture ne se fête pas (on ne félicite pas quelqu'un pour
l'an dernier). Mesuré : une tâche `done` écrite par l'API pendant que Lina
regarde son Accueil → « Première tâche terminée. La liste a commencé à
descendre. Ça se voit. » (`lina-14-celebration.png`), mémoire `['tache']`.

**5. Les extensions gratuites** (Paramètres › Extensions, rubrique dans le
sommaire). Teintes de familles, index des familles, célébrations — trois
interrupteurs qui s'appliquent à l'instant — puis l'écran de veille, les
Accueils, et le Hall avec son état (« Votre organisation y est, sous le nom
“Syraagensy” »). « Extension » veut dire ici ce qu'une personne qui n'a
jamais installé un logiciel peut comprendre : une façon d'habiter le poste,
gratuite, réversible (`nadia-9-extensions.png`).

**Le contact avec AMN DevSec.** Il existait (Assistance) ; le chantier l'a
rendu visible là où la solitude se ressent — la ligne de présence de
l'Accueil — et l'a nommé comme le paquet l'exige dans le paquet cliente :
« votre prestataire », jamais la raison sociale (le contrôle de pureté du
bundle a refusé la première version du texte du Hall qui la citait ; corrigé).

**Deux régressions trouvées par `check:mobile` en chemin, et corrigées.**
(1) La barre du haut interne débordait de 50 px à 360 px et de 20 px à
390 px depuis que le bouton d'aide « ? » (chantier 2) y vit : huit boutons
de 44 px n'y tiennent pas. La gouttière tombe à 6 px sous `sm`, l'avatar
attend `sm` (Paramètres reste à un geste par le lanceur et la palette), et
le nom de l'organisation attend 480 px au lieu de 430 (à 430 il n'en restait
qu'une lettre coupée d'une ellipse). (2) Dans l'Agenda à 360 px, le titre
d'un rendez-vous n'avait que la moitié de lui-même : l'heure, le titre et
la durée sur une ligne ; la durée attend `sm` (la hauteur du bloc la dit
déjà). `check:mobile` : 200 mesures vertes sur chaque édition.

**Déconstruction honnête.** (a) Le Hall n'a pas d'écran de modération dans
la Tour : la modération passe par l'API d'administration et la file
d'assistance ; c'est un brief pour Claude Design (§5) et un écran à faire
avant que le Hall ait dix organisations. (b) Le Hall est une conversation
unique, cent messages, sans fil ni réponse — voulu pour une première
version, mais une agence et une collégienne dans la même pièce est une
hypothèse à vérifier avec les premières inscrites. (c) La présence sur
l'Accueil dit « seul·e » à Nadia parce que ses données de test n'ont qu'un
compte ; la vraie Syraagensy verra ses trois membres — mais la ligne ne
distingue pas « en ligne sur le poste » de « en ligne sur le téléphone ».
(d) Les célébrations ne fêtent que quatre premières fois ; c'est peu, et
c'est volontaire — la cinquième serait déjà du bruit. (e) Les teintes sont
une légende, pas de la joie ; la joie viendra des écrans vides et des
Accueils, qui sont le travail de Claude Design.

### 2.4 La sécurité de tout ce qui a été ajouté (chantier 5)

**La méthode.** Tout ce que les chantiers 2 à 4 ont ajouté a été relu avec
une seule question : *qu'est-ce qui entre, d'où, et qui le rend ?* Puis
chaque réponse a reçu un garde-fou automatique quand c'était possible — un
contrôle qu'on relance vaut mieux qu'une relecture qu'on oublie.

**Ce qui entre, et comment c'est rendu.**

| Surface ajoutée | Ce qui entre | Rendu | Verrou |
|---|---|---|---|
| Le Hall : message, signature, nom d'affichage | texte d'une autre organisation | texte (React), `whitespace-pre-wrap` | stocké tel quel, borné (600/30/60), caractères de contrôle retirés, freins ; `check:xss` |
| La présence | prénoms et adresses de SA PROPRE organisation | texte | `useMembers` ne lit que l'organisation de la session |
| Les teintes | un code de famille du catalogue | `style={{ backgroundColor: 'var(--famille-XX)' }}` | le code passe par `/^[A-Z]{2}$/` avant de devenir un nom de variable ; aucune valeur d'utilisateur n'atteint un `style` |
| Le profil de départ | un identifiant écrit dans `profiles` | jamais rendu tel quel : `PROFILS.find(id)` ou rien | une valeur inconnue vaut « pas de profil » |
| Le guide, les présentations, le lexique | textes du code | texte | statiques |
| Les célébrations | compteurs de collections | texte statique | `localStorage` par compte |
| Les extensions | trois booléens | — | `localStorage` |

**Deux garde-fous automatiques de plus.**

1. **`check:xss`** (`scripts/check-xss.mjs`, dans le navigateur, sur un
   bundle). Il écrit par l'API, au nom du compte d'essai, huit charges
   hostiles (image `onerror`, `<script>`, SVG `onload` + lien `javascript:`,
   lien `javascript:` en HTML et en Markdown, `</style><style>` qui masque
   le corps, `iframe srcdoc`, gabarit `{{constructor…}}`, entités HTML) là où
   une cliente écrit — titre de tâche, nom de client, corps de note, message
   et nom d'affichage du Hall — ouvre les écrans qui les rendent et vérifie :
   aucun nœud né du texte (`img`, `script`, `svg[onload]`, `iframe`, `style`,
   `a[href^=javascript:]`), aucun code exécuté (`window.__xss` reste nul),
   aucun dialogue, page visible, **et le texte montré tel quel** — un
   compte-rendu qui parle de `<script>` doit pouvoir le dire. Puis il efface
   ce qu'il a écrit. Vert sur les deux éditions (Marco en cliente, le compte
   design en interne) : « 8 charges hostiles dans 3 collections et le Hall,
   5 écrans relus ».
2. **`check:accueils`** vérifie maintenant que chaque « → écran » du lexique
   mène à un chemin du catalogue interne (le mot ne promet pas un écran qui
   n'existe pas), et que rien du lexique n'entre dans le dictionnaire
   livré : ses textes ont été **déplacés** de `i18n/fr.ts`/`en.ts` (qui
   entrent dans le paquet cliente) vers le composant interne. Vérifié sur le
   bundle : « Lexique de la supervision » n'y apparaît plus.

**Ce que la relecture a trouvé, et corrigé.**

- *Usurpation du prestataire dans le Hall.* Une organisation pouvait se
  nommer « AMN DevSec » ou « AMNDevSec » et signer des conseils à sa
  place. Refusé (400 `hall_nom_reserve`) : un nom qui commence par AMN, ou
  qui accole AMN à DevSec/Business/Support/Garde, sous toutes ses formes
  (accents, tirets, casse). « Damn Good Coffee » passe.
- *Usurpation d'une autre cliente.* Deux organisations pouvaient porter le
  même nom d'affichage ; un message signé « Syraagensy » pouvait venir
  d'une autre. Refusé (409 `hall_nom_pris`) tant que l'autre est présente ;
  le nom légal d'une cliente n'est pas réservé pour autant — on ne le
  connaît que d'elle, et le refuser à une autre révélerait qu'elle existe.
- *Amplification par le consentement.* Chaque entrée ou sortie fait
  relire les écrans de toutes les participantes ; un propriétaire qui
  bascule en boucle aurait fait relire tout le monde en boucle. Dix gestes
  par dix minutes et par organisation (429).
- *Le lexique dans le paquet cliente* (ci-dessus).
- *Le menu d'aide* (chantier 3) : les fenêtres ouvertes depuis le menu
  mouraient au premier clic — pas une faille, un défaut, mais trouvé par le
  même réflexe de « casser d'abord ».

Neuf tests côté serveur (`hall.test.js`), suite complète verte ; le patch
et la branche `claude/cinquante-modules` d'amn-api portent ces deux commits
(voir §6).

**Ce qui n'a pas été trouvé, et ce que ça vaut.** Aucun
`dangerouslySetInnerHTML` dans ce qui a été ajouté (les deux du dépôt sont
antérieurs, relus, et hors de portée d'un texte d'utilisateur). Aucune route
nouvelle qui lise un `orgId` dans la requête — `tenantAuth` le dérive du
justificatif, comme avant. Aucune donnée d'une organisation ne traverse vers
une autre ailleurs que par le Hall, et le Hall ne livre que ce que §2.3
énumère. Ce que je ne peux pas prouver d'ici : le comportement du
`rateLimit` derrière un proxy qui ne pose pas `x-forwarded-for` (les freins
du Hall sont par compte, pas par adresse, justement pour ça), et la tenue de
`hall_messages` au-delà de quelques milliers de lignes (un index sur
`created_at`, aucune purge — à décider, §6).

### 2.5 L'organisation à plusieurs projets — la simulation du Groupe Vernet (chantier 6)

**La simulation.** Le compte « Groupe Vernet » (formule Premium, dix places)
a reçu une entreprise entière : huit comptes (le patron, Claire —
directrice des opérations, admin —, Karim et Sonia — chefs de projet,
admins —, Yanis, Léa et Moussa — techniciens, membres, Moussa partagé
entre deux chantiers —, et la Mairie de Lyon invitée en `guest`) ; quatre
projets (Lyon en cours, Bordeaux en cours, le siège en attente de validation
et passé d'échéance, Villeurbanne terminé) ; douze tâches réparties ; quatre
ressources partagées dont **la nacelle réclamée par Lyon et par Bordeaux le
même jour** ; deux véhicules dont un contrôle technique dans dix jours ; le
plan du siège et deux réservations qui se disputent la salle Rhône ; trois
interventions ; une demande de congé de Yanis qui attend Karim ; deux
clients ; des rendez-vous et des notes rattachés aux projets. Les scripts
sont dans le bac à sable (`seed-vernet-*.mjs`) ; les captures avant/après
dans `docs/captures/vision-2026-09-24/vernet/`.

**Ce que le patron voyait avant.** « Bonsoir Vernet — rien à signaler.
Aucun rendez-vous aujourd'hui. » Et, dans « À traiter » : « Rien ne traîne :
aucune facture en retard, aucun devis sans réponse. » Pendant ce temps : un
projet avait dépassé son échéance de trois jours, un autre attendait sa
validation, la nacelle était promise deux fois samedi, Yanis attendait une
réponse depuis la veille, le Master passait au contrôle technique dans dix
jours. Chaque module le savait (Projets disait le retard, Absences comptait
« À valider 1 », Matériel refuserait le chevauchement à la création mais ne
le voyait pas dans ses données, Flotte connaissait l'échéance). Personne ne
le disait à celui qui décide. C'est le manque principal d'une organisation
à plusieurs projets : **la hiérarchie de décision existait (les admins
approuvent les absences, les propriétaires règlent l'organisation) mais
rien ne remontait vers elle.**

**Ce qui a été fait.**

1. **« Ce qui attend une décision »** (`state/useDecisions.ts`, dans
   « À traiter » de l'Accueil cliente). Un seul hook rassemble, par
   ordre de poids : les projets passés d'échéance (le lendemain, pas un
   adjectif) ou en attente de validation ; les absences à décider — **visibles
   seulement par qui peut décider** (owner/admin, `isAdminRole`) ; les
   chevauchements réels de deux réservations de matériel, quel que soit le
   jour ; les échéances de véhicules à trente jours ou mille kilomètres.
   Chaque ligne dit le fait, la preuve chiffrée et le geste (« Arbitrer »,
   « Redater ou fermer », « Accepter ou refuser », « Prendre rendez-vous »),
   et mène à l'écran. Après : « 4 choses à traiter » chez le patron
   (`apres-vernet-1-accueil.png`) ; Yanis, membre, n'y voit pas la demande de
   congé de son collègue.
2. **Le responsable d'un projet** (`ownerEmail`, facultatif, choisi parmi
   les membres dans la fiche projet ; normalisé à la lecture). Un projet
   répond à quelqu'un, sinon c'est le groupe entier qui le porte —
   c'est-à-dire personne. Le prénom apparaît dans la liste et dans la vue du
   groupe.
3. **La vue du groupe** (Projets › GROUPE, à côté de FRISE et LISTE). Une
   ligne par projet ouvert : responsable, statut, échéance (et le retard en
   jours), tâches ouvertes / en cours, l'équipe (le responsable plus les
   personnes assignées aux tâches du projet), la prochaine action. Sous la
   table : **« Sur plusieurs projets »** — les personnes que deux projets ou
   plus se disputent (Moussa : Lyon · Bordeaux), parce que c'est là que les
   arbitrages se jouent. La courbe de brûlage reste l'objet dominant
   au-dessus ; la table ne décide de rien, elle montre
   (`apres-vernet-2-projets-groupe.png`).
4. **« À arbitrer »** sur Matériel : tous les chevauchements à venir, quel
   que soit le jour, avec qui réclame quoi et quand (« Nacelle 12 m · sam.
   26 sept. · karim 8 h–14 h ↔ sonia 12 h–17 h »). L'écran ne montrait que le
   jour affiché ; un patron ne feuillette pas les jours pour découvrir que la
   nacelle est promise deux fois samedi (`apres-vernet-3-materiel.png`). La
   fonction de chevauchement vit dans `lib/creneaux.ts`, partagée avec le
   hook de décisions.
5. **L'invité ne lit pas la vie interne de l'entreprise** — la découverte la
   plus sérieuse de la simulation, corrigée côté serveur (patch `0005`,
   `test/invite.test.js`). La Mairie, invitée en `guest` sur son chantier,
   lisait les congés de l'équipe, les carnets de droits, les candidatures, les
   paies, les messages privés. Le rôle `guest` est conçu pour « la comptable
   qui vient chercher les factures, un sous-traitant » ; treize collections
   (congés, droits, candidatures, formations, habilitations, paies,
   procédures, messages privés, groupes, annonces, réunions, objectifs) se
   lisent désormais **vides** pour un invité (la synchronisation ne casse
   pas ; l'écran est simplement sans rien) et ne s'écrivent pas (403). Les
   projets, tâches, factures et dépenses restent lisibles : c'est pour eux
   qu'un invité existe. Détail en §4.

**Trois défauts anciens que le compte riche a fait sortir** (`check:signal`
ne tournait qu'avec un compte Standard à quinze modules) : Priorités et
Recrutement affichaient des zéros sur un écran déclaré vide (« 0 € encaissé
se lit comme un échec ») — la phrase remplace le chiffre ; RDV en ligne
portait deux ambres quand la page est fermée (la plaque « fermée » et le
créneau bloqué en interne) — page fermée, la plaque est la seule décision,
le créneau reste dit en encre. `check:signal` vert sur Vernet (Premium,
tous modules) comme sur Nadia (Standard).

**Ce que la simulation n'a pas comblé, et pourquoi** (idées classées en
§3). Les réservations de matériel et les interventions ne portent pas
d'identifiant de projet : on sait qui réserve, pas pour quel chantier — la
vue du groupe ne peut donc pas dire « la nacelle est à Lyon jeudi ». Les
tâches n'ont pas de date : elles ont une priorité, un projet a une échéance —
c'est un choix du produit, et il tient, mais un technicien avec douze tâches
sur deux chantiers voudra savoir dans quel ordre. Les salles n'ont pas de
conflit visible (deux réservations de la salle Rhône se recouvrent dans les
données sans que l'écran le dise). Le Tableau de bord dit « aucun module n'a
encore de quoi alimenter un cadran » à une organisation qui a tout : il ne
lit pas les projets ni les tâches. Et « qui décide quoi » reste implicite :
il n'y a pas d'écran qui dise, pour cette organisation, que Karim répond de
Lyon, Claire des absences, Vernet des places — l'information est éparpillée
entre les rôles, les responsables de projet et les décideurs d'absences.

**Déconstruction honnête.** La vue du groupe est une table : elle rend
lisible, elle ne rend pas beau, et c'est un brief pour Claude Design (§5).
« Ce qui attend une décision » a quatre sources ; la cinquième (les salles)
manque parce que la structure des réservations de salle est une union de
trois genres d'enregistrement que je n'ai pas voulu modifier à la fin d'un
chantier. Le compte Vernet est riche mais **simulé par moi** : les vraies
questions d'un groupe (la sous-traitance, les marchés publics, la paie de
sept personnes) n'y sont pas — Harun doit faire jouer un vrai patron (§8).

### 2.6 Casser pour corriger (chantier 7)

**Côté serveur** (`amn-api/test/casser-vision.test.js`, six tests, suite
complète 482/482) — ce que le mandat nomme, appliqué au Hall :

| Coup porté | Ce qui s'est passé | Corrigé |
|---|---|---|
| Suspendre une organisation qui parle dans le Hall | ses messages restaient visibles pour les autres, elle comptait encore parmi les participantes | la lecture joint sur `organizations.status = 'active'` : suspendue, elle disparaît ; réactivée, elle revient |
| Supprimer une organisation | rien ne reste (`ON DELETE CASCADE`), même pour la modération | — (déjà juste) |
| Redémarrer le serveur sur le même fichier | ce qui a été dit reste dit | — |
| Vingt messages et cinq consentements simultanés | jamais un 500, vingt acceptés, aucun doublon | — |
| Deux cent soixante messages | les cent derniers en 156 ms, mais **dans un ordre instable** quand plusieurs partagent la même milliseconde | `ORDER BY created_at DESC, rowid DESC` |
| Emoji, arabe, sauts de ligne, six cents caractères exacts, nom de soixante | stockés tels quels, coupés à la borne | — |

**Côté poste** (`scratchpad/casser-vision.mjs`, sept scénarios dans le
navigateur, captures `docs/captures/vision-2026-09-24/casser/`) :

| Coup porté | Ce qui s'est passé | Corrigé |
|---|---|---|
| Couper le réseau au milieu d'un message du Hall | le refus est dit en français, le brouillon reste dans la zone ; le lien revenu, le même message part et la zone se vide | — |
| Tuer le serveur, le Hall ouvert | **l'écran restait nu sous son titre** (relevés « … » et « — ») pendant les reprises du pont, puis revenait seul une fois le serveur relancé | pendant l'attente hors ligne, l'écran dit « Le Hall a besoin du lien. Il reviendra avec lui. » |
| Retirer des cibles du guide pendant la visite | la visite passe les cibles absentes et va au bout, aucune erreur de page | — |
| Refuser le stockage local (navigation privée stricte) | les interrupteurs des extensions s'appliquent sans erreur de page | — |
| Refêter une première fois dans le même navigateur | une fois, pas deux | — |
| Onze messages, rechargement | 3 s, la liste défile | — |

**Un défaut trouvé par accident.** Le contrôle XSS interne et le contrôle
mobile ont tourné en même temps : la tâche hostile de l'un (« `<img
src=x…` », sans espace) a fait déborder l'autre de 17 px à 360 px dans le
détail d'une tâche — une URL collée en titre ferait pareil. Le bouton
coupe désormais son titre où il faut (`[overflow-wrap:anywhere]`).

**Ce que je n'ai pas cassé, et pourquoi.** Le mode support, les liens
publics, le Coffre-fort, les exports, la file hors ligne, les places et les
formules ont déjà leurs suites (`casser.test.js`, `isolation`,
`role-hardening`, `support`, `public`, `links`, `formules`,
`guest-quota`, `check:reprise`, `check:resilience`, `check:persistence`),
toutes vertes ; les rejouer sans les enrichir n'aurait rien prouvé de plus.
J'ai enrichi là où j'avais ajouté. La concurrence sur les *collections* (deux
postes qui écrivent la même fiche hors ligne) est couverte par la suite
« fusion d'écriture concurrente » du 10 septembre — pas rejouée ici.

### 2.7 Les cinq parcours — après

Le même exercice qu'en §1, rejoué sur les bundles finaux (captures dans
`docs/captures/vision-2026-09-24/apres/`, `vernet/`, `casser/`).

**Lina, 14 ans.** À la première ouverture, une porte en quatre choix (« Je
suis élève ou étudiant·e ») ; sa barre se range seule (Accueil, Tâches,
Agenda, Projets, Notes épinglés ; devis, factures, commandes allégés), le
panneau liste les familles par leur nom, l'Accueil « élève » se pose, la
visite guidée montre huit endroits avec un curseur qui glisse, puis trois
premiers pas concrets qui se cochent tout seuls (« Noter un premier devoir
dans Tâches » — coché dès la première tâche). Quand elle termine sa première
tâche : « Première tâche terminée. La liste a commencé à descendre. Ça se
voit. » Elle est seule dans son organisation ; l'Accueil le dit et lui ouvre
le Hall. **Reste :** le Hall est un lieu d'adultes qui parlent devis et
fourreaux — une collégienne n'y a rien à faire, et rien ne l'en protège
(§3, §7).

**Marco, plombier seul.** « Je travaille seul·e » : Clients, Devis, Agenda,
Interventions en tête, l'Accueil « artisan », les premiers pas « Entrer un
premier client », « Faire un premier devis ». Sur son téléphone (390 px) la
visite tient, la carte se pose en haut quand la cible est en bas, la barre
du pouce est nommée. Il rejoint le Hall d'un geste, y lit la question d'une
agence sur un modèle de devis, y répond ; il la signale s'il faut. Sans
réseau, son message reste dans la zone et part au retour du lien. **Reste :**
ses tâches n'ont pas de date, seulement une priorité — pour un homme seul
qui jongle avec dix chantiers, c'est la question ouverte du produit (§3).

**Nadia, Syraagensy.** « Une petite équipe » : Tâches, Agenda, Clients,
Facturation, Équipe. La présence sur l'Accueil dit qui est là (le point vert
sur l'avatar) ou combien sont dans l'équipe, et « 2 invitations en attente »
tant que ses collègues n'ont pas ouvert le lien. Les teintes disent dans
quelle famille elle est ; elle les éteint d'un interrupteur si elle les
trouve inutiles. Le Hall répond à « on s'y sent seul, coupé des autres » :
elle y parle sous le nom « Syraagensy », personne ne voit son adresse ni ses
données, et elle en sort d'un geste. **Reste :** la « ludicité » qu'elle
demandait est une affaire d'écrans vides et d'Accueils — le travail de
Claude Design (§5) — pas de treize points de couleur.

**Le Groupe Vernet.** Le patron ouvre l'Accueil : « 4 choses à traiter » —
la nacelle réclamée deux fois samedi, le siège passé d'échéance de trois
jours, la demande de congé de Yanis, le contrôle technique du Master dans
dix jours — chacune avec son geste et son écran. Projets › GROUPE lui donne
une ligne par chantier (responsable, échéance, retard, tâches, équipe) et
lui dit que Moussa est réclamé par Lyon et Bordeaux. Karim, chef de projet,
voit la demande de congé de son technicien ; Yanis, technicien, ne la voit
pas. La Mairie, invitée, lit le chantier et ne lit plus les congés ni les
paies de l'entreprise. **Reste :** les réservations de matériel ne savent
pas pour quel chantier elles sont ; les salles ne signalent pas leurs
conflits ; le Tableau de bord ne lit ni projets ni tâches (§3).

**Mohamed et Riyad, AMN Business.** Le rail interne met la supervision en
tête — quatre tuiles groupées, un filet, l'arête allumée — et le panneau
peut lister « Supervision des clientes » puis « Quotidien » en toutes
lettres. La visite guidée interne a un pas de plus (« la supervision ») qui
pointe ce groupe. Le menu « ? » ouvre le lexique : vingt-deux mots (la
Garde, la ronde, la pile « À votre avis », le mandat, la Relève…), chacun
avec son écran. Le Hall est modérable par l'API d'administration ; les
signalements arrivent dans la file d'assistance de la Tour. **Reste :** pas
d'écran de modération du Hall dans la Tour, et « qui décide quoi » chez une
cliente n'est lisible nulle part d'un seul regard (§3, §5).

### 2.8 Les garde-fous, mesurés — sur les bundles finaux

_Mesurés sur les deux bundles construits après la dernière modification
(`AMN_EDITION=business` et `internal`, API locale sur 8791). Les contrôles
navigateur ont tourné avec le compte indiqué ; ceux qui dépendent d'un jeu
d'essai l'ont eu._

| Contrôle | Cliente | Interne | Note |
|---|---|---|---|
| `tsc` (deux tsconfig) | vert | vert | |
| `lint` (`eslint --ext .ts,.tsx .`) | vert (0 erreur, 7 avertissements antérieurs) | — | |
| `check:langue` | vert — 8 contrôles, 3 284 clés | — | |
| `check:encres` | vert — 582 fichiers, 28 jetons | — | |
| `check:modules` | vert — 117 / 140 / 109 | — | |
| `check:accueils` (+ lexique) | vert — 11 / 11, aucun import croisé | — | |
| `check:roles` | vert | — | |
| `check:sync` | vert | — | |
| `check:cinquante` | vert — 222 règles | — | |
| `check:appels` | vert (note TURN, O8) | — | |
| `check:business` (pureté du bundle) | vert — 28 motifs interdits, 3 marqueurs | — | |
| `check:coquille` | vert — 9 écrans (Nadia) | vert — 10 écrans (design) | rail 52, tuiles 38 × 38, 27n + 8, deux plaques, aucun ambre |
| `check:signal` | vert — Nadia (Standard) **et** Vernet (Premium, tous modules) | vert — design | |
| `check:mobile` | vert — 200 mesures (Vernet) | vert — 200 mesures (design) | 360 / 390 / 430 / 768 |
| `check:contraste` | vert — 118 écrans, 24 vues de détail, 24 801 textes (design) | vert — 159 écrans, 34 340 textes (design) | seuil WCAG AA |
| `check:xss` (nouveau) | vert — Marco, 8 charges, 3 collections + Hall | vert — design | |
| `check:veille-cliente` | vert sous `TZ=Europe/Paris` sauf la règle « mode nuit », dépendante de l'heure (O1) | — | compte design ; avec Nadia, deux règles attendent le jeu d'essai |
| amn-api `npm test` | 482 tests verts (dont hall 9, invite 1, casser-vision 6) | | |

**Les captures** : `docs/captures/vision-2026-09-24/` — `avant/` (8),
`apres/onboarding/` (8), `apres/barre/` (11), `apres/vie/` (16),
`vernet/` (avant et après, 30), `casser/` (3).

## 3. Les idées, classées par impact

_Ce qui n'a pas été fait, classé par ce que ça changerait pour une cliente.
Chaque ligne dit l'effort en jours de travail sérieux, pas en heures
optimistes._

**Impact fort — à faire avant le premier client, ou juste après.**

1. **Les dates sur les tâches, sans casser la priorité.** Une échéance
   facultative (`dueAt`), montrée seulement quand elle existe, comptée dans
   « ce qui attend une décision » quand elle est passée. Marco et Yanis en
   ont besoin ; le produit a choisi la priorité, il peut garder les deux.
   *3 jours* (écran Tâches, Accueil, Projets, contrôle `check:cinquante`).
2. **Le chantier sur les réservations et les interventions** (`projectId`
   sur `resourceBookings` et `interventions`, rattachables au projet comme
   les tâches). La vue du groupe dira « la nacelle est à Lyon jeudi ».
   *2 jours*.
3. **Un écran de modération du Hall dans la Tour** (liste, masquer avec
   raison, participantes, signalements) : l'API existe, l'écran manque.
   Indispensable avant dix organisations dans le Hall. *2 jours* (brief §5).
4. **Le Tableau de bord qui lit les projets et les tâches.** Il dit « aucun
   module n'a de quoi alimenter un cadran » à une organisation qui a tout.
   *2 jours* (à cadrer : quels cadrans).
5. **Les conflits de salles** (deux réservations de la même pièce qui se
   recouvrent), comme pour le matériel, dans l'écran et dans « à traiter ».
   *1 jour*.
6. **Un Hall par public**, ou au moins une porte différente pour une élève :
   aujourd'hui Lina et une agence parlent dans la même pièce. Le plus simple :
   le profil de départ « élève » ne propose pas le Hall, et l'organisation
   peut le fermer (`org_module_locks` existe). *1 jour* pour fermer, *5 jours*
   pour des Halls par public.

**Impact moyen — le confort de tous les jours.**

7. « Qui décide quoi » : une page de l'organisation qui liste les
   responsables (projets, absences, places, modules), dérivée des données,
   jamais saisie deux fois. *2 jours*.
8. Les célébrations au-delà des quatre premières fois : une par mois au plus
   (« Cent tâches terminées ce mois »), jamais deux. *1 jour*.
9. La présence sur le téléphone : la ligne dit « en ligne » sans distinguer
   poste et téléphone ; un mot suffirait. *½ jour* (le serveur sait déjà d'où
   vient la socket ?  à vérifier).
10. Le tuto par module avec une phrase spécifique pour les vingt écrans les
    plus ouverts, au lieu de l'anatomie générique. *3 jours* d'écriture, à
    faire avec Claude Design (§5).
11. Le contrôle `check:veille-cliente` dépend de l'heure de la machine (une
    règle ne passe qu'entre midi et vingt heures locales) : lui donner une
    horloge factice. *½ jour*.
12. La bulle du rail sur téléphone : un appui long sur une tuile pourrait la
    montrer. *½ jour*.

**Impact faible, ou à décider d'abord.**

13. Des fils dans le Hall (répondre à un message). Pas avant d'avoir vu
    comment les premières organisations s'en servent.
14. Une purge du Hall (au-delà de N mois) : à décider avec la politique de
    conservation.
15. Le lanceur du téléphone qui montrerait la supervision : contredit une
    décision antérieure du dépôt ; ne pas y toucher sans une raison d'usage.
16. Des teintes personnalisables par organisation : non — la légende n'a de
    sens que si elle est la même partout.


## 4. Bugs et failles, par gravité


_Trouvés pendant le chantier, dans ce qui existait comme dans ce qui a été
ajouté. « Corrigé » veut dire : corrigé, vérifié, et un garde-fou ou un test
empêche le retour quand c'était possible._

**Graves — une donnée qui sort, une décision qu'on ne peut plus prendre.**

| # | Où | Quoi | État |
|---|---|---|---|
| G1 | serveur, rôle `guest` | Une cliente invitée sur son chantier lisait les congés de l'équipe, les carnets de droits, les candidatures, les formations, les paies, les messages privés, les groupes, les annonces, les réunions, les objectifs. Ni le serveur ni le poste ne restreignaient un invité en lecture. | **Corrigé** (patch `0005`, `test/invite.test.js`) : treize collections se lisent vides et ne s'écrivent pas pour un invité. Ce qui reste lisible est à confirmer comme décision produit (§6). |
| G2 | Hall | Une organisation pouvait se nommer « AMN DevSec » ou « AMNDevSec » et signer des conseils à la place du prestataire ; deux organisations pouvaient porter le même nom. | **Corrigé** (patch `0002`) : nom réservé, nom déjà porté refusé. |
| G3 | Hall | Une organisation suspendue par AMN continuait de figurer dans le Hall (messages, compte de participantes). | **Corrigé** (patch `0006`, test). |

**Moyens — un écran qui ment, un geste qui casse.**

| # | Où | Quoi | État |
|---|---|---|---|
| M1 | Accueil cliente | « Rien à signaler » à un patron dont un projet était en retard, une absence en attente, une nacelle promise deux fois, un contrôle technique à dix jours. | **Corrigé** (`useDecisions`). |
| M2 | barre du haut interne (téléphone) | Depuis le bouton d'aide « ? » du chantier 2 : débordement de 50 px à 360 px, 20 px à 390 px ; à 430 px le nom de l'organisation réduit à une lettre. | **Corrigé** ; `check:mobile` interne vert. |
| M3 | menu « ? » | Les fenêtres ouvertes depuis le menu (aide rapide, lexique) mouraient au premier clic dedans. | **Corrigé** (les entrées signalent, un hôte montre). |
| M4 | Hall, hors ligne | L'écran restait nu sous son titre pendant les reprises du pont. | **Corrigé** (« a besoin du lien »). |
| M5 | Hall, volume | L'ordre des cent derniers messages était instable dans la même milliseconde. | **Corrigé** (`rowid`). |
| M6 | RDV en ligne | Deux ambres page fermée (la plaque « fermée » et le créneau bloqué). | **Corrigé**. |
| M7 | Priorités, Recrutement | Des zéros sur un écran déclaré vide. | **Corrigé**. |
| M8 | Agenda à 360 px | Le titre d'un rendez-vous réduit à la moitié de lui-même. | **Corrigé**. |
| M9 | Tâches à 360 px | Un titre sans espace (URL collée) faisait déborder le bouton du détail. | **Corrigé**. |
| M10 | teintes | Déclarées dans le `@theme` de Tailwind, jamais émises (point transparent). | **Corrigé**, raison en commentaire. |
| M11 | Hall, départ d'une organisation | Les écrans ouverts gardaient ses messages jusqu'au rechargement. | **Corrigé** (trame `hall:rafraichir`). |

**Ouverts — dits, pas corrigés.**

| # | Où | Quoi | Pourquoi ouvert |
|---|---|---|---|
| O1 | `check:veille-cliente` | Une règle (« mode nuit ») dépend de l'heure de la machine : le contrôle n'est entièrement vert qu'entre midi et vingt heures locales. | Garde-fou, pas produit ; lui donner une horloge factice (§3, n° 11). |
| O2 | veille, palette | Une fois, avec le compte Nadia, Ctrl+K pendant la veille a ouvert la palette (un dialogue) ; pas reproduit avec le compte design. | Non compris ; à reproduire avec un vrai poste. |
| O3 | Salles | Deux réservations de la même pièce qui se recouvrent ne sont signalées nulle part. | §3, n° 5. |
| O4 | Tableau de bord | « Aucun module n'a de quoi alimenter un cadran » à une organisation qui a tout. | §3, n° 4. |
| O5 | Hall | Une élève de quatorze ans et une agence dans la même pièce. | Décision produit (§6), §3 n° 6. |
| O6 | Matériel, Interventions | Pas d'identifiant de chantier : on sait qui réserve, pas pour quoi. | §3, n° 2. |
| O7 | Hall | Pas de purge : `hall_messages` grandit sans fin (un index, aucune limite). | Décision de conservation (§6). |
| O8 | appels | Aucun relais TURN configuré (`VITE_AMN_TURN_URL`) : un téléphone en données mobiles et un poste en wifi ne s'atteignent pas. Constat de `check:appels`, antérieur au chantier. | Infrastructure (§6). |


## 5. Les briefs pour Claude Design


_Un brief par écran. Chacun dit l'objet, l'état actuel (la capture), ce
qu'on attend, et les règles qui ne bougent pas : un seul ambre par écran, la
coquille (rail 52 px, tuiles 38 × 38, aucun ambre dans la colonne), les
encres par jetons, 16 px de gouttière au téléphone. Claude Design travaille
sur les bundles finaux ; les composants portent des ancres `data-guide` et
`data-signal-groupe` qu'il ne doit pas retirer._

**B1 — Le Hall, la porte.** `apres/vie/nadia-3-hall-porte.png`,
`marco-5-hall-porte.png`. Objet dominant : le consentement. Aujourd'hui deux
colonnes de texte (« ce qui se partage / ce qui ne se partage jamais »), un
champ, un bouton. Attendu : la même honnêteté, plus chaleureuse — on doit
avoir envie d'entrer *et* comprendre qu'on peut ressortir. Le nombre
d'organisations présentes est la seule donnée vivante. Aucun ambre.

**B2 — Le Hall, la conversation.** `nadia-7-hall-direct.png`. Une liste et
un composeur, alignement gauche/droite (les miens à droite). Attendu : une
salle, pas un chat — les organisations se reconnaissent par leur nom en
capitales mono ; la signature est secondaire ; « Signaler » discret mais
trouvable. Les messages sont du texte brut, jamais de HTML : ne pas
proposer de mise en forme. Sur téléphone (`check:mobile` vert à 360/390/430)
le composeur doit rester au pouce.

**B3 — « À traiter » sur l'Accueil cliente.** `vernet/apres-vernet-1-accueil.png`.
Quatre lignes : fait, preuve chiffrée, jauge, geste. Attendu : que le patron
lise en deux secondes ce qui attend *sa* décision et ce qui attend un geste
de routine — deux registres aujourd'hui mêlés dans une seule liste. La jauge
grise n'explique pas son échelle. Un seul ambre possible sur l'écran : il est
déjà pris par « la journée ».

**B4 — Projets › GROUPE.** `apres-vernet-2-projets-groupe.png`. Une table à
six colonnes et une liste « sur plusieurs projets ». Attendu : lisible sur
téléphone sans défilement horizontal (aujourd'hui `min-w-[720px]`), le
retard visible sans lire (le rouge critique est réservé ; il faut une autre
matière), l'équipe comme visages et non comme chips de prénoms. La courbe
de brûlage reste l'objet dominant au-dessus.

**B5 — La porte « Qui êtes-vous ? ».** `apres/onboarding/*.png`. Quatre
choix en feuille. Attendu : quatre cartes qui donnent envie, chacune avec
l'image mentale de ce que la barre deviendra ; une cinquième porte « autre
chose » qui ne retombe pas en silence sur « petite équipe ».

**B6 — Les premiers pas.** Une carte de trois ou quatre cases à cocher qui se
cochent seules. Attendu : la satisfaction de la case qui se coche (un
mouvement, une matière), et la carte qui s'efface d'elle-même quand tout est
fait, sans « Masquer ».

**B7 — La bulle du rail et l'index des familles.** `apres/barre/*.png`. La
bulle porte le nom, le compte, une phrase, quatre modules, un filet de
teinte. L'index liste les familles en toutes lettres avec deux titres en
interne. Attendu : que l'index ait l'air d'une table des matières et non
d'une liste de réglages ; que la bulle ne recouvre pas le panneau quand il
est déplié (aujourd'hui elle le chevauche à droite du rail).

**B8 — Le lexique de la supervision.** `apres/barre/interne-5-lexique.png`.
Vingt-deux définitions en quatre familles, dans une fenêtre longue.
Attendu : une page que Mohamed lit comme un glossaire de bienvenue, avec
les quatre familles comme chapitres et le « → écran » comme bouton, pas comme
lien souligné.

**B9 — Paramètres › Extensions.** `apres/vie/nadia-9-extensions.png`. Trois
interrupteurs et deux boutons. Attendu : que chaque extension ait un
aperçu de ce qu'elle change (un point de couleur, une liste de familles,
une phrase de fête), pour qu'on choisisse en voyant.

**B10 — La modération du Hall dans la Tour** (écran à créer, interne). Les
données existent (`GET /v1/admin/hall/messages`, `/participants`, `PUT
…/masquer`). Attendu : une liste des messages avec le vrai nom de
l'organisation, les signalements en tête (compteur `flags`), le geste
« masquer » avec sa raison, jamais « supprimer ». Un seul ambre : le
signalement le plus ancien non traité.

**B11 — Les écrans vides pour Lina.** La « ludicité » demandée par
Syraagensy se joue là : Tâches, Agenda, Projets, Notes vides pour une
collégienne. Attendu : un premier jour qui donne envie d'écrire la première
ligne — sans mascotte, sans confettis, dans le système.

**B12 — Le tuto par module, vingt textes.** Le tuto générique montre
l'anatomie ; il faut, pour les vingt modules les plus ouverts, une phrase
sur *l'objet dominant* de chacun (« la courbe descend quand vous cochez »,
« le cadran, c'est votre journée »). Travail d'écriture avec les captures
`docs/captures/`.

**B13 — La présence et les célébrations.** Une ligne d'avatars, un toast.
Attendu : que la ligne de présence ait une place stable sur l'Accueil (elle
flotte aujourd'hui entre le titre et la journée) ; que la célébration soit
une matière du système (une plaque, pas une notification système).

**B14 — Le rail interne, la supervision groupée.** `interne-1-bulle.png`.
Quatre tuiles en tête, un filet, l'arête haute allumée. Attendu : valider
que l'arête suffit comme signature de la Tour, ou proposer mieux dans les
contraintes de la coquille (aucune couleur, 38 × 38, 1 px de bord).


## 6. Les autres besoins


**Infrastructure.**

- **amn-api déployé** doit recevoir la série `docs/patchs/amn-api-2026-09-24/`
  (six patchs, aussi sur la branche `claude/cinquante-modules`) : `git am`,
  `npm test` (482), redémarrage. Les tables du Hall naissent au démarrage
  (`CREATE TABLE IF NOT EXISTS`, SQLite et Postgres) — aucune migration à la
  main. Sans elles, l'écran du Hall dit « a besoin du lien » et
  l'interrupteur des extensions ne sait pas si l'organisation y est.
- **Un relais TURN** (`VITE_AMN_TURN_URL`) pour les appels entre un téléphone
  en données mobiles et un poste en wifi (constat de `check:appels`,
  antérieur au chantier).
- **La conservation du Hall** : décider une durée (ou un nombre) et écrire la
  purge. Rien ne se purge aujourd'hui.

**Comptes.**

- Les comptes d'essai du bac à sable (Lina, Marco, Nadia, Vernet et ses
  sept collègues, la Mairie) sont locaux à ce conteneur ; leurs scripts
  (`seed-vernet-*.mjs`) sont dans le bac à sable, pas dans le dépôt —
  volontairement : ils écrivent des mots de passe.
- Le compte `design@exemple.test` (interne, AMN DevSec) porte le jeu d'essai
  que `check:contraste` et `check:veille-cliente` attendent
  (`scripts/seed-essai.mjs`) ; les autres comptes ne l'ont pas.

**Décisions produit à prendre — je les ai tranchées provisoirement, il faut
les confirmer.**

1. **Le périmètre d'un invité.** J'ai fermé treize collections (RH, paie,
   messages privés, réunions, objectifs). Restent lisibles : projets, tâches,
   clients, devis, factures, dépenses, matériel, flotte, notes, agenda —
   parce que le rôle est fait pour « la comptable qui vient chercher les
   factures ». Une cliente invitée sur son chantier lit donc les factures de
   *tous* les clients. Est-ce voulu ? Sinon, il faut un rôle « cliente
   invitée » distinct de « comptable invitée ».
2. **Le Hall pour les élèves.** Fermer le Hall au profil « élève » (un
   verrou de module), ou des Halls par public.
3. **La modération du Hall** : qui la fait, en combien de temps, avec quelle
   règle. Le signalement arrive dans la file d'assistance ; il n'y a pas
   d'engagement de délai.
4. **Les dates sur les tâches** (§3 n° 1) : le produit a choisi la priorité ;
   Marco et Yanis demanderont la date.
5. **Le nom d'affichage dans le Hall** est libre à 60 caractères ; faut-il
   le valider à la main la première fois ?


## 7. Avis honnête


**Ce à quoi je me suis attaché.** À la règle d'un objet dominant par écran,
qui m'a obligé à chaque fois à répondre « qu'est-ce qui attend une
décision ici ? » — et c'est cette question qui a fait sortir le vrai manque
du Groupe Vernet. À l'étanchéité entre organisations : le Hall est la
première chose qui la traverse volontairement, et la prouver (six clés,
pas une de plus ; une session de support qui ne parle pas ; une organisation
partie qui disparaît à l'instant) a été le travail le plus satisfaisant du
chantier. Aux garde-fous : `check:xss` qui joue huit charges hostiles sur de
vrais écrans, `check:signal` qui a fait sortir trois défauts anciens dès
qu'on lui a donné un compte riche.

**Le plus gros frein.** Ce produit est encore celui de la personne qui l'a
construit. Cent trente-neuf modules en interne, cent dix-sept côté cliente,
cinquante ajoutés en un mois ; une collégienne en a besoin de huit. Le
profil de départ et l'index des familles *cachent* cette densité, ils ne la
réduisent pas ; la première fois que Lina ouvrira le lanceur « Tous les
modules », elle verra la vérité. Le deuxième frein est que **tout ce que
j'ai vu, je l'ai simulé** : Nadia n'a pas d'équipe réelle, le Groupe Vernet
est né dans un script, et personne n'a encore ouvert le Hall sans que je le
lui demande. Le troisième est le coût de vérification : chaque écran a des
garde-fous, mais ils tournent en dix minutes sur un bundle, dépendent d'un
jeu d'essai et, pour un, de l'heure de la machine. Un produit qu'on ne peut
vérifier qu'avec un conteneur et un compte seedé n'est pas encore un produit
qu'un client fait vivre.

**Ce qui m'inquiète.** Le Hall. Pas sa technique — sa vie : un espace commun
sans modératrice nommée ni règle affichée devient silencieux ou désagréable
en quelques semaines. Il ne faut pas l'ouvrir avant d'avoir décidé qui le
tient (§6). Et le rôle `guest`, dont j'ai fermé la moitié sans savoir à quoi
il sert vraiment chez la première cliente.

**Ce que je referais autrement.** J'aurais dû jouer le Groupe Vernet *avant*
le chantier 4 : « ce qui attend une décision » aurait guidé la présence et
les célébrations, au lieu d'arriver après. Et j'aurais dû lancer
`check:signal` avec un compte Premium dès le premier jour.


## 8. Ce qu'Harun doit tester avant le premier client


_Dans l'ordre. Chaque étape dit ce qu'on doit voir ; si on ne le voit pas,
c'est un défaut à me renvoyer._

1. **Le serveur.** Sur `amn-api`, `git am docs/patchs/amn-api-2026-09-24/*.patch`
   (ou `git merge claude/cinquante-modules`), `npm test` → 482 tests verts.
   Démarrer ; `GET /v1/hall/participation` sans jeton → 401.
2. **Le poste, compte neuf, ordinateur.** Se connecter avec un compte jamais
   ouvert : la porte « Qui êtes-vous ? » ; choisir « petite équipe » ; la
   barre se range ; la visite guidée (curseur qui glisse, ← → Échap) ; les
   premiers pas ; Paramètres › Guide pour tout rejouer.
3. **Le même, téléphone (390 px).** La visite tient ; la carte se pose en haut
   quand la cible est en bas ; le tiroir liste les familles par leur nom.
4. **Le Hall à deux.** Deux organisations, deux navigateurs : rejoindre sous
   un nom, poster, voir arriver en direct, signaler, quitter — l'autre écran
   se vide sans recharger. Essayer le nom « AMN DevSec » → refusé.
5. **XSS à la main.** Coller `<img src=x onerror=alert(1)>` dans un titre de
   tâche, un nom de client, un message du Hall : le texte s'affiche tel quel,
   aucune alerte. (`npm run check:xss` le fait seul.)
6. **Le Groupe Vernet, ou son équivalent réel.** Un compte propriétaire, un
   admin, un membre, un invité. Sur l'Accueil du propriétaire : « à traiter »
   avec une absence à décider ; le membre ne la voit pas ; l'invité ne voit
   ni absences ni paies (écrans vides, pas d'erreur).
7. **Hors ligne.** Dans le Hall, couper le wifi, poster : refus dit en
   français, le brouillon reste ; rétablir : il part.
8. **L'édition interne.** Le rail : la supervision en tête ; l'index ; le
   menu « ? » → le lexique, cliquer « → À votre avis ».
9. **Les garde-fous**, sur les deux bundles : `check:signal`, `check:contraste`
   (compte design, `AMN_E2E_URL`), `check:mobile`, `check:coquille`,
   `check:appels`, `check:cinquante`, `check:accueils`, `check:veille-cliente`
   (entre midi et vingt heures — O1), `check:sync`, `check:business`,
   `check:xss`, `tsc`, `lint`. La matrice mesurée est en §2.8.
10. **Puis un vrai patron.** Lui donner le compte, ne rien expliquer, le
    regarder pendant vingt minutes. C'est la seule mesure qui manque à ce
    rapport.
