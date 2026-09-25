import { useEffect, useMemo, useState } from 'react';
import { useCollection } from '../../state/SyncContext';
import { useSourceBureaux } from './source';
import { fileATraiter, elementAmbre, type ElementFile } from './file';
import { orgAmbre, orgRouge, pointsDuParc, sansPersonne, trierParPoids, type OrgPoints } from './parc';
import type { DossierOrg, RegleParc, Suivi } from './types';

/**
 * LE MODÈLE DE SUPERVISOR — ce que lisent l'horizon, la grille, la file, le
 * pupitre (ses compteurs) et la palette (« 1 sans personne »). Une seule
 * dérivation, mémorisée : cinq surfaces, une vérité.
 */
export interface ModeleSupervisor {
  pret: boolean;
  pannes: string[];
  maintenant: number;
  orgs: OrgPoints[];
  tri: OrgPoints[];
  ambre: OrgPoints | null;
  rouge: OrgPoints | null;
  sansPersonne: OrgPoints[];
  file: ElementFile[];
  fileAmbre: ElementFile | null;
  dossiers: Map<string, DossierOrg>;
  groupes: Map<string, string[]>;
  regles: (RegleParc & { id: string })[];
  suivis: (Suivi & { id: string })[];
}

export function useMaintenant(pasMs = 30_000): number {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setT(Date.now()), pasMs);
    return () => clearInterval(i);
  }, [pasMs]);
  return t;
}

export function useSupervisor(): ModeleSupervisor {
  const src = useSourceBureaux();
  const suivis = useCollection<Suivi>('suivis');
  const dossiersOrg = useCollection<DossierOrg>('orgDossier');
  const regles = useCollection<RegleParc>('parcRegles');
  const maintenant = useMaintenant();

  return useMemo(() => {
    const dossiers = src.accueil?.pile.dossiers ?? [];
    const orgs = pointsDuParc({
      organisations: src.organisations,
      dossiers,
      supports: src.supports,
      modulesDemandes: src.modulesDemandes,
      incidents: src.incidents,
      suivis,
      maintenant,
    });
    const file = fileATraiter({
      organisations: src.organisations,
      dossiers,
      supports: src.supports,
      modulesDemandes: src.modulesDemandes,
      incidents: src.incidents,
      suivis,
      maintenant,
    });
    const parId = new Map(dossiersOrg.map((d) => [d.id, d as DossierOrg]));
    const groupes = new Map<string, string[]>();
    for (const o of src.organisations) {
      const g = parId.get(o.id)?.groupe?.trim();
      if (g) groupes.set(g, [...(groupes.get(g) ?? []), o.id]);
    }
    return {
      pret: src.pret,
      pannes: src.pannes,
      maintenant,
      orgs,
      tri: trierParPoids(orgs),
      ambre: orgAmbre(orgs),
      rouge: orgRouge(orgs),
      sansPersonne: trierParPoids(orgs.filter(sansPersonne)),
      file,
      fileAmbre: elementAmbre(file),
      dossiers: parId,
      groupes,
      regles: regles.filter((r) => r.sujet),
      suivis,
    };
  }, [src, suivis, dossiersOrg, regles, maintenant]);
}
