# Simulation — bac à sable amn-api

Simuler un usage réaliste et des abus courants, dans un bac à sable **isolé**,
pour trouver ce qui casse avant les vrais utilisateurs.

## Cadre (tenu par le code)

- **Bac à sable uniquement** : amn-api en local, repli **SQLite** (base
  jetable sous `/tmp/sim`), serveur sur `127.0.0.1`, **aucun réseau sortant**.
- **Données fictives** : population synthétique à graine fixe, comptes
  `@exemple.test`, entreprises inventées. **Jamais** la production (Render,
  Vercel, domaines amndevsec), aucun tiers, aucun secret, aucune donnée réelle
  (Syraagensy, NWSY).
- **Défensif** : les abus sont exercés contre notre propre bac à sable pour
  tester la détection. Pas d'outil d'exploitation, pas de code offensif
  réutilisable.
- **Reproductible** : même graine → même population et mêmes tirages
  (`simulation/lib/prng.mjs`). On n'utilise jamais `Math.random()`.

## Lancer

amn-api doit être lisible sur disque (cloné à côté). Indiquer son chemin par
`AMN_API_DIR` (défaut `/home/user/amn-api`) :

```
npm run sim              # tout : usage + pannes + attaques
npm run sim:usage        # journée type, pic du lundi, facturation, 400 connexions, conflits, hors-ligne
npm run sim:pannes       # API coupée, latence, corps volumineux, redémarrage brutal
npm run sim:attaques     # connexion répétée, abus API, accès croisé, entrées malformées, campagne (Garde)
```

Sortie : `docs/simulation/RAPPORT.md` (**local, non poussé**) et
`docs/simulation/mesures/derniere-passe.json`. Les constats (avec preuve)
vivent dans `docs/simulation/constats/`.

## Population synthétique

400 personnes réparties sur 12 entreprises fictives, profils variés (dirigeant,
comptable, commercial, technicien), formules et effectifs variés. Une
organisation sur six a un siège de trop, une sur quatre un site qu'on laisse
muet — du grain pour la Garde, jamais du critique gratuit.

## Résultats de la dernière passe (2026-10-22, graine 424242)

13 🟢 · 0 🟡 · 2 🔴 sur 15 scénarios.

| Scénario | Résultat | Preuve (résumé) |
|---|---|---|
| Journée type (40 pers., lecture + 3 écritures) | 🟢 tient | 40/40 ; écriture p50 ~2,6 ms |
| Pic du lundi (400 connexions, 50 en //) | 🟢 tient | 400/400, ~80 conn/s |
| Facturation fin de mois (12×20 factures) | 🟢 tient | 240/240 ; p50 ~1,9 ms |
| 400 connexions simultanées | 🟢 tient | 400/400, 0 erreur réseau, ~5 s |
| **Conflits d'écriture (2 comptes, champs différents)** | 🔴 **casse** | une modification écrasée (dernier-gagne) |
| **Hors ligne puis reconnexion (S5)** | 🔴 **casse** | `priority="high"` perdue |
| API coupée puis redémarrée | 🟢 tient | échec propre ; note retrouvée |
| Latence réseau (20 écritures) | 🟢 tient | 20/20 persistées |
| Corps volumineux (2 Mo / 15 Mo) | 🟢 tient | 15 Mo → 413 borné proprement |
| Redémarrage brutal (SIGKILL) pendant écriture | 🟢 tient | base relisible, aucune demi-écriture |
| Essais de connexion répétés | 🟢 tient | porte fermée au 6ᵉ essai, blocage ~900 s |
| Abus de l'API (650 écritures) | 🟢 tient | freinage au 601ᵉ (429) |
| Accès d'un compte aux données d'un autre | 🟢 tient | fiche non vue ; console 404 ; anonyme 401 |
| Entrées malformées (SQL / XSS / traversée) | 🟢 tient | 4 journalisées, aucune ne bloque la saisie |
| Campagne multi-sites (détection Garde) | 🟢 tient | remontée « campagne » ~qq s après le dernier événement |

Les deux rouges ont la **même cause** : le correctif de fusion d'écriture
concurrente n'est pas déployé dans amn-api. Détail et preuve :
[`constats/2026-10-22-ecrasement-ecriture-concurrente.md`](constats/2026-10-22-ecrasement-ecriture-concurrente.md).

## Détection (qui voit quoi, et en combien de temps)

| Abus | Chaîne | Détecté |
|---|---|---|
| Connexion répétée | immédiate (`login_buckets`, 429) | au 6ᵉ essai (5/compte) |
| Abus d'écriture | immédiate (`rateLimit`, 429) | au 601ᵉ appel (600/min) |
| Accès croisé | prévention (portée dérivée du justificatif) | bloqué d'emblée |
| Entrées malformées | immédiate (Sentinelle → Tour de contrôle) | journalisée en ~qq ms, **sans bloquer** |
| Campagne multi-sites | différée (tracker → incident → Garde.sécurité) | remontée quelques secondes après le dernier événement (tick réduit en bac à sable ; seuil réel 3 orgs/24 h) |

## Non vérifié

- **Postgres (Supabase)** : la simulation tourne sur le repli SQLite ; la route
  de fusion et les verrous `FOR UPDATE` côté Postgres ne sont pas exercés.
- **Seuils réels de la Garde** (escalade à 15 min) : le bac à sable réduit le
  tick ; le délai mesuré est celui de la chaîne, pas le seuil de production.
- **Le vrai poste** (amn-desktop) : on exerce l'API, pas l'interface ni la file
  d'envoi hors ligne réelle du poste.
