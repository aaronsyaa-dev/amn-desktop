import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, EyeOff, LayoutGrid, Plus } from 'lucide-react';
import { Avatar, BarreProgression, Bouton, Carte, Chargement, EtapeFranchie, EtatVide, Etiquette, LigneActivite, LigneTache, Saisie, Squelette, TuileAjouter, TuileKpi, type TonVariation } from '../../socle/ui';
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
import { useCoquilleActive } from '../coquille/drapeau';

/**
 * L'ACCUEIL DE LA REFONTE (`42k`) — noir et gris, très rangé, sans personnage.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Câblé sur les briques du socle (`src/socle/ui/`), aux mesures de la
 * référence : zone principale 26/40, titre 32 px, quatre tuiles de 92 px,
 * puis « Aujourd'hui » et « Activité de l'équipe » (400 px) côte à côte.
 *
 *   · en haut, la salutation, le message discret d'Ajmani, les étiquettes
 *     « Série » et « Boîte à zéro » quand elles sont vraies ;
 *   · quatre tuiles — seulement celles dont la donnée existe ; une dernière,
 *     « Ajouter une carte », prend la place vide : jamais un trou ;
 *   · « Aujourd'hui » : des cases à cocher, « x sur y fait », le responsable
 *     de chaque ligne, et le SEUL bouton blanc plein de l'écran ;
 *   · « Activité de l'équipe » : le journal, ponctué d'étapes franchies ;
 *   · pendant le chargement, des squelettes ; un fil vide propose d'agir.
 *
 * La navigation (familles, en ligne, Tous les modules) et la barre d'Ajmani
 * (⌘J) sont celles de la coquille (`src/socle/coquille/`). Tant que la
 * coquille d'origine est active (drapeau éteint), l'Accueil garde sa barre de
 * familles d'avant, à gauche, et rien d'autre ne change pour personne.
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
  const coquille = useCoquilleActive();

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

  return (
    <AccueilVue
      a={a}
      coquille={coquille}
      message={message.texte || null}
      astuce={
        astuceAffichee
          ? {
              texte: astuceAffichee.texte,
              masquer: () => {
                transformer((e) => masquerAstuce(e, astuceAffichee.astuce));
                setAstuceAffichee(null);
              },
            }
          : null
      }
    />
  );
}

/**
 * Le dessin de l'Accueil, sans aucune lecture de donnée : il reçoit ce que
 * `useAccueil` a rassemblé. C'est ce qui permet de le rendre sur des données
 * d'essai (contrôles, aperçus) sans monter l'application.
 */
