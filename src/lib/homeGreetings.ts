/**
 * Dynamic-but-meaningful home content. The welcome line and the "où commencer"
 * nudge vary at each launch, yet stay coherent: they're chosen from curated
 * variants scoped to the time of day, not random noise. A per-launch pick keeps
 * it fresh; the time-of-day bucket keeps it sensible.
 */

type Slot = 'night' | 'morning' | 'afternoon' | 'evening';

function slotFor(hour: number): Slot {
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

const GREETINGS: Record<Slot, string[]> = {
  night: [
    'Encore là, {name} ?',
    'La nuit est calme, {name}.',
    'Bonsoir {name} — veille tranquille.',
  ],
  morning: [
    'Bonjour {name}.',
    'Belle matinée, {name}.',
    'On démarre bien, {name} ?',
    'Bonjour {name} — tout est en ordre.',
  ],
  afternoon: [
    'Bon après-midi, {name}.',
    'Content de te revoir, {name}.',
    'Ça avance, {name} ?',
    'Bon après-midi {name} — au calme.',
  ],
  evening: [
    'Bonsoir, {name}.',
    'Bonne soirée, {name}.',
    'On fait le point, {name} ?',
    'Bonsoir {name} — journée bientôt bouclée.',
  ],
};

const NUDGES: string[] = [
  'Par où commencer ?',
  'Que veux-tu regarder ?',
  'Un endroit où aller ?',
  'On commence par quoi ?',
  'Choisis un point de départ.',
];

/** Deterministic-per-launch pick (stable during a session, changes next launch). */
const launchSeed = Math.floor(Math.random() * 100000);
function pick<T>(arr: T[], salt: number): T {
  return arr[(launchSeed + salt) % arr.length];
}

export function homeWelcome(name: string, now = new Date()): string {
  const slot = slotFor(now.getHours());
  return pick(GREETINGS[slot], 0).replace('{name}', name);
}

export function homeNudge(): string {
  return pick(NUDGES, 7);
}
