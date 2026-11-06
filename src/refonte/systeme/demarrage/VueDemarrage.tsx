import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, CircleAlert, Database, Euro, File, LayoutGrid, Mail, MessageSquare, Phone, Play, RotateCcw, Shield, Smartphone, Users } from 'lucide-react';
import { encoderQr } from '../../../lib/qr';
import { AnneauProgression, Avatar, Bouton, Carte, Chargement, PageHead, PastilleEtat, PileAvatars, Raccourci, Squelette, type ActionPage } from '../../../socle/ui';
import { IconeEtincelle } from '../../../socle/ui/controles';
import { FlowLine } from '../../../socle/ui/vivant';
import { etapeApres, RACCOURCIS_SAVOIR, type EtapeCalculee, type IdEtape, type RaccourciSavoir, type ResultatEtapes } from './etapes';
import { useMots } from './i18n';
import './demarrage.css';

/**
 * DÉMARRAGE (H42, v3) — la VUE : tout ce qu'elle montre arrive en props, elle ne sait rien du poste.
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Elle se rend donc sans navigateur ni fournisseur (`check:systeme-demarrage`, aperçu `scripts/apercu/ecrans/H42.tsx`).
 * `PageDemarrage.tsx` la branche sur les données, la navigation, la visite guidée et l'assistant.
 *
 * La surface : un PARCOURS horizontal de six nœuds (anneau « n/N » dans sa gouttière), la CARTE DE L'ÉTAPE affichée
 * (la conseillée par défaut, ou celle qu'on a choisie sur le parcours) avec l'aperçu de ce qu'elle produit, « Déjà
 * prêt » et la carte d'ACCOMPAGNEMENT. Les étapes 1 à 4 se cochent d'après les données du poste ; 5 et 6 (encaissements,
 * application mobile) se marquent à la main (« C'est déjà fait ») : le poste n'a aucune donnée de connexion bancaire
 * ni d'appareil mobile à lire, et ne prétendra donc pas le savoir.
 *
 * Deux boutons primaires sur la page, comme le veut la fiche (rubrique 12) : celui de l'étape, et celui de la carte
 * d'accompagnement quand un créneau est réservable. L'en-tête n'en a aucun.
 */

/* ── Les données de présentation (calculées par la page, fictives dans l'aperçu) ── */

/** Une ligne de « Déjà rempli pour vous » : le terme en T1, la suite en T2. */
export interface LigneRemplie {
  terme: string;
  suite: string;
}

/** Une ligne du papier : libellé, quantité, et le montant s'il est connu (aucun prix n'est inventé). */
export interface LigneBrouillon {
  libelle: string;
  quantite: string;
  montant?: string;
}

/** L'aperçu « papier » d'un brouillon. Rien n'est enregistré : c'est ce que l'étape va préparer. */
export interface ApercuBrouillon {
  /** Le numéro, s'il en a un (un brouillon n'en a pas : le numéro vient à l'émission). */
  numero?: string;
  client: string;
  /** La suite de « Pour {client} » (« valable 30 jours »), si elle est connue. */
  precision?: string;
  lignes: readonly LigneBrouillon[];
  /** Les totaux, s'ils sont connus ; le dernier est en gras. */
  totaux?: readonly { libelle: string; valeur: string }[];
}

export type IconePrete = 'modules' | 'clients' | 'garde' | 'sauvegarde';

/** Une ligne de « Déjà prêt » : vraie au moment de l'affichage, sinon la page ne la donne pas. */
export interface LignePrete {
  id: string;
  icone: IconePrete;
  titre: string;
  sous: string;
}

/** La personne de l'équipe qui accompagne cet espace ; `null` : « L'équipe AMN vous répond ». */
export interface Referent {
  nom: string;
  /** Délai de réponse moyen, en minutes. */
  delai: number;
  enLigne: boolean;
  /** Les prochains créneaux libres (libellés déjà formatés : « 14:30 », « Lun. 9:30 »), trois au plus. */
  creneaux: readonly string[];
}

