/**
 * LA COMMANDE VOCALE — mains libres, jamais micro permanent (Ajmani partout, Bloc 2 ; ce module a
 * été corrigé après un premier chantier qui n'avait jamais vérifié le chemin avec un vrai
 * microphone — voir docs/voix-micro-2026-09-08.md pour le diagnostic complet).
 *
 * PUSH-TO-TALK STRICT : on tient une touche (ou le bouton micro), le micro écoute, on relâche, la
 * transcription apparaît dans le champ de texte — JAMAIS envoyée seule. La personne relit, corrige
 * si besoin, et c'est elle qui valide. Un ordre qui modifie continue de demander sa confirmation
 * exactement comme à l'écrit : la voix n'entre nulle part dans `AssistantContext.sendMessage`, elle
 * ne fait que remplir le même champ que le clavier — c'est ce qui garantit qu'elle suit le même
 * chemin (Lexique → cerveau → outils → confirmation → action), sans code séparé pour elle.
 *
 * LA RÈGLE D'HONNÊTETÉ DE CE MODULE : un échec dit TOUJOURS lequel, parmi une liste fermée
 * (`RaisonEchecVocal`) — jamais un « indisponible » muet qui mélange « personne n'a donné accès au
 * micro », « il n'y a pas de micro », et « le micro marche mais rien ne sait le transcrire ». Ces
 * trois situations demandent trois gestes différents de la part de la personne ; un message qui ne
 * les distingue pas fait perdre du temps à chaque diagnostic futur — c'est exactement ce qui s'est
 * passé la première fois.
 *
 * TESTABLE SANS MICROPHONE NI ÉLECTRON : toute l'IO (micro, enregistreur, décodage, appel au
 * serveur de transcription) passe par `Adaptateur`, injecté ; `scripts/check-voix.ts` fait circuler
 * un flux audio simulé à travers exactement ce chemin — getUserMedia → MediaRecorder → base64 →
 * appel de transcription — et vérifie chaque branche de sortie. Ce que ce test NE prouve PAS : la
 * qualité d'une vraie transcription, ni qu'un vrai microphone Windows livre des données lisibles à
 * MediaRecorder — ça, seule une machine avec les deux peut le dire.
 */
import { bridge } from '../lib/bridge';
import type { WhisperTranscrireResultat } from '../shared/api';

export type EtatVocal = 'inactif' | 'enregistrement' | 'transcription' | 'echec';

/**
 * Les raisons d'échec, fermées et distinctes — jamais un texte libre à la place. `detail` porte le
 * message technique d'origine (utile pour un rapport de bogue), `raison` porte ce qui doit
 * gouverner le message montré et le geste à proposer.
 */
export type RaisonEchecVocal =
  | 'permission-refusee'
  | 'aucun-peripherique'
  | 'enregistrement-impossible'
  | 'aucun-serveur-transcription'
  | 'serveur-transcription-en-erreur'
  | 'reponse-transcription-inattendue'
  | 'transcription-vide'
  | 'trop-court'
  | 'inconnue';

/**
 * Le message montré pour chaque échec vocal — jamais le même « indisponible » générique pour des
 * causes différentes (correctif micro, puis bulle Ajmani) : permission / périphérique /
 * enregistrement sont un problème Windows ou matériel, alors qu'un serveur de transcription
 * absent ou en erreur n'a rien à voir avec le micro, qui a très bien capté. Partagé entre le
 * panneau plein (`AssistantPanel`) et la bulle (`AjmaniBubble`) : un seul texte par raison.
 */
export function messageEchecVocal(raison: RaisonEchecVocal): string {
  switch (raison) {
    case 'permission-refusee':
      return 'Micro refusé — vérifiez l’accès au microphone dans les réglages de Windows.';
    case 'aucun-peripherique':
      return 'Aucun microphone détecté — branchez-en un, ou écrivez votre demande.';
    case 'enregistrement-impossible':
      return 'L’enregistrement audio a échoué sur cet appareil — écrivez votre demande.';
    case 'aucun-serveur-transcription':
      return 'Micro capté — aucun serveur de transcription local n’est configuré.';
    case 'serveur-transcription-en-erreur':
      return 'Micro capté — le serveur de transcription local a répondu en erreur.';
    case 'reponse-transcription-inattendue':
      return 'Micro capté — le serveur de transcription local a répondu dans un format inattendu.';
    case 'transcription-vide':
      return 'Rien n’a été compris — réessayez, ou écrivez votre demande.';
    case 'trop-court':
      return 'Trop court pour être une phrase — maintenez la touche plus longtemps.';
    case 'inconnue':
      return 'Échec de la commande vocale — écrivez votre demande.';
  }
}

export type DemarrageVocal = { ok: true } | { ok: false; raison: RaisonEchecVocal; detail: string };
export type ResultatVocal = { texte: string; raison?: undefined } | { texte: null; raison: RaisonEchecVocal; detail: string };

