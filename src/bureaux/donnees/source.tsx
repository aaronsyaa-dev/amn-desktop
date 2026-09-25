import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { bridge } from '../../lib/bridge';
import { garde } from '../../lib/garde';
import type { AdminOrganization, FleetIncident, ModuleRequestForOperator, RemoteSite, SslStatus, SupportRequestForOperator } from '../../shared/api';
import type { GardeAccueil, GardeSalle } from '../../shared/garde';

/**
 * LA SOURCE DES BUREAUX — une seule lecture du serveur pour cinq pièces.
 *
 * La palette, les coquilles (leurs compteurs), les sas (la ligne ambre du
 * carton) et les accueils disent tous la même chose du parc : il ne faut
 * donc qu'une source. Recoupée d'un écran à l'autre, elle permet de vérifier
 * que les écrans lisent bien la même chose — c'est la consigne du paquet
 * (« le critique d'AMN DevSec arrive à 09:05, Harun le prend à 09:12 »).
 *
 * Paresseuse : rien n'est demandé tant qu'aucun bureau n'est ouvert, que la
 * palette n'a pas été appelée, ou que le poste n'a pas eu quelques secondes
 * de calme après son ouverture (voir `useActiverSourceBureaux`).
 */

export interface SourceBureaux {
  pret: boolean;
  /** Les sources qui n'ont pas répondu au dernier relevé — dites, jamais tues. */
  pannes: string[];
  at: string | null;
  /**
   * L'heure du dernier relevé réussi de chaque source. Une source qui ne
   * répond plus garde ses dernières données (l'écran les montre atténuées) ;
   * c'est cette heure-là qu'il date, pas celle du relevé manqué.
   */
  reussites: Record<string, string>;
  organisations: AdminOrganization[];
  accueil: GardeAccueil | null;
  salle: GardeSalle | null;
  supports: SupportRequestForOperator[];
  modulesDemandes: ModuleRequestForOperator[];
  /** Les incidents ouverts du parc, toutes gravités (au plus 2 000). */
  incidents: FleetIncident[];
  ssl: SslStatus[];
  /** Les sites suivis, et la cliente à qui chacun est rattaché (`clientOrgId`). */
  sites: RemoteSite[];
  recharger: () => Promise<void>;
  /** Un écran ou la palette signale qu'il a besoin des données. */
  activer: () => void;
}

const vide: Omit<SourceBureaux, 'recharger' | 'activer'> = {
  pret: false,
  pannes: [],
  at: null,
  reussites: {},
  organisations: [],
  accueil: null,
  salle: null,
  supports: [],
  modulesDemandes: [],
  incidents: [],
  ssl: [],
  sites: [],
};

const Ctx = createContext<SourceBureaux | null>(null);

const TRAMES_GARDE = ['garde:remontee', 'garde:remontee-decidee', 'garde:remontee-resolue', 'garde:releve', 'garde:ronde', 'garde:prise', 'garde:presence'];

async function tousLesIncidentsOuverts(): Promise<FleetIncident[]> {
  const admin = bridge().remote.admin;
  const r: FleetIncident[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 10; page += 1) {
    const p = await admin.incidentsQueue({ status: 'open', cursor, limit: 200 });
    r.push(...p.incidents);
    if (!p.nextCursor) break;
    cursor = p.nextCursor;
  }
  return r;
}

