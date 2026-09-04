import React, { useEffect, useMemo, useState } from 'react';
import { ModuleRequestsPanel } from '../components/tour/ModuleRequestsPanel';
import { RequestsQueuePanel } from '../components/tour/RequestsQueuePanel';
import { InputAlertsPanel } from '../components/tour/InputAlertsPanel';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Building2, ChevronDown, FolderLock, Loader2, Lock, Plus, Search, ShieldAlert, ShieldCheck, ShieldOff, Tag } from 'lucide-react';
import { useOrgContext } from '../state/OrgContextContext';
import { OrgDossierPanel } from '../components/org-rail/OrgDossierPanel';
import { ScreenHeader } from '../components/ScreenHeader';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { bridge } from '../lib/bridge';
import { cleanErrorMessage } from '../lib/errorMessage';
import { relativeTime } from '../lib/time';
import { useParcPage } from '../state/useParcPage';
import { CLIENT_NAV_ITEMS } from '../client-context/ClientSidebar';
import { ALWAYS_ON_MODULES } from '../data/spaces';
import type { AdminOrganization, BulkAction, ModuleLock, ParcOrganization, ParcPageQuery, ParcSummary } from '../shared/api';

/**
 * LE REGISTRE DES ORGANISATIONS, À L'ÉCHELLE (Bloc 4).
 *
 * Avant : toutes les organisations chargées puis filtrées dans le navigateur
 * — deux filtres (toutes / actives / suspendues) et une recherche sur le nom.
 * Mesuré à 100 000 organisations d'essai : 2,6 s côté serveur et 48 Mo par
 * ouverture ; à un million, l'écran ne s'ouvre pas.
 *
 * Maintenant : le serveur filtre (recherche, statut, formule, activité,
 * incidents, étiquette, langue, secteur), trie, compte, et rend cinquante
 * lignes à la fois (3 ms la page, la 402e comme la première). Les compteurs
 * de l'en-tête viennent du résumé agrégé, jamais des lignes. Une sélection
 * et un geste s'appliquent à N organisations d'un coup, confirmés, et le
 * serveur journalise chacune.
 *
 * Écran interne : les textes restent en français, comme toute la Tour.
 */
const PLAN_LABELS: Record<string, string> = { business_standard: 'Standard', business_premium: 'Premium', internal: 'Interne' };
const ACTIONS: Array<{ key: BulkAction; label: string }> = [
  { key: 'module_open', label: 'Ouvrir un module' },
  { key: 'module_close', label: 'Fermer un module' },
  { key: 'tag_add', label: 'Poser une étiquette' },
  { key: 'tag_remove', label: 'Retirer une étiquette' },
  { key: 'announce', label: 'Déposer une annonce' },
  { key: 'suspend', label: 'Suspendre' },
  { key: 'reactivate', label: 'Réactiver' },
];
const MODULES_REGLABLES = CLIENT_NAV_ITEMS.filter((i) => !ALWAYS_ON_MODULES.includes(i.key));

