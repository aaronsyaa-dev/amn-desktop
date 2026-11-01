import React from 'react';
import { Bell, CalendarDays, Check, Euro, Eye, Flag, Lock, MessageSquare, Package, Users } from 'lucide-react';
import { Bouton } from '../../../socle/ui/Bouton';
import { DrapeauUrgent } from '../../../socle/ui/controles';
import type { CleMots } from './i18n';
import { MenuReport } from './MenuReport';
import type { IconeNotification, Notification, OptionReport, TypeNotification } from './modele';

/**
 * LES LIGNES DU FIL (H40, v3) — trois formes, les composants propres à cet écran :
 *
 *   · `CarteAction` (NotifActionCard) : une notification de « Maintenant », en carte, ses gestes VISIBLES en
 *     permanence. Urgente : bord et fond teintés du critique, « Ouvrir le ticket » (le seul bouton primaire du fil)
 *     et « Reporter » ; sinon neutre, un seul geste secondaire à droite (« Voir le rendez-vous »).
 *   · `LigneNotification` (NotificationRow) : 46 px, point « non lu » de 7 px, tuile de 32 px teintée de la famille
 *     d'origine à .13, titre de 13 px, détail de 12 px T4, heure tabulaire sur 40 px. « Ouvrir » et « Reporter »
 *     (secondaires) prennent la place de l'heure au survol ou au focus, jamais en permanence.
 *   · `LignePaquet` (NotifBundle) : plusieurs notifications d'une même clé en une ligne — deux cartes fantômes
 *     derrière la tuile, un compteur de 16 px ; un clic le déplie en place.
 *
 * Le corps d'une ligne est un vrai `<button>` : Entrée l'ouvre (ou déplie le paquet), un seul arrêt de tabulation
 * dans le fil, les flèches font le reste (`VueNotifications`). « Non lu » se dit par le point ET par un mot.
 */
export const ICONES: Record<IconeNotification, React.ComponentType<{ 'aria-hidden'?: boolean }>> = {
  drapeau: Flag,
  euro: Euro,
  cadenas: Lock,
  bulle: MessageSquare,
  calendrier: CalendarDays,
  coche: Check,
  boite: Package,
  utilisateurs: Users,
  cloche: Bell,
};

type Tm = (cle: CleMots, params?: Record<string, string | number>) => string;

/**
 * La teinte d'une tuile : la famille d'origine ; une alerte de sécurité vient de La Garde (`#d6d6da`, socle §1) ;
 * seule l'urgence prend le critique (`data-urgente`).
 */
export const teinteDe = (n: Pick<Notification, 'type' | 'famille'>): string => (n.type === 'securite' ? 'garde' : n.famille);
const teinte = (famille: string): React.CSSProperties => ({ '--sc-notif-teinte': `var(--socle-fam-${famille})` }) as React.CSSProperties;

function Tuile({ n, taille }: { n: Pick<Notification, 'icone' | 'famille' | 'type' | 'urgente' | 'lue'>; taille: 'ligne' | 'carte' }): React.ReactElement {
  const Icone = ICONES[n.icone];
  const urgente = n.urgente && !n.lue;
  return (
    <span aria-hidden className="sc-notif__tuile" data-taille={taille} data-urgente={urgente || undefined} style={urgente ? undefined : teinte(teinteDe(n))}>
      <Icone aria-hidden />
    </span>
  );
}

/* ── La carte d'action (« Maintenant ») ──────────────────────────────────── */

/** Le libellé du geste principal d'une carte, selon le type (« Ouvrir le ticket », « Voir le rendez-vous »…). */
export function libelleOuvrir(type: TypeNotification): CleMots {
  if (type === 'urgent') return 'carte.ouvrir.urgent';
  if (type === 'securite') return 'carte.ouvrir.securite';
  if (type === 'rendez-vous') return 'carte.ouvrir.rendez-vous';
  return 'carte.ouvrir';
}

export interface CarteActionProps {
  notification: Notification;
  heure: string;
  tm: Tm;
  /** Le seul bouton blanc du fil : la première carte urgente le porte, les suivantes sont secondaires. */
  primaire: boolean;
  options: readonly OptionReport[];
  menuOuvert: boolean;
  onOuvrir: () => void;
  onChoisirReport: (option: OptionReport) => void;
  onBasculerMenu: () => void;
  onFermerMenu: () => void;
}

export function CarteAction(p: CarteActionProps): React.ReactElement {
  const { notification: n, tm } = p;
  const urgente = n.urgente && !n.lue;
  const libelle = tm(libelleOuvrir(n.type));
  const titreId = `sc-notif-carte-${n.id.replace(/[^\w-]/g, '_')}`;
  return (
    <article className="sc-notif__carte-action" data-urgente={urgente || undefined} data-notification={n.id} aria-labelledby={titreId}>
      <Tuile n={n} taille="carte" />
      <div className="sc-notif__carte-action-corps">
        <div className="sc-notif__carte-action-haut">
          <div className="sc-notif__texte">
            <span className="sc-notif__ligne-titre">
              <span id={titreId} className="sc-notif__carte-action-titre" title={n.titre}>
                {n.titre}
              </span>
              {urgente && <DrapeauUrgent />}
            </span>
            <span className="sc-notif__detail" title={n.detail}>
              {n.detail}
            </span>
          </div>
          {urgente ? (
            <time className="sc-notif__heure sc-nombre" dateTime={n.date}>
              {p.heure}
            </time>
          ) : (
            <Bouton variante="secondaire" taille="petit" icone={<Eye aria-hidden />} onClick={p.onOuvrir}>
              {libelle}
            </Bouton>
          )}
        </div>
        {urgente && (
          <div className="sc-notif__carte-action-gestes">
            <Bouton variante={p.primaire ? 'primaire' : 'secondaire'} taille="petit" onClick={p.onOuvrir}>
              {libelle}
            </Bouton>
            <MenuReport tm={tm} options={p.options} ouvert={p.menuOuvert} icone onBasculer={p.onBasculerMenu} onFermer={p.onFermerMenu} onChoisir={p.onChoisirReport} />
          </div>
        )}
      </div>
    </article>
  );
}

