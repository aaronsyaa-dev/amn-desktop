import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Contact, ImagePlus, Loader2, X } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { useClients } from '../state/useClients';
import { useCollection, useSync, uid, stripMeta } from '../state/SyncContext';
import { resizeImageToDataUrl } from '../lib/imageResize';
import { relativeTime } from '../lib/time';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useFermetureEchap } from '../lib/useFermetureEchap';

/**
 * Médiathèque de l'édition Business.
 *
 * La médiathèque interne n'est pas un stockage : c'est une vue dérivée des
 * pièces jointes du chat d'équipe. Sans chat, elle n'aurait rien à afficher —
 * d'où une collection `media` à part, où les fichiers sont déposés
 * directement.
 *
 * Les images sont redimensionnées côté client avant d'être stockées en
 * data-URL, exactement comme les photos de fiches clients : au-delà, il
 * faudrait un vrai stockage objet côté amn-api, ce qui est un autre chantier.
 * La limite est donc annoncée à l'écran plutôt que découverte à l'usage.
 */

const MAX_DIMENSION = 1600;

interface MediaData {
  name: string;
  dataUrl: string;
  clientId: number | null;
  clientName: string;
  createdAt: string;
}

export function MediaSoloScreen() {
  const { upsert, remove } = useSync();
  const { clients } = useClients();
  const rows = useCollection<Partial<MediaData>>('media');
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [preview, setPreview] = useState<string | null>(null);

  /*
    L'aperçu plein écran se ferme à Échap. Sortir d'un plein écran est
    précisément ce que cette touche fait partout ailleurs — dans le
    navigateur, dans le lecteur vidéo, dans le système.
  */
  useFermetureEchap(preview !== null, () => setPreview(null));

  const items = useMemo(
    () =>
      rows
        .map((row) => ({
          id: row.id,
          name: row.name ?? 'Sans nom',
          dataUrl: row.dataUrl ?? '',
          clientId: row.clientId ?? null,
          clientName: row.clientName ?? '',
          createdAt: row.createdAt ?? row.updatedAt,
        }))
        .filter((item) => item.dataUrl)
        .filter((item) => !filter || String(item.clientId) === filter)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [rows, filter],
  );

  const onPick = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(fileList)) {
        if (!file.type.startsWith('image/')) {
          setError('Pour l’instant, seules les images sont acceptées.');
          continue;
        }
        const dataUrl = await resizeImageToDataUrl(file, MAX_DIMENSION);
        const linked = filter ? clients.find((c) => String(c.id) === filter) : undefined;
        upsert('media', uid('media'), {
          name: file.name,
          dataUrl,
          clientId: linked ? linked.id : null,
          clientName: linked ? linked.name : '',
          createdAt: new Date().toISOString(),
        } satisfies MediaData);
      }
    } catch {
      setError('Impossible de lire ce fichier.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const relink = (id: string, clientId: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const linked = clientId ? clients.find((c) => String(c.id) === clientId) : undefined;
    upsert('media', id, {
      ...stripMeta(row),
      clientId: linked ? linked.id : null,
      clientName: linked ? linked.name : '',
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/*
        `ScreenHeader`, comme les vingt-six écrans de l'autre édition.

        Cet écran écrivait son titre à la main, en `text-lg` — 18 px, contre
        les 22 à 24 du composant. Son jumeau interne (`MediaLibraryScreen`)
        passe par `ScreenHeader` depuis la refonte. Deux voix pour le même
        produit, et c'est l'édition CLIENTE qui avait la moins soignée.

        Le contrôle `check:ecrans` ne pouvait pas le voir : il ne lisait que
        `src/screens/`. Il lit désormais `src/business/` aussi.
      */}
      <ScreenHeader
        eyebrow="Mon espace · Médias"
        title="Médias"
        description="Photos et fichiers de votre activité, rassemblés."
        stats={[
          { label: 'Éléments', value: items.length },
          { label: 'Clients', value: new Set(items.map((i) => i.clientId).filter(Boolean)).size },
        ]}
        actions={
          <>
          <select
            // Un `<select>` sans étiquette s'annonce « liste déroulante », et
            // rien de plus : on ne sait pas ce qu'il filtre. La première
            // option porte le sens à l'œil, jamais à l'oreille.
            aria-label="Filtrer par cliente"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input-focus cursor-pointer border border-border bg-surface px-2.5 py-2 font-mono text-[10px] uppercase tracking-wider text-text-secondary outline-none"
          >
            <option value="">Tous les clients</option>
            {clients.map((client) => (
              <option key={client.id} value={String(client.id)}>
                {client.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} strokeWidth={2} />}
            Ajouter
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => void onPick(e.target.files)}
          />
          </>
        }
      />

      {error && (
        <p role="alert" className="border border-danger/40 bg-danger-muted px-3 py-2 font-mono text-xs text-danger">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-secondary">
            {filter ? 'Aucun média pour ce client.' : 'Aucun média pour l’instant.'}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Les images sont réduites à {MAX_DIMENSION} px avant d’être enregistrées
          </p>
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {items.map((item) => (
            <motion.figure
              key={item.id}
              variants={staggerItem}
              className="flex flex-col border border-border bg-surface"
            >
              <button
                type="button"
                onClick={() => setPreview(item.dataUrl)}
                className="aspect-square overflow-hidden bg-bg"
              >
                <img
                  src={item.dataUrl}
                  alt={item.name}
                  className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
                />
              </button>
              <figcaption className="flex flex-col gap-1.5 p-2">
                <span className="truncate text-xs text-text-primary">{item.name}</span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
                  {relativeTime(item.createdAt)}
                </span>
                <div className="flex items-center gap-1">
                  <Contact size={11} strokeWidth={1.75} className="flex-shrink-0 text-text-muted" />
                  <select
                    value={item.clientId === null ? '' : String(item.clientId)}
                    onChange={(e) => relink(item.id, e.target.value)}
                    className="input-focus min-w-0 flex-1 cursor-pointer border border-border bg-bg px-1 py-0.5 font-mono text-[9px] text-text-secondary outline-none"
                  >
                    <option value="">Sans client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={String(client.id)}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                  <ConfirmDelete onConfirm={() => remove('media', item.id)} label="Supprimer le média" size={12} />
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreview(null)}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-6"
          >
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => setPreview(null)}
              className="absolute right-4 top-4 text-white/70 hover:text-white"
            >
              <X size={20} strokeWidth={2} />
            </button>
            <img src={preview} alt="" className="max-h-full max-w-full object-contain" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
