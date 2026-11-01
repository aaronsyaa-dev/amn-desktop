import type { NavItem } from '../../../data/navigation';
import { indiceNav, libelleNav } from '../../../i18n';
import { REGISTRE_MODULES } from '../../modules/registre';
import { chercher } from '../../navigation/recherche';
import { routeEnsemble } from '../ensemble';
import type { Correspondance, FamilleRepertoire, ModuleRepertoire } from './logique';
import type { ModulePuce } from './VueTousLesModules';

/**
 * LE RÉPERTOIRE, LU AU REGISTRE (D02) — les familles et leurs modules, d'après `src/refonte/modules/` et le
 * catalogue des vues, avec ce que la page sait de plus (compteurs, présences, activation, verrous).
 *
 * Le registre reste la SEULE source des modules, de leurs familles et de leurs niveaux : le total, les effectifs
 * et les trois niveaux se calculent depuis lui. Un module que l'espace n'a pas activé reste listé (« non activé »),
 * un module que le rôle ne peut pas ouvrir aussi (cadenas) : l'effectif ne change pas.
 */
export interface SourcesRepertoire {
  langue: 'fr' | 'en';
  /** Toutes les vues du catalogue, par clé (activées ou non). */
  catalogue: ReadonlyMap<string, NavItem>;
  /** Les compteurs de la coquille, par adresse. */
  compteurs: Readonly<Record<string, number>>;
  /** Les collègues présents, par adresse de vue. */
  presents: ReadonlyMap<string, readonly string[]>;
  estActive: (cle: string) => boolean;
  estVerrouille: (cle: string) => boolean;
  /** Le nom court de La Garde (« La Garde » : jamais tronqué, écart C6). */
  nomGarde: string;
}

export function lireRepertoire(s: SourcesRepertoire): FamilleRepertoire[] {
  return REGISTRE_MODULES.familles
    .map((famille): FamilleRepertoire => ({
      id: famille.id,
      nom: famille.amnSeulement ? s.nomGarde : famille.nom[s.langue],
      teinte: famille.amnSeulement ? 'garde' : famille.teinte,
      vers: routeEnsemble(famille.id),
      garde: famille.amnSeulement,
      modules: famille.entrees
        .map((entree): ModuleRepertoire | null => {
          const vues = entree.vues.flatMap((v) => s.catalogue.get(v.id) ?? []);
          if (vues.length === 0) return null;
          const actives = vues.filter((v) => s.estActive(v.key));
          const personnes = new Set<string>();
          for (const v of vues) for (const p of s.presents.get(v.to) ?? []) personnes.add(p);
          return {
            id: entree.id,
            nom: entree.nom ? entree.nom[s.langue] : libelleNav(vues[0]),
            vers: (actives[0] ?? vues[0]).to,
            niveau: entree.niveau,
            badge: vues.reduce((n, v) => n + (s.compteurs[v.to] ?? 0), 0),
            personnes: [...personnes],
            active: actives.length > 0,
            verrouille: actives.length === 0 && vues.some((v) => s.estVerrouille(v.key)),
            nouveau: entree.vues.some((v) => Boolean(v.nouveau)),
            cles: vues.map((v) => v.key),
          };
        })
        .filter((m): m is ModuleRepertoire => m !== null),
    }))
    .filter((f) => f.modules.length > 0);
}

/** Les modules qui répondent à une saisie : la recherche par intention, ramenée aux entrées du registre. */
export function correspondancesDe(requete: string, catalogue: ReadonlyMap<string, NavItem>, langue: 'fr' | 'en'): Map<string, Correspondance> {
  const trouvees = chercher(requete, [...catalogue.values()].map((item) => ({ ...item, label: libelleNav(item), hint: item.hint })), { langue });
  const parCle = new Map(trouvees.map((t) => [t.item.key, t]));
  const sortie = new Map<string, Correspondance>();
  for (const f of REGISTRE_MODULES.familles) for (const e of f.entrees) {
    const meilleure = e.vues
      .map((v) => parCle.get(v.id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .sort((a, b) => b.score - a.score)[0];
    if (meilleure) sortie.set(e.id, { score: meilleure.score, raison: meilleure.raison });
  }
  return sortie;
}

/** Un module du répertoire en puce de la colonne droite : sa teinte de famille, l'icône et l'indice de sa vue. */
export function enPuce(m: ModuleRepertoire, familles: readonly FamilleRepertoire[], catalogue: ReadonlyMap<string, NavItem>): ModulePuce {
  const famille = familles.find((f) => f.modules.includes(m));
  const vue = catalogue.get(m.cles[0]);
  return {
    id: m.id,
    nom: m.nom,
    vers: m.vers,
    teinte: famille?.teinte ?? 'outils',
    icone: vue?.icon,
    indice: vue ? indiceNav(vue) || undefined : undefined,
    cle: m.cles[0],
  };
}

/** Le module du répertoire qui range une clé du catalogue (une épingle, une ligne du journal). */
export function moduleDeLaCle(familles: readonly FamilleRepertoire[], cle: string): ModuleRepertoire | undefined {
  for (const f of familles) for (const m of f.modules) if (m.cles.includes(cle)) return m;
  return undefined;
}

/**
 * Une épingle en puce : la VUE épinglée (son libellé court du catalogue, sa route), teintée de la famille du module
 * qui la range. `undefined` si la clé n'est plus au registre.
 */
export function epingleEnPuce(cle: string, familles: readonly FamilleRepertoire[], catalogue: ReadonlyMap<string, NavItem>): ModulePuce | undefined {
  const m = moduleDeLaCle(familles, cle);
  const vue = catalogue.get(cle);
  if (!m || !vue) return undefined;
  return { ...enPuce(m, familles, catalogue), nom: libelleNav(vue), vers: vue.to, icone: vue.icon, cle };
}
