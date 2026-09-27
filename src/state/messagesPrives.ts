import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useCollection } from './SyncContext';

/**
 * LES MESSAGES PRIVÉS NON LUS — ce qui manquait pour qu'un mot reçu se voie.
 *
 * Un message privé n'avait qu'un seul signal : une notification du système,
 * que Windows range sans bruit dès que « Concentration » est active, et qu'un
 * navigateur refuse tant qu'on n'a pas dit oui. Rien dans l'application : pas
 * de pastille, pas de son, pas de toast — et dans un bureau (Studio, Cyber…),
 * même pas de cloche. Le message était stocké, silencieusement.
 *
 * Ici : ce qui a été lu, fil par fil (« lu jusqu'à » par correspondant·e),
 * gardé sur ce poste. Un fil est lu quand on l'a sous les yeux dans Messages
 * privés. Au tout premier usage, l'historique compte comme lu : la pastille
 * ne s'ouvre pas sur cinquante vieux messages.
 */

interface DmLike {
  id: string;
  from: string;
  to: string;
  body?: string;
  createdAt?: string;
}

interface Lus {
  depuis: string;
  fils: Record<string, string>;
}

const EVENEMENT = 'amn:dm-lus';
const cle = (moi: string) => `amn.dm.lus.${moi}`;

function lire(moi: string): Lus {
  try {
    const brut = localStorage.getItem(cle(moi));
    if (brut) {
      const v = JSON.parse(brut) as Partial<Lus>;
      if (v && typeof v.depuis === 'string') return { depuis: v.depuis, fils: v.fils ?? {} };
    }
  } catch {
    /* stockage indisponible : on repart d'aujourd'hui */
  }
  const neuf = { depuis: new Date().toISOString(), fils: {} };
  ecrire(moi, neuf);
  return neuf;
}

function ecrire(moi: string, v: Lus) {
  try {
    localStorage.setItem(cle(moi), JSON.stringify(v));
  } catch {
    /* stockage indisponible : la pastille vivra le temps de la session */
  }
}

/** Le fil avec `autre` est lu jusqu'à `jusqua` (la date du dernier message affiché). */
export function marquerFilLu(moi: string, autre: string, jusqua: string) {
  if (!moi || !autre || !jusqua) return;
  const v = lire(moi);
  if ((v.fils[autre] ?? '') >= jusqua) return;
  v.fils[autre] = jusqua;
  ecrire(moi, v);
  window.dispatchEvent(new CustomEvent(EVENEMENT));
}

/** Un message m'est adressé, et il est plus récent que ce que j'ai lu de ce fil. */
export function estNonLu(m: DmLike, moi: string, lus: Lus): boolean {
  if (!moi || m.to !== moi || m.from === moi) return false;
  const quand = m.createdAt ?? '';
  return quand > lus.depuis && quand > (lus.fils[m.from] ?? '');
}

export function useMessagesPrivesNonLus(): { total: number; dernier: DmLike | null; parCorrespondant: Map<string, number> } {
  const { user } = useAuth();
  const moi = user?.email ?? '';
  const dms = useCollection<DmLike>('dms');
  const [tic, setTic] = useState(0);
  useEffect(() => {
    const rafraichir = () => setTic((n) => n + 1);
    window.addEventListener(EVENEMENT, rafraichir);
    window.addEventListener('storage', rafraichir);
    return () => {
      window.removeEventListener(EVENEMENT, rafraichir);
      window.removeEventListener('storage', rafraichir);
    };
  }, []);
  return useMemo(() => {
    if (!moi) return { total: 0, dernier: null, parCorrespondant: new Map() };
    const lus = lire(moi);
    const non = dms.filter((m) => estNonLu(m, moi, lus)).sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
    const par = new Map<string, number>();
    for (const m of non) par.set(m.from, (par.get(m.from) ?? 0) + 1);
    return { total: non.length, dernier: non[non.length - 1] ?? null, parCorrespondant: par };
    // `tic` : relire le stockage quand un fil vient d'être lu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dms, moi, tic]);
}

/**
 * Un carillon court, deux notes, fabriqué sur place (aucun fichier son à livrer). Un navigateur peut le
 * refuser tant que la page n'a reçu aucun geste : l'échec est silencieux, le toast et la pastille restent.
 */
export function jouerCarillon() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t0 = ctx.currentTime;
    for (const [i, freq] of [880, 1320].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const debut = t0 + i * 0.14;
      gain.gain.setValueAtTime(0.0001, debut);
      gain.gain.exponentialRampToValueAtTime(0.18, debut + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, debut + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(debut);
      osc.stop(debut + 0.35);
    }
    window.setTimeout(() => void ctx.close().catch(() => {}), 800);
  } catch {
    /* pas de son possible : le reste du signal suffit */
  }
}
