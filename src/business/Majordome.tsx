import React, { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useAppointments } from '../state/useAppointments';
import { useClients } from '../state/useClients';
import { useCollection } from '../state/SyncContext';
import { useInvoices } from '../state/useInvoices';
import { passagePrecedent, RelevePoste } from '../components/RelevePoste';
import type { Observation } from '../lib/releve';
import { useLangue } from '../i18n';

/**
 * LE MAJORDOME — la relève de poste, au ton de la maison.
 *
 * Ce fichier ne fait plus qu'une chose : COMPTER, sur les vraies collections
 * de l'édition cliente, ce qui est arrivé pendant l'absence. La grammaire vit
 * dans `releve.ts` (check:releve), la mise en scène et le repère de passage
 * dans `RelevePoste` — partagés avec la relève SOC de l'accueil interne, pour
 * que les deux tons ne divergent jamais. C'est le motif de défaut le plus
 * fréquent du dépôt : la même règle écrite à deux endroits.
 */

interface TacheLigne {
  status?: string;
  createdAt?: string;
}

const apres = (date: string | undefined, seuil: Date): boolean => {
  if (!date) return false;
  const t = Date.parse(date);
  return Number.isFinite(t) && t > seuil.getTime();
};

export function Majordome({ attentions }: { attentions: number }) {
  const { org } = useAuth();
  const { appointments } = useAppointments();
  const { clients } = useClients();
  const { invoices } = useInvoices();
  const taches = useCollection<TacheLigne>('tasks');
  const { t, langue } = useLangue();

  const depuis = useMemo(() => passagePrecedent(org?.id), [org?.id]);

  /*
    Les observations, comptées sur les vraies collections et ordonnées par
    importance pour la personne — l'argent d'abord, puis l'agenda, puis le
    reste. La grammaire n'en garde que deux : le plus important gagne.
  */
  const observations = useMemo((): Observation[] => {
    if (!depuis) return [];
    return [
      {
        nombre: invoices.filter((f) => apres(f.createdAt, depuis)).length,
        un: t('relev.facture.un'),
        plusieurs: t('relev.facture.des'),
      },
      {
        nombre: appointments.filter((a) => a.status !== 'cancelled' && apres(a.createdAt, depuis))
          .length,
        un: t('relev.rdv.un'),
        plusieurs: t('relev.rdv.des'),
      },
      {
        nombre: clients.filter((c) => apres(c.createdAt, depuis)).length,
        un: t('relev.fiche.un'),
        plusieurs: t('relev.fiche.des'),
      },
      {
        nombre: taches.filter((t) => apres(t.createdAt, depuis)).length,
        un: t('relev.tache.un'),
        plusieurs: t('relev.tache.des'),
      },
    ];
  }, [depuis, invoices, appointments, clients, taches, langue]);

  return (
    <RelevePoste depuis={depuis} observations={observations} attentions={attentions} ton="majordome" />
  );
}
