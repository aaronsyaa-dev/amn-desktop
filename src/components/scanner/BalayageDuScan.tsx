import React, { useMemo } from 'react';
import { useHaloSignal } from '../EtatEcran';
import { SEVERITY_LABEL, SEVERITY_ORDER, TIER_BLURB, TIER_LABEL, scoreColor } from '../../lib/scanSeverity';
import type { Scan, ScanFinding, ScanProgress, ScanResults, ScanTier } from '../../shared/api';

/**
 * PRODUITS · SCANNER — le balayage.
 *
 * L'analyse n'est pas une barre de progression : c'est un BALAYAGE. Les
 * familles de vérification sont une piste, un trait de tête avance dessus, et
 * ce qui est trouvé TOMBE EN DESSOUS, à l'abscisse de la famille qui l'a
 * trouvé, relié par une ligne de rappel. On ne regarde pas un pourcentage
 * monter, on regarde une analyse travailler — et l'on peut agir sur une
 * trouvaille sans attendre la fin.
 *
 * L'AMBRE, unique : le SCORE, seul verdict du module — sa plaque, son surtitre,
 * sa valeur. Trois nœuds.
 *
 * LE ROUGE COEXISTE AVEC L'AMBRE SANS LE CONCURRENCER. Il est réservé au
 * critique, et à lui seul : c'est la discipline du produit, et c'est ce qui
 * rend une vraie trouvaille critique reconnaissable dans une liste de quarante
 * lignes. L'ambre est le verdict ; le rouge est un état de fait.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LA PISTE PORTE LES FAMILLES DE VÉRIFICATION, PAS SOIXANTE CASES
 *
 * La direction décrit « les soixante vérifications du palier » en abscisse, et
 * des trouvailles qui tombent au fur et à mesure. Ce que le produit rend est
 * autre chose, et c'est lui qui fait foi :
 *
 *   · `ScanProgress` porte un `pct` et un `step` en clair — AUCUNE liste de
 *     vérifications, aucun index de la vérification en cours. Dessiner soixante
 *     cases aurait inventé une granularité que le serveur n'annonce pas.
 *   · Une trouvaille porte sa `category` — transport, headers, cookies,
 *     disclosure, email, cms, cve, injection, xss, ports, exposure. C'EST la
 *     graduation réelle de la piste, et l'abscisse d'une trouvaille s'en déduit
 *     sans rien supposer.
 *   · Les trouvailles n'arrivent PAS en flux : elles viennent toutes avec la
 *     trame terminale `done`. Pendant l'analyse, la tête avance et la piste
 *     reste nue ; c'est ce que le serveur permet de montrer, et l'écran ne
 *     fait pas semblant d'en savoir plus.
 *
 * L'ANALYSE TOURNE SUR LE SERVEUR : fermer l'écran ne l'arrête pas, et c'est
 * dit sous la piste plutôt que laissé à deviner.
 */

/**
 * L'ordre de la piste : celui que `ScanFinding.category` documente. Il ne se
 * réordonne pas au gré des trouvailles — une piste dont les graduations
 * bougent ne serait plus une piste.
 */
const FAMILLES: { cle: string; nom: string }[] = [
  { cle: 'transport', nom: 'Transport' },
  { cle: 'headers', nom: 'En-têtes' },
  { cle: 'cookies', nom: 'Cookies' },
  { cle: 'disclosure', nom: 'Divulgation' },
  { cle: 'email', nom: 'Email' },
  { cle: 'cms', nom: 'CMS' },
  { cle: 'cve', nom: 'CVE' },
  { cle: 'injection', nom: 'Injection' },
  { cle: 'xss', nom: 'XSS' },
  { cle: 'ports', nom: 'Ports' },
  { cle: 'exposure', nom: 'Exposition' },
];

/** La géométrie du balayage. Rien n'est posé au pixel près ailleurs. */
const PISTE_H = 34;
const CHUTE_H = 118;
/** La hauteur d'un rang de trouvailles sous la piste : deux trouvailles voisines ne se superposent pas. */
const RANG_H = 26;

/** Le recalage d'une étiquette selon sa place sur la piste : à gauche, au milieu, à droite. */
const bord = (x: number) => (x < 18 ? '' : x > 82 ? '-translate-x-full' : '-translate-x-1/2');

const abscisse = (cle: string) => {
  const i = FAMILLES.findIndex((f) => f.cle === cle);
  const rang = i < 0 ? FAMILLES.length - 1 : i;
  /* Au MILIEU de la graduation : une trouvaille appartient à sa famille, pas à la frontière. */
  return ((rang + 0.5) / FAMILLES.length) * 100;
};

