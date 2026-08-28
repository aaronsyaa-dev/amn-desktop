# Audit de la supervision — ce qu'on a, et ce qui manque pour parler de SOC

*Établi en lisant le code d'`amn-api` sur `main` et en exerçant l'API, pas en
relisant des notes. Chaque constat dit sur quoi il repose.*

---

## 1. Ce qui existe, et qui est bon

La chaîne de détection est réelle et bien placée. Trois choses méritent d'être
dites, parce qu'elles sont souvent mal faites ailleurs :

**La détection vit sur le serveur, pas sur le site de la cliente.** Le traceur
installé chez elle n'envoie que des observations brutes ; `src/tracker/engine.js`
décide. Trois conséquences, toutes bonnes : un site *serverless* — gelé entre
deux invocations, donc incapable de tenir un compteur glissant — obtient quand
même la détection de force brute ; améliorer un détecteur se déploie chez nous
plutôt que de demander à chaque cliente de mettre à jour un paquet ; et la
sonde de disponibilité part forcément d'ailleurs que du site surveillé.

**Les scans partent d'une IP de sortie connue**, jamais de la connexion
personnelle d'un opérateur, et la cible est gardée contre le SSRF.

**Six détections** tournent aujourd'hui : force brute, dépassement de débit,
injection, empreinte de robot, réputation d'IP, anomalie de trafic. Quatre
balayages serveur s'y ajoutent : battements de cœur, disponibilité, dépendances
vulnérables (OSV), et le certificat TLS. Plus un scanner de neuf familles de
contrôles et un contrôle RGPD.

Ce n'est pas un gadget. C'est une bonne base de **détection**.

---

## 2. Le manque, et il est structurel

**Une alerte n'est rien d'autre qu'une ligne de journal.**

Mesuré, pas supposé. La table `events` (`src/db/schema.sql:37`) porte
exactement sept colonnes :

```
id, site_id, type, severity, message, payload, occurred_at
```

Aucune n'exprime ce qu'on en a fait. Pas de `acknowledged_at`, pas de
`resolved_at`, pas d'assignation, pas de « faux positif ». Et côté poste,
`AlertHistory` (`SiteControlScreen.tsx:430`) est une liste en **lecture seule** :
aucun geste n'y est possible.

Ce que ça produit concrètement :

- **on ne peut pas travailler à deux.** Rien ne dit qu'une alerte est déjà prise
  en charge par l'autre. Deux opérateurs enquêtent deux fois, ou zéro fois ;
- **rien ne se ferme.** Une alerte de 3 h du matin traitée à 9 h ressemble, à
  10 h, exactement à une alerte que personne n'a vue ;
- **le bruit ne diminue jamais.** Un faux positif reconnu revient à l'identique
  le lendemain, sans mémoire de la décision. C'est ainsi qu'une console d'alertes
  cesse d'être lue — et le jour où l'alerte compte, personne ne la voit ;
- **rien n'est mesurable.** Pas de délai de prise en charge, pas de délai de
  résolution. Or un centre de supervision se juge exactement là-dessus.

**Deuxième manque, du même tissu : aucune corrélation.**

Une IP qui tente une force brute, puis une injection, puis promène un scanner
de ports produit aujourd'hui **trois alertes indépendantes**, dans trois lignes
qui ne se connaissent pas. C'est pourtant *une* campagne, et c'est cette
lecture-là qui a de la valeur : trois lignes isolées se lisent comme du bruit,
une campagne appelle un geste.

---

## 3. Les angles morts de détection, par ordre de rentabilité

Le scanner regarde le transport, les en-têtes, les cookies, la divulgation, le
CMS, les erreurs SQL et les ports. Il ne regarde **pas** le DNS.

**L'usurpation d'email est l'angle mort le plus coûteux pour une PME.** Sans
`SPF`, sans `DMARC`, n'importe qui écrit un email qui *vient* du domaine de la
cliente — un faux virement au comptable, une facture au client. C'est passif,
ça se vérifie en une requête DNS, et aucune cliente ne l'a aujourd'hui.

Trois autres manques, moins graves mais réels :

- **fichiers sensibles exposés** — `/.env`, `/.git/config`, sauvegardes
  oubliées. Une seule requête HTTP chacun, et une trouvaille vaut le scan entier ;
- **méthodes HTTP dangereuses** (`TRACE`, `PUT`) laissées ouvertes ;
- **`security.txt`** absent : c'est ce qui permet à un chercheur bienveillant de
  signaler une faille plutôt que de la publier.

---

## 4. Ce qui n'existe pas du tout, côté maison

- **aucun journal d'audit interne** : qui a ouvert le dossier de quelle cliente,
  qui a changé un rôle, qui a supprimé quoi. `org_access_log` couvre l'entrée
  chez une cliente, rien d'autre ;
- **aucun suivi des erreurs de l'application elle-même** (déjà noté au Bloc 0) ;
- **aucune escalade** : une alerte critique à 3 h du matin n'atteint personne.

---

## 5. L'ordre dans lequel je traite

1. **Le cycle de vie d'un incident** — c'est ce qui transforme un flux d'alertes
   en travail. Rien d'autre n'a de valeur tant que ça manque.
2. **La corrélation par acteur** — même geste, même écran : elle tombe
   naturellement une fois les incidents introduits.
3. **Les mesures** — délai de prise en charge, délai de résolution. Elles ne
   coûtent presque rien une fois (1) et (2) posés, et elles seules disent si la
   supervision s'améliore.
4. **SPF/DMARC et les fichiers exposés** dans le scanner.
5. **Le journal d'audit interne.**

Une note sur ce que je **ne** prétends pas mesurer : le délai de *détection*
(MTTD) demanderait de savoir quand l'attaque a commencé, ce que nous ne savons
pas. Annoncer un MTTD serait inventer un chiffre. Les délais de prise en charge
et de résolution, eux, sont entièrement dans nos données.
