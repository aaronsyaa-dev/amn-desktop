/**
 * L'APERÇU DE LA COQUILLE — `ApercuBureau`, la coquille de PRÉSENTATION (`src/socle/coquille/`) sur des données
 * FICTIVES de bac à sable, pour les captures 1440 × 900 des écrans (sans lancer l'application, sans serveur).
 *
 * Rien ici n'entre dans l'application : les prénoms (Aaron, Mohamed, Riyad), « Rendez-vous Menna », les compteurs
 * et les noms courts des modules sont ceux des maquettes, et ne vivent que dans ce fichier.
 *
 * Mode d'emploi, pour un écran (`scripts/apercu/ecrans/<ID>.tsx`) :
 *
 *   import { ApercuBureau } from '../coquille';
 *   export default function Apercu() {
 *     return (
 *       <ApercuBureau famille="jour" sousPage="accueil" fil={['Ma journée', 'Notifications']} ajmani="Demandez à Ajmani, par exemple : …">
 *         <MaVue … />   ← la zone principale (1108 px de large, padding 24 / 40 déjà posé par la coquille)
 *       </ApercuBureau>
 *     );
 *   }
 *
 *   · `famille`  : la famille dépliée dans la barre (`jour`, `contacts`, `ecrire`, `argent`, `echanger`, `creer`,
 *                  `outils`, `garde`) ; `null` ou absent : aucune (D02).
 *   · `sousPage` : la ligne allumée dans sa sous-liste, par sa clé (voir `FAMILLES` ci-dessous : `accueil`,
 *                  `calendrier`, `facturation`…, ou `ensemble` pour « Vue d'ensemble »). Une clé hors des cinq
 *                  lignes montrées prend la place de la dernière (le module actif est toujours visible).
 *   · `fil`      : les miettes du fil d'Ariane, dans l'ordre (« Ma journée / Démarrage / Votre métier »).
 *   · `ajmani`   : le texte de la barre Ajmani pour cet écran (défaut : le texte du socle).
 *   · `tousLesModules` : le bouton carré « Tous les modules » est allumé (D02).
 *   · `garde`    : l'état de La Garde (`calme` par défaut, `attention`, `critique`).
 *   · `epingles`, `aujourdhui`, `notifications`, `cyber` : pour changer les données fictives d'un écran.
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import '../../src/refonte/accueil/Ambiance';
import { BarreAjmani, BarreLaterale, Coquille, EnTete, type EtatGarde, type FamilleLaterale, type MiettePain, type ModuleLateral } from '../../src/socle/coquille';
import type { CarteAujourdhui } from '../../src/socle/coquille/types';
import type { Famille } from '../../src/socle/familles';

interface ModuleFictif {
  cle: string;
  libelle: string;
  badge?: number;
}
interface FamilleFictive {
  cle: string;
  nom: string;
  teinte: Famille;
  /** Le nombre de modules de la famille (D02). */
  total: number;
  modules: ModuleFictif[];
}

