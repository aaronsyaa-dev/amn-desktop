import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGuide } from '../../../guide/GuideContext';
import { parcoursGeneral } from '../../../guide/parcours';
import { canBuildPublicLink, publicOrigin } from '../../../lib/publicUrl';
import { Bouton, Modale } from '../../../socle/ui';
import { usePageCoquille } from '../../coquille/page';
import { useToucheModificatrice } from '../../coquille/touche';
import { evenementDeTouche, type EtapeCalculee } from './etapes';
import { useMots } from './i18n';
import { ROUTE_METIER } from './chemins';
import { presentationDemarrage } from './presentation';
import { useDemarrage } from './useDemarrage';
import { LienMobile, VueDemarrage } from './VueDemarrage';

/**
 * DÉMARRAGE (H42) — l'écran, branché sur le poste. Route : `ROUTE_DEMARRAGE` (`routes.ts`), export par défaut pour `lazy`.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * La page n'est ni au registre ni au catalogue ; elle s'ouvre d'elle-même une seule fois, à la toute première connexion
 * (`../premiereConnexion.ts`). « Plus tard » ramène à l'Accueil, sans rien perdre.
 *
 * Ce que la vue montre vient de `presentation.ts` (les vraies données, ligne par ligne) ; ce que le poste ne sait pas,
 * elle ne le montre pas : aucune personne référente ni créneau (pas d'agenda de l'équipe AMN dans le poste) — la carte
 * dit « L'équipe AMN vous répond » et mène à l'assistance ; aucun nom de personne à inviter avant qu'elle soit invitée.
 */

export function PageDemarrage() {
  const { tm, langue } = useMots();
  const navigate = useNavigate();
  const d = useDemarrage();
  const { lancer } = useGuide();
  const modKey = useToucheModificatrice();
  const [lienOuvert, setLienOuvert] = useState(false);
  const [copie, setCopie] = useState(false);
  const lien = useMemo(() => (canBuildPublicLink() ? publicOrigin() : null), []);
  const vue = useMemo(
    () => presentationDemarrage({ calcul: d.calcul, metier: d.metier, modele: d.modele, effectifs: d.effectifs, premierClient: d.premierClient, langue }),
    [d.calcul, d.metier, d.modele, d.effectifs, d.premierClient, langue],
  );

  usePageCoquille({ famille: 'jour', sousPage: 'home', miettes: [{ libelle: tm('titre') }], ajmani: tm('ajmani.barre') });

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
        resumes={vue.resumes}
        rempli={vue.rempli}
        brouillon={vue.brouillon}
        client={d.premierClient}
        pret={vue.pret}
        aInviter={[]}
        referent={null}
        lienMobile={lien}
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
        onReserver={() => navigate('/assistance')}
        onEcrire={() => navigate('/assistance')}
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
