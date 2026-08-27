import React, { useCallback, useEffect, useState } from 'react';
import { Check, Inbox, Loader2, X } from 'lucide-react';
import { bridge } from '../../lib/bridge';
import type { ModuleRequestForOperator } from '../../shared/api';

/**
 * CE QUE LES CLIENTES ONT DEMANDÉ (BLOC 4)
 * ════════════════════════════════════════
 *
 * Une file, lue par un humain. C'est tout le mécanisme : aucune ouverture
 * automatique, aucun paiement, aucun moyen de paiement stocké nulle part.
 *
 * ## Deux gestes, jamais un seul
 *
 * « Traité » marque la demande, et n'ouvre RIEN. Ouvrir le module se fait dans
 * le dossier de l'organisation, à côté des autres modules, avec le reste de
 * son contexte sous les yeux.
 *
 * Les fusionner serait plus rapide d'un clic et faux pour deux raisons :
 * dépiler une liste finirait par ouvrir des modules par inadvertance, et le
 * jour où un module portera un prix, « j'ai lu » ne devra jamais valoir « je
 * facture ». Le serveur applique la même séparation — la route de traitement
 * ne touche pas aux modules de l'organisation.
 *
 * ## Le panneau disparaît quand il n'y a rien
 *
 * Pas de « 0 demande en attente ». Un bloc vide en permanence est un bloc
 * qu'on cesse de lire, et le jour où il porte quelque chose, on ne le voit
 * plus.
 */
export function ModuleRequestsPanel() {
  const [demandes, setDemandes] = useState<ModuleRequestForOperator[] | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      setDemandes(await bridge().remote.admin.moduleRequests('pending'));
    } catch {
      // Une file illisible ne doit pas emporter l'écran des organisations :
      // c'est un bloc en plus, pas le sujet de la page.
      setErreur('Les demandes de module n’ont pas pu être lues.');
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const traiter = async (id: string, status: 'done' | 'declined') => {
    setEnCours(id);
    setErreur(null);
    try {
      await bridge().remote.admin.resolveModuleRequest(id, { status });
      setDemandes((prev) => (prev ? prev.filter((d) => d.id !== id) : prev));
    } catch {
      setErreur('La demande n’a pas pu être marquée. Réessayez.');
    } finally {
      setEnCours(null);
    }
  };

  if (erreur) {
    return (
      <p className="rounded-lg border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-text-primary">
        {erreur}
      </p>
    );
  }
  if (!demandes || demandes.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <p className="eyebrow mb-1 flex items-center gap-2">
        <Inbox size={13} strokeWidth={1.75} />
        Demandes de module · {demandes.length}
      </p>
      <p className="mb-3 text-xs leading-relaxed text-text-muted">
        Marquer une demande traitée n’ouvre pas le module&nbsp;: cela se fait dans le dossier de
        l’organisation, à côté de ses autres modules.
      </p>

      <ul className="flex flex-col gap-px bg-border">
        {demandes.map((d) => (
          <li key={d.id} className="flex flex-wrap items-start justify-between gap-3 bg-surface px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm text-text-primary">
                {d.orgName} <span className="text-text-muted">·</span> {d.moduleKey}
              </p>
              <p className="text-[11px] text-text-muted">
                {d.requestedByEmail} · {new Date(d.createdAt).toLocaleDateString('fr-FR')}
              </p>
              {/* Le message n'est affiché que s'il existe : une ligne vide
                  entre deux demandes rendrait la file plus haute sans rien
                  dire de plus. */}
              {d.message && (
                <p className="mt-1 max-w-prose text-xs leading-relaxed text-text-secondary">
                  « {d.message} »
                </p>
              )}
            </div>
            <div className="flex flex-shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => void traiter(d.id, 'done')}
                disabled={enCours === d.id}
                className="flex min-h-11 items-center gap-1.5 border border-border-strong bg-surface px-3 text-xs text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-40 md:min-h-0 md:py-2"
              >
                {enCours === d.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Traité
              </button>
              <button
                type="button"
                onClick={() => void traiter(d.id, 'declined')}
                disabled={enCours === d.id}
                className="flex min-h-11 items-center gap-1.5 border border-border px-3 text-xs text-text-muted transition-colors hover:text-text-primary disabled:opacity-40 md:min-h-0 md:py-2"
              >
                <X size={13} />
                Refusé
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
