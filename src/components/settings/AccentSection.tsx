import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import { ACCENTS, applyAccent } from '../../lib/accent';
import { useAuth } from '../../auth/AuthContext';
import { bridge } from '../../lib/bridge';
import { cleanErrorMessage } from '../../lib/errorMessage';

/**
 * LA COULEUR DE VOTRE APPLICATION — réglée par vous (BLOC C)
 * ══════════════════════════════════════════════════════════
 *
 * La couleur d'accent existait depuis longtemps : le générateur en PROPOSE une
 * cohérente avec le métier, et le dossier interne permettait d'en changer. Mais
 * ce dossier est le nôtre. Autrement dit, le principe posé et répété — « la
 * couleur reste au client, pas figée par la supervision » — n'était vrai que sur
 * le papier : en pratique, changer de couleur demandait de nous écrire.
 *
 * Ce panneau est la moitié qui manquait. Il vit dans les Paramètres de la
 * CLIENTE, appelle une route qui n'accepte que sa propre organisation, et
 * n'existe pas dans le contexte de support — un opérateur ne choisit pas
 * l'identité visuelle de quelqu'un d'autre à sa place (voir plus bas).
 *
 * LA PALETTE EST FERMÉE, et ce n'est pas une restriction gratuite : chaque
 * couleur y est entrée après un contrôle de contraste sur fond sombre
 * (`npm run check:accent`, exécutable). Un sélecteur libre laisserait une
 * cliente rendre ses propres boutons illisibles, et elle ne s'en apercevrait
 * qu'en essayant de les lire.
 *
 * L'APERÇU EST IMMÉDIAT : la couleur s'applique au clic, avant même la réponse
 * du serveur. Si le serveur refuse, on remet l'ancienne et on le dit — mais
 * faire attendre un aller-retour réseau pour voir une couleur transformerait un
 * choix esthétique, qui se fait à l'œil, en formulaire.
 */
export function AccentSection() {
  const { org, patchSessionOrg } = useAuth();
  const current = org?.accent ?? 'blanc';
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const choose = async (id: string) => {
    if (busy || id === current) return;
    setError(null);
    setBusy(id);
    const previous = org?.accent ?? null;
    // Aperçu immédiat : on peint d'abord, on confirme ensuite.
    applyAccent(id);
    try {
      const next = await bridge().remote.setOrganizationAccent(id);
      patchSessionOrg(next);
    } catch (err) {
      // Retour à l'état d'avant : laisser la nouvelle couleur à l'écran après un
      // refus ferait croire que c'est enregistré.
      applyAccent(previous);
      setError(cleanErrorMessage(err, 'La couleur n’a pas pu être enregistrée.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="panel p-4">
      <p className="eyebrow mb-2">Couleur de l’application</p>
      <p className="mb-4 max-w-lg text-[12px] leading-relaxed text-text-secondary">
        Elle s’applique à toute votre organisation, sur tous les postes. Les teintes proposées ont
        toutes été vérifiées pour rester lisibles sur fond sombre.
      </p>

      <div className="flex flex-wrap gap-2">
        {ACCENTS.map((accent) => {
          const active = accent.id === current;
          return (
            <button
              key={accent.id}
              type="button"
              onClick={() => void choose(accent.id)}
              disabled={busy !== null}
              title={accent.label}
              aria-label={accent.label}
              aria-pressed={active}
              className={`flex h-9 w-9 items-center justify-center border transition-transform disabled:opacity-60 ${
                active ? 'scale-105 border-text-primary' : 'border-border hover:border-border-strong'
              }`}
            >
              {busy === accent.id ? (
                <Loader2 size={13} className="animate-spin text-text-primary" />
              ) : (
                <span
                  className="flex h-4 w-4 items-center justify-center"
                  style={{ background: accent.value }}
                >
                  {active && <Check size={10} strokeWidth={3} style={{ color: accent.on }} />}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && <p className="mt-3 text-[12px] text-danger">{error}</p>}
    </section>
  );
}
