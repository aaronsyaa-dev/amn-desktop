import React, { useEffect, useState } from 'react';
import { garde } from '../../lib/garde';
import type { GardeCompte, GardeJeton } from '../../shared/garde';
import { enLettres } from '../lettres';
import { EnTeteQG, SiGardeLue } from './communs';
import { useQG } from './qg';
import { HORIZON, jourDHorizon, pileEnAmbre } from './parc';

/**
 * I8 · L'HORIZON DES EXPIRATIONS (`42h`).
 *
 * Les trente prochains jours sur une ligne, et au-dessus de chaque jour,
 * empilé, ce qui arrive à échéance : certificats en blanc, fins d'essai en
 * gris, renouvellements en sombre.
 *
 * Ce que l'espace sait vraiment : les certificats (`validTo` des contrôles
 * SSL), les renouvellements (échéances de règlement de la Garde des
 * Comptes). Le produit n'a pas de période d'essai ; ce qui en tient lieu est
 * le jeton d'activation émis et pas encore utilisé, qui expire : c'est lui
 * que le gris montre, sous son vrai nom.
 *
 * Règles (ACCUEILS.md), dans `interne/parc` : seule une pile d'au moins deux
 * échéances à moins de sept jours peut porter l'ambre ; les marques font
 * 12 px de haut, sans échelle — c'est le nombre qu'on compte.
 */
