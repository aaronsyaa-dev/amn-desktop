# Vigilance sous-traitants (`vigilance`)

**Famille** outils · **Action** conformité · **Niveau** avancé · **Route proposée** `/vigilance-sous-traitants`

## Le besoin

Un donneur d'ordre qui confie un contrat d'au moins 5 000 € HT doit vérifier
que son sous-traitant est en règle (déclarations et cotisations sociales,
immatriculation). Sans ces pièces, il peut être tenu solidairement des
cotisations et pénalités en cas de travail dissimulé. Dans le bâtiment, il
faut en plus l'attestation d'assurance décennale. Le suivi se fait d'ordinaire
à la main, et les attestations expirent en silence. Le catalogue a `kyc`
(vérifier une identité), rien sur l'échéance des pièces.

## Ce que fait le module

- Sous-traitants fictifs : métier, contact, montant HT du contrat, et trois
  pièces (date de l'attestation URSSAF, date de l'extrait d'immatriculation,
  date de fin de l'assurance).
- Réglages : seuil d'obligation (5 000 € par défaut), validité retenue pour
  l'extrait d'immatriculation (3 mois), fenêtre d'alerte (30 jours). Un
  réglage illisible est signalé et retombe sur sa valeur par défaut.
- Chiffres : bloquants, à relancer, à jour, non concernés.
- Tableau trié du plus urgent au plus tranquille : état du sous-traitant et
  état de chaque pièce (valide jusqu'au…, expire le…, expirée le…, manquante,
  date à vérifier).
- Relances : un message groupé, une partie par sous-traitant, qui dit quelle
  pièce manque ou expire. Un bouton blanc : copier la relance groupée.

## Règles

- Obligation à partir de 5 000 € HT : art. L8222-1 et D8222-1 du Code du
  travail. Montant égal au seuil : concerné.
- Attestation de vigilance URSSAF : à la conclusion du contrat puis tous les
  six mois jusqu'à la fin de son exécution (art. D8222-5). Le module la tient
  pour valide jusqu'à la veille du même jour six mois plus tard (31 août →
  27 février, la fin de mois étant ramenée au dernier jour existant).
  Lecture prudente : **à vérifier** sur la doctrine URSSAF.
- Justificatif d'immatriculation (extrait Kbis, répertoire des métiers…) :
  exigé par D8222-5. La règle « moins de trois mois » est un **usage**, pas un
  délai lu dans le texte : elle reste un réglage.
- Assurance : valide jusqu'à sa date de fin, incluse. L'assurance décennale
  est obligatoire pour les travaux de bâtiment (art. L241-1 du Code des
  assurances). Elle ne relève pas de la vigilance URSSAF : une assurance
  manquante ou expirée fait « à relancer », jamais « bloquant ».
- État d'une pièce : expirée si la fin de validité est passée ; « expire »
  si elle tombe dans la fenêtre d'alerte (dernier jour compris) ; une date de
  délivrance dans le futur ou inexistante est « à vérifier ».
- État d'un sous-traitant concerné : bloquant si URSSAF ou immatriculation
  manque, a expiré ou est à vérifier ; à relancer si une pièce expire bientôt
  ou si l'assurance manque ; à jour sinon.

## Hors périmètre

Vérification en ligne de l'attestation (code de sécurité URSSAF : réseau
exclu du bac à sable), sous-traitants étrangers (pièces différentes),
liste nominative des salariés étrangers, archivage des pièces.
