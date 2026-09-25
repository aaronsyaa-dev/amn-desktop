import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isElectron } from '../lib/platform';
import { ESPACES, espace as espaceDe, type BureauKey, type EspaceKey, MOUVEMENT } from './jetons';
import { bureauDuChemin, espaceDuChemin, outilNumero } from './catalogue';
import { ambianceActive, marquerEntre, mouvementReduit, premiereEntree, varianteSas } from './ambiance';
import { acheverSas, jouerSas, type ModeSas } from './sas';
import { useAttentes, type Attente } from './attentes';

/**
 * CHANGER DE PIÈCE — la navigation entre les six espaces (cahier 11, `44b`–`44d`).
 *
 * Tout passage d'un espace à un autre passe ici, quelle que soit sa porte : la
 * palette, `G` puis un chiffre, le bouton « Poste de travail », un lien dans un
 * écran (intercepté avant que le routeur ne le suive, pour que le sas ait
 * encore la pièce quittée sous les yeux). Une navigation programmée qu'on
 * n'aurait pas vue passer reçoit au moins un fondu d'entrée : aucune pièce
 * n'apparaît d'un coup.
 *
 * LES RACCOURCIS n'emploient que des touches qu'une page reçoit aussi dans un
 * navigateur : ⌘E / Ctrl E partout, `G` puis `0`–`5` (1,2 s), `1`–`9`, `?`,
 * Échap. `F1`–`F9` n'existent que dans l'application installée — dans un
 * navigateur, F1 ouvre son aide et F5 recharge la page.
 */

export interface NavEspaces {
  espace: EspaceKey;
  bureau: BureauKey | null;
  attentes: Record<EspaceKey, Attente>;
  aller: (chemin: string) => void;
  allerEspace: (e: EspaceKey) => void;
  palette: boolean;
  ouvrirPalette: () => void;
  fermerPalette: () => void;
  aide: boolean;
  ouvrirAide: () => void;
  fermerAide: () => void;
  /** `G` vient d'être frappé : la touche suivante choisit l'espace. */
  attenteG: boolean;
}

const Ctx = createContext<NavEspaces | null>(null);

const enSaisie = (el: EventTarget | null) => {
  const n = el as HTMLElement | null;
  if (!n || !n.tagName) return false;
  return n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT' || n.isContentEditable;
};

/** Le chemin d'une ancre de l'application (`#/cyber/alertes`), ou `null` pour un lien qui sort. */
function cheminDeLien(a: HTMLAnchorElement): string | null {
  const href = a.getAttribute('href');
  if (!href) return null;
  if (href.startsWith('#/')) return href.slice(1).split('?')[0];
  try {
    const u = new URL(a.href, window.location.href);
    if (u.origin !== window.location.origin || !u.hash.startsWith('#/')) return null;
    return u.hash.slice(1).split('?')[0];
  } catch {
    return null;
  }
}