/* ── La ligne ────────────────────────────────────────────────────────────── */

export interface LigneNotificationProps {
  notification: Notification;
  heure: string;
  tm: Tm;
  /** Un seul arrêt de tabulation dans tout le fil : la ligne qui le porte. */
  tabIndex: 0 | -1;
  /** « Ouvrir » et « Reporter » sont montés (survol, focus ou menu ouvert). */
  actionsVisibles: boolean;
  menuOuvert: boolean;
  options: readonly OptionReport[];
  sortie: boolean;
  /** Une ligne d'un paquet déplié : retrait de 16 px. */
  dansUnPaquet?: boolean;
  onOuvrir: () => void;
  onChoisirReport: (option: OptionReport) => void;
  onBasculerMenu: () => void;
  onFermerMenu: () => void;
  onSurvol: (survole: boolean) => void;
  onFocusLigne: () => void;
  onQuitterFocus: () => void;
}

export function LigneNotification(p: LigneNotificationProps): React.ReactElement {
  const { notification: n, tm } = p;
  return (
    <li
      className="sc-notif__ligne"
      data-lue={n.lue}
      data-actif={p.actionsVisibles || undefined}
      data-sortie={p.sortie || undefined}
      data-retrait={p.dansUnPaquet || undefined}
      data-notification={n.id}
      onMouseEnter={() => p.onSurvol(true)}
      onMouseLeave={() => p.onSurvol(false)}
      onFocus={p.onFocusLigne}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) p.onQuitterFocus();
      }}
    >
      <button type="button" className="sc-notif__corps-ligne" data-ligne={n.id} tabIndex={p.tabIndex} onClick={p.onOuvrir}>
        <span aria-hidden className="sc-notif__point" />
        {!n.lue && <span className="sc-notif__sr">{tm('ligne.nonLue')}</span>}
        <Tuile n={n} taille="ligne" />
        <span className="sc-notif__texte">
          <span className="sc-notif__ligne-titre">
            <span className="sc-notif__ligne-nom" title={n.titre}>
              {n.titre}
            </span>
            {n.urgente && !n.lue && <DrapeauUrgent />}
          </span>
          <span className="sc-notif__detail" title={n.detail}>
            {n.detail}
          </span>
        </span>
        <time className="sc-notif__heure sc-nombre" dateTime={n.date} data-masquee={p.actionsVisibles || undefined}>
          {p.heure}
        </time>
      </button>
      {p.actionsVisibles && (
        <div className="sc-notif__actions">
          <Bouton variante="secondaire" taille="petit" onClick={p.onOuvrir} aria-label={tm('ligne.ouvrirLibelle', { titre: n.titre })}>
            {tm('ligne.ouvrir')}
          </Bouton>
          <MenuReport tm={tm} options={p.options} ouvert={p.menuOuvert} onBasculer={p.onBasculerMenu} onFermer={p.onFermerMenu} onChoisir={p.onChoisirReport} />
        </div>
      )}
    </li>
  );
}

/* ── Le paquet ───────────────────────────────────────────────────────────── */

export interface LignePaquetProps {
  id: string;
  titre: string;
  detail: string;
  heure: string;
  date: string;
  nombre: number;
  lue: boolean;
  famille: string;
  type: TypeNotification;
  icone: IconeNotification;
  deplie: boolean;
  tm: Tm;
  tabIndex: 0 | -1;
  onBasculer: () => void;
  onFocusLigne: () => void;
  onQuitterFocus: () => void;
}

export function LignePaquet(p: LignePaquetProps): React.ReactElement {
  const Icone = ICONES[p.icone];
  return (
    <li
      className="sc-notif__ligne sc-notif__ligne--paquet"
      data-lue={p.lue}
      data-deplie={p.deplie || undefined}
      onFocus={p.onFocusLigne}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) p.onQuitterFocus();
      }}
    >
      <button type="button" className="sc-notif__corps-ligne" data-ligne={p.id} tabIndex={p.tabIndex} aria-expanded={p.deplie} onClick={p.onBasculer}>
        <span aria-hidden className="sc-notif__point" />
        {!p.lue && <span className="sc-notif__sr">{p.tm('ligne.nonLue')}</span>}
        <span aria-hidden className="sc-notif__pile">
          <span className="sc-notif__fantome" data-rang="2" />
          <span className="sc-notif__fantome" data-rang="1" />
          <span className="sc-notif__tuile" data-taille="ligne" style={teinte(p.type === 'securite' ? 'garde' : p.famille)}>
            <Icone aria-hidden />
          </span>
          <b className="sc-notif__pile-compteur sc-nombre">{p.nombre}</b>
        </span>
        <span className="sc-notif__sr">{p.tm('paquet.compteur', { n: p.nombre })}</span>
        <span className="sc-notif__texte">
          <span className="sc-notif__ligne-titre">
            <span className="sc-notif__ligne-nom" title={p.titre}>
              {p.titre}
            </span>
          </span>
          <span className="sc-notif__detail" title={p.detail}>
            {p.detail}
          </span>
        </span>
        <time className="sc-notif__heure sc-nombre" dateTime={p.date}>
          {p.heure}
        </time>
      </button>
    </li>
  );
}
