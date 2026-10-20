import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pin, PinOff } from 'lucide-react';
import type { NavItem } from '../../data/navigation';
import { toutesLesSections } from '../../data/spaces';
import { libelleNav, indiceNav } from '../../i18n';
import { useNavFavorites } from '../../state/useNavFavorites';
import { useNavAlleges } from '../../state/useNavAlleges';
import { FAMILLES, type Famille } from '../../socle/familles';
import { useSocleLangue } from '../../socle/i18n';
import { Carte, Saisie } from '../../socle/ui';
import { ACTIONS, entreeDuRegistre, familleDe, type CleAction } from './registre';
import { chercher } from './recherche';
import { useNavLangue } from './i18n';

/**
 * TOUS LES MODULES — rangés par famille, puis par ce qu'on veut faire.
 *
 * La vue qui remplace les codes à deux lettres : sept cartes (une par
 * famille, à sa couleur), et dans chacune des petits groupes nommés par une
 * action (« Facturer », « Sur le terrain »…). Le champ du haut cherche par
 * intention, comme ⌘K.
 *
 * Elle ne montre que les modules ouverts à l'organisation et non allégés,
 * comme le rail : alléger reste le travail de la Bibliothèque.
 */
export function TousLesModules() {
  const { tn } = useNavLangue();
  const { ts } = useSocleLangue();
  const { alleges } = useNavAlleges();
  const { isFavorite, toggleFavorite } = useNavFavorites();
  const [requete, setRequete] = useState('');

  // `alleges` en dépendance : `toutesLesSections` lit un registre, pas un état React.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const catalogue = useMemo(() => toutesLesSections().flatMap((s) => s.items), [alleges]);

  const trouvailles = useMemo(
    () =>
      requete.trim()
        ? chercher(
            requete,
            catalogue.map((item) => ({ ...item, label: libelleNav(item), hint: indiceNav(item) })),
          )
        : null,
    [requete, catalogue],
  );

  const rangement = useMemo(() => {
    const parFamille = new Map<Famille, Map<CleAction, NavItem[]>>();
    for (const item of catalogue) {
      const entree = entreeDuRegistre(item.key);
      const famille = familleDe(item.key);
      const action = entree?.action ?? ('outils.pratique' as CleAction);
      const actions = parFamille.get(famille) ?? new Map<CleAction, NavItem[]>();
      actions.set(action, [...(actions.get(action) ?? []), item]);
      parFamille.set(famille, actions);
    }
    return parFamille;
  }, [catalogue]);

  const ligne = (item: NavItem, raison?: string) => (
    <LigneModule
      key={item.key}
      item={item}
      libelle={libelleNav(item)}
      detail={raison ?? indiceNav(item)}
      epingle={isFavorite(item.key)}
      onEpingler={() => toggleFavorite(item.key)}
      libelleEpingler={(nom, oui) => tn(oui ? 'rail.detacher' : 'rail.epingler', { nom })}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 data-guide="titre" className="text-2xl font-semibold text-text-primary">
          {tn('tous.titre')}
        </h1>
        <p className="text-sm text-text-secondary">{tn('tous.texte')}</p>
      </header>

      <div className="max-w-md">
        <Saisie
          type="search"
          etiquette={tn('tous.filtre')}
          aide={tn('tous.filtre.aide')}
          value={requete}
          onChange={(e) => setRequete(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setRequete('');
          }}
        />
      </div>

      {trouvailles ? (
        trouvailles.length === 0 ? (
          <p className="text-sm text-text-secondary">{tn('tous.aucun', { q: requete.trim() })}</p>
        ) : (
          <ul className="flex max-w-2xl flex-col gap-0.5">
            {trouvailles.map((t) => ligne(catalogue.find((i) => i.key === t.item.key) ?? t.item, t.raison))}
          </ul>
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {FAMILLES.map((famille) => {
            const actions = rangement.get(famille);
            if (!actions) return null;
            const total = [...actions.values()].reduce((n, l) => n + l.length, 0);
            return (
              <Carte key={famille} famille={famille} titre={ts(`famille.${famille}`)} surtitre={tn('tous.compte', { n: total })}>
                <div className="flex flex-col gap-4">
                  {(ACTIONS[famille] as readonly string[]).map((a) => {
                    const cle = `${famille}.${a}` as CleAction;
                    const items = actions.get(cle);
                    if (!items) return null;
                    return (
                      <section key={cle} aria-label={tn(`action.${cle}`)}>
                        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-socle-texte-discret">
                          {tn(`action.${cle}`)}
                        </h3>
                        <ul className="flex flex-col gap-0.5">{items.map((i) => ligne(i))}</ul>
                      </section>
                    );
                  })}
                </div>
              </Carte>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LigneModule({
  item,
  libelle,
  detail,
  epingle,
  onEpingler,
  libelleEpingler,
}: {
  item: NavItem;
  libelle: string;
  detail?: string;
  epingle: boolean;
  onEpingler: () => void;
  libelleEpingler: (nom: string, epingle: boolean) => string;
}) {
  const Icone = item.icon;
  return (
    <li data-famille={familleDe(item.key)} className="group flex items-center gap-1">
      <Link
        to={item.to}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 text-socle-texte transition-colors hover:bg-socle-survol focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-socle-focus"
      >
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-[var(--fam-bord)] bg-[var(--fam-fond)] text-[var(--fam-texte)]">
          <Icone size={14} strokeWidth={2.1} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px]">{libelle}</span>
          {detail && <span className="block truncate text-[12px] text-socle-texte-doux">{detail}</span>}
        </span>
      </Link>
      <button
        type="button"
        onClick={onEpingler}
        aria-pressed={epingle}
        aria-label={libelleEpingler(libelle, epingle)}
        title={libelleEpingler(libelle, epingle)}
        className={`flex h-8 w-8 flex-none items-center justify-center rounded-md text-socle-texte-discret transition-opacity hover:text-socle-texte focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-socle-focus group-hover:opacity-100 ${epingle ? 'opacity-100' : 'opacity-0'}`}
      >
        {epingle ? <PinOff size={13} strokeWidth={2} /> : <Pin size={13} strokeWidth={2} />}
      </button>
    </li>
  );
}
