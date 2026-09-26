import React, { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { uid } from '../../state/SyncContext';
import { resizeImageToDataUrl } from '../../lib/imageResize';
import { AMBRE } from '../jetons';
import { useStrategie, type CampagneId } from '../donnees/strategie';
import type { Campagne } from '../donnees/types';
import { Carte, EnTete, Invitation } from '../ui/kit';
import { enLettres } from '../format';
import { champ, useEcrire } from './commun';

/**
 * STRATÉGIE · LE STORYBOARD, PLAN PAR PLAN (cahier 14, `49b`).
 *
 * En tête, la règle du temps : chaque plan y prend la largeur de sa durée,
 * et la somme fait le film. Dessous, les plans dans l'ordre : le visuel, la
 * durée, ce qu'on y voit.
 *
 * L'ambre : le plan sans visuel — sur la règle et à sa place dans le film.
 * C'est le même manque que la campagne bloquée (`49a`) : fournir le dernier
 * visuel manquant lève le blocage de la campagne quand c'était sa raison.
 */

type Plan = NonNullable<Campagne['plans']>[number];

export function StrategieStoryboards() {
  const m = useStrategie();
  const ecrire = useEcrire<Campagne>('campagnes');
  const [params, setParams] = useSearchParams();
  const [choisi, setChoisi] = useState<string | null>(null);
  const [ajout, setAjout] = useState<{ duree: string; quoi: string } | null>(null);
  const fichier = useRef<HTMLInputElement>(null);
  const avecPlans = m.campagnes.filter((c) => (c.plans?.length ?? 0) > 0 || c.etape === 'scenario' || c.etape === 'production');
  const manque = (c: CampagneId) => (c.plans ?? []).some((p) => !p.visuel);
  const c = avecPlans.find((x) => x.id === params.get('c')) ?? avecPlans.find((x) => x.bloquee && manque(x)) ?? avecPlans.find((x) => (x.plans?.length ?? 0) > 0) ?? avecPlans[0] ?? null;

  if (!c) {
    return (
      <>
        <EnTete surtitre="Stratégie · Storyboards" titre="Aucun film en préparation." />
        <Invitation titre="Pas de storyboard." texte="Un storyboard naît avec une campagne au scénario : ses plans, leur durée, ce qu’on y voit, et le visuel de chacun." />
      </>
    );
  }

  const plans = c.plans ?? [];
  const total = plans.reduce((s, p) => s + p.duree, 0);
  const manquants = plans.filter((p) => !p.visuel);
  const ambre = manquants[0] ?? null;
  const plan = plans.find((p) => p.id === choisi) ?? null;

  const majPlans = (f: (ps: Plan[]) => Plan[]) =>
    ecrire(c.id, (b) => {
      const suivants = f(b?.plans ?? []);
      const leve = b?.bloquee && /visuel/i.test(b.bloquee.raison) && suivants.every((p) => p.visuel);
      return { plans: suivants, ...(leve ? { bloquee: null } : {}) };
    });
  const fournir = async (p: Plan, f: File | undefined) => {
    if (!f || !f.type.startsWith('image/')) return;
    const image = await resizeImageToDataUrl(f, 640, 0.8);
    majPlans((ps) => ps.map((x) => (x.id === p.id ? { ...x, visuel: image } : x)));
  };

  const titre = plans.length === 0
    ? 'Le film n’a pas encore de plan.'
    : `${enLettres(plans.length, true)} plan${plans.length > 1 ? 's' : ''}, ${enLettres(total)} seconde${total > 1 ? 's' : ''}${manquants.length === 0 ? ', tous les visuels sont là' : manquants.length === 1 ? ', un visuel manquant' : `, ${enLettres(manquants.length)} visuels manquants`}.`;

  return (
    <>
      <EnTete
        surtitre="Stratégie · Storyboards"
        titre={titre}
        actions={
          avecPlans.length > 1 ? (
            <select value={c.id} onChange={(e) => setParams({ c: e.target.value }, { replace: true })} aria-label="La campagne" className="h-9 border border-[#28282c] bg-[#141416] px-2.5 text-[13px] text-text-primary">
              {avecPlans.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.titre}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />
      <Carte dominante pad="p-6" titre={`${c.titre} · ${plans.length} plan${plans.length > 1 ? 's' : ''}`} droite={total ? `${total} s au total` : ''}>
        {plans.length > 0 && (
          <div className="mb-5 flex h-[26px] border border-[#28282c]" role="img" aria-label={`La règle du temps : ${plans.map((p, i) => `plan ${i + 1}, ${p.duree} s`).join(' ; ')}`}>
            {plans.map((p, i) => {
              const estAmbre = ambre?.id === p.id;
              return (
                <span key={p.id} className="flex min-w-0 items-center justify-center border-r border-[#28282c] font-mono text-[10px] tabular-nums last:border-r-0" style={{ flexGrow: p.duree, flexBasis: 0, background: estAmbre ? 'rgba(208,154,74,.14)' : choisi === p.id ? '#222226' : '#17171a', color: estAmbre ? AMBRE : 'var(--color-text-secondary)' }} data-signal-groupe={estAmbre ? 'plan-manquant' : undefined}>
                  <span className="truncate px-1">
                    {i + 1} · {p.duree} s
                  </span>
                </span>
              );
            })}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {plans.map((p, i) => {
            const estAmbre = ambre?.id === p.id;
            const image = p.visuel && p.visuel.startsWith('data:image/') ? p.visuel : null;
            return (
              <button key={p.id} type="button" onClick={() => setChoisi(choisi === p.id ? null : p.id)} aria-pressed={choisi === p.id} className="block min-w-0 self-start text-left">
                <span
                  className="relative flex aspect-[16/10] items-center justify-center overflow-hidden px-2 text-center"
                  style={
                    estAmbre
                      ? { border: `1px dashed ${AMBRE}`, background: 'rgba(208,154,74,.08)' }
                      : { border: `1px solid ${choisi === p.id ? '#8a8a87' : '#28282c'}`, background: '#1c1c1f' }
                  }
                  data-signal-groupe={estAmbre ? 'plan-manquant' : undefined}
                >
                  {image ? (
                    <img src={image} alt={`Visuel du plan ${i + 1}`} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <span className="font-mono text-[9.5px] font-semibold uppercase leading-[1.5] tracking-[0.12em]" style={{ color: estAmbre ? AMBRE : 'var(--color-text-muted)' }}>
                      {p.visuel ? p.visuel : estAmbre ? 'Visuel à fournir' : 'Sans visuel'}
                    </span>
                  )}
                </span>
                <span className="mt-2.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-text-secondary">
                  Plan {i + 1} · {p.duree} s
                </span>
                <span className="mt-1 block text-[12.5px] leading-snug text-text-body">{p.quoi}</span>
              </button>
            );
          })}
          {plans.length === 0 && (
            <div className="col-span-full">
              <Invitation titre="Aucun plan." texte="Un plan : une durée, ce qu’on y voit, puis son visuel. La règle du temps se dessine à mesure." />
            </div>
          )}
        </div>
        <div className="mt-5 border-t border-[#28282c] pt-4">
          {ajout ? (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const d = Number(ajout.duree.replace(',', '.'));
                if (!ajout.quoi.trim() || !(d > 0)) return;
                majPlans((ps) => [...ps, { id: uid('p'), duree: Math.round(d * 10) / 10, visuel: null, quoi: ajout.quoi.trim() }]);
                setAjout(null);
              }}
            >
              <input autoFocus value={ajout.quoi} onChange={(e) => setAjout({ ...ajout, quoi: e.target.value })} placeholder="Ce qu’on voit dans le plan…" aria-label="Ce qu’on voit" className={`${champ} h-9 min-w-0 flex-1`} />
              <input value={ajout.duree} onChange={(e) => setAjout({ ...ajout, duree: e.target.value })} inputMode="decimal" placeholder="durée (s)" aria-label="Durée en secondes" className={`${champ} h-9 w-[110px] font-mono`} />
              <button type="submit" className="bx-btn2">
                Ajouter le plan
              </button>
              <button type="button" className="bx-lien" onClick={() => setAjout(null)}>
                Annuler
              </button>
            </form>
          ) : (
            <button type="button" className="bx-lien" onClick={() => setAjout({ duree: '4', quoi: '' })}>
              Ajouter un plan
            </button>
          )}
        </div>
      </Carte>

      {plan && (
        <Carte pad="p-6" className="mt-[18px]" titre={`Plan ${plans.indexOf(plan) + 1} · ${plan.duree} s`} droite={<button type="button" onClick={() => setChoisi(null)} className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-secondary hover:text-text-primary">Fermer</button>}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_120px]">
            <input key={`${plan.id}-q`} defaultValue={plan.quoi} onBlur={(e) => e.target.value.trim() && majPlans((ps) => ps.map((x) => (x.id === plan.id ? { ...x, quoi: e.target.value.trim() } : x)))} aria-label="Ce qu’on voit" className={`${champ} h-9`} />
            <input key={`${plan.id}-d`} defaultValue={String(plan.duree)} inputMode="decimal" onBlur={(e) => {
              const d = Number(e.target.value.replace(',', '.'));
              if (d > 0) majPlans((ps) => ps.map((x) => (x.id === plan.id ? { ...x, duree: Math.round(d * 10) / 10 } : x)));
            }} aria-label="Durée en secondes" className={`${champ} h-9 font-mono`} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <button type="button" className="bx-btn2" onClick={() => fichier.current?.click()}>
              {plan.visuel ? 'Changer le visuel' : 'Fournir le visuel'}
            </button>
            <input ref={fichier} type="file" accept="image/*" hidden onChange={(e) => {
              void fournir(plan, e.target.files?.[0]);
              e.target.value = '';
            }} />
            <input key={`${plan.id}-v`} defaultValue={plan.visuel && !plan.visuel.startsWith('data:') ? plan.visuel : ''} onBlur={(e) => majPlans((ps) => ps.map((x) => (x.id === plan.id ? { ...x, visuel: e.target.value.trim() || (x.visuel?.startsWith('data:') ? x.visuel : null) } : x)))} placeholder="ou le décrire (« mains du boulanger »)" aria-label="Le visuel, décrit" className={`${champ} h-9 min-w-0 flex-1`} />
            <button type="button" className="bx-lien" onClick={() => {
              majPlans((ps) => ps.filter((x) => x.id !== plan.id));
              setChoisi(null);
            }}>
              Retirer le plan
            </button>
          </div>
          {c.bloquee && /visuel/i.test(c.bloquee.raison) && <p className="mt-3 text-[12.5px] text-[#a3a3a0]">Quand le dernier visuel manquant est fourni, la campagne n’est plus bloquée.</p>}
        </Carte>
      )}
    </>
  );
}
