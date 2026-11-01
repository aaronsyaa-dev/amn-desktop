# Jeux de données fictives de la refonte

Des données **entièrement inventées**, en français, pour construire et tester les
écrans sans jamais toucher à une vraie donnée. Un appel suffit :

```ts
import { construireMonde, jeu } from '../donnees';

const monde = construireMonde();                       // tout, volume « normal »
const gros = construireMonde({ volume: 'beaucoup' });  // de quoi éprouver défilement et pagination
const clients = jeu('clients', 'peu');                 // un seul jeu
const mixte = construireMonde({ volume: 'normal', volumes: { factures: 'vide', clients: 'beaucoup' } });
```

## Ce qui est garanti

| Garantie | Comment |
|---|---|
| **Reproductible** | même graine, mêmes données, à l'octet près (`GRAINE_REFERENCE`). Chaque jeu a son hasard : changer le volume d'un jeu ne déplace pas les autres. |
| **Stable dans le temps** | rien ne lit l'horloge. « Maintenant » = **vendredi 30 octobre 2026, 10 h 15** (`MAINTENANT_REFERENCE`), le jour des maquettes. Une capture refaite dans un an est identique. `construireMonde({ maintenant })` décale tout de façon cohérente. |
| **Rien de réel** | courriels en `@….exemple.test` (domaine réservé, RFC 2606) ; téléphones dans les plages que l'ARCEP réserve à la fiction (`01 99 00`, `06 39 98`) ; SIRET commençant par `000`, IBAN à clé `00`, jamais d'IBAN complet ; plaques d'immatriculation invalides par construction ; aucune photo, aucun secret (les secrets sont des **valeurs masquées**, jamais une valeur). La Garde et Cyber : identifiants `FICT-AAAA-NNNN`, aucune adresse réseau, aucun nom d'outil de sécurité réel, constats réduits à un titre et une gravité, campagnes réduites à des agrégats. Les noms sont des assemblages de prénoms et noms courants : une ressemblance avec une vraie personne est une coïncidence. |
| **Cohérent** | une facture payée a son paiement, qui a son mouvement bancaire ; un client est « Impayé » parce qu'une facture est échue ; une série vient des tâches faites ; le statut d'un projet vient de ses tâches ; la TVA à payer vient des factures et des dépenses du mois ; le net d'un bulletin vient des salaires du mouvement bancaire ; la quantité d'un article est la somme de ses mouvements ; le nombre de non-lus d'une conversation vient de ses messages ; l'état d'une organisation de La Garde vient de son score, de ses alertes ouvertes et de sa dernière ronde ; l'état d'une mission Cyber vient de son accord. Les maquettes se contredisent (72 clients ici, 48 là) : ces jeux, non. |
| **Complet pour les écrans** | dès « peu » ou « normal », chaque cas que les fiches montrent existe : un impayé, un brouillon, une facture annulée, une tâche en retard, une ronde de La Garde à venir, les trois statuts de client, les quatre colonnes de tickets… |

## Volumes

| Volume | Sert à | Exemple (clients / factures / tâches) |
|---|---|---|
| `vide` | l'état vide de chaque écran | 0 / 0 / 0 (l'équipe garde la personne connectée) |
| `peu` | un compte qui démarre | 6 / 8 / ≈ 50 |
| `normal` | le cas des maquettes | 48 / 70 / ≈ 270 |
| `beaucoup` | défilement, pagination, performance | 300 / 700 / ≈ 1 750 |

`construireMonde` assemble les 100 jeux en quelques centaines de millisecondes, même au volume `beaucoup`.

## Conventions

- **Montants en centimes entiers** (`...Cents`), TTC sauf mention contraire. Aides : `totauxDeFacture`, `totauxDeLignes`.
- **Un champ qui existe déjà dans le dépôt garde son nom** (`title`, `status`, `assigneeEmail`, `amountCents`…). Un champ que seule une fiche réclame est en français et cite sa fiche (`types.ts`). `compat.ts` vérifie à la compilation que `FicheClient`, `Devis`, `Facture`, `Evenement`, `Depense`, `NoteRapide` et `Projet` restent des sur-ensembles des types du dépôt.
- **Jours** : `AAAA-MM-JJ` du calendrier de Paris (heure d'hiver et d'été gérées). **Instants** : ISO.
- **Ce qui est dérivé se recalcule** : « En retard » (`statutAffiche`), santé d'un client (`calculerSante`, formule proposée par H05), avancement et statut d'un projet (`avancementProjet`, `statutProjet`), série (`journeesDeTravail`, `serieEnCours`), quantité en stock (`quantiteEnStock`), état d'une organisation (`etatOrganisation`), score et niveau de maturité (`scoreMaturite`, `niveauMaturite`), état d'un accord (`etatAccord`), disponibilité d'un outil (`outilDisponible`), niveau de conformité (`niveauConformite`), jours sans impayé (`joursSansImpaye`). Un écran doit refaire ces calculs ; les valeurs stockées servent à comparer.
- Les règles que les fiches disent « à confirmer dans le code » sont implémentées comme **propositions**, nommées dans le code. Ne les prenez pas pour la règle du produit.

