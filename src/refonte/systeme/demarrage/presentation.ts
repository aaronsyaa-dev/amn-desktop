import type { Langue } from '../../../i18n';
import type { IdEtape, ResultatEtapes } from './etapes';
import { traduire } from './i18n';
import type { ChoixMetier } from './metier';
import type { ModeleMetier } from './modeles';
import type { ApercuBrouillon, LignePrete, LigneRemplie } from './VueDemarrage';

/**
 * CE QUE LA VUE DE DÉMARRAGE (H42) MONTRE, CALCULÉ DEPUIS LES VRAIES DONNÉES — sans React, pour `check:systeme-demarrage`.
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Chaque ligne n'apparaît que si elle est vraie au moment de l'affichage (fiche, rubrique 6) :
 *   · nœuds faits : le métier choisi, le nombre de clients, le nombre de personnes — sinon « faite » ;
 *   · « Déjà rempli pour vous » (étape 3) : le premier client enregistré, les lignes types du modèle ;
 *   · le papier : un APERÇU (rien n'est enregistré) — le client et les lignes types du modèle, sans prix (aucun
 *     tarif n'est connu : aucun montant n'est inventé), sans numéro (un brouillon n'en a pas) ;
 *   · « Déjà prêt » : les modules du métier choisi, les clients enregistrés, La Garde (le journal note chaque
 *     connexion). Aucune ligne sur la sauvegarde : le poste ne connaît pas l'heure ni la durée de garde des copies.
 */

export interface EntreePresentation {
  calcul: ResultatEtapes;
  metier: ChoixMetier | null;
  modele: ModeleMetier | null;
  effectifs: { clients: number; membres: number };
  premierClient: string | null;
  langue: Langue;
}

export interface Presentation {
  resumes: Partial<Record<IdEtape, string>>;
  rempli: Partial<Record<IdEtape, readonly LigneRemplie[]>>;
  brouillon: ApercuBrouillon | null;
  pret: LignePrete[];
}

/** Les six premiers modules du métier vont dans la barre (H47) : « 6 dans la barre ». */
export const MODULES_DANS_LA_BARRE = 6;

export function presentationDemarrage(e: EntreePresentation): Presentation {
  const t = (cle: Parameters<typeof traduire>[1], params?: Record<string, string | number>) => traduire(e.langue, cle, params);
  const { modele, metier, effectifs, premierClient, calcul } = e;
  const nomMetier = modele?.nom[e.langue] ?? null;

  const resumes: Partial<Record<IdEtape, string>> = {};
  if (nomMetier && metier && !metier.passe) resumes.metier = nomMetier;
  if (effectifs.clients > 0) resumes.client = t('statut.clients', { n: effectifs.clients });
  if (effectifs.membres >= 2) resumes.equipe = t('statut.membres', { n: effectifs.membres });

  const devisType = calcul.etapes.some((x) => x.id === 'devis') && modele?.etapes.devis.mesure === 'quotes' ? (modele.devisType ?? []) : [];
  const rangClient = calcul.etapes.find((x) => x.id === 'client')?.rang;
  const devis: LigneRemplie[] = [];
  if (premierClient && rangClient) devis.push({ terme: t('rempli.client.terme'), suite: t('rempli.client.suite', { client: premierClient, n: rangClient }) });
  if (devisType.length > 0) devis.push({ terme: t('rempli.lignes.terme'), suite: t('rempli.lignes.suite') });

  const brouillon: ApercuBrouillon | null =
    premierClient && devisType.length > 0 ? { client: premierClient, lignes: devisType.map((l) => ({ libelle: l.libelle[e.langue], quantite: l.quantite[e.langue] })) } : null;

  const pret: LignePrete[] = [];
  if (nomMetier && metier && !metier.passe && metier.modules.length > 0) {
    pret.push({
      id: 'modules',
      icone: 'modules',
      titre: t('dejaPret.modules.titre', { n: metier.modules.length }),
      sous: t('dejaPret.modules.sous', { metier: nomMetier, n: Math.min(MODULES_DANS_LA_BARRE, metier.modules.length) }),
    });
  }
  if (effectifs.clients > 0) pret.push({ id: 'clients', icone: 'clients', titre: t('dejaPret.clients.titre', { n: effectifs.clients }), sous: t('dejaPret.clients.sous') });
  pret.push({ id: 'garde', icone: 'garde', titre: t('dejaPret.garde.titre'), sous: t('dejaPret.garde.sous') });

  return { resumes, rempli: devis.length > 0 ? { devis } : {}, brouillon, pret };
}
