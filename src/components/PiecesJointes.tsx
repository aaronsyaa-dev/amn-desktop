import React, { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, Eye, EyeOff, FileText, Film, Image as ImageIcon, Loader2, Paperclip, X } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { downloadBlob } from '../lib/download';
import type { PieceJointe } from '../shared/api';

/**
 * LES PIÈCES JOINTES — joindre un PDF (ou une image, une courte vidéo) à un enregistrement.
 *
 * Constat : impossible de joindre un PDF nulle part — ni aux Tâches, ni au Classeur. Le fichier part
 * côté serveur (`/v1/fichiers`, 8 Mo au plus, cloisonné par organisation) ; l'enregistrement ne garde
 * que la référence (`PieceJointe`). Ouvrir le relit à la demande : rien ne voyage dans la
 * synchronisation.
 *
 * `accepte` : ce que le sélecteur propose (le serveur, lui, vérifie le type ET la signature du fichier).
 */
export const ACCEPTE_PDF = 'application/pdf';
export const ACCEPTE_MEDIA = 'application/pdf,image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime';
const TAILLE_MAX = 8 * 1024 * 1024;

export const taille = (o: number) => (o >= 1024 * 1024 ? `${(o / 1024 / 1024).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`);
const estElectron = () => typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent);

function lireEnBase64(f: File): Promise<string> {
  return new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => ko(new Error('Lecture du fichier impossible.'));
    r.readAsDataURL(f);
  });
}

/** Relit le fichier et le rend comme `Blob` (pour l'ouvrir, le télécharger ou l'afficher). */
export async function blobDe(p: PieceJointe): Promise<Blob> {
  const { base64 } = await bridge().remote.fichiers.lire(p.id);
  const bin = atob(base64);
  const octets = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
  return new Blob([octets], { type: p.mime });
}

/** Dépose des fichiers ; rend les références créées, et les erreurs en clair. */
export async function deposer(fichiers: File[]): Promise<{ pieces: PieceJointe[]; erreurs: string[] }> {
  const pieces: PieceJointe[] = [];
  const erreurs: string[] = [];
  for (const f of fichiers) {
    if (f.size > TAILLE_MAX) {
      erreurs.push(`« ${f.name} » fait ${taille(f.size)} : 8 Mo au plus.`);
      continue;
    }
    try {
      pieces.push(await bridge().remote.fichiers.envoyer({ nom: f.name, type: f.type || 'application/octet-stream', base64: await lireEnBase64(f) }));
    } catch (e) {
      erreurs.push(`« ${f.name} » : ${e instanceof Error ? e.message : 'envoi impossible'}`);
    }
  }
  return { pieces, erreurs };
}

const Icone = ({ mime }: { mime: string }) => {
  const P = mime.startsWith('video/') ? Film : mime.startsWith('image/') ? ImageIcon : FileText;
  return <P size={14} strokeWidth={1.9} aria-hidden className="flex-none text-text-secondary" />;
};

