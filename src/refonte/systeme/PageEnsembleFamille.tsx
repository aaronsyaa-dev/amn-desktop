import React, { useMemo } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { NAV_SECTIONS } from '../../data/navigation';
import { isModuleEnabled } from '../../data/spaces';
import { indiceNav, libelleNav, useLangue } from '../../i18n';
import { Carte } from '../../socle/ui';
import { REGISTRE_MODULES } from '../modules/registre';
import { ROUTE_TOUS_LES_MODULES } from '../navigation/moment';
import { definirMots } from '../../socle/mots';

/**
 * LA VUE D'ENSEMBLE D'UNE FAMILLE — la page générique, en attendant celle de chaque lot (F10 à F60).
 *
 * « Vue d'ensemble » est la première ligne de chaque famille de la barre latérale (01-SOCLE-DESIGN §3). Le lot qui
 * construit la page d'accueil d'une famille la branche dans `ensemble.ts` ; tant qu'elle n'existe pas, cette page
 * dresse la liste des modules de la famille, un par carte, avec ce qu'ils font. Jamais un lien mort.
 */
const { useMots } = definirMots(
  { 'sous': '{n} modules in this family', 'tous': 'See all modules', 'introuvable': 'This family does not exist.' } as const,
  { 'sous': '{n} modules dans cette famille', 'tous': 'Voir tous les modules', 'introuvable': 'Cette famille n’existe pas.' },
);

export function PageEnsembleFamille() {
  const { famille: id = '' } = useParams();
  const { langue } = useLangue();
  const { tm } = useMots();
  const navigate = useNavigate();
  const famille = REGISTRE_MODULES.familles.find((f) => f.id === id);

  const modules = useMemo(() => {
    if (!famille) return [];
    const ouverts = new Map(NAV_SECTIONS.flatMap((s) => s.items).filter((i) => isModuleEnabled(i.key)).map((i) => [i.key, i]));
    return famille.entrees.flatMap((e) => {
      const vues = e.vues.flatMap((v) => ouverts.get(v.id) ?? []);
      if (vues.length === 0) return [];
      return [{ id: e.id, nom: e.nom ? e.nom[langue] : libelleNav(vues[0]), indice: indiceNav(vues[0]), vers: vues[0].to }];
    });
  }, [famille, langue]);

  if (!famille) return <Navigate to={ROUTE_TOUS_LES_MODULES} replace />;

  return (
    <div data-refonte-police="inter" data-famille={famille.teinte} className="flex flex-col gap-5">
      <header>
        <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-socle-texte">{famille.nom[langue]}</h1>
        <p className="mt-[7px] text-[13.5px] text-socle-texte-discret">{tm('sous', { n: modules.length })}</p>
      </header>
      <ul className="grid list-none grid-cols-1 gap-[14px] p-0 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((m) => (
          <li key={m.id}>
            <Carte famille={famille.teinte} titre={m.nom} niveauTitre={2} onClick={() => navigate(m.vers)}>
              {m.indice}
            </Carte>
          </li>
        ))}
      </ul>
      <p>
        <Link to={ROUTE_TOUS_LES_MODULES} className="text-[13px] text-socle-texte-doux underline underline-offset-4">
          {tm('tous')}
        </Link>
      </p>
    </div>
  );
}

export default PageEnsembleFamille;
