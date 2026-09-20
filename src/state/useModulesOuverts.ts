import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { NAV_ITEMS } from '../data/navigation';

/**
 * CE QUI A DÉJÀ ÉTÉ OUVERT — la mémoire dont Découvrir a besoin (`26b`)
 * ════════════════════════════════════════════════════════════════════
 *
 * Découvrir doit montrer « la carte de ce qui reste inexploré » : une case par
 * module, PLEINE si le module a déjà été ouvert. Le produit n'en gardait
 * aucune trace — ni le serveur, ni le poste. La carte aurait donc été un
 * dessin sans donnée, et c'est exactement ce que ce chantier s'interdit.
 *
 * CE QUE CE JOURNAL EST, ET CE QU'IL N'EST PAS. Il note une CLÉ DE MODULE et
 * une DATE quand une route de la barre latérale s'ouvre. Rien d'autre : pas
 * de durée, pas de compte de visites, pas de contenu. Ce n'est pas une mesure
 * d'usage, et il ne sert à rien d'autre qu'à distinguer « déjà vu » de
 * « jamais ouvert ».
 *
 * IL EST LOCAL AU POSTE, PAR COMPTE, ET L'ÉCRAN LE DIT. Le mettre sur le
 * serveur en ferait une donnée d'organisation — donc lisible par les autres
 * membres, qui n'ont pas à savoir quels écrans quelqu'un ouvre. Une carte
 * d'exploration personnelle qu'un collègue peut lire n'est plus personnelle.
 */
const PREFIXE = 'amn.modules.ouverts';

export type JournalOuvertures = Record<string, string>;

function cleDe(email: string | undefined): string {
  return `${PREFIXE}.${email ?? 'anonyme'}`;
}

function lire(cle: string): JournalOuvertures {
  try {
    const brut = window.localStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as JournalOuvertures) : {};
  } catch {
    return {};
  }
}

/** Le journal, en lecture. Les écrans ne l'écrivent jamais eux-mêmes. */
export function useModulesOuverts(): JournalOuvertures {
  const { user } = useAuth();
  const cle = cleDe(user?.email);
  const [journal, setJournal] = useState<JournalOuvertures>(() => lire(cle));
  useEffect(() => setJournal(lire(cle)), [cle]);
  return journal;
}

/**
 * Le mouchard de route, monté une seule fois dans la coque.
 *
 * Il n'écrit QUE pour une route qui est celle d'un module de la barre : une
 * vue de détail (`/clients/42`) note son module parent, et une route qui
 * n'appartient à aucun module n'écrit rien du tout.
 */
export function useNoterLOuverture(): void {
  const { user } = useAuth();
  const location = useLocation();
  const cle = cleDe(user?.email);

  const noter = useCallback(
    (chemin: string) => {
      /* Le module le PLUS SPÉCIFIQUE dont la route préfixe le chemin : sans
         ce tri, « / » gagnerait contre « /clients » et tout compterait pour
         l'accueil. */
      const trouve = NAV_ITEMS.filter((i) => chemin === i.to || chemin.startsWith(`${i.to}/`)).sort(
        (a, b) => b.to.length - a.to.length,
      )[0];
      if (!trouve) return;
      try {
        const journal = lire(cle);
        journal[trouve.key] = new Date().toISOString();
        window.localStorage.setItem(cle, JSON.stringify(journal));
      } catch {
        /* Stockage refusé : la carte de Découvrir restera vide, et elle le dit. */
      }
    },
    [cle],
  );

  useEffect(() => {
    noter(location.pathname);
  }, [location.pathname, noter]);
}

/** Le mouchard sous forme de composant, à poser à côté des autres. */
export function ModulesOuvertsTracker(): null {
  useNoterLOuverture();
  return null;
}
