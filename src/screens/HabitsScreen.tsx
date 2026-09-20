import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { EcranVide, useHaloSignal } from '../components/EtatEcran';
import { usePersonalStore } from '../state/usePersonalStore';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface Habitude {
  id: string;
  label: string;
  ticks: string[];
  createdAt: string;
  /** L'instant exact de la dernière coche du jour — sert à savoir laquelle est fraîche. */
  lastTickAt?: string;
}
const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/*
  ═══════════════════════════════════════════════════════════════════
  LA BALANCE DU JOUR — et la règle de mise en page qui l'a déjà cassée
  ═══════════════════════════════════════════════════════════════════

  LE FLÉAU VIT DANS UNE BANDE DE HAUTEUR CONNUE (`BANDE_H`), ET LES PLATEAUX
  SONT EN FLUX NORMAL. Un plateau posé en position absolue dans un parent à
  hauteur fixe déborde EN SILENCE dès la cinquième habitude : rien ne casse,
  rien ne prévient, les jetons sortent simplement du cadre. C'est arrivé, et
  c'est pourquoi cette règle est écrite ici plutôt que sous-entendue.

  `PENCHE` est de combien le plateau chargé descend. Trente-quatre pixels :
  assez pour que l'inclinaison se voie sans regarder les nombres, trop peu
  pour qu'une journée à moitié tenue ressemble à un échec.

  CE QU'IL N'Y A PAS, ET QUI EST LE VRAI SUJET DU MODULE : pas de série à ne
  pas casser, pas de pourcentage annuel, pas de rappel. La balance se remet à
  plat chaque matin. C'est délibérément le module le moins comptable du
  produit, et la moindre statistique ajoutée ici lui ôterait sa raison d'être.
*/
const PENCHE = 34;
const JETON_H = 30;
/*
  LA GÉOMÉTRIE DU FLÉAU. Il était dessiné en trois filets indépendants : un
  trait au-dessus de chaque plateau et un tiret de quarante pixels au milieu.
  Sur une capture avec de vraies données, ça ne lisait pas comme une balance
  — ça lisait comme deux listes surmontées d'une règle, et l'objet dominant
  du module n'existait pas.

  Le fléau est maintenant une VRAIE barre, tracée en deux moitiés qui
  partagent les colonnes des plateaux (règle de géométrie : une rangée qui
  accompagne une autre partage ses colonnes, sinon les deux se décalent dès
  que la largeur change). Chaque moitié va du centre de son plateau au pivot,
  et son extrémité monte ou descend de `PENCHE` — la MÊME valeur qui déplace
  le plateau. Le bras de suspension garde donc une longueur constante :
  `FLEAU_H - FLEAU_MID`, quelle que soit l'inclinaison.

  Les `<svg>` du fléau débordent volontairement (`overflow: visible`) : la
  moitié basse descend jusqu'au plateau, qui est hors de la bande.
*/
const FLEAU_H = 76;
const FLEAU_MID = 56;
/** La largeur de la colonne du pivot, partagée par les trois rangées. */
const PIVOT_L = 40;

/** Un jeton est FRAIS quand il vient d'être posé — moins de deux minutes. */
const FRAIS_MS = 2 * 60_000;

/**
 * LES HABITUDES — les vôtres, jour après jour.
 *
 * Pour qui : une personne, pas une équipe. Les Routines sont celles de
 * l'organisation, partagées ; une habitude (marcher, lire, appeler sa mère)
 * ne regarde que soi. Rangé sur ce poste, comme le budget avant la paie.
 *
 * ## Ce qui domine : une balance, et surtout pas un tableau
 *
 * L'écran affichait une série par habitude et une « meilleure série » en
 * en-tête. C'était la faute exacte que cette famille interdit : une série
 * transforme une habitude en score, et un score se casse. Quelqu'un qui rate
 * un jour après quarante n'a pas perdu quarante jours — mais l'écran le lui
 * disait.
 *
 * La balance ne garde rien. Les habitudes tenues pèsent à gauche, les
 * manquées à droite, le fléau penche, et demain matin tout est à plat.
 *
 * ## L'ambre : la dernière cochée, encore fraîche
 *
 * Son jeton et son libellé, deux nœuds. Il s'éteint au bout de deux minutes :
 * l'ambre dit « ça vient d'être posé », pas « voilà la bonne habitude ».
 */
