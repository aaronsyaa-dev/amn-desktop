# Pilotage — les seize modules, composés contre le paquet de design

Captures faites à **1180 px**, la largeur des maquettes, sur le bac à sable
(`design@exemple.test`, base sqlite locale — aucune donnée réelle). Chaque
écran a été semé avec de quoi faire TOURNER son instrument, pas seulement de
quoi le remplir : c'est la différence entre un écran qui s'affiche et un
instrument qui se prouve.

| Fichier | Module | Instrument | Ce que la capture prouve |
|---|---|---|---|
| `accueil.png` | Accueil `12a` | Axe temporel 08→20 h | 5 rendez-vous à leur vraie durée ; l'ambre sur le 15:00 (enjeu non tranché) et **pas** sur le prochain (10:00) |
| `taches.png` | Tâches `16a` | Arbre des blocages | Une racine « attendue depuis 12 j » qui bloque trois tâches, deux de plus derrière |
| `projets.png` | Projets `16b` | Courbe de brûlage | 24 journées estimées, 17,1 faites, « 1 journée d'avance » calculée et non posée |
| `avant-la-paie.png` | Avant la paie `13c` | Cascade de soustraction | 2 800 € en haut, quatre marches, 1 845,70 € qui restent — la somme tombe juste |
| `okr.png` | Objectifs & résultats `16c` | Cinq curseurs d'allure | Un résultat qui DESCEND vers sa cible (19 depuis 48 vers 12 → 80,6 %), un dépassé bloqué au bout de la règle |
| `hebdo.png` | Revue hebdo `16e` | Miroir | Cinq paires à leur propre échelle ; l'ambre sur « Facturé −134 € » et non sur « 1 tâche → 0 » |
| `journal.png` | Journal de bord `17a` | Coupe géologique | Épaisseurs 22 → 96 px interpolées sur le nombre de mots réel |
| `priorites.png` | Priorités du jour `16d` | Trois fentes | La première en ambre, les fentes libres dessinées, trente jours en colonnes de trois cases |
| `routines.png` | Routines `17b` | Matrice de séries 28 j | Une série jamais rompue en ambre ; le « point stock » troué tous les jeudis |
| `reunions.png` | Réunions `17c` | Peigne | Mardi 3 h d'affilée → 7 h 30 libres ; jeudi 3 h en morceaux → 4 h. L'ambre sur le jeudi |
| `notes.png` | Notes `17d` | Mur de fraîcheur | Aujourd'hui / 4 j / 12 j / 26 j / 2 mois / 4 mois / 6 mois, l'encre qui s'éteint ; l'épinglée y échappe |
| `formulaires.png` | Formulaires `17e` | Feuille et marges | Marge alignée sur le champ ; l'ambre sur « budget envisagé » (6/24) et non sur le dernier champ |
| `minipage.png` | Mini-page `22a` | Téléphone à taille réelle | Page rendue à 390 px, mise à l'échelle 286/390 ; blocs inactifs en filet pointillé |
| `lettre.png` | Lettre d'information `22b` | Portée des envois | Trois envois sur un axe commun, le carnet derrière |
| `signature.png` | Signature sur place `22c` | Le bon signé | Le tracé réel au-dessus de sa ligne, le cartouche scellé en pied — et le bouton **inactif** dans son nouveau traitement (fond sombre, aucune ombre) |
| `portfolio.png` | Portfolio `22d` | Planche contact | Cinq ellipses ambre, cinq croix grises, huit indécises — les trois états en même temps |

## Ce que les gardes disent

```
check:signal   49 écrans — aucun n'a plus d'un objet ambre,
               les écrans vides n'en portent aucun ni aucun relevé à zéro
check:encres   429 fichiers — aucun défaut
tsc            vert
lint           0 erreur, 76 avertissements (la référence du dépôt)
```

## Deux défauts trouvés par la garde, pas par l'œil

`check:signal` a rattrapé deux fautes que ces captures donnaient pour bonnes,
parce que dans les deux cas les deux régions ambre étaient à des hauteurs
différentes de la page :

- **Projets** portait deux ambres — la frise avait gardé le sien après que la
  courbe de brûlage lui a pris la place d'objet dominant ;
- **Avant la paie** affichait quatre « 0,00 € » sur un écran que la règle des
  zéros déclare vide.

Les deux sont corrigés dans le même lot que ces captures.
