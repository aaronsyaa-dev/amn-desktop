# Audit du backlog — ce qui existe déjà, et ce qui n'existe pas

*Bloc 0 du chantier « Audit du backlog, nouveaux modules, ergonomie de
supervision ». Établi en lisant le code sur `main` et en exerçant l'application
empaquetée, pas en relisant des notes.*

La consigne était : regarder avant de construire, et ne pas refaire ce qui est
fait. Voici ce que la lecture a donné, item par item. Quand la réponse est
« ça n'existe pas », c'est écrit ainsi — un « partiellement » complaisant
coûterait un chantier entier à quelqu'un qui s'y fierait.

---

## 1. Les calculateurs

**Ce qui existe.** Un moteur générique (`src/state/calcEngine.ts`) où un
calculateur est une **donnée** : des entrées nommées, des étapes de calcul dans
l'ordre, des sorties. Aucune formule n'est codée en dur, `eval` n'est pas
utilisé, et les cycles sont impossibles par construction (une étape ne voit que
ce qui la précède). Quatre profils métier sont déclarés, plus un personnel
ajouté par ce chantier. `npm run check:calc` les valide tous sans rien savoir
d'eux, et vérifie plusieurs cas calculés à la main.

Le calculateur e-commerce répond à la bonne question — « quel prix client pour
qu'il me reste la marge visée, une fois tout payé » — et l'ordre des
soustractions y est juste : les frais de transaction se prennent sur le prix
encaissé (d'où la division par `1 - taux`), les charges sur la marge.

**Ce qui manque, et qui était demandé.**

| Demande | État | Ce qu'il faudrait |
|---|---|---|
| Charges **par ligne** | Absent | Le calculateur traite un article. Un panier à plusieurs lignes, chacune avec son coût et sa charge, demande une entrée de type « liste » que le moteur ne connaît pas. C'est un ajout au **moteur**, pas un profil de plus. |
| **Seuil de rentabilité** e-commerce | Absent | Il existe en événementiel (`seuilEntrees`), pas en e-commerce. Le prix plancher — celui en dessous duquel on perd de l'argent — se calcule avec les entrées déjà présentes : c'est une étape à ajouter au profil, quelques lignes de configuration. |
| **Fourchette de prix** | Absent | Le calculateur rend UN prix. Une fourchette suppose une marge basse et une marge haute, donc deux entrées de plus et deux sorties. Là aussi : de la configuration, pas du code. |

**Coût estimé** : le seuil et la fourchette sont deux petites additions au
profil existant. Les charges par ligne sont un vrai chantier de moteur.

> **Fait depuis, et vérifié le 29 août.** Les trois manques ci-dessus sont
> comblés, et ce tableau ne décrit plus l'état du code :
>
> - les **charges par ligne** existent — le moteur connaît un bloc de lignes
>   (`CalcRowBlock` dans `src/state/calcEngine.ts`), et le profil
>   `ecommerce-panier` s'en sert ;
> - le **prix plancher** (seuil de rentabilité e-commerce) est une étape du
>   profil `ecommerce-prix-client` ;
> - la **fourchette** y est aussi, sous la forme de deux entrées de marge —
>   basse et confortable — qui encadrent la marge visée sans la remplacer.
>
> Ce paragraphe est conservé plutôt que réécrit : un audit est daté, et effacer
> ce qu'il disait ferait perdre le fait que ces trois points ont bien été
> ouverts puis fermés.

---

## 2. Le module « événementiel »

**Il n'existe pas.** Ce qui existe porte ce nom et n'est pas ça :

- un **calculateur** `evenementiel-rentabilite` (coûts fixes, recette nette par
  billet, entrées pour l'équilibre, marge salle comble) ;
- un **profil métier** `evenementiel` dans l'atelier de création, qui propose un
  jeu de modules et une couleur.

Il n'y a **aucune clé de module** `evenements` dans `MODULE_CATALOGUE`
(amn-api), donc aucun écran, aucune collection, aucune route. Une organisation
événementielle reçoit aujourd'hui l'agenda, les projets et le calculateur — ce
qui est déjà cohérent, mais ce n'est pas un module dédié.

**Bonne nouvelle pour la suite** : le moteur de pages du bloc 3 est fait pour
ça. Une « fiche d'événement » est une page à portée `evenement`, exactement
comme la liste de courses est une page à portée `personnel`. Le module
événementiel se construit donc sur du déjà-posé, pas à partir de rien.

---

## 3. Le lien d'appel sur Mac / Safari

**Déjà diagnostiqué et corrigé à la source**, et le diagnostic est écrit en
toutes lettres dans `src/lib/publicUrl.ts`.

La cause n'a rien de spécifique à Safari : le lien se fabriquait avec
`window.location.origin`. Dans un navigateur, cela donne `https://…`. Dans
l'application **installée**, le renderer est chargé par `loadFile()`, donc
`origin` vaut `file://` et le lien produit est un chemin sur la machine
d'Aaron :

```
file:///C:/Users/…/index.html#/appel?token=…
```

Collé dans Safari sur un Mac, il n'ouvre rien — mais il n'ouvrirait rien dans
aucun navigateur, sur aucune machine autre que celle qui l'a produit. Le
symptôme « ça marche chez moi, pas chez le prospect » vient de là.

Le correctif : **le serveur** rend désormais l'adresse complète avec le jeton
(`CreatedCallLink.url`), et `publicUrl.ts` ne sert plus que de repli pour le
build web, où `window.location` est une vraie adresse publique. Quand aucune
adresse n'est connue, l'application **refuse** de fabriquer un lien et explique
pourquoi, plutôt que d'en fabriquer un faux — un lien faux est pire qu'une
absence de lien.

> **Point de vigilance, à vérifier en production.** Ce correctif dépend d'une
> variable d'environnement sur amn-api : `APP_PUBLIC_URL` (et
> `APP_BUSINESS_PUBLIC_URL` pour les liens d'activation des clientes). Sur
> l'instance de test, elles ne sont pas réglées, et l'API rend alors `url: null`
> — l'écran affiche le jeton seul et prévient. **Si elles ne sont pas réglées en
> production, le bug est toujours vivant pour l'utilisateur final**, non pas
> parce que le code est faux mais parce qu'il n'a rien à quoi se raccrocher.
> C'est une ligne de configuration, à faire une fois.

---

## 4. Bloc H — la discussion avec les clientes

**Il n'existe pas, et rien n'y ressemble.** Aucune trace dans le desktop ni
dans amn-api : pas de collection, pas de route, pas d'écran.

Ce qui pourrait prêter à confusion : le module **Équipe** (`team`, collection
`messages`) est une messagerie **interne** à AMN DevSec. Elle est explicitement
exclue de l'édition Business — « outil de collaboration, sans objet pour une
personne seule » — et n'est donc reliée à aucune cliente.

Le bloc H reste donc entièrement à faire. La consigne du chantier l'excluait
« sauf si le bloc 0 révèle qu'il est déjà bien avancé ailleurs » : il ne l'est
pas, l'exclusion tient.

**Bloc J** (revue de design) : hors du champ de cette lecture, non évalué.

---

## Ce que l'audit a trouvé sans le chercher

Deux défauts réels, non demandés, corrigés pendant le chantier — ils sont
documentés ici parce qu'ils disent quelque chose sur la forme du projet.

**Une sixième liste de modules que rien ne croisait.**
`CONFIGURABLE_MODULES` (`src/data/tradeProfiles.ts`) alimente l'atelier de
création *et* sert de point de départ à `check:persistence`. Le module `pages`,
déclaré partout ailleurs, y manquait : l'atelier ne savait pas l'ouvrir, et le
contrôle de persistance ne demandait jamais où vivait sa donnée. Deux contrôles
sur trois étaient aveugles à un module entier, sans qu'aucun échoue.

**Une règle qui vivait dans le contrôle et pas dans l'application.**
Les modules « toujours ouverts » étaient déclarés dans
`scripts/check-modules.mjs` uniquement. `isModuleEnabled` ne connaissait que
`home` et `settings`, donc la section Personnel ne s'affichait chez aucune
cliente dont les modules sont listés explicitement — pendant que le contrôle
restait vert. La liste vit désormais dans `src/data/spaces.ts`, et le script
l'y **relit** au lieu d'en tenir une copie.

Le point commun : dans les deux cas, la même information était écrite à deux
endroits. C'est le motif de défaut le plus fréquent de ce dépôt, et la parade
qui marche est toujours la même — une source, et un contrôle qui va la lire là
où elle est plutôt que d'en garder un double.
