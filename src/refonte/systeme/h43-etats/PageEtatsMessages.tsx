import React, { useId } from 'react';
import { File, Search, Trash2, TriangleAlert, X } from 'lucide-react';
import { useSocleLangue } from '../../../socle/i18n';
import { Avatar, Etiquette, PastilleEtat, type EtatPastille } from '../../../socle/ui/Pastilles';
import { Chargement } from '../../../socle/ui/Etats';
import { DialogueConfirmationEnPlace, EtatAccesRefuse, EtatAucunResultat, EtatErreurChargement, EtatVideInvitation, SANS_ACTION, SqueletteLignes, Toast } from '../../../socle/ui/situations';
import {
  BandeauCollaboration,
  BandeauHorsLigne,
  CurseurPair,
  MarqueEnAttente,
  MentionDerniereValeur,
  PiedFusion,
  PorteAjmani,
  SqueletteChiffres,
} from '../../../socle/ui/situations/EnSituation';
import { styleRang } from '../../../socle/couche-mouvement';
import { EXEMPLE_H43, type ExempleH43, type StatutFactureExemple } from './exemples';
import { useMotsH43 } from './i18n';

/**
 * H43 · ÉTATS ET MESSAGES (v3) — la planche de référence, réservée au développement (`/dev/etats`).
 *
 * Les neuf situations que tous les écrans réutilisent, CHACUNE EN SITUATION dans une mini-fenêtre d'un vrai module
 * (1440 × 900, mini-fenêtres de 440 × 239 à x = 44 / 500 / 956 et y = 120 / 375 / 631, écart 16). Numéros 1 à 8
 * inchangés (les fiches y renvoient), 9 = Erreur. Sans coquille : ni barre latérale, ni en-tête, ni barre Ajmani.
 *
 * Les modèles sont STATIQUES : leurs boutons sont `aria-disabled` (atteignables au clavier, sans effet) — `disabled`
 * les grisserait, et la planche doit les montrer tels qu'ils sont dans l'application. Neuf boutons blancs : normal
 * pour un catalogue (fiche, rubrique 13) ; un seul par vrai écran.
 *
 * Aucun nom propre ici : tout ce qui est « exemple » arrive en props (`exemple`), à défaut des valeurs fictives et
 * neutres de `exemples.ts`. Les briques (`socle/ui/situations`) n'ont aucun nom en dur. La mini-fenêtre
 * (`MiniFenetre`) est un cadre de démonstration : dans l'application, l'état prend la place du contenu dans la
 * vraie carte, sans barre de titre numérotée.
 *
 * Route : `import PageEtatsMessages from '…/h43-etats/PageEtatsMessages'` (export par défaut, pour `lazy`).
 */
export interface PageEtatsMessagesProps {
  exemple?: ExempleH43;
}

const STATUTS: Record<StatutFactureExemple, EtatPastille> = { envoyee: 'succes', retard: 'critique', payee: 'succes' };

/** Le cadre de démonstration d'un modèle : barre de titre de 36 px (numéro, nom, fil du module), puis la situation. */
function MiniFenetre({ numero, nom, fil, rang, children }: { numero: number; nom: string; fil: string; rang: number; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="sc-h43__fenetre" data-modele={numero} data-mvt="fondu" style={styleRang(rang, { animationDelay: `${rang * 45}ms` })}>
      <header className="sc-h43__barre">
        <h2 id={id} className="sc-h43__nom">
          <span className="sc-h43__numero sc-mono">{String(numero).padStart(2, '0')}</span>
          {nom}
        </h2>
        <span className="sc-h43__fil">{fil}</span>
      </header>
      <div className="sc-h43__situation">{children}</div>
    </section>
  );
}

/** La courbe grisée du modèle 9 : les dernières valeurs connues, en pointillé. */
function CourbePerimee({ valeurs, libelle }: { valeurs: readonly number[]; libelle: string }) {
  const n = Math.max(2, valeurs.length);
  const points = valeurs.map((v, i) => `${Math.round((24 + (i * 390) / (n - 1)) * 10) / 10},${Math.round((128 - Math.min(1, Math.max(0, v)) * 100) * 10) / 10}`).join(' ');
  return (
    <svg className="sc-h43__courbe" viewBox="0 0 438 160" preserveAspectRatio="none" role="img" aria-label={libelle}>
      <polyline points={points} fill="none" />
    </svg>
  );
}

