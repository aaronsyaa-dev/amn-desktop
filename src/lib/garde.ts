/**
 * LE CLIENT DE LA GARDE, côté poste : un appel typé par chemin, et les trames.
 *
 * Tout passe par `bridge().remote.garde.appel` (Electron : IPC vers le
 * processus principal ; web : fetch), toujours au nom d'AMN DevSec. Les
 * écrans de l'espace « La Garde » ne connaissent que ceci.
 */
import { bridge } from './bridge';
import type { GardeTrame } from '../shared/api';
import type { GardeExceptions, GardeCompte, GardeContexte, GardeJeton, GardeJetonEmis, GardeAccueil, GardeDossier, GardeGuideEntree, GardeMandat, GardePileDossiers, GardeAgent, GardeBureau, GardeCalendrierItem, GardeDefinitionAgent, GardeJournalEntree, GardeMessage, GardeOrdreReponse, GardePouls, GardeProposition, GardeReleve, GardeRemontee, GardeRonde, GardeSalle } from '../shared/garde';

const g = () => bridge().remote.garde;
const appel = <T,>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: unknown) => g().appel<T>({ path, method, ...(body !== undefined ? { body } : {}) });
const q = (params: Record<string, string | number | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const garde = {
  salle: () => appel<GardeSalle>('/salle'),
  pouls: async () => (await appel<{ pouls: GardePouls }>('/pouls')).pouls,
  calendrier: async (jours = 7) => (await appel<{ calendrier: GardeCalendrierItem[] }>(`/calendrier${q({ jours })}`)).calendrier,
  agent: (key: string) => appel<{ agent: GardeAgent; definition: (Pick<GardeDefinitionAgent, 'role' | 'prises' | 'regles'>) | null; rondes: GardeRonde[]; journal: GardeJournalEntree[] }>(`/agents/${encodeURIComponent(key)}`),
  majAgent: async (key: string, patch: Partial<Pick<GardeAgent, 'actif' | 'everyMs' | 'parametres' | 'geleOrgs' | 'couloir'>>) => (await appel<{ agent: GardeAgent }>(`/agents/${encodeURIComponent(key)}`, 'PUT', patch)).agent,
  ronde: (key: string) => appel<{ ronde: { rondeId: string; resume: string; erreur: string | null; dureeMs: number } | null }>(`/agents/${encodeURIComponent(key)}/ronde`, 'POST', {}),
  journal: async (params: { action?: string; agent?: string; equipe?: string; org?: string; ressource?: string; since?: string; limit?: number; mauvais?: '1' } = {}) => (await appel<{ journal: GardeJournalEntree[] }>(`/journal${q(params)}`)).journal,
  mauvais: (id: string, note: string) => appel<{ entree: GardeJournalEntree; correction: { type: string; texte: string } }>(`/journal/${encodeURIComponent(id)}/mauvais`, 'POST', { note }),
  remontees: (etat: 'ouverte' | 'decidee' | 'resolue' | 'ignoree' | 'toutes' = 'ouverte', params: { equipe?: string; org?: string; limit?: number } = {}) => appel<{ remontees: GardeRemontee[]; compte: GardePouls['compte'] }>(`/remontees${q({ etat, ...params })}`),
  decider: async (id: string, decision: string) => (await appel<{ remontee: GardeRemontee }>(`/remontees/${encodeURIComponent(id)}/decision`, 'POST', { decision })).remontee,
  messages: async (params: { canal?: string; agent?: string; nonLus?: '1'; limit?: number } = {}) => (await appel<{ messages: GardeMessage[] }>(`/messages${q(params)}`)).messages,
  lu: (id: string) => appel<{ ok: boolean }>(`/messages/${encodeURIComponent(id)}/lu`, 'POST', {}),
  ordre: (texte: string, confirmer = false, cible = 'capitaine', contexte?: GardeContexte) => appel<GardeOrdreReponse>('/ordres', 'POST', { texte, confirmer, cible, ...(contexte ? { contexte } : {}) }),
  bureau: (equipe: string) => appel<GardeBureau>(`/bureau/${encodeURIComponent(equipe)}`),
  question: (equipe: string, texte: string, confirmer = false) => appel<GardeOrdreReponse>(`/bureau/${encodeURIComponent(equipe)}/question`, 'POST', { texte, confirmer }),
  commune: (texte: string, confirmer = false) => appel<GardeOrdreReponse>('/commune', 'POST', { texte, confirmer }),
  absence: (dureeMs: number | null, mandat: Record<string, unknown> = {}) => appel<{ etat: unknown; texte: string }>('/absence', 'POST', { dureeMs, mandat }),
  retour: () => appel<{ texte: string }>('/retour', 'POST', {}),
  tour: async () => (await appel<{ releve: GardeReleve }>('/tour', 'POST', {})).releve,
  propositions: async (etat = 'proposee') => (await appel<{ propositions: GardeProposition[] }>(`/propositions${q({ etat })}`)).propositions,
  deciderProposition: async (id: string, etat: 'acceptee' | 'refusee', couloir: { min: number; max: number } | null = null) => (await appel<{ proposition: GardeProposition }>(`/propositions/${encodeURIComponent(id)}`, 'POST', { etat, couloir })).proposition,
  /**
   * « ET SI ? » — le mois écoulé rejoué avec un paramètre changé.
   *
   * `avant` et `apres` sont deux TOTAUX sur la même fenêtre de trente jours :
   * c'est tout ce que `regle.rejouer()` sait produire côté serveur aujourd'hui.
   * `serieAvant` / `serieApres` — trente valeurs, un jour chacune — permettent
   * de tracer le calque dans le temps ; elles n'arrivent que d'un serveur qui
   * sait les compter. Facultatives, donc, et l'écran s'en passe sans mentir.
   */
  etSi: async (agent: string, regle: string, parametre: string, valeur: number) => (await appel<{ etsi: { avant: number | null; apres: number | null; actuelle?: number; phrase?: string; note?: string; serieAvant?: number[]; serieApres?: number[] } }>(`/etsi${q({ agent, regle, parametre, valeur })}`)).etsi,
  reglages: async (patch: { heureTour?: number; silence?: { de: number; a: number }; budgetParoles?: number }) => (await appel<{ reglages: { heureTour: number; silence?: { de: number; a: number }; budgetParoles?: number } }>('/reglages', 'PUT', patch)).reglages,
  // Bloc 4 — Ajmani, chef d'état-major.
  accueil: () => appel<GardeAccueil>('/ajmani'),
  pile: (limit = 50) => appel<GardePileDossiers>(`/pile${q({ limit })}`),
  prendre: (id: string, prendre = true) => appel<{ pris: boolean; prisPar: string | null }>(`/pile/${encodeURIComponent(id)}/prise`, 'POST', { prendre }),
  deciderDossier: (id: string, decision: string) => appel<{ n: number; decision: string }>(`/pile/${encodeURIComponent(id)}/decision`, 'POST', { decision }),
  guide: async () => (await appel<{ guide: GardeGuideEntree[]; version: string; familles: Record<string, { un: string; des: string }> }>('/lexique')),
  mandat: async () => (await appel<{ mandat: GardeMandat }>('/ajmani/mandat')).mandat,
  donnerMandat: (input: { agent: string; famille: string; decision: string }) => appel<{ mandat: GardeMandat; appliquees: number }>('/ajmani/mandat', 'POST', input),
  // Bloc 7 — les exceptions d'abord.
  exceptions: () => appel<GardeExceptions>('/exceptions'),
  // Bloc 5 — la Garde des Comptes et le site.
  jetons: async (etat?: GardeJeton['etat']) => (await appel<{ jetons: GardeJeton[] }>(`/jetons${q({ etat })}`)).jetons,
  emettreJeton: (input: { module?: string; formule?: string; places?: number; expiresInDays?: number; note?: string }) => appel<GardeJetonEmis>('/jetons', 'POST', input),
  revoquerJeton: (id: string) => appel<{ revoque: boolean }>(`/jetons/${encodeURIComponent(id)}`, 'DELETE'),
  comptes: async (etat?: GardeCompte['etat']) => (await appel<{ comptes: GardeCompte[] }>(`/comptes${q({ etat })}`)).comptes,
  paiement: (orgId: string, etat: 'paye' | 'impaye', extra: { echeanceAt?: string; note?: string } = {}) => appel<{ compte: GardeCompte; texte: string; error?: string }>(`/comptes/${encodeURIComponent(orgId)}/paiement`, 'POST', { etat, ...extra }),
  retirerMandat: (cle: string) => appel<{ mandat: GardeMandat; retire: boolean }>(`/ajmani/mandat/${encodeURIComponent(cle)}`, 'DELETE'),
  onGarde: (callback: (trame: GardeTrame) => void): (() => void) => g().onGarde?.(callback) ?? (() => undefined),
};

export const EQUIPES_ORDRE = ['sites', 'securite', 'comptes', 'registre', 'clientes', 'produit', 'taches', 'memoire'] as const;

/**
 * LE RETARD TOLÉRÉ — la formule du Capitaine, recopiée à l'identique.
 *
 * `amn-api/src/garde/capitaine.js` décide ceci : `Math.max(3 * everyMs,
 * 15 min)`. Au-delà, le Capitaine ouvre lui-même une remontée HAUTE
 * `garde-retard:<clé>` — la Garde surveille la Garde.
 *
 * La Salle doit trancher EXACTEMENT comme lui. Une Salle qui dirait « en
 * retard » là où le Capitaine n'a rien ouvert — ou l'inverse — ferait douter
 * des deux, et c'est le mur qu'on regarde en premier la nuit. Si la règle
 * change côté serveur, elle change ici, et les deux phrases restent la même.
 */
export const retardTolereMs = (everyMs: number) => Math.max(3 * everyMs, 15 * 60_000);

/** Le retard d'une garde en millisecondes, ou `null` si sa ronde tient encore l'heure. */
export function retardDeRonde(agent: GardeAgent, now: number = Date.now()): number | null {
  if (!agent.actif || !agent.prochaineRondeAt) return null;
  const retard = now - Date.parse(agent.prochaineRondeAt);
  return retard > retardTolereMs(agent.everyMs) ? retard : null;
}

/**
 * LE SILENCE DE NUIT, par défaut — la valeur du produit, pas une invention d'écran.
 * `amn-api/src/garde/ajmani.js` : `SILENCE_DEFAUT = { de: 22, a: 7 }`. Tant que
 * personne ne l'a réglé, `reglages.silence` est absent de `/salle` ; afficher un
 * tiret laisserait croire qu'il n'y a pas de silence, ce qui est faux.
 */
export const SILENCE_DEFAUT = { de: 22, a: 7 } as const;

/** « Garde des Sites » → « Sites ». La colonne d'un mur de sept n'a pas la place de répéter sept fois le mot « Garde ». */
export const domaineDEquipe = (nom: string) => nom.replace(/^garde\s+(?:de\s+l[’']|de\s+la\s+|des\s+|du\s+|de\s+)/i, '');

/**
 * `securite.escalade` → « Escalade ». Le journal, la pile et les collaborations
 * nomment les gardes par leur CLÉ ; une clé technique dans une phrase française
 * ne dit rien à qui la lit, et l'écran a déjà le nom du mur juste à côté.
 */
export const nomDeCleDeGarde = (cle: string) => {
  const dernier = cle.split('.').pop() ?? cle;
  const mots = dernier.replace(/-/g, ' ');
  return mots.charAt(0).toUpperCase() + mots.slice(1);
};

/**
 * « de AMN DevSec » ne s'écrit pas : l'élision est obligatoire devant une
 * voyelle ou un h muet. Le nom d'une organisation vient de la base, donc la
 * phrase qui le porte ne peut pas figer sa préposition dans le dictionnaire.
 */
export const deOrganisation = (nom: string) => (/^[aeiouyàâäéèêëîïôöùûü]/i.test(nom.trim()) ? `d’${nom}` : `de ${nom}`);

/**
 * `seuilMinutes` → « seuil minutes ». Le nom d'un paramètre de règle vient du
 * serveur, en une seule pièce ; imprimé tel quel dans une phrase française il
 * se lit SEUILMINUTES, qui n'est pas un mot. On sépare les mots, sans rien
 * traduire : inventer un libellé ferait diverger l'écran de la règle.
 */
export const motDeParametre = (nom: string) => nom.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
