# Correctif — le micro restait « indisponible » (Ajmani partout, Bloc 2)

Chantier de suite du Bloc 2 (`docs/ajmani-partout-2026-09-08.md`), qui l'avait annoncé
franchement dans son propre rapport : le mécanisme vocal n'avait été vérifié qu'avec un micro
simulé (Playwright), jamais un vrai périphérique. Ce document couvre le correctif du bogue
signalé par Aaron sur sa machine réelle.

## Le signalement

F9 déclenche bien l'état d'écoute (l'interface fonctionne), mais l'application affiche
systématiquement « Micro indisponible — écrivez votre demande ». Windows a bien donné l'accès au
microphone à AMN Business (vérifié dans Paramètres → Confidentialité et sécurité → Microphone,
avec un accès récent horodaté) : ce n'est donc pas un problème de permission côté système.

## Ce qui a été vérifié, et ce qui a été écarté

Je n'ai pas pu reproduire le bogue moi-même : cet environnement n'a aucun microphone, et aucun
serveur de transcription local n'y tourne. Ce qui suit vient de la lecture du code, pas d'un essai
avec un vrai périphérique — voir plus bas ce qu'Aaron doit vérifier de son côté pour confirmer le
diagnostic.

**Écarté — la couche Electron (permissions).** `src/main.ts` configure déjà correctement
`setPermissionRequestHandler`/`setPermissionCheckHandler` pour autoriser `media`, et aucune
fenêtre ne tourne avec `webSecurity: false` ni une configuration `webPreferences` inhabituelle. Le
plus solide des indices : `CallContext.tsx` (les appels opérateur-à-opérateur) utilise déjà
`getUserMedia` avec cette même configuration Electron, en production, sans ce problème. Si
Electron bloquait le micro en interne, cette fonctionnalité serait cassée elle aussi — elle ne
l'est pas.

**Trouvé — deux bogues distincts dans le code vocal du Bloc 2 :**

1. **Le message était générique, quelle que soit la cause.** `AssistantContext.tsx` jetait la
   raison précise que `SessionVocale` rendait déjà (permission refusée / aucun périphérique /
   serveur de transcription absent / etc.) et se contentait de `voixEtat('echec')`.
   `AssistantPanel.tsx` affichait alors la même phrase, « Micro indisponible — écrivez votre
   demande », pour TOUS les cas d'échec. Un micro qui capte parfaitement mais qui n'a personne à
   qui parler (aucun serveur Whisper local installé) s'affichait donc exactement comme un micro
   physiquement absent — ce qui est le cœur de la confusion signalée.

2. **Une erreur du pont Electron perdait sa nature en traversant l'IPC.** `main/whisper.ts` lève
   une `WhisperError` distinguant « injoignable » de « a répondu en erreur ». Mais
   `ipcMain.handle`/`ipcRenderer.invoke` ne transporte pas les propriétés d'une classe d'erreur
   personnalisée (ici `.kind`) : le renderer n'aurait reçu qu'un message générique, rendant
   impossible une classification fiable même une fois le premier bogue corrigé.

**L'hypothèse la plus probable pour la machine d'Aaron** (à confirmer par lui, voir plus bas) :
le micro fonctionne, Windows l'autorise, mais aucun serveur de transcription compatible OpenAI
(`faster-whisper-server`, `whisper.cpp --convert`, LM Studio…) ne tourne sur les ports sondés
(`AMN_WHISPER_URL`, sinon `127.0.0.1:8000`, `127.0.0.1:1234`, `localhost:8000`) — c'est exactement
la brique que le Bloc 2 avait dit ne jamais avoir testée avec un vrai serveur.

## Ce qui a été corrigé

- **`src/assistant/voix.ts`** — réécrit autour d'un type fermé `RaisonEchecVocal` (huit valeurs
  distinctes : `permission-refusee`, `aucun-peripherique`, `enregistrement-impossible`,
  `aucun-serveur-transcription`, `serveur-transcription-en-erreur`, `transcription-vide`,
  `trop-court`, `inconnue`) — plus jamais un texte libre. Toute l'IO (micro, enregistreur, base64,
  appel de transcription) passe désormais par un `AdaptateurVocal` injecté, ce qui la rend
  testable sans navigateur ni microphone.
- Un **niveau sonore en direct** (`suivreNiveau`, via `AudioContext`/`AnalyserNode`) est maintenant
  remonté pendant l'écoute — la preuve visuelle qu'un signal arrive vraiment, indépendamment de la
  transcription. Confort de diagnostic seulement : son échec (navigateur trop ancien, etc.) ne
  bloque jamais l'enregistrement.
