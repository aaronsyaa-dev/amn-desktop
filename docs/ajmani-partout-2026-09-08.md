# Ajmani partout — rapport au réveil

Chantier « Ajmani partout, le vrai Jarvis du desktop », avant un rendez-vous commercial. Point de départ : `avant-ajmani-partout` sur les deux dépôts (le tag n'a pas pu être poussé — la porte de la session le refuse en 403 sur les tags, comme lors des chantiers précédents ; les commits ci-dessous font foi). Arrivée : amn-desktop `34097ab` (branche `claude/first-pr-github-setup-ltpqqo`), amn-api `84da559` (`main`). Tous les gardes verts sur les deux dépôts, `check:postgres` passé avant chaque poussée d'amn-api, `version` intacte, données de test uniquement.

## Bloc 0 — l'état réel, avant de construire

**La pile et les tâches n'étaient pas fragmentées.** Le chantier précédent (Garde Bloc 6, « la Garde des Tâches ») avait déjà unifié les deux : l'agent `taches.emission` regroupe les remontées ouvertes en dossiers (Ajmani) et les transforme en enregistrements de la collection `tasks`, la même que le module Tâches lit. Une tâche née d'une garde porte `data.garde` (agent, équipe, dossier) ; elle se met à jour quand le dossier grossit, se ferme seule quand il se vide, ne se duplique jamais (identifiant stable `garde-d-<dossier>`), et un budget quotidien évite une avalanche (au-delà, une seule tâche dit combien de dossiers attendent dans la pile). Ce qui manquait, ce n'était pas le mécanisme : c'était la **preuve** qu'une tâche posée à la main par une personne cohabite avec, sans jamais être touchée par la Garde — fait au Bloc 4.

**Les écrans sans Ajmani.** Une confusion existait à corriger avant de coder : il y a déjà DEUX Ajmani. Le premier, ancien (`src/assistant/AssistantContext.tsx` + `engine.ts`), est un panneau **global** — monté dans `AppLayout`, ouvert par le bouton de la barre du haut ou Ctrl+J depuis n'importe quel écran interne (Poste de travail et Tour de contrôle compris). Il lit les collections du Poste (clients, tâches, notes, decisions, knowledge) et, en option, un modèle Ollama local. Le second, plus récent (chantier « La Garde »), est le cerveau côté serveur (`src/garde/cerveau.js`) : un vrai LLM (Claude), avec des outils, une garde des faits et un budget — mais il n'était appelé QUE depuis les routes `/garde/*`. Hors de la Garde, le panneau global retombait sur une reconnaissance de mots-clés locale (« clients », « tâches », « hors ligne »…) et, faute de correspondance, une phrase générique qui ne répond à rien (« Je supervise vos N sites… »). C'est ce point précis — pas l'absence totale d'Ajmani — qui correspond à « hors de La Garde, il n'a aucun lien avec ce qu'on regarde ».

**Le parcours de démo** (Bloc 0.3) a servi de fil rouge au Bloc 3 : Accueil → Clients → La Salle → Ajmani → Tour de contrôle, sur poste et téléphone.

## Bloc 1 — Ajmani partout : un seul cerveau, présent sur tout le desktop

- **Le point d'entrée global existait déjà** (bouton « Ajmani » de la barre, Ctrl+J) et la palette de commandes (Ctrl+K) appelait déjà `garde.ordre()` pour le texte libre — acquis du chantier précédent, vérifié, pas refait.
- **Le vrai changement** : quand le panneau global ne reconnaît aucun mot-clé précis (hors ligne, alertes, visiteurs, contenu d'un module) et qu'aucun modèle Ollama n'est configuré, il **escalade vers le cerveau de la Garde** au lieu d'afficher une phrase générique — même garde des faits, même budget, même confirmation avant toute écriture que dans l'espace La Garde.
- **Le contexte de l'écran** (`src/assistant/ecranContexte.ts`) : une fiche ouverte (client, tâche, projet…) annonce son focus tant qu'elle est montée ; le panneau le lit au moment d'envoyer et le fait voyager jusqu'au cerveau (`POST /v1/garde/ordres` porte désormais `{ contexte: { focus } }`). Câblé dans `ClientsScreen` — l'exemple exact du chantier.
- **Un piège trouvé et corrigé en le testant en direct** : la reconnaissance locale de mots-clés matchait le mot « client » dans « résume-moi ce client » et dumpait tout le répertoire — avant même d'atteindre l'escalade. Corrigé : la liste à plat ne se déclenche plus quand une fiche précise est ouverte (elle est alors, par construction, la mauvaise réponse à « ce client »-là).
- **Les outils du cerveau, étendus** (`OUTILS_DIRECTS_LECTURE`/`OUTILS_DIRECTS_ECRITURE` dans `capitaine.js`) :
  - `lire_organisation` — nom, **date de création**, formule, sièges, statut, modules d'une organisation cliente, cherchée par nom (tolère les accents, que `LOWER()` de SQLite ne replie pas) ou par le contexte de l'écran. C'est exactement le fait qu'Aaron avait trouvé manquant.
  - `lire_module` — les enregistrements d'un module du Poste de travail (clients, tâches, notes, factures, projets), filtrables par un mot.
  - `creer_note`, `creer_tache` — les deux seules écritures, non destructives, choisies parce que ce sont elles qu'on montrera en démo (Bloc 3).
- **La confirmation avant écriture** : le cerveau ne exécute jamais un outil qui modifie — il s'arrête, décrit ce qu'il ferait, et `executerOrdre` le propose (état `confirmation`). Un « oui » qui répète le texte exact retrouve la proposition **sur l'ordre déjà enregistré** plutôt que de rappeler le modèle une seconde fois : déterministe, et pas de second coût.

### Conversation-témoin, hors de l'espace La Garde (fiche Clients ouverte, serveur local sans clé Anthropic)

Vérifié en direct sur le Poste de travail (Playwright, build réel, API réelle) :

> Sur la fiche de **Camille Renaud** (Le Jardin d'Élise), dans le panneau Ajmani global :
> **résume-moi ce client** → « Je ne sais pas faire cela, ou je n'ai pas saisi. Essayez « qui n'a pas payé », « lance une ronde SSL sur … », « qu'est-ce qui s'est passé cette nuit ». Mon cerveau est hors ligne : pas de clé Anthropic sur le serveur. Restent les tournures du Lexique, derrière « ? ». »

Avant la correction du Bloc 1, la même question renvoyait la liste des six clients à plat, sans jamais toucher le cerveau — un exemple concret de ce que « il n'a aucun lien avec ce qu'on regarde » voulait dire. Sans clé Anthropic dans ce bac à sable, je ne peux pas montrer la vraie réponse résumée ; le mécanisme (contexte transmis, escalade déclenchée, aveu honnête plutôt qu'un silence ou un plantage) est prouvé côté serveur par sept tests avec un faux Anthropic (`test/cerveau.test.js`), dont un qui pose exactement cette question avec le contexte « client AllStore » et vérifie que le nom entre dans le préambule sans être prononcé par la personne.

## Bloc 2 — la commande vocale : ce qui marche, ce qui ne l'est pas

**Marche, vérifié mécaniquement (Playwright, microphone simulé) :**
- **F9 tenu, depuis n'importe quel écran** (testé depuis l'Accueil, hors de tout écran Ajmani) ouvre le panneau et démarre l'écoute — le raccourci non négociable du chantier.
- Un bouton micro (souris) fait la même chose pour qui n'a pas le clavier sous la main.
- L'enregistrement démarre et s'arrête proprement (`MediaRecorder`), sans fuite de flux audio.
- La transcription se pose dans le champ de texte, **jamais envoyée seule** — la personne relit, corrige, valide.
- L'échec (aucun serveur de transcription ici) s'affiche honnêtement (« Micro indisponible — écrivez votre demande. ») puis s'efface tout seul ; rien ne reste bloqué, rien ne plante.
- Un ordre vocal ne fait qu'écrire dans le champ que le clavier remplit aussi : il n'existe **aucun chemin de code séparé** pour la voix — Lexique → cerveau → outils → confirmation → action, à l'identique.
- La voix d'Ajmani en option (désactivée par défaut) : `speechSynthesis`, embarqué dans Chromium, aucun serveur, les voix déjà installées sur le poste (« voix Windows »).

**Pas vérifié, et il faut le dire :** la qualité réelle d'une transcription. Cet environnement n'a ni microphone ni serveur Whisper à interroger — seule une machine avec les deux peut le prouver. `src/main/whisper.ts` suit le même contrat qu'un serveur compatible OpenAI (`/v1/audio/transcriptions`), le même patron que l'intégration Ollama déjà éprouvée dans ce produit, mais c'est un maillon qu'aucun test automatisé ne peut couvrir sans un vrai serveur. Le mot d'éveil « Ajmani » (Picovoice ou équivalent) n'a pas été tenté : le raccourci clavier était le minimum non négociable, il est fait et vérifié ; le mot d'éveil reste une amélioration future.

## Bloc 3 — le parcours de démo, poli

Parcours retenu (Bloc 0.3) : Accueil → Clients → La Salle → Ajmani → Tour de contrôle, poste et téléphone.

**Un vrai défaut trouvé et corrigé en le rejouant** : sur un parc neuf, l'Accueil affichait « 0 sites supervisés / 0 en ligne » — l'écran a l'air cassé alors qu'il ne l'est pas. Cause : ce chiffre lit les sites de l'organisation authentifiée elle-même (AMN DevSec), pas ceux de ses clientes — un poste qui n'a pas ses propres sites affiche zéro, même avec un parc de clientes florissant. Sans ce détail, aucun jeu de données de démo ne serait « pas vide ». Corrigé en donnant à AMN DevSec trois sites à elle, sains.

**Le parc de démonstration** (amn-api, `scripts/demo-parc.mjs`, documenté dans `docs/DEMO.md`) : quatre organisations clientes saines (aucune ne réclame rien), trois sites propres à AMN DevSec, un Poste de travail qui a déjà vécu (trois clients avec une histoire, trois tâches à des états différents). La Garde y est calme parce qu'il n'y a réellement rien à lui reprocher — la mise en scène du « et si un site tombait » se joue en direct pendant la démo, pas en préparant un faux problème. Idempotent, données de test uniquement, jamais une organisation réelle touchée.

**Avant / après** (captures dans `docs/captures/ajmani-partout-2026-09-08/demo/`) :

| Écran | Avant (parc neuf, sans les trois sites AMN) | Après |
|---|---|---|
| Accueil | 0 sites supervisés, 0 en ligne — a l'air vide/cassé | 3 sites, 3 en ligne, « Rien à signaler » |
| Clients | 3 fiches à l'histoire courte | inchangé, déjà propre |
| La Salle | Pouls calme, 0 ouvertes | inchangé, déjà propre |
| Ajmani | « La Garde veille, rien ne vous attend » | inchangé, déjà propre |
| Tour de contrôle | 3 sites / 3 en ligne / 0 dégradés / 4 clientes | inchangé une fois l'Accueil corrigé |

**Cohérence visuelle et mobile** : le parcours tient sur téléphone (captures `demo-06`/`demo-07`) sans rien de coupé ni de réarrangé de travers ; aucun écran à moitié fini rencontré sur ce chemin précis — les écrans visités sont ceux déjà repris par les chantiers Signes Vitaux et L'Automatique.

**Ce que je n'ai pas fait, faute de temps** : une revue exhaustive de tous les écrans du desktop (au-delà du parcours de démo précis) pour traquer des écarts de cohérence visuelle ailleurs ; ce n'était pas le périmètre demandé (« precisément » les écrans de démo).

## Bloc 4 — la preuve d'unification

Test réel ajouté (`test/garde.test.js`) : une tâche posée à la main (`db.upsertRecord`, comme le ferait l'écran Tâches) coexiste avec une tâche née d'une vraie remontée de garde, dans la même collection. Après deux rondes de la Garde des Tâches, la tâche manuelle est comparée **octet à octet** à son état d'origine — rien ne l'a réécrite. Sa clôture, faite par la personne, reste attribuée à elle, jamais reprise par « La Garde des Tâches ». La convergence en une seule vue existait déjà (héritée du chantier précédent) ; ce qui manquait, et existe maintenant, c'est la preuve automatisée de ce cas précis.

## Ce qu'Aaron doit tester lui-même avant son rendez-vous, dans l'ordre

1. **Lancer le parc de démo** (`docs/DEMO.md`, amn-api) et vérifier que l'Accueil affiche bien 3 sites / 3 en ligne — c'est le premier écran du rendez-vous.
2. **Ouvrir la fiche d'un client** (Clients) et demander à Ajmani (bouton « Ajmani » ou Ctrl+J) « résume-moi ce client » sans le nommer — avec une vraie clé Anthropic sur le serveur cette fois, pour entendre la vraie réponse plutôt que l'aveu « sans clé ».
3. **Tester F9** sur sa machine, avec son vrai microphone : est-ce que l'enregistrement démarre, est-ce que le texte transcrit apparaît juste — et si un serveur Whisper compatible est installé, que dit-il ?
4. **Créer une tâche à la voix ou à l'écrit** (« crée-moi une tâche pour… ») et vérifier que la confirmation s'affiche, puis que la tâche apparaît dans le module Tâches après le « oui ».
5. **Ouvrir la Tour de contrôle et la Garde** pour vérifier que le pouls reste calme et que rien d'alarmant n'apparaît avant l'arrivée du prospect.
6. Si le rendez-vous peut basculer sur téléphone, ouvrir le même parcours sur mobile une fois, à l'avance.
EOF
echo WRITTEN