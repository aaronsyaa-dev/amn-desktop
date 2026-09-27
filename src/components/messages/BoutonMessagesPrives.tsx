import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useMessagesPrivesNonLus } from '../../state/messagesPrives';
import { useProfilesOptionnel } from '../../state/ProfilesContext';

/**
 * LA PASTILLE DES MESSAGES PRIVÉS — dans la barre du Poste de travail ET dans celle de chaque
 * bureau : un message reçu se voit où qu'on soit. Un clic ouvre le fil du dernier message reçu.
 * Le nombre de non-lus passe aussi dans le titre de la fenêtre (onglet du navigateur, barre des tâches).
 */
export function BoutonMessagesPrives({ variante = 'poste' }: { variante?: 'poste' | 'bureau' }) {
  const navigate = useNavigate();
  const { total, dernier } = useMessagesPrivesNonLus();
  const profils = useProfilesOptionnel();
  const de = dernier ? profils?.profileFor(dernier.from).name || dernier.from.split('@')[0] : null;
  const libelle = total > 0 ? `Messages privés : ${total} non lu${total > 1 ? 's' : ''}${de ? `, le dernier de ${de}` : ''}` : 'Messages privés';

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s+/, '');
    document.title = total > 0 ? `(${total}) ${base}` : base;
  }, [total]);

  const ouvrir = () => navigate(dernier ? `/messages-prives?avec=${encodeURIComponent(dernier.from)}` : '/messages-prives');
  const classe =
    variante === 'bureau'
      ? 'relative flex h-7 w-7 flex-none items-center justify-center border border-border-strong text-text-secondary hover:border-[#8a8a87] hover:text-text-primary'
      : 'relative flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition-colors duration-200 hover:text-text-primary md:h-9 md:w-9';
  return (
    <button type="button" onClick={ouvrir} aria-label={libelle} title={libelle} data-messages-prives={total} className={classe}>
      <MessageCircle size={variante === 'bureau' ? 14 : 17} strokeWidth={1.9} aria-hidden />
      {total > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-fill px-1 text-[10px] font-semibold text-white">
          {total > 99 ? '99+' : total}
        </span>
      )}
    </button>
  );
}
