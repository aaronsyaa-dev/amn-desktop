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
