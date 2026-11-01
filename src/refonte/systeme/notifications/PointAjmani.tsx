import React, { useId } from 'react';
import { CalendarDays, Euro, Flag, MessageSquare, Shield, Sun } from 'lucide-react';
import { IconeEtincelle } from '../../../socle/ui/controles';
import type { CleMots } from './i18n';
import type { CategorieDuPoint, LignePoint } from './modele';

/**
 * « LE POINT D'AJMANI » (H40, v3 — `AjmaniDigest`) : le résumé du jour en quatre phrases au plus, une par catégorie
 * importante (urgence, paiements, sécurité, rendez-vous, puis mentions), chacune faite du titre que le module a écrit
 * (`pointDuJour`) : rien n'est réécrit ni inventé. Carte teintée de la suggestion d'Ajmani (`#17181a` → `#141415`,
 * bord `#2c2e32`), étincelle verte, heure du calcul ; une icône de 14 px à la couleur de la source par ligne ; les
 * lignes glissent une fois à l'ouverture. Au pied, collé en bas : le résumé du matin (le réglage) et « Régler ».
 *
 * Écart v3 assumé : l'image dit « Résumé du matin envoyé à 8:00 » et « Relire » ; aucun résumé n'est envoyé
 * aujourd'hui (voir l'en-tête de `reglages.ts`), la carte dit donc l'heure réglée et mène au réglage.
 */
const ICONES: Record<CategorieDuPoint, React.ComponentType<{ 'aria-hidden'?: boolean }>> = {
  urgent: Flag,
  paiement: Euro,
  securite: Shield,
  'rendez-vous': CalendarDays,
  mention: MessageSquare,
};

type Tm = (cle: CleMots, params?: Record<string, string | number>) => string;

/** La phrase d'une ligne : « 1 urgence : … », « Facture encaissée. », « …, et 2 autres. ». */
export function phrasePoint(l: LignePoint, tm: Tm): string {
  if (l.categorie === 'urgent') return l.nombre === 1 ? tm('point.urgent.un', { titre: l.titre }) : tm('point.urgent.n', { n: l.nombre, titre: l.titre });
  if (l.nombre === 1) return tm('point.ligne.un', { titre: l.titre });
  if (l.nombre === 2) return tm('point.ligne.deux', { titre: l.titre });
  return tm('point.ligne.n', { titre: l.titre, n: l.nombre - 1 });
}

export interface PointAjmaniProps {
  tm: Tm;
  /** L'heure du calcul (« 10:42 ») : le point est recalculé à l'ouverture de la page et chaque minute. */
  heure: string;
  lignes: readonly LignePoint[];
  resume: { actif: boolean; heure: string };
  onRegler: () => void;
}

export function PointAjmani({ tm, heure, lignes, resume, onRegler }: PointAjmaniProps): React.ReactElement {
  const id = useId();
  return (
    <section className="sc-notif__carte sc-notif__point-ajmani" aria-labelledby={id}>
      <header className="sc-notif__point-entete">
        <IconeEtincelle taille={14} />
        <h2 id={id} className="sc-notif__point-titre">
          {tm('point.titre')}
        </h2>
        <span className="sc-notif__point-heure sc-nombre">{tm('point.a', { heure })}</span>
      </header>
      {lignes.length > 0 ? (
        <ul className="sc-notif__point-lignes" role="list">
          {lignes.map((l, i) => {
            const Icone = ICONES[l.categorie];
            return (
              <li key={l.categorie} className="sc-notif__point-ligne" data-mvt="arrivee" style={{ animationDelay: `${i * 60}ms` }}>
                <span aria-hidden className="sc-notif__point-icone" data-categorie={l.categorie} style={{ '--sc-notif-teinte': `var(--socle-fam-${l.famille})` } as React.CSSProperties}>
                  <Icone aria-hidden />
                </span>
                <span className="sc-notif__point-texte">{phrasePoint(l, tm)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="sc-notif__point-calme">{tm('point.calme')}</p>
      )}
      <footer className="sc-notif__point-pied">
        <Sun aria-hidden className="sc-notif__point-soleil" />
        <span className="sc-notif__point-resume">{resume.actif ? tm('point.resume', { heure: resume.heure }) : tm('point.resume.off')}</span>
        <button type="button" className="sc-notif__lien-fort" onClick={onRegler}>
          {tm('point.regler')}
        </button>
      </footer>
    </section>
  );
}
