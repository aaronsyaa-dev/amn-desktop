import type { AdminOrganization, AdminOrgUser, OrgPulse, SupportRequestForOperator } from '../shared/api';
import type { Maturite } from './maturiteSoc';

/**
 * LE RAPPORT CLIENT — UN SEUL TABLEAU DE DONNÉES POUR LE SOMMAIRE ET POUR LE DOS.
 *
 * C'est la condition pour que le dos du document (`30g`) dise vrai : la hauteur
 * d'un segment vient du MÊME tableau que la ligne du sommaire, et le poids d'une
 * section est le nombre de lignes qu'elle écrit réellement dans le document.
 * Des hauteurs posées à la main dériveraient : une section vaudrait dix-huit
 * pixels à un endroit et vingt-deux à un autre, et la bascule promise
 * n'épaissirait rien.
 *
 * POURQUOI DES LIGNES ET NON DES PAGES. La direction compte en pages, à huit
 * pixels la page. Rien ici ne sait ce que vaut une page : le rapport n'est pas
 * paginé, il s'imprime par le navigateur et sa pagination dépend du papier, de
 * la fonte et de la marge. Poser « annexes : treize pages » aurait été un
 * chiffre inventé. Le poids d'une section est donc ce qu'on peut compter — SES
 * LIGNES — et l'échelle du dos en découle. L'instrument est le même, et son
 * unité est vérifiable.
 *
 * ET IL N'Y AVAIT PAS DE SECTIONS. L'écran composait une page fixe : identité,
 * activité, maturité, sans bascule ni sommaire. Les huit sections de la
 * direction (et leurs poids en pages) étaient une proposition de maquette. Les
 * sections ci-dessous sont celles que les données du serveur permettent
 * réellement d'écrire, et rien de plus.
 */

export interface Dossier {
  org: AdminOrganization;
  membres: AdminOrgUser[];
  pouls: OrgPulse | null;
  support: SupportRequestForOperator[];
  maturite: Maturite;
  entrees30: number;
  catalogue: Map<string, string>;
  /** Le parc, pour la seule section qui parle des autres — et qui est décochée par défaut. */
  parc: { clientes: number; ecrituresMediane7j: number; ecritures7j: number };
}

/** Une ligne du document : un intitulé, une valeur. Le Markdown et l'écran la rendent tous deux. */
export interface Ligne { k: string; v: string }
export interface Section {
  cle: string;
  titre: string;
  lignes: Ligne[];
  /**
   * Une section obligatoire n'a pas de bascule : un rapport sans le nom de la
   * cliente ni sa formule ne serait pas un rapport plus court, il serait faux.
   */
  obligatoire?: boolean;
  /** Décochée à l'ouverture — voir `comparatif`. */
  parDefautDecochee?: boolean;
  /** Pourquoi cette section coûte ce qu'elle coûte, ou pourquoi elle est décochée. */
  note?: string;
}

const actif = (m: AdminOrgUser) => m.status === 'active';

export function sectionsDuRapport(d: Dossier, mots: {
  identite: string; formule: string; depuis: string; membres: string; places: string; derniereActivite: string;
  modules: string; tousModules: string; activite: string; joursActifs: string; enregistrements: string; sites: string;
  critiques: string; support: string; enAttente: string; enTout: string; entrees: string; maturite: string;
  nomDuSignal: (s: string) => string; formuleDe: (p: string) => string; date: (iso: string | null) => string;
}): Section[] {
  const p = d.pouls;
  const modulesOuverts = d.org.modules ? d.org.modules.map((k) => d.catalogue.get(k) ?? k) : [mots.tousModules];

  return [
    {
      cle: 'identite',
      titre: mots.identite,
      obligatoire: true,
      lignes: [
        { k: mots.formule, v: mots.formuleDe(d.org.plan) },
        { k: mots.depuis, v: mots.date(d.org.createdAt) },
        { k: mots.membres, v: `${d.membres.filter(actif).length}/${d.membres.length}${d.org.seats ? ` · ${d.org.seats} ${mots.places}` : ''}` },
        { k: mots.derniereActivite, v: mots.date(d.org.lastActivityAt) },
      ],
    },
    {
      cle: 'activite',
      titre: mots.activite,
      lignes: [
        { k: mots.joursActifs, v: `${p?.activeDaysLast30 ?? 0}/30` },
        { k: mots.enregistrements, v: `${p?.records.last7Days ?? 0} / ${p?.records.last30Days ?? 0}` },
        { k: mots.sites, v: `${p?.sites.online ?? 0}/${p?.sites.total ?? 0}` },
        { k: mots.critiques, v: String(p?.events.critical7Days ?? 0) },
        { k: mots.support, v: `${d.support.filter((s) => s.status === 'pending').length} ${mots.enAttente} · ${d.support.length} ${mots.enTout}` },
        { k: mots.entrees, v: String(d.entrees30) },
      ],
    },
    {
      cle: 'maturite',
      titre: `${mots.maturite} · ${d.maturite.verts}/6`,
      lignes: d.maturite.lectures.map((l) => ({ k: `${l.ok ? '✓' : '✗'} ${mots.nomDuSignal(l.signal)}`, v: l.valeur })),
    },
    {
      cle: 'modules',
      titre: mots.modules,
      /* Le poids de cette section est le nombre de modules ouverts : il varie d'une cliente à l'autre, et le dos le montre. */
      lignes: modulesOuverts.map((nom) => ({ k: nom, v: '' })),
    },
    {
      cle: 'membres',
      titre: mots.membres,
      lignes: d.membres.map((m) => ({ k: m.email, v: m.status })),
      note: 'Une ligne par compte : c’est la section dont le poids dépend le plus de la cliente.',
    },
    {
      cle: 'support',
      titre: mots.support,
      lignes: d.support.slice(0, 40).map((s) => ({ k: mots.date(s.createdAt), v: s.status })),
      note: 'Les quarante derniers échanges au plus : au-delà, ce n’est plus un rapport, c’est un export.',
    },
    {
      cle: 'comparatif',
      titre: 'Position dans le parc',
      parDefautDecochee: true,
      /* Aucune autre cliente n'est nommée : seules des positions, jamais des noms. */
      lignes: [
        { k: 'Clientes comparées', v: String(d.parc.clientes) },
        { k: 'Écritures sur sept jours · médiane du parc', v: String(d.parc.ecrituresMediane7j) },
        { k: 'Écritures sur sept jours · cette cliente', v: String(d.parc.ecritures7j) },
      ],
      note: 'Décochée par défaut : elle parle des autres clientes, jamais de celle qui lit.',
    },
  ];
}

/** Le Markdown se compose du même tableau : un seul endroit décide de ce que contient le rapport. */
export function markdownDuRapport(nom: string, sections: Section[], choisies: Set<string>): string {
  const lignes: string[] = [`# ${nom}`, ''];
  for (const s of sections) {
    if (!s.obligatoire && !choisies.has(s.cle)) continue;
    lignes.push(`## ${s.titre}`);
    for (const l of s.lignes) lignes.push(l.v ? `- ${l.k} : ${l.v}` : `- ${l.k}`);
    lignes.push('');
  }
  return lignes.join('\n');
}
