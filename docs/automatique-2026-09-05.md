# L'Automatique — rapport au réveil

Chantier « de la voiture manuelle à l'automatique », nuit du 5 au 6 septembre 2026. Point de départ : branches `avant-automatique` sur les deux dépôts. Arrivée : amn-desktop `7ecff1d` (branche `claude/first-pr-github-setup-ltpqqo`), amn-api `22770fc` (`main`). Tous les gardes sont verts sur les deux dépôts ; `check:postgres` passé avant chaque poussée d'amn-api ; `check:migration` intact ; `version` intacte (1.2.44) ; données de test uniquement.

## Bloc 0 — H24, d'abord

### La preuve que la Garde tourne sur Render : ce que j'ai pu, ce que je n'ai pas pu

Je **n'ai pas pu lire Render depuis ce bac à sable** : `onrender.com` est bloqué par le mandataire de la session. Je ne peux donc pas vous montrer un battement lu en production cette nuit. Ce que j'ai fait à la place, pour que la preuve existe sans moi :

- **Un battement public** : `GET /v1/health` rend `garde: { actif, dernierBattementAt, depuisMs, tickMs, agents, enRetard, interruption }`. Quiconque l'ouvre sait, à la seconde, si la Garde bat.
- **Un témoin qui tourne hors de nous** : l'action GitHub `garde-h24.yml` (amn-api) interroge ce battement toutes les dix minutes et **échoue** si le dernier battement a plus de quinze minutes ou si un garde est en retard. Le premier vert de cette action, lu dans l'onglet Actions du dépôt, est la preuve H24 — je ne l'ai pas vue, elle vous attend.
- **La Garde surveille la Garde** : une ronde qui manque son heure devient une remontée haute (« garde-retard »), une interruption du serveur (trou entre deux battements) devient une remontée critique au redémarrage, datée, avec sa durée. Si Render a dormi cette nuit, Ajmani le dira ce matin dans « À votre avis », en premier.
- **Le plan gratuit de Render** : un service qui s'endort après quinze minutes sans requête ne tient pas H24 par nature. Le keep-alive existant et l'action toutes les dix minutes le réveillent ; `docs/H24.md` dit le reste et ce qu'un plan payant changerait.

### Pourquoi les badges clignotaient

Deux causes, mesurées sur le poste : le badge « Garde » se réécrivait à chaque trame reçue (présence, ronde, journal) et portait une animation de « ping » ; l'indicateur de synchronisation basculait « reprise / synchronisé » à chaque micro-coupure. Mesure sur 90 secondes, même écran, même données : **7 changements visibles avant, 0 après**. Le badge ne lit plus que le niveau (calme, attention, critique), au plus une fois par minute, et ne se cache qu'après trois échecs consécutifs ; l'indicateur attend deux secondes avant d'annoncer une reprise. Capture : `docs/captures/automatique-2026-09-05/00-badges-stables.jpg`.

### Une seule source pour « quand a tourné quoi »

`/v1/admin/supervision` ne calcule plus ses propres heures de balayage : il les **dérive de la Garde** (`source: 'garde'`, chaque moniteur relié à sa ronde par `RONDE_PAR_MONITEUR`). La Tour de contrôle lit la même chose, dans un seul panneau « La Garde, de fond » (battement, retards, interruption). Il n'y a plus deux horloges qui se contredisent. Capture : `01-tour-garde-fond.jpg`.

## Écran par écran, avant / après

Mesure : mots lisibles dans `<main>` (poste, 1440 × 900), paragraphes de plus de deux lignes. Captures dans `docs/captures/automatique-2026-09-05/{avant,apres}-{interne,business}/`, poste et téléphone.

