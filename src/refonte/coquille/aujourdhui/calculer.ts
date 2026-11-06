import { appliquerRetouches, construireFil, type LibellesFil, type LigneFil, type RetouchesFil } from '../../accueil/filDuJour';
import { meilleureSerie } from '../../accueil/tuiles';
import { isoDay } from '../../../state/useInvoices';

/**
 * « AUJOURD'HUI » — LE SEUL CALCUL (§1.10 point 3), sans React.
 * ══════════════════════════════════════════════════════════════
 *
 * La carte « Aujourd'hui » de la barre latérale et l'Accueil (N01) lisent les
 * mêmes chiffres parce qu'ils sortent d'ici, une fois : ce qui est fait sur ce
 * qui est prévu, la série, le prochain rendez-vous, et le fil du jour qui les
 * porte. Les RÈGLES restent celles de S2 (`src/refonte/accueil/`) et sont
 * appelées, jamais recopiées :
 *
 *   · `construireFil` puis `appliquerRetouches` (`filDuJour.ts`) : le fil
 *     automatique (priorités, rendez-vous, tâches, étapes d'un compte vide),
 *     puis la main de la personne par-dessus ;
 *   · `meilleureSerie` (`tuiles.ts`) : la série se compte à la clôture — le
 *     jour en cours ne la rompt pas tant qu'il n'est pas fini (04-ECARTS B2).
 *
 * `construireFil` n'est appelé qu'ici (`check:socle-coquille`).
 */

export interface SourcesAujourdhui {
  /** Mon adresse (vide : personne n'est connecté). */
  moi: string;
  /** La synchronisation a répondu. */
  pret: boolean;
  /** Le jour, « AAAA-MM-JJ » local. */
  jour: string;
  taches: { id: string; title?: string; status?: string; assigneeEmail?: string; updatedAt?: string }[];
  priorites: { email: string; day: string; items?: { id: string; label: string; doneAt: string | null }[] }[];
  /** Les rendez-vous, avec leur fin déjà calculée (`appointmentEnd`). */
  rdv: { id: string; title: string; clientName?: string; startAt: string; fin: Date; status: string }[];
  routines: { ticks: string[] }[];
  /** Pour les trois étapes d'un compte vide. */
  clients: number;
  factures: number;
  visiteFaite: boolean;
  retouches: RetouchesFil;
}

export interface LibellesAujourdhui extends LibellesFil {
  /** L'heure d'un instant ISO, à la française (« 11:00 »). */
  heure: (iso: string) => string;
}

export interface AujourdhuiCalcule {
  /** Les lignes faites, sur les lignes visibles du fil : le « x sur y faites ». */
  faites: number;
  total: number;
  /** La série en cours, en jours (0 : pas de série). */
  serie: number;
  /** Le prochain rendez-vous du jour (pas encore fini), ou `null`. */
  prochainRdv: { titre: string; debut: string } | null;
  /** Le fil tel qu'on le montre (retouches appliquées). */
  fil: LigneFil[];
  masquees: number;
  /** Un compte sans client, facture, rendez-vous ni tâche (les étapes de départ sont dans le fil). */
  compteVide: boolean;
}

export function calculerAujourdhui(s: SourcesAujourdhui, maintenant: Date, l: LibellesAujourdhui): AujourdhuiCalcule {
  const rdvDuJour = s.rdv.filter((a) => a.status !== 'cancelled' && isoDay(new Date(a.startAt)) === s.jour);
  const ouvertes = s.taches.filter((t) => t.status === 'todo' || t.status === 'doing');
  const faitesAujourdhui = s.taches.filter((t) => t.status === 'done' && (t.updatedAt ?? '').slice(0, 10) === s.jour);
  const compteVide = s.pret && s.clients === 0 && s.factures === 0 && s.rdv.length === 0 && s.taches.length === 0;
  const lignes = construireFil(
    {
      moi: s.moi,
      priorites: s.priorites.filter((d) => d.day === s.jour).flatMap((d) => (d.items ?? []).map((p) => ({ email: d.email, id: p.id, label: p.label, fait: Boolean(p.doneAt) }))),
      rdv: rdvDuJour.map((a) => ({
        id: a.id,
        titre: a.clientName ? `${a.title} · ${a.clientName}` : a.title,
        quand: a.startAt,
        heure: l.heure(a.startAt),
        fait: a.status === 'done' || a.fin <= maintenant,
      })),
      taches: [...ouvertes, ...faitesAujourdhui].map((t) => ({ id: t.id, titre: t.title || '—', statut: (t.status as 'todo' | 'doing' | 'done') ?? 'todo', responsable: t.assigneeEmail || null })),
      etapes: compteVide ? { client: s.clients > 0, rdv: s.rdv.length > 0, visite: s.visiteFaite } : null,
    },
    l,
  );
  const { visibles, masquees, faits } = appliquerRetouches(lignes, s.retouches, s.jour, s.moi);
  const rdvAVenir = rdvDuJour.filter((a) => a.status === 'scheduled' && a.fin > maintenant).sort((x, y) => x.startAt.localeCompare(y.startAt));
  const prochain = rdvAVenir[0];
  return {
    faites: faits,
    total: visibles.length,
    serie: meilleureSerie(s.routines, maintenant),
    prochainRdv: prochain ? { titre: prochain.title?.trim() || prochain.clientName || '', debut: prochain.startAt } : null,
    fil: visibles,
    masquees,
    compteVide,
  };
}
