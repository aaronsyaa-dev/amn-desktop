# Alertes critiques quand l'app est fermée — ce qu'amn-api doit faire

> Refonte S3 (Supervisor et Garde), édition **interne** seulement.
> Côté app, le contrat est figé dans `src/refonte/garde/alertes.ts` et vérifié
> par `npm run check:garde-refonte`. **Rien n'est envoyé aujourd'hui** :
> ce document décrit le travail d'amn-api, qui n'a été ni modifié ni appelé.

## Pourquoi

Aujourd'hui, un problème grave n'atteint personne si l'app est fermée :

| Situation | App ouverte (Electron) | App fermée |
|---|---|---|
| Alerte critique d'un site | notification système (`NotificationsManager.tsx:132`) | rien |
| Escalade (« personne n'a pris l'incident ») | notification (`NotificationsManager.tsx:152`) | rien |
| Site qui ne répond plus | notification (`NotificationsManager.tsx:166`) | rien |
| Remontée critique de la Garde, garde en échec | visible dans les écrans seulement | rien |
| Appel entrant | sonnerie | Web Push (PWA seulement, `public/sw.js:244`) |

Le Web Push existe déjà (`src/lib/webPush.ts`, clé VAPID côté serveur), mais
il ne sert qu'aux appels. Electron fermé ne reçoit rien du tout. Aucun e-mail
d'alerte n'existe.

## Le principe

**Seul le critique traverse l'app fermée.** Le reste attend le résumé du
matin (le bloc « Pendant votre absence »). Une alerte de trop, et la personne
coupe tout ; la nuit où ça compte, plus rien ne passe.

## Le contrat (côté app, déjà écrit)

### Les cinq types

| Type | Seuil « critique » (`estCritique`) | Clé de regroupement (`cleDAlerte`) |
|---|---|---|
| `incident-critique` | incident de gravité `critical`, **premier** signal de l'incident (une IP qui mitraille fait un incident, donc une alerte) | `incident-critique:<incidentId>` |
| `escalade` | l'incident critique est resté sans preneur au-delà du délai d'escalade (déjà compté par amn-api : trame `incident:escalated`) | `escalade:<incidentId>` |
| `site-muet` | un site suivi ne répond plus depuis `siteMuetMinutes` (15 par défaut) | `site-muet:<siteId>` |
| `garde-en-echec` | une garde a échoué `gardeEchecsConsecutifs` rondes de suite (3 par défaut) | `garde-en-echec:<agent>` |
| `remontee-critique` | la Garde ouvre une remontée de gravité `critique` | `remontee-critique:<remonteeId>` |

Seuils par défaut (`SEUILS_CRITIQUES_DEFAUT`) : `siteMuetMinutes: 15`,
`gardeEchecsConsecutifs: 3`, `silenceRepetitionMinutes: 60` (une même clé ne
sonne pas deux fois en une heure). **amn-api doit appliquer exactement la même
règle.** Si elle change côté serveur, elle change dans `alertes.ts`, et
inversement.

### Les préférences (`PreferencesAlertesCritiques`)

```json
{
  "version": 1,
  "canaux": { "notification": true, "email": true },
  "types": {
    "incident-critique": true,
    "escalade": true,
    "site-muet": true,
    "garde-en-echec": true,
    "remontee-critique": true
  },
  "email": null
}
```

- Par compte, **stockées côté serveur** : le poste est fermé quand elles servent.
- Défaut : tout le critique, par les deux canaux.
- `email: null` = l'adresse du compte. Une autre adresse ne s'active qu'après vérification.
- Le **silence de nuit de la Garde (22 h → 7 h) ne s'applique pas** au critique : c'est la nuit qu'il compte.
- Lecture tolérante : un champ manquant ou inconnu prend le défaut (`normaliserPreferences`).

### La charge envoyée (`AlerteCritique`)

```json
{
  "kind": "alerte-critique",
  "type": "site-muet",
  "cle": "site-muet:<siteId>",
  "titre": "Un site ne répond plus",
  "corps": "<nom du site> ne répond plus depuis 15 min.",
  "vers": "#/supervisor/a-traiter",
  "at": "2026-10-20T03:12:00.000Z"
}
```

Des identifiants et un texte court. **Jamais** un secret, un jeton, une IP
complète, ni le contenu d'un message de cliente.

## Ce qu'amn-api doit faire

1. **Stocker les préférences.** Une table (ou une colonne JSON) par compte.
   - `GET /v1/alertes/preferences` : rend les préférences normalisées.
   - `PUT /v1/alertes/preferences` : valide comme `normaliserPreferences` (champs inconnus ignorés, e-mail douteux refusé).
   - Réservé à l'édition interne (comptes d'AMN DevSec). Une cliente n'a pas de parc.
2. **Émettre un signal à chaque endroit qui le connaît déjà :**
   - incident critique : là où les alertes sont regroupées en incidents, à l'**ouverture** de l'incident ;
   - escalade : là où part déjà la trame `incident:escalated` ;
   - site muet : le relevé qui dérive l'état d'un site (dernier battement), au passage du seuil ;
   - garde en échec : le Capitaine (`src/garde/capitaine.js`), qui compte déjà `agent.echecs` ;
   - remontée critique : le magasin de la Garde (`src/garde/store.js`), à la création d'une remontée `critique`.
3. **Décider** avec la même règle que l'app : `estCritique`, puis le type coché dans les préférences, puis les canaux cochés.
4. **Regrouper.** Persister `(compte, cle, derniereFois)`. Ne rien renvoyer pour une même clé avant `silenceRepetitionMinutes`. Plafonner l'e-mail : au plus 6 par compte et par heure, puis un seul e-mail récapitulatif.
5. **Savoir si l'app est fermée.** Un compte qui a une connexion temps réel ouverte (la WebSocket du poste) est servi par l'app : ne rien envoyer. Sinon :
   - **notification** : Web Push vers chaque abonnement du compte (mécanisme existant des appels), avec la charge ci-dessus ;
   - **e-mail** : envoi immédiat, une alerte par e-mail, objet = `titre`, corps = `corps` + lien vers `vers`, et un lien vers les préférences.
6. **Electron fermé** ne reçoit pas de Web Push (le module ne s'abonne que dans la PWA). Pour une personne qui n'utilise que l'app de bureau, l'e-mail est le seul canal. À dire dans les Réglages.
7. **Journaliser** chaque décision (envoyé, regroupé, coupé par préférence), sans contenu sensible : c'est ce que le résumé du matin pourra relire (« 2 alertes critiques envoyées cette nuit »).
8. **Tester sans réseau** : seuils (bords inclus), regroupement, plafond d'e-mails, « app ouverte : rien ne part », préférences tolérantes. Aucun envoi réel en test (transport d'e-mail et de push simulés).

## Ce qui reste à faire côté app (hors S3)

- `public/sw.js` : traiter `kind: 'alerte-critique'` comme l'appel (`requireInteraction: true`, `tag = cle`, clic vers `vers`). Fichier hors de la zone S3.
- Une section « Alertes critiques » dans les Réglages, lisant et écrivant les préférences. `SettingsScreen.tsx` est sensible : elle passera par une couture `@edition/*`, comme `MouvementSection`. Les libellés existent déjà (`alertes.*` dans `src/refonte/garde/i18n.ts`).
- Brancher `NotificationsManager` sur le même seuil (`estCritique`) pour que l'app ouverte et l'app fermée disent la même chose.
