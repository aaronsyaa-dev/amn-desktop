# Document unique des risques (`duerp`)

**Famille** outils · **Action** conformité · **Niveau** courant · **Route proposée** `/document-unique`

## Le besoin

Tout employeur, dès le premier salarié, doit évaluer les risques
professionnels et les consigner dans un document unique (DUERP), avec un plan
d'action. Dans une petite entreprise, ce document est souvent un tableur
oublié depuis l'embauche. Le catalogue a `gdpr`, `csr` et `kyc` en
conformité, rien sur la santé et la sécurité au travail.

## Ce que fait le module

- Unités de travail (atelier, chantier, déplacements, bureau…) et, pour chacune,
  des risques : catégorie, danger en une phrase, gravité 1 à 4, probabilité 1 à 4,
  mesures existantes, action prévue, responsable, échéance, case « faite ».
- Liste triée par criticité décroissante, puis par échéance la plus proche ;
  filtre par unité.
- Chiffres : risques recensés (dont critiques et élevés), actions en retard,
  risques élevés ou critiques sans aucune action prévue.
- Bandeau de mise à jour : date de la dernière revue, alerte au-delà d'un an,
  bouton « noter la revue d'aujourd'hui ».
- Formulaire d'ajout d'un risque, avec les erreurs dites en texte.
- Un bouton blanc : copier le plan d'action (actions ouvertes, triées, retards signalés).

## Règles

- Criticité = gravité × probabilité (1 à 16). Niveaux : faible 1–3, moyen 4–6,
  élevé 8–9, critique 12–16. Grille d'usage courant (méthodes INRS / CARSAT) :
  le Code du travail impose l'évaluation (art. L4121-3 et R4121-1), pas une
  méthode de cotation. Le module le dit à l'écran.
- Action en retard : action prévue, non faite, échéance strictement passée
  (le jour même n'est pas en retard).
- Mise à jour : art. R4121-2 du Code du travail, au moins chaque année dans les
  entreprises d'au moins onze salariés, et dans toutes lors d'une décision
  d'aménagement important ou d'une information nouvelle sur un risque. Le
  module ne surveille que l'échéance annuelle : au-delà de 365 jours, « en
  retard » à partir de onze salariés, « conseillée » en dessous. **À vérifier**
  avant intégration : la rédaction de R4121-2 issue de la loi du 2 août 2021
  et de son décret d'application.
- Saisie refusée : unité inconnue, danger vide, cote hors 1–4 ou décimale,
  date inexistante, action prévue sans échéance.

## Hors périmètre

Conservation des versions successives (40 ans depuis 2022, à vérifier),
programme annuel de prévention (≥ 50 salariés), consultation du CSE,
pénibilité, export PDF.
