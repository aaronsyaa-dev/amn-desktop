/**
 * Déclencher un téléchargement, une fois pour toutes.
 *
 * Le geste est court mais il a trois pièges, et les trois se paient en fichier
 * qui n'arrive jamais : un `<a>` détaché du document ne réagit pas au clic sur
 * certains moteurs, l'URL d'objet doit survivre au démarrage du transfert, et
 * ne jamais la révoquer garde le contenu en mémoire jusqu'à la fermeture de la
 * fenêtre. Un seul endroit où c'est écrit, donc, plutôt qu'une variante par
 * appelant.
 */

/** Télécharge un contenu déjà en mémoire sous le nom donné. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Laisser au transfert le temps de démarrer avant de libérer l'URL : révoquer
  // dans la foulée annule le téléchargement sur plusieurs navigateurs.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Télécharge du texte en UTF-8, sans BOM.
 *
 * Pas de BOM volontairement : sur un fichier à colonnes, les trois octets de
 * marque se retrouvent collés au premier intitulé de l'en-tête, qui cesse
 * alors d'être exactement celui qu'attend le lecteur.
 */
export function downloadText(text: string, fileName: string, mime = 'text/plain'): void {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), fileName);
}
