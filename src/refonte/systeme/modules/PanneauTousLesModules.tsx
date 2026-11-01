import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { NAV_SECTIONS, type NavItem } from '../../../data/navigation';
import { isModuleEnabled } from '../../../data/spaces';
import { libelleNav, useLangue } from '../../../i18n';
import { useFermetureEchap } from '../../../lib/useFermetureEchap';
import { useAssistant } from '../../../assistant/AssistantContext';
import { useNavAlleges } from '../../../state/useNavAlleges';
import { useNavFavorites } from '../../../state/useNavFavorites';
import { useRegards, moduleDuChemin } from '../../../state/RegardsContext';
import { useProfilesOptionnel } from '../../../state/ProfilesContext';
import { BoiteRecherche, PastilleFiltre } from '../../../socle/ui/controles';
import { Avatar, PileAvatars, Raccourci } from '../../../socle/ui';
import { BlocEtat } from '../../../socle/ui/situations';
import { REGISTRE_MODULES } from '../../modules/registre';
import { chercher } from '../../navigation/recherche';
import { useDonneesCoquille } from '../../coquille/donnees';
import { routeEnsemble } from '../ensemble';
import {
  carteDeLaLigne,
  compterParNiveau,
  composerCartes,
  ordreDeSelection,
  surligner,
  type CarteComposee,
  type Correspondance,
  type EntreeSource,
  type FamilleSource,
  type FiltreNiveau,
  type LigneCarte,
} from './logique';
import { useMots } from './i18n';
import './modules.css';

/**
 * TOUS LES MODULES (D02) — le panneau des modules, rangés en familles.
 * ═══════════════════════════════════════════════════════════════════
 *
 * Il remplace la page de S5 dans l'édition interne (couture `@edition/navigation`) ; la page de S5 reste en place,
 * intacte, et le registre (`src/refonte/modules/`) reste la seule source : 101, les effectifs des familles et les
 * trois niveaux se calculent depuis lui, rien n'est écrit à la main. La barre latérale y mène (« Tous les modules »
 * et « + N autres », ce dernier avec `?famille=` : la carte de cette famille est alors en état actif).
 *
 * C'est une route (`/tous-les-modules`) qui s'affiche en panneau modal, rendu dans <body> : Échap, un clic sur le
 * voile ou l'ouverture d'un module ramènent à la page d'où l'on vient. Les modules « allégés » par la personne y
 * restent listés (alléger n'est qu'un affichage) ; ceux que l'organisation n'a pas ouverts n'y sont pas.
 */

function lireFamilles(langue: 'fr' | 'en', catalogue: ReadonlyMap<string, NavItem>, compteurs: Record<string, number>, presents: ReadonlyMap<string, string[]>, epingle: (cle: string) => boolean): FamilleSource[] {
  return REGISTRE_MODULES.familles
    .map((famille) => ({
      id: famille.id,
      nom: famille.nom[langue],
      teinte: famille.teinte,
      vers: routeEnsemble(famille.id),
      entrees: famille.entrees
        .map((entree): EntreeSource | null => {
          const vues = entree.vues.flatMap((v) => catalogue.get(v.id) ?? []);
          if (vues.length === 0) return null;
          const personnes = new Set<string>();
          for (const v of vues) for (const p of presents.get(v.to) ?? []) personnes.add(p);
          return {
            id: entree.id,
            nom: entree.nom ? entree.nom[langue] : libelleNav(vues[0]),
            vers: vues[0].to,
            niveau: entree.niveau,
            badge: vues.reduce((n, v) => n + (compteurs[v.to] ?? 0), 0),
            personnes: [...personnes],
            epingle: epingle(vues[0].key),
          };
        })
        .filter((e): e is EntreeSource => e !== null),
    }))
    .filter((f) => f.entrees.length > 0);
}