export interface VueDemarrageProps {
  etat: 'chargement' | 'erreur' | 'pret';
  calcul: ResultatEtapes;
  prenom: string;
  horsLigne: boolean;
  peutAdministrer: boolean;
  /** ⌘ (macOS) ou Ctrl : ce que les touches de « Bon à savoir » affichent. */
  mac: boolean;
  /** Ce que dit le nœud d'une étape faite (le métier choisi, le nombre de clients…). Absent : « faite ». */
  resumes: Partial<Record<IdEtape, string>>;
  /** « Déjà rempli pour vous », étape par étape. */
  rempli: Partial<Record<IdEtape, readonly LigneRemplie[]>>;
  /** Le papier de l'étape 3 (devis), s'il y a de quoi le préparer. */
  brouillon: ApercuBrouillon | null;
  /** Le client à qui « rien ne part sans votre accord ». */
  client: string | null;
  pret: readonly LignePrete[];
  /** Les personnes connues pour l'encart « Ensuite : inviter … » (vide : « inviter votre équipe »). */
  aInviter: readonly string[];
  referent: Referent | null;
  /** L'adresse générique de l'application mobile (QR de l'étape 6), ou `null`. */
  lienMobile: string | null;
  onPlusTard: () => void;
  onAccueil: () => void;
  onReprendreVisite: () => void;
  onReessayer: () => void;
  /** Le bouton de l'étape affichée. */
  onAgir: (etape: EtapeCalculee) => void;
  /** Un nœud fait : l'élément concerné, pour le revoir. */
  onOuvrir: (etape: EtapeCalculee) => void;
  /** « C'est déjà fait » d'une étape qui se marque à la main. */
  onMarquer: (id: IdEtape) => void;
  onRetirer: (id: IdEtape) => void;
  /** Remet une étape retirée (« Annuler »), ou toutes (`null`, « Les remettre »). */
  onRemettre: (id: IdEtape | null) => void;
  onRaccourci: (raccourci: RaccourciSavoir) => void;
  onReserver: (creneau: string) => void;
  onEcrire: () => void;
}

type Icone = React.ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>;

const ICONES_ETAPES: Record<IdEtape, Icone> = {
  metier: LayoutGrid,
  client: Users,
  devis: File,
  equipe: Mail,
  paiement: Euro,
  mobile: Phone,
};

const ICONES_PRETES: Record<IconePrete, Icone> = {
  modules: LayoutGrid,
  clients: Users,
  garde: Shield,
  sauvegarde: Database,
};

function Coche({ taille = 14 }: { taille?: number }) {
  return <Check aria-hidden size={taille} strokeWidth={2.4} />;
}

/** Le libellé commun ou celui du modèle, pour les textes d'une étape. */
function useTextesEtape() {
  const { tm, langue } = useMots();
  return (e: EtapeCalculee) => {
    const commun = e.id as 'metier' | 'equipe' | 'mobile';
    const titre = e.libelle ? e.libelle.titre[langue] : tm(`etape.${commun}.titre`);
    const sous = e.libelle ? e.libelle.sous[langue] : tm(`etape.${commun}.sous`);
    const texte = e.libelle ? (e.libelle.texte ?? e.libelle.sous)[langue] : tm(`etape.${commun}.texte`);
    const action = e.libelle ? e.libelle.action[langue] : tm(`etape.${commun}.action`);
    return { titre, sous, texte, action };
  };
}

const minuscule = (t: string) => (t ? t[0].toLocaleLowerCase('fr') + t.slice(1) : t);

/* ── Z2 · le parcours ─────────────────────────────────────────────────────── */

