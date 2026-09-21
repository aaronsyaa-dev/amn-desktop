import React, { useEffect, useMemo, useState } from 'react';
import { allegementsPourPrereglage } from '../data/prereglagesBarre';
import { PROFILS_INTERNES_ORDRE, allegementsPourProfil } from '../data/profilsInternes';
import { garde as gardeClient } from '../lib/garde';
import { prisesParModule } from '../data/prisesGarde';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { ModuleGrid, type EtatModule } from '../components/ModuleGrid';
import { NAV_SECTIONS } from '../data/navigation';
import { ALWAYS_ON_MODULES, isModuleEnabled } from '../data/spaces';
import { useNavAlleges } from '../state/useNavAlleges';
import { useNavFavorites } from '../state/useNavFavorites';
import { useModulesOuverts } from '../state/useModulesOuverts';
import { useHaloSignal } from '../components/EtatEcran';
import { Link } from 'react-router-dom';
import { bridge } from '../lib/bridge';
import { useLangue, libelleSection } from '../i18n';
import { IS_BUSINESS } from '../edition/edition';
import { staggerContainer, staggerItem } from '../lib/transitions';
import type { ModuleOffer } from '../shared/api';

/**
 * LA BIBLIOTHÈQUE — le rangement de référence.
 *
 * Édition interne : « Bibliothèque ». Tous les modules du produit, les deux
 * espaces, rangés par sections, avec une recherche. Chez AMN DevSec tout est
 * ouvert : c'est l'endroit où l'on retrouve un écran en deux secondes.
 *
 * Édition cliente : « Découvrir ». La même grille, mais lue depuis chez elle :
 * ses modules ouverts (on y va), ce qui est inclus quoi qu'il arrive, et ce
 * qui existe par ailleurs — avec le geste pour le demander, qui écrit un
 * message à son prestataire et rien d'autre (voir routes/modules.js). Jamais
 * un desktop qui a l'air vide : la Bibliothèque est là même quand la barre
 * est courte. Jamais un catalogue qui a l'air d'un mur : rangé, cherchable,
 * un mot d'état par tuile.
 *
 * Épingler et la Trousse restent le raccourci rapide ; ceci est le rangement.
 */
/*
  ══════════════════════════════════════════════════════════════════════
  LA CARTE DU PRODUIT — et pourquoi ce n'est pas un catalogue
  ══════════════════════════════════════════════════════════════════════

  Un catalogue se parcourt : il présente ce qui existe, tuile après tuile, et
  celui qui le lit repart avec l'impression d'avoir tout vu. Une CARTE dit
  autre chose — ce qui reste inexploré. Huit cartes de famille, une case par
  module, pleine si le module a déjà été ouvert : la famille la plus vide se
  voit sans compter, et c'est la seule information que cet écran doit donner
  avant toute autre.

  LES COMPTEURS VIENNENT DE `NAV_SECTIONS`, comme la barre latérale. Jamais
  d'un littéral écrit ici : c'est l'écran qui affiche l'inventaire du produit,
  et si ses chiffres contredisaient la barre à 240 px de là, il se
  contredirait lui-même.

  UNE SEULE RECOMMANDATION, JAMAIS TROIS, et elle est DÉDUITE d'un manque
  réel — la famille la moins explorée, et dans cette famille un module ouvert
  mais jamais visité. Pas un cycle de mise en avant, pas une nouveauté à
  pousser : si tout a été ouvert, il n'y a pas de recommandation, et pas
  d'ambre.
*/
const CASE = 11;
const CASE_ECART = 3;

const BOUTON_ALLEGER = 'min-h-9 border border-border bg-bg px-2.5 py-1 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:min-h-0';

