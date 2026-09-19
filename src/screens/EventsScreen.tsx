import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, Plus, Trash2, Undo2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { EmptyState, FirstRun } from '../components/EmptyState';
import { useEvenements, type EvenementVu } from '../state/useEvenements';
import {
  ETAT_LABELS,
  joursAvant,
  type EvenementData,
  type EtatEvenement,
} from '../state/eventEngine';
import { centsToInput, formatCents, parsePositiveAmount } from '../lib/money';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue, t as tr } from '../i18n';
import { useHaloSignal } from '../components/EtatEcran';

/**
 * LE MODULE ÉVÉNEMENTS
 * ════════════════════
 *
 * Un module à part, et non un type de projet : un événement a une date butoir
 * qu'on ne déplace pas, une jauge, un prix de billet et un seuil de
 * rentabilité. Aucun de ces quatre champs n'existe sur un projet, et c'est sur
 * eux qu'on décide.
 *
 * ## Ce que cet écran met en avant, et pourquoi
 *
 * Le chiffre qui compte n'est pas le prix du billet : c'est le NOMBRE
 * D'ENTRÉES qu'il reste à vendre avant l'équilibre — celui qu'on regarde trois
 * semaines avant, quand il est encore temps d'agir sur un coût. Le compte à
 * rebours vient juste après, parce qu'il dit combien de temps il reste pour
 * agir dessus.
 *
 * Toute l'arithmétique vient de `eventEngine`, qui la tire lui-même du profil
 * `evenementiel-rentabilite` du moteur de calcul. Rien n'est recalculé ici :
 * deux arithmétiques à tenir d'accord finissent toujours par diverger, chacune
 * restant cohérente avec elle-même.
 */

/* ------------------------------- Vocabulaire ------------------------------- */

const TON_ETAT: Record<EtatEvenement, string> = {
  imminent: 'border-warning/50 bg-warning-muted text-text-primary',
  'a-venir': 'border-border text-text-secondary',
  'sans-date': 'border-border text-text-muted',
  passe: 'border-border/60 text-text-muted',
  annule: 'border-border/60 text-text-muted line-through',
};

/**
 * Le compte à rebours, en mots.
 *
 * « J-1 » et « J+3 » se lisent mal à voix haute et se confondent d'un coup
 * d'œil. Les mots que tout le monde emploie déjà valent mieux qu'une notation.
 */
function compteARebours(jours: number | null): string {
  if (jours === null) return 'Date à poser';
  if (jours === 0) return 'Aujourd’hui';
  if (jours === 1) return 'Demain';
  if (jours === -1) return 'Hier';
  if (jours > 0) return `Dans ${jours} jours`;
  return `Il y a ${Math.abs(jours)} jours`;
}

/* ---------------------------------- Écran ---------------------------------- */

