# Système de design v2 — rapport de fin de chantier

**71 modules, 5 états transverses, deux éditions.** Ce document dit ce qui a été
livré, comment chaque module prouve son COMPORTEMENT (et pas seulement son
dessin), où le paquet de design a été contredit et pourquoi, et ce qui reste à
faire par un humain.

---

## 1. Le compte, et pourquoi il ne tombe pas sur 68

Le chantier a été ouvert sur « 68 modules ». `MODULES.md` en numérote **71**,
et se compte lui-même à « soixante-seize écrans » — 71 modules + 5 états.
L'écart vient du découpage, pas d'un oubli :

| Famille | Modules dans `MODULES.md` |
| --- | --- |
| Pilotage | 16 |
| Clients & revenus | 15 |
| Production | 13 |
| Documents | 4 |
| Collectif | 7 |
| Outils | 5 |
| Personnel | 6 |
| Système | 5 |
| **Total** | **71** |

`npm run check:modules` lit les catalogues réels et conclut : **71 en Business,
94 en interne, 64 en support.** Les 94 − 71 = 23 écrans supplémentaires de
l'édition interne sont précisément La Garde, la Supervision, le Parc et les
Produits — exclus du chantier, et jamais touchés. Les 64 du contexte de support
sont les 71 moins sept exclusions documentées (`NOT_IN_SUPPORT`).

**Aucun module de la liste n'a été sauté.** Les 71 sont composés, les 5 états
sont partagés.

---

## 2. La preuve, module par module

Le chantier s'interdisait de livrer « l'esprit » d'une entrée : *si une entrée
dit qu'un curseur se déduit de sa valeur par une formule précise, cette formule
doit être dans le code*. Ce qui suit n'est donc pas la liste des dessins, c'est
la liste des COMPORTEMENTS vérifiés sur données réelles.

### La règle de preuve

Trois niveaux, appliqués à chaque module :

1. **Le code porte la règle**, pas une approximation — une constante nommée, une
   fonction, un commentaire qui dit pourquoi.
2. **La garde le mesure** — `check:signal` compte l'ambre dans un vrai
   navigateur, `check:contraste` mesure chaque texte rendu, `check:encres` relit
   439 fichiers, `check:persistence` croise chaque module avec ce qu'amn-api
   accepte, `check:consequences` ouvre les fichiers qu'un compteur prétend citer.
3. **La capture le montre sur de vraies données** — jamais sur un compte vide.

### Les preuves que seules de vraies données ont pu donner

Le détail par module est dans les commentaires d'en-tête de chaque écran et dans
les messages de commit. Voici les preuves de comportement les plus difficiles,
celles qu'un rendu statique n'aurait pas pu simuler :

