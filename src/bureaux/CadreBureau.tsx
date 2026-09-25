import React, { useEffect, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import './bureaux.css';
import { espace as espaceDe, type BureauKey } from './jetons';
import { ongletDuChemin } from './catalogue';
import { useReglagesBureaux } from './ambiance';
import { BarreHaute } from './ui/BarreHaute';
import { BarreEtatCyber, ConsoleColonne, Dock, OrganigrammeNav, Portes, Pupitre, SousOnglets } from './coquilles';
import { EnTeteCtx, type EnTeteContexte } from '../components/EnTeteContexte';
import { cederPaletteCommandes } from '../components/command-palette/CommandPalette';
import { useActiverSourceBureaux, useSourceBureaux } from './donnees/source';
import { jourDe, useEcrireReleveDuJour } from './donnees/releves';
import { useAuth } from '../auth/AuthContext';
import { useCollection, useSync } from '../state/SyncContext';
import { useSupervisor } from './donnees/useSupervisor';
import { useCyber } from './donnees/cyber';
import { useExecuterRegles } from './donnees/executerRegles';
import { NavAllegesSync } from '../components/NavAllegesSync';
import { PremiereOuverture } from '../components/PremiereOuverture';
import { BureauCtx } from './ui/kit';
import { NAV_ITEMS } from '../data/navigation';

/**
 * LE CADRE D'UN BUREAU — la barre haute commune, la coquille du bureau, et
 * la pièce où l'écran se pose (cahier 11 §4, cahier 16).
 *
 * Un écran ne sait pas dans quel bureau il est monté : les vingt-trois
 * modules recousus gardent leurs instruments, leurs actions et leur ligne
 * d'état ; le cadre leur impose seulement sa tête (typographie, surtitre) par
 * `EnTeteCtx`, et ses marges.
 */

/** La tête de chaque bureau (cahier 11 §1) et ses marges de contenu (`shell()`). */
const TETES: Record<BureauKey, { titre: string; marges: string }> = {
  supervisor: { titre: 'font-sans text-[36px] font-bold leading-[1.08] tracking-[-0.03em] text-[#f7f7f5] text-balance', marges: '28px 28px 32px' },
  cyber: { titre: 'font-mono text-[24px] font-semibold leading-[1.08] tracking-[-0.01em] text-[#f7f7f5] text-balance', marges: '24px 24px 28px' },
  studio: { titre: 'font-sans text-[38px] font-bold leading-[1.08] tracking-[-0.03em] text-[#f7f7f5] text-balance', marges: '32px 32px 36px' },
  strategie: { titre: 'font-sans text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] text-[#f7f7f5] text-balance', marges: '28px 28px 32px' },
  garde: { titre: 'font-sans text-[36px] font-bold leading-[1.08] tracking-[-0.03em] text-[#f7f7f5] text-balance', marges: '28px 28px 32px' },
};

/** Les anciens noms de pièce (cahier 4) que le surtitre d'un écran recousu ne doit plus dire. */
const ANCIENS_LIEUX = ['Tour de contrôle', 'La Tour', 'Tour', 'Parc', 'Produits', 'Collectif', 'Supervision interne', 'Espace La Garde'];

export function CadreBureau({ bureau }: { bureau: BureauKey }) {
  const e = espaceDe(bureau);
  const { pathname } = useLocation();
  const { ambiance, reduit } = useReglagesBureaux();
  useActiverSourceBureaux();
  useReleveDuJour();
  useExecuterRegles();
  useReleveLue(bureau);

  useEffect(() => {
    cederPaletteCommandes(true);
    return () => cederPaletteCommandes(false);
  }, []);

  const onglet = ongletDuChemin(bureau, pathname);
  const tete = TETES[bureau];
  const ctx = useMemo<EnTeteContexte>(() => {
    const nomOnglet = onglet?.onglet.nom ?? '';
    return {
      prefixe: [e.nom.toUpperCase(), nomOnglet.toUpperCase()].filter(Boolean).join(' · '),
      redites: [e.nom, nomOnglet, onglet?.ecran.nom ?? '', ...ANCIENS_LIEUX].filter(Boolean),
      classeTitre: tete.titre,
      sansTeinte: true,
    };
  }, [e.nom, onglet?.onglet.nom, onglet?.ecran.nom, tete.titre]);

  return (
    <div
      data-espace-racine
      data-bureau={bureau}
      data-ambiance={ambiance && !reduit ? 'active' : 'coupee'}
      className="bx flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <BarreHaute bureau={bureau} />
      {bureau === 'supervisor' && <Pupitre />}
      {bureau === 'studio' && <Portes />}
      {bureau === 'garde' && <OrganigrammeNav />}
      <div className="flex min-h-0 flex-1">
        {bureau === 'cyber' && <ConsoleColonne />}
        <div className="flex min-w-0 flex-1 flex-col">
          <SousOnglets bureau={bureau} />
          <main
            className={`relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-none ${bureau === 'strategie' ? 'bx-trame' : ''}`}
            style={{ padding: tete.marges }}
            data-bureau-contenu={bureau}
          >
            <BureauCtx.Provider value={bureau}>
              <EnTeteCtx.Provider value={ctx}>
                <NavAllegesSync />
                {/* La présentation d'un module recousu, jamais celle d'un écran de bureau qui partage son préfixe. */}
                {NAV_ITEMS.some((i) => i.to === pathname) && <PremiereOuverture />}
                <Outlet />
              </EnTeteCtx.Provider>
            </BureauCtx.Provider>
          </main>
        </div>
      </div>
      {bureau === 'cyber' && <BarreEtatCyber />}
      {bureau === 'strategie' && <Dock />}
    </div>
  );
}

/**
 * Le relevé du jour : poids, points et score de chaque organisation, écrit
 * une fois par jour par le premier bureau ouvert — la mémoire des tendances.
 */
/**
 * L'habitude « relève lue avant 9 h » (tracker de l'équipe, `51b`) : la
 * première ouverture d'un écran de la Garde, un jour de semaine, après
 * l'heure de la relève, est notée une fois (`suivis`, `releve-lue:<jour>`).
 */
function useReleveLue(bureau: BureauKey) {
  const { user } = useAuth();
  const { upsert, ready } = useSync();
  const suivis = useCollection<{ at?: string }>('suivis');
  const src = useSourceBureaux();
  const heureReleve = src.salle?.reglages?.heureTour ?? 7;
  const jour = jourDe(Date.now());
  const deja = suivis.some((s) => s.id === `releve-lue:${jour}`);
  useEffect(() => {
    if (bureau !== 'garde' || !ready || deja || !user?.email) return;
    const d = new Date();
    if (d.getDay() === 0 || d.getDay() === 6 || d.getHours() < heureReleve) return;
    void upsert('suivis', `releve-lue:${jour}`, { par: user.email, at: d.toISOString() });
  }, [bureau, ready, deja, user?.email, heureReleve, jour, upsert]);
}

function useReleveDuJour() {
  const sup = useSupervisor();
  const cyber = useCyber();
  const objectifs = useCollection<{ currentValue?: number; targetValue?: number }>('objectives');
  const pret = sup.pret && cyber.pret && sup.orgs.length > 0;
  useEcrireReleveDuJour(pret, () => {
    const scores = new Map(cyber.orgs.map((o) => [o.id, o.score]));
    const panne = new Set(cyber.incidents.filter((g) => g.incidents.some((i) => i.kinds.some((k) => k === 'site_unreachable' || k === 'availability_down'))).map((g) => g.orgId));
    const orgs: Record<string, { poids: number; points: Record<string, number>; score?: number | null; suivi?: string; enPanne?: boolean; silenceJ?: number | null; actif?: boolean }> = {};
    for (const o of sup.orgs) {
      const derniere = o.org.lastActivityAt ? Date.parse(o.org.lastActivityAt) : null;
      orgs[o.id] = {
        poids: o.poids,
        points: o.points,
        score: scores.get(o.id) ?? null,
        // « personne », « garde », « rien » — ou l'adresse de qui suit : les règles relisent ce champ.
        suivi: o.suivi.type === 'humain' ? o.suivi.email : o.suivi.type,
        enPanne: panne.has(o.id),
        silenceJ: derniere === null ? null : Math.floor((Date.now() - derniere) / 86_400_000),
        actif: o.statut !== 'suspended',
      };
    }
    return orgs;
  }, () => (objectifs.length ? { objectifs: { atteints: objectifs.filter((o) => (o.currentValue ?? 0) >= (o.targetValue ?? Infinity)).length, total: objectifs.length } } : undefined));
}
