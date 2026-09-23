import React from 'react';
import { useRemoteSites } from '../../state/RemoteSitesContext';
import { enLettres } from '../lettres';
import { EnTeteQG, SiGardeLue } from './communs';
import { useQG } from './qg';

/**
 * I10 · LE SILENCE (`42j`).
 *
 * Une phrase de 48 px au centre d'une carte haute — « La Garde veille. Un
 * seul dossier attend un humain. » —, une ligne qui le nomme, et quatre états
 * discrets.
 *
 * Règles (ACCUEILS.md) : quand aucun dossier n'attend, la phrase devient
 * « La Garde veille. Rien n'attend un humain. » et l'écran n'a pas d'ambre.
 * L'ambre : le nombre dans la phrase, en encre ambre.
 */
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Silence() {
  const q = useQG();
  const { sites } = useRemoteSites();
  const pile = q.accueil?.pile;
  const n = pile?.compte.dossiers ?? 0;
  const premier = pile?.dossiers[0] ?? null;
  const agents = q.salle?.agents ?? [];
  const enRonde = agents.filter((a) => a.etat === 'ronde').length;
  const tombes = sites.filter((s) => s.status === 'offline').length;
  const heureTour = q.salle?.reglages.heureTour ?? 8;
  const releveFaite = Boolean(q.accueil?.releve);

  const nombre = n === 1 ? 'Un seul' : majuscule(enLettres(n));
  const etats: [string, string][] = [
    ['bg-text-primary', `${agents.filter((a) => a.actif).length} gardes en veille`],
    ['bg-text-primary', enRonde === 0 ? 'aucune en ronde' : `${enRonde} en ronde`],
    [tombes ? 'bg-text-muted' : 'bg-[#4a4a48]', tombes === 0 ? 'tous les sites répondent' : tombes === 1 ? '1 site sans réponse' : `${tombes} sites sans réponse`],
    ['bg-[#4a4a48]', releveFaite ? `Relève demain ${String(heureTour).padStart(2, '0')}:00` : `Relève à ${String(heureTour).padStart(2, '0')}:00`],
  ];

  return (
    <SiGardeLue q={q}>
      <div className="flex flex-col gap-6">
        <EnTeteQG q={q} nom="Le silence" />
        <section className="panel-raised panel-raised-wide flex min-h-[430px] flex-col items-center justify-center px-5 py-10 text-center sm:px-10">
          <p className="max-w-[20ch] text-[32px] font-bold leading-[1.08] tracking-[-0.04em] text-text-primary [text-wrap:balance] sm:text-[48px]">
            La Garde veille.{' '}
            {n === 0 ? (
              'Rien n’attend un humain.'
            ) : (
              <>
                <span data-signal-groupe="nombre" className="text-signal">
                  {nombre}
                </span>{' '}
                dossier{n > 1 ? 's attendent' : ' attend'} un humain.
              </>
            )}
          </p>
          {premier && (
            <p className="mt-[18px] text-[16px] text-text-secondary">
              {premier.orgNom && !premier.titre.includes(premier.orgNom) ? `${premier.orgNom}, ` : ''}
              {premier.orgNom && !premier.titre.includes(premier.orgNom) ? premier.titre.replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase()) : premier.titre.replace(/\.$/, '')}
              {n > 1 ? ' — en tête.' : '.'}
            </p>
          )}
          <div className="mt-11 flex flex-wrap justify-center gap-x-[34px] gap-y-3">
            {etats.map(([teinte, texte]) => (
              <span key={texte} className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${teinte}`} />
                <span className="text-[13px] text-text-secondary">{texte}</span>
              </span>
            ))}
          </div>
        </section>
      </div>
    </SiGardeLue>
  );
}
