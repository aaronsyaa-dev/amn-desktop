import React, { useEffect, useState } from 'react';
import { bridge } from '../../lib/bridge';
import type { ParcOrganization } from '../../shared/api';

/**
 * LA CLIENTE DONT C'EST LE SITE (édition interne, chantier « arrivée cliente », partie 4).
 *
 * Un site surveillé reste à AMN DevSec — sa clé, ses événements, ses
 * incidents. Ce rattachement ne donne à la cliente AUCUN accès : il dit
 * seulement à la Garde chez qui ranger ce qu'elle fait sur ce site (une
 * panne, un certificat, un incident), pour que le dossier de la cliente le
 * montre. Sans lui, tout restait rangé sous AMN DevSec.
 *
 * La recherche passe par la page du Parc (`organizationsPage`, 6 résultats) :
 * jamais la liste complète des organisations.
 */
export function SiteCliente({
  siteId,
  clientOrgId,
  onChange,
}: {
  siteId: string;
  clientOrgId: string | null;
  onChange: () => void | Promise<void>;
}) {
  const [nom, setNom] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [trouvees, setTrouvees] = useState<ParcOrganization[]>([]);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    if (!clientOrgId) { setNom(null); return; }
    bridge().remote.admin.organizationDossier(clientOrgId)
      .then((d) => { if (vivant) setNom(d.organization.name); })
      .catch(() => { if (vivant) setNom(null); });
    return () => { vivant = false; };
  }, [clientOrgId]);

  const chercher = async (q: string) => {
    setRecherche(q);
    if (q.trim().length < 2) { setTrouvees([]); return; }
    try {
      const page = await bridge().remote.admin.organizationsPage({ q: q.trim(), limit: 6 });
      setTrouvees(page.organizations.filter((o) => o.plan !== 'internal'));
    } catch { setTrouvees([]); }
  };

  const poser = async (id: string | null) => {
    if (busy) return;
    setBusy(true);
    setErreur(null);
    try {
      await bridge().remote.configureSite(siteId, { clientOrgId: id });
      setRecherche('');
      setTrouvees([]);
      await onChange();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-border bg-bg/40 p-3 sm:p-4" data-site-cliente={clientOrgId ?? ''}>
      <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Cliente de ce site</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className="text-sm text-text-primary">
          {clientOrgId ? nom ?? '…' : 'Pas encore rattaché — la Garde range son travail sous AMN DevSec.'}
        </span>
        {clientOrgId && (
          <button
            type="button"
            onClick={() => void poser(null)}
            disabled={busy}
            className="border border-border px-2 py-1 text-xs text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-50"
          >
            Détacher
          </button>
        )}
      </div>
      <input
        value={recherche}
        onChange={(e) => void chercher(e.target.value)}
        placeholder={clientOrgId ? 'Changer de cliente…' : 'Chercher la cliente…'}
        aria-label="Chercher la cliente de ce site"
        className="input-focus mt-2 w-full max-w-sm border border-border bg-bg px-2 py-1.5 text-[13px] text-text-primary outline-none"
      />
      {trouvees.length > 0 && (
        <ul className="mt-1 max-w-sm divide-y divide-border border border-border" aria-label="Clientes trouvées">
          {trouvees.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => void poser(o.id)}
                disabled={busy || o.id === clientOrgId}
                className="flex min-h-10 w-full items-center justify-between px-2 text-left text-[13px] text-text-primary hover:bg-surface-hover disabled:opacity-50"
              >
                <span className="truncate">{o.name}</span>
                <span className="ml-2 font-mono text-[10px] text-text-muted">#{o.id.slice(0, 8)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 max-w-md text-[12px] leading-relaxed text-text-muted">
        Le site reste à AMN DevSec, et la cliente n’y gagne aucun accès : le rattachement range seulement le
        travail de la Garde sur ce site dans son dossier.
      </p>
      {erreur && <p role="alert" className="mt-2 text-xs text-danger">{erreur}</p>}
    </div>
  );
}
