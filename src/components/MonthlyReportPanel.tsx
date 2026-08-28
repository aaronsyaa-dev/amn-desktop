import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, FileText, X } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { cleanErrorMessage } from '../lib/errorMessage';
import { dureeLisible } from '../lib/incidentDisplay';
import type { MonthlyReport } from '../shared/api';

/**
 * LE RAPPORT MENSUEL DE SUPERVISION — l'aperçu avant l'impression
 * ══════════════════════════════════════════════════════════════
 *
 * Une organisation qui paie une supervision ne voit, le plus souvent, rien se
 * passer. Ce rapport est la seule chose qui rende ce travail visible, et il
 * s'ouvre depuis le bureau de supervision parce que c'est là qu'il est produit.
 *
 * ## Pourquoi un aperçu, et pas un simple bouton « Ouvrir »
 *
 * Ce document part chez une cliente. On ne l'envoie pas sans l'avoir lu, et
 * ouvrir une fenêtre d'impression pour vérifier qu'un mois est vide est une
 * friction suffisante pour qu'on cesse de vérifier. L'aperçu montre ici les
 * mêmes chiffres que le document — la SEULE source est le serveur, jamais un
 * recalcul local, sans quoi l'écran et le PDF finiraient par diverger et c'est
 * le PDF qui serait cru.
 *
 * ## Le mois par défaut est le mois ÉCOULÉ
 *
 * Et il est choisi par le serveur, pas ici : deux calendriers qui décideraient
 * chacun de leur côté quel est « le mois dernier » se contrediraient une nuit
 * de changement d'heure. Le sélecteur ne propose donc que des mois RÉVOLUS —
 * un rapport du mois en cours, le 3 du mois, annonce trois jours d'activité et
 * se lit comme un mois calme.
 */

/** Les douze derniers mois RÉVOLUS, du plus récent au plus ancien. */
export function moisRevolus(depuisDate = new Date(), combien = 12): { valeur: string; libelle: string }[] {
  const out: { valeur: string; libelle: string }[] = [];
  const d = new Date(Date.UTC(depuisDate.getUTCFullYear(), depuisDate.getUTCMonth(), 1));
  for (let i = 0; i < combien; i++) {
    d.setUTCMonth(d.getUTCMonth() - 1);
    const valeur = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    out.push({
      valeur,
      libelle: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    });
  }
  return out;
}

/*
  AUCUN ROUGE ICI, et c'est délibéré.

  Le bureau de supervision garde le rouge pour un critique ENCORE à traiter :
  c'est ce qui lui donne sa valeur d'alerte. Ce rapport porte sur un mois CLOS
  — de l'histoire, pas une urgence. Peindre en rouge un décompte qu'on ne peut
  plus traiter userait le seul signal qui fait encore lever quelqu'un.
*/
function Chiffre({
  label,
  valeur,
  precision,
}: {
  label: string;
  valeur: string;
  precision?: string;
}) {
  return (
    <div>
      {/*
        Deux lignes RÉSERVÉES pour l'intitulé, toujours.

        « Prise en charge » revient à la ligne là où « Traités » tient sur une
        seule : sans cette réserve, le chiffre du relevé le plus long descend
        d'une ligne et toute la rangée perd sa ligne de base. Un tableau de
        bord dont les chiffres ne s'alignent pas se lit comme un brouillon.
      */}
      <p className="flex min-h-[2.4em] items-start font-mono text-[9px] uppercase leading-[1.2] tracking-[0.2em] text-text-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-text-primary">
        {valeur}
      </p>
      {precision && <p className="mt-0.5 text-[11px] text-text-muted">{precision}</p>}
    </div>
  );
}

