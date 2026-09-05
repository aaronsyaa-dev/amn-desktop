import React, { useState } from 'react';
import { useLangue } from '../../i18n';
import { relativeTime } from '../../lib/time';
import { garde } from '../../lib/garde';
import type { GardeAgent, GardeGravite, GardeJournalEntree, GardeOrdreReponse, GardePouls } from '../../shared/garde';

/*
  LES PIÈCES DE L'ESPACE « LA GARDE » — dans le langage Signes Vitaux.

  Un garde, c'est une lumière et une respiration : au repos, un point calme ;
  en ronde, il respire ; quand il a trouvé, il s'allume en avertissement ; en
  échec, en danger. Aucune animation qui ne dise un état. Aucune musique.
*/

export const GRAVITE_CLASSE: Record<GardeGravite, string> = {
  critique: 'border-danger/50 bg-danger-muted text-danger',
  haute: 'border-warning/50 bg-warning-muted text-text-primary',
  normale: 'border-border bg-surface text-text-secondary',
};

export function GraviteChip({ gravite }: { gravite: GardeGravite }) {
  const { t } = useLangue();
  return <span className={`inline-flex items-center border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${GRAVITE_CLASSE[gravite]}`}>{t(`garde.gravite.${gravite}`)}</span>;
}

export function EtatPoint({ etat, actif = true, size = 8 }: { etat: GardeAgent['etat']; actif?: boolean; size?: number }) {
  const classe = !actif ? 'bg-text-muted' : etat === 'ronde' ? 'bg-accent' : etat === 'trouve' ? 'bg-warning' : etat === 'echec' ? 'bg-danger' : 'bg-success';
  return (
    <span className="relative inline-flex flex-shrink-0" style={{ width: size, height: size }} aria-hidden>
      {actif && etat === 'ronde' && <span className={`absolute inset-0 rounded-full ${classe} opacity-60 motion-safe:animate-ping`} />}
      <span className={`relative inline-flex h-full w-full rounded-full ${classe}`} />
    </span>
  );
}

