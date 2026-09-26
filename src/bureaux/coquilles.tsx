import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { espace as espaceDe, type BureauKey } from './jetons';
import { CATALOGUE, ongletDuChemin, type Ecran } from './catalogue';
import { useCompteurs } from './compteurs';
import { useSupervisor } from './donnees/useSupervisor';
import { poidsDuBandeau } from './donnees/parc';
import { useCyber } from './donnees/cyber';
import { useStudio, type Piece } from './donnees/studio';
import { hhmmss } from './format';
import { Glyphe } from './ui/Glyphe';

/**
 * LES CINQ COQUILLES — cahier 11 §4, engendrées dans le paquet par
 * `shell(bureau, options)` (`_tools/bureaux.js`). Chaque bureau a sa forme de
 * navigation : le pupitre, la console, les pièces, le plan du mur,
 * l'organigramme. Les compteurs viennent des modèles (voir `compteurs.ts`).
 *
 * Les encres : le paquet écrit ses petites mentions en #6b6b68 ou #4a4a48 ;
 * le produit ne descend pas sous #9a9a97 pour du texte (WCAG AA,
 * `check:contraste`). Les mentions gardent leur taille et leur espacement,
 * pas leur gris.
 */

const NB = (n: number | null | undefined) => (n && n > 0 ? String(n) : '');

