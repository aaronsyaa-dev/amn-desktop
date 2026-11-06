# Refonte — le socle (S0)

Ce que les autres sessions de la refonte (navigation, Accueil et mascotte,
Supervisor et Garde, robots, écrans) peuvent utiliser dès maintenant. Rien n'est
encore branché aux écrans : on crée les briques, la migration viendra écran par
écran.

> Rappel de nommage : `internal` = édition **interne** (AMN Business, `npm start`),
> `business` = édition **cliente** (AMN Desktop). Tout ce qui suit ne vit que dans
> l'édition interne, sauf mention contraire.

## Où vit quoi

| Fichier | Rôle |
|---|---|
| `src/index.css`, bloc « LE SOCLE DE LA REFONTE (S0) » (fin du fichier) | Les jetons : graphite, 7 familles, états, thème clair, règles `data-famille` et `data-mouvement`. |
| `src/socle/familles.ts` | Les 7 identifiants de famille et le type `Famille`. |
| `src/socle/i18n.ts` | Les mots du socle en fr/en (noms de familles, Mouvement, libellés des briques), et `useSocleLangue()`. |
| `src/socle/ui/` | `Bouton`, `Carte`, `Modale`, `Saisie`. |
| `src/socle/moments.ts` | Le bus de moments. |
| `src/socle/mouvement.ts` | Le réglage Mouvement : lecture, écriture, hook. |
| `src/edition/socle.internal.tsx` / `socle.business.tsx` (`@edition/socle`) | La couture d'édition : la racine (`RacineSocle`) et la section des Réglages (`MouvementSection`). Côté cliente, les deux sont vides. |
| `scripts/check-socle.ts`, `scripts/check-moments.ts` | `npm run check:socle`, `npm run check:moments`. Tous deux sans réseau, et ajoutés à la CI. |

### Pourquoi l'édition cliente ne change pas

- Les jetons ont des **noms neufs** (`socle-*`, `fam-*`, `etat-*`). La rampe
  existante (`--color-bg`, `--color-success`…) n'a pas bougé : elle porte les
  deux éditions et des dizaines de gris recopiés en dur. Dans le paquet client,
  aucun élément n'emploie ces jetons. Ils sont inertes (quelques règles CSS de
  plus, rien d'affiché).