export function MonthlyReportPanel({ onClose }: { onClose: () => void }) {
  const options = useMemo(() => moisRevolus(), []);
  const [mois, setMois] = useState<string>(options[0]?.valeur ?? '');
  const [rapport, setRapport] = useState<MonthlyReport | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouverture, setOuverture] = useState(false);

  const charger = useCallback(async (m: string) => {
    setChargement(true);
    setErreur(null);
    try {
      setRapport(await bridge().remote.monthlyReport(m));
    } catch (err) {
      setRapport(null);
      setErreur(cleanErrorMessage(err));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void charger(mois);
  }, [charger, mois]);

  // Échap ferme, comme partout ailleurs.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [onClose]);

  const ouvrirImprimable = async () => {
    setOuverture(true);
    setErreur(null);
    try {
      const href = await bridge().remote.monthlyReportUrl(mois);
      // Une vraie fenêtre : c'est de là que « Enregistrer en PDF » fonctionne,
      // le même chemin que les autres rapports d'AMN.
      window.open(href, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setErreur(cleanErrorMessage(err));
    } finally {
      setOuverture(false);
    }
  };

  const i = rapport?.incidents;

  return (
    <AnimatePresence>
      <motion.div
        key="rapport-fond"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-[2px]"
        aria-hidden
      />

      <motion.div
        key="rapport-panneau"
        role="dialog"
        aria-modal="true"
        aria-label="Rapport mensuel de supervision"
        initial={{ opacity: 0, y: 28, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.99 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-x-0 bottom-0 z-[151] max-h-[86vh] overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 elev-3 outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[84vh] sm:w-[min(40rem,calc(100vw-4rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6"
      >
        <span className="mx-auto mb-4 block h-1 w-10 rounded-full bg-border-strong sm:hidden" aria-hidden />

        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-text-primary">
              Rapport mensuel de supervision
            </h2>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
              {rapport ? rapport.organisation.nom : 'Chargement…'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <label htmlFor="rapport-mois" className="sr-only">
            Mois du rapport
          </label>
          <select
            id="rapport-mois"
            value={mois}
            onChange={(e) => setMois(e.target.value)}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-text-primary outline-none transition-colors focus:border-border-strong"
          >
            {options.map((o) => (
              <option key={o.valeur} value={o.valeur}>
                {o.libelle}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void ouvrirImprimable()}
            disabled={ouverture || chargement || !rapport}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-[12px] font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            <Download size={14} strokeWidth={2} />
            {ouverture ? 'Ouverture…' : 'Ouvrir la version imprimable'}
          </button>
        </div>

        {erreur && (
          <p className="mb-4 rounded-lg border border-danger/40 bg-danger-muted px-3 py-2 text-[13px] text-danger">
            {erreur}
          </p>
        )}

        {chargement && !rapport && (
          <p className="py-8 text-center text-[13px] text-text-muted">Assemblage du rapport…</p>
        )}

        {rapport && i && (
          <motion.div
            key={rapport.mois}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="flex flex-col gap-6"
          >
            {/*
              La phrase d'abord, les chiffres ensuite : c'est la seule ligne
              qu'on lira à coup sûr, et un mois calme s'annonce comme un mois
              calme — le maquiller apprendrait à ne plus lire le rapport.
            */}
            <p className="text-[15px] leading-relaxed text-text-primary">
              {i.total === 0
                ? 'Aucun incident ce mois-ci. La supervision a tourné sans interruption et rien n’a demandé d’intervention.'
                : i.encoreOuverts === 0
                  ? `${i.total} incident${i.total > 1 ? 's' : ''} détecté${i.total > 1 ? 's' : ''}, ${i.total > 1 ? 'tous traités' : 'traité'}. Rien ne reste ouvert à la clôture du mois.`
                  : `${i.total} incident${i.total > 1 ? 's' : ''} détecté${i.total > 1 ? 's' : ''}, dont ${i.encoreOuverts} encore en cours de traitement à la clôture du mois.`}
            </p>

            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-5 sm:gap-x-4">
              <Chiffre
                label="Incidents"
                valeur={String(i.total)}
                precision={i.critiques > 0 ? `dont ${i.critiques} critique${i.critiques > 1 ? 's' : ''}` : 'aucun critique'}
              />
              <Chiffre
                label="Traités"
                valeur={String(i.traites)}
                precision={i.encoreOuverts > 0 ? `${i.encoreOuverts} en cours` : 'rien en attente'}
              />
              <Chiffre
                label="Prise en charge"
                valeur={dureeLisible(i.delaiMedianPriseEnChargeMs)}
                precision="délai médian"
              />
              <Chiffre
                label="Résolution"
                valeur={dureeLisible(i.delaiMedianResolutionMs)}
                precision="délai médian"
              />
              <Chiffre
                label="Sites"
                valeur={String(rapport.parc.sites)}
                precision={`${rapport.disponibilite.interruptions} interruption${rapport.disponibilite.interruptions > 1 ? 's' : ''}`}
              />
            </div>

            <div>
              <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.25em] text-text-muted">
                Ce qui a été rencontré
              </p>
              {i.parNature.length === 0 ? (
                <p className="text-[13px] italic text-text-muted">
                  Aucune activité suspecte détectée sur la période.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {i.parNature.map((n) => (
                    <li key={n.kind} className="flex items-baseline justify-between gap-4 text-[13px]">
                      <span className="text-text-secondary">{n.libelle}</span>
                      <span className="flex-1 border-b border-dashed border-border" aria-hidden />
                      <span className="tabular-nums text-text-primary">{n.n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {(rapport.certificats.aRenouveler > 0 || rapport.analyses.scans > 0) && (
              <div>
                <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.25em] text-text-muted">
                  Certificats et analyses
                </p>
                <ul className="flex flex-col gap-1.5 text-[13px] text-text-secondary">
                  <li>
                    {rapport.certificats.surveilles} certificat
                    {rapport.certificats.surveilles > 1 ? 's' : ''} surveillé
                    {rapport.certificats.surveilles > 1 ? 's' : ''}
                    {rapport.certificats.aRenouveler > 0 && (
                      <span className="text-danger">
                        {' '}
                        — {rapport.certificats.aRenouveler} à renouveler sous 30 jours
                      </span>
                    )}
                  </li>
                  <li>
                    {rapport.analyses.scans} analyse{rapport.analyses.scans > 1 ? 's' : ''} de sécurité,{' '}
                    {rapport.analyses.conformite} contrôle{rapport.analyses.conformite > 1 ? 's' : ''} de
                    conformité
                  </li>
                </ul>
              </div>
            )}

            {/*
              On dit ce que le document NE contient pas, ici et pas seulement
              dans le PDF : c'est à l'opératrice qui l'envoie de pouvoir
              répondre si une cliente demande son « score de sécurité ».
            */}
            <p className="flex items-start gap-2 border-t border-border pt-4 text-[11px] leading-relaxed text-text-muted">
              <FileText size={13} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" />
              <span>
                Les délais sont des médianes. Aucune note globale, aucun délai de détection et aucun
                pourcentage de disponibilité ne figurent au rapport : ils supposeraient de savoir des
                choses que nous ne mesurons pas.
              </span>
            </p>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
