import type { CalcProfile } from './calcEngine';

/**
 * LES CALCULATEURS PERSONNELS (BLOC 2)
 * ════════════════════════════════════
 *
 * Les mêmes données que `calcProfiles.ts`, déroulées par le même moteur, et
 * dans un fichier séparé pour une seule raison : ils ne s'affichent pas au
 * même endroit. Le module Calculateurs est un outil de travail — y glisser un
 * budget de fin de mois mélangerait ce qu'on facture et ce qu'on vit, dans un
 * écran qu'une cliente ouvre devant quelqu'un.
 *
 * ## Ce que ce module est, économiquement
 *
 * Un bonus inclus dans les desktops business déjà payés. Pas un produit vendu
 * à part, pas une option, pas un palier. Cela se lit dans le code plutôt que
 * dans un commentaire : « personnel » n'a AUCUNE clé dans `ORG_MODULES`
 * (amn-api). Il ne peut donc pas être ouvert ni fermé par organisation, et
 * n'existe nulle part comme quelque chose qui se donne ou se retire. Il n'y a
 * pas de levier pour le vendre parce qu'il n'y a pas de levier du tout — voir
 * `ALWAYS_ON` dans `scripts/check-modules.mjs`, qui refuse de réclamer une clé
 * serveur pour ces écrans-là.
 *
 * Aucune logique de facturation n'est touchée, et c'est vérifiable : ce
 * chantier ne modifie ni `plan`, ni `ORG_PLANS`, ni la moindre route de
 * `/v1/admin/organizations/:id/plan`.
 */

/**
 * Combien il reste à dépenser d'ici la paie.
 *
 * ## Le raisonnement, parce que ce n'est pas « solde ÷ jours »
 *
 * Le solde affiché par la banque ment presque toujours : il contient encore le
 * loyer qui n'est pas passé, et il ignore le remboursement qui arrive jeudi.
 * Diviser ce chiffre-là par le nombre de jours donne un budget quotidien
 * confortable et faux, ce qui est exactement la façon dont on se retrouve à
 * découvert le 28.
 *
 * L'ordre compte donc :
 *
 *   1. on ramène le solde à ce qui restera VRAIMENT une fois les prélèvements
 *      connus passés et les rentrées attendues arrivées ;
 *   2. on met de côté le matelas — la somme qu'on veut voir le jour de la
 *      paie, et qui n'a jamais été « dépensable » ;
 *   3. seulement ensuite on divise par les jours restants.
 *
 * `max(…, 0)` sur le dépensable n'est pas une précaution cosmétique : sans
 * lui, un budget déjà dans le rouge rendrait un « par jour » négatif, c'est-à-
 * dire un chiffre qu'on lit comme une autorisation de dépenser. Le manque est
 * dit séparément, par `manque`, et il est dit comme un manque.
 *
 * `max(jours, 1)` évite la division par zéro le jour de la paie, où « ce qu'il
 * reste » et « ce qu'il reste par jour » sont légitimement la même chose.
 */
const BUDGET_AVANT_PAIE: CalcProfile = {
  id: 'personnel-budget-avant-paie',
  label: 'Avant la paie',
  description:
    'Ce qu’il reste vraiment à dépenser d’ici la prochaine paie, une fois les prélèvements connus retirés et le matelas mis de côté.',
  inputs: [
    {
      key: 'solde',
      label: 'Sur le compte aujourd’hui',
      kind: 'money',
      defaultValue: 0,
      help: 'Le solde que la banque affiche, tel quel.',
    },
    {
      key: 'aVenir',
      label: 'Ce qui doit encore arriver',
      kind: 'money',
      defaultValue: 0,
      help: 'Un remboursement, un virement attendu — seulement ce qui est sûr.',
    },
    {
      key: 'prelevements',
      label: 'Prélèvements encore à passer',
      kind: 'money',
      defaultValue: 0,
      help: 'Loyer, abonnements, échéances : ce qui partira avant la paie.',
    },
    {
      key: 'matelas',
      label: 'Ce qu’il doit rester le jour de la paie',
      kind: 'money',
      defaultValue: 0,
      help: 'La somme que vous ne voulez pas toucher. Mettez 0 si vous n’en gardez pas.',
    },
    {
      key: 'jours',
      label: 'Jours avant la paie',
      kind: 'number',
      defaultValue: 15,
      help: 'Aujourd’hui compte. Le jour de la paie, mettez 1.',
    },
  ],
  steps: [
    {
      key: 'reelDisponible',
      label: 'Ce qu’il reste vraiment',
      formula: 'solde + aVenir - prelevements',
      kind: 'money',
      output: true,
      help: 'Le solde une fois les prélèvements connus passés et les rentrées sûres arrivées.',
    },
    {
      key: 'manque',
      label: 'Ce qui manque pour tenir',
      formula: 'max(0 - reelDisponible, 0)',
      kind: 'money',
      output: true,
      help: 'Zéro tant que les prélèvements sont couverts. Au-dessus de zéro, c’est le montant à trouver.',
    },
    {
      key: 'depensable',
      label: 'Dépensable d’ici la paie',
      formula: 'max(reelDisponible - matelas, 0)',
      kind: 'money',
      output: true,
      help: 'Le matelas est retiré : il n’a jamais été dépensable.',
    },
    {
      key: 'parJour',
      label: 'Par jour',
      formula: 'depensable / max(jours, 1)',
      kind: 'money',
      output: true,
    },
    {
      key: 'parSemaine',
      label: 'Par semaine',
      formula: 'min(parJour * 7, depensable)',
      kind: 'money',
      output: true,
      help: 'Plafonné au dépensable : s’il reste quatre jours, une semaine n’en vaut pas sept.',
    },
  ],
};

export const PERSONAL_CALC_PROFILES: CalcProfile[] = [BUDGET_AVANT_PAIE];

export const DEFAULT_PERSONAL_PROFILE_ID = BUDGET_AVANT_PAIE.id;

export function personalProfileById(id: string): CalcProfile | undefined {
  return PERSONAL_CALC_PROFILES.find((profile) => profile.id === id);
}
