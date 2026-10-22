# Atelier F1 — backlog

> Idées de modules classées par utilité pour une petite entreprise (artisan,
> indépendant, PME). Chaque idée comble un **manque vérifié** du catalogue
> interne (142 modules, `src/refonte/navigation/registre.ts` @ `f0b8f12`) :
> la colonne « Voisin » dit ce qui existe déjà et pourquoi ce n'est pas la même
> chose. Une idée prise passe dans [`PRET.md`](PRET.md) avec son statut.
>
> Classement : combien d'entreprises en ont besoin, combien coûte de ne pas
> l'avoir (argent perdu, amende, oubli), si le module tient seul sans serveur,
> et si ses règles sont sûres (une règle mouvante descend dans la liste).

## À prendre (passage 2)

| # | Module (`id` proposé) | Famille · action | Pour qui | Le manque | Voisin |
|---|---|---|---|---|---|
| 1 | Point mort (`pointMort`) | argent · prévoir | toutes | le chiffre d'affaires et la date à partir desquels l'année devient rentable | `calculators` : seuil d'un événement, pas de l'entreprise |
| 2 | Révision de prix par indice (`revisionPrix`) | argent · facturer | BTP, maintenance, services sous contrat | appliquer P = P0 × (a + b × I / I0) avec les indices saisis (BT, Syntec) | aucun |
| 3 | Délais de paiement (`delaisPaiement`) | argent · facturer | toutes | délai moyen réel des clients et des fournisseurs, factures au-delà du plafond légal | `reminders` relance, ne mesure pas |
| 4 | Garanties après réception (`garantiesClients`) | outils · terrain | BTP | parfait achèvement, biennale, décennale : ce qui court encore, chantier par chantier | `contracts` suit des contrats, pas les garanties légales |
| 5 | Heures supplémentaires (`heuresSupp`) | jour · equipe | employeurs | majorations et contingent annuel consommé, par salarié | `time` note le temps, ne le qualifie pas |
| 6 | Plan de charge (`planDeCharge`) | jour · equipe | ateliers, agences, BTP | charge vendue face à la capacité de l'équipe, semaine par semaine | `shifts` fait les horaires, pas la capacité |
| 7 | Inventaire de fin d'exercice (`inventaireAnnuel`) | outils · stock | commerces, ateliers | feuille de comptage, écarts, stock valorisé à la clôture | `stock` suit le stock courant, sans valorisation de clôture |
| 8 | Compteur de congés payés (`congesPayes`) | jour · equipe | employeurs de 1 à 20 salariés | jours acquis, pris, restants sur la période de référence | `leaves` pose des absences, ne compte pas les droits |
| 9 | Visites médicales du travail (`visitesMedicales`) | outils · conformite | employeurs | la prochaine visite de chaque salarié (information et prévention, suivi renforcé) | `health` : santé personnelle, pas celle des salariés |
| 10 | Seuils micro et TVA (`seuils`) | argent · comptabilite | micro-entrepreneurs | voir venir le dépassement des plafonds sur le chiffre d'affaires cumulé | `taxForecast` prévoit l'impôt, pas les plafonds |
| 11 | Taux de TVA des travaux (`tvaTravaux`) | argent · facturer | artisans du bâtiment | 5,5, 10 ou 20 % selon le logement et la nature des travaux, attestation à garder | aucun |
| 12 | Registre de sécurité (`registreSecurite`) | outils · conformite | commerces recevant du public | vérifications périodiques (extincteurs, électricité, alarme), dernière et prochaine | `entretiens` vise les installations des clients, pas les siennes |
| 13 | Affichages obligatoires (`affichagesObligatoires`) | outils · conformite | employeurs | ce qu'il faut afficher selon l'effectif, coché ou non | aucun |
| 14 | Tour d'astreinte (`astreintes`) | jour · equipe | dépannage, maintenance | rotation équitable des astreintes, échanges, compteur par personne | `shifts` : horaires, sans équité de rotation |
| 15 | Consignes et prêts d'emballages (`consignes`) | argent · vendre | grossistes, brasseurs, traiteurs | fûts, palettes, caisses prêtés : qui en doit combien | `equipment` : matériel interne seulement |

## Points d'attention

- **Règles mouvantes** (n° 8 à 13) : valeurs en paramètres datés et sourcés,
  jamais en dur ; tout ce qui n'est pas sûr est écrit « à vérifier » dans la
  spec et à l'écran. Pour `seuils` (plafonds et franchise TVA en débat depuis
  la loi de finances 2025) et `congesPayes` (acquisition pendant un arrêt
  maladie depuis la loi du 22 avril 2024), vérifier le texte en vigueur le
  jour même, ou ne pas faire.
- **Données personnelles** (n° 5, 8, 9) : même condition que
  `registrePersonnel` à l'intégration (accès RH et dirigeant, registre RGPD).
- **Familles** : les modules `outils · terrain` et `outils · conformite`
  attendent la même décision que S1 (8e famille « terrain » ou non).

## Pris

- Passage 1 (2026-10-22), 14 modules : `tauxHoraire`, `situations`,
  `penalites`, `metre`, `entretiens`, `bonsCadeaux`, `duerp`, `indemnitesKm`,
  `vigilance`, `amortissements`, `echeancier`, `comparateurDevis`,
  `retroplanning`, `registrePersonnel`. Notes et statuts dans [`PRET.md`](PRET.md).