export function AccueilVue({ a, coquille, message, astuce }: { a: Accueil; coquille: boolean; message: string | null; astuce: { texte: string; masquer: () => void } | null }) {
  const { langue, ta } = useAccueilLangue();
  const navigate = useNavigate();
  const { ts } = useSocleLangue();

  const h = a.maintenant.getHours();
  const salut = !a.prenom ? ta('salut.anonyme') : ta(h < 12 ? 'salut.matin' : h < 18 ? 'salut.jour' : 'salut.soir', { prenom: a.prenom });
  const date = a.maintenant.toLocaleDateString(langue === 'en' ? 'en-GB' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const contenu = (
    <div className="@container flex min-w-0 flex-col">
      <h1 data-guide="titre" className="m-0 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-socle-texte [text-wrap:balance]">
        {salut}
      </h1>
      <p className="mt-[7px] text-[14px] text-socle-texte-doux first-letter:uppercase">{date}</p>
      {message && (
        <p role="status" className="mt-1 text-[14px] text-socle-texte-doux">
          <span className="font-medium text-socle-texte">Ajmani</span> · {message}
        </p>
      )}
      {astuce && (
        <div role="note" className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-socle-texte-doux">
          <span className="min-w-0">{astuce.texte}</span>
          <button type="button" className="sc-focus rounded text-socle-texte underline decoration-socle-bord-fort underline-offset-4 hover:decoration-socle-texte" onClick={astuce.masquer}>
            {ta('astuce.masquer')}
          </button>
        </div>
      )}
      {(a.serie > 0 || a.boiteAZero) && (
        <div className="mt-3.5 flex flex-wrap gap-2">
          {a.serie > 0 && (
            <Etiquette famille="jour" title={ta('pastille.serie.aide', { n: a.serie })}>
              {ta('pastille.serie', { n: a.serie })}
              <span className="sr-only"> — {ta('pastille.serie.aide', { n: a.serie })}</span>
            </Etiquette>
          )}
          {a.boiteAZero && (
            <Etiquette famille="echanger" title={ta('pastille.boite.aide')}>
              {ta('pastille.boite')}
              <span className="sr-only"> — {ta('pastille.boite.aide')}</span>
            </Etiquette>
          )}
        </div>
      )}

      {/* ── Les tuiles : seulement celles dont la donnée existe, puis une invitation ── */}
      <section aria-label={ta('tuiles.titre')} className="mt-5 grid grid-cols-2 gap-[14px] @[860px]:grid-cols-4">
        {!a.pret ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <Squelette key={i} hauteur={92} rayon={14} />
            ))}
            <span role="status" className="sr-only">
              {ts('bouton.chargement')}
            </span>
          </>
        ) : (
          <>
            {a.tuiles.map((t) => (
              <TuileAccueil key={t.cle} t={t} a={a} />
            ))}
            {a.tuiles.length < 4 && <TuileAjouter libelle={ta('tuiles.ajouter')} onClick={() => navigate('/tableau-de-bord')} />}
          </>
        )}
      </section>

      <div className="mt-6 grid grid-cols-1 gap-8 @[920px]:grid-cols-[minmax(0,1fr)_400px]">
        <Aujourdhui a={a} />
        <Activite a={a} />
      </div>

      {/* La barre d'Ajmani : celle de la coquille. Tant que l'ancienne coquille est là, l'Accueil garde la sienne. */}
      {!coquille && <BarreAjmaniAncienne />}
    </div>
  );

  if (coquille) return <div data-accueil="vivant" data-refonte-police="inter" className="text-socle-texte">{contenu}</div>;
  return (
    <div data-accueil="vivant" data-refonte-police="inter" className="grid gap-6 text-socle-texte lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8">
      <BarreFamilles a={a} />
      <div className="order-1 min-w-0 lg:order-none">{contenu}</div>
    </div>
  );
}

/* ── Une tuile ─────────────────────────────────────────────────────────── */

