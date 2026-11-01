/**
 * APERÇU « G06 » — Connexion (v3), sur les vrais composants de présentation (`VueConnexion`, `CadreConnexion`) :
 * la vue « connexion » au repos, l'adresse FICTIVE `vous@exemple.test` saisie, l'horloge figée au moment des
 * maquettes (vendredi 30 octobre 2026, 08:57). Aucune logique d'authentification n'est montée ici.
 *
 *   npm run apercu -- G06
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import '../../../src/refonte/accueil/Ambiance';
import { VueConnexion } from '../../../src/refonte/systeme/connexion/VueConnexion';

const rien = () => undefined;

export default function Apercu() {
  return (
    <MemoryRouter>
      <div style={{ width: 1440, height: 900, overflow: 'hidden' }}>
        <VueConnexion
          produit="AMN Business"
          enLigne
          onRelireReseau={rien}
          vue="connexion"
          envoi={false}
          parti={false}
          message={null}
          redirection={false}
          invalide={false}
          ids={{ erreur: 'e', aideEmail: 'a', maj: 'm' }}
          connexion={{
            email: 'vous@exemple.test',
            onEmail: rien,
            mdp: '',
            onMdp: rien,
            montrer: false,
            onMontrer: rien,
            majuscules: false,
            onToucheMdp: rien,
            onQuitterMdp: rien,
            aide: null,
            onSoumettre: (e) => e.preventDefault(),
            onOublie: rien,
            focusInitial: false,
          }}
          mfa={null}
          oublie={{ etat: 'saisie', chemin: 'manuel', adresseValide: true, onSoumettre: (e) => e.preventDefault(), onRetour: rien }}
          acces={false}
          onAcces={rien}
          maintenant={new Date(2026, 9, 30, 8, 57)}
        />
      </div>
    </MemoryRouter>
  );
}
