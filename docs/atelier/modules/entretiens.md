# Visites d'entretien (`entretiens`)

**Famille** outils · **Action** terrain · **Niveau** courant · **Route proposée** `/visites-entretien`

## Le besoin

Un chauffagiste, un frigoriste ou une entreprise de sécurité incendie vit de
contrats d'entretien : chaque installation chez un client doit être revue à
une périodicité fixée. Le suivi se fait souvent sur un cahier ou un tableur,
et les visites oubliées sont du chiffre d'affaires perdu, parfois un client
perdu. Le catalogue facture des abonnements (`subscriptions`) et organise la
tournée d'un jour (`rounds`), mais rien ne dit **quelle installation est due
ce mois-ci**.

## Ce que fait le module

- Un parc d'installations : client, type (chaudière, pompe à chaleur,
  climatisation, VMC, extincteurs, adoucisseur), commune, dernière visite,
  périodicité en mois.
- Quatre compteurs : en retard, ce mois-ci, sous 30 jours, à jour.
- **À planifier ce mois-ci, par commune** : les visites en retard et dues ce
  mois, regroupées par commune (la plus en retard d'abord), pour composer la
  tournée.
- Le parc complet, trié par prochaine visite, filtrable par état.
- Un bouton : **marquer faites aujourd'hui** les visites cochées (dans la
  tournée ou dans le parc) ; leur prochaine échéance repart de ce jour.
- Ajouter une installation (bouton secondaire).

## Règles

- Prochaine visite = dernière visite + périodicité ; un 31 qui n'existe pas
  devient le dernier jour du mois (31 janvier + 1 mois = 28 ou 29 février).
- États, par rapport au jour : en retard si l'échéance est passée
  (strictement avant aujourd'hui) ; ce mois-ci si elle tombe dans le mois en
  cours, aujourd'hui compris ; sous 30 jours si elle tombe dans les 30 jours
  suivants ; à jour sinon.
- Refusé : client ou commune vides, date impossible (30 février) ou future,
  périodicité qui n'est pas un nombre entier de mois entre 1 et 120.
- Dates en `AAAA-MM-JJ`, calculées en UTC. Le bac à sable vit au 22 octobre 2026.

## Visites obligatoires

Le module ne décide pas de ce qui est obligatoire : la périodicité est celle
du contrat, saisie par l'artisan. Pour mémoire, sans valeur de conseil :

- les chaudières dont la puissance nominale est comprise entre 4 et 400 kW
  font l'objet d'un **entretien annuel** obligatoire (décret n° 2009-649 du
  9 juin 2009) ;
- les extincteurs font l'objet de vérifications périodiques (Code du travail,
  consigne de sécurité incendie ; la périodicité annuelle est l'usage courant,
  **à vérifier** selon le référentiel suivi) ;
- pour la climatisation et les pompes à chaleur, les obligations dépendent de
  la puissance et du fluide : **à vérifier**, rien n'est affirmé ici.

Une évolution possible : proposer la périodicité par défaut selon le type,
avec la source affichée, une fois ces règles vérifiées.

## Hors périmètre

Prise de rendez-vous avec le client, ordre optimal des arrêts (c'est le
travail de `itineraries`), facturation de la visite, compte rendu
d'intervention (`interventions`).
