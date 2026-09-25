# Courses dans les listes « Charger plus » (édition interne)

Rapport du 25 septembre 2026, branche `claude/first-pr-github-setup-ltpqqo`.

Chantier de suite : les deux courses avaient été repérées, sans être corrigées, pendant le chantier précédent (`docs/visite-guidee-et-turn-2026-09-25.md`, §4 « Vu en passant, non corrigé »). Tout a été mesuré en bac à sable, sur les bundles internes construits depuis le code réel.

---

## 0. En bref

| | État |
|---|---|
| Cause | **Trouvée et reproduite** dans un vrai navigateur, sur les deux listes : le registre des organisations (`useParcPage`) et la file d'incidents du parc (`ParcSocPanel`) |
| Correctif | **À la source, un seul endroit** : `src/state/useCursorPage.ts`, dont les deux écrans se servent désormais |
| Preuve | **`check:courses-parc`** (nouveau garde-fou) échoue avant le correctif (6 défauts), passe après. Deux contre-épreuves : l'une confirme que le test détecte une régression réelle, l'autre montre la limite d'un affaiblissement cosmétique |
| Garde-fous | 40 contrôles statiques verts, matrice navigateur verte sur les deux éditions (détail §5) |
| Logique déjà validée | **Non touchée** : `check:fusion-sync` et `check:sync` sont verts |

---

## 1. La cause, reproduite

### 1.1 Deux défauts, répétés dans les deux écrans

`useParcPage` (le registre des organisations, Bloc 4) avait un embryon de protection — un compteur de génération, qui rejette une réponse dont le numéro n'est plus le plus récent. `ParcSocPanel` (la file d'incidents, Bloc 6) n'en avait **aucune** : chaque réponse, dans n'importe quel ordre d'arrivée, écrasait l'état sans condition. Les deux partageaient pourtant le même défaut de fond :

1. **Le curseur de l'ancienne question restait en mémoire.** Rien ne le remettait à zéro au moment où le filtre changeait — seulement une fois que le premier lot de la nouvelle question avait fini d'arriver. Dans cette fenêtre, « Charger plus » cliqué repart avec le curseur de l'**ancienne** question ; si sa réponse arrive avant celle de la nouvelle (ce qui est le cas courant, une requête déjà en vol ayant une longueur d'avance sur celle qui vient d'être déclenchée), elle s'ajoute quand même aux lignes affichées — des lignes d'une question que l'écran n'affiche plus.
2. **Deux clics rapides sur « Charger plus » pouvaient tous les deux partir.** Le verrou tenait dans le state `loading` (ou son équivalent) : deux clics **DOM synchrones**, sans qu'un rendu React ne s'intercale entre les deux, lisent tous les deux la même valeur pré-clic — le premier clic n'a pas encore eu le temps de faire réagir le second. La même page repart alors deux fois.

### 1.2 Reproduit dans un vrai navigateur

Le réseau réel a été remplacé par des réponses fabriquées et délibérément décalées dans le temps (même technique que `check-visite.mjs`, qui délaie `**/v1/garde/**`), pour rendre chaque course certaine plutôt que dépendante du hasard du réseau :

- **Scénario A (réponse périmée).** Cinquante organisations « SONDE-A-0 » à « SONDE-A-49 » chargées, puis « Charger plus » cliqué (sa réponse, « SONDE-A-PERIMEE », répond en 120 ms) et le filtre « Statut : Actives » choisi aussitôt après (sa réponse, propre, répond en 900 ms). Assertion : « SONDE-A-PERIMEE » ne doit **jamais** apparaître, ni transitoirement ni dans l'état final.
- **Scénario B (double clic).** Deux `.click()` DOM dans le même appel (`element.click(); element.click();`), sans laisser de rendu s'intercaler. Assertion : une seule requête part pour la même page.

Sur le code d'avant (`avant-correctif.txt`) :

```
✗ Organisations · A : « SONDE-A-PERIMEE » … s'est affichée après le changement de filtre.
✗ Organisations · B : deux clics synchrones … ont déclenché 2 requête(s) … attendu exactement 1.
✗ Organisations · B : la ligne du second appel … est affichée — la page a été chargée deux fois.
✗ File d'incidents · A : « SONDE-A-PERIMEE » … s'est affichée après le changement de filtre.
✗ File d'incidents · B : deux clics synchrones … ont déclenché 2 requête(s) … attendu exactement 1.
✗ File d'incidents · B : la ligne du second appel … est affichée — la page a été chargée deux fois.
```

Les six défauts sont mesurés, pas déduits : `docs/mesures/courses-parc-2026-09-25/avant-correctif.txt`.

---

## 2. Le correctif, à la source

### 2.1 Un seul utilitaire partagé

