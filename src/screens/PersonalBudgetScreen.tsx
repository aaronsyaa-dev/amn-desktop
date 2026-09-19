import React, { useMemo } from 'react';
import { Laptop, Plus, RotateCcw, X } from 'lucide-react';
import { evaluateProfile, outputsOf } from '../state/calcEngine';
import { PERSONAL_CALC_PROFILES } from '../state/personalProfiles';
import { usePersonalBudget } from '../state/usePersonalBudget';
import { defaultText, formatValue, parseValue } from '../lib/calcFormat';
import { ScreenHeader } from '../components/ScreenHeader';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { EcranVide } from '../components/EtatEcran';

/**
 * AVANT LA PAIE — LA CASCADE DE SOUSTRACTION (système de design, `13c`)
 * ════════════════════════════════════════════════════════════════════
 *
 * La thèse du module tient en une phrase : **le grand chiffre du haut n'est
 * pas l'argent disponible.** Le solde que la banque affiche contient encore le
 * loyer, l'assurance et l'abonnement du mois. Tant que cette thèse est écrite
 * en toutes lettres à côté d'un nombre, elle se lit comme une mise en garde
 * qu'on oublie ; dessinée, elle devient une forme qu'on voit tomber.
 *
 * L'instrument : le solde est une colonne pleine hauteur à gauche ; chaque
 * engagement du mois retire sa marche, dessinée comme un segment SUSPENDU dont
 * le haut touche le bas du segment précédent ; la dernière colonne, pleine
 * hauteur depuis le sol, est ce qui reste vraiment.
 *
 * LA RÈGLE DE GÉOMÉTRIE, et pourquoi elle n'est pas négociable : **les
 * hauteurs de marche somment exactement au solde.** Elles se déduisent toutes
 * du même total (`part()`), donc le compte tombe juste par construction. Une
 * hauteur ajustée à l'œil ferait une cascade qui ne retombe pas sur ses pieds
 * — et sur un écran dont le sujet est « où est passé l'argent », c'est la
 * seule erreur qui discrédite tout le reste.
 *
 * Le calcul, lui, n'est pas ici : les cinq entrées, les cinq résultats et
 * l'ordre des soustractions sont déclarés dans `state/personalProfiles.ts`, et
 * `npm run check:calc` les éprouve sur des cas calculés à la main. L'écran ne
 * fait que dessiner ce que le moteur rend.
 *
 * CE QUE CET ÉCRAN N'ENVOIE NULLE PART. Rien. Les chiffres restent sur ce
 * poste (voir `usePersonalBudget`). C'est dit à l'écran, en bas, parce qu'une
 * promesse de confidentialité écrite seulement dans le code n'est pas une
 * promesse faite à quelqu'un.
 */

/** La hauteur de la cascade, en pixels. Tout le reste s'en déduit. */
const CASCADE_H = 260;

