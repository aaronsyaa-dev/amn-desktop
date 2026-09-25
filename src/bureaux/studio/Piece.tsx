import React from 'react';
import { useParams } from 'react-router-dom';
import { StudioCroquis } from './Croquis';
import { StudioPrompts } from './Prompts';
import { StudioNotes } from './Notes';
import { StudioAnalytique } from './Analytique';
import { StudioLivraison } from './Livraison';
import { StudioRetours } from './Retours';
import type { OngletPiece } from './commun';

/** La pièce projet (cahier 14, `48a`–`48d`) : un onglet par adresse, le mur par défaut. */
const ONGLETS: Record<OngletPiece, () => React.ReactElement> = {
  croquis: StudioCroquis,
  prompts: StudioPrompts,
  notes: StudioNotes,
  analytique: StudioAnalytique,
  livraison: StudioLivraison,
  retours: StudioRetours,
};

export function StudioPiece() {
  const { onglet } = useParams();
  const Ecran = ONGLETS[(onglet ?? 'croquis') as OngletPiece] ?? StudioCroquis;
  return <Ecran />;
}
