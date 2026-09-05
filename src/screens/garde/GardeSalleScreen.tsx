import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StaggerGroup, StaggerItem } from '../../components/Stagger';
import { AgentTuile, PoulsBadge } from '../../components/garde/GardeUi';
import { garde } from '../../lib/garde';
import { relativeTime } from '../../lib/time';
import { useLangue } from '../../i18n';
import type { GardeAgent, GardeJournalEntree, GardeSalle } from '../../shared/garde';

/**
 * LA SALLE — le mur de la Garde.
 *
 * Un écran par agent, groupés par équipe : nom et rôle, état (lumière et
 * respiration), dernière et prochaine ronde, ce qu'il fait maintenant en une
 * phrase, ses constats récents. Tout vient du serveur et se met à jour par
 * les trames `garde:*` (présence, ronde, journal). Plein écran possible ; sur
 * téléphone, une équipe à la fois.
 */
export function GardeSalleScreen() {
  const { t } = useLangue();
  const [salle, setSalle] = useState<GardeSalle | null>(null);
  const [journal, setJournal] = useState<GardeJournalEntree[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [equipe, setEquipe] = useState<string>('toutes');
  const [plein, setPlein] = useState(false);

  const charger = useCallback(async () => {
    try {
      const [s, j] = await Promise.all([garde.salle(), garde.journal({ limit: 80 })]);
      setSalle(s);
      setJournal(j);
      setErreur(null);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    }
  }, []);
  useEffect(() => { void charger(); }, [charger]);
  useEffect(() => garde.onGarde((trame) => {
    if (trame.type === 'garde:presence') {
      setSalle((s) => s && ({ ...s, agents: s.agents.map((a) => (a.key === trame.agent ? { ...a, phrase: String(trame.phrase ?? a.phrase), etat: trame.actif ? 'ronde' : a.etat } : a)) }));
    } else if (trame.type === 'garde:journal' && trame.entree) {
      setJournal((j) => [trame.entree as GardeJournalEntree, ...j].slice(0, 120));
    } else if (['garde:ronde', 'garde:remontee', 'garde:remontee-resolue', 'garde:absence', 'garde:releve'].includes(trame.type)) {
      void charger();
    }
  }), [charger]);
  useEffect(() => {
    const onChange = () => setPlein(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const equipes = useMemo(() => (salle ? salle.equipes.filter((e) => equipe === 'toutes' || e.key === equipe) : []), [salle, equipe]);
  // Les collaborations se lisent à part : le journal des rondes les enterrerait en quelques minutes.
  const [collaborations, setCollaborations] = useState<GardeJournalEntree[]>([]);
  const chargerCollaborations = useCallback(async () => {
    try { setCollaborations((await garde.journal({ action: 'collaboration', limit: 24 })).filter((e) => /^demande à|refusée/.test(e.pourquoi)).slice(0, 6)); } catch { setCollaborations([]); }
  }, []);
  useEffect(() => { void chargerCollaborations(); }, [chargerCollaborations]);
  useEffect(() => garde.onGarde((trame) => { if (trame.type === 'garde:collaboration') void chargerCollaborations(); }), [chargerCollaborations]);
  const agentsParEquipe = useMemo(() => {
    const m = new Map<string, GardeAgent[]>();
    for (const a of salle?.agents ?? []) m.set(a.equipe, [...(m.get(a.equipe) ?? []), a]);
    return m;
  }, [salle]);

  return (
    <section className="flex flex-col gap-5" id="garde-salle">
      <ScreenHeader eyebrow={t('garde.surtitre')} title={t('garde.salle.titre')} description={t('garde.salle.description')} stats={salle ? [{ label: t('garde.salle.equipe'), value: salle.equipes.length }, { label: t('garde.pile.ouvertes'), value: salle.pouls.compte.ouvertes, emphasis: salle.pouls.compte.critiques > 0 }] : []}>
        <button
          type="button"
          onClick={() => { const el = document.getElementById('garde-salle'); if (document.fullscreenElement) void document.exitFullscreen(); else void el?.requestFullscreen?.(); }}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-[12px] font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
        >
          {plein ? <Minimize2 size={14} strokeWidth={1.75} /> : <Maximize2 size={14} strokeWidth={1.75} />}
          <span className="hidden sm:inline">{plein ? t('garde.salle.quitterPleinEcran') : t('garde.salle.pleinEcran')}</span>
        </button>
      </ScreenHeader>

      {erreur && <p role="alert" className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-text-primary">{t('garde.salle.indisponible')} ({erreur})</p>}
      {!salle && !erreur && <p className="font-mono text-xs text-text-muted">{t('garde.salle.chargement')}</p>}

      {salle && (
        <div className="flex flex-wrap items-center gap-3">
          <PoulsBadge pouls={salle.pouls} />
          {salle.priorite && <p className="text-[12px] text-text-secondary">« {salle.priorite.texte} » — {salle.priorite.par}</p>}
          <label className="ml-auto flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-text-muted md:hidden">
            {t('garde.salle.equipe')}
            <select value={equipe} onChange={(e) => setEquipe(e.target.value)} aria-label={t('garde.salle.equipe')} className="input-focus bg-bg px-2 py-1 text-[11px] normal-case tracking-normal text-text-primary outline-none">
              <option value="toutes">{t('garde.salle.toutes')}</option>
              {salle.equipes.map((e) => <option key={e.key} value={e.key}>{e.nom}</option>)}
            </select>
          </label>
        </div>
      )}

      {/* Les collaborations (Bloc 9) : un garde en sollicite un autre, le Capitaine arbitre et avance sa ronde — ou refuse, budget atteint, organisation gelée. */}
      {collaborations.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-3" aria-label={t('garde.salle.collaborations')} data-collaborations={collaborations.length}>
          <h2 className="mb-1 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.salle.collaborations')}</h2>
          <ol className="flex flex-col gap-0.5">
            {collaborations.map((e) => (
              <li key={e.id} className="text-[12px] text-text-secondary">
                <span className={`font-mono text-[10px] uppercase tracking-wider ${e.resultat === 'refuse' ? 'text-text-muted' : 'text-success'}`}>{e.resultat === 'refuse' ? t('garde.salle.refusee') : t('garde.salle.arbitree')}</span>
                <span className="text-text-muted"> · {relativeTime(e.createdAt)} · </span>
                <span className="text-text-primary">{e.agent}</span> — {e.pourquoi}
              </li>
            ))}
          </ol>
        </section>
      )}

      <StaggerGroup className="flex flex-col gap-5">
        {equipes.map((e) => (
          <StaggerItem key={e.key}>
            <section aria-label={e.nom} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{e.nom}</h2>
                <span className="truncate text-[11px] text-text-muted">{e.chef.nom} · {e.chef.role}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {(agentsParEquipe.get(e.key) ?? []).map((a) => <AgentTuile key={a.key} agent={a} equipeKey={e.key} journal={journal} onRafraichir={() => void charger()} />)}
              </div>
            </section>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}
