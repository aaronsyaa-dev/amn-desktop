import React, { useMemo } from 'react';
import { useHaloSignal } from '../EtatEcran';
import { useLangue } from '../../i18n';
import type { AlertRuleData, Declenchee, Nature, Parc } from '../../screens/CustomAlertsScreen';

/**
 * PARC · ALERTES PERSONNALISÉES — le tamis.
 *
 * Une règle est un TAMIS que le parc traverse, et sa maille est dessinée dans
 * le fond de la piste : serrée pour une règle qui retient beaucoup, large pour
 * une règle qui laisse presque tout passer. Ce qui est retenu remplit la piste
 * par la gauche.
 *
 * La lecture utile n'est ni le nombre entrant ni le nombre sortant : c'est LE
 * RAPPORT, et la piste le donne en surface. Une règle saine est un filet de
 * lumière ; une règle mal réglée éclaire la moitié de sa piste.
 *
 * L'AMBRE, unique : la règle dont la maille est trop fine — son remplissage,
 * son décompte et son taux. Trois nœuds sur une ligne. Aucune règle trop fine,
 * aucun ambre : un tamis qui tient n'a rien à signaler.
 *
 * ────────────────────────────────────────────────────────────────────────
 * CE QUE LE TAMIS FILTRE VRAIMENT
 *
 * La direction décrit des ÉVÉNEMENTS qui traversent la maille, et un coût du
 * bruit — « trois alertes sur quatre sont du bruit ». `CustomAlertsScreen` dit
 * autre chose, et c'est lui qui fait foi : une règle n'examine pas un flux
 * d'événements, elle examine LES ORGANISATIONS DU PARC, une par une, à chaque
 * lecture. L'entrant d'une piste est donc le nombre de clientes examinées — un
 * nombre réel, jamais arrondi — et le retenu le nombre de clientes sur
 * lesquelles la règle se déclenche.
 *
 * Et le produit ne sait PAS ce qui est du bruit : aucune alerte personnalisée
 * n'est acquittée, écartée ni notée. Annoncer « trois sur quatre sont du
 * bruit » aurait été un chiffre sans mesure derrière. Le coût d'une maille
 * trop fine se dit donc autrement : une règle qui retient la moitié du parc ne
 * désigne plus personne.
 *
 * OÙ VA UNE ALERTE : NULLE PART AILLEURS QU'ICI. La direction demande un pied
 * qui dise la destination de chaque alerte — la pile, le rapport hebdomadaire,
 * le journal seulement. `AlertRuleData` ne porte que `kind`, `threshold`,
 * `enabled` et `createdAt` : il n'existe aucune destination dans le produit,
 * et rien ne route ces alertes ailleurs que vers la liste de cet écran.
 * Dessiner trois destinations aurait promis un acheminement qui n'existe pas.
 */

/**
 * LA MAILLE TROP FINE : une règle qui retient plus d'une cliente sur deux.
 * Au-delà, ce n'est plus une exception qu'elle désigne, c'est le parc.
 */
const MAILLE_TROP_FINE = 0.5;
const PISTE_H = 26;
/** Le pas de la maille, en pixels : serré quand la règle retient, large quand elle laisse passer. */
const PAS_MIN = 4;
const PAS_MAX = 20;

const pasDeMaille = (taux: number) => Math.round(PAS_MAX - taux * (PAS_MAX - PAS_MIN));

/**
 * LE FOND D'UNE PISTE EST UNE MAILLE, donc une trame qui se répète. Un
 * `linear-gradient` ne poserait qu'un trait, au bord : c'est
 * `repeating-linear-gradient` qui fait une grille.
 */
const maille = (taux: number) => {
  const pas = pasDeMaille(taux);
  return `repeating-linear-gradient(90deg, transparent 0 ${pas - 1}px, rgba(255,255,255,0.1) ${pas - 1}px ${pas}px)`;
};

