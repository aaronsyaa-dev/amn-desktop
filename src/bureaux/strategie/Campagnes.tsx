import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { uid } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import { ETAPES_CAMPAGNE, useStrategie, type CampagneId } from '../donnees/strategie';
import type { Campagne } from '../donnees/types';
import { Carte, EnTete, Invitation } from '../ui/kit';
import { enLettresF } from '../format';
import { champ, jjmm, jourMoisAbrege, useEcrire } from './commun';

/**
 * STRATÉGIE · LES CAMPAGNES, DE L'IDÉE AUX RÉSULTATS (cahier 14, `49a`).
 *
 * Cinq colonnes, l'avancée d'une campagne de gauche à droite ; chaque
 * campagne est une fiche de papier, comme sur le mur de l'accueil. Une
 * campagne publiée porte sa courbe ; une campagne close, ce qu'elle a
 * rapporté.
 *
 * L'ambre : la campagne bloquée — la plus anciennement bloquée s'il y en a
 * plusieurs ; les autres restent au papier, avec leur raison à l'encre.
 */

export function StrategieCampagnes() {
  const m = useStrategie();
  const { hash } = useLocation();
  const { user } = useAuth();
  const ecrire = useEcrire<Campagne>('campagnes');
  const [choisie, setChoisie] = useState<string | null>(() => hash.replace(/^#/, '') || null);
  const [idee, setIdee] = useState<string | null>(null);
  const campagnes = [...m.campagnes].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  const bloquees = campagnes.filter((c) => c.bloquee && c.etape !== 'close');
  const n = campagnes.length;
  const c = campagnes.find((x) => x.id === choisie) ?? null;

  useEffect(() => {
    const id = hash.replace(/^#/, '');
    if (!id) return;
    setChoisie(id);
    requestAnimationFrame(() => document.getElementById(`campagne-${id}`)?.scrollIntoView({ block: 'center' }));
  }, [hash]);

  const titre = n === 0 ? 'Aucune campagne encore.' : `${enLettresF(n, true)} campagne${n > 1 ? 's' : ''}. ${bloquees.length === 0 ? 'Aucune n’est bloquée.' : bloquees.length === 1 ? 'Une est bloquée.' : `${enLettresF(bloquees.length, true)} sont bloquées.`}`;

  const noterIdee = () => {
    if (!idee?.trim()) return;
    const id = `camp-${uid()}`;
    ecrire(id, () => ({ titre: idee.trim(), etape: 'idee', creePar: user?.email ?? '', at: new Date().toISOString() }));
    setIdee(null);
    setChoisie(id);
  };

  return (
    <>
      <EnTete
        surtitre="Stratégie · Campagnes"
        titre={titre}
        actions={
          <button type="button" className="bx-btn2" onClick={() => setIdee('')}>
            Noter une idée
          </button>
        }
      />
      {idee !== null && (
        <Carte pad="p-5" className="mb-[18px]" titre="Une idée de campagne" droite="elle entre dans la colonne Idée">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              noterIdee();
            }}
          >
            <input autoFocus value={idee} onChange={(e) => setIdee(e.target.value)} placeholder="« Portes ouvertes du printemps »" aria-label="L’idée" className={`${champ} h-9 min-w-0 flex-1`} />
            <button type="submit" className="bx-btn" disabled={!idee.trim()}>
              Noter
            </button>
            <button type="button" className="bx-btn2" onClick={() => setIdee(null)}>
              Annuler
            </button>
          </form>
        </Carte>
      )}
      {n === 0 ? (
        <Invitation titre="Aucune campagne sur le mur." texte="Une campagne part d’une idée, passe par un scénario et une production, puis se publie et rapporte. Chaque étape est une colonne." />
      ) : (
        <Carte dominante pad="p-6" titre={`Les campagnes · ${n}`} droite="de l’idée aux résultats">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {ETAPES_CAMPAGNE.map((e) => {
              const liste = campagnes.filter((x) => x.etape === e.cle);
              return (
                <section key={e.cle} aria-label={e.nom} className="min-w-0">
                  <div className="mb-3 flex items-baseline justify-between border-b border-[#28282c] pb-2">
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-text-secondary">{e.nom}</span>
                    <span className="font-mono text-[10px] tabular-nums text-text-muted">{liste.length || ''}</span>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {liste.map((x) => (
                      <Fiche key={x.id} c={x} ambre={bloquees[0]?.id === x.id} choisie={choisie === x.id} onChoisir={() => setChoisie(choisie === x.id ? null : x.id)} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </Carte>
      )}
      {c && <Detail c={c} ecrire={ecrire} prospects={m.prospects.map((p) => ({ id: p.id, nom: p.company || p.name }))} onFermer={() => setChoisie(null)} />}
    </>
  );
}

/** Ce que dit la fiche sous son titre, selon l'étape. */
function ligne(c: CampagneId): string {
  const plans = c.plans?.length ?? 0;
  if (c.etape === 'idee') return c.resultat || (c.at ? `idée notée le ${jjmm(c.at)}` : 'idée');
  if (c.etape === 'scenario') return plans ? `storyboard en cours, ${plans} plan${plans > 1 ? 's' : ''}` : c.resultat || 'à scénariser';
  if (c.etape === 'production') return c.programmeeLe ? `sortie le ${jourMoisAbrege(c.programmeeLe)}` : c.resultat || 'en production';
  if (c.etape === 'publiee') return c.resultat || (c.publieeLe ? `publiée le ${jjmm(c.publieeLe)}` : 'publiée');
  return c.rapporte ? `clôturée · ${c.rapporte}` : c.resultat || 'clôturée';
}

function Fiche({ c, ambre, choisie, onChoisir }: { c: CampagneId; ambre: boolean; choisie: boolean; onChoisir: () => void }) {
  const courbe = c.etape === 'publiee' && (c.courbe?.length ?? 0) > 1 ? c.courbe! : null;
  if (ambre && c.bloquee) {
    return (
      <button
        id={`campagne-${c.id}`}
        type="button"
        onClick={onChoisir}
        aria-pressed={choisie}
        className="block w-full px-3.5 pb-3.5 pt-3 text-left"
        style={{ background: '#1d1810', border: `1px solid ${AMBRE}`, boxShadow: '0 0 30px -10px rgba(208,154,74,.55)', outline: choisie ? '2px solid var(--color-text-primary)' : undefined, outlineOffset: 2 }}
        data-signal-groupe="campagne-bloquee"
      >
        <span className="block text-[13.5px] font-semibold leading-snug text-text-primary">{c.titre}</span>
        <span className="mt-2.5 block font-mono text-[10px] font-bold uppercase leading-[1.5] tracking-[0.1em]" style={{ color: AMBRE }}>
          {c.bloquee.raison}
          {c.programmeeLe ? ` · sortie le ${jourMoisAbrege(c.programmeeLe)}` : ''}
        </span>
      </button>
    );
  }
  return (
    <button id={`campagne-${c.id}`} type="button" onClick={onChoisir} aria-pressed={choisie} className="bx-papier block w-full px-3.5 pb-3.5 pt-3 text-left" style={{ outline: choisie ? '2px solid var(--color-text-primary)' : undefined, outlineOffset: 2 }}>
      <span className="block text-[13.5px] font-semibold leading-snug text-[#111]">{c.titre}</span>
      <span className="mt-1.5 block text-[11.5px] leading-snug text-[#3a3a38]">{ligne(c)}</span>
      {c.bloquee && <span className="mt-1.5 block font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#3a3a38]">bloquée : {c.bloquee.raison}</span>}
      {courbe && (
        <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="mt-2.5 block h-[22px] w-full" aria-label={`Sa courbe, semaine après semaine : ${courbe.join(', ')}`} role="img">
          <path d={courbe.map((v, i) => `${i ? 'L' : 'M'}${6 + (i / (courbe.length - 1)) * 88} ${21 - (v / Math.max(...courbe, 1)) * 18}`).join(' ')} fill="none" stroke="#111" strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </button>
  );
}

function Detail({ c, ecrire, prospects, onFermer }: { c: CampagneId; ecrire: ReturnType<typeof useEcrire<Campagne>>; prospects: { id: string; nom: string }[]; onFermer: () => void }) {
  const [raison, setRaison] = useState('');
  const i = ETAPES_CAMPAGNE.findIndex((e) => e.cle === c.etape);
  const avant = ETAPES_CAMPAGNE[i - 1] ?? null;
  const apres = ETAPES_CAMPAGNE[i + 1] ?? null;
  const maj = (patch: Partial<Campagne>) => ecrire(c.id, () => patch);
  const passer = (etape: Campagne['etape']) =>
    maj({ etape, ...(etape === 'publiee' && !c.publieeLe ? { publieeLe: new Date().toISOString() } : {}), ...(etape === 'close' || etape === 'publiee' ? { bloquee: null } : {}) });

  return (
    <Carte pad="p-6" className="mt-[18px]" titre={`La campagne · ${c.titre}`} droite={<button type="button" onClick={onFermer} className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-secondary hover:text-text-primary">Fermer</button>}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {avant && (
              <button type="button" className="bx-btn2" onClick={() => passer(avant.cle)}>
                ← {avant.nom}
              </button>
            )}
            {apres && (
              <button type="button" className="bx-btn" onClick={() => passer(apres.cle)}>
                Passer à « {apres.nom} » →
              </button>
            )}
            {(c.plans?.length || c.etape === 'scenario' || c.etape === 'production') && (
              <Link to={`/strategie/storyboards?c=${c.id}`} className="bx-btn2">
                Le storyboard
              </Link>
            )}
          </div>
          <label className="block">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">{c.etape === 'close' ? 'Ce qu’elle a rapporté' : 'Sa ligne sur la fiche'}</span>
            <input
              key={`${c.id}-${c.etape}`}
              defaultValue={(c.etape === 'close' ? c.rapporte : c.resultat) ?? ''}
              onBlur={(e) => maj(c.etape === 'close' ? { rapporte: e.target.value.trim() || null } : { resultat: e.target.value.trim() || null })}
              placeholder={c.etape === 'close' ? '« 2 rendez-vous, 1 devis signé »' : '« 3 visuels, 2 vidéos »'}
              className={`${champ} mt-1.5 h-9 w-full`}
            />
          </label>
          <label className="block">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">Sortie prévue</span>
            <input type="date" key={`${c.id}-sortie`} defaultValue={c.programmeeLe?.slice(0, 10) ?? ''} onBlur={(e) => maj({ programmeeLe: e.target.value ? `${e.target.value}T09:00:00` : null })} className={`${champ} mt-1.5 h-9 w-[200px] [color-scheme:dark]`} />
          </label>
        </div>
        <div className="flex flex-col gap-3">
          {c.bloquee ? (
            <div className="border border-[#28282c] p-3.5">
              <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">Bloquée depuis le {jjmm(c.bloquee.depuis)}</span>
              <span className="mt-1.5 block text-[13.5px] text-text-primary">{c.bloquee.raison}</span>
              <button type="button" className="bx-lien mt-2.5" onClick={() => maj({ bloquee: null })}>
                Ce n’est plus bloqué
              </button>
            </div>
          ) : (
            c.etape !== 'close' && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!raison.trim()) return;
                  maj({ bloquee: { raison: raison.trim(), depuis: new Date().toISOString() } });
                  setRaison('');
                }}
              >
                <input value={raison} onChange={(e) => setRaison(e.target.value)} placeholder="Ce qui la bloque, s’il y a quelque chose…" aria-label="Ce qui bloque" className={`${champ} h-9 min-w-0 flex-1`} />
                <button type="submit" className="bx-btn2" disabled={!raison.trim()}>
                  Bloquer
                </button>
              </form>
            )
          )}
          <div>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">Les prospects qu’elle vise · un fil sur le mur</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(c.prospects ?? []).map((id) => (
                <button key={id} type="button" onClick={() => maj({ prospects: (c.prospects ?? []).filter((x) => x !== id) })} className="border border-[#3a3a40] px-2 py-1 text-[12px] text-text-body" title="Retirer ce fil">
                  {prospects.find((p) => p.id === id)?.nom ?? id} ×
                </button>
              ))}
              <select value="" onChange={(e) => e.target.value && maj({ prospects: [...(c.prospects ?? []), e.target.value] })} aria-label="Viser un prospect" className="h-8 border border-[#28282c] bg-[#141416] px-2 text-[12px] text-text-body">
                <option value="">+ viser…</option>
                {prospects
                  .filter((p) => !(c.prospects ?? []).includes(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </Carte>
  );
}