function Parcours({ p, affichee, onAfficher }: { p: VueDemarrageProps; affichee: IdEtape | null; onAfficher: (id: IdEtape) => void }) {
  const { tm } = useMots();
  const textes = useTextesEtape();
  const { calcul } = p;
  const noeuds = useRef<(HTMLButtonElement | null)[]>([]);

  const statut = (e: EtapeCalculee): string => {
    if (e.faite) return e.passee ? tm('statut.passee') : (p.resumes[e.id] ?? tm('statut.faite'));
    if (e.conseillee) return tm('statut.maintenant', { n: e.duree });
    if (e.id === calcul.suivante) return tm('statut.ensuite', { n: e.duree });
    return tm('statut.duree', { n: e.duree });
  };

  /* ← → déplacent le focus d'un nœud à l'autre (Début, Fin aux extrémités). */
  const surTouche = (i: number, ev: React.KeyboardEvent) => {
    const n = calcul.etapes.length;
    const cible = ev.key === 'ArrowRight' ? Math.min(n - 1, i + 1) : ev.key === 'ArrowLeft' ? Math.max(0, i - 1) : ev.key === 'Home' ? 0 : ev.key === 'End' ? n - 1 : null;
    if (cible === null) return;
    ev.preventDefault();
    noeuds.current[cible]?.focus();
  };

  return (
    <Carte sansMarge className="dem-parcours" rang={0} aria-label={tm('etapes.liste')}>
      <div className="dem-parcours__corps">
        <div className="dem-parcours__resume">
          <AnneauProgression valeur={calcul.ratio} taille={74} epaisseur={8} ton="succes" piste="anneau" libelle={tm('anneau.libelle')} texte={tm('anneau.texte', { n: calcul.n, total: calcul.total })}>
            <span className="dem-anneau__n">{calcul.n}</span>
            <span className="dem-anneau__total">/{calcul.total}</span>
          </AnneauProgression>
          <div className="dem-parcours__textes">
            <p className="dem-parcours__pretes" aria-live="polite">
              {tm('resume.pretes', { n: calcul.n, total: calcul.total })}
            </p>
            {calcul.tout ? (
              <p className="dem-parcours__reste">{tm('resume.rien')}</p>
            ) : (
              <>
                <p className="dem-parcours__reste">{tm('resume.duree', { n: calcul.minutesRestantes })}</p>
                <p className="dem-parcours__reste">{tm('resume.reste')}</p>
              </>
            )}
          </div>
        </div>
        <ol className="dem-route" aria-label={tm('etapes.liste')}>
          {calcul.etapes.map((e, i) => {
            const IconeEtape = ICONES_ETAPES[e.id];
            const { titre } = textes(e);
            const suivant = calcul.etapes[i + 1];
            const lien = suivant ? (e.faite && suivant.faite ? 'plein' : suivant.conseillee ? 'flux' : 'attente') : null;
            const forme = e.faite ? 'faite' : e.conseillee ? 'conseillee' : 'afaire';
            return (
              <li key={e.id} className="dem-route__etape" data-forme={forme} data-affichee={e.id === affichee || undefined} data-mvt="entree" style={{ '--sc-mvt-rang': i + 1 } as React.CSSProperties}>
                {lien && suivant && (
                  <svg aria-hidden className="dem-route__lien" data-lien={lien} data-depart={forme} data-arrivee={suivant.faite ? 'faite' : suivant.conseillee ? 'conseillee' : 'afaire'} preserveAspectRatio="none" viewBox="0 0 100 4">
                    {lien === 'flux' ? <FlowLine d="M 0 2 L 100 2" epaisseur={2} duree={1600} /> : <line x1="0" y1="2" x2="100" y2="2" />}
                  </svg>
                )}
                <button
                  ref={(el) => {
                    noeuds.current[i] = el;
                  }}
                  type="button"
                  className="dem-noeud sc-focus"
                  data-mvt-survol="noeud"
                  aria-current={e.id === affichee ? 'step' : undefined}
                  aria-label={e.faite ? tm('noeud.faite', { etape: titre }) : tm('noeud.afaire', { etape: titre })}
                  onClick={() => (e.faite ? p.onOuvrir(e) : onAfficher(e.id))}
                  onKeyDown={(ev) => surTouche(i, ev)}
                >
                  {e.conseillee && <span aria-hidden className="dem-noeud__halo" data-mvt="onde" />}
                  <span aria-hidden className="dem-noeud__rond">
                    {e.faite ? <Coche taille={15} /> : <IconeEtape aria-hidden size={e.conseillee ? 20 : 15} strokeWidth={1.8} />}
                  </span>
                </button>
                <span className="dem-route__titre">{titre}</span>
                <span className="dem-route__statut">{statut(e)}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </Carte>
  );
}

/* ── Z3 · le papier ───────────────────────────────────────────────────────── */

export function PapierBrouillon({ b }: { b: ApercuBrouillon }) {
  const { tm } = useMots();
  const totaux = b.totaux ?? [];
  return (
    <figure className="dem-papier" data-mvt-survol="carte" aria-label={tm('papier.libelle')}>
      <div className="dem-papier__haut">
        <span className="dem-papier__numero sc-mono">{b.numero ?? ''}</span>
        <PastilleEtat etat="info">{tm('papier.statut')}</PastilleEtat>
      </div>
      <p className="dem-papier__titre">{tm('papier.titre')}</p>
      <p className="dem-papier__pour">
        {tm('papier.pour')} <span className="dem-papier__client">{b.client}</span>
        {b.precision ? ` · ${b.precision}` : ''}
      </p>
      <ul className="dem-papier__lignes" data-mvt="cascade">
        {b.lignes.map((l, i) => (
          <li key={i} className="dem-papier__ligne">
            <span className="dem-papier__libelle">{l.libelle}</span>
            <span className="dem-papier__quantite">{l.quantite}</span>
            <span className="dem-papier__montant sc-nombre">{l.montant ?? ''}</span>
          </li>
        ))}
      </ul>
      {totaux.length > 0 && (
        <dl className="dem-papier__totaux">
          {totaux.map((t, i) => (
            <div key={t.libelle} className="dem-papier__total" data-fort={i === totaux.length - 1 || undefined}>
              <dt>{t.libelle}</dt>
              <dd className="sc-nombre">{t.valeur}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="dem-papier__note">
        <IconeEtincelle taille={12} />
        {tm('papier.note')}
      </p>
    </figure>
  );
}

/* ── « Bon à savoir » : les raccourcis qui existent ───────────────────────── */

function Savoir({ p }: { p: VueDemarrageProps }) {
  const { tm } = useMots();
  return (
    <div className="dem-savoir">
      <span className="dem-savoir__titre">{tm('savoir.titre')}</span>
      <ul className="dem-savoir__liste" aria-label={tm('savoir.liste')}>
        {RACCOURCIS_SAVOIR.map((r) => {
          const touche = r.avecModificateur ? `${p.mac ? '⌘' : 'Ctrl '}${r.touche.toUpperCase()}` : r.touche;
          const libelle = tm(`savoir.${r.id}`);
          return (
            <li key={r.id}>
              <button type="button" className="dem-savoir__ligne sc-focus" aria-label={`${libelle} (${touche})`} onClick={() => p.onRaccourci(r)}>
                <Raccourci>{touche}</Raccourci>
                <span>{libelle}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Z3 · la carte de l'étape affichée ────────────────────────────────────── */

function CarteEtape({ p, e, onAfficher }: { p: VueDemarrageProps; e: EtapeCalculee; onAfficher: (id: IdEtape | null) => void }) {
  const { tm } = useMots();
  const textes = useTextesEtape();
  const { calcul } = p;
  const t = textes(e);
  const [retiree, setRetiree] = useState<IdEtape | null>(null);

  const reserve = !p.peutAdministrer && (e.id === 'equipe' || e.id === 'paiement');
  const horsLigne = p.horsLigne && (e.id === 'paiement' || e.id === 'mobile');
  const rempli = p.rempli[e.id] ?? [];
  const papier = e.id === 'devis' && p.brouillon ? <PapierBrouillon b={p.brouillon} /> : e.id === 'mobile' ? <LienMobile lien={p.lienMobile} /> : null;

  /* « Ensuite » et « Plus tard » : l'étape suivante à faire (après la conseillée : `suivante`). */
  const idSuivante = e.conseillee ? calcul.suivante : etapeApres(calcul.etapes, e.id);
  const suivante = calcul.etapes.find((x) => x.id === idSuivante);
  const ts = suivante ? textes(suivante) : null;
  const noms = p.aInviter.length === 1 ? p.aInviter[0] : `${p.aInviter.slice(0, -1).join(', ')} ${tm('ensuite.et')} ${p.aInviter[p.aInviter.length - 1]}`;
  const avecNoms = suivante?.id === 'equipe' && p.aInviter.length > 0;

  return (
    <div className="dem-etape" data-avec-papier={papier ? 'true' : undefined}>
      <div className="dem-etape__texte">
        <p className="dem-etape__surtitre">
          <span className="dem-etape__rang">{tm('panneau.etape', { n: e.rang, total: calcul.total })}</span>
          <span className="dem-etape__quand">{e.conseillee ? tm('panneau.conseillee') : tm('panneau.afaire')}</span>
          {calcul.retirees.length > 0 && retiree === null && (
            <span className="dem-etape__retirees">
              {calcul.retirees.length === 1 ? tm('panneau.retirees.une') : tm('panneau.retirees.plusieurs', { n: calcul.retirees.length })}
              <button type="button" className="dem-lien sc-focus" onClick={() => p.onRemettre(null)}>
                {tm('panneau.remettre')}
              </button>
            </span>
          )}
        </p>
        <h2 className="dem-etape__titre">{t.titre}</h2>
        <p className="dem-etape__desc">{t.texte}</p>
        {rempli.length > 0 && (
          <>
            <p className="dem-etape__libelle">{tm('panneau.rempli')}</p>
            <ul className="dem-rempli">
              {rempli.map((l) => (
                <li key={l.terme} className="dem-rempli__ligne">
                  <span aria-hidden className="dem-rempli__coche">
                    <Check aria-hidden size={11} strokeWidth={3.2} />
                  </span>
                  <span className="dem-rempli__texte">
                    <span className="dem-rempli__terme">{l.terme}</span> · {l.suite}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="dem-etape__actions">
          {reserve ? (
            <span className="dem-etape__reserve">{tm('etape.admin')}</span>
          ) : (
            <span title={horsLigne ? tm('horsLigne') : undefined}>
              <Bouton variante="primaire" disabled={horsLigne} icone={<ArrowRight aria-hidden />} onClick={() => p.onAgir(e)}>
                {t.action}
              </Bouton>
            </span>
          )}
          {suivante && (
            <Bouton variante="secondaire" onClick={() => onAfficher(suivante.id)}>
              {tm('panneau.plusTard')}
            </Bouton>
          )}
          {e.manuelle && (
            <button type="button" className="dem-lien dem-lien--action sc-focus" onClick={() => p.onMarquer(e.id)}>
              {tm('panneau.dejaFait')}
            </button>
          )}
          <button
            type="button"
            className="dem-lien dem-lien--action sc-focus"
            onClick={() => {
              setRetiree(e.id);
              p.onRetirer(e.id);
            }}
          >
            {tm('panneau.pasPourMoi')}
          </button>
        </div>
        {retiree ? (
          <p role="status" className="dem-etape__ajmani">
            {tm('panneau.retiree')}
            <button
              type="button"
              className="dem-lien sc-focus"
              onClick={() => {
                p.onRemettre(retiree);
                setRetiree(null);
              }}
            >
              {tm('panneau.annuler')}
            </button>
          </p>
        ) : (
          <p className="dem-etape__ajmani">
            <IconeEtincelle taille={13} />
            {p.client ? tm('panneau.ajmani', { client: p.client }) : tm('panneau.ajmani.sans')}
          </p>
        )}
        <div className="dem-etape__bas">
          {suivante && ts && (
            <button type="button" className="dem-ensuite sc-focus" data-mvt-survol="carte" aria-label={tm('ensuite.libelle', { etape: ts.titre })} onClick={() => onAfficher(suivante.id)}>
              <span aria-hidden className="dem-ensuite__rond">
                {React.createElement(ICONES_ETAPES[suivante.id], { size: 14, strokeWidth: 1.8, 'aria-hidden': true })}
              </span>
              <span className="dem-ensuite__textes">
                <span className="dem-ensuite__titre">{avecNoms ? tm('ensuite.inviter', { noms }) : tm('ensuite.titre', { etape: minuscule(ts.titre) })}</span>
                <span className="dem-ensuite__detail">{tm('ensuite.detail', { sous: minuscule(ts.sous), n: suivante.duree })}</span>
              </span>
              {avecNoms && <PileAvatars noms={[...p.aInviter]} taille={22} libelle={p.aInviter.join(', ')} />}
            </button>
          )}
          <Savoir p={p} />
        </div>
      </div>
      {papier && <div className="dem-etape__papier">{papier}</div>}
    </div>
  );
}

/* ── Z4 · « Déjà prêt » et l'accompagnement ───────────────────────────────── */

function DejaPret({ lignes }: { lignes: readonly LignePrete[] }) {
  const { tm } = useMots();
  return (
    <Carte sansMarge className="dem-pret" rang={2} aria-label={tm('dejaPret.titre')}>
      <div className="dem-pret__corps">
        <div className="dem-carte__entete">
          <h2 className="dem-carte__titre">{tm('dejaPret.titre')}</h2>
          <span className="dem-pret__sans">{tm('dejaPret.sous')}</span>
        </div>
        <ul className="dem-pret__liste">
          {lignes.map((l) => {
            const IconeLigne = ICONES_PRETES[l.icone];
            return (
              <li key={l.id} className="dem-pret__ligne">
                <span aria-hidden className="dem-pret__tuile" data-icone={l.icone}>
                  <IconeLigne aria-hidden size={15} strokeWidth={1.8} />
                </span>
                <span className="dem-pret__textes">
                  <span className="dem-pret__titre">{l.titre}</span>
                  <span className="dem-pret__sous">{l.sous}</span>
                </span>
                <span aria-hidden className="dem-pret__coche">
                  <Coche />
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </Carte>
  );
}

function Accompagnement({ p }: { p: VueDemarrageProps }) {
  const { tm } = useMots();
  const r = p.referent;
  const [choisi, setChoisi] = useState(0);
  const [reserve, setReserve] = useState<string | null>(null);
  const creneaux = r?.creneaux.slice(0, 3) ?? [];
  const creneau = creneaux[Math.min(choisi, creneaux.length - 1)];

  return (
    <Carte sansMarge className="dem-aide" rang={3} aria-label={r ? tm('aide.referent.titre', { nom: r.nom }) : tm('aide.equipe.titre')}>
      <div className="dem-aide__corps">
        <div className="dem-aide__qui">
          {r && <Avatar nom={r.nom} taille={38} enLigne={r.enLigne} />}
          <div className="dem-aide__nom">
            <h2 className="dem-carte__titre">{r ? tm('aide.referent.titre', { nom: r.nom }) : tm('aide.equipe.titre')}</h2>
            <p className="dem-aide__sous">{r ? tm('aide.referent.sous', { n: r.delai }) : tm('aide.equipe.sous')}</p>
          </div>
        </div>
        <p className="dem-aide__texte">{r ? tm('aide.texte') : tm('aide.texte.equipe')}</p>
        {creneaux.length > 0 && (
          <>
            <p className="dem-aide__libelle" id="dem-aide-creneaux">
              {tm('aide.creneaux')}
            </p>
            <div role="radiogroup" aria-labelledby="dem-aide-creneaux" className="dem-creneaux">
              {creneaux.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={c === creneau}
                  tabIndex={c === creneau ? 0 : -1}
                  className="dem-creneau sc-focus sc-nombre"
                  onClick={() => setChoisi(i)}
                  onKeyDown={(ev) => {
                    const j = ev.key === 'ArrowRight' ? Math.min(creneaux.length - 1, i + 1) : ev.key === 'ArrowLeft' ? Math.max(0, i - 1) : null;
                    if (j === null) return;
                    ev.preventDefault();
                    setChoisi(j);
                    (ev.currentTarget.parentElement?.children[j] as HTMLElement | undefined)?.focus();
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </>
        )}
        {reserve && r && (
          <p role="status" className="dem-aide__reserve">
            {tm('aide.reserve', { nom: r.nom, heure: reserve })}
          </p>
        )}
        <div className="dem-aide__actions">
          {creneau && r && (
            <span title={p.horsLigne ? tm('horsLigne') : undefined}>
              <Bouton
                variante="primaire"
                disabled={p.horsLigne}
                icone={<Phone aria-hidden />}
                onClick={() => {
                  setReserve(creneau);
                  p.onReserver(creneau);
                }}
              >
                {tm('aide.reserver', { heure: creneau })}
              </Bouton>
            </span>
          )}
          <Bouton variante="secondaire" icone={<MessageSquare aria-hidden />} onClick={p.onEcrire}>
            {r ? tm('aide.ecrire') : tm('aide.ecrire.equipe')}
          </Bouton>
        </div>
      </div>
    </Carte>
  );
}

/* ── Le squelette : la même forme que la page chargée, rien ne saute ──────── */

export function SqueletteDemarrage() {
  const { tm } = useMots();
  return (
    <Chargement libelle={tm('chargement')} className="dem-surface">
      <Carte sansMarge className="dem-parcours">
        <div aria-hidden className="dem-parcours__corps">
          <div className="dem-parcours__resume">
            <Squelette largeur={74} hauteur={74} rayon="99px" />
            <div className="dem-squelette-textes">
              <Squelette largeur={96} hauteur={12} rayon="99px" ligne />
              <Squelette largeur={70} hauteur={10} rayon="99px" ligne />
            </div>
          </div>
          <div className="dem-route">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="dem-route__etape dem-squelette-noeud">
                <Squelette largeur={36} hauteur={36} rayon="99px" />
                <Squelette largeur={100} hauteur={10} rayon="99px" ligne />
                <Squelette largeur={60} hauteur={9} rayon="99px" ligne />
              </div>
            ))}
          </div>
        </div>
      </Carte>
      <div className="dem-bas">
        <Carte sansMarge className="dem-carte-etape">
          <div aria-hidden className="dem-squelette-etape">
            <Squelette largeur={120} hauteur={10} rayon="99px" ligne />
            <Squelette largeur={300} hauteur={22} rayon="6px" ligne />
            <Squelette largeur={360} hauteur={12} rayon="99px" ligne />
            <Squelette largeur={330} hauteur={12} rayon="99px" ligne />
          </div>
        </Carte>
        <div aria-hidden className="dem-droite">
          <Squelette largeur="100%" hauteur={233} rayon="14px" />
          <Squelette largeur="100%" hauteur={239} rayon="14px" />
        </div>
      </div>
    </Chargement>
  );
}

/* ── La vue ───────────────────────────────────────────────────────────────── */

export function VueDemarrage(p: VueDemarrageProps) {
  const { tm } = useMots();
  const { calcul } = p;
  const [choisie, setChoisie] = useState<IdEtape | null>(null);

  /* L'étape affichée : celle qu'on a choisie si elle est toujours à faire et montrée, sinon la conseillée. */
  const affichee = useMemo(() => calcul.etapes.find((x) => x.id === choisie && !x.faite) ?? calcul.etapes.find((x) => x.conseillee) ?? null, [calcul, choisie]);
  useEffect(() => {
    if (choisie && !calcul.etapes.some((x) => x.id === choisie && !x.faite)) setChoisie(null);
  }, [calcul, choisie]);

  return (
    <div className="dem-page" data-refonte-police="inter">
      <PageHead
        className="dem-entete"
        titre={tm('titre')}
        attributsTitre={{ 'data-guide': 'titre' }}
        sousTitre={p.prenom ? tm('sous.prenom', { prenom: p.prenom }) : tm('sous')}
        secondaires={[
          ...(calcul.tout ? [] : [{ libelle: tm('plusTard'), onClick: p.onPlusTard } satisfies ActionPage]),
          { libelle: tm('reprendreVisite'), icone: <Play aria-hidden />, onClick: p.onReprendreVisite },
        ]}
      />

      {p.etat === 'chargement' ? (
        <SqueletteDemarrage />
      ) : (
        <div className="dem-surface">
          <Parcours p={p} affichee={affichee?.id ?? null} onAfficher={setChoisie} />
          <div className="dem-bas">
            <Carte sansMarge className="dem-carte-etape" rang={1} aria-label={affichee ? tm('panneau.etape', { n: affichee.rang, total: calcul.total }) : tm('pret.sans')}>
              <div className="dem-carte-etape__corps">
                {p.etat === 'erreur' && (
                  <div role="alert" className="dem-bandeau">
                    <p className="dem-bandeau__texte">
                      <CircleAlert aria-hidden size={16} strokeWidth={1.8} />
                      {tm('erreur')}
                    </p>
                    <Bouton variante="secondaire" icone={<RotateCcw aria-hidden />} onClick={p.onReessayer}>
                      {tm('erreur.reessayer')}
                    </Bouton>
                  </div>
                )}
                {affichee ? (
                  <CarteEtape key={affichee.id} p={p} e={affichee} onAfficher={setChoisie} />
                ) : (
                  <div className="dem-etape dem-etape--fini">
                    <div className="dem-etape__texte">
                      <h2 className="dem-etape__titre">{p.prenom ? tm('pret', { prenom: p.prenom }) : tm('pret.sans')}</h2>
                      <p className="dem-etape__desc">{tm('texte.tout')}</p>
                      <div className="dem-etape__actions">
                        <Bouton variante="primaire" icone={<ArrowRight aria-hidden />} onClick={p.onAccueil}>
                          {tm('allerAccueil')}
                        </Bouton>
                      </div>
                      <div className="dem-etape__bas">
                        <Savoir p={p} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Carte>
            <div className="dem-droite">
              {p.pret.length > 0 && <DejaPret lignes={p.pret} />}
              <Accompagnement p={p} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Le lien de l'application mobile : générique, sans jeton, sans donnée personnelle ── */

function CodeQr({ texte, libelle }: { texte: string; libelle: string }) {
  const code = useMemo(() => encoderQr(texte, { niveau: 'M' }), [texte]);
  if (!code) return null;
  const marge = 4;
  const total = code.taille + marge * 2;
  const chemin: string[] = [];
  for (let y = 0; y < code.taille; y += 1) for (let x = 0; x < code.taille; x += 1) if (code.modules[y][x]) chemin.push(`M${x + marge} ${y + marge}h1v1h-1z`);
  return (
    <svg role="img" aria-label={libelle} viewBox={`0 0 ${total} ${total}`} shapeRendering="crispEdges">
      <path d={chemin.join('')} style={{ fill: 'var(--socle-primaire-encre)' }} />
    </svg>
  );
}

/** Le code et le lien (étape 6 et fenêtre du lien). Sans adresse publique, une explication — jamais un faux lien. */
export function LienMobile({ lien }: { lien: string | null }) {
  const { tm } = useMots();
  if (!lien) return <p className="dem-note">{tm('lien.indisponible')}</p>;
  return (
    <div className="dem-lien-mobile">
      <span className="dem-qr">
        <CodeQr texte={lien} libelle={tm('lien.qr')} />
      </span>
      <p className="dem-adresse" aria-label={tm('lien.champ')}>
        <Smartphone aria-hidden size={13} strokeWidth={1.8} />
        {lien}
      </p>
    </div>
  );
}
