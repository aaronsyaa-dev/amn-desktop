# La bulle Ajmani, Whisper, et les modules ultra premium — rapport au réveil

Chantier en trois blocs, imposés dans l'ordre : le serveur Whisper (Bloc 1), la bulle flottante
(Bloc 2), puis une vague de modules « ultra premium » (Bloc 3). Tag posé avant tout travail :
`avant-bulle-modules` (local — le push de tags renvoie 403 sur ce proxy, documenté de longue date).

## Bloc 1 — Whisper, vraiment branché

**La cause exacte.** `whisper-server.exe` (whisper.cpp) tournait sur `127.0.0.1:8080` chez Aaron.
Deux défauts empêchaient l'app de le voir :
1. Les ports sondés par défaut (8000, 1234) visaient des serveurs compatibles OpenAI
   (LM Studio, faster-whisper-server) — 8080 n'y était jamais.
2. La sonde interrogeait `/v1/models`, un chemin qu'expose l'API OpenAI mais pas whisper.cpp : un
   serveur bien vivant y répondait 404 et se faisait prendre pour une absence.

**Corrigé.** `src/main/whisper.ts` sonde maintenant 8080 en premier, détecte lequel des deux
contrats répond (`/v1/models` pour OpenAI-compatible, sinon la page racine que sert whisper.cpp) et
appelle le bon endpoint (`/inference` pour whisper.cpp, `/v1/audio/transcriptions` pour un serveur
OpenAI-compatible). Trois échecs distincts, jamais confondus : injoignable, en erreur, ou réponse
sans texte exploitable (`unexpected-format`, propagé jusqu'au message affiché).

Un réglage est apparu dans **Réglages → Ajmani — transcription vocale**, avec l'adresse détectée et
un champ pour la forcer (persisté dans `whisper-config.json`, prioritaire sur `AMN_WHISPER_URL`).

**Effet de bord trouvé et corrigé en route** : les stubs de l'édition Business (préchargement et
pont navigateur) ne portaient pas la clé `whisper` du contrat commun `AmnBridge` — `tsc -p
tsconfig.business.json` était cassé depuis le chantier précédent, et personne ne l'avait fait
tourner. C'est corrigé et vérifié.