export function HabitsScreen() {
  const { t } = useLangue();
  const [habitudes, setHabitudes, pret] = usePersonalStore<Habitude[]>('habitudes', []);
  const [ouvert, setOuvert] = useState(false);
  const [label, setLabel] = useState('');
  const aujourdhui = isoJour(new Date());

  const tenues = habitudes.filter((h) => h.ticks.includes(aujourdhui));
  const manquees = habitudes.filter((h) => !h.ticks.includes(aujourdhui));
  const quatorze = useMemo(() => Array.from({ length: 14 }, (_, i) => isoJour(new Date(Date.now() - (13 - i) * 86_400_000))), []);

  /* LA DERNIÈRE COCHÉE, et seulement si elle est encore fraîche. */
  const fraiche = useMemo(() => {
    const candidate = tenues
      .filter((h) => h.lastTickAt)
      .sort((a, b) => (b.lastTickAt ?? '').localeCompare(a.lastTickAt ?? ''))[0];
    if (!candidate?.lastTickAt) return null;
    return Date.now() - Date.parse(candidate.lastTickAt) < FRAIS_MS ? candidate : null;
  }, [tenues]);
  const halo = useHaloSignal(Boolean(fraiche));

  /*
    L'INCLINAISON. Le plateau le plus chargé descend de `PENCHE`, l'autre monte
    d'autant. À égalité, le fléau est droit — et c'est un état, pas un
    intermédiaire : la moitié tenue à midi n'est ni bien ni mal.
  */
  const ecart = tenues.length - manquees.length;
  const descenteGauche = ecart > 0 ? PENCHE : ecart < 0 ? -PENCHE : 0;

  const ajouter = () => {
    if (!label.trim()) return;
    setHabitudes((h) => [...h, { id: `hab-${Date.now().toString(36)}`, label: label.trim(), ticks: [], createdAt: new Date().toISOString() }]);
    setLabel('');
    setOuvert(false);
  };
  const basculer = (h: Habitude) =>
    setHabitudes((liste) =>
      liste.map((x) =>
        x.id === h.id
          ? x.ticks.includes(aujourdhui)
            ? { ...x, ticks: x.ticks.filter((d) => d !== aujourdhui), lastTickAt: undefined }
            : { ...x, ticks: [...x.ticks, aujourdhui].sort(), lastTickAt: new Date().toISOString() }
          : x,
      ),
    );
  const retirer = (h: Habitude) => setHabitudes((liste) => liste.filter((x) => x.id !== h.id));

  const vide = pret && habitudes.length === 0 && !ouvert;

  /*
    UNE MOITIÉ DE FLÉAU. `viewBox` en pixels + `preserveAspectRatio="none"` :
    une unité de vue vaut un pixel en hauteur, donc `FLEAU_MID ± PENCHE` se
    lit directement en pixels, comme le déplacement du plateau. Le trait garde
    son épaisseur (`vectorEffect`) malgré l'étirement horizontal.
  */
  const DemiFleau = ({ cote }: { cote: 'gauche' | 'droite' }) => {
    const d = cote === 'gauche' ? descenteGauche : -descenteGauche;
    const bout = FLEAU_MID + d;
    return (
      <svg
        viewBox={`0 0 100 ${FLEAU_H}`}
        preserveAspectRatio="none"
        className="block h-full w-full"
        style={{ overflow: 'visible' }}
        aria-hidden
      >
        <line
          x1={cote === 'gauche' ? 50 : 0}
          y1={cote === 'gauche' ? bout : FLEAU_MID}
          x2={cote === 'gauche' ? 100 : 50}
          y2={cote === 'gauche' ? FLEAU_MID : bout}
          stroke="var(--color-border-strong)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        {/* LE BRAS DE SUSPENSION — du bout du fléau au plateau, longueur
            constante : le plateau descend d'autant que le bout du fléau. */}
        <line
          x1={50}
          y1={bout}
          x2={50}
          y2={FLEAU_H + d}
          stroke="var(--color-border-strong)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  };

  /** Un plateau : les jetons EN FLUX, jamais en absolu — voir l'en-tête. */
  const Plateau = ({ liste, cote }: { liste: Habitude[]; cote: 'gauche' | 'droite' }) => (
    <div
      className="flex min-w-0 flex-1 flex-col items-center transition-transform duration-500 motion-reduce:transition-none"
      style={{ transform: `translateY(${cote === 'gauche' ? descenteGauche : -descenteGauche}px)` }}
    >
      <span className="h-px w-full bg-border-strong" aria-hidden />
      <ul className="flex w-full flex-col gap-1.5 pt-2">
        {liste.length === 0 && <li className="py-2 text-center text-xs text-text-muted">{t('habitudes.plateauVide')}</li>}
        {liste.map((h) => {
          const ambre = fraiche?.id === h.id;
          return (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => basculer(h)}
                data-signal-groupe={ambre ? 'fraiche' : undefined}
                className={`input-focus flex w-full items-center justify-center px-3 text-center text-[13px] leading-tight transition-colors ${
                  ambre
                    ? 'bg-signal font-semibold text-signal-ink'
                    : cote === 'gauche'
                      ? 'border border-border-strong bg-elevated text-text-primary'
                      : 'border border-dashed border-border text-text-secondary'
                }`}
                style={{ minHeight: JETON_H }}
              >
                <span className="truncate">{h.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <EcranVide quand={Boolean(vide)} premierJour={Boolean(vide)}>
      <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={staggerItem}>
          <ScreenHeader
            eyebrow={t('perso.surtitre', { module: t('habitudes.titre') })}
            title={t('habitudes.titre')}
            description={t('habitudes.description')}
            phraseVide={t('habitudes.vide.phrase')}
            stats={[
              { label: t('habitudes.stat.tenues'), value: tenues.length },
              { label: t('habitudes.stat.habitudes'), value: habitudes.length },
            ]}
            actions={
              <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
                <Plus size={16} strokeWidth={2} /> {t('habitudes.ajouter')}
              </button>
            }
          />
        </motion.div>

        {ouvert && (
          <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); ajouter(); }} className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-4">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('habitudes.champ')} aria-label={t('habitudes.champ')} autoFocus className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
            <button type="submit" disabled={!label.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('habitudes.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </motion.form>
        )}

        {vide ? (
          <motion.div variants={staggerItem}>
            <FirstRun title={t('habitudes.vide.titre')} action={{ label: t('habitudes.vide.action'), onClick: () => setOuvert(true) }}>{t('habitudes.vide.texte')}</FirstRun>
          </motion.div>
        ) : (
          <>
            {/* ═══ L'OBJET DOMINANT : la balance du jour ═══ */}
            <motion.section variants={staggerItem} className={`panel-raised p-5 sm:p-6 ${halo}`}>
              <p className="eyebrow mb-1">{t('habitudes.laBalance')}</p>
              <p className="max-w-prose text-sm leading-relaxed text-text-secondary">{t('habitudes.remiseAPlat')}</p>

              {/* LES ÉTIQUETTES — mêmes colonnes que le fléau et les plateaux. */}
              <div className="mt-6 flex items-end gap-6">
                <p className="min-w-0 flex-1 text-center eyebrow">{t('habitudes.tenues')}</p>
                <span className="flex-shrink-0" style={{ width: PIVOT_L }} aria-hidden />
                <p className="min-w-0 flex-1 text-center eyebrow">{t('habitudes.manquees')}</p>
              </div>

              {/* LE FLÉAU — deux moitiés et le pivot, dans les mêmes colonnes. */}
              <div className="flex items-stretch gap-6" style={{ height: FLEAU_H }}>
                <div className="min-w-0 flex-1"><DemiFleau cote="gauche" /></div>
                {/* LE PIVOT — au milieu, immobile : le fléau y passe à plat et
                    le support descend jusqu'au pied de la bande. */}
                <div className="flex-shrink-0" style={{ width: PIVOT_L }}>
                  <svg viewBox={`0 0 100 ${FLEAU_H}`} preserveAspectRatio="none" className="block h-full w-full" aria-hidden>
                    <line x1={0} y1={FLEAU_MID} x2={100} y2={FLEAU_MID} stroke="var(--color-border-strong)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                    <polygon points={`50,${FLEAU_MID} 10,${FLEAU_H} 90,${FLEAU_H}`} fill="var(--color-border)" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1"><DemiFleau cote="droite" /></div>
              </div>

              {/* LES PLATEAUX — en flux, jamais en absolu : voir l'en-tête. */}
              {/* `paddingBottom` : un `translateY` ne pousse pas la mise en page.
                  Sans cette réserve, le plateau chargé sortait du panneau par
                  le bas dès que la balance penchait. */}
              <div className="flex items-start gap-6" style={{ paddingBottom: PENCHE }}>
                <Plateau liste={tenues} cote="gauche" />
                <span className="flex-shrink-0" style={{ width: PIVOT_L }} aria-hidden />
                <Plateau liste={manquees} cote="droite" />
              </div>
            </motion.section>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* À GAUCHE — les quatorze derniers jours, en cases. */}
              <motion.section variants={staggerItem} className="panel p-4">
                <p className="eyebrow mb-3">{t('habitudes.quatorzeJours')}</p>
                <ul className="flex flex-col gap-2.5">
                  {habitudes.map((h) => (
                    <li key={h.id} className="group flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{h.label}</span>
                      <span className="flex flex-shrink-0 gap-1" aria-hidden>
                        {quatorze.map((d) => (
                          <span key={d} className={`h-2.5 w-2.5 ${h.ticks.includes(d) ? 'bg-text-body' : 'bg-border'}`} />
                        ))}
                      </span>
                      <button
                        type="button"
                        onClick={() => retirer(h)}
                        aria-label={t('habitudes.supprimer')}
                        title={t('habitudes.supprimer')}
                        className="flex-shrink-0 text-text-muted opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              </motion.section>

              {/* À DROITE — ce que le module ne garde pas. */}
              <motion.aside variants={staggerItem} className="panel p-4">
                <p className="eyebrow mb-3">{t('habitudes.ceQueCaNeGardePas')}</p>
                <ul className="flex flex-col gap-2">
                  {[t('habitudes.pasDeSerie'), t('habitudes.pasDeRappel'), t('habitudes.pasDeRapport')].map((phrase) => (
                    <li key={phrase} className="flex items-baseline gap-2 text-sm leading-relaxed text-text-secondary">
                      <span aria-hidden className="text-text-muted">—</span>
                      <span>{phrase}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-text-muted">{t('perso.local')}</p>
              </motion.aside>
            </div>
          </>
        )}
      </motion.section>
    </EcranVide>
  );
}
