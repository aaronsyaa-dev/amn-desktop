import React from 'react';
import { Trash2 } from 'lucide-react';
import { useSocleLangue } from '../../../socle/i18n';
import {
  AvisCollaboration,
  DialogueConfirmationEnPlace,
  EtatAccesRefuse,
  EtatAucunResultat,
  EtatChargement,
  EtatHorsConnexion,
  EtatVideInvitation,
  SANS_ACTION,
  Toast,
} from '../../../socle/ui';
import { EXEMPLE_H43, type ExempleH43 } from './exemples';
import { useMotsH43 } from './i18n';

/**
 * H43 · ÉTATS ET MESSAGES — la page de démonstration, réservée au développement.
 *
 * Les huit situations que tous les écrans réutilisent, posées comme sur la maquette (1440 × 900, tuiles de
 * 314 × 330, colonnes à 59 / 395 / 731 / 1067, rangées à 153 et 503). Sert aux tests visuels ; elle n'est pas
 * destinée aux utilisateurs. Sans coquille : ni barre latérale, ni en-tête, ni barre Ajmani.
 *
 * Les huit modèles sont STATIQUES : leurs boutons sont `aria-disabled` (atteignables au clavier, sans effet) —
 * `disabled` les grisserait, et la page doit les montrer tels qu'ils sont dans l'application.
 *
 * Aucun nom propre ici : tout ce qui est « exemple » arrive en props (`exemple`), à défaut des valeurs fictives
 * de `exemples.ts`. Les composants, eux, n'ont aucun nom en dur.
 *
 * Route : `import PageEtatsMessages from '…/h43-etats/PageEtatsMessages'` (export par défaut, pour `lazy`).
 */
export interface PageEtatsMessagesProps {
  exemple?: ExempleH43;
}

function Tuile({ id, etiquette, children }: { id: string; etiquette: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="sc-demo__tuile">
      <h2 id={id} className="sc-demo__tuile-etiquette">
        {etiquette}
      </h2>
      <div className="sc-demo__tuile-corps">{children}</div>
    </section>
  );
}

export function PageEtatsMessages({ exemple = EXEMPLE_H43 }: PageEtatsMessagesProps) {
  const { tm } = useMotsH43();
  const { ts } = useSocleLangue();
  return (
    <main className="sc-demo" data-refonte-police="inter">
      <div className="sc-demo__cadre">
        <header>
          <p className="sc-demo__etiquette">{tm('entete.etiquette')}</p>
          <h1 className="sc-demo__titre">{tm('entete.titre')}</h1>
          <p className="sc-demo__sous">{tm('entete.sous')}</p>
        </header>
        <div className="sc-demo__grille">
          <Tuile id="h43-vide" etiquette={tm('tuile.vide')}>
            <EtatVideInvitation statique objet={exemple.objet} famille="contacts" onAjouter={SANS_ACTION} onImporter={SANS_ACTION} />
          </Tuile>
          <Tuile id="h43-chargement" etiquette={tm('tuile.chargement')}>
            <EtatChargement statique objets={exemple.objets} />
          </Tuile>
          <Tuile id="h43-hors" etiquette={tm('tuile.hors')}>
            <EtatHorsConnexion statique onReessayer={SANS_ACTION} />
          </Tuile>
          <Tuile id="h43-acces" etiquette={tm('tuile.acces')}>
            <EtatAccesRefuse statique prenom={exemple.prenomAdmin} onDemander={SANS_ACTION} />
          </Tuile>
          <Tuile id="h43-aucun" etiquette={tm('tuile.aucun')}>
            <EtatAucunResultat statique terme={exemple.terme} proche={exemple.proche} onVoirProche={SANS_ACTION} />
          </Tuile>
          <Tuile id="h43-confirmation" etiquette={tm('tuile.confirmation')}>
            <DialogueConfirmationEnPlace
              ouvert
              sansVoile
              statique
              largeur={276}
              onAnnuler={SANS_ACTION}
              onConfirmer={SANS_ACTION}
              titre={tm('confirmation.titre', { nom: exemple.nomSupprime })}
              texte={tm('confirmation.texte', { objet: exemple.objet })}
              libelleAction={tm('confirmation.action')}
              iconeAction={<Trash2 aria-hidden size={14} strokeWidth={1.9} />}
            />
          </Tuile>
          <Tuile id="h43-succes" etiquette={tm('tuile.succes')}>
            {/* La barre est à 62 % : un instant de l'animation, comme sur la maquette. Réelle, elle part de 100 % et se vide en 8 s. */}
            <Toast statique type="succes" largeur={276} fraction={0.62} titre={tm('succes.titre', { client: exemple.nomClientFacture })} detail={ts('toast.disparait', { n: 8 })} onAnnuler={SANS_ACTION} />
          </Tuile>
          <Tuile id="h43-collab" etiquette={tm('tuile.collab')}>
            <AvisCollaboration statique noms={exemple.noms} prenom={exemple.prenomCollaborateur} onDifferences={SANS_ACTION} onGarderLesDeux={SANS_ACTION} />
          </Tuile>
        </div>
      </div>
    </main>
  );
}

export default PageEtatsMessages;
