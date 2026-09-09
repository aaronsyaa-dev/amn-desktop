# Redesign Accueil — « Le poste habité »

Chantier scopé à un seul écran : l'Accueil de l'édition **cliente** (AMN Desktop,
`HomeSoloScreen.tsx`), selon la direction validée dans Claude Design (export
`AMN_Desktop__Directions.dc.html`, turn `t2`, option `2a`). AMN Business
(interne) n'est pas concerné. Tag posé avant tout travail :
`avant-redesign-accueil` (local — le push de tags renvoie 403 sur ce proxy,
documenté de longue date).

## Ce qui a changé

- **`src/business/HomeSoloScreen.tsx`** — réécrit entièrement selon la direction
  2a : fond ardoise/encre, le bloc « Maintenant » (prochain rendez-vous) en
  ambre plein — seul objet dominant de l'écran —, le cadran de progression de
  la journée, les deux registres « Suite du jour » et « À encaisser » en ombre
  longue. Toutes les valeurs sont réelles : rendez-vous, tâches, factures,
  temps saisi.
- **`src/business/SoloPulse.tsx`** et **`src/business/DayBand.tsx`** —
  supprimés. Ils n'étaient utilisés que par `HomeSoloScreen` ; leur contenu
  (compteurs de la semaine, bande d'information tournante) est repris et
  honnêtement recalculé à l'intérieur du nouvel écran.
- **`src/business/BusinessSidebar.tsx`** — jetons d'icônes à 42×42 px ajoutés
  autour de chaque icône de navigation, sur les tokens de thème **existants**
  de la barre (pas la palette ambre/encre de l'Accueil). Aucun autre
  comportement touché (repli/dépli, tiroir mobile, sections, badges, i18n).

Rien d'autre n'a bougé : `BusinessTopBar`, `BusinessLayout`, les jetons CSS
globaux (`index.css`), les autres écrans, et toute l'édition interne (AMN
Business) sont inchangés. `HomeSoloScreen` reste partagé avec le contexte
support interne (« voir comme cette organisation cliente ») exactement comme
avant — ce chantier en hérite sans le modifier.

## Captures — avant / après

Base : parc de démonstration (`amn-api/scripts/demo-parc.mjs`) complété d'un
jeu de données réalistes pour l'organisation « Syraagensy » (rendez-vous du
jour, tâches, deux fiches clientes, une facture à jour et une en retard de
12 jours) — aucune donnée réelle de production touchée. Dossier :
`docs/captures/redesign-accueil-2026-09-09/`.

| | Avant | Après |
|---|---|---|
| Poste (1440×900) | `avant-poste-1440.png` | `apres-poste-1440.png` |
| 13" (1366×768) | `avant-laptop13-1366.png` | `apres-laptop13-1366.png` / `apres-laptop13-1366-plein.png` |
| Téléphone (390 px) | `avant-telephone-390.png` | `apres-telephone-390.png` / `apres-telephone-390-plein.png` |
| Espace vide (aucune donnée) | — | `apres-vide-1440.png` |

## Fidélité à l'export Claude Design (direction 2a)

**Reproduit fidèlement** : fond #050505, texte #f7f7f5 / #a3a3a0 / #6b6b68,
ambre #d09a4a réservé au seul bloc « Maintenant » (halo compris), rouge #ff4230
réservé au badge « échue(s) » et au montant en retard, cadran conique de
progression de la journée avec restant/saisi, les deux registres en ombre
longue, la ligne d'ouverture avec le sous-titre dynamique et le bouton
« + Rendez-vous ».

**Adapté, et pourquoi** :

- **La journée de référence du cadran (9 h–18 h) est un défaut posé, pas une
  donnée réelle** : aucune configuration d'horaires de bureau n'existe dans
  l'application. Documenté en tête de fichier (`JOURNEE_DEBUT_HEURE` /
  `JOURNEE_FIN_HEURE`) plutôt que caché dans un nombre magique. Capturé après
  18 h dans nos essais, le cadran affiche honnêtement 100 % écoulée et 0 min
  restant — c'est le comportement correct, pas un bug de démo.
