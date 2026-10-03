# Mise en ligne — la liste courte

Écrite après le signalement « le module Clients a disparu chez une cliente » (octobre 2026), où une PR de plusieurs dizaines de commits a été livrée d'un bloc et où une écriture en attente pouvait se perdre au changement de version. Chaque ligne correspond à un contrôle qui existe : on le lance, on ne le « vérifie » pas de tête.

## 1. Avant de merger

- [ ] **La PR est courte** : un sujet, quelques commits. Une PR qui cumule des dizaines de commits ne se relit pas, et un défaut s'y cache.
- [ ] **CI verte** sur la PR : `Les garde-fous`, `Build business + contrôle de fuite`, `Build interne`, `Garde-fous croisés (poste ↔ serveur)`. Les garde-fous croisés incluent désormais `check:modules-de-base` et `check:isolation`.
- [ ] **En local, si la PR touche la synchronisation, les organisations, les modules ou la connexion :**
  - `npm run check:file-heritee`, pour qu'aucune écriture en attente ne soit perdue au changement de version ;
  - `AMN_API_ROOT=../amn-api npm run check:modules-de-base -- <bundle business> <port>`, puis la même chose avec `--interne` sur un bundle interne ;
  - `AMN_API_ROOT=../amn-api npm run check:isolation -- <bundle> <port>`, puis avec `--fondatrice` sur un bundle interne.
- [ ] **amn-api** : `npm test` vert. Il couvre l'isolation entre organisations, le fait qu'un module n'est jamais retiré en sous-main, et la colonne Activité.

## 2. Déployer, dans cet ordre

1. **API (Render)** : redéployer le dernier commit de `main`, puis vérifier `GET /v1/health`. L'API passe d'abord, parce que le poste peut s'appuyer sur ce qu'elle apporte (par exemple `X-AMN-Org`), alors que l'inverse est toujours toléré.
2. **Web (Vercel)** : merger dans `main`. Le workflow « Ce qui est servi à la cliente » doit passer au vert, ce qui veut dire :
   - le bundle servi est bien celui des clientes ;
   - Clients, Agenda, Tâches et Facturation sont présents pour l'organisation de référence (voir plus bas).
3. **Desktop (Electron)** : mettre à jour la version dans `package.json`, ajouter l'entrée au changelog, puis pousser le tag `git tag vX.Y.Z && git push origin vX.Y.Z` depuis `main`. En dernier, parce qu'une version installée ne se reprend pas.

## 3. Après la mise en ligne

- [ ] Le workflow « Ce qui est servi à la cliente » est vert après le déploiement Vercel. Il repasse aussi toutes les heures.
- [ ] Ouvrir une session sur l'organisation de référence et passer une minute dans Clients, Agenda, Tâches et Facturation.
- [ ] Si une cliente signale un module absent, lancer `DATABASE_URL=… node scripts/diagnostic-modules-org.mjs "<nom>"` dans amn-api. Le script est en lecture seule et masque les adresses. Il dit si le module est ouvert côté serveur et pourquoi, si la personne l'a retiré de sa barre, et combien de fiches existent.
- [ ] Si la synchronisation a changé, lancer `DATABASE_URL=… node scripts/audit-isolation.mjs` (lecture seule) pour repérer les fiches recopiées entre organisations.

## L'organisation de référence (à créer une fois)

C'est une organisation **de test**, jamais une cliente. On la crée depuis la console d'administration, avec un compte propriétaire dédié. On y saisit, dans l'application :

- un client nommé « Référence Client » ;
- un rendez-vous « Référence RDV », que l'on recrée s'il sort de la vue de l'agenda ;
- une tâche « Référence Tâche » ;
- une facture adressée à « Référence Facture ».

Ensuite, dans le dépôt amn-desktop (Settings → Secrets and variables → Actions) :

- les secrets `AMN_REF_EMAIL` et `AMN_REF_MDP`, pour le compte propriétaire ;
- la variable `URL_CLIENTE`, si elle n'existe pas encore.

Sans ces secrets, le contrôle après déploiement passe son tour et l'annonce dans un avertissement. Il ne protège alors rien.
