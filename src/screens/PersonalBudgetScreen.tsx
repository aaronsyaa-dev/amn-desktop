import React, { useMemo } from 'react';
import { Laptop, RotateCcw } from 'lucide-react';
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
  /* Le premier résultat du profil est « ce qu'il reste vraiment » — c'est
     l'ordre déclaré dans `personalProfiles.ts`, pas une supposition d'écran. */
  const principal = visibles[0];
  const secondaires = visibles.slice(1);

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
              <RotateCcw size={13} strokeWidth={1.9} />
              Repartir à zéro
            </button>
          }
        />
      </StaggerItem>

      <StaggerItem>
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          {/* ---------------------------- Ce qu'on sait --------------------------- */}
          <section className="panel p-5 sm:p-6">
            <h2 className="eyebrow mb-5">Où vous en êtes</h2>
            <div className="flex flex-col gap-4">
              {profile.inputs.map((input) => (
                <label key={input.key} className="block">
                  <span className="eyebrow mb-2 block">{input.label}</span>
                  <input
                    inputMode="decimal"
                    value={values[input.key] ?? defaultText(input.defaultValue, input.kind)}
                    onChange={(e) => setValue(input.key, e.target.value)}
                    placeholder={defaultText(input.defaultValue, input.kind)}
                    className="input-focus min-h-11 w-full border border-border bg-sunken px-3 text-right font-mono text-[15px] tabular-nums text-text-primary outline-none"
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
          {/*
            CE QU'IL RESTE VRAIMENT — l'objet dominant, et le filet qui le porte.

            Les cinq résultats étaient une pile de lignes de même taille, le
            premier marqué d'un filet d'accent large de 2 px. C'était déjà la
            bonne intention : mettre en avant celui qui compte. Mais à taille
            égale, « ce qu'il reste vraiment » se lisait comme « déjà engagé »,
            et la phrase qui explique POURQUOI le solde de la banque trompe —
            la raison d'être du module — n'était pas là.

            Le premier résultat prend donc une carte à lui, le chiffre à 52 px
            avec son explication, et les autres passent en petites cartes
            dessous. L'AMBRE est celui que la table nomme : le filet du
            résultat. Il ne marque pas une alerte — il marque LE chiffre qu'on
            est venu chercher, celui sur lequel on va décider de dépenser ou
            non.
          */}
          <div className="flex flex-col gap-4">
            {result.errors.length > 0 && (
              <ul className="flex flex-col gap-2">
                {result.errors.map((err) => (
                  <li
                    key={err.key}
                    className="border border-border-strong bg-raised px-4 py-3 text-[13.5px] leading-[1.6] text-text-primary"
                  >
                    {err.message}
                  </li>
                ))}
              </ul>
            )}

            {principal && (
              <section className="panel-raised relative p-5 sm:p-6" data-signal-groupe="ce-qui-reste">
                {/*
                  Le filet est un élément posé, pas une bordure.

                  `border-l-2 border-l-signal` ne tenait pas : `.panel-raised`
                  déclare la propriété raccourcie `border`, écrite après les
                  utilitaires dans la feuille, et elle remet donc la couleur du
                  bord gauche à celle du panneau. Le filet disparaissait sans
                  rien casser d'autre — le genre de perte qu'on ne voit qu'en
                  regardant la capture.
                */}
                <span className="absolute inset-y-0 left-0 w-[2px] bg-signal" aria-hidden />
                <p className="eyebrow mb-3.5">{principal.label}</p>
                <p className="tnum font-mono text-[38px] font-bold leading-[0.92] tracking-[-0.04em] text-text-primary sm:text-[50px]">
                  {formatValue(principal.value, principal.kind)}
                </p>
                {principal.help && (
                  <p className="mt-5 max-w-[54ch] text-[14.5px] leading-[1.65] text-text-secondary [text-wrap:pretty]">
                    {principal.help}
                  </p>
                )}
              </section>
            )}

            {secondaires.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {secondaires.map((line) => (
                  <section
                    key={line.key}
                    /* Le manque garde un cadre en pointillés plutôt qu'une
                       couleur : il n'apparaît que lorsqu'il existe, et son
                       apparition suffit à le signaler — lui donner l'ambre
                       ferait deux signaux sur l'écran. */
                    className={`p-5 ${line.key === 'manque' ? 'border border-dashed border-border-strong' : 'panel'}`}
                  >
                    <p className="eyebrow mb-3">{line.label}</p>
                    <p className="tnum font-mono text-[23px] font-semibold leading-none tracking-[-0.03em] text-text-primary">
                      {formatValue(line.value, line.kind)}
                    </p>
                    {line.help && (
                      <p className="mt-3 text-[13px] leading-[1.55] text-text-muted [text-wrap:pretty]">{line.help}</p>
                    )}
                  </section>
                ))}
                {/* La règle du manque, dite une fois — sinon son absence passe
                    pour un oubli du calcul. */}
                {!dansLeRouge && (
                  <section className="border border-dashed border-border p-5">
                    <p className="text-[13.5px] leading-[1.6] text-text-muted [text-wrap:pretty]">
                      La ligne « il manque » n’apparaît que lorsqu’il manque quelque chose.
                    </p>
                  </section>
                )}
              </div>
            )}

            <p className="flex items-start gap-3 border border-border bg-sunken px-4 py-3.5 text-[13px] leading-[1.6] text-text-muted [text-wrap:pretty]">
              <Laptop size={14} strokeWidth={1.9} className="mt-0.5 flex-shrink-0" />
              Ces chiffres restent sur cet ordinateur. Ils ne partent sur aucun serveur, ne suivent
              pas sur le téléphone, et personne d’autre ne les voit. Ils ne sont pas chiffrés pour
              autant&nbsp;: ce qui doit l’être va dans le Coffre-fort.
            </p>
          </div>
        </div>
      </StaggerItem>
    </StaggerGroup>
  );
}
