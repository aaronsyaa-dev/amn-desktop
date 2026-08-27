import React, { useMemo } from 'react';
import { Laptop, RotateCcw, Wallet } from 'lucide-react';
import { evaluateProfile, outputsOf } from '../state/calcEngine';
import { PERSONAL_CALC_PROFILES } from '../state/personalProfiles';
import { usePersonalBudget } from '../state/usePersonalBudget';
import { defaultText, formatValue, parseValue } from '../lib/calcFormat';
import { ScreenHeader } from '../components/ScreenHeader';
import { StaggerGroup, StaggerItem } from '../components/Stagger';

/**
 * AVANT LA PAIE (BLOC 2)
 * ══════════════════════
 *
 * Le même moteur que les Calculateurs métier, la même façon de saisir, et un
 * seul profil : `personnel-budget-avant-paie`. L'écran ne connaît donc aucune
 * formule — les cinq entrées, les cinq résultats et l'ordre des soustractions
 * sont déclarés dans `state/personalProfiles.ts`, et `npm run check:calc` les
 * éprouve sur des cas calculés à la main.
 *
 * ## Ce qui se voit à l'écran, et pourquoi
 *
 * Le premier résultat est « ce qu'il reste vraiment », pas le solde. Le solde
 * de la banque contient encore le loyer ; c'est précisément le chiffre qui
 * trompe, et le mettre en tête reviendrait à répéter l'erreur en plus gros.
 *
 * Le manque n'apparaît que lorsqu'il existe. Une ligne « 0,00 € manquants »
 * affichée en permanence apprend à ne plus la lire.
 *
 * ## Ce que cet écran n'envoie nulle part
 *
 * Rien. Les chiffres restent sur ce poste (voir `usePersonalBudget`). C'est
 * dit à l'écran, en bas, parce qu'une promesse de confidentialité qui n'est
 * écrite que dans le code n'est pas une promesse faite à quelqu'un.
 */
export function PersonalBudgetScreen() {
  const profile = PERSONAL_CALC_PROFILES[0];
  const { values, setValue, reset } = usePersonalBudget();

  const parsed = useMemo(() => {
    const out: Record<string, number> = {};
    for (const input of profile.inputs) {
      const raw = values[input.key];
      // Jamais touché : le moteur applique la valeur par défaut du profil.
      if (raw === undefined) continue;
      out[input.key] = parseValue(raw, input.kind);
    }
    return out;
  }, [profile, values]);

  const result = useMemo(() => evaluateProfile(profile, parsed), [profile, parsed]);
  const outputs = outputsOf(result);
  const manque = result.lines.find((l) => l.key === 'manque');
  const dansLeRouge = (manque?.value ?? 0) > 0;

  // Une ligne « 0,00 € manquants » en permanence s'apprend à ne plus se lire.
  const visibles = outputs.filter((l) => l.key !== 'manque' || dansLeRouge);

  return (
    <StaggerGroup className="flex flex-col gap-6">
      <StaggerItem>
        <ScreenHeader
          eyebrow="Personnel"
          title="Avant la paie"
          description={profile.description}
          actions={
            <button
              type="button"
              onClick={reset}
              className="flex min-h-11 items-center gap-2 border border-border px-3 text-xs text-text-muted transition-colors hover:text-text-primary md:min-h-0 md:py-2"
            >
              <RotateCcw size={13} strokeWidth={1.75} />
              Repartir à zéro
            </button>
          }
        />
      </StaggerItem>

      <StaggerItem>
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          {/* ---------------------------- Ce qu'on sait --------------------------- */}
          <section className="border border-border bg-surface p-4">
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
              Où vous en êtes
            </h2>
            <div className="flex flex-col gap-3">
              {profile.inputs.map((input) => (
                <label key={input.key} className="block">
                  <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
                    {input.label}
                  </span>
                  <input
                    inputMode="decimal"
                    value={values[input.key] ?? defaultText(input.defaultValue, input.kind)}
                    onChange={(e) => setValue(input.key, e.target.value)}
                    placeholder={defaultText(input.defaultValue, input.kind)}
                    className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-right font-mono text-sm tabular-nums text-text-primary outline-none"
                  />
                  {input.help && (
                    <span className="mt-1 block text-[11px] leading-relaxed text-text-muted">
                      {input.help}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </section>

          {/* ------------------------------ Ce que ça donne ----------------------- */}
          <section className="border border-border bg-surface p-4">
            <h2 className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
              <Wallet size={13} strokeWidth={1.75} />
              Ce qui reste
            </h2>

            {result.errors.length > 0 && (
              <ul className="mb-3 flex flex-col gap-1">
                {result.errors.map((err) => (
                  <li
                    key={err.key}
                    className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs leading-relaxed text-text-primary"
                  >
                    {err.message}
                  </li>
                ))}
              </ul>
            )}

            <dl className="flex flex-col gap-px bg-border">
              {visibles.map((line, index) => (
                <div
                  key={line.key}
                  className={`bg-surface px-3 py-2.5 ${
                    index === 0 ? 'border-l-2 border-accent' : ''
                  } ${line.key === 'manque' ? 'border-l-2 border-warning' : ''}`}
                >
                  <dt className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                    {line.label}
                  </dt>
                  <dd
                    className={`mt-0.5 font-mono tabular-nums ${
                      index === 0 ? 'text-xl text-text-primary' : 'text-sm text-text-secondary'
                    }`}
                  >
                    {formatValue(line.value, line.kind)}
                  </dd>
                  {line.help && (
                    <p className="mt-1 text-[11px] leading-relaxed text-text-muted">{line.help}</p>
                  )}
                </div>
              ))}
            </dl>

            <p className="mt-3 flex items-start gap-2 border border-border bg-bg px-3 py-2 text-[11px] leading-relaxed text-text-muted">
              <Laptop size={13} strokeWidth={1.75} className="mt-px flex-shrink-0" />
              Ces chiffres restent sur cet ordinateur. Ils ne partent sur aucun serveur, ne suivent
              pas sur le téléphone, et personne d’autre ne les voit. Ils ne sont pas chiffrés pour
              autant&nbsp;: ce qui doit l’être va dans le Coffre-fort.
            </p>
          </section>
        </div>
      </StaggerItem>
    </StaggerGroup>
  );
}
