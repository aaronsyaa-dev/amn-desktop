import React, { useEffect, useMemo, useState } from 'react';
import { useHaloSignal } from '../EtatEcran';
import { bridge } from '../../lib/bridge';
import { echantillonParc } from '../../lib/parcEchantillon';
import { lireMaturite, SIGNAUX, type Maturite, type Signal } from '../../lib/maturiteSoc';
import type { AdminOrganization, InputAlert, ModuleRequestForOperator, OrgPulse, SupportRequestForOperator } from '../../shared/api';

/**
 * PARC · COMPARATIF CLIENTES — la carte de chaleur.
 *
 * Une ligne par cliente, six colonnes, et LA CLARTÉ D'UNE CASE EST SA VALEUR.
 * Une carte de chaleur ne sert à rien pour comparer deux valeurs voisines :
 * elle sert à voir des BANDES. Une ligne pâle est une cliente en retard ; une
 * COLONNE pâle est un problème qui nous appartient. Distinguer ces deux
 * lectures est le sujet entier de l'écran, et c'est écrit en pied.
 *
 * L'AMBRE, unique : la case à l'intersection de la ligne la plus faible et de
 * la colonne la plus faible — un nœud, plus l'en-tête de colonne et le nom de
 * ligne qui la désignent.
 *
 * AUCUN CLASSEMENT DES CLIENTES. Pas de rang, pas de total par ligne :
 * comparer neuf clientes entre elles n'aide personne, et un classement
 * transformerait une carte de diagnostic en palmarès. Seule la MOYENNE PAR
 * COLONNE est calculée, parce que c'est la seule qui parle de nous. Les lignes
 * sont rangées par ordre alphabétique — un ordre qui ne dit rien, donc qui ne
 * ment pas. Une organisation suspendue reste dans la carte, marquée comme
 * telle : la sortir ferait croire que le parc va mieux qu'il ne va.
 *
 * (La ligne la plus faible SE CALCULE pour placer l'ambre, mais ne s'affiche
 * jamais : désigner une case n'est pas publier un rang.)
 *
 * LES SIX COLONNES SONT LES SIX AXES DE `maturiteSoc.ts`, les mêmes qu'en
 * `30d` — c'est ce qui rend le comparatif possible, et c'est le référentiel
 * réel du produit, pas un référentiel de maquette. La clarté d'une case est
 * l'atteinte de l'axe (`Lecture.part`), prise au même endroit que le seuil.
 */

/** Un nom de colonne court : les libellés du dictionnaire sont des phrases de seuil. */
const NOM_DAXE: Record<Signal, string> = {
  activite: 'Activité',
  equipe: 'Équipe',
  sites: 'Sites',
  critiques: 'Critiques',
  entrees: 'Entrées',
  demandes: 'Demandes',
};

/** La hauteur d'une case. La carte n'a pas d'autre unité. */
const CASE_H = 30;

/**
 * L'ENCRE D'UNE CASE : du noir de fond au gris clair, en continu. Une échelle
 * de couleurs (rouge → vert) aurait donné à lire une alarme par case ; ici la
 * carte se lit en BANDES, et seule la clarté porte la valeur.
 */
const encreDeCase = (part: number) => `rgba(255, 255, 255, ${(0.045 + part * 0.5).toFixed(3)})`;

