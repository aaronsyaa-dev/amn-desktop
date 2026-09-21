import React, { useMemo } from 'react';
import { useHaloSignal } from '../EtatEcran';
import type { ComplyCheck, ComplyFinding, ComplyResults } from '../../shared/api';

/**
 * PRODUITS · COMPLY — le sceau.
 *
 * Le référentiel est un SCEAU : un anneau dont chaque segment est un contrôle.
 * Un contrôle satisfait est un segment plein et épais ; un contrôle manquant
 * est une BRÈCHE, un filet pointillé qui ne porte rien. La position d'une
 * brèche sur l'anneau est celle du contrôle DANS LE RÉFÉRENTIEL — donc des
 * brèches voisines se lisent d'un coup, et le sceau ne peut pas se fermer.
 *
 * L'AMBRE, unique : le compte de brèches au centre du sceau et son libellé.
 * Deux nœuds dans une plaque. Aucune brèche, aucun ambre — un sceau fermé n'a
 * rien à décider.
 *
 * PAS DE POURCENTAGE DE CONFORMITÉ. Soixante-quinze pour cent ne vaut rien :
 * on est conforme ou on ne l'est pas, et un pourcentage laisserait croire à un
 * progrès là où le sceau refuse de se fermer. Le module a un `score` ; il n'est
 * pas rendu ici, et le pied dit pourquoi.
 *
 * COMPLY A LA MÊME FORME QUE LE SCANNER DANS LE CODE — une adresse, une analyse
 * serveur, des résultats en flux, un score, un contrôle de programmation — et
 * doit malgré tout se composer autrement, parce que ce qu'il encode diffère :
 * le Scanner TROUVE (une piste, une chute, un verdict chiffré), Comply VÉRIFIE
 * UNE LISTE CLOSE (un anneau, des brèches, aucun chiffre de progrès).
 *
 * ────────────────────────────────────────────────────────────────────────
 * AUTANT DE SEGMENTS QUE LE RÉFÉRENTIEL A DE CONTRÔLES
 *
 * La direction décrit « un anneau de vingt-huit segments ». Le référentiel
 * RGPD d'amn-api en compte CINQ — bannière de consentement, politique de
 * confidentialité, mentions légales, formulaires chiffrés, traceurs sous
 * consentement — et c'est lui qui fait foi. Vingt-huit segments auraient
 * dessiné un référentiel qui n'existe pas, et rendu chaque brèche vingt-huit
 * fois moins visible qu'elle ne l'est. L'anneau prend donc les contrôles que
 * l'analyse a réellement exécutés, quel que soit leur nombre.
 *
 * LES CHAPITRES VIENNENT DES MANQUEMENTS, PAS DES CONTRÔLES. `ComplyCheckItem`
 * ne porte ni chapitre ni numéro d'article : seuls les MANQUEMENTS
 * (`ComplyFinding`) portent une `category` et un `article`. Le pied groupe donc
 * ce qui existe — les manquements par chapitre — au lieu d'inventer un
 * classement des contrôles satisfaits.
 */

/** La géométrie du sceau. Tout en découle. */
const SCEAU = { r: 74, largeur: 13, cx: 96, cy: 96, taille: 192 };
/** L'écart entre deux segments : c'est lui qui fait un anneau segmenté et non un disque. */
const JEU_DEG = 4;

const CHAPITRES: Record<string, string> = {
  consent: 'Consentement',
  transparency: 'Transparence',
  security: 'Sécurité',
  trackers: 'Traceurs',
};

