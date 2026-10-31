import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssistant } from '../../../assistant/AssistantContext';
import { useGuide } from '../../../guide/GuideContext';
import { parcoursGeneral } from '../../../guide/parcours';
import { canBuildPublicLink, publicOrigin } from '../../../lib/publicUrl';
import { Bouton, Modale } from '../../../socle/ui';
import { useToucheModificatrice } from '../../coquille/touche';
import { evenementDeTouche, type EtapeCalculee } from './etapes';
import { useMots } from './i18n';
import { ROUTE_METIER } from './chemins';
import { useDemarrage } from './useDemarrage';
import { LienMobile, VueDemarrage } from './VueDemarrage';

/**
 * DÉMARRAGE (H42) — l'écran, branché sur le poste. Route : `ROUTE_DEMARRAGE` (`routes.ts`), export par défaut pour `lazy`.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * La page n'est ni au registre ni au catalogue, et elle ne s'ouvre pas d'elle-même : la première connexion et la carte de
 * l'Accueil sont à brancher dans les couches qui les possèdent. « Plus tard » ramène à l'Accueil, sans rien perdre.
 */

/* ── L'écran, branché sur le poste ────────────────────────────────────────── */

export function PageDemarrage() {
  const { tm } = useMots();
  const navigate = useNavigate();
  const d = useDemarrage();
  const assistant = useAssistant();
  const { lancer } = useGuide();
  const modKey = useToucheModificatrice();
  const [lienOuvert, setLienOuvert] = useState(false);
  const [copie, setCopie] = useState(false);
  const lien = useMemo(() => (canBuildPublicLink() ? publicOrigin() : null), []);

  const aller = (e: EtapeCalculee) => {
    if (e.id === 'mobile') setLienOuvert(true);
    else navigate(e.id === 'metier' ? ROUTE_METIER : (e.vers ?? '/'));
  };

  const copier = () => {
    if (!lien) return;
    void navigator.clipboard
      ?.writeText(lien)
      .then(() => setCopie(true))
      .catch(() => setCopie(false));
  };

  return (
    <>
      <VueDemarrage
        etat={d.etat}
        calcul={d.calcul}
        prenom={d.prenom}
        horsLigne={d.horsLigne}
        peutAdministrer={d.peutAdministrer}
        mac={modKey === '⌘'}
        onPlusTard={() => navigate('/')}
        onAccueil={() => navigate('/')}
        onReprendreVisite={() => lancer(parcoursGeneral(d.prenom, { sansBienvenue: true }))}
        onReessayer={d.reessayer}
        onAgir={aller}
        onOuvrir={aller}
        onMarquer={d.marquerFaite}
        onRetirer={d.retirer}
        onRemettre={d.remettre}
        onRaccourci={(r) => window.dispatchEvent(new KeyboardEvent('keydown', evenementDeTouche(r, modKey === '⌘')))}
        onAjmani={() => {
          assistant.open('chat');
          assistant.sendMessage(tm('aide.ajmani.demande'));
        }}
        onAppel={() => navigate('/assistance')}
        onDonnees={() => navigate('/outils/donnees')}
      />
      <Modale
        ouverte={lienOuvert}
        onFermer={() => {
          setLienOuvert(false);
          setCopie(false);
        }}
        titre={tm('lien.titre')}
        description={lien ? tm('lien.texte') : undefined}
        taille="petite"
        actions={
          <>
            <Bouton
              variante="secondaire"
              onClick={() => {
                setLienOuvert(false);
                setCopie(false);
              }}
            >
              {tm('lien.fermer')}
            </Bouton>
            {lien && (
              <Bouton variante="primaire" onClick={copier}>
                {copie ? tm('lien.copie') : tm('lien.copier')}
              </Bouton>
            )}
          </>
        }
      >
        <LienMobile lien={lien} />
      </Modale>
    </>
  );
}

export default PageDemarrage;
