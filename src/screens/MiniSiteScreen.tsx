import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Globe } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { useSync, useCollection } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { publicOrigin } from '../lib/publicUrl';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

const CONFIG_ID = 'config';
interface MiniSiteConfig {
  enabled: boolean;
  title: string;
  intro: string;
  hours: string;
  address: string;
  phone: string;
  email: string;
  showReviews: boolean;
  showPortfolio: boolean;
}
const DEFAUT: MiniSiteConfig = { enabled: false, title: '', intro: '', hours: '', address: '', phone: '', email: '', showReviews: true, showPortfolio: true };

/**
 * LA MINI-PAGE PUBLIQUE — votre page, composée depuis ce qui existe déjà.
 *
 * Pour qui : une boutique sans site, ou avec un site que personne ne met à
 * jour. Ce que ça règle : une page publique avec la présentation, les
 * horaires, le contact — et, sans rien ressaisir, les avis marqués
 * publiables, le portfolio, la prise de rendez-vous si elle est ouverte.
 * Le serveur ne sert que ce qui a été marqué pour être montré.
 */
/**
 * LE TÉLÉPHONE À TAILLE RÉELLE — l'objet dominant de la Mini-page (`22a`)
 * ══════════════════════════════════════════════════════════════════════
 *
 * Quatre-vingt-onze pour cent des visites d'une page publique viennent d'un
 * téléphone. L'aperçu est donc UN TÉLÉPHONE, avec ses coins de 34 px et son
 * encoche, et les réglages vivent AUTOUR — jamais au centre. Un aperçu posé
 * dans une carte rectangulaire laisse croire qu'on regarde un site ; celui-ci
 * dit ce que les gens verront vraiment.
 *
 * LA RÈGLE DE GÉOMÉTRIE, ET COMMENT ELLE EST TENUE. Le paquet exige que la
 * maquette reste à 390 × 844 — « un aperçu redimensionné ne prouve rien ». Le
 * cadre, lui, fait 286 px de large pour tenir dans l'écran. Les deux ne se
 * contredisent pas : la page est RENDUE à 390 px de large, puis mise à
 * l'échelle par `transform: scale(286 / 390)`. Les proportions, les
 * césures de ligne et les tailles de texte sont exactement celles du
 * téléphone ; seule la loupe change. Recalculer les tailles pour « faire
 * tenir » aurait produit une page qui n'existe nulle part.
 */
const TELEPHONE_L = 390;
const TELEPHONE_H = 844;
const CADRE_L = 286;
const ECHELLE = CADRE_L / TELEPHONE_L;

function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return '—';
  return (mots[0][0] + (mots[1]?.[0] ?? '')).toUpperCase();
}