/** Un arc de l'anneau, en coordonnées du cercle. Rien n'est posé en pixels ailleurs. */
function arc(debut: number, fin: number, rayon: number) {
  const p = (deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(SCEAU.cx + Math.cos(a) * rayon).toFixed(2)} ${(SCEAU.cy + Math.sin(a) * rayon).toFixed(2)}`;
  };
  const grand = fin - debut > 180 ? 1 : 0;
  return `M${p(debut)} A${rayon} ${rayon} 0 ${grand} 1 ${p(fin)}`;
}

export function SceauDeConformite({ check }: { check: ComplyCheck | null }) {
  const lecture = useMemo(() => {
    const results = (check?.results ?? null) as ComplyResults | null;
    const controles = results && Array.isArray(results.checks) ? results.checks : [];
    const manquements = results && Array.isArray(results.findings) ? results.findings : [];
    const breches = controles.filter((c) => !c.passed);
    /*
      LA PLUS LONGUE SUITE DE BRÈCHES VOISINES. C'est ce que la forme du sceau
      montre et qu'une liste ne montre pas : des contrôles qui se suivent et
      tombent ensemble ne sont pas cinq oublis, c'est un pan entier.
    */
    let suite = 0;
    let courante = 0;
    for (const c of controles) {
      courante = c.passed ? 0 : courante + 1;
      suite = Math.max(suite, courante);
    }
    /* Les chapitres : ceux des MANQUEMENTS, seuls porteurs d'une catégorie. */
    const parChapitre = new Map<string, ComplyFinding[]>();
    for (const f of manquements) parChapitre.set(f.category, [...(parChapitre.get(f.category) ?? []), f]);
    return { controles, manquements, breches, suite, parChapitre };
  }, [check]);

  const { controles, breches, suite, parChapitre } = lecture;
  const halo = useHaloSignal(breches.length > 0);
  /* Sans contrôle exécuté, il n'y a pas de sceau : ni anneau, ni compte à zéro. */
  if (controles.length === 0) return null;

  const pas = 360 / controles.length;

  return (
    <article className="border border-border-raised bg-elevated px-6 py-[30px] sm:px-8" data-sceau={controles.length}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">Le sceau du référentiel</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
          {controles.length} contrôles · un segment chacun
        </span>
      </div>

      <div className="grid items-center gap-8 lg:grid-cols-[212px_minmax(0,1fr)] lg:gap-[38px]">
        <div className="relative mx-auto w-full max-w-[212px]">
          <svg viewBox={`0 0 ${SCEAU.taille} ${SCEAU.taille}`} className="block h-auto w-full" role="img" aria-label={`Sceau du référentiel, ${breches.length} brèche${breches.length > 1 ? 's' : ''} sur ${controles.length} contrôles`}>
            {controles.map((c, i) => {
              const debut = i * pas + JEU_DEG / 2;
              const fin = (i + 1) * pas - JEU_DEG / 2;
              return (
                <path
                  key={c.key}
                  d={arc(debut, fin, SCEAU.r)}
                  fill="none"
                  data-segment={c.key}
                  /* Un contrôle satisfait PORTE : trait épais et plein. Une brèche ne porte rien : un filet pointillé. */
                  stroke={c.passed ? 'var(--color-text-body)' : 'var(--color-border-strong)'}
                  strokeWidth={c.passed ? SCEAU.largeur : 2}
                  strokeDasharray={c.passed ? undefined : '3 4'}
                  strokeLinecap="butt"
                />
              );
            })}
          </svg>
          {/* LE COMPTE, au centre du sceau : ce qui empêche l'anneau de se fermer. */}
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {breches.length > 0 ? (
              <span data-signal-groupe="breches" className={`signal-plate flex flex-col items-center px-4 py-2.5 ${halo}`}>
                <span data-signal-groupe="breches" className="font-mono text-[26px] font-bold leading-none tabular-nums tracking-[-0.03em]">{breches.length}</span>
                <span data-signal-groupe="breches" className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] opacity-80">
                  brèche{breches.length > 1 ? 's' : ''}
                </span>
              </span>
            ) : (
              <span className="flex flex-col items-center">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-secondary">sceau</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-primary">fermé</span>
              </span>
            )}
          </span>
        </div>

        <div className="min-w-0">
          {breches.length > 0 ? (
            <>
              <ul>
                {controles.map((c, i) => (c.passed ? null : (
                  <li key={c.key} className="flex items-baseline gap-3 border-b border-border py-2 last:border-b-0" data-breche={c.key}>
                    {/* Le numéro est la POSITION dans le référentiel : c'est elle qui rend le voisinage lisible. */}
                    <span className="flex-none font-mono text-[11px] tabular-nums text-text-muted">{String(i + 1).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1 text-[13px] text-text-body">{c.label}</span>
                  </li>
                )))}
              </ul>
              <p className="mt-3.5 text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">
                {suite > 1
                  ? <>{suite} de ces brèches SE SUIVENT dans le référentiel : ce ne sont pas des oublis épars, c’est un pan entier qui n’est pas traité — et c’est la forme du sceau qui le dit, pas la liste.</>
                  : <>Les brèches sont isolées dans le référentiel : chacune se ferme de son côté, sans qu’un pan entier soit à reprendre.</>}
              </p>
            </>
          ) : (
            <p className="text-[22px] font-bold leading-[1.22] tracking-[-0.02em] text-text-primary [text-wrap:pretty]">
              Les {controles.length} contrôles du référentiel sont satisfaits : le sceau se ferme.
            </p>
          )}
        </div>
      </div>

      {/* LES CHAPITRES : ceux des manquements, les seuls qui en portent un. */}
      {parChapitre.size > 0 && (
        <div className="mt-[26px] border-t border-border-raised pt-5">
          <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">Les manquements par chapitre</span>
          <ul className="mt-3">
            {[...parChapitre.entries()].map(([cle, liste]) => (
              <li key={cle} className="grid grid-cols-[124px_44px_minmax(0,1fr)] items-baseline gap-3.5 border-b border-border py-[7px] last:border-b-0" data-chapitre={cle}>
                <span className="truncate text-[12.5px] text-text-body">{CHAPITRES[cle] ?? cle}</span>
                <span className="font-mono text-[12px] tabular-nums text-text-secondary">{liste.length}</span>
                <span className="truncate font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-muted">
                  {[...new Set(liste.map((f) => f.article).filter(Boolean))].join(' · ') || '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 border-t border-border-raised pt-4 text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">
        Aucun pourcentage de conformité n’est affiché : quatre-vingts pour cent de conforme n’est pas conforme, et un chiffre de progrès laisserait croire à un avancement là où le sceau refuse de se fermer. L’anneau porte les contrôles que l’analyse a réellement exécutés — pas un nombre décidé d’avance. Les chapitres viennent des manquements : un contrôle satisfait n’en porte pas, et aucun ne lui a été inventé.
      </p>
    </article>
  );
}
