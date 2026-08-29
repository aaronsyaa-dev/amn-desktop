import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Database, Download, FileSearch, Loader2, ShieldCheck } from 'lucide-react';
import { SettingsPanel as Panel } from '../SettingsPanel';
import { downloadBackup } from '../../lib/backup';
import { inspecterSauvegarde, type RapportSauvegarde } from '../../lib/backupInspect';

/**
 * MES DONNÉES — EMPORTER, VÉRIFIER, SAVOIR
 * ════════════════════════════════════════
 *
 * La section ne portait qu'un bouton d'export. Trois choses lui manquaient, et
 * elles vont ensemble :
 *
 * ## 1. Relire ce qu'on a déjà
 *
 * Une sauvegarde qu'on ne peut pas vérifier est une promesse qu'on découvre
 * fausse le jour où l'on en a besoin — c'est-à-dire le jour où l'on a déjà
 * tout perdu par ailleurs. Le cas n'est pas théorique : l'instantané local de
 * repli a longtemps couvert neuf collections sur vingt-six sous un bouton qui
 * promettait tout. Quelqu'un a pu ranger ce fichier-là et dormir tranquille.
 *
 * La lecture se fait ENTIÈREMENT dans l'appareil : le fichier n'est envoyé
 * nulle part. Ce serait le comble pour un outil dont l'objet est de rendre
 * ses données à qui les demande.
 *
 * ## 2. Ne pas restaurer, et le dire
 *
 * Réinjecter demande des règles que personne n'a tranchées : on écrase, on
 * fusionne, et qui gagne quand les deux côtés ont bougé. Un import
 * approximatif détruit un vrai carnet de clientes pour rendre un fichier.
 * L'écran l'annonce plutôt que de le laisser deviner — une fonction absente
 * qu'on attend est pire qu'une fonction absente qu'on sait absente.
 *
 * ## 3. Dire ce qu'on garde
 *
 * Ce produit note la conformité RGPD des autres. Il ne disait rien de ce
 * qu'il détient lui-même, ni de la façon d'en demander l'effacement. La
 * dernière ligne répare exactement ça, sans grandiloquence.
 */

/** Rien de plus gros n'a de raison d'être une sauvegarde — au-delà, on refuse de lire. */
const TAILLE_MAX = 64 * 1024 * 1024;

export function DataSection() {
  return (
    <Panel
      icon={Database}
      title="Mes données"
      subtitle="Emportez une copie de votre espace, et vérifiez celles que vous gardez déjà."
    >
      <Exporter />
      <div className="my-5 border-t border-border" />
      <Verifier />
      <div className="my-5 border-t border-border" />
      <Droits />
    </Panel>
  );
}

/* ------------------------------- Emporter --------------------------------- */

function Exporter() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const run = async () => {
    setBusy(true);
    setDone(false);
    try {
      await downloadBackup();
      setDone(true);
      window.setTimeout(() => setDone(false), 2500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/*
        Le sous-titre énumérait « clients, devis, tâches, messages… » — la
        liste de ce que l'export contenait VRAIMENT, à savoir neuf collections
        sur vingt-deux, et pas celles d'une cliente. Il ne promet plus une
        énumération qu'il faudrait tenir à jour : il promet tout, et c'est le
        serveur qui tient la liste (voir lib/backup.ts).
      */}
      {/*
        `basis-64` et pas seulement `flex-1` : sans base, `min-w-0` laisse le
        paragraphe rétrécir jusqu'à une colonne de dix caractères pour garder
        le bouton sur la même ligne. Sur un téléphone de 390 px, ça donnait un
        ruban de texte vertical illisible à côté d'un bouton confortable — et
        le contrôle de largeur ne pouvait pas le voir : rien ne DÉBORDE, tout
        est écrasé. Avec une base, la ligne se casse et le bouton passe
        dessous, ce qui est le bon comportement.
      */}
      <p className="min-w-0 flex-1 basis-64 text-xs leading-relaxed text-text-muted">
        Un fichier JSON, à conserver en lieu sûr : tout ce que contient votre espace y est,
        jusqu’à ce que nous avons observé de vos sites. Le coffre-fort en est absent — il ne
        quitte pas cet appareil.
      </p>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="flex items-center gap-2 border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-40"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : done ? <Check size={14} /> : <Download size={14} />}
        {busy ? 'Export…' : done ? 'Exporté' : 'Exporter mes données'}
      </button>
    </div>
  );
}

/* ------------------------------- Vérifier --------------------------------- */