export function PiecesJointes({
  pieces,
  onChange,
  accepte = ACCEPTE_PDF,
  libelle = 'Joindre un PDF',
  lectureSeule = false,
}: {
  pieces: PieceJointe[];
  onChange: (pieces: PieceJointe[]) => void;
  accepte?: string;
  libelle?: string;
  lectureSeule?: boolean;
}) {
  const entree = useRef<HTMLInputElement>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupee, setOccupee] = useState<string | null>(null);
  /* L'aperçu dans l'application : une vidéo se lit, une image s'affiche, sans rien télécharger ni changer de fenêtre. */
  const [apercu, setApercu] = useState<{ id: string; url: string; mime: string } | null>(null);
  useEffect(
    () => () => {
      if (apercu) URL.revokeObjectURL(apercu.url);
    },
    [apercu],
  );
  const basculerApercu = async (p: PieceJointe) => {
    if (apercu?.id === p.id) return setApercu(null);
    setOccupee(p.id);
    try {
      setApercu({ id: p.id, url: URL.createObjectURL(await blobDe(p)), mime: p.mime });
    } catch (e) {
      setErreur(`« ${p.name} » ne se lit pas : ${e instanceof Error ? e.message : 'fichier introuvable'}.`);
    } finally {
      setOccupee(null);
    }
  };

  const ajouter = async (liste: File[]) => {
    if (!liste.length) return;
    setEnvoi(true);
    setErreur(null);
    const { pieces: nouvelles, erreurs } = await deposer(liste);
    setEnvoi(false);
    if (nouvelles.length) onChange([...pieces, ...nouvelles]);
    if (erreurs.length) setErreur(erreurs.join(' '));
  };
  const ouvrir = async (p: PieceJointe, telecharger: boolean) => {
    setOccupee(p.id);
    setErreur(null);
    try {
      const blob = await blobDe(p);
      // Dans l'application installée, une fenêtre sur un contenu en mémoire est refusée : on enregistre le fichier.
      if (telecharger || estElectron()) downloadBlob(blob, p.name);
      else {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (e) {
      setErreur(`« ${p.name} » ne s’ouvre pas : ${e instanceof Error ? e.message : 'fichier introuvable'}.`);
    } finally {
      setOccupee(null);
    }
  };
  const retirer = (p: PieceJointe) => {
    onChange(pieces.filter((x) => x.id !== p.id));
    void bridge()
      .remote.fichiers.supprimer(p.id)
      .catch(() => undefined);
  };

  return (
    <div data-pieces-jointes>
      {pieces.length > 0 && (
        <ul className="mb-2 flex flex-col gap-1">
          {pieces.map((p) => (
            <li key={p.id} className="flex items-center gap-2 border border-border px-2.5 py-1.5 text-[12.5px]">
              <Icone mime={p.mime} />
              <span className="min-w-0 flex-1 truncate text-text-primary" title={p.name}>
                {p.name}
              </span>
              <span className="flex-none font-mono text-[10.5px] text-text-muted">{taille(p.size)}</span>
              {occupee === p.id ? (
                <Loader2 size={14} className="animate-spin text-text-muted" aria-label="Ouverture…" />
              ) : (
                <>
                  {(p.mime.startsWith('video/') || p.mime.startsWith('image/')) && (
                    <button
                      type="button"
                      onClick={() => void basculerApercu(p)}
                      className="flex min-h-8 min-w-8 items-center justify-center text-text-secondary hover:text-text-primary"
                      aria-label={`${apercu?.id === p.id ? 'Fermer l’aperçu de' : 'Aperçu de'} ${p.name}`}
                      title={apercu?.id === p.id ? 'Fermer l’aperçu' : p.mime.startsWith('video/') ? 'Lire ici' : 'Voir ici'}
                      aria-pressed={apercu?.id === p.id}
                    >
                      {apercu?.id === p.id ? <EyeOff size={14} strokeWidth={1.9} /> : <Eye size={14} strokeWidth={1.9} />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void ouvrir(p, false)}
                    className="flex min-h-8 min-w-8 items-center justify-center text-text-secondary hover:text-text-primary"
                    aria-label={`Ouvrir ${p.name}`}
                    title="Ouvrir"
                  >
                    <ExternalLink size={14} strokeWidth={1.9} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void ouvrir(p, true)}
                    className="flex min-h-8 min-w-8 items-center justify-center text-text-secondary hover:text-text-primary"
                    aria-label={`Télécharger ${p.name}`}
                    title="Télécharger"
                  >
                    <Download size={14} strokeWidth={1.9} />
                  </button>
                </>
              )}
              {!lectureSeule && (
                <button
                  type="button"
                  onClick={() => retirer(p)}
                  className="flex min-h-8 min-w-8 items-center justify-center text-text-muted hover:text-text-primary"
                  aria-label={`Retirer ${p.name}`}
                  title="Retirer"
                >
                  <X size={14} strokeWidth={1.9} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {apercu && (
        <div className="mb-2 border border-border bg-bg p-2" data-apercu-media>
          {apercu.mime.startsWith('video/') ? (
            <video src={apercu.url} controls playsInline className="max-h-[360px] w-full" aria-label={pieces.find((x) => x.id === apercu.id)?.name} />
          ) : (
            <img src={apercu.url} alt={pieces.find((x) => x.id === apercu.id)?.name ?? ''} className="max-h-[360px] w-full object-contain" />
          )}
        </div>
      )}
      {!lectureSeule && (
        <>
          <button
            type="button"
            onClick={() => entree.current?.click()}
            disabled={envoi}
            className="inline-flex min-h-9 items-center gap-2 border border-dashed border-border px-3 text-[12.5px] text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-60"
          >
            {envoi ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} strokeWidth={1.9} />}
            {envoi ? 'Envoi…' : libelle}
          </button>
          <input
            ref={entree}
            type="file"
            accept={accepte}
            multiple
            hidden
            aria-label={libelle}
            onChange={(e) => {
              void ajouter([...(e.target.files ?? [])]);
              e.target.value = '';
            }}
          />
        </>
      )}
      {erreur && (
        <p className="mt-1.5 text-[12px] text-danger-ink" role="alert">
          {erreur}
        </p>
      )}
    </div>
  );
}
