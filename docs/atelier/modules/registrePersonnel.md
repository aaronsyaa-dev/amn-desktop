# Registre unique du personnel (`registrePersonnel`)

**Famille** outils · **Action** conformité · **Niveau** courant · **Route proposée** `/registre-du-personnel`

## Le besoin

Tout établissement qui emploie des salariés tient un registre unique du
personnel, présenté à l'inspection du travail sur demande. Les très petits
employeurs l'oublient ou le tiennent incomplet (qualification, titre de
travail, stagiaires mélangés aux salariés). Le catalogue a un trombinoscope
(`directory`), rien pour ce registre.

## Ce que fait le module

- Le registre dans l'ordre des embauches, en deux parties : salariés, puis
  stagiaires ; numéro d'ordre, mentions, présent ou sorti.
- Chiffres : salariés présents, mentions manquantes, points à vérifier.
- « À traiter » : mention manquante, titre de travail expiré ou qui expire
  sous 60 jours, ligne sortie depuis plus de cinq ans (peut être retirée).
- Un bouton : inscrire une embauche (refusé tant qu'une mention manque).

## Règles (Code du travail)

- L1221-13 : registre dans tout établissement employant des salariés ;
  stagiaires dans une partie spécifique.
- D1221-23 : nom, prénoms, nationalité, date de naissance, sexe, emploi,
  qualification, dates d'entrée et de sortie, nature du contrat hors CDI à
  temps plein, et pour un travailleur étranger soumis à autorisation, type et
  numéro d'ordre du titre.
- R1221-26 : conservation cinq ans à compter du départ.
- La date de fin de validité du titre n'est pas une mention du registre : elle
  est suivie parce que l'employeur doit s'assurer que l'autorisation reste
  valable. Le délai d'alerte (60 jours) est un choix de l'atelier.
- À vérifier avant intégration : la liste exacte des mentions propres aux
  stagiaires (tuteur, lieu de stage) ajoutées par la loi de 2014, non reprises ici.

## Hors périmètre

Le registre légal lui-même (mentions indélébiles, version papier ou
électronique conforme), la DPAE, les intérimaires mis à disposition (mention
de l'entreprise de travail temporaire). Données personnelles : à l'intégration,
accès réservé aux rôles RH et dirigeant, et mention au registre RGPD.
