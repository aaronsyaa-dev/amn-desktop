import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../auth/AuthContext';
import { useAppointments } from '../state/useAppointments';
import { useClients } from '../state/useClients';
import { useCollection } from '../state/SyncContext';
import { useInvoices } from '../state/useInvoices';
import { construireReleve, type Observation } from '../lib/releve';

/**
 * LE MAJORDOME — la relève de poste, au ton de la maison (Signes Vitaux).
 *
 * Ouvrir son espace après des heures, c'est LE moment canonique : la première
 * question n'est pas « où sont mes listes » mais « qu'est-ce que j'ai
 * manqué ». Le Majordome y répond en deux lignes et un verdict, composés par
 * la grammaire déterministe de `releve.ts` — aucune IA, aucune invention,
 * uniquement des comptes sur les vraies collections (check:releve).
 *
 * ## Pourquoi il vit DANS la page, et pas en voile par-dessus
 *
 * Le brief imaginait une ouverture immersive skippable. Un voile qui
 * intercepte le premier clic de la journée est pourtant exactement ce qu'on
 * reproche aux applications qui se regardent travailler — et il piégerait le
 * focus d'un lecteur d'écran avant même le contenu. Ici, la relève est le
 * premier paragraphe de la page : les lignes s'écrivent en séquence, rien ne
 * bloque, et « passer » n'a plus besoin d'exister puisqu'on peut simplement…
 * continuer. La version plein-noir immersive reste réservée à la Salle de
 * contrôle, où on ne travaille pas pendant qu'elle parle.
 *
 * ## Le repère du dernier passage
 *
 * `localStorage`, par organisation : c'est une présence PAR POSTE, et c'est
 * honnête ainsi — « pendant votre absence » veut dire absence d'ici. Le
 * repère est posé au montage (après lecture) et reposé quand l'onglet passe
 * en arrière-plan ; une fenêtre laissée ouverte toute la nuit sans fermeture
 * ne déclenche donc pas de relève au matin — limite connue, préférée à une
 * horlogerie de visibilité qui se tromperait plus souvent qu'elle.
 */

function cleDernierPassage(orgId: string): string {
  return `amn.releve.passage.${orgId}`;
}

/*
  LE REPÈRE SE LIT UNE FOIS PAR CHARGEMENT DE PAGE — pas une fois par montage.

  Première version en `useMemo` : la sonde l'a vue mourir. L'écran d'accueil
  se remonte quand la garde d'authentification se résout, et le second montage
  relisait le repère que le premier venait de POSER — absence de trois
  secondes, pas de relève, à chaque fois. Le cache de module survit aux
  remontages : la valeur lue au premier accès de la session de page fait foi
  jusqu'au prochain vrai chargement.
*/
let ecouteurPose = false;
let derniereClePosee: string | null = null;

function passagePrecedent(orgId: string | undefined): Date | null {
  if (!orgId || typeof window === 'undefined') return null;
  const cle = cleDernierPassage(orgId);
  const cleSession = `${cle}.lu`;

  try {
    /*
      LE PREMIER DÉMARRAGE DE L'ONGLET FAIT FOI — les suivants relisent SA
      lecture, pas le battement qu'il vient de poser.

      La sonde a vu la première version mourir deux fois de la même mort :
      d'abord le remontage de l'écran derrière la garde d'authentification,
      puis — corrigé le remontage — le DOUBLE DÉMARRAGE de la PWA : le
      service worker s'installe, prend la page, la recharge, et le second
      démarrage lisait le battement écrit trois cents millisecondes plus tôt.
      « Absence : 0,3 s », silence — à chaque déploiement et à chaque
      première installation. C'est la forme de défaut la plus récidiviste de
      ce dépôt : ce qui est observé est bien enregistré, c'est le réveil qui
      ne survit pas.

      `sessionStorage` survit au rechargement du même onglet et meurt avec
      lui : exactement la durée de vie qu'a « ce que ce démarrage a lu ».
    */
    const deja = window.sessionStorage.getItem(cleSession);
    if (deja !== null) {
      if (deja === 'aucun') return null;
      const t = Date.parse(deja);
      return Number.isFinite(t) ? new Date(t) : null;
    }

    let precedent: Date | null = null;
    const brut = window.localStorage.getItem(cle);
    if (brut) {
      const t = Date.parse(brut);
      if (Number.isFinite(t)) precedent = new Date(t);
    }
    window.sessionStorage.setItem(cleSession, precedent ? precedent.toISOString() : 'aucun');
    window.localStorage.setItem(cle, new Date().toISOString());
    derniereClePosee = cle;
    if (!ecouteurPose) {
      ecouteurPose = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && derniereClePosee) {
          try {
            window.localStorage.setItem(derniereClePosee, new Date().toISOString());
          } catch {
            /* stockage indisponible : le prochain chargement fera sans repère */
          }
        }
      });
    }
    return precedent;
  } catch {
    return null;
  }
}

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
  const mouvementReduit = useReducedMotion();

  const depuis = useMemo(() => passagePrecedent(org?.id), [org?.id]);

  const releve = useMemo(() => {
    if (!depuis) return null;
    /*
      Les observations, comptées ici sur les vraies collections, ordonnées par
      importance pour la personne — l'argent d'abord, puis l'agenda, puis le
      reste. La grammaire n'en garde que deux : le plus important gagne.
    */
    const observations: Observation[] = [
      {
        nombre: invoices.filter((f) => apres(f.createdAt, depuis)).length,
        un: 'une facture créée',
        plusieurs: 'factures créées',
      },
      {
        nombre: appointments.filter(
          (a) => a.status !== 'cancelled' && apres(a.createdAt, depuis),
        ).length,
        un: 'un rendez-vous posé',
        plusieurs: 'rendez-vous posés',
      },
      {
        nombre: clients.filter((c) => apres(c.createdAt, depuis)).length,
        un: 'une nouvelle fiche client',
        plusieurs: 'nouvelles fiches clients',
      },
      {
        nombre: taches.filter((t) => apres(t.createdAt, depuis)).length,
        un: 'une tâche ajoutée',
        plusieurs: 'tâches ajoutées',
      },
    ];
    return construireReleve({
      depuis,
      maintenant: new Date(),
      observations,
      attentions,
      ton: 'majordome',
    });
  }, [depuis, invoices, appointments, clients, taches, attentions]);

  if (!releve) return null;

  /*
    Les lignes s'écrivent en séquence — l'une APRÈS l'autre, pas un typewriter
    lettre à lettre (lent, criard, et illisible pour un lecteur d'écran). En
    mouvement réduit, tout est là d'emblée. `aria-live` est inutile : le bloc
    est présent au premier rendu, un lecteur d'écran le lit en ordre normal.
  */
  return (
    <motion.section
      aria-label="Pendant votre absence"
      initial={mouvementReduit ? false : 'cache'}
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.9, delayChildren: 0.4 } } }}
      className="panel-ticks border border-border bg-surface px-5 py-4"
    >
      <motion.p
        variants={{ cache: { opacity: 0, y: 4 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45 } } }}
        className="eyebrow"
      >
        {releve.entete}
      </motion.p>
      <div className="mt-2 flex flex-col gap-1">
        {releve.lignes.map((ligne, i) => {
          const verdict = i === releve.lignes.length - 1;
          return (
            <motion.p
              key={ligne}
              variants={{
                cache: { opacity: 0, y: 4 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
              }}
              className={
                verdict
                  ? 'text-v4 font-medium text-text-primary'
                  : 'text-v4 text-text-secondary'
              }
            >
              {ligne}
            </motion.p>
          );
        })}
      </div>
    </motion.section>
  );
}
