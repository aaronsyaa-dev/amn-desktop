# Écrasement en édition concurrente — correctif

Le défaut prouvé par l'audit du 10/09 (`docs/audit-fiabilite-2026-09-10.md`, scénario S5) est fermé.
Deux personnes qui modifient la même fiche — l'une hors ligne — ne se perdent plus mutuellement leur
travail. Preuves dans `docs/captures/fusion-2026-09-10/`.

**Le patch amn-api est prêt et validé, il n'est PAS poussé** (`amn-api-fusion.patch`, 5 fichiers).
La moitié poste est commitée ici : seule, elle ne change rien pour personne, elle se contente
d'envoyer deux champs de plus qu'un serveur d'avant ignore.

## 1. Le bug était réel — reproduit avant de toucher au code

Rejoué au niveau où la donnée se perd vraiment : les requêtes HTTP que les deux postes envoient.
Les deux personnes touchent des champs **différents** de la même tâche, donc rien ne se contredit.

```
1. état de départ, lu par les DEUX postes    status="todo"  priority="normal"
2. B (HORS LIGNE) : status → "doing". Son écriture part en file d'envoi.
   elle porte : status="doing" priority="normal"   (priority est PÉRIMÉ)
3. A (EN LIGNE)  : priority → "high". Le serveur accepte.
   serveur : status="todo" priority="high"
4. B RETROUVE LE RÉSEAU — sa file rejoue son écriture
   serveur : status="doing" priority="normal"

   modification de B (status → doing)  : CONSERVÉE
   modification de A (priority → high) : PERDUE
```

`priority="high"` n'existe plus nulle part : ni sur le serveur, ni sur l'écran de A à la prochaine
relecture. Personne n'est averti. **La coupure réseau ne crée pas le défaut, elle allonge la fenêtre** :
deux postes connectés qui ont la même fiche ouverte le produisent aussi, à quelques secondes d'écart.

Journal complet : `repro-avant-apres.txt`.

## 2. Le correctif règle le scénario exact de l'audit

Même script, même scénario, avec un poste qui dit d'où il part :

```
4. B RETROUVE LE RÉSEAU — sa file rejoue son écriture
   serveur : status="doing" priority="high"
   le serveur annonce une FUSION : champs repris de B = [status, _by]

   modification de B (status → doing)  : CONSERVÉE
   modification de A (priority → high) : CONSERVÉE
```

Et rejoué **dans le vrai produit**, sur le scénario S5 à l'identique (B hors ligne épingle un message,
A en ligne y réagit 👍) :

```
C1 — B (HORS LIGNE) épingle — son écriture attend en file
     {"en_file":1,"base_annoncee":"2026-09-10T20:00:27.933Z","champs_declares":["pinned","_by"]}
C1 — A (EN LIGNE) réagit 👍 — le serveur l'enregistre
     {"reactions_serveur":1,"pinned_serveur":false}
C1 — B RETROUVE LE RÉSEAU — état FINAL du message
     {"pinned":true,"reactions":1,"verdict":"LES DEUX SURVIVENT — l'écrasement est fermé"}
```

Vérifié aussi à l'écran, pas seulement en base (`C1-convergence-A.png`, `C1-apres-fusion-A.png`) :
le message porte le 👍 de A **et** figure dans la barre des épinglés posée par B.

