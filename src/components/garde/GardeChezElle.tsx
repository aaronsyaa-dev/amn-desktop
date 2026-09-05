import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { garde, EQUIPES_ORDRE } from '../../lib/garde';
import { useLangue } from '../../i18n';
import { relativeTime } from '../../lib/time';
import type { GardeJournalEntree } from '../../shared/garde';

/**
 * LA GARDE CHEZ CETTE ORGANISATION (Bloc 9) — l'historique par élément.
 *
 * Dans le dossier d'une organisation : ce que les gardes y ont fait, dans
 * l'ordre, avec qui, pourquoi, et le résultat (réglé seul, remonté, refusé,
 * échec). Et l'on peut parler au garde qu'on croise : un lien vers le bureau
 * de son chef. Rien quand la Garde n'y a jamais mis les pieds — pas de bloc
 * vide.
 */
const NOM_EQUIPE: Record<string, string> = { sites: 'des Sites', securite: 'de la Sécurité', comptes: 'des Comptes', registre: 'du Registre', clientes: 'des Clientes', produit: 'du Produit', taches: 'des Tâches', memoire: 'de la Mémoire' };

export function GardeChezElle({ orgId }: { orgId: string }) {
  const { t } = useLangue();
  const [journal, setJournal] = useState<GardeJournalEntree[] | null>(null);
  const charger = useCallback(async () => {
    try { setJournal(await garde.journal({ org: orgId, limit: 8 })); } catch { setJournal([]); }
  }, [orgId]);
  useEffect(() => { void charger(); }, [charger]);
  useEffect(() => garde.onGarde((trame) => { if (trame.type === 'garde:journal' && (trame.entree as { orgId?: string } | undefined)?.orgId === orgId) void charger(); }), [charger, orgId]);
  if (!journal || journal.length === 0) return null;
  const equipes = [...new Set(journal.map((e) => e.equipe))].filter((e) => (EQUIPES_ORDRE as readonly string[]).includes(e));
  const classe = (r: string) => (r === 'echec' ? 'text-danger' : r === 'refuse' ? 'text-text-muted' : r === 'remonte' ? 'text-warning' : 'text-success');
  return (
    <>
      <p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('dossier.garde.titre')}</p>
      <ol className="mt-2 flex flex-col gap-1.5" aria-label={t('dossier.garde.titre')} data-garde-chez-elle={journal.length}>
        {journal.map((e) => (
          <li key={e.id} className="text-[12px] leading-snug text-text-secondary">
            <span className={`font-mono text-[10px] uppercase tracking-wider ${classe(e.resultat)}`}>{t(`garde.resultat.${e.resultat}`)}</span>
            <span className="text-text-muted"> · {relativeTime(e.createdAt)} · </span>
            <span className="text-text-primary">{t('dossier.garde.par', { equipe: NOM_EQUIPE[e.equipe] ?? e.equipe })}</span>
            <span> — {e.pourquoi || e.action}</span>
          </li>
        ))}
      </ol>
      <div className="mt-2 flex flex-wrap gap-2">
        {equipes.map((e) => (
          <Link key={e} to={`/garde/bureaux/${e}`} className="border border-border px-2 py-1 text-[11px] text-text-secondary hover:border-border-strong hover:text-text-primary">{t('dossier.garde.parler', { equipe: NOM_EQUIPE[e] ?? e })}</Link>
        ))}
      </div>
    </>
  );
}
