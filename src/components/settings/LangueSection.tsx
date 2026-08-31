import React from 'react';
import { Check } from 'lucide-react';
import {
  changerLangue,
  choixDeLUtilisateur,
  langueDeLOrganisation,
  useLangue,
  type Langue,
} from '../../i18n';

/**
 * LA LANGUE DU POSTE — un choix de personne, pas d'organisation.
 *
 * L'organisation a sa langue (choisie à l'atelier, portée par l'identité de
 * session) ; chacun peut la suivre ou la remplacer SUR CE POSTE. Le choix vit
 * en localStorage : il ne part pas en synchronisation, ne change rien pour
 * personne d'autre, et survit aux redémarrages de ce navigateur-là.
 *
 * Trois options, pas deux : « suivre l'organisation » est un état à part
 * entière — c'est lui qui permet à l'atelier de changer la langue d'une
 * organisation entière sans repasser poste par poste.
 */
export function LangueSection() {
  const { t } = useLangue();
  const choix = choixDeLUtilisateur();
  const orgLangue = langueDeLOrganisation();

  const options: Array<{ valeur: Langue | null; libelle: string }> = [
    {
      valeur: null,
      libelle: t('reglages.langue.suitOrganisation', {
        langue: (orgLangue ?? 'fr') === 'en' ? t('reglages.langue.anglais') : t('reglages.langue.francais'),
      }),
    },
    { valeur: 'fr', libelle: t('reglages.langue.francais') },
    { valeur: 'en', libelle: t('reglages.langue.anglais') },
  ];

  return (
    <section className="panel p-4">
      <p className="eyebrow mb-2">{t('reglages.langue.titre')}</p>
      <p className="mb-4 max-w-lg text-[12px] leading-relaxed text-text-secondary">
        {t('reglages.langue.description')}
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('reglages.langue.titre')}>
        {options.map((o) => {
          const actif = choix === o.valeur;
          return (
            <button
              key={String(o.valeur)}
              type="button"
              onClick={() => changerLangue(o.valeur)}
              aria-pressed={actif}
              className={`flex min-h-11 items-center gap-2 border px-3 text-sm transition-colors md:min-h-9 ${
                actif
                  ? 'border-border-strong bg-accent-muted text-text-primary'
                  : 'border-border text-text-secondary hover:border-border-strong hover:text-text-primary'
              }`}
            >
              {actif && <Check size={14} strokeWidth={2} />}
              {o.libelle}
            </button>
          );
        })}
      </div>
    </section>
  );
}