/** Les familles des maquettes (H42, D02), noms courts et compteurs FICTIFS. */
const FAMILLES: FamilleFictive[] = [
  {
    cle: 'jour',
    nom: 'Ma journée',
    teinte: 'jour',
    total: 12,
    modules: [
      { cle: 'accueil', libelle: 'Accueil' },
      { cle: 'tableau', libelle: 'Tableau de bord' },
      { cle: 'calendrier', libelle: 'Calendrier', badge: 3 },
      { cle: 'taches', libelle: 'Tâches', badge: 3 },
      { cle: 'projets', libelle: 'Projets' },
      { cle: 'missions', libelle: 'Missions et tickets' },
      { cle: 'bilan', libelle: 'Bilan de la semaine' },
    ],
  },
  {
    cle: 'contacts',
    nom: 'Mes contacts et clients',
    teinte: 'contacts',
    total: 14,
    modules: [
      { cle: 'clients', libelle: 'Clients' },
      { cle: 'prospects', libelle: 'Prospects' },
      { cle: 'pipeline', libelle: 'Pipeline commercial' },
      { cle: 'retours', libelle: 'Retours clients' },
      { cle: 'relances', libelle: 'Relances', badge: 5 },
    ],
  },
  {
    cle: 'ecrire',
    nom: 'Écrire et retenir',
    teinte: 'ecrire',
    total: 9,
    modules: [
      { cle: 'notes', libelle: 'Notes et pages' },
      { cle: 'documents', libelle: 'Documents' },
      { cle: 'journal', libelle: 'Journal' },
      { cle: 'signatures', libelle: 'Signatures', badge: 3 },
    ],
  },
  {
    cle: 'argent',
    nom: 'L’argent',
    teinte: 'argent',
    total: 18,
    modules: [
      { cle: 'facturation', libelle: 'Facturation', badge: 2 },
      { cle: 'devis', libelle: 'Devis' },
      { cle: 'depenses', libelle: 'Dépenses et achats' },
      { cle: 'tresorerie', libelle: 'Trésorerie' },
      { cle: 'impayes', libelle: 'Impayés', badge: 4 },
    ],
  },
  {
    cle: 'echanger',
    nom: 'Échanger',
    teinte: 'echanger',
    total: 10,
    modules: [
      { cle: 'messagerie', libelle: 'Messagerie', badge: 5 },
      { cle: 'appels', libelle: 'Appels et salles' },
      { cle: 'courriel', libelle: 'Courriel' },
      { cle: 'annonces', libelle: 'Annonces' },
    ],
  },
  {
    cle: 'creer',
    nom: 'Créer et produire',
    teinte: 'creer',
    total: 16,
    modules: [
      { cle: 'video', libelle: 'Vidéo' },
      { cle: 'visuels', libelle: 'Visuels et marque' },
      { cle: 'stock', libelle: 'Stock', badge: 6 },
      { cle: 'chantiers', libelle: 'Chantiers' },
    ],
  },
  {
    cle: 'outils',
    nom: 'Outils et réglages',
    teinte: 'outils',
    total: 14,
    modules: [
      { cle: 'parametres', libelle: 'Paramètres' },
      { cle: 'membres', libelle: 'Membres et accès' },
      { cle: 'automatisations', libelle: 'Automatisations' },
      { cle: 'connecteurs', libelle: 'Connecteurs', badge: 1 },
    ],
  },
];
const GARDE: FamilleFictive = {
  cle: 'garde',
  nom: 'La Garde',
  teinte: 'outils',
  total: 8,
  modules: [
    { cle: 'salle', libelle: 'Salle de contrôle' },
    { cle: 'organisations', libelle: 'Organisations' },
    { cle: 'alertes', libelle: 'Alertes', badge: 1 },
    { cle: 'incidents', libelle: 'Incidents', badge: 1 },
    { cle: 'rondes', libelle: 'Rondes' },
  ],
};

/** Les lignes montrées sous une famille ouverte : au plus cinq (Vue d'ensemble d'abord, sauf Ma journée), le module actif toujours visible. */
function deplier(f: FamilleFictive, active: boolean, sousPage: string | null | undefined): FamilleLaterale {
  const ensemble = f.cle !== 'jour';
  const place = ensemble ? 4 : 5;
  let montres = f.modules.slice(0, place);
  const courant = active ? f.modules.find((m) => m.cle === sousPage) : undefined;
  if (courant && !montres.includes(courant)) montres = [...montres.slice(0, place - 1), courant];
  const mod = (m: ModuleFictif): ModuleLateral => ({ cle: m.cle, libelle: m.libelle, vers: `/${f.cle}/${m.cle}`, badge: m.badge ?? 0, courant: active && m.cle === sousPage });
  return {
    cle: f.cle,
    nom: f.nom,
    famille: f.teinte,
    modules: montres.map(mod),
    badge: 0,
    active,
    ensemble: ensemble ? { cle: `ensemble-${f.cle}`, libelle: '', vers: `/ensemble/${f.cle}`, badge: 0, courant: active && sousPage === 'ensemble' } : undefined,
    autres: f.total - montres.length,
  };
}

