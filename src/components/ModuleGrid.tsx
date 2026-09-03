import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2, Lock, Send } from 'lucide-react';
import type { NavItem } from '../data/navigation';
import { useLangue, libelleNav, libelleSection, indiceNav, carteModule, type SurfaceNav } from '../i18n';

/**
 * LA GRILLE DES MODULES — un seul rangement, trois lectures.
 *
 * Le produit a maintenant assez de modules pour que « où est quoi » soit une
 * question. Cette grille est la réponse, et elle est la MÊME partout :
 *
 *   · `lire`      — la Bibliothèque : chaque module, son état, et on y va ;
 *   · `composer`  — le dossier d'une organisation : Aaron coche ce que la
 *                   cliente reçoit, section par section ;
 *   · `demander`  — Découvrir, chez la cliente : ce qui existe par ailleurs,
 *                   et le geste pour le demander à son prestataire.
 *
 * Rangée par sections, jamais à plat : c'est la règle que `check:modules`
 * tient pour les barres, et une grille de cinquante tuiles sans intitulés
 * serait exactement le mur qu'on veut éviter.
 *
 * Quatre états, un mot chacun : ouvert (là, on y va), inclus (là quoi qu'il
 * arrive — accueil, paramètres, membres, assistance, personnel), disponible
 * (existe, pas chez vous), demandé (vous l'avez demandé, quelqu'un répond).
 */
export type EtatModule = 'ouvert' | 'inclus' | 'disponible' | 'demande';

export interface SectionGrille {
  key: string;
  label: string;
  items: NavItem[];
}