export function EventsScreen() {
  const { vus, compte, aTraiter, creer, modifier, supprimer } = useEvenements();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [voirPasses, setVoirPasses] = useState(false);

  const selected = useMemo(
    () => vus.find((v) => v.evenement.id === selectedId) ?? null,
    [vus, selectedId],
  );

  /*
    LES PASSÉS SONT REPLIÉS, PAS CACHÉS.

    Ils s'accumulent sans fin et repoussent vers le bas les trois qui comptent.
    Les supprimer serait pire : on annule rarement sans avoir déjà dépensé, et
    c'est du dernier événement qu'on tire le bilan du suivant.
  */
  const revolus = vus.filter((v) => v.etat === 'passe' || v.etat === 'annule');
  const visibles = voirPasses ? vus : vus.filter((v) => !revolus.includes(v));

  /*
    L'ÉVÉNEMENT AFFICHÉ : celui qu'on a choisi, sinon le PROCHAIN à venir.

    Un événement n'existe pour personne avant d'avoir une affiche, et c'est la
    prochaine qu'on regarde en ouvrant l'écran — pas la liste, qui ne dit rien
    de ce que les gens verront. `vus` est déjà trié par le moteur, le premier
    non révolu est donc le plus proche.
  */
  const aAfficher = useMemo(
    () => selected ?? vus.find((v) => v.etat !== 'passe' && v.etat !== 'annule') ?? null,
    [selected, vus],
  );

  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="flex min-h-0 flex-1 flex-col gap-5"
    >
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={tr('hist.events.posteDeTravailEvenements')}
          title={tr('hist.events.evenements')}
          description={
            aTraiter.length > 0
              ? 'Ce qui approche, et ce qu’il reste à vendre pour l’équilibre.'
              : 'La date, la jauge, et le seuil de rentabilité.'
          }
          stats={[
            { label: tr('hist.events.aTraiter'), value: aTraiter.length, emphasis: aTraiter.length > 0 },
            { label: tr('hist.events.aVenir'), value: (compte.imminent ?? 0) + (compte['a-venir'] ?? 0) },
            { label: tr('hist.events.passes'), value: (compte.passe ?? 0) + (compte.annule ?? 0) },
          ]}
        />
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedId(creer())}
          className="flex min-h-11 items-center gap-2 bg-accent px-4 text-[13px] font-semibold text-bg transition-colors hover:bg-accent-hover md:min-h-0 md:py-2"
        >
          <Plus size={14} strokeWidth={2} />{tr('hist.events.nouvelEvenement')}</button>
        {revolus.length > 0 && (
          <button
            type="button"
            onClick={() => setVoirPasses((v) => !v)}
            aria-pressed={voirPasses}
            className={`flex min-h-11 items-center border px-3 text-xs transition-colors md:min-h-0 md:py-2 ${
              voirPasses
                ? 'border-border-strong bg-accent-muted text-text-primary'
                : 'border-border text-text-muted hover:text-text-secondary'
            }`}
          >
            {revolus.length} passé{revolus.length > 1 ? 's' : ''}
          </button>
        )}
      </motion.div>

      {/* ── L'AFFICHE — l'objet dominant (`23e`) ───────────────────────── */}
      {aAfficher && (
        <motion.div variants={staggerItem}>
          <AfficheDeLEvenement vu={aAfficher} passes={revolus} />
        </motion.div>
      )}

      <div
        className={`grid min-h-0 flex-1 gap-4 ${
          vus.length === 0 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-[340px_1fr]'
        }`}
      >
        <div
          className={`min-h-0 min-w-0 flex-col border border-border bg-surface ${
            selected ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="flex-shrink-0 border-b border-border px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            {visibles.length} événement{visibles.length > 1 ? 's' : ''}
          </div>
          <div className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto">
            {visibles.length === 0 ? (
              <div className="px-4">
                {vus.length === 0 ? (
                  <FirstRun
                    title={tr('hist.events.aucunEvenement')}
                    action={{ label: tr('hist.events.creerLePremier'), onClick: () => setSelectedId(creer()) }}
                  >
                    Un événement rassemble sa date, sa jauge et ses coûts — et vous dit combien
                    d’entrées il reste à vendre avant qu’il ne coûte plus d’argent.
                  </FirstRun>
                ) : (
                  <EmptyState quiet>{tr('hist.events.rienAVenirLes')}</EmptyState>
                )}
              </div>
            ) : (
              visibles.map((vu) => (
                <LigneEvenement
                  key={vu.evenement.id}
                  vu={vu}
                  active={vu.evenement.id === selectedId}
                  onSelect={() => setSelectedId(vu.evenement.id)}
                />
              ))
            )}
          </div>
        </div>

        {selected ? (
          <DetailEvenement
            key={selected.evenement.id}
            vu={selected}
            onBack={() => setSelectedId(null)}
            onPatch={(patch) => modifier(selected.evenement, patch)}
            onDelete={() => {
              supprimer(selected.evenement.id);
              setSelectedId(null);
            }}
          />
        ) : vus.length === 0 ? null : (
          <div className="hidden items-center justify-center border border-border bg-surface font-mono text-xs uppercase tracking-widest text-text-muted md:flex">{tr('hist.events.selectionnezUnEvenement')}</div>
        )}
      </div>
    </motion.section>
  );
}

/* --------------------------------- La liste -------------------------------- */

function LigneEvenement({
  vu,
  active,
  onSelect,
}: {
  vu: EvenementVu;
  active: boolean;
  onSelect: () => void;
}) {
  const { evenement, etat, economie } = vu;
  const jours = joursAvant(evenement.date);
  const encours = etat === 'imminent' || etat === 'a-venir';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`block w-full px-4 py-3 text-left transition-colors ${
        active ? 'bg-accent-muted' : 'hover:bg-white/[0.02]'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`truncate text-[13px] font-medium ${
            etat === 'annule' ? 'text-text-muted line-through' : 'text-text-primary'
          }`}
        >
          {evenement.nom || 'Sans nom'}
        </span>
        <span
          className={`flex-shrink-0 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${TON_ETAT[etat]}`}
        >
          {ETAT_LABELS[etat]}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-text-muted">
        <span className="tabular-nums">{compteARebours(jours)}</span>
        {evenement.lieu && <span className="truncate">{evenement.lieu}</span>}
      </div>

      {/*
        LA LIGNE QUI DÉCIDE — seulement pour ce qui est encore devant nous.

        Sur un événement passé, « il reste 37 entrées » n'appelle aucune
        action ; c'est le résultat qui compte alors, et il est dans le détail.
      */}
      {encours && (
        <p className="mt-1.5 text-[11px] leading-relaxed">
          {!economie.atteignable ? (
            <span className="text-danger">
              {economie.seuilEntrees === null
                ? 'Chaque entrée vendue coûte de l’argent.'
                : 'Le seuil dépasse la jauge : rentable, jamais.'}
            </span>
          ) : economie.entreesAvantEquilibre > 0 ? (
            <span className="text-text-secondary">
              Encore{' '}
              <span className="font-mono tabular-nums text-text-primary">
                {economie.entreesAvantEquilibre}
              </span>{' '}
              entrée{economie.entreesAvantEquilibre > 1 ? 's' : ''} avant l’équilibre
            </span>
          ) : (
            <span className="text-success">
              À l’équilibre — {formatCents(economie.resultatActuelCents)} dégagés
            </span>
          )}
        </p>
      )}
    </button>
  );
}

