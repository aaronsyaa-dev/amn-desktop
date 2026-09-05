import React, { useEffect, useState } from 'react';
import { Blocks, Check, Loader2, Lock, LockOpen, Send } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { isAdminRole } from '../../auth/roles';
import { t as tr } from '../../i18n';
import type { ModuleLock } from '../../shared/api';
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
  /*
    LE CONSENTEMENT (Bloc 4). La cliente décide, module par module, si son
    prestataire peut en ouvrir le CONTENU depuis une session d'assistance.
    Fermé, le module reste le sien : c'est nous qui n'y entrons plus, et son
    journal le dit. Son compte — formule, places, comptes — reste géré par le
    prestataire : c'est le contrat, pas le contenu. Seule la personne qui
    gère (owner ou admin) décide.
  */
  const { role } = useAuth();
  const peutDecider = isAdminRole(role);
  const [verrous, setVerrous] = useState<ModuleLock[] | null>(null);
  const [verrouEnCours, setVerrouEnCours] = useState<string | null>(null);
  useEffect(() => {
    let vivant = true;
    bridge()
      .remote.locks.list()
      .then((liste) => vivant && setVerrous(liste))
      .catch(() => vivant && setVerrous([]));
    return () => {
      vivant = false;
    };
  }, []);
  const basculerVerrou = async (cle: string, fermer: boolean) => {
    setVerrouEnCours(cle);
    setErreur(null);
    try {
      setVerrous(await bridge().remote.locks.set(cle, fermer));
    } catch {
      setErreur(tr('consentement.echec'));
    } finally {
      setVerrouEnCours(null);
    }
  };
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

  const [jeton, setJeton] = useState('');
  const [jetonDit, setJetonDit] = useState<string | null>(null);
  const deposerJeton = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jeton.trim()) return;
    setJetonDit(null);
    try {
      const r = await bridge().remote.modules.jeton({ jeton: jeton.trim() });
      setJetonDit(r.texte);
      if (r.recevable) { setJeton(''); setModules(await bridge().remote.modules.catalogue()); }
    } catch {
      setJetonDit(tr('biblio.jeton.echec'));
    }
  };

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

      <form onSubmit={(e) => void deposerJeton(e)} aria-label={tr('biblio.jeton.titre')} className="mb-4 flex flex-col gap-1.5">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="eyebrow">{tr('biblio.jeton.titre')}</span>
            <input value={jeton} onChange={(e) => setJeton(e.target.value)} placeholder="jeton:…" aria-label={tr('biblio.jeton.titre')} className="input-focus min-w-0 border border-border bg-bg px-2 py-1.5 font-mono text-[13px] text-text-primary outline-none" />
          </label>
          <button type="submit" disabled={!jeton.trim()} className="min-h-11 border border-border-strong bg-surface px-3 text-sm font-medium text-text-primary hover:bg-surface-hover disabled:opacity-50 md:min-h-0 md:py-1.5">{tr('biblio.jeton.envoyer')}</button>
        </div>
        <p className="text-[11px] text-text-muted">{tr('biblio.jeton.aide')}</p>
        {jetonDit && <p className="text-[13px] text-text-primary" aria-live="polite" data-jeton-reponse>{jetonDit}</p>}
      </form>

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

          <div>
            <p className="eyebrow mb-1">{tr('consentement.titre')}</p>
            <p className="mb-2 text-xs leading-relaxed text-text-secondary">{tr('consentement.aide')}</p>
            {verrous === null ? (
              <p className="flex items-center gap-2 text-xs text-text-muted"><Loader2 size={13} className="animate-spin" /> …</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border border border-border bg-bg">
                {ouverts.map((m) => {
                  const ferme = verrous.some((v) => v.module === m.key);
                  return (
                    <li key={m.key} className="flex items-center gap-3 px-3 py-2">
                      <span className={`flex-shrink-0 ${ferme ? 'text-warning' : 'text-text-muted'}`}>{ferme ? <Lock size={13} /> : <LockOpen size={13} />}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{m.label}</span>
                      <span className="hidden font-mono text-[10px] uppercase tracking-wider text-text-muted sm:inline">{ferme ? tr('consentement.ferme') : tr('consentement.ouvert')}</span>
                      <button
                        type="button"
                        disabled={!peutDecider || verrouEnCours === m.key}
                        onClick={() => void basculerVerrou(m.key, !ferme)}
                        aria-pressed={ferme}
                        className="min-h-11 border border-border-strong px-3 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40 md:min-h-0 md:py-1.5"
                      >
                        {ferme ? tr('consentement.rouvrir') : tr('consentement.fermer')}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {!peutDecider && <p className="mt-2 text-[11px] text-text-muted">{tr('consentement.seulGerant')}</p>}
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
