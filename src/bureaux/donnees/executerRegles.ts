import { useEffect, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useCollection, useSync } from '../../state/SyncContext';
import { useSupervisor } from './useSupervisor';
import { useCyber } from './cyber';
import { jourDe } from './releves';
import { actionDe, candidates, conditionDe, type EtatDuJour } from './regles';
import type { DeclenchementParc, RegleParc } from './types';

/**
 * LE MOTEUR DES AUTOMATISATIONS — tourne dans le poste qui a un bureau ouvert.
 *
 * Toutes les dix minutes : pour chaque règle ACTIVE (un brouillon ne
 * déclenche rien), chaque organisation qui remplit sa condition aujourd'hui
 * et n'est pas exceptée reçoit l'action — une fois. Les identifiants sont
 * déterministes (`règle:organisation:jour`, et la tâche qui en découle) :
 * deux postes ouverts au même moment écrivent la même chose au même endroit,
 * sans doublon. Une même organisation n'est pas relancée tant que la règle
 * l'a déjà servie dans sa fenêtre (la durée de la règle, sept jours au moins).
 */
export function useExecuterRegles() {
  const { user } = useAuth();
  const { upsert } = useSync();
  const sup = useSupervisor();
  const cyber = useCyber();
  const declenchements = useCollection<DeclenchementParc>('parcDeclenchements');
  const etat = useRef({ sup, cyber, declenchements });
  etat.current = { sup, cyber, declenchements };

  useEffect(() => {
    if (!user?.email) return;
    const moi = user.email;
    const tourner = () => {
      const { sup: s, cyber: c, declenchements: d } = etat.current;
      if (!s.pret || !c.pret || !s.orgs.length) return;
      const maintenant = Date.now();
      const jour = jourDe(maintenant);
      const e: EtatDuJour = {
        maintenant,
        tendance: new Map(c.orgs.map((o) => [o.id, o.tendance])),
        enPanne: new Set(c.incidents.filter((g) => g.incidents.some((i) => i.kinds.some((k) => k === 'site_unreachable' || k === 'availability_down'))).map((g) => g.orgId)),
      };
      for (const r of s.regles) {
        if (!r.active || !conditionDe(r)) continue;
        const fenetre = Math.max(7, r.duree || 1) * 86_400_000;
        for (const o of candidates(r, s.orgs, e)) {
          const deja = d.some((x) => x.regleId === r.id && x.orgId === o.id && maintenant - Date.parse(x.at) < fenetre);
          if (deja) continue;
          const id = `${r.id}:${o.id}:${jour}`;
          const pour = r.pourQui === 'suivi' ? (o.suivi.type === 'humain' ? o.suivi.email : r.creePar ?? moi) : r.pourQui || moi;
          const c0 = conditionDe(r)!;
          const at = new Date(maintenant).toISOString();
          const action = actionDe(r.action);
          if (action.cle === 'carnet') {
            void upsert('carnet', `regle-${id}`, { texte: `${r.nom ?? 'Automatisation'} : ${o.nom}, ${c0.constat(o, e)}.`, liens: [{ type: 'cliente', id: o.id, label: o.nom }], question: false, resolue: false, par: moi, at });
            void upsert('parcDeclenchements', id, { regleId: r.id, orgId: o.id, jour, at, quoi: 'note au carnet de Cyber', tacheId: null });
          } else {
            const tacheId = `regle-${id}`;
            const titre = action.cle === 'tache_relance' ? `Relancer ${o.nom}` : `À regarder : ${o.nom}`;
            void upsert('tasks', tacheId, { title: titre, detail: `${r.nom ?? 'Automatisation'} — ${c0.constat(o, e)}.`, assigneeEmail: pour, status: 'todo', siteId: null, clientId: null, createdAt: at });
            void upsert('parcDeclenchements', id, { regleId: r.id, orgId: o.id, jour, at, quoi: action.cle === 'tache_relance' ? 'tâche de relance' : 'prévenu', tacheId });
          }
        }
      }
    };
    const premier = setTimeout(tourner, 15_000);
    const i = setInterval(tourner, 10 * 60_000);
    return () => {
      clearTimeout(premier);
      clearInterval(i);
    };
  }, [user?.email, upsert]);
}

