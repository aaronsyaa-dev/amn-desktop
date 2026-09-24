import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { NAV_SECTIONS } from '../../data/navigation';
import { libelleSection } from '../../i18n';
import { CONFIGURABLE_MODULES } from '../../data/tradeProfiles';

/**
 * LES MODULES D'UNE NOUVELLE ORGANISATION — sans cocher 108 cases (U3).
 *
 * Avant : le métier posait huit modules, puis l'Atelier déroulait les 108
 * modules configurables à plat, un bouton chacun. Personne ne crée un client
 * comme ça. Maintenant, trois niveaux, du plus rapide au plus fin :
 *
 *   1. LE PAQUET DU MÉTIER — déjà posé par l'étape précédente ; on le voit
 *      d'un coup d'œil (ses modules en toutes lettres) et on peut valider.
 *   2. LES PAQUETS COMPLÉMENTAIRES — une famille entière d'un geste
 *      (« + Finance », « + Marketing »…), avec son compte.
 *   3. LE DÉTAIL — une recherche, et les familles repliées ; on n'ouvre que
 *      celle qu'on veut ajuster.
 *
 * Tout reste ajustable ensuite dans le dossier de l'organisation (les modules
 * s'ouvrent et se ferment depuis la Tour).
 */
interface Famille {
  key: string;
  label: string;
  modules: { key: string; label: string; hint: string }[];
}

function famillesConfigurables(): Famille[] {
  const configurables = new Map(CONFIGURABLE_MODULES.map((m) => [m.key, m]));
  const vus = new Set<string>();
  const familles: Famille[] = [];
  for (const section of NAV_SECTIONS) {
    if ((section.space ?? 'workspace') !== 'workspace') continue;
    const modules: (typeof CONFIGURABLE_MODULES)[number][] = [];
    for (const i of section.items) {
      const m = configurables.get(i.key);
      if (m && !vus.has(m.key)) modules.push(m);
    }
    modules.forEach((m) => vus.add(m.key));
    if (modules.length) familles.push({ key: section.key, label: libelleSection(section.label), modules });
  }
  const restes = CONFIGURABLE_MODULES.filter((m) => !vus.has(m.key));
  if (restes.length) familles.push({ key: 'autres', label: 'Autres', modules: restes });
  return familles;
}