- **Le sous-titre et le nombre de « relances »** sont composés sur les vrais
  comptes du jour (rendez-vous du jour, factures réellement en retard), jamais
  la phrase de l'exemple Claude Design.
- **Le mini-graphique de la carte « À encaisser »** trace l'activité de
  FACTURATION des 7 derniers jours (combien de factures émises par jour), pas
  un historique du montant dû : cette valeur n'est jamais figée dans le temps,
  aucune vraie courbe de « à encaisser » n'existe donc à tracer sans l'inventer.
- **Le lien de visio dans le bloc « Maintenant »** s'affiche comme « Visio »
  plutôt que l'URL en clair (le mockup montre un lieu physique lisible ;
  exposer l'URL entière en majuscules débordait sur téléphone et n'apportait
  rien que le bouton « Rejoindre » ne fasse déjà).
- **« Notes du client »** n'apparaît que si le rendez-vous porte un
  `clientId` réel, et réutilise le lien profond déjà existant
  (`navigate('/clients', { state: { focusClientId } })`) plutôt que d'inventer
  un nouveau mécanisme.
- **Chrome partagé** : seule la demande explicite (jetons 42 px) a été
  appliquée à `BusinessSidebar`, avec les couleurs de thème existantes de la
  barre — pas la palette de l'Accueil. `BusinessTopBar` n'a pas été touchée. Ce
  découpage est une décision de portée prise pendant le chantier ; à confirmer
  ci-dessous.
- **Écran vide** (aucune donnée) : la carte de bienvenue existante
  (`FirstRunCard`) n'a pas été retouchée — la direction validée ne dépeint pas
  cet état, donc rien à reproduire, et la retoucher sans mockup à suivre
  aurait été inventer.

**Changement de portée à valider explicitement** : la direction validée ne
montre ni la liste des tâches ouvertes, ni les fiches clientes, ni les
raccourcis qui occupaient jusqu'ici le bas de l'écran — seulement un compteur
« Tâches ». Ce chantier a suivi le mockup à la lettre et a donc **retiré** ces
trois blocs de l'Accueil. Rien n'est perdu : Tâches et Clients restent des
écrans à part entière, accessibles depuis la barre latérale. Mais c'est une
réduction de fonctionnalité visible sur cet écran précis, et elle mérite votre
regard avant de partir plus loin.

## Ce qui n'a pas pu être vérifié ici

- Le rendu sur un écran physique réel (poste 13" ou téléphone) — seules des
  fenêtres de navigateur aux mêmes dimensions ont été testées.
- Le partage vers le contexte support interne (« voir comme cette
  organisation ») n'a pas été rejoué à l'écran : `tsc` passe sur les deux
  éditions et le composant ne dépend d'aucun contexte propre à l'édition
  interne, mais aucune capture n'a été prise depuis ce chemin précis.
- Contraste et cibles tactiles automatisés (`check:contraste`, `check:cibles`)
  demandent une session E2E complète (identifiants dédiés) non montée pour ce
  chantier ponctuel ; vérification visuelle faite à l'œil sur les captures
  ci-dessus (texte clair sur fond très sombre, boutons ≥ 40 px de haut).

## Contrôles

`tsc` propre sur les deux éditions (`tsconfig.json`, `tsconfig.business.json`),
`eslint` propre sur les deux fichiers touchés, `check:business` (aucune trace
d'AMN DevSec dans le bundle livré), `check:ecrans`, `check:naming`,
`check:modules`, `check:sync`, `check:persistence` : tous verts. Version de
l'application et canal de mise à jour **inchangés** (1.2.44) — ce chantier
n'avait aucune raison d'y toucher.

## Ce qu'Harun doit faire ensuite

1. **Valider visuellement** les captures ci-dessus, en particulier le
   changement de portée (disparition des listes Tâches/Clients/Raccourcis de
   l'Accueil) et le découpage retenu sur la barre latérale (jetons seuls, pas
   de reskin complet).
2. **Tester avec Syraagensy** (ou Mohamed) sur ces mêmes données réelles de
   rendez-vous/factures, pas seulement le jeu de démonstration.
3. Une fois validé, **merger** — les autres modules (Agenda, Tâches, Clients,
   Facturation…) suivront dans des chantiers séparés, une fois validés à leur
   tour dans Claude Design.