export function OrganizationsScreen() {
  const navigate = useNavigate();
  const { enterOrganization, entering, refreshOrganizations } = useOrgContext();
  const [q, setQ] = useState('');
  const [filtres, setFiltres] = useState<Omit<ParcPageQuery, 'q' | 'cursor' | 'limit'>>({ sort: 'name' });
  const requete = useMemo(() => ({ ...filtres, q: q.trim() || undefined }), [filtres, q]);
  const parc = useParcPage(requete);
  const [resume, setResume] = useState<ParcSummary | null>(null);
  const [resumeGen, setResumeGen] = useState(0);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dossier, setDossier] = useState<{ organization: AdminOrganization; tags: string[]; locks: ModuleLock[] } | null>(null);
  const [dossierEnCours, setDossierEnCours] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    bridge()
      .remote.admin.organizationsSummary()
      .then((s) => vivant && setResume(s))
      .catch(() => {
        /* l'en-tête retire ses chiffres plutôt que d'afficher des zéros */
      });
    return () => {
      vivant = false;
    };
  }, [resumeGen]);

  const rafraichir = () => {
    parc.reload();
    setResumeGen((g) => g + 1);
    void refreshOrganizations();
  };

  const poser = (patch: Partial<typeof filtres>) => setFiltres((f) => ({ ...f, ...patch }));
  const gereesHorsAmn = resume ? Math.max(0, resume.total - (resume.byPlan.internal ?? 0)) : undefined;

  const ouvrirDossier = async (id: string) => {
    setDossierEnCours(id);
    setError(null);
    try {
      setDossier(await bridge().remote.admin.organizationDossier(id));
    } catch (err) {
      setError(cleanErrorMessage(err, 'Le dossier n’a pas pu être lu.'));
    } finally {
      setDossierEnCours(null);
    }
  };
  const toggleStatus = async (org: ParcOrganization) => {
    setError(null);
    setPending(org.id);
    try {
      await bridge().remote.admin.setOrganizationStatus(org.id, org.status === 'suspended' ? 'active' : 'suspended');
      rafraichir();
    } catch (err) {
      setError(cleanErrorMessage(err, 'Action refusée par amn-api.'));
    } finally {
      setPending(null);
    }
  };
  const basculerSelection = (id: string) =>
    setSelection((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toutSelectionner = () => setSelection(new Set(parc.rows.map((r) => r.id)));

  return (
    <StaggerGroup className="flex flex-col gap-6">
      <StaggerItem>
        <ScreenHeader
          eyebrow="Tour de contrôle · Supervision"
          title="Organisations"
          description="Le registre des clientes gérées — chercher, filtrer, agir sur plusieurs à la fois, ouvrir un dossier. Le serveur compte et trie ; le poste tourne les pages."
          stats={[
            { label: 'Gérées', value: gereesHorsAmn },
            { label: 'Actives (7 j)', value: resume?.active7d, title: 'Organisations ayant écrit quelque chose sur sept jours.' },
            { label: 'Muettes (30 j)', value: resume?.silent30d, title: 'Rien d’écrit depuis trente jours, ou jamais.' },
            { label: 'Incidents ouverts', value: resume?.withOpenIncidents, emphasis: Boolean(resume && resume.withOpenIncidents > 0), title: 'Organisations avec au moins un incident nouveau ou pris en charge.' },
            { label: 'Suspendues', value: resume?.byStatus.suspended ?? (resume ? 0 : undefined), emphasis: Boolean(resume?.byStatus.suspended) },
          ]}
          actions={
            <button type="button" onClick={() => navigate('/tour/generateur')} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} />
              <span className="hidden sm:inline">Ouvrir l’atelier</span>
            </button>
          }
        />
      </StaggerItem>

      <StaggerItem><RequestsQueuePanel /></StaggerItem>
      <StaggerItem><InputAlertsPanel /></StaggerItem>
      <StaggerItem><ModuleRequestsPanel /></StaggerItem>

      {/* --------------------------------------------- la question posée au serveur ----- */}
      <StaggerItem>
        <div className="flex flex-col gap-2">
          <label className="input-focus flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3">
            <Search size={15} strokeWidth={1.75} className="flex-shrink-0 text-text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une organisation…" aria-label="Chercher une organisation" className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted" />
            {parc.loading && <Loader2 size={14} className="animate-spin text-text-muted" />}
          </label>
          <div className="flex flex-wrap gap-2">
            <Filtre label="Statut" value={filtres.status ?? ''} onChange={(v) => poser({ status: (v || undefined) as ParcPageQuery['status'] })} options={[['', 'Toutes'], ['active', 'Actives'], ['suspended', 'Suspendues']]} />
            <Filtre label="Formule" value={filtres.plan ?? ''} onChange={(v) => poser({ plan: (v || undefined) as ParcPageQuery['plan'] })} options={[['', 'Toutes'], ['business_standard', 'Standard'], ['business_premium', 'Premium']]} />
            <Filtre label="Activité" value={filtres.activity ?? ''} onChange={(v) => poser({ activity: (v || undefined) as ParcPageQuery['activity'] })} options={[['', 'Toutes'], ['7d', 'Actives 7 j'], ['30d', 'Actives 30 j'], ['silent30d', 'Muettes 30 j'], ['never', 'Jamais actives']]} />
            <Filtre label="Incidents" value={filtres.incidents ?? ''} onChange={(v) => poser({ incidents: (v || undefined) as ParcPageQuery['incidents'] })} options={[['', 'Tous'], ['open', 'Ouverts']]} />
            <Filtre label="Étiquette" value={filtres.tag ?? ''} onChange={(v) => poser({ tag: v || undefined })} options={[['', 'Toutes'], ...(resume?.tags ?? []).map((t) => [t.tag, `${t.tag} (${t.count})`] as [string, string])]} />
            <Filtre label="Langue" value={filtres.language ?? ''} onChange={(v) => poser({ language: v || undefined })} options={[['', 'Toutes'], ['fr', 'Français'], ['en', 'Anglais']]} />
            <Filtre label="Secteur" value={filtres.trade ?? ''} onChange={(v) => poser({ trade: v || undefined })} options={[['', 'Tous'], ['boutique', 'Boutique'], ['services', 'Services'], ['evenementiel', 'Événementiel'], ['artisan', 'Artisan'], ['collectif', 'Collectif']]} />
            <Filtre label="Tri" value={filtres.sort ?? 'name'} onChange={(v) => poser({ sort: v as ParcPageQuery['sort'] })} options={[['name', 'Nom'], ['created', 'Création'], ['activity', 'Activité']]} />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {parc.total === null ? '…' : `${parc.total} organisation${parc.total > 1 ? 's' : ''} · ${parc.rows.length} affichée${parc.rows.length > 1 ? 's' : ''}`}
            {selection.size > 0 && ` · ${selection.size} sélectionnée${selection.size > 1 ? 's' : ''}`}
          </p>
        </div>
      </StaggerItem>

      {(error || parc.error) && (
        <StaggerItem>
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-text-secondary">{error ?? parc.error}</p>
        </StaggerItem>
      )}

      {selection.size > 0 && (
        <StaggerItem>
          <BarreGroupee ids={[...selection]} onDone={() => { setSelection(new Set()); rafraichir(); }} />
        </StaggerItem>
      )}

      {/* ------------------------------------------------------------- les lignes ----- */}
      <StaggerItem>
        {parc.rows.length === 0 && !parc.loading ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface py-12 text-center">
            <Building2 size={22} strokeWidth={1.5} className="text-text-muted" />
            <p className="text-sm font-medium text-text-primary">{parc.total === 0 && !q && Object.keys(filtres).length <= 1 ? 'Aucune organisation cliente' : 'Aucune organisation ne correspond'}</p>
            <p className="max-w-sm text-sm text-text-secondary">{parc.total === 0 && !q ? 'La création génère l’organisation, son compte propriétaire et son accès en une fois.' : 'Changez un filtre ou effacez la recherche.'}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex items-center gap-3 border-b border-border px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">
              <input type="checkbox" aria-label="Tout sélectionner" checked={parc.rows.length > 0 && selection.size === parc.rows.length} onChange={(e) => (e.target.checked ? toutSelectionner() : setSelection(new Set()))} className="h-6 w-6 accent-[var(--accent)]" />
              <span className="flex-1">Organisation</span>
              <span className="hidden w-20 sm:block">Formule</span>
              <span className="hidden w-16 md:block">Comptes</span>
              <span className="hidden w-28 md:block">Activité</span>
              <span className="w-32 text-right sm:w-56">Gestes</span>
            </div>
            <ul className="divide-y divide-border">
              {parc.rows.map((org) => (
                <li key={org.id} className={`flex items-center gap-3 px-3 py-2 ${org.status === 'suspended' ? 'opacity-70' : ''}`}>
                  <input type="checkbox" aria-label={`Sélectionner ${org.name}`} checked={selection.has(org.id)} onChange={() => basculerSelection(org.id)} className="h-6 w-6 flex-shrink-0 accent-[var(--accent)]" />
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => void ouvrirDossier(org.id)} className="-my-2 max-w-full truncate py-2 text-left text-sm font-medium text-text-primary hover:underline">
                      {org.name}
                    </button>
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-text-muted">
                      {org.status === 'suspended' && <span className="text-warning">Suspendue</span>}
                      {org.openIncidents > 0 && <span className="flex items-center gap-0.5 text-danger"><ShieldAlert size={9} /> {org.openIncidents} incident{org.openIncidents > 1 ? 's' : ''}</span>}
                      {org.locks > 0 && <span className="flex items-center gap-0.5"><Lock size={9} /> {org.locks} verrou{org.locks > 1 ? 's' : ''}</span>}
                      {org.tags.map((t) => <span key={t} className="flex items-center gap-0.5 rounded-sm border border-border px-1 normal-case tracking-normal"><Tag size={8} /> {t}</span>)}
                    </div>
                  </div>
                  <span className="hidden w-20 text-xs text-text-secondary sm:block">{PLAN_LABELS[org.plan] ?? org.plan}</span>
                  <span className="tnum hidden w-16 text-xs text-text-secondary md:block">{org.userCount}{org.seats ? ` / ${org.seats}` : ''}</span>
                  <span className="hidden w-28 text-xs text-text-muted md:block">{org.lastActivityAt ? relativeTime(org.lastActivityAt) : '—'}</span>
                  <div className="flex w-32 flex-shrink-0 justify-end gap-1 sm:w-56">
                    <button type="button" onClick={() => void enterOrganization(org.id)} disabled={entering === org.id || org.status === 'suspended'} className="min-h-11 border border-border-strong px-2.5 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-50 md:min-h-0 md:py-1.5">
                      {entering === org.id ? '…' : 'Ouvrir'}
                    </button>
                    <button type="button" onClick={() => void ouvrirDossier(org.id)} disabled={dossierEnCours === org.id} title="Dossier interne : formule, modules, étiquettes, verrous, comptes" className="hidden min-h-11 items-center gap-1.5 border border-border px-2.5 font-mono text-[10px] uppercase tracking-wider text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50 sm:flex md:min-h-0 md:py-1.5">
                      <FolderLock size={12} strokeWidth={1.75} /> Dossier
                    </button>
                    <button type="button" onClick={() => void toggleStatus(org)} disabled={pending === org.id} aria-label={org.status === 'suspended' ? `Réactiver ${org.name}` : `Suspendre ${org.name}`} title={org.status === 'suspended' ? 'Réactiver' : 'Suspendre'} className="hidden min-h-11 items-center border border-border px-2.5 text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50 sm:flex md:min-h-0 md:py-1.5">
                      {org.status === 'suspended' ? <ShieldCheck size={12} strokeWidth={1.75} /> : <ShieldOff size={12} strokeWidth={1.75} />}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {parc.hasMore && (
              <button type="button" onClick={parc.loadMore} disabled={parc.loading} className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-border font-mono text-[10px] uppercase tracking-widest text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-50">
                {parc.loading ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />} Cinquante de plus
              </button>
            )}
          </div>
        )}
      </StaggerItem>

      <AnimatePresence>
        {dossier && (
          <OrgDossierPanel
            key={dossier.organization.id}
            org={dossier.organization}
            tags={dossier.tags}
            locks={dossier.locks}
            onClose={() => setDossier(null)}
            onSaved={() => {
              void ouvrirDossier(dossier.organization.id);
              rafraichir();
            }}
          />
        )}
      </AnimatePresence>
    </StaggerGroup>
  );
}

function Filtre({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <label className="flex items-center gap-1.5 border border-border bg-surface px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-text-muted">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="input-focus max-w-[9rem] cursor-pointer bg-bg px-1 py-1 text-[11px] normal-case tracking-normal text-text-primary outline-none">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

/**
 * LA BARRE DES GESTES GROUPÉS. Un geste, ses paramètres, une confirmation
 * qui dit combien d'organisations, puis le résultat : combien faites,
 * lesquelles refusées et pourquoi. Le serveur journalise chacune.
 */
function BarreGroupee({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const [action, setAction] = useState<BulkAction>('module_open');
  const [module, setModule] = useState(MODULES_REGLABLES[0]?.key ?? '');
  const [tag, setTag] = useState('');
  const [titre, setTitre] = useState('');
  const [corps, setCorps] = useState('');
  const [maintenance, setMaintenance] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<{ done: number; failed: Array<{ id: string; error: string }> } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const pret = action === 'module_open' || action === 'module_close' ? Boolean(module) : action === 'tag_add' || action === 'tag_remove' ? tag.trim().length > 0 : action === 'announce' ? titre.trim().length > 0 && corps.trim().length > 0 : true;

  const appliquer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      let done = 0;
      const failed: Array<{ id: string; error: string }> = [];
      for (let i = 0; i < ids.length; i += 500) {
        const r = await bridge().remote.admin.bulk({ ids: ids.slice(i, i + 500), action, params: { module, tag: tag.trim(), title: titre.trim(), body: corps.trim(), maintenance }, confirm: true });
        done += r.done;
        failed.push(...r.failed);
      }
      setResultat({ done, failed });
      setConfirmer(false);
      if (failed.length === 0) onDone();
    } catch (err) {
      setErreur(cleanErrorMessage(err, 'Le geste groupé a été refusé.'));
    } finally {
      setEnCours(false);
    }
  };
  const libelle = ACTIONS.find((a) => a.key === action)?.label ?? action;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-accent/40 bg-accent-muted px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{ids.length} organisation{ids.length > 1 ? 's' : ''} sélectionnée{ids.length > 1 ? 's' : ''}</span>
        <select value={action} onChange={(e) => { setAction(e.target.value as BulkAction); setConfirmer(false); setResultat(null); }} aria-label="Geste groupé" className="input-focus cursor-pointer border border-border bg-bg px-2 py-1.5 text-sm text-text-primary outline-none">
          {ACTIONS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
        </select>
        {(action === 'module_open' || action === 'module_close') && (
          <select value={module} onChange={(e) => setModule(e.target.value)} aria-label="Module" className="input-focus cursor-pointer border border-border bg-bg px-2 py-1.5 text-sm text-text-primary outline-none">
            {MODULES_REGLABLES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        )}
        {(action === 'tag_add' || action === 'tag_remove') && (
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Étiquette" aria-label="Étiquette" className="input-focus border border-border bg-bg px-2 py-1.5 text-sm text-text-primary outline-none" />
        )}
        {!confirmer ? (
          <button type="button" disabled={!pret || enCours} onClick={() => setConfirmer(true)} className="min-h-11 bg-accent px-3 text-sm font-semibold text-bg disabled:opacity-40 md:min-h-0 md:py-1.5">Appliquer</button>
        ) : (
          <>
            <span className="text-sm text-text-primary">{libelle} sur {ids.length} organisation{ids.length > 1 ? 's' : ''} — sûr ?</span>
            <button type="button" disabled={enCours} onClick={() => void appliquer()} className="min-h-11 bg-accent px-3 text-sm font-semibold text-bg disabled:opacity-40 md:min-h-0 md:py-1.5">{enCours ? 'En cours…' : 'Confirmer'}</button>
            <button type="button" disabled={enCours} onClick={() => setConfirmer(false)} className="min-h-11 border border-border px-3 text-sm text-text-secondary md:min-h-0 md:py-1.5">Annuler</button>
          </>
        )}
      </div>
      {action === 'announce' && (
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Titre de l’annonce" aria-label="Titre de l’annonce" className="input-focus border border-border bg-bg px-2 py-1.5 text-sm text-text-primary outline-none" />
          <input value={corps} onChange={(e) => setCorps(e.target.value)} placeholder="Texte (ce que chaque cliente lira dans ses Annonces)" aria-label="Texte de l’annonce" className="input-focus border border-border bg-bg px-2 py-1.5 text-sm text-text-primary outline-none" />
          <label className="flex items-center gap-2 text-xs text-text-secondary"><input type="checkbox" checked={maintenance} onChange={(e) => setMaintenance(e.target.checked)} className="h-6 w-6" /> Maintenance</label>
        </div>
      )}
      {erreur && <p role="alert" className="text-xs text-danger">{erreur}</p>}
      {resultat && (
        <p className="text-xs text-text-secondary">
          {resultat.done} faite{resultat.done > 1 ? 's' : ''}{resultat.failed.length > 0 ? ` · ${resultat.failed.length} refusée${resultat.failed.length > 1 ? 's' : ''} : ${resultat.failed.map((f) => f.error).slice(0, 3).join(' ; ')}` : ' — chacune est au journal.'}
        </p>
      )}
    </div>
  );
}