function Verifier() {
  const champ = useRef<HTMLInputElement>(null);
  const [rapport, setRapport] = useState<RapportSauvegarde | null>(null);
  const [nomFichier, setNomFichier] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lire = async (fichier: File) => {
    setBusy(true);
    setErreur(null);
    setRapport(null);
    setNomFichier(fichier.name);
    try {
      if (fichier.size > TAILLE_MAX) {
        throw new Error('Ce fichier est trop volumineux pour être une sauvegarde.');
      }
      setRapport(inspecterSauvegarde(JSON.parse(await fichier.text())));
    } catch (err) {
      /*
        Un JSON illisible ne passe PAS par l'inspecteur : celui-ci répond sur
        un document, et un fichier tronqué n'en est pas un. Le dire ici évite
        de rendre « ce n'est pas une sauvegarde » pour un fichier qui en est
        peut-être une, coupée à la copie.
      */
      setErreur(
        err instanceof SyntaxError
          ? 'Ce fichier n’a pas pu être lu — il est peut-être incomplet ou abîmé.'
          : err instanceof Error
            ? err.message
            : 'Ce fichier n’a pas pu être lu.',
      );
    } finally {
      setBusy(false);
      // Sans ça, re-choisir LE MÊME fichier ne déclenche rien : le champ ne
      // signale que les changements de valeur.
      if (champ.current) champ.current.value = '';
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 basis-64 text-xs leading-relaxed text-text-muted">
          Vous gardez déjà un fichier ? Ouvrez-le ici pour savoir ce qu’il contient vraiment,
          et de quand il date. Tout se passe sur cet appareil : le fichier n’est envoyé nulle part.
        </p>
        <input
          ref={champ}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void lire(f);
          }}
        />
        <button
          type="button"
          onClick={() => champ.current?.click()}
          disabled={busy}
          className="flex items-center gap-2 border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-40"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <FileSearch size={14} />}
          {busy ? 'Lecture…' : 'Vérifier une sauvegarde'}
        </button>
      </div>

      {erreur && (
        <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-danger">
          <AlertTriangle size={13} strokeWidth={2} className="mt-0.5 flex-shrink-0" />
          {erreur}
        </p>
      )}

      <AnimatePresence initial={false}>
        {rapport && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <Rapport rapport={rapport} nomFichier={nomFichier} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ageEnMots(jours: number | null): string {
  if (jours === null) return 'date inconnue';
  if (jours <= 0) return 'aujourd’hui';
  if (jours === 1) return 'hier';
  if (jours < 31) return `il y a ${jours} jours`;
  const mois = Math.round(jours / 30.44);
  return mois < 12 ? `il y a ${mois} mois` : `il y a ${Math.floor(jours / 365)} an(s)`;
}

function Rapport({ rapport, nomFichier }: { rapport: RapportSauvegarde; nomFichier: string | null }) {
  const bon = rapport.origine !== null && rapport.avertissements.length === 0;

  return (
    <div className="mt-4 border border-border bg-surface-hover/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {bon ? (
          <ShieldCheck size={14} strokeWidth={1.9} className="flex-shrink-0 text-success" />
        ) : (
          <AlertTriangle size={14} strokeWidth={1.9} className="flex-shrink-0 text-warning" />
        )}
        {/*
          L'intitulé vient de l'inspecteur, PAS d'ici : « Sauvegarde complète »
          affirme une qualité et ne s'obtient qu'en l'ayant méritée. Calculé
          dans le JSX, il s'affichait au-dessus de « ne contient aucune fiche »
          sans que rien ne puisse l'en empêcher — c'est une règle, donc elle
          vit dans le module éprouvé. Voir lib/backupInspect.ts (`titre`).
        */}
        <p className="min-w-0 flex-1 text-[13px] font-medium text-text-primary">
          {rapport.titre}
          {rapport.organisation && <span className="text-text-muted"> · {rapport.organisation}</span>}
        </p>
        {nomFichier && (
          <span className="truncate font-mono text-[10px] text-text-muted">{nomFichier}</span>
        )}
      </div>

      {/*
        LES AVERTISSEMENTS PASSENT AVANT LE CONTENU.

        L'inspecteur les rend déjà rangés par gravité ; les afficher sous le
        décompte les mettrait après ce qui rassure, et c'est exactement ainsi
        qu'on referme un écran en pensant que tout va bien.
      */}
      {rapport.avertissements.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {rapport.avertissements.map((a) => (
            <li key={a} className="flex items-start gap-2 text-xs leading-relaxed text-warning">
              <span aria-hidden className="mt-[3px] block h-1 w-1 flex-shrink-0 rounded-full bg-warning" />
              {a}
            </li>
          ))}
        </ul>
      )}

      {rapport.origine !== null && (
        <>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-text-muted">
            {rapport.totalFiches} fiche{rapport.totalFiches > 1 ? 's' : ''}
            {' · '}
            {rapport.collections.length} collection{rapport.collections.length > 1 ? 's' : ''}
            {' · '}
            {ageEnMots(rapport.ageJours)}
            {rapport.supervision &&
              ` · ${rapport.supervision.incidents} incident${rapport.supervision.incidents > 1 ? 's' : ''}`}
          </p>

          {rapport.collections.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {rapport.collections.map((c) => (
                <span key={c.nom} className="text-[11px] text-text-secondary">
                  {c.nom} <span className="font-medium text-text-primary">{c.total}</span>
                  {c.supprimes > 0 && (
                    <span className="text-text-muted"> ({c.supprimes} supprimée{c.supprimes > 1 ? 's' : ''})</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* --------------------------------- Droits --------------------------------- */

function Droits() {
  return (
    <div className="text-xs leading-relaxed text-text-muted">
      <p>
        <span className="font-medium text-text-secondary">Ce que nous gardons.</span>{' '}
        Ce que vous voyez dans l’application, et rien d’autre : le fichier d’export ci-dessus en
        est la copie exacte, y compris ce qui a été supprimé et qui y figure marqué comme tel.
        Les empreintes de mots de passe et les codes d’authentification en sont volontairement
        absents — ce sont des éléments de sécurité, pas des données à restituer.
      </p>
      <p className="mt-2">
        <span className="font-medium text-text-secondary">Effacer, et remettre en place.</span>{' '}
        L’effacement complet d’un espace se demande à l’équipe qui vous a fourni cette
        application, et se fait à la main. C’est délibéré : le geste est irréversible et emporte
        le travail de tout le monde, pas seulement celui de qui clique. Pour la même raison, ce
        fichier ne se réinjecte pas ici — décider seul ce qui doit écraser quoi détruirait des
        données réelles pour en rendre d’anciennes.
      </p>
    </div>
  );
}