| Module | Ce qui est prouvé, et comment |
| --- | --- |
| `20a` Messages privés | L'espace vertical EST du temps : `blancDe()` rend 16 px par jour, borné à 160. Un silence de six jours mesure 96 px sur la capture, et le délai habituel est la MÉDIANE des réponses passées. |
| `20d` Groupes | La zone centrale du diagramme est l'intersection EXACTE, par `clipPath` imbriqués, et le jeton d'une personne est posé au barycentre de sa région, échantillonné au pas de 3 px. |
| `19b` Annonces | La moins lue est triée par PORTÉE puis par date, jamais par date seule : sur données réelles, c'est une annonce ancienne à 2/5 qui remonte, pas la dernière écrite. |
| `19c` Sondages | Les bâtons se groupent par cinq avec l'oblique du cinquième, et le lien au plan d'équipe est calculé : « 4 h posées le jeudi, pour un besoin de 12 h — il en manque 8 ». |
| `19e` Absences | La fermeture d'atelier est DÉDUITE (les jours où tout le monde a un congé approuvé), pas déclarée. Le carnet à souches a exigé une vraie collection `leaveQuotas` — sans total, il ne peut rien dessiner. |
| `20b` Appels | Une durée qui ne vit que dans l'état React n'est pas un journal : le module écrit désormais dans une collection `calls` au raccrochage ET aux deux endroits qui marquent un appel manqué. |
| `20c` QR codes | Le compteur de scans est incrémenté par une route publique d'amn-api, prouvée de bout en bout : deux POST non authentifiés ont fait passer `scans` de 0 à 2 ; un code inconnu répond 404. |
| `21b` Calculatrice pro | Une annulation pose une LIGNE à −90,00 €, jamais une suppression, et les taux viennent de `VAT_RATES` + `billing.vatExempt`. |
| `21c` Convertisseurs | Le curseur unique est rendu en segments empilés, et une règle dégénérée (des kilomètres sur un axe de 0 à 5 m) est retirée au lieu d'afficher « 0,00 » à toutes les positions. |
| `24a` Habitudes | Le fléau est une VRAIE barre en deux moitiés qui partagent les colonnes des plateaux ; son extrémité et le plateau bougent de la même valeur, donc le bras de suspension garde une longueur constante. |
| `21d` Courses | Le prix proposé vient de la DERNIÈRE liste soldée, les rayons suivent l'ordre où ils y sont apparus, et un article sans prix connu écrit un tiret — puis le reste à prendre dit qu'il sera plus élevé en caisse. |
| `21e` Journal perso | La ligne d'eau et les points partagent la MÊME fonction d'ordonnée. Le seul constat de l'écran — « le creux du mois n'a aucune entrée écrite » — est vérifié sur trente jours réels. |
| `25d` Objectifs perso | Un mois compte comme tenu par une règle LUE dans un autre module (19 jours d'habitude sur 18 requis), jamais déclarée ici. |
| `26a` Assistance | Les points du diagnostic sont MESURÉS : sur une organisation sans plafond de places, il y en a cinq et non six, et l'écran ne prétend pas le contraire. |
| `26b` Découvrir | Les compteurs viennent de `NAV_SECTIONS`, la même source que la barre latérale ; la recommandation unique est déduite de la famille la moins explorée EN PART (Outils, 0/6 → QR codes). |
| `26d` Paramètres | « CITÉS 12 FOIS » est réel : douze fichiers listés, et `npm run check:consequences` les ouvre un par un pour vérifier qu'ils lisent encore le réglage. |
| `27d` Le refus | Les deux sorties sont calculées sur l'occupation réelle de la journée : le dernier créneau libre AVANT, le premier APRÈS. |
| `27e` Le hors-ligne | La file est celle du produit (`amn.sync.__envoi`), et chaque wagon est nommé par son module via un pont vérifié contre les collections qu'amn-api accepte. |

### Les captures

Neuf dossiers, tous sur le bac à sable rempli, jamais sur un compte vide :

```
docs/captures/design-v2-pilotage/     design-v2-commerce/
docs/captures/design-v2-production/   design-v2-documents/
docs/captures/design-v2-collectif/    design-v2-outils/
docs/captures/design-v2-personnel/    design-v2-systeme/
docs/captures/design-v2-etats/
```

Les deux derniers portent un `README.md` qui dit, image par image, comment
l'état a été provoqué.

---

## 3. Les arbitrages — là où le paquet a été contredit

La consigne était nette : *si une entrée contredit ce que le vrai modèle de
données permet, dire clairement lequel des deux a raison et pourquoi plutôt que
d'inventer un compromis silencieux.* Chacun de ces arbitrages est aussi écrit
dans le code concerné.

### Ceux où le PRODUIT a raison

| Entrée | Ce que dit `MODULES.md` | Ce qui a été fait, et pourquoi |
| --- | --- | --- |
| `20a` Messages privés | Le trait ambre du silence « précède » la bulle | Dans un fil chronologique, le silence non répondu SUIT nécessairement le dernier message. Le trait a été placé après, et seul le silence en cours est ambre. |
| `26e` Membres | « Les cinq personnes du trombinoscope ne sont pas cinq comptes » | Dans ce produit, si : le Trombinoscope lit la même liste de membres. Il n'existe pas de fiche de personne sans compte. L'écran dit la vérité du produit. |
| `26e` Membres | Chaque place donne accès à certaines familles | Les modules sont ouverts PAR ORGANISATION, jamais par rôle (`ModuleRoute` lit la formule). Toutes les places voient les mêmes familles ; ce qui diffère réellement est nommé : Personnel jamais partagé, gestes de Système réservés. |
| `26d` Paramètres | « Les cinq derniers changements » et « le prochain prélèvement » | Aucun changement de réglage n'est journalisé (le journal enregistre des GESTES), et rien n'est facturé automatiquement. Le panneau dit les deux absences au lieu de les meubler. |
| `27c` L'assistant | Étapes *Offre, Tarif, Mission* | Ce produit n'a pas cet objet. Le formulaire long réel est le contrat, et ses trois étapes gardent le même principe dans le même ordre : ce que c'est, ce que ça vaut, jusqu'à quand. |
| `26c` Coffre-fort | « La phrase de passe n'est pas récupérable » | Il n'y a pas de phrase de passe : il y a un trousseau de machine qui ne voyage pas. La conséquence est la même et l'écran l'écrit — si la machine disparaît, les secrets aussi. |
| `21b` Calculatrice pro | Un ruban devient un devis | `Quote` n'a pas d'items structurés : chaque ligne du ruban devient une ligne de TEXTE du devis. Aucune marge n'est affichée sans prix d'achat. |

### Ceux où le PAQUET a raison, contre une règle interne

| Entrée | L'arbitrage |
| --- | --- |
| `20a` Trombinoscope | `MODULES.md` donne l'ambre à la fiche ouverte, alors que le module « ne demande rien ». La règle du paquet l'emporte : le commentaire de `check-signal.mjs` a été mis à jour pour dire pourquoi. |

### Ceux qui ont demandé une vraie donnée plutôt qu'un dessin

| Module | Ce qui manquait | Ce qui a été créé |
| --- | --- | --- |
| `19e` Absences | Un TOTAL de droits — impossible de dessiner un carnet à souches sans lui | Collection `leaveQuotas`, saisie à la main, sans acquisition ni ancienneté (donc pas une paie), **sans valeur par défaut inventée**. |
| `20b` Appels | Aucun journal d'appels | Collection `calls` : qui, dans quel sens, quand, combien de temps. Rien du contenu. |
| `20c` QR codes | Un compteur qu'un poste ne peut pas tenir (celui qui scanne n'a pas de compte) | Route publique `POST /v1/qr/:orgId/:codeId/scan` — incrémente seulement, ne crée rien, freinée par adresse. |
| `21b` Calculatrice pro | Le module n'existait pas | Écran + collection `calcTapes`. |
| `24c` Interventions | Le module n'existait pas | Écran + collection `interventions`. |
| `25e` Carnet de santé | Le module n'existait pas | Écran local au poste, sans aucune collection. |
| `26b` Découvrir | Aucune trace de ce qui a déjà été ouvert | `src/state/useModulesOuverts.ts`, local au poste et par compte. |
| `27e` Le hors-ligne | La file d'envoi n'exposait qu'un COMPTE | `SyncContext` expose la file (nature et heure, jamais les données) + `src/data/collectionsModules.ts`. |

