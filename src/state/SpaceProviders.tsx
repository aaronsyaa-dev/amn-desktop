import React from 'react';
import { ActivityProvider } from './ActivityContext';
import { ProfilesProvider } from './ProfilesContext';
import { SyncProvider } from './SyncContext';
import { ToastProvider } from './ToastContext';
import { UndoProvider } from './UndoContext';
import { TagProvider } from '../components/tags/TagProvider';

/**
 * LES FOURNISSEURS D'UN ESPACE DE TRAVAIL BUSINESS, EN UN SEUL ENDROIT
 * ═══════════════════════════════════════════════════════════════════
 *
 * ## Le défaut que ce composant existe pour rendre impossible
 *
 * La table de routes de l'édition Business est montée à DEUX endroits : par
 * `BusinessLayout` chez la cliente, et par `ClientContextLayout` quand un
 * opérateur entre dans son contexte depuis la Tour de contrôle. C'est voulu —
 * tout l'intérêt du contexte de support est de voir SON application, pas une
 * variante.
 *
 * Mais les deux coquilles montaient chacune leur propre pile de fournisseurs,
 * recopiée à la main. Elles ont divergé d'un seul fournisseur, et ce seul
 * fournisseur a suffi :
 *
 *   `ClientContextLayout` n'avait pas d'`ActivityProvider`. Une bande
 *   d'information ajoutée plus tard à l'accueil Business (`DayBand`) appelle
 *   `useActivity()`. Chez la cliente, tout allait bien. Côté opérateur, entrer
 *   dans le contexte d'une organisation faisait rendre exactement le même
 *   accueil SANS le fournisseur — donc `useActivity` levait
 *   « useActivity must be used within an ActivityProvider », et l'écran
 *   d'erreur s'affichait à la place de l'application.
 *
 * Ce n'était pas une erreur d'inattention isolée : c'est ce que produit
 * MÉCANIQUEMENT une pile recopiée. Ajouter le fournisseur manquant aurait
 * corrigé ce crash-ci et laissé le suivant arriver au prochain écran partagé
 * qui utiliserait un contexte. Une seule liste, utilisée des deux côtés, retire
 * la possibilité même de l'oubli.
 *
 * ## L'ordre compte, et il est le même partout
 *
 * `ActivityProvider` lit le magasin de synchronisation (`useSync`) : il doit
 * donc vivre SOUS `SyncProvider`. C'est la seule contrainte réelle de la pile ;
 * le reste de l'ordre est repris tel quel de `BusinessLayout`, pour que le
 * comportement observé chez la cliente soit exactement celui que l'opérateur
 * voit en support.
 *
 * ## La portée
 *
 * `scope` est absent dans l'édition Business — la cliente n'a qu'un espace, le
 * sien. Dans un contexte client il porte l'identifiant de l'organisation
 * visitée, et l'appelant remonte tout l'arbre via une `key` quand il change :
 * c'est ce qui garantit qu'aucun état React d'une organisation ne survit à la
 * bascule vers une autre.
 */
export function SpaceProviders({
  children,
  scope,
}: {
  children: React.ReactNode;
  scope?: string;
}) {
  return (
    <SyncProvider scope={scope}>
      <ProfilesProvider>
        <ActivityProvider>
          <ToastProvider>
            <UndoProvider>
              <TagProvider>{children}</TagProvider>
            </UndoProvider>
          </ToastProvider>
        </ActivityProvider>
      </ProfilesProvider>
    </SyncProvider>
  );
}
