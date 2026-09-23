import React from 'react';
import { Link } from 'react-router-dom';
import { sectionsForSpace } from '../../data/spaces';
import type { NavSection } from '../../data/navigation';
import { libelleSection } from '../../i18n';
import { useActivity } from '../../state/ActivityContext';
import { EnTeteAccueil, SiPremierJour, enLettres, euros } from './communs';
import { hhmm, useJournee } from './journee';

/**
 * C9 · LES TIROIRS (`40i`).
 *
 * Les sept familles les plus actives en façades de tiroirs : poignée, nom,
 * nombre de modules, ligne d'état. UN SEUL tiroir est tiré — deux colonnes sur
 * deux rangées, quatre lignes de contenu.
 *
 * Règles (ACCUEILS.md) : le tiroir tiré est celui qui porte l'élément à
 * enjeu ; s'il n'y en a pas, aucun tiroir n'est tiré et l'écran n'a pas
 * d'ambre. Dans le tiroir tiré, NOM ET DÉTAIL S'EMPILENT et le détail peut
 * aller à la ligne — jamais sur une même ligne tronquée.
 *
 * « Les plus actives » se mesure sur les données de l'espace, pas sur les
 * ouvertures d'écran (le journal des ouvertures n'est pas une mesure
 * d'usage, et le dit) : les points d'attention et les actions du jour qui
 * mènent à un module de la famille, puis les changements faits depuis un
 * autre poste dans les sept derniers jours ; à égalité, l'ordre du catalogue.
 */
const TIROIRS = 7;
const SEPT_JOURS = 7 * 86_400_000;