- `src/socle/**` n'est importé par **aucun** code de l'édition cliente. Rollup
  ne le met donc pas dans son paquet. Le seul chemin passe par `@edition/socle`,
  dont la variante cliente rend `children` tels quels (sous le même
  `MotionConfig reducedMotion="user"` qu'avant) et `null` pour la section des
  Réglages.
- Les mots du socle ne sont pas dans `src/i18n/fr.ts` / `en.ts` : ces
  dictionnaires entrent dans le paquet client.

## 1. Les jetons

Ils sont tous en `@theme`, ce qui donne des utilitaires Tailwind :
`bg-socle-surface`, `text-socle-texte-doux`, `border-socle-bord`,
`text-fam-argent-texte`, `bg-etat-succes-fond`…

**Surfaces graphite** (chaud, pas de noir pur) : `socle-fond`, `socle-creux`,
`socle-surface`, `socle-eleve`, `socle-survol`. **Bordures** : `socle-bord`, et
`socle-bord-fort` (≥ 3:1, pour les champs et les boutons secondaires).
**Encres** : `socle-texte`, `socle-texte-doux`, `socle-texte-discret`. **Autres** :
`socle-focus`, `socle-primaire` / `-survol` / `-encre`, `socle-voile`.

**Familles** : `jour`, `contacts`, `ecrire`, `argent`, `echanger`, `creer`, `outils`.
**États** : `etat-succes`, `etat-attention`, `etat-danger`. Chaque couleur se
décline en quatre jetons :

| Jeton | Emploi | Garanti |
|---|---|---|
| `fam-argent` | point, filet, trait | ≥ 3:1 sur les 5 surfaces |
| `fam-argent-texte` | texte coloré | ≥ 4,5:1 sur les 5 surfaces **et** sur son fond léger |
| `fam-argent-fond` | fond léger (pastille, encart) | dérivé de la base, à 14 % |
| `fam-argent-bord` | bordure de cet encart | dérivé de la base, à 40 % |

Le bouton destructeur a en plus `etat-danger-plein`, `-plein-survol` et `-encre`.

**Couleur d'une famille sur un bloc.** Posez `data-famille="argent"` sur
n'importe quel élément : `var(--fam)`, `var(--fam-texte)`, `var(--fam-fond)` et
`var(--fam-bord)` descendent dans tout son contenu. Exemple :
`<span className="text-[var(--fam-texte)]">`. N'écrivez pas de nom de classe
fabriqué à l'exécution : Tailwind ne le verrait pas.

**Règles qui tiennent** (et que `check:socle` vérifie) :

- L'ambre (`--color-signal`) reste réservé à la décision à prendre, un seul
  objet par écran. Aucune famille ni aucun état n'entre dans sa teinte
  (25–50°). L'avertissement est un jaune paille à 58°.
- Le rouge reste le critique. Seul `etat-danger` y touche ; c'est sa version
  sobre (erreur de saisie, action destructrice), pas une alarme.
- Une famille dit « où je suis », jamais « ce qui attend ».

**Thème clair doux** : jetons prêts dans `:root[data-theme='clair']`, **non
activé**. Il s'allume en posant `data-theme="clair"` sur `<html>`. Il passe les
mêmes contrôles de contraste.

**Le fond graphite n'est pas activé sur l'app entière.** Les briques sont
graphite ; l'arrière-plan général reste `#060606` tant que les écrans n'ont pas
migré. Le basculer est un choix à faire avec la session des écrans : il
toucherait tous les écrans d'un coup, y compris leurs gris codés en dur.

## 2. Les briques

```tsx
import { Bouton, Carte, Modale, Saisie } from '../socle/ui';
```

**`Bouton`**
- `variante` : `primaire` | `secondaire` (défaut) | `discret` | `danger`.
- `taille` : `petit` | `moyen` (défaut) | `grand`.
- `chargement` : bloque les clics, pose `aria-busy`, garde la largeur et le libellé.
- Aussi : `icone`, `pleineLargeur`. Toutes les props de `<button>` passent ; `type="button"` par défaut.
- Focus visible ; légère pression au clic, sauf en mouvement réduit.
- Une seule `primaire` par vue. Jamais `danger` comme action par défaut.

**`Carte`**
- Props : `famille`, `surtitre`, `titre`, `niveauTitre` (2, par défaut, à 4), `actions`, `as` (`section` | `article` | `div`).
- Avec `famille` : un filet de 2 px de la teinte, et `data-famille` sur la carte.
- Avec `onClick`, la carte entière devient un `<button>` qui se soulève d'un cran au survol. Son contenu y est rendu en texte courant, et `actions` est ignoré (pas de bouton dans un bouton).

**`Modale`** (`ouverte`, `onFermer`, `titre`, `description`, `actions`, `taille`, `famille`, `fermetureAuVoile`)
- Rendue dans `<body>` via un portail. Rôles posés : `role="dialog"`, `aria-modal`, `aria-labelledby` (le titre), `aria-describedby` (la description).
- Échap ferme **celle du dessus** seulement (`useFermetureEchap`).
- Le focus est piégé par `pileCalques`. Il entre à l'ouverture, ou va au champ qui porte `autoFocus`. Il revient à l'élément qui a ouvert la fenêtre.
- Ne retirez pas `fixed inset-0 z-50` du voile : la pile reconnaît un calque à ces classes.
- Les boutons d'action vont dans `actions`, la principale à droite.

**`Saisie`** (`etiquette`, `aide`, `erreur`, `suffixe`, plus toutes les props d'`<input>`)
- Un vrai `<label>`. L'aide et l'erreur sont reliées par `aria-describedby`, avec `aria-invalid` en cas d'erreur.
- Le focus est neutre, pas ambre. C'est un écart volontaire avec `components/formulaire/Champ.tsx`.

Les animations passent par framer-motion et suivent le réglage Mouvement
via le `MotionConfig` de la racine (`useReducedMotionConfig`). Les briques ne
lisent jamais le stockage elles-mêmes.

## 3. Le bus de moments

```ts
import { emit, subscribe, type Moment } from '../socle/moments';

const off = subscribe('facture.payee', (m) => { /* m.charge.factureId, m.quand */ });
const offTous = subscribe('*', (m) => { /* tous les types */ });
emit('facture.payee', { factureId });
off();
```

- **Types** (`ChargesDeMoments`) : `facture.payee`, `facture.envoyee`,
  `facture.en-retard`, `devis.accepte`, `client.cree`, `rdv.proche`,
  `tache.terminee`, `projet.cree`, `message.recu`, `tentative.suspecte`,
  `sauvegarde.terminee`, `synchro.retablie`, `premiere.fois`, et pour la Garde
  (ajoutés par le CO d'après S3) `garde.escalade` (critique), `site.muet`
  (decision) et `garde.remontee-critique` (critique). Rien ne les émet encore :
  les endroits sont listés dans `docs/refonte/rapports/S3.md`.
- `CATALOGUE_DES_MOMENTS[type]` donne la **famille** et le **ton** de chaque type :
  `fete` | `info` | `decision` (seul ton à droit à l'ambre) | `critique`.
- **Comportement** : émission synchrone. Les abonnés du type passent d'abord,
  puis ceux de `'*'`. Un abonné qui lève une erreur ne bloque pas les autres :
  l'erreur part dans `reportError` et l'émission continue.
- **Charge** : des identifiants seulement, jamais un nom, un montant libellé
  ou un secret. Un abonné qui veut le détail le relit dans sa collection.
- **Journal** : en `npm start` (édition interne), `RacineSocle` écrit chaque
  moment dans la console (`console.debug('[moment] …')`). Il n'y a ni interface,
  ni historique, ni persistance.
- **Ajouter un type** : une ligne dans `ChargesDeMoments` et une dans
  `CATALOGUE_DES_MOMENTS`. Le typage refuse un oubli.

### Où il faudra appeler `emit` (rien n'est branché)

Lignes relues sur `main` (630ef45). « Partagé » = le fichier sert aux deux
éditions : l'appel devra y passer par la couture d'édition, ou rester inerte
côté cliente.

| Moment | Endroit | Édition |
|---|---|---|
| `facture.payee` | `src/state/useInvoices.ts:425` (`markPaid`, passage à `paid`) | partagé |
| `facture.envoyee` | `src/state/useInvoices.ts:412` (`issue`, passage à `issued`) | partagé |
| `devis.accepte` | `src/state/useClients.ts:354` (`updateQuote` : tester `status === 'accepted'`) | partagé |
| `client.cree` | `src/state/useClients.ts:255` (`createClient`). Ne pas émettre pour l'import historique (l. 221). | partagé |
| `rdv.proche` | `src/business/AppointmentReminders.tsx:102` (le rappel) | monté par l'édition cliente seulement : l'interne n'a pas de rappel de rendez-vous |
| `tache.terminee` | `src/screens/TasksScreen.tsx:192` (`moveTask`, statut `done` ; il n'y a pas de hook des tâches) | partagé |
| `projet.cree` | `src/state/useProjects.ts:112` (`createProject`) | partagé |
| `message.recu` | `src/components/NotificationsManager.tsx:212` (message privé reçu), `:180` (canal d'équipe) | interne (monté par `AppLayout`) |
| `tentative.suspecte` | `src/components/SupportNotifier.tsx:54` (tentative d'injection) ; `src/components/NotificationsManager.tsx:132` (alerte critique d'un site) ; `src/screens/LoginScreen.tsx:107` et `:129` (échec de connexion, échec du code MFA) | interne / partagé pour la connexion |
| `synchro.retablie` | `src/state/SyncContext.tsx:688` (`reconnected`) | partagé |
| `sauvegarde.terminee` | `src/lib/backup.ts:87` (export téléchargé) | partagé |
| `premiere.fois` | `src/components/Celebrations.tsx:81` (le `notify` actuel ; seuils l. 49–54) | partagé |
| moments venus d'un **autre poste** | `src/state/SyncContext.tsx:676` (`onRemoteChange`) | partagé |

`Celebrations.tsx` est le cas existant le plus proche : il compte des
collections et ne fête que le passage de 0 à plus de 0. Une fois le bus
branché, il deviendra un simple abonné de `premiere.fois`, émis par les
endroits ci-dessus.

## 4. Le réglage Mouvement

- **Niveaux** : `complet` | `reduit` | `aucun`.
  - `reduit` : framer coupe position et échelle mais garde les fondus ; le CSS coupe les boucles.
  - `aucun` : framer `skipAnimations`, et le CSS saute chaque animation à son état final.
- **Défaut** : `reduit` si le système demande moins de mouvement (`prefers-reduced-motion`), sinon `complet`. Un choix écrit l'emporte, dans les deux sens.
- **Stockage** : `localStorage['amn.mouvement']` et l'événement `amn:mouvement`, comme `amn.teintes`.
- **API** : `useMouvement()`, `lireMouvement()`, `ecrireMouvement(niveau | null)` (`null` revient au système), `configMotion(niveau)`.
- **Branchement** : `RacineSocle` dans `src/renderer.tsx`. Il pose un `MotionConfig` imbriqué, qui hérite du `reducedMotion="user"` commun et le remplace, et l'attribut `data-mouvement` sur `<html>`.
- **Réglages** : `MouvementSection`, juste après Extensions. Édition interne seulement.
- **Limite connue** : « complet » ne rallume pas ce que les blocs CSS `@media (prefers-reduced-motion)` coupent quand le système le demande.
- **À migrer plus tard** : quelques composants lisent encore `matchMedia` directement, donc ignorent le réglage :
  - `components/AnimatedCounter.tsx`, `lib/fluxVisible.ts`, `bureaux/ambiance.ts` ;
  - `components/LiveMetric.tsx`, `Typewriter.tsx`, `RelevePoste.tsx`, `guide/*`, `screens/garde/*`.

  Remède : lire `lireMouvement()`, ou `useReducedMotionConfig()` de framer-motion.

## Ce qui n'est pas vérifié

L'app n'a pas été lancée et aucun build n'a été fait. Ce qui reste à voir :

- le rendu visuel des briques ;
- l'effet réel du réglage à l'écran ;
- le piège de focus de la Modale dans un vrai DOM.

`check:socle` vérifie les contrastes calculés, le balisage rendu côté serveur et
la logique du réglage. `check:calques` vérifie la pile qu'utilise la Modale.

## Mise à jour — session DS (noir et gris, coquille commune)

- Les jetons de la direction vivent dans `src/socle/noir.css` (`--socle-*`, et les noms S0 redéfinis depuis les mêmes valeurs). Les encres « discret » (`#77777c`) et « très discret » (`#5f5f64`) sont réservées aux filets, icônes décoratives et éléments désactivés : jamais un texte (`check:socle`).
- Nouvelles briques (`src/socle/ui/`) : `TuileKpi`, `BarreProgression`, `AnneauProgression`, `PastilleEtat`, `Etiquette`, `Avatar`, `PileAvatars`, `CaseACocher`, `LigneTache`, `LigneActivite`, `EtapeFranchie`, `EtatVide`, `Squelette`, `Raccourci`.
- Coquille (`src/socle/coquille/`) : `BarreLaterale`, `EnTete`, `BarreAjmani`, `PaletteAjmani`, `Coquille`. Branchement : `src/refonte/coquille/`, par la couture `@edition/coquille`. Éteinte par défaut ; Paramètres › « Nouvelle coquille ».
- Détail, choix et points à trancher : [`rapports/DS.md`](refonte/rapports/DS.md).

## Mise à jour — LOT-00 Système et démarrage

Nouveaux groupes de briques dans `src/socle/ui/` (tous réexportés par `index.ts`) : `controles/`, `situations/`, `graphiques/`, `archetypes/`. Les mots fr/en vivent par écran (`definirMots`, `src/socle/mots.ts`). La page de démonstration interne `/dev/socle` (développement seulement) montre chaque brique. Écrans système : `src/refonte/systeme/`. Liste et chemins : section « LOT-00 » de [`refonte/STATUT.md`](refonte/STATUT.md).

## Mise à jour — v3 (2026-11-01)

Couche de mouvement commune (`src/socle/mouvement.css`, attribut `data-mvt`), police monospace (`--socle-police-mono`, `.sc-mono`), composants vivants (`src/socle/ui/vivant/` : `LiveDot`, `Caret`, `Severity`, `FilterChips`, `Gauge`, `HeatCell`, `FlowLine`, `InlineSuggestion`), coquille v3 (`usePageCoquille`). Aperçus de capture : `scripts/apercu/`. Détail et chemins : section « LOT-00 v3 » de [`refonte/STATUT.md`](refonte/STATUT.md).

## Mise à jour — briques partagées v3 (STATUT § 1.10, point 1)

Les briques que les fiches v3 citent dans tous les lots vivent dans `src/socle/ui/briques-partagees/` (feuille
`briques-partagees.css`, chargée par `@import` depuis `briques.css`, donc par `Ambiance.tsx`, édition interne seulement) et
s'importent depuis `src/socle/ui` :

```tsx
import { IconTile, CountBadge, ModuleTile, ModuleGroupGrid, AddModuleTile, PageHead, StatusPill } from '../socle/ui';
```

- **`IconTile`** (`icone`, `taille` 22 | 26 | 28 | 36 | 38 | 42 | 44 | 48, `famille?` dont `garde`, `ton?` neutre | succes |
  attention | critique | info, `part?` 10 | 13 | 14 | 18, `bordure?`, `libelle?`) : le carré arrondi teinté de la famille à
  13 % (§ 4) ou neutre (`--socle-tag`). Rayon et glyphe suivent la taille. `part` et `bordure` reproduisent les images de
  D02 (10 %, bordure à 22 %) et de H41 (14 %, 18 % pour l'aperçu) ; `BlocEtat`, D02 et H41 l'emploient sans changer un pixel.
- **`CountBadge`** (`n`, `libelle?`, `variante?` standard | laterale | texte, `critique?`) : 16 px, fond
  `--socle-pastille-compte`, 10,5 / 600 ; la pastille de Cyber (`laterale`) et le chiffre seul des épinglés (`texte`) de
  la barre latérale ; rien à zéro, « 99+ » au-delà, le chiffre dit en mots (lecteur d'écran et info-bulle).
- **`ModuleTile`** (`nom`, `icone`, `famille?`, `sousTexte?`, `accessoire?`, `variante?` standard | ligne, `actif?`,
  `vers?` ou `onClick`, `tuile?`) : un lien ou un bouton, focus visible. `ligne` = la puce des épinglés de D02 (34 px) ;
  `standard` = 41 px (tuile 26, nom 13 T2, sous-texte 11,5 T4, survol de ligne, `aria-current` du module ouvert),
  **provisoire** jusqu'aux fiches F10 à F70.
- **`ModuleGroupGrid`** (`titre`, `effectif?`, `colonnes?`, `onAjouter?` ou `versAjouter?`, enfants `ModuleTile`) et
  **`AddModuleTile`** (`libelle?`, `vers?` ou `onClick`, `variante?`) : la grille d'un groupe (titre 11 px capitales T4,
  écart 6) fermée par « + Ajouter un module » (pointillé `--socle-pointille`, même hauteur que la tuile). Provisoires.
- **`PageHead`** (= `EnTeteDePage`) : `titre`, `sousTitre?`, `primaire?`, `secondaires?` (avec `infobulle?`), `extra?`,
  `controles?` (à la place des boutons, D02), `className?` (les cotes propres d'un écran restent dans sa feuille, en
  `.x-entete.sc-page__entete`), `attributsTitre?` (`data-guide` d'une visite). H40, H42, H47 et D02 l'emploient.
- **`StatusPill`** = `PastilleEtat` ; **le catalogue des noms des fiches** est `src/socle/ui/noms.ts` (`Card` = `Carte`,
  `Button` = `Bouton`… tableau en tête du fichier ; `Sidebar`, `Header`, `AjmaniBar` depuis `src/socle/coquille`). Un alias
  n'existe que si la brique suit la ligne du § 4 : `Empty` n'en a pas (voir `noms.ts`).

Démonstration : section « Briques partagées » de `/dev/socle`. Garde : `npm run check:socle-briques`.

## Mise à jour — alignement du § 4 (chantier s1b, 2026-11-06)

Audit brique par brique de `01-SOCLE-DESIGN.md` § 4, mesuré dans le **CSS calculé** de `/dev/socle` (aperçu `scripts/apercu/ecrans/SOCLE-DEMO.tsx`, Chromium 1440 × 900 ; script Playwright jetable, effacé). Tout ce que la table ne cite pas était déjà à la valeur exacte (Card, Subcard, Button, IconButton, Kpi, StatusPill, Pill, Tag, FlagUrgent, Kbd, Avatar / AvatarStack / Sq, Progress, Ring, Donut, Check, Toggle, Field / Select, Tabs, Segmented, SearchBox, Table, Ticket, colonne de kanban, Suggestion, cartes ludiques) ; `check:socle-controles`, `check:socle-graphiques` et `check:socle-archetypes` tiennent désormais chaque valeur.

| Brique | Spec § 4 | Mesuré avant | Corrigé |
|---|---|---|---|
| TimelineItem, filet vertical | `#222224` | `#2a2a2d` (`--socle-filet-vertical`) | oui : jeton à `#222224` |
| Empty (`EtatVide`), pointillé | `#2E2E33` | `#28282b` (`--socle-bord-controle`) | oui : `--socle-pointille` |
| Empty, rayon | 14 | 12 | oui : `--socle-rayon-carte` |
| Empty, titre | 14 px / 600 | 15 px (surcharge de `situations.css`) | oui : 14 px, surcharge retirée |
| Empty, texte | 12,5 px T4, 300 px au plus | 12,5 px T4, sans limite | oui : `max-width: 300px` |
| Empty, icône | 44 px dans un carré arrondi | absente | oui : prop `icone` (`.sc-vide__icone`, 44 px, rayon 12, glyphe 20) |
| Empty, action | toujours | facultative | oui : `action` demandé (`null` l'assume) ; alias `Empty` dans `noms.ts` |
| Kpi, hauteur | 84 à 92 | jusqu'à 94 : la variation passait sous la valeur dès que les deux ne tenaient pas côte à côte | oui : une seule ligne (`flex-wrap: nowrap`), variation en ellipse ; la phrase entière reste dans l'infobulle et pour les lecteurs d'écran |
| Ring muet (< 40 px) avec un centre donné | — | centre à 16 px, la cote de 72 px | oui : 11 px, la plus petite cote |
| Segmented désactivé (fieldset) | état visible (§ 7.6) | aucun état, survol actif | oui : `.sc-segment:disabled` comme le sélecteur (60 %, curseur « interdit »), survol épargné |
| Check, bordure | 1,5 px `#3A3A3E` | déclarée 1,5 px, rendue 1 px (Chromium arrondit une bordure de 1,5 px à 1 px en échelle 1) | non : la feuille dit 1,5 px, le rendu ne peut pas faire mieux |
| `BlocEtat` (le bloc d'état de H43) | — (c'est `StateBlock`, fiche H43) | tuile 48 px, titre 15 px, texte 240 px | non : cotes mesurées sur l'image H43 (0,72 %), hors § 4 |

Ajouts demandés par LOT-06 (point 2) : `Anneau` accepte `taille` de **26 à 80** (`tailleAnneau` borne, `epaisseurAnneau` donne 3 px à 26 → 8 px dès 72, `coteAnneau` règle la valeur centrée : 16 px, 13 px sous 72, 11 px sous 48, rien sous 40 — `children` l'y remet) ; `CaseACocher` prend `taille={16 | 18 | 24}` (16 px, coche de 11 px ; `'serie'` reste) ; `Segmente` prend `taille="compact"` (26 px : rembourrage 2, segments 12 px 3 × 9) ; `BoiteRecherche` prend `hauteur={38}` (le champ 270 × 38 de l'en-tête de D02). Une cible de 16 ou 26 px est sous les 34 px du § 7.6 : réservée aux rangées denses.

### Les noms de mouvement des fiches (`amn-grow`, `amn-slide`, `amn-bar`, `amnFlow`, `amnHalo`)

Les fiches des lots nomment les mouvements à l'anglaise ; `src/socle/mouvement.css` les fournit sans rien dupliquer (LOT-06, point 4) : trois **classes** qui partagent la règle de leur attribut, deux **noms de keyframes** pour une feuille d'écran qui anime elle-même un trait. Même coupure que le reste de la couche (`prefers-reduced-motion`, Mouvement « aucun » ; « réduit » garde un fondu court pour `amn-grow` et `amn-slide`, coupe `amn-bar`).

| Nom de la fiche | Équivalent de la couche | Ce que c'est |
|---|---|---|
| `.amn-grow` | `data-mvt="entree"` | l'entrée d'une carte : 500 ms, monte de 6 px, décalage `--sc-mvt-rang` × 45 ms |
| `.amn-slide` | `data-mvt="arrivee"` | l'arrivée d'une ligne : glisse de 8 px depuis la gauche, 450 ms |
| `.amn-bar` | `data-mvt="pousse"` | une barre qui pousse depuis sa base : 700 ms, décalage `--sc-mvt-rang` × `--sc-mvt-barre-decalage` |
| `amnFlow` | keyframes de `data-mvt="flux"` | un pointillé qui s'écoule (`stroke-dashoffset` recule de `--sc-mvt-flux-pas`), en boucle |
| `amnHalo` | keyframes de `data-mvt="onde"` | une onde qui s'élargit (opacité .55 → 0, échelle 1 → 2,6), en boucle |

Les noms `amn-fade` et `amn-in` de la fiche D02 sont `data-mvt="fondu"` et `data-mvt="entree"` ; ils n'ont pas de classe (un seul nom par mouvement).

### `Mono` et `src/socle/formats.ts` (chantier s1b)

- `Mono` (`src/socle/ui/Mono.tsx`, exporté par `src/socle/ui`) : la donnée technique « en MONO » des fiches — `<Mono>10:42:07</Mono>`, `<Mono as="time" dateTime="…">`, `<Mono as="code">`, `taille` de 11 à 18 px (bornée, ±Infinity compris ; la borne l'emporte sur un `style.fontSize` de l'appelant ; NaN hérite du parent) ; la couleur vient du parent. C'est `.sc-mono` de `noir.css` (`--socle-police-mono`, chiffres tabulaires, sans ligatures).
- `src/socle/formats.ts` : `formaterNombre`, `formaterPourcent` (déjà en pour cent), `formaterRatio` (0 à 1), `formaterEuro`, `formaterMontant`, `formaterDate`, `formaterHeure`, `dateIso`, importables depuis tout code interne (`import { formaterEuro } from '../../socle/formats'`) — `check:socle-graphiques` interdit d'importer `src/socle/ui/graphiques/*` hors du socle ; ce module neutre réexporte les deux sources sans rien recopier. Une valeur illisible (NaN, ±Infinity, date invalide) donne « — » sur chaque export (jamais « NaN € », « 0 % » pour un ratio inconnu ni une exception), sauf `dateIso` qui rend « » ; jamais « -0 € ».
- Jetons ajoutés dans `noir.css` : `--socle-decor-1/2/3` (illustrations seulement), `--socle-hachure-attention` / `--socle-hachure-grise` (`background-image`), `--socle-pointille-ok` / `--socle-pointille-attention` (`border`) ; la teinte de sélection `#D9A27A` des fiches est `--socle-fam-creer`.

## « Aujourd'hui » et compteurs de la barre latérale (socle v3, chantier s2)

### « Aujourd'hui » : un seul calcul (`src/refonte/coquille/aujourdhui/`)

La carte « Aujourd'hui » de la barre latérale et l'Accueil (N01) lisent les mêmes chiffres parce qu'ils sortent d'un seul calcul (consigne du CO, `STATUT.md` §1.10 point 3). LOT-01 le lit, il ne le recalcule pas.

```ts
import { useAujourdhui } from '../coquille/aujourdhui';

const a = useAujourdhui();
// a.faites / a.total   : « x sur y faites » (les lignes faites sur les lignes visibles du fil)
// a.serie               : la série en cours, en jours (0 : aucune), comptée à la clôture (04-ECARTS B2)
// a.prochainRdv         : { titre, debut } du prochain rendez-vous du jour pas encore fini, ou null
// a.fil / a.masquees    : le fil du jour tel qu'on le montre (retouches appliquées), et ce qui est masqué
// a.enLigne / a.presenceMontree : qui est en ligne et le libellé du module où chacun est (jamais une adresse)
// a.maintenant / a.jour : l'horloge à la minute, le jour « AAAA-MM-JJ »
// a.cocher(ligne)       : cocher dans la donnée (priorité, tâche) ou sur ce poste (ligne à soi)
// a.retoucher(fn)       : masquer, ajouter, tout réafficher (fonctions pures de `accueil/filDuJour.ts`)
```

- Les **règles** restent celles de S2 : `construireFil` et `appliquerRetouches` (`src/refonte/accueil/filDuJour.ts`), `meilleureSerie` (`tuiles.ts`). Elles sont appelées par la fonction pure `calculerAujourdhui(sources, maintenant, libelles)` (`calculer.ts`), jamais recopiées ; `construireFil` n'est appelé que là (`check:socle-coquille`).
- **Une seule instance** : `FournisseurAujourdhui` est monté une fois dans la coque interne (`AppLayout`, par `@edition/coquille`, jumeau cliente inerte). Tout ce qui est sous la coque reçoit le même objet : cocher une ligne à l'Accueil met la carte de la barre à jour sans second calcul. Sans fournisseur (contrôles, aperçus), `useAujourdhui()` calcule localement.
- `useCarteAujourdhui(langue, versAccueil)` (`carte.ts`) met ces chiffres en mots pour la barre (« 11:00 · dans 18 min »). `useAccueil` (N01) lit `useAujourdhui()` et garde le reste (tuiles, activité, familles, message d'Ajmani).

### Compteurs de la barre latérale : déclarés par les lots (`src/refonte/compteurs/`)

Les pastilles de la barre latérale (« ce qui attend », par adresse de module) ne sont plus calculées en dur dans la coquille. Chaque lot déclare les siennes dans **un fichier**, `src/refonte/compteurs/<famille>.ts`, ramassé seul (comme le registre des modules de S5) :

```ts
import { useMemo } from 'react';
import { useCollection } from '../../state/SyncContext';
import { declarerCompteurs } from '../coquille/declarerCompteurs';

function useCompteurs(): Record<string, number> {
  const articles = useCollection<Article>('stock');
  return useMemo(() => ({ '/stock': articlesASurveiller(articles).length }), [articles]);
}
export default declarerCompteurs({ famille: 'creer', useCompteurs });
```

- `useCompteurs` est un **hook** (il lit les accès existants) qui rend les compteurs par adresse de vue (le `to` du catalogue). Rendez un objet mémorisé. Une adresse absente ou à zéro n'affiche rien ; deux déclarations sur la même adresse s'additionnent : déclarez une adresse une seule fois.
- `famille` : une des sept familles, `garde` ou `cyber`. Une déclaration mal formée est écartée avec sa raison (`COMPTEURS_DECLARES.ecartes`), les autres s'affichent.
- Les compteurs d'avant sont la première déclaration, `compteurs/jour.ts` (activité non vue, agenda, tâches, relances, priorités) ; celui de Cyber est `compteurs/cyber.ts` (absent tant que la source n'a pas répondu : pas de pastille, pas de zéro inventé).
- Hors de Vite (contrôles Node), `import.meta.glob` n'existe pas : la liste est vide ; `check:socle-coquille` et les aperçus (`scripts/apercu/construire.ts`) la remplacent par le contenu du dossier.

## Substituer un écran (refonte, STATUT § 1.3)

Un écran refondu est un nouveau composant dans `src/refonte/<lot>/` ; `src/screens/**` et `appRoot.internal.tsx` ne bougent pas. Le lot le déclare dans `src/refonte/substitutions/declarations/<lot>.tsx` (un fichier par lot, ramassé seul) :

```tsx
import { lazy } from 'react';
import { declarerSubstitutions } from '../declarer';

export default declarerSubstitutions('jour', [
  { route: '/tasks', module: 'tasks', support: 'identique', composant: lazy(() => import('../../jour/PageTaches')) },
]);
```

`route` : le chemin exact de la route d'origine (paramétré accepté : `/garde/bureaux/:equipe`) ; `module` : la garde `ModuleRoute` de la route d'origine, conservée (un module fermé renvoie à l'Accueil) ; `support` : `'identique'` rend le même substitut en session de support cliente, `'aucune'` (défaut) y laisse l'écran d'origine ; `toujours` : rendu même coquille éteinte (défaut : seulement coquille allumée). Le point unique est `SubstitutionDEcran` (`src/refonte/substitutions/SubstitutionDEcran.tsx`), monté par `AppLayout` et `ClientContextLayout` via la couture `@edition/substitutions` ; côté cliente, le jumeau rend l'`Outlet` et le registre est vide. Gardes : `npm run check:substitutions` (route existante, pas de doublon, substitut dans `src/refonte/<lot>/` sans `src/screens/**`) et `npm run check:client-statique` (le paquet client n'atteint rien de `src/socle`, `src/refonte`, `*.internal.*`).

## Mise à jour — `check:coquille` sur la barre v3 (2026-11-06)

`scripts/check-coquille.mjs` mesure désormais aussi la barre latérale v3 (01-SOCLE-DESIGN §0.1) : une seule colonne de 252 px en `border-box` (padding 16 / 14 / 14), recherche 34 px et bouton carré 34 px collé à droite, sections ESPACE / SURVEILLANCE / ÉPINGLÉS (10,5 px capitales, 20 px), familles de 32 px à icône de 15 px en T3 sans aucune pastille (la teinte de famille ne colore que l'icône de la famille active, fond `#19191B`, 600, T1, chevron), La Garde « veille » + voyant, Cyber toujours présent, sous-liste de cinq lignes de 27 px au plus avec le module courant visible et son repère blanc 2 × 13 sur le filet puis « + N autres », carte « Aujourd'hui » (anneau 34, filet, rendez-vous, présence sans adresse brute), en-tête de 60 px (fil, « N en ligne », cloche 34, Garde avec onde), barre Ajmani 46 px / rayon 14 avec « Entrée pour envoyer » et ⌘J d'un bloc, aucun ambre, une seule ligne active. Deux usages :

- **T1, bundle servi** (inchangé) : `AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… AMN_EDITION=interne node scripts/check-coquille.mjs <dossier-du-bundle> [port]`. Coquille éteinte : les sept mesures d'origine et les bureaux ; puis un second passage, coquille allumée (`localStorage['amn.coquille'] = 'noir'` posé avant la navigation, fenêtre 1440 × 900), sur la liste interne. `AMN_COQUILLE=eteinte|allumee` restreint à un passage. Les bureaux ne sont pas mesurés sous la coquille allumée (ils gardent leur coquille propre).
- **Page statique, sans serveur ni connexion** : `npm run apercu -- COQUILLE-H42 --sortie /tmp/apercu/x/COQUILLE-H42` puis `node scripts/check-coquille.mjs --page /tmp/apercu/x/COQUILLE-H42/index.html` (ou `AMN_COQUILLE_PAGE=`). Un fichier local seulement (aucune adresse, même locale) ; toute requête réseau est refusée et comptée comme une faute. Les aperçus `COQUILLE-H40`, `-H42`, `-H47`, `-D02` sont faits pour lui ; dans ce mode, La Garde, « + N autres », la carte « Aujourd'hui » et « N en ligne » sont exigés (l'aperçu les porte), alors que dans l'application ils peuvent manquer pour une raison de données.

## Mise à jour — réglages des écrans LOT-00 (2026-11-06)

Les trois surfaces de réglages que LOT-00 possède dans les Paramètres passent par la porte `MouvementSection` de `@edition/socle` (`src/edition/socle.internal.tsx` ; le jumeau client rend `null`) et sont chacune la sienne, sur une `Carte` du socle : **Mouvement** (un `Segmente` à trois niveaux, l'aide du niveau choisi, « Suivre le système » quand un choix est écrit), **Écran de veille** (`src/refonte/systeme/veille/EcranDeVeilleSection.tsx` : un `Interrupteur` dans l'en-tête, « Veille après » en `Segmente`, « Verrouiller l'espace après » en `Selecteur`, coupés ensemble quand l'écran est éteint — et visiblement : `.sc-segment:disabled` comme `.sc-selecteur:disabled`, estompés à 60 % avec le curseur « interdit »), **Nouvelle coquille** (`src/refonte/coquille/CoquilleSection.tsx` : l'état en pastille, les quatre points, un `Interrupteur`). Ancres : `reglages-mouvement`, `reglages-ecran-de-veille`, `reglages-coquille`.

Un écran qui envoie aux Paramètres passe la rubrique dans l'état de navigation : `navigate('/settings', { state: { section: 'notifications' } })` (H40 « Réglages »). `SettingsScreen` (partagé, non modifié) expose un `id="reglages-<rubrique>"` par rubrique ; la porte interne (`ancreDeReglages`, `ANCRES_REGLAGES`) fait défiler jusqu'à elle, sans glissement quand le mouvement est réduit. Une rubrique inconnue ne fait rien. Aperçu : `npm run apercu -- REGLAGES-LOT-00`. Gardes : `check:socle` (trois surfaces distinctes, H40 → Notifications, G09 inactif pendant la veille, aucun archétype du §5 en gabarit d'écran), `check:systeme-veille`.
