import React, { useRef, useState } from 'react';
import { Moon } from 'lucide-react';
import { LiveDot } from '../../../socle/ui/vivant';
import { styleRang } from '../../../socle/couche-mouvement';
import type { CleMots } from './i18n';
import { heureHorloge, importanceDe, minutesDuJour, type Journee, type Notification } from './modele';

/**
 * L'ANNEAU DE LA JOURNÉE (H40, v3 — `DayRing`) : 24 heures en un cadran, le composant propre à cet écran.
 *
 *   · la piste (rayon 76, 12 px, `#1c1c1e`) ; l'arc des HEURES CALMES (le réglage, `#8aa4d6` à .26) ; l'arc du TEMPS
 *     ÉCOULÉ depuis la fin des heures calmes (`#3a3a3e`), qui se dessine à l'ouverture ;
 *   · 24 graduations à l'intérieur (les 4 cardinales plus longues, en `#5f5f64`), « 0 h », « 6 h », « 12 h », « 18 h »
 *     en monospace 10,5 px T4 ;
 *   · UNE NOTIFICATION = UN RAYON de 3 px vers l'extérieur, à son heure : 24 px pour l'urgente, 15 pour une non lue,
 *     11 pour une lue ; couleur de la famille d'origine (l'urgence prend le critique) ; en pointillé T3 quand elle a
 *     été RETENUE (heures calmes, silence, niveau de bruit : `estRetenue`). Les rayons apparaissent un à un ;
 *   · l'aiguille blanche de l'instant présent, son point vivant (onde de 2,2 s), la lune dans la zone calme ;
 *   · au centre : les non lues du jour (« 4 à voir ») sur toutes celles du jour (« sur 9 aujourd'hui »).
 *
 * Rien n'y est inventé : chaque rayon est une notification du jour, les heures calmes sont lues dans le réglage.
 * Survol d'un rayon : son heure et son titre ; clic : le fil défile jusqu'à la notification (`onChoisir`). Au clavier,
 * les rayons forment un seul arrêt de tabulation : ← → (↑ ↓) passent d'un rayon à l'autre, Entrée ou Espace font
 * défiler le fil. Sans `onChoisir` (chargement, erreur), l'anneau n'est qu'une image.
 */
const TAILLE = 248;
const C = TAILLE / 2;
const R_PISTE = 76;
const EPAISSEUR = 12;
const R_RAYON = 84;
const LONGUEUR: Record<ReturnType<typeof importanceDe>, number> = { urgente: 24, 'non-lue': 15, lue: 11 };
const R_LIBELLE = 114;
const R_LUNE = 102;
const R_AIGUILLE = [55, 69] as const;

const angle = (minutes: number): number => (minutes / 1440) * 2 * Math.PI;
const point = (r: number, minutes: number): { x: number; y: number } => ({ x: C + r * Math.sin(angle(minutes)), y: C - r * Math.cos(angle(minutes)) });
const arrondi = (v: number): number => Math.round(v * 100) / 100;

/** Le chemin d'un arc de la piste, de `de` à `a` (minutes depuis minuit), dans le sens des aiguilles. */
export function cheminArc(de: number, a: number, r = R_PISTE): string {
  let fin = a;
  while (fin <= de) fin += 1440;
  if (fin - de >= 1440) fin = de + 1439.9;
  const p1 = point(r, de);
  const p2 = point(r, fin);
  const grand = fin - de > 720 ? 1 : 0;
  return `M ${arrondi(p1.x)} ${arrondi(p1.y)} A ${r} ${r} 0 ${grand} 1 ${arrondi(p2.x)} ${arrondi(p2.y)}`;
}

const enMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export interface AnneauJourneeProps {
  tm: (cle: CleMots, params?: Record<string, string | number>) => string;
  locale: string;
  maintenant: Date;
  journee: Journee;
  heuresCalmes: { actif: boolean; de: string; a: string };
  /** L'heure du résumé du matin, « 8:00 » : la légende « gardée pour 8:00 ». */
  heureResume: string;
  estRetenue: (n: Notification) => boolean;
  /** Le squelette du chargement : la piste seule. */
  chargement?: boolean;
  onChoisir?: (id: string) => void;
}

