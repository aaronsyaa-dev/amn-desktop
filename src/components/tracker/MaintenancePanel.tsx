import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, Plus, RotateCcw, X } from 'lucide-react';
import { bridge } from '../../lib/bridge';
import { cleanErrorMessage } from '../../lib/errorMessage';
import { futureTime, relativeTime } from '../../lib/time';
import { useOrgSites } from './useOrgSites';
import type { MaintenanceWindow } from '../../shared/api';

/**
 * QUAND L'INDISPONIBILITÉ EST PRÉVUE
 * ══════════════════════════════════
 *
 * Une cliente migre son site un samedi soir, de 22 h à 2 h. Tout le monde le
 * sait, c'était au calendrier. Sans ce panneau, voilà ce qui se passe : le
 * traceur se tait, notre sonde échoue, personne n'acquitte parce que c'est
 * prévu — et l'escalade réveille quelqu'un au bout de dix minutes, puis
 * encore au bout d'une heure.
 *
 * L'étouffoir ne pouvait rien : la disponibilité est justement la nature qu'il
 * refuse de faire taire, et ce refus est bon (une panne n'est jamais un faux
 * positif).
 *
 * ## Ce qu'une fenêtre fait, et surtout ce qu'elle NE fait pas
 *
 * Elle ne supprime rien. Pendant une migration, quelque chose de VRAI peut
 * casser — c'est même le moment le plus probable — et cesser d'observer serait
 * le mauvais arbitrage. Les sondes tournent, les alertes sont enregistrées,
 * l'incident est créé et se voit dans la file.
 *
 * Elle coupe le RÉVEIL, et c'est tout. Au matin l'incident est là, étiqueté,
 * et se clôt d'un geste.
 *
 * ## Pourquoi le texte de ce panneau insiste là-dessus
 *
 * Parce que la personne qui déclare une fenêtre croit, elle, qu'elle « coupe
 * les alertes ». Si elle le croit, elle ne regardera pas la file au matin. La
 * phrase sous le titre est donc écrite pour être lue une fois et retenue, pas
 * pour décorer.
 */

/* ------------------------------- Vocabulaire ------------------------------- */

const TON_ETAT: Record<MaintenanceWindow['etat'], string> = {
  'en-cours': 'border-accent/50 bg-accent-muted text-text-primary',
  'a-venir': 'border-border text-text-secondary',
  terminee: 'border-border/60 text-text-muted',
  annulee: 'border-border/60 text-text-muted line-through',
};

const LIBELLE_ETAT: Record<MaintenanceWindow['etat'], string> = {
  'en-cours': 'En cours',
  'a-venir': 'À venir',
  terminee: 'Terminée',
  annulee: 'Annulée',
};

/** Le créneau, en une ligne lisible à voix haute. */
function creneau(f: MaintenanceWindow): string {
  const debut = new Date(f.startsAt);
  const fin = new Date(f.endsAt);
  const jour = debut.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const h = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  // Une migration qui déborde sur le lendemain est le cas NORMAL, pas
  // l'exception : la nommer évite de lire « de 22 h à 2 h » comme une erreur.
  const memeJour = debut.toDateString() === fin.toDateString();
  return memeJour
    ? `${jour}, de ${h(debut)} à ${h(fin)}`
    : `${jour} ${h(debut)} → lendemain ${h(fin)}`;
}

/** `YYYY-MM-DDTHH:mm` local, ce qu'attend un `<input type="datetime-local">`. */
function pourChamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* --------------------------------- Panneau --------------------------------- */

