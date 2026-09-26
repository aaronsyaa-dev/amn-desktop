import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { ESPACES, espace as espaceDe, touchePrincipale, AMBRE, ROUGE, type EspaceKey } from '../jetons';
import { useNavigationEspaces } from '../navigation';
import { cherchablesDuBureau, CATALOGUE } from '../catalogue';
import { useActiverSourceBureaux } from '../donnees/source';
import { useCompteurs } from '../compteurs';
import { itemsForSpace } from '../../data/spaces';
import { Glyphe } from './Glyphe';

/**
 * LA PALETTE D'ESPACES — cahier 11, `44d`.
 *
 * Sous la barre, sur l'écran assombri à 76 %, à 64 px sous la barre ; 580 de
 * large, fond #111, bordure #2a2a2a ; jamais coupée (elle défile en elle-même
 * quand la fenêtre est trop basse). Les six espaces, avec la seule chose qui
 * y attend ; puis les outils du bureau courant, ET EUX SEULS : on ne passe
 * pas de Notes à un moniteur de certificats, on change d'abord d'espace.
 *
 * L'ambre : la première chose qui attend quelqu'un hors d'ici. Le rouge :
 * seulement si un bureau porte un critique que personne n'a pris.
 */

const plier = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type Ligne = { cle: string; kind: 'espace'; espace: EspaceKey } | { cle: string; kind: 'outil'; nom: string; route: string; chiffre: number | null; compte: number | null; groupe?: string };

export function PaletteEspaces() {
  const nav = useNavigationEspaces();
  if (!nav.palette) return null;
  return <Palette />;
}

