import React, { createContext, useContext, useMemo } from 'react';

/**
 * UN ÉCRAN VIDE N'A PAS D'AMBRE — la règle, écrite une fois (BLOC 1)
 * ═════════════════════════════════════════════════════════════════
 *
 * Le système de design tire cette règle des deux états transverses `27a` et
 * `27b` : « Un écran vide n'a rien à signaler. C'est l'exception à la règle
 * d'ambre, et elle est délibérée. » Deux écrans sur soixante-seize s'en
 * passent, et ce sont les deux seuls.
 *
 * Elle a un corollaire, énoncé en `27b` comme la règle la plus importante de
 * cet état : **aucun chiffre à zéro nulle part.** « 0 € encaissé » se lit
 * comme un échec ; « rien n'est encore passé en caisse » se lit comme un
 * début. Ce n'est pas une nuance de ton : c'est la différence entre un outil
 * qui accuse quelqu'un dès son premier jour et un outil qui l'accueille.
 *
 * CE QUE CE FICHIER ÉVITE. Sans lui, la règle serait soixante-et-onze `&&`
 * posés à la main dans soixante-et-onze écrans — donc soixante-et-onze
 * endroits où l'oublier, et aucun endroit où la lire. Ici, l'écran déclare
 * UN FAIT qu'il connaît déjà (« je n'ai rien à montrer »), et ce sont les
 * composants partagés qui en tirent les conséquences :
 *
 *   · `PlaqueSignal` ne rend rien du tout sur un écran vide ;
 *   · `ScreenHeader` retire ses relevés chiffrés et les remplace par la
 *     phrase que l'écran lui donne ;
 *   · `scripts/check-signal.mjs` échoue si un écran porte en même temps un
 *     état vide et un objet ambre.
 *
 * L'écran ne décide donc jamais du traitement — seulement de son état.
 */

type EtatEcran = {
  /** L'écran n'a aucune donnée à montrer : ni ambre, ni chiffre. */
  vide: boolean;
  /**
   * Vrai quand c'est le PREMIER JOUR du module — jamais utilisé, pas
   * seulement vide sur la période regardée. `27b` contre `27a`. La
   * distinction change la phrase, pas les règles : les deux interdisent
   * l'ambre et les zéros.
   */
  premierJour: boolean;
};

const Contexte = createContext<EtatEcran>({ vide: false, premierJour: false });

/**
 * Le fournisseur, posé autour du contenu d'un écran. Il ne rend aucun DOM :
 * il ne fait que rendre lisible, aux composants partagés, un fait que l'écran
 * vient de calculer.
 *
 * ```tsx
 * <EcranVide quand={factures.length === 0} premierJour={jamaisFacture}>
 *   <ScreenHeader … phraseVide="Aucune facture n'est encore partie." />
 *   …
 * </EcranVide>
 * ```
 */
export function EcranVide({
  quand,
  premierJour = false,
  children,
}: {
  quand: boolean;
  premierJour?: boolean;
  children: React.ReactNode;
}) {
  const valeur = useMemo(() => ({ vide: quand, premierJour: quand && premierJour }), [quand, premierJour]);
  return (
    <Contexte.Provider value={valeur}>
      {/*
        `display: contents` — le marqueur n'a AUCUNE boîte de mise en page :
        ses enfants se disposent exactement comme si ce nœud n'existait pas.
        Il n'est là que pour être lisible de l'extérieur, par le garde-fou
        `check:signal`, qui tourne dans un vrai navigateur et ne peut pas lire
        un contexte React. Sans lui, la règle « un écran vide n'a pas d'ambre »
        serait une intention ; avec lui, elle est mesurée.
      */}
      <div className="contents" data-ecran-vide={quand ? (premierJour ? 'premier-jour' : 'oui') : undefined}>
        {children}
      </div>
    </Contexte.Provider>
  );
}

/** L'état de l'écran courant. Faux par défaut : un écran qui ne déclare rien a du contenu. */
export function useEtatEcran(): EtatEcran {
  return useContext(Contexte);
}

/**
 * LA PLAQUE AMBRE — le seul objet ambre de l'écran.
 *
 * Trois choses valent d'être faites ici plutôt qu'à la main :
 *
 *   1. **Sur un écran vide, elle ne rend rien.** Pas une version pâle, pas un
 *      tiret : rien. C'est la règle de `27a`, appliquée sans que l'écran ait
 *      à y penser.
 *   2. **Elle refuse le vide.** Une plaque ambre sans contenu — parce que le
 *      compte est tombé à zéro entre deux rendus — laisserait un rectangle
 *      ambre qui ne signale plus rien. `quand` permet à l'écran de dire à
 *      quelle condition l'objet mérite le signal ; sans condition vraie,
 *      pas de plaque.
 *   3. **Elle porte l'encre sombre.** L'ambre est TOUJOURS une plaque pleine à
 *      encre `--signal-ink` (voir l'en-tête de `src/index.css`), jamais du
 *      texte ambre sur fond sombre.
 *
 * `data-signal-groupe` est transmis tel quel : plusieurs nœuds d'une même
 * région ambre (l'objet et son relevé) se comptent pour un seul signal.
 */
export function PlaqueSignal({
  quand = true,
  groupe,
  className = '',
  children,
  ...reste
}: {
  /** À quelle condition l'objet demande une décision. Faux ⇒ pas de plaque. */
  quand?: boolean;
  /** Le nom de la région ambre, quand elle compte plusieurs nœuds. */
  groupe?: string;
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, 'children' | 'className'>) {
  const { vide } = useEtatEcran();
  if (vide || !quand) return null;
  return (
    <span
      data-signal-groupe={groupe}
      className={`inline-flex items-center bg-signal font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-signal-ink ${className}`}
      {...reste}
    >
      {children}
    </span>
  );
}

/**
 * Le halo ambre d'un objet dominant — le `drop-shadow` qui respire, sans la
 * plaque. Même règle : rien sur un écran vide.
 *
 * Rendu en tant que fonction plutôt qu'en composant parce qu'il s'applique à
 * un `<svg>` ou à un `<div>` déjà écrit par l'écran : on veut lui donner une
 * classe, pas l'envelopper dans un nœud de plus.
 */
export function useHaloSignal(quand = true): string {
  const { vide } = useEtatEcran();
  return vide || !quand ? '' : 'halo-signal';
}
