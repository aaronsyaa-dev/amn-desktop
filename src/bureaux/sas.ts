import { espace, GLYPHES, type EspaceKey } from './jetons';
import type { VarianteSas } from './ambiance';

/**
 * LES DEUX SAS — cahier 11, `44b` (la porte) et `44c` (la plongée).
 *
 * Un sas ne peut animer que ce qu'il voit : quand on quitte une pièce, React
 * l'a déjà remplacée par la suivante. On en prend donc une EMPREINTE juste
 * avant de partir — une copie inerte du DOM, posée par-dessus — et c'est elle
 * qui se retire, recule ou s'éteint, pendant que la pièce d'arrivée monte
 * dessous. Aucun écran n'a à savoir qu'il entre ou qu'il sort.
 *
 * Trois règles du paquet, tenues ici :
 *   · il ne bloque jamais : un clic ou une touche l'achève aussitôt ;
 *   · il ne joue aucun son ;
 *   · mouvement réduit ou Ambiance coupée : un fondu enchaîné de 160 ms, sans
 *     déplacement ni couture ni carton.
 */

export type ModeSas = 'complet' | 'retour' | 'court' | 'fondu';

export interface Carton {
  nom: string;
  role: string;
  /** La ligne ambre de l'accueil du bureau, même donnée, même texte ; `null` s'il n'y en a pas. */
  ligne: string | null;
  espace: EspaceKey;
}

export interface OptionsSas {
  vers: EspaceKey;
  mode: ModeSas;
  variante: VarianteSas;
  carton: Carton | null;
  /** Change de pièce (la navigation). Appelé une fois l'empreinte prise. */
  naviguer: () => void;
}

const SORTIE = 'cubic-bezier(.4,0,1,1)';
const INSTALLATION = 'cubic-bezier(.16,1,.3,1)';
const RALLIEMENT = 'cubic-bezier(.65,0,.35,1)';

let enCours: (() => void) | null = null;

/** Le sas en cours, s'il y en a un, s'achève tout de suite. */
export function acheverSas() {
  enCours?.();
}

function empreinte(racine: HTMLElement): HTMLElement {
  const copie = racine.cloneNode(true) as HTMLElement;
  // Une copie inerte : pas d'identifiant en double, rien de focalisable, rien de lisible deux fois.
  copie.removeAttribute('data-espace-racine');
  copie.setAttribute('aria-hidden', 'true');
  copie.setAttribute('inert', '');
  for (const el of copie.querySelectorAll('[id]')) el.removeAttribute('id');
  for (const el of copie.querySelectorAll('[data-signal-groupe]')) el.removeAttribute('data-signal-groupe');
  return copie;
}

/** Les défilements de la pièce quittée, reportés sur son empreinte (sinon elle saute en haut). */
function reporterDefilements(racine: HTMLElement, copie: HTMLElement) {
  const sel = 'main, aside, nav, [data-defile]';
  const a = [...racine.querySelectorAll<HTMLElement>(sel)];
  const b = [...copie.querySelectorAll<HTMLElement>(sel)];
  a.forEach((el, i) => {
    if (b[i] && (el.scrollTop || el.scrollLeft)) {
      b[i].scrollTop = el.scrollTop;
      b[i].scrollLeft = el.scrollLeft;
    }
  });
}

