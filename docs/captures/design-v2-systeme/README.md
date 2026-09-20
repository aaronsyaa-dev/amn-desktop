# Famille Système — captures sur données réelles

Bac à sable local (compte `design@exemple.test`, base sqlite fictive), bundle
Business à 1180 px. Le jeu d'essai est celui de `scripts/perso-essai.mjs` :
coffre-fort et journal d'ouvertures inclus, puisque ces deux-là ne passent pas
par l'API et laisseraient sinon les écrans vides.

| Capture | Ce qu'elle prouve |
| --- | --- |
| `assistance.png` | Les points du diagnostic sont MESURÉS : cinq ici, parce que le sixième (les places) n'est pas mesurable sur une organisation sans plafond. Un seul ambre alors que deux points sont à vérifier. |
| `decouvrir.png` | La carte lit le journal d'ouvertures : familles à 5/15, 2/13, 0/6… La recommandation unique (QR codes) est DÉDUITE de la famille la moins explorée (Outils), pas choisie. |
| `coffre-ferme.png` | La porte refuse : sept secrets annoncés, catégories en barres, aucune valeur. L'ambre est le cadran, et lui seul. |
| `coffre-ouvert.png` | Le même écran après un clic sur le cadran — et plus aucun ambre, parce qu'un coffre ouvert ne demande rien. |
| `parametres.png` | Le plan, et le compte « CITÉS 12 FOIS » de la rubrique Profil : les douze modules sont nommés dessous, et `npm run check:consequences` ouvre les douze fichiers pour vérifier qu'ils lisent bien ce réglage. |
| `membres-sans-plafond.png` | Le cas RÉEL de ce compte : AMN DevSec n'a pas de plafond de places (`seatsForOrg` renvoie `null`), donc aucune place vide n'est dessinée — en inventer une serait faux. |
| `membres-places-payees.png` | Le cas d'une cliente ordinaire : six places payées, cinq prises, **la vide dessinée comme les autres**, cadre en pointillé et mention qu'elle est comprise dans l'abonnement. Obtenue en donnant six places à l'organisation du bac à sable le temps de la capture ; `amn-api` a été remis en état juste après, et rien de cette bascule n'est parti dans un patch. |

Rien ici n'est une maquette : chaque chiffre vient de la base du bac à sable ou
du stockage local du navigateur de capture.