const chemin = (to: string) => to.split(/[?#]/)[0];
/** La famille dont un module porte ce chemin (le module le plus précis gagne). */
function familleDe(sections: NavSection[], to: string): string | null {
  const c = chemin(to);
  let m: { cle: string; n: number } | null = null;
  for (const s of sections)
    for (const i of s.items) if ((c === i.to || c.startsWith(`${i.to}/`)) && (!m || i.to.length > m.n)) m = { cle: s.key, n: i.to.length };
  return m?.cle ?? null;
}

interface Ligne {
  nom: string;
  detail: string;
}

export function Tiroirs() {
  const j = useJournee(60_000);
  const { events } = useActivity();
  const sections = sectionsForSpace('workspace');
  const t = j.maintenant.getTime();

  const actif = new Map<string, number>();
  const lignesDe = new Map<string, Ligne[]>();
  const ajouter = (cle: string | null, poids: number, ligne?: Ligne) => {
    if (!cle) return;
    actif.set(cle, (actif.get(cle) ?? 0) + poids);
    if (ligne) lignesDe.set(cle, [...(lignesDe.get(cle) ?? []), ligne]);
  };
  /* L'enjeu compte pour la famille où il se règle (le tiroir tiré), pas pour l'Agenda. */
  for (const a of j.actions) if (!a.cle.startsWith('enjeu-')) ajouter(familleDe(sections, a.to), 100, { nom: a.titre, detail: a.detail });
  for (const e of events) if (t - new Date(e.at).getTime() <= SEPT_JOURS) ajouter(familleDe(sections, e.routeKey), 1);

  if (j.enJeu) ajouter(familleDe(sections, j.enJeu.motif === 'devis' ? '/facturation/devis' : '/facturation'), 1000);
  const ordre = sections.map((s, i) => ({ s, i, n: actif.get(s.key) ?? 0 }));
  ordre.sort((a, b) => b.n - a.n || a.i - b.i);
  const sept = ordre.slice(0, TIROIRS).map((x) => x.s);
  const autres = sections.length - sept.length;

  /* Le tiroir tiré : la famille du module où l'enjeu se règle. */
  const e = j.enJeu;
  const cleTiree = e ? familleDe(sections, e.motif === 'devis' ? '/facturation/devis' : '/facturation') : null;
  const tire = cleTiree ? sept.find((s) => s.key === cleTiree) ?? null : null;
  /* Toujours dans les sept : s'il n'y était pas, il prend la dernière place. */
  const facades = tire ? [tire, ...sept.filter((s) => s !== tire)] : sept;
  if (tire && !sept.includes(tire)) facades.splice(TIROIRS);

  const contenu: Ligne[] = [];
  if (e && tire) {
    contenu.push({
      nom: e.motif === 'devis' ? (e.devis?.title ? `Devis « ${e.devis.title} »` : 'Devis') : 'Facture échue',
      detail: `${e.motif === 'devis' ? 'remise' : 'rendez-vous'} à ${hhmm(new Date(e.rdv.startAt))} avec ${e.rdv.clientName}${e.jours !== null ? `, ${enLettres(e.jours)} jour${e.jours > 1 ? 's' : ''} ${e.motif === 'devis' ? 'sans réponse' : 'de retard'}` : ''}`,
    });
    if (j.retard.n > 0) contenu.push({ nom: 'Facturation', detail: `${j.retard.n} facture${j.retard.n > 1 ? 's' : ''} en retard · ${euros(j.retard.cents)}` });
    contenu.push({ nom: 'Encaissé aujourd’hui', detail: j.encaisseJour > 0 ? euros(j.encaisseJour) : 'rien encore' });
    for (const l of lignesDe.get(tire.key) ?? []) if (contenu.length < 4 && !l.nom.includes(e.rdv.clientName)) contenu.push(l);
  }

  const etat = (s: NavSection) => lignesDe.get(s.key)?.[0]?.nom ?? 'Rien en attente';

  return (
    <SiPremierJour j={j}>
      <div className="flex flex-col gap-6">
        <EnTeteAccueil j={j} nom="Les tiroirs" />
        <section className="panel-raised panel-raised-wide px-4 py-[26px] sm:px-7">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="eyebrow text-text-secondary">Le meuble</span>
            <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
              {facades.length} FAMILLES LES PLUS ACTIVES · {tire ? '1 TIROIR TIRÉ' : 'AUCUN TIROIR TIRÉ'}
            </span>
          </div>
          <div className={`grid grid-cols-2 gap-2.5 ${tire ? 'lg:grid-cols-5' : 'md:grid-cols-4'}`}>
            {facades.map((s) =>
              s === tire ? (
                <div
                  key={s.key}
                  className="col-span-2 flex min-w-0 flex-col gap-2.5 border border-border-strong bg-[#1c1c1c] px-5 py-[18px] shadow-[0_26px_50px_-22px_rgba(0,0,0,1)] lg:row-span-2"
                >
                  <span data-signal-groupe="tiroir" className="h-1.5 w-14 self-center rounded-[3px] bg-signal shadow-[0_0_18px_-2px_rgba(208,154,74,.9)]" />
                  <span className="flex items-baseline justify-between gap-3">
                    <Link to={s.items[0]?.to ?? '/'} data-signal-groupe="tiroir" className="text-[17px] font-bold text-signal">
                      {libelleSection(s.label)}
                    </Link>
                    <span className="tnum whitespace-nowrap font-mono text-[11px] font-medium text-text-muted">{s.items.length} modules</span>
                  </span>
                  {contenu.map((l) => (
                    <span key={l.nom} className="flex flex-col gap-[3px] border-t border-border-raised py-[9px]">
                      <span className="text-[13.5px] font-semibold text-text-primary">{l.nom}</span>
                      <span className="text-[12.5px] leading-[1.45] text-text-secondary [text-wrap:pretty]">{l.detail}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <Link
                  key={s.key}
                  to={s.items[0]?.to ?? '/'}
                  className="flex min-w-0 flex-col gap-[9px] border border-border-section bg-raised px-4 py-3.5 shadow-[inset_0_-3px_0_var(--color-sunken)] hover:border-border-strong"
                >
                  <span className="h-[5px] w-11 self-center rounded-[3px] bg-[#2b2b2b]" />
                  <span className="flex items-baseline justify-between gap-2.5">
                    <span className="min-w-0 text-[13.5px] font-semibold text-text-body">{libelleSection(s.label)}</span>
                    <span className="tnum font-mono text-[10.5px] font-medium text-text-muted">{s.items.length}</span>
                  </span>
                  <span className="line-clamp-2 text-[12px] leading-[1.45] text-text-muted [text-wrap:pretty]">{etat(s)}</span>
                </Link>
              ),
            )}
          </div>
          <p className="mt-4 text-[13px] text-text-muted">
            {autres > 0 ? `${autres === 1 ? 'L’autre famille est' : `Les ${enLettres(autres)} autres familles sont`} au rail. ` : ''}
            Un tiroir ne s’ouvre que s’il a quelque chose à montrer.
          </p>
        </section>
      </div>
    </SiPremierJour>
  );
}
