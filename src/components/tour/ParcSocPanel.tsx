import React, { useEffect, useState } from 'react';
import { ChevronDown, Loader2, ShieldAlert } from 'lucide-react';
import { bridge } from '../../lib/bridge';
import { relativeTime } from '../../lib/time';
import { useOrgContext } from '../../state/OrgContextContext';
import { useCursorPage } from '../../state/useCursorPage';
import type { FleetIncident, SocSummary } from '../../shared/api';

/**
 * LA FILE DU PARC (Bloc 6) — tous les incidents ouverts, toutes organisations.
 *
 * L'écran de supervision tenait la file d'UNE organisation : la nôtre, ou
 * celle dans laquelle on est entré. Quand on tient le parc, la question est
 * « où ça brûle, chez qui, depuis combien de temps » — et la réponse ne peut
 * pas être « ouvre les organisations une par une ». Ici : les comptes du SOC
 * agrégés par le serveur (jamais en chargeant les incidents), puis la file
 * par pages de cinquante, les plus récents d'abord, avec le total.
 *
 * Écran interne : les textes restent en français, comme toute la Tour.
 */
/*
  LE CRITIQUE À L'ENCRE. La file est recousue dans un bureau (Mur de
  situation, Cyber · Incidents) où le rouge ne se dit qu'une fois par écran,
  sur l'objet critique lui-même — l'exception du Mur, la couche de la nappe.
  Ici, une ligne critique porte une pastille d'encre pleine et son mot.
*/
const GRAVITE: Record<string, string> = { critical: 'bg-text-primary', warning: 'bg-warning', info: 'bg-text-muted' };

