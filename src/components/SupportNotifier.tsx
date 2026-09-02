import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { bridge } from '../lib/bridge';
import { useToast } from '../state/ToastContext';
import { IS_BUSINESS } from '../edition/edition';

/**
 * LES DEMANDES, À L'ARRIVÉE (Bloc 4).
 *
 * Deux sens, deux organisations, jamais mélangés — c'est le hub qui scinde :
 *
 *   · chez AMN DevSec, une demande de cliente arrive (`support:request`) :
 *     un toast et une notification de bureau, qui mènent à la file ;
 *   · chez la cliente, la réponse arrive (`support:answered`) : idem, vers
 *     son écran Assistance.
 *
 * Une trame rejouée à la reconnexion ne doit pas notifier deux fois.
 */
export function SupportNotifier() {
  const { notify } = useToast();
  const navigate = useNavigate();
  const vues = useRef(new Set<string>());

  useEffect(() => {
    const desabonnements: Array<() => void> = [];
    const dire = (cle: string, title: string, body: string, to: string) => {
      if (vues.current.has(cle)) return;
      vues.current.add(cle);
      notify({ title, body, durationMs: 12_000, onClick: () => navigate(to) });
      try {
        bridge().system.notify({ title, body });
      } catch {
        /* pas de notification native sur cette plateforme — le toast suffit */
      }
    };

    const surDemande = bridge().remote.onSupportRequest;
    if (!IS_BUSINESS && surDemande) {
      desabonnements.push(
        surDemande((request) => {
          const nature =
            request.kind === 'seat' ? 'Une place de plus' : request.kind === 'password_reset' ? 'Mot de passe oublié' : request.subject;
          dire(`req:${request.id}`, `Demande — ${request.orgName ?? request.requestedByEmail}`, nature, '/tour/organisations');
        }),
      );
    }
    const surInjection = bridge().remote.onInputAlert;
    if (!IS_BUSINESS && surInjection) {
      desabonnements.push(
        surInjection((alerte) => {
          dire(`inj:${alerte.id}`, `Tentative d’injection — ${alerte.orgName ?? 'hors organisation'}`, `${alerte.family} · ${alerte.userEmail ?? alerte.ip ?? ''}`, '/tour/organisations');
        }),
      );
    }
    if (bridge().remote.onSupportAnswered) {
      desabonnements.push(
        bridge().remote.onSupportAnswered((request) => {
          dire(`rep:${request.id}:${request.handledAt ?? ''}`, 'Réponse de votre prestataire', request.subject, '/assistance');
        }),
      );
    }
    return () => {
      for (const d of desabonnements) d();
    };
  }, [notify, navigate]);

  return null;
}