- **Négociation du type MIME** de `MediaRecorder` (`choisirMimeType`) : Windows/Chromium n'accepte
  pas toujours le même type que d'autres plateformes ; le code essaie
  `audio/webm;codecs=opus`, `audio/webm`, `audio/ogg;codecs=opus`, `audio/mp4` dans cet ordre au
  lieu d'imposer un seul choix.
- **`src/shared/api.ts`** — nouveau type `WhisperTranscrireResultat` (`{ok:true; texte}` ou
  `{ok:false; kind; message}`), et le contrat du pont (`AmnBridge.whisper.transcrire`) ne rejette
  plus jamais : il rend un verdict.
- **`src/main/exclusive.internal.ts`** — le handler IPC `whisper:transcrire` capture désormais la
  `WhisperError` et rend l'objet structuré ci-dessus, au lieu de laisser l'erreur traverser l'IPC
  (et perdre son `.kind` au passage).
- **`src/edition/browserExclusive.internal.ts`** — le repli navigateur (édition web, sans
  Electron) rend le même verdict structuré plutôt que de lever une exception.
- **`src/assistant/AssistantContext.tsx`** — `voixRaison` et `voixNiveau` sont maintenant exposés
  dans le contexte, au lieu d'être jetés.
- **`src/assistant/AssistantPanel.tsx`** — huit messages distincts (un par `RaisonEchecVocal`),
  par exemple : « Micro capté — aucun serveur de transcription local n'est configuré. » au lieu de
  « Micro indisponible ». L'icône du bouton micro grossit légèrement avec le niveau sonore pendant
  l'écoute.

## Ce qui reste à vérifier — je ne peux pas le faire moi-même

Aucune machine de ce chantier n'a de microphone ni de serveur de transcription : la plomberie ci-
dessus suit le contrat documenté et est vérifiée mécaniquement (`npm run check:voix`, neuf
scénarios avec un `AdaptateurVocal` entièrement simulé — voir plus bas), mais rien ne prouve qu'un
vrai microphone Windows livre des données lisibles à `MediaRecorder`, ni qu'un vrai serveur Whisper
répond correctement au format envoyé.

### Comment Aaron doit tester, sur sa machine

1. Ouvrir Ajmani (n'importe quel écran), tenir **F9**.
2. **Regarder l'icône du micro** : elle doit légèrement grossir pendant que vous parlez. Si elle ne
   bouge jamais, le micro ne capte rien — un problème matériel ou système, indépendant de ce
   correctif.
3. Relâcher F9, lire le message affiché sous le champ de texte :
   - **« Micro capté — aucun serveur de transcription local n'est configuré. »** → le diagnostic
     ci-dessus est confirmé : le micro fonctionne, il ne manque qu'un serveur Whisper compatible
     OpenAI installé et lancé sur la machine (voir l'en-tête de `src/main/whisper.ts` pour les
     logiciels compatibles et `AMN_WHISPER_URL` pour pointer vers un port non standard).
   - **« Micro refusé… »** ou **« Aucun microphone détecté… »** → un problème RÉEL et NOUVEAU,
     différent de celui déjà diagnostiqué ici, à signaler avec le message exact affiché.
   - **« Rien n'a été compris… »** → le serveur de transcription a répondu, mais avec un texte
     vide — vérifier le volume du micro ou la langue configurée sur le serveur.
4. Sans serveur installé, la commande vocale reste dégradée par conception : le texte tapé demeure
   la voie normale, jamais un blocage.

### Le test mécanique déjà fait

`npm run check:voix` (nouveau, neuf scénarios, aucun navigateur ni microphone requis) fait
circuler un flux audio entièrement simulé à travers le chemin exact
`getUserMedia → MediaRecorder → base64 → appel de transcription`, et vérifie que chaque branche
d'échec rend sa propre raison — en particulier le scénario nommé explicitement « LE BOGUE CORRIGÉ »,
qui prouve qu'un micro capté avec succès mais sans serveur de transcription rend
`aucun-serveur-transcription`, jamais une raison liée au micro lui-même.

## amn-api

Aucun changement. La transcription vocale est un service local qu'Aaron installe et fait tourner
lui-même sur sa machine (même discipline que `main/ollama.ts`) — jamais un appel à `amn-api` ni à
un serveur d'AMN DevSec. Rien à modifier côté serveur pour ce correctif.

## Guides restés verts

`check:langue`, `check:business`, `check:ecrans`, `check:liens`, `check:clavier`, `check:focus`,
`check:cibles`, `check:contraste`, `check:largeur`, `check:releve`, `check:naming`, `check:veille`,
`check:reformuler`, `check:parole`, plus `npx tsc --noEmit` et `npm run lint` (0 erreur, les
avertissements restants sont tous préexistants, sans rapport avec ce correctif). Le nouveau
`check:voix` est vert (9 contrôles). `version` dans `package.json` n'a pas changé.
