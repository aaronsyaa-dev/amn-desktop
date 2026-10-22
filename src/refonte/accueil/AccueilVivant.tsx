import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUp, Check, EyeOff, MessageSquare, Plus } from 'lucide-react';
import { Bouton, Saisie } from '../../socle/ui';
import { useAssistant } from '../../assistant/AssistantContext';
import { signalerGuide } from '../../guide/memoire';
import { depuisQuand } from '../garde/fil';
import { lireParole, useParole, quelquUnEstOccupe } from './ajmani/memoire';
import { astuceDuMoment, choisir, masquerAstuce, noterAstuce, repliqueDuJour } from './ajmani/parole';
import { useRegistre } from './ajmani/registre';
import type { Astuce } from './ajmani/phrases';
import { raccourciAssistant } from './etat';
import { ajouter, masquer, toutReafficher, type LigneFil, type RetouchesFil } from './filDuJour';
import { evolution, type Tuile } from './tuiles';
import { useAccueilLangue } from './i18n';
import { choisirScene } from './scenes';
import { useAccueil, type Accueil } from './useAccueil';

/**
 * L'ACCUEIL DE LA REFONTE (`42k`) — noir et gris, très rangé, sans personnage.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   · en haut, la salutation, le message discret d'Ajmani, les pastilles
 *     « Série » et « Boîte à zéro » quand elles sont vraies ;
 *   · quatre tuiles — seulement celles dont la donnée existe ;
 *   · « Aujourd'hui » : des cases à cocher, « x sur y fait », le responsable
 *     de chaque ligne, et le SEUL bouton blanc plein de l'écran ;
 *   · « Activité de l'équipe » : le journal, ponctué de jalons ;
 *   · en bas, la barre d'Ajmani : elle ouvre le panneau assistant (⌘J).
 *
 * Il n'y a pas de navigation ici : il n'y en a qu'une, celle de S1.
 *
 * Trois états, dits honnêtement :
 *   chargement — des gabarits ; aucun message, aucun « rien de prévu » ;
 *   hors ligne — le dit, sans chiffre calculé sur un miroir peut-être incomplet ;
 *   prêt       — tout s'affiche.
 *
 * Les couleurs de famille ne sont que de petits points. Le mouvement passe
 * par framer-motion et les animations CSS, sous le réglage Mouvement du socle.
 */

const avatar = (nom: string) =>
  nom
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase())
    .join('');

function Initiales({ nom }: { nom: string }) {
  return (
    <span aria-hidden className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-socle-bord bg-socle-eleve text-[10px] font-semibold text-socle-texte-doux">
      {avatar(nom)}
    </span>
  );
}

