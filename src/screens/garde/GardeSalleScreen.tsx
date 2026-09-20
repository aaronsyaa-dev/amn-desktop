import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useHaloSignal } from '../../components/EtatEcran';
import { AgentTuile, PoulsBadge, dureeCourte } from '../../components/garde/GardeUi';
import { garde, retardDeRonde, SILENCE_DEFAUT, domaineDEquipe } from '../../lib/garde';
import { relativeTime, dansTemps } from '../../lib/time';
import { serieFluxComptee } from '../../lib/serieVitale';
import { useLangue } from '../../i18n';
import type { GardeAgent, GardeCalendrierItem, GardeJournalEntree, GardeSalle } from '../../shared/garde';

/**
 * LA SALLE — le mur des lumières.
 *
 * Les vingt gardes sont un mur de cases en sept colonnes, une colonne par
 * équipe. Une garde AU REPOS est une plaque fine de 26 px : pastille éteinte,
 * nom, rien d'autre. Une garde EN RONDE grandit à 86 px, sa pastille bat, et
 * sa case s'ouvre pour écrire ce qu'elle fait *maintenant* en une phrase.
 *
 * Le mur change donc de forme au fil de la nuit, et un coup d'œil dit où la
 * Garde travaille sans lire un mot. C'est tout l'argument du module : une
 * liste de vingt lignes de même poids ne l'aurait pas dit.
 *
 * L'AMBRE, unique : la garde dont la ronde a manqué son heure — sa case, sa
 * pastille, son nom et son retard. Quatre nœuds dans UNE case.
 */

/** Une garde en ronde : sa case s'ouvre pour dire ce qu'elle fait. */
const RONDE_H = 86;
/** Une garde au repos : une plaque fine, le nom suffit. */
const REPOS_H = 26;
/** Ce que le Capitaine appelle « cette nuit » — `capitaine.js`, clôture du soir : le calendrier du jour, coupé à douze heures. */
const NUIT_MS = 12 * 3_600_000;

