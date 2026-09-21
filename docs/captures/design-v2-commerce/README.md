# Clients & revenus — captures du rendu réel

Bac à sable `design@exemple.test`, base sqlite locale, données semées par
`scripts/seed-essai.mjs`. Largeur 1180 px, la largeur des maquettes.

Chaque ligne dit ce que la capture **prouve** — pas ce qu'elle montre. Une
capture qui ne prouve rien n'a pas sa place ici.

| Capture | Module | Ce qu'elle prouve |
| --- | --- | --- |
| `fidelite.png` | Fidélité `23b` | Neuf tampons apposés, tous de travers, et la dixième case en ambre. Les angles sont mesurés par sonde navigateur, pas jugés à l'œil : `rotate(5.6deg) · −6.03 · −2.66 · −6.05 · 1.64 · −3.19 · 2.26 · 0.95 · 4.4`, dixième `−6.67`, **tampons parfaitement droits : 0**. |
| `avis.png` | Avis `23a` | L'aiguille du peson à `((5 − moyenne) / 4) × 100 %` de la course, le ressort étiré avec elle, et la nervosité chiffrée (combien d'avis sans une étoile, combien de cinq). |
| `parrainage.png` | Parrainage `23c` | Deux générations, et le CA de branche = somme de la descendance, jamais les factures du parrain lui-même. |
| `facturation.png` | Facturation `11a` | Le demi-cercle de 340 px, trois arcs proportionnels sur un seul chemin, total émis gravé au centre à 42 px. L'en-tête et la dominante disent **le même** « en attente » : 3 439,20 € des deux côtés (c'était 10 199 vs 3 439 avant correction). |
| `facturation-entier.png` | Facturation `11a` | L'écran entier : douze mois émis avec le prévisionnel du mois courant en filet pointillé, les brouillons non émis avec leur montant en jeu, et le registre — dont les lignes en retard restent **en encre claire**, l'ambre étant le sujet de la carte du haut. |
| `clients.png` · `clients-entier.png` | Clients `14a` | Le nuage à deux axes : silence en abscisse (0–180 j), chiffre d'affaires des douze derniers mois en ordonnée (0–12 k€), diamètre du disque repris du même chiffre. Le quadrant critique est calculé sur des seuils écrits — 90 jours, 4 000 € — et Cabinet Vallon (3 740 € · 104 j) en est **exclu de justesse** : la preuve que le seuil travaille vraiment. Villa Sereine (6 000 € · 97 j) y est seule, et porte l'ambre avec son étiquette. Une flèche marque le point dont le CA dépasse le haut de l'axe. |
| `devis.png` · `devis-entier.png` | Devis `13a` | Le fil d'Ariane dit « Facturation · Devis », la barre latérale garde Facturation en actif, aucune entrée « Devis » n'y est ajoutée. Cinq réglettes sur un axe commun de trente jours ; sonde navigateur : parts `100 / 40 / 30 / 20 / 10 %` pour 34 / 12 / 9 / 6 / 3 jours, et le cran de relance au **même pixel** (`584.3`) sur les cinq lignes — la légende partage bien la grille des réglettes. |
| `abonnements-entier.png` | Abonnements `13b` | La colonne empile des FORFAITS, pas des abonnements : Hébergement 900 € (41 %) + Maintenance 720 € (33 %) = **74 %** de 2 200 €, « les trois quarts », mesurés. Le ruban porte 12 crans pour 13 abonnés — l'annuel échoit dans 113 jours. |
| `depenses-entier.png` | Dépenses `12b` | Le cran de fin au **même pixel** sur les quatre rails (462,2 px sur une piste de 642, soit 72,0 %). Fournitures sort de 86,3 px = 18,67 % = 112 € sur 600 €. Déplacement « au cran », Autre borné au bout de piste avec chevron. Les neuf cuves ont le même sommet (851,7 px) et la même hauteur (132 px). |
| `caisse-entier.png` | Caisse du jour `11c` | Trois jours sans caisse comptée n'ont **pas de barre**, seulement leur fantôme. Habituelle = médiane des jours passés (422 €), aujourd'hui 329 € = 78 % de la colonne. |
| `contrats-entier.png` | Contrats `14b` | Deux tacites en fondu, sans cap ni date ; deux barres courtes avec nom posé après le cap ; le contrat-cadre de 2028 borné au bord avec chevron. |
| `commandes-entier.png` | Commandes `14c` | Quatre épaisseurs et « 2 autres attendent derrière » : la règle des quatre maximum se vérifie parce que le jeu d'essai porte six bons. « Il manque 3 » en rouge sur l'article court en stock. |
| `relances-entier.png` | Relances `14d` | Les quatre marches 70/110/150/190, la marche du haut **vide avec « personne »**, l'ambre sur la plus haute occupée, et les jetons de créance en encre claire dessus. |
| `prospects-entier.png` | Prospects `14e` | 24 / 15 / 8 / 5 en effectifs cumulés, chutes − 38 % / − 47 % / − 38 %, ambre sur la fuite entre qualifié et devis envoyé, sept qualifiés sans devis nommés, et « les 5 gagnés viennent TOUS du bouche à oreille ». |
| `rdv-entier.png` | RDV en ligne `23d` | Les trois états sans couleur d'accent — plein, barré, pointillé — et le créneau bloqué en interne en ambre avec l'en-tête de sa colonne. Sonde : quatre nœuds dans un seul groupe (`lun.21/09`, `09:30`, `10:00`, `10:30`). |
| `evenements-entier.png` | Événements `23e` | L'affiche au ratio A3 (268 × 379 px) avec sa mention de format, titre 42 px, bandeau de date ambre en 17 px mono noir. **Trente cases dont vingt-trois pleines** — le nombre exact de places, pas une barre de pourcentage. |

## Les mesures de la sonde

`check:signal` sur le bundle complet : **55 écrans, aucun n'a plus d'un objet
ambre**, les écrans vides n'en portent aucun et n'affichent aucun relevé à
zéro. `check:contraste` : 69 écrans, **9 705 textes**, aucun sous WCAG AA — après
correction d'un défaut qu'il a trouvé lui-même : le chiffre gravé dans la
colonne d'Abonnements était en encre de fond (#060606) sur #4a4a48, soit un
rapport de 2,28 pour un seuil de 4,5. Les gris de remplissage de la rampe sont
sombres ; ce qui s'écrit dessus s'écrit en clair.

Une phrase de la maquette ne tient pas sur ces données-là, et l'écran le dit :
`MODULES.md` décrit « les quatre clients à plus de 90 jours, dont trois pèsent
moins de 1 600 € par an » ; ici un seul est léger. La phrase du panneau
« Les silencieux » se déduit des comptes plutôt que d'être écrite d'avance —
une formule figée aurait contredit le tableau juste au-dessus d'elle.

Le demi-cercle : les trois `stroke-dasharray` somment 486,9469 px pour un
chemin de π × 155 = 486,9469 px — le dernier arc prend le reste exact plutôt
que sa propre part arrondie. (`getTotalLength()` du navigateur renvoie
486,9082 : c'est sa polyligne d'approximation, soit 0,008 % de moins, pas un
jour entre deux masses.)
