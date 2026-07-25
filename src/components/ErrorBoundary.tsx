import React from 'react';

interface Props {
  children: React.ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Last line of defence against a blank frozen screen: catches render/runtime
 * errors anywhere in the tree and shows a recoverable fallback instead of an
 * unmounted white page. "Réessayer" clears the error and re-renders in place
 * (typed data held in component state below the boundary is lost, but nothing
 * already persisted — SQLite / synced records / localStorage — is affected);
 * "Recharger" does a full reload as a stronger reset.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[AMN] UI error caught by boundary:', error, info.componentStack);
  }

  handleRetry = () => this.setState({ error: null });
  handleReload = () => window.location.reload();

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-danger/40 bg-danger-muted text-danger">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
          </span>
          <h1 className="text-lg font-bold text-text-primary">Une erreur inattendue s’est produite</h1>
          <p className="max-w-sm text-sm text-text-secondary">
            L’application a rencontré un problème d’affichage. Vos données enregistrées sont intactes.
            Vous pouvez réessayer sans tout recharger.
          </p>
        </div>

        {this.state.error?.message && (
          <pre className="max-w-md overflow-x-auto border border-border bg-surface px-3 py-2 text-left font-mono text-[11px] text-text-muted">
            {this.state.error.message}
          </pre>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={this.handleRetry}
            className="bg-accent px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            Réessayer
          </button>
          <button
            type="button"
            onClick={this.handleReload}
            className="border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
          >
            Recharger l’app
          </button>
        </div>
      </div>
    );
  }
}
