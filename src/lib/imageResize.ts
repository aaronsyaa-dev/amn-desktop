/**
 * Resizes an image file client-side before it's turned into a data-URL and
 * persisted (SQLite TEXT column / localStorage). Keeps chat attachments and
 * client avatars small — this is a small internal tool, not object storage.
 */
export function resizeImageToDataUrl(
  file: File,
  maxDim = 960,
  quality = 0.82,
  /**
   * Format de sortie. JPEG par défaut — c'est ce qu'il faut pour des photos.
   * Un logo d'organisation demande `image/png` : sur le fond noir du rail, la
   * transparence aplatie en blanc par le JPEG se verrait immédiatement.
   */
  type: 'image/jpeg' | 'image/png' = 'image/jpeg',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image illisible'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(type, quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
