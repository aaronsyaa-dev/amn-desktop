import React, { useEffect, useState } from 'react';
import { bridge } from '../lib/bridge';
import type { SessionAssistance } from '../shared/api';

/**
 * LE BANDEAU DE LA SESSION D'ASSISTANCE (cahier 15, `51a` — édition cliente).
 *
 * Quand quelqu'un de l'équipe AMN ouvre une session d'assistance dans
 * l'espace d'une cliente, il n'y apparaît ni « en ligne » ni en pastille sur
 * un module : on ne doit jamais le prendre pour une collègue. Il s'annonce
 * ici, en toutes lettres — qui, depuis quand —, tant que la session dure.
 * Le serveur n'envoie cette trame qu'aux membres de l'organisation.
 *
 * Pas d'ambre : rien n'est demandé à la cliente.
 */
export function BandeauAssistance() {
  const [sessions, setSessions] = useState<SessionAssistance[]>([]);
  useEffect(() => bridge().remote.onAssistance?.((s) => setSessions(s)) ?? undefined, []);
  if (!sessions.length) return null;
  const qui = sessions.map((s) => prenom(s.email));
  const depuis = sessions.map((s) => s.depuis).sort()[0];
  const h = new Date(depuis);
  const heure = `${String(h.getHours()).padStart(2, '0')}:${String(h.getMinutes()).padStart(2, '0')}`;
  return (
    <div role="status" className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2 text-[13px] text-text-secondary sm:px-8" data-bandeau-assistance>
      <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-text-secondary" />
      <span>
        <b className="font-semibold text-text-primary">{qui.length > 1 ? `${qui.slice(0, -1).join(', ')} et ${qui[qui.length - 1]}` : qui[0]}</b>, de l’équipe AMN, {qui.length > 1 ? 'sont' : 'est'} dans votre espace depuis {heure}, en session d’assistance.
      </span>
    </div>
  );
}

function prenom(email: string): string {
  const base = email.split('@')[0].split(/[._-]/)[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}
