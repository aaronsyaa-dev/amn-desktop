import { CoquilleSection } from '../refonte/coquille/CoquilleSection';
import { EcranDeVeilleSection } from '../refonte/systeme/veille/EcranDeVeilleSection';
import React, { useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { configMotion, choixMouvement, ecrireMouvement, NIVEAUX_MOUVEMENT, systemeDemandeMoins, useMouvement, type NiveauMouvement } from '../socle/mouvement';
import { poserJournal } from '../socle/moments';
import { useSocleLangue, type CleSocle } from '../socle/i18n';
import { Bouton, Carte, PastilleEtat, Segmente } from '../socle/ui';

/**
 * LE SOCLE DE LA REFONTE, CÔTÉ INTERNE — ce que l'édition interne branche.
 *
 * L'édition cliente reçoit `socle.business.tsx` à la place : une racine qui
 * rend ses enfants telle quelle, et une section de réglages vide. Rien de ce
 * fichier — ni le réglage, ni le journal des moments — n'entre dans son
 * paquet.
 *
 * ## La racine
 *
 * Posée dans `src/renderer.tsx`, SOUS le `MotionConfig reducedMotion="user"`
 * commun : un `MotionConfig` imbriqué hérite de son parent et le remplace là
 * où il redéfinit (framer-motion fusionne les deux). Tout l'arbre — le splash
 * compris — suit donc le réglage Mouvement. Elle pose aussi
 * `data-mouvement` sur <html> pour les animations CSS (voir index.css).
 *
 * En développement (`npm start`), elle branche le journal du bus de moments
 * sur la console. Jamais dans un paquet construit.
 */
export function RacineSocle({ children }: { children: React.ReactNode }) {
  const niveau = useMouvement();

  useEffect(() => {
    document.documentElement.dataset.mouvement = niveau;
  }, [niveau]);

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    poserJournal((m) => console.debug(`[moment] ${m.type}`, m.charge));
    return () => poserJournal(null);
  }, []);

  return <MotionConfig {...configMotion(niveau)}>{children}</MotionConfig>;
}

const LIBELLES: Record<NiveauMouvement, { titre: CleSocle; aide: CleSocle }> = {
  complet: { titre: 'mouvement.complet', aide: 'mouvement.complet.aide' },
  reduit: { titre: 'mouvement.reduit', aide: 'mouvement.reduit.aide' },
  aucun: { titre: 'mouvement.aucun', aide: 'mouvement.aucun.aide' },
};

/**
 * LES ANCRES DES RÉGLAGES. `SettingsScreen` (partagé, non modifié) pose un `id="reglages-<rubrique>"` sur chacune
 * de ses rubriques, et son plan y défile. Un écran de la refonte qui envoie aux Réglages (H40 « Réglages » → la
 * rubrique Notifications) passe la rubrique dans l'état de navigation : `navigate('/settings', { state: { section:
 * 'notifications' } })`. Les trois surfaces de LOT-00 ci-dessous ont aussi la leur.
 */
export const ANCRES_REGLAGES = ['profil', 'accueil', 'securite', 'notifications', 'apparence', 'poste', 'modules', 'donnees', 'mouvement', 'ecran-de-veille', 'coquille'] as const;

/** L'identifiant à faire défiler pour une rubrique demandée, ou `null` si elle n'existe pas (rien ne bouge). */
export function ancreDeReglages(section: unknown): string | null {
  return typeof section === 'string' && (ANCRES_REGLAGES as readonly string[]).includes(section) ? `reglages-${section}` : null;
}

/** Fait défiler les Réglages jusqu'à la rubrique demandée par l'écran qui y envoie. Ne rend rien. */
function AncreDesReglages() {
  const { state } = useLocation();
  const niveau = useMouvement();
  const ancre = ancreDeReglages((state as { section?: unknown } | null)?.section);
  useEffect(() => {
    if (!ancre) return undefined;
    // Les rubriques entrent en cascade : on attend deux images avant de défiler, et sans glissement si le mouvement est réduit.
    let seconde = 0;
    const premiere = requestAnimationFrame(() => {
      seconde = requestAnimationFrame(() => document.getElementById(ancre)?.scrollIntoView({ behavior: niveau === 'complet' ? 'smooth' : 'auto', block: 'start' }));
    });
    return () => {
      cancelAnimationFrame(premiere);
      cancelAnimationFrame(seconde);
    };
  }, [ancre, niveau]);
  return null;
}

/**
 * La porte des Réglages de la refonte : le réglage Mouvement, l'écran de veille
 * (G09, ligne de H18), puis la nouvelle coquille (session DS). Une seule porte,
 * pour que `SettingsScreen` — partagé par les deux éditions — n'ait pas à
 * connaître les suivantes : le paquet client reste identique octet pour octet.
 *
 * Trois surfaces, chacune la sienne (demande du dirigeant : aucun gabarit
 * générique) : Mouvement choisit un niveau dans un segmenté ; l'écran de
 * veille s'allume d'un interrupteur et règle deux délais (segmenté, liste) ;
 * la nouvelle coquille dit ce qu'elle apporte et s'allume d'un interrupteur.
 */
export function MouvementSection() {
  return (
    <>
      <AncreDesReglages />
      <MouvementBloc />
      <EcranDeVeilleSection />
      <CoquilleSection />
    </>
  );
}

/**
 * MOUVEMENT — un niveau parmi trois, dans un segmenté (flèches au clavier) ; sous lui, ce que le niveau choisi
 * fait ; la note du système s'il demande moins ; « Suivre le système » quand un choix est écrit sur ce poste.
 */
function MouvementBloc() {
  const { ts } = useSocleLangue();
  const niveau = useMouvement();
  const choisi = choixMouvement() !== null;
  const systeme = systemeDemandeMoins();

  return (
    <div id="reglages-mouvement" data-reglage="mouvement">
      <Carte titre={ts('mouvement.titre')} actions={<PastilleEtat etat={choisi ? 'info' : 'neutre'}>{ts(LIBELLES[niveau].titre)}</PastilleEtat>}>
        <p className="mb-3 max-w-2xl">{ts('mouvement.texte')}</p>
        <Segmente libelle={ts('mouvement.choix')} options={NIVEAUX_MOUVEMENT.map((n) => ({ cle: n, libelle: ts(LIBELLES[n].titre) }))} valeur={niveau} onChange={(cle) => ecrireMouvement(cle as NiveauMouvement)} />
        <p aria-live="polite" className="mt-2 max-w-2xl text-[12.5px]">
          {ts(LIBELLES[niveau].aide)}
        </p>
        {systeme && !choisi && <p className="mt-2 max-w-2xl text-[12.5px]">{ts('mouvement.systeme')}</p>}
        {choisi && (
          <div className="mt-3">
            <Bouton variante="discret" taille="petit" onClick={() => ecrireMouvement(null)}>
              {ts('mouvement.revenirSysteme')}
            </Bouton>
          </div>
        )}
      </Carte>
    </div>
  );
}

/**
 * `emit` pour le code PARTAGÉ (ajout S2) : un fichier commun aux deux éditions
 * n'importe jamais `src/socle/**` ; il passe par `@edition/socle`. Ici, c'est
 * le vrai bus ; côté cliente, une fonction qui ne fait rien.
 */
export { emit as emettreMoment } from '../socle/moments';