| Écran (interne) | Avant | Après | Retiré | Ce qui a changé |
|---|---:|---:|---:|---|
| Tour de contrôle | 5 788 | 879 | −4 909 | exceptions d'abord, Garde de fond, six incidents et un lien, le reste replié |
| La Salle | 1 082 | 281 | −801 | un garde = une ligne, équipes repliées, repos résumé, chiffres à mémoire |
| Ajmani | 1 557 | 602 | −955 | une conversation, trois suites, catalogue derrière « ? », historique plié |
| À votre avis | 779 | 406 | −373 | contexte plié, « Décidées à l'instant », dossiers qui se retirent |
| Bureau des Sites | 2 493 | 1 135 | −1 358 | journal à douze lignes, règles sous « Détails » |
| Bibliothèque | 3 080 | 1 221 | −1 859 | cartes d'une ligne, détail au survol |
| Accueil interne | 249 | 252 | 0 | inchangé (déjà court) ; carte « Quel est votre poste ? » |
| Incidents | 249 | 252 | 0 | inchangé |
| Tâches | 3 469 | 3 323 | −146 | attribution « par la Garde » clampée ; les 30 pavés restants sont les descriptions des tâches de test elles-mêmes (voir « Ce qui reste ») |

| Écran (édition cliente, espace vide) | Avant | Après | Retiré | Ce qui a changé |
|---|---:|---:|---:|---|
| Accueil | 109 | 60 | −49 | une carte de bienvenue et rien qui la répète ; plus de trois cartes vides |
| Bibliothèque | 109 | 74 | −35 | Bloc 1 |
| Réglages | 109 | 74 | −35 | Bloc 1 |
| Clients | 70 | 69 | −1 | plus de répertoire creux ; état vide illustré d'un trait |

Auto-notation (≥ 4/5 deux fois de suite, plus « est-ce que ça donne envie de lire ? ») : Tour 4/5, 4/5 ; Salle 4/5, 4/5 ; Ajmani 4/5, 4/5 ; À votre avis 4/5, 4/5 ; Accueil cliente 4/5, 4/5 ; Clients 4/5. Ce qui m'empêche de mettre 5 : le mur de la Salle reste dense en capitales monospace sur téléphone, et Ajmani dépend encore de la longueur des réponses du Lexique (« qui est arrivé cette nuit ? » sur six organisations tient en une phrase de six membres).

## Bloc 2 — Futurisme sobre

### Recensement : les décisions que l'écran prenait pour vous, et celles qu'il prend maintenant

| Décision | Avant | Maintenant |
|---|---|---|
| Quelle équipe regarder dans la Salle | à rechoisir à chaque ouverture | mémorisée sur le poste (« amn.garde.salle.equipe ») |
| Que faire ensuite dans la conversation avec Ajmani | à deviner, catalogue ouvert | ≤ 3 suites proposées après chaque réponse (Bloc 3) |
| Quoi lire d'abord dans la Tour | tout, à plat | exceptions d'abord, la Garde de fond (Bloc 0) |
| D'où vient un chiffre de la Salle | un nombre nu | sa courbe sur sept jours, comptée par le serveur, jamais simulée |
| Un dossier décidé disparaît | d'un coup, on perd le fil | il se retire d'un souffle ; « Décidées à l'instant » compte ce que vous venez de faire |
| Quel poste choisir à la première ouverture | carte proposée, rien de pré-choisi | inchangé : rien dans les données ne permet de deviner sans se tromper, on ne pré-coche pas au hasard |

### Ce qui change à l'écran

- **L'anneau qui respire** : le pouls (Salle, Ajmani, Tour) respire au rythme du rail — quatre secondes au calme, plus court quand quelque chose attend. Plus aucun « ping » radar : ni sur le pouls, ni sur un garde en ronde, ni sur un site en ligne (le point « à jour » des Signes Vitaux le remplace). La couleur glisse en 700 ms quand l'état change au lieu de sauter.
- **Les chiffres à mémoire** : l'en-tête de la Salle porte « Remontées, 7 jours » et « Réglé seul, 7 jours » avec leur courbe fantôme. Le serveur compte par jour (`/v1/garde/salle` → `series`) ; le poste ne fabrique aucun historique (`serieFluxComptee`, gardée par `check:vitaux`).
- **Le mouvement qui dit quelque chose** : une bulle d'Ajmani arrive d'un glissement de six pixels ; un dossier décidé se replie. `prefers-reduced-motion` : les deux deviennent une simple apparition/disparition (`useReducedMotion`), et le souffle devient une intensité fixe.
- **Ludique, sérieusement** : dans « À votre avis », un relevé « Décidées à l'instant » compte ce que vous avez décidé depuis l'ouverture de l'écran — un compteur qui compte, pas un score, pas de confettis.
- **Parole** : une organisation disparue n'est plus nommée par son identifiant (« chez ba1426c2-… ») : on ne dit rien plutôt qu'un identifiant.

