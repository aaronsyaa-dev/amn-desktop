import React, { useEffect, useMemo, useState } from 'react';
import { allegementsPourPrereglage } from '../data/prereglagesBarre';
import { PROFILS_INTERNES_ORDRE, allegementsPourProfil } from '../data/profilsInternes';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { ModuleGrid, type EtatModule } from '../components/ModuleGrid';
import { NAV_SECTIONS } from '../data/navigation';
import { ALWAYS_ON_MODULES, isModuleEnabled } from '../data/spaces';
import { useNavAlleges } from '../state/useNavAlleges';
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

  const sections = useMemo(
    () => NAV_SECTIONS.map((s) => ({ key: s.key, label: s.label, items: s.items })),
    [],
  );

  const demandes = useMemo(() => new Set((offres ?? []).filter((o) => o.requested).map((o) => o.key)), [offres]);
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
            ...(IS_BUSINESS ? [{ label: t('biblio.stat.disponibles'), value: comptes.disponible + comptes.demande }] : []),
          ]}
        />
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
          recherche={recherche}
          enCours={enCours}
          onDemander={(cle) => void demander(cle)}
        />
      </motion.div>
    </motion.section>
  );
}
