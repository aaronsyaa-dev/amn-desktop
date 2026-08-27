import React, { useEffect, useState } from 'react';
import { Blocks, Check, Loader2, Send } from 'lucide-react';
import { bridge } from '../../lib/bridge';
import type { ModuleOffer } from '../../shared/api';
import { SettingsPanel as Panel } from '../SettingsPanel';

/**
 * VOS MODULES, ET CEUX QUI EXISTENT (BLOC 4)
 * ══════════════════════════════════════════
 *
 * Deux listes, et la seconde est celle qui pose une question.
 *
 * ## Pourquoi montrer ce qu'on n'a pas
 *
 * Montrer une porte fermée n'est pas gratuit : ça rappelle qu'il existe des
 * choses qu'on n'a pas. Sans cela, pourtant, personne ne peut rien demander —
 * une cliente qui ignore que « Commandes » existe ne le réclamera jamais, et
 * la seule façon de le lui apprendre serait de l'appeler pour le lui vendre.
 * Le catalogue rend la demande possible sans démarchage.
 *
 * D'où la forme retenue : ce qu'elle a d'abord, en clair et sans emphase ; ce
 * qui existe ensuite, décrit d'une phrase, sans prix, sans badge, sans « à
 * partir de ». Ce n'est pas une boutique.
 *
 * ## Ce que « Demander » fait, et ne fait pas
 *
 * Ça envoie un message, lu par un humain. Rien ne s'ouvre tout seul, rien ne
 * se facture, aucun moyen de paiement n'est demandé. L'écran le dit, parce
 * qu'un bouton qui ressemble à un achat doit démentir lui-même.
 *
 * Recliquer par hésitation ne fait pas doublon : le serveur rend la demande
 * existante (200 au lieu de 201), et l'écran affiche « demandé » dans les deux
 * cas. Quelqu'un qui n'est pas sûr d'avoir cliqué doit être rassuré, pas
 * grondé.
 */
export function ModulesSection() {
  const [modules, setModules] = useState<ModuleOffer[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    bridge()
      .remote.modules.catalogue()
      .then((liste) => {
        if (vivant) setModules(liste);
      })
      .catch(() => {
        // Le catalogue est un CONFORT : son échec ne doit pas transformer
        // l'écran des paramètres en page d'erreur. On le dit, et le reste des
        // réglages continue de fonctionner.
        if (vivant) setErreur('Le catalogue des modules n’a pas pu être lu.');
      });
    return () => {
      vivant = false;
    };
  }, []);

  const demander = async (cle: string) => {
    setEnCours(cle);
    setErreur(null);
    try {
      await bridge().remote.modules.request({ module: cle });
      setModules((prev) =>
        prev ? prev.map((m) => (m.key === cle ? { ...m, requested: true } : m)) : prev,
      );
    } catch {
      setErreur('La demande n’est pas partie. Réessayez dans un instant.');
    } finally {
      setEnCours(null);
    }
  };

  const ouverts = modules?.filter((m) => m.enabled) ?? [];
  const fermes = modules?.filter((m) => !m.enabled) ?? [];

  return (
    <Panel
      icon={Blocks}
      title="Vos modules"
      subtitle="Ce que votre espace contient, et ce qui existe par ailleurs."
    >
      {modules === null && !erreur && (
        <p className="flex items-center gap-2 text-xs text-text-muted">
          <Loader2 size={13} className="animate-spin" />
          Lecture du catalogue…
        </p>
      )}

      {erreur && (
        <p className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-text-primary">
          {erreur}
        </p>
      )}

      {modules !== null && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="eyebrow mb-2">
              Ouverts chez vous · {ouverts.length}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ouverts.map((m) => (
                <span
                  key={m.key}
                  title={m.summary}
                  className="border border-border bg-bg px-2.5 py-1 text-xs text-text-secondary"
                >
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          {/* Une section vide dirait « il y a autre chose, mais pas pour
              vous ». Quand tout est ouvert, il n'y a rien à dire. */}
          {fermes.length > 0 && (
            <div>
              <p className="eyebrow mb-1">Existe aussi</p>
              <p className="mb-3 text-xs leading-relaxed text-text-muted">
                {/* « votre prestataire » et non notre raison sociale : l'édition
                    Business ne porte aucune marque, et `check:business` refuse
                    le build qui en contiendrait une. */}
                Demander écrit un message à votre prestataire. Rien ne s’ouvre et rien ne se
                facture automatiquement&nbsp;: quelqu’un vous répond.
              </p>
              <ul className="flex flex-col gap-px bg-border">
                {fermes.map((m) => (
                  <li
                    key={m.key}
                    className="flex flex-wrap items-center justify-between gap-3 bg-surface px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary">{m.label}</p>
                      <p className="text-xs leading-relaxed text-text-muted">{m.summary}</p>
                    </div>
                    {m.requested ? (
                      <span className="flex flex-shrink-0 items-center gap-1.5 text-xs text-text-muted">
                        <Check size={13} />
                        Demandé
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void demander(m.key)}
                        disabled={enCours === m.key}
                        className="flex min-h-11 flex-shrink-0 items-center gap-2 border border-border-strong bg-surface px-3 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-40 md:min-h-0 md:py-2"
                      >
                        {enCours === m.key ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Send size={13} />
                        )}
                        Demander
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
