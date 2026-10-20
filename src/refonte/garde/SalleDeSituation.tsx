import React, { useEffect, useMemo, useState } from 'react';
import { EQUIPES_ORDRE } from '../../lib/garde';
import { useRemoteSites } from '../../state/RemoteSitesContext';
import { usePoulsDuParc } from '../../state/poulsDuParc';
import { useActiverSourceBureaux, useSourceBureaux } from '../../bureaux/donnees/source';
import { useMouvement } from '../../socle/mouvement';
import { Logo } from '../../components/Logo';
import { useGardeLangue } from './i18n';
import { useJournalGarde } from './donnees';
import { accentEquipe } from './equipes';
import { nomDEquipe } from './fil';
import { ResumeDeNuit } from './ResumeDeNuit';
import { FilDActivite } from './FilDActivite';
import {
  CX,
  CY,
  ETIREMENT,
  HAUTEUR,
  LARGEUR,
  R_CAPITAINE,
  R_ETIQUETTE,
  R_QUARTIER_EXT,
  R_SITES_MAX,
  R_SITES_MIN,
  cheminLien,
  cheminQuartier,
  phaseDe,
  placesDesSites,
  pointsDAgents,
  polaire,
  quartier,
} from './carte';

/**
 * LA SALLE DE SITUATION (S3) — ce qui remplace l'écran noir de veille.
 *
 * Une vue d'ensemble en 2D, dessinée en SVG : le Capitaine au centre, les
 * équipes de la Garde en quartiers autour, chaque garde un point ; au-delà,
 * les sites du parc ; entre les deux, des lignes discrètes qui disent quelle
 * équipe a travaillé sur quel site ces dernières heures. À côté, le résumé de
 * la nuit et le fil d'activité.
 *
 * Réservée à la veille et au Supervisor : jamais sur un écran de travail.
 * Aucune requête réseau pour l'affichage (pas de tuile, pas d'image) : les
 * seules données sont celles que l'app lit déjà (sites, pouls, Garde).
 *
 * Ce que la lumière dit :
 *   point d'équipe plein      garde en ronde (respire en mouvement complet)
 *   point d'équipe atténué    garde au repos ; creux : garde désactivée
 *   anneau jaune paille       garde en échec
 *   point de site blanc       site en ligne ; gris : hors ligne ; creux : jamais vu
 *   braise                    incident ouvert sur ce site (critique : plus grand)
 *   losange au bord d'un quartier   dossier ouvert de cette équipe (braise : critique)
 *
 * Mouvement : en « complet », les points en ronde et les sites respirent
 * (opacité seule) ; en « réduit » ou « aucun », la carte est une photographie.
 */
const FENETRE_LIENS_MS = 6 * 3_600_000;
const LIENS_MAX = 28;

