import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Pin, PinOff } from 'lucide-react';
import { navItemByKey, type NavItem } from '../../data/navigation';
import { toutesLesSections } from '../../data/spaces';
import { libelleNav, indiceNav } from '../../i18n';
import { useNavFavorites } from '../../state/useNavFavorites';
import { useNavAlleges } from '../../state/useNavAlleges';
import { Saisie } from '../../socle/ui';
import { NIVEAUX, type Libelle, type Niveau } from '../modules/declarer';
import type { EntreeRegistre, FamilleRegistre } from '../modules/assembler';
import { REGISTRE_MODULES } from '../modules/registre';
import { entreeDuRegistre, familleDe } from './registre';
import { chercher } from './recherche';
import { useNavLangue } from './i18n';

/**
 * TOUS LES MODULES — une grille de cartes, une par famille (refonte S5).
 *
 * Noir et gris : la couleur d'une famille n'est plus qu'un petit point devant
 * son nom. Dans chaque carte, les entrées sont rangées par action (« Facturer »,
 * « Sur le terrain »…). Une entrée qui regroupe plusieurs vues (Facturation :
 * Relances, Acompte) les montre en liens discrets sous son nom.
 *
 * Trois niveaux, en filtres avec leur compteur : Essentiels, Courants,
 * Avancés. Sous « Tous », les Avancés d'une famille restent repliés sous
 * « Plus ». Le champ du haut cherche par intention, comme ⌘K, dans tous les
 * niveaux.
 *
 * Elle ne montre que les modules ouverts à l'organisation et non allégés,
 * comme le rail : alléger reste le travail de la Bibliothèque. Tout se lit au
 * registre (`src/refonte/modules/`) : une famille ou un module déclarés y
 * apparaissent sans toucher à ce fichier.
 */

type Filtre = 'tous' | Niveau;
const FILTRES: readonly Filtre[] = ['tous', ...NIVEAUX];

interface EntreeOuverte {
  entree: EntreeRegistre;
  /** Les vues ouvertes, la principale d'abord quand elle l'est. */
  vues: NavItem[];
}