### Mesure

Captures dans `docs/captures/automatique-2026-09-05/apres-interne/` (poste et téléphone).
Auto-notation : Salle 4/5 (deux fois), À votre avis 4/5, Ajmani 4/5. « Est-ce que ça donne envie de lire ? » — la Salle et la pile, oui ; Ajmani reste dépendant de la longueur de ses réponses (voir Bloc 5).

Limite dite : le souffle et le glissement ne se voient pas sur une capture fixe ; ils se vérifient en ouvrant l'écran (classes `sv-souffle-*`, `motion.li`).


## Bloc 3 — Jarvis : Ajmani est une conversation

Il parle en premier (le salut, une proposition, ses aveux), on répond, il propose **au plus trois suites** — jamais un catalogue, le guide reste derrière « ? ». Le Lexique parle avec le contexte (« Certificats a relu douze sites, rien à dire, prochaine dans une heure »), **une voix par garde** (rotation des tournures décalée par garde), et ne dit plus « prochaine à l'instant » quand c'est dans dix minutes. Ollama, quand il est là, reformule **sans inventer** : `reformulerSansInventer` refuse toute reformulation qui ajoute ou retire un nombre, un nom, un point d'exclamation, ou qui s'allonge de moitié (`check:reformuler`).

### Conversation-témoin, cette nuit, sur le parc d'essai (serveur local, sans clé Anthropic)

> **comment ça va ?** — Critique : 200 points critiques. En veille : 20 gardes. À votre avis : 204 points, dont 200 critiques. *Suites : Rassemble-moi les tâches · Fais le tour des bureaux*
>
> **qu'est-ce qui m'attend ?** — quatre dossiers : 200 incidents critiques non pris chez AMN DevSec (critique) ; Grosse Essai a 5 comptes pour 2 places (normale) ; Deux organisations portent le nom « Boutique Journal SAS » (normale) ; deux jetons non recevables (normale). *Suites : Qui n'a pas payé ? · Les demandes en attente*
>
> **fais le tour des bureaux** — Un point critique d'abord : 200 incidents critiques non pris chez AMN DevSec ; Grosse Essai a 5 comptes pour 2 places ; Deux organisations portent le nom « Boutique Journal SAS ». Ensuite, six points réglés sans vous, 9600 remontées. / Chef des Sites (Garde des Sites) — Sur la période : 62 rondes, trois réglés seul, aucun remonté. / … *Suites : Rassemble-moi les tâches · Qu'est-ce que tu vas faire demain ?*
>
> **dis-moi ce que tu penses de la météo** — Je n'ai pas compris. Dites-moi quoi faire en quelques mots : une ronde, une organisation, un module, une période. Sans clé Anthropic sur le serveur, je ne comprends que les tournures du Lexique ; « ? » les montre.
>
> **je ferme pour ce soir** — Ce qui vous attend : un dossier — 200 incidents critiques non pris chez AMN DevSec. Cette nuit, la Garde fera 21 rondes ; je ne vous dérange que pour le critique. Bonne soirée. *Suites : Qu'est-ce que tu vas faire demain ? · On va s'absenter trois jours*

Avant cette nuit, « qu'est-ce qui m'attend ? » rendait trente lignes identiques (« Incident critique chez AMN DevSec non pris depuis 2 jours … ×103 », trente fois) ; on le voit encore dans l'historique de la capture, plié derrière « Lire plus ».