export function ModuleGrid({
  sections,
  etat,
  mode,
  surface = 'interne',
  recherche = '',
  enCours = null,
  onToggle,
  onDemander,
  annotation,
  estAllege,
  onBasculer,
}: {
  sections: SectionGrille[];
  etat: (key: string) => EtatModule;
  mode: 'lire' | 'composer' | 'demander' | 'alleger';
  surface?: SurfaceNav;
  /** Filtre libre : intitulé ou phrase, sans accent ni casse. */
  recherche?: string;
  /** La clé en cours de changement — la tuile attend, les autres restent. */
  enCours?: string | null;
  onToggle?: (key: string) => void;
  onDemander?: (key: string) => void;
  /**
   * Mode composer : d'où vient l'état de la tuile — « inclus dans la
   * formule », « ajouté hors formule », « retiré de la formule ». Décrit, ne
   * verrouille pas : la tuile reste cliquable quoi qu'elle dise.
   */
  annotation?: (key: string) => string | null;
  /** Mode alléger : les modules retirés de MA barre, et le geste pour basculer. */
  estAllege?: (key: string) => boolean;
  onBasculer?: (key: string) => void;
}) {
  const { t } = useLangue();
  const normaliser = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const filtre = normaliser(recherche.trim());
  const visibles = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!filtre) return true;
        const carte = carteModule(item.key);
        return normaliser(`${libelleNav(item)} ${indiceNav(item, surface)} ${carte ? `${carte.quoi} ${carte.pourQui} ${carte.exemple}` : ''}`).includes(filtre);
      }),
    }))
    .filter((section) => section.items.length > 0);

  if (visibles.length === 0) {
    return <p className="py-6 text-sm text-text-secondary">{t('biblio.rienTrouve', { recherche: recherche.trim() })}</p>;
  }

  const ETAT_LIBELLE: Record<EtatModule, string> = {
    ouvert: t('biblio.etat.ouvert'),
    inclus: t('biblio.etat.inclus'),
    disponible: t('biblio.etat.disponible'),
    demande: t('biblio.etat.demande'),
  };

  return (
    <div className="flex flex-col gap-6">
      {visibles.map((section) => (
        <section key={section.key} aria-label={libelleSection(section.label)}>
          <p className="eyebrow mb-2.5">{libelleSection(section.label)}</p>
          <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(11.5rem,1fr))]">
            {section.items.map((item) => {
              const Icon = item.icon;
              const e = etat(item.key);
              const ouvert = e === 'ouvert' || e === 'inclus';
              const attente = enCours === item.key;
              /*
                LA CARTE (Bloc 3) : ce que ça fait, pour qui, un exemple —
                trois lignes qu'on lit en cinq secondes. La phrase d'aide de
                la navigation reste le repli d'un module sans carte.
              */
              const carte = carteModule(item.key);
              const corps = (
                <>
                  <span className="flex items-start justify-between gap-2">
                    <span className={`transition-transform duration-200 ${ouvert ? 'text-text-primary group-hover:-translate-y-0.5' : 'text-text-muted'}`}>
                      <Icon size={22} strokeWidth={1.5} />
                    </span>
                    <span
                      className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                        e === 'ouvert'
                          ? 'border-success/40 text-success'
                          : e === 'inclus'
                            ? 'border-border text-text-muted'
                            : e === 'demande'
                              ? 'border-warning/40 text-warning'
                              : 'border-border text-text-muted'
                      }`}
                    >
                      {ETAT_LIBELLE[e]}
                    </span>
                  </span>
                  <span className={`text-sm font-medium leading-tight ${ouvert ? 'text-text-primary' : 'text-text-secondary'}`}>
                    {libelleNav(item)}
                  </span>
                  <span className="text-[11px] leading-snug text-text-muted">{carte?.quoi ?? indiceNav(item, surface)}</span>
                  {carte && mode !== 'composer' && (
                    <>
                      <span className="text-[11px] leading-snug text-text-muted">
                        <span className="text-text-secondary">{t('carte.pourQui')} :</span> {carte.pourQui}
                      </span>
                      <span className="text-[11px] italic leading-snug text-text-secondary">{carte.exemple}</span>
                    </>
                  )}
                </>
              );
              const cadre = `group flex h-full flex-col gap-2 rounded-xl border p-3 text-left transition-colors duration-200 ${
                ouvert ? 'border-border bg-bg hover:border-border-strong hover:bg-surface-hover' : 'border-dashed border-border bg-transparent'
              }`;

              if (mode === 'composer') {
                const verrou = e === 'inclus';
                const origine = verrou ? null : annotation?.(item.key) ?? null;
                return (
                  <button
                    key={item.key}
                    type="button"
                    disabled={verrou || enCours !== null}
                    aria-pressed={ouvert}
                    onClick={() => onToggle?.(item.key)}
                    className={`${cadre} disabled:cursor-default ${enCours !== null && !verrou ? 'opacity-60' : ''}`}
                  >
                    {corps}
                    {origine && <span className="text-[10px] leading-snug text-text-secondary">{origine}</span>}
                    <span className="mt-auto flex items-center gap-1.5 pt-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {verrou ? (
                        <>
                          <Lock size={11} /> {t('biblio.composer.inclus')}
                        </>
                      ) : attente ? (
                        <>
                          <Loader2 size={11} className="animate-spin" /> …
                        </>
                      ) : ouvert ? (
                        <>
                          <Check size={11} strokeWidth={3} className="text-success" /> {t('biblio.composer.retirer')}
                        </>
                      ) : (
                        t('biblio.composer.ouvrir')
                      )}
                    </span>
                  </button>
                );
              }

              if (mode === 'alleger') {
                /*
                  ALLÉGER / RAJOUTER (Bloc 3). La tuile ne mène nulle part ici :
                  un clic la retire de ma barre (elle s'estompe) ou l'y remet.
                  Ce qui est ouvert quoi qu'il arrive ne s'allège pas. Rien
                  d'autre ne bouge : ni l'accès, ni les données.
                */
                const allege = estAllege?.(item.key) ?? false;
                const fixe = e === 'inclus' || !ouvert;
                return (
                  <button
                    key={item.key}
                    type="button"
                    disabled={fixe}
                    aria-pressed={!allege}
                    onClick={() => onBasculer?.(item.key)}
                    className={`${cadre} disabled:cursor-default ${allege ? 'opacity-40' : ''}`}
                  >
                    {corps}
                    <span className="mt-auto flex items-center gap-1.5 pt-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {fixe ? t('biblio.alleger.fixe') : allege ? t('biblio.alleger.rajouter') : t('biblio.alleger.retirer')}
                    </span>
                  </button>
                );
              }

              if (ouvert) {
                return (
                  <Link key={item.key} to={item.to} className={cadre}>
                    {corps}
                  </Link>
                );
              }

              return (
                <div key={item.key} className={cadre}>
                  {corps}
                  {mode === 'demander' && (
                    <span className="mt-auto pt-1">
                      {e === 'demande' ? (
                        <span className="flex items-center gap-1.5 text-xs text-text-muted">
                          <Check size={13} /> {t('biblio.demande.faite')}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onDemander?.(item.key)}
                          disabled={attente}
                          className="flex min-h-11 items-center gap-2 border border-border-strong bg-surface px-3 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-40 md:min-h-0 md:py-1.5"
                        >
                          {attente ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                          {t('biblio.demander')}
                        </button>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
