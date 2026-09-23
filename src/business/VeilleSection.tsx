import React, { useState } from 'react';
import { DELAIS_VEILLE, EVENEMENT_APERCU, REGLAGES_VEILLE_DEFAUT, ecrireReglagesVeille, lireReglagesVeille, masqueEffectif, type ReglagesVeille } from '../lib/veille';

/**
 * L'ÉCRAN DE VEILLE, dans Paramètres (`41a`). Des réglages DE CE POSTE :
 * le délai, le poste déclaré en accueil du public, les montants masqués
 * (actifs par défaut en accueil du public) et l'heure de fermeture, qui
 * borne la journée et fait passer la veille en mode nuit.
 */
const FERMETURES = [17, 18, 19, 20, 21, 22, 23];

export function VeilleSection() {
  const [r, setR] = useState<ReglagesVeille>(() => lireReglagesVeille());
  const poser = (patch: Partial<ReglagesVeille>) => {
    const n = { ...r, ...patch };
    setR(n);
    ecrireReglagesVeille(n);
  };
  const masque = masqueEffectif(r);

  return (
    <section className="panel p-4" id="reglages-veille">
      <p className="eyebrow mb-2">Écran de veille</p>
      <p className="mb-4 max-w-2xl text-[12px] leading-relaxed text-text-secondary">
        Après un moment sans action, ce poste affiche la journée en grand : l’heure, le prochain rendez-vous, l’encaissé.
        Le premier contact le referme sans rien déclencher d’autre. Ces réglages valent pour ce poste seulement.
      </p>
      <div className="flex flex-col gap-4">
        <div>
          <span className="mb-2 block text-[12.5px] text-text-secondary">Se met en veille après</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Délai de mise en veille">
            {DELAIS_VEILLE.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={r.delaiMin === d}
                onClick={() => poser({ delaiMin: d })}
                className={`min-h-11 border px-3 text-[13px] md:min-h-9 ${r.delaiMin === d ? 'border-border-strong bg-surface-hover text-text-primary' : 'border-border text-text-secondary hover:border-border-strong'}`}
              >
                {d === 0 ? 'Jamais' : `${d} minutes`}
              </button>
            ))}
          </div>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-[13px] text-text-body">
          <input type="checkbox" checked={r.accueilPublic} onChange={(e) => poser({ accueilPublic: e.target.checked })} className="h-4 w-4" />
          Ce poste est en accueil du public
        </label>
        <label className="flex min-h-11 items-center gap-3 text-[13px] text-text-body">
          <input type="checkbox" checked={masque} onChange={(e) => poser({ masque: e.target.checked })} className="h-4 w-4" />
          <span>
            Montants masqués en veille
            <span className="block text-[12px] text-text-muted">
              Les montants deviennent « — € » et les noms des clients ne s’affichent pas.
              {r.masque === null ? ' Suit le réglage « accueil du public ».' : ''}
            </span>
          </span>
        </label>
        <label className="flex flex-wrap items-center gap-3 text-[13px] text-text-body">
          Fermeture
          <select
            value={r.fermetureH}
            onChange={(e) => poser({ fermetureH: Number(e.target.value) })}
            className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none md:min-h-9"
          >
            {FERMETURES.map((h) => (
              <option key={h} value={h}>
                {h} h
              </option>
            ))}
          </select>
          <span className="text-[12px] text-text-muted">après cette heure, la veille ne montre plus que l’heure.</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.setTimeout(() => window.dispatchEvent(new Event(EVENEMENT_APERCU)), 300)}
            className="min-h-11 border border-border-strong px-3 text-[13px] font-semibold text-text-body hover:bg-surface-hover md:min-h-9"
          >
            Voir l’écran de veille
          </button>
          {JSON.stringify(r) !== JSON.stringify(REGLAGES_VEILLE_DEFAUT) && (
            <button type="button" onClick={() => poser(REGLAGES_VEILLE_DEFAUT)} className="min-h-11 px-3 text-[13px] text-text-secondary hover:text-text-primary md:min-h-9">
              Revenir aux réglages d’origine
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