export function GardeSalleScreen() {
  const { t, langue } = useLangue();
  const [salle, setSalle] = useState<GardeSalle | null>(null);
  const [journal, setJournal] = useState<GardeJournalEntree[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  /* L'équipe regardée hier est l'équipe regardée aujourd'hui : le filtre se souvient, personne ne le rechoisit à chaque ouverture. */
  const [equipe, setEquipeBrut] = useState<string>(() => { try { return window.localStorage.getItem('amn.garde.salle.equipe') || 'toutes'; } catch { return 'toutes'; } });
  const setEquipe = (e: string) => { setEquipeBrut(e); try { window.localStorage.setItem('amn.garde.salle.equipe', e); } catch { /* sans mémoire locale, le filtre repart de « toutes » */ } };
  const [plein, setPlein] = useState(false);
  const [regardee, setRegardee] = useState<string | null>(null);
  /* Un retard se creuse tout seul : sans battement d'horloge, le mur resterait à l'heure de son chargement toute la nuit. */
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => { const id = window.setInterval(() => setMaintenant(Date.now()), 30_000); return () => window.clearInterval(id); }, []);

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

  /* Les chiffres à mémoire : « ouvertes » est un stock sans historique (nombre seul) ; les remontées et ce que la Garde a réglé seule sont des flux, comptés par jour côté serveur. */
  const stats = useMemo(() => {
    if (!salle) return [];
    const now = new Date();
    const remontees = salle.series ? serieFluxComptee(salle.series.remontees, 7, now) : undefined;
    const reglees = salle.series ? serieFluxComptee(salle.series.reglees, 7, now) : undefined;
    return [
      { label: t('garde.pile.ouvertes'), value: salle.pouls.compte.ouvertes, emphasis: salle.pouls.compte.critiques > 0 },
      { label: t('garde.salle.remontees7'), value: remontees?.delta ?? '—', brut: remontees?.delta, serie: remontees, title: t('garde.salle.remontees7.aide') },
      { label: t('garde.salle.reglees7'), value: reglees?.delta ?? '—', brut: reglees?.delta, serie: reglees, title: t('garde.salle.reglees7.aide') },
    ];
  }, [salle, t]);

  const equipes = useMemo(() => (salle ? salle.equipes.filter((e) => equipe === 'toutes' || e.key === equipe) : []), [salle, equipe]);
  // Les collaborations se lisent à part : le journal des rondes les enterrerait en quelques minutes.
  const [collaborations, setCollaborations] = useState<GardeJournalEntree[]>([]);
  const chargerCollaborations = useCallback(async () => {
    try { setCollaborations((await garde.journal({ action: 'collaboration', limit: 24 })).filter((e) => /^demande à|refusée/.test(e.pourquoi)).slice(0, 6)); } catch { setCollaborations([]); }
  }, []);
  useEffect(() => { void chargerCollaborations(); }, [chargerCollaborations]);
  useEffect(() => garde.onGarde((trame) => { if (trame.type === 'garde:collaboration') void chargerCollaborations(); }), [chargerCollaborations]);

  /* Ce que la Garde fera cette nuit, compté comme le Capitaine le compte à la clôture du soir : le calendrier d'un jour, coupé à douze heures. Le poste ne refait pas le calcul autrement. */
  const [nuit, setNuit] = useState<GardeCalendrierItem[] | null>(null);
  useEffect(() => {
    let vivant = true;
    void garde.calendrier(1)
      .then((items) => { if (vivant) setNuit(items.filter((i) => Date.parse(i.at) <= Date.now() + NUIT_MS)); })
      .catch(() => { if (vivant) setNuit(null); });
    return () => { vivant = false; };
  }, []);

  const agentsParEquipe = useMemo(() => {
    const m = new Map<string, GardeAgent[]>();
    for (const a of salle?.agents ?? []) m.set(a.equipe, [...(m.get(a.equipe) ?? []), a]);
    return m;
  }, [salle]);

  /*
    LE RETARD — tranché par la formule du Capitaine (`retardDeRonde`), pas par
    une tolérance inventée ici. Plusieurs gardes peuvent manquer leur heure la
    même nuit ; l'ambre n'en prend qu'UNE, la plus en retard. Les autres
    restent des cases hautes ordinaires, et la ligne de pied les compte : en
    ambrer trois ferait un rapport là où il faut une chose à savoir.
  */
  const retards = useMemo(() => {
    const liste = (salle?.agents ?? [])
      .map((a) => ({ agent: a, retardMs: retardDeRonde(a, maintenant) }))
      .filter((r): r is { agent: GardeAgent; retardMs: number } => r.retardMs !== null)
      .sort((a, b) => b.retardMs - a.retardMs);
    return { liste, ambre: liste[0] ?? null };
  }, [salle, maintenant]);
  const halo = useHaloSignal(retards.ambre !== null);

  const heureDe = (iso: string) => new Date(iso).toLocaleTimeString(langue === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  /* Le journal nomme les gardes par leur clé (`sites.disponibilite`) ; l'écran, lui, les nomme comme le mur les nomme. */
  const nomDeGarde = (cle: string) => (salle?.agents ?? []).find((a) => a.key === cle)?.nom ?? cle;
  const agentRegarde = (salle?.agents ?? []).find((a) => a.key === regardee) ?? null;
  const equipeDe = (key: string) => salle?.equipes.find((e) => e.key === key) ?? null;

  return (
    <section className="flex flex-col gap-5" id="garde-salle">
      <ScreenHeader eyebrow={t('garde.surtitre')} title={t('garde.salle.titre')} description={t('garde.salle.description')} stats={stats}>
        <button
          type="button"
          onClick={() => { const el = document.getElementById('garde-salle'); if (document.fullscreenElement) void document.exitFullscreen(); else void el?.requestFullscreen?.(); }}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-[12px] font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
        >
          {plein ? <Minimize2 size={14} strokeWidth={1.9} /> : <Maximize2 size={14} strokeWidth={1.9} />}
          <span className="hidden sm:inline">{plein ? t('garde.salle.quitterPleinEcran') : t('garde.salle.pleinEcran')}</span>
        </button>
      </ScreenHeader>

      {erreur && <p role="alert" className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-text-primary">{t('garde.salle.indisponible')} ({erreur})</p>}
      {!salle && !erreur && <p className="font-mono text-xs text-text-muted">{t('garde.salle.chargement')}</p>}

      {salle && (
        <div className="flex flex-wrap items-center gap-3">
          <PoulsBadge pouls={salle.pouls} />
          {salle.priorite && <p className="text-[12px] text-text-secondary">« {salle.priorite.texte} » — {salle.priorite.par}</p>}
          <label className="ml-auto flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {t('garde.salle.equipe')}
            <select value={equipe} onChange={(e) => setEquipe(e.target.value)} aria-label={t('garde.salle.equipe')} className="input-focus bg-bg px-2 py-1 text-[11px] normal-case tracking-normal text-text-primary outline-none">
              <option value="toutes">{t('garde.salle.toutes')}</option>
              {salle.equipes.map((e) => <option key={e.key} value={e.key}>{e.nom}</option>)}
            </select>
          </label>
        </div>
      )}

      {/* ═══ L'OBJET DOMINANT : le mur, sept colonnes, vingt cases ═══ */}
      {salle && (
        <article className="border border-border-raised bg-elevated px-5 py-6 sm:px-7" data-mur={salle.agents.length}>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.salle.mur')}</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{t('garde.salle.murLegende')}</span>
          </div>

          <div className="flex items-start gap-2.5 overflow-x-auto pb-1">
            {equipes.map((e) => {
              const tous = agentsParEquipe.get(e.key) ?? [];
              /*
                Ce qui parle pour rien ne prend pas de place sur le mur. Une
                garde au repos sans constat récent se range sous « n au repos ·
                prochaine dans X » ; une équipe entièrement au repos tient en
                UNE ligne — sa colonne garde sa tête, pas ses vingt-six pixels
                par garde.
              */
              const parle = (a: GardeAgent) => a.etat !== 'repos' || !a.actif || journal.some((j) => j.agent === a.key);
              /*
                UNE CASE HAUTE EST UNE GARDE QUI A QUELQUE CHOSE À DIRE MAINTENANT.
                `etat === 'ronde'` ne dure que le temps d'une ronde — quelques
                millisecondes toutes les vingt secondes : un mur qui ne grandirait
                que là serait plat en permanence, et l'instrument ne dirait rien.
                Les états qui PARLENT sont `ronde`, `trouve` et `echec` — plus le
                retard, qui parle plus fort que tous.
              */
              const hautes = tous.filter((a) => a.actif && (a.etat !== 'repos' || retardDeRonde(a, maintenant) !== null));
              const fines = tous.filter((a) => !hautes.includes(a) && parle(a));
              const muettes = tous.filter((a) => !hautes.includes(a) && !parle(a));
              const prochaine = muettes.map((a) => a.prochaineRondeAt).filter((x): x is string => Boolean(x)).sort()[0];
              const resume = prochaine
                ? t('garde.salle.equipeAuRepos', { n: muettes.length, quand: dansTemps(prochaine, maintenant) })
                : t('garde.salle.equipeAuReposSansSuite', { n: muettes.length });
              return (
                <div key={e.key} className="flex min-w-[72px] flex-1 flex-col gap-[5px]" data-equipe={e.key} data-hautes={hautes.length}>
                  <span className="border-b border-border-raised pb-2">
                    <span className="block truncate font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-text-secondary" title={e.nom}>{domaineDEquipe(e.nom)}</span>
                    <span className="mt-[3px] block truncate font-mono text-[9px] text-text-muted" title={e.chef.role}>{e.chef.nom}</span>
                  </span>

                  {hautes.map((a) => {
                    const retardMs = retardDeRonde(a, maintenant);
                    const ambre = retards.ambre?.agent.key === a.key;
                    const groupe = ambre ? 'ronde-manquee' : undefined;
                    return (
                      <button
                        key={a.key}
                        type="button"
                        onClick={() => setRegardee((k) => (k === a.key ? null : a.key))}
                        data-agent={a.key}
                        data-etat={retardMs !== null ? 'retard' : a.etat}
                        data-signal-groupe={groupe}
                        style={{ minHeight: RONDE_H }}
                        className={
                          ambre
                            ? `flex flex-col items-start px-3 py-[11px] text-left bg-signal text-signal-ink ${halo}`
                            : 'flex flex-col items-start border border-border-strong bg-surface-hover px-3 py-[11px] text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]'
                        }
                      >
                        <span className="flex items-center gap-[7px]" data-signal-groupe={groupe}>
                          <span
                            aria-hidden
                            data-signal-groupe={groupe}
                            className={`h-[5px] w-[5px] flex-none rounded-full ${ambre ? 'bg-signal-ink anneau-courant-encre' : 'bg-accent anneau-courant'}`}
                          />
                          {/* Le surtitre dit l'état RÉEL : « a trouvé » n'est pas « en ronde », et le confondre ferait mentir le mur. */}
                          <span className={`font-mono text-[9px] font-bold uppercase tracking-[0.14em] ${ambre ? 'opacity-75' : 'text-text-muted'}`}>
                            {retardMs !== null ? t('garde.salle.rondeManquee') : t(`garde.etat.${a.etat}` as const)}
                          </span>
                        </span>
                        <span data-signal-groupe={groupe} className={`mt-1.5 text-[12.5px] font-semibold leading-tight [text-wrap:pretty] ${ambre ? '' : 'text-text-primary'}`}>{a.nom}</span>
                        <span data-signal-groupe={groupe} className={`mt-auto pt-[7px] text-[11.5px] leading-snug [text-wrap:pretty] ${ambre ? 'opacity-85' : 'text-text-secondary'}`}>
                          {retardMs !== null && a.prochaineRondeAt
                            ? t('garde.salle.attendueA', { heure: heureDe(a.prochaineRondeAt), duree: dureeCourte(retardMs, t) })
                            : a.phrase || t('garde.salle.rienRecent')}
                        </span>
                      </button>
                    );
                  })}

                  {fines.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => setRegardee((k) => (k === a.key ? null : a.key))}
                      data-agent={a.key}
                      data-etat={a.actif ? a.etat : 'inactif'}
                      style={{ minHeight: REPOS_H }}
                      className="flex items-center gap-2 border border-border bg-sheet px-2.5 py-[7px] text-left"
                    >
                      <span aria-hidden className="h-1 w-1 flex-none rounded-full bg-border-strong" />
                      <span className="min-w-0 flex-1 truncate text-[11.5px] text-text-muted">{a.nom}</span>
                    </button>
                  ))}

                  {muettes.length > 0 && (
                    <details data-repos={muettes.length}>
                      <summary title={resume} style={{ minHeight: REPOS_H }} className="flex cursor-pointer list-none items-center border border-border bg-sunken px-2.5 py-[7px] font-mono text-[9.5px] uppercase tracking-wider text-text-muted">
                        <span className="min-w-0 truncate">{resume}</span>
                      </summary>
                      <div className="mt-[5px] flex flex-col gap-[5px]">
                        {muettes.map((a) => (
                          <button
                            key={a.key}
                            type="button"
                            onClick={() => setRegardee((k) => (k === a.key ? null : a.key))}
                            data-agent={a.key}
                            data-etat={a.actif ? a.etat : 'inactif'}
                            style={{ minHeight: REPOS_H }}
                            className="flex items-center gap-2 border border-border bg-sheet px-2.5 py-[7px] text-left"
                          >
                            <span aria-hidden className="h-1 w-1 flex-none rounded-full bg-border-strong" />
                            <span className="min-w-0 flex-1 truncate text-[11.5px] text-text-muted">{a.nom}</span>
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>

          {/* Le pied de la carte dominante : ce que le mur vient de dire, et le seul geste qui y répond. */}
          <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-border-raised pt-5">
            <p className="min-w-[16rem] flex-1 text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">
              {retards.ambre
                ? <>
                    {t('garde.salle.retardPhrase', { nom: retards.ambre.agent.nom, duree: dureeCourte(retards.ambre.retardMs, t) })}
                    {retards.liste.length > 1 && <> {t('garde.salle.autresRetards', { n: retards.liste.length - 1 })}</>}
                  </>
                : t('garde.salle.toutALHeure')}
            </p>
            {retards.ambre && (
              <button
                type="button"
                onClick={() => { const cle = retards.ambre?.agent.key; if (cle) void garde.ronde(cle).then(() => charger()); }}
                className="flex h-[30px] flex-none items-center border border-border-strong px-3.5 text-[12.5px] font-semibold text-text-body hover:bg-surface-hover"
              >
                {t('garde.salle.rondeMaintenant')}
              </button>
            )}
          </div>
        </article>
      )}

      {/* La garde regardée : son rôle, sa dernière ronde, ses constats, et les deux gestes. Le mur dit l'état, cette ligne dit le détail. */}
      {agentRegarde && (
        <section aria-label={t('garde.salle.regardee')} className="border border-border bg-surface px-3">
          <ul>
            <AgentTuile agent={agentRegarde} equipeKey={equipeDe(agentRegarde.equipe)?.key ?? agentRegarde.equipe} journal={journal} onRafraichir={() => void charger()} />
          </ul>
        </section>
      )}

      {salle && (
        <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Les collaborations (Bloc 9) : un garde en sollicite un autre, le Capitaine arbitre et avance sa ronde — ou refuse, budget atteint, organisation gelée. */}
          <section className="min-w-0 border border-border bg-surface px-5 py-5" aria-label={t('garde.salle.collaborations')} data-collaborations={collaborations.length}>
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.salle.collaborations')}</h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{t('garde.salle.collabLegende')}</span>
            </div>
            {collaborations.length === 0 ? (
              <p className="text-[13px] text-text-muted">{t('garde.salle.rienRecent')}</p>
            ) : (
              <ol>
                {collaborations.map((e) => (
                  /* Deux rangs, pas quatre colonnes : un motif de collaboration est une phrase, et une colonne de 130 px la rendrait mot à mot. */
                  <li key={e.id} className="border-b border-border-row py-2.5 last:border-b-0">
                    <span className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
                      <span className={`font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] ${e.resultat === 'refuse' ? 'text-text-muted' : 'text-text-secondary'}`}>
                        {e.resultat === 'refuse' ? t('garde.salle.refusee') : t('garde.salle.arbitree')}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-text-muted">{relativeTime(e.createdAt)}</span>
                      <span className="text-[13px] text-text-primary">{nomDeGarde(e.agent)}</span>
                    </span>
                    <span className="mt-1 block text-[12.5px] leading-snug text-text-secondary [text-wrap:pretty]">{e.pourquoi}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="flex flex-col border border-border bg-surface px-5 py-5" aria-label={t('garde.salle.cetteNuit')}>
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.salle.cetteNuit')}</h2>
            <div className="mt-[18px] flex flex-col gap-4">
              {/* Le nombre de rondes ne s'invente pas : il vient du calendrier du serveur. Tant qu'il n'est pas là, la place reste muette plutôt que d'annoncer zéro. */}
              {nuit !== null && (
                <span>
                  <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">{t('garde.salle.rondesPrevues')}</span>
                  <span className="mt-1.5 block font-mono text-[19px] font-semibold tabular-nums tracking-tight text-text-primary">{nuit.length}</span>
                </span>
              )}
              <span>
                <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">{t('garde.salle.silence')}</span>
                <span className="mt-1.5 block font-mono text-[19px] font-semibold tabular-nums tracking-tight text-text-primary">
                  {`${(salle.reglages.silence ?? SILENCE_DEFAUT).de} h → ${(salle.reglages.silence ?? SILENCE_DEFAUT).a} h`}
                </span>
              </span>
              <span>
                <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">{t('garde.salle.sauf')}</span>
                <span className="mt-1.5 block font-mono text-[19px] font-semibold tracking-tight text-text-primary">{t('garde.salle.sauf.valeur')}</span>
              </span>
            </div>
            <p className="mt-auto pt-[18px] text-[13px] leading-relaxed text-text-secondary">{t('garde.salle.filtreMemoire')}</p>
          </section>
        </div>
      )}
    </section>
  );
}
