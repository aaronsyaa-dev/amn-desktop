import type { NavItem, NavSection } from '../../data/navigation';
import type { Registre, VueRegistre } from './assembler';
import type { EcranNeuf } from './declarer';
import { REGISTRE_MODULES } from './registre';

/**
 * LES ÉCRANS NEUFS AU CATALOGUE — ce qui évite de toucher au rail.
 *
 * Une vue déclarée avec `nouveau` n'est pas dans `modules.internal.ts` : on
 * la range ici dans une section du catalogue, que ce fichier ajoute à la fin
 * de `NAV_SECTIONS`. Le rail, la palette, les épinglés et le filtre des
 * modules ouverts la voient alors comme n'importe quel module.
 *
 * Deux sections au plus, vides aujourd'hui (aucune vue n'est `nouveau`) : une
 * pour le Poste de travail, une pour la Garde (familles `amnSeulement`), pour
 * qu'une vue réservée à l'équipe AMN ne tombe jamais dans l'espace de travail.
 */
function item(entreeNom: string, v: VueRegistre & { nouveau: EcranNeuf }): NavItem {
  const neuf = v.nouveau;
  return { key: v.id, label: v.etiquette?.fr ?? entreeNom, to: v.route, icon: neuf.icone, hint: neuf.indice.fr };
}

export function sectionsDuRegistre(registre: Registre = REGISTRE_MODULES): NavSection[] {
  const poste: NavItem[] = [];
  const garde: NavItem[] = [];
  for (const e of registre.entrees) {
    for (const v of e.vues) {
      if (!v.nouveau) continue;
      (e.amnSeulement ? garde : poste).push(item(e.nom?.fr ?? v.id, { ...v, nouveau: v.nouveau }));
    }
  }
  const sections: NavSection[] = [];
  if (poste.length > 0) sections.push({ key: 'registre', code: 'NV', label: 'Nouveaux modules', space: 'workspace', items: poste });
  if (garde.length > 0) sections.push({ key: 'registre-garde', code: 'NG', label: 'Nouveaux modules de la Garde', space: 'garde', items: garde });
  return sections;
}