`src/state/useCursorPage.ts` (nouveau) porte toute la mécanique de pagination par curseur — génération, remise à zéro, verrou du double clic. `useParcPage.ts` passe de 60 à 34 lignes (il ne fait plus que traduire `ParcPageQuery`/`ParcPage` vers la forme commune) ; `ParcSocPanel.tsx` délègue de même.

### 2.2 Ce qui a changé

- **Le curseur repart à zéro dans le même rendu que le changement de question**, via `useLayoutEffect` — pas un effet ordinaire, qui s'exécute après la peinture du navigateur et laisserait une fenêtre où un clic pourrait encore passer avant que le curseur ne soit invalidé. `hasMore` devient donc faux **immédiatement** : le bouton « Charger plus » disparaît avant même que la question n'ait eu le temps de répondre, la question ne peut donc plus repartir avec un curseur qui ne lui appartient pas.
- **Le numéro de génération avance au même instant**, indépendamment de toute requête en cours : une réponse déjà en vol pour l'ancienne question devient périmée sur-le-champ, qu'elle arrive avant ou après la réponse de la nouvelle. C'est ce qui manquait entièrement côté file d'incidents.
- **Les lignes et le total affichés ne sont volontairement PAS effacés** à cet instant : ils restent ceux de l'ancienne question jusqu'à ce que la nouvelle réponde. Un instant de données périmées mais **cohérentes** vaut mieux qu'un vide qui clignote à chaque lettre tapée dans une recherche.
- **Le verrou du double clic vit dans une `ref`** (`enVol`), pas dans le state `loading` : une ref se lit et s'écrit tout de suite, un state ne se voit qu'au rendu suivant — exactement la fenêtre où deux clics synchrones passaient tous les deux.
- Un chargement resté « en vol » pour l'ancienne question ne garde pas le verrou bloqué pour la nouvelle : le verrou est relâché au même moment que la remise à zéro, et sa réponse — de toute façon périmée par le numéro de génération qui vient de changer — ne le reprendra pas elle-même.

### 2.3 Ce qui n'a pas changé

- `useParcPage` garde son débond de 250 ms sur la recherche en direct (`{ debounceMs: 250 }`).
- `ParcSocPanel` garde son rechargement immédiat sur un changement de gravité (`debounceMs` par défaut, 0).
- La coupure « pas de chargement en session de support » (`ParcSocPanel`) devient un paramètre explicite (`actif: !support`), au lieu d'un `if (support) return;` glissé dans l'ancien effet — même comportement, plus lisible.
- Aucune des deux options d'affichage (colonnes, boutons, libellés) n'a bougé.

---

## 3. La preuve, avant/après/contre-épreuve

Nouveau garde-fou navigateur **`check:courses-parc`** (`scripts/check-courses-parc.mjs`, dans `package.json`), en deux parties :

1. **Statique** : vérifie que `useParcPage.ts` et `ParcSocPanel.tsx` importent bien le **même** `useCursorPage` — un correctif posé sur l'un sans l'autre serait exactement la divergence d'origine.
2. **Navigateur**, les scénarios A et B décrits en §1.2, sur les deux listes.

| | Résultat |
|---|---|
| **Avant** correctif (code de `f6a729f`, sans `useCursorPage`) | **échoue**, 6 défauts (§1.2) |
| **Après** correctif | **passe**, aucun défaut |
| **Contre-épreuve 1** : la remise à zéro devient un `useEffect` ordinaire au lieu d'un `useLayoutEffect` | **passe encore** — la différence entre les deux ne se joue qu'à l'échelle d'une image (moins de 16 ms), largement sous la résolution de ce test ; documentée comme telle, pas un défaut du test |
| **Contre-épreuve 2** : la remise à zéro est **désactivée** (le numéro de génération ne bouge plus quand la question change) | **échoue à nouveau** sur le registre des organisations (délai de recherche 250 ms — la fenêtre où le défaut d'origine se produit) ; confirme que le test détecte une vraie régression |

Sorties complètes : `docs/mesures/courses-parc-2026-09-25/`.

---

## 4. Garde-fous

| | Cliente | Interne |
|---|---|---|
| **check:courses-parc** (nouveau) | — (écrans internes seulement) | vert |
| check:coquille, check:signal, check:mobile, check:xss | vert | vert |
| check:visite (régression) | vert | vert |
| check:contraste | vert | vert |
| check:support | — | vert |
| check:veille-cliente | vert | — |
| check:business | vert | — |
| 40 contrôles statiques | vert | vert |
| tsc, lint | 0 erreur (85 avertissements, déjà là) | |

La fusion de synchro validée n'a pas été touchée (`check:fusion-sync`, `check:sync` verts). Rien d'autre n'a été modifié que les trois fichiers cités en §2.1.
