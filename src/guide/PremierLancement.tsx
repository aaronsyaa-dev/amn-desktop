import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useProfiles } from '../state/ProfilesContext';
import { useSync } from '../state/SyncContext';
import { QuiEtesVous } from './QuiEtesVous';
import { EVENEMENT_GUIDE, guideVu } from './memoire';

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
  const { user } = useAuth();
  const { profilDe } = useProfiles();
  const { ready, pullFailed } = useSync();
  const email = user?.email ?? '';
  const [ouvert, setOuvert] = useState(false);
  const [relance, setRelance] = useState(false);

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
  return <QuiEtesVous relance={relance} onFerme={() => setOuvert(false)} />;
}
