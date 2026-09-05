/**
 * LE CLIENT DE LA GARDE, côté poste : un appel typé par chemin, et les trames.
 *
 * Tout passe par `bridge().remote.garde.appel` (Electron : IPC vers le
 * processus principal ; web : fetch), toujours au nom d'AMN DevSec. Les
 * écrans de l'espace « La Garde » ne connaissent que ceci.
 */
import { bridge } from './bridge';
import type { GardeTrame } from '../shared/api';
import type { GardeAgent, GardeBureau, GardeCalendrierItem, GardeDefinitionAgent, GardeJournalEntree, GardeMessage, GardeOrdreReponse, GardePouls, GardeProposition, GardeReleve, GardeRemontee, GardeRonde, GardeSalle } from '../shared/garde';

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
  journal: async (params: { agent?: string; equipe?: string; org?: string; ressource?: string; since?: string; limit?: number; mauvais?: '1' } = {}) => (await appel<{ journal: GardeJournalEntree[] }>(`/journal${q(params)}`)).journal,
  mauvais: (id: string, note: string) => appel<{ entree: GardeJournalEntree; correction: { type: string; texte: string } }>(`/journal/${encodeURIComponent(id)}/mauvais`, 'POST', { note }),
  remontees: (etat: 'ouverte' | 'decidee' | 'resolue' | 'ignoree' | 'toutes' = 'ouverte', params: { equipe?: string; org?: string; limit?: number } = {}) => appel<{ remontees: GardeRemontee[]; compte: GardePouls['compte'] }>(`/remontees${q({ etat, ...params })}`),
  decider: async (id: string, decision: string) => (await appel<{ remontee: GardeRemontee }>(`/remontees/${encodeURIComponent(id)}/decision`, 'POST', { decision })).remontee,
  messages: async (params: { canal?: string; agent?: string; nonLus?: '1'; limit?: number } = {}) => (await appel<{ messages: GardeMessage[] }>(`/messages${q(params)}`)).messages,
  lu: (id: string) => appel<{ ok: boolean }>(`/messages/${encodeURIComponent(id)}/lu`, 'POST', {}),
  ordre: (texte: string, confirmer = false, cible = 'capitaine') => appel<GardeOrdreReponse>('/ordres', 'POST', { texte, confirmer, cible }),
  bureau: (equipe: string) => appel<GardeBureau>(`/bureau/${encodeURIComponent(equipe)}`),
  question: (equipe: string, texte: string, confirmer = false) => appel<GardeOrdreReponse>(`/bureau/${encodeURIComponent(equipe)}/question`, 'POST', { texte, confirmer }),
  commune: (texte: string, confirmer = false) => appel<GardeOrdreReponse>('/commune', 'POST', { texte, confirmer }),
  absence: (dureeMs: number | null, mandat: Record<string, unknown> = {}) => appel<{ etat: unknown; texte: string }>('/absence', 'POST', { dureeMs, mandat }),
  retour: () => appel<{ texte: string }>('/retour', 'POST', {}),
  tour: async () => (await appel<{ releve: GardeReleve }>('/tour', 'POST', {})).releve,
  propositions: async (etat = 'proposee') => (await appel<{ propositions: GardeProposition[] }>(`/propositions${q({ etat })}`)).propositions,
  deciderProposition: async (id: string, etat: 'acceptee' | 'refusee', couloir: { min: number; max: number } | null = null) => (await appel<{ proposition: GardeProposition }>(`/propositions/${encodeURIComponent(id)}`, 'POST', { etat, couloir })).proposition,
  etSi: async (agent: string, regle: string, parametre: string, valeur: number) => (await appel<{ etsi: { avant: number | null; apres: number | null; phrase?: string; note?: string } }>(`/etsi${q({ agent, regle, parametre, valeur })}`)).etsi,
  reglages: async (heureTour: number) => (await appel<{ reglages: { heureTour: number } }>('/reglages', 'PUT', { heureTour })).reglages,
  onGarde: (callback: (trame: GardeTrame) => void): (() => void) => g().onGarde?.(callback) ?? (() => undefined),
};

export const EQUIPES_ORDRE = ['sites', 'securite', 'comptes', 'registre', 'clientes', 'produit', 'taches', 'memoire'] as const;
