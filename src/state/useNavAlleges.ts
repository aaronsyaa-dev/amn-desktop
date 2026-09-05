import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { bridge } from '../lib/bridge';
import { useAuth } from '../auth/AuthContext';
import { ALWAYS_ON_MODULES, setAllegedModules } from '../data/spaces';

/**
 * LES MODULES ALLÉGÉS DE LA PERSONNE (Bloc 3) — « alléger » et « rajouter ».
 *
 * Même dessin que les épingles (useNavFavorites) : un magasin de module, des
 * abonnés, une liste. Deux différences, voulues :
 *
 *   · PAR PERSONNE, pas par machine : la clé locale porte l'adresse du
 *     compte, et la liste est aussi posée sur le serveur (préférence
 *     `nav-alleges`), donc elle suit la personne sur son téléphone. Le local
 *     sert de cache et de repli hors ligne ; le serveur fait foi au chargement.
 *   · JAMAIS un accès : la liste retire des lignes de la barre, du lanceur et
 *     de la barre du pouce. Le module reste ouvert par son adresse et depuis
 *     la Bibliothèque. Aucune donnée, aucun droit ne bouge.
 */
const PREF = 'nav-alleges';
const cleLocale = (email: string) => `amn.nav.alleges.${email || 'anonyme'}`;

let courant: string[] = [];
let chargePour: string | null = null;
const abonnes = new Set<() => void>();

function emettre(suivant: string[]) {
  courant = suivant.filter((k) => !ALWAYS_ON_MODULES.includes(k));
  setAllegedModules(courant);
  for (const a of abonnes) a();
}
function lireLocal(email: string): string[] {
  try {
    const brut = window.localStorage.getItem(cleLocale(email));
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste.filter((k) => typeof k === 'string') : [];
  } catch {
    return [];
  }
}
function ecrireLocal(email: string, liste: string[]) {
  try {
    window.localStorage.setItem(cleLocale(email), JSON.stringify(liste));
  } catch {
    /* mode privé : le serveur garde la liste */
  }
}
function abonner(fn: () => void) {
  abonnes.add(fn);
  return () => {
    abonnes.delete(fn);
  };
}

export function useNavAlleges() {
  const { user } = useAuth();
  const email = user?.email ?? '';
  const alleges = useSyncExternalStore(abonner, () => courant, () => courant);

  // Au changement de personne : le cache local tout de suite, le serveur ensuite.
  useEffect(() => {
    if (chargePour === email) return;
    chargePour = email;
    emettre(lireLocal(email));
    if (!email) return;
    let vivant = true;
    void bridge()
      .remote.prefs.get()
      .then((prefs) => {
        if (!vivant || chargePour !== email) return;
        const liste = prefs[PREF];
        if (Array.isArray(liste)) {
          const propre = liste.filter((k): k is string => typeof k === 'string');
          ecrireLocal(email, propre);
          emettre(propre);
        }
      })
      .catch(() => {
        /* hors ligne ou ancienne API : le cache local suffit */
      });
    return () => {
      vivant = false;
    };
  }, [email]);

  const basculer = useCallback(
    (key: string) => {
      if (ALWAYS_ON_MODULES.includes(key)) return;
      const suivant = courant.includes(key) ? courant.filter((k) => k !== key) : [...courant, key];
      ecrireLocal(email, suivant);
      emettre(suivant);
      void bridge()
        .remote.prefs.set(PREF, suivant)
        .catch(() => {
          /* le local a déjà la liste ; le serveur la recevra au prochain geste */
        });
    },
    [email],
  );

  /** Poser la liste entière d'un coup — tout, rien, une section, un préréglage (Bloc 1 de la Garde). */
  const remplacer = useCallback(
    (liste: string[]) => {
      const suivant = [...new Set(liste)].filter((k) => !ALWAYS_ON_MODULES.includes(k));
      ecrireLocal(email, suivant);
      emettre(suivant);
      void bridge()
        .remote.prefs.set(PREF, suivant)
        .catch(() => {
          // Le cache local a la liste ; le serveur la recevra au prochain geste.
        });
    },
    [email],
  );

  const estAllege = useCallback((key: string) => alleges.includes(key), [alleges]);
  return { alleges, estAllege, basculer, remplacer };
}
