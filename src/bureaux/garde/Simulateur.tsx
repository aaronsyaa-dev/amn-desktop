import React, { useEffect, useState } from 'react';
import { garde } from '../../lib/garde';
import type { GardeAgent, GardeDefinitionAgent } from '../../shared/garde';
import { AMBRE } from '../jetons';
import { useGardeBureau } from '../donnees/gardeBureau';
import { Carte, Chargement, EnTete, Invitation } from '../ui/kit';

/**
 * LA GARDE · LE SIMULATEUR DE NUIT (cahier 15, `51c` · 15).
 *
 * Rejouer les nuits écoulées avec une règle changée, avant de l'appliquer.
 * Le serveur relit les traces du mois (`/v1/garde/etsi`) avec la valeur
 * proposée et dit ce que le mois aurait produit, contre ce qu'il a produit —
 * rien n'est modifié tant qu'on n'applique pas, et on n'applique qu'à
 * l'intérieur du couloir que la règle s'est fixé.
 *
 * L'ambre : le changement rejoué qui attend une décision — sa valeur sur la
 * glissière et son résultat, une seule région.
 */

type Fiche = { agent: GardeAgent; definition: Pick<GardeDefinitionAgent, 'role' | 'prises' | 'regles'> | null };
type Essai = { agent: string; regle: string; parametre: string; actuelle: number; valeur: number; resultat: { avant: number | null; apres: number | null; phrase?: string; note?: string; serieAvant?: number[]; serieApres?: number[] } | null; erreur: string | null };

