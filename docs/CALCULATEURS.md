# Calculateurs métier

Un moteur, aucune formule en dur. Ce document explique **comment déclarer un
nouveau calculateur sans toucher au code du moteur** — c'est la promesse du
générateur, et c'est aussi le seul test valable de sa généricité.

## Les trois fichiers

| Fichier | Rôle |
| --- | --- |
| `src/state/calcEngine.ts` | Le moteur. Il ne connaît aucun métier. |
| `src/state/calcProfiles.ts` | Les calculateurs, déclarés en **données**. |
| `src/screens/CalculatorsScreen.tsx` | L'écran. Il ne connaît aucun métier non plus. |

Ajouter un calculateur ne touche que le fichier du milieu.

## Ce qu'est un calculateur

Trois listes :

- des **entrées** nommées — ce que la personne sait (un prix fournisseur, un
  taux de charges, un nombre d'associés) ;
- des **étapes** de calcul — des formules arithmétiques sur les entrées et sur
  les étapes précédentes ;
- parmi ces étapes, celles marquées `output: true` sont les **résultats**, et
  celle marquée `headline: true` est **la réponse** — voir plus bas.

```ts
{
  id: 'exemple-marge',
  label: 'Marge simple',
  description: 'Ce que rapporte une vente, une fois le fournisseur payé.',
  inputs: [
    { key: 'achat', label: 'Prix d’achat', kind: 'money', defaultValue: 4500 },
    { key: 'vente', label: 'Prix de vente', kind: 'money', defaultValue: 7900 },
  ],
  steps: [
    { key: 'marge', label: 'Marge', kind: 'money', formula: 'vente - achat', output: true, headline: true },
    { key: 'taux', label: 'Taux de marge', kind: 'percent', formula: 'marge / vente * 100', output: true },
  ],
}
```

Rien d'autre. L'écran l'affichera, `npm run check:calc` le validera, et il
apparaîtra dans le sélecteur — sans qu'une ligne du moteur ou de l'écran change.

### La tête : nommer LE chiffre qu'on vient chercher

`headline: true` désigne la seule étape que l'écran met en avant — plus grande,
filet d'accent, en premier. Une par profil, et forcément une sortie.

Elle existe parce qu'elle a manqué. L'écran mettait en avant la **première
sortie déclarée**, c'est-à-dire la première dans l'ordre du **calcul** — un
ordre imposé par les dépendances entre étapes, qui n'a aucune raison de
coïncider avec l'importance. Un prix client ne peut pas être calculé avant les
charges qui entrent dedans, donc « Prix client » ouvrait sur les charges
sociales. « Rentabilité d'un événement » ouvrait sur les coûts fixes, alors que
le commentaire de ce profil dit en toutes lettres que le chiffre qui compte est
le nombre d'entrées. Trois profils sur cinq annonçaient autre chose que leur
réponse.

Un chiffre juste, affiché à la place d'un autre, se lit comme une réponse.
Personne ne signale ce genre d'erreur : on lit le gros chiffre.

`check:calc` exige que tout profil livré nomme sa tête, refuse qu'il y en ait
deux, refuse une tête qui n'est pas une sortie, et **vérifie profil par profil
que c'est la bonne** — la liste attendue est écrite en clair dans le contrôle,
justifiée par la description de chaque profil. Si la tête et la description
divergent un jour, l'une des deux est fausse et il faudra choisir sciemment.

Un profil sans tête reste valide : la première sortie redevient la tête. C'est
ce qui garde un profil minimal déclarable en trois lignes.

## La recette, en quatre gestes

1. **Écrire le profil** dans `CALC_PROFILES` (`src/state/calcProfiles.ts`).
2. **Lancer `npm run check:calc`.** Le contrôle passe tous les profils déclarés
   dans `validateProfile` : une formule qui nomme une entrée inexistante, une
   clé en double, une parenthèse oubliée, un profil sans sortie — tout cela
   échoue ici, pas chez l'utilisateur.
3. **Ajouter un cas connu** dans `scripts/check-calc.ts` : une situation dont on
   connaît la réponse, calculée à la main. Une calculatrice fausse ne plante
   pas ; elle rend un chiffre crédible. C'est la seule protection réelle.
4. **Ouvrir l'écran.** Il n'y a rien à câbler.

## Les unités, une fois pour toutes

| `kind` | Unité stockée | Affichage |
| --- | --- | --- |
| `money` | **centimes entiers** | `1 234,56 €` |
| `percent` | points (22 = 22 %) | `22,0 %` |
| `number` | tel quel | entier, ou deux décimales |

L'argent est en centimes entiers de bout en bout, comme partout ailleurs dans
l'application (`src/lib/money.ts`). Les étapes `money` sont arrondies au centime
**à chaque étape**, exactement comme une ligne de facture : arrondir seulement à
la fin ferait diverger le détail affiché de son total.

## Ce que le moteur sait faire, et rien de plus

- `+`, `-`, `*`, `/`, les parenthèses, le moins unaire (`-x`) ;
- six fonctions : `min(a, b)`, `max(a, b)`, `abs(x)`, `round(x)`, `ceil(x)`,
  `floor(x)`.

`ceil` et `floor` existent pour les grandeurs qui se **comptent**. Le seuil de
rentabilité d'un événement valait 103,37 : personne ne vend 0,37 entrée, et
`round` aurait affiché 103, c'est-à-dire un seuil auquel l'événement perd
encore de l'argent. Le sens du calcul décide de l'arrondi, donc c'est au profil
de le dire — le moteur ne devine pas.

C'est volontairement peu. Le besoin réel est de l'arithmétique commerciale ; un
moteur qui essaie de tout prévoir devient un langage à maintenir.

Deux refus délibérés :

- **Pas d'`eval`.** Une formule est du texte, et l'objectif est qu'elle puisse un
  jour venir d'une configuration éditée dans l'application. `eval` en ferait une
  exécution de code arbitraire dans le rendu. Le contrôle refuse explicitement
  `process.exit(1)`, `constructor.constructor(…)`, `__proto__`, les gabarits
  entre accents graves.
- **Pas de graphe de dépendances.** Une étape ne voit **que** les entrées et les
  étapes qui la précèdent. Les cycles sont donc impossibles par construction :
  aucune détection à écrire, donc aucune détection à déboguer.

La division par zéro lève **au moment de la division**, et pas seulement en
constatant un résultat non fini à la fin. La nuance a l'air théorique : sans
elle, `min(10 / 0, 5)` vaut `5` — un chiffre parfaitement crédible et faux.

## Une étape en échec ne casse pas le reste

Elle est signalée sous les résultats, avec sa raison, et **retirée de la
portée** : les étapes qui en dépendent échouent proprement à leur tour, au lieu
de propager un `NaN` jusqu'à un prix affiché « NaN € » dont personne ne saurait
dire quelle ligne l'a produit.

## Les profils livrés

| `id` | Ce qu'il répond |
| --- | --- |
| `ecommerce-prix-client` | À quel prix vendre pour dégager la marge visée, URSSAF et frais d'encaissement compris. |
| `evenementiel-rentabilite` | Combien d'entrées vendues couvrent les frais, et à quel prix. |
| `groupe-cagnotte` | Combien chacun met, et combien de temps il reste pour y arriver. |
| `startup-repartition` | Une part de départ entre fondateurs, capital et temps pondérés. |

### Le raisonnement du prix client (le cas AllStore)

Il mérite d'être écrit, parce que l'**ordre** des opérations est ce qui décide
du chiffre :

```
margeBrute    = margeVisee / (1 - tauxCharges / 100)
charges       = margeBrute - margeVisee
aEncaisser    = coutFournisseur + fraisLivraison + margeBrute
prixClient    = (aEncaisser + fixeTransaction) / (1 - tauxTransaction / 100)
fraisPaiement = prixClient - aEncaisser
partAssocie   = margeVisee / max(associes, 1)
```

Deux points où l'intuition se trompe :

- **Les frais Stripe portent sur le prix encaissé**, pas sur le montant qu'on
  veut toucher. Il faut donc *remonter* par une division par `1 - taux`, et non
  ajouter le pourcentage à la fin. Ajouter 1,5 % au lieu de diviser par 0,985
  laisse une perte à chaque vente, invisible sur une commande et bien réelle
  sur un mois.
- **L'URSSAF porte sur la marge**, pas sur le chiffre d'affaires ni sur le prix
  d'achat. La marge brute est donc « gonflée » avant d'être ajoutée au coût.

Un cas connu vérifié à la main est dans `scripts/check-calc.ts` : la veste à
45 € de l'énoncé, marge visée 20 €, URSSAF 22 %, Stripe 1,5 % + 0,25 €.

## La synthèse mensuelle

Sous les calculateurs, elle répond à « combien on a gagné ce mois-ci, et qui
touche quoi ». Elle ne **stocke rien** : elle agrège la Facturation (factures
marquées payées ce mois-là), les Dépenses, et le module Temps. Une base
parallèle de « chiffres du mois » divergerait de la facturation à la première
correction faite d'un côté et pas de l'autre.

Deux modes de répartition :

- **Équitable** — le bénéfice divisé par le nombre d'associés ;
- **Pondérée par le travail** — au prorata du temps réellement enregistré sur le
  mois.

Le second n'est possible que parce que chaque enregistrement synchronisé porte
l'adresse de son auteur (`WRITER_KEY` dans `SyncContext`) : le temps est donc
attribuable sans avoir eu à ajouter un champ « qui » au module Temps.

Quand la pondération est demandée mais qu'aucun temps n'a été enregistré, elle
retombe sur l'équitable **et le dit à l'écran**. Une répartition annoncée
« pondérée » qui est en fait équitable, sans le signaler, se découvre au moment
du virement.

La répartition est faite en **centimes entiers**, le reste de la division
distribué un centime à la fois aux plus grosses parts. Sans cela, 100 centimes
entre trois associés donnent trois fois 33 et un centime s'évapore — sur douze
mois, les comptes ne tombent plus juste et personne ne sait pourquoi.

## Le module

`calculators` est un module d'organisation comme les autres : il figure dans
`ORG_MODULES` (amn-api), dans les deux catalogues du desktop, et sa route est
gardée par `<ModuleRoute module="calculators">`. `npm run check:modules` vérifie
que ces listes s'accordent.
