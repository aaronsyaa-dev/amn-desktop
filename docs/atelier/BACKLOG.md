# Atelier F1 — backlog

> Idées de modules classées par utilité pour une petite entreprise (artisan,
> indépendant, PME). Chaque idée comble un **manque vérifié** du catalogue
> interne (142 modules, `src/refonte/navigation/registre.ts` @ `f0b8f12`) :
> la colonne « Voisin » dit ce qui existe déjà et pourquoi ce n'est pas la même
> chose. Une idée prise passe dans [`PRET.md`](PRET.md) avec son statut.

Critères de classement : combien d'entreprises en ont besoin, combien ça leur
coûte de ne pas l'avoir (argent perdu, amende, oubli), et si le module tient
seul, sans serveur ni intégration.

## Pris (passage 1, 2026-10-22)

| # | Module (`id`) | Pour qui | Le manque | Voisin dans le catalogue |
|---|---|---|---|---|
| 1 | Taux horaire de revient (`tauxHoraire`) | tous ceux qui vendent du temps | personne ne sait si son tarif couvre ses charges | `calculators` : prix e-commerce, panier, événement ; aucun taux horaire |
| 2 | Situations de travaux (`situations`) | artisans du bâtiment | facturer à l'avancement, avec retenue de garantie et acomptes déduits | `invoices` facture un montant, pas un avancement cumulé par lot |
| 3 | Pénalités de retard (`penalites`) | toute entreprise qui facture des pros | intérêts de retard et indemnité de 40 € jamais réclamés | `reminders` relance, ne calcule rien |
| 4 | Métré et quantitatif (`metre`) | peintres, carreleurs, plaquistes, poseurs | surfaces, ouvertures déduites, chute, nombre de paquets | aucun |
| 5 | Visites d'entretien (`entretiens`) | chauffagistes, frigoristes, sécurité incendie | savoir quelle installation est à visiter ce mois-ci | `subscriptions` facture, ne planifie pas ; `rounds` fait la tournée d'un jour |
| 6 | Bons cadeaux (`bonsCadeaux`) | commerces, salons, restaurants | émettre, encaisser en plusieurs fois, voir les soldes et les bons expirés | `loyalty` tamponne une carte ; rien pour un bon prépayé |
| 7 | Document unique des risques (`duerp`) | toute entreprise dès un salarié | l'évaluation des risques obligatoire, jamais tenue | `gdpr`, `csr`, `kyc` : aucune n'est la santé-sécurité |
| 8 | Indemnités kilométriques (`indemnitesKm`) | indépendants, salariés en déplacement | le barème fiscal appliqué trajet par trajet, total annuel | `expenseClaims` saisit des tickets ; `fleet` suit un véhicule |
| 9 | Vigilance sous-traitants (`vigilance`) | donneurs d'ordre, BTP | attestations URSSAF, Kbis, assurances : qui est à jour, qui expire | `kyc` vérifie une identité, pas une échéance de pièces |
| 10 | Tableau d'amortissement (`amortissements`) | indépendants et sociétés au réel | dotation par exercice, prorata, valeur nette | `loanSim` amortit un prêt, pas une immobilisation |

## À prendre ensuite

| # | Module (`id` proposé) | Pour qui | Le manque | Voisin |
|---|---|---|---|---|
| 11 | Paiement en plusieurs fois (`echeancier`) | artisans, commerces | découper une facture en échéances datées, suivre ce qui est payé | `deposits` : un acompte, pas un échéancier |
| 12 | Comparateur de devis fournisseurs (`comparateurDevis`) | PME qui achète | comparer 2 à 5 offres sur prix, délai, garantie, critères pondérés | `suppliers` : un annuaire |
| 13 | Seuils micro et TVA (`seuils`) | micro-entrepreneurs | voir venir le dépassement des plafonds sur le chiffre d'affaires cumulé | `taxForecast` prévoit l'impôt, pas les plafonds |
| 14 | Compteur de congés payés (`congesPayes`) | employeurs de 1 à 20 salariés | jours acquis, pris, restants sur la période de référence | `leaves` pose des absences, ne compte pas les droits |
| 15 | Registre unique du personnel (`registrePersonnel`) | employeurs dès un salarié | le registre obligatoire des entrées et sorties | `directory` : un trombinoscope |
| 16 | Rétroplanning (`retroplanning`) | tous les métiers à date de livraison | partir de la date due et remonter les étapes | `projects`, `board` : planifient vers l'avant |

Points d'attention pour les suivants :

- **seuils** et **congesPayes** reposent sur des règles qui changent (plafonds
  et franchise TVA en débat depuis la loi de finances 2025 ; acquisition des
  congés pendant un arrêt maladie depuis 2024). À ne faire qu'avec des valeurs
  en paramètres datés et sourcés, jamais en dur.