export function MaintenancePanel() {
  const sites = useOrgSites();
  const [fenetres, setFenetres] = useState<MaintenanceWindow[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [historique, setHistorique] = useState(false);

  const charger = useCallback(async () => {
    try {
      setFenetres(await bridge().remote.listMaintenance(true));
      setErreur(null);
    } catch (err) {
      setFenetres([]);
      setErreur(cleanErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const vivantes = useMemo(
    () => (fenetres ?? []).filter((f) => f.etat === 'en-cours' || f.etat === 'a-venir'),
    [fenetres],
  );
  const revolues = useMemo(
    () => (fenetres ?? []).filter((f) => f.etat === 'terminee' || f.etat === 'annulee'),
    [fenetres],
  );

  const annuler = async (id: string) => {
    setEnCours(id);
    setErreur(null);
    try {
      await bridge().remote.cancelMaintenance(id);
      await charger();
    } catch (err) {
      setErreur(cleanErrorMessage(err));
    } finally {
      setEnCours(null);
    }
  };

  return (
    <section className="elev-1 rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <CalendarClock size={15} strokeWidth={1.75} className="text-text-secondary" />
        <h3 className="mr-auto text-sm font-semibold text-text-primary">Maintenances annoncées</h3>
        <button
          type="button"
          onClick={() => void charger()}
          aria-label="Relire"
          className="rounded-lg p-1.5 text-text-muted transition-colors hover:text-text-primary"
        >
          <RotateCcw size={13} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => setOuvert((v) => !v)}
          aria-expanded={ouvert}
          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
        >
          <Plus size={12} strokeWidth={2} />
          Annoncer
        </button>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-text-secondary">
        {/*
          LA PHRASE QUI COMPTE. Voir l'en-tête : qui déclare une fenêtre croit
          couper les alertes, et ne regardera donc pas la file au matin.
        */}
        Pendant une fenêtre, la supervision continue : les sondes tournent, les alertes sont
        enregistrées, les incidents apparaissent ici. <strong className="font-semibold text-text-primary">
        Seul le réveil est coupé</strong> — aucune notification, aucune escalade sur ce site.
      </p>

      <AnimatePresence initial={false}>
        {ouvert && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Formulaire
              sites={sites}
              onFait={async () => {
                setOuvert(false);
                await charger();
              }}
              onErreur={setErreur}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {erreur && <p className="mt-3 text-sm text-danger">{erreur}</p>}
      {fenetres === null && <p className="mt-3 text-sm text-text-muted">Lecture…</p>}

      {fenetres !== null && vivantes.length === 0 && !ouvert && (
        <p className="mt-3 text-[12px] text-text-muted">
          Aucune maintenance annoncée. Une migration prévue se déclare ici, avant qu'elle ne
          réveille quelqu'un.
        </p>
      )}

      <ul className="mt-3 flex flex-col">
        <AnimatePresence initial={false}>
          {vivantes.map((f) => (
            <motion.li
              key={f.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-b border-border last:border-b-0"
            >
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[13px] text-text-primary">
                    <span className="font-medium">{f.siteName ?? 'Site'}</span>
                    <span
                      className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${TON_ETAT[f.etat]}`}
                    >
                      {LIBELLE_ETAT[f.etat]}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary">{f.reason}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    {creneau(f)}
                    {/*
                      `futureTime` pour ce qui n'a pas commencé, `relativeTime`
                      pour la fin d'une fenêtre en cours : la première ne sait
                      parler que de l'avenir, la seconde que du passé, et les
                      confondre donne « il y a 3 h » sur une migration de ce
                      soir.
                    */}
                    {f.etat === 'a-venir'
                      ? ` · commence ${futureTime(f.startsAt)}`
                      : ` · se termine ${futureTime(f.endsAt)}`}
                    {f.createdBy ? ` · annoncée par ${f.createdBy}` : ''}
                  </p>
                  {f.couvert.incidents > 0 && (
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {f.couvert.incidents} incident{f.couvert.incidents > 1 ? 's' : ''} couvert
                      {f.couvert.incidents > 1 ? 's' : ''} — visibles dans la file, sans réveil
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void annuler(f.id)}
                  disabled={enCours === f.id}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
                >
                  <X size={12} strokeWidth={2} />
                  {enCours === f.id ? '…' : f.etat === 'en-cours' ? 'Écourter' : 'Annuler'}
                </button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {revolues.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setHistorique((v) => !v)}
            aria-expanded={historique}
            className="text-[11px] font-medium text-text-muted transition-colors hover:text-text-secondary"
          >
            {historique ? '▾' : '▸'} {revolues.length} maintenance
            {revolues.length > 1 ? 's' : ''} passée{revolues.length > 1 ? 's' : ''}
          </button>
          {historique && (
            <ul className="mt-2">
              {revolues.map((f) => (
                <li key={f.id} className="border-b border-border/60 py-2 last:border-b-0">
                  <p className="text-[12px] text-text-secondary">
                    <span className="font-medium">{f.siteName ?? 'Site'}</span> — {f.reason}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    {f.cancelledAt
                      ? `annulée ${relativeTime(f.cancelledAt)}${f.cancelledBy ? ` par ${f.cancelledBy}` : ''}`
                      : `terminée ${relativeTime(f.endsAt)}`}
                    {' · '}
                    {f.couvert.incidents === 0
                      ? 'rien couvert'
                      : `${f.couvert.incidents} incident${f.couvert.incidents > 1 ? 's' : ''} couvert${f.couvert.incidents > 1 ? 's' : ''}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/* ------------------------------- Le formulaire ----------------------------- */

/**
 * Trois champs et une raison obligatoire.
 *
 * Les créneaux courants sont proposés en un clic — « ce soir 22 h → 2 h » est
 * la fenêtre réelle de neuf migrations sur dix, et la saisir à la main la nuit
 * même est le moment où l'on se trompe de jour.
 */
function Formulaire({
  sites,
  onFait,
  onErreur,
}: {
  sites: { id: string; name: string }[];
  onFait: () => Promise<void>;
  onErreur: (message: string | null) => void;
}) {
  const ceSoir = useMemo(() => {
    const debut = new Date();
    debut.setHours(22, 0, 0, 0);
    // Passé 22 h, « ce soir » est déjà commencé : on part de maintenant, ce
    // que le serveur accepte (annoncer une maintenance en cours est le cas
    // réel « ça a démarré, les alertes tombent »).
    if (debut.getTime() < Date.now()) debut.setTime(Date.now());
    const fin = new Date(debut);
    fin.setHours(fin.getHours() + 4);
    return { debut, fin };
  }, []);

  const [siteId, setSiteId] = useState('');
  const [debut, setDebut] = useState(() => pourChamp(ceSoir.debut));
  const [fin, setFin] = useState(() => pourChamp(ceSoir.fin));
  const [raison, setRaison] = useState('');
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (!siteId && sites.length > 0) setSiteId(sites[0].id);
  }, [sites, siteId]);

  const decaler = (heures: number) => {
    const d = new Date(debut);
    const f = new Date(d);
    f.setHours(f.getHours() + heures);
    setFin(pourChamp(f));
  };

  const envoyer = async () => {
    setEnvoi(true);
    onErreur(null);
    try {
      await bridge().remote.declareMaintenance({
        siteId,
        // Les champs sont en heure LOCALE ; le serveur veut de l'ISO. La
        // conversion se fait ici, une fois, plutôt que d'envoyer une chaîne
        // sans fuseau que le serveur interpréterait en UTC — soit deux heures
        // d'écart en été, c'est-à-dire une fenêtre qui s'ouvre trop tard.
        startsAt: new Date(debut).toISOString(),
        endsAt: new Date(fin).toISOString(),
        reason: raison,
      });
      setRaison('');
      await onFait();
    } catch (err) {
      onErreur(cleanErrorMessage(err));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-border bg-bg/40 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Site
          </span>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="input-focus min-h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text-primary outline-none"
          >
            {sites.length === 0 && <option value="">Aucun site</option>}
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-0">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Début
          </span>
          <input
            type="datetime-local"
            value={debut}
            onChange={(e) => setDebut(e.target.value)}
            className="input-focus min-h-11 w-full rounded-lg border border-border bg-bg px-3 font-mono text-sm text-text-primary outline-none"
          />
        </label>

        <label className="block min-w-0">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Fin
          </span>
          <input
            type="datetime-local"
            value={fin}
            onChange={(e) => setFin(e.target.value)}
            className="input-focus min-h-11 w-full rounded-lg border border-border bg-bg px-3 font-mono text-sm text-text-primary outline-none"
          />
          <span className="mt-1 flex flex-wrap gap-1.5">
            {[2, 4, 8].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => decaler(h)}
                className="rounded border border-border px-1.5 py-0.5 text-[10px] text-text-muted transition-colors hover:border-border-strong hover:text-text-secondary"
              >
                +{h} h
              </button>
            ))}
          </span>
        </label>

        <label className="block min-w-0 sm:col-span-2">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Ce qui est prévu
          </span>
          <input
            value={raison}
            onChange={(e) => setRaison(e.target.value)}
            placeholder="Migration du serveur chez l’hébergeur"
            className="input-focus min-h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text-primary outline-none"
          />
          {/*
            Obligatoire, comme la note d'un étouffoir et pour la même raison :
            c'est le seul moment où quelqu'un sait pourquoi. Six mois plus tard,
            « maintenance » tout court ne dit rien à qui relit la nuit où le
            réveil n'a pas sonné.
          */}
          <span className="mt-1 block text-[11px] leading-relaxed text-text-muted">
            En quelques mots. C'est ce qu'on relira dans six mois pour comprendre cette nuit-là.
          </span>
        </label>
      </div>

      <button
        type="button"
        onClick={() => void envoyer()}
        disabled={envoi || !siteId || raison.trim().length < 5}
        className="mt-3 min-h-11 rounded-lg bg-accent px-4 text-[13px] font-semibold text-bg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 md:min-h-0 md:py-2"
      >
        {envoi ? 'Enregistrement…' : 'Annoncer la maintenance'}
      </button>
    </div>
  );
}
