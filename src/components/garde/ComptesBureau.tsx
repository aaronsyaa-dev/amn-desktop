import React, { useCallback, useEffect, useState } from 'react';
import { bridge } from '../../lib/bridge';
import { garde } from '../../lib/garde';
import { useLangue } from '../../i18n';
import { relativeTime } from '../../lib/time';
import type { GardeCompte, GardeJeton } from '../../shared/garde';
import type { ParcOrganization } from '../../shared/api';

/**
 * LE PUPITRE DU CHEF DES COMPTES — les jetons et les règlements (Bloc 5).
 *
 * Deux choses seulement, celles que le site fait d'habitude et qu'Aaron doit
 * pouvoir faire à la main : émettre un jeton (module, formule ou places) dont
 * le secret ne se lit qu'une fois ; dire qu'une organisation a payé ou non.
 * Tout le reste — vérifier, ouvrir, préavis, grâce, pause, réouverture — est
 * fait par la Garde des Comptes, et se lit dans son journal, en dessous.
 */
type Type = 'module' | 'formule' | 'places';
const FORMULES = ['business_standard', 'business_premium'] as const;

export function ComptesBureau() {
  const { t } = useLangue();
  const [jetons, setJetons] = useState<GardeJeton[]>([]);
  const [comptes, setComptes] = useState<GardeCompte[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [type, setType] = useState<Type>('module');
  const [valeur, setValeur] = useState('');
  const [jours, setJours] = useState(30);
  const [note, setNote] = useState('');
  const [emis, setEmis] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [trouvees, setTrouvees] = useState<ParcOrganization[]>([]);
  const [dit, setDit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const charger = useCallback(async () => {
    try {
      const [j, c] = await Promise.all([garde.jetons(), garde.comptes()]);
      setJetons(j);
      setComptes(c);
      setErreur(null);
    } catch (err) { setErreur(err instanceof Error ? err.message : String(err)); }
  }, []);
  useEffect(() => { void charger(); }, [charger]);
  useEffect(() => garde.onGarde((trame) => { if (['garde:journal', 'garde:remontee'].includes(trame.type)) void charger(); }), [charger]);

  const emettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setEmis(null); setCopie(false);
    try {
      const input = type === 'module' ? { module: valeur.trim() } : type === 'formule' ? { formule: valeur || FORMULES[0] } : { places: Number(valeur) };
      const r = await garde.emettreJeton({ ...input, expiresInDays: jours, note: note.trim() || undefined });
      if (r.error) { setDit(r.error); } else { setEmis(r.aTransmettre); setDit(null); setValeur(''); setNote(''); }
      await charger();
    } catch (err) { setDit(t('garde.erreur', { message: err instanceof Error ? err.message : String(err) })); } finally { setBusy(false); }
  };
  const copier = async () => {
    if (!emis) return;
    try { await navigator.clipboard.writeText(emis); setCopie(true); } catch { setCopie(false); }
  };
  const revoquer = async (id: string) => { await garde.revoquerJeton(id); await charger(); };
  const chercher = async (q: string) => {
    setRecherche(q);
    if (q.trim().length < 2) { setTrouvees([]); return; }
    try { setTrouvees((await bridge().remote.admin.organizationsPage({ q: q.trim(), limit: 6 })).organizations); } catch { setTrouvees([]); }
  };
  const paiement = async (orgId: string, etat: 'paye' | 'impaye') => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await garde.paiement(orgId, etat);
      setDit(r.error ?? r.texte);
      setTrouvees([]); setRecherche('');
      await charger();
    } catch (err) { setDit(t('garde.erreur', { message: err instanceof Error ? err.message : String(err) })); } finally { setBusy(false); }
  };
  const quoi = (j: GardeJeton) => (j.module ? j.module : j.formule ? t('garde.comptes.formuleDe', { formule: j.formule === 'business_premium' ? 'Premium' : 'Standard' }) : t('garde.comptes.placesDe', { n: j.places ?? 0 }));
  const etatClasse = (etat: GardeCompte['etat'] | GardeJeton['etat']) => (etat === 'a_jour' || etat === 'utilise' ? 'text-success' : etat === 'grace' || etat === 'emis' ? 'text-warning' : etat === 'suspendu' || etat === 'impaye' ? 'text-danger' : 'text-text-muted');

  return (
    <>
      {erreur && <p role="alert" className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-text-primary">{t('garde.erreur', { message: erreur })}</p>}
      <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.comptes.jetons')}>
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.comptes.jetons')}</h2>
        <p className="mb-3 mt-1 text-[12px] text-text-muted">{t('garde.comptes.jetonsAide')}</p>
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => void emettre(e)} aria-label={t('garde.comptes.emettre')}>
          <label className="flex flex-col gap-0.5 text-[11px] text-text-muted">{t('garde.comptes.type')}
            <select value={type} onChange={(e) => { setType(e.target.value as Type); setValeur(''); }} aria-label={t('garde.comptes.type')} className="input-focus bg-bg px-2 py-1 text-[12px] text-text-primary outline-none">
              <option value="module">{t('garde.comptes.typeModule')}</option>
              <option value="formule">{t('garde.comptes.typeFormule')}</option>
              <option value="places">{t('garde.comptes.typePlaces')}</option>
            </select>
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[11px] text-text-muted">{type === 'module' ? t('garde.comptes.module') : type === 'formule' ? t('garde.comptes.formule') : t('garde.comptes.places')}
            {type === 'formule'
              ? <select value={valeur || FORMULES[0]} onChange={(e) => setValeur(e.target.value)} aria-label={t('garde.comptes.formule')} className="input-focus bg-bg px-2 py-1 text-[12px] text-text-primary outline-none">{FORMULES.map((f) => <option key={f} value={f}>{f === 'business_premium' ? 'Premium' : 'Standard'}</option>)}</select>
              : <input value={valeur} onChange={(e) => setValeur(e.target.value)} type={type === 'places' ? 'number' : 'text'} min={1} max={500} placeholder={type === 'module' ? 'stock' : '3'} aria-label={type === 'module' ? t('garde.comptes.module') : t('garde.comptes.places')} className="input-focus min-w-0 border border-border bg-bg px-2 py-1 text-[12px] text-text-primary outline-none" />}
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-text-muted">{t('garde.comptes.jours')}
            <input type="number" min={1} max={365} value={jours} onChange={(e) => setJours(Number(e.target.value) || 30)} aria-label={t('garde.comptes.jours')} className="input-focus w-16 border border-border bg-bg px-2 py-1 text-[12px] text-text-primary outline-none" />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[11px] text-text-muted">{t('garde.comptes.note')}
            <input value={note} onChange={(e) => setNote(e.target.value)} aria-label={t('garde.comptes.note')} className="input-focus min-w-0 border border-border bg-bg px-2 py-1 text-[12px] text-text-primary outline-none" />
          </label>
          <button type="submit" disabled={busy || (type !== 'formule' && !valeur.trim())} className="min-h-11 border border-border-strong bg-surface px-3 text-sm font-medium text-text-primary hover:bg-surface-hover disabled:opacity-50 md:min-h-0 md:py-1.5">{t('garde.comptes.emettre')}</button>
        </form>
        {emis && (
          <div className="mt-3 rounded-lg border border-accent/60 bg-bg p-3" data-jeton-emis>
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('garde.comptes.uneFois')}</p>
            <p className="mt-1 break-all font-mono text-[13px] text-text-primary" data-secret>{emis}</p>
            <button type="button" onClick={() => void copier()} className="mt-2 border border-border px-2.5 py-1 text-xs text-text-secondary hover:border-border-strong hover:text-text-primary">{copie ? t('garde.comptes.copie') : t('garde.comptes.copier')}</button>
          </div>
        )}
        {dit && <p className="mt-2 text-[12px] text-text-secondary" aria-live="polite" data-comptes-dit>{dit}</p>}
        <ul className="mt-3 flex flex-col divide-y divide-border" aria-label={t('garde.comptes.jetonsEmis')}>
          {jetons.length === 0 && <li className="py-2 font-mono text-xs text-text-muted">{t('garde.comptes.aucunJeton')}</li>}
          {jetons.slice(0, 30).map((j) => (
            <li key={j.id} className="flex flex-wrap items-center gap-2 py-2 text-[12px]" data-jeton-etat={j.etat}>
              <span className={`font-mono text-[10px] uppercase tracking-widest ${etatClasse(j.etat)}`}>{t(`garde.comptes.etatJeton.${j.etat}`)}</span>
              <span className="text-text-primary">{quoi(j)}</span>
              <span className="text-text-muted">· {j.emisPar}{j.note ? ` · ${j.note}` : ''} · {j.etat === 'utilise' && j.utiliseAt ? `${t('garde.comptes.utilisePar', { org: j.utiliseParOrgName ?? j.utiliseParOrg ?? '' })} ${relativeTime(j.utiliseAt)}` : `${t('garde.comptes.expire')} ${relativeTime(j.expiresAt)}`}</span>
              {j.etat === 'emis' && <button type="button" onClick={() => void revoquer(j.id)} className="ml-auto min-h-11 border border-border px-2 text-[11px] text-text-secondary hover:border-border-strong hover:text-text-primary md:min-h-0 md:py-0.5">{t('garde.comptes.revoquer')}</button>}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.comptes.reglements')}>
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.comptes.reglements')}</h2>
        <p className="mb-3 mt-1 text-[12px] text-text-muted">{t('garde.comptes.reglementsAide')}</p>
        <div className="relative">
          <input value={recherche} onChange={(e) => void chercher(e.target.value)} placeholder={t('garde.comptes.chercher')} aria-label={t('garde.comptes.chercher')} className="input-focus w-full border border-border bg-bg px-2 py-1.5 text-[12px] text-text-primary outline-none" />
          {trouvees.length > 0 && (
            <ul className="absolute left-0 right-0 z-10 mt-1 flex flex-col divide-y divide-border border border-border-strong bg-surface shadow-lg" role="listbox">
              {trouvees.map((o) => (
                <li key={o.id} className="flex items-center gap-2 px-2 py-1.5 text-[12px]">
                  <span className="min-w-0 flex-1 truncate text-text-primary">{o.name}</span>
                  <button type="button" disabled={busy} onClick={() => void paiement(o.id, 'impaye')} className="border border-border px-2 py-0.5 text-[11px] text-danger hover:border-border-strong">{t('garde.comptes.impaye')}</button>
                  <button type="button" disabled={busy} onClick={() => void paiement(o.id, 'paye')} className="border border-border px-2 py-0.5 text-[11px] text-success hover:border-border-strong">{t('garde.comptes.paye')}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <ul className="mt-3 flex flex-col divide-y divide-border" aria-label={t('garde.comptes.comptesSuivis')}>
          {comptes.length === 0 && <li className="py-2 font-mono text-xs text-text-muted">{t('garde.comptes.tousAJour')}</li>}
          {comptes.map((c) => (
            <li key={c.orgId} className="flex flex-wrap items-center gap-2 py-2 text-[12px]" data-compte-etat={c.etat}>
              <span className={`font-mono text-[10px] uppercase tracking-widest ${etatClasse(c.etat)}`}>{t(`garde.comptes.etat.${c.etat}`)}</span>
              <span className="text-text-primary">{c.orgName ?? c.orgId}</span>
              <span className="text-text-muted">
                {c.etat === 'grace' && c.graceJusqua ? `· ${t('garde.comptes.graceJusqua')} ${relativeTime(c.graceJusqua)}` : ''}
                {c.etat === 'suspendu' && c.suspenduAt ? `· ${t('garde.comptes.enPauseDepuis')} ${relativeTime(c.suspenduAt)} · ${c.modulesSuspendus.join(', ') || '—'}` : ''}
                {c.etat === 'impaye' && c.impayeDepuis ? `· ${t('garde.comptes.impayeDepuis')} ${relativeTime(c.impayeDepuis)}` : ''}
              </span>
              {c.etat !== 'a_jour' && <button type="button" disabled={busy} onClick={() => void paiement(c.orgId, 'paye')} className="ml-auto min-h-11 border border-border px-2 text-[11px] text-success hover:border-border-strong md:min-h-0 md:py-0.5">{t('garde.comptes.paye')}</button>}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