function TuileAccueil({ t, a }: { t: Tuile; a: Accueil }) {
  const { langue, ta } = useAccueilLangue();
  const navigate = useNavigate();
  const euros = (cents: number) => new Intl.NumberFormat(langue === 'en' ? 'en-GB' : 'fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
  const nomMois = (decalage: number) => new Date(a.maintenant.getFullYear(), a.maintenant.getMonth() + decalage, 1).toLocaleDateString(langue === 'en' ? 'en-GB' : 'fr-FR', { month: 'long' });

  let libelle = '';
  let valeur: React.ReactNode = null;
  let variation = '';
  /** La phrase entière, en infobulle et pour les lecteurs d'écran : la tuile n'affiche que le court. */
  let detail = '';
  let ton: TonVariation = 'neutre';
  let barre: number | undefined;
  let libelleBarre: string | undefined;
  let vers = '/';
  let famille: 'argent' | 'jour' = 'argent';
  if (t.cle === 'ca') {
    libelle = ta('tuile.ca');
    valeur = euros(t.cents);
    const evol = evolution(t.cents, t.moisPrecedentCents);
    variation = evol === null ? ta('tuile.ca.sous', { mois: nomMois(0) }) : ta('tuile.ca.evol', { signe: evol > 0 ? '+' : '', n: evol, mois: nomMois(-1) });
    if (evol !== null && evol !== 0) ton = evol > 0 ? 'succes' : 'attention';
    vers = '/facturation';
  } else if (t.cle === 'attente') {
    libelle = ta('tuile.attente');
    valeur = euros(t.cents);
    variation = t.enRetard ? ta('tuile.attente.retard', { r: t.enRetard }) : t.nombre ? ta('tuile.attente.encaisser', { n: t.nombre }) : ta('tuile.attente.aucune');
    detail = t.nombre ? ta('tuile.attente.sous', { n: t.nombre, r: t.enRetard }) : '';
    ton = t.enRetard ? 'attention' : t.nombre ? 'neutre' : 'succes';
    vers = t.enRetard ? '/relances' : '/facturation';
  } else if (t.cle === 'equipe') {
    libelle = ta('tuile.equipe');
    valeur = t.ouvertes;
    variation = ta('tuile.equipe.court', { c: t.enCours });
    detail = ta('tuile.equipe.sous', { c: t.enCours, f: t.faitesSemaine });
    if (t.ouvertes + t.faitesSemaine > 0) {
      barre = t.faitesSemaine / (t.ouvertes + t.faitesSemaine);
      libelleBarre = ta('tuile.equipe.barre');
    }
    vers = '/tasks';
    famille = 'jour';
  } else {
    libelle = ta('tuile.objectif');
    valeur = <span className="text-[15px] font-medium leading-snug tracking-normal">{t.texte}</span>;
    variation = ta('tuile.objectif.sous');
    vers = '/revue-hebdo';
    famille = 'jour';
  }
  return <TuileKpi famille={famille} libelle={libelle} valeur={valeur} variation={variation} detail={detail || undefined} ton={ton} barre={barre} libelleBarre={libelleBarre} onClick={() => navigate(vers)} />;
}

/* ── Aujourd'hui ───────────────────────────────────────────────────────── */

function Aujourdhui({ a }: { a: Accueil }) {
  const { ta } = useAccueilLangue();
  const { ts } = useSocleLangue();
  const navigate = useNavigate();
  const [ajout, setAjout] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const total = a.fil.length;
  const part = total ? a.faits / total : 0;
  const avecHeures = a.fil.some((l) => l.type === 'rdv');

  const libelleAction =
    a.action.cle === 'relancer' ? ta('action.relancer', { nom: a.action.nom }) : a.action.cle === 'ouvrir' ? ta('action.ouvrir', { titre: a.action.titre.length > 32 ? `${a.action.titre.slice(0, 30)}…` : a.action.titre }) : ta('action.priorites');

  const valider = (e: React.FormEvent) => {
    e.preventDefault();
    a.retoucher((r, jour) => ajouter(r, jour, ajout, Date.now().toString(36)));
    setAjout('');
    setOuvert(false);
  };

  const formulaire = (
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
  );

  return (
    <Carte as="section" sansMarge aria-label={ta('jour.titre')} className="min-w-0">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--socle-bord-ligne)] px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h2 id="accueil-jour" className="m-0 text-[15px] font-semibold text-socle-texte">
              {ta('jour.titre')}
            </h2>
            {total > 0 && (
              <span aria-live="polite" className="whitespace-nowrap text-[12px] text-socle-texte-doux">
                {ta('jour.progres', { x: a.faits, y: total })}
              </span>
            )}
          </div>
          {total > 0 && <BarreProgression valeur={part} libelle={ta('jour.titre')} texte={ta('jour.progres', { x: a.faits, y: total })} className="mt-2.5 max-w-[220px]" />}
        </div>
        {/* Le seul bouton blanc plein de l'écran. */}
        <Bouton variante="primaire" taille="petit" onClick={() => navigate(a.action.vers)}>
          {libelleAction}
        </Bouton>
      </header>

      {!a.pret ? (
        <Chargement libelle={ts('bouton.chargement')}>
          <div className="grid gap-3 px-5 py-4">
            {[0, 1, 2].map((i) => (
              <Squelette key={i} hauteur={36} />
            ))}
          </div>
        </Chargement>
      ) : total === 0 ? (
        <div className="px-5 py-5">
          <EtatVide texte={ta('jour.vide')} action={ouvert ? formulaire : <Bouton taille="petit" variante="secondaire" icone={<Plus size={14} aria-hidden />} onClick={() => setOuvert(true)}>{ta('jour.ajouter')}</Bouton>} />
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col px-5">
          {a.fil.map((l) => (
            <LigneDuJour key={l.cle} l={l} a={a} avecColonneHeure={avecHeures} />
          ))}
        </ul>
      )}

      {(total > 0 || a.masquees > 0) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--socle-bord-ligne)] px-4 py-2.5">
          {ouvert ? (
            formulaire
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
      )}
    </Carte>
  );
}