export function ParcSocPanel() {
  const { enterOrganization, entering, support } = useOrgContext();
  const [resume, setResume] = useState<SocSummary | null>(null);
  const [gravite, setGravite] = useState<'' | 'critical' | 'warning' | 'info'>('');
  /*
    Le chargement par curseur (générations, verrou du double clic, remise à
    zéro à chaque changement de gravité) vit dans `useCursorPage`, partagée
    avec le registre des organisations (`useParcPage`) : c'est la même course
    qui a été trouvée aux deux endroits le 25/09. Voir l'en-tête de
    `useCursorPage` pour le détail.
  */
  const {
    rows: lignes,
    total,
    loading: chargement,
    error: erreur,
    hasMore,
    loadMore,
  } = useCursorPage<FleetIncident>(
    gravite,
    async (cursor) => {
      const page = await bridge().remote.admin.incidentsQueue({ status: 'open', severity: gravite || undefined, cursor, limit: 50 });
      return { items: page.incidents, total: page.total, nextCursor: page.nextCursor };
    },
    { messageErreur: 'La file du parc n’a pas pu être lue.', actif: !support },
  );

  useEffect(() => {
    if (support) return;
    let vivant = true;
    const lireResume = () =>
      bridge()
        .remote.admin.incidentsSummary()
        .then((s) => vivant && setResume(s))
        .catch(() => {
          /* les chiffres se retirent plutôt que d'afficher des zéros */
        });
    void lireResume();
    const minuterie = window.setInterval(() => void lireResume(), 60_000);
    return () => {
      vivant = false;
      window.clearInterval(minuterie);
    };
  }, [support]);

  // En session d'assistance, l'écran tient la file de LA cliente : le parc n'a rien à faire ici.
  if (support) return null;

  const compteur = (label: string, valeur: number | string | null | undefined, accent = false) => (
    <div className="flex flex-col gap-0.5 border-l border-border pl-3 first:border-0 first:pl-0">
      <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</span>
      <span className={`tnum text-lg text-text-primary ${accent ? 'font-semibold' : 'font-medium'}`}>{valeur ?? '—'}</span>
    </div>
  );

  return (
    <section aria-label="La file du parc" className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Le parc · tous les incidents ouverts</p>
          <p className="mt-0.5 text-xs text-text-secondary">Comptés et triés par le serveur ; cinquante à la fois, les plus récents d’abord. Entrer chez une cliente ouvre sa file à elle.</p>
        </div>
        <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
          Gravité
          <select value={gravite} onChange={(e) => setGravite(e.target.value as typeof gravite)} aria-label="Gravité" className="input-focus cursor-pointer bg-bg px-1 py-1 text-[11px] normal-case tracking-normal text-text-primary outline-none">
            <option value="">Toutes</option>
            <option value="critical">Critiques</option>
            <option value="warning">Avertissements</option>
            <option value="info">Informations</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-4">
        {compteur('Ouverts', resume?.open)}
        {compteur('Nouveaux', resume?.new)}
        {compteur('Critiques', resume?.critical, Boolean(resume && resume.critical > 0))}
        {compteur('Escaladés', resume?.escalated, Boolean(resume && resume.escalated > 0))}
        {compteur('Plus vieux non pris', resume?.oldestNewMinutes === null || resume?.oldestNewMinutes === undefined ? '—' : `${resume.oldestNewMinutes} min`, Boolean(resume && (resume.oldestNewMinutes ?? 0) > 60))}
        {compteur('Sites hors ligne', resume?.sitesOffline, Boolean(resume && resume.sitesOffline > 0))}
        {compteur('Organisations touchées', resume?.organizationsAffected)}
      </div>
      {erreur && <p role="alert" className="text-xs text-text-primary">{erreur}</p>}
      {lignes.length === 0 && !chargement ? (
        <p className="text-sm text-text-secondary">Rien d’ouvert dans le parc{gravite ? ' à cette gravité' : ''}.</p>
      ) : (
        <ul className="divide-y divide-border border border-border bg-bg">
          {lignes.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-3 py-2">
              <span className={`h-2 w-2 flex-shrink-0 rounded-full ${GRAVITE[i.severity] ?? 'bg-text-muted'}`} aria-label={i.severity} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text-primary">
                  <span className="font-medium">{i.orgName || '—'}</span>
                  <span className="text-text-muted"> · </span>
                  {i.actor}
                  {i.kinds.length > 0 && <span className="text-text-secondary"> · {i.kinds.slice(0, 2).join(', ')}</span>}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  {i.severity === 'critical' && <span className="font-semibold text-text-primary">critique · </span>}
                  {i.status === 'new' ? 'nouveau' : 'pris en charge'} · {i.alertCount} alerte{i.alertCount > 1 ? 's' : ''} · vu {relativeTime(i.lastSeenAt)}
                  {i.escalationLevel > 0 && <span className="font-semibold text-text-primary"> · escaladé niveau {i.escalationLevel}</span>}
                </p>
              </div>
              <button type="button" onClick={() => void enterOrganization(i.orgId)} disabled={entering === i.orgId} className="min-h-11 flex-shrink-0 border border-border-strong px-2.5 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-50 md:min-h-0 md:py-1.5">
                {entering === i.orgId ? '…' : 'Entrer'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
          {total === null ? '…' : `${total} ouvert${total > 1 ? 's' : ''} · ${lignes.length} affiché${lignes.length > 1 ? 's' : ''}`}
        </p>
        {hasMore && (
          <button type="button" onClick={loadMore} disabled={chargement} className="flex min-h-11 items-center gap-1.5 border border-border px-3 font-mono text-[10px] uppercase tracking-widest text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-50 md:min-h-0 md:py-1.5">
            {chargement ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />} Cinquante de plus
          </button>
        )}
      </div>
      {resume && resume.escalated > 0 && (
        <p className="flex items-center gap-2 text-xs font-semibold text-text-primary"><ShieldAlert size={13} /> {resume.escalated} incident{resume.escalated > 1 ? 's' : ''} critique{resume.escalated > 1 ? 's' : ''} escaladé{resume.escalated > 1 ? 's' : ''} sans prise en charge.</p>
      )}
    </section>
  );
}