type Nature = 'certificat' | 'jeton' | 'renouvellement';
interface Echeance {
  nature: Nature;
  quoi: string;
  emetteur?: string | null;
  jour: number;
}
const TEINTE: Record<Nature, string> = { certificat: 'bg-text-body', jeton: 'bg-[#4a4a48]', renouvellement: 'bg-[#2b2b2b]' };
const JOURS = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
const JOURS_LONGS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export function Horizon() {
  const q = useQG(300_000);
  const [comptes, setComptes] = useState<GardeCompte[]>([]);
  const [jetons, setJetons] = useState<GardeJeton[]>([]);
  useEffect(() => {
    let vivant = true;
    void garde.comptes().then((c) => vivant && setComptes(c)).catch(() => undefined);
    void garde.jetons('emis').then((j) => vivant && setJetons(j)).catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, []);

  const m = q.maintenant;
  const echeances: Echeance[] = [];
  for (const s of q.ssl) {
    const j = s.validTo ? jourDHorizon(Date.parse(s.validTo), m) : null;
    if (j !== null) echeances.push({ nature: 'certificat', quoi: s.site?.name ?? s.host, emetteur: s.issuer, jour: j });
  }
  for (const t of jetons) {
    const j = jourDHorizon(Date.parse(t.expiresAt), m);
    if (j !== null) echeances.push({ nature: 'jeton', quoi: t.note || t.module || t.formule || 'jeton', jour: j });
  }
  for (const c of comptes) {
    const j = c.echeanceAt ? jourDHorizon(Date.parse(c.echeanceAt), m) : null;
    if (j !== null) echeances.push({ nature: 'renouvellement', quoi: c.orgName ?? 'une organisation', jour: j });
  }
  const ORDRE: Nature[] = ['certificat', 'jeton', 'renouvellement'];
  const parJour = Array.from({ length: HORIZON.jours }, (_, j) => echeances.filter((e) => e.jour === j).sort((a, b) => ORDRE.indexOf(a.nature) - ORDRE.indexOf(b.nature)));
  const ambre = pileEnAmbre(parJour.map((p) => p.length));
  const hauteur = Math.max(4, ...parJour.map((p) => p.length)) * (HORIZON.hauteurMarque + 3) + 12;
  const dateDe = (j: number) => {
    const d = new Date(m);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + j);
    return d;
  };
  const etiquette = (j: number) => {
    const d = dateDe(j);
    return j === 0 || j === HORIZON.jours - 1 || j === ambre || d.getDate() === 1 ? `${JOURS[d.getDay()]} ${d.getDate()}` : '';
  };

  const certs = echeances.filter((e) => e.nature === 'certificat');
  const phrase = (() => {
    if (ambre === null) return echeances.length ? 'Aucune grappe à moins de sept jours : rien ne s’accumule.' : 'Rien n’arrive à échéance dans les trente prochains jours.';
    const pile = parJour[ambre];
    const d = dateDe(ambre);
    const noms = pile.map((e) => e.quoi);
    const liste = noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}` : noms[0];
    const memeEmetteur = pile.every((e) => e.nature === 'certificat') && pile[0].emetteur && pile.every((e) => e.emetteur === pile[0].emetteur);
    return `${JOURS_LONGS[d.getDay()]} ${d.getDate()} : ${liste}${memeEmetteur ? `, ${pile.length === 2 ? 'tous deux' : pile.length === 3 ? 'tous trois' : 'tous'} chez le même émetteur (${pile[0].emetteur}). Un seul renouvellement groupé suffit.` : '.'}`;
  })();

  return (
    <SiGardeLue q={q}>
      <div className="flex flex-col gap-6">
        <EnTeteQG q={q} nom="L’horizon des expirations" />
        <section className="panel-raised panel-raised-wide px-4 pb-6 pt-7 sm:px-[30px]">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="eyebrow text-text-secondary">Les trente prochains jours</span>
            <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">BLANC = CERTIFICAT · GRIS = JETON QUI EXPIRE · SOMBRE = RENOUVELLEMENT</span>
          </div>
          <div className="flex items-end gap-[3px] border-b border-[#333] pb-1.5 sm:gap-1" style={{ height: hauteur }}>
            {parJour.map((pile, j) => (
              <span key={j} className="flex min-w-0 flex-1 flex-col-reverse items-center gap-[3px]" data-signal-groupe={j === ambre ? 'pile' : undefined}>
                {pile.map((e, k) => (
                  <span
                    key={k}
                    title={e.quoi}
                    className={`h-3 w-full max-w-[18px] ${j === ambre ? 'bg-signal shadow-[0_0_14px_-2px_rgba(208,154,74,.8)]' : TEINTE[e.nature]}`}
                  />
                ))}
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-[3px] sm:gap-1">
            {parJour.map((_, j) => (
              <span
                key={j}
                data-signal-groupe={j === ambre ? 'pile' : undefined}
                className={`min-w-0 flex-1 overflow-visible whitespace-nowrap text-center font-mono text-[9px] tracking-[0.04em] ${j === ambre ? 'font-bold text-signal' : 'text-text-muted'}`}
              >
                {etiquette(j)}
              </span>
            ))}
          </div>
          <div className="mt-[22px] grid grid-cols-1 gap-[22px] border-t border-border-raised pt-[18px] sm:grid-cols-3">
            {[
              ['CERTIFICATS SOUS 30 J', `${certs.length}${certs.length ? ` · ${new Set(certs.map((c) => c.quoi)).size === 1 ? 'un site' : `${enLettres(new Set(certs.map((c) => c.quoi)).size)} sites`}` : ''}`],
              ['JETONS QUI EXPIRENT', String(echeances.filter((e) => e.nature === 'jeton').length)],
              ['RENOUVELLEMENTS', String(echeances.filter((e) => e.nature === 'renouvellement').length)],
            ].map(([l, v]) => (
              <span key={l}>
                <span className="block font-mono text-[9.5px] tracking-[0.12em] text-text-muted">{l}</span>
                <span className="tnum mt-1.5 block font-mono text-[19px] font-semibold tracking-[-0.03em] text-text-primary">{v}</span>
              </span>
            ))}
          </div>
          <p className="mt-4 text-[13.5px] leading-[1.6] text-text-secondary [text-wrap:pretty]">{phrase}</p>
        </section>
      </div>
    </SiGardeLue>
  );
}