function LigneDuJour({ l, a, avecColonneHeure }: { l: LigneFil; a: Accueil; avecColonneHeure: boolean }) {
  const { ta } = useAccueilLangue();
  const { ts } = useSocleLangue();
  const navigate = useNavigate();
  const lecture = l.case === 'lecture';
  const ouvrir = l.cle === 'etape:visite' ? () => signalerGuide() : l.vers ? () => navigate(l.vers as string) : undefined;
  const rdv = l.type === 'rdv';
  return (
    <LigneTache
      titre={l.titre}
      meta={rdv ? ts(`famille.${l.famille}`) : l.detail || ts(`famille.${l.famille}`)}
      famille={l.famille}
      heure={rdv ? l.detail : undefined}
      avecColonneHeure={avecColonneHeure}
      fait={l.fait}
      lecture={lecture}
      libelleCase={lecture ? ta('jour.lecture', { titre: l.titre }) : ta(l.fait ? 'jour.decocher' : 'jour.cocher', { titre: l.titre })}
      onCoche={() => a.cocher(l)}
      onOuvrir={ouvrir}
      droite={
        <>
          {l.responsable && (
            <span className="hidden items-center gap-2 text-[12px] text-socle-texte-doux @[560px]:flex" title={`${ta('jour.responsable')} : ${a.nomDe(l.responsable)}`}>
              <Avatar nom={a.nomDe(l.responsable)} taille={24} />
              <span className="max-w-[9rem] truncate">{a.nomDe(l.responsable)}</span>
            </span>
          )}
          <Bouton className="sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100" taille="petit" variante="discret" onClick={() => a.retoucher((r, jour) => masquer(r, jour, l.cle))} aria-label={ta('jour.masquer', { titre: l.titre })} title={ta('jour.masquer', { titre: l.titre })}>
            <EyeOff size={14} aria-hidden />
          </Bouton>
        </>
      }
    />
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
  const { ts } = useSocleLangue();
  const navigate = useNavigate();
  return (
    <Carte as="section" sansMarge aria-label={ta('activite.titre')} className="min-w-0">
      <h2 id="accueil-activite" className="m-0 border-b border-[var(--socle-bord-ligne)] px-5 py-4 text-[15px] font-semibold text-socle-texte">
        {ta('activite.titre')}
      </h2>
      {!a.pret ? (
        <Chargement libelle={ts('bouton.chargement')}>
          <div className="grid gap-3 px-5 py-4">
            {[0, 1, 2].map((i) => (
              <Squelette key={i} hauteur={30} />
            ))}
          </div>
        </Chargement>
      ) : a.activite.length === 0 ? (
        <div className="px-5 py-5">
          <EtatVide
            texte={ta('activite.vide')}
            action={
              <Bouton taille="petit" variante="secondaire" onClick={() => navigate('/journal-de-bord')}>
                {ta('activite.vide.action')}
              </Bouton>
            }
          />
        </div>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-1 px-5 py-3">
          {a.activite.map((e) => {
            const quand = quandActivite(e.quand, a.maintenant, langue);
            return e.type === 'jalon' ? (
              <EtapeFranchie key={e.cle} libelle={ta('activite.etape')} texte={e.texte} quand={[e.qui ? a.nomDe(e.qui) : null, quand].filter(Boolean).join(' · ')} famille={e.famille} />
            ) : (
              <LigneActivite key={e.cle} nom={e.qui ? a.nomDe(e.qui) : null} texte={e.texte} quand={quand} famille={e.famille} />
            );
          })}
        </ol>
      )}
    </Carte>
  );
}

/* ── L'ancienne barre d'Ajmani, tant que la coquille d'origine est active ── */

function BarreAjmaniAncienne() {
  const { ta } = useAccueilLangue();
  const assistant = useAssistant();
  return (
    <button
      type="button"
      onClick={() => assistant.open('chat')}
      title={ta('ajmani.barre.aide')}
      className="sc-ajmani sc-focus mt-6"
    >
      <span>{ta('ajmani.barre')}</span>
      <kbd className="sc-kbd">⌘J</kbd>
    </button>
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
