import React, { useEffect, useState } from 'react';
import { Mic, RefreshCw } from 'lucide-react';
import { bridge } from '../../lib/bridge';
import { SettingsPanel as Panel } from '../SettingsPanel';
import type { WhisperStatus } from '../../shared/api';

/**
 * Réglage de l'adresse du serveur de transcription locale (whisper.cpp, ou tout serveur
 * compatible OpenAI) — correctif du 2026-09-08 : la détection ne trouvait jamais un
 * `whisper-server.exe` réel parce qu'aucun réglage n'existait pour lui dire où chercher au-delà
 * des ports par défaut. `AMN_WHISPER_URL` reste le minimum (variable d'environnement) ; ce champ
 * est la version que quelqu'un qui ne sait pas ce qu'est une variable d'environnement peut poser.
 */
export function WhisperSection() {
  const [url, setUrlState] = useState('');
  const [statut, setStatut] = useState<WhisperStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const recheck = () => {
    setChecking(true);
    bridge()
      .whisper.status()
      .then(setStatut)
      .finally(() => setChecking(false));
  };

  useEffect(() => {
    bridge()
      .whisper.getUrl()
      .then((u) => setUrlState(u ?? ''));
    recheck();
  }, []);

  const enregistrer = () => {
    const propre = url.trim();
    void bridge()
      .whisper.setUrl(propre || null)
      .then(recheck);
  };

  return (
    <Panel
      icon={Mic}
      title="Ajmani — transcription vocale (whisper.cpp)"
      subtitle="Un serveur qui tourne sur votre machine transcrit la voix captée au micro (F9). Sans lui, la commande vocale reste dégradée : le texte tapé."
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${statut?.available ? 'bg-success' : 'border border-text-muted bg-transparent'}`}
            />
            <span className="text-sm text-text-primary">
              {statut?.available
                ? `Serveur détecté sur ${statut.baseUrl} (${statut.flavor === 'whispercpp' ? 'whisper.cpp' : 'compatible OpenAI'})`
                : 'Aucun serveur détecté'}
            </span>
          </div>
          <button
            type="button"
            onClick={recheck}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
          >
            <RefreshCw size={12} className={checking ? 'animate-spin' : ''} />
            Vérifier
          </button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Adresse du serveur</span>
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrlState(e.target.value)}
              placeholder="http://127.0.0.1:8080"
              className="input-focus flex-1 border border-border bg-bg px-3 py-2 font-mono text-sm text-text-primary outline-none"
            />
            <button
              type="button"
              onClick={enregistrer}
              className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
            >
              Enregistrer
            </button>
          </div>
          <span className="text-xs text-text-muted">
            Laissez vide pour revenir au port par défaut de whisper.cpp (8080), ou aux autres adresses essayées
            automatiquement. La variable d'environnement <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11px]">AMN_WHISPER_URL</code>{' '}
            fait la même chose sans cette fenêtre.
          </span>
        </label>
      </div>
    </Panel>
  );
}
