import React, { useState } from 'react';
import { useLangue } from '../../i18n';
import { relativeTime, dansTemps } from '../../lib/time';
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
export function Conversation({ envoyer, rapides = [], aide }: { envoyer: (texte: string, confirmer: boolean) => Promise<GardeOrdreReponse>; rapides?: (string | { label: string; texte: string })[]; aide?: string }) {
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
          {rapides.map((r) => (typeof r === 'string' ? { label: r, texte: r } : r)).map((r) => <button key={r.texte} title={r.texte} type="button" onClick={() => void poser(r.texte)} disabled={busy} className="border border-border bg-bg px-2.5 py-1 text-xs text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-50">{r.label}</button>)}
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
  /*
    UNE LIGNE PAR GARDE (Bloc 1 de l'Automatique). Vingt tuiles de même poids,
    chacune avec deux boutons et « Rien en cours ; je repasse à… », c'était la
    cantine. La ligne dit le point, le nom, sa phrase, et quand il repasse ;
    le détail (ses derniers constats, sa réponse) s'ouvre au clic ; les gestes
    n'apparaissent qu'au survol ou au clavier sur le poste — toujours visibles
    au doigt, où le survol n'existe pas.

    « Prochaine à l'instant » était un mensonge : une ronde due mais pas
    encore passée se dit « imminente », pas « à l'instant ».
  */
  const { t } = useLangue();
  const [reponse, setReponse] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const etat = !agent.actif ? 'inactif' : agent.etat;
  const constats = journal.filter((e) => e.agent === agent.key).slice(0, 3);
  const prochaine = agent.prochaineRondeAt ? dansTemps(agent.prochaineRondeAt) : '—';
  return (
    <li className="group border-b border-border last:border-b-0" data-agent={agent.key} data-etat={etat}>
      <div className="flex items-center gap-3 py-2">
        <EtatPoint etat={agent.etat} actif={agent.actif} size={8} />
        <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} className="min-w-0 flex-1 text-left">
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span className="text-[13px] font-medium text-text-primary">{agent.nom}</span>
            <span className="min-w-0 truncate text-[12px] text-text-secondary">{agent.phrase || t('garde.salle.rienRecent')}</span>
          </span>
        </button>
        <span className="hidden flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-muted sm:inline" title={`${t('garde.salle.derniere')} ${agent.derniereRondeAt ? relativeTime(agent.derniereRondeAt) : t('garde.salle.jamais')}`}>
          {etat === 'ronde' ? t('garde.etat.ronde') : `${t('garde.salle.prochaine')} ${prochaine}`}
        </span>
        <span className="flex flex-shrink-0 gap-1.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <button type="button" disabled={busy} onClick={() => { setBusy(true); void garde.ronde(agent.key).then(() => onRafraichir()).finally(() => setBusy(false)); }} className="min-h-8 border border-border px-2 text-[11px] text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-50">{t('garde.salle.rondeMaintenant')}</button>
          <button type="button" disabled={busy} onClick={() => { setBusy(true); setOuvert(true); void garde.question(equipeKey, `tu fais quoi ${agent.nom}`).then((r) => setReponse(r.reponse)).finally(() => setBusy(false)); }} className="min-h-8 border border-border px-2 text-[11px] text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-50">{t('garde.salle.tuFaisQuoi')}</button>
        </span>
      </div>
      {ouvert && (
        <div className="mb-2 ml-5 flex flex-col gap-1 text-[12px]">
          <p className="text-text-muted">{agent.role} · {t('garde.salle.derniere')} {agent.derniereRondeAt ? relativeTime(agent.derniereRondeAt) : t('garde.salle.jamais')}</p>
          {constats.map((e) => <p key={e.id} className="truncate text-text-secondary" title={e.pourquoi}>{e.pourquoi || e.action}</p>)}
          {reponse && <p className="text-text-primary">{reponse}</p>}
        </div>
      )}
    </li>
  );
}