function TelephoneApercu({
  config,
  nomOrg,
  avis,
  realisations,
}: {
  config: MiniSiteConfig;
  nomOrg: string;
  avis: number;
  realisations: number;
}) {
  const nom = config.title.trim() || nomOrg || 'Votre activité';
  return (
    <div
      className="relative flex-none overflow-hidden border border-border-sheet bg-black"
      style={{
        width: `${CADRE_L}px`,
        height: `${Math.round(TELEPHONE_H * ECHELLE)}px`,
        borderRadius: '34px',
        boxShadow: '0 40px 70px -30px rgba(0,0,0,1), inset 0 1px 0 rgba(255,255,255,.07)',
      }}
    >
      {/* L'encoche. Elle appartient au cadre, pas à la page : elle ne bouge
          pas avec l'échelle. */}
      <span
        className="absolute left-1/2 top-0 z-10 h-[20px] w-[92px] -translate-x-1/2 bg-black"
        style={{ borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}
        aria-hidden
      />
      <div
        /* Le papier de la page publique : c'est l'encre claire du système,
           employée comme FOND parce qu'une page publique est claire. Le jeton
           plutôt que sa valeur, comme partout. */
        className="origin-top-left bg-[var(--color-text-primary)]"
        style={{
          width: `${TELEPHONE_L}px`,
          height: `${TELEPHONE_H}px`,
          transform: `scale(${ECHELLE})`,
        }}
      >
        <div className="flex h-full flex-col px-7 pb-8 pt-16 text-[#0a0a0a]">
          <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[var(--color-text-body)] font-mono text-[26px] font-bold text-[#0a0a0a]">
            {initiales(nom)}
          </span>
          <span className="mt-6 block text-[30px] font-bold leading-[1.08] tracking-[-0.025em]">{nom}</span>
          {config.address.trim() && (
            <span className="mt-2 block text-[15px] leading-[1.5] text-[#4a4a48]">{config.address}</span>
          )}

          <div className="mt-7 flex gap-3">
            {/*
              LE BOUTON D'APPEL — le seul ambre de l'écran, et le seul geste
              que la page demande. Il est ambre DANS la page, donc il l'est
              aussi dans l'aperçu : montrer un aperçu qui ne ressemble pas à
              la page rendrait l'aperçu inutile.
            */}
            <span
              data-signal-groupe="bouton-appel"
              className="flex h-[52px] flex-1 items-center justify-center bg-signal text-[16px] font-semibold text-signal-ink"
            >
              Appeler
            </span>
            <span className="flex h-[52px] flex-1 items-center justify-center border border-[#0a0a0a] text-[16px] font-semibold">
              Écrire
            </span>
          </div>

          {config.intro.trim() && (
            <span className="mt-7 block text-[16px] leading-[1.6] text-[#26262a] [text-wrap:pretty]">
              {config.intro.length > 220 ? `${config.intro.slice(0, 220)}…` : config.intro}
            </span>
          )}

          <div className="mt-auto flex flex-col gap-2.5">
            {config.hours.trim() && (
              <span className="block border border-[#d5d5d1] px-4 py-3 text-[14px] leading-[1.4] text-[#26262a]">
                {config.hours.split('\n')[0]}
              </span>
            )}
            <div className="flex gap-2.5">
              {config.showReviews && (
                <span className="flex-1 border border-[#d5d5d1] px-4 py-3 text-[14px] text-[#26262a]">
                  {avis} avis
                </span>
              )}
              {config.showPortfolio && (
                <span className="flex-1 border border-[#d5d5d1] px-4 py-3 text-[14px] text-[#26262a]">
                  {realisations} réalisations
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {!config.enabled && (
        /* Page fermée : le cadre le dit par-dessus l'aperçu plutôt que de
           montrer une page qui n'existe pas encore pour le public. */
        <span className="absolute inset-0 flex items-center justify-center bg-black/70 font-mono text-[11px] uppercase tracking-[0.18em] text-text-primary">
          Page fermée
        </span>
      )}
    </div>
  );
}

/**
 * LES HUIT BLOCS DE LA PAGE — ceux qui existent et ceux qui dorment.
 *
 * Les blocs non activés se dessinent en filet POINTILLÉ plutôt que d'être
 * absents : on ne peut pas activer ce dont on ignore l'existence, et une liste
 * de deux interrupteurs laisse croire que la page ne sait rien faire d'autre.
 */
const BLOCS_PAGE = [
  { cle: 'identite', nom: 'Nom et initiales', toujours: true },
  { cle: 'appel', nom: 'Bouton d’appel', toujours: true },
  { cle: 'ecrire', nom: 'Bouton d’écriture', toujours: true },
  { cle: 'intro', nom: 'Présentation', toujours: false },
  { cle: 'horaires', nom: 'Horaires', toujours: false },
  { cle: 'adresse', nom: 'Adresse', toujours: false },
  { cle: 'avis', nom: 'Avis publiables', toujours: false },
  { cle: 'portfolio', nom: 'Réalisations', toujours: false },
] as const;

export function MiniSiteScreen() {
  const { t } = useLangue();
  const { org } = useAuth();
  const { upsert } = useSync();
  const rows = useCollection<Partial<MiniSiteConfig>>('minisite');
  const avis = useCollection<{ publishable?: boolean }>('reviews');
  const realisations = useCollection<{ visible?: boolean }>('portfolioItems');
  const [copie, setCopie] = useState(false);
  const config: MiniSiteConfig = { ...DEFAUT, ...(rows.find((r) => r.id === CONFIG_ID) ?? {}) };
  const origine = publicOrigin();
  const adresse = origine && org ? `${origine}/#/p?org=${encodeURIComponent(org.id)}` : null;
  const publiables = avis.filter((a) => a.publishable === true).length;
  const visibles = realisations.filter((r) => r.visible !== false).length;

  const enregistrer = (patch: Partial<MiniSiteConfig>) => upsert('minisite', CONFIG_ID, { ...config, ...patch });
  const copier = async () => {
    if (!adresse) return;
    try {
      await navigator.clipboard.writeText(adresse);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      /* presse-papiers refusé : l'adresse reste sélectionnable */
    }
  };
  const champ = 'input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none';

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('pilotage.surtitre', { module: t('miniPage.titre') })}
          title={t('miniPage.titre')}
          description={config.enabled ? t('miniPage.ouverte') : t('miniPage.fermee')}
          stats={[
            { label: t('miniPage.stat.etat'), value: config.enabled ? t('miniPage.etat.ouverte') : t('miniPage.etat.fermee'), emphasis: config.enabled },
            { label: t('miniPage.stat.avis'), value: publiables },
            { label: t('miniPage.stat.realisations'), value: visibles },
          ]}
          actions={
            <button type="button" onClick={() => void enregistrer({ enabled: !config.enabled })} aria-pressed={config.enabled} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${config.enabled ? 'border border-border-strong text-text-primary hover:bg-surface-hover' : 'bg-accent text-bg hover:bg-accent-hover'}`}>
              <Globe size={16} strokeWidth={2} /> {config.enabled ? t('miniPage.fermer') : t('miniPage.ouvrir')}
            </button>
          }
        />
      </motion.div>

      {/* ── L'OBJET DOMINANT : la page, telle qu'on la verra ──────────── */}
      <motion.section
        variants={staggerItem}
        className="panel-raised panel-raised-wide flex flex-wrap items-start gap-x-9 gap-y-7 px-[30px] pb-[26px] pt-[30px]"
      >
        <TelephoneApercu
          config={config}
          nomOrg={org?.name ?? ''}
          avis={publiables}
          realisations={visibles}
        />

        {/* LES RÉGLAGES VIVENT AUTOUR DU TÉLÉPHONE, jamais au centre. */}
        <div className="flex min-w-[280px] flex-1 flex-col gap-6">
          <div>
            <span className="eyebrow block text-text-secondary">Ce que la page montre</span>
            <ul className="mt-4 grid grid-cols-2 gap-2">
              {BLOCS_PAGE.map((b) => {
                const actif =
                  b.toujours ||
                  (b.cle === 'intro' && config.intro.trim() !== '') ||
                  (b.cle === 'horaires' && config.hours.trim() !== '') ||
                  (b.cle === 'adresse' && config.address.trim() !== '') ||
                  (b.cle === 'avis' && config.showReviews) ||
                  (b.cle === 'portfolio' && config.showPortfolio);
                return (
                  <li
                    key={b.cle}
                    className={`px-3 py-2.5 text-[12.5px] ${
                      actif
                        ? 'border border-border bg-surface text-text-secondary'
                        : 'border border-dashed border-border-section text-text-muted'
                    }`}
                  >
                    {b.nom}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 font-mono text-[9.5px] uppercase leading-[1.7] tracking-[0.12em] text-text-muted">
              En pointillé : les blocs que la page sait faire et qui dorment
            </p>
          </div>

          {/*
            CE QUE CET ÉCRAN NE PEUT PAS DIRE, ET POURQUOI IL LE DIT QUAND MÊME.

            Le paquet place ici « vues / appels / devis du mois » et les trois
            sources de visite. Le produit ne les mesure pas : la page publique
            ne pose ni cookie ni traceur, et n'en posera pas — c'est le genre
            de décision qui appartient à qui vend le produit, pas à un chantier
            de composition. Plutôt qu'un compteur muet à zéro, la carte dit ce
            qu'elle sait : l'adresse, l'état, et ce que la page a à montrer.
          */}
          <div>
            <span className="eyebrow block text-text-secondary">L’adresse publique</span>
            {adresse ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 select-all truncate border border-border bg-sunken px-3 py-2 font-mono text-[11.5px] text-text-primary">
                  {adresse}
                </code>
                <button
                  type="button"
                  onClick={() => void copier()}
                  className="flex min-h-11 items-center gap-1.5 border border-border-strong px-3 text-xs text-text-primary hover:bg-surface-hover md:min-h-0 md:py-2"
                >
                  {copie ? <Check size={13} /> : <Copy size={13} />} {copie ? t('miniPage.copie') : t('miniPage.copier')}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-[13.5px] text-text-secondary">{t('miniPage.adresseAbsente')}</p>
            )}
            {!config.enabled && adresse && (
              <p className="mt-2 text-[12.5px] text-text-muted">{t('miniPage.adresseFermee')}</p>
            )}
            <p className="mt-4 border-t border-border-raised pt-4 text-[13px] leading-[1.6] text-text-muted [text-wrap:pretty]">
              Cette page ne compte pas ses visiteurs : elle ne pose ni cookie ni traceur. On sait ce
              qu’elle montre, pas qui l’a regardée.
            </p>
          </div>
        </div>
      </motion.section>

      <motion.div variants={staggerItem} className="grid gap-4 lg:grid-cols-2">
        <section aria-label={t('miniPage.section.contenu')} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <p className="eyebrow">{t('miniPage.section.contenu')}</p>
          <label className="flex flex-col gap-1 text-xs text-text-muted">{t('miniPage.champTitre')}<input value={config.title} onChange={(e) => void enregistrer({ title: e.target.value })} placeholder={org?.name ?? ''} className={champ} /></label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">{t('miniPage.champIntro')}<textarea value={config.intro} onChange={(e) => void enregistrer({ intro: e.target.value })} rows={4} className="input-focus w-full border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none" /></label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">{t('miniPage.champHoraires')}<textarea value={config.hours} onChange={(e) => void enregistrer({ hours: e.target.value })} rows={2} className="input-focus w-full border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none" /></label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">{t('miniPage.champAdresse')}<input value={config.address} onChange={(e) => void enregistrer({ address: e.target.value })} className={champ} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-text-muted">{t('miniPage.champTelephone')}<input value={config.phone} onChange={(e) => void enregistrer({ phone: e.target.value })} type="tel" className={champ} /></label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">{t('miniPage.champEmail')}<input value={config.email} onChange={(e) => void enregistrer({ email: e.target.value })} type="email" className={champ} /></label>
          </div>
        </section>
        <section aria-label={t('miniPage.section.blocs')} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <p className="eyebrow">{t('miniPage.section.blocs')}</p>
          <label className="flex min-h-11 items-center gap-3 text-sm text-text-primary">
            <input type="checkbox" checked={config.showReviews} onChange={(e) => void enregistrer({ showReviews: e.target.checked })} className="h-6 w-6" />
            {t('miniPage.montrerAvis')} <span className="tnum text-text-muted">({publiables})</span>
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm text-text-primary">
            <input type="checkbox" checked={config.showPortfolio} onChange={(e) => void enregistrer({ showPortfolio: e.target.checked })} className="h-6 w-6" />
            {t('miniPage.montrerPortfolio')} <span className="tnum text-text-muted">({visibles})</span>
          </label>
          <p className="text-xs leading-relaxed text-text-muted">{t('miniPage.rdv')}</p>
        </section>
      </motion.div>
    </motion.section>
  );
}
