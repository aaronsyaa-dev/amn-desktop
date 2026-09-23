import React from 'react';
import { Link } from 'react-router-dom';
import { SILENCE_DEFAUT, retardDeRonde } from '../../lib/garde';
import { EnTeteQG, SiGardeLue } from './communs';
import { hhmm, nombre, useQG } from './qg';

/**
 * I1 · LA RELÈVE (`42a`).
 *
 * Le bulletin du matin en dépêche : l'en-tête (« LA RELÈVE · 07:00 », les
 * rondes et la fenêtre de nuit), une phrase-titre de 38 px, cinq relevés de
 * nuit, puis les faits du bulletin en bandes, la ligne critique en tête.
 *
 * Règles (ACCUEILS.md) : le bulletin est celui du jour ; après 19:00,
 * l'Accueil affiche « prochaine Relève demain 07:00 » au-dessus. S'il n'y a
 * pas de critique, la bande de tête est en encre claire et l'écran n'a pas
 * d'ambre. L'ambre : la ligne critique, rien d'autre.
 */
const SOIR_H = 19;
const deuxChiffres = (h: number) => `${String(h).padStart(2, '0')}:00`;

export function Releve() {
  const q = useQG();
  const a = q.accueil;
  const releve = a?.releve ?? null;
  const heureTour = q.salle?.reglages.heureTour ?? 8;
  const silence = q.salle?.reglages.silence ?? SILENCE_DEFAUT;
  const dossiers = a?.pile.dossiers ?? [];
  const critiques = dossiers.filter((d) => d.gravite === 'critique');
  const autres = dossiers.filter((d) => d.gravite !== 'critique');
  const tete = critiques[0] ?? null;
  const t = q.maintenant.getTime();

  const releves: [string, string][] = [
    ['RONDES', a?.cloture ? nombre(a.cloture.rondesNuit) : '—'],
    ['RÉGLÉ SEUL', releve ? nombre(releve.totaux.regles) : '—'],
    ['REMONTÉES', releve ? nombre(releve.totaux.remontes) : '—'],
    ['SITES TOMBÉS', nombre(dossiers.filter((d) => d.famille === 'site-tombe').reduce((s, d) => s + d.n, 0))],
    ['HORS HORAIRES', nombre((q.salle?.agents ?? []).filter((g) => retardDeRonde(g, t) !== null).length)],
  ];

  const bandes = [
    ...critiques.slice(1).map((d) => ({ cle: d.id, texte: d.titre, critique: true })),
    ...autres.slice(0, Math.max(0, 3 - critiques.slice(1).length)).map((d) => ({ cle: d.id, texte: d.titre, critique: false })),
    ...(a && a.budget.retenues > 0 ? [{ cle: 'paroles', texte: a.budget.retenues === 1 ? 'Ajmani a gardé une parole pour vous.' : `Ajmani a gardé ${a.budget.retenues} paroles pour vous.`, critique: false }] : []),
  ];

  const titre = releve ? releve.texte.split(/(?<=\.)\s/)[0] : `La Relève de ${deuxChiffres(heureTour)} n’a pas encore eu lieu.`;

  return (
    <SiGardeLue q={q}>
      <div className="flex flex-col gap-6">
        <EnTeteQG q={q} nom="La Relève" />
        {q.maintenant.getHours() >= SOIR_H && (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">Prochaine Relève demain {deuxChiffres(heureTour)}</p>
        )}
        <section className="panel-raised panel-raised-wide px-5 py-[30px] sm:px-9">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#333] pb-3">
            <span className="font-mono text-[11px] font-bold tracking-[0.24em] text-text-body">LA RELÈVE · {releve ? hhmm(new Date(releve.at)) : deuxChiffres(heureTour)}</span>
            <span className="tnum font-mono text-[11px] tracking-[0.12em] text-text-muted">
              {a?.cloture ? `${nombre(a.cloture.rondesNuit)} RONDES · ` : ''}
              {silence.de} H → {String(silence.a).padStart(2, '0')} H
            </span>
          </div>
          <h2 className="mt-[22px] max-w-[26ch] text-[28px] font-bold leading-[1.1] tracking-[-0.03em] text-text-primary [text-wrap:balance] sm:text-[38px]">{titre}</h2>
          <div className="mt-[22px] grid grid-cols-2 gap-[18px] border-y border-border py-4 sm:grid-cols-5">
            {releves.map(([l, v]) => (
              <span key={l}>
                <span className="block font-mono text-[9.5px] tracking-[0.12em] text-text-muted">{l}</span>
                <span className="tnum mt-1.5 block whitespace-nowrap font-mono text-[19px] font-semibold tracking-[-0.03em] text-text-primary">{v}</span>
              </span>
            ))}
          </div>
          <div className="mt-5 flex flex-col gap-2">
            {tete ? (
              <div data-signal-groupe="critique" className="flex items-baseline gap-3.5 bg-signal px-4 py-[13px] shadow-[0_0_30px_-7px_rgba(208,154,74,.85)]">
                <span className="whitespace-nowrap font-mono text-[9.5px] font-bold tracking-[0.16em] text-[#3a2a0e]">CRITIQUE</span>
                <span className="text-[15px] font-semibold text-signal-ink">{tete.titre}</span>
              </div>
            ) : (
              <div className="border border-border-strong bg-[#171717] px-4 py-[13px] text-[15px] font-semibold text-text-primary">Aucun dossier critique.</div>
            )}
            {bandes.map((b) => (
              <div key={b.cle} className="flex items-baseline gap-3.5 border border-border bg-[#0f0f0f] px-4 py-[11px] text-[14px] text-text-body">
                {b.critique && <span className="whitespace-nowrap font-mono text-[9.5px] font-bold tracking-[0.16em] text-text-primary">CRITIQUE</span>}
                <span>{b.texte}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-[9px]">
            {tete && (
              <Link to="/garde/pile" className="flex min-h-11 items-center bg-text-primary px-[13px] text-[12.5px] font-semibold text-[#0a0a0a] shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)] sm:min-h-[30px]">
                Ouvrir le dossier {tete.orgNom ?? ''}
              </Link>
            )}
            <Link to="/garde/ajmani" className="flex min-h-11 items-center border border-border-strong px-[13px] text-[12.5px] font-semibold text-text-body sm:min-h-[30px]">
              Toute la Relève
            </Link>
          </div>
        </section>
      </div>
    </SiGardeLue>
  );
}
