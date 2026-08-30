/**
 * LE FLUX VISIBLE — on ne voit pas « +1 », on voit d'où vient le +1
 * ═════════════════════════════════════════════════════════════════
 *
 * Quand un enregistrement arrive par la liaison temps réel, un jeton de
 * lumière voyage du point de synchronisation (la source : là où la donnée
 * entre dans le poste) vers le relevé qui va compter (la destination). La
 * donnée circule comme du sang — et le compteur qui s'incrémente juste après
 * n'est plus un chiffre qui saute, c'est une arrivée qu'on a vue venir.
 *
 * ## La règle d'honnêteté
 *
 * Le jeton ne part QUE sur une vraie arrivée réseau (le gestionnaire
 * `onRecord` de la synchronisation, pour un enregistrement écrit par
 * quelqu'un d'autre). Jamais sur un écrit local — on n'a pas besoin qu'on
 * nous montre d'où vient ce qu'on vient soi-même de taper — et jamais en
 * boucle décorative. Pas de cible enregistrée pour la collection ? Pas de
 * vol, en silence : un jeton qui volerait vers rien serait du théâtre.
 *
 * ## Pourquoi un module minuscule, sans React
 *
 * Source et cibles sont des éléments du DOM tenus par des composants qui ne
 * se connaissent pas (l'indicateur de synchronisation, chaque LiveMetric).
 * Un registre de module les met en relation sans créer de dépendance — et le
 * vol lui-même passe par WAAPI (`element.animate`), transform + opacité
 * uniquement, hors de tout rendu React.
 */

type Gravite = 'normal';

const cibles = new Map<string, Set<HTMLElement>>();
let source: HTMLElement | null = null;

export function poserSourceDuFlux(el: HTMLElement | null): void {
  source = el;
}

/** Enregistre un relevé comme destination pour une collection. Rend le retrait. */
export function poserCibleDuFlux(collection: string, el: HTMLElement): () => void {
  let set = cibles.get(collection);
  if (!set) {
    set = new Set();
    cibles.set(collection, set);
  }
  set.add(el);
  return () => {
    set?.delete(el);
    if (set && set.size === 0) cibles.delete(collection);
  };
}

function mouvementReduit(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Fait voler un jeton de la source vers chaque cible de la collection.
 *
 * En mouvement réduit, rien ne vole : l'impulsion du LiveMetric (un simple
 * changement d'intensité) porte déjà l'information « ça vient de changer ».
 */
export function signalerArrivee(collection: string, _gravite: Gravite = 'normal'): void {
  if (typeof document === 'undefined' || mouvementReduit()) return;
  const depuis = source?.getBoundingClientRect();
  if (!depuis || (depuis.width === 0 && depuis.height === 0)) return;
  const vers = cibles.get(collection);
  if (!vers || vers.size === 0) return;

  for (const cible of vers) {
    const arrivee = cible.getBoundingClientRect();
    if (arrivee.width === 0 && arrivee.height === 0) continue;

    const jeton = document.createElement('span');
    jeton.setAttribute('aria-hidden', 'true');
    jeton.style.cssText = [
      'position:fixed',
      `left:${depuis.left + depuis.width / 2 - 3}px`,
      `top:${depuis.top + depuis.height / 2 - 3}px`,
      'width:6px',
      'height:6px',
      'border-radius:9999px',
      'background:#f2f2f0',
      'box-shadow:0 0 10px rgba(255,255,255,0.6)',
      'pointer-events:none',
      'z-index:220',
      'will-change:transform,opacity',
    ].join(';');
    document.body.appendChild(jeton);

    const dx = arrivee.left + arrivee.width / 2 - (depuis.left + depuis.width / 2);
    const dy = arrivee.top + arrivee.height / 2 - (depuis.top + depuis.height / 2);

    const vol = jeton.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 0.95 },
        { transform: `translate(${dx * 0.7}px,${dy * 0.7}px) scale(0.9)`, opacity: 0.9, offset: 0.7 },
        { transform: `translate(${dx}px,${dy}px) scale(0.5)`, opacity: 0 },
      ],
      { duration: 620, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    );
    vol.onfinish = () => jeton.remove();
    // Si l'animation est interrompue (navigation), le jeton ne doit pas rester.
    vol.oncancel = () => jeton.remove();
    window.setTimeout(() => jeton.remove(), 1200);
  }
}