export function jouerSas(o: OptionsSas) {
  acheverSas();
  const racine = document.querySelector<HTMLElement>('[data-espace-racine]');
  if (!racine || typeof racine.animate !== 'function') {
    o.naviguer();
    return;
  }
  const rect = racine.getBoundingClientRect();
  const calque = document.createElement('div');
  calque.className = 'bx-sas';
  calque.setAttribute('aria-hidden', 'true');
  calque.dataset.sas = `${o.mode}:${o.variante}`;

  const sol = document.createElement('div');
  sol.style.cssText = `position:absolute;inset:0;background:${espace(o.vers).fond}`;
  const copie = empreinte(racine);
  copie.style.cssText += `;position:absolute;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;margin:0;pointer-events:none;transform-origin:50% 50%`;
  if (o.mode !== 'fondu') calque.appendChild(sol);
  calque.appendChild(copie);
  document.body.appendChild(calque);
  reporterDefilements(racine, copie);

  const animations: Animation[] = [];
  const anime = (el: Element, k: Keyframe[], t: KeyframeAnimationOptions) => {
    const a = el.animate(k, { fill: 'both', ...t });
    animations.push(a);
    return a;
  };

  let fini = false;
  const finir = () => {
    if (fini) return;
    fini = true;
    enCours = null;
    for (const a of animations) a.cancel();
    calque.remove();
    window.removeEventListener('pointerdown', finir, true);
    window.removeEventListener('keydown', finir, true);
  };
  enCours = finir;
  // Il ne bloque jamais : le premier geste l'achève.
  window.addEventListener('pointerdown', finir, true);
  window.addEventListener('keydown', finir, true);

  let duree = 600;
  if (o.mode === 'fondu') {
    duree = 160;
    anime(copie, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'linear' });
    anime(racine, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'linear' });
  } else if (o.mode === 'court') {
    duree = 200;
    anime(copie, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: o.variante === 'porte' ? 'translateX(-3%)' : 'scale(0.98)' }], { duration: 120, easing: SORTIE });
    anime(sol, [{ opacity: 1 }, { opacity: 0 }], { delay: 80, duration: 120, easing: 'linear' });
    anime(racine, [{ opacity: 0 }, { opacity: 1 }], { delay: 80, duration: 120, easing: 'linear' });
  } else if (o.mode === 'retour') {
    // Le même sas à l'envers, sans couture ni carton : 360 ms.
    duree = 360;
    const aller = o.variante === 'porte';
    anime(copie, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: aller ? 'translateX(7%)' : 'scale(0.94)' }], { duration: 120, easing: SORTIE });
    anime(sol, [{ opacity: 1 }, { opacity: 0 }], { delay: 180, duration: 180, easing: 'linear' });
    anime(racine, [{ opacity: 0, transform: aller ? 'translateX(-3%)' : 'scale(0.94)' }, { opacity: 1, transform: 'none' }], { delay: 180, duration: 180, easing: INSTALLATION });
  } else if (o.variante === 'porte') {
    // A · La porte : retrait 0→180, couture 120→360, installation 300→600.
    anime(copie, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-7%)' }], { duration: 180, easing: SORTIE });
    const couture = document.createElement('div');
    couture.style.cssText = 'position:absolute;top:0;bottom:0;left:0;width:2px;background:#f7f7f5;box-shadow:0 0 22px 6px rgba(247,247,245,.28)';
    calque.appendChild(couture);
    anime(couture, [{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${window.innerWidth}px)`, opacity: 1 }], { delay: 120, duration: 240, easing: 'linear' });
    anime(couture, [{ opacity: 0 }, { opacity: 1, offset: 0.01 }, { opacity: 1, offset: 0.99 }, { opacity: 0 }], { delay: 120, duration: 240, easing: 'linear', composite: 'replace' });
    anime(sol, [{ opacity: 1 }, { opacity: 0 }], { delay: 300, duration: 300, easing: 'linear' });
    anime(racine, [{ opacity: 0, transform: 'translateY(1.2%)' }, { opacity: 1, transform: 'none' }], { delay: 300, duration: 300, easing: INSTALLATION });
  } else {
    // B · La plongée : recul 0→200, carton 180→390, ralliement 380→600.
    anime(copie, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.94)' }], { duration: 200, easing: SORTIE });
    if (o.carton) {
      const carton = construireCarton(o.carton);
      calque.appendChild(carton);
      anime(carton, [{ opacity: 0 }, { opacity: 1 }], { delay: 180, duration: 90, easing: 'linear' });
      // Le ralliement vise l'indicateur d'espace de la barre haute, qui existe dès que la pièce est montée.
      window.setTimeout(() => {
        if (fini) return;
        const cible = document.querySelector('[data-indicateur-espace]')?.getBoundingClientRect();
        const c = carton.getBoundingClientRect();
        const dx = cible ? cible.left + cible.width / 2 - (c.left + c.width / 2) : -c.left;
        const dy = cible ? cible.top + cible.height / 2 - (c.top + c.height / 2) : -c.top;
        anime(carton, [{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.3)`, opacity: 0 }], { duration: 220, easing: RALLIEMENT });
      }, 380);
    }
    anime(sol, [{ opacity: 1 }, { opacity: 0 }], { delay: 380, duration: 220, easing: 'linear' });
    anime(racine, [{ opacity: 0 }, { opacity: 1 }], { delay: 380, duration: 220, easing: RALLIEMENT });
  }

  o.naviguer();
  window.setTimeout(finir, duree + 40);
}

function construireCarton(c: Carton): HTMLElement {
  const e = espace(c.espace);
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;will-change:transform,opacity';
  el.appendChild(svgGlyphe(c.espace, 34, '#f7f7f5'));
  const nom = document.createElement('div');
  nom.textContent = c.nom;
  nom.style.cssText = "font:700 34px 'Space Grotesk',sans-serif;letter-spacing:-.03em;color:#f7f7f5;line-height:1";
  const role = document.createElement('div');
  role.textContent = c.role.toUpperCase();
  role.style.cssText = "font:400 10px 'JetBrains Mono',monospace;letter-spacing:.2em;color:#a3a3a0";
  el.append(nom, role);
  if (c.ligne) {
    const ligne = document.createElement('div');
    ligne.textContent = c.ligne;
    ligne.style.cssText = `margin-top:6px;padding:5px 10px;background:#d09a4a;color:#080808;font:700 10px 'JetBrains Mono',monospace;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap;box-shadow:0 0 22px -6px rgba(208,154,74,.85)`;
    el.appendChild(ligne);
  }
  el.style.background = 'transparent';
  el.dataset.bureau = e.key;
  return el;
}

const SVG = 'http://www.w3.org/2000/svg';

/** Le glyphe d'un espace, construit hors de React (le carton vit hors de l'arbre). */
function svgGlyphe(e: EspaceKey, taille: number, couleur: string): SVGSVGElement {
  const g = GLYPHES[e];
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('width', String(taille));
  svg.setAttribute('height', String(taille));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', couleur);
  svg.setAttribute('stroke-width', '1.9');
  svg.style.color = couleur;
  const ajoute = (nom: string, attrs: Record<string, string | number>) => {
    const n = document.createElementNS(SVG, nom);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    svg.appendChild(n);
  };
  for (const [x, y, w, h] of g.rects ?? []) ajoute('rect', { x, y, width: w, height: h });
  for (const [cx, cy, r] of g.cercles ?? []) ajoute('circle', { cx, cy, r });
  for (const d of g.d) ajoute('path', { d });
  for (const p of g.plein ?? []) ajoute('circle', { cx: p.cx, cy: p.cy, r: p.r, fill: 'currentColor' });
  return svg;
}
