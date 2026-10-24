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
