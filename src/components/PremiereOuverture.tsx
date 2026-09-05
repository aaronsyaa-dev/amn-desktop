import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { sectionsForSpace, spaceForPath } from '../data/spaces';
import { useLangue, libelleNav, carteModule } from '../i18n';
import { useAuth } from '../auth/AuthContext';

/**
 * LA PRÉSENTATION À LA PREMIÈRE OUVERTURE (Bloc 3).
 *
 * Aaron l'a dit sans détour : certains modules, même lui ne les a pas
 * compris. Un module qu'on ne comprend pas en cinq secondes est raté, quoi
 * qu'il sache faire. D'où ces trois lignes, EN PLACE, la première fois qu'une
 * personne ouvre un module : ce que ça fait, pour qui, un exemple — la carte
 * de la Bibliothèque, au-dessus de l'écran lui-même.
 *
 * Jamais bloquant : rien ne se met devant l'écran, on peut cliquer dessous
 * tout de suite. Fermable d'un geste, et mémorisé par personne sur ce poste
 * (`amn.presentation.vue.<email>`) : elle ne revient pas, sauf si on efface
 * le stockage — auquel cas la relire ne coûte qu'un clic.
 *
 * Un seul composant, monté dans la disposition commune plutôt que dans
 * chaque écran : quatre-vingt-six écrans à modifier, c'est quatre-vingt-six
 * façons d'en oublier un.
 */
const CLE = (email: string) => `amn.presentation.vue.${email || 'anonyme'}`;

function lireVues(email: string): string[] {
  try {
    const brut = window.localStorage.getItem(CLE(email));
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste.filter((k) => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

export function PremiereOuverture() {
  const { t } = useLangue();
  const { user } = useAuth();
  const location = useLocation();
  const email = user?.email ?? '';
  const [vues, setVues] = useState<string[]>(() => lireVues(email));
  /*
    LES TROIS GESTES PRINCIPAUX (Bloc 10) — lus sur l'écran, jamais inventés.
    Les boutons d'action de l'en-tête sont ce que l'écran sait faire ; on les
    relit après le rendu (et à chaque changement d'écran) plutôt que de tenir
    une liste à la main qui mentirait au premier bouton renommé.
  */
  const [gestes, setGestes] = useState<string[]>([]);
  useEffect(() => {
    let vivant = true;
    const lire = () => {
      if (!vivant) return;
      const boutons = [...document.querySelectorAll<HTMLElement>('main [data-screen-actions] button, main [data-screen-actions] a')];
      const textes = boutons.map((b) => (b.getAttribute('aria-label') || b.textContent || '').replace(/\s+/g, ' ').trim()).filter((x) => x.length > 1 && x.length < 40);
      setGestes([...new Set(textes)].slice(0, 3));
    };
    const t1 = window.setTimeout(lire, 250);
    const t2 = window.setTimeout(lire, 1500);
    return () => { vivant = false; window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [location.pathname]);

  // Le module courant : le chemin le plus long qui colle, dans l'espace courant.
  const items = sectionsForSpace(spaceForPath(location.pathname)).flatMap((s) => s.items);
  let item = null as (typeof items)[number] | null;
  for (const candidat of items) {
    if (candidat.to === '/') continue;
    const colle = location.pathname === candidat.to || location.pathname.startsWith(`${candidat.to}/`);
    if (colle && (!item || candidat.to.length > item.to.length)) item = candidat;
  }
  if (!item) return null;
  const carte = carteModule(item.key);
  if (!carte || vues.includes(item.key)) return null;

  const fermer = () => {
    const suivant = [...vues, item!.key];
    setVues(suivant);
    try {
      window.localStorage.setItem(CLE(email), JSON.stringify(suivant));
    } catch {
      /* mode privé : la présentation reviendra, ce n'est pas grave */
    }
  };

  return (
    <aside
      aria-label={t('presentation.surtitre')}
      className="mb-5 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent-muted px-4 py-3"
    >
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
          {t('presentation.surtitre')} · {libelleNav(item)}
        </p>
        <p className="mt-1 text-sm text-text-primary">{carte.quoi}</p>
        <p className="mt-0.5 text-xs text-text-secondary">
          <span className="text-text-muted">{t('carte.pourQui')} :</span> {carte.pourQui}
        </p>
        <p className="mt-0.5 text-xs italic text-text-secondary">{carte.exemple}</p>
        {gestes.length > 0 && (
          <p className="mt-1 text-xs text-text-secondary" data-gestes={gestes.length}>
            <span className="text-text-muted">{t('carte.gestes')} :</span> {gestes.join(' · ')}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={fermer}
        className="flex min-h-11 flex-shrink-0 items-center gap-1.5 border border-border-strong bg-surface px-3 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover md:min-h-0 md:py-1.5"
      >
        <X size={13} /> {t('presentation.commencer')}
      </button>
    </aside>
  );
}