export function PersonalBudgetScreen() {
  const profile = PERSONAL_CALC_PROFILES[0];
  const {
    values,
    setValue,
    reset,
    engagements,
    ajouterEngagement,
    modifierEngagement,
    retirerEngagement,
  } = usePersonalBudget();

  /* Les engagements nommés, quand il y en a, sont la source du total des
     prélèvements : on ne saisit jamais le même nombre à deux endroits. */
  const engagementsChiffres = useMemo(
    () =>
      engagements.map((e) => ({
        ...e,
        valeur: Math.max(0, parseValue(e.montant, 'money')),
      })),
    [engagements],
  );
  const totalEngagements = useMemo(
    () => engagementsChiffres.reduce((s, e) => s + e.valeur, 0),
    [engagementsChiffres],
  );
  const listeTient = engagements.length > 0;

  const parsed = useMemo(() => {
    const out: Record<string, number> = {};
    for (const input of profile.inputs) {
      const raw = values[input.key];
      // Jamais touché : le moteur applique la valeur par défaut du profil.
      if (raw === undefined) continue;
      out[input.key] = parseValue(raw, input.kind);
    }
    if (listeTient) out.prelevements = totalEngagements;
    return out;
  }, [profile, values, listeTient, totalEngagements]);

  const result = useMemo(() => evaluateProfile(profile, parsed), [profile, parsed]);
  const outputs = outputsOf(result);
  const manque = result.lines.find((l) => l.key === 'manque');
  const dansLeRouge = (manque?.value ?? 0) > 0;
  const visibles = outputs.filter((l) => l.key !== 'manque' || dansLeRouge);
  /* Le premier résultat du profil est « ce qu'il reste vraiment » — c'est
     l'ordre déclaré dans `personalProfiles.ts`, pas une supposition d'écran. */
  const principal = visibles[0];
  const secondaires = visibles.slice(1);

  /*
    LA CASCADE. Le haut de la colonne de gauche vaut le solde PLUS ce qui doit
    encore arriver : c'est l'argent qui sera passé en banque avant la paie, et
    c'est de là que les marches descendent. L'à-venir est dessiné en encre plus
    claire au sommet de la colonne, parce qu'il n'est pas encore là — la
    cascade reste une soustraction, mais elle ne cache pas ce qu'elle additionne.
  */
  const solde = parsed.solde ?? 0;
  const aVenir = parsed.aVenir ?? 0;
  const haut = solde + aVenir;
  const prelevements = listeTient ? totalEngagements : (parsed.prelevements ?? 0);
  const reste = haut - prelevements;
  const cascadeLisible = haut > 0 && prelevements >= 0 && reste >= 0;

  /* Une hauteur de marche, en pixels, déduite du même total que toutes les
     autres. C'est ce qui garantit que la somme retombe sur le solde. */
  const part = (montant: number) => (haut > 0 ? (montant / haut) * CASCADE_H : 0);

  /* Les marches, avec le bas de chacune : le haut de la marche n touche le bas
     de la marche n−1, donc la descente se lit comme une chute continue. */
  const marches = useMemo(() => {
    const source = listeTient
      ? engagementsChiffres
          .filter((e) => e.valeur > 0)
          .map((e) => ({ id: e.id, label: e.label.trim() || 'Prélèvement', jour: e.jour, valeur: e.valeur }))
      : prelevements > 0
        ? [{ id: 'total', label: 'Prélèvements à passer', jour: '', valeur: prelevements }]
        : [];
    let sommet = CASCADE_H;
    return source.map((e) => {
      const h = part(e.valeur);
      const bas = sommet - h;
      sommet = bas;
      return { ...e, hauteur: h, bas };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listeTient, engagementsChiffres, prelevements, haut]);

  const rienDeSaisi = haut === 0 && prelevements === 0 && engagements.length === 0;

  return (
    <EcranVide quand={rienDeSaisi} premierJour={rienDeSaisi}>
      <StaggerGroup className="flex flex-col gap-6">
        <StaggerItem>
          <ScreenHeader
            eyebrow="Personnel"
            title="Avant la paie"
            description={profile.description}
            phraseVide="Posez votre solde et ce qui doit encore partir : la descente se dessinera d’elle-même."
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

        {result.errors.length > 0 && (
          <StaggerItem>
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
          </StaggerItem>
        )}

        {/* ── L'OBJET DOMINANT : la descente ──────────────────────────────── */}
        {cascadeLisible && (
          <StaggerItem>
            <section className="panel-raised panel-raised-wide px-[30px] pb-[26px] pt-[30px]">
              <div className="mb-7 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <span className="eyebrow text-text-secondary">La descente</span>
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
                  {marches.length} ENGAGEMENT{marches.length > 1 ? 'S' : ''} ·{' '}
                  {formatValue(prelevements, 'money').toUpperCase()} QUI PARTENT
                </span>
              </div>

              <div
                className="relative flex items-end gap-[22px] border-b border-border-raised"
                style={{ height: `${CASCADE_H}px` }}
              >
                {/* La colonne du solde : pleine hauteur, elle EST l'échelle. */}
                <span className="relative flex-1" style={{ height: `${CASCADE_H}px` }}>
                  <span
                    className="absolute inset-x-0 bottom-0 bg-border-strong shadow-[inset_0_1px_0_#4a4a48]"
                    style={{ height: `${CASCADE_H}px` }}
                  />
                  {aVenir > 0 && (
                    /* Ce qui n'est pas encore arrivé, distingué au sommet. */
                    <span
                      className="absolute inset-x-0 border-t border-dashed border-[#6f6f6c] bg-[#4a4a48]"
                      style={{ bottom: `${CASCADE_H - part(aVenir)}px`, height: `${part(aVenir)}px` }}
                      title="Ce qui doit encore arriver"
                    />
                  )}
                </span>

                {marches.map((m) => (
                  <span key={m.id} className="relative flex-1" style={{ height: `${CASCADE_H}px` }}>
                    {/* Le segment SUSPENDU : son haut touche le bas du
                        précédent, donc la chute se lit sans flèche ni libellé. */}
                    <span
                      className="absolute inset-x-0 border-t border-[#333] bg-border-section"
                      style={{ bottom: `${m.bas}px`, height: `${m.hauteur}px` }}
                    />
                  </span>
                ))}

                {/* CE QUI RESTE VRAIMENT — le seul ambre de l'écran. La colonne,
                    son surtitre et son montant sous l'axe : trois nœuds, une
                    seule colonne. C'est la seule chose sur laquelle on décide. */}
                <span className="relative flex-1" style={{ height: `${CASCADE_H}px` }}>
                  <span
                    data-signal-groupe="reste-vraiment"
                    className="absolute inset-x-0 bottom-0 bg-signal shadow-[0_0_30px_-4px_var(--color-signal-glow)]"
                    style={{ height: `${Math.max(2, part(reste))}px` }}
                  />
                </span>
              </div>

              {/* Les légendes, dans la MÊME grille que les colonnes : même
                  nombre de cellules, même gouttière. Une rangée recalibrée à
                  coups de marges finirait décalée dès qu'un engagement
                  s'ajoute. */}
              <div className="mt-3.5 flex items-start gap-[22px]">
                <span className="flex-1">
                  {/* Le libellé dit ce que la colonne mesure VRAIMENT : quand
                      un virement est attendu, le haut de la colonne n'est plus
                      le solde de la banque, et l'écrire « sur le compte »
                      serait le même mensonge que le module dénonce. */}
                  <span className="eyebrow block text-text-muted">
                    {aVenir > 0 ? 'Compte + à venir' : 'Sur le compte'}
                  </span>
                  <span className="tnum mt-1.5 block font-mono text-[14px] font-semibold text-text-secondary">
                    {formatValue(haut, 'money')}
                  </span>
                </span>
                {marches.map((m) => (
                  <span key={`l-${m.id}`} className="min-w-0 flex-1">
                    <span className="eyebrow block truncate text-text-muted" title={m.label}>
                      {m.label}
                    </span>
                    <span className="tnum mt-1.5 block font-mono text-[14px] font-semibold text-text-secondary">
                      −{formatValue(m.valeur, 'money')}
                    </span>
                    {m.jour && (
                      <span className="mt-1 block font-mono text-[9.5px] tracking-[0.1em] text-text-muted">
                        LE {m.jour}
                      </span>
                    )}
                  </span>
                ))}
                <span className="flex-1">
                  <span
                    data-signal-groupe="reste-vraiment"
                    className="eyebrow-signal block"
                  >
                    Reste vraiment
                  </span>
                  {/*
                    ARBITRAGE ENTRE LE README ET LA MAQUETTE, ET POURQUOI LA
                    MAQUETTE GAGNE ICI. Le README interdit l'ambre EN TEXTE sur
                    fond sombre, sauf pour un chiffre à l'échelle d'un titre.
                    La maquette de `13c`, elle, pose ce surtitre et ce montant
                    en ambre 9,5 et 19 px sous la colonne — parce qu'ils
                    APPARTIENNENT à la colonne ambre, et qu'une encre claire
                    les en détacherait. La règle du README vise la discipline
                    de hiérarchie, pas la lisibilité : l'ambre sur le fond de
                    la carte dominante tient 7,9:1, bien au-dessus du seuil.
                    Les trois nœuds portent le même `data-signal-groupe`, donc
                    la garde les compte pour un seul signal.
                  */}
                  <span
                    data-signal-groupe="reste-vraiment"
                    className="tnum mt-1.5 block font-mono text-[19px] font-bold tracking-[-0.03em] text-signal"
                  >
                    {formatValue(reste, 'money')}
                  </span>
                </span>
              </div>

              {/* La règle que le paquet demande d'écrire : ce module ne
                  raisonne que sur ce qui est ARRIVÉ EN BANQUE. */}
              <p className="mt-6 border-t border-border-raised pt-[22px] text-[13px] leading-[1.6] text-text-muted [text-wrap:pretty]">
                Les factures que vos clients n’ont pas encore payées ne comptent pas ici : tant
                qu’un virement n’est pas arrivé, il ne peut pas être dépensé.
              </p>
            </section>
          </StaggerItem>
        )}

        <StaggerItem>
          <div className="grid gap-[18px] lg:grid-cols-[1fr_340px]">
            {/* ── À GAUCHE : les engagements, avec leur date et leur montant ── */}
            <section className="panel min-w-0 px-[22px] pb-[18px] pt-5">
              <div className="mb-[18px] flex items-baseline justify-between">
                <span className="eyebrow text-text-secondary">Ce qui doit encore partir</span>
                <button
                  type="button"
                  onClick={ajouterEngagement}
                  className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-secondary transition-colors hover:text-text-primary"
                >
                  <Plus size={12} strokeWidth={2.1} /> Ajouter
                </button>
              </div>

              {engagements.length > 0 ? (
                <ul className="flex flex-col">
                  {engagements.map((e) => (
                    <li
                      key={e.id}
                      className="grid grid-cols-[1fr_66px_104px_32px] items-center gap-3 border-b border-border py-2.5 last:border-b-0"
                    >
                      <input
                        value={e.label}
                        onChange={(ev) => modifierEngagement(e.id, { label: ev.target.value })}
                        placeholder="Loyer, assurance…"
                        aria-label="Ce que c’est"
                        className="input-focus min-w-0 border-none bg-transparent text-[14px] text-text-primary outline-none placeholder:text-text-muted"
                      />
                      <input
                        value={e.jour}
                        onChange={(ev) =>
                          modifierEngagement(e.id, { jour: ev.target.value.replace(/\D/g, '').slice(0, 2) })
                        }
                        inputMode="numeric"
                        placeholder="jour"
                        aria-label="Jour du mois"
                        className="input-focus w-full border-none bg-transparent text-right font-mono text-[12.5px] tabular-nums text-text-muted outline-none placeholder:text-text-muted"
                      />
                      <input
                        value={e.montant}
                        onChange={(ev) => modifierEngagement(e.id, { montant: ev.target.value })}
                        inputMode="decimal"
                        placeholder="0,00"
                        aria-label="Montant"
                        className="input-focus w-full border-none bg-transparent text-right font-mono text-[14px] tabular-nums text-text-primary outline-none placeholder:text-text-muted"
                      />
                      <button
                        type="button"
                        onClick={() => retirerEngagement(e.id)}
                        aria-label={`Retirer ${e.label || 'cet engagement'}`}
                        className="flex h-8 w-8 items-center justify-center text-text-muted transition-colors hover:text-text-primary"
                      >
                        <X size={14} strokeWidth={2} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-3 text-[13.5px] leading-[1.7] text-text-secondary">
                  Nommez ce qui part avant la paie — loyer, assurance, abonnements — et chacun
                  prendra sa marche dans la descente. Sans liste, le total saisi plus bas suffit.
                </p>
              )}
            </section>

            {/* ── À DROITE : la simulation, en deux barres dont la somme fait le reste ── */}
            <section className="panel flex flex-col px-5 pb-[18px] pt-5">
              <span className="eyebrow mb-5 text-text-secondary">Ce que ça vous laisse</span>
              {principal && (
                <>
                  <span className="tnum block font-mono text-[40px] font-bold leading-[.92] tracking-[-0.04em] text-text-primary">
                    {formatValue(principal.value, principal.kind)}
                  </span>
                  <span className="mt-2 block text-[12.5px] leading-[1.5] text-text-muted">
                    {principal.label.toLowerCase()}
                  </span>
                </>
              )}
              {secondaires.length > 0 && (
                <dl className="mt-5 flex flex-col gap-2.5 border-t border-border pt-4">
                  {secondaires.map((line) => (
                    <div key={line.key} className="flex items-baseline justify-between gap-3">
                      <dt className="min-w-0 truncate text-[13px] text-text-secondary">{line.label}</dt>
                      <dd className="tnum flex-none font-mono text-[14px] font-semibold text-text-primary">
                        {formatValue(line.value, line.kind)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          </div>
        </StaggerItem>

        {/* ── LES CINQ NOMBRES ────────────────────────────────────────────── */}
        <StaggerItem>
          <section className="panel px-[22px] pb-[18px] pt-5">
            <h2 className="eyebrow mb-5 text-text-secondary">Où vous en êtes</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profile.inputs.map((input) => {
                /* Le total des prélèvements n'est plus saisissable dès qu'une
                   liste le porte : deux endroits pour le même nombre, c'est
                   deux nombres qui divergent. */
                const derive = input.key === 'prelevements' && listeTient;
                return (
                  <label key={input.key} className="block">
                    <span className="eyebrow mb-2 block">{input.label}</span>
                    <input
                      inputMode="decimal"
                      readOnly={derive}
                      value={
                        derive
                          ? formatValue(totalEngagements, 'money')
                          : (values[input.key] ?? defaultText(input.defaultValue, input.kind))
                      }
                      onChange={(e) => setValue(input.key, e.target.value)}
                      placeholder={defaultText(input.defaultValue, input.kind)}
                      className={`input-focus min-h-11 w-full border border-border px-3 text-right font-mono text-[15px] tabular-nums outline-none ${
                        derive ? 'bg-bg text-text-muted' : 'bg-sunken text-text-primary'
                      }`}
                    />
                    <span className="mt-1 block text-[11px] leading-relaxed text-text-muted">
                      {derive ? 'Somme de la liste ci-dessus.' : input.help}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        </StaggerItem>

        <StaggerItem>
          <p className="flex items-start gap-3 border border-border bg-sunken px-4 py-3.5 text-[13px] leading-[1.6] text-text-muted [text-wrap:pretty]">
            <Laptop size={14} strokeWidth={1.9} className="mt-0.5 flex-shrink-0" />
            Ces chiffres restent sur cet ordinateur. Ils ne partent sur aucun serveur, ne suivent
            pas sur le téléphone, et personne d’autre ne les voit. Ils ne sont pas chiffrés pour
            autant&nbsp;: ce qui doit l’être va dans le Coffre-fort.
          </p>
        </StaggerItem>
      </StaggerGroup>
    </EcranVide>
  );
}
