import type { Famille } from '../../socle/familles';

/**
 * ACTIVITÉ DE L'ÉQUIPE — un fil tiré du journal, ponctué de jalons.
 * ═════════════════════════════════════════════════════════════════
 *
 * Trois sources réelles, fusionnées et triées du plus récent au plus ancien :
 *
 *   · le journal d'activité de l'app (`useActivity().events`) : ce que les
 *     autres membres ont créé ou modifié — tâches, messages, rendez-vous… ;
 *   · le journal de bord (`logbook`) : ce qu'on a choisi de garder, signé ;
 *   · des JALONS, tirés des données : une facture encaissée, un nouveau
 *     client, une décision notée au journal de bord.
 *
 * Pur. Rien n'est inventé : une source vide ne donne aucune ligne, et un fil
 * vide se dit comme tel à l'écran.
 */

export interface LigneActivite {
  cle: string;
  /** ISO. */
  quand: string;
  /** Email de qui l'a fait, s'il est connu. */
  qui: string | null;
  texte: string;
  /** `jalon` : un moment qui compte, marqué autrement dans le fil. */
  type: 'modif' | 'journal' | 'jalon';
  famille: Famille;
}

export interface SourcesActivite {
  evenements: { key: string; routeKey: string; noun: string; text: string; actorEmail: string; at: string }[];
  journal: { id: string; text: string; kind: string; byEmail: string; at: string }[];
  encaissements: { id: string; numero: string; paidAt: string }[];
  clients: { id: string; nom: string; createdAt: string }[];
  /** La famille d'une route (`familleDe` du registre S1, passé par l'appelant). */
  familleDeRoute: (route: string) => Famille;
}

export interface LibellesActivite {
  modif: (nom: string, texte: string) => string;
  encaissee: (numero: string) => string;
  client: (nom: string) => string;
}

const court = (t: string, n = 110) => {
  const s = t.trim().replace(/\s+/g, ' ');
  return s.length > n ? `${s.slice(0, n - 2).trimEnd()}…` : s;
};

export function filDActivite(s: SourcesActivite, l: LibellesActivite, limite = 12): LigneActivite[] {
  const lignes: LigneActivite[] = [];
  for (const e of s.evenements) {
    if (!e.at) continue;
    lignes.push({ cle: `evt:${e.key}`, quand: e.at, qui: e.actorEmail || null, texte: l.modif(e.noun, court(e.text)), type: 'modif', famille: s.familleDeRoute(e.routeKey) });
  }
  for (const j of s.journal) {
    if (!j.at || !j.text?.trim()) continue;
    lignes.push({ cle: `journal:${j.id}`, quand: j.at, qui: j.byEmail || null, texte: court(j.text), type: j.kind === 'decision' ? 'jalon' : 'journal', famille: 'ecrire' });
  }
  for (const f of s.encaissements) {
    if (!f.paidAt) continue;
    lignes.push({ cle: `paye:${f.id}`, quand: f.paidAt, qui: null, texte: l.encaissee(f.numero), type: 'jalon', famille: 'argent' });
  }
  for (const c of s.clients) {
    if (!c.createdAt) continue;
    lignes.push({ cle: `client:${c.id}`, quand: c.createdAt, qui: null, texte: l.client(court(c.nom, 60)), type: 'jalon', famille: 'contacts' });
  }
  return lignes.sort((a, b) => b.quand.localeCompare(a.quand)).slice(0, limite);
}