## Catalogue des jeux

Les 100 jeux sont dans `types.ts` (`NOMS_DES_JEUX`, 25) et `types-suite.ts` (`NOMS_DES_JEUX_SUITE`, 75). Fiches = celles de `AMN-refonte-CO/lots/`.

| Lot | Jeux | Fichier |
|---|---|---|
| Base | `equipe`, `entreprise` | `equipe.ts`, `fond.ts` |
| Ma journée | `taches`, `evenements`, `projets`, `tickets`, `notes`, `rappels`, `habitudes` ; planning de l'équipe : `creneaux` ; défis : `defis` | `ma-journee.ts`, `complements.ts` |
| Contacts | `clients`, `interlocuteurs`, `prospects`, `fournisseurs`, `achats`, `avis`, `relances`, `fidelite` ; `partenaires` | `contacts.ts`, `complements.ts` |
| L'argent | `devis`, `factures`, `paiements`, `depenses`, `abonnements`, `contrats`, `comptes`, `mouvements`, `enveloppes` ; TVA et impôts : `echeancesFiscales` ; paie : `bulletins` ; tarifs : `prestations` | `argent.ts`, `complements.ts` |
| Écrire | `fichiers`, `signatures`, `pages`, `modeles`, `journal`, `textes`, `archives`, `connaissances` | `ecrire.ts` |
| Échanger | `conversations`, `messages`, `canaux`, `annonces`, `courriels`, `salles`, `appels`, `reunions`, `partages`, `sondages`, `reponsesAuto` | `echanger.ts` |
| Créer | `articles`, `produits`, `commandes`, `chantiers`, `dossiersPhotos`, `marque`, `videos`, `pagesPubliques`, `etapesTournee`, `equipements`, `ressources`, `reservations`, `vehicules`, `modelesControle`, `controles`, `ecarts` | `creer.ts` |
| Outils | `corbeille`, `aide`, `secrets` (masqués), `sites`, `trackers`, `sauvegardes`, `operations`, `raccourcis`, `automatisations`, `connecteurs`, `notifications`, `modelesMetier`, `usagesCalculs` | `boite-outils.ts` |
| La Garde | `organisations`, `actifs`, `alertes`, `incidents`, `vulnerabilites`, `rondes`, `evenementsSecurite`, `journalAcces`, `criteresMaturite`, `offresCyber` | `garde.ts` |
| Cyber (LOT-10) | `outilsCyber`, `accords`, `missions`, `constats`, `documentsCyber`, `logicielsClients`, `alertesVeille`, `fuites`, `dossiersConformite`, `campagnes`, `parcSecurite` | `cyber.ts` |

Aides communes : `commun.ts` (horodatages bornés au passé, cycles, hasard par jeu).

**Pas encore faits** : voir le rapport `docs/refonte/rapports/DONNEES.md`.

## Vérifier

```
node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-donnees.ts
```

87 contrôles : reproductibilité, volumes, absence de données réelles, références
qui existent, numérotation continue des factures, chiffres qui se recoupent,
français correct, absence de secret, d'adresse réseau et de nom d'outil de sécurité réel, et les mêmes invariants sur 12 graines (« peu » et « normal »), 4 graines (« beaucoup ») et 4 dates de référence.

## Ajouter un jeu

1. Le type dans `types.ts` (sur-ensemble du type du dépôt s'il existe, puis une ligne dans `compat.ts`) ; le nom dans `NOMS_DES_JEUX` et dans `Monde`.
2. Un générateur : `hasard(graineDe(ctx.graine, 'nom'))`, `compter(ctx.volumes.nom, [vide, peu, normal, beaucoup])`, aucune lecture de l'horloge.
3. Son appel dans `monde.ts`, **après** les jeux dont il dépend.
4. Les cas que les écrans montrent doivent être **garantis**, pas laissés au tirage (voir `garantir` dans `argent.ts`).
5. Des contrôles dans `scripts/check-donnees.ts` : références, passé et futur, recoupements.