/* -------------------------------- Le détail -------------------------------- */

function DetailEvenement({
  vu,
  onBack,
  onPatch,
  onDelete,
}: {
  vu: EvenementVu;
  onBack: () => void;
  onPatch: (patch: Partial<EvenementData>) => void;
  onDelete: () => void;
}) {
  const { evenement, etat, economie } = vu;
  const [confirmSuppression, setConfirmSuppression] = useState(false);
  const jours = joursAvant(evenement.date);

  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto border border-border bg-surface">
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={tr('hist.events.revenirALaListe')}
          className="p-1 text-text-muted transition-colors hover:text-text-primary md:hidden"
        >
          <ArrowLeft size={16} strokeWidth={1.9} />
        </button>
        <input
          value={evenement.nom}
          onChange={(e) => onPatch({ nom: e.target.value })}
          placeholder={tr('hist.events.nomDeLEvenement')}
          aria-label={tr('hist.events.nomDeLEvenement')}
          className="input-focus min-w-0 flex-1 bg-transparent text-[15px] font-medium text-text-primary outline-none placeholder:text-text-muted"
        />
        <span
          className={`flex-shrink-0 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${TON_ETAT[etat]}`}
        >
          {ETAT_LABELS[etat]}
        </span>
      </div>

      <div className="flex flex-col gap-5 p-4">
        {/* ------------------------- LE VERDICT, EN TÊTE ------------------------ */}
        <Verdict vu={vu} jours={jours} />

        {/* ----------------------------- Quand, où ---------------------------- */}
        <Bloc titre="Quand et où">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Champ label="Date" aide="Le jour de l’événement.">
              <input
                type="date"
                value={evenement.date}
                onChange={(e) => onPatch({ date: e.target.value })}
                aria-label={tr('hist.events.dateDeLEvenement')}
                className="input-focus min-h-11 w-full border border-border bg-bg px-3 font-mono text-sm text-text-primary outline-none"
              />
            </Champ>
            <Champ label="Horaire" aide="Texte libre : « portes 19 h 30 ».">
              <input
                value={evenement.horaire ?? ''}
                onChange={(e) => onPatch({ horaire: e.target.value })}
                placeholder="Portes 19 h 30"
                aria-label="Horaire"
                className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
              />
            </Champ>
            <Champ label="Lieu">
              <input
                value={evenement.lieu ?? ''}
                onChange={(e) => onPatch({ lieu: e.target.value })}
                placeholder="Salle, adresse"
                aria-label="Lieu"
                className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
              />
            </Champ>
          </div>
        </Bloc>

        {/* ------------------------------ La jauge ---------------------------- */}
        <Bloc titre="La salle et les entrées">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ChampNombre
              label="Jauge"
              aide="Le nombre de places. Plafonne tout le reste."
              value={evenement.capacite}
              onChange={(v) => onPatch({ capacite: Math.max(Math.round(v), 0) })}
            />
            <ChampNombre
              label={tr('hist.events.entreesVendues')}
              aide="C’est ce chiffre qu’on compare au seuil."
              value={evenement.billetsVendus}
              onChange={(v) => onPatch({ billetsVendus: Math.max(Math.round(v), 0) })}
            />
            <ChampArgent
              label="Prix du billet"
              value={evenement.prixBilletCents}
              onChange={(v) => onPatch({ prixBilletCents: v })}
            />
          </div>
          <Jauge
            vendus={evenement.billetsVendus}
            capacite={evenement.capacite}
            seuil={economie.seuilEntrees}
          />
        </Bloc>

        {/* ------------------------------ L'argent ---------------------------- */}
        <Bloc titre="Ce que ça coûte">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ChampArgent
              label="Location du lieu"
              value={evenement.coutLieuCents}
              onChange={(v) => onPatch({ coutLieuCents: v })}
            />
            <ChampArgent
              label="Prestataires"
              aide="Son, lumière, sécurité, traiteur — le total."
              value={evenement.coutPrestatairesCents}
              onChange={(v) => onPatch({ coutPrestatairesCents: v })}
            />
            <ChampArgent
              label="Communication"
              value={evenement.coutCommunicationCents}
              onChange={(v) => onPatch({ coutCommunicationCents: v })}
            />
            <ChampArgent
              label={tr('hist.events.coutParEntree')}
              aide="Ce que chaque personne coûte en plus : bracelet, boisson."
              value={evenement.coutParEntreeCents}
              onChange={(v) => onPatch({ coutParEntreeCents: v })}
            />
            <ChampNombre
              label="Commission billetterie"
              suffixe="%"
              value={evenement.commissionBilletterie}
              onChange={(v) => onPatch({ commissionBilletterie: Math.min(Math.max(v, 0), 100) })}
            />
          </div>
        </Bloc>

        {/* ----------------------------- Documents ---------------------------- */}
        <Bloc titre="Les documents">
          {/*
            LE MODULE DOIT SE SUFFIRE.

            La fiche, la conduite et la check-list du jour J sont des pages du
            moteur de blocs — inutile de refaire un éditeur ici. Mais il faut
            qu'on les trouve DEPUIS l'événement : chercher « Pages » dans la
            navigation en régie, la veille au soir, c'est exactement le genre
            de détour qui fait qu'on ne s'en sert pas.
          */}
          <Link
            to="/evenements/documents"
            className="flex min-h-11 items-center gap-2 border border-border px-3 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:min-h-0 md:py-2"
          >
            <FileText size={13} strokeWidth={1.9} />{tr('hist.events.fichesConduiteEtCheck')}</Link>
        </Bloc>

        {/* ------------------------------- Notes ------------------------------ */}
        <Bloc titre="Notes">
          <textarea
            value={evenement.notes ?? ''}
            onChange={(e) => onPatch({ notes: e.target.value })}
            rows={4}
            placeholder={tr('hist.events.contactsAccesCeQu')}
            aria-label="Notes"
            className="input-focus w-full resize-y border border-border bg-bg px-3 py-2 text-sm leading-relaxed text-text-primary outline-none"
          />
        </Bloc>

        {/* ------------------------------ Gestes ------------------------------ */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => onPatch({ annule: !evenement.annule })}
            className="flex min-h-11 items-center gap-2 border border-border px-3 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:min-h-0 md:py-2"
          >
            {evenement.annule ? <Undo2 size={13} strokeWidth={1.9} /> : <XCircle size={13} strokeWidth={1.9} />}
            {evenement.annule ? 'Rétablir' : 'Annuler l’événement'}
          </button>

          {/*
            La suppression demande confirmation, l'annulation non : annuler se
            défait d'un clic (« Rétablir »), supprimer efface les chiffres sur
            lesquels on aurait bâti le bilan du suivant.
          */}
          {confirmSuppression ? (
            <>
              <span className="text-xs text-text-secondary">{tr('hist.events.supprimerDefinitivement')}</span>
              <button
                type="button"
                onClick={onDelete}
                className="flex min-h-11 items-center gap-2 border border-danger/50 px-3 text-xs text-danger transition-colors hover:bg-danger/10 md:min-h-0 md:py-2"
              >
                <Trash2 size={13} strokeWidth={1.9} />{tr('hist.events.ouiSupprimer')}</button>
              <button
                type="button"
                onClick={() => setConfirmSuppression(false)}
                className="min-h-11 px-2 text-xs text-text-muted transition-colors hover:text-text-primary md:min-h-0"
              >
                Non
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmSuppression(true)}
              className="flex min-h-11 items-center gap-2 px-2 text-xs text-text-muted transition-colors hover:text-danger md:min-h-0"
            >
              <Trash2 size={13} strokeWidth={1.9} />{tr('hist.events.supprimer')}</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Le verdict ------------------------------- */

/**
 * Ce qu'on est venu chercher, en haut : combien d'entrées avant l'équilibre,
 * et combien de temps il reste pour les vendre.
 *
 * Le cas INATTEIGNABLE passe devant tout le reste et n'affiche aucun compte
 * d'entrées : proposer « encore 8 entrées » sur un événement qui perd de
 * l'argent à chaque billet serait une consigne fausse, et quelqu'un la
 * suivrait.
 */
function Verdict({ vu, jours }: { vu: EvenementVu; jours: number | null }) {
  const { economie, etat } = vu;

  if (economie.erreurs.length > 0) {
    return (
      <ul className="flex flex-col gap-1">
        {economie.erreurs.map((err) => (
          <li
            key={err.key}
            className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs leading-relaxed text-text-primary"
          >
            {err.message}
          </li>
        ))}
      </ul>
    );
  }

  const revolu = etat === 'passe' || etat === 'annule';

  return (
    <div className="border-l-2 border-accent bg-bg/40 px-4 py-3">
      {!economie.atteignable ? (
        <>
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{tr('hist.events.rentabilite')}</p>
          <p className="mt-1 text-[15px] font-medium text-danger">
            {economie.seuilEntrees === null
              ? 'Chaque entrée vendue coûte de l’argent'
              : 'Le seuil dépasse la jauge'}
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-text-secondary">
            {economie.seuilEntrees === null
              ? `Une entrée rapporte ${formatCents(economie.recetteNetteBilletCents)} nets, commission et coût par entrée déduits. Il n’existe donc AUCUN nombre d’entrées qui équilibre : en vendre davantage creuse le trou. C’est le prix du billet ou le coût par entrée qu’il faut reprendre.`
              : `Il faudrait ${economie.seuilEntrees} entrées pour couvrir ${formatCents(economie.coutsFixesCents)} de coûts fixes, et la salle en contient ${vu.evenement.capacite}. Aucune vente ne rattrapera cela : il faut baisser un coût ou monter le prix.`}
          </p>
        </>
      ) : revolu ? (
        <>
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{tr('hist.events.resultat')}</p>
          <p
            className={`mt-1 font-mono text-xl tabular-nums ${
              economie.resultatActuelCents >= 0 ? 'text-text-primary' : 'text-danger'
            }`}
          >
            {formatCents(economie.resultatActuelCents)}
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-text-secondary">
            {vu.evenement.billetsVendus} entrée{vu.evenement.billetsVendus > 1 ? 's' : ''} vendue
            {vu.evenement.billetsVendus > 1 ? 's' : ''}
            {economie.seuilEntrees === null
              ? ', sur un événement qui perdait de l’argent à chaque entrée.'
              : ` sur un seuil de ${economie.seuilEntrees}.`}
          </p>
        </>
      ) : (
        <>
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {economie.entreesAvantEquilibre > 0 ? 'Avant l’équilibre' : 'Au-delà de l’équilibre'}
          </p>
          <p className="mt-1 font-mono text-xl tabular-nums text-text-primary">
            {economie.entreesAvantEquilibre > 0
              ? `${economie.entreesAvantEquilibre} entrée${economie.entreesAvantEquilibre > 1 ? 's' : ''}`
              : formatCents(economie.resultatActuelCents)}
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-text-secondary">
            {economie.entreesAvantEquilibre > 0
              ? `Seuil à ${economie.seuilEntrees} entrées, ${vu.evenement.billetsVendus} vendues. ${compteARebours(jours)}${
                  jours !== null && jours > 0 ? ' pour les vendre.' : '.'
                }`
              : `Seuil franchi. Salle comble, l’événement dégagerait ${formatCents(economie.margeSalleCombleCents)}.`}
          </p>
        </>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border/60 pt-3 sm:grid-cols-4">
        <Mesure label={tr('hist.events.coutsFixes')} valeur={formatCents(economie.coutsFixesCents)} />
        <Mesure label={tr('hist.events.netParEntree')} valeur={formatCents(economie.recetteNetteBilletCents)} />
        {/*
          UN TIRET, PAS UN NOMBRE, quand il n'existe pas de seuil.

          Le moteur de calcul rend ici un nombre grand mais fini pour ne pas
          laisser passer un `Infinity` — bonne garantie de sa part, mais ce
          n'est pas un seuil : sur 2 300 € de coûts il valait 230 000, et
          « SEUIL 230 000 » se lisait « il faut vendre 230 000 places ». Un
          chiffre faux avec l'autorité d'un chiffre juste, à côté d'un verdict
          pourtant correct.
        */}
        <Mesure
          label="Seuil"
          valeur={economie.seuilEntrees === null ? '—' : String(economie.seuilEntrees)}
        />
        <Mesure label="Salle comble" valeur={formatCents(economie.margeSalleCombleCents)} />
      </dl>
    </div>
  );
}

function Mesure({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-widest text-text-muted">{label}</dt>
      <dd className="font-mono text-xs tabular-nums text-text-secondary">{valeur}</dd>
    </div>
  );
}

/**
 * La jauge — le remplissage, avec le seuil marqué DESSUS.
 *
 * Une barre de remplissage seule dit « 40 % » et n'appelle aucune décision. Le
 * repère du seuil est ce qui la rend utile : on voit d'un coup si la barre l'a
 * dépassé, et de combien il s'en faut.
 */
function Jauge({
  vendus,
  capacite,
  seuil,
}: {
  vendus: number;
  capacite: number;
  seuil: number | null;
}) {
  if (capacite <= 0) return null;
  const part = Math.min((vendus * 100) / capacite, 100);
  const repere = seuil !== null && seuil <= capacite ? (seuil * 100) / capacite : null;
  const atteint = seuil !== null && vendus >= seuil;

  return (
    <div className="mt-3">
      <div className="relative h-2 w-full bg-bg">
        <div
          className={`h-full transition-[width] duration-500 ${atteint ? 'bg-success' : 'bg-accent'}`}
          style={{ width: `${part}%` }}
        />
        {repere !== null && (
          <div
            className="absolute inset-y-0 w-px bg-text-primary"
            style={{ left: `${repere}%` }}
            title={`Seuil de rentabilité : ${seuil} entrées`}
            aria-hidden
          />
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 text-[10px] text-text-muted">
        <span className="tabular-nums">
          {vendus} / {capacite} places · {Math.round(part)} %
        </span>
        {seuil !== null && (
          <span className="tabular-nums">
            {/* Le trait noir sur la barre n'a de sens qu'expliqué une fois. */}
            Trait : seuil de rentabilité ({seuil})
          </span>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- Formulaire ------------------------------ */

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
        {titre}
      </h2>
      {children}
    </section>
  );
}

function Champ({
  label,
  aide,
  children,
}: {
  label: string;
  aide?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
        {label}
      </span>
      {children}
      {aide && <span className="mt-1 block text-[11px] leading-relaxed text-text-muted">{aide}</span>}
    </label>
  );
}

/**
 * Un montant.
 *
 * Le TEXTE saisi est conservé, pas les centimes — même convention que les
 * lignes de facture et les calculateurs. Réécrire `centsToInput` à chaque
 * frappe rend « 45,50 » impossible à taper : le « 4 » se réécrit en « 4.00 »
 * et le « 5 » suivant donne 4,005 €.
 */
function ChampArgent({
  label,
  aide,
  value,
  onChange,
}: {
  label: string;
  aide?: string;
  value: number;
  onChange: (cents: number) => void;
}) {
  const [texte, setTexte] = useState<string | null>(null);
  return (
    <Champ label={label} aide={aide}>
      <input
        inputMode="decimal"
        value={texte ?? centsToInput(value)}
        onChange={(e) => {
          setTexte(e.target.value);
          onChange(parsePositiveAmount(e.target.value));
        }}
        onBlur={() => setTexte(null)}
        aria-label={label}
        className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-right font-mono text-sm tabular-nums text-text-primary outline-none"
      />
    </Champ>
  );
}

function ChampNombre({
  label,
  aide,
  suffixe,
  value,
  onChange,
}: {
  label: string;
  aide?: string;
  suffixe?: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const [texte, setTexte] = useState<string | null>(null);
  return (
    <Champ label={suffixe ? `${label} (${suffixe})` : label} aide={aide}>
      <input
        inputMode="decimal"
        value={texte ?? String(value)}
        onChange={(e) => {
          setTexte(e.target.value);
          const n = Number.parseFloat(e.target.value.replace(',', '.'));
          onChange(Number.isFinite(n) ? n : 0);
        }}
        onBlur={() => setTexte(null)}
        aria-label={label}
        className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-right font-mono text-sm tabular-nums text-text-primary outline-none"
      />
    </Champ>
  );
}

/* --------------------------------------------------- l'affiche (`23e`) ---- */

/**
 * L'AFFICHE — l'objet dominant d'Événements (`23e`).
 *
 * Un événement n'existe pour personne avant d'avoir une affiche. C'est le seul
 * écran du produit dont l'objet dominant est COMPOSÉ POUR ÊTRE LU À TROIS
 * MÈTRES : papier clair, titre énorme, date en bandeau, et rien d'autre. Tout
 * ce qui se lit à cinquante centimètres — la jauge, les coûts, le seuil — vit
 * ailleurs sur l'écran.
 *
 * DEUX RÈGLES DU PAQUET :
 *
 *   1. **L'affiche garde son ratio A3 et sa mention de format.** Un aperçu
 *      qui ne respecte pas le ratio du papier fait composer un titre qui ne
 *      tiendra pas à l'impression, et on s'en aperçoit chez l'imprimeur.
 *   2. **Les cases d'inscription sont AU NOMBRE EXACT DE PLACES**, pas une
 *      barre de pourcentage. « 77 % » ne dit pas s'il reste sept places ou
 *      soixante-dix ; sept cases vides le disent sans compter.
 */
const AFFICHE_L = 268;
/** A3 : 297 × 420 mm, soit 1 / 1,414 — la racine de deux, comme toute la série A. */
const AFFICHE_RATIO = 1.4142;
const AFFICHE_H = Math.round(AFFICHE_L * AFFICHE_RATIO);

/** « SAM 11 OCT » — majuscules, sans point : un bandeau d'affiche ne ponctue pas. */
function dateDAffiche(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'DATE À POSER';
  return new Date(`${iso}T12:00:00`)
    .toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })
    .replace(/\./g, '')
    .toUpperCase();
}

function AfficheDeLEvenement({ vu, passes }: { vu: EvenementVu; passes: EvenementVu[] }) {
  const { evenement, economie } = vu;
  const places = Math.max(0, Math.round(evenement.capacite || 0));
  const pris = Math.max(0, Math.min(places, Math.round(evenement.billetsVendus || 0)));
  const halo = useHaloSignal(!!evenement.date);

  /*
    CE QU'IL RESTE À FAIRE — déduit des champs vides, jamais une liste saisie.
    Un événement sans date ni lieu ne s'affiche pas ; le dire ici évite de
    l'apprendre en regardant l'affiche et en ne comprenant pas ce qui cloche.
  */
  const restants = [
    !evenement.date && 'poser la date',
    !evenement.horaire && 'préciser l’horaire',
    !evenement.lieu && 'nommer le lieu',
    places === 0 && 'fixer la jauge',
    evenement.prixBilletCents === 0 && 'fixer le prix d’entrée',
  ].filter(Boolean) as string[];

  return (
    <section className="panel-raised panel-raised-wide panel-ticks px-6 py-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="eyebrow">L’affiche · telle qu’elle sera imprimée</p>
        <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
          composée pour être lue à trois mètres
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* L'AFFICHE — papier clair, ratio A3 tenu par le style en ligne. */}
        <div className="flex-shrink-0">
          <div
            className="flex flex-col justify-between overflow-hidden"
            style={{
              width: AFFICHE_L,
              height: AFFICHE_H,
              background: 'var(--color-text-primary)',
              boxShadow: '0 40px 70px -30px rgba(0,0,0,1)',
            }}
          >
            <div className="px-5 pt-6">
              <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] text-[#5c5c59]">
                {evenement.lieu || 'lieu à nommer'}
              </p>
              <h2
                /*
                  L'ENCRE DU TITRE : le jeton `--color-raised` (#141414), pas
                  une copie de sa valeur. C'est le même noir que le plan levé
                  de l'application — sur papier clair il fait une encre de
                  presse, et le jour où la rampe bouge, il bouge avec elle.
                */
                className="mt-4 font-bold leading-[0.96] tracking-[-0.03em]"
                style={{ fontSize: 42, color: 'var(--color-raised)' }}
              >
                {evenement.nom || 'Sans titre'}
              </h2>
            </div>

            {/*
              LE BANDEAU DE DATE — l'unique ambre de l'écran. Plaque pleine,
              encre noire, 17 px mono : c'est la seule ligne de l'affiche qu'on
              lit avant le titre quand on passe devant.
            */}
            <div
              className={`bg-signal px-5 py-4 ${halo}`}
              data-signal-groupe="bandeau"
            >
              {/*
                LA DATE ET L'HORAIRE SUR DEUX LIGNES, décidées plutôt que
                subies. À 17 px mono, « DIM 11 OCT · 10 H → 17 H » dépasse la
                largeur utile de l'affiche et se coupait n'importe où — vu sur
                capture, avec « 17 H » seul sur sa ligne. Deux lignes posées
                se lisent à trois mètres ; une césure au hasard, non.
              */}
              <p className="tnum font-mono text-[17px] font-bold leading-[1.25] tracking-[0.03em] text-signal-ink">
                {dateDAffiche(evenement.date)}
              </p>
              {evenement.horaire && (
                <p className="tnum font-mono text-[17px] font-bold leading-[1.25] tracking-[0.03em] text-signal-ink">
                  {evenement.horaire.toUpperCase()}
                </p>
              )}
            </div>
          </div>
          <p className="mt-2 text-center font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
            A3 · 297 × 420 mm
          </p>
        </div>

        {/* LES INSCRIPTIONS — le nombre, puis une case par place. */}
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-2">Inscrits</p>
          <p className="tnum font-mono text-[52px] font-bold leading-none tracking-[-0.04em] text-text-primary">
            {pris}
          </p>
          <p className="mt-2 text-[13px] text-text-secondary">
            sur {places || '—'} place{places > 1 ? 's' : ''}
            {places > 0 && ` · il en reste ${places - pris}`}
          </p>

          {places > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {Array.from({ length: places }).map((_, i) => (
                <span
                  key={i}
                  className={`h-4 w-4 ${i < pris ? 'bg-[#4a4a48]' : 'border border-border-strong'}`}
                  aria-hidden
                />
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-col divide-y divide-border-row">
            <div className="flex items-baseline justify-between gap-4 py-2">
              <span className="text-[12.5px] text-text-secondary">
                Entrées à vendre pour l’équilibre
              </span>
              <span className="tnum font-mono text-[13px] font-semibold text-text-primary">
                {economie.entreesAvantEquilibre}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2">
              <span className="text-[12.5px] text-text-secondary">Résultat à ce jour</span>
              <span className="tnum font-mono text-[13px] text-text-primary">
                {formatCents(economie.resultatActuelCents)}
              </span>
            </div>
          </div>

          {/*
            ÉCART DIT. `MODULES.md` demande ici la COMPOSITION des inscrits
            (clients / prospects / inconnus) et le fait que quatre d'entre eux
            attendent un devis. Le produit ne garde PAS la liste des inscrits :
            `billetsVendus` est un COMPTE, pas un carnet. Répartir ce compte en
            trois catégories reviendrait à inventer des gens.
          */}
          <p className="mt-5 border-t border-border-row pt-3 text-[12.5px] leading-relaxed text-text-muted">
            Le produit garde un COMPTE d’entrées, pas un carnet d’inscrits : il ne sait pas qui
            vient, donc il ne dit pas d’où ils viennent. Les répartir en clients, prospects et
            inconnus reviendrait à inventer des gens.
          </p>

          {restants.length > 0 && (
            <p className="mt-3 text-[12.5px] leading-relaxed text-text-secondary">
              Avant d’imprimer : {restants.join(', ')}.
            </p>
          )}
        </div>
      </div>

      {/* LES ÉVÉNEMENTS PASSÉS — ce que les précédents ont donné. */}
      {passes.length > 0 && (
        <div className="mt-7 border-t border-border-raised pt-5">
          <p className="eyebrow mb-3">Ce que les précédents ont donné</p>
          <div className="flex flex-col divide-y divide-border-row">
            {passes.slice(0, 4).map((p) => (
              <div key={p.evenement.id} className="flex flex-wrap items-baseline gap-x-5 gap-y-1 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-text-primary">
                  {p.evenement.nom || 'Sans titre'}
                </span>
                <span className="tnum w-[96px] flex-shrink-0 text-right font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
                  {p.evenement.date || '—'}
                </span>
                <span className="tnum w-[92px] flex-shrink-0 text-right font-mono text-[12.5px] text-text-secondary">
                  {p.evenement.billetsVendus}/{p.evenement.capacite}
                </span>
                <span className="tnum w-[104px] flex-shrink-0 text-right font-mono text-[12.5px] text-text-primary">
                  {formatCents(p.economie.resultatActuelCents)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-text-muted">
            Entrées vendues sur jauge, et résultat. Le nombre de VENUS et les devis issus de
            l’événement ne sont pas suivis : rien dans le produit ne les enregistre.
          </p>
        </div>
      )}
    </section>
  );
}