export function PoulsBadge({ pouls, compact = false }: { pouls: GardePouls | null; compact?: boolean }) {
  const { t, langue } = useLangue();
  if (!pouls) return null;
  const classe = pouls.niveau === 'critique' ? 'border-danger/60 text-danger' : pouls.niveau === 'attention' ? 'border-warning/60 text-text-primary' : 'border-success/50 text-text-primary';
  const point = pouls.niveau === 'critique' ? 'bg-danger' : pouls.niveau === 'attention' ? 'bg-warning' : 'bg-success';
  return (
    <div className={`flex items-center gap-3 rounded-xl border bg-surface px-3 py-2 ${classe}`} aria-label={t('garde.pouls.titre')}>
      <span className="relative inline-flex h-3 w-3" aria-hidden>
        {pouls.niveau !== 'calme' && <span className={`absolute inset-0 rounded-full ${point} opacity-50 motion-safe:animate-ping`} />}
        <span className={`relative inline-flex h-3 w-3 rounded-full ${point}`} />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('garde.pouls.titre')}</p>
        <p className="text-sm font-semibold leading-tight">{t(`garde.pouls.${pouls.niveau}`)}{!compact && pouls.compte.ouvertes > 0 ? ` · ${t('garde.pouls.aVotreAvis', { n: pouls.compte.ouvertes })}` : ''}</p>
        {!compact && pouls.absence && <p className="text-[11px] text-text-muted">{t('garde.pouls.absence', { depuis: new Date(pouls.absence.depuis).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB') })}</p>}
      </div>
    </div>
  );
}

type Traducteur = ReturnType<typeof useLangue>['t'];

export function dureeCourte(ms: number, t: Traducteur): string {
  if (ms < 3_600_000) return t('garde.duree.min', { n: Math.max(1, Math.round(ms / 60_000)) });
  if (ms < 86_400_000) return t('garde.duree.h', { n: Math.round(ms / 3_600_000) });
  return t('garde.duree.j', { n: Math.round(ms / 86_400_000) });
}

export function JournalLigne({ entree, onMauvais }: { entree: GardeJournalEntree; onMauvais?: (id: string, note: string) => Promise<void> }) {
  const { t } = useLangue();
  const [ouvert, setOuvert] = useState(false);
  const [note, setNote] = useState('');
  const [fait, setFait] = useState<string | null>(null);
  const classe = entree.resultat === 'echec' ? 'text-danger' : entree.resultat === 'refuse' ? 'text-text-muted' : entree.resultat === 'remonte' ? 'text-warning' : 'text-text-secondary';
  return (
    <li className="flex flex-col gap-1 border-b border-border py-2 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-mono text-[10px] text-text-muted">{relativeTime(entree.createdAt)}</span>
        <span className={`font-mono text-[10px] uppercase tracking-wider ${classe}`}>{t(`garde.bureau.resultat.${entree.resultat}`)}</span>
        <span className="font-mono text-[10px] text-text-muted">{entree.agent}</span>
        <span className="text-[13px] text-text-primary">{entree.pourquoi || entree.action}</span>
        {entree.mauvais && <span className="font-mono text-[10px] uppercase tracking-wider text-danger">{t('garde.bureau.dejaMauvais')}</span>}
      </div>
      {entree.correction && <p className="text-[11px] text-text-muted">{t('garde.bureau.corrige', { texte: entree.correction.texte })}</p>}
      {fait && <p className="text-[11px] text-text-secondary">{fait}</p>}
      {onMauvais && !entree.mauvais && !fait && (
        ouvert ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); void onMauvais(entree.id, note).then(() => setFait(t('garde.bureau.mauvaisFait', { correction: '' }))); }}
          >
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('garde.bureau.mauvaisNote')} aria-label={t('garde.bureau.mauvaisNote')} className="input-focus min-w-0 flex-1 border border-border bg-bg px-2 py-1 text-xs text-text-primary outline-none" />
            <button type="submit" className="border border-danger/50 px-2 py-1 text-[11px] text-danger hover:bg-danger-muted">{t('garde.bureau.mauvais')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="px-2 py-1 text-[11px] text-text-muted">{t('garde.bureau.annuler')}</button>
          </form>
        ) : (
          <button type="button" onClick={() => setOuvert(true)} className="self-start text-[11px] text-text-muted underline-offset-2 hover:text-danger hover:underline">{t('garde.bureau.mauvais')}</button>
        )
      )}
    </li>
  );
}

/**
 * LA CONVERSATION avec un chef, ou avec toute la Garde : on écrit, il répond
 * avec ses preuves ; s'il manque une précision, il pose la question ; si
 * l'ordre modifie quelque chose, il demande confirmation avant de faire.
 */