function Palette() {
  useActiverSourceBureaux();
  const nav = useNavigationEspaces();
  const ici = nav.espace;
  const compteurs = useCompteurs(nav.bureau);
  const [q, setQ] = useState('');
  const [choix, setChoix] = useState(0);
  const champ = useRef<HTMLInputElement>(null);
  const liste = useRef<HTMLDivElement>(null);
  const touche = touchePrincipale();

  useEffect(() => champ.current?.focus(), []);

  const ambre = useMemo(() => ESPACES.find((e) => e.key !== ici && nav.attentes[e.key].humain)?.key ?? null, [ici, nav.attentes]);

  const lignes = useMemo<Ligne[]>(() => {
    const f = plier(q.trim());
    const espaces: Ligne[] = ESPACES.filter((e) => !f || plier(`${e.nom} ${e.role} ${e.qui}`).includes(f)).map((e) => ({ cle: `e:${e.key}`, kind: 'espace', espace: e.key }));
    let outils: Ligne[] = [];
    if (nav.bureau) {
      const tous = cherchablesDuBureau(nav.bureau).map((o) => ({
        cle: `o:${o.route}`,
        kind: 'outil' as const,
        nom: o.nom,
        route: o.route,
        chiffre: o.chiffre,
        compte: o.compteur ? compteurs[o.compteur] ?? null : null,
        groupe: o.groupe,
      }));
      outils = f
        ? tous.filter((o) => plier(o.nom).includes(f))
        : (() => {
            // Sans recherche : ce qui porte un compte ; à défaut, les outils numérotés.
            const comptes = tous.filter((o) => o.chiffre !== null && (o.compte ?? 0) > 0);
            return comptes.length ? comptes : tous.filter((o) => o.chiffre !== null);
          })();
    } else if (f) {
      outils = itemsForSpace('workspace')
        .filter((i) => plier(i.label).includes(f))
        .slice(0, 12)
        .map((i) => ({ cle: `o:${i.to}`, kind: 'outil' as const, nom: i.label, route: i.to, chiffre: null, compte: null }));
    }
    return [...espaces, ...outils];
  }, [q, nav.bureau, compteurs]);

  useEffect(() => setChoix(0), [q]);
  useEffect(() => {
    liste.current?.querySelector<HTMLElement>(`[data-ligne="${choix}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [choix]);

  const entrer = (l: Ligne | undefined) => {
    if (!l) return;
    if (l.kind === 'espace') nav.allerEspace(l.espace);
    else nav.aller(l.route);
  };

  const surTouche = (ev: React.KeyboardEvent) => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      setChoix((c) => Math.min(lignes.length - 1, c + 1));
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setChoix((c) => Math.max(0, c - 1));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      entrer(lignes[choix]);
    } else if (ev.key === 'Tab') {
      // La palette garde le focus : Tab parcourt ses lignes.
      ev.preventDefault();
      setChoix((c) => (ev.shiftKey ? Math.max(0, c - 1) : Math.min(lignes.length - 1, c + 1)));
    }
  };

  const espaces = lignes.filter((l) => l.kind === 'espace');
  const outils = lignes.filter((l) => l.kind === 'outil');
  const nomIci = nav.bureau ? espaceDe(nav.bureau).nom : 'Poste de travail';

  return (
    <div className="fixed inset-x-0 bottom-0 top-12 z-[240]" data-palette-espaces-voile>
      <div className="bx-voile absolute inset-0" onMouseDown={nav.fermerPalette} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Changer d’espace"
        data-palette-espaces
        onKeyDown={surTouche}
        className="absolute left-1/2 top-16 flex w-[580px] max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col overflow-hidden border border-border-sheet bg-[#111] shadow-[0_40px_80px_-30px_rgba(0,0,0,1)]"
        style={{ maxHeight: 'calc(100vh - 160px)' }}
      >
        <div className="flex h-[54px] flex-none items-center gap-3 border-b border-[#222] px-4">
          <Search size={15} strokeWidth={1.9} className="text-text-secondary" aria-hidden />
          <input
            ref={champ}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Aller à un espace ou à un outil de ${nomIci}…`}
            aria-label={`Aller à un espace ou à un outil de ${nomIci}`}
            aria-controls="palette-espaces-liste"
            aria-activedescendant={lignes[choix] ? `palette-ligne-${choix}` : undefined}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-muted"
          />
          <kbd className="border border-border-sheet bg-surface-hover px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">{touche === '⌘' ? '⌘ E' : 'Ctrl E'}</kbd>
        </div>
        <div ref={liste} id="palette-espaces-liste" role="listbox" aria-label="Espaces et outils" className="min-h-0 flex-1 overflow-y-auto">
          {espaces.length > 0 && <Titre>ESPACES</Titre>}
          {espaces.map((l) => {
            if (l.kind !== 'espace') return null;
            const i = lignes.indexOf(l);
            const e = espaceDe(l.espace);
            const a = nav.attentes[l.espace];
            const estIci = l.espace === ici;
            const rouge = !estIci && a.critique;
            const enAmbre = !estIci && !rouge && ambre === l.espace;
            return (
              <button
                key={l.cle}
                id={`palette-ligne-${i}`}
                data-ligne={i}
                role="option"
                aria-selected={choix === i}
                type="button"
                onMouseEnter={() => setChoix(i)}
                onClick={() => entrer(l)}
                className="relative flex h-[50px] w-full items-center gap-3.5 px-4 text-left"
                style={{ background: choix === i ? '#1c1c1c' : undefined }}
              >
                {choix === i && <span aria-hidden className="absolute bottom-0 left-0 top-0 w-[2px] bg-text-primary" />}
                <span className="flex h-[30px] w-[30px] flex-none items-center justify-center" style={{ background: e.rel, border: `1px solid ${e.filet}` }}>
                  <Glyphe espace={l.espace} couleur="var(--color-text-body)" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-text-primary">{e.nom}</span>
                  <span className="block truncate text-[11.5px] text-text-secondary">
                    {e.role} · {e.qui}
                  </span>
                </span>
                <span
                  className={`flex-none whitespace-nowrap font-mono text-[11.5px] ${enAmbre || rouge ? 'font-bold tracking-[0.08em]' : ''}`}
                  style={{ color: estIci ? 'var(--color-text-secondary)' : rouge ? ROUGE.texte : enAmbre ? AMBRE : 'var(--color-text-secondary)' }}
                >
                  {estIci ? 'ICI' : a.texte ? (enAmbre || rouge ? a.texte.toUpperCase() : a.texte) : ''}
                </span>
                <kbd className="flex-none border border-border-sheet px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">G {e.chiffre}</kbd>
              </button>
            );
          })}
          {outils.length > 0 && <Titre filet>{nav.bureau ? `DANS ${nomIci.toUpperCase()}` : 'DANS LE POSTE DE TRAVAIL'}</Titre>}
          {outils.map((l) => {
            if (l.kind !== 'outil') return null;
            const i = lignes.indexOf(l);
            return (
              <button
                key={l.cle}
                id={`palette-ligne-${i}`}
                data-ligne={i}
                role="option"
                aria-selected={choix === i}
                type="button"
                onMouseEnter={() => setChoix(i)}
                onClick={() => entrer(l)}
                className="relative flex h-9 w-full items-center gap-3.5 px-4 text-left"
                style={{ background: choix === i ? '#1c1c1c' : undefined }}
              >
                {choix === i && <span aria-hidden className="absolute bottom-0 left-0 top-0 w-[2px] bg-text-primary" />}
                <span className="w-[28px] flex-none font-mono text-[10.5px] text-text-muted">{l.chiffre ?? (l.groupe ? '·' : '')}</span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-text-body">{l.nom}</span>
                {l.groupe && <span className="font-mono text-[9.5px] tracking-[0.14em] text-text-muted">{l.groupe}</span>}
                {(l.compte ?? 0) > 0 && <span className="font-mono text-[11px] tabular-nums text-text-secondary">{l.compte}</span>}
              </button>
            );
          })}
          {!lignes.length && <p className="px-4 py-6 text-[13px] text-text-secondary">Rien de ce nom ici. Pour l’outil d’un autre bureau, changez d’abord d’espace.</p>}
        </div>
        <div className="flex h-9 flex-none items-center gap-4 overflow-hidden whitespace-nowrap border-t border-[#222] px-4 font-mono text-[9.5px] tracking-[0.12em] text-text-muted">
          <span>↑↓ CHOISIR</span>
          <span>↵ ENTRER</span>
          <span>G 0 POSTE</span>
          <span>G 1-5 BUREAUX</span>
          {nav.bureau && CATALOGUE[nav.bureau].outils.some((o) => o.chiffre) && <span>1-9 OUTILS</span>}
          <span className="ml-auto">ÉCHAP FERMER</span>
        </div>
      </div>
    </div>
  );
}

function Titre({ children, filet = false }: { children: React.ReactNode; filet?: boolean }) {
  return (
    <div className={`px-4 pb-2 pt-4 font-mono text-[9.5px] tracking-[0.2em] text-text-muted ${filet ? 'mt-1 border-t border-[#222]' : ''}`} role="presentation">
      {children}
    </div>
  );
}