export function PanneauTousLesModules() {
  const { langue } = useLangue();
  const { tm } = useMots();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const assistant = useAssistant();
  const { alleges } = useNavAlleges();
  const { isFavorite } = useNavFavorites();
  const { autres } = useRegards();
  const profils = useProfilesOptionnel();
  const donnees = useDonneesCoquille(location.pathname, null);

  const [requete, setRequete] = useState('');
  const [niveau, setNiveau] = useState<FiltreNiveau>('tous');
  const [deplie, setDeplie] = useState<ReadonlySet<string>>(() => new Set());
  const [selection, setSelection] = useState(0);
  const retour = useRef<HTMLElement | null>(null);
  const grille = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLInputElement>(null);

  const fermer = () => {
    // Sans page précédente (lien direct), on retombe sur l'accueil : jamais un panneau qui ne se ferme pas.
    if (location.key !== 'default') navigate(-1);
    else navigate('/', { replace: true });
  };
  useFermetureEchap(true, fermer);
  useEffect(() => {
    retour.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (retour.current?.isConnected) retour.current.focus();
    };
  }, []);

  /* Les modules ouverts à l'organisation, allégés compris. */
  const catalogue = useMemo(() => {
    const m = new Map<string, NavItem>();
    for (const s of NAV_SECTIONS) for (const i of s.items) if (isModuleEnabled(i.key)) m.set(i.key, i);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alleges]);

  const nomDe = (email: string) => profils?.profileFor(email)?.name?.trim() || email.split('@')[0];
  const presents = useMemo(() => {
    const m = new Map<string, string[]>();
    const routes = [...catalogue.values()].map((i) => i.to).filter((t) => t !== '/');
    for (const r of autres) {
      if (r.parti) continue;
      const chemin = moduleDuChemin(r.module);
      const cible = chemin === '/' ? '/' : routes.filter((t) => chemin === t || chemin.startsWith(`${t}/`)).sort((a, b) => b.length - a.length)[0];
      if (!cible) continue;
      m.set(cible, [...(m.get(cible) ?? []), nomDe(r.email)]);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autres, catalogue, profils]);

  const familles = useMemo(
    () => lireFamilles(langue, catalogue, donnees.compteurs, presents, isFavorite),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [langue, catalogue, donnees.compteurs, presents],
  );
  const total = useMemo(() => compterParNiveau(familles), [familles]);

  const correspondances = useMemo(() => {
    const q = requete.trim();
    if (!q) return null;
    const trouvees = chercher(q, [...catalogue.values()].map((item) => ({ ...item, label: libelleNav(item), hint: item.hint })));
    const parCle = new Map(trouvees.map((t) => [t.item.key, t]));
    const sortie = new Map<string, Correspondance>();
    for (const f of REGISTRE_MODULES.familles) for (const e of f.entrees) {
      const meilleure = e.vues.map((v) => parCle.get(v.id)).filter((t): t is NonNullable<typeof t> => Boolean(t)).sort((a, b) => b.score - a.score)[0];
      if (meilleure) sortie.set(e.id, { score: meilleure.score, raison: meilleure.raison });
    }
    return sortie;
  }, [requete, catalogue]);

  const cartes = useMemo(() => composerCartes(familles, { niveau, correspondances, deplie }), [familles, niveau, correspondances, deplie]);
  const ordre = useMemo(() => ordreDeSelection(cartes, correspondances), [cartes, correspondances]);
  const idSelectionnee = ordre[Math.min(selection, ordre.length - 1)];
  const carteActive = carteDeLaLigne(cartes, idSelectionnee) ?? (params.get('famille') ?? undefined);

  useEffect(() => setSelection(0), [requete, niveau]);
  const aucun = Boolean(correspondances) && correspondances?.size === 0;
  const nombreFamilles = familles.length;
  const nombreModules = niveau === 'tous' ? total.tous : total[niveau];

  const ligneParId = (id: string | undefined): LigneCarte | undefined => (id ? cartes.flatMap((c) => c.lignes).find((l) => l.id === id) : undefined);
  const ouvrir = (vers: string) => navigate(vers);

  const surChamp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && ordre.length > 0) {
      e.preventDefault();
      setSelection((s) => (s + 1) % ordre.length);
    } else if (e.key === 'ArrowUp' && ordre.length > 0) {
      e.preventDefault();
      setSelection((s) => (s - 1 + ordre.length) % ordre.length);
    } else if (e.key === 'Enter') {
      const l = ligneParId(idSelectionnee);
      if (l) {
        e.preventDefault();
        ouvrir(l.type === 'action' ? l.vers : l.entree.vers);
      }
    }
  };

  /* Les flèches dans la grille : de ligne en ligne, dans l'ordre de lecture ; Entrée ouvre (c'est un lien). */
  const surGrille = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const lignes = [...(grille.current?.querySelectorAll<HTMLElement>('[data-ligne]') ?? [])];
    const i = lignes.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    const suivant = e.key === 'Home' ? 0 : e.key === 'End' ? lignes.length - 1 : e.key === 'ArrowDown' || e.key === 'ArrowRight' ? Math.min(lignes.length - 1, i + 1) : Math.max(0, i - 1);
    lignes[suivant]?.focus();
  };

  const demanderAjmani = () => {
    assistant.sendMessage(requete.trim());
    assistant.open('chat');
    fermer();
  };

  if (typeof document === 'undefined') return null;
  const sousTitre = niveau === 'tous' ? tm('sous', { n: nombreModules, f: nombreFamilles }) : tm('sous.niveau', { n: nombreModules, f: nombreFamilles, niveau: tm(`niveau.${niveau}`) });
  const equipe = donnees.enLigne.map((p) => p.nom);

  return createPortal(
    <div className="dm-voile" onMouseDown={(e) => e.target === e.currentTarget && fermer()} data-tous-les-modules>
      <section role="dialog" aria-modal="true" aria-labelledby="dm-titre" tabIndex={-1} data-refonte-police="inter" className="dm-panneau">
        <header className="dm-entete">
          <div className="dm-entete__titres">
            <h1 id="dm-titre" className="dm-titre">
              {tm('titre')}
            </h1>
            <p className="dm-sous">{sousTitre}</p>
          </div>
          <BoiteRecherche
            grande
            inputRef={champ}
            valeur={requete}
            onChange={setRequete}
            libelle={tm('recherche.libelle')}
            placeholder={tm('recherche.placeholder')}
            autoFocus
            onKeyDown={surChamp}
            className="dm-recherche"
          />
          <button type="button" onClick={fermer} aria-label={tm('echap.nom')} className="dm-echap dm-focus">
            {tm('echap')}
          </button>
        </header>

        <div className="dm-filtres">
          <div role="group" aria-label={tm('filtres')} className="dm-pastilles">
            {(['tous', 'essentiel', 'courant', 'avance'] as const).map((f) => (
              <PastilleFiltre key={f} actif={niveau === f} compteur={total[f]} onClick={() => setNiveau(niveau === f ? 'tous' : f)}>
                {tm(`filtre.${f}`)}
              </PastilleFiltre>
            ))}
          </div>
          {equipe.length > 0 && (
            <p className="dm-presence">
              <span>{tm('presence')}</span>
              <PileAvatars noms={equipe} taille={24} libelle={tm('presence')} />
            </p>
          )}
        </div>

        <div className="dm-corps" role="region" aria-live="polite" aria-label={correspondances ? (aucun ? tm('aucunResultat') : tm('resultats', { n: ordre.length })) : undefined}>
          {aucun ? (
            <BlocEtat
              icone={<Search aria-hidden size={22} />}
              ton="neutre"
              titre={tm('vide.titre', { q: requete.trim() })}
              texte={tm('vide.texte')}
              actions={
                <button type="button" onClick={demanderAjmani} className="dm-ajmani dm-focus" data-socle="bouton" data-variante="primaire">
                  {tm('vide.demander')}
                </button>
              }
            />
          ) : (
            <div ref={grille} onKeyDown={surGrille} className="dm-grille">
              {cartes.map((carte) => (
                <CarteFamille
                  key={carte.id}
                  carte={carte}
                  active={carte.id === carteActive}
                  selection={idSelectionnee}
                  saisie={requete}
                  deplie={deplie.has(carte.id)}
                  niveauLibelle={niveau === 'tous' ? '' : tm(`niveau1.${niveau}`)}
                  onBasculer={() =>
                    setDeplie((s) => {
                      const n = new Set(s);
                      if (n.has(carte.id)) n.delete(carte.id);
                      else n.add(carte.id);
                      return n;
                    })
                  }
                  onVoirTout={() => setNiveau('tous')}
                  onSurvol={(id) => {
                    const i = ordre.indexOf(id);
                    if (i >= 0) setSelection(i);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function CarteFamille({
  carte,
  active,
  selection,
  saisie,
  deplie,
  niveauLibelle,
  onBasculer,
  onVoirTout,
  onSurvol,
}: {
  carte: CarteComposee;
  active: boolean;
  selection: string | undefined;
  saisie: string;
  deplie: boolean;
  /** Le niveau filtré, au singulier (« essentiel »). */
  niveauLibelle: string;
  onBasculer: () => void;
  onVoirTout: () => void;
  onSurvol: (id: string) => void;
}) {
  const { tm } = useMots();
  const garde = carte.id === 'garde';
  return (
    <section data-socle="carte" data-active={active || undefined} data-famille={carte.teinte} aria-labelledby={`dm-f-${carte.id}`} className="dm-carte">
      <header className="dm-carte__entete">
        <span aria-hidden className={garde ? 'dm-carte__bouclier' : 'sc-point'} data-taille="9" />
        <h2 id={`dm-f-${carte.id}`} className="dm-carte__nom">
          <Link to={carte.vers} className="dm-focus" aria-label={tm('famille.ouvrir', { nom: carte.nom })}>
            {carte.nom}
          </Link>
        </h2>
        <span className="dm-carte__effectif">{carte.effectif}</span>
      </header>
      {carte.videAuNiveau ? (
        <div className="dm-carte__vide">
          <p>{tm('niveauVide', { niveau: niveauLibelle })}</p>
          <button type="button" onClick={onVoirTout} className="dm-lien dm-focus">
            {tm('niveauVide.voir', { n: carte.totalSansFiltre })}
          </button>
        </div>
      ) : (
        <ul className={`dm-lignes ${deplie ? 'dm-lignes--complet' : ''}`}>
          {carte.lignes.map((l) => {
            const libelle = l.type === 'action' ? l.libelle : l.entree.nom;
            const [gras, reste] = surligner(libelle, saisie);
            const choisie = l.id === selection;
            const e = l.entree;
            return (
              <li key={l.id}>
                <Link
                  to={l.type === 'action' ? l.vers : e.vers}
                  data-ligne
                  data-choisie={choisie || undefined}
                  data-action={l.type === 'action' || undefined}
                  onMouseMove={() => onSurvol(l.id)}
                  className="dm-ligne dm-focus"
                >
                  <span className="dm-ligne__libelle">
                    {gras ? <b>{gras}</b> : null}
                    {reste}
                  </span>
                  {l.type === 'module' && (
                    <span className="dm-ligne__acc">
                      {e.badge > 0 && (
                        <span className="dm-badge" title={tm('ligne.badge', { n: e.badge })}>
                          {e.badge > 99 ? '99+' : e.badge}
                          <span className="sr-only"> {tm('ligne.badge', { n: e.badge })}</span>
                        </span>
                      )}
                      {e.personnes.length > 0 && (
                        <span className="dm-presents" title={tm('ligne.presents', { noms: e.personnes.join(', ') })}>
                          {e.personnes.slice(0, 2).map((n) => (
                            <Avatar key={n} nom={n} taille={18} />
                          ))}
                          <span className="sr-only">{tm('ligne.presents', { noms: e.personnes.join(', ') })}</span>
                        </span>
                      )}
                    </span>
                  )}
                  {choisie && <Raccourci>↵</Raccourci>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {(carte.reste > 0 || deplie) && !carte.videAuNiveau && (
        <button type="button" onClick={onBasculer} aria-expanded={deplie} className="dm-pied dm-focus">
          {deplie ? tm('reduire') : tm('autres', { n: carte.reste })}
        </button>
      )}
    </section>
  );
}

export default PanneauTousLesModules;