### Les choix de confidentialité, assumés

- **Courses (`21d`) et Carnet de santé (`25e`) sont LOCAUX.** La synchronisation
  est par organisation ; la famille Personnel promet « jamais partagés ». Une
  collection synchronisée aurait rendu la promesse fausse.
- **`health` rejoint `budget` et `courses` dans `NOT_IN_SUPPORT`** : en session
  de support, ces écrans montreraient les dates de l'opérateur sous la bannière
  de la cliente.
- **Le journal des modules ouverts reste sur le poste** : sur le serveur, il
  deviendrait une donnée d'organisation, donc lisible par les collègues. Une
  carte d'exploration personnelle qu'un autre peut lire n'est plus personnelle.
- **Le journal des ouvertures du coffre reste sur le poste** : c'était la seule
  chose qui n'en sortait pas encore — QUAND quelqu'un ouvre son coffre.
- **Ni le Journal perso ni le Carnet de santé n'entrent dans le diagnostic
  d'Assistance**, pas même comptés, et l'écran le dit.

---

## 4. L'état des gardes, mesuré

Dernière exécution complète, sur le bac à sable rempli :

| Garde | Résultat |
| --- | --- |
| `check:signal` | **70 écrans mesurés, aucun à plus d'un objet ambre.** Les écrans vides n'en portent aucun et n'affichent aucun relevé à zéro. |
| `check:contraste` | **72 écrans + 19 vues de détail + 31 bascules, 13 169 textes, aucun sous WCAG AA.** |
| `check:encres` | 439 fichiers, 28 jetons, aucun défaut ; 28 copies connues en attente. |
| `check:ecrans` | 86 écrans par `ScreenHeader`, 20 dispensés pour une raison nommée. |
| `check:langue` | 8 contrôles sur 2 760 clés (+ 214 entrées de navigation). |
| `check:modules` | 71 Business, 94 interne, 64 support — les catalogues s'accordent. |
| `check:consequences` | **Nouveau.** 2 réglages à conséquence, 15 lecteurs vérifiés fichier par fichier. |
| `check:persistence` | À sa ligne de base : un seul échec, `budget`, antérieur au chantier. |
| `tsc` / `lint` | Propres ; 0 erreur, 83 avertissements (ligne de base du dépôt). |

**Deux gardes ont été rendues moins aveugles pendant le chantier :**

- `check:signal` lit désormais `fill` et `stroke` : elle ignorait tout instrument
  dessiné en SVG, et comptait donc zéro objet sur des écrans qui en portaient un.
- `check:signal` ET `check:contraste` posent désormais le jeu d'essai des écrans
  qui ne passent pas par l'API (Personnel, Coffre-fort, carte de Découvrir). Sans
  lui, ces écrans étaient mesurés VIDES — et une garde qui compte un MAXIMUM
  déclarait en règle un écran qu'elle n'avait pas mesuré.