export function AnneauJournee(p: AnneauJourneeProps): React.ReactElement {
  const { tm, maintenant, journee: j, heuresCalmes: calmes } = p;
  const maintenantMin = minutesDuJour(maintenant);
  const de = enMinutes(calmes.de);
  const a = enMinutes(calmes.a);
  // Le temps écoulé part de la fin des heures calmes (8:00), ou de minuit sans heures calmes ou avant leur fin.
  const debutJournee = calmes.actif && maintenantMin >= a ? a : 0;
  const heureNow = heureHorloge(maintenant, p.locale);
  const lune = calmes.actif ? point(R_LUNE, de + (((a - de + 1440) % 1440) * 5) / 12) : null;
  const aiguille = [point(R_AIGUILLE[0], maintenantMin), point(R_AIGUILLE[1], maintenantMin)];
  const pointNow = point(R_PISTE, maintenantMin);
  const [actif, setActif] = useState(0);
  const rayons = useRef<(SVGLineElement | null)[]>([]);
  const choisir = p.onChoisir;
  const rangActif = Math.min(actif, Math.max(0, j.notifications.length - 1));
  const surTouche = (e: React.KeyboardEvent<SVGLineElement>, i: number, id: string) => {
    const n = j.notifications.length;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choisir?.(id);
      return;
    }
    const pas = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!pas) return;
    e.preventDefault();
    const suivant = (i + pas + n) % n;
    setActif(suivant);
    rayons.current[suivant]?.focus();
  };

  return (
    <div className="sc-notif__anneau" data-chargement={p.chargement || undefined}>
      <svg
        className="sc-notif__anneau-svg"
        width={TAILLE}
        height={TAILLE}
        viewBox={`0 0 ${TAILLE} ${TAILLE}`}
        role={choisir ? 'group' : 'img'}
        aria-label={p.chargement ? tm('etat.chargement') : tm('journee.libelle', { n: j.total, v: j.aVoir })}
      >
        <circle className="sc-notif__anneau-piste" cx={C} cy={C} r={R_PISTE} strokeWidth={EPAISSEUR} fill="none" />
        {!p.chargement && (
          <>
            {maintenantMin > debutJournee && (
              <path className="sc-notif__anneau-ecoule" d={cheminArc(debutJournee, maintenantMin)} strokeWidth={EPAISSEUR} fill="none" pathLength={1} data-mvt="trace" />
            )}
            {calmes.actif && de !== a && <path className="sc-notif__anneau-calmes" d={cheminArc(de, a)} strokeWidth={EPAISSEUR} fill="none" />}
            {Array.from({ length: 24 }, (_, h) => {
              const cardinale = h % 6 === 0;
              const p1 = point(cardinale ? 61 : 63, h * 60);
              const p2 = point(66, h * 60);
              return <line key={h} className="sc-notif__anneau-graduation" data-cardinale={cardinale || undefined} x1={arrondi(p1.x)} y1={arrondi(p1.y)} x2={arrondi(p2.x)} y2={arrondi(p2.y)} />;
            })}
            {j.notifications.map((n, i) => {
              const m = minutesDuJour(new Date(n.date));
              const importance = importanceDe(n);
              const retenue = p.estRetenue(n);
              const p1 = point(R_RAYON, m);
              const p2 = point(R_RAYON + LONGUEUR[importance], m);
              const quand = heureHorloge(new Date(n.date), p.locale);
              const dit = tm(retenue ? 'journee.rayon.gardee' : 'journee.rayon', { heure: quand, titre: n.titre });
              return (
                <line
                  key={n.id}
                  ref={(el) => {
                    rayons.current[i] = el;
                  }}
                  className="sc-notif__rayon"
                  data-importance={importance}
                  data-retenue={retenue || undefined}
                  data-mvt="entree"
                  style={{ ...styleRang(i), '--sc-notif-teinte': `var(--socle-fam-${n.type === 'securite' ? 'garde' : n.famille})` } as React.CSSProperties}
                  x1={arrondi(p1.x)}
                  y1={arrondi(p1.y)}
                  x2={arrondi(p2.x)}
                  y2={arrondi(p2.y)}
                  role={choisir ? 'button' : undefined}
                  tabIndex={choisir ? (i === rangActif ? 0 : -1) : undefined}
                  aria-label={choisir ? dit : undefined}
                  onClick={choisir ? () => choisir(n.id) : undefined}
                  onKeyDown={choisir ? (e) => surTouche(e, i, n.id) : undefined}
                  onFocus={() => setActif(i)}
                >
                  <title>{dit}</title>
                </line>
              );
            })}
            <line className="sc-notif__aiguille" x1={arrondi(aiguille[0].x)} y1={arrondi(aiguille[0].y)} x2={arrondi(aiguille[1].x)} y2={arrondi(aiguille[1].y)} />
          </>
        )}
      </svg>
      {(['0', '6', '12', '18'] as const).map((h) => {
        const pos = point(R_LIBELLE, Number(h) * 60);
        return (
          <span key={h} aria-hidden className="sc-notif__anneau-heure sc-mono" style={{ left: arrondi(pos.x), top: arrondi(pos.y) }}>
            {tm('journee.heure', { h })}
          </span>
        );
      })}
      {lune && !p.chargement && (
        <span aria-hidden className="sc-notif__anneau-lune" style={{ left: arrondi(lune.x), top: arrondi(lune.y) }}>
          <Moon aria-hidden />
        </span>
      )}
      {!p.chargement && (
        <span className="sc-notif__anneau-maintenant" style={{ left: arrondi(pointNow.x), top: arrondi(pointNow.y) }}>
          <LiveDot libelle={tm('journee.maintenant', { heure: heureNow })} halo={false} />
        </span>
      )}
      <div className="sc-notif__anneau-centre" aria-hidden={p.chargement || undefined}>
        {!p.chargement && (
          <>
            <b className="sc-notif__anneau-nombre sc-nombre">{j.aVoir}</b>
            <span className="sc-notif__anneau-avoir">{tm('journee.aVoir')}</span>
            <span className="sc-notif__anneau-sur">{tm('journee.sur', { n: j.total })}</span>
          </>
        )}
      </div>
      {!p.chargement && (
        <div className="sc-notif__legende" aria-hidden>
          <span className="sc-notif__legende-ligne">
            <span className="sc-notif__legende-element">
              <i className="sc-notif__temoin" data-genre="notification" />
              {tm('journee.legende.notification')}
            </span>
            {calmes.actif && (
              <span className="sc-notif__legende-element">
                <i className="sc-notif__temoin" data-genre="calmes" />
                {tm('journee.legende.calmes')}
              </span>
            )}
          </span>
          <span className="sc-notif__legende-ligne">
            <span className="sc-notif__legende-element">
              <i className="sc-notif__temoin" data-genre="gardee" />
              {tm('journee.legende.gardee', { heure: p.heureResume })}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
