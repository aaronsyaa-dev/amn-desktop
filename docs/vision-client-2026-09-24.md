# Du produit de développeur au produit que les clients adorent

Rapport du chantier « vision client », commencé le 24 septembre 2026. Point de
rollback : le tag `avant-vision-client`.

Ce document se remplit chantier par chantier. La première partie est écrite
AVANT toute modification : c'est ce que cinq personnes ont vécu en ouvrant le
produit tel qu'il était ce matin-là. Les captures sont dans
`docs/captures/vision-2026-09-24/`.

---

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

## 3. Les idées, classées par impact

_(se remplit au fil du chantier)_

## 4. Bugs et failles, par gravité

_(se remplit au fil du chantier)_

## 5. Les briefs pour Claude Design

_(se remplit au fil du chantier)_

## 6. Les autres besoins

_(se remplit au fil du chantier)_

## 7. Avis honnête

_(se remplit au fil du chantier)_

## 8. Ce qu'Harun doit tester avant le premier client

_(se remplit au fil du chantier)_
