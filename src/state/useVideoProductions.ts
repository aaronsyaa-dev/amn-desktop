import { useCallback, useMemo } from 'react';
import { useSync, useCollection, uid, stripMeta } from './SyncContext';
import { oneOf } from '../lib/records';
import type { PieceJointe } from '../shared/api';

/**
 * PRODUCTION VIDÉO — une fiche par vidéo, de l'idée à la publication.
 *
 * Même contrat que les autres modules synchronisés (voir `useAppointments.ts`) :
 * amn-api est la source durable, chaque écriture est posée par organisation et
 * repoussée en direct aux autres sessions de la MÊME organisation.
 *
 * Demande d'origine : Syraagensy veut suivre une vidéo de bout en bout — l'idée,
 * le tournage, le montage, la sortie — sans se reposer sur un fil de discussion
 * ou un tableur à part.
 */

export type StatutProductionVideo = 'idee' | 'tournage' | 'montage' | 'publie';

/** Le même domaine, disponible à l'exécution — un type seul ne vérifie rien. */
const STATUTS_PRODUCTION_VIDEO: StatutProductionVideo[] = ['idee', 'tournage', 'montage', 'publie'];

export const STATUT_LABEL: Record<StatutProductionVideo, string> = {
  idee: 'Idée',
  tournage: 'En tournage',
  montage: 'En montage',
  publie: 'Publié',
};

/** Une personne présente sur la conception : un compte de l'organisation, par e-mail. */
export interface PersonneConception {
  email: string;
  nom: string;
}

/** Le contact propre à CETTE vidéo — pas nécessairement une fiche client existante. */
export interface ContactVideo {
  nom: string;
  role: string;
  telephone: string;
  email: string;
  notes: string;
}

export interface VideoProduction {
  id: string;
  // Conception
  idee: string;
  synopsis: string;
  /** Jour de tournage prévu ou passé, ISO (AAAA-MM-JJ) — ou vide si pas encore fixé. */
  jourDeTournage: string;
  texteALire: string;
  /** Un lien d'inspiration (Pinterest, Instagram, une page…), en plus des images jointes. */
  inspiLien: string;
  /** Images d'inspiration envoyées (stockées côté serveur comme les autres pièces jointes). */
  inspiPieces: PieceJointe[];
  // Statut
  /** Jour de sortie prévu, ISO — ou vide si pas encore fixé. */
  jourDeSortiePrevu: string;
  statut: StatutProductionVideo;
  // Détails
  description: string;
  /** Le compte sur lequel la vidéo sort (« Instagram @syraagensy », « YouTube — chaîne principale »…). */
  comptePublication: string;
  personnesPresentes: PersonneConception[];
  contact: ContactVideo;
  createdAt: string;
  updatedAt: string;
}

const CONTACT_VIDE: ContactVideo = { nom: '', role: '', telephone: '', email: '', notes: '' };

type VideoProductionData = Omit<VideoProduction, 'id' | 'updatedAt'>;

export interface VideoProductionDraft {
  idee: string;
  synopsis: string;
  jourDeTournage: string;
  texteALire: string;
  inspiLien: string;
  jourDeSortiePrevu: string;
  statut: StatutProductionVideo;
  description: string;
  comptePublication: string;
  personnesPresentes: PersonneConception[];
  contact: ContactVideo;
}

export function brouillonVide(): VideoProductionDraft {
  return {
    idee: '',
    synopsis: '',
    jourDeTournage: '',
    texteALire: '',
    inspiLien: '',
    jourDeSortiePrevu: '',
    statut: 'idee',
    description: '',
    comptePublication: '',
    personnesPresentes: [],
    contact: { ...CONTACT_VIDE },
  };
}

export function useVideoProductions() {
  const { upsert, remove } = useSync();
  const raw = useCollection<Partial<VideoProductionData>>('videoProductions');

  const videos = useMemo<VideoProduction[]>(() => {
    return raw
      .map((row) => ({
        id: row.id,
        idee: row.idee ?? '',
        synopsis: row.synopsis ?? '',
        jourDeTournage: row.jourDeTournage ?? '',
        texteALire: row.texteALire ?? '',
        inspiLien: row.inspiLien ?? '',
        inspiPieces: Array.isArray(row.inspiPieces) ? row.inspiPieces : [],
        jourDeSortiePrevu: row.jourDeSortiePrevu ?? '',
        // `oneOf` : une valeur inconnue stockée (une liste de statuts éditée depuis une
        // ancienne version) se lit comme « Idée » plutôt que de faire tomber l'écran.
        statut: oneOf(row.statut, STATUTS_PRODUCTION_VIDEO, 'idee'),
        description: row.description ?? '',
        comptePublication: row.comptePublication ?? '',
        personnesPresentes: Array.isArray(row.personnesPresentes) ? row.personnesPresentes : [],
        contact: row.contact ? { ...CONTACT_VIDE, ...row.contact } : { ...CONTACT_VIDE },
        createdAt: row.createdAt ?? row.updatedAt,
        updatedAt: row.updatedAt,
      }))
      .sort((a, b) => (b.jourDeSortiePrevu || b.createdAt).localeCompare(a.jourDeSortiePrevu || a.createdAt));
  }, [raw]);

  const creerVideo = useCallback(
    (draft: VideoProductionDraft): string => {
      const id = uid('vid');
      upsert('videoProductions', id, {
        ...draft,
        inspiPieces: [],
        createdAt: new Date().toISOString(),
      } satisfies VideoProductionData);
      return id;
    },
    [upsert],
  );

  const patchVideo = useCallback(
    (id: string, patch: Partial<VideoProductionData>) => {
      const current = raw.find((r) => r.id === id);
      if (!current) return;
      upsert('videoProductions', id, { ...stripMeta(current), ...patch });
    },
    [raw, upsert],
  );

  const supprimerVideo = useCallback((id: string) => remove('videoProductions', id), [remove]);

  return { videos, creerVideo, patchVideo, supprimerVideo };
}