export function TousLesModules() {
  const { langue, tn } = useNavLangue();
  const { alleges } = useNavAlleges();
  const { isFavorite, toggleFavorite } = useNavFavorites();
  const [requete, setRequete] = useState('');
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [deplies, setDeplies] = useState<ReadonlySet<string>>(() => new Set());
  const dire = (l: Libelle) => l[langue];

  // `alleges` en dépendance : `toutesLesSections` lit un registre, pas un état React.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const catalogue = useMemo(() => toutesLesSections().flatMap((s) => s.items), [alleges]);

  /* Les familles et leurs entrées ouvertes ; une entrée sans aucune vue ouverte disparaît. */
  const familles = useMemo(() => {
    const ouverts = new Map(catalogue.map((i) => [i.key, i]));
    return REGISTRE_MODULES.familles
      .map((famille) => ({
        famille,
        entrees: famille.entrees
          .map((entree): EntreeOuverte => ({ entree, vues: entree.vues.flatMap((v) => ouverts.get(v.id) ?? []) }))
          .filter((e) => e.vues.length > 0),
      }))
      .filter((f) => f.entrees.length > 0);
  }, [catalogue]);

  const compteurs = useMemo(() => {
    const toutes = familles.flatMap((f) => f.entrees);
    const n: Record<Filtre, number> = { tous: toutes.length, essentiel: 0, courant: 0, avance: 0 };
    for (const e of toutes) n[e.entree.niveau] += 1;
    return n;
  }, [familles]);

  const nomsDeFamille = useMemo(() => new Map(REGISTRE_MODULES.familles.map((f) => [f.id, f.nom])), []);
  const trouvailles = useMemo(
    () =>
      requete.trim()
        ? chercher(
            requete,
            catalogue.map((item) => ({ ...item, label: libelleNav(item), hint: indiceNav(item) })),
            { langue },
          )
        : null,
    [requete, catalogue, langue],
  );

  const nomEntree = (e: EntreeOuverte) => (e.entree.nom ? dire(e.entree.nom) : libelleNav(e.vues[0]));
  const libelleEpingler = (nom: string, oui: boolean) => tn(oui ? 'rail.detacher' : 'rail.epingler', { nom });

  const ligne = (e: EntreeOuverte) => {
    const nom = nomEntree(e);
    const principal = e.vues[0];
    return (
      <LigneEntree
        key={e.entree.id}
        principal={principal}
        nom={nom}
        detail={e.vues.length === 1 ? indiceNav(principal) : undefined}
        sousVues={
          e.vues.length > 1
            ? e.vues.map((item) => {
                const etiquette = entreeDuRegistre(item.key)?.etiquette;
                return { item, libelle: etiquette ? dire(etiquette) : libelleNav(item) };
              })
            : []
        }
        libelleSousVues={tn('tous.vues', { nom })}
        epingle={isFavorite(principal.key)}
        onEpingler={() => toggleFavorite(principal.key)}
        libelleEpingler={libelleEpingler}
      />
    );
  };

  const parAction = (famille: FamilleRegistre, entrees: EntreeOuverte[]) =>
    famille.actions.map((a) => {
      const items = entrees.filter((e) => e.entree.action === a.cle);
      if (items.length === 0) return null;
      return (
        <section key={a.cle} aria-label={dire(a.libelle)}>
          <h3 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">{dire(a.libelle)}</h3>
          <ul className="flex flex-col gap-0.5">{items.map(ligne)}</ul>
        </section>
      );
    });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 data-guide="titre" className="text-2xl font-semibold text-text-primary">
          {tn('tous.titre')}
        </h1>
        <p className="text-sm text-text-secondary">{tn('tous.texte')}</p>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="w-full max-w-md">
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
        {!trouvailles && (
          <div role="group" aria-label={tn('tous.niveaux')} className="flex flex-wrap gap-1 rounded-lg border border-border-section bg-sunken p-1">
            {FILTRES.map((f) => {
              const actif = filtre === f;
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => setFiltre(f)}
                  className={`flex min-h-9 items-center gap-2 rounded-md px-3 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-socle-focus ${
                    actif ? 'bg-surface-hover font-semibold text-text-primary' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {tn(`tous.niveau.${f}`)}
                  <Pastille n={compteurs[f]} etiquette={tn('tous.compte', { n: compteurs[f] })} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {trouvailles ? (
        trouvailles.length === 0 ? (
          <p className="text-sm text-text-secondary">{tn('tous.aucun', { q: requete.trim() })}</p>
        ) : (
          <ul className="flex max-w-2xl flex-col gap-0.5">
            {trouvailles.map((t) => {
              const item = catalogue.find((i) => i.key === t.item.key) ?? t.item;
              return (
                <LigneEntree
                  key={item.key}
                  principal={item}
                  nom={libelleNav(item)}
                  detail={t.raison ?? indiceNav(item)}
                  famille={(() => {
                    const nom = nomsDeFamille.get(entreeDuRegistre(item.key)?.famille ?? '');
                    return nom ? dire(nom) : undefined;
                  })()}
                  point
                  sousVues={[]}
                  libelleSousVues=""
                  epingle={isFavorite(item.key)}
                  onEpingler={() => toggleFavorite(item.key)}
                  libelleEpingler={libelleEpingler}
                />
              );
            })}
          </ul>
        )
      ) : compteurs[filtre] === 0 ? (
        <p className="text-sm text-text-secondary">{tn('tous.niveau.vide')}</p>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {familles.map(({ famille, entrees }) => {
            const visibles = entrees.filter((e) => (filtre === 'tous' ? e.entree.niveau !== 'avance' : e.entree.niveau === filtre));
            const avances = filtre === 'tous' ? entrees.filter((e) => e.entree.niveau === 'avance') : [];
            if (visibles.length === 0 && avances.length === 0) return null;
            const deplie = deplies.has(famille.id);
            const idPlus = `tous-plus-${famille.id}`;
            const nombre = visibles.length + avances.length;
            return (
              <section
                key={famille.id}
                data-famille={famille.teinte}
                aria-labelledby={`tous-famille-${famille.id}`}
                className="flex flex-col gap-4 rounded-lg border border-border-section bg-surface p-4"
              >
                <header className="flex items-center gap-2 px-2">
                  <span aria-hidden className="h-2 w-2 flex-none rounded-full bg-[var(--fam)]" />
                  <h2 id={`tous-famille-${famille.id}`} className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text-primary">
                    {dire(famille.nom)}
                  </h2>
                  <Pastille n={nombre} etiquette={tn('tous.compte', { n: nombre })} />
                </header>

                {parAction(famille, visibles)}

                {avances.length > 0 && (
                  <div className="flex flex-col gap-2 border-t border-border-section pt-3">
                    <button
                      type="button"
                      aria-expanded={deplie}
                      aria-controls={idPlus}
                      onClick={() =>
                        setDeplies((s) => {
                          const n = new Set(s);
                          if (n.has(famille.id)) n.delete(famille.id);
                          else n.add(famille.id);
                          return n;
                        })
                      }
                      className="flex min-h-9 items-center gap-2 rounded-md px-2 text-left text-[13px] text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-socle-focus"
                    >
                      <ChevronDown size={14} strokeWidth={2} aria-hidden className={`transition-transform ${deplie ? 'rotate-180' : ''}`} />
                      <span className="flex-1">{tn(deplie ? 'tous.moins' : 'tous.plus')}</span>
                      <Pastille n={avances.length} etiquette={tn('tous.compte', { n: avances.length })} />
                    </button>
                    {deplie && (
                      <div id={idPlus} className="flex flex-col gap-4">
                        {parAction(famille, avances)}
                      </div>
                    )}
                  </div>
                )}

                {famille.remplacees.map((r) => (
                  <p key={r.id} className="px-2 text-[12px] text-text-muted">
                    {tn('tous.remplace', { nom: libelleNav(navItemByKey(r.id) ?? { key: r.id, label: r.id }), par: dire(r.par) })}
                  </p>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Un compteur : un chiffre dans une pastille grise. Le nom accessible dit ce qu'il compte. */
function Pastille({ n, etiquette }: { n: number; etiquette: string }) {
  return (
    <span
      aria-label={etiquette}
      className="flex h-5 min-w-5 flex-none items-center justify-center rounded-full border border-border-section bg-sunken px-1.5 font-mono text-[10.5px] text-text-muted"
    >
      {n}
    </span>
  );
}

function LigneEntree({
  principal,
  nom,
  detail,
  point = false,
  famille,
  sousVues,
  libelleSousVues,
  epingle,
  onEpingler,
  libelleEpingler,
}: {
  principal: NavItem;
  nom: string;
  detail?: string;
  /** Le petit point de la famille, devant le nom (résultats de recherche, hors des cartes). */
  point?: boolean;
  /** Le nom de la famille, en gris après le nom : deux modules peuvent porter le même (Calendrier). */
  famille?: string;
  sousVues: { item: NavItem; libelle: string }[];
  libelleSousVues: string;
  epingle: boolean;
  onEpingler: () => void;
  libelleEpingler: (nom: string, epingle: boolean) => string;
}) {
  const Icone = principal.icon;
  return (
    <li data-famille={familleDe(principal.key)} className="group flex flex-col">
      <div className="flex items-center gap-1">
        <Link
          to={principal.to}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-socle-focus"
        >
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-border-section bg-sunken text-text-secondary">
            <Icone size={14} strokeWidth={2.1} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              {point && <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-[var(--fam)]" />}
              <span className="block truncate text-[14px] text-text-primary">{nom}</span>
              {famille && <span className="flex-none truncate text-[11.5px] text-text-muted">· {famille}</span>}
            </span>
            {detail && <span className="block truncate text-[12px] text-text-muted">{detail}</span>}
          </span>
        </Link>
        <button
          type="button"
          onClick={onEpingler}
          aria-pressed={epingle}
          aria-label={libelleEpingler(nom, epingle)}
          title={libelleEpingler(nom, epingle)}
          className={`flex h-8 w-8 flex-none items-center justify-center rounded-md text-text-muted transition-opacity hover:text-text-primary focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-socle-focus group-hover:opacity-100 ${epingle ? 'opacity-100' : 'opacity-0'}`}
        >
          {epingle ? <PinOff size={13} strokeWidth={2} /> : <Pin size={13} strokeWidth={2} />}
        </button>
      </div>
      {sousVues.length > 0 && (
        <ul aria-label={libelleSousVues} className="mb-1 ml-[42px] flex flex-wrap gap-x-3 gap-y-0.5">
          {sousVues.map(({ item, libelle }) => (
            <li key={item.key}>
              <Link
                to={item.to}
                className="inline-flex min-h-6 items-center text-[12px] text-text-muted underline-offset-2 transition-colors hover:text-text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-socle-focus"
              >
                {libelle}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
