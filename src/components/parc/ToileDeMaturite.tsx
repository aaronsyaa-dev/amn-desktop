import React, { useMemo } from 'react';
import { useHaloSignal } from '../EtatEcran';
import { SIGNAUX, type Maturite, type Signal } from '../../lib/maturiteSoc';

/**
 * PARC · MATURITÉ SOC — la toile.
 *
 * Six axes, deux polygones : le PLEIN est l'état du parc, le FILET la cible.
 * C'est la seule convention de métier reprise telle quelle, parce qu'elle est
 * méritée — un modèle de maturité EST multi-axes, et six barres côte à côte ne
 * montreraient pas ce qu'une toile montre : la FORME du déséquilibre. Ce qu'on
 * lit d'abord n'est pas un pourcentage, c'est un creux, et la toile rentre d'un
 * seul côté.
 *
 * L'AMBRE, unique : l'axe le plus creux — son sommet grossi sur la toile et son
 * étiquette d'axe. Deux nœuds. Sa ligne dans « Les six axes » rappelle la même
 * donnée et reste en encre ordinaire : une carte calme n'est pas un relevé
 * attaché.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LE RÉFÉRENTIEL EXISTE DÉJÀ, IL N'EST PAS À INVENTER
 *
 * La direction écrit « Source. Aucune — les axes sont à définir avec
 * l'équipe », et propose six axes de maquette : Détection, Réponse,
 * Journalisation, Sauvegarde, Accès, Formation. Le dépôt dit autre chose, et
 * c'est lui qui fait foi : `src/lib/maturiteSoc.ts` porte DÉJÀ six signaux,
 * lus dans le pouls que le serveur tient — activité, équipe, sites, critiques,
 * entrées suspectes, demandes en attente — chacun avec son seuil et le chiffre
 * qui l'a décidé.
 *
 * Dessiner les six axes de la maquette aurait donc posé une toile sur des
 * valeurs inventées, à côté d'un modèle réel et déjà à l'écran. La toile prend
 * les six axes du produit. C'est aussi ce qui arrête le référentiel une fois
 * pour les trois écrans qui doivent le partager (`30e`, `31b`).
 *
 * UNE MATURITÉ N'EST PAS UNE NOTE — ET CELLE DU PRODUIT EN EST UNE. La
 * direction demande un relevé trimestriel posé à la main, qui ne bouge pas
 * quand un incident arrive. Le produit fait l'inverse : `lireMaturite` dérive
 * les six signaux du pouls, et l'écran les relit toutes les soixante secondes.
 * Rien dans amn-api ne stocke de relevé daté, et personne n'en saisit. Poser
 * ici un « relevé du trimestre » aurait affiché une date que rien n'écrit. La
 * toile dit donc ce qu'elle est : une lecture de l'instant, datée comme telle.
 * L'instrument tient tel quel le jour où un relevé trimestriel existera.
 *
 * LA VALEUR D'UN AXE EST UNE PART DE PARC, PAS UNE NOTE INVENTÉE. Un signal du
 * produit est BINAIRE : il est au vert ou il ne l'est pas. Inventer une note
 * continue par cliente aurait demandé une échelle que le produit n'a pas.
 * L'axe porte donc la part des clientes au vert sur ce signal — une grandeur
 * qui se vérifie en comptant. La cible est celle du produit lui-même : les six
 * signaux au vert chez toutes les clientes, donc le filet passe au bord.
 */

/** La géométrie de la toile. Tout en découle : rien n'est posé au pixel près ailleurs. */
const TOILE = { cx: 118, cy: 104, r: 76, w: 236, h: 208 };
/** Les cercles de lecture, en part de rayon. */
const ANNEAUX = [0.25, 0.5, 0.75, 1];

/** Un nom d'axe court. Les libellés du dictionnaire sont des PHRASES de seuil — illisibles au bout d'un rayon. */
const NOM_DAXE: Record<Signal, string> = {
  activite: 'Activité',
  equipe: 'Équipe',
  sites: 'Sites',
  critiques: 'Critiques',
  entrees: 'Entrées',
  demandes: 'Demandes',
};

/**
 * POURQUOI UN CREUX NE SE RATTRAPE PAS PAR UN RÉGLAGE. Chaque axe tient à un
 * fait du monde, pas à une case à cocher de ce poste — c'est ce qui sépare une
 * maturité d'un score qu'on remonte en changeant un seuil.
 */