const EPINGLES: ModuleLateral[] = [
  { cle: 'facturation', libelle: 'Facturation', vers: '/argent/facturation', badge: 2, courant: false, famille: 'argent' },
  { cle: 'clients', libelle: 'Clients', vers: '/contacts/clients', badge: 0, courant: false, famille: 'contacts' },
  { cle: 'soc', libelle: 'SOC', vers: '/cyber', badge: 5, courant: false, famille: 'cyber' },
];

const AUJOURDHUI: CarteAujourdhui = {
  faites: 5,
  total: 8,
  serie: 6,
  rendezVous: { titre: 'Rendez-vous Menna', heure: '11:00', dans: 'dans 18 min' },
  collegues: [
    { cle: 'mohamed', nom: 'Mohamed', lieu: 'Facturation' },
    { cle: 'riyad', nom: 'Riyad', lieu: 'Clients' },
  ],
  presenceMontree: true,
  vers: '/',
};

export interface ApercuBureauProps {
  /** La famille dépliée (identifiant), ou `null` : aucune. */
  famille?: string | null;
  /** La ligne allumée dans la sous-liste de cette famille (sa clé, ou `ensemble`). */
  sousPage?: string | null;
  /** Le fil d'Ariane, miette par miette. */
  fil: (string | MiettePain)[];
  /** Le texte de la barre Ajmani (défaut : celui du socle). */
  ajmani?: string;
  /** Le bouton carré « Tous les modules » est allumé. */
  tousLesModules?: boolean;
  garde?: EtatGarde;
  epingles?: ModuleLateral[];
  aujourdhui?: CarteAujourdhui | null;
  notifications?: number;
  /** Le compteur d'alertes ouvertes de Cyber. */
  cyber?: number | null;
  largeur?: 'lecture' | 'pleine';
  children?: React.ReactNode;
}

export function ApercuBureau({
  famille = null,
  sousPage = null,
  fil,
  ajmani,
  tousLesModules = false,
  garde = 'calme',
  epingles = EPINGLES,
  aujourdhui = AUJOURDHUI,
  notifications = 4,
  cyber = 5,
  largeur = 'pleine',
  children,
}: ApercuBureauProps) {
  const rien = () => undefined;
  const familles = FAMILLES.map((f) => deplier(f, f.cle === famille, sousPage));
  const laGarde = deplier(GARDE, famille === 'garde', sousPage);
  const leCyber: FamilleLaterale = { cle: 'cyber', nom: 'Cyber', famille: 'outils', modules: [], badge: 0, active: famille === 'cyber', vers: '/cyber', compteur: cyber, compteurAide: `${cyber ?? 0} alertes ouvertes` };
  return (
    <MemoryRouter>
      <div style={{ width: 1440, height: 900, overflow: 'hidden' }}>
        <Coquille
          largeur={largeur}
          tiroirOuvert={false}
          onFermerTiroir={rien}
          lateral={
            <BarreLaterale
              produit="AMN Business"
              familles={familles}
              garde={laGarde}
              cyber={leCyber}
              epingles={epingles}
              etatGarde={garde}
              nombreModules={101}
              routeTousLesModules="/tous-les-modules"
              tousLesModulesActif={tousLesModules}
              aujourdhui={aujourdhui}
              raccourciRecherche="⌘K"
              onRecherche={rien}
              onReplier={rien}
              ouvert={false}
              onFermer={rien}
            />
          }
          entete={
            <EnTete
              fil={fil.map((m, i) => (typeof m === 'string' ? { libelle: m, vers: i < fil.length - 1 ? '/' : undefined } : m))}
              enLigne={['Aaron', 'Mohamed', 'Riyad']}
              presenceMontree
              notifications={notifications}
              versNotifications="/notifications"
              garde={{ etat: garde, points: garde === 'calme' ? 0 : 1, vers: '/garde' }}
              onMenu={rien}
            />
          }
          ajmani={<BarreAjmani onOuvrir={rien} raccourci="⌘J" texte={ajmani} />}
        >
          {children}
        </Coquille>
      </div>
    </MemoryRouter>
  );
}
