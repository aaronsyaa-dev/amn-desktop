import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { bridge } from '../lib/bridge';
import { useAuth } from '../auth/AuthContext';
import { useSync } from './SyncContext';
import type { RegardModule } from '../shared/api';

/**
 * LA PRÉSENCE SUR LES MODULES (cahier 15, `51a`) — un composant, deux éditions.
 *
 * Ce poste annonce le module qu'il a ouvert ; il reçoit ceux des autres
 * membres de SON organisation (le serveur n'en diffuse pas d'autres, et
 * jamais une session d'assistance : amn-api/src/ws/hub.js).
 *
 * « Vient de partir » : quand une personne ferme le module, sa pastille reste
 * une minute, à 40 %, cerclée de gris, puis disparaît. Ce n'est pas le
 * serveur qui s'en souvient : il ne connaît que l'instant ; la minute de
 * grâce est une affaire d'affichage, tenue ici.
 *
 * Le réglage « Montrer ma présence aux autres » est réciproque : coupé, ce
 * poste n'annonce plus rien ET ne montre plus personne.
 */

export interface Regard extends RegardModule {
  /** Parti depuis moins d'une minute : la pastille s'estompe. */
  parti: boolean;
  /** ISO — quand il est parti, le cas échéant. */
  partiA?: string;
}

const MINUTE_DE_GRACE = 60_000;
const EVENEMENT = 'amn:presence-reglage';

const cleReglage = (email: string) => `amn.presence.${email.trim().toLowerCase()}`;

export function presenceMontree(email: string | null | undefined): boolean {
  if (!email) return true;
  try {
    return window.localStorage.getItem(cleReglage(email)) !== 'coupee';
  } catch {
    return true;
  }
}

export function poserPresenceMontree(email: string, montree: boolean) {
  try {
    window.localStorage.setItem(cleReglage(email), montree ? 'montree' : 'coupee');
  } catch {
    /* sans stockage, le réglage ne tient que le temps de la session */
  }
  window.dispatchEvent(new Event(EVENEMENT));
}

/**
 * Le « module » d'un chemin : le chemin lui-même, sans ce qui désigne une
 * fiche. Deux personnes sur deux clientes différentes sont toutes deux dans
 * Clients — c'est ce que la pastille dit (« utilise ce module aussi »).
 */
export function moduleDuChemin(chemin: string): string {
  const net = chemin.split('?')[0].replace(/\/+$/, '') || '/';
  // Les fiches et sous-écrans d'un module restent le module.
  const parts = net.split('/').filter(Boolean);
  if (parts.length <= 1) return net;
  // Deux segments de catalogue connus (`/tour/organisations`, `/garde/pile`,
  // `/personnel/budget`…) : on les garde ; au-delà, c'est une fiche.
  return `/${parts.slice(0, 2).join('/')}`;
}

/**
 * La vue ouverte, telle qu'on peut la dire à un collègue : le chemin sans ce
 * qui désigne une fiche (un segment qui porte un chiffre, ou trop long pour
 * être un nom d'écran). `/facturation/devis` reste ; `/clients/8f3a…` devient
 * `/clients`.
 */
export function vueDuChemin(chemin: string): string {
  const parts = chemin.split('?')[0].split('/').filter(Boolean).filter((s) => !/\d/.test(s) && s.length <= 24);
  return `/${parts.slice(0, 4).join('/')}`;
}

interface RegardsValue {
  montree: boolean;
  setMontree: (v: boolean) => void;
  /** Tous les regards connus des AUTRES membres, départs récents compris. */
  autres: Regard[];
}

const Ctx = createContext<RegardsValue | null>(null);

export function RegardsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const moi = user?.email?.trim().toLowerCase() ?? null;
  const { connectionStatus } = useSync();
  const location = useLocation();
  const [montree, setMontreeEtat] = useState(() => presenceMontree(moi));
  const [presents, setPresents] = useState<RegardModule[]>([]);
  const [partis, setPartis] = useState<Regard[]>([]);
  const precedents = useRef<RegardModule[]>([]);

  useEffect(() => {
    const maj = () => setMontreeEtat(presenceMontree(moi));
    maj();
    window.addEventListener(EVENEMENT, maj);
    return () => window.removeEventListener(EVENEMENT, maj);
  }, [moi]);

  const setMontree = useCallback(
    (v: boolean) => {
      if (moi) poserPresenceMontree(moi, v);
    },
    [moi],
  );

  /* L'annonce : le module courant, ou rien. Renvoyée à chaque reconnexion —
     le serveur oublie une socket fermée, et c'est voulu. */
  const module = moduleDuChemin(location.pathname);
  const vue = vueDuChemin(location.pathname);
  useEffect(() => {
    if (connectionStatus !== 'online') return;
    bridge().remote.annoncerRegard?.(montree ? module : null, montree ? vue : null);
  }, [module, vue, montree, connectionStatus]);
  useEffect(() => () => bridge().remote.annoncerRegard?.(null), []);

  /* La réception, et la minute de grâce de ceux qui viennent de partir. */
  useEffect(() => {
    const off = bridge().remote.onRegards?.((entries) => {
      const maintenant = new Date().toISOString();
      const cle = (r: RegardModule) => `${r.email}\u0000${r.module}`;
      const neufs = new Set(entries.map(cle));
      const sortis = precedents.current.filter((r) => !neufs.has(cle(r)));
      precedents.current = entries;
      setPresents(entries);
      if (sortis.length) {
        setPartis((p) => [
          ...p.filter((x) => !neufs.has(cle(x)) && !sortis.some((s) => cle(s) === cle(x))),
          ...sortis.map((s) => ({ ...s, parti: true, partiA: maintenant })),
        ]);
      } else {
        setPartis((p) => p.filter((x) => !neufs.has(cle(x))));
      }
    });
    return () => off?.();
  }, []);
  useEffect(() => {
    if (!partis.length) return;
    const t = setInterval(() => {
      const limite = Date.now() - MINUTE_DE_GRACE;
      setPartis((p) => p.filter((x) => Date.parse(x.partiA ?? '') > limite));
    }, 5_000);
    return () => clearInterval(t);
  }, [partis.length]);

  const autres = useMemo<Regard[]>(() => {
    if (!montree) return [];
    const vivants: Regard[] = presents.filter((r) => r.email !== moi).map((r) => ({ ...r, parti: false }));
    return [...vivants, ...partis.filter((r) => r.email !== moi)];
  }, [presents, partis, montree, moi]);

  const value = useMemo(() => ({ montree, setMontree, autres }), [montree, setMontree, autres]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Le contexte, ou un état neutre hors fournisseur (écrans publics, tests). */
export function useRegards(): RegardsValue {
  return useContext(Ctx) ?? { montree: false, setMontree: () => undefined, autres: [] };
}

/**
 * Les autres personnes sur CE module, la dernière arrivée d'abord : ceux qui
 * y sont, puis ceux qui viennent de partir (encore une minute).
 */
export function useRegardsSurModule(chemin: string): Regard[] {
  const { autres } = useRegards();
  const module = moduleDuChemin(chemin);
  return useMemo(
    () =>
      autres
        .filter((r) => r.module === module)
        .sort((a, b) => Number(a.parti) - Number(b.parti) || b.depuis.localeCompare(a.depuis)),
    [autres, module],
  );
}
