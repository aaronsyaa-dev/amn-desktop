import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Bloc,
  BoutonSecondaire,
  Calmes,
  CarteCalme,
  CarteReleves,
  Dominante,
  Ecran50,
  LigneRegistre,
  PiedDominante,
  donnees,
} from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import {
  type ArretItineraire,
  type EnregistrementItineraire,
  PLAN,
  type PlanItineraire,
  type ReglageItineraire,
  courbeCoursDEau,
  evaluer,
  optimiser,
  traceBoucle,
  traversees,
} from '../lib/cinquante/ajouts';
import { useLangue } from '../i18n';

/**
 * ITINÉRAIRES — la carte des deux routes (`39c`).
 *
 * Les arrêts de demain sur un plan schématique de la ville, les cours d'eau en
 * bandes sombres. Deux routes : l'ordre habituel en pointillé gris, l'ordre
 * optimisé en trait plein, qui relie les mêmes arrêts autrement. Tournées sert
 * le jour même ; Itinéraires se prépare la veille, et envoie l'ordre retenu à
 * Tournées — jamais sans validation.
 *
 * Les distances affichées viennent des trajets routiers enregistrés avec le
 * plan, pas du tracé : le plan est schématique, et il le dit.
 */

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const heure = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
};
const creneau = (a: ArretItineraire) => {
  const c = a.creneau;
  if (!c || (!c.debut && !c.fin)) return 'libre';
  if (c.debut && c.fin) return c.debut === c.fin ? heure(c.debut) : `${heure(c.debut)} – ${heure(c.fin)}`;
  return c.debut ? `après ${heure(c.debut)}` : `avant ${heure(c.fin as string)}`;
};
const duree = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`);
const kmLisible = (km: number) => `${String(Math.round(km * 10) / 10).replace('.', ',')} km`;
/** « le Rhône » → « du Rhône » ; « la Saône » → « de la Saône ». */
const du = (nom: string) => nom.replace(/^le /i, 'du ').replace(/^les /i, 'des ').replace(/^(la |l’|l')/i, (x) => `de ${x}`);
const court = (a: { nom: string; court?: string }) => a.court ?? a.nom;
const jourIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function ItinerairesScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const tout = useCollection<EnregistrementItineraire>('routePlans');
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const reglage = tout.find((e): e is ReglageItineraire & { id: string; updatedAt: string } => e.kind === 'reglage') ?? null;
  const plans = useMemo(
    () => tout.filter((e): e is PlanItineraire & { id: string; updatedAt: string } => e.kind === 'plan').sort((a, b) => a.jour.localeCompare(b.jour)),
    [tout],
  );
  const demain = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + 1);
  /* Le plan de demain ; à défaut, le prochain à venir. */
  const plan = plans.find((p) => p.jour === jourIso(demain)) ?? plans.find((p) => p.jour >= jourIso(demain)) ?? null;
  const vide = plans.length === 0;

  const calc = useMemo(() => {
    if (!plan) return null;
    const optimise = optimiser(plan);
    const eh = evaluer(plan, plan.ordreHabituel);
    const eo = evaluer(plan, optimise);
    const rivieres = (reglage?.coursDEau ?? []).map((c) => ({
      c,
      habituel: traversees(plan, plan.ordreHabituel, c),
      optimise: traversees(plan, optimise, c),
    }));
    return { optimise, eh, eo, rivieres, gainKm: Math.round((eh.km - eo.km) * 10) / 10, gainMin: eh.min - eo.min };
  }, [plan, reglage]);

  const envoyer = async () => {
    if (!plan || !calc) return;
    const parId = new Map(plan.arrets.map((a) => [a.id, a]));
    const trajet = (de: string, a: string) => plan.trajets.find((x) => (x.de === de && x.a === a) || (x.de === a && x.a === de));
    const etapes = [plan.depot.id, ...calc.optimise];
    await upsert('deliveryRounds', `itineraire-${plan.id}`, {
      title: `Tournée du ${new Date(`${plan.jour}T12:00:00`).getDate()} ${MOIS[new Date(`${plan.jour}T12:00:00`).getMonth()]}`,
      day: plan.jour,
      departAt: plan.depart,
      createdAt: new Date().toISOString(),
      stops: calc.optimise.map((id, i) => {
        const a = parId.get(id) as ArretItineraire;
        return { id: `stp-${id}`, label: a.nom, address: a.adresse ?? '', doneAt: null, km: trajet(etapes[i], id)?.km, dureeMin: a.dureeMin };
      }),
    });
    await upsert('routePlans', plan.id, { ...donnees(plan), envoyeLe: new Date().toISOString(), gains: { km: calc.gainKm, min: calc.gainMin } });
  };

  /* Le mois : ce que les ordres ENVOYÉS ont économisé. */
  const moisIso = jourIso(maintenant).slice(0, 7);
  const envoyes = plans.filter((p) => p.envoyeLe && p.gains && p.jour.startsWith(moisIso));
  const kmMois = envoyes.reduce((s, p) => s + (p.gains?.km ?? 0), 0);
  const minMois = envoyes.reduce((s, p) => s + (p.gains?.min ?? 0), 0);
  const litres = reglage ? Math.round((kmMois * reglage.consoL100) / 100) : null;

  const pied = (() => {
    if (!plan || !calc) return '';
    const parId = new Map(plan.arrets.map((a) => [a.id, a]));
    const morceaux: string[] = [];
    const trop = calc.rivieres.filter((r) => r.habituel > r.optimise);
    const premierH = parId.get(plan.ordreHabituel[0]);
    const premierO = parId.get(calc.optimise[0]);
    if (trop.length) {
      const debut = premierH && premierO && premierH.id !== premierO.id ? `L’ordre habituel commence par ${court(premierH)} pour revenir ensuite vers ${court(premierO)} : ` : 'L’ordre habituel fait ';
      morceaux.push(
        `${debut}${trop.map((r) => `${L(r.habituel - r.optimise)} traversée${r.habituel - r.optimise > 1 ? 's' : ''} ${du(r.c.nom)}`).join(' et ')} de trop.`,
      );
    } else if (calc.gainKm > 0) {
      morceaux.push(`L’ordre optimisé relie les mêmes arrêts en ${kmLisible(calc.eo.km)} au lieu de ${kmLisible(calc.eh.km)}.`);
    } else {
      morceaux.push('L’ordre habituel est déjà le plus court.');
    }
    const imposes = plan.arrets.filter((a) => a.creneau && (a.creneau.debut || a.creneau.fin));
    const perdus = imposes.filter((a) => !calc.eo.tenus.includes(a.id));
    if (perdus.length) morceaux.push(`Le créneau ${perdus.map((a) => `de ${court(a)} (${creneau(a)})`).join(', ')} ne peut pas être tenu, même dans l’ordre optimisé.`);
    else if (imposes.length === 1) morceaux.push(`${court(imposes[0])} garde son créneau de ${creneau(imposes[0])} dans l’ordre optimisé.`);
    else if (imposes.length > 1) morceaux.push(`Les ${L(imposes.length)} créneaux imposés sont tenus dans l’ordre optimisé.`);
    if (plan.envoyeLe) morceaux.push(`Ordre envoyé à Tournées le ${new Date(plan.envoyeLe).getDate()} ${MOIS[new Date(plan.envoyeLe).getMonth()]}.`);
    return morceaux.join(' ');
  })();

  const description = vide
    ? t('m50.itineraries.descriptionVide')
    : calc && calc.rivieres.some((r) => r.habituel > r.optimise)
      ? t('m50.itineraries.description', {
          riviere: ((nom: string) => (langue === 'fr' ? du(nom) : nom.replace(/^(le |la |les |l’|l')/i, '')))(calc.rivieres.find((r) => r.habituel > r.optimise)?.c.nom ?? ''),
        })
      : t('m50.itineraries.descriptionSansTraversee');

  const jourPlan = plan ? new Date(`${plan.jour}T12:00:00`) : null;
  const libelleJour = jourPlan ? (plan?.jour === jourIso(demain) ? 'Demain' : `Le ${jourPlan.getDate()} ${MOIS[jourPlan.getMonth()]}`) : 'Demain';
  const numero = new Map((calc?.optimise ?? []).map((id, i) => [id, i + 1]));

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.production'), module: t('m50.itineraries.titre') })}
          title={t('m50.itineraries.titre')}
          description={description}
          phraseVide={t('m50.itineraries.phraseVide')}
        />
      </Bloc>

      <Dominante
        surtitre={plan ? `${libelleJour} · ${plan.arrets.length} arrêt${plan.arrets.length > 1 ? 's' : ''}` : 'Demain'}
        note={plan ? 'Pointillé = ordre habituel · trait = ordre optimisé' : undefined}
      >
        {!plan || !calc ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            La veille d’une tournée, ses arrêts se poseront ici sur le plan de la ville : l’ordre habituel en pointillé,
            l’ordre optimisé par-dessus, dans le respect des créneaux imposés.
          </p>
        ) : (
          <>
            <div
              className="relative h-[260px] overflow-hidden border border-border-raised bg-sunken sm:h-[360px]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, rgba(255,255,255,.025) 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, rgba(255,255,255,.025) 0 1px, transparent 1px 40px)',
              }}
            >
              <svg viewBox={`0 0 ${PLAN.largeur} ${PLAN.hauteur}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
                {(reglage?.coursDEau ?? []).map((c) => (
                  <polyline
                    key={c.nom}
                    points={courbeCoursDEau(c)
                      .map((p) => `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`)
                      .join(' ')}
                    fill="none"
                    stroke="var(--color-border-row)"
                    strokeWidth={c.largeur}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                <path d={traceBoucle(plan, plan.ordreHabituel)} fill="none" stroke="#5e5e5b" strokeWidth={2} strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
                <path
                  d={traceBoucle(plan, calc.optimise)}
                  fill="none"
                  stroke="var(--color-signal)"
                  strokeWidth={3}
                  vectorEffect="non-scaling-stroke"
                  style={{ filter: 'drop-shadow(0 0 5px rgba(208,154,74,.6))' }}
                  data-signal-groupe="route"
                />
              </svg>

              {[plan.depot, ...plan.arrets].map((a) => {
                const d = a.id === plan.depot.id;
                const gauche = a.xPct > 75;
                return (
                  <span
                    key={a.id}
                    className={`absolute flex items-center gap-[7px] whitespace-nowrap ${gauche ? 'flex-row-reverse' : ''}`}
                    style={{ left: `${a.xPct}%`, top: `${a.yPct}%`, transform: gauche ? 'translate(calc(-100% + 12px), -50%)' : 'translate(-12px, -50%)' }}
                  >
                    <span
                      className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 border-text-primary font-mono text-[10px] font-bold ${
                        d ? 'bg-text-primary text-[#0a0a0a]' : 'bg-[#1e1e1e] text-text-primary'
                      }`}
                    >
                      {d ? 'D' : numero.get(a.id)}
                    </span>
                    <span className="bg-[rgba(11,11,11,.8)] px-1 py-px text-[11.5px] text-text-body max-sm:hidden">{d ? 'Dépôt' : court(a)}</span>
                  </span>
                );
              })}

              {calc.gainKm > 0 && (
                <span className="absolute right-3.5 top-3.5 flex items-center gap-2 bg-signal max-sm:bottom-8 max-sm:top-auto px-[11px] py-1.5 shadow-[0_0_28px_-7px_rgba(208,154,74,.85)]" data-signal-groupe="route">
                  <span className="tnum font-mono text-[13px] font-bold text-[#0a0a0a]">
                    − {kmLisible(calc.gainKm)} · − {calc.gainMin} min
                  </span>
                </span>
              )}
              <span className="absolute bottom-2.5 left-3.5 font-mono text-[9px] uppercase tracking-[0.14em] text-text-muted">Plan schématique · non à l’échelle</span>
            </div>

            <PiedDominante action={!plan.envoyeLe ? <BoutonSecondaire onClick={() => void envoyer()}>Envoyer l’ordre à Tournées</BoutonSecondaire> : undefined}>
              {pied}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="L’ordre optimisé" note={plan ? 'Créneau imposé' : undefined}>
          {!plan || !calc ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucune tournée préparée pour demain.</p>
          ) : (
            calc.optimise.map((id, i) => {
              const a = plan.arrets.find((x) => x.id === id) as ArretItineraire;
              return (
                <LigneRegistre key={id} colonnes="40px minmax(0,1fr) auto" derniere={i === calc.optimise.length - 1}>
                  <span className="text-[13.5px] text-text-primary">{i + 1}</span>
                  <span className="min-w-0 font-mono text-[11.5px] text-text-secondary [overflow-wrap:anywhere]">{a.nom}</span>
                  <span className="text-right font-mono text-[11.5px] text-text-secondary">{creneau(a)}</span>
                </LigneRegistre>
              );
            })
          )}
        </CarteCalme>
        <CarteReleves
          surtitre={MOIS[maintenant.getMonth()].replace(/^./, (x) => x.toUpperCase())}
          releves={[
            { label: 'Km économisés', valeur: envoyes.length ? `${Math.round(kmMois)} km` : '—' },
            { label: 'Temps de route', valeur: envoyes.length ? `− ${duree(minMois)}` : '—' },
            { label: 'Carburant', valeur: envoyes.length && litres !== null ? `− ${litres} L` : '—' },
          ]}
        >
          L’ordre n’est jamais appliqué sans validation : Tournées reçoit ce que vous envoyez.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
