import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useProfiles } from '../state/ProfilesContext';
import { useSync } from '../state/SyncContext';
import { QuiEtesVous } from './QuiEtesVous';
import { Presentation } from './Presentation';
import { PresentationArrivee } from './PresentationArrivee';
import { IS_BUSINESS } from '../edition/edition';
import { EVENEMENT_GUIDE, guideVu, marquerGuide } from './memoire';

/**
 * LE PREMIER LANCEMENT — quand poser la question, et quand ne pas la poser.
 *
 * La question « Qui êtes-vous ? » se pose une fois par compte et par poste,
 * et seulement quand le profil synchronisé est lu (on ne demande pas à
 * quelqu'un qui a déjà répondu sur un autre poste). Elle attend que la
 * synchronisation soit prête : avant, le profil n'est pas encore là et on
 * poserait la question à tort. Paramètres peut la rouvrir (« Changer de
 * profil ») par l'événement `amn:guide`.
 */
export function PremierLancement() {
  const { user, org } = useAuth();
  const { profilDe } = useProfiles();
  const { ready, pullFailed } = useSync();
  const email = user?.email ?? '';
  const [ouvert, setOuvert] = useState(false);
  const [relance, setRelance] = useState(false);
  /* La présentation du produit passe avant la porte, une fois par compte et par poste. */
  const [presenter, setPresenter] = useState(false);
  /* La présentation vient d'être vue : la porte s'ouvre dans sa feuille, et la visite ne redit pas « Bienvenue ». */
  const [vuePresentation, setVuePresentation] = useState(false);

  useEffect(() => {
    if (!email || !ready || pullFailed) return;
    if (guideVu('profil', email)) return;
    if (profilDe(email)) return;
    /* Le rideau de bienvenue de l'édition interne passe d'abord : on attend qu'il soit parti. */
    let t = 0;
    const essayer = () => {
      if (document.querySelector('[data-bienvenue]')) {
        t = window.setTimeout(essayer, 600);
        return;
      }
      setPresenter(!guideVu('presentation', email));
      setOuvert(true);
    };
    t = window.setTimeout(essayer, 900);
    return () => window.clearTimeout(t);
  }, [email, ready, pullFailed, profilDe]);

  useEffect(() => {
    const rouvrir = () => {
      setRelance(true);
      setOuvert(true);
    };
    window.addEventListener(EVENEMENT_GUIDE, rouvrir);
    return () => window.removeEventListener(EVENEMENT_GUIDE, rouvrir);
  }, []);

  if (!ouvert) return null;
  const finPresentation = () => {
    marquerGuide('presentation', email);
    setPresenter(false);
    setVuePresentation(true);
  };
  if (presenter && !relance) {
    // Édition cliente : la présentation du cahier 43f (trois pages, puis la porte dans la même feuille).
    return IS_BUSINESS
      ? <PresentationArrivee prenom={user?.name?.split(' ')[0] ?? ''} onFin={finPresentation} />
      : <Presentation orgName={org?.name ?? ''} onFin={finPresentation} />;
  }
  return <QuiEtesVous relance={relance} apresPresentation={IS_BUSINESS && vuePresentation && !relance} onFerme={() => setOuvert(false)} />;
}
