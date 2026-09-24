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

_(se remplit au fil du chantier)_

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