export function GardeSimulateur() {
  const g = useGardeBureau();
  const [equipe, setEquipe] = useState<string | null>(null);
  const [fiches, setFiches] = useState<Fiche[] | null>(null);
  const [essai, setEssai] = useState<Essai | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [applique, setApplique] = useState<string | null>(null);
  const chef = g.chefs.find((c) => c.key === equipe) ?? g.chefs[0] ?? null;

  useEffect(() => {
    if (!chef) return;
    let vivant = true;
    setFiches(null);
    Promise.all(chef.agents.map((a) => garde.agent(a.key).catch(() => null)))
      .then((r) => vivant && setFiches(r.filter((x): x is NonNullable<typeof x> => x !== null).map((x) => ({ agent: x.agent, definition: x.definition }))))
      .catch(() => vivant && setFiches([]));
    return () => {
      vivant = false;
    };
  }, [chef?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const rejouer = async () => {
    if (!essai) return;
    setEnvoi(true);
    try {
      const r = await garde.etSi(essai.agent, essai.regle, essai.parametre, essai.valeur);
      setEssai({ ...essai, resultat: r, erreur: null });
    } catch (e) {
      setEssai({ ...essai, resultat: null, erreur: e instanceof Error ? e.message : 'La Garde n’a pas répondu.' });
    } finally {
      setEnvoi(false);
    }
  };
  const appliquer = async (f: Fiche) => {
    if (!essai) return;
    setEnvoi(true);
    try {
      const courant = (f.agent.parametres?.[essai.regle] as Record<string, unknown> | undefined) ?? {};
      await garde.majAgent(essai.agent, { parametres: { ...f.agent.parametres, [essai.regle]: { ...courant, [essai.parametre]: essai.valeur } } });
      setApplique(`${essai.regle} · ${essai.parametre} = ${essai.valeur}`);
      setEssai(null);
    } catch (e) {
      setEssai({ ...essai, erreur: e instanceof Error ? e.message : 'La règle n’a pas été changée.' });
    } finally {
      setEnvoi(false);
    }
  };

  if (!g.pret) {
    return (
      <>
        <EnTete surtitre="La Garde · Simulateur de nuit" titre="Les règles se relisent." />
        <Chargement texte="Lecture des chefs" />
      </>
    );
  }
  const change = essai && essai.resultat && essai.valeur !== essai.actuelle;
  const titre = change
    ? `Avec ${essai!.parametre.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()} à ${essai!.valeur}, le mois aurait donné ${essai!.resultat!.apres ?? '—'} au lieu de ${essai!.resultat!.avant ?? '—'}.`
    : 'Changer une règle sur les nuits écoulées, avant de l’appliquer.';

  return (
    <>
      <EnTete surtitre="La Garde · Les bureaux · Simulateur de nuit" titre={titre} />
      <nav className="mb-[18px] flex flex-wrap gap-1.5" aria-label="Les chefs">
        {g.chefs.map((c) => (
          <button key={c.key} type="button" aria-pressed={c.key === chef?.key} onClick={() => { setEquipe(c.key); setEssai(null); }} className="h-8 border px-3 text-[12.5px]" style={{ borderColor: c.key === chef?.key ? '#8a8a87' : '#262626', color: c.key === chef?.key ? '#f7f7f5' : '#a3a3a0' }}>
            {c.nom}
          </button>
        ))}
      </nav>
      {applique && <p className="mb-4 border border-[#262626] px-4 py-3 text-[13px] text-[#e4e4e1]">Appliqué : {applique}. La prochaine ronde s’en sert ; le journal le garde.</p>}
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_360px]">
        <Carte dominante pad="p-6" className="self-start" titre={`Les règles · ${chef?.titre ?? ''}`} droite="glissière = la valeur rejouée · trait = la valeur actuelle">
          {fiches === null ? (
            <Chargement texte="Lecture des règles" />
          ) : fiches.length === 0 ? (
            <Invitation titre="Aucune règle à rejouer." texte="Ce chef n’a pas de garde dont une règle se rejoue sur le mois écoulé." />
          ) : (
            fiches.map((f) => {
              const regles = Object.entries(f.definition?.regles ?? {}).filter(([, r]) => r.rejouable);
              if (!regles.length) return null;
              return (
                <div key={f.agent.key} className="border-b border-[#1d1d1d] py-4">
                  <span className="block text-[14px] font-semibold text-[#f7f7f5]">{f.agent.nom}</span>
                  <span className="block text-[12px] text-[#a3a3a0]">{f.agent.role}</span>
                  {regles.map(([cle, r]) => {
                    const valeurs = { ...(r.parametres as Record<string, unknown>), ...((f.agent.parametres?.[cle] as Record<string, unknown> | undefined) ?? {}) };
                    return Object.entries(valeurs)
                      .filter(([, v]) => typeof v === 'number')
                      .map(([p, v]) => {
                        const actuelle = v as number;
                        const couloir = f.agent.couloir?.[cle]?.[p] ?? { min: Math.max(0, Math.round(actuelle / 4)), max: Math.max(1, actuelle * 3) };
                        const ici = essai?.agent === f.agent.key && essai.regle === cle && essai.parametre === p;
                        const valeur = ici ? essai!.valeur : actuelle;
                        const pos = (x: number) => ((x - couloir.min) / Math.max(1, couloir.max - couloir.min)) * 100;
                        const estAmbre = ici && Boolean(essai?.resultat) && valeur !== actuelle;
                        return (
                          <div key={`${cle}:${p}`} className="mt-3" data-signal-groupe={estAmbre ? 'simulateur-ambre' : undefined}>
                            <span className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="text-[12.5px] text-[#e4e4e1]">{r.description}</span>
                              <span className="font-mono text-[10.5px] text-[#9a9a97]">
                                {p} : {actuelle}
                                {ici && valeur !== actuelle ? <span style={{ color: estAmbre ? AMBRE : '#f7f7f5' }}> → {valeur}</span> : null}
                              </span>
                            </span>
                            <span className="relative mt-2 block">
                              <input
                                type="range"
                                min={couloir.min}
                                max={couloir.max}
                                step={actuelle >= 100 ? Math.max(1, Math.round((couloir.max - couloir.min) / 50)) : 1}
                                value={valeur}
                                onChange={(e) => setEssai({ agent: f.agent.key, regle: cle, parametre: p, actuelle, valeur: Number(e.target.value), resultat: null, erreur: null })}
                                aria-label={`${r.description} : ${p}`}
                                className="w-full"
                                style={{ accentColor: estAmbre ? AMBRE : '#8a8a87' }}
                              />
                              <span aria-hidden className="pointer-events-none absolute top-0 h-full w-px bg-[#f7f7f5]" style={{ left: `${pos(actuelle)}%` }} />
                            </span>
                          </div>
                        );
                      });
                  })}
                </div>
              );
            })
          )}
        </Carte>
        <Carte className="self-start" titre="Le rejeu" droite="le mois écoulé, nuit par nuit">
          {!essai ? (
            <p className="text-[13px] leading-relaxed text-[#a3a3a0]">Déplacez une glissière, puis rejouez : la Garde relit ses traces du mois avec cette valeur. Rien ne change tant qu’on n’applique pas.</p>
          ) : (
            <div data-signal-groupe={essai.resultat && essai.valeur !== essai.actuelle ? 'simulateur-ambre' : undefined} style={essai.resultat && essai.valeur !== essai.actuelle ? { borderLeft: `2px solid ${AMBRE}`, paddingLeft: 12 } : undefined}>
              <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-[#9a9a97]">
                {essai.regle} · {essai.parametre} : {essai.actuelle} → {essai.valeur}
              </span>
              {essai.resultat ? (
                <>
                  <p className="mt-2 text-[15px] font-semibold text-[#f7f7f5]">
                    {essai.resultat.avant ?? '—'} → {essai.resultat.apres ?? '—'}
                  </p>
                  {(essai.resultat.phrase || essai.resultat.note) && <p className="mt-1 text-[12.5px] leading-relaxed text-[#a3a3a0]">{essai.resultat.phrase ?? essai.resultat.note}</p>}
                  {essai.resultat.serieAvant && essai.resultat.serieApres && (
                    <div className="mt-3 flex h-[60px] items-end gap-[2px]" aria-hidden>
                      {essai.resultat.serieAvant.map((v, i) => {
                        const w = essai.resultat!.serieApres![i] ?? 0;
                        const max = Math.max(1, ...essai.resultat!.serieAvant!, ...essai.resultat!.serieApres!);
                        return (
                          <span key={i} className="flex h-full min-w-0 flex-1 items-end gap-px">
                            <span className="min-w-0 flex-1 bg-[#4a4a48]" style={{ height: `${(v / max) * 100}%` }} />
                            <span className="min-w-0 flex-1 bg-[#e4e4e1]" style={{ height: `${(w / max) * 100}%` }} />
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {essai.valeur !== essai.actuelle && (
                    <div className="mt-4 flex gap-2.5">
                      <button type="button" className="bx-btn" disabled={envoi} onClick={() => { const f = fiches?.find((x) => x.agent.key === essai.agent); if (f) void appliquer(f); }}>
                        Appliquer
                      </button>
                      <button type="button" className="bx-btn2" onClick={() => setEssai(null)}>
                        Laisser la règle
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <button type="button" className="bx-btn2 mt-3" disabled={envoi} onClick={() => void rejouer()}>
                  Rejouer le mois
                </button>
              )}
              {essai.erreur && <p className="mt-2 text-[12.5px] text-[#e4e4e1]">{essai.erreur}</p>}
            </div>
          )}
        </Carte>
      </div>
    </>
  );
}
