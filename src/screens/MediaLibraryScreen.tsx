import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Film, ImageOff, Play, X } from 'lucide-react';
import { useMessages } from '../state/useMessages';
import { useProfiles } from '../state/ProfilesContext';
import { LightboxProvider, useLightbox, type LightboxImage } from '../components/team/MediaLightbox';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { AJMANI_EMAIL, AJMANI_NAME } from '../lib/ajmaniChat';
import { useFermetureEchap } from '../lib/useFermetureEchap';
import { useLangue, t as tr } from '../i18n';

/**
 * Bibliothèque média (Bloc 3).
 *
 * STORAGE DECISION (documented as requested): the app talks to amn-api
 * (Express + Postgres), not to Supabase Storage, and chat media already live
 * inline (data-URI) inside the synced `messages` collection. Rather than add a
 * whole new storage backend + credentials, this library is a *view over what
 * already exists* — it indexes every image/video sent in the team chat. It's
 * free (no extra infra, no quota beyond the DB rows already written) and works
 * offline via the same mirror. Heavier media stays capped in the composer
 * (6 MB videos); the natural upgrade path, if that becomes limiting, is to move
 * media to Supabase Storage and store only URLs here.
 *
 * Media attached directly to a site/client (e.g. screenshots) is intentionally
 * out of scope for now: there is no place in the app yet to attach an image to
 * a site or client fiche. When that lands, extend `useMediaItems` to include it.
 */

type MediaKind = 'image' | 'video';
type TypeFilter = 'all' | MediaKind;
type PeriodFilter = 'all' | '7' | '30';

interface MediaItem {
  key: string;
  kind: MediaKind;
  src: string;
  name: string;
  mime?: string;
  authorEmail: string;
  createdAt: string;
}

