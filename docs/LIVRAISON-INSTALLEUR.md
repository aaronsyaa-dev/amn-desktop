# Livrer l'installeur Business

## Le fait qui change tout : il n'y a pas d'installeur par cliente

L'application Business est **exactement la même pour toutes vos clientes**. Elle
apprend son organisation, ses modules et sa couleur **à la connexion**, par la
session qu'amn-api lui rend. Rien de la cliente n'est compilé dedans — ni son
nom, ni son identifiant, ni ses modules.

Un `.exe` « avec ses modules à l'intérieur » n'existe donc pas, et ne peut pas
exister : il faudrait le recompiler chaque fois qu'on ouvre ou ferme un module
chez elle.

**Une version publiée, autant de liens qu'on a de clientes.** Ce qui change
d'une cliente à l'autre, c'est son compte — et l'Atelier le crée déjà.

## Pourquoi amn-api ne fabrique pas le fichier

L'installeur Windows est produit par **Squirrel, qui exige une machine
Windows**. amn-api tourne sous Linux : aucun code écrit côté serveur n'y changera
rien. La production reste un geste d'atelier — sur votre machine, ou dans une CI
Windows.

Ce qu'amn-api fait, en revanche : elle **tient le registre** des versions et
**distribue l'accès** par des liens à durée limitée.

## La chaîne, en trois gestes

```bash
# 1. Sur une machine Windows
npm run make:business

# 2. Sur la même machine — enregistre le fichier auprès d'amn-api
AMN_API_URL=https://votre-amn-api OPERATOR_TOKEN=… npm run publish:release
```

3. Dans l'**Atelier** (`Tour de contrôle → Atelier`), créez la cliente. L'écran
   de remise porte alors **deux liens** : l'accès au compte, et le
   téléchargement de l'installeur.

Le script calcule l'empreinte SHA-256, lit la version dans `package.json` et
retrouve le fichier dans `out/make` tout seul.

## Où vivent les octets

`publish:release` enregistre un **emplacement**. Deux formes sont acceptées, et
le choix vous appartient :

| Emplacement | Ce qui se passe | À savoir |
| --- | --- | --- |
| **URL** (`--location https://…`) | amn-api **redirige** (302) | La bande passante ne passe pas par l'instance, où elle est mesurée. **Recommandé** — Cloudflare R2 est gratuit à cette échelle |
| **Chemin local** (par défaut) | amn-api **sert le fichier** | Ne marche que si amn-api tourne sur cette machine. Sur Render, il faut un disque persistant, qui est payant |

Le script vous avertit en clair quand l'emplacement est un chemin local.

## Ce que le lien garantit

- **30 jours**, puis il cesse de fonctionner ;
- il **n'ouvre rien d'autre** : le jeton vit dans sa propre table, jamais dans
  `sessions`, donc il ne peut satisfaire aucune route authentifiée. Un test le
  vérifie sur `/v1/auth/me`, `/v1/admin/organizations` et `/v1/collections` ;
- il **ne se brûle pas** au premier usage : un téléchargement repris ne doit pas
  échouer. Les usages sont comptés, pas limités ;
- l'**empreinte SHA-256** est affichée à côté du lien et voyage avec le fichier
  (en-tête `X-AMN-SHA256`), pour vérifier l'octet reçu sans rien redemander.

Un lien expiré, révoqué ou inventé donnent **la même réponse**, mot pour mot.

## Si aucune version n'est publiée

L'Atelier ne rend pas de lien : il **refuse et le dit**, avec les deux commandes
à lancer. Rendre un lien qui ne mène nulle part serait pire — vous l'enverriez à
une cliente sans le savoir.

## Ce qui reste à faire le jour où l'installeur devient la voie principale

- **Signer le binaire.** Sans signature, SmartScreen affiche un avertissement
  rouge : sur le poste d'une cliente, c'est ce qui décide si elle installe ou si
  elle appelle. Un certificat coûte quelques centaines d'euros par an — une
  dépense, pas une ligne de code.
- **Un canal de mise à jour distinct**, pour qu'une cliente ne reçoive jamais
  une version interne d'AMN Desktop.

Le web/PWA reste la voie sans aucun de ces problèmes : une URL, rien à
installer, rien à signer.