---

## 5. Les deux éditions

**À jour toutes les deux, et vérifiées au rendu, pas seulement à la
compilation.**

- Édition **Business** : construite, et c'est celle que toutes les gardes et
  toutes les captures mesurent.
- Édition **interne** : construite, puis OUVERTE écran par écran dans un vrai
  navigateur sur les huit écrans neufs ou refondus (Carnet de santé, Courses,
  Habitudes, Calculatrice pro, Membres, Assistance, Coffre-fort, Contrats).
  Chacun rend son titre et son contenu ; **aucune erreur de page**.
- Contexte de **support** : `check:modules` vérifie que son rangement reflète
  celui de la cliente, aux sept exclusions documentées près.

**Un écart signalé, pas corrigé.** `habits`, `personalGoals`, `diary` et
`pomodoro` lisent `localStorage` par compte, exactement comme `budget`,
`courses` et `health` — mais ils sont restés dans le contexte de support. Un
opérateur y verrait donc SES propres habitudes sous la bannière de la cliente.
C'est un écart antérieur à ce chantier ; le corriger retire quatre modules du
contexte de support, ce qui est une décision de produit, pas de design.

---

## 6. Les deux patchs amn-api — à appliquer

`amn-api` vit dans un autre dépôt et n'a pas été poussé. Les changements de
serveur que ce chantier rend nécessaires sont exportés en clair :

```
docs/patchs/amn-api-interventions.patch
docs/patchs/amn-api-qr-scan.patch
docs/patchs/README.md          ← dit ce que chacun fait et pourquoi
```

À appliquer depuis la racine d'`amn-api` :

```
git apply /chemin/vers/amn-desktop/docs/patchs/amn-api-interventions.patch
git apply /chemin/vers/amn-desktop/docs/patchs/amn-api-qr-scan.patch
```

**Tant qu'ils ne sont pas appliqués et déployés :**

- Interventions, Absences (les droits), Appels, QR codes et Calculatrice pro
  fonctionnent en local, mais leurs collections ne se synchronisent pas : les
  carnets de congés et le journal d'appels resteront vides sur le téléphone.
- Les clés `health` et `calcPro` n'existent pas au catalogue serveur : **le
  serveur les refuserait à la création d'une organisation.**
- Les compteurs de scans QR restent à leur valeur de départ.

---

## 7. Ce qu'Harun doit essayer lui-même

Ce que ni une garde ni une capture ne peut trancher :

**Le jugement de fond**

1. **La famille Personnel a-t-elle le bon ton ?** Six objets, aucun score, aucune
   série, aucun rappel. C'est un choix fort : ouvrir Habitudes et Journal perso
   et dire si l'absence de série soulage ou frustre.
2. **Le Coffre-fort fermé.** La porte ne chiffre rien — elle évite qu'un coffre
   ouvert reste affiché. Est-ce utile, ou est-ce un clic de plus chaque jour ?
3. **Découvrir recommande UN module.** Vérifier que la recommandation tombe juste
   sur un vrai espace, et pas seulement sur le bac à sable.
4. **L'assistant des contrats.** Trois étapes au lieu d'une grille de six
   champs : est-ce plus lent à remplir la dixième fois ?

**Les parcours à exercer en vrai**

5. **Le refus de créneau**, sur Matériel, avec deux personnes qui réservent la
   même ressource au même moment.
6. **Une vraie coupure réseau** (couper le Wi-Fi, pas simuler) : saisir trois
   choses, ouvrir Assistance, vérifier que la file les nomme correctement, puis
   rebrancher et vérifier qu'elles partent.
7. **Le scan d'un QR code depuis un téléphone**, une fois le patch déployé.
8. **Un premier jour réel** : créer une organisation neuve et regarder l'accueil.
   Le bac à sable simule cet état en vidant le miroir ; une vraie organisation
   neuve peut se comporter autrement.

**Les limites connues, à trancher**

9. **Le responsive.** Les 76 écrans sont composés à 1180 px. Les seuils de repli
   ne sont pas définis — le paquet de design le dit lui-même, et ce chantier ne
   les a pas inventés.
10. **Les états de chargement** ne sont pas composés (hors périmètre du paquet).
11. **L'écart des quatre modules Personnel en support** (§5) : décision de
    produit.
12. **`check:persistence` échoue toujours sur `budget`** — deux écritures locales
    pour une déclarée. C'est antérieur au chantier et n'a pas été touché pour ne
    pas masquer une dette sous un chantier de design.