Couverture permanente : **11 tests neufs** dans `amn-api/test/fusion.test.js` (le cas de l'audit, le
même champ des deux côtés, trois gestes hors ligne d'affilée, l'enregistrement supprimé entre-temps,
un patch mal formé, la compatibilité avec un poste d'avant) et **10 contrôles neufs** dans
`npm run check:envoi` côté poste (33 → 43).

## 3. La piste retenue, et pourquoi pas l'autre

Ni l'une ni l'autre des deux pistes du rapport, mais **la détection de la première et la résolution
de la seconde** : le poste annonce la version dont il part (`base`) et les seuls champs qu'il a
changés (`patch`) ; le serveur ne fusionne que si la base a bougé.

**Pourquoi pas le refus 409 seul.** Le poste ne sait rien faire d'un refus sinon abandonner
l'écriture — la file classe déjà 409 en « non réessayable », donc le geste de Mohamed serait annoncé
puis perdu, à refaire. Surtout, il frapperait le cas le plus **courant** : deux personnes connectées
qui touchent la même fiche à quelques secondes d'écart, une réaction et une épingle sur le même
message. Rien ne s'y contredit, et pourtant un refus par jour sur des gestes qui ne s'opposent pas.
On aurait échangé une perte rare et silencieuse contre une perte fréquente et annoncée.

**Pourquoi pas la fusion seule.** Sans `base`, le serveur ne peut rien décider : il reçoit un
enregistrement entier, et rien n'y distingue un champ délibérément remis à son ancienne valeur d'un
champ jamais touché. La détection n'est pas un supplément, c'est ce qui rend la fusion possible.

**Coût et risque.** ~100 lignes serveur, ~80 lignes poste. Le risque tenait à la fusion elle-même :
il est borné par trois choix. La décision est **une seule fonction pure** (`src/lib/fusion.js`)
appelée par les deux pilotes de base — ils ne peuvent pas diverger. Elle ne s'applique **que** si la
base a bougé : le chemin normal, de très loin le plus fréquent, reste identique au bit près. Et
`base`/`patch` sont **facultatifs** des deux côtés, donc poste et serveur se mettent à jour dans
n'importe quel ordre sans rien casser (vérifié : un poste sans `base` retrouve exactement le
comportement d'avant, bug compris).

**Cohérence avec l'existant.** La file d'envoi conservait déjà « une seule entrée par
enregistrement, le dernier geste gagne » ; elle conserve maintenant en plus la base d'ORIGINE et
cumule les champs changés — sans quoi trois modifications hors ligne n'en décriraient qu'une.
La lecture et l'écriture serveur sont dans une transaction (verrou de ligne sur Postgres), sinon deux
écritures simultanées fusionneraient sur le même état périmé.

## 4. Non-régression : les trois scénarios déjà validés

Rejoués dans le navigateur, deux vrais postes, après correctif (`journal.json`) :

| Scénario (audit) | Avant | Après |
|---|---|---|
| Synchro normale A → B (S2) | 73 ms | **107 ms**, visible chez B |
| Coupure réseau, écriture hors ligne, reprise (S4) | serveur 4,0 s / A 4,0 s | **serveur 2,2 s / A 2,0 s**, file vidée, bannière d'attente présente puis disparue |
| Redémarrage du serveur (S6) | sockets 7,8 s, écriture livrée 8,0 s | **sockets 2,4 s, écriture de panne livrée 2,4 s**, visible chez B 2,4 s |

Plus : suite amn-api **475/475** (464 d'avant + 11 neufs), `check:envoi` 43/43, `tsc` propre sur les
deux éditions, `eslint` sans erreur, `check:sync`, `check:persistence`, `check:modules`,
`check:business` verts, et les deux pilotes de base exposent le même contrat.

`check:incidents` reste rouge : c'est le faux positif déjà connu, dont le patch est préparé à part —
hors de ce chantier, comme demandé, et volontairement non touché ici.

## 5. Ce qui reste, et qu'il faut savoir

- **Le même champ des deux côtés en même temps** : le dernier arrivé gagne, comme avant — mais sur
  ce seul champ, plus sur toute la fiche. Aucune règle automatique ne peut trancher un vrai conflit.
- **La fusion est de premier niveau** : un objet imbriqué (`billTo`) ou un tableau (`lines`,
  `reactions`) est remplacé en entier, jamais fusionné élément par élément. Fusionner deux tableaux
  demanderait de savoir ce qu'est un « même élément » — la deviner produirait des lignes de facture
  en double le jour où chacun en ajoute une.
- **Les liens entre champs ne sont pas connus** : une facture qui s'émet pose ensemble `status`,
  `number` et `issuedAt`. Si l'autre poste écrivait au même moment un `status` périmé, la fusion
  garderait le numéro et le statut d'avant — incohérent, mais moins destructeur que l'écrasement
  d'aujourd'hui, qui perdait aussi le numéro. La vraie réponse serait des groupes de champs atomiques
  déclarés par collection ; ce n'est pas dans ce chantier, et c'est écrit pour ne pas être découvert
  à l'usage.
- **La suppression n'est pas concernée** : une suppression hors ligne rejouée efface encore ce que
  l'autre a modifié entre-temps. C'est un arbitrage humain (« Mohamed a supprimé pendant que vous
  modifiiez »), pas une fusion — laissé de côté volontairement, hors du défaut de l'audit.
- **Postgres n'a pas pu être exercé ici** : pas de base disponible dans ce bac à sable. La décision
  fusionnée est la même fonction pour les deux pilotes et elle est testée ; ce qui n'est pas prouvé
  est le SQL du pilote Postgres (transaction + `FOR UPDATE`). Le travail CI `postgres` d'amn-api le
  couvrira à la poussée.

## 6. Ce qu'Harun doit faire

1. **Relire le patch** `docs/captures/fusion-2026-09-10/amn-api-fusion.patch` (5 fichiers, 537 lignes,
   dont la moitié est du commentaire et des tests). Il s'applique proprement sur `main` d'amn-api —
   vérifié dans une copie neuve, tests passés depuis le patch seul.
2. **Dire quand le pousser sur amn-api.** Je ne pousse pas sans votre accord. Une fois poussé, Render
   redéploie, et la CI passe le travail Postgres qui manque ici.
3. **Reconstruire l'installateur** (`npm run make`) pour que les postes envoient `base` et `patch` —
   c'est le poste qui déclenche la fusion, le serveur seul ne suffit pas.
4. **L'ordre n'a pas d'importance** : serveur d'abord ou poste d'abord, rien ne casse. La protection
   n'est complète que lorsque les deux sont à jour.
5. **Refaire le test à deux, en vrai** : ouvrez la même tâche tous les deux, l'un coupe son Wi-Fi et
   change le statut, l'autre change la priorité, puis le premier se reconnecte. Les deux
   modifications doivent tenir.