/** Une piste minimale : ce que ce module utilise réellement d'un MediaStreamTrack, pour rester substituable dans un test. */
export interface PisteAudio {
  stop(): void;
}
export interface FluxAudio {
  getTracks(): PisteAudio[];
}
/** Ce que ce module utilise réellement d'un MediaRecorder — un sous-ensemble minimal, substituable. */
export interface EnregistreurAudio {
  readonly mimeType: string;
  start(): void;
  stop(): void;
  addEventListener(type: 'dataavailable', cb: (e: { data: { size: number } }) => void): void;
  addEventListener(type: 'stop', cb: () => void, opts?: { once?: boolean }): void;
}

/** Toute l'IO du module, injectée — la vraie implémentation par défaut, une fausse dans les tests. */
export interface AdaptateurVocal {
  getUserMedia(): Promise<FluxAudio>;
  creerEnregistreur(flux: FluxAudio): EnregistreurAudio;
  /** Assemble les morceaux captés en un objet transportable ; `mimeType` vient de l'enregistreur. */
  assembler(morceaux: unknown[], mimeType: string): { encoderBase64(): Promise<string>; type: string };
  transcrire(input: { base64Audio: string; mimeType: string; langue?: string }): Promise<WhisperTranscrireResultat>;
  /** Best-effort, jamais bloquant : un niveau 0..1 pendant l'écoute, pour la preuve visuelle du signal. Peut être un no-op. */
  suivreNiveau?(flux: FluxAudio, onNiveau: (n: number) => void): () => void;
  maintenant(): number;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      // `data:audio/webm;base64,AAAA` → seul ce qui suit la virgule est du base64.
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('lecture audio impossible'));
    reader.readAsDataURL(blob);
  });
}

/** Le premier type que le navigateur sait vraiment enregistrer — Windows/Chromium n'accepte pas toujours le même. */
const MIME_PREFERES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
function choisirMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined;
  return MIME_PREFERES.find((m) => {
    try {
      return MediaRecorder.isTypeSupported(m);
    } catch {
      return false;
    }
  });
}

/** Distingue « Windows/le navigateur a refusé » de « il n'y a pas de microphone » — deux gestes différents pour la personne. */
function classifierErreurMicro(err: unknown): RaisonEchecVocal {
  const nom = err instanceof Error ? err.name : '';
  if (nom === 'NotAllowedError' || nom === 'PermissionDeniedError' || nom === 'SecurityError') return 'permission-refusee';
  if (nom === 'NotFoundError' || nom === 'DevicesNotFoundError' || nom === 'OverconstrainedError') return 'aucun-peripherique';
  return 'inconnue';
}
function detailDe(err: unknown): string {
  return err instanceof Error ? `${err.name ? `${err.name} : ` : ''}${err.message}` : String(err);
}

/** L'adaptateur réel — les vraies API du navigateur/Electron. Non instancié dans les tests. */
export function adaptateurNavigateur(): AdaptateurVocal {
  return {
    async getUserMedia() {
      return navigator.mediaDevices.getUserMedia({ audio: true });
    },
    creerEnregistreur(flux) {
      const mimeType = choisirMimeType();
      return new MediaRecorder(flux as unknown as MediaStream, mimeType ? { mimeType } : undefined) as unknown as EnregistreurAudio;
    },
    assembler(morceaux, mimeType) {
      const blob = new Blob(morceaux as BlobPart[], { type: mimeType || 'audio/webm' });
      return { type: blob.type, encoderBase64: () => blobToBase64(blob) };
    },
    async transcrire(input) {
      return bridge().whisper.transcrire(input);
    },
    suivreNiveau(flux, onNiveau) {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return () => undefined;
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(flux as unknown as MediaStream);
        const analyseur = ctx.createAnalyser();
        analyseur.fftSize = 512;
        source.connect(analyseur);
        const donnees = new Uint8Array(analyseur.frequencyBinCount);
        let vivant = true;
        const boucle = () => {
          if (!vivant) return;
          analyseur.getByteTimeDomainData(donnees);
          let somme = 0;
          for (const v of donnees) somme += (v - 128) ** 2;
          onNiveau(Math.min(1, Math.sqrt(somme / donnees.length) / 64));
          window.requestAnimationFrame(boucle);
        };
        boucle();
        return () => {
          vivant = false;
          source.disconnect();
          void ctx.close();
        };
      } catch {
        // Le niveau sonore est un confort de diagnostic, jamais un chemin critique : son absence ne doit rien bloquer.
        return () => undefined;
      }
    },
    maintenant: () => Date.now(),
  };
}

/**
 * Enregistre tant que `arreter()` n'est pas appelé, puis transcrit via le pont (serveur local
 * compatible OpenAI, voir `main/whisper.ts`). Ne lève jamais d'exception : chaque échec rend une
 * `RaisonEchecVocal` précise, jamais un texte générique.
 */
export class SessionVocale {
  private enregistreur: EnregistreurAudio | null = null;
  private morceaux: unknown[] = [];
  private flux: FluxAudio | null = null;
  private demarreA = 0;
  private arreterSuiviNiveau: (() => void) | null = null;