export function PageEtatsMessages({ exemple = EXEMPLE_H43 }: PageEtatsMessagesProps) {
  const { tm, langue } = useMotsH43();
  const { ts } = useSocleLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const euros = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const e = exemple;
  return (
    <main className="sc-h43" data-refonte-police="inter">
      <header className="sc-h43__entete">
        <div className="sc-h43__titres">
          <p className="sc-h43__etiquette">{tm('entete.etiquette')}</p>
          <h1 className="sc-h43__titre">{tm('entete.titre')}</h1>
          <p className="sc-h43__sous">{tm('entete.sous')}</p>
        </div>
        <ul className="sc-h43__regles" aria-label={tm('entete.regles')}>
          {(['regle.1', 'regle.2', 'regle.3'] as const).map((r) => (
            <li key={r}>
              <Etiquette>{tm(r)}</Etiquette>
            </li>
          ))}
        </ul>
      </header>

      <div className="sc-h43__grille">
        {/* 1 — Vide : l'en-tête du tableau reste affiché pour montrer la forme. */}
        <MiniFenetre numero={1} nom={tm('fenetre.1')} fil={tm('fil.1')} rang={0}>
          <div aria-hidden className="sc-h43__tete-tableau">
            <span>{tm('vide.colonne.client')}</span>
            <span>{tm('vide.colonne.contact')}</span>
            <span>{tm('vide.colonne.echange')}</span>
          </div>
          <div className="sc-h43__cadre-vide">
            <EtatVideInvitation statique taille="compact" objet={e.objet} famille="contacts" onAjouter={SANS_ACTION} onImporter={SANS_ACTION} />
          </div>
        </MiniFenetre>

        {/* 2 — Chargement : des squelettes de la forme du contenu attendu (chiffres clés, lignes), puis la légende. */}
        <MiniFenetre numero={2} nom={tm('fenetre.2')} fil={tm('fil.2')} rang={1}>
          <Chargement libelle={ts('chargement.legende', { objets: e.objets })} className="sc-h43__chargement">
            <SqueletteChiffres nombre={3} />
            <SqueletteLignes compact lignes={3} />
            <p className="sc-h43__legende">{ts('chargement.legende', { objets: e.objets })}</p>
          </Chargement>
        </MiniFenetre>

        {/* 3 — Hors ligne : bandeau, élément en file, champ toujours utilisable. */}
        <MiniFenetre numero={3} nom={tm('fenetre.3')} fil={tm('fil.3')} rang={2}>
          <div className="sc-h43__hors">
            <BandeauHorsLigne statique enAttente={e.enAttente} objet={tm('hors.objet')} objets={tm('hors.objets')} onReessayer={SANS_ACTION} />
            <ol className="sc-h43__fil-messages">
              <li className="sc-h43__message" data-sens="recu">
                <Avatar nom={e.correspondant} taille={22} />
                <p className="sc-h43__bulle">{e.messageRecu}</p>
              </li>
              <li className="sc-h43__message" data-sens="envoye">
                <p className="sc-h43__bulle">
                  {e.messageEnvoye}
                  <MarqueEnAttente />
                </p>
              </li>
            </ol>
            <input className="sc-h43__saisie" type="text" aria-label={tm('hors.saisie', { prenom: e.correspondant })} placeholder={tm('hors.saisie', { prenom: e.correspondant })} />
          </div>
        </MiniFenetre>

        {/* 4 — Droits manquants : rien du contenu, des lignes fantômes hachurées seulement. */}
        <MiniFenetre numero={4} nom={tm('fenetre.4')} fil={tm('fil.4')} rang={3}>
          <div aria-hidden className="sc-h43__fantomes">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="sc-h43__fantome" />
            ))}
          </div>
          <div className="sc-h43__acces">
            <EtatAccesRefuse statique taille="compact" prenom={e.prenomAdmin} onDemander={SANS_ACTION} />
            <p className="sc-h43__mention">{ts('acces.connecte', { prenom: e.prenomConnecte })}</p>
          </div>
        </MiniFenetre>

        {/* 5 — Aucun résultat : la recherche reste remplie, un élément proche est proposé, la porte Ajmani reste en bas. */}
        <MiniFenetre numero={5} nom={tm('fenetre.5')} fil={tm('fil.5')} rang={4}>
          <div className="sc-h43__recherche">
            <Search aria-hidden size={13} strokeWidth={1.8} />
            <input type="search" readOnly value={e.terme} aria-label={tm('aucun.recherche')} />
            <button type="button" className="sc-h43__effacer sc-focus" aria-label={tm('aucun.effacer')} title={tm('aucun.effacer')} aria-disabled onClick={(ev) => ev.preventDefault()}>
              <X aria-hidden size={13} strokeWidth={1.8} />
            </button>
          </div>
          <div className="sc-h43__aucun">
            <EtatAucunResultat statique taille="compact" icone={null} iconeAction={<File size={13} strokeWidth={1.9} />} terme={e.terme} proche={e.proche} onVoirProche={SANS_ACTION} />
          </div>
          <PorteAjmani statique terme={e.terme} onClick={SANS_ACTION} className="sc-h43__porte" />
        </MiniFenetre>

        {/* 6 — Confirmation : la ligne concernée reste visible derrière le voile ; boîte en bas à droite. */}
        <MiniFenetre numero={6} nom={tm('fenetre.6')} fil={tm('fil.6')} rang={5}>
          <ul aria-hidden className="sc-h43__liste">
            {e.liste.map((l, i) => (
              <li key={`${l.nom}-${i}`} className="sc-h43__ligne" data-choisie={i === e.rangSupprime || undefined}>
                <span className="sc-h43__lettre">{l.nom.trim().charAt(0).toLocaleUpperCase()}</span>
                <span className="sc-h43__ligne-nom">{l.nom}</span>
                {l.detail && <span className="sc-h43__ligne-detail">{l.detail}</span>}
              </li>
            ))}
          </ul>
          <span aria-hidden className="sc-h43__voile" />
          <div className="sc-h43__boite">
            <DialogueConfirmationEnPlace
              ouvert
              sansVoile
              statique
              compact
              largeur={300}
              onAnnuler={SANS_ACTION}
              onConfirmer={SANS_ACTION}
              titre={tm('confirmation.titre', { nom: e.liste[e.rangSupprime]?.nom ?? '' })}
              texte={tm('confirmation.texte', { objet: e.objet })}
              libelleAction={tm('confirmation.action')}
              iconeAction={<Trash2 aria-hidden size={13} strokeWidth={1.9} />}
            />
          </div>
        </MiniFenetre>

        {/* 7 — Succès discret : la ligne change d'état et se surligne ; toast avec « Annuler » et barre de temps. */}
        <MiniFenetre numero={7} nom={tm('fenetre.7')} fil={tm('fil.7')} rang={6}>
          <ul className="sc-h43__factures">
            {e.factures.map((f, i) => (
              <li key={f.numero} className="sc-h43__facture" data-surlignee={i === 0 || undefined}>
                <span className="sc-h43__facture-numero sc-mono">{f.numero}</span>
                <span className="sc-h43__facture-client">{f.client}</span>
                <span className="sc-h43__facture-montant sc-nombre">{euros.format(f.montant)}</span>
                <PastilleEtat etat={STATUTS[f.statut]}>{tm(`statut.${f.statut}`)}</PastilleEtat>
              </li>
            ))}
          </ul>
          <div className="sc-h43__toast" data-mvt="entree" style={styleRang(0, { animationDelay: '600ms' })}>
            {/* Un instant de l'animation, comme sur la maquette : réelle, la barre part de 100 % et se vide en 8 s. */}
            <Toast
              statique
              compact
              type="succes"
              largeur={318}
              fraction={e.secondesRestantes / 8}
              titre={tm('succes.titre', { client: e.nomClientFacture })}
              detail={ts('toast.disparait', { n: e.secondesRestantes })}
              onAnnuler={SANS_ACTION}
            />
          </div>
        </MiniFenetre>

        {/* 8 — Deux personnes : bandeau, passage surligné et curseur de l'autre personne, pied de fusion. */}
        <MiniFenetre numero={8} nom={tm('fenetre.8')} fil={tm('fil.8')} rang={7}>
          <div className="sc-h43__collab">
            <BandeauCollaboration statique noms={e.noms} prenom={e.prenomCollaborateur} onDifferences={SANS_ACTION} />
            <h3 className="sc-h43__page-titre">{e.titrePage}</h3>
            <p className="sc-h43__page-texte">
              {e.paragraphe}
              <br />
              {e.debutModifie}
              <mark className="sc-h43__modifie">{e.passageModifie}</mark>
              <CurseurPair prenom={e.prenomCollaborateur} />
            </p>
            <PiedFusion statique onGarderLesDeux={SANS_ACTION} />
          </div>
        </MiniFenetre>

        {/* 9 — Erreur : les dernières valeurs connues restent, grisées, avec leur heure ; nouvel essai automatique. */}
        <MiniFenetre numero={9} nom={tm('fenetre.9')} fil={tm('fil.9')} rang={8}>
          <div className="sc-h43__perime">
            <MentionDerniereValeur heure={e.heureDerniere} />
            <CourbePerimee valeurs={e.courbe} libelle={tm('erreur.courbe')} />
          </div>
          <div className="sc-h43__erreur">
            <EtatErreurChargement
              statique
              taille="compact"
              objets={e.objetsErreur}
              genre={e.genreErreur}
              icone={<TriangleAlert aria-hidden size={16} strokeWidth={1.8} />}
              onReessayer={SANS_ACTION}
              apres={<span className="sc-h43__essai sc-nombre">{ts('erreur.essai', { n: e.prochainEssai })}</span>}
            />
          </div>
        </MiniFenetre>
      </div>
    </main>
  );
}

export default PageEtatsMessages;
