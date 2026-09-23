import React from 'react';
import { Link } from 'react-router-dom';
import { EnTeteQG, SiGardeLue } from './communs';
import { useQG } from './qg';
import { colonnesCarte, dossierEnTete, ordreFixe, palierDe } from './parc';

/**
 * I2 · LA CARTE DES NEUF (`42b`).
 *
 * Les organisations en grille, À DES PLACES FIXES. Chaque case a un état en
 * trois paliers — calme, à suivre, critique — avec pastille, nom et phrase.
 *
 * Règles (ACCUEILS.md), dans `interne/parc` : l'ordre est fixé une fois par
 * ancienneté et ne se retrie jamais selon l'état ; au-delà de neuf, quatre
 * colonnes ; au-delà de seize, la variante est retirée du choix
 * (`useAccueilsDisponibles`). L'ambre : la case critique, en entier.
 */
export function CarteDesNeuf() {
  const q = useQG();
  const orgs = ordreFixe(q.organisations);
  const cols = colonnesCarte(orgs.length) ?? 4;
  const dossiers = q.accueil?.pile.dossiers ?? [];
  /* Une seule région ambre : la première case critique dans l'ordre fixe. */
  const premiereCritique = orgs.find((o) => palierDe(dossiers.filter((d) => d.orgId === o.id)) === 'critique')?.id ?? null;

  return (
    <SiGardeLue q={q}>
      <div className="flex flex-col gap-6">
        <EnTeteQG q={q} nom="La carte des neuf" />
        <section className="panel-raised panel-raised-wide px-4 py-[26px] sm:px-7">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="eyebrow text-text-secondary">{orgs.length === 9 ? 'Les neuf organisations' : `Les ${orgs.length} organisations`}</span>
            <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">PLACES FIXES · CALME / À SUIVRE / CRITIQUE</span>
          </div>
          <div className={`grid grid-cols-1 gap-2.5 sm:grid-cols-2 ${cols === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
            {orgs.map((o) => {
              const siens = dossiers.filter((d) => d.orgId === o.id);
              const palier = palierDe(siens);
              const tete = dossierEnTete(siens);
              const ambre = o.id === premiereCritique;
              const phrase = tete ? tete.titre : 'Tout est à jour.';
              return (
                <Link
                  key={o.id}
                  to="/garde/pile"
                  data-signal-groupe={ambre ? 'case' : undefined}
                  className={`flex min-h-[128px] min-w-0 flex-col px-[18px] py-4 ${
                    ambre
                      ? 'bg-signal shadow-[0_0_30px_-7px_rgba(208,154,74,.85)]'
                      : palier === 'critique'
                        ? 'border border-text-primary bg-[#1a1a1a]'
                        : palier === 'suivre'
                          ? 'border border-[#333] bg-[#1a1a1a]'
                          : 'border border-border bg-[#111]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`h-[7px] w-[7px] rounded-full ${ambre ? 'bg-signal-ink' : palier === 'calme' ? 'bg-border-strong' : 'bg-text-primary'}`} />
                    <span className={`font-mono text-[9.5px] font-semibold tracking-[0.12em] ${ambre ? 'text-[#3a2a0e]' : 'text-text-muted'}`}>
                      {palier === 'critique' ? 'CRITIQUE' : palier === 'suivre' ? 'À SUIVRE' : 'CALME'}
                    </span>
                  </span>
                  <span className={`mt-2.5 truncate text-[15px] font-bold tracking-[-0.01em] ${ambre ? 'text-signal-ink' : 'text-text-primary'}`}>{o.name}</span>
                  <span className={`mt-auto pt-2.5 text-[12.5px] leading-[1.45] [text-wrap:pretty] ${ambre ? 'text-[#3a2a0e]' : palier === 'calme' ? 'text-text-muted' : 'text-text-secondary'}`}>{phrase}</span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </SiGardeLue>
  );
}
