# Les cinq états transverses — provoqués, pas mis en scène

Un état ne se capture pas en ouvrant une route : il faut le PROVOQUER. Chaque
image ci-dessous vient d'un état que le banc de mesure a déclenché sur le bac
à sable, avec les données réelles de la base.

| Capture | Comment l'état a été provoqué, et ce qu'elle prouve |
| --- | --- |
| `t1-instrument-vide.png` | Le jeu d'essai du Journal perso a été RETIRÉ du poste. L'écran rend alors la marée à vide : ses deux bornes d'échelle, sa ligne d'eau en pointillé à mi-hauteur, ses trente traits de jours — la géométrie exacte de l'instrument rempli, en encre de sourdine et cadre pointillé. Aucun ambre, aucun zéro. |
| `t2-premier-jour.png` | Le miroir local (`amn.sync.*`) a été vidé et les collections coupées : l'accueil n'a alors vraiment rien. L'axe garde ses douze colonnes et ses graduations 08 → 20 aux positions que `pctDe` donnera aux vrais rendez-vous ; une SEULE invitation ; deux cartes calmes sans action et sans le moindre chiffre. Le trait d'heure est absent parce qu'il est 5 h du matin, hors de la journée ouvrée — il ne ment pas. |
| `t3-assistant-etape1-inactif.png` | L'assistant d'un contrat, à l'étape un, champ requis vide : « Continuer » porte le traitement inactif du paquet — plaque sombre, aucune ombre, encre lisible. L'aperçu montre déjà les deux lignes à venir, en filet, avec l'étape qui les remplira. |
| `t3-assistant-etape2.png` | Intitulé saisi, montant saisi : l'aperçu s'est rempli poste par poste (« 2 400,00 € »), la durée reste « À L'ÉTAPE 3 », et le pied rappelle que rien n'est créé avant le dernier bouton. L'étape courante est l'unique ambre de l'écran — la frise du bas a cédé le sien. |
| `t4-refus.png` | La camionnette est prise de 13:30 à 15:00 par samir ; le banc a demandé 14:00 → 16:00. La fenêtre de 560 px dessine le conflit, l'écran reste visible derrière, le nom de samir reste en encre claire, et les deux sorties sont RÉELLES : le dernier créneau libre avant (12:00 → 13:30) et le premier après (15:00 → 20:00). |
| `t5-hors-ligne.png` | Les routes `/v1/collections/**` ont été coupées et la file d'envoi reposée dans sa propre clé (`amn.sync.__envoi`, le format que le produit écrit lui-même pour survivre à une fermeture). La barrière porte l'heure de la coupure à la verticale, quatre wagons nommés par leur MODULE la suivent, et le bloc de diagnostic dessous a cédé son ambre. L'indicateur de barre de titre reste en encre claire. |

**Un détail du banc, pas du produit :** les champs `<input type="datetime-local">`
s'affichent au format américain dans ces captures. Chromium suit la langue de
son interface, pas celle de la page ; sur un poste français, le format l'est
aussi.