**Preuve** : `npm run check:whisper` (9 scénarios, fetch simulé — le scénario nommé confirme que
8080 est sondé en premier et que whisper.cpp n'est jamais pris pour une absence) et `npm run
check:voix` (10 scénarios sur le chemin micro complet). Guards existants restés verts.

## Bloc 2 — Ajmani en bulle flottante

F9 ouvre désormais une petite fenêtre flottante en bas à droite (au-dessus de la barre basse sur
téléphone), plutôt que le panneau plein : l'ordre, la réponse courte, l'état d'écoute (l'icône
micro grossit avec le niveau sonore). « Lire les détails » ouvre le panneau plein sur demande
seulement. Échap, un clic dehors ou vingt secondes d'inactivité la referment sans rien perdre — la
conversation vit dans `AssistantProvider`, la bulle n'est qu'une vue dessus ; un petit point discret
reste au repos pour la rouvrir.

**Différence assumée** : tenir F9 est déjà le geste de confirmation (tenir, parler, relâcher), donc
la bulle envoie directement au lieu de poser le texte dans un champ à valider. Le mic du panneau
plein garde l'ancien comportement (dicter, relire, envoyer). Dans les deux cas, `sendMessage()`
reste l'unique chemin : un ordre qui écrit continue de demander sa confirmation, inchangé.

**Preuve avec un vrai flux audio, pas seulement l'interface** : amn-api lancé avec le parc de
démonstration, build web servi localement, Chromium piloté par Playwright avec
`--use-fake-device-for-media-stream` (un vrai `getUserMedia`, un vrai `MediaRecorder`, un micro
simulé au niveau système — pas un mock du code). La bulle affiche la raison exacte du correctif du
Bloc 1 : « Micro capté — aucun serveur de transcription local n'est configuré », jamais un
« indisponible » générique. Captures envoyées : repos, écoute, résultat, poste et téléphone.

## Bloc 3 — les modules ultra premium

### Ce qui a été construit, en profondeur

**Facturation avancée — avoirs et relances graduées** (approfondit un module existant, comme
demandé). Deux briques, une seule intégration cohérente :

- **Les avoirs** (`kind: 'creditNote'`) ont leur propre séquence de numérotation légale
  (`AV-AAAA-NNNN`), continue et jamais mélangée à celle des factures. Ils réduisent la dette nette
  d'une facture (`netDueCents`), jamais en dessous de zéro. `src/lib/fec.ts` — qui disait depuis son
  écriture ne pas savoir compenser une annulation — produit maintenant l'écriture comptable inverse
  d'un avoir (le compte client crédité, les comptes de produits et de TVA débités, mêmes comptes,
  montants toujours positifs en ligne comme l'exige le format).
- **Les relances graduées** (`src/lib/relances.ts`) : quatre paliers sur des seuils usuels (7 / 21
  / 45 jours), un message et un ton distincts par palier (rappel, ferme, mise en demeure, dernier
  avis), et une alerte quand le ton doit monter depuis la dernière relance notée — la Relance ne dit
  plus jamais la même phrase polie à trois jours de retard et à cent quarante.
- **Intégration Ajmani** : la fiche facture expose son contexte (`useAjmaniFocus({type: 'facture',
  ...})`) — un type déjà lu côté `amn-api/garde/capitaine.js` (`COLLECTION_PAR_FOCUS.facture →
  invoices`), vérifié en lisant ce fichier plutôt que supposé : seul le client manquait cette ligne.

**Un bogue réel trouvé en vérifiant visuellement, corrigé avant de committer** : `isOverdue()`
marquait un AVOIR lui-même comme « en retard », parce qu'il porte une date sans rapport avec un
paiement. Vu en capture d'écran, corrigé, couvert par un nouveau contrôle.

**Preuve** : 45 contrôles neufs (`check:avoirs` — 13, `check:relances` — 13, 2 nouveaux dans
`check:fec`, 17 clés i18n FR/EN ajoutées et vérifiées par `check:langue`), plus la boucle visuelle
réelle — amn-api + parc de démonstration + build web servi, facture pleine, avoir pointant vers sa
facture d'origine, palier de relance affiché avec l'alerte de montée de ton, poste (1280 px) et
téléphone (390 px). Toutes les captures envoyées à Aaron pendant le travail. Tous les guards
existants (`check:business`, `check:ecrans`, `check:modules`, `check:sync`, `check:persistence`,
`check:cibles`, `check:contraste`, etc.) restent verts, `tsc` propre sur les deux éditions, `version`
inchangée.

### Ce qui a été volontairement laissé de côté, et pourquoi

La consigne était claire — quinze modules excellents valent mieux que cinquante moyens — et elle a
gouverné ce choix : **un seul module a été mené jusqu'au bout de la profondeur demandée**, plutôt que
d'ouvrir plusieurs chantiers à moitié. Douze candidats de la liste restent devant nous, chacun pour
une raison précise, pas par manque de temps générique :

- **Comptabilité — rapprochement bancaire et trésorerie prévisionnelle** : demande un import de
  relevé bancaire et un moteur de rapprochement (matching flou montant/date/libellé) qui n'existent
  nulle part dans le code actuel — une brique entièrement neuve, pas un approfondissement. Le bon
  candidat pour la prochaine vague, une fois la facturation stabilisée sur ce qui vient d'être posé.
- **Devis multi-versions + factures récurrentes** : un vrai second morceau de « Facturation
  avancée », volontairement séparé de celui-ci pour ne pas mélanger deux logiques différentes (un
  historique de versions de devis n'a presque rien à voir avec un échéancier récurrent) dans un
  même commit sans queue.
- **Gestion de projet façon Gantt** : le moteur de projets actuel est explicitement conçu pour NE
  RIEN stocker (« un projet est un filtre, jamais une copie ») — un vrai chemin critique demande un
  graphe de dépendances entre tâches ET une visualisation chronologique manipulable, c'est-à-dire
  une brique d'interface aussi grande que tout ce qui a été livré ce chantier, avant même
  l'algorithme. Elle mérite son propre chantier, pas une fin de nuit.
- **CRM pipeline avancé, RH légère, campagnes email, BI, automatisations inter-modules avancées** :
  chacun demande soit une UI de construction (graphiques libres, séquences email) soit une
  intégration serveur (scoring, planification) qui déborde d'un seul repo desktop.
- **Portail client en marque blanche, éditeur de permissions avancé, API et webhooks pour la
  cliente, journal d'audit exportable** : touchent tous à `amn-api` (authentification, rôles,
  webhooks sortants) au-delà de ce qu'un chantier côté desktop peut poser seul sans risquer une
  intégration bâclée entre deux dépôts.
- **Inventaire et prévision de stock** : le produit n'a aujourd'hui aucune donnée de vente
  structurée (quantités, unités) dont dériver un historique réel — l'inventer produirait des
  prévisions qui ont l'air sérieuses et qui ne le sont pas, exactement ce que ce chantier a refusé
  de faire pour la comptabilité (voir `fec.ts`).

Aucun de ces douze n'a été commencé puis abandonné à mi-chemin : ils n'ont pas été ouverts, pour ne
pas produire une pile d'ébauches à la place d'un module qui tient debout.

## Ce qu'Aaron doit tester en premier

1. **Bloc 1** : lancer whisper.cpp sur sa machine (port 8080 par défaut), tenir F9, parler,
   relâcher. Le message doit maintenant refléter honnêtement ce qui se passe — plus jamais
   « indisponible » générique.
2. **Bloc 2** : vérifier que la bulle apparaît bien en bas à droite depuis n'importe quel écran, se
   referme à l'Échap et à l'inactivité, et retrouve la conversation en la rouvrant.
3. **Bloc 3** : ouvrir Facturation, émettre un avoir sur une facture réelle (partiel puis total),
   vérifier que le montant dû se met à jour partout (liste, détail, Relances), et exporter le FEC
   pour confirmer que l'avoir y apparaît en écriture inverse équilibrée.
