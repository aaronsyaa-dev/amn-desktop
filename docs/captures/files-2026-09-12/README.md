# Famille A — les files, avant et après

Trois modules composés le 12 septembre : `Relances`, `SAV`, `Rendez-vous en
ligne`. L'audit de départ les avait rangés ensemble sous « quelque chose arrive
et attend une réponse », et les avait désignés comme la famille la plus
dangereuse — quatre têtes de file composées pareil feraient quatre écrans
jumeaux.

## Une erreur d'audit, corrigée en lisant le modèle

`Rendez-vous en ligne` n'est pas une file. Rien n'y arrive : les réservations
tombent directement dans l'Agenda, et l'écran ne fait que régler une page
publique. C'est une **vitrine**, au sens du Bloc 0 : son objet n'est pas dans
l'application, il est chez le visiteur. Il est composé comme tel, et
`docs/modules-restants-2026-09-12.md` le reclasse.

Le reclassement n'est pas cosmétique : c'est lui qui a fait sortir l'aperçu du
visiteur, et donc le seul chiffre qui manquait vraiment à cet écran — combien
de créneaux restent libres.

## L'après, module par module

| Écran | Objet dominant | Pourquoi celui-là | Ambre |
|---|---|---|---|
| Relances | Une seule lettre, posée en `panel-sheet`, et l'échelle des quatre paliers | Une relance EST un document : on la copie telle quelle. L'échelle répond à la question qu'on se pose devant une facture en retard — « je peux écrire ça, ou c'est trop tôt ? » | `À ÉCRIRE MAINTENANT` et le bouton de copie. Jamais sur la gravité : le rouge la dit déjà |
| SAV | La plus vieille demande non réglée, son âge en chiffre de titre ; les autres par tranches d'âge | Le fichier disait déjà « un client, un état, et SURTOUT un âge » — et c'est le tableau par ÉTAT qui cachait l'âge | `PERSONNE NE L'A PRISE`, ou `PRISE PAR …, TOUJOURS OUVERTE`, sur le geste que la demande réclame vraiment |
| RDV en ligne | L'aperçu du visiteur, rendu avec les mots et le calcul de la page publique | Sept cases cochées ne disent pas s'il reste un créneau libre demain ; une durée de 90 min dans une fenêtre de 9 h à 10 h n'en laisse aucun | Aucun quand la page est ouverte et pourvue. `LA PAGE EST FERMÉE`, ou « aucun créneau libre » si elle est ouverte et vide |

## Ce que la composition a forcé dans le code

- `src/lib/relances.ts` expose `ECHELLE` : les seuils étaient privés, l'écran
  les aurait sinon recopiés — et `paliereDe` compare en strict supérieur, donc
  « ferme » commence au huitième jour, pas au septième.
- `src/lib/creneaux.ts` est extrait de `PublicBookingScreen` : l'aperçu et la
  page publique partagent maintenant le calcul des créneaux. Deux copies du
  même algorithme divergent toujours d'une minute ou d'un bord d'intervalle.
- `<html lang>` n'existait nulle part. Il est posé, et tenu à jour par
  `src/i18n/index.ts` : lecteurs d'écran, césure, `:lang()`.

## Une hypothèse mesurée, et fausse

Le « 09:00 AM » des disponibilités devait, pensais-je, venir du `lang` manquant.
Mesure au navigateur : trois champs `type="time"`, l'un sous `<html lang="fr">`,
les deux autres portant eux-mêmes `lang="fr"` et `lang="fr-FR"` — les trois
rendent « 09:00 AM » tant que la locale du NAVIGATEUR est `en-US`. Chromium suit
sa propre locale d'interface, pas le document. Le `lang` reste juste pour ce
qu'il fait vraiment ; le commentaire dit maintenant ce qu'il ne fait pas.

## Les preuves

- `avant/` et `apres/` — les trois écrans, à 1180 × 1000, sur le bac à sable
  peuplé (six factures échues couvrant les quatre paliers, huit demandes SAV de
  deux heures à cinq semaines, une page de rendez-vous ouverte et pourvue).
- `apres/rdv-fermee.png` — la branche « page fermée », qui n'existe qu'après un
  clic et ne se serait pas vue autrement.

## Les gardes, à la livraison de la famille

| Garde | Résultat |
|---|---|
| `tsc` | 0 erreur |
| lint | 76 avertissements, 0 erreur — la ligne de base inchangée |
| `check:encres` | aucun défaut, 33 copies connues |
| `check:langue` | 8 contrôles sur 2329 clés |
| `check:signal` | 32 écrans, aucun avec plus d'un ambre, dans les DEUX éditions |
| `check:contraste` | 101 écrans, 20 513 textes, aucun sous WCAG AA |