export function BalayageDuScan({ scan, progress }: { scan: Scan | null; progress: ScanProgress | null }) {
  const lecture = useMemo(() => {
    const results = (scan?.results ?? null) as ScanResults | null;
    const trouvailles = results && Array.isArray(results.findings) ? results.findings : [];
    /* Les plus graves d'abord, et à rang égal dans l'ordre de la piste : la chute se lit de gauche à droite. */
    const rangees = [...trouvailles].sort(
      (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || abscisse(a.category) - abscisse(b.category),
    );
    const critiques = trouvailles.filter((f) => f.severity === 'critical').length;
    return { trouvailles: rangees, critiques };
  }, [scan]);

  const { trouvailles, critiques } = lecture;
  const enCours = progress !== null && progress.status !== 'done' && progress.status !== 'error';
  const score = scan?.status === 'done' ? scan.score : null;
  const halo = useHaloSignal(score !== null);
  /* Sans analyse ouverte ni analyse en cours, il n'y a rien à balayer : pas de piste, pas de score à zéro. */
  if (!scan && !enCours) return null;

  /* La tête : le pourcentage du serveur pendant l'analyse, le bout de la piste une fois finie. */
  const tete = enCours ? Math.max(0, Math.min(100, progress?.pct ?? 0)) : 100;
  /* Chaque trouvaille son rang, pour que deux voisines ne se recouvrent pas. */
  const rangs = new Map<string, number>();
  trouvailles.forEach((f, i) => rangs.set(f.id, i % Math.max(1, Math.floor(CHUTE_H / RANG_H))));

  return (
    <article className="border border-border-raised bg-elevated px-6 py-[30px] sm:px-8" data-balayage={trouvailles.length}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">Le balayage</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
          {enCours ? progress?.step : `${trouvailles.length} trouvaille${trouvailles.length > 1 ? 's' : ''} · ${FAMILLES.length} familles vérifiées`}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[620px]">
          {/* LA PISTE. Les graduations sont les familles de vérification, dans leur ordre. */}
          <div className="relative border border-border-raised bg-sunken" style={{ height: PISTE_H }}>
            {FAMILLES.map((f, i) => (
              <span key={f.cle} aria-hidden className="absolute inset-y-0 w-px bg-border" style={{ left: `${(i / FAMILLES.length) * 100}%` }} />
            ))}
            {/* La part balayée : elle se remplit derrière la tête, elle ne clignote pas. */}
            <span aria-hidden className="absolute inset-y-0 left-0 bg-[#1a1a1a]" style={{ width: `${tete}%` }} />
            {/* LE TRAIT DE TÊTE : il bat tant que l'analyse travaille, et se pose au bout quand elle a fini. */}
            <span
              aria-hidden
              /* `bord-vivant` : 1,4 s, l'utilitaire fait justement pour un bord qui AVANCE pendant qu'on le regarde — un anneau dirait seulement « vivant ». */
              className={`absolute inset-y-0 w-0.5 bg-text-primary ${enCours ? 'bord-vivant' : ''}`}
              style={{ left: `${tete}%`, transform: 'translateX(-1px)' }}
            />
            <span className="absolute inset-0 flex items-center">
              {FAMILLES.map((f) => (
                <span key={f.cle} className="min-w-0 flex-1 truncate px-1.5 text-center font-mono text-[8.5px] uppercase tracking-[0.06em] text-text-muted">
                  {f.nom}
                </span>
              ))}
            </span>
          </div>

          {/* LA CHUTE : ce qui est trouvé tombe sous la piste, à l'abscisse de sa famille, relié par un rappel. */}
          <div className="relative" style={{ height: trouvailles.length > 0 ? CHUTE_H : 26 }}>
            {trouvailles.map((f) => {
              const x = abscisse(f.category);
              const y = (rangs.get(f.id) ?? 0) * RANG_H + 6;
              return (
                <span key={f.id} className="absolute" style={{ left: `${x}%`, top: y }} data-trouvaille={f.id}>
                  <span aria-hidden className="absolute bottom-full left-0 w-px bg-border-strong" style={{ height: y - 2 }} />
                  {/*
                    L'ÉTIQUETTE SE RECALE SUR LE BORD. Centrée sur son rappel, une
                    trouvaille tombée dans la première famille sortait du cadre par
                    la gauche et se lisait « edirection 302 vers http ». Le rappel,
                    lui, ne bouge pas : il reste à l'abscisse de la famille.
                  */}
                  <span
                    className={`block whitespace-nowrap border px-2 py-[3px] text-[11px] ${bord(x)} ${
                      f.severity === 'critical' ? 'border-danger bg-danger/15 text-danger' : 'border-border-strong bg-raised text-text-body'
                    }`}
                    title={`${SEVERITY_LABEL[f.severity]} · ${f.detail}`}
                  >
                    {SEVERITY_LABEL[f.severity]} · {f.title}
                  </span>
                </span>
              );
            })}
            {trouvailles.length === 0 && (
              <span className="absolute left-0 top-1.5 text-[12.5px] text-text-muted">
                {enCours ? 'Les trouvailles tombent à la fin de l’analyse : le serveur ne les annonce pas une par une.' : 'Rien n’est tombé sous la piste : aucune trouvaille sur ce balayage.'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* LE SCORE, seul verdict du module — et sa conséquence. */}
      <div className="mt-5 flex flex-wrap items-stretch gap-[18px] border-t border-border-raised pt-5">
        {score !== null ? (
          <div data-signal-groupe="verdict" className={`signal-plate flex flex-none flex-col justify-center px-5 py-[15px] ${halo}`}>
            <span data-signal-groupe="verdict" className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] opacity-80">Le verdict</span>
            <span data-signal-groupe="verdict" className="mt-[7px] font-mono text-[30px] font-bold leading-none tabular-nums tracking-[-0.03em]">
              {score}<span className="text-[15px] opacity-70">/100</span>
            </span>
          </div>
        ) : (
          <div className="flex flex-none flex-col justify-center border border-dashed border-border-strong px-5 py-[15px]">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-text-muted">Le verdict</span>
            <span className="mt-[7px] font-mono text-[30px] font-bold leading-none tracking-[-0.03em] text-text-muted">—</span>
          </div>
        )}
        <div className="flex min-w-[17rem] flex-1 flex-col justify-center gap-2">
          <p className="text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">
            {score === null
              ? <>L’analyse tourne sur le serveur : fermer cet écran ne l’arrête pas, et le verdict sera là au retour.</>
              : score < 50
                ? <>Sous cinquante, le rapport PDF passe ce score au <span className={scoreColor(score)}>rouge</span> — et il ne remontera pas tout seul : c’est une trouvaille qu’il faut fermer, pas un chiffre qui se rattrape.</>
                : score < 80
                  ? <>Entre cinquante et quatre-vingts, le score reste en <span className={scoreColor(score)}>ambre</span> dans le rapport PDF : ce sont les mêmes seuils des deux côtés, et c’est ce qui rend le rapport lisible sans l’écran.</>
                  : <>Au-dessus de quatre-vingts, le rapport PDF passe le score au <span className={scoreColor(score)}>vert</span> : mêmes seuils ici et là, pour qu’un score ne change pas de couleur en changeant de support.</>}
          </p>
          {critiques > 0 && (
            <p className="text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">
              {critiques} trouvaille{critiques > 1 ? 's' : ''} critique{critiques > 1 ? 's' : ''} en rouge sous la piste. Le rouge ne concurrence pas l’ambre : l’ambre est le verdict, le rouge est un état de fait, et il est réservé au critique.
            </p>
          )}
        </div>
      </div>

      {/* LES TROIS PALIERS, avec ce que chacun exécute réellement — `TIER_BLURB`, pas une promesse. */}
      <div className="mt-5 border-t border-border-raised pt-5">
        <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">Ce que chaque palier exécute</span>
        <ul className="mt-3">
          {(['lite', 'pro', 'elite'] as ScanTier[]).map((t) => (
            <li key={t} className="grid grid-cols-[62px_minmax(0,1fr)] items-baseline gap-3.5 border-b border-border py-[7px] last:border-b-0">
              <span className={`font-mono text-[11px] uppercase tracking-[0.1em] ${scan?.tier === t ? 'text-text-primary' : 'text-text-muted'}`}>{TIER_LABEL[t]}</span>
              <span className="text-[12.5px] leading-snug text-text-secondary">{TIER_BLURB[t]}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3.5 text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">
          La piste porte les familles de vérification, pas le détail des contrôles : le serveur annonce une étape en clair et un pourcentage, jamais la vérification en cours. Chaque trouvaille, elle, porte sa famille — c’est d’elle que vient son abscisse.
        </p>
      </div>
    </article>
  );
}

export type { ScanFinding };
