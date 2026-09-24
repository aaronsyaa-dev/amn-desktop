# Système de design — les teintes de familles (évolution)

_Vision cliente, chantier 4 (24 septembre 2026). Une évolution du système de
design posé le 11 septembre — pas un remplacement. Ce qu'elle ajoute, ce
qu'elle interdit, et comment elle se vérifie._

## Le constat

Syraagensy : « il manque de ludicité et de couleur ». Le système est
volontairement monochrome — encres sur fond sombre — avec **un seul ambre
par écran**, réservé à ce qui attend une action. Cette règle est ce qui rend
l'ambre lisible ; elle ne bouge pas. Mais « une seule couleur qui parle »
n'oblige pas à ce que tout le reste soit muet.

## La règle ajoutée

**Une teinte par famille du rail, qui dit « où je suis » et jamais « ce qui
attend ».** Treize jetons (`--famille-PI` … `--famille-SY`, plus les quatre
de supervision interne), un par code de rail, stables dans les deux
éditions, définis dans `src/index.css` et rendus par
`teinteFamille(code)` (`src/lib/teintes.ts`) — aucun composant ne connaît
une valeur.

Où elle apparaît, et sous quelle forme :

| Endroit | Forme | Pourquoi là |
|---|---|---|
| Le surtitre de chaque écran (`ScreenHeader`) | un point de 6 px devant le texte | la personne sait dans quelle famille elle est sans lire le rail |
| La bulle du rail (survol / clavier) | un filet de 2 px à gauche | la bulle et l'écran portent la même teinte : on relie les deux |
| Les titres de famille du lanceur | un point de 6 px | le lanceur est la carte ; la teinte est la légende |

Où elle **n'apparaît pas**, et c'est vérifié :

- jamais un fond, jamais un bouton, jamais un texte coloré — une teinte qui
  peint un objet devient un signal, et l'ambre cesse d'être seul ;
- jamais dans la coquille (rail, panneau, tiroir) : `check:coquille` y
  refuse l'ambre et n'a pas à apprendre treize couleurs de plus ;
- aucune teinte n'approche l'ambre (30–50°) ni le rouge critique ; Système
  reste gris (c'est la seule famille sans teinte : elle n'est nulle part en
  particulier) ;
- éteignable d'un geste (Paramètres › Extensions › Teintes de familles,
  `amn.teintes`), sans rechargement.

## Les valeurs

| Code | Famille | Teinte |
|---|---|---|
| PI | Pilotage | `#5b8def` |
| CR | Clients & revenus | `#3fb37f` |
| GU | Guichet | `#8b6ff0` |
| MK | Marketing | `#e06aa8` |
| PR | Production | `#2fb8c5` |
| FI | Finance | `#7cc46a` |
| DO / LV | Documents / Livrables | `#4aa3d8` |
| JU | Juridique | `#6f7ff0` |
| CO | Collectif | `#c76fe0` |
| RH | Ressources humaines | `#3fb3a0` |
| OU | Outils | `#7f8fb8` |
| PE | Personnel | `#e07a8a` |
| SY | Système | `#9a9a97` (gris : pas de teinte) |
| LG / SU / PA / PD | Supervision (interne) | `#d6c28a` · `#9ec7ff` · `#7fd0c0` · `#b39ddb` |

Toutes à luminance moyenne sur `#060606` : elles se voient en point, elles
ne concurrencent pas l'encre en texte.

## Ce que ça ne règle pas

La « ludicité » n'est pas une affaire de treize points de couleur. Elle
tient aux gestes qui répondent (les célébrations des premières fois, la
présence, le Hall — même chantier) et à ce que Claude Design fera des
écrans vides et des Accueils. Ce document ne prétend pas plus que ce qu'il
pose : une légende de couleur, cohérente, réversible.