function useMediaItems(): MediaItem[] {
  const { messages } = useMessages();
  return useMemo(() => {
    const items: MediaItem[] = [];
    for (const m of messages) {
      m.attachments.forEach((att, i) => {
        const kind = att.kind ?? 'image';
        if (kind === 'image' || kind === 'video') {
          items.push({
            key: `${m.id}:${i}`,
            kind,
            src: att.dataUrl,
            name: att.name,
            mime: att.mime,
            authorEmail: m.authorEmail,
            createdAt: m.createdAt,
          });
        }
      });
    }
    // Newest first.
    return items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [messages]);
}

export function MediaLibraryScreen() {
  const all = useMediaItems();
  const { profileFor } = useProfiles();
  const [type, setType] = useState<TypeFilter>('all');
  const [sender, setSender] = useState<string>('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [video, setVideo] = useState<MediaItem | null>(null);

  /* Une vidéo ouverte en plein écran se ferme à Échap — c’est le geste attendu
     partout ailleurs pour sortir d’un plein écran. */
  useFermetureEchap(video !== null, () => setVideo(null));

  const senders = useMemo(() => {
    const set = new Set(all.map((m) => m.authorEmail));
    return [...set];
  }, [all]);

  const filtered = useMemo(() => {
    const cutoff =
      period === 'all' ? 0 : Date.now() - Number(period) * 24 * 60 * 60 * 1000;
    return all.filter((m) => {
      if (type !== 'all' && m.kind !== type) return false;
      if (sender !== 'all' && m.authorEmail !== sender) return false;
      if (cutoff && new Date(m.createdAt).getTime() < cutoff) return false;
      return true;
    });
  }, [all, type, sender, period]);

  const imageGallery = useMemo<LightboxImage[]>(
    () => filtered.filter((m) => m.kind === 'image').map((m) => ({ key: m.key, src: m.src, name: m.name })),
    [filtered],
  );

  const senderName = (email: string) => (email === AJMANI_EMAIL ? AJMANI_NAME : profileFor(email).name);

  return (
    <LightboxProvider gallery={imageGallery}>
      <section className="flex flex-col gap-5">
        <ScreenHeader
          eyebrow={tr('hist.medialibrary.posteDeTravailMedias')}
          title={tr('hist.medialibrary.medias')}
          description={tr('hist.medialibrary.lesImagesEtVideos')}
          stats={[
            { label: tr('hist.medialibrary.elements'), value: all.length },
            { label: 'Images', value: all.filter((m) => (m.kind ?? 'image') === 'image').length },
            { label: tr('hist.medialibrary.videos'), value: all.filter((m) => m.kind === 'video').length },
          ]}
        />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Segmented
            value={type}
            onChange={(v) => setType(v as TypeFilter)}
            options={[
              { value: 'all', label: tr('hist.medialibrary.tout') },
              { value: 'image', label: 'Images' },
              { value: 'video', label: tr('hist.medialibrary.videos') },
            ]}
          />
          <select
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            aria-label={tr('hist.medialibrary.filtrerParExpediteur')}
            className="input-focus cursor-pointer border border-border bg-surface px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-text-secondary"
          >
            <option value="all">{tr('hist.medialibrary.tousLesExpediteurs')}</option>
            {senders.map((email) => (
              <option key={email} value={email}>
                {senderName(email)}
              </option>
            ))}
          </select>
          <Segmented
            value={period}
            onChange={(v) => setPeriod(v as PeriodFilter)}
            options={[
              { value: 'all', label: 'Toujours' },
              { value: '30', label: '30 j' },
              { value: '7', label: '7 j' },
            ]}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 border border-dashed border-border py-20 text-center">
            <ImageOff size={24} strokeWidth={1.5} className="text-text-muted" />
            <p className="text-sm font-medium text-text-primary">{tr('hist.medialibrary.aucunMedia')}</p>
            <p className="max-w-sm text-sm text-text-secondary">
              {all.length === 0
                ? 'Les images et vidéos envoyées dans l’onglet Équipe apparaîtront ici.'
                : 'Aucun média ne correspond à ces filtres.'}
            </p>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          >
            {filtered.map((m) => (
              <motion.div key={m.key} variants={staggerItem}>
                <MediaTile item={m} senderName={senderName(m.authorEmail)} onPlayVideo={() => setVideo(m)} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      {/* Video modal — portalled to <body> so the routed screen's transform
          can't trap this fixed overlay (same reason as the image lightbox). */}
      {createPortal(
        <AnimatePresence>
          {video && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[210] flex items-center justify-center bg-black/90 p-6"
              onClick={() => setVideo(null)}
            >
            <button
              type="button"
              onClick={() => setVideo(null)}
              aria-label="Fermer"
              className="absolute right-5 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={19} strokeWidth={2} />
            </button>
            <video
              src={video.src}
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] max-w-[90vw] rounded-lg bg-black shadow-2xl"
            >
              {video.mime && <source src={video.src} type={video.mime} />}
            </video>
          </motion.div>
        )}
        </AnimatePresence>,
        document.body,
      )}
    </LightboxProvider>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex items-center border border-border bg-surface">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors duration-150 ${
            value === opt.value ? 'bg-accent-muted text-text-primary' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function MediaTile({
  item,
  senderName,
  onPlayVideo,
}: {
  item: MediaItem;
  senderName: string;
  onPlayVideo: () => void;
}) {
  const { openKey } = useLightbox();

  return (
    <button
      type="button"
      onClick={() => (item.kind === 'image' ? openKey(item.key) : onPlayVideo())}
      className="group relative block aspect-square w-full overflow-hidden rounded-lg border border-border bg-bg"
    >
      {item.kind === 'image' ? (
        <img
          src={item.src}
          alt={item.name || 'Image'}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        />
      ) : (
        <>
          <video src={item.src} preload="metadata" muted className="h-full w-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white">
              <Play size={18} strokeWidth={2} className="ml-0.5" />
            </span>
          </span>
          <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white">
            <Film size={9} strokeWidth={2} />{tr('hist.medialibrary.video')}</span>
        </>
      )}
      {/* Meta on hover */}
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-6 text-left opacity-0 transition-opacity group-hover:opacity-100">
        <span className="truncate text-[11px] font-medium text-white">{senderName}</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-white/70">{relativeTime(item.createdAt)}</span>
      </span>
    </button>
  );
}
