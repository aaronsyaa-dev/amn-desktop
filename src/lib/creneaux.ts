/**
 * LES CRÉNEAUX LIBRES — une seule règle, deux écrans.
 *
 * La page publique (`PublicBookingScreen`) calculait les créneaux chez elle ;
 * l'écran de réglage (`BookingScreen`) n'en calculait aucun et se contentait
 * de montrer des cases à cocher. Le jour où celui qui règle veut voir CE QUE
 * LE VISITEUR VERRA, il faut le même calcul des deux côtés — et deux copies
 * du même algorithme finissent toujours par diverger d'une minute ou d'un
 * bord d'intervalle.
 *
 * Le serveur revalide tout à la réservation : ce module aide à choisir et à
 * montrer, il ne fait jamais autorité.
 */

export type JourSemaine = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

/** L'ordre de `Date.getDay()` : dimanche en 0. Ne pas réordonner. */
export const CLES_JOUR: JourSemaine[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export interface FenetreHoraire {
  from: string;
  to: string;
}

/** « 09:30 » → 570. `null` sur toute autre écriture : un champ vide ne vaut pas minuit. */
export const minutesDe = (hhmm: string): number | null => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export interface JourOuvert {
  iso: string;
  date: Date;
  creneaux: Date[];
}

/**
 * Les jours à venir qui ont au moins un créneau libre.
 *
 * Un créneau ne compte que s'il tient ENTIÈREMENT dans la fenêtre (`m +
 * durationMin <= a`), s'il est à venir, et s'il ne chevauche aucun rendez-vous
 * déjà pris. Les jours sans créneau libre ne sont pas rendus : une journée
 * vide dans une liste de disponibilités est un faux espoir.
 */
export function joursOuverts(params: {
  availability: Partial<Record<JourSemaine, FenetreHoraire[]>>;
  durationMin: number;
  jours: number;
  pris: { startAt: string; durationMin: number }[];
  maintenant?: number;
}): JourOuvert[] {
  const { availability, durationMin, jours, pris } = params;
  const maintenant = params.maintenant ?? Date.now();
  const out: JourOuvert[] = [];
  if (durationMin <= 0) return out;
  for (let i = 0; i < jours; i += 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    const fenetres = availability[CLES_JOUR[d.getDay()]] ?? [];
    const creneaux: Date[] = [];
    for (const f of fenetres) {
      const de = minutesDe(f.from);
      const a = minutesDe(f.to);
      if (de === null || a === null) continue;
      for (let m = de; m + durationMin <= a; m += durationMin) {
        const debut = new Date(d);
        debut.setMinutes(m);
        if (debut.getTime() <= maintenant) continue;
        const occupe = pris.some((p) => {
          const pd = Date.parse(p.startAt);
          return debut.getTime() < pd + p.durationMin * 60_000 && pd < debut.getTime() + durationMin * 60_000;
        });
        if (!occupe) creneaux.push(debut);
      }
    }
    if (creneaux.length > 0) out.push({ iso: d.toISOString().slice(0, 10), date: d, creneaux });
  }
  return out;
}

/* --------------------------------------------- le plateau de créneaux (`23d`) */

/**
 * L'ÉTAT D'UN CRÉNEAU, DU POINT DE VUE DU VISITEUR.
 *
 *   `libre`  — il peut le réserver ;
 *   `pris`   — quelqu'un l'a réservé en ligne avant lui ;
 *   `interne`— l'agenda le bloque pour une autre raison. LE VISITEUR NE LE
 *              VOIT PAS DU TOUT : la page publique ne rend que les créneaux
 *              libres. C'est le seul créneau que personne ne peut réserver,
 *              et l'écran de réglage doit l'expliquer plutôt que de laisser
 *              croire qu'il est offert ;
 *   `ferme`  — l'heure est hors de la fenêtre d'ouverture de ce jour-là. Elle
 *              n'existe pas pour le visiteur ; elle est dessinée ici pour que
 *              la grille reste une grille, et que l'œil compare des colonnes
 *              de même hauteur.
 */
export type EtatCreneau = 'libre' | 'pris' | 'interne' | 'ferme';

export interface CaseDuPlateau {
  debut: Date;
  etat: EtatCreneau;
  /** Ce qui occupe le créneau, quand il est pris ou bloqué. */
  intitule?: string;
}

export interface ColonneDuPlateau {
  iso: string;
  date: Date;
  cases: CaseDuPlateau[];
  libres: number;
}

export interface Plateau {
  colonnes: ColonneDuPlateau[];
  /** Les heures de la grille commune, en minutes depuis minuit. */
  heures: number[];
}

/**
 * LE PLATEAU — l'offre telle que le visiteur la voit, et ce qu'il en reste.
 *
 * LA GRILLE EST COMMUNE À TOUTES LES COLONNES : elle va de la première heure
 * ouverte de la semaine à la dernière, par pas d'une durée de rendez-vous. Une
 * grille recalculée par colonne donnerait des lignes qui ne s'alignent pas, et
 * on ne pourrait plus lire « mardi à 10 h » en parcourant une ligne — ce qui
 * est précisément ce qu'on fait devant un plateau de créneaux.
 */
export function plateauDeCreneaux(params: {
  availability: Partial<Record<JourSemaine, FenetreHoraire[]>>;
  durationMin: number;
  jours: number;
  /** Tous les rendez-vous de l'agenda, avec leur origine. */
  pris: { startAt: string; durationMin: number; source?: string; title?: string }[];
  maintenant?: number;
}): Plateau {
  const { availability, durationMin, jours, pris } = params;
  const maintenant = params.maintenant ?? Date.now();
  if (durationMin <= 0) return { colonnes: [], heures: [] };

  /* Les bornes de la grille : la plus tôt et la plus tard de toute la semaine. */
  let tot = Infinity;
  let tard = -Infinity;
  for (const cle of CLES_JOUR) {
    for (const f of availability[cle] ?? []) {
      const de = minutesDe(f.from);
      const a = minutesDe(f.to);
      if (de === null || a === null) continue;
      tot = Math.min(tot, de);
      tard = Math.max(tard, a);
    }
  }
  if (!Number.isFinite(tot) || !Number.isFinite(tard)) return { colonnes: [], heures: [] };

  const heures: number[] = [];
  for (let m = tot; m + durationMin <= tard; m += durationMin) heures.push(m);

  const colonnes: ColonneDuPlateau[] = [];
  for (let i = 0; i < jours && colonnes.length < 6; i += 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    const fenetres = availability[CLES_JOUR[d.getDay()]] ?? [];
    /* UNE COLONNE PAR JOUR OUVRÉ : un jour fermé n'est pas une colonne vide,
       il n'est pas une colonne du tout — la page publique ne le propose pas. */
    if (fenetres.length === 0) continue;

    const cases: CaseDuPlateau[] = heures.map((m) => {
      const debut = new Date(d);
      debut.setMinutes(m);
      const dedans = fenetres.some((f) => {
        const de = minutesDe(f.from);
        const a = minutesDe(f.to);
        return de !== null && a !== null && m >= de && m + durationMin <= a;
      });
      if (!dedans || debut.getTime() <= maintenant) return { debut, etat: 'ferme' };
      const occupant = pris.find((p) => {
        const pd = Date.parse(p.startAt);
        return debut.getTime() < pd + p.durationMin * 60_000 && pd < debut.getTime() + durationMin * 60_000;
      });
      if (!occupant) return { debut, etat: 'libre' };
      return {
        debut,
        etat: occupant.source === 'booking' ? 'pris' : 'interne',
        intitule: occupant.title,
      };
    });

    colonnes.push({
      iso: d.toISOString().slice(0, 10),
      date: d,
      cases,
      libres: cases.filter((c) => c.etat === 'libre').length,
    });
  }
  return { colonnes, heures };
}
