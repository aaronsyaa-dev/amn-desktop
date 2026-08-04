import React from 'react';
import { useLightbox } from './MediaLightbox';
import type { MessageAttachment } from '../../shared/api';

/**
 * Renders one chat attachment inline in a message bubble by kind (Bloc 1.1/1.2):
 *  - image → thumbnail that opens the fullscreen lightbox,
 *  - video → inline player (controls + sound),
 *  - audio → inline voice-note player.
 * Old records without `kind` are treated as images (backwards-compatible).
 */
export function MessageMedia({
  att,
  galleryKey,
}: {
  att: MessageAttachment;
  galleryKey: string;
}) {
  const { openKey } = useLightbox();
  const kind = att.kind ?? 'image';

  if (kind === 'video') {
    return (
      <video
        src={att.dataUrl}
        controls
        preload="metadata"
        className="max-h-64 max-w-[280px] rounded-md border border-black/10 bg-black"
      >
        {att.mime && <source src={att.dataUrl} type={att.mime} />}
      </video>
    );
  }

  if (kind === 'audio') {
    return (
      <audio src={att.dataUrl} controls preload="metadata" className="h-10 w-[240px] max-w-full">
        {att.mime && <source src={att.dataUrl} type={att.mime} />}
      </audio>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openKey(galleryKey)}
      className="block overflow-hidden rounded-md border border-black/10 transition-opacity hover:opacity-90"
      aria-label="Agrandir l'image"
    >
      <img
        src={att.dataUrl}
        alt={att.name || 'Pièce jointe'}
        className="max-h-48 max-w-[220px] object-cover"
      />
    </button>
  );
}
