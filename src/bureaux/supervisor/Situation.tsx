import React from 'react';
import { EnTete } from '../ui/kit';
import { SalleDeSituation } from '../../refonte/garde/SalleDeSituation';
import { useGardeLangue } from '../../refonte/garde/i18n';

/**
 * SUPERVISOR · LA SALLE DE SITUATION (refonte S3) — la même vue que la veille,
 * posée dans le bureau, pour qui veut la regarder sans attendre quatre minutes.
 *
 * Route ajoutée (`/supervisor/situation`), aucune route existante touchée ;
 * elle n'a pas d'onglet : on y entre depuis l'accueil du Supervisor.
 */
export function SupervisorSituation() {
  const { tg } = useGardeLangue();
  return (
    <>
      <EnTete surtitre={tg('salle.page.surtitre')} titre={tg('salle.page.titre')} lede={tg('salle.page.lede')} />
      <SalleDeSituation />
    </>
  );
}
