import React, { createContext, useContext } from 'react';

/**
 * « Cet écran est-il rendu DANS le dossier d'une organisation cliente ? »
 *
 * Les écrans partagés (Clients, Tâches, Notes, Rapports, Paramètres) sont
 * littéralement les mêmes fichiers dans les deux éditions. Jusqu'ici, ce qui
 * différait était tranché à la compilation par la couture `@edition/exclusive` :
 * un build interne montrait les blocs internes, un build Business ne les
 * compilait pas.
 *
 * Le contexte client casse cette hypothèse, parce qu'il fait cohabiter les deux
 * faces dans un MÊME build : c'est l'édition interne, mais l'opérateur doit y
 * voir l'application de la cliente. Sans ce drapeau, sa fiche client afficherait
 * un bloc « sites liés » qui n'existe pas chez elle, sa liste de tâches
 * proposerait de les assigner à aaron@amn-devsec.com, et ses devis imprimés
 * porteraient notre sous-titre commercial. Le premier point est un écran faux ;
 * les deux suivants sont des fuites.
 *
 * Le drapeau ne remplace pas la couture de compilation — il la complète : dans
 * un build Business, ce fichier n'est jamais importé, et rien de ce qu'il gouverne
 * n'existe de toute façon.
 */
const ClientViewContext = createContext(false);

export function ClientViewProvider({ children }: { children: React.ReactNode }) {
  return <ClientViewContext.Provider value>{children}</ClientViewContext.Provider>;
}

/** `false` hors d'un contexte client — y compris sans fournisseur du tout. */
export function useClientView(): boolean {
  return useContext(ClientViewContext);
}
