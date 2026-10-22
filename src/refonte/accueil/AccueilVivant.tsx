import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ChevronDown, ChevronRight, EyeOff, LayoutGrid, MessageSquare, Plus } from 'lucide-react';
import { Bouton, Saisie } from '../../socle/ui';
import { useSocleLangue, type CleSocle } from '../../socle/i18n';
import { useAssistant } from '../../assistant/AssistantContext';
import { signalerGuide } from '../../guide/memoire';
import { ROUTE_TOUS_LES_MODULES } from '../navigation/moment';
import { depuisQuand } from '../garde/fil';
import { lireParole, useParole, quelquUnEstOccupe } from './ajmani/memoire';
import { astuceDuMoment, choisir, masquerAstuce, noterAstuce, repliqueDuJour } from './ajmani/parole';
import { useRegistre } from './ajmani/registre';
import type { Astuce } from './ajmani/phrases';
import { ajouter, masquer, toutReafficher, type LigneFil } from './filDuJour';
import { evolution, type Tuile } from './tuiles';
import { useAccueilLangue } from './i18n';
import { choisirScene } from './scenes';
import { useAccueil, type Accueil, type FamilleBarre, type ModuleBarre } from './useAccueil';

/**
 * L'ACCUEIL DE LA REFONTE (`42k`) — noir et gris, très rangé, sans personnage.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   · à gauche, les sept familles et la Garde à part, « Ma journée » dépliée,
 *     des compteurs réels, qui est en ligne et où, « Tous les modules » ;
 *   · en haut, la salutation, le message discret d'Ajmani, les pastilles
 *     « Série » et « Boîte à zéro » quand elles sont vraies ;
 *   · quatre tuiles — seulement celles dont la donnée existe ;
 *   · « Aujourd'hui » : des cases à cocher, « x sur y fait », le responsable
 *     de chaque ligne, et le SEUL bouton blanc plein de l'écran ;
 *   · « Activité de l'équipe » : le journal, ponctué de jalons ;
 *   · en bas, la barre d'Ajmani : elle ouvre le panneau assistant (⌘J).
 *
 * Les couleurs de famille ne sont que de petits points. Le mouvement passe
 * par framer-motion, sous le réglage Mouvement du socle.
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

function Badge({ n, aide }: { n: number; aide: string }) {
  if (n <= 0) return null;
  return (
    <span className="ml-auto rounded-full bg-socle-eleve px-1.5 py-px text-[11px] font-medium text-socle-texte [font-variant-numeric:tabular-nums]" title={aide}>
      {n > 99 ? '99+' : n}
    </span>
  );
}

export function AccueilVivant() {
  const a = useAccueil();
  const { langue, ta } = useAccueilLangue();
  const registre = useRegistre();
  const [parole, transformer] = useParole(a.email);
  const assistant = useAssistant();

  /* Le message d'Ajmani : choisi une fois par jour et par situation, dit discrètement. */
  const mise = useMemo(() => choisirScene(a.journee), [a.journee]);
  const message = useMemo(
    () => repliqueDuJour(parole, a.jour, mise.scene, langue, mise.situation, registre, mise.params),
    [parole, a.jour, mise.scene, mise.situation, mise.params, langue, registre],
  );
  useEffect(() => {
    if (message.etat !== parole) transformer(() => message.etat);
  }, [message, parole, transformer]);

  /* L'astuce : au plus deux par jour, une par passage, jamais pendant une alerte. */
  const astuce = mise.scene === 'alerte' || mise.scene === 'neuf' ? null : astuceDuMoment(parole, a.jour);
  const [astuceAffichee, setAstuceAffichee] = useState<{ astuce: Astuce; texte: string } | null>(null);
  const astuceMontree = useRef(false);
  useEffect(() => {
    if (!astuce || astuceAffichee || astuceMontree.current) return undefined;
    const t = setTimeout(() => {
      if (quelquUnEstOccupe()) return;
      astuceMontree.current = true;
      const { replique, etat } = choisir(lireParole(a.email), langue, astuce, registre);
      transformer(() => noterAstuce(etat, a.jour, astuce));
      setAstuceAffichee({ astuce, texte: replique.texte });
    }, 2500);
    return () => clearTimeout(t);
  }, [astuce, astuceAffichee, a.jour, a.email, langue, registre, transformer]);

  const h = a.maintenant.getHours();
  const salut = !a.prenom ? ta('salut.anonyme') : ta(h < 12 ? 'salut.matin' : h < 18 ? 'salut.jour' : 'salut.soir', { prenom: a.prenom });
  const date = a.maintenant.toLocaleDateString(langue === 'en' ? 'en-GB' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div data-accueil="vivant" data-refonte-police="inter" className="grid gap-6 text-socle-texte lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8">
      <h1 className="sr-only">{ta('accueil.titre')}</h1>
      <BarreFamilles a={a} />

      <div className="order-1 flex min-w-0 flex-col gap-6 lg:order-none">
        {/* ── Salutation, message d'Ajmani, pastilles ── */}
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-socle-texte [text-wrap:balance]">{salut}</p>
              <p className="mt-0.5 text-[13px] text-socle-texte-doux first-letter:uppercase">{date}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {a.serie > 0 && <Pastille titre={ta('pastille.serie', { n: a.serie })} aide={ta('pastille.serie.aide', { n: a.serie })} famille="jour" />}
              {a.boiteAZero && <Pastille titre={ta('pastille.boite')} aide={ta('pastille.boite.aide')} famille="echanger" />}
            </div>
          </div>
          {message.texte && (
            <p role="status" className="text-[14px] text-socle-texte-doux">
              <span className="font-medium text-socle-texte">Ajmani</span> · {message.texte}
            </p>
          )}
          {astuceAffichee && (
            <div role="note" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-socle-texte-doux">
              <span className="min-w-0">{astuceAffichee.texte}</span>
              <button
                type="button"
                className="rounded text-socle-texte underline decoration-socle-bord-fort underline-offset-4 hover:decoration-socle-texte focus-visible:outline-2 focus-visible:outline-socle-focus"
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

        {/* ── Les tuiles : seulement celles dont la donnée existe ── */}
        {a.tuiles.length > 0 && (
          <section aria-label={ta('tuiles.titre')} className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
            {a.tuiles.map((t) => (
              <TuileAccueil key={t.cle} t={t} a={a} />
            ))}
          </section>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <Aujourdhui a={a} />
          <Activite a={a} />
        </div>

        {/* ── La barre d'Ajmani : elle ouvre le panneau assistant ── */}
        <button
          type="button"
          onClick={() => assistant.open('chat')}
          title={ta('ajmani.barre.aide')}
          className="flex w-full items-center gap-3 rounded-xl border border-socle-bord bg-socle-surface px-4 py-3 text-left text-[14px] text-socle-texte-doux transition-colors hover:border-socle-bord-fort hover:bg-socle-eleve focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-socle-focus"
        >
          <MessageSquare size={16} aria-hidden className="flex-none" />
          <span className="min-w-0 flex-1 truncate">{ta('ajmani.barre')}</span>
          <kbd className="flex-none rounded border border-socle-bord bg-socle-eleve px-1.5 py-0.5 text-[11px] text-socle-texte-doux">⌘J</kbd>
        </button>
      </div>
    </div>
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

function TuileAccueil({ t, a }: { t: Tuile; a: Accueil }) {
  const { langue, ta } = useAccueilLangue();
  const navigate = useNavigate();
  const euros = (cents: number) => new Intl.NumberFormat(langue === 'en' ? 'en-GB' : 'fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
  const nomMois = (decalage: number) => new Date(a.maintenant.getFullYear(), a.maintenant.getMonth() + decalage, 1).toLocaleDateString(langue === 'en' ? 'en-GB' : 'fr-FR', { month: 'long' });

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
      <span className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-socle-texte [font-variant-numeric:tabular-nums]">{valeur}</span>
      <span className="mt-auto text-[12px] text-socle-texte-doux [font-variant-numeric:tabular-nums]">{sous}</span>
    </button>
  );
}

/* ── Aujourd'hui ───────────────────────────────────────────────────────── */

function Aujourdhui({ a }: { a: Accueil }) {
  const { ta } = useAccueilLangue();
  const navigate = useNavigate();
  const [ajout, setAjout] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const total = a.fil.length;
  const part = total ? a.faits / total : 0;

  const libelleAction =
    a.action.cle === 'relancer' ? ta('action.relancer', { nom: a.action.nom }) : a.action.cle === 'ouvrir' ? ta('action.ouvrir', { titre: a.action.titre.length > 32 ? `${a.action.titre.slice(0, 30)}…` : a.action.titre }) : ta('action.priorites');

  const valider = (e: React.FormEvent) => {
    e.preventDefault();
    a.retoucher((r, jour) => ajouter(r, jour, ajout, Date.now().toString(36)));
    setAjout('');
    setOuvert(false);
  };

  return (
    <section aria-labelledby="accueil-jour" className="flex min-w-0 flex-col rounded-xl border border-socle-bord bg-socle-surface">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-socle-bord px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <h2 id="accueil-jour" className="text-[15px] font-semibold text-socle-texte">
            {ta('jour.titre')}
          </h2>
          {total > 0 && (
            <div className="mt-1.5 flex items-center gap-3">
              <span className="whitespace-nowrap text-[12px] text-socle-texte-doux [font-variant-numeric:tabular-nums]">{ta('jour.progres', { x: a.faits, y: total })}</span>
              <span aria-hidden className="h-1 w-28 overflow-hidden rounded-full bg-socle-eleve">
                <motion.span className="block h-full rounded-full bg-socle-texte" initial={false} animate={{ width: `${Math.round(part * 100)}%` }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} />
              </span>
            </div>
          )}
        </div>
        {/* Le seul bouton blanc plein de l'écran. */}
        <Bouton variante="primaire" taille="petit" onClick={() => navigate(a.action.vers)}>
          {libelleAction}
        </Bouton>
      </header>

      {total === 0 ? (
        <p className="px-4 py-6 text-[14px] text-socle-texte-doux">{ta('jour.vide')}</p>
      ) : (
        <ul className="flex flex-col">
          {a.fil.map((l) => (
            <LigneDuJour key={l.cle} l={l} a={a} />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-socle-bord px-3 py-2.5">
        {ouvert ? (
          <form onSubmit={valider} className="flex w-full flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              {/* Le champ ne prend le focus que parce qu'on vient de demander à écrire. */}
              <Saisie etiquette={ta('jour.ajouter')} aide={ta('jour.ajouter.aide')} value={ajout} maxLength={140} onChange={(e) => setAjout(e.target.value)} autoFocus />
            </div>
            <Bouton type="submit" taille="moyen" variante="secondaire" disabled={!ajout.trim()}>
              {ta('jour.ajouter.ok')}
            </Bouton>
            <Bouton type="button" taille="moyen" variante="discret" onClick={() => setOuvert(false)}>
              {ta('jour.annuler')}
            </Bouton>
          </form>
        ) : (
          <Bouton taille="petit" variante="discret" icone={<Plus size={14} aria-hidden />} onClick={() => setOuvert(true)}>
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

function LigneDuJour({ l, a }: { l: LigneFil; a: Accueil }) {
  const { ta } = useAccueilLangue();
  const navigate = useNavigate();
  const lecture = l.case === 'lecture';
  const ouvrir = l.cle === 'etape:visite' ? () => signalerGuide() : l.vers ? () => navigate(l.vers as string) : undefined;
  return (
    <li data-famille={l.famille} className="group flex items-center gap-3 border-b border-socle-bord px-4 py-2.5 last:border-b-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={l.fait}
        aria-disabled={lecture || undefined}
        aria-label={lecture ? ta('jour.lecture', { titre: l.titre }) : ta(l.fait ? 'jour.decocher' : 'jour.cocher', { titre: l.titre })}
        onClick={() => !lecture && a.cocher(l)}
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
        {l.detail && <span className="block text-[12px] text-socle-texte-doux [font-variant-numeric:tabular-nums]">{l.detail}</span>}
      </button>
      {l.responsable && (
        <span className="hidden items-center gap-2 text-[12px] text-socle-texte-doux sm:flex" title={`${ta('jour.responsable')} : ${a.nomDe(l.responsable)}`}>
          <Initiales nom={a.nomDe(l.responsable)} />
          <span className="max-w-[9rem] truncate">{a.nomDe(l.responsable)}</span>
        </span>
      )}
      <Bouton className="sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100" taille="petit" variante="discret" onClick={() => a.retoucher((r, jour) => masquer(r, jour, l.cle))} aria-label={ta('jour.masquer', { titre: l.titre })} title={ta('jour.masquer', { titre: l.titre })}>
        <EyeOff size={14} aria-hidden />
      </Bouton>
    </li>
  );
}

/** Une date seule (un encaissement) se dit au jour ; un instant, en durée relative. */
function quandActivite(quand: string, maintenant: Date, langue: 'fr' | 'en'): string {
  if (quand.length !== 10) return depuisQuand(quand, maintenant.getTime(), langue);
  const jour = new Date(`${quand}T00:00:00`);
  const minuit = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const ecart = Math.round((jour.getTime() - minuit.getTime()) / 86_400_000);
  return new Intl.RelativeTimeFormat(langue, { numeric: 'auto' }).format(ecart, 'day');
}

/* ── Activité de l'équipe ──────────────────────────────────────────────── */

function Activite({ a }: { a: Accueil }) {
  const { langue, ta } = useAccueilLangue();
  return (
    <section aria-labelledby="accueil-activite" className="flex min-w-0 flex-col rounded-xl border border-socle-bord bg-socle-surface">
      <h2 id="accueil-activite" className="border-b border-socle-bord px-4 py-3.5 text-[15px] font-semibold text-socle-texte">
        {ta('activite.titre')}
      </h2>
      {a.activite.length === 0 ? (
        <p className="px-4 py-6 text-[14px] text-socle-texte-doux">{ta('activite.vide')}</p>
      ) : (
        <ol className="flex flex-col py-1.5">
          {a.activite.map((e) => (
            <li key={e.cle} data-famille={e.famille} className="relative flex gap-3 px-4 py-2">
              {/* Le fil : un trait discret ; un jalon est un losange plein, le reste un point. */}
              <span aria-hidden className="mt-[7px] flex w-2 flex-none justify-center">
                {e.type === 'jalon' ? <span className="h-2 w-2 rotate-45 bg-[var(--fam)]" /> : <span className="h-1.5 w-1.5 rounded-full bg-[var(--fam)]" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[13.5px] leading-snug ${e.type === 'jalon' ? 'font-medium text-socle-texte' : 'text-socle-texte'}`}>
                  {e.type === 'jalon' && <span className="sr-only">{ta('activite.jalon')} : </span>}
                  {e.texte}
                </span>
                <span className="block text-[12px] text-socle-texte-doux [font-variant-numeric:tabular-nums]">
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

/* ── La barre : sept familles, la Garde à part, qui est en ligne ──────── */

function BarreFamilles({ a }: { a: Accueil }) {
  const { ta } = useAccueilLangue();
  const { ts } = useSocleLangue();
  const navigate = useNavigate();
  const [ouvertes, setOuvertes] = useState<Set<string>>(() => new Set(['jour']));
  const basculer = (cle: string) =>
    setOuvertes((s) => {
      const n = new Set(s);
      if (n.has(cle)) n.delete(cle);
      else n.add(cle);
      return n;
    });

  const groupe = (cle: string, nom: string, famille: string, modules: ModuleBarre[], badge: number) => {
    const ouverte = ouvertes.has(cle);
    return (
      <li key={cle} data-famille={famille}>
        <button
          type="button"
          aria-expanded={ouverte}
          aria-label={ta(ouverte ? 'barre.replier' : 'barre.deplier', { nom })}
          onClick={() => basculer(cle)}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13.5px] font-medium text-socle-texte hover:bg-socle-survol focus-visible:outline-2 focus-visible:outline-socle-focus"
        >
          <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-[var(--fam)]" />
          <span className="min-w-0 flex-1 truncate">{nom}</span>
          {!ouverte && <Badge n={badge} aide={ta('barre.badge', { n: badge })} />}
          {ouverte ? <ChevronDown size={14} aria-hidden className="flex-none text-socle-texte-doux" /> : <ChevronRight size={14} aria-hidden className="flex-none text-socle-texte-doux" />}
        </button>
        {ouverte && (
          <ul className="mb-1 ml-[13px] flex flex-col border-l border-socle-bord pl-2">
            {modules.map((m) => (
              <li key={m.item.key}>
                <button
                  type="button"
                  onClick={() => navigate(m.item.to)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] text-socle-texte-doux hover:bg-socle-survol hover:text-socle-texte focus-visible:outline-2 focus-visible:outline-socle-focus"
                >
                  <span className="min-w-0 flex-1 truncate">{m.libelle}</span>
                  <Badge n={m.badge} aide={ta('barre.badge', { n: m.badge })} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <aside aria-label={ta('barre.titre')} className="order-2 flex flex-col gap-5 lg:order-none lg:sticky lg:top-4 lg:self-start">
      <nav aria-label={ta('barre.titre')}>
        <ul className="flex flex-col gap-0.5">
          {a.familles.filter((f: FamilleBarre) => f.modules.length > 0).map((f) => groupe(f.famille, ts(`famille.${f.famille}` as CleSocle), f.famille, f.modules, f.badge))}
        </ul>
        {a.garde.length > 0 && (
          <ul className="mt-3 flex flex-col gap-0.5 border-t border-socle-bord pt-3">{groupe('garde', ta('barre.garde'), 'outils', a.garde, a.garde.reduce((n, m) => n + m.badge, 0))}</ul>
        )}
      </nav>

      <Bouton variante="secondaire" taille="petit" icone={<LayoutGrid size={14} aria-hidden />} onClick={() => navigate(ROUTE_TOUS_LES_MODULES)}>
        {ta('barre.tous')}
      </Bouton>

      <section aria-labelledby="accueil-en-ligne" className="flex flex-col gap-2">
        <h2 id="accueil-en-ligne" className="flex items-center gap-2 px-2 text-[12px] font-medium text-socle-texte-doux">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-etat-succes" />
          {ta('barre.enLigne')}
          {a.enLigne.length > 0 && <span className="[font-variant-numeric:tabular-nums]">· {a.enLigne.length}</span>}
        </h2>
        {!a.presenceMontree ? (
          <p className="px-2 text-[12px] text-socle-texte-doux">{ta('barre.presenceCoupee')}</p>
        ) : a.enLigne.length === 0 ? (
          <p className="px-2 text-[12px] text-socle-texte-doux">{ta('barre.personne')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {a.enLigne.map((p) => (
              <li key={p.email} className="flex items-center gap-2 px-2">
                <Initiales nom={p.nom} />
                <span className="min-w-0 text-[12.5px] leading-tight">
                  <span className="block truncate text-socle-texte">{p.nom}</span>
                  <span className="block truncate text-socle-texte-doux">{ta('barre.sur', { module: p.module })}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
