/**
 * Triggers the print/PDF dialog only after the print-only region has actually
 * been laid out and painted. A single requestAnimationFrame can fire before the
 * freshly-mounted portal (logo SVG, tables) has painted — in Electron that race
 * produced a blank print dialog the first time a document was exported. A
 * double rAF guarantees a committed frame, and the small trailing timeout gives
 * late layout (web fonts, images) a beat to settle.
 *
 * Returns a cleanup function that cancels the pending trigger and detaches the
 * afterprint handler.
 */
export function triggerPrint(onDone: () => void): () => void {
  let raf1 = 0;
  let raf2 = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const handleAfterPrint = () => onDone();
  window.addEventListener('afterprint', handleAfterPrint);

  raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(() => {
      timer = setTimeout(() => window.print(), 60);
    });
  });

  return () => {
    cancelAnimationFrame(raf1);
    cancelAnimationFrame(raf2);
    if (timer) clearTimeout(timer);
    window.removeEventListener('afterprint', handleAfterPrint);
  };
}
