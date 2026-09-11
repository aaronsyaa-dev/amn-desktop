import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Plus, Trash2 } from 'lucide-react';
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
  const septJours = useMemo(() => Array.from({ length: 7 }, (_, i) => isoJour(new Date(Date.now() - (6 - i) * 86_400_000))), []);

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
        <motion.div variants={staggerItem} className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse">
              <thead>
                <tr>
                  <th className="eyebrow border-b border-border px-3 py-3 text-left font-bold">
                    {t('routines.ceQuiRevient')}
                  </th>
                  {septJours.map((d) => {
                    const ceJour = new Date(`${d}T00:00:00`);
                    const estAujourdhui = d === aujourdhui;
                    return (
                      <th
                        key={d}
                        data-signal-groupe={estAujourdhui ? 'serie-en-cours' : undefined}
                        className={`w-[62px] border-b px-2 py-3 text-center ${
                          estAujourdhui ? 'signal-plate border-signal' : 'border-border'
                        }`}
                      >
                        <span
                          className={`block font-mono text-[9.5px] font-bold uppercase tracking-[0.15em] ${
                            estAujourdhui ? 'text-signal-ink' : 'text-text-muted'
                          }`}
                        >
                          {estAujourdhui
                            ? t('routines.auj')
                            : ceJour.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}
                        </span>
                        <span
                          className={`tnum mt-1 block font-mono text-[11px] ${
                            estAujourdhui ? 'text-signal-ink' : 'text-text-secondary'
                          }`}
                        >
                          {String(ceJour.getDate()).padStart(2, '0')}
                        </span>
                      </th>
                    );
                  })}
                  <th className="eyebrow w-[74px] border-b border-border px-3 py-3 text-right font-bold">
                    {t('routines.serieCourte')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {routines.map((r) => {
                  const faite = r.ticks.includes(aujourdhui);
                  const serie = serieDe(r.ticks);
                  return (
                    <tr key={r.id} className="group border-b border-[#161616] last:border-b-0">
                      <td className="px-3 py-3.5">
                        <span className="flex items-center gap-3">
                          <span className={`min-w-0 flex-1 truncate text-[14.5px] ${faite ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
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
                      </td>
                      {septJours.map((d) => {
                        const coche = r.ticks.includes(d);
                        const estAujourdhui = d === aujourdhui;
                        /*
                          UNE CASE NE SE COCHE QUE POUR AUJOURD'HUI.

                          Le modèle garde une liste de jours, donc rien
                          n'empêcherait techniquement de cocher mardi dernier —
                          et c'est précisément ce qu'il ne faut pas offrir : une
                          série qu'on peut rattraper après coup ne mesure plus
                          rien. Les autres colonnes sont donc des cellules, pas
                          des boutons, et le pied de tableau le dit.
                        */
                        const carre = coche
                          ? 'border-text-primary bg-text-primary'
                          : estAujourdhui
                            ? 'border-signal-ink/40 bg-signal-ink/10'
                            : 'border-[#2b2b2b] bg-[#2b2b2b]';
                        const contenu = (
                          <span
                            className={`mx-auto flex h-[18px] w-[18px] items-center justify-center border ${carre}`}
                          >
                            {coche && <Check size={12} strokeWidth={3} className="text-bg" />}
                          </span>
                        );
                        return (
                          <td
                            key={d}
                            data-signal-groupe={estAujourdhui ? 'serie-en-cours' : undefined}
                            className={`px-2 py-3.5 ${estAujourdhui ? 'bg-signal-muted' : ''}`}
                          >
                            {estAujourdhui ? (
                              <button
                                type="button"
                                onClick={() => void basculer(r)}
                                aria-pressed={faite}
                                aria-label={`${r.label} — ${faite ? t('routines.faite') : t('routines.aFaire')}`}
                                className="flex min-h-11 w-full items-center justify-center md:min-h-0"
                              >
                                {contenu}
                              </button>
                            ) : (
                              contenu
                            )}
                          </td>
                        );
                      })}
                      <td className="tnum px-3 py-3.5 text-right font-mono text-[15px] font-semibold tracking-[-0.03em] text-text-primary">
                        {serie}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* La règle du jeu, écrite une fois sous le tableau : sans elle, une
              série qui retombe à zéro passe pour un bug. */}
          <p className="font-mono text-[9.5px] uppercase leading-[1.7] tracking-[0.14em] text-text-muted">
            {t('routines.regleDuJeu')}
          </p>
        </motion.div>
      )}

    </motion.section>
  );
}
