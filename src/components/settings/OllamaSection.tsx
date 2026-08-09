import React, { useState } from 'react';
import { Bot, ExternalLink, RefreshCw } from 'lucide-react';
import { useAssistant } from '../../assistant/AssistantContext';
import { SettingsPanel as Panel } from '../SettingsPanel';

/**
 * Réglages du modèle local (Ollama) qui fait tourner l'assistant Ajmani.
 *
 * Vit hors de `SettingsScreen` parce que l'assistant n'existe que dans
 * l'édition interne : l'édition Business résout `@edition/exclusive` vers un
 * stub, et ni ce composant ni l'assistant n'entrent dans son bundle.
 */
export function OllamaSection() {
  const { ollamaAvailable, ollamaModels, ollamaModel, setOllamaModel, refreshOllama } = useAssistant();
  const [checking, setChecking] = useState(false);

  const recheck = () => {
    setChecking(true);
    refreshOllama();
    window.setTimeout(() => setChecking(false), 900);
  };

  return (
    <Panel
      icon={Bot}
      title="Ajmani — modèle local (Ollama)"
      subtitle="Ajmani utilise un modèle qui tourne sur votre machine, gratuitement et en privé. Sinon, le moteur intégré prend le relais."
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${ollamaAvailable ? 'bg-success' : 'border border-text-muted bg-transparent'}`}
            />
            <span className="text-sm text-text-primary">
              {ollamaAvailable ? 'Ollama détecté' : 'Ollama non détecté'}
            </span>
            {ollamaAvailable && (
              <span className="font-mono text-[11px] text-text-muted">
                · {ollamaModels.length} modèle{ollamaModels.length > 1 ? 's' : ''}
              </span>
            )}
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

        {ollamaAvailable && ollamaModels.length > 0 ? (
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Modèle utilisé</span>
            <select
              value={ollamaModel ?? ''}
              onChange={(e) => setOllamaModel(e.target.value)}
              className="input-focus cursor-pointer border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            >
              {ollamaModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span className="text-xs text-text-muted">
              L’assistant répond désormais via ce modèle, ancré sur vos données de parc réelles.
            </span>
          </label>
        ) : ollamaAvailable ? (
          <p className="text-sm text-text-secondary">
            Ollama tourne mais aucun modèle n’est installé. Dans un terminal :{' '}
            <code className="rounded bg-bg px-1.5 py-0.5 font-mono text-xs text-text-primary">ollama pull llama3.2</code>
          </p>
        ) : (
          <div className="rounded-lg border border-border bg-bg p-3 text-sm text-text-secondary">
            <p>
              Installez Ollama, puis téléchargez un modèle léger, par ex.{' '}
              <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-text-primary">
                ollama pull llama3.2
              </code>
              . L’app le détectera automatiquement.
            </p>
            <a
              href="https://ollama.com"
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-text-primary underline decoration-border underline-offset-2 hover:decoration-text-primary"
            >
              <ExternalLink size={12} /> ollama.com
            </a>
          </div>
        )}
      </div>
    </Panel>
  );
}