/** Un gabarit : ce qui va arriver, sans rien affirmer. */
function Gabarit({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded bg-socle-survol ${className}`} />;
}

export function AccueilVivant() {
  const a = useAccueil();
  const { langue, ta } = useAccueilLangue();
  const registre = useRegistre();
  const [parole, transformer] = useParole(a.email);
  const assistant = useAssistant();
  const navigate = useNavigate();
  const raccourci = raccourciAssistant();

  /* Le message d'Ajmani : choisi une fois par jour et par situation, jamais avant que les données aient répondu. */
  const mise = useMemo(() => choisirScene(a.journee), [a.journee]);
  const message = useMemo(
    () => (a.complet ? repliqueDuJour(parole, a.jour, mise.scene, langue, mise.situation, registre, mise.params) : null),
    [a.complet, parole, a.jour, mise.scene, mise.situation, mise.params, langue, registre],
  );
  useEffect(() => {
    if (message && message.etat !== parole) transformer(() => message.etat);
  }, [message, parole, transformer]);
  const versDuMessage = mise.situation.startsWith('alerte.') ? a.alerte?.vers : mise.situation === 'relance' ? '/relances' : mise.situation === 'calme.module' ? a.moduleRoute : null;

  /* L'astuce : au plus deux par jour, une par passage, jamais pendant une alerte ni le premier jour. */
  const astuce = !a.complet || mise.scene === 'alerte' || mise.scene === 'neuf' ? null : astuceDuMoment(parole, a.jour);
  const [astuceAffichee, setAstuceAffichee] = useState<{ astuce: Astuce; texte: string } | null>(null);
  const astuceMontree = useRef(false);
  useEffect(() => {
    if (!astuce || astuceAffichee || astuceMontree.current) return undefined;
    const t = setTimeout(() => {
      if (quelquUnEstOccupe()) return;
      astuceMontree.current = true;
      const { replique, etat } = choisir(lireParole(a.email), langue, astuce, registre, { raccourci });
      transformer(() => noterAstuce(etat, a.jour, astuce));
      setAstuceAffichee({ astuce, texte: replique.texte });
    }, 2500);
    return () => clearTimeout(t);
  }, [astuce, astuceAffichee, a.jour, a.email, langue, registre, raccourci, transformer]);

  const h = a.maintenant.getHours();
  const salut = !a.prenom ? ta('salut.anonyme') : ta(h >= 5 && h < 12 ? 'salut.matin' : h >= 12 && h < 18 ? 'salut.jour' : 'salut.soir', { prenom: a.prenom });
  const date = a.maintenant.toLocaleDateString(langue === 'en' ? 'en-GB' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const charge = a.etat === 'chargement';

  return (
    <div data-accueil="vivant" aria-busy={charge || undefined} className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 text-socle-texte">
      {/* ── Salutation, message d'Ajmani, pastilles ── */}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-socle-texte [text-wrap:balance]">{salut}</h1>
            <p className="mt-0.5 text-[13px] text-socle-texte-doux first-letter:uppercase">{date}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {a.serie > 0 && <Pastille titre={ta('pastille.serie', { n: a.serie })} aide={ta('pastille.serie.aide', { n: a.serie })} famille="jour" />}
            {a.boiteAZero && <Pastille titre={ta('pastille.boite')} aide={ta('pastille.boite.aide')} famille="echanger" />}
          </div>
        </div>
        {a.etat === 'hors-ligne' && (
          <p role="status" className="text-[13px] text-socle-texte-doux">
            {ta('etat.horsligne')}
          </p>
        )}
        {charge && (
          <p className="sr-only" role="status">
            {ta('etat.chargement')}
          </p>
        )}
        {message?.texte && (
          <div className="flex flex-col gap-0.5">
            <p className="text-[14px] text-socle-texte-doux">
              <span className="font-medium text-socle-texte">Ajmani</span> · {message.texte}
              {versDuMessage && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={() => navigate(versDuMessage)}
                    className="rounded text-socle-texte underline decoration-socle-bord-fort underline-offset-4 hover:decoration-socle-texte focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-socle-focus"
                  >
                    {ta('message.ouvrir')}
                  </button>
                </>
              )}
            </p>
            {mise.scene === 'alerte' && a.alerte && (
              <p className="text-[13px] text-socle-texte-doux">
                <span className="text-socle-texte">{a.alerte.titre}</span>
                {a.alerte.detail ? ` · ${a.alerte.detail}` : ''}
              </p>
            )}
          </div>
        )}
        {astuceAffichee && (
          <div role="note" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-socle-texte-doux">
            <span className="min-w-0">{astuceAffichee.texte}</span>
            <button
              type="button"
              className="rounded text-socle-texte underline decoration-socle-bord-fort underline-offset-4 hover:decoration-socle-texte focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-socle-focus"
              onClick={() => {
                transformer((e) => masquerAstuce(e, astuceAffichee.astuce));
                setAstuceAffichee(null);
              }}
            >
              {ta('astuce.masquer')}
            </button>
          </div>
        )}
      </header>

      {/* ── Les tuiles : seulement celles dont la donnée existe (des gabarits le temps du chargement) ── */}
      {charge ? (
        <section aria-hidden className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex min-h-[112px] flex-col gap-3 rounded-xl border border-socle-bord bg-socle-surface p-4">
              <Gabarit className="h-3 w-24" />
              <Gabarit className="h-6 w-28" />
              <Gabarit className="mt-auto h-3 w-32" />
            </div>
          ))}
        </section>
      ) : (
        a.tuiles.length > 0 && (
          <section aria-label={ta('tuiles.titre')} className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
            {a.tuiles.map((t) => (
              <TuileAccueil key={t.cle} t={t} maintenant={a.maintenant} />
            ))}
          </section>
        )
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Aujourdhui a={a} />
        <Activite a={a} />
      </div>

      {/* ── La barre d'Ajmani : elle ouvre le panneau assistant ── */}
      <BarreAjmani raccourci={raccourci} />
    </div>
  );
}

/* ── La barre d'Ajmani ─────────────────────────────────────────────────── */

function BarreAjmani({ raccourci }: { raccourci: string }) {
  const { ta } = useAccueilLangue();
  const assistant = useAssistant();
  const [texte, setTexte] = useState('');
  // Sur un écran étroit, l'invite complète serait coupée : on garde la courte (le nom accessible reste complet).
  const etroit = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(max-width: 480px)').matches);
  const envoyer = (e: React.FormEvent) => {
    e.preventDefault();
    const propre = texte.trim();
    // Le panneau s'ouvre d'abord ; un texte tapé lui est envoyé tel quel.
    assistant.open('chat');
    if (propre) assistant.sendMessage(propre);
    setTexte('');
  };
  return (
    <form onSubmit={envoyer} className="flex items-center gap-3 rounded-xl border border-socle-bord bg-socle-surface py-1.5 pl-4 pr-1.5 transition-colors focus-within:border-socle-bord-fort hover:border-socle-bord-fort">
      <MessageSquare size={16} aria-hidden className="flex-none text-socle-texte-doux" />
      <input
        id="accueil-ajmani"
        type="text"
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        placeholder={etroit ? ta('ajmani.barre.court') : ta('ajmani.barre')}
        aria-label={ta('ajmani.barre')}
        aria-keyshortcuts="Control+J Meta+J"
        autoComplete="off"
        maxLength={500}
        className="min-h-10 min-w-0 flex-1 bg-transparent text-[14px] text-socle-texte placeholder:text-socle-texte-doux focus:outline-none"
      />
      <kbd className="hidden flex-none rounded border font-sans border-socle-bord bg-socle-eleve px-1.5 py-0.5 text-[11px] text-socle-texte-doux sm:block">{raccourci}</kbd>
      <button
        type="submit"
        aria-label={texte.trim() ? ta('ajmani.barre.envoyer') : ta('ajmani.barre.aide', { raccourci })}
        title={texte.trim() ? ta('ajmani.barre.envoyer') : ta('ajmani.barre.aide', { raccourci })}
        className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-socle-texte-doux transition-colors hover:bg-socle-survol hover:text-socle-texte focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-socle-focus"
      >
        <ArrowUp size={16} aria-hidden />
      </button>
    </form>
  );
}

/* ── Les pastilles ─────────────────────────────────────────────────────── */

function Pastille({ titre, aide, famille }: { titre: string; aide: string; famille: string }) {
  return (
    <span data-famille={famille} title={aide} className="inline-flex items-center gap-2 rounded-full border border-socle-bord bg-socle-surface px-3 py-1 text-[12px] font-medium text-socle-texte">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--fam)]" />
      {titre}
      <span className="sr-only"> — {aide}</span>
    </span>
  );
}

/* ── Une tuile ─────────────────────────────────────────────────────────── */

function TuileAccueil({ t, maintenant }: { t: Tuile; maintenant: Date }) {
  const { langue, ta } = useAccueilLangue();
  const navigate = useNavigate();
  const lieu = langue === 'en' ? 'en-GB' : 'fr-FR';
  const euros = (cents: number) => new Intl.NumberFormat(lieu, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
  const nomMois = (decalage: number) => new Date(maintenant.getFullYear(), maintenant.getMonth() + decalage, 1).toLocaleDateString(lieu, { month: 'long' });

  let titre = '';
  let valeur: React.ReactNode = null;
  let sous = '';
  let vers = '/';
  let famille = 'argent';
  if (t.cle === 'ca') {
    titre = ta('tuile.ca');
    valeur = euros(t.cents);
    const evol = evolution(t.cents, t.moisPrecedentCents);
    sous = evol === null ? ta('tuile.ca.sous', { mois: nomMois(0) }) : ta('tuile.ca.evol', { signe: evol > 0 ? '+' : '', n: evol, mois: nomMois(-1) });
    vers = '/facturation';
  } else if (t.cle === 'attente') {
    titre = ta('tuile.attente');
    valeur = euros(t.cents);
    sous = t.nombre ? ta('tuile.attente.sous', { n: t.nombre, r: t.enRetard }) : ta('tuile.attente.aucune');
    vers = t.enRetard ? '/relances' : '/facturation';
  } else if (t.cle === 'equipe') {
    titre = ta('tuile.equipe');
    valeur = t.ouvertes;
    sous = ta('tuile.equipe.sous', { c: t.enCours, f: t.faitesSemaine });
    vers = '/tasks';
    famille = 'jour';
  } else {
    titre = ta('tuile.objectif');
    valeur = <span className="text-[15px] font-medium leading-snug tracking-normal">{t.texte}</span>;
    sous = ta('tuile.objectif.sous');
    vers = '/revue-hebdo';
    famille = 'jour';
  }

  return (
    <button
      type="button"
      onClick={() => navigate(vers)}
      data-famille={famille}
      className="flex min-h-[112px] flex-col items-start gap-2 rounded-xl border border-socle-bord bg-socle-surface p-4 text-left transition-colors hover:border-socle-bord-fort focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-socle-focus"
    >
      <span className="flex items-center gap-2 text-[12px] font-medium text-socle-texte-doux">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--fam)]" />
        {titre}
      </span>
      <span className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-socle-texte">{valeur}</span>
      <span className="mt-auto text-[12px] text-socle-texte-doux">{sous}</span>
    </button>
  );
}

/* ── Aujourd'hui ───────────────────────────────────────────────────────── */

function Aujourdhui({ a }: { a: Accueil }) {
  const { ta } = useAccueilLangue();
  const navigate = useNavigate();
  const [ajout, setAjout] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const boutonAjout = useRef<HTMLButtonElement>(null);
  const etaitOuvert = useRef(false);
  const total = a.fil.length;
  const part = total ? a.faits / total : 0;
  const premierJour = a.fil.some((l) => l.type === 'etape');

  // Fermer le champ rend le focus au bouton qui l'a ouvert : on ne se retrouve jamais « nulle part ».
  useEffect(() => {
    if (etaitOuvert.current && !ouvert) boutonAjout.current?.focus();
    etaitOuvert.current = ouvert;
  }, [ouvert]);

  const abreger = (t: string) => (t.length > 32 ? `${t.slice(0, 30)}…` : t);
  const libelleAction =
    a.action.cle === 'alerte'
      ? ta('action.ouvrir', { titre: abreger(a.action.titre) })
      : a.action.cle === 'relancer'
        ? ta('action.relancer', { nom: a.action.nom })
        : a.action.cle === 'commencer'
          ? ta('action.commencer', { titre: abreger(a.action.titre) })
          : a.action.cle === 'ouvrir'
            ? ta('action.ouvrir', { titre: abreger(a.action.titre) })
            : ta('action.priorites');

  const valider = (e: React.FormEvent) => {
    e.preventDefault();
    a.retoucher((r, jour) => ajouter(r, jour, ajout, Date.now().toString(36)));
    setAjout('');
    setOuvert(false);
  };

  return (
    <section aria-labelledby="accueil-jour" className="flex min-w-0 flex-col self-start rounded-xl border border-socle-bord bg-socle-surface">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-socle-bord px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <h2 id="accueil-jour" className="text-[15px] font-semibold text-socle-texte">
            {ta('jour.titre')}
          </h2>
          {total > 0 && (
            <div className="mt-1.5 flex items-center gap-3">
              <span aria-live="polite" className="whitespace-nowrap text-[12px] text-socle-texte-doux">
                {ta('jour.progres', { x: a.faits, y: total })}
              </span>
              <span aria-hidden className="h-1 w-28 overflow-hidden rounded-full bg-socle-eleve">
                <motion.span className="block h-full rounded-full bg-socle-texte" initial={false} animate={{ width: `${Math.round(part * 100)}%` }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} />
              </span>
            </div>
          )}
        </div>
        {/* Le seul bouton blanc plein de l'écran — pas avant que les données aient répondu, ni sur un miroir peut-être incomplet. */}
        {a.etat === 'pret' && (
          <Bouton variante="primaire" taille="petit" onClick={() => navigate(a.action.vers)}>
            {libelleAction}
          </Bouton>
        )}
      </header>

      {a.etat === 'chargement' ? (
        <ul aria-hidden className="flex flex-col">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 border-b border-socle-bord px-4 py-3.5 last:border-b-0">
              <Gabarit className="h-[18px] w-[18px] flex-none" />
              <Gabarit className={`h-3 ${i === 1 ? 'w-2/5' : 'w-3/5'}`} />
            </li>
          ))}
        </ul>
      ) : total === 0 ? (
        <p className="px-4 py-6 text-[14px] text-socle-texte-doux">{a.etat === 'hors-ligne' ? ta('etat.horsligne.court') : ta('jour.vide')}</p>
      ) : (
        <>
          {premierJour && <p className="border-b border-socle-bord px-4 py-3 text-[13px] text-socle-texte-doux">{ta('jour.etapes.aide')}</p>}
          <ul className="flex flex-col">
            {a.fil.map((l) => (
              <LigneDuJour key={l.cle} l={l} nomDe={a.nomDe} cocher={a.cocher} retoucher={a.retoucher} />
            ))}
          </ul>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-socle-bord px-3 py-2.5">
        {ouvert ? (
          <form
            onSubmit={valider}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setAjout('');
                setOuvert(false);
              }
            }}
            className="flex w-full flex-wrap items-end gap-2"
          >
            <div className="min-w-0 flex-1">
              {/* Le champ ne prend le focus que parce qu'on vient de demander à écrire. */}
              <Saisie etiquette={ta('jour.ajouter')} aide={ta('jour.ajouter.aide')} value={ajout} maxLength={140} onChange={(e) => setAjout(e.target.value)} autoFocus />
            </div>
            <Bouton type="submit" taille="moyen" variante="secondaire" disabled={!ajout.trim()}>
              {ta('jour.ajouter.ok')}
            </Bouton>
            <Bouton
              type="button"
              taille="moyen"
              variante="discret"
              onClick={() => {
                setAjout('');
                setOuvert(false);
              }}
            >
              {ta('jour.annuler')}
            </Bouton>
          </form>
        ) : (
          <Bouton ref={boutonAjout} taille="petit" variante="discret" icone={<Plus size={14} aria-hidden />} onClick={() => setOuvert(true)} disabled={a.etat === 'chargement'}>
            {ta('jour.ajouter')}
          </Bouton>
        )}
        {!ouvert && a.masquees > 0 && (
          <Bouton taille="petit" variante="discret" onClick={() => a.retoucher((r, jour) => toutReafficher(r, jour))}>
            {ta('jour.reafficher', { n: a.masquees })}
          </Bouton>
        )}
      </div>
    </section>
  );
}

function LigneDuJour({
  l,
  nomDe,
  cocher,
  retoucher,
}: {
  l: LigneFil;
  nomDe: (email: string) => string;
  cocher: (l: LigneFil) => void;
  retoucher: (fn: (r: RetouchesFil, jour: string) => RetouchesFil) => void;
}) {
  const { ta } = useAccueilLangue();
  const navigate = useNavigate();
  const lecture = l.case === 'lecture';
  const ouvrir = l.cle === 'etape:visite' ? () => signalerGuide() : l.vers ? () => navigate(l.vers as string) : undefined;
  const responsable = l.responsable ? nomDe(l.responsable) : null;
  const masquerLigne = (e: React.MouseEvent<HTMLButtonElement>) => {
    // La ligne disparaît : le focus passe à la case voisine, il ne tombe pas dans le vide.
    const li = e.currentTarget.closest('li');
    const voisin = (li?.nextElementSibling ?? li?.previousElementSibling)?.querySelector<HTMLElement>('[role="checkbox"]');
    retoucher((r, jour) => masquer(r, jour, l.cle));
    requestAnimationFrame(() => voisin?.focus());
  };
  return (
    <li data-famille={l.famille} className="group flex items-center gap-3 border-b border-socle-bord px-4 py-2.5 last:border-b-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={l.fait}
        aria-disabled={lecture || undefined}
        aria-label={lecture ? ta('jour.lecture', { titre: l.titre }) : ta(l.fait ? 'jour.decocher' : 'jour.cocher', { titre: l.titre })}
        onClick={() => !lecture && cocher(l)}
        className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-socle-focus ${
          l.fait ? 'border-socle-texte bg-socle-texte text-socle-primaire-encre' : 'border-socle-bord-fort'
        } ${lecture ? 'cursor-default opacity-70' : 'cursor-pointer'}`}
      >
        {l.fait && <Check size={12} strokeWidth={3} aria-hidden />}
      </button>
      <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-[var(--fam)]" />
      <button
        type="button"
        onClick={ouvrir}
        disabled={!ouvrir}
        className="min-w-0 flex-1 rounded text-left focus-visible:outline-2 focus-visible:outline-socle-focus disabled:cursor-default"
      >
        <span className={`block truncate text-[14px] ${l.fait ? 'text-socle-texte-doux line-through decoration-socle-bord-fort' : 'text-socle-texte'}`}>{l.titre}</span>
        {l.detail && <span className="block text-[12px] text-socle-texte-doux">{l.detail}</span>}
      </button>
      {responsable && (
        <span className="flex items-center gap-2 text-[12px] text-socle-texte-doux" title={`${ta('jour.responsable')} : ${responsable}`}>
          <Initiales nom={responsable} />
          <span className="hidden max-w-[9rem] truncate sm:inline">{responsable}</span>
          <span className="sr-only">{`${ta('jour.responsable')} : ${responsable}`}</span>
        </span>
      )}
      {/* Visible au survol et au clavier ; discrète sinon, mais toujours là pour le tactile. */}
      <Bouton
        className="opacity-80 group-hover:opacity-100 group-focus-within:opacity-100"
        taille="petit"
        variante="discret"
        onClick={masquerLigne}
        aria-label={ta('jour.masquer', { titre: l.titre })}
        title={ta('jour.masquer', { titre: l.titre })}
      >
        <EyeOff size={14} aria-hidden />
      </Bouton>
    </li>
  );
}

