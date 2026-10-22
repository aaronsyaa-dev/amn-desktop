# Rétroplanning (`retroplanning`)

**Famille** jour · **Action** organiser · **Niveau** essentiel · **Route proposée** `/retroplanning`

## Le besoin

Un menuisier promet une boutique pour le 18 décembre, une agence un site pour
un salon : la question n'est pas « combien de temps », c'est « quand faut-il
commencer, au plus tard, et reste-t-il de la marge aujourd'hui ? ». Les
modules `projects` et `board` planifient vers l'avant ; aucun ne part de la
date promise.

## Ce que fait le module

- Entrées : la date promise, une réserve en jours ouvrés, samedi travaillé ou
  non, fériés sautés ou non, et les étapes dans l'ordre (nom, durée, en jours
  ouvrés ou calendaires), qu'on ajoute et retire.
- Sorties : le **jour de démarrage au plus tard** (la réponse), la marge en
  jours ouvrés depuis aujourd'hui (ou le retard), la frise, le tableau des
  dates de chaque étape et de la réserve.
- Un bouton : copier le rétroplanning.

## Règles

- La livraison est ramenée au dernier jour ouvré qui la précède ou l'égale ;
  la réserve occupe les derniers jours ouvrés ; les étapes se placent bout à
  bout, de la dernière à la première, chacune finissant le jour ouvré qui
  précède le début de la suivante.
- Une étape en jours calendaires (délai fournisseur, séchage) court aussi le
  week-end ; l'étape suivante ne commence qu'un jour ouvré.
- Fériés : les onze jours nationaux de métropole (C. trav., art. L3133-1),
  Pâques par l'algorithme de Meeus/Jones/Butcher. Le lundi de Pentecôte est
  compté férié ; l'option « fériés » les retire tous (journée de solidarité
  travaillée, entreprises qui ne chôment pas).
- Marge : jours ouvrés d'aujourd'hui (compris) au démarrage (non compris).
  En dessous de 6 : avertissement ; négative : retard.

## Hors périmètre

Étapes en parallèle et dépendances multiples (un vrai diagramme de Gantt),
Alsace-Moselle et outre-mer, congés de l'équipe.
