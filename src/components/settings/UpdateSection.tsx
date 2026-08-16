import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Info, RefreshCw } from 'lucide-react';
import { bridge } from '../../lib/bridge';
import type { UpdateCheck } from '../../shared/api';

/**
 * « Vérifier les mises à jour maintenant » (BLOC D).
 *
 * L'application vérifie déjà toute seule, en arrière-plan. Ce bouton existe
 * pour l'autre situation : celle où l'on VIENT d'être prévenu qu'un correctif
 * existe et où l'on ne veut pas attendre le prochain passage. Sans lui, la
 * seule action possible est de relancer l'application en espérant que le cycle
 * tombe au bon moment.
 *
 * ## Quatre états, jamais un booléen
 *
 * C'est le point de tout ce composant. « Pas de mise à jour » et « je n'ai pas
 * pu regarder » se ressemblent dans le code et n'ont rien à voir à l'écran :
 * l'un rassure, l'autre demande quelque chose. Les confondre revient à afficher
 * « à jour » à quelqu'un qui ne l'est pas — c'est-à-dire à mentir précisément
 * là où la personne fait confiance.
 *
 * L'édition Business tombe aujourd'hui sur « aucun canal configuré », et c'est
 * la vérité : elle n'est branchée sur aucun flux de publication (voir
 * `setupAutoUpdate` et docs/BUSINESS.md). Le jour où ce canal existera, la
 * variable de build suffira — cet écran n'aura pas à changer.
 */
export function UpdateSection() {
  const [state, setState] = useState<UpdateCheck | null>(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    setState(null);
    try {
      setState(await bridge().updates.check());
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Vérification impossible.',
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="border border-border bg-surface p-4">
      <h2 className="mb-1 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
        Mises à jour
      </h2>
      <p className="mb-3 text-xs leading-relaxed text-text-muted">
        L’application vérifie toute seule en arrière-plan. Ce bouton force une
        vérification immédiate.
      </p>

      <button
        type="button"
        onClick={() => void check()}
        disabled={checking}
        className="input-focus flex min-h-11 items-center gap-2 border border-border px-3 text-sm text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-60 md:min-h-0 md:py-2"
      >
        <RefreshCw
          size={14}
          strokeWidth={1.75}
          className={checking ? 'animate-spin' : undefined}
          aria-hidden
        />
        {checking ? 'Vérification…' : 'Vérifier les mises à jour maintenant'}
      </button>

      {state && <Verdict state={state} />}
    </section>
  );
}

/**
 * Le verdict, avec son icône et son ton.
 *
 * Chaque état a sa propre phrase : aucune ne se replie sur une formule vague
 * comme « terminé », qui laisserait la personne sans savoir ce qu'elle doit
 * faire — ou ne pas faire.
 */
function Verdict({ state }: { state: UpdateCheck }) {
  if (state.status === 'uptodate') {
    return (
      <Line tone="ok" icon={CheckCircle2}>
        À jour — vous êtes en version {state.version}.
      </Line>
    );
  }
  if (state.status === 'available') {
    return (
      <Line tone="accent" icon={Download}>
        Version {state.version} disponible. Elle s’installera au prochain
        redémarrage de l’application.
      </Line>
    );
  }
  if (state.status === 'downloading') {
    return (
      <Line tone="muted" icon={RefreshCw}>
        Vérification lancée. Si une version existe, elle se télécharge en fond et
        un bandeau vous proposera de l’installer — inutile de rester ici.
      </Line>
    );
  }
  if (state.status === 'unconfigured') {
    return (
      <Line tone="muted" icon={Info}>
        {state.reason}
      </Line>
    );
  }
  return (
    <Line tone="warn" icon={AlertTriangle}>
      {state.message}
    </Line>
  );
}

function Line({
  children,
  icon: Icon,
  tone,
}: {
  children: React.ReactNode;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  tone: 'ok' | 'accent' | 'muted' | 'warn';
}) {
  const color =
    tone === 'ok'
      ? 'text-text-primary'
      : tone === 'accent'
        ? 'text-text-primary'
        : tone === 'warn'
          ? 'text-danger'
          : 'text-text-muted';
  const border =
    tone === 'warn' ? 'border-warning/40 bg-warning-muted' : 'border-border bg-bg';

  return (
    <p
      role="status"
      className={`mt-3 flex items-start gap-2 border px-3 py-2.5 text-xs leading-relaxed ${border} ${color}`}
    >
      <Icon size={14} strokeWidth={1.75} className="mt-px flex-shrink-0" />
      <span>{children}</span>
    </p>
  );
}
