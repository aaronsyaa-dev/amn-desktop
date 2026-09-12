import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarCheck, Check, Copy, Link2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { useSync, useCollection } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { publicOrigin } from '../lib/publicUrl';
import { joursOuverts, type JourSemaine, type FenetreHoraire } from '../lib/creneaux';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

type Jour = JourSemaine;
type Fenetre = FenetreHoraire;

/** L'horizon de la page publique, côté serveur : `JOURS_VISIBLES` dans
 *  `amn-api/src/routes/booking.js`. L'aperçu mentirait s'il en montrait plus. */
const JOURS_VISIBLES = 14;
interface BookingConfigData {
  enabled: boolean;
  title: string;
  intro: string;
  durationMin: number;
  location: string;
  availability: Partial<Record<Jour, Fenetre[]>>;
}
const JOURS: Jour[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DEFAUT: BookingConfigData = {
  enabled: false,
  title: '',
  intro: '',
  durationMin: 30,
  location: '',
  availability: { mon: [{ from: '09:00', to: '12:00' }], tue: [{ from: '09:00', to: '12:00' }], wed: [{ from: '09:00', to: '12:00' }], thu: [{ from: '09:00', to: '12:00' }], fri: [{ from: '09:00', to: '12:00' }] },
};

/**
 * LES RENDEZ-VOUS EN LIGNE — la page publique, réglée d'ici.
 *
 * Pour qui : un salon, une praticienne, une prestataire qui passe ses
 * journées à répondre « quand êtes-vous libre ? ». Ce que ça règle : une
 * adresse à mettre sur le site, dans une bio, un SMS ; les gens choisissent
 * un créneau, et le rendez-vous tombe dans l'Agenda — le même, sur tous ses
 * postes. Calendly fait ça en vendant un abonnement de plus ; ici c'est un
 * réglage, et rien ne sort de l'agenda vers la page sauf les heures prises.
 *
 * Tout ce qui est réglé ici est relu par le serveur à chaque réservation :
 * la page n'est ouverte que si « enabled » l'est, un créneau hors fenêtre
 * est refusé, un créneau pris aussi.
 *
 * ## Ce module n'est pas une file — l'audit s'était trompé
 *
 * Le Bloc 0 du chantier de design l'avait rangé avec les Relances, le SAV et
 * l'Assistance, « quelque chose arrive et attend une réponse ». C'est faux :
 * rien n'arrive ici. Aucune demande n'attend d'être traitée — les réservations
 * tombent directement dans l'Agenda. Cet écran est une VITRINE : son objet
 * n'est pas dans l'application, il est chez le visiteur.
 *
 * ## Ce qui domine : l'aperçu du visiteur
 *
 * L'écran ne montrait que des réglages — un champ titre, un champ intro, un
 * menu de durée, sept cases à cocher avec deux heures chacune. Celle qui règle
 * ne voyait jamais le résultat : sept cases cochées ne disent pas s'il reste
 * un créneau libre demain, et une durée de 90 minutes dans une fenêtre de
 * 9 h à 10 h n'en laisse aucun — ce qui ne se voyait nulle part.
 *
 * L'aperçu passe donc en tête, rendu comme la page publique, avec les mêmes
 * mots (`rdvPublic.*`) et le MÊME calcul de créneaux (`src/lib/creneaux.ts`,
 * extrait de `PublicBookingScreen` pour cette raison). Les réglages
 * descendent : ils produisent ce rendu, ils ne sont pas le sujet.
 *
 * ## L'ambre
 *
 * Sur la seule chose qui demande une décision, et il n'y en a jamais deux à la
 * fois : OUVRIR la page si elle est fermée ; sinon, si elle est ouverte mais
 * ne propose rien pendant quinze jours, le dire — une page ouverte qui ne
 * propose rien est pire qu'une page fermée, le visiteur s'y déplace pour rien.
 * Ouverte et pourvue, l'écran n'a aucun ambre : c'est un état sain.
 */
export function BookingScreen() {
  const { t, langue } = useLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const { org } = useAuth();
  const { upsert } = useSync();
  const brutes = useCollection<Partial<BookingConfigData>>('bookingConfig');
  const rdvs = useCollection<{ source?: string; startAt?: string; durationMin?: number }>('appointments');
  const [copie, setCopie] = useState(false);

  const config = useMemo<BookingConfigData>(() => {
    const rec = brutes.find((r) => r.id === 'config');
    return { ...DEFAUT, ...(rec ?? {}), availability: { ...DEFAUT.availability, ...(rec?.availability ?? {}) } };
  }, [brutes]);
  const enregistrer = (patch: Partial<BookingConfigData>) => upsert('bookingConfig', 'config', { ...config, ...patch });
  const prisEnLigne = rdvs.filter((r) => r.source === 'booking');
  const aVenir = prisEnLigne.filter((r) => (r.startAt ?? '') >= new Date().toISOString()).length;

  const origine = publicOrigin();
  const adresse = origine && org ? `${origine}/#/rdv?org=${encodeURIComponent(org.id)}` : null;
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
  /*
    L'APERÇU — le même calcul que la page publique, sur les mêmes données.

    `pris` vient des rendez-vous locaux, alors que la page publique le reçoit
    du serveur : c'est la même information, vue d'ici. L'aperçu peut donc
    différer d'une seconde près d'un créneau qui vient d'être réservé ailleurs,
    et c'est acceptable pour un aperçu — jamais pour une réservation, que le
    serveur revalide.
  */
  const ouverts = useMemo(
    () =>
      joursOuverts({
        availability: config.availability,
        durationMin: config.durationMin,
        jours: JOURS_VISIBLES,
        pris: rdvs
          .filter((r) => r.startAt)
          .map((r) => ({ startAt: r.startAt as string, durationMin: r.durationMin ?? config.durationMin })),
      }),
    [config.availability, config.durationMin, rdvs],
  );
  const totalCreneaux = ouverts.reduce((n, j) => n + j.creneaux.length, 0);

  const jourLibelle = (j: Jour) => t(`rdv.jour.${j}` as Parameters<typeof t>[0]);
  const fenetre = (j: Jour): Fenetre | null => config.availability[j]?.[0] ?? null;
  const reglerJour = (j: Jour, f: Fenetre | null) => enregistrer({ availability: { ...config.availability, [j]: f ? [f] : [] } });

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('commerce.surtitre', { module: t('rdv.titre') })}
          title={t('rdv.titre')}
          description={config.enabled ? t('rdv.ouverte') : t('rdv.fermee')}
          stats={[
            { label: t('rdv.stat.prisEnLigne'), value: prisEnLigne.length },
            { label: t('rdv.stat.aVenir'), value: aVenir, emphasis: aVenir > 0 },
            /* Le chiffre qui manquait : sept cases cochées ne disent pas
               combien de créneaux restent réellement libres. */
            { label: t('rdv.creneauxLibres'), value: totalCreneaux },
          ]}
          actions={
            <button
              type="button"
              onClick={() => void enregistrer({ enabled: !config.enabled })}
              aria-pressed={config.enabled}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${config.enabled ? 'border border-border-strong text-text-primary hover:bg-surface-hover' : 'bg-accent text-bg hover:bg-accent-hover'}`}
            >
              <CalendarCheck size={16} strokeWidth={2} /> {config.enabled ? t('rdv.fermer') : t('rdv.ouvrir')}
            </button>
          }
        />
      </motion.div>

      {/* L'APERÇU — l'objet dominant. Une feuille (`panel-sheet`) : ce n'est pas
          une carte de l'application, c'est une PAGE, celle que le visiteur
          ouvre. Voir l'en-tête du fichier pour l'arbitrage. */}
      <motion.section variants={staggerItem} className="panel-sheet p-5 sm:p-6" data-signal-groupe="vitrine">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="eyebrow">{t('rdv.apercu')}</p>
          <p className="text-[11px] text-text-muted">{t('rdv.apercuAide')}</p>
        </div>

        {!config.enabled && (
          <p className="signal-plate mt-3 inline-flex px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider">{t('rdv.pageFermee')}</p>
        )}

        <div className={config.enabled ? 'mt-4' : 'mt-3 opacity-45'}>
          {/* Les mêmes mots que la page publique : `rdvPublic.titreDefaut` et
              `rdv.minutes` y sont rendus à l'identique. */}
          <p className="eyebrow">{org?.name ?? ''}</p>
          <h2 className="mt-1 text-[21px] font-bold leading-tight tracking-tight text-text-primary sm:text-[27px]">
            {config.title || t('rdvPublic.titreDefaut')}
          </h2>
          {config.intro && <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">{config.intro}</p>}
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
            {t('rdv.minutes', { n: config.durationMin })}
            {config.location && ` · ${config.location}`}
          </p>

          {ouverts.length === 0 ? (
            <div className="mt-5">
              <p className="text-sm text-text-primary">{t('rdvPublic.aucunCreneau')}</p>
              <p className="mt-1 max-w-lg text-xs leading-relaxed text-text-muted">{t('rdv.aucunCreneauAide')}</p>
            </div>
          ) : (
            <>
              <p className="eyebrow mt-5 mb-2">{t('rdvPublic.choisirJour')}</p>
              <ul className="flex flex-wrap gap-1.5">
                {ouverts.slice(0, 7).map((j) => (
                  <li key={j.iso} className="border border-border px-3 py-1.5 text-sm text-text-secondary">
                    {j.date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
                    <span className="ml-2 font-mono text-[10px] text-text-muted">{j.creneaux.length}</span>
                  </li>
                ))}
                {ouverts.length > 7 && (
                  <li className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('rdv.etPlus', { n: ouverts.length - 7 })}</li>
                )}
              </ul>
              <p className="eyebrow mt-4 mb-2">{t('rdvPublic.choisirHeure')}</p>
              <ul className="flex flex-wrap gap-1.5">
                {ouverts[0].creneaux.slice(0, 8).map((c) => (
                  <li key={c.toISOString()} className="border border-border px-3 py-1.5 font-mono text-sm text-text-secondary">
                    {c.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                  </li>
                ))}
                {ouverts[0].creneaux.length > 8 && (
                  <li className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('rdv.etPlus', { n: ouverts[0].creneaux.length - 8 })}</li>
                )}
              </ul>
            </>
          )}
        </div>

        {/* La page ouverte mais vide : le seul défaut que cet écran peut
            dire et que personne d'autre ne verra — sauf le visiteur. */}
        {config.enabled && ouverts.length === 0 && (
          <p className="signal-plate mt-4 inline-flex px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider">{t('rdvPublic.aucunCreneau')}</p>
        )}
        {!config.enabled && <p className="mt-3 max-w-lg text-xs leading-relaxed text-text-muted">{t('rdv.pageFermeeAide')}</p>}
      </motion.section>

      <motion.section variants={staggerItem} className="rounded-xl border border-border bg-surface p-4">
        <p className="eyebrow mb-2 flex items-center gap-2"><Link2 size={12} /> {t('rdv.adresse')}</p>
        {adresse ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 select-all truncate rounded-lg bg-bg px-3 py-2 font-mono text-xs text-text-primary">{adresse}</code>
            <button type="button" onClick={() => void copier()} className="flex min-h-11 items-center gap-1.5 border border-border-strong px-3 text-xs text-text-primary hover:bg-surface-hover md:min-h-0 md:py-2">
              {copie ? <Check size={13} /> : <Copy size={13} />} {copie ? t('relances.copie') : t('rdv.copier')}
            </button>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-text-secondary">{t('rdv.adresseAbsente')}</p>
        )}
        {!config.enabled && <p className="mt-2 text-xs text-text-muted">{t('rdv.adresseFermee')}</p>}
      </motion.section>

      <motion.p variants={staggerItem} className="eyebrow">{t('rdv.reglages')}</motion.p>

      <motion.section variants={staggerItem} className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <p className="eyebrow">{t('rdv.presentation')}</p>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            {t('rdv.champTitre')}
            <input value={config.title} onChange={(e) => void enregistrer({ title: e.target.value })} placeholder={t('rdv.champTitreExemple')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            {t('rdv.champIntro')}
            <textarea value={config.intro} onChange={(e) => void enregistrer({ intro: e.target.value })} rows={3} placeholder={t('rdv.champIntroExemple')} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              {t('rdv.champDuree')}
              <select value={config.durationMin} onChange={(e) => void enregistrer({ durationMin: Number(e.target.value) })} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none">
                {[15, 30, 45, 60, 90].map((n) => <option key={n} value={n}>{t('rdv.minutes', { n })}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              {t('rdv.champLieu')}
              <input value={config.location} onChange={(e) => void enregistrer({ location: e.target.value })} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
            </label>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <p className="eyebrow">{t('rdv.disponibilites')}</p>
          <p className="text-xs leading-relaxed text-text-muted">{t('rdv.disponibilitesAide')}</p>
          <ul className="flex flex-col gap-1.5">
            {JOURS.map((j) => {
              const f = fenetre(j);
              return (
                <li key={j} className="flex flex-wrap items-center gap-2">
                  <label className="flex min-h-11 w-28 items-center gap-2 text-sm text-text-primary md:min-h-0">
                    <input type="checkbox" checked={Boolean(f)} onChange={(e) => void reglerJour(j, e.target.checked ? { from: '09:00', to: '12:00' } : null)} className="h-6 w-6" />
                    {jourLibelle(j)}
                  </label>
                  {f && (
                    <>
                      <input type="time" value={f.from} onChange={(e) => void reglerJour(j, { ...f, from: e.target.value })} aria-label={`${jourLibelle(j)} · ${t('rdv.de')}`} className="input-focus min-h-11 border border-border bg-bg px-2 text-sm text-text-primary outline-none md:min-h-0 md:py-1" />
                      <span className="text-xs text-text-muted">→</span>
                      <input type="time" value={f.to} onChange={(e) => void reglerJour(j, { ...f, to: e.target.value })} aria-label={`${jourLibelle(j)} · ${t('rdv.a')}`} className="input-focus min-h-11 border border-border bg-bg px-2 text-sm text-text-primary outline-none md:min-h-0 md:py-1" />
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </motion.section>
    </motion.section>
  );
}