export function CarteDeChaleur() {
  const [maturites, setMaturites] = useState<Maturite[] | null>(null);

  useEffect(() => {
    let vivant = true;
    const lire = async () => {
      try {
        const admin = bridge().remote.admin;
        const [orgs, entrees, support, modules] = await Promise.all([
          echantillonParc(),
          admin.inputAlerts({ limit: 500 }),
          admin.supportRequests('pending'),
          admin.moduleRequests('pending'),
        ]);
        const clientes = (orgs as AdminOrganization[]).filter((o) => o.plan !== 'internal');
        const pouls = await Promise.all(clientes.map((o) => admin.organizationPulse(o.id).catch(() => null)));
        if (!vivant) return;
        setMaturites(clientes.map((o, i) => lireMaturite(o, pouls[i] as OrgPulse | null, entrees as InputAlert[], support as SupportRequestForOperator[], modules as ModuleRequestForOperator[])));
      } catch {
        if (vivant) setMaturites([]);
      }
    };
    void lire();
    return () => { vivant = false; };
  }, []);

  const lecture = useMemo(() => {
    if (!maturites || maturites.length === 0) return null;
    /* L'ordre alphabétique : il ne dit rien, donc il ne classe pas. */
    const lignes = [...maturites].sort((a, b) => a.org.name.localeCompare(b.org.name, 'fr'));
    const part = (m: Maturite, s: Signal) => m.lectures.find((l) => l.signal === s)?.part ?? 0;
    const moyennes = SIGNAUX.map((s) => ({ signal: s, moyenne: lignes.reduce((n, m) => n + part(m, s), 0) / lignes.length }));
    /* La colonne la plus pâle : celle qui nous appartient. */
    const colonneFaible = moyennes.reduce((bas, c) => (c.moyenne < bas.moyenne ? c : bas), moyennes[0]);
    /* La ligne la plus pâle, calculée pour placer l'ambre — et jamais affichée. */
    const force = (m: Maturite) => SIGNAUX.reduce((n, s) => n + part(m, s), 0);
    const ligneFaible = lignes.reduce((bas, m) => (force(m) < force(bas) ? m : bas), lignes[0]);
    const caseAmbre = part(ligneFaible, colonneFaible.signal) < 1
      ? { orgId: ligneFaible.org.id, signal: colonneFaible.signal, nom: ligneFaible.org.name }
      : null;
    return { lignes, moyennes, colonneFaible, caseAmbre, part };
  }, [maturites]);

  const halo = useHaloSignal(Boolean(lecture?.caseAmbre));
  if (!lecture) return null;
  const { lignes, moyennes, colonneFaible, caseAmbre, part } = lecture;
  const pourcent = (p: number) => `${Math.round(p * 100)} %`;
  const GRILLE = `minmax(0, 168px) repeat(${SIGNAUX.length}, minmax(0, 1fr))`;

  return (
    <article className="border border-border-raised bg-elevated px-6 py-[30px] sm:px-8" data-carte={lignes.length}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">La carte des six axes</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">Plus une case est claire, plus l’axe est atteint</span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          {/* L'en-tête partage la grille des lignes : sinon « Sites » ne tomberait pas sur la colonne des sites. */}
          <div className="grid items-end gap-[3px] pb-1.5" style={{ gridTemplateColumns: GRILLE }}>
            <span />
            {SIGNAUX.map((s) => {
              const designe = caseAmbre?.signal === s;
              return (
                <span
                  key={s}
                  data-signal-groupe={designe ? 'case-basse' : undefined}
                  className={`truncate text-center font-mono text-[9.5px] uppercase tracking-[0.06em] ${designe ? 'font-bold text-signal' : 'text-text-muted'}`}
                >
                  {NOM_DAXE[s]}
                </span>
              );
            })}
          </div>

          {lignes.map((m) => {
            const designe = caseAmbre?.orgId === m.org.id;
            return (
              <div key={m.org.id} className="grid items-center gap-[3px] py-[2px]" style={{ gridTemplateColumns: GRILLE }} data-ligne={m.org.id}>
                <span className="flex min-w-0 items-baseline gap-2 pr-3">
                  <span
                    data-signal-groupe={designe ? 'case-basse' : undefined}
                    className={`truncate text-[12.5px] ${designe ? 'font-semibold text-signal' : 'text-text-body'}`}
                    title={m.org.name}
                  >
                    {m.org.name}
                  </span>
                  {/* Une suspendue reste dans la carte : la sortir ferait croire que le parc va mieux qu'il ne va. */}
                  {m.org.status === 'suspended' && (
                    <span className="flex-none font-mono text-[8.5px] uppercase tracking-[0.1em] text-text-muted">susp.</span>
                  )}
                </span>
                {SIGNAUX.map((s) => {
                  const p = part(m, s);
                  const ambre = caseAmbre?.orgId === m.org.id && caseAmbre.signal === s;
                  const l = m.lectures.find((x) => x.signal === s);
                  return (
                    <span
                      key={s}
                      data-signal-groupe={ambre ? 'case-basse' : undefined}
                      data-case={`${m.org.id}|${s}`}
                      title={`${m.org.name} · ${NOM_DAXE[s]} · ${l?.valeur ?? ''}`}
                      className={`block ${ambre ? `bg-signal ${halo}` : ''}`}
                      style={{ height: CASE_H, background: ambre ? undefined : encreDeCase(p) }}
                    />
                  );
                })}
              </div>
            );
          })}

          {/* LA SEULE AGRÉGATION CALCULÉE : la moyenne par colonne. Elle parle de nous, pas d'une cliente. */}
          <div className="mt-2.5 grid items-center gap-[3px] border-t border-border-raised pt-2.5" style={{ gridTemplateColumns: GRILLE }}>
            <span className="pr-3 text-right font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-muted">Atteinte moyenne</span>
            {moyennes.map((c) => (
              <span key={c.signal} className={`text-center font-mono text-[12px] tabular-nums ${c.signal === colonneFaible.signal ? 'text-text-primary' : 'text-text-secondary'}`}>
                {pourcent(c.moyenne)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-[22px] border-t border-border-raised pt-5">
        <p className="text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">
          <b className="font-semibold text-text-primary">Une ligne pâle est une cliente en retard ; une colonne pâle est un problème qui nous appartient.</b>{' '}
          {caseAmbre
            ? <>La colonne la plus pâle du parc est {NOM_DAXE[colonneFaible.signal].toLowerCase()}, à {pourcent(colonneFaible.moyenne)} de moyenne : c’est une bande, pas un cas. La case ambre est à son croisement avec la ligne la plus pâle, {caseAmbre.nom} — le point où les deux retards se rencontrent.</>
            : <>Aucune case ne reste sous la cible au croisement des deux plus pâles : la carte n’a pas de point bas à désigner.</>}
        </p>
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">
          Ce que la carte ne fait pas : elle ne classe pas les clientes, ne totalise aucune ligne et ne compare pas deux cases voisines — deux gris proches ne se distinguent pas à l’œil, et c’est voulu. Trois colonnes ne connaissent que le noir et le clair parce que leur règle est « aucun » : il n’y a pas de demi-mesure entre zéro critique et deux.
        </p>
        {/* Deux écrans, deux chiffres sur le même axe : dire lequel mesure quoi, sinon l'un dément l'autre. */}
        <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">
          Cette moyenne n’est pas celle de la toile de Maturité SOC : la toile donne la part des clientes AU VERT sur un axe, la carte la moyenne de l’ATTEINTE de cet axe. Une cliente à six jours actifs sur huit ne compte pas au vert dans la toile, et compte pour trois quarts ici.
        </p>
      </div>
    </article>
  );
}
