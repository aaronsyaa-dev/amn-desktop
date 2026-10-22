# Simulation — bac à sable amn-api

Simuler un usage réaliste, des pannes et des abus courants dans un bac à sable **isolé**, pour trouver ce qui
casse avant les vrais utilisateurs.

## Cadre (tenu par le code, pas seulement par la consigne)

- **Bac à sable uniquement** : amn-api en local, repli **SQLite** (bases jetables sous `/tmp/sim`), serveur sur
  `127.0.0.1`.
- **Aucun tiers, vérifié par le code** : le serveur de simulation est lancé avec `lib/isolement-reseau.mjs`, qui
  refuse toute connexion hors boucle locale (avant même la résolution DNS) et note ce qu'il a voulu appeler. Le
  rapport local liste ces tentatives.
- **Données fictives** : population à graine fixe, comptes `@exemple.test`, entreprises inventées. Jamais la
  production, aucun secret, aucune donnée réelle.
- **Défensif** : les abus sont exercés contre notre propre bac à sable pour tester la détection. Pas d'outil
  d'exploitation, pas de code offensif réutilisable.
- **Reproductible** : même graine, même population et mêmes tirages (`lib/prng.mjs`). Jamais `Math.random()`.
- **Dépôt public** : les faiblesses de **sécurité** et l'inventaire de surface restent en local
  (`constats-securite/`, `RAPPORT.md`, `mesures/surface-publique.json`, ignorés par git). Ne sont publiés que les
  constats d'intégrité, de fiabilité et de performance.

## Lancer

amn-api doit être lisible sur disque. Indiquer son chemin par `AMN_API_DIR` (défaut `/home/user/amn-api`) :

```
npm run sim                  # tout (≈ 5 min)
npm run sim:base             # usage + pannes + attaques de base (≈ 30 s)
npm run sim:profond          # concurrence + contrat + durabilité + attaques approfondies + 2000 comptes

npm run sim:usage            # journée type, pic, facturation, 400 connexions, conflits, hors-ligne
npm run sim:pannes           # API coupée, latence, corps volumineux, redémarrage brutal
npm run sim:attaques         # connexions répétées, abus, accès croisé, entrées malformées, campagne (Garde)
npm run sim:concurrence      # écrasement multi-champs, résurrection, curseur since, lot rejoué
npm run sim:contrat          # chaque chemin /v1 appelé par le poste existe-t-il côté amn-api ?
npm run sim:durabilite       # 10 SIGKILL en pleine écriture, lot coupé, état après redémarrage, Garde tuée
npm run sim:attaques-profond # attaques approfondies, qui est averti ? (scénarios locaux, non publiés)
npm run sim:echelle          # 2000 comptes : connexions, sockets, grosse cliente, 10 000 fiches, Garde
```

Sorties : `docs/simulation/RAPPORT.md` (**local**), `mesures/derniere-passe.json` (local). Les constats, avec
preuve, sont dans `constats/`.

## Population synthétique

`lib/seed.mjs` : 400 personnes sur 12 entreprises fictives (dirigeant, comptable, commercial, technicien), formules et
effectifs variés, un siège de trop sur une organisation sur six, un site muet sur une sur quatre. Pour la montée en
charge : 2000 personnes sur 60 organisations (`nombreOrganisations`), les 12 premières restant identiques.

## Dernière passe (2026-10-22, graine 424242) — hors sécurité

| Scénario | Résultat | À retenir |
|---|---|---|
| Journée type, pic, facturation, 400 connexions simultanées | 🟢 | 400/400 en ~5 s ; écriture p50 ≈ 2 ms |
| Pannes : API coupée, latence, corps trop gros, SIGKILL | 🟢 | échec propre ; 15 Mo refusé en 413 ; aucune demi-écriture |
| **Durabilité : 10 SIGKILL sous 6 écrivains** | 🟢 | ≈ 2 900 écritures accusées, **0 perdue**, 0 base corrompue |
| Isolement entre organisations, escalade de rôle, 236 routes | 🟢 | voir le rapport local |
| 2000 sockets temps réel (60 organisations) | 🟢 | ouvertes en 1,8 s ; diffusion p95 13 ms |
| Espace de 10 000 fiches | 🟡 | une lecture : 70-90 ms pour 5,3 Mo ; **10 postes ensemble figent toute l'API 0,3 à 0,9 s** |
| Garde sur 2000 comptes | 🟢 | rondes ≤ 60 ms, 0 en retard |
| **Écrasement concurrent** (2 comptes ; 8 personnes ; suppression) | 🔴 | **7 champs sur 8 perdus** ; fiche supprimée qui ressuscite |
| **Contrat poste ↔ API** | 🔴 | `/v1/collections/_activity` appelé par le poste, absent d'amn-api |
| **Lot d'événements** | 🔴 | non atomique (coupé en route : 9 à 116 sur 200) ; renvoyé = doublons |
| Tempête de 2000 connexions | 🟡 | ~82/s sur 4 cœurs : le dernier attend ~25 s ; les connectés ne ressentent rien |
| Grosse cliente (300 → 600 personnes) | 🟡 | présence en N³ : 472 Mo → 3,7 Go de trames |
| Redémarrage / Garde tuée en ronde | 🟡 | freins en mémoire remis à zéro ; état « en ronde » périmé (cosmétique) |

Classement par gravité : [`CARTE-POINTS-FAIBLES.md`](CARTE-POINTS-FAIBLES.md).

## Non vérifié

- **Postgres (Supabase)** : tout tourne sur SQLite. Verrous, pool et latence de la base distante ne sont pas exercés.
- **Une coupure de courant** : SIGKILL arrête le processus, pas la machine. Le réglage `synchronous` est relevé
  (NORMAL en WAL), pas éprouvé.
- **Les seuils réels de la Garde** (escalade à 15 min) : le bac à sable réduit le tick.
- **Derrière l'infrastructure réelle** (Render, proxy, CPU partagé) : la tempête de connexions a été mesurée sur
  4 cœurs ; sur 0,5 cœur le débit serait de l'ordre de 10 connexions/s (estimation, non mesurée).
- **Le vrai poste** : on exerce l'API, pas l'interface ni la file d'envoi hors ligne réelle.