### Les chiffres de variété (`check:parole`, serveur)

207 tournures sur 109 clés, 30 intentions, 435 phrases en dur relues dans 16 fichiers : aucun point d'exclamation, aucune servilité, aucun « (s) », typographie française posée, genres connus. Journée simulée (20 gardes × 24 rondes) : **0 répétition immédiate**, tournure la plus fréquente **8 %** d'une journée, **70 %** de phrases distinctes sur le mur au pire instant. Côté poste, 574 clés FR/EN de la Garde relues par le même garde.

## Bloc 4 — L'édition cliente

### Ce qui change

- **Une chose d'abord** : un espace encore vide n'affiche plus trois cartes vides (« Aucun rendez-vous », « Rien en attente », « Aucune fiche ») ni des raccourcis qui répètent la carte de bienvenue. Il affiche la carte de bienvenue, ses trois gestes, et la ligne des points d'attention. Les cartes reviennent avec la première donnée.
- **Une seule absence parle** : quand l'espace vit mais qu'une carte est vide, la première le dit, les suivantes se taisent (opacité réduite), comme le veut la règle 3 de `EmptyState`.
- **Le Majordome, un degré plus chaud** : « Rien de nouveau pendant votre absence ; tout vous a attendu » (FR/EN). Le verdict « Tout va bien. » reste tel quel, gardé par `check:releve`.
- **États vides illustrés, sobrement** : `FirstRun` accepte le glyphe du module, en filet, à la taille du titre. Pas d'image, pas de couleur — un trait qui dit « c'est ici ». Appliqué aux Clients, où le répertoire vide (une boîte creuse) n'apparaît plus avant la première fiche.
- **Moins de texte** : la carte de bienvenue perd sa phrase juridique (« Tout ce que vous créez ici n'appartient qu'à votre organisation ») — c'est vrai, et c'est dans les conditions ; ce n'est pas ce qu'on lit en ouvrant la porte. Chaque geste porte le bon glyphe (un devis n'a plus l'icône d'une fiche client).

### Mesure

Captures dans `docs/captures/automatique-2026-09-05/apres-business/`. Accueil vide : 4/5 (deux fois) ; Clients vide : 4/5. « Est-ce que ça donne envie de lire ? » — oui pour l'accueil vide, qui tient en une carte.
Limite dite : les captures sont prises sur un compte d'essai sans données ; l'accueil « vivant » (cartes remplies, une seule absence qui parle) est vérifié par le code et les gardes, pas par une capture.

## Bloc 5 — Le cerveau d'Ajmani (serveur)

Le texte libre que le Lexique ne comprend pas est confié à un modèle Claude, appelé par le serveur avec **sa** clé (`ANTHROPIC_API_KEY`), jamais par un poste. Il ne sait faire que lire, par onze outils qui sont des tournures du Lexique rejouées sans trace ; **aucun outil ne modifie** quoi que ce soit. Trois gardes : la **garde des faits** (un chiffre ou un nom propre absent de la question et des outils rejette la réponse ; c'est la parole des outils qui est rendue, et le rejet est compté), le **budget** (`AJMANI_BUDGET_EUR`, 10 € par défaut, dur ; compteur dans les réglages d'Ajmani, « Son cerveau »), le **périmètre** (interne seulement ; courriels et téléphones pseudonymisés ; la mémoire par personne indexée par empreinte). Modèle courant pour l'ordinaire, modèle de raisonnement pour « pourquoi / explique / compare » ; prompt système en cache. Tâches de fond après le tour des bureaux : la Relève en trois lignes, des brouillons de réponse aux demandes en attente — proposés, **jamais envoyés**. Sans clé : rien ne casse, Ajmani le dit (voir la conversation-témoin). Le détail et le périmètre de confidentialité : `amn-api/docs/AJMANI-CERVEAU.md`. Sept tests avec un faux serveur (`test/cerveau.test.js`).

## Bloc 6 — Les courriels (serveur)

Sept courriels dans la voix du Majordome, FR/EN, texte d'abord puis HTML noir sur blanc sans image ni rouge : lien de bienvenue, réinitialisation de mot de passe (autonome, jeton d'une heure à usage unique, même réponse pour une adresse inconnue), rapport mensuel, préavis d'impayé, réactivation, notification critique (**opt-in**), lettre (**opt-in**, lien de désabonnement par empreinte). Envoi par Resend (`RESEND_API_KEY`, `EMAIL_FROM`), journal `courriers` sans le corps, **jamais un mot de passe** (`check:emails` en CI). La Garde des Comptes envoie le préavis et la réactivation ; l'escalade envoie la notification critique à qui l'a demandée. Sans clé : rien ne part, le journal dit « manuel », le poste dit « votre prestataire a été prévenu » comme avant ; avec la clé, « un courriel vient de partir ». Le domaine `amn-devsec.com` (SPF, DKIM, DMARC) : `amn-api/docs/EMAILS.md`. Six tests (`test/courrier.test.js`).

