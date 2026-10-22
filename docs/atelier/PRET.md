# Atelier F1 — prêt à intégrer ?

> Une ligne par module. Notes sur 5 : **U**tilité, **Q**ualité du code,
> **D**esign (noir et gris, un bouton blanc, point de famille, lisible sur
> téléphone), **T**ests, **S**écurité (bac à sable, pas de réseau, saisies
> bornées, données sensibles), **I**solation (édition cliente intacte, rien de
> branché, supprimable seul).
>
> Statuts : idée · en cours · prêt à intégrer · rejeté (avec la raison).
> « Prêt à intégrer » veut dire : vérificateur vert, gardes communes vertes,
> logique relue, aperçu regardé en image à 1280 et 390 px. Le choix d'intégrer
> reste à Harun. Les conditions listées en remarque sont à remplir **au moment**
> de l'intégration.

État au passage 1 (2026-10-22), branche `claude/refonte-atelier-f1` : 14 modules,
`node src/ateliers/verifier.mjs` → 128 propriétés vertes, dont 110 tests.

| Module | Famille · action · niveau | U | Q | D | T | S | I | Statut | Remarques |
|---|---|---|---|---|---|---|---|---|---|
| `tauxHoraire` Taux horaire de revient | argent · prévoir · essentiel | 5 | 4 | 5 | 4 | 5 | 5 | **prêt à intégrer** | Aucun taux de cotisation en dur. Réel et micro. |
| `retroplanning` Rétroplanning | jour · organiser · essentiel | 5 | 4 | 4 | 5 | 5 | 5 | **prêt à intégrer** | Fériés de métropole calculés (Pâques testé 2025-2027). Pas de Gantt parallèle. |
| `penalites` Pénalités de retard | argent · facturer · courant | 5 | 4 | 5 | 5 | 5 | 5 | **prêt à intégrer** | Condition : taux BCE et taux légal d'exemple (2,15 % et 3,15 %) à remplacer par ceux du semestre ; ce sont des paramètres. Lettre de mise en demeure générée. |
| `situations` Situations de travaux | argent · facturer · avancé | 5 | 4 | 4 | 5 | 5 | 5 | **prêt à intégrer** | Retenue de garantie plafonnée à 5 % (loi 71-584), calculée sur le TTC ; réglage HT à ajouter si un client le demande. Le tableau défile en largeur sur téléphone. |
| `metre` Métré et quantitatif | outils · terrain · courant | 5 | 4 | 4 | 5 | 5 | 5 | **prêt à intégrer** | Calcul en cm entiers. Pièces rectangulaires seulement. `aValider` : famille « terrain » (même question que S1). |
| `entretiens` Visites d'entretien | outils · terrain · courant | 5 | 4 | 4 | 4 | 5 | 5 | **prêt à intégrer** | Périodicité saisie par l'artisan, aucune règle codée. `aValider` comme `metre`. Contrôles natifs en `color-scheme: dark` posé en dur : à reprendre si le thème clair s'allume. |
| `indemnitesKm` Indemnités kilométriques | argent · dépenser · essentiel | 5 | 4 | 4 | 5 | 5 | 5 | **prêt à intégrer** | Condition : barème 2024 reconduit en 2025 ; celui publié en 2026 est **à vérifier** (impots.gouv.fr, BOI-BAREME-000001). Barème appliqué au total annuel puis réparti au centime. Voitures seulement. |
| `duerp` Document unique des risques | outils · conformité · courant | 5 | 4 | 4 | 4 | 5 | 5 | **prêt à intégrer** | Grille de cotation = usage INRS/CARSAT, présentée comme telle. Conservation 40 ans des versions hors périmètre. Page longue sur téléphone. |
| `vigilance` Vigilance sous-traitants | outils · conformité · avancé | 4 | 4 | 5 | 5 | 5 | 5 | **prêt à intégrer** | Seuil 5 000 € HT (D8222-1), attestation tous les 6 mois (D8222-5). « Kbis de moins de 3 mois » = usage, en réglage. Surtout BTP. |
| `echeancier` Paiement en plusieurs fois | argent · facturer · courant | 4 | 4 | 5 | 5 | 5 | 5 | **prêt à intégrer** | La 1re échéance absorbe les centimes ; dates recalculées depuis la 1re (pas de glissement au 28). |
| `amortissements` Tableau d'amortissement | argent · comptabilité · avancé | 4 | 4 | 4 | 5 | 5 | 5 | **prêt à intégrer** | Linéaire, prorata 30/360 ; somme des dotations = valeur au centime (432 combinaisons testées). Seuil petit matériel 500 € HT **à vérifier**. Pas de dégressif. |
| `comparateurDevis` Comparateur de devis | argent · dépenser · courant | 4 | 4 | 4 | 5 | 5 | 5 | **prêt à intégrer** | Signal d'offre anormalement basse (> 30 % sous la moyenne des autres), jamais un rejet. |
| `registrePersonnel` Registre unique du personnel | outils · conformité · courant | 4 | 4 | 4 | 4 | 4 | 5 | **prêt à intégrer** | Condition : données personnelles, accès réservé RH et dirigeant, mention au registre RGPD. Mentions propres aux stagiaires (tuteur, lieu) **à vérifier** et à ajouter. |
| `bonsCadeaux` Bons cadeaux | argent · vendre · courant | 4 | 4 | 5 | 5 | 3 | 5 | **en cours** | Bloquant pour l'intégration : le code est déterministe (bijection du numéro + clé de contrôle), donc devinable. Il faut un code tiré au hasard côté serveur avant tout usage réel ; la clé de contrôle peut rester. Le reste (soldes, expiration, encaissement partiel) est prêt. |

## Idées écartées

| Idée | Raison |
|---|---|
| Fiches recettes et allergènes | Couvert par `bom` (nomenclatures, coût de revient, recette). |
| Clôture de caisse (ticket Z) | Couvert par `cashCount`. |
| Diagramme de Gantt | Couvert par `projects` et `board` ; le manque réel était le calcul à rebours, fait dans `retroplanning`. |
| Taux de marge et coefficient de vente | Couvert par `calculators` (prix client, marge). |
| Suivi des devis non signés | Couvert par `pipeline` (affaires) et `clients` (devis). |
| Seuils micro-entreprise et franchise TVA, pour ce passage | Reporté, pas rejeté : plafonds et franchise en débat depuis la loi de finances 2025 ; à ne faire qu'avec des valeurs vérifiées le jour même (voir `BACKLOG.md`). |

## Ce que l'atelier n'a pas vérifié

- Le rendu dans l'application (règle : ne pas la lancer). Les aperçus sont le
  vrai écran, mais hors de `AppLayout`, avec le fond noir et gris posé à la main
  par-dessus les jetons graphite du socle.
- Les champs date natifs s'affichent au format de la langue du navigateur
  (Chromium de test en anglais : `mm/dd/yyyy`), limite connue du dépôt.
- L'accessibilité au lecteur d'écran, au-delà des étiquettes et de
  `aria-live` posés dans le code.
- Les valeurs légales marquées « à vérifier » ci-dessus.