export function NavigationEspacesProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const espace = espaceDuChemin(location.pathname);
  const bureau = bureauDuChemin(location.pathname);
  const attentes = useAttentes();
  const [palette, setPalette] = useState(false);
  const [aide, setAide] = useState(false);
  const [attenteG, setAttenteG] = useState(false);
  const gA = useRef(0);
  const minuterieG = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dernierSas = useRef(0);
  const espacePrecedent = useRef(espace);
  const refs = useRef({ espace, attentes, navigate });
  refs.current = { espace, attentes, navigate };

  // Ouverte directement dans une pièce (lien profond, onglet mémorisé) : on y
  // est déjà entré, la prochaine entrée n'y rejoue pas le sas complet.
  useEffect(() => {
    marquerEntre(espace);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Le mode du sas vers `vers`, selon la session, l'Ambiance et le système. */
  const modeVers = useCallback((vers: EspaceKey): ModeSas => {
    const premiere = premiereEntree(vers);
    if (!ambianceActive() || mouvementReduit()) return 'fondu';
    if (vers === 'poste') return premiere ? 'retour' : 'court';
    return premiere ? 'complet' : 'court';
  }, []);

  /** Joue le sas vers `vers` ; `naviguer` change la pièce (ou rien, si un lien s'en charge). */
  const passer = useCallback(
    (vers: EspaceKey, naviguer: () => void) => {
      const mode = modeVers(vers);
      const variante = varianteSas();
      const e = espaceDe(vers);
      dernierSas.current = Date.now();
      jouerSas({
        vers,
        mode,
        variante,
        carton: mode === 'complet' && variante === 'plongee' && vers !== 'poste' ? { nom: e.nom, role: e.role, ligne: refs.current.attentes[vers].carton, espace: vers } : null,
        naviguer,
      });
    },
    [modeVers],
  );

  const aller = useCallback(
    (chemin: string) => {
      setPalette(false);
      setAide(false);
      const vers = espaceDuChemin(chemin.split('?')[0]);
      if (vers === refs.current.espace) {
        refs.current.navigate(chemin);
        return;
      }
      passer(vers, () => refs.current.navigate(chemin));
    },
    [passer],
  );

  const allerEspace = useCallback((e: EspaceKey) => aller(espaceDe(e).accueil), [aller]);

  // Un lien d'écran vers un autre espace : le sas part AVANT que le routeur ne suive le lien.
  useEffect(() => {
    const surClic = (ev: MouseEvent) => {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const a = (ev.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const chemin = cheminDeLien(a);
      if (!chemin) return;
      const vers = espaceDuChemin(chemin);
      if (vers === refs.current.espace) return;
      setPalette(false);
      passer(vers, () => undefined);
    };
    document.addEventListener('click', surClic, true);
    return () => document.removeEventListener('click', surClic, true);
  }, [passer]);

  // Une navigation programmée d'un espace à l'autre, sans sas : un fondu d'entrée.
  useLayoutEffect(() => {
    if (espacePrecedent.current === espace) return;
    espacePrecedent.current = espace;
    marquerEntre(espace);
    if (Date.now() - dernierSas.current < 400) return;
    const racine = document.querySelector<HTMLElement>('[data-espace-racine]');
    racine?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: MOUVEMENT.fondu, easing: 'linear' });
  }, [espace]);

  // Les raccourcis.
  useEffect(() => {
    const oublierG = () => {
      gA.current = 0;
      setAttenteG(false);
      if (minuterieG.current) clearTimeout(minuterieG.current);
    };
    const surTouche = (ev: KeyboardEvent) => {
      const mod = ev.metaKey || ev.ctrlKey;
      const touche = ev.key;
      // ⌘E / Ctrl E : partout, même dans un champ.
      if (mod && !ev.altKey && !ev.shiftKey && touche.toLowerCase() === 'e') {
        ev.preventDefault();
        acheverSas();
        setAide(false);
        setPalette((v) => !v);
        return;
      }
      // Dans un bureau, ⌘K ouvre aussi SA palette (la palette des commandes cède, voir CommandPalette).
      if (mod && !ev.altKey && touche.toLowerCase() === 'k' && bureauDuChemin(window.location.hash.slice(1).split('?')[0] || '/')) {
        ev.preventDefault();
        setAide(false);
        setPalette((v) => !v);
        return;
      }
      if (touche === 'Escape') {
        oublierG();
        setPalette(false);
        setAide(false);
        return;
      }
      // F1–F9 : l'application installée seulement.
      if (/^F[1-9]$/.test(touche) && !mod && !ev.altKey && isElectron()) {
        const b = bureauDuChemin(window.location.hash.slice(1).split('?')[0] || '/');
        const outil = b ? outilNumero(b, Number(touche.slice(1))) : null;
        if (outil) {
          ev.preventDefault();
          aller(outil.route);
        }
        return;
      }
      if (mod || ev.altKey || enSaisie(ev.target) || enSaisie(document.activeElement)) return;
      // Une boîte de dialogue ouverte (autre que la palette) garde ses touches.
      if (document.querySelector('[role="dialog"][aria-modal="true"]:not([data-palette-espaces]):not([data-aide-bureaux])')) return;
      if (touche === 'g' || touche === 'G') {
        gA.current = Date.now();
        setAttenteG(true);
        if (minuterieG.current) clearTimeout(minuterieG.current);
        minuterieG.current = setTimeout(oublierG, MOUVEMENT.attenteG);
        return;
      }
      if (/^[0-9]$/.test(touche)) {
        const n = Number(touche);
        if (gA.current && Date.now() - gA.current <= MOUVEMENT.attenteG) {
          oublierG();
          const cible = ESPACES.find((e) => e.chiffre === n);
          if (cible) {
            ev.preventDefault();
            allerEspace(cible.key);
          }
          return;
        }
        const b = bureauDuChemin(window.location.hash.slice(1).split('?')[0] || '/');
        const outil = b && n >= 1 ? outilNumero(b, n) : null;
        if (outil) {
          ev.preventDefault();
          aller(outil.route);
        }
        return;
      }
      if (touche === '?' && bureauDuChemin(window.location.hash.slice(1).split('?')[0] || '/')) {
        ev.preventDefault();
        setPalette(false);
        setAide(true);
        return;
      }
      if (gA.current) oublierG();
    };
    window.addEventListener('keydown', surTouche);
    return () => {
      window.removeEventListener('keydown', surTouche);
      if (minuterieG.current) clearTimeout(minuterieG.current);
    };
  }, [aller, allerEspace]);

  const value = useMemo<NavEspaces>(
    () => ({
      espace,
      bureau,
      attentes,
      aller,
      allerEspace,
      palette,
      ouvrirPalette: () => {
        setAide(false);
        setPalette(true);
      },
      fermerPalette: () => setPalette(false),
      aide,
      ouvrirAide: () => {
        setPalette(false);
        setAide(true);
      },
      fermerAide: () => setAide(false),
      attenteG,
    }),
    [espace, bureau, attentes, aller, allerEspace, palette, aide, attenteG],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNavigationEspaces(): NavEspaces {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNavigationEspaces hors de NavigationEspacesProvider');
  return ctx;
}

export function useNavigationEspacesOptionnelle(): NavEspaces | null {
  return useContext(Ctx);
}
