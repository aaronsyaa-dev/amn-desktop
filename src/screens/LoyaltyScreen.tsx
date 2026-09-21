import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Gift, Plus, Search, Stamp } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface LoyaltyCardData {
  customerName: string;
  stamps: number;
  rewards: number;
  lastStampAt: string;
  createdAt: string;
}
const SEUIL = 10;

/**
 * LA FIDÉLITÉ — la carte à tampons, sans le carton.
 *
 * Pour qui : une boutique, un salon, un traiteur — dix passages, le onzième
 * offert. Ce que ça règle : la carte perdue, le tampon oublié, le compte
 * qu'on refait de tête. Une carte par personne, un tampon par passage, une
 * récompense quand la ligne est pleine. Dix par ligne, c'est le seuil des
 * cartes en carton ; assez simple pour ne pas devenir un programme.
 */
/**
 * LA CARTE CARTONNÉE — l'objet dominant de Fidélité (`23b`)
 * ════════════════════════════════════════════════════════
 *
 * Un compteur « 9/10 » n'a aucune force. Neuf tampons et une case vide en ont,
 * et LA CASE VIDE EST LE MESSAGE DU MODULE : on la voit avant de lire le
 * chiffre, et on sait ce qu'il reste à faire sans compter.
 *
 * DEUX RÈGLES DU PAQUET, ET LEUR RAISON.
 *
 *   1. **Dix emplacements en dur, et le dixième se dessine toujours.** Une
 *      grille qui n'afficherait que les tampons posés redeviendrait un
 *      compteur : ce qui manque ne se verrait plus.
 *
 *   2. **Les tampons ont une rotation légère et VARIABLE** — « un tampon
 *      parfaitement droit casse l'objet ». Dix tampons alignés au degré près
 *      ne sont pas des tampons, ce sont des cases cochées, et la carte
 *      redevient un tableau.
 *
 * LA ROTATION EST DÉTERMINISTE, ET C'EST INDISPENSABLE. Un `Math.random()`
 * redonnerait un angle différent à chaque rendu : les tampons frémiraient à
 * chaque frappe au clavier, ce qui est pire qu'une carte droite. L'angle se
 * déduit donc de l'identifiant de la carte et du rang du tampon — même carte,
 * même tampon, même angle, toujours, sur n'importe quelle donnée réelle.
 */
const CASES = SEUIL;

/**
 * Un angle en degrés dans [-7, +7], déduit de deux entrées stables.
 *
 * Le mélange est un petit hachage entier : il n'a pas besoin d'être solide,
 * seulement de ne pas produire la même valeur pour deux rangs voisins — sans
 * quoi les tampons d'une même carte pencheraient tous du même côté, ce qui
 * est exactement l'alignement qu'on cherche à éviter.
 */
function angleTampon(cle: string, rang: number): number {
  let h = 2166136261 ^ rang * 16777619;
  for (let i = 0; i < cle.length; i += 1) {
    h = Math.imul(h ^ cle.charCodeAt(i), 16777619);
  }
  return (((h >>> 0) % 1400) / 100 - 7);
}

/** Un léger décalage de position, pour la même raison que l'angle. */
function decalageTampon(cle: string, rang: number): { x: number; y: number } {
  const a = angleTampon(cle, rang * 3 + 1);
  const b = angleTampon(cle, rang * 5 + 2);
  return { x: a / 4, y: b / 5 };
}