export function TamisDesRegles({
  regles,
  parc,
  declenchees,
}: {
  regles: (AlertRuleData & { id: string })[];
  parc: Parc;
  declenchees: Declenchee[];
}) {
  const { t } = useLangue();
  const nature = (n: Nature) => t(`alertesPerso.nature.${n}` as Parameters<typeof t>[0]);
  const unite = (n: Nature) => t(`alertesPerso.unite.${n}` as Parameters<typeof t>[0]);

  const lecture = useMemo(() => {
    const entrant = parc.orgs.length;
    const pistes = regles.map((regle) => {
      const retenu = declenchees.filter((d) => d.regle.id === regle.id).length;
      return { regle, retenu, taux: entrant > 0 ? retenu / entrant : 0 };
    });
    /* La maille la plus fine parmi les règles qui veillent : une règle suspendue ne tamise rien. */
    const actives = pistes.filter((p) => p.regle.enabled);
    const trop = actives.filter((p) => p.taux >= MAILLE_TROP_FINE).sort((a, b) => b.taux - a.taux)[0] ?? null;
    return { entrant, pistes, trop };
  }, [regles, parc, declenchees]);

  const { entrant, pistes, trop } = lecture;
  const halo = useHaloSignal(trop !== null);
  /* Sans cliente examinée, il n'y a pas de tamis : pas de piste, pas de taux à zéro. */
  if (entrant === 0 || pistes.length === 0) return null;

  const pourcent = (x: number) => `${Math.round(x * 100)} %`;

  return (
    <article className="border border-border-raised bg-elevated px-6 py-[30px] sm:px-8" data-tamis={pistes.length}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">Ce que chaque règle retient</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{entrant} cliente{entrant > 1 ? 's' : ''} traversent chaque maille</span>
      </div>

      <ul>
        {pistes.map(({ regle, retenu, taux }) => {
          const ambre = trop?.regle.id === regle.id;
          const groupe = ambre ? 'maille-trop-fine' : undefined;
          return (
            <li
              key={regle.id}
              className="grid grid-cols-[minmax(0,236px)_minmax(0,1fr)_58px_52px] items-center gap-3.5 border-b border-border py-2.5 last:border-b-0"
              data-piste={regle.id}
              data-taux={taux.toFixed(2)}
            >
              <span className="flex min-w-0 flex-col">
                {/* Les libellés du dictionnaire sont des PROPOSITIONS (« une organisation est silencieuse depuis ») : tronquées, elles ne disent plus la règle. */}
                <span className={`text-[12.5px] leading-snug ${regle.enabled ? 'text-text-body' : 'text-text-muted'}`}>{nature(regle.kind)}</span>
                <span className="mt-0.5 font-mono text-[10px] tabular-nums uppercase tracking-[0.06em] text-text-muted">
                  {regle.threshold} {unite(regle.kind)}{regle.enabled ? '' : ' · suspendue'}
                </span>
              </span>
              <span
                className={`relative block border ${regle.enabled ? 'border-border-raised' : 'border-dashed border-border'}`}
                style={{ height: PISTE_H, background: regle.enabled ? maille(taux) : undefined }}
              >
                {/* Ce qui est retenu remplit la piste PAR LA GAUCHE : la surface EST le rapport. */}
                <span
                  data-signal-groupe={groupe}
                  className={`absolute inset-y-0 left-0 ${ambre ? `bg-signal ${halo}` : 'bg-[#4a4a48]'}`}
                  style={{ width: `${taux * 100}%` }}
                />
              </span>
              {/* Le nombre entrant est réel, jamais arrondi : c'est ce qui rend le rapport vérifiable. */}
              <span data-signal-groupe={groupe} className={`text-right font-mono text-[12px] tabular-nums ${ambre ? 'font-bold text-signal' : 'text-text-secondary'}`}>
                {retenu} / {entrant}
              </span>
              <span data-signal-groupe={groupe} className={`text-right font-mono text-[12px] tabular-nums ${ambre ? 'font-bold text-signal' : 'text-text-muted'}`}>
                {pourcent(taux)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-[22px] border-t border-border-raised pt-5">
        <p className="text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">
          {trop
            ? <>La règle «&nbsp;<b className="font-semibold text-text-primary">{nature(trop.regle.kind)} {trop.regle.threshold} {unite(trop.regle.kind)}</b>&nbsp;» a une maille trop fine : elle retient {trop.retenu} clientes sur {entrant}. Une règle qui retient la moitié du parc ne désigne plus personne — c’est le seuil qu’il faut remonter, pas l’alerte qu’il faut ignorer.</>
            : <>Aucune règle ne retient plus d’une cliente sur deux : les mailles tiennent. Une règle saine est un filet de lumière dans sa piste, pas une piste à moitié éclairée.</>}
        </p>
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">
          Une règle se RÈGLE, elle ne se coupe pas : à zéro alerte, on ne saurait plus si elle veille encore. Le seuil se remonte, et la piste le montre aussitôt.
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">
          Une règle n’examine pas un flux d’événements : elle relit les {entrant} clientes du parc à chaque lecture. Et ces alertes ne partent nulle part — aucune destination n’existe dans le produit, elles vivent dans la liste ci-dessous, et rien ne les achemine vers la pile ni vers un rapport.
        </p>
      </div>
    </article>
  );
}
