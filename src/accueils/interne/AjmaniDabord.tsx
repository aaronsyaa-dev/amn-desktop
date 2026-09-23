import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { garde } from '../../lib/garde';
import { useLangue } from '../../i18n';
import type { GardeGeste } from '../../shared/garde';
import { EnTeteQG, SiGardeLue } from './communs';
import { hhmm, useQG } from './qg';

/**
 * I6 · AJMANI D'ABORD (`42f`).
 *
 * La proposition d'Ajmani, seule, en 34 px, précédée de sa plaque de gravité,
 * avec ses gestes en dessous et ses trois suites en pied.
 *
 * Règles (ACCUEILS.md) : la proposition est celle que la Garde produit de
 * façon DÉTERMINISTE (`/garde/ajmani`) — aucune reformulation par un modèle,
 * le texte est affiché tel quel. Si Ajmani a épuisé ses paroles du jour,
 * l'Accueil affiche sa dernière proposition avec la mention « dite à 11:40 ».
 * L'ambre : la plaque de gravité ; la phrase reste en encre claire.
 */
export function AjmaniDabord() {
  const q = useQG();
  const { t } = useLangue();
  const navigate = useNavigate();
  const [occupe, setOccupe] = useState(false);
  const [reponse, setReponse] = useState<string | null>(null);
  const [suites, setSuites] = useState<string[]>([]);
  const a = q.accueil;
  const p = a?.proposition ?? null;
  const dossier = p?.dossier ? a?.pile.dossiers.find((d) => d.id === p.dossier) ?? null : null;
  const gravite = p?.cle === 'critique' ? 'critique' : dossier?.gravite ?? null;
  /* La plaque est ambre quand la proposition porte sur un dossier à décider ; un tour ou un réglage reste en encre claire. */
  const ambre = gravite !== null && (p?.cle === 'critique' || p?.cle === 'pile');
  const plaque = gravite ? gravite.toUpperCase() : p?.cle === 'tour' ? 'TOUR' : p?.cle === 'apprentissage' ? 'RÉGLAGE' : 'RIEN';
  const epuise = a ? a.budget.dites >= a.budget.max : false;
  const derniere = a?.messages.filter((m) => m.canal === 'ajmani').sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0] ?? null;

  const dire = async (texte: string) => {
    setOccupe(true);
    try {
      const r = await garde.ordre(texte);
      setReponse(r.question ?? r.reponse);
      setSuites(r.suites ?? []);
      await q.recharger();
    } catch (e) {
      setReponse(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  };
  const geste = async (g: GardeGeste) => {
    if (g.vers) return navigate(g.vers);
    if (g.dossier && g.decision) {
      setOccupe(true);
      try {
        await garde.deciderDossier(g.dossier, g.decision);
        await q.recharger();
      } finally {
        setOccupe(false);
      }
      return;
    }
    if (g.ordre) await dire(g.ordre);
  };
  const lesSuites = (suites.length ? suites : [t('garde.chef.suite.pouls'), t('garde.chef.suite.attend'), t('garde.chef.suite.tour')]).slice(0, 3);

  return (
    <SiGardeLue q={q}>
      <div className="flex flex-col gap-6">
        <EnTeteQG q={q} nom="Ajmani d’abord" />
        <section className="panel-raised panel-raised-wide px-5 pb-[34px] pt-10 sm:px-11">
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#333] bg-[#1e1e1e] font-mono text-[11px] font-semibold text-text-secondary">AJ</span>
            <span className="text-[14px] font-semibold text-text-body">Ajmani</span>
            {a && (
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                · {a.budget.dites} parole{a.budget.dites > 1 ? 's' : ''} sur {a.budget.max} dite{a.budget.dites > 1 ? 's' : ''} aujourd’hui
              </span>
            )}
          </span>
          <div className="mt-[26px] flex flex-col items-start gap-[18px] sm:flex-row">
            <span
              data-signal-groupe={ambre ? 'gravite' : undefined}
              className={`mt-2 flex-none px-2.5 py-[5px] font-mono text-[10px] font-bold tracking-[0.18em] ${
                ambre ? 'bg-signal text-signal-ink shadow-[0_0_30px_-7px_rgba(208,154,74,.85)]' : 'border border-border-strong text-text-body'
              }`}
            >
              {plaque}
            </span>
            <div className="min-w-0">
              <p className="max-w-[30ch] text-[26px] font-bold leading-[1.22] tracking-[-0.03em] text-text-primary [text-wrap:pretty] sm:text-[34px]">{p?.texte ?? 'Ajmani n’a rien à proposer.'}</p>
              {epuise && derniere && <p className="mt-2 font-mono text-[11px] text-text-muted">dite à {hhmm(new Date(derniere.createdAt))}</p>}
              {p && p.gestes.length > 0 && (
                <div className="mt-[26px] flex flex-wrap gap-[9px]">
                  {p.gestes.map((g, i) => (
                    <button
                      key={g.label}
                      type="button"
                      disabled={occupe}
                      onClick={() => void geste(g)}
                      className={`flex min-h-11 items-center px-[13px] text-[12.5px] font-semibold disabled:opacity-50 sm:min-h-[30px] ${
                        i === 0 ? 'bg-text-primary text-[#0a0a0a] shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)]' : 'border border-border-strong text-text-body'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              )}
              {reponse && <p className="mt-5 max-w-[62ch] border-l border-border-strong pl-3 text-[14px] leading-relaxed text-text-secondary">{reponse}</p>}
            </div>
          </div>
          <div className="mt-[34px] border-t border-border-raised pt-[22px]">
            <span className="block font-mono text-[9.5px] tracking-[0.14em] text-text-muted">SES TROIS SUITES</span>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              {lesSuites.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={occupe}
                  onClick={() => void dire(s)}
                  className="border border-[#2b2b2b] bg-[#151515] px-4 py-3.5 text-left text-[14px] font-semibold text-text-body hover:border-border-strong disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </SiGardeLue>
  );
}