function CarteATampons({
  carte,
  onTamponner,
  onOffrir,
}: {
  carte: LoyaltyCardData & { id: string };
  onTamponner: () => void;
  onOffrir: () => void;
}) {
  const pleine = carte.stamps >= CASES;
  return (
    <div className="min-w-[320px] flex-1">
      {/* Le carton, sur papier clair. */}
      <div className="bg-[var(--color-text-primary)] px-8 pb-8 pt-7 text-[#0a0a0a] shadow-[0_26px_50px_-24px_rgba(0,0,0,1)]">
        <div className="flex items-baseline justify-between gap-4 border-b border-[#d5d5d1] pb-4">
          <span className="min-w-0">
            <span className="block font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#5c5c59]">
              Carte de fidélité
            </span>
            <span className="mt-1.5 block truncate text-[22px] font-bold leading-[1.15] tracking-[-0.02em]">
              {carte.customerName}
            </span>
          </span>
          <span className="flex-none text-right">
            <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#5c5c59]">Ouverte le</span>
            <span className="tnum mt-1 block font-mono text-[12px] font-semibold">
              {new Date(carte.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
            </span>
          </span>
        </div>

        <div className="mt-6 grid grid-cols-5 gap-x-4 gap-y-5">
          {Array.from({ length: CASES }, (_, i) => {
            const appose = i < carte.stamps;
            /* LE DIXIÈME, CELUI QUI N'EST PAS ENCORE APPOSÉ : c'est lui qui
               porte l'ambre, et c'est le sujet entier de l'écran. Il n'est en
               attente que s'il est le PROCHAIN — une carte à trois tampons a
               sept cases vides, pas sept promesses. */
            const enAttente = !appose && i === carte.stamps && i === CASES - 1;
            const angle = angleTampon(carte.id, i);
            const d = decalageTampon(carte.id, i);
            return (
              <span key={i} className="flex items-center justify-center">
                {appose ? (
                  <span
                    className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-2 border-[#7a4a3a] text-[#7a4a3a]"
                    style={{ transform: `rotate(${angle.toFixed(2)}deg) translate(${d.x.toFixed(2)}px, ${d.y.toFixed(2)}px)` }}
                    aria-label={`Tampon ${i + 1}`}
                  >
                    <Stamp size={22} strokeWidth={1.9} />
                  </span>
                ) : enAttente ? (
                  <span
                    data-signal-groupe="dixieme-tampon"
                    className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-signal text-signal-ink shadow-[0_0_26px_-4px_var(--color-signal-glow)]"
                    style={{ transform: `rotate(${angle.toFixed(2)}deg)` }}
                    aria-label="Dixième tampon, en attente"
                  >
                    <Stamp size={22} strokeWidth={2.1} />
                  </span>
                ) : (
                  <span
                    className="h-[52px] w-[52px] rounded-full border-2 border-dashed border-[#c8c8c4]"
                    aria-hidden
                  />
                )}
              </span>
            );
          })}
        </div>

        <p className="mt-7 border-t border-[#d5d5d1] pt-4 text-[13px] leading-[1.5] text-[#26262a]">
          {pleine
            ? 'La ligne est pleine. La prochaine intervention est offerte.'
            : carte.stamps === CASES - 1
              ? 'Il manque un tampon. Le prochain passage remplit la carte.'
              : `${CASES - carte.stamps} passages avant la récompense.`}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {pleine ? (
          <button
            type="button"
            onClick={onOffrir}
            className="flex min-h-11 items-center gap-2 bg-accent px-4 text-[12.5px] font-semibold text-bg shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)] transition-colors hover:bg-accent-hover"
          >
            <Gift size={15} strokeWidth={2} /> Offrir la récompense
          </button>
        ) : (
          <button
            type="button"
            onClick={onTamponner}
            className="flex min-h-11 items-center gap-2 border border-border-strong px-4 text-[12.5px] text-text-primary transition-colors hover:bg-surface-hover"
          >
            <Stamp size={15} strokeWidth={1.9} /> Tamponner
          </button>
        )}
      </div>
    </div>
  );
}

export function LoyaltyScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<LoyaltyCardData>('loyaltyCards');
  const [recherche, setRecherche] = useState('');
  const [nouveau, setNouveau] = useState('');

  const cartes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return [...brutes].filter((c) => !q || c.customerName.toLowerCase().includes(q)).sort((a, b) => (b.lastStampAt || '').localeCompare(a.lastStampAt || ''));
  }, [brutes, recherche]);
  const pleines = brutes.filter((c) => c.stamps >= SEUIL).length;
  const tampons = brutes.reduce((n, c) => n + c.stamps + c.rewards * SEUIL, 0);
  const remises = brutes.reduce((n, c) => n + c.rewards, 0);

  /*
    LA CARTE MONTRÉE EN GRAND : celle qui est LE PLUS PRÈS DU DIXIÈME TAMPON.

    Le sujet du module est la case vide, donc la carte qui en a le moins. À
    égalité, la plus récemment tamponnée — c'est celle qu'on a en main.
  */
  const carteDuJour = useMemo(() => {
    const candidates = [...brutes].filter((c) => c.stamps < SEUIL);
    if (candidates.length === 0) return brutes[0] ?? null;
    return candidates.sort(
      (a, b) => b.stamps - a.stamps || (b.lastStampAt || '').localeCompare(a.lastStampAt || ''),
    )[0];
  }, [brutes]);

  const creer = async () => {
    if (!nouveau.trim()) return;
    await upsert('loyaltyCards', uid('fid'), { customerName: nouveau.trim(), stamps: 0, rewards: 0, lastStampAt: '', createdAt: new Date().toISOString() });
    setNouveau('');
  };
  const tamponner = (c: LoyaltyCardData & { id: string }) => upsert('loyaltyCards', c.id, { ...c, stamps: Math.min(SEUIL, c.stamps + 1), lastStampAt: new Date().toISOString() });
  const offrir = (c: LoyaltyCardData & { id: string }) => upsert('loyaltyCards', c.id, { ...c, stamps: 0, rewards: c.rewards + 1, lastStampAt: new Date().toISOString() });

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('commerce.surtitre', { module: t('fidelite.titre') })}
          title={t('fidelite.titre')}
          description={t('fidelite.description', { seuil: SEUIL })}
          stats={[
            { label: t('fidelite.stat.cartes'), value: brutes.length },
            { label: t('fidelite.stat.pleines'), value: pleines, emphasis: pleines > 0 },
            { label: t('fidelite.stat.tampons'), value: tampons },
          ]}
        />
      </motion.div>

      <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void creer(); }} className="flex flex-wrap gap-2">
        <input value={nouveau} onChange={(e) => setNouveau(e.target.value)} placeholder={t('fidelite.champNom')} aria-label={t('fidelite.champNom')} className="input-focus min-h-11 min-w-[14rem] flex-1 border border-border bg-surface px-3 text-sm text-text-primary outline-none sm:max-w-sm" />
        <button type="submit" disabled={!nouveau.trim()} className="flex min-h-11 items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-40"><Plus size={15} /> {t('fidelite.nouvelleCarte')}</button>
        {brutes.length > 3 && (
          <label className="input-focus flex min-h-11 items-center gap-2 border border-border bg-surface px-3">
            <Search size={14} className="text-text-muted" />
            <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder={t('fidelite.rechercher')} aria-label={t('fidelite.rechercher')} className="min-w-0 bg-transparent text-sm text-text-primary outline-none" />
          </label>
        )}
      </motion.form>

      {brutes.length === 0 ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('fidelite.vide.titre')}>{t('fidelite.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <>
          {/* ── L'OBJET DOMINANT : la carte, et sa case vide ─────────────── */}
          {carteDuJour && (
            <motion.section variants={staggerItem} className="panel-raised panel-raised-wide flex flex-wrap items-start gap-x-9 gap-y-7 px-[30px] pb-[26px] pt-[30px]">
              <CarteATampons
                carte={carteDuJour}
                onTamponner={() => void tamponner(carteDuJour)}
                onOffrir={() => void offrir(carteDuJour)}
              />

              <div className="flex min-w-[240px] flex-1 flex-col gap-6">
                <div>
                  <span className="eyebrow block text-text-secondary">Ce que le dixième déclenche</span>
                  <dl className="mt-4 flex flex-col gap-3">
                    <div className="flex items-baseline justify-between gap-3 border-b border-border-row pb-2.5">
                      <dt className="text-[13px] text-text-secondary">Tampons posés</dt>
                      <dd className="tnum font-mono text-[19px] font-semibold text-text-primary">
                        {carteDuJour.stamps}/{SEUIL}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 border-b border-border-row pb-2.5">
                      <dt className="text-[13px] text-text-secondary">Dernier passage</dt>
                      <dd className="font-mono text-[12.5px] text-text-primary">
                        {carteDuJour.lastStampAt ? relativeTime(carteDuJour.lastStampAt) : t('fidelite.jamais')}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[13px] text-text-secondary">Récompenses déjà offertes</dt>
                      <dd className="tnum font-mono text-[19px] font-semibold text-text-secondary">
                        {carteDuJour.rewards}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="border-t border-border-raised pt-5">
                  <span className="eyebrow block text-text-secondary">Le programme</span>
                  <dl className="mt-4 flex flex-col gap-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[13px] text-text-secondary">Cartes en cours</dt>
                      <dd className="tnum font-mono text-[17px] font-semibold text-text-primary">{brutes.length}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[13px] text-text-secondary">Lignes complétées</dt>
                      <dd className="tnum font-mono text-[17px] font-semibold text-text-primary">{remises}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[13px] text-text-secondary">Tampons au total</dt>
                      <dd className="tnum font-mono text-[17px] font-semibold text-text-secondary">{tampons}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </motion.section>
          )}

          {/* ── AUTOUR : les cartes en cours, en rangées de dix pastilles ── */}
          <motion.section variants={staggerItem} className="panel px-[22px] pb-[18px] pt-5">
            <div className="mb-[18px] flex items-baseline justify-between gap-4">
              <span className="eyebrow text-text-secondary">Les cartes en cours</span>
              <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
                {brutes.length} CARTE{brutes.length > 1 ? 'S' : ''} · {pleines} PLEINE{pleines > 1 ? 'S' : ''}
              </span>
            </div>
            <ul className="flex flex-col">
              {cartes.map((c) => (
                <li
                  key={c.id}
                  className="group grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border-row py-2.5 last:border-b-0"
                >
                  <span className="min-w-0 truncate text-[13.5px] text-text-primary">{c.customerName}</span>
                  {/* Dix pastilles, toujours dix : la rangée dit d'un coup
                      d'œil où en est chaque carte, sans compteur. */}
                  <span className="flex gap-1">
                    {Array.from({ length: SEUIL }, (_, i) => (
                      <span
                        key={i}
                        className={`h-2.5 w-2.5 rounded-full ${
                          i < c.stamps ? 'bg-text-primary' : 'border border-border-section'
                        }`}
                      />
                    ))}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tnum w-[46px] text-right font-mono text-[12.5px] text-text-secondary">
                      {c.stamps}/{SEUIL}
                    </span>
                    <button
                      type="button"
                      onClick={() => void remove('loyaltyCards', c.id)}
                      aria-label={t('fidelite.supprimer')}
                      title={t('fidelite.supprimer')}
                      className="text-[10px] uppercase tracking-wider text-text-muted opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
                    >
                      {t('fidelite.supprimerCourt')}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </motion.section>
        </>
      )}

    </motion.section>
  );
}