  constructor(private readonly adaptateur: AdaptateurVocal = adaptateurNavigateur()) {}

  async demarrer(onNiveau?: (n: number) => void): Promise<DemarrageVocal> {
    try {
      this.flux = await this.adaptateur.getUserMedia();
    } catch (err) {
      return { ok: false, raison: classifierErreurMicro(err), detail: detailDe(err) };
    }
    this.morceaux = [];
    this.demarreA = this.adaptateur.maintenant();
    try {
      this.enregistreur = this.adaptateur.creerEnregistreur(this.flux);
    } catch (err) {
      this.flux.getTracks().forEach((p) => p.stop());
      this.flux = null;
      return { ok: false, raison: 'enregistrement-impossible', detail: detailDe(err) };
    }
    this.enregistreur.addEventListener('dataavailable', (e) => {
      if (e.data.size > 0) this.morceaux.push(e.data);
    });
    if (onNiveau && this.adaptateur.suivreNiveau) this.arreterSuiviNiveau = this.adaptateur.suivreNiveau(this.flux, onNiveau);
    this.enregistreur.start();
    return { ok: true };
  }

  /** Arrête le micro et rend le texte transcrit, ou un échec précis. Une prise trop courte (bruit d'appui) est écartée avant tout appel réseau. */
  async arreter(langue: 'fr' | 'en' = 'fr'): Promise<ResultatVocal> {
    const enregistreur = this.enregistreur;
    const flux = this.flux;
    this.enregistreur = null;
    this.flux = null;
    this.arreterSuiviNiveau?.();
    this.arreterSuiviNiveau = null;
    if (!enregistreur || !flux) return { texte: null, raison: 'inconnue', detail: 'aucun enregistrement en cours' };
    const dureeMs = this.adaptateur.maintenant() - this.demarreA;
    await new Promise<void>((resolve) => {
      enregistreur.addEventListener('stop', () => resolve(), { once: true });
      enregistreur.stop();
    });
    flux.getTracks().forEach((p) => p.stop());
    if (dureeMs < 300) return { texte: null, raison: 'trop-court', detail: `${dureeMs} ms` };
    const paquet = this.adaptateur.assembler(this.morceaux, enregistreur.mimeType);
    let base64Audio: string;
    try {
      base64Audio = await paquet.encoderBase64();
    } catch (err) {
      return { texte: null, raison: 'inconnue', detail: detailDe(err) };
    }
    let r: WhisperTranscrireResultat;
    try {
      r = await this.adaptateur.transcrire({ base64Audio, mimeType: paquet.type, langue });
    } catch (err) {
      // Le pont ne devrait plus jeter (voir main/whisper.ts, qui rend un résultat structuré) —
      // ce filet couvre un pont plus ancien ou une erreur de transport IPC elle-même.
      return { texte: null, raison: 'inconnue', detail: detailDe(err) };
    }
    if (!r.ok) {
      const raison: RaisonEchecVocal =
        r.kind === 'unreachable'
          ? 'aucun-serveur-transcription'
          : r.kind === 'server-error'
            ? 'serveur-transcription-en-erreur'
            : r.kind === 'unexpected-format'
              ? 'reponse-transcription-inattendue'
              : 'inconnue';
      return { texte: null, raison, detail: r.message };
    }
    if (!r.texte.trim()) return { texte: null, raison: 'transcription-vide', detail: '' };
    return { texte: r.texte };
  }
}

/**
 * La voix d'Ajmani, en repli du système (« voix Windows », Bloc 2) : `speechSynthesis` est
 * embarqué dans Chromium, ne parle à aucun serveur, et utilise les voix déjà installées sur le
 * poste. Optionnelle, silencieuse en cas d'absence — jamais de musique, jamais permanente.
 */
export function directAVoixHaute(texte: string, langue: 'fr' | 'en' = 'fr'): void {
  try {
    if (!('speechSynthesis' in window) || !texte.trim()) return;
    window.speechSynthesis.cancel(); // une réponse à la fois — jamais deux voix qui se chevauchent
    const u = new SpeechSynthesisUtterance(texte.replace(/[*_`#]/g, ''));
    u.lang = langue === 'en' ? 'en-US' : 'fr-FR';
    window.speechSynthesis.speak(u);
  } catch {
    /* la voix haute est un confort, jamais un chemin critique */
  }
}

const CLE_VOIX_HAUTE = 'amn.ajmani.voixHaute';
export function voixHauteActive(): boolean {
  try {
    return window.localStorage.getItem(CLE_VOIX_HAUTE) === '1';
  } catch {
    return false;
  }
}
export function setVoixHauteActive(actif: boolean): void {
  try {
    window.localStorage.setItem(CLE_VOIX_HAUTE, actif ? '1' : '0');
  } catch {
    /* sans mémoire locale, le réglage revient à son défaut (désactivé) à la prochaine ouverture */
  }
}
