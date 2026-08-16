import React from 'react';

/**
 * L'en-tête d'écran — la même voix sur les trente-deux écrans (REFONTE).
 *
 * Chaque écran écrivait son titre à sa façon : `text-2xl` ici, `text-xl`
 * là, un sous-titre parfois, une rangée de boutons tantôt collée au titre,
 * tantôt reléguée sous une carte. Rien n'était faux isolément ; ensemble, ça
 * donnait trente-deux applications qui se ressemblent vaguement. C'est ce que
 * « rien n'a changé » veut dire quand on ouvre l'application : il n'y a pas
 * d'objet commun à reconnaître.
 *
 * La structure est fixe, et c'est tout l'intérêt :
 *
 *   ESPACE · SECTION        ← l'étiquette technique, où je suis
 *   Titre de l'écran        ← ce que je regarde
 *   trois relevés chiffrés  ← ce que ça vaut MAINTENANT
 *   ──────────────────────  ← le filet qui referme l'en-tête
 *
 * LES RELEVÉS NE SONT PAS UNE DÉCORATION. Ils sont la raison d'être de ce
 * composant : chaque écran doit annoncer son état réel avant qu'on ait lu une
 * seule ligne de sa liste. Un relevé se calcule sur les données affichées, à
 * chaque rendu — jamais une valeur figée, jamais un chiffre d'exemple. Un
 * en-tête sans relevé est permis (certains écrans n'ont rien à compter) ; un
 * en-tête avec un relevé faux ne l'est pas.
 */

export interface ScreenStat {
  /** Ce que le chiffre mesure. Court : deux mots au plus. */
  label: string;
  /** Le chiffre lui-même, déjà formaté. */
  value: React.ReactNode;
  /**
   * Attire l'œil sur ce relevé. Réservé à ce qui APPELLE une action — des
   * impayés, une alerte ouverte, une commande non traitée. Mis partout, il
   * n'attirerait plus l'œil nulle part.
   */
  emphasis?: boolean;
  /** Une phrase au survol, quand le libellé seul serait ambigu. */
  title?: string;
}

export function ScreenHeader({
  eyebrow,
  title,
  description,
  stats,
  actions,
  children,
}: {
  /** L'étiquette technique : espace, section, ou les deux séparés par « · ». */
  eyebrow?: string;
  title: string;
  /** Une ligne, quand le titre seul ne dit pas à quoi sert l'écran. */
  description?: string;
  stats?: ScreenStat[];
  /** Les gestes de l'écran — bouton principal en dernier, à droite. */
  actions?: React.ReactNode;
  /** Filtres, onglets : ce qui appartient à l'en-tête sans être un relevé. */
  children?: React.ReactNode;
}) {
  const shown = (stats ?? []).filter((s) => s.value !== null && s.value !== undefined);

  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h1 className="truncate text-[22px] font-semibold leading-tight tracking-[-0.015em] text-text-primary sm:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-text-secondary">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {shown.length > 0 && (
        /*
          Les relevés en ligne, séparés par des filets verticaux plutôt que
          posés dans des cartes. Trois cartes pour trois nombres prendraient la
          moitié de l'écran et repousseraient la liste sous la ligne de
          flottaison — or c'est la liste qu'on vient lire.
        */
        <div className="mt-4 flex flex-wrap items-stretch gap-x-6 gap-y-3">
          {shown.map((stat, index) => (
            <div
              key={stat.label}
              title={stat.title}
              className={`flex flex-col justify-center ${
                index > 0 ? 'border-l border-border pl-6' : ''
              }`}
            >
              <span className="eyebrow mb-1.5">{stat.label}</span>
              <span
                className={`tnum text-[19px] font-medium leading-none ${
                  stat.emphasis ? 'text-text-primary' : 'text-text-secondary'
                }`}
              >
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {children && <div className="mt-4">{children}</div>}

      <div className="rule-fade mt-5" />
    </header>
  );
}
