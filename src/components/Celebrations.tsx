import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useLangue } from '../i18n';
import { useCollection, useSync } from '../state/SyncContext';
import { useToast } from '../state/ToastContext';

/**
 * LES CÉLÉBRATIONS — les premières fois, et rien d'autre.
 *
 * Une première tâche terminée, un premier client, une première facture
 * encaissée, un premier projet : une phrase chaleureuse, une fois, jamais
 * deux. Rien n'est coché à la main : la collection franchit le seuil
 * pendant que le poste est ouvert. Ce qui existait déjà à l'ouverture ne se
 * fête pas (on ne félicite pas quelqu'un pour l'an dernier). Éteignable dans
 * Paramètres › Extensions (`amn.celebrations`).
 */
export const CLE_CELEBRATIONS = 'amn.celebrations';

export function celebrationsActives(): boolean {
  try {
    return window.localStorage.getItem(CLE_CELEBRATIONS) !== 'non';
  } catch {
    return true;
  }
}

export function ecrireCelebrations(oui: boolean): void {
  try {
    window.localStorage.setItem(CLE_CELEBRATIONS, oui ? 'oui' : 'non');
  } catch {
    /* stockage refusé */
  }
}

type Seuil = { cle: string; compte: () => number; titre: string; texte: string };

export function Celebrations() {
  const { t } = useLangue();
  const { user } = useAuth();
  const { ready } = useSync();
  const { notify } = useToast();
  const tasks = useCollection<{ status?: string }>('tasks');
  const clients = useCollection('clients');
  const invoices = useCollection<{ status?: string }>('invoices');
  const projects = useCollection('projects');
  const email = user?.email ?? '';
  const memoire = useRef<Record<string, number> | null>(null);

  const seuils: Seuil[] = [
    { cle: 'tache', compte: () => tasks.filter((x) => x.status === 'done').length, titre: t('celebration.tache.titre'), texte: t('celebration.tache.texte') },
    { cle: 'client', compte: () => clients.length, titre: t('celebration.client.titre'), texte: t('celebration.client.texte') },
    { cle: 'facture', compte: () => invoices.filter((x) => x.status === 'paid').length, titre: t('celebration.facture.titre'), texte: t('celebration.facture.texte') },
    { cle: 'projet', compte: () => projects.length, titre: t('celebration.projet.titre'), texte: t('celebration.projet.texte') },
  ];
  const comptes = seuils.map((s) => s.compte());

  useEffect(() => {
    if (!ready || !email) return;
    const cleMemoire = `${CLE_CELEBRATIONS}.${email}`;
    let faites: Record<string, number> = {};
    try {
      faites = JSON.parse(window.localStorage.getItem(cleMemoire) ?? '{}') as Record<string, number>;
    } catch {
      faites = {};
    }
    /* Première lecture : ce qui existe déjà est acquis, pas fêté. */
    if (memoire.current === null) {
      memoire.current = Object.fromEntries(seuils.map((s, i) => [s.cle, comptes[i]]));
      return;
    }
    seuils.forEach((s, i) => {
      const avant = memoire.current?.[s.cle] ?? 0;
      const apres = comptes[i];
      if (avant === 0 && apres > 0 && !faites[s.cle] && celebrationsActives()) {
        faites[s.cle] = Date.now();
        try {
          window.localStorage.setItem(cleMemoire, JSON.stringify(faites));
        } catch {
          /* stockage refusé : la fête ne se rejouera qu'à la prochaine première fois */
        }
        notify({ title: s.titre, body: s.texte, durationMs: 7000 });
      }
      if (memoire.current) memoire.current[s.cle] = apres;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, email, ...comptes]);

  return null;
}