const POURQUOI: Record<Signal, string> = {
  activite: 'L’outil n’est pas entré dans leur semaine. Aucun réglage ne fait écrire une équipe qui n’écrit pas : c’est une reprise en main, pas un paramètre.',
  equipe: 'Une seule personne porte le dossier. Rien n’y survit à son absence, et ouvrir un deuxième compte est une décision de la cliente, pas une option d’ici.',
  sites: 'Un site ne bat plus, ou aucun site n’est surveillé. Cela se répare sur le site, pas sur cet écran.',
  critiques: 'Des événements critiques récents. Ils se traitent un par un dans la file du parc ; les masquer ne les ferme pas.',
  entrees: 'La sentinelle a vu des entrées suspectes. Baisser sa sensibilité les ferait disparaître de l’écran, pas du site.',
  demandes: 'Des demandes attendent depuis plus de trois jours. Le seul geste qui remonte cet axe est de répondre.',
};

export function ToileDeMaturite({ maturites }: { maturites: Maturite[] }) {
  const lecture = useMemo(() => {
    const total = maturites.length;
    const axes = SIGNAUX.map((signal) => {
      const verts = maturites.filter((m) => m.lectures.find((l) => l.signal === signal)?.ok).length;
      return { signal, verts, part: total > 0 ? verts / total : 0 };
    });
    /* Le creux : l'axe le moins atteint. À égalité, le premier du référentiel — son ordre est stable et publié. */
    const creux = axes.reduce((bas, a) => (a.part < bas.part ? a : bas), axes[0]);
    return { total, axes, creux: creux && creux.part < 1 ? creux : null };
  }, [maturites]);

  const { total, axes, creux } = lecture;
  const halo = useHaloSignal(creux !== null);
  /* Un parc sans cliente n'a pas de toile : ni polygone, ni creux, ni relevé à zéro. */
  if (total === 0) return null;

  const point = (i: number, part: number) => {
    const angle = (-90 + i * (360 / SIGNAUX.length)) * (Math.PI / 180);
    return { x: TOILE.cx + Math.cos(angle) * TOILE.r * part, y: TOILE.cy + Math.sin(angle) * TOILE.r * part };
  };
  const polygone = (parts: number[]) => parts.map((p, i) => { const { x, y } = point(i, p); return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ');
  const pleine = polygone(axes.map((a) => a.part));
  const pourcent = (p: number) => `${Math.round(p * 100)} %`;

  return (
    <article className="border border-border-raised bg-elevated px-6 py-[30px] sm:px-8" data-toile={total}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">La toile des six axes</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">Plein = le parc · filet = la cible · {total} cliente{total > 1 ? 's' : ''}</span>
      </div>

      <div className="grid items-center gap-8 lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-[38px]">
        <div className="relative mx-auto w-full max-w-[264px] px-[34px]">
          <svg viewBox={`0 0 ${TOILE.w} ${TOILE.h}`} className="block h-auto w-full" role="img" aria-label={`La toile du parc sur six axes${creux ? `, le creux est ${NOM_DAXE[creux.signal]}` : ''}`}>
            {ANNEAUX.map((a) => (
              <polygon key={a} points={polygone(SIGNAUX.map(() => a))} fill="none" stroke="var(--color-border-raised)" strokeWidth={1} />
            ))}
            {SIGNAUX.map((s, i) => {
              const { x, y } = point(i, 1);
              return <line key={s} x1={TOILE.cx} y1={TOILE.cy} x2={x} y2={y} stroke="var(--color-border-raised)" strokeWidth={1} />;
            })}
            {/* LE FILET : la cible du produit — les six signaux au vert chez toutes les clientes. */}
            <polygon points={polygone(SIGNAUX.map(() => 1))} fill="none" stroke="var(--color-border-strong)" strokeWidth={1} strokeDasharray="3 3" />
            {/* LE PLEIN : l'état, à sa vraie forme. C'est le creux qu'on lit, pas la surface. */}
            <polygon points={pleine} fill="rgba(74,74,72,0.55)" stroke="#4a4a48" strokeWidth={1.5} />
            {axes.map((a, i) => {
              const { x, y } = point(i, a.part);
              const ambre = creux?.signal === a.signal;
              return (
                <circle
                  key={a.signal}
                  cx={x}
                  cy={y}
                  r={ambre ? 5 : 2.6}
                  fill={ambre ? 'var(--color-signal)' : '#4a4a48'}
                  data-signal-groupe={ambre ? 'axe-creux' : undefined}
                  className={ambre ? halo : undefined}
                />
              );
            })}
          </svg>
          {/*
            LES ÉTIQUETTES VIVENT HORS DU SVG. Posées en <text>, elles étaient
            coupées net par le cadre du viewBox dès qu'un nom dépassait à
            gauche — « ENTRÉES » devenait « :NTRÉES ». En HTML, elles débordent
            sans être rognées, gardent la fonte de l'application, et restent à
            l'abscisse que la même fonction `point()` leur donne.
          */}
          {axes.map((a, i) => {
            const { x, y } = point(i, 1.14);
            const ambre = creux?.signal === a.signal;
            return (
              <span
                key={a.signal}
                data-signal-groupe={ambre ? 'axe-creux' : undefined}
                className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.08em] ${ambre ? `font-bold text-signal ${halo}` : 'text-text-muted'}`}
                style={{ left: `${(x / TOILE.w) * 100}%`, top: `${(y / TOILE.h) * 100}%` }}
              >
                {NOM_DAXE[a.signal]}
              </span>
            );
          })}
        </div>

        <div className="min-w-0">
          {creux ? (
            <>
              <p className="text-[22px] font-bold leading-[1.22] tracking-[-0.02em] text-text-primary [text-wrap:pretty]">
                {/* La phrase NOMME le creux, elle ne le re-signale pas : l'ambre est déjà sur la toile, et deux ambres sur un écran n'en font aucun. */}
                Le parc rentre sur {NOM_DAXE[creux.signal].toLowerCase()} : {creux.verts} cliente{creux.verts > 1 ? 's' : ''} sur {total} y {creux.verts > 1 ? 'sont' : 'est'} au vert.
              </p>
              <p className="mt-3.5 text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">{POURQUOI[creux.signal]}</p>
            </>
          ) : (
            <p className="text-[22px] font-bold leading-[1.22] tracking-[-0.02em] text-text-primary [text-wrap:pretty]">
              La toile touche le filet sur les six axes : les {total} cliente{total > 1 ? 's' : ''} du parc sont au vert partout.
            </p>
          )}
          <p className="mt-3.5 text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">
            Les six axes sont les mêmes pour toutes les clientes — c’est ce qui rend le comparatif possible. Un axe vaut la part des clientes au vert sur ce signal : un signal du produit est au vert ou ne l’est pas, et aucune note continue n’a été inventée par-dessus.
          </p>
        </div>
      </div>

      {/* LES SIX AXES EN BARRES : la même donnée, lisible au chiffre. Encre ordinaire, y compris sur l'axe creux. */}
      <div className="mt-[26px] border-t border-border-raised pt-5">
        <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">Les six axes · écart à la cible</span>
        <ul className="mt-3.5">
          {axes.map((a) => (
            <li key={a.signal} className="grid grid-cols-[90px_minmax(0,1fr)_52px_64px] items-center gap-3.5 border-b border-border py-[9px] last:border-b-0" data-axe={a.signal}>
              <span className="truncate text-[12.5px] text-text-body">{NOM_DAXE[a.signal]}</span>
              <span className="relative block h-[9px] border border-border-raised bg-sunken">
                <span className="absolute inset-y-0 left-0 bg-[#4a4a48]" style={{ width: `${a.part * 100}%` }} />
                {/* Le repère de cible reste visible même à 100 % : il tient le bord, il ne se confond pas avec la barre. */}
                <span aria-hidden className="absolute -inset-y-1 right-0 w-px bg-border-strong" />
              </span>
              <span className="text-right font-mono text-[12px] tabular-nums text-text-secondary">{pourcent(a.part)}</span>
              <span className={`text-right font-mono text-[11px] tabular-nums ${a.part >= 1 ? 'text-text-muted' : 'text-text-secondary'}`}>
                {a.part >= 1 ? 'à la cible' : `− ${total - a.verts}`}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">
          Cette toile est une LECTURE DE L’INSTANT, pas un relevé de trimestre : les six signaux se dérivent du pouls que le serveur tient, et l’écran les relit chaque minute. Elle descend donc quand un critique arrive et remonte quand il se ferme. Rien dans le produit ne stocke aujourd’hui un relevé daté qu’on poserait à la main.
        </p>
      </div>
    </article>
  );
}
