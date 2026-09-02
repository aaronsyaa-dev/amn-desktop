import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ScreenHeader } from '../components/ScreenHeader';
import { evaluateProfile, outputsOf } from '../state/calcEngine';
import { CONVERTER_PROFILES } from '../state/converterProfiles';
import { defaultText, formatValue, parseValue } from '../lib/calcFormat';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

/**
 * LES CONVERTISSEURS — le bon chiffre tout de suite.
 *
 * Pour qui : une boutique qui reçoit une commande en pouces, un traiteur
 * qui lit une recette en onces, n'importe qui devant un prix TTC à ramener
 * en HT. Ce que ça règle : sept convertisseurs sur le moteur des
 * Calculateurs — des profils, des formules, rien d'écrit deux fois. Les
 * devises n'embarquent aucun taux : il serait faux demain, on le saisit.
 */
export function ConvertersScreen() {
  const { t } = useLangue();
  const [actif, setActif] = useState(CONVERTER_PROFILES[0].id);
  const [saisies, setSaisies] = useState<Record<string, Record<string, string>>>({});
  const profile = CONVERTER_PROFILES.find((p) => p.id === actif) ?? CONVERTER_PROFILES[0];
  const valeurs = saisies[profile.id] ?? {};
  const parsed = useMemo(() => {
    const out: Record<string, number> = {};
    for (const input of profile.inputs) {
      const brut = valeurs[input.key];
      out[input.key] = brut === undefined ? input.defaultValue : parseValue(brut, input.kind);
    }
    return out;
  }, [profile, valeurs]);
  const result = useMemo(() => evaluateProfile(profile, parsed), [profile, parsed]);
  const sorties = outputsOf(result);
  const saisir = (key: string, brut: string) => setSaisies((s) => ({ ...s, [profile.id]: { ...(s[profile.id] ?? {}), [key]: brut } }));

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('outils.surtitre', { module: t('convertisseurs.titre') })}
          title={t('convertisseurs.titre')}
          description={t('convertisseurs.description')}
          stats={[
            { label: t('convertisseurs.stat.convertisseurs'), value: CONVERTER_PROFILES.length },
            { label: t('convertisseurs.stat.actif'), value: profile.label },
          ]}
        />
      </motion.div>

      <motion.div variants={staggerItem} role="tablist" aria-label={t('convertisseurs.titre')} className="flex flex-wrap gap-1">
        {CONVERTER_PROFILES.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={p.id === actif} onClick={() => setActif(p.id)} className={`min-h-11 border px-3 text-xs md:min-h-0 md:py-1.5 ${p.id === actif ? 'border-border-strong bg-surface-hover text-text-primary' : 'border-border text-text-secondary hover:text-text-primary'}`}>{p.label}</button>
        ))}
      </motion.div>

      <motion.div variants={staggerItem} role="tabpanel" className="grid gap-4 rounded-xl border border-border bg-surface p-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-text-secondary">{profile.description}</p>
          {profile.inputs.map((input) => (
            <label key={input.key} className="flex flex-col gap-1 text-xs text-text-muted">
              {input.label}
              <input
                value={valeurs[input.key] ?? defaultText(input.defaultValue, input.kind)}
                onChange={(e) => saisir(input.key, e.target.value)}
                inputMode="decimal"
                placeholder={defaultText(input.defaultValue, input.kind)}
                className="input-focus tnum min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none"
              />
              {input.help && <span className="text-[11px] text-text-muted">{input.help}</span>}
            </label>
          ))}
        </div>
        <dl className="flex flex-col divide-y divide-border">
          {sorties.map((line) => (
            <div key={line.key} className="flex items-center justify-between gap-3 py-2">
              <dt className="text-sm text-text-secondary">{line.label}</dt>
              <dd className={`tnum font-mono ${line.headline ? 'text-lg font-medium text-text-primary' : 'text-sm text-text-primary'}`}>{formatValue(line.value, line.kind)}</dd>
            </div>
          ))}
        </dl>
      </motion.div>
    </motion.section>
  );
}
