# Le rouge — audit, politique, correction

*Nuit du 30 août. Consigne : « le rouge est un signal, pas une ambiance ».
L'audit AVANT la correction, puis l'après, famille par famille.*

## L'audit — 249 usages, 84 fichiers

Relevé par grep sur `(text|bg|border|ring|fill|decoration)-danger*` :

| Classe | Occurrences |
|---|---|
| `text-danger` | 120 |
| `bg-danger-muted` | 41 |
| `border-danger/40` | 31 |
| `bg-danger` | 18 |
| `border-danger(/50…)` | 25 |
| `bg-danger/10…20` | 17 |
| autres (`ring`, `fill`, `decoration`, `-ink`, `-fill`) | 12 |

Foyers les plus denses : InvoicesScreen (18), ProjectsScreen (9),
OrgDossierPanel (9), ExpenseForm (9), SslScreen (8), TasksScreen (7),
SitesDashboardScreen (7), GuestCallScreen (7), EventsScreen (7).

## Les familles, et la politique de chacune

**F1 — Le mur de veille (MurDeControle).** AVANT : jusqu'à 144 points
`bg-danger` vif + lueur rouge (`box-shadow` rouge), plus `bg-warning` pour les
incidents non critiques — un parc en incident baignait l'écran de rouge.
APRÈS : les points d'incident passent en **braise sombre désaturée** (nouveau
jeton `--color-braise`), sans lueur ; le SEUL rouge vif du mur est la ligne de
synthèse (le verdict). L'écran reste noir, quoi qu'il arrive.

**F2 — Le battement du rail.** AVANT : anneau rouge respirant AUTOUR DU LOGO
sur critique — c'est le « logo AMN en rouge » : interdit. APRÈS : l'anneau
reste monochrome (blanc), toujours ; l'état critique se signale par un POINT
rouge posé au coin du bouton — un signal, pas une teinte sur la marque — et le
souffle s'accélère.

**F3 — Les statuts de site (StatusBadge).** AVANT : « HORS LIGNE » = point
rouge PULSANT + libellé rouge — douze sites en panne, vingt-quatre éléments
rouges qui respirent. APRÈS : le point reste rouge (c'est LE signal), mais il
ne pulse plus (le battement dit « flux vivant », un point de panne qui respire
est un mensonge de vocabulaire) et le libellé redevient neutre. Une liste en
panne se lit d'un balayage de points, elle ne crie plus sur chaque mot.

**F4 — Les cartes baignées (AttentionPanel et parentes).** AVANT : carte
critique = fond rouge + bordure rouge + texte rouge. APRÈS : surface neutre,
UNE arête gauche rouge + l'icône rouge ; le texte redevient de l'encre
normale. Une carte critique se repère, elle ne se lit pas à travers un filtre
rouge.

**F5 — Les badges compteurs (cloche de notifications).** AVANT :
`bg-danger-fill` pour un simple compte de non-lus. APRÈS : badge monochrome
(accent sur fond) — un non-lu n'est pas un incident.

**F6 — Les erreurs de formulaire (`role="alert"`, textes d'échec).**
CONSERVÉES en rouge : rares, momentanées, causées par un geste — c'est le
signal dans son rôle exact.

**F7 — Les gestes destructeurs (poubelles `hover:text-danger`, bouton de
confirmation de suppression).** CONSERVÉS : le rouge n'apparaît que sous
l'intention, c'est un rationnement par l'interaction.

**F8 — Les teintes de gravité dans les listes métier (factures en retard,
certificats expirés, projets bloqués…).** Même règle que F4 : l'information
critique garde UN porteur rouge (le montant, la date, l'icône), le fond et le
reste du texte redeviennent neutres.

## Ce que « braise » veut dire

`--color-braise: #7d332b` — un rouge éteint, désaturé, sombre : visible sur le
noir comme une braise dans l'obscurité, incapable de baigner quoi que ce soit.
Réservé aux nuées de points (le mur) où CHAQUE point marquerait trop en rouge
vif ; jamais utilisé pour du texte (il ne tiendrait pas le contraste, et ce
n'est pas son rôle : l'information textuelle passe par la ligne de synthèse).

## L'après, vérifié en capture

- **Le mur** : noir, points d'incident en braise `#7d332b` sans lueur, un
  SEUL rouge vif — la ligne « 100 incidents critiques ouverts. ». Vérifié sur
  le jeu d'essai en feu : l'écran reste noir même à cent incidents.
- **Le rail** : anneau blanc, toujours ; le critique est un point rouge de
  8 px au coin du bouton. Le logo n'est plus jamais teinté.
- **L'accueil interne** : les cartes d'attention passent de trois lavis
  rouges à six porteurs fins (arête gauche + icône) ; la preuve et le titre
  redeviennent de l'encre. La ligne d'alerte sous la salutation reste LE
  rouge de synthèse de l'écran.
- **StatusBadge** : le mot redevient neutre, le point ne pulse plus — douze
  pannes se lisent d'un balayage de points, sans cri.
- **Puces SSL, priorité de tâche, bannières persistantes** (factures en
  retard, zone dangereuse du dossier client, événements) : un porteur rouge
  chacune (arête ou encre), fond neutre.

## Vérifié légitime, conservé tel quel

- La cloche de notifications compte les CRITIQUES uniquement (relu dans le
  code) — son badge rouge est un signal exact, pas un compteur de non-lus.
- Les erreurs de formulaire (`role="alert"`) : momentanées, causées par un
  geste — le rouge dans son rôle.
- Les gestes destructeurs (poubelles au survol, confirmations) : le rouge
  n'apparaît que sous l'intention.
- Le bouton de raccroché d'appel (convention téléphonie), la pastille REC de
  l'enregistreur vocal (convention d'enregistrement), l'icône de l'écran de
  panne (ErrorBoundary — l'événement le plus rare du produit).
- Les montants négatifs / échus (facturation, événementiel) : UN porteur par
  ligne, l'encre du chiffre lui-même.
