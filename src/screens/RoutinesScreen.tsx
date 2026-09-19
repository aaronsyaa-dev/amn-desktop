import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface RoutineData {
  label: string;
  /** Jours ISO (AAAA-MM-JJ) où la routine a été cochée. */
  ticks: string[];
  createdAt: string;
}
const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Jours consécutifs cochés en remontant depuis aujourd'hui (ou hier, si aujourd'hui n'est pas encore fait). */
function serieDe(ticks: string[]): number {
  const set = new Set(ticks);
  let k = set.has(isoJour(new Date())) ? 0 : 1;
  let n = 0;
  for (; k < 400; k += 1) {
    if (!set.has(isoJour(new Date(Date.now() - k * 86_400_000)))) break;
    n += 1;
  }
  return n;
}

/**
 * LES ROUTINES — ce qui revient, coché chaque jour.
 *
 * Pour qui : une équipe dont les gestes récurrents (relever la caisse,
 * sortir les poubelles, vérifier le frigo) se font quand on y pense. Ce que
 * ça règle : une case par jour et une série de jours tenus — ce qui tient se
 * voit, ce qui glisse aussi. Les Contrôles qualité gardent une trace signée
 * point par point ; une routine, c'est juste fait ou pas fait.
 */
export function RoutinesScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<RoutineData>('routines');
  const [ouvert, setOuvert] = useState(false);
  const [label, setLabel] = useState('');
  const aujourdhui = isoJour(new Date());

  const routines = useMemo(() => [...brutes].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [brutes]);
  const faites = routines.filter((r) => r.ticks.includes(aujourdhui)).length;
  const ratioDuJour = `${faites}/${routines.length}`;
  const meilleure = routines.reduce((n, r) => Math.max(n, serieDe(r.ticks)), 0);

  /*
    L'AXE FAIT EXACTEMENT 28 JOURS — c'est la règle du paquet, et elle a une
    raison : quatre semaines pleines montrent le même jour de semaine quatre
    fois, donc un manque qui revient toujours le jeudi se voit comme une
    colonne trouée. Sur trente jours, les semaines se décalent et le motif
    disparaît.
  */
  const JOURS_AXE = 28;
  const axe = useMemo(
    () => Array.from({ length: JOURS_AXE }, (_, i) => isoJour(new Date(Date.now() - (JOURS_AXE - 1 - i) * 86_400_000))),
    [],
  );

  /*
    LA SÉRIE ININTERROMPUE — l'unique ambre, et il récompense la CONTINUITÉ,
    pas la performance. Une routine cochée vingt-sept jours sur vingt-huit
    n'a pas de série : elle a un trou. C'est exactement ce que l'instrument
    doit rendre visible.

    La routine doit aussi avoir existé sur toute la fenêtre : une routine
    créée avant-hier et cochée deux fois n'a pas « tenu vingt-huit jours ».
  */
  const ininterrompue = useMemo(() => {
    const debutAxe = axe[0];
    for (const r of routines) {
      if (r.createdAt.slice(0, 10) > debutAxe) continue;
      if (axe.every((d) => r.ticks.includes(d))) return r.id;
    }
    return null;
  }, [routines, axe]);

  /*
    LA ROUTINE QUI CASSE, et QUAND elle casse. Sept barres, une par jour de
    semaine : c'est le diagnostic que le module doit rendre — « le point stock
    échoue le jeudi » — et il ne se lit dans aucun compteur.
  */
  const diagnostic = useMemo(() => {
    /*
      ON NE CHERCHE PAS CELLE QUI MANQUE LE PLUS, mais celle dont les manques
      se CONCENTRENT sur un jour de semaine — et la nuance change tout.

      Une routine manquée partout est une routine qu'on ne fait pas : sept
      barres égales, aucun diagnostic, et la seule réponse honnête est « vous
      ne la faites pas ». Une routine manquée quatre fois, toujours le jeudi,
      est une routine MAL POSÉE : elle tombe le jour de la livraison, ou du
      marché, ou de la fermeture. C'est celle-là que l'instrument doit
      désigner, parce que c'est la seule dont le remède est de la déplacer.

      La mesure est donc la part du pire jour dans le total des manques, et
      non le total. Trois manques au minimum : sous ce seuil, une pointe n'est
      qu'un hasard.
    */
    let choisie: { id: string; label: string; manques: number[]; concentration: number } | null = null;
    for (const r of routines) {
      const manques = [0, 0, 0, 0, 0, 0, 0];
      let total = 0;
      for (const d of axe) {
        if (r.createdAt.slice(0, 10) > d) continue;
        if (r.ticks.includes(d)) continue;
        // `getDay()` rend 0 = dimanche ; on range du lundi au dimanche.
        const jour = (new Date(`${d}T00:00:00`).getDay() + 6) % 7;
        manques[jour] += 1;
        total += 1;
      }
      if (total < 3) continue;
      const concentration = Math.max(...manques) / total;
      if (choisie === null || concentration > choisie.concentration) {
        choisie = { id: r.id, label: r.label, manques, concentration };
      }
    }
    return choisie;
  }, [routines, axe]);

  /*
    LA TENUE GÉNÉRALE, et ce qu'elle vaudrait sans la routine mal posée. Le
    deuxième chiffre n'est pas une consolation : il dit qu'une routine
    impossible à tenir fait baisser la lecture de toutes les autres, et que la
    réponse est de la déplacer, pas de se forcer.
  */
  const tenue = useMemo(() => {
    const compter = (liste: typeof routines) => {
      let faits = 0;
      let possibles = 0;
      for (const r of liste) {
        for (const d of axe) {
          if (r.createdAt.slice(0, 10) > d) continue;
          possibles += 1;
          if (r.ticks.includes(d)) faits += 1;
        }
      }
      return possibles === 0 ? null : Math.round((faits / possibles) * 100);
    };
    const globale = compter(routines);
    const sansLaPire = diagnostic ? compter(routines.filter((r) => r.id !== diagnostic.id)) : null;
    return { globale, sansLaPire };
  }, [routines, axe, diagnostic]);

  /* La phrase sous le titre dit l'état du jour, pas la nature du module : « il
     reste deux gestes » est ce qu'on vient chercher, et ça change chaque matin. */
  const resume = useMemo(() => {
    /*
      LE PLURIEL S'ÉCRIT, IL NE SE PARENTHÈSE PAS.

      « 3 geste(s) sur 5 sont faits. 2 attende(nt) encore. » passe dans un
      libellé de colonne ; dans une PHRASE, sous un titre, c'est illisible. Les
      quatre cas se comptent sur les doigts d'une main, alors ils s'écrivent.
    */
    if (routines.length === 0) return t('routines.description');
    const reste = routines.length - faites;
    if (reste === 0) return t('routines.toutFait', { n: routines.length });
    if (faites === 0) return t('routines.bilanRienFait', { total: routines.length });
    if (faites === 1) return t('routines.bilanUnFait', { total: routines.length, reste });
    if (reste === 1) return t('routines.bilanUnReste', { faits: faites, total: routines.length });
    return t('routines.bilanDuJour', { faits: faites, total: routines.length, reste });
  }, [routines.length, faites, t]);

  const ajouter = async () => {
    if (!label.trim()) return;
    await upsert('routines', uid('rtn'), { label: label.trim(), ticks: [], createdAt: new Date().toISOString() });
    setLabel(''); setOuvert(false);
  };
  const basculer = (r: RoutineData & { id: string }) =>
    upsert('routines', r.id, { ...r, ticks: r.ticks.includes(aujourdhui) ? r.ticks.filter((d) => d !== aujourdhui) : [...r.ticks, aujourdhui].sort() });

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('pilotage.surtitre', { module: t('routines.titre') })}
          title={t('routines.titre')}
          description={resume}
          stats={[
            { label: t('routines.stat.aujourdhui'), value: ratioDuJour, emphasis: routines.length > 0 && faites === routines.length },
            { label: t('routines.stat.meilleureSerie'), value: meilleure },
            { label: t('routines.stat.routines'), value: routines.length },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('routines.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-4">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('routines.champ')} aria-label={t('routines.champ')} autoFocus className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <button type="submit" disabled={!label.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('routines.enregistrer')}</button>
          <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
        </motion.form>
      )}

      {routines.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('routines.vide.titre')} action={{ label: t('routines.vide.action'), onClick: () => setOuvert(true) }}>{t('routines.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        /*
          LA MATRICE JOUR × ROUTINE — l'objet dominant de cet écran.

          C'était une pile de cartes : une routine par carte, avec sa case, son
          intitulé, sa série, et sept petits carrés de 10 px pour l'historique.
          Chaque carte était juste, et l'ensemble ne répondait pas à la question
          qu'on pose ici — « où est-ce que ça glisse » — parce que comparer sept
          carrés de 10 px d'une carte à ceux de la carte du dessous demande de
          les aligner mentalement.

          Une matrice les aligne pour de bon : une ligne par routine, une
          colonne par jour, et le trou se voit sans être cherché.

          L'AMBRE est celui que la table nomme, « la série en cours » : la
          colonne d'AUJOURD'HUI, seule colonne où l'on peut encore agir. Son
          en-tête est une plaque pleine en encre de signal, et la colonne porte
          un fond teinté qui lui appartient — même groupe, un seul objet.
        */
        <motion.div variants={staggerItem} className="flex flex-col gap-[18px]">
          {/* ── L'OBJET DOMINANT : la matrice de séries ─────────────────── */}
          <section className="panel-raised panel-raised-wide px-[30px] pb-[26px] pt-[30px]">
            <div className="mb-[22px] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <span className="eyebrow text-text-secondary">{t('routines.ceQuiRevient')} · 28 jours</span>
              <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
                {ininterrompue ? 'UNE SÉRIE JAMAIS ROMPUE' : 'AUCUNE SÉRIE COMPLÈTE'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[680px]">
                {routines.map((r) => {
                  const serie = serieDe(r.ticks);
                  const ambre = ininterrompue === r.id;
                  const faite = r.ticks.includes(aujourdhui);
                  return (
                    <div
                      key={r.id}
                      data-signal-groupe={ambre ? 'serie-ininterrompue' : undefined}
                      className="group grid grid-cols-[180px_1fr_58px] items-center gap-4 border-b border-[#161616] py-2.5 last:border-b-0"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={`min-w-0 flex-1 truncate text-[13.5px] ${
                            faite ? 'font-semibold text-text-primary' : 'text-text-secondary'
                          }`}
                          title={r.label}
                        >
                          {r.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => void remove('routines', r.id)}
                          aria-label={t('routines.supprimer')}
                          title={t('routines.supprimer')}
                          className="flex-shrink-0 text-text-muted opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 size={13} strokeWidth={1.9} />
                        </button>
                      </span>

                      {/*
                        LES VINGT-HUIT CASES, de largeur égale. La série se lit
                        comme un TRAIT CONTINU que les manques interrompent :
                        c'est la forme de la régularité, pas un compteur.

                        ARBITRAGE SUR LES TROIS ÉTATS. Le paquet décrit
                        « pleine (fait), grise (partiel), vide cerclée
                        (manqué) ». Le modèle ne connaît pas le partiel — une
                        routine est cochée ou ne l'est pas, et c'est
                        volontaire : « une routine, c'est juste fait ou pas
                        fait » (en-tête de ce fichier). Les trois états rendus
                        sont donc pleine / vide cerclée / rien-du-tout, ce
                        dernier pour les jours ANTÉRIEURS à la création de la
                        routine — qui ne sont pas des manques. Inventer un
                        partiel demanderait un champ que personne ne
                        remplirait.
                      */}
                      <span className="flex min-w-0 gap-[3px]">
                        {axe.map((d) => {
                          const coche = r.ticks.includes(d);
                          const avantCreation = r.createdAt.slice(0, 10) > d;
                          const estAujourdhui = d === aujourdhui;
                          const contenu = (
                            <span
                              className={`block h-[18px] w-full ${
                                avantCreation
                                  ? ''
                                  : coche
                                    ? ambre
                                      ? 'bg-signal'
                                      : 'bg-text-primary'
                                    : 'border border-border-section'
                              }`}
                            />
                          );
                          /* Une case ne se coche que pour AUJOURD'HUI : une
                             série qu'on rattrape après coup ne mesure plus
                             rien. Les autres cases ne sont pas des boutons. */
                          return estAujourdhui ? (
                            <button
                              key={d}
                              type="button"
                              onClick={() => void basculer(r)}
                              aria-pressed={coche}
                              aria-label={`${r.label} — ${coche ? t('routines.faite') : t('routines.aFaire')}`}
                              className="min-w-0 flex-1"
                              title={d}
                            >
                              {contenu}
                            </button>
                          ) : (
                            <span key={d} className="min-w-0 flex-1" title={d}>
                              {contenu}
                            </span>
                          );
                        })}
                      </span>

                      {/* LE COMPTE : la série EN COURS, jamais le total de
                          jours tenus. Les deux diffèrent dès le premier trou,
                          et c'est le premier que l'instrument mesure. */}
                      <span
                        data-signal-groupe={ambre ? 'serie-ininterrompue' : undefined}
                        className={`tnum text-right font-mono text-[15px] font-semibold tracking-[-0.03em] ${
                          ambre ? 'text-signal' : 'text-text-primary'
                        }`}
                      >
                        {serie}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-3.5 flex justify-between font-mono text-[9.5px] tracking-[0.1em] text-text-muted">
              <span>
                {new Date(`${axe[0]}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
              </span>
              <span>{t('routines.auj')}</span>
            </div>

            <p className="mt-5 border-t border-border-raised pt-[22px] font-mono text-[9.5px] uppercase leading-[1.7] tracking-[0.14em] text-text-muted">
              {t('routines.regleDuJeu')}
            </p>
          </section>

          {/* ── AUTOUR : où ça casse, et ce que ça coûte ───────────────── */}
          <div className="grid gap-[18px] lg:grid-cols-[1fr_340px]">
            <section className="panel min-w-0 px-[22px] pb-[18px] pt-5">
              <div className="mb-[18px] flex items-baseline justify-between gap-4">
                <span className="eyebrow text-text-secondary">Où ça casse</span>
                {diagnostic && (
                  <span className="min-w-0 truncate font-mono text-[10px] tracking-[0.1em] text-text-muted">
                    {diagnostic.label.toUpperCase()}
                  </span>
                )}
              </div>
              {diagnostic ? (
                <>
                  <div className="flex h-[88px] items-end gap-3">
                    {diagnostic.manques.map((n, i) => {
                      const plafond = Math.max(1, ...diagnostic.manques);
                      return (
                        <span
                          key={i}
                          className={`flex-1 ${n === plafond && n > 0 ? 'bg-text-primary' : 'bg-border-strong'}`}
                          style={{ height: `${Math.max(3, (n / plafond) * 88)}px` }}
                          title={`${n} manque${n > 1 ? 's' : ''}`}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-2.5 flex gap-3 font-mono text-[9.5px] tracking-[0.1em] text-text-muted">
                    {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((j, i) => (
                      <span key={i} className="flex-1 text-center">
                        {j}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-[13.5px] leading-[1.6] text-text-secondary [text-wrap:pretty]">
                    {diagnostic.concentration >= 0.6
                      ? 'Le manque revient le même jour de semaine. Une routine qui casse toujours au même endroit n’est pas un manque de discipline : elle est mal posée.'
                      : 'Les manques se répartissent sur toute la semaine : rien n’indique un jour qui coince, seulement une routine qu’on ne fait pas.'}
                  </p>
                </>
              ) : (
                <p className="py-3 text-[13.5px] leading-[1.7] text-text-secondary">
                  Rien ne casse sur les vingt-huit derniers jours.
                </p>
              )}
            </section>

            <section className="panel flex flex-col px-5 pb-[18px] pt-5">
              <span className="eyebrow mb-5 text-text-secondary">La tenue</span>
              <span className="tnum block font-mono text-[40px] font-bold leading-[.92] tracking-[-0.04em] text-text-primary">
                {tenue.globale === null ? '—' : `${tenue.globale} %`}
              </span>
              <span className="mt-2.5 block text-[13.5px] leading-[1.55] text-text-secondary">
                des cases cochées sur les vingt-huit jours.
              </span>
              {tenue.sansLaPire !== null && tenue.globale !== null && tenue.sansLaPire > tenue.globale && (
                <span className="mt-4 block border-t border-border pt-4 font-mono text-[10px] leading-[1.7] tracking-[0.1em] text-text-muted">
                  SANS « {diagnostic?.label.toUpperCase()} » · {tenue.sansLaPire} %
                </span>
              )}
            </section>
          </div>
        </motion.div>
      )}

    </motion.section>
  );
}
