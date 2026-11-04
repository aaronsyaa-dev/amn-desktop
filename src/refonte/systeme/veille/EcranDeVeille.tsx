import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { EDITION_PRODUCT_NAME } from '../../../edition/edition';
import { useInactivite } from '../../../lib/useInactivite';
import { useSourceBureaux } from '../../../bureaux/donnees/source';
import { useMouvementVivant } from '../../../socle/couche-mouvement';
import { usePoulsGarde } from '../../coquille/pouls';
import { useBlocageVeille } from './useBlocageVeille';
import { etatPastille, prochaineRonde } from './etat';
import { useMots } from './i18n';
import { IdleScreen } from './IdleScreen';
import { useReglageVeille } from './reglage';
import { avantLaMinute, deriveDeLaMinute } from './temps';
import { VueVeille } from './VueVeille';
import { tirerRepereEnVeille } from './WatchOrbit';

/**
 * L'ÉCRAN DE VEILLE (G09), BRANCHÉ — ce que monte `IdleScreensaver` quand la nouvelle coquille est allumée.
 *
 * Déclenchement : `useInactivite` (la détection partagée, inchangée) avec le délai du réglage H18 ; coupé si la
 * veille est désactivée, et tant qu'un appel, un partage d'écran, une dictée ou une vidéo est en cours
 * (`useBlocageVeille`). L'événement `amn:veille-ouverte` part à l'ouverture, comme avant (les bureaux y terminent
 * leur session).
 *
 * Données — trois, et rien d'autre : l'horloge du poste (à la minute) ; l'état global de La Garde, par la règle de
 * la pastille de l'en-tête (`usePoulsGarde`) et le réseau du poste ; l'heure de la prochaine ronde (la plus proche
 * `prochaineRondeAt` à venir des gardes actives, dans la Salle déjà lue par la source des bureaux). Ni nom, ni
 * montant, ni texte : seuls un état et deux heures arrivent à la vue.
 *
 * Verrouillage : l'application n'a pas de verrouillage de l'espace après inactivité. On n'en crée pas : la vue
 * ne dit ni « Espace verrouillé » ni « verrouillage après … » (`verrouille={false}`, `verrouApresMin={null}`), et
 * le délai réglé reste enregistré sans effet. Le jour où un verrou réel existe, il se branche ici.
 */
export function EcranDeVeille() {
  const reglage = useReglageVeille();
  const blocage = useBlocageVeille();
  const delai = reglage.actif && blocage === null ? reglage.veilleMin * 60_000 : null;
  const { actif, reveiller } = useInactivite(delai);
  const { tm } = useMots();

  // La veille termine la session des bureaux : la prochaine entrée dans un bureau rejoue son sas (cahier 11 §3).
  useEffect(() => {
    if (actif) window.dispatchEvent(new Event('amn:veille-ouverte'));
  }, [actif]);

  return (
    <IdleScreen ouvert={actif} libelle={tm('calque')} onReprendre={reveiller}>
      <VeilleBranchee veilleMin={reglage.veilleMin} />
    </IdleScreen>
  );
}

/** L'heure du poste, relue à chaque minute pleine (jamais de secondes à l'écran). */
function useMinute(): Date {
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const suivante = () => {
      id = setTimeout(() => {
        setMaintenant(new Date());
        suivante();
      }, avantLaMinute(new Date()) + 50);
    };
    suivante();
    return () => clearTimeout(id);
  }, []);
  return maintenant;
}

const abonnerReseau = (rappel: () => void) => {
  window.addEventListener('online', rappel);
  window.addEventListener('offline', rappel);
  return () => {
    window.removeEventListener('online', rappel);
    window.removeEventListener('offline', rappel);
  };
};
const enLigneMaintenant = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

const abonnerTaille = (rappel: () => void) => {
  window.addEventListener('resize', rappel);
  return () => window.removeEventListener('resize', rappel);
};
/** Le dessin de 1440 × 900, ramené à la fenêtre (les marges de 48 px, elles, restent fixes). */
const echelleFenetre = () => (typeof window === 'undefined' ? 1 : Math.min(window.innerWidth / 1440, window.innerHeight / 900));

function VeilleBranchee({ veilleMin }: { veilleMin: number }) {
  const maintenant = useMinute();
  const pouls = usePoulsGarde();
  const enLigne = useSyncExternalStore(abonnerReseau, enLigneMaintenant, () => true);
  const echelle = useSyncExternalStore(abonnerTaille, echelleFenetre, () => 1);
  const { salle } = useSourceBureaux();
  const ronde = useMemo(() => prochaineRonde(salle?.agents ?? [], maintenant), [salle, maintenant]);
  // Un repère « en veille » au hasard, à chaque affichage.
  const [repere] = useState(() => tirerRepereEnVeille());
  // La dérive anti-usure : coupée dès que le mouvement l'est (système ou réglage).
  const derive = useMouvementVivant() === 'complet' ? deriveDeLaMinute(maintenant) : undefined;
  return (
    <VueVeille
      produit={EDITION_PRODUCT_NAME}
      maintenant={maintenant}
      etat={etatPastille(pouls.etat, enLigne)}
      ronde={ronde}
      veilleMin={veilleMin}
      verrouApresMin={null}
      verrouille={false}
      repereEnVeille={repere}
      derive={derive}
      echelle={echelle}
    />
  );
}