/* ── Activité de l'équipe ──────────────────────────────────────────────── */

/** Une date seule (un encaissement) se dit au jour ; un instant, en durée relative. */
function quandActivite(quand: string, maintenant: Date, langue: 'fr' | 'en'): string {
  if (quand.length !== 10) return depuisQuand(quand, maintenant.getTime(), langue);
  const jour = new Date(`${quand}T00:00:00`);
  const minuit = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const ecart = Math.round((jour.getTime() - minuit.getTime()) / 86_400_000);
  return new Intl.RelativeTimeFormat(langue, { numeric: 'auto' }).format(ecart, 'day');
}

function Activite({ a }: { a: Accueil }) {
  const { langue, ta } = useAccueilLangue();
  return (
    <section aria-labelledby="accueil-activite" className="flex min-w-0 flex-col self-start rounded-xl border border-socle-bord bg-socle-surface">
      <h2 id="accueil-activite" className="border-b border-socle-bord px-4 py-3.5 text-[15px] font-semibold text-socle-texte">
        {ta('activite.titre')}
      </h2>
      {a.etat === 'chargement' ? (
        <ul aria-hidden className="flex flex-col gap-3 px-4 py-4">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex flex-col gap-1.5">
              <Gabarit className={`h-3 ${i % 2 ? 'w-2/3' : 'w-5/6'}`} />
              <Gabarit className="h-2.5 w-20" />
            </li>
          ))}
        </ul>
      ) : a.activite.length === 0 ? (
        <p className="px-4 py-6 text-[14px] text-socle-texte-doux">{a.etat === 'hors-ligne' ? ta('etat.horsligne.court') : ta('activite.vide')}</p>
      ) : (
        <ol className="flex flex-col py-1.5">
          {a.activite.map((e) => (
            <li key={e.cle} data-famille={e.famille} className="relative flex gap-3 px-4 py-2">
              {/* Un jalon est un losange plein, le reste un point. */}
              <span aria-hidden className="mt-[7px] flex w-2 flex-none justify-center">
                {e.type === 'jalon' ? <span className="h-2 w-2 rotate-45 bg-[var(--fam)]" /> : <span className="h-1.5 w-1.5 rounded-full bg-[var(--fam)]" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[13.5px] leading-snug text-socle-texte ${e.type === 'jalon' ? 'font-medium' : ''}`}>
                  {e.type === 'jalon' && <span className="sr-only">{ta('activite.jalon')} : </span>}
                  {e.texte}
                </span>
                <span className="block text-[12px] text-socle-texte-doux">
                  {[e.qui ? a.nomDe(e.qui) : null, quandActivite(e.quand, a.maintenant, langue)].filter(Boolean).join(' · ')}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