export function SourceBureauxProvider({ actif, children }: { actif: boolean; children: React.ReactNode }) {
  const [etat, setEtat] = useState(vide);
  const dernier = useRef(vide);
  const [demande, setDemande] = useState(false);
  const enCours = useRef(false);
  const engage = actif || demande;

  const recharger = useCallback(async () => {
    if (enCours.current) return;
    enCours.current = true;
    try {
      const r = bridge().remote;
      const [organisations, accueil, salle, supports, modules, incidents, ssl, sites] = await Promise.allSettled([
        r.admin.listOrganizations(),
        garde.accueil(),
        garde.salle(),
        r.admin.supportRequests('pending'),
        r.admin.moduleRequests('pending'),
        tousLesIncidentsOuverts(),
        r.listSslStatus(),
        r.listSites(),
      ]);
      const pannes: string[] = [];
      const maintenant = new Date().toISOString();
      const reussites: Record<string, string> = { ...dernier.current.reussites };
      // Une source muette garde ses dernières données : le dernier état connu, que l'écran date.
      const val = <T,>(p: PromiseSettledResult<T>, d: T, nom: string): T => {
        if (p.status === 'fulfilled') {
          reussites[nom] = maintenant;
          return p.value;
        }
        pannes.push(nom);
        return d;
      };
      const avant = dernier.current;
      const orgs = val(organisations, avant.organisations, 'organisations');
      const lesSites = val(sites, avant.sites, 'les sites');
      const parSite = sitesParId(lesSites);
      const noms = new Map(orgs.map((o) => [o.id, o.name]));
      const suivant = {
        pret: true,
        pannes,
        at: maintenant,
        reussites,
        organisations: orgs,
        accueil: val(accueil, avant.accueil, 'la Garde'),
        salle: val(salle, avant.salle, 'la Salle'),
        supports: val(supports, avant.supports, 'les demandes'),
        modulesDemandes: val(modules, avant.modulesDemandes, 'les demandes de modules'),
        // Rangés chez la cliente du site, une fois pour toutes les pièces.
        incidents: incidents.status === 'fulfilled'
          ? val(incidents, [] as FleetIncident[], 'les incidents').map((i) => {
              const c = cliente(i, parSite);
              return c === i.orgId ? i : { ...i, orgId: c, orgName: noms.get(c) ?? i.orgName };
            })
          : val(incidents, avant.incidents, 'les incidents'),
        ssl: val(ssl, avant.ssl, 'les certificats'),
        sites: lesSites,
      };
      dernier.current = suivant;
      setEtat(suivant);
    } finally {
      enCours.current = false;
    }
  }, []);

  useEffect(() => {
    if (!engage) return;
    void recharger();
    const t = setInterval(() => void recharger(), 60_000);
    let attente: ReturnType<typeof setTimeout> | null = null;
    const bientot = () => {
      if (attente) clearTimeout(attente);
      attente = setTimeout(() => void recharger(), 1500);
    };
    const offGarde = garde.onGarde((trame) => {
      if (TRAMES_GARDE.includes(trame.type)) bientot();
    });
    const r = bridge().remote;
    const offOrg = r.onOrgChanged?.(() => bientot());
    const offDemande = r.onSupportRequest?.(() => bientot());
    return () => {
      clearInterval(t);
      if (attente) clearTimeout(attente);
      offGarde();
      offOrg?.();
      offDemande?.();
    };
  }, [engage, recharger]);

  const activer = useCallback(() => setDemande(true), []);
  const value = useMemo(() => ({ ...etat, recharger, activer }), [etat, recharger, activer]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Les données des bureaux, telles qu'elles sont. Lire ne réveille pas la
 * source : c'est la coquille d'un bureau qui l'engage (`actif`), la palette
 * quand elle s'ouvre, ou le poste de travail après quelques secondes de
 * calme — pour que le carton du premier sas ait déjà sa ligne ambre.
 */
export function useSourceBureaux(): SourceBureaux {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSourceBureaux hors de SourceBureauxProvider');
  return ctx;
}

/** Engage la source (idempotent). */
export function useActiverSourceBureaux(delaiMs = 0) {
  const { activer } = useSourceBureaux();
  useEffect(() => {
    if (!delaiMs) {
      activer();
      return;
    }
    const t = setTimeout(activer, delaiMs);
    return () => clearTimeout(t);
  }, [activer, delaiMs]);
}

/**
 * La cliente d'un incident. Un site qu'AMN DevSec surveille POUR une cliente
 * reste à AMN DevSec (sa clé, ses événements) : l'incident porte donc l'id
 * d'AMN DevSec. Son rattachement (`clientOrgId`) dit chez qui ranger le
 * travail — c'est lui qui compte ici, sinon le parc entier semblerait
 * tomber chez nous.
 */
export function cliente(i: { orgId: string; siteId: string }, sites: Map<string, RemoteSite>): string {
  return sites.get(i.siteId)?.clientOrgId || i.orgId;
}

export function sitesParId(sites: RemoteSite[]): Map<string, RemoteSite> {
  return new Map(sites.map((s) => [s.id, s]));
}