export function ChoixModules({
  modules,
  conseilles,
  metier,
  onChange,
}: {
  modules: string[];
  conseilles: string[];
  metier: string;
  onChange: (next: string[]) => void;
}) {
  const familles = useMemo(famillesConfigurables, []);
  const [detail, setDetail] = useState(false);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [cherche, setCherche] = useState('');
  const actifs = new Set(modules);
  const libelle = new Map(CONFIGURABLE_MODULES.map((m) => [m.key, m.label]));

  const basculer = (key: string) => onChange(actifs.has(key) ? modules.filter((k) => k !== key) : [...modules, key]);
  const famillePleine = (f: Famille) => f.modules.every((m) => actifs.has(m.key));
  const basculerFamille = (f: Famille) => {
    const cles = f.modules.map((m) => m.key);
    onChange(famillePleine(f) ? modules.filter((k) => !cles.includes(k)) : [...new Set([...modules, ...cles])]);
  };

  const q = cherche.trim().toLowerCase();
  const trouves = q ? CONFIGURABLE_MODULES.filter((m) => `${m.label} ${m.hint}`.toLowerCase().includes(q)).slice(0, 12) : [];

  const Case = ({ m }: { m: { key: string; label: string; hint: string } }) => {
    const on = actifs.has(m.key);
    return (
      <button
        type="button"
        onClick={() => basculer(m.key)}
        aria-pressed={on}
        className={`flex items-start gap-2.5 border px-2.5 py-2 text-left transition-colors ${on ? 'border-border-strong bg-surface-hover' : 'border-border bg-bg hover:border-border-strong'}`}
      >
        <span className={`mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center border ${on ? 'border-text-primary bg-text-primary' : 'border-border-strong'}`}>
          {on && <Check size={9} strokeWidth={3} className="text-bg" />}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className={`text-[12px] ${on ? 'text-text-primary' : 'text-text-secondary'}`}>{m.label}</span>
            {conseilles.includes(m.key) && <span className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">conseillé</span>}
          </span>
          <span className="block text-[10px] leading-snug text-text-muted">{m.hint}</span>
        </span>
      </button>
    );
  };

  return (
    <section className="panel p-4" data-choix-modules>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="eyebrow">Modules ouverts</p>
        <span className="eyebrow">{modules.length} sur {CONFIGURABLE_MODULES.length}</span>
      </div>

      {/* 1 · Le paquet, lisible d'un coup d'œil */}
      <p className="mb-2 text-[12.5px] leading-relaxed text-text-secondary">
        Le paquet <span className="text-text-primary">{metier}</span> est posé. Accueil et Paramètres sont toujours ouverts ; tout s’ajuste plus tard depuis son dossier.
      </p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {modules.length === 0 && <span className="text-[12px] text-text-muted">Aucun module en plus d’Accueil et Paramètres.</span>}
        {modules.map((k) => (
          <button key={k} type="button" onClick={() => basculer(k)} title="Retirer" className="border border-border-strong px-2 py-1 text-[11.5px] text-text-body hover:bg-surface-hover">
            {libelle.get(k) ?? k} <span aria-hidden className="text-text-muted">×</span>
          </button>
        ))}
      </div>

      {/* 2 · Les paquets complémentaires : une famille d'un geste */}
      <p className="eyebrow mb-2">Ajouter un paquet</p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {familles.map((f) => {
          const pleine = famillePleine(f);
          const n = f.modules.filter((m) => actifs.has(m.key)).length;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => basculerFamille(f)}
              aria-pressed={pleine}
              className={`border px-2.5 py-1.5 text-[12px] ${pleine ? 'border-text-primary bg-surface-hover text-text-primary' : 'border-border text-text-secondary hover:border-border-strong'}`}
            >
              {pleine ? '−' : '+'} {f.label} <span className="font-mono text-[10px] text-text-muted">{n}/{f.modules.length}</span>
            </button>
          );
        })}
      </div>

      {/* 3 · Le détail : chercher, ou ouvrir une famille */}
      <label className="mb-3 flex items-center gap-2 border border-border bg-bg px-2.5">
        <Search size={14} className="text-text-muted" aria-hidden />
        <input
          value={cherche}
          onChange={(e) => setCherche(e.target.value)}
          placeholder="Chercher un module — « stock », « signature », « paie »…"
          className="h-10 min-w-0 flex-1 bg-transparent text-[13px] text-text-primary outline-none"
        />
      </label>
      {q && (
        <div className="mb-3 grid gap-1.5 sm:grid-cols-2">
          {trouves.length === 0 ? <p className="text-[12px] text-text-muted">Aucun module ne porte ce nom.</p> : trouves.map((m) => <Case key={m.key} m={m} />)}
        </div>
      )}
      <button type="button" onClick={() => setDetail((d) => !d)} className="flex items-center gap-1.5 text-[12px] text-text-secondary hover:text-text-primary">
        {detail ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Ajuster module par module
      </button>
      {detail && (
        <div className="mt-3 flex flex-col">
          {familles.map((f) => {
            const n = f.modules.filter((m) => actifs.has(m.key)).length;
            const ici = ouverte === f.key;
            return (
              <div key={f.key} className="border-b border-border-row last:border-b-0">
                <button type="button" onClick={() => setOuverte(ici ? null : f.key)} aria-expanded={ici} className="flex w-full items-center justify-between py-2 text-left">
                  <span className="text-[13px] text-text-body">{f.label}</span>
                  <span className="font-mono text-[11px] text-text-muted">{n} / {f.modules.length}</span>
                </button>
                {ici && <div className="mb-3 grid gap-1.5 sm:grid-cols-2">{f.modules.map((m) => <Case key={m.key} m={m} />)}</div>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
