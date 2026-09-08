/**
 * LA COMMANDE VOCALE — mains libres, jamais micro permanent (Ajmani partout, Bloc 2).
 *
 * PUSH-TO-TALK STRICT : on tient une touche (ou le bouton micro), le micro écoute, on relâche, la
 * transcription apparaît dans le champ de texte — JAMAIS envoyée seule. La personne relit, corrige
 * si besoin, et c'est elle qui valide. Un ordre qui modifie continue de demander sa confirmation
 * exactement comme à l'écrit : la voix n'entre nulle part dans `AssistantContext.sendMessage`, elle
 * ne fait que remplir le même champ que le clavier — c'est ce qui garantit qu'elle suit le même
 * chemin (Lexique → cerveau → outils → confirmation → action), sans code séparé pour elle.
 *
 * Ce module fait deux choses, l'une prouvée, l'autre non :
 *  - Prouvé (mécanique JS pure, sans matériel) : l'enregistrement (MediaRecorder), la conversion,
 *    l'appel à `bridge().whisper`, le repli honnête si rien ne répond.
 *  - NON prouvé faute de microphone dans l'environnement où ceci a été écrit : la qualité réelle
 *    d'une transcription, et la présence effective d'un serveur Whisper compatible sur le poste
 *    d'Aaron. Voir docs (rapport du chantier) — le repli texte ne bloque jamais si ça manque.
 */
import { bridge } from '../lib/bridge';

export type EtatVocal = 'inactif' | 'enregistrement' | 'transcription' | 'echec';

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

/**
 * Enregistre tant que `arreter()` n'est pas appelé, puis transcrit via le pont (serveur local
 * compatible OpenAI, voir `main/whisper.ts`). Rend `null` — jamais une exception — quand
 * l'utilisateur n'a pas de microphone, l'a refusé, ou qu'aucun serveur ne répond : c'est
 * `AssistantContext` qui décide alors de dire le repli.
 */
export class SessionVocale {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private demarreA = 0;

  async demarrer(): Promise<{ ok: true } | { ok: false; raison: string }> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      return { ok: false, raison: err instanceof Error ? err.message : 'microphone indisponible' };
    }
    this.chunks = [];
    this.demarreA = Date.now();
    try {
      this.recorder = new MediaRecorder(this.stream);
    } catch (err) {
      this.stream.getTracks().forEach((tr) => tr.stop());
      this.stream = null;
      return { ok: false, raison: err instanceof Error ? err.message : 'enregistrement indisponible' };
    }
    this.recorder.addEventListener('dataavailable', (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    });
    this.recorder.start();
    return { ok: true };
  }

  /** Arrête le micro et rend le texte transcrit (ou `null` avec la raison). Une prise trop courte (bruit d'appui) est ignorée. */
  async arreter(langue: 'fr' | 'en' = 'fr'): Promise<{ texte: string } | { texte: null; raison: string }> {
    const recorder = this.recorder;
    const stream = this.stream;
    this.recorder = null;
    this.stream = null;
    if (!recorder || !stream) return { texte: null, raison: 'aucun enregistrement en cours' };
    const dureeMs = Date.now() - this.demarreA;
    const blob = await new Promise<Blob>((resolve) => {
      recorder.addEventListener('stop', () => resolve(new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' })), { once: true });
      recorder.stop();
    });
    stream.getTracks().forEach((tr) => tr.stop());
    if (dureeMs < 300) return { texte: null, raison: 'trop court pour être une phrase' };
    try {
      const base64Audio = await blobToBase64(blob);
      const r = await bridge().whisper.transcrire({ base64Audio, mimeType: blob.type, langue });
      if (!r.texte) return { texte: null, raison: 'transcription vide' };
      return { texte: r.texte };
    } catch (err) {
      return { texte: null, raison: err instanceof Error ? err.message : 'transcription indisponible' };
    }
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