export function LibraryScreen() {
  const { t } = useLangue();
  const [recherche, setRecherche] = useState('');
  const [offres, setOffres] = useState<ModuleOffer[] | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Côté cliente, le serveur sait ce qui est demandé : on le lit une fois.
  useEffect(() => {
    if (!IS_BUSINESS) return;
    let vivant = true;
    bridge()
      .remote.modules.catalogue()
      .then((liste) => vivant && setOffres(liste))
      .catch(() => vivant && setOffres([]));
    return () => {
      vivant = false;
    };
  }, []);

  // Les prises de la Garde (Bloc 10) : ce que chaque équipe lit ou modifie, module par module — interne seulement.
  const [prises, setPrises] = useState<Record<string, { lit: string[]; modifie: string[] }> | undefined>(undefined);
  useEffect(() => {
    if (IS_BUSINESS) return;
    let vivant = true;
    gardeClient.salle().then((salle) => { if (vivant) setPrises(prisesParModule(salle)); }).catch(() => undefined);
    return () => { vivant = false; };
  }, []);

  const sections = useMemo(
    () => NAV_SECTIONS.map((s) => ({ key: s.key, label: s.label, items: s.items })),
    [],
  );

  const demandes = useMemo(() => new Set((offres ?? []).filter((o) => o.requested).map((o) => o.key)), [offres]);
  const ouvertures = useModulesOuverts();
  const { favorites } = useNavFavorites();
  /*
    ALLÉGER MA BARRE (Bloc 3). Un mode de la Bibliothèque, pas un écran de
    plus : on l'entre, on clique les modules qu'on n'ouvre jamais (ils
    s'estompent), on en sort. Le même mode sert à les rajouter. Par personne,
    mémorisé sur le serveur : le téléphone suit.
  */
  const [allegement, setAllegement] = useState(false);
  const { alleges, estAllege, basculer, remplacer } = useNavAlleges();
  // Tout ce qui peut s'alléger dans cette édition — les préréglages disent ce qu'ils gardent, le reste s'allège.
  const catalogue = useMemo(() => sections.flatMap((sec) => sec.items.map((i) => i.key)), [sections]);
  const cataloguePrereglable = useMemo(() => catalogue.filter((k) => !ALWAYS_ON_MODULES.includes(k)), [catalogue]);
  const etat = (key: string): EtatModule => {
    if (ALWAYS_ON_MODULES.includes(key)) return 'inclus';
    if (isModuleEnabled(key)) return 'ouvert';
    return demandes.has(key) ? 'demande' : 'disponible';
  };

  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const comptes = sections
    .flatMap((s) => s.items)
    .reduce(
      (acc, item) => {
        acc[etat(item.key)] += 1;
        return acc;
      },
      { ouvert: 0, inclus: 0, disponible: 0, demande: 0 } as Record<EtatModule, number>,
    );


  /*
    LA CARTE. Une famille = ses modules RÉELLEMENT OUVERTS à cette
    organisation (jamais le catalogue entier : une case pour un module fermé
    ferait une carte de ce qu'on n'a pas). « Explorée » veut dire visitée au
    moins une fois depuis ce poste.
  */
  const carte = useMemo(
    () =>
      sections.map((sec) => {
        const ouvertsIci = sec.items.filter((i) => etat(i.key) === 'ouvert' || etat(i.key) === 'inclus');
        const explores = ouvertsIci.filter((i) => Boolean(ouvertures[i.key]));
        return {
          key: sec.key,
          label: sec.label,
          modules: ouvertsIci,
          jamais: ouvertsIci.filter((i) => !ouvertures[i.key]),
          explores: explores.length,
          total: ouvertsIci.length,
        };
      }),
    // `etat` et `ouvertures` changent avec les offres et le journal ; les
    // sections sont figées.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sections, ouvertures, offres],
  );

  /* LA FAMILLE LA MOINS EXPLORÉE — en part, pas en nombre : une famille de
     quatorze modules dont deux sont vus n'est pas mieux lotie qu'une famille
     de quatre dont un l'est. */
  const moinsExplorees = useMemo(
    () => carte.filter((f) => f.total > 0 && f.jamais.length > 0).sort((a, b) => a.explores / a.total - b.explores / b.total),
    [carte],
  );
  /* LA RECOMMANDATION UNIQUE, déduite : dans la famille la moins explorée,
     le premier module ouvert et jamais visité. Rien à recommander quand tout
     a été vu — et l'écran n'a alors aucun ambre. */
  const recommandation = useMemo(() => {
    const famille = moinsExplorees[0];
    const module = famille?.jamais[0];
    return famille && module ? { famille, module } : null;
  }, [moinsExplorees]);
  const haloCarte = useHaloSignal(Boolean(recommandation));

  const ouvertsEnTout = carte.reduce((n, f) => n + f.explores, 0);
  const CETTE_SEMAINE = 7 * 86_400_000;
  const cetteSemaine = Object.values(ouvertures).filter((d) => Date.now() - Date.parse(d) < CETTE_SEMAINE).length;

  // Un jeton de paiement, émis par le site : collé ici, vérifié sur-le-champ par la Garde des Comptes.
  const [jeton, setJeton] = useState('');
  const [jetonDit, setJetonDit] = useState<string | null>(null);
  const [jetonEnCours, setJetonEnCours] = useState(false);
  const deposerJeton = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jeton.trim() || jetonEnCours) return;
    setJetonEnCours(true);
    setJetonDit(null);
    try {
      const r = await bridge().remote.modules.jeton({ jeton: jeton.trim() });
      setJetonDit(r.texte);
      if (r.recevable) {
        setJeton('');
        setOffres(await bridge().remote.modules.catalogue());
      }
    } catch {
      setJetonDit(t('biblio.jeton.echec'));
    } finally {
      setJetonEnCours(false);
    }
  };

  const demander = async (cle: string) => {
    setEnCours(cle);
    setErreur(null);
    try {
      await bridge().remote.modules.request({ module: cle });
      setOffres((prev) => (prev ?? []).some((o) => o.key === cle)
        ? (prev ?? []).map((o) => (o.key === cle ? { ...o, requested: true } : o))
        : [...(prev ?? []), { key: cle, label: cle, summary: '', enabled: false, requested: true }]);
    } catch {
      setErreur(t('biblio.demande.echec'));
    } finally {
      setEnCours(null);
    }
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={IS_BUSINESS ? t('biblio.surtitreCliente') : t('biblio.surtitreInterne')}
          title={IS_BUSINESS ? t('biblio.titreCliente') : t('biblio.titreInterne')}
          description={IS_BUSINESS ? t('biblio.descriptionCliente') : t('biblio.descriptionInterne')}
          stats={[
            { label: t('biblio.stat.modules'), value: total },
            { label: t('biblio.stat.ouverts'), value: comptes.ouvert + comptes.inclus },
            /* Un relevé à zéro ne dit rien : quand tout est ouvert, il n'y a
               rien « de disponible », et la ligne disparaît au lieu d'afficher
               un 0 — même règle que partout ailleurs. */
            ...(IS_BUSINESS && comptes.disponible + comptes.demande > 0
              ? [{ label: t('biblio.stat.disponibles'), value: comptes.disponible + comptes.demande }]
              : []),
          ]}
        />
      </motion.div>

      {/* ═══ L'OBJET DOMINANT : la carte du produit entier ═══ */}
      <motion.section variants={staggerItem} className={`panel-raised p-5 sm:p-6 ${haloCarte}`}>
        <p className="eyebrow mb-4">{t('biblio.carte.titre')}</p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {carte.map((f) => (
            <li key={f.key} className="panel p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold text-text-primary">{libelleSection(f.label)}</p>
                <span className="flex-shrink-0 font-mono text-[10px] tabular-nums tracking-wider text-text-muted">
                  {f.explores} / {f.total}
                </span>
              </div>
              {/* UNE CASE PAR MODULE — pleine si le module a déjà été ouvert. */}
              <div className="mt-2.5 flex flex-wrap" style={{ gap: CASE_ECART }} aria-hidden>
                {f.modules.map((m) => (
                  <span
                    key={m.key}
                    title={m.label}
                    style={{
                      width: CASE,
                      height: CASE,
                      backgroundColor: ouvertures[m.key] ? 'var(--color-text-body)' : 'transparent',
                      border: ouvertures[m.key] ? 'none' : '1px solid var(--color-border-strong)',
                    }}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>

        {/* LA RECOMMANDATION — une seule, en bande ambre, jamais trois. */}
        {recommandation && (
          <div data-signal-groupe="recommandation" className="signal-plate mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
            <div className="min-w-0 flex-1">
              <p data-signal-groupe="recommandation" className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">
                {t('biblio.carte.recommandationSurtitre')}
              </p>
              <p data-signal-groupe="recommandation" className="mt-1.5 text-[19px] font-semibold leading-tight">
                {recommandation.module.label}
              </p>
              <p data-signal-groupe="recommandation" className="mt-1 max-w-prose text-[13px] leading-relaxed">
                {t('biblio.carte.recommandationPhrase', {
                  famille: libelleSection(recommandation.famille.label),
                  jamais: recommandation.famille.jamais.length,
                })}
              </p>
            </div>
            <Link
              to={recommandation.module.to}
              data-signal-groupe="recommandation"
              className="flex min-h-11 flex-shrink-0 items-center bg-signal-ink px-4 text-sm font-semibold text-signal md:min-h-0 md:py-2.5"
            >
              {t('biblio.carte.recommandationBouton')}
            </Link>
          </div>
        )}
      </motion.section>

      <motion.div variants={staggerItem} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* À GAUCHE — les familles les moins explorées, en barres. */}
        <section className="panel p-4">
          <p className="eyebrow mb-3">{t('biblio.carte.moinsExplorees')}</p>
          {moinsExplorees.length === 0 ? (
            <p className="text-sm leading-relaxed text-text-secondary">{t('biblio.carte.toutVu')}</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {moinsExplorees.slice(0, 4).map((f) => (
                <li key={f.key} className="flex items-center gap-3">
                  <span className="w-40 flex-shrink-0 truncate text-sm text-text-primary">{libelleSection(f.label)}</span>
                  <span className="flex min-w-0 flex-1 gap-1" aria-hidden>
                    {f.modules.map((m) => (
                      <span
                        key={m.key}
                        className="h-1.5 min-w-0 flex-1"
                        style={{ backgroundColor: ouvertures[m.key] ? 'var(--color-border)' : 'var(--color-text-body)' }}
                      />
                    ))}
                  </span>
                  <span className="flex-shrink-0 font-mono text-[10px] tabular-nums uppercase tracking-wider text-text-muted">
                    {t('biblio.carte.jamaisOuverts', { n: f.jamais.length })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* À DROITE — ouverts, ouverts cette semaine, épinglés. */}
        <aside className="panel p-4">
          <p className="eyebrow mb-3">{t('biblio.carte.depuisCePoste')}</p>
          <dl className="flex flex-col gap-2.5">
            {[
              { l: t('biblio.carte.ouverts'), v: ouvertsEnTout },
              { l: t('biblio.carte.cetteSemaine'), v: cetteSemaine },
              { l: t('biblio.carte.epingles'), v: favorites.length },
            ].map((r) => (
              <div key={r.l}>
                <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{r.l}</dt>
                <dd className="text-[19px] font-semibold tabular-nums leading-tight text-text-primary">{r.v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-text-muted">
            {t('biblio.carte.localAide')}
          </p>
        </aside>
      </motion.div>

      {IS_BUSINESS && (
        <motion.form variants={staggerItem} onSubmit={(e) => void deposerJeton(e)} aria-label={t('biblio.jeton.titre')} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">{t('biblio.jeton.titre')}</span>
              <input value={jeton} onChange={(e) => setJeton(e.target.value)} placeholder="jeton:…" aria-label={t('biblio.jeton.titre')} className="input-focus min-w-0 border border-border bg-bg px-2 py-1.5 font-mono text-[13px] text-text-primary outline-none" />
            </label>
            <button type="submit" disabled={jetonEnCours || !jeton.trim()} className="min-h-11 border border-border-strong bg-surface px-3 text-sm font-medium text-text-primary hover:bg-surface-hover disabled:opacity-50 md:min-h-0 md:py-1.5">{t('biblio.jeton.envoyer')}</button>
          </div>
          <p className="text-[11px] text-text-muted">{t('biblio.jeton.aide')}</p>
          {jetonDit && <p className="text-[13px] text-text-primary" aria-live="polite" data-jeton-reponse>{jetonDit}</p>}
        </motion.form>
      )}

      <motion.div variants={staggerItem} className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setAllegement((v) => !v)}
          aria-pressed={allegement}
          className={`flex min-h-11 items-center gap-2 border px-3 text-sm font-medium transition-colors md:min-h-0 md:py-1.5 ${
            allegement ? 'border-accent bg-accent text-bg' : 'border-border-strong bg-surface text-text-primary hover:bg-surface-hover'
          }`}
        >
          <SlidersHorizontal size={14} />
          {allegement ? t('biblio.alleger.terminer') : t('biblio.alleger.entrer')}
        </button>
        <p className="text-xs text-text-secondary">
          {allegement
            ? t('biblio.alleger.aide')
            : alleges.length > 0
              ? t('biblio.alleger.compte', { n: alleges.length })
              : t('biblio.alleger.aucun')}
        </p>
      </motion.div>

      {allegement && (
        /*
          TOUT, RIEN, PAR SECTION, PRÉRÉGLAGES — parce que soixante tuiles une
          à une, c'est long (Bloc 1 de la Garde). Chaque bouton pose la liste
          entière ; les tuiles en dessous suivent, et un second geste défait.
        */
        <motion.div variants={staggerItem} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3" aria-label={t('biblio.alleger.outils')}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('biblio.alleger.dUnGeste')}</span>
            <button type="button" onClick={() => remplacer([])} className={BOUTON_ALLEGER}>{t('biblio.alleger.toutGarder')}</button>
            <button type="button" onClick={() => remplacer(cataloguePrereglable)} className={BOUTON_ALLEGER}>{t('biblio.alleger.toutAlleger')}</button>
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('biblio.alleger.prereglages')}</span>
            {IS_BUSINESS
              ? (['leger', 'commerce', 'service'] as const).map((pre) => (
                <button key={pre} type="button" onClick={() => remplacer(allegementsPourPrereglage(pre, catalogue, ALWAYS_ON_MODULES))} className={BOUTON_ALLEGER}>
                  {t(`biblio.alleger.pre.${pre}`)}
                </button>
              ))
              : PROFILS_INTERNES_ORDRE.map((profil) => (
                <button key={profil} type="button" onClick={() => remplacer(allegementsPourProfil(profil, catalogue, ALWAYS_ON_MODULES))} className={BOUTON_ALLEGER}>
                  {t(`profil.${profil}`)}
                </button>
              ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('biblio.alleger.parSection')}</span>
            {sections.map((section) => {
              const cles = section.items.map((i) => i.key).filter((k) => !ALWAYS_ON_MODULES.includes(k));
              if (cles.length === 0) return null;
              const touteAllegee = cles.every((k) => alleges.includes(k));
              return (
                <button
                  key={section.key}
                  type="button"
                  aria-pressed={touteAllegee}
                  onClick={() => remplacer(touteAllegee ? alleges.filter((k) => !cles.includes(k)) : [...alleges, ...cles])}
                  className={`${BOUTON_ALLEGER} ${touteAllegee ? 'opacity-60' : ''}`}
                >
                  {touteAllegee ? t('biblio.alleger.garderSection', { section: libelleSection(section.label) }) : t('biblio.alleger.allegerSection', { section: libelleSection(section.label) })}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      <motion.div variants={staggerItem}>
        <label className="input-focus flex min-h-11 max-w-xl items-center gap-2 rounded-lg border border-border bg-surface px-3">
          <Search size={15} className="flex-shrink-0 text-text-muted" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t('biblio.rechercher')}
            aria-label={t('biblio.rechercher')}
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
        </label>
      </motion.div>

      {erreur && (
        <motion.p variants={staggerItem} role="alert" className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-text-primary">
          {erreur}
        </motion.p>
      )}

      <motion.div variants={staggerItem}>
        <ModuleGrid
          sections={sections}
          etat={etat}
          mode={allegement ? 'alleger' : IS_BUSINESS ? 'demander' : 'lire'}
          estAllege={estAllege}
          onBasculer={basculer}
          surface={IS_BUSINESS ? 'business' : 'interne'}
          prises={prises}
          recherche={recherche}
          enCours={enCours}
          onDemander={(cle) => void demander(cle)}
        />
      </motion.div>
    </motion.section>
  );
}