## Ce qui reste, sans enjoliver

- **Rien de vu en production.** Render est inaccessible depuis ce bac à sable : le battement H24, le badge stable et le cerveau n'ont été vérifiés que localement et par tests. La preuve H24 attend le premier vert de `garde-h24.yml`.
- **Le cerveau et le courrier n'ont pas parlé à un vrai serveur.** Sans clé Anthropic ni clé Resend ici, tout est vérifié contre de faux serveurs qui imitent leur contrat. Le premier vrai appel se fera chez vous ; la garde des faits et le journal sont là pour le lire.
- **Les tarifs** dans `cerveau.js` sont ceux que je connais ; le modèle de raisonnement est à vérifier contre la grille du jour. Le dernier appel du mois peut dépasser le plafond de son propre coût : mettez aussi un plafond côté console Anthropic.
- **Le poste ne montre pas encore le journal des courriels ni les brouillons du cerveau** : ils se lisent par `GET /v1/courrier` et `GET /v1/garde/cerveau`. L'écran viendra quand il y aura quelque chose à y lire.
- **Les Tâches** gardent trente paragraphes longs : ce sont les descriptions des tâches de test elles-mêmes (des incidents du parc d'essai), pas de la chrome. Les plier cacherait ce qu'une tâche dit.
- **« Quel est votre poste ? »** n'est pas pré-choisi : rien dans les données ne permet de deviner sans se tromper.
- **L'historique d'Ajmani** garde les vieilles réponses longues d'avant cette nuit ; elles sont pliées, pas réécrites.
- **Le souffle et le glissement** ne se voient pas sur une capture fixe ; ils se vérifient en ouvrant l'écran.
- **Le plan gratuit de Render** ne tient H24 que réveillé ; c'est dit dans `docs/H24.md`.

## Ce qu'Aaron doit faire

1. **Anthropic** : créer une clé, poser un plafond de dépense (10 €/mois) sur la console, la renseigner sur Render (`ANTHROPIC_API_KEY`, `AJMANI_BUDGET_EUR=10`).
2. **Resend** : créer le compte, ajouter `amn-devsec.com`, poser les quatre enregistrements DNS donnés par le tableau de bord, puis `RESEND_API_KEY`, `EMAIL_FROM="AMN DevSec <garde@amn-devsec.com>"`, `COURRIER_SECRET`.
3. **Redéployer** amn-api ; le journal de démarrage dit « le cerveau d'Ajmani est en ligne » et « [courrier] en ligne ».
4. **Lire** l'onglet Actions d'amn-api : le premier vert de « garde-h24 » est la preuve H24.
5. **Ouvrir** la Tour et la Salle en production : le badge « Garde » ne doit plus bouger que quand l'état change.

## Ce que j'ai cassé

Rien cette nuit sur les données réelles (je n'y ai pas accès). Sur le parc d'essai local : rien de nouveau ; le parc reconstruit hier (`scripts/parc-essai.mjs`) a servi tel quel.
