import React, { useEffect, useState } from 'react';
import { bridge } from '../../lib/bridge';
import { garde } from '../../lib/garde';
import { useAuth } from '../../auth/AuthContext';
import { useProfiles } from '../../state/ProfilesContext';
import { useSync } from '../../state/SyncContext';
import type { AdminOrgUser } from '../../shared/api';
import type { GardeDossier } from '../../shared/garde';
import { EnTeteQG, SiGardeLue } from './communs';
import { useQG } from './qg';

/**
 * I9 · LES DEUX POSTES (`42i`).
 *
 * Deux colonnes, un compte chacune, avec ce que chacun a pris ; entre les
 * deux, une allée en pointillé qui contient CE QUE PERSONNE N'A PRIS, avec un
 * seul bouton « Je le prends ».
 *
 * Règles (ACCUEILS.md) : l'allée ne contient que des dossiers de gravité
 * haute ou critique non attribués. Prendre un dossier le fait passer du côté
 * de celui qui l'a pris (amn-api : `POST /garde/pile/:id/prise`, journalisé).
 * L'état de présence de chaque compte est affiché en tête de sa colonne.
 * L'ambre : le dossier dans l'allée.
 *
 * La présence est celle que le serveur connaît : en ligne, ou hors ligne. Le
 * produit ne garde pas l'heure de dernière présence d'un compte ; l'écran ne
 * l'invente pas.
 */
const JOUR = 86_400_000;

export function DeuxPostes() {
  const q = useQG(30_000);
  const { user } = useAuth();
  const { profileFor } = useProfiles();
  const { onlineEmails } = useSync();
  const [membres, setMembres] = useState<AdminOrgUser[]>([]);
  const [occupe, setOccupe] = useState(false);
  const interne = q.organisations.find((o) => o.plan === 'internal')?.id ?? null;

  useEffect(() => {
    if (!interne) return;
    let vivant = true;
    void bridge()
      .remote.admin.listUsers(interne)
      .then((l) => vivant && setMembres(l.filter((u) => u.status === 'active').sort((a, b) => a.email.localeCompare(b.email))))
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, [interne]);

  const dossiers = q.accueil?.pile.dossiers ?? [];
  const allee = dossiers.filter((d) => !d.prisPar && (d.gravite === 'critique' || d.gravite === 'haute'));
  const premier = allee[0] ?? null;
  const postes = membres.slice(0, 2);
  const t = q.maintenant.getTime();
  const age = (d: GardeDossier) => Math.max(0, Math.floor((t - Date.parse(d.depuis)) / JOUR));

  const prendre = async (d: GardeDossier) => {
    setOccupe(true);
    try {
      await garde.prendre(d.id, true);
      await q.recharger();
    } finally {
      setOccupe(false);
    }
  };
  const rendre = async (d: GardeDossier) => {
    setOccupe(true);
    try {
      await garde.prendre(d.id, false);
      await q.recharger();
    } finally {
      setOccupe(false);
    }
  };

  const colonne = (m: AdminOrgUser) => {
    const pris = dossiers.filter((d) => d.prisPar === m.email);
    const enLigne = onlineEmails.has(m.email) || m.email === user?.email;
    const nom = profileFor(m.email).name || m.email.split('@')[0];
    return (
      <div key={m.id} className="flex min-w-0 flex-col gap-2">
        <span className="mb-1.5 flex items-center gap-[9px]">
          <span className={`h-1.5 w-1.5 rounded-full ${enLigne ? 'anneau-courant bg-text-primary' : 'bg-border-strong'}`} />
          <span className={`truncate text-[15px] font-bold ${enLigne ? 'text-text-primary' : 'text-text-body'}`}>{nom}</span>
          <span className="whitespace-nowrap font-mono text-[10px] text-text-muted">
            {enLigne ? 'EN LIGNE' : 'HORS LIGNE'} · {pris.length} PRIS
          </span>
        </span>
        {pris.length === 0 && <span className="text-[12.5px] text-text-muted">Rien de pris.</span>}
        {pris.map((d) => (
          <div key={d.id} className="border border-border bg-[#0f0f0f] px-3.5 py-[11px]">
            <span className="block text-[13.5px] font-semibold text-text-primary">{d.titre.replace(/\.$/, '')}</span>
            <span className="mt-1 flex items-baseline justify-between gap-3 text-[12px] text-text-muted">
              <span>
                {d.orgNom ?? 'La Garde'} · {d.gravite}
              </span>
              {m.email === user?.email && (
                <button type="button" disabled={occupe} onClick={() => void rendre(d)} className="min-h-8 text-[11.5px] text-text-secondary underline-offset-2 hover:text-text-primary hover:underline disabled:opacity-50">
                  Rendre
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <SiGardeLue q={q}>
      <div className="flex flex-col gap-6">
        <EnTeteQG q={q} nom="Les deux postes" />
        <section className="panel-raised panel-raised-wide grid items-start gap-[18px] px-4 py-[26px] sm:px-7 lg:grid-cols-[minmax(0,1fr)_300px_minmax(0,1fr)]">
          {postes[0] ? colonne(postes[0]) : <span />}
          <div className="flex min-h-[260px] min-w-0 flex-col gap-2.5 border-x border-dashed border-[#333] bg-[#0a0a0a] p-4">
            <span className="text-center font-mono text-[9.5px] tracking-[0.14em] text-text-muted">PERSONNE</span>
            {premier ? (
              <>
                <div data-signal-groupe="allee" className="bg-signal p-4 shadow-[0_0_30px_-7px_rgba(208,154,74,.85)]">
                  <span className="block font-mono text-[9.5px] font-bold tracking-[0.16em] text-[#3a2a0e]">
                    {premier.gravite.toUpperCase()} · {age(premier)} J
                  </span>
                  <span className="mt-2 block text-[15px] font-bold leading-[1.3] text-[#080808]">{premier.titre.replace(/\.$/, '')}</span>
                </div>
                <button
                  type="button"
                  disabled={occupe}
                  onClick={() => void prendre(premier)}
                  className="flex min-h-11 items-center justify-center bg-text-primary px-[13px] text-[12.5px] font-semibold text-[#0a0a0a] shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)] disabled:opacity-50 sm:min-h-[30px]"
                >
                  Je le prends
                </button>
                {allee.length > 1 && (
                  <span className="text-center text-[12px] text-text-secondary">
                    Puis {allee.length - 1} autre{allee.length > 2 ? 's' : ''} : {allee.slice(1, 3).map((d) => d.orgNom ?? 'la Garde').join(', ')}
                    {allee.length > 3 ? '…' : ''}
                  </span>
                )}
                <span className="text-center text-[12px] leading-[1.45] text-text-muted [text-wrap:pretty]">Un dossier pris passe du côté de celui qui l’a pris.</span>
              </>
            ) : (
              <span className="my-auto text-center text-[13px] leading-[1.5] text-text-secondary">Tout ce qui est grave a quelqu’un.</span>
            )}
          </div>
          {postes[1] ? colonne(postes[1]) : <span className="text-[12.5px] text-text-muted">Un seul compte actif dans l’équipe interne.</span>}
        </section>
      </div>
    </SiGardeLue>
  );
}