export function SalleDeSituation({ enVeille = false }: { enVeille?: boolean }) {
  const { tg, tc, langue } = useGardeLangue();
  useActiverSourceBureaux();
  const src = useSourceBureaux();
  const { sites } = useRemoteSites();
  const pouls = usePoulsDuParc();
  const anime = useMouvement() === 'complet';
  const [depuis] = useState(() => new Date(Date.now() - FENETRE_LIENS_MS));
  const { journal } = useJournalGarde(depuis, 200);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const salle = src.salle;
  const cles = useMemo(() => [...EQUIPES_ORDRE, ...(salle?.equipes ?? []).map((e) => e.key).filter((k) => !(EQUIPES_ORDRE as readonly string[]).includes(k))], [salle]);

  const quartiers = useMemo(
    () =>
      cles.map((cle, i) => {
        const q = quartier(i, cles.length);
        const agents = (salle?.agents ?? []).filter((a) => a.equipe === cle);
        const dossiers = (src.accueil?.pile.dossiers ?? []).filter((d) => d.equipe === cle);
        return { cle, q, agents, points: pointsDAgents(agents.length, q.debut, q.fin), dossiers, accent: accentEquipe(cle) };
      }),
    [cles, salle, src.accueil],
  );

  const places = useMemo(() => placesDesSites(sites), [sites]);

  // Les lignes : une par (équipe, site) touchés dans la fenêtre, les plus récentes d'abord.
  const liens = useMemo(() => {
    const parId = new Map(places.map((x) => [x.site.id, x]));
    const parOrg = new Map<string, (typeof places)[number]>();
    for (const x of places) if (x.site.clientOrgId && !parOrg.has(x.site.clientOrgId)) parOrg.set(x.site.clientOrgId, x);
    const vus = new Set<string>();
    const out: { cle: string; d: string; couleur: string }[] = [];
    for (const j of [...journal].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      const ressource = j.ressource?.replace(/^site:/, '') ?? '';
      const cible = parId.get(ressource) ?? (j.orgId ? parOrg.get(j.orgId) : undefined);
      const q = quartiers.find((x) => x.cle === j.equipe);
      if (!cible || !q) continue;
      const cle = `${j.equipe}>${cible.site.id}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      out.push({ cle, d: cheminLien(polaire(R_QUARTIER_EXT, q.q.milieu), cible.p), couleur: q.accent.base });
      if (out.length >= LIENS_MAX) break;
    }
    return out;
  }, [journal, places, quartiers]);

  const horsLigne = sites.filter((s) => s.status === 'offline').length;
  const enLigne = sites.filter((s) => s.status === 'online').length;
  const dossiersOuverts = src.accueil?.pile.compte.dossiers ?? 0;
  const enEchec = salle?.pouls.enEchec.length ?? 0;

  const verdict = useMemo((): { texte: string; ton: 'critique' | 'serieux' | 'calme' } => {
    if (pouls.critiques > 0) return { texte: tc('salle.critiques', pouls.critiques), ton: 'critique' };
    const critiquesPile = src.accueil?.pile.compte.critiques ?? 0;
    if (critiquesPile > 0) return { texte: tc('resume.critique', critiquesPile), ton: 'critique' };
    if (horsLigne > 0) return { texte: tc('salle.horsLigne', horsLigne), ton: 'serieux' };
    if (enEchec > 0) return { texte: tc('fil.echec', enEchec), ton: 'serieux' };
    if (dossiersOuverts > 0) return { texte: tc('resume.decision', dossiersOuverts), ton: 'serieux' };
    if (!salle && sites.length === 0) return { texte: tg('salle.attente'), ton: 'calme' };
    return { texte: tg('salle.calme'), ton: 'calme' };
  }, [pouls.critiques, src.accueil, horsLigne, enEchec, dossiersOuverts, salle, sites.length, tc, tg]);

  const heure = now.toLocaleTimeString(langue === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className={`relative w-full overflow-hidden bg-socle-creux text-socle-texte ${enVeille ? 'h-full' : 'h-[78vh] min-h-[520px] rounded-[2px] border border-socle-bord'}`}>
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_minmax(0,1fr)]">
        {/* L'en-tête : l'heure, la date, le verdict. */}
        <header className="flex items-end justify-between gap-6 px-6 pt-6 lg:col-span-2 lg:px-10 lg:pt-8">
          <div>
            {enVeille && (
              <div className="mb-4 opacity-40">
                <Logo height={22} />
              </div>
            )}
            <p className="font-mono text-5xl font-light tabular-nums tracking-tight text-socle-texte sm:text-6xl">{heure}</p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.28em] text-socle-texte-discret">{date}</p>
          </div>
          <div className="max-w-[46ch] text-right">
            <p className={`text-[17px] font-medium leading-snug ${verdict.ton === 'critique' ? 'text-danger-ink' : verdict.ton === 'serieux' ? 'text-socle-texte' : 'text-socle-texte-doux'}`}>{verdict.texte}</p>
            {sites.length > 0 && (
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-socle-texte-discret">
                {tg('salle.enLigne', { n: enLigne })}
                <span className="mx-2 text-socle-bord-fort">·</span>
                {tg('salle.horsLigneCompte', { n: horsLigne })}
                {pouls.ouverts > 0 && (
                  <>
                    <span className="mx-2 text-socle-bord-fort">·</span>
                    {tc('salle.incidents', pouls.ouverts)}
                  </>
                )}
              </p>
            )}
          </div>
        </header>

        {/* La carte. */}
        <div className="relative min-h-0 px-2 lg:px-6">
          <svg viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full" role="img" aria-label={tg('salle.carte')}>
            {/* Le fond de carte : anneaux et rayons, à peine visibles. */}
            <g fill="none" stroke="var(--color-socle-bord)" strokeWidth={1}>
              {[R_SITES_MIN - 14, (R_SITES_MIN + R_SITES_MAX) / 2, R_SITES_MAX + 14].map((r) => (
                <ellipse key={r} cx={CX} cy={CY} rx={r * ETIREMENT} ry={r} strokeDasharray="2 6" opacity={0.7} />
              ))}
              {quartiers.map(({ cle, q }) => {
                const a = polaire(R_QUARTIER_EXT + 8, q.debut - 2.5);
                const b = polaire(R_SITES_MAX + 14, q.debut - 2.5);
                return <line key={cle} x1={a.x} y1={a.y} x2={b.x} y2={b.y} opacity={0.45} />;
              })}
            </g>

            {/* Les lignes : qui a travaillé où, ces six dernières heures. */}
            <g fill="none" strokeWidth={1} strokeLinecap="round">
              {liens.map((l) => (
                <path key={l.cle} d={l.d} stroke={l.couleur} opacity={0.32} />
              ))}
            </g>

            {/* Les sites. */}
            <g>
              {places.map(({ site, p }) => {
                const incident = pouls.enIncident.get(site.id);
                if (incident) {
                  return (
                    <circle
                      key={site.id}
                      cx={p.x}
                      cy={p.y}
                      r={incident === 'critical' ? 5 : 3.5}
                      fill="var(--color-braise)"
                      stroke={incident === 'critical' ? 'var(--color-etat-danger)' : undefined}
                      strokeWidth={1}
                      opacity={incident === 'critical' ? 1 : 0.75}
                      className={anime ? (incident === 'critical' ? 'sv-souffle-tendu' : 'sv-souffle-calme') : undefined}
                      style={anime ? { animationDelay: `-${phaseDe(site.id)}ms` } : undefined}
                    />
                  );
                }
                if (site.status === 'online')
                  return <circle key={site.id} cx={p.x} cy={p.y} r={2.4} fill="var(--color-socle-texte)" className={anime ? 'sv-souffle-calme' : undefined} style={anime ? { animationDelay: `-${phaseDe(site.id)}ms` } : { opacity: 0.85 }} />;
                if (site.status === 'offline') return <circle key={site.id} cx={p.x} cy={p.y} r={2.4} fill="var(--color-socle-bord-fort)" />;
                return <circle key={site.id} cx={p.x} cy={p.y} r={2.4} fill="none" stroke="var(--color-socle-bord-fort)" />;
              })}
            </g>

            {/* Les quartiers de la Garde. */}
            {quartiers.map(({ cle, q, agents, points, dossiers, accent }) => {
              const etiquette = polaire(R_ETIQUETTE, q.milieu);
              const droite = Math.cos((q.milieu * Math.PI) / 180) >= 0.15;
              const gauche = Math.cos((q.milieu * Math.PI) / 180) <= -0.15;
              return (
                <g key={cle}>
                  <path d={cheminQuartier(q.debut, q.fin)} fill={accent.base} fillOpacity={0.08} stroke={accent.base} strokeOpacity={0.35} strokeWidth={1} />
                  {points.map((pt, k) => {
                    const a = agents[k];
                    const ronde = a.actif && a.etat === 'ronde';
                    if (!a.actif) return <circle key={a.key} cx={pt.x} cy={pt.y} r={4} fill="none" stroke={accent.base} strokeOpacity={0.6} />;
                    if (a.etat === 'echec')
                      return <circle key={a.key} cx={pt.x} cy={pt.y} r={5.5} fill="var(--color-socle-creux)" stroke="var(--color-etat-attention)" strokeWidth={2} />;
                    return (
                      <circle
                        key={a.key}
                        cx={pt.x}
                        cy={pt.y}
                        r={ronde ? 5.5 : 4}
                        fill={accent.base}
                        opacity={ronde || a.etat === 'trouve' ? 1 : 0.45}
                        className={ronde && anime ? 'sv-souffle-calme' : undefined}
                        style={ronde && anime ? { animationDelay: `-${phaseDe(a.key)}ms` } : undefined}
                      />
                    );
                  })}
                  {dossiers.slice(0, 5).map((d, k) => {
                    const p = polaire(R_QUARTIER_EXT + 10, q.debut + 4 + k * 5);
                    const critique = d.gravite === 'critique';
                    return <rect key={d.id} x={p.x - 3.5} y={p.y - 3.5} width={7} height={7} transform={`rotate(45 ${p.x} ${p.y})`} fill={critique ? 'var(--color-braise)' : 'none'} stroke={critique ? 'var(--color-etat-danger)' : accent.base} strokeWidth={1.2} />;
                  })}
                  <text
                    x={etiquette.x}
                    y={etiquette.y}
                    textAnchor={droite ? 'start' : gauche ? 'end' : 'middle'}
                    dominantBaseline="middle"
                    fill={accent.texte}
                    style={{ font: '600 13px var(--font-sans, system-ui)' }}
                  >
                    {nomDEquipe(cle, salle?.equipes ?? [], langue)}
                  </text>
                </g>
              );
            })}

            {/* Le Capitaine. */}
            <circle cx={CX} cy={CY} r={R_CAPITAINE} fill="var(--color-socle-surface)" stroke="var(--color-socle-bord-fort)" strokeWidth={1} />
            <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" fill="var(--color-socle-texte-doux)" style={{ font: '500 10px var(--font-mono, ui-monospace)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {tg('salle.capitaine')}
            </text>
          </svg>
        </div>

        {/* Le résumé et le fil. */}
        <aside className="min-h-0 space-y-6 overflow-hidden border-t border-socle-bord px-6 py-5 lg:border-l lg:border-t-0 lg:px-7 lg:py-2">
          <ResumeDeNuit compact />
          <FilDActivite compact />
        </aside>
      </div>

      {enVeille && (
        <p className="pointer-events-none absolute bottom-4 left-0 right-0 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-socle-texte-discret">{tg('salle.reprendre')}</p>
      )}
    </div>
  );
}
