/**
 * Contextual task markers ("repères", A4).
 *
 * A marker pins a spot somewhere in the app to a Kanban task: it stores the
 * route the spot lives on, the position as PERCENTAGES of the scrollable content
 * (so it survives window resizes), and optionally the id of the element that was
 * under the cursor (a stable anchor when the layout reflows). Markers live on the
 * task's synced data, so both operators see the same repères.
 */

export interface TaskMarker {
  id: string;
  /** Route the marker points at, e.g. '/sites', '/team'. */
  routeKey: string;
  /** Horizontal position, 0–100, relative to the content scroll width. */
  xPct: number;
  /** Vertical position, 0–100, relative to the content scroll height. */
  yPct: number;
  /** Id of the element under the cursor at capture time, if any. */
  elementId: string | null;
  /** Short human label for the chip (route name by default). */
  label: string;
  createdAt: string;
}

/** The app's scrollable content container (the routed screen host). */
export function contentEl(): HTMLElement | null {
  return document.querySelector('main');
}

/**
 * Turns a viewport click into content-relative percentages + the nearest
 * element id under the pointer. Returns null if the click wasn't inside the
 * content area.
 */
export function captureAt(
  clientX: number,
  clientY: number,
): { xPct: number; yPct: number; elementId: string | null } | null {
  const main = contentEl();
  if (!main) return null;
  const rect = main.getBoundingClientRect();
  if (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  ) {
    return null;
  }
  const x = main.scrollLeft + (clientX - rect.left);
  const y = main.scrollTop + (clientY - rect.top);
  const w = main.scrollWidth || rect.width || 1;
  const h = main.scrollHeight || rect.height || 1;

  // Nearest ancestor carrying an id gives a layout-stable anchor.
  const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  const withId = target?.closest<HTMLElement>('[id]') ?? null;

  return {
    xPct: clamp((x / w) * 100),
    yPct: clamp((y / h) * 100),
    elementId: withId?.id || null,
  };
}

/**
 * Resolves a marker to a current viewport point, scrolling the content so the
 * spot is visible. Prefers the anchored element's live position; falls back to
 * the stored percentages. Returns null if the content isn't mounted yet.
 */
export function resolveMarkerPoint(marker: TaskMarker): { left: number; top: number } | null {
  const main = contentEl();
  if (!main) return null;

  const anchor = marker.elementId ? document.getElementById(marker.elementId) : null;
  if (anchor) {
    anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const r = anchor.getBoundingClientRect();
    return { left: r.left + r.width / 2, top: r.top + r.height / 2 };
  }

  const targetX = (marker.xPct / 100) * (main.scrollWidth || 1);
  const targetY = (marker.yPct / 100) * (main.scrollHeight || 1);
  main.scrollTo({
    left: Math.max(0, targetX - main.clientWidth / 2),
    top: Math.max(0, targetY - main.clientHeight / 2),
    behavior: 'smooth',
  });
  const rect = main.getBoundingClientRect();
  return {
    left: rect.left + (targetX - main.scrollLeft),
    top: rect.top + (targetY - main.scrollTop),
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