/* ── Un onglet du pupitre et de l'organigramme (`tab()` du paquet) ─────── */
function Onglet({ to, nom, compte, actif, rel }: { to: string; nom: string; compte: string; actif: boolean; rel: string }) {
  return (
    <Link
      to={to}
      aria-current={actif ? 'page' : undefined}
      className="bx-nav relative flex flex-none items-center gap-2 whitespace-nowrap px-3.5 text-[13px]"
      style={{ background: actif ? rel : undefined, boxShadow: actif ? 'inset 0 1px 0 rgba(255,255,255,.05)' : undefined, fontWeight: actif ? 600 : 500, color: actif ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
    >
      {nom}
      {compte && <span className="font-mono text-[10.5px] font-medium tabular-nums" style={{ color: actif ? 'var(--color-text-body)' : 'var(--color-text-muted)' }}>{compte}</span>}
      {actif && <span aria-hidden className="absolute bottom-0 left-2.5 right-2.5 h-[2px] bg-text-primary" />}
    </Link>
  );
}

function BarreOnglets({ bureau }: { bureau: BureauKey }) {
  const e = espaceDe(bureau);
  const { pathname } = useLocation();
  const compteurs = useCompteurs(bureau);
  const actif = ongletDuChemin(bureau, pathname)?.onglet.route;
  return (
    <nav aria-label={e.nom} data-coquille-bureau="onglets" className="flex h-[42px] flex-none items-stretch gap-[2px] overflow-x-auto px-[18px]" style={{ background: e.fond, borderBottom: `1px solid ${e.filet}` }}>
      {CATALOGUE[bureau].onglets.map((o) => (
        <Onglet key={o.route} to={o.route} nom={o.nom} compte={NB(o.compteur ? compteurs[o.compteur] : null)} actif={actif === o.route} rel={e.rel} />
      ))}
    </nav>
  );
}

/* ── Supervisor · le pupitre, et l'horizon sous lui ───────────────────── */
export function Pupitre() {
  const sup = useSupervisor();
  const h = poidsDuBandeau(sup.orgs);
  const n = h.length;
  const max = Math.max(1, ...h);
  return (
    <>
      <BarreOnglets bureau="supervisor" />
      <div data-coquille-bureau="horizon" className="flex h-[22px] flex-none items-center gap-3.5 px-[18px]" style={{ background: 'var(--color-sunken)', borderBottom: '1px solid #1a1a1a' }} aria-label={`L’horizon : ${n} organisations, pesées par ce qui demande un humain`} role="img">
        <span className="font-mono text-[8.5px] tracking-[0.18em] text-text-muted">HORIZON</span>
        {n > 40 ? (
          <svg viewBox="0 0 1000 12" preserveAspectRatio="none" className="block h-3 flex-1" aria-hidden>
            <path d={`M0 12 ${h.map((v, i) => `L${((i / Math.max(1, n - 1)) * 1000).toFixed(1)} ${(12 - (v / max) * 11).toFixed(2)}`).join(' ')} L1000 12 Z`} fill="#2b2b2b" stroke="#4a4a48" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          </svg>
        ) : (
          <span className="flex h-3 flex-1 items-end justify-between" style={{ borderBottom: '1px solid #252525' }} aria-hidden>
            {h.map((v, i) => (
              <span key={i} className="w-[2px]" style={{ height: Math.max(1, Math.round((v / max) * 11)), background: '#4a4a48' }} />
            ))}
          </span>
        )}
        <span className="font-mono text-[8.5px] tracking-[0.14em] text-text-muted">{n ? `${n} ORGANISATION${n > 1 ? 'S' : ''}` : ''}</span>
      </div>
    </>
  );
}

/* ── Cyber · la console (colonne de 200) et la barre d'état en pied ───── */
export function ConsoleColonne() {
  const e = espaceDe('cyber');
  const { pathname } = useLocation();
  const compteurs = useCompteurs('cyber');
  const actif = ongletDuChemin('cyber', pathname)?.onglet.route ?? null;
  const produit = CATALOGUE.cyber.outils.find((o) => o.groupe && (pathname === o.route || pathname.startsWith(`${o.route}/`)))?.route ?? null;
  const entree = (cle: string, nom: string, to: string, compte: string, on: boolean) => (
    <Link
      key={to}
      to={to}
      aria-current={on ? 'page' : undefined}
      className="bx-nav relative flex h-[30px] items-center gap-2.5 px-2"
      style={{ background: on ? e.rel : undefined, boxShadow: on ? 'inset 0 1px 0 rgba(255,255,255,.05)' : undefined }}
    >
      <span className="w-[18px] font-mono text-[9.5px] font-medium" style={{ color: on ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}>{cle}</span>
      <span className="min-w-0 flex-1 truncate whitespace-nowrap font-mono text-[12.5px]" style={{ fontWeight: on ? 600 : 500, color: on ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>{nom}</span>
      {compte && <span className="font-mono text-[10.5px] font-medium tabular-nums" style={{ color: on ? 'var(--color-text-body)' : 'var(--color-text-muted)' }}>{compte}</span>}
      {on && <span aria-hidden className="absolute bottom-1 left-0 top-1 w-[2px] bg-text-primary" />}
    </Link>
  );
  return (
    <nav aria-label="Console de Cyber" data-coquille-bureau="console" className="hidden w-[200px] flex-none flex-col gap-[2px] overflow-y-auto px-2.5 py-3.5 md:flex" style={{ background: e.barre, borderRight: `1px solid ${e.filet}` }}>
      <span className="px-2 pb-2.5 font-mono text-[9px] tracking-[0.2em] text-text-muted">CONSOLE</span>
      {CATALOGUE.cyber.onglets.map((o, i) => entree(String(i + 1), o.nom, o.route, NB(o.compteur ? compteurs[o.compteur] : null), !produit && actif === o.route))}
      <span className="px-2 pb-2 pt-3.5 font-mono text-[9px] tracking-[0.2em] text-text-muted">PRODUITS</span>
      {CATALOGUE.cyber.outils.filter((o) => o.groupe).map((o) => entree('·', o.nom, o.route, NB(o.compteur ? compteurs[o.compteur] : null), produit === o.route))}
    </nav>
  );
}

export function BarreEtatCyber() {
  const e = espaceDe('cyber');
  const c = useCyber();
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const critiques = c.orgs.filter((o) => o.breche).length;
  return (
    <div className="flex h-7 flex-none items-center gap-[22px] overflow-hidden whitespace-nowrap px-4 font-mono text-[10px] font-medium tracking-[0.1em] text-text-muted" style={{ background: e.barre, borderTop: `1px solid ${e.filet}` }} data-barre-etat data-coquille-bureau="etat">
      <span>
        POSTURE DU PARC <b className="font-semibold tabular-nums text-text-body">{c.parc ?? '—'}</b>
      </span>
      <span>
        ALERTES OUVERTES <b className="font-semibold text-text-body">{c.alertes.length}</b>
      </span>
      {/* Le critique, à l'encre : le rouge n'est dit qu'une fois par écran, et c'est l'écran qui le dit. */}
      <span>
        CRITIQUES <b className="font-semibold text-text-body">{critiques}</b>
      </span>
      <span className="hidden lg:inline">
        {c.orgs.length} ORGANISATION{c.orgs.length > 1 ? 'S' : ''} · {c.actifsSurveilles} ACTIF{c.actifsSurveilles > 1 ? 'S' : ''} SURVEILLÉ{c.actifsSurveilles > 1 ? 'S' : ''}
      </span>
      <span className="ml-auto hidden md:inline">{c.rondesNuit !== null ? `GARDE · ${c.rondesNuit} RONDE${c.rondesNuit > 1 ? 'S' : ''} CETTE NUIT` : 'GARDE · NUIT NON RELEVÉE'}</span>
      <span className="tabular-nums">UTC {hhmmss(t, true)}</span>
    </div>
  );
}

/* ── Studio · les pièces : une porte par projet ────────────────────────── */
function Pastille({ etat }: { etat: Piece['etat'] }) {
  if (etat === 'en_ligne') return <span aria-label="en ligne" className="h-[7px] w-[7px] flex-none rounded-full bg-text-body" />;
  if (etat === 'chantier') return <span aria-label="chantier" className="h-[7px] w-[7px] flex-none rounded-full border border-[#8a8a87]" style={{ background: 'linear-gradient(90deg,var(--color-text-body) 50%,transparent 50%)' }} />;
  return <span aria-label="attente client" className="h-[7px] w-[7px] flex-none rounded-full border border-[#8a8a87]" />;
}

export function Portes() {
  const e = espaceDe('studio');
  const { pathname } = useLocation();
  const studio = useStudio();
  const courante = /^\/studio\/pieces\/([^/]+)/.exec(pathname)?.[1] ?? null;
  // « Toutes les pièces » reste la porte courante sous ses outils (budget, recette, accessibilité) : ils y sont rangés.
  const toutes = !courante && ongletDuChemin('studio', pathname)?.onglet.route === '/studio';
  const ordre: Piece[] = [];
  const ajoute = (p: Piece | null | undefined) => {
    if (p && !ordre.includes(p)) ordre.push(p);
  };
  ajoute(studio.pieces.find((p) => p.id === courante));
  for (const p of studio.pieces) ajoute(p);
  const montrees = ordre.slice(0, 4).sort((a, b) => a.numero - b.numero);
  const reste = studio.pieces.length - montrees.length;
  const porte = (to: string, contenu: React.ReactNode, on: boolean, cle: string) => (
    <Link
      key={cle}
      to={to}
      aria-current={on ? 'page' : undefined}
      className="bx-nav relative flex flex-none items-center gap-2.5 pl-3 pr-3.5"
      style={{ background: on ? e.rel : e.surf, border: `1px solid ${on ? '#3a3834' : e.filet}`, boxShadow: on ? 'inset 0 1px 0 rgba(255,255,255,.06)' : undefined }}
    >
      {contenu}
      {on && <span aria-hidden className="absolute bottom-[-1px] left-2.5 right-2.5 h-[2px] bg-text-primary" />}
    </Link>
  );
  return (
    <nav aria-label="Les pièces du Studio" data-coquille-bureau="portes" className="flex h-[58px] flex-none items-stretch gap-1.5 overflow-x-auto px-[18px] py-[9px]" style={{ background: e.fond, borderBottom: `1px solid ${e.filet}` }}>
      {porte(
        '/studio',
        <>
          <Glyphe espace="studio" taille={13} couleur="var(--color-text-secondary)" />
          <span className="whitespace-nowrap text-[13px]" style={{ fontWeight: toutes ? 600 : 500, color: toutes ? 'var(--color-text-primary)' : '#c9c7c1' }}>Toutes les pièces</span>
          {studio.pieces.length > 0 && <span className="font-mono text-[10.5px] tabular-nums text-text-muted">{studio.pieces.length}</span>}
        </>,
        toutes,
        'toutes',
      )}
      {montrees.map((p) =>
        porte(
          `/studio/pieces/${p.id}`,
          <>
            <span className="border px-[5px] py-[3px] font-mono text-[9.5px] font-semibold tracking-[0.1em] text-text-muted" style={{ borderColor: e.filet }}>{p.plaque}</span>
            <span className="whitespace-nowrap text-[13px]" style={{ fontWeight: p.id === courante ? 600 : 500, color: p.id === courante ? 'var(--color-text-primary)' : '#c9c7c1' }}>{p.orgNom}</span>
            <Pastille etat={p.etat} />
          </>,
          p.id === courante,
          p.id,
        ),
      )}
      {reste > 0 && (
        <Link to="/studio" className="bx-nav flex flex-none items-center whitespace-nowrap px-3 text-[12.5px] font-medium text-text-muted hover:text-text-body">
          + {reste} pièce{reste > 1 ? 's' : ''}
        </Link>
      )}
    </nav>
  );
}

/* ── Stratégie · le plan du mur : le dock en pied ─────────────────────── */
const PLACES_MUR: Record<string, number> = { '/strategie': 1.5, '/strategie/campagnes': 1.3, '/strategie/storyboards': 1, '/strategie/calendrier': 1.2, '/strategie/pipeline': 1.2, '/strategie/enquete': 1.1, '/strategie/objectifs': 0.8, '/strategie/liege': 0.9 };

export function Dock() {
  const e = espaceDe('strategie');
  const { pathname } = useLocation();
  const actif = ongletDuChemin('strategie', pathname)?.onglet.route;
  return (
    <nav aria-label="Le plan du mur" data-coquille-bureau="dock" className="flex h-[52px] flex-none items-center gap-3.5 px-[18px]" style={{ background: e.barre, borderTop: `1px solid ${e.filet}` }}>
      <span className="hidden flex-none font-mono text-[9px] tracking-[0.2em] text-text-muted lg:inline">LE PLAN DU MUR</span>
      <span className="flex h-[30px] min-w-0 flex-1 gap-1 overflow-x-auto">
        {CATALOGUE.strategie.onglets.map((o) => {
          const on = actif === o.route;
          return (
            <Link
              key={o.route}
              to={o.route}
              aria-current={on ? 'page' : undefined}
              className="bx-nav relative flex min-w-[76px] items-center overflow-hidden whitespace-nowrap px-2.5 text-[12px]"
              style={{ flex: PLACES_MUR[o.route] ?? 1, background: on ? e.rel : e.surf, border: `1px solid ${on ? '#44444a' : e.filet}`, fontWeight: on ? 600 : 500, color: on ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
            >
              {o.nom}
              {on && <span aria-hidden className="absolute left-0 right-0 top-[-1px] h-[2px] bg-text-primary" />}
            </Link>
          );
        })}
      </span>
    </nav>
  );
}

/* ── La Garde · l'organigramme, et le pouls sous lui ──────────────────── */
export function OrganigrammeNav() {
  const e = espaceDe('garde');
  return (
    <>
      <BarreOnglets bureau="garde" />
      <div data-coquille-bureau="pouls" className="relative h-4 flex-none overflow-hidden" style={{ background: e.fond, borderBottom: '1px solid var(--color-border-row)' }} aria-hidden>
        <svg viewBox="0 0 1000 16" preserveAspectRatio="none" className="absolute inset-0 h-4 w-full">
          <path d="M0 9 H436 L442 9 L447 2 L453 15 L458 6 L462 9 H1000" fill="none" stroke="var(--color-border-strong)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        </svg>
        <span data-mv className="bx-pouls absolute top-px -ml-0.5 h-1 w-1 rounded-full bg-text-secondary" style={{ left: '44.7%' }} />
      </div>
    </>
  );
}

/* ── Les écrans recousus sous un onglet : une ligne de sous-onglets ───── */
export function SousOnglets({ bureau }: { bureau: BureauKey }) {
  const e = espaceDe(bureau);
  const { pathname } = useLocation();
  const o = ongletDuChemin(bureau, pathname);
  if (!o?.onglet.aussi?.length) return null;
  const ecrans: { nom: string; route: string }[] = [{ nom: o.onglet.nom, route: o.onglet.route }, ...(o.onglet.aussi as NonNullable<Ecran['aussi']>)];
  return (
    <nav aria-label={`${o.onglet.nom} — écrans`} data-coquille-bureau="sous-onglets" className="flex h-[34px] flex-none items-stretch gap-1 overflow-x-auto px-[18px]" style={{ background: e.fond, borderBottom: `1px solid ${e.filet}` }}>
      {ecrans.map((x) => {
        const on = o.ecran.route === x.route;
        return (
          <Link key={x.route} to={x.route} aria-current={on ? 'page' : undefined} className="bx-nav relative flex flex-none items-center whitespace-nowrap px-2.5 text-[12px]" style={{ fontWeight: on ? 600 : 500, color: on ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
            {x.nom}
            {on && <span aria-hidden className="absolute bottom-0 left-2 right-2 h-px bg-text-body" />}
          </Link>
        );
      })}
    </nav>
  );
}