export function Conversation({ envoyer, rapides = [], aide }: { envoyer: (texte: string, confirmer: boolean) => Promise<GardeOrdreReponse>; rapides?: string[]; aide?: string }) {
  const { t } = useLangue();
  const [texte, setTexte] = useState('');
  const [fil, setFil] = useState<{ de: 'moi' | 'garde'; texte: string; confirmation?: string; original?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const poser = async (quoi: string, confirmer = false) => {
    if (!quoi.trim() || busy) return;
    setBusy(true);
    setFil((f) => [...f, { de: 'moi', texte: quoi }]);
    setTexte('');
    try {
      const r = await envoyer(quoi, confirmer);
      const reponse = r.question ?? r.reponse;
      setFil((f) => [...f, { de: 'garde', texte: reponse, ...(r.confirmation ? { confirmation: r.confirmation, original: quoi } : {}) }]);
    } catch (err) {
      setFil((f) => [...f, { de: 'garde', texte: t('garde.erreur', { message: err instanceof Error ? err.message : String(err) }) }]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      {rapides.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rapides.map((r) => <button key={r} type="button" onClick={() => void poser(r)} disabled={busy} className="border border-border bg-bg px-2.5 py-1 text-xs text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-50">{r}</button>)}
        </div>
      )}
      {fil.length > 0 && (
        <ol className="flex flex-col gap-2" aria-live="polite">
          {fil.map((m, i) => (
            <li key={i} className={`max-w-[85%] whitespace-pre-line rounded-lg border px-3 py-2 text-[13px] leading-relaxed ${m.de === 'moi' ? 'self-end border-border-strong bg-bg text-text-primary' : 'self-start border-border bg-surface text-text-secondary'}`}>
              {m.texte}
              {m.confirmation && m.original && (
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => void poser(m.original as string, true)} className="border border-accent bg-accent px-2.5 py-1 text-xs font-medium text-bg">{t('garde.bureau.confirmer')}</button>
                  <button type="button" onClick={() => setFil((f) => [...f, { de: 'garde', texte: t('garde.bureau.annuler') }])} className="border border-border px-2.5 py-1 text-xs text-text-muted">{t('garde.bureau.annuler')}</button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <form className="flex flex-col gap-1" onSubmit={(e) => { e.preventDefault(); void poser(texte); }}>
        <div className="flex gap-2">
          <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={t('garde.bureau.question')} aria-label={t('garde.bureau.question')} className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-3 text-sm text-text-primary outline-none md:min-h-0 md:py-2" />
          <button type="submit" disabled={busy || !texte.trim()} className="min-h-11 border border-border-strong bg-surface px-3 text-sm font-medium text-text-primary hover:bg-surface-hover disabled:opacity-50 md:min-h-0">{t('garde.bureau.envoyer')}</button>
        </div>
        <p className="text-[11px] text-text-muted">{aide ?? t('garde.bureau.questionAide')}</p>
      </form>
    </div>
  );
}

export function AgentTuile({ agent, equipeKey, journal, onRafraichir }: { agent: GardeAgent; equipeKey: string; journal: GardeJournalEntree[]; onRafraichir: () => void }) {
  const { t } = useLangue();
  const [reponse, setReponse] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const etat = !agent.actif ? 'inactif' : agent.etat;
  const constats = journal.filter((e) => e.agent === agent.key).slice(0, 3);
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3" aria-label={agent.nom}>
      <div className="flex items-start gap-2">
        <EtatPoint etat={agent.etat} actif={agent.actif} size={9} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text-primary">{agent.nom}</p>
          <p className="truncate text-[11px] text-text-muted">{agent.role}</p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">{t(`garde.etat.${etat}`)}</span>
      </div>
      <p className="text-[13px] leading-snug text-text-secondary">{agent.phrase || t('garde.salle.rienRecent')}</p>
      <p className="font-mono text-[10px] text-text-muted">
        {t('garde.salle.derniere')} {agent.derniereRondeAt ? relativeTime(agent.derniereRondeAt) : t('garde.salle.jamais')} · {t('garde.salle.prochaine')} {agent.prochaineRondeAt ? relativeTime(agent.prochaineRondeAt) : '—'}
      </p>
      {constats.length > 0 && (
        <ul className="flex flex-col gap-0.5 border-t border-border pt-2">
          {constats.map((e) => <li key={e.id} className="truncate text-[11px] text-text-secondary" title={e.pourquoi}>{e.pourquoi || e.action}</li>)}
        </ul>
      )}
      {reponse && <p className="border-t border-border pt-2 text-[12px] text-text-primary">{reponse}</p>}
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <button type="button" disabled={busy} onClick={() => { setBusy(true); void garde.ronde(agent.key).then(() => onRafraichir()).finally(() => setBusy(false)); }} className="border border-border px-2 py-1 text-[11px] text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-50">{t('garde.salle.rondeMaintenant')}</button>
        <button type="button" disabled={busy} onClick={() => { setBusy(true); void garde.question(equipeKey, `tu fais quoi ${agent.nom}`).then((r) => setReponse(r.reponse)).finally(() => setBusy(false)); }} className="border border-border px-2 py-1 text-[11px] text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-50">{t('garde.salle.tuFaisQuoi')}</button>
      </div>
    </article>
  );
}
