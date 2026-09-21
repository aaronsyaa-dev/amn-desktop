import React, { useMemo } from 'react';
import { useHaloSignal } from '../EtatEcran';
import type { OrgAccessEntry } from '../../shared/api';

/**
 * JOURNAL D'ACCÈS — les séjours.
 *
 * Un COULOIR par organisation, sept jours en abscisse, et chaque entrée d'un
 * opérateur dans un dossier client est un BLOC À SA DURÉE RÉELLE — un séjour,
 * pas un événement ponctuel.
 *
 * Ce que l'écran doit pouvoir montrer à une cliente qui demande « qui a vu mes
 * données » n'est pas une liste de lignes : c'est UN COULOIR VIDE. Les
 * couloirs pleins se comptent sur une main, les vides sont la règle, et la
 * démonstration se fait sans lire.
 *
 * L'AMBRE, unique : la suspension — la seule marque qui ne soit pas une
 * visite. Elle traverse le couloir d'un bord à l'autre au lieu d'occuper une
 * durée, parce qu'elle n'en a pas : c'est un instant qui change un état.
 *
 * LA DURÉE D'UN SÉJOUR SE DÉDUIT DU JOURNAL, ELLE NE S'INVENTE PAS. Le journal
 * porte un `enter` et un `leave` ; un accès dure UNE HEURE avec un rôle imposé
 * et se ferme seul (`OrgRail`). Un séjour va donc de son `enter` à son `leave`
 * s'il existe, sinon à une heure plus tard — borné à maintenant, parce qu'un
 * bloc ne se dessine pas dans le futur.
 */

/** La fenêtre du couloir : sept jours, et rien d'autre ne décide des abscisses. */
const FENETRE_JOURS = 7;
const JOUR_MS = 86_400_000;
/** Un accès se ferme seul au bout d'une heure — `OrgRail`, une heure avec un rôle imposé. */
const ACCES_MS = 3_600_000;
const COULOIR_H = 26;

interface Sejour { id: number; debut: number; fin: number; acteur: string }
interface Couloir { orgId: string; orgNom: string; sejours: Sejour[]; suspensions: { id: number; at: number; acteur: string }[] }

export function CouloirsDAcces({ entrees }: { entrees: OrgAccessEntry[] }) {
  const maintenant = Date.now();
  const debutFenetre = maintenant - FENETRE_JOURS * JOUR_MS;

  const couloirs = useMemo(() => {
    const par = new Map<string, Couloir>();
    /* Du plus ancien au plus récent : un séjour se ferme par le `leave` qui le SUIT. */
    const chrono = [...entrees].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const ouverts = new Map<string, Sejour>();
    for (const e of chrono) {
      const at = Date.parse(e.createdAt);
      if (!Number.isFinite(at)) continue;
      const c = par.get(e.orgId) ?? { orgId: e.orgId, orgNom: e.orgName, sejours: [], suspensions: [] };
      par.set(e.orgId, c);
      const cle = `${e.orgId}|${e.actorEmail}`;
      if (e.action === 'enter') {
        const s: Sejour = { id: e.id, debut: at, fin: Math.min(at + ACCES_MS, maintenant), acteur: e.actorEmail };
        ouverts.set(cle, s);
        c.sejours.push(s);
      } else if (e.action === 'leave') {
        const s = ouverts.get(cle);
        if (s) { s.fin = Math.min(at, maintenant); ouverts.delete(cle); }
      } else if (e.action === 'suspend') {
        c.suspensions.push({ id: e.id, at, acteur: e.actorEmail });
      }
    }
    /* Ne restent que les marques de la fenêtre : un couloir montre sept jours, pas l'histoire. */
    for (const c of par.values()) {
      c.sejours = c.sejours.filter((s) => s.fin >= debutFenetre);
      c.suspensions = c.suspensions.filter((s) => s.at >= debutFenetre);
    }
    /* Les couloirs qui ont quelque chose d'abord : le vide est la règle, il se lit dessous. */
    return [...par.values()].sort((a, b) => (b.sejours.length + b.suspensions.length) - (a.sejours.length + a.suspensions.length) || a.orgNom.localeCompare(b.orgNom, 'fr'));
  }, [entrees, maintenant, debutFenetre]);

  /* L'ambre : la suspension la plus récente de la fenêtre. Aucune suspension, aucun ambre. */
  const suspensionAmbre = useMemo(() => {
    const toutes = couloirs.flatMap((c) => c.suspensions.map((s) => ({ ...s, orgNom: c.orgNom, orgId: c.orgId })));
    return toutes.sort((a, b) => b.at - a.at)[0] ?? null;
  }, [couloirs]);
  const halo = useHaloSignal(suspensionAmbre !== null);

  const pct = (t: number) => Math.min(100, Math.max(0, ((t - debutFenetre) / (FENETRE_JOURS * JOUR_MS)) * 100));
  const vides = couloirs.filter((c) => c.sejours.length === 0 && c.suspensions.length === 0).length;
  const jourCourt = (ms: number) => new Date(ms).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });

  if (couloirs.length === 0) return null;

  return (
    <article className="border border-border-raised bg-elevated px-6 py-[30px] sm:px-8" data-couloirs={couloirs.length}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">Un couloir par organisation · sept jours</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">Bloc = un séjour à sa durée · barre = une suspension</span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          {couloirs.map((c) => (
            <div key={c.orgId} className="grid grid-cols-[minmax(0,152px)_minmax(0,1fr)] items-center gap-3.5 py-1.5" data-couloir={c.orgId} data-sejours={c.sejours.length}>
              <span className="truncate text-[12.5px] text-text-body" title={c.orgNom}>{c.orgNom}</span>
              <span className="relative block border-y border-[#1a1a1a] bg-sunken" style={{ height: COULOIR_H }}>
                {c.sejours.map((s) => (
                  /* Un séjour occupe sa durée : début et largeur viennent des deux horodatages, jamais d'une largeur choisie. */
                  <span
                    key={s.id}
                    className="absolute inset-y-[5px] border border-border-strong bg-surface-hover"
                    style={{ left: `${pct(s.debut)}%`, width: `${Math.max(0.6, pct(s.fin) - pct(s.debut))}%` }}
                    title={`${s.acteur} · ${new Date(s.debut).toLocaleString('fr-FR')} → ${new Date(s.fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                  />
                ))}
                {c.suspensions.map((s) => {
                  const ambre = suspensionAmbre?.id === s.id;
                  return (
                    <span
                      key={s.id}
                      data-signal-groupe={ambre ? 'suspension' : undefined}
                      className={`absolute -inset-y-1 w-0.5 ${ambre ? `bg-signal ${halo}` : 'bg-border-strong'}`}
                      style={{ left: `${pct(s.at)}%` }}
                      title={`Suspension par ${s.acteur}`}
                    />
                  );
                })}
              </span>
            </div>
          ))}
          {/* La rangée de graduations partage la grille des couloirs : sinon « mardi » ne tomberait pas sur mardi. */}
          <div className="mt-2 grid grid-cols-[minmax(0,152px)_minmax(0,1fr)] gap-3.5">
            <span />
            <span className="relative block h-3.5 font-mono text-[9px] uppercase tracking-[0.08em] text-text-muted">
              {Array.from({ length: FENETRE_JOURS + 1 }, (_, i) => debutFenetre + i * JOUR_MS).map((ms, i) => (
                <span key={ms} className="absolute whitespace-nowrap" style={{ left: `${(i / FENETRE_JOURS) * 100}%`, transform: i === 0 ? 'none' : i === FENETRE_JOURS ? 'translateX(-100%)' : 'translateX(-50%)' }}>
                  {i === FENETRE_JOURS ? 'maintenant' : jourCourt(ms)}
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-[22px] border-t border-border-raised pt-5">
        <p className="text-[13.5px] leading-relaxed text-text-secondary [text-wrap:pretty]">
          {vides === couloirs.length
            ? 'Aucun opérateur n’est entré dans un dossier client sur les sept derniers jours. C’est ce que cet écran doit pouvoir montrer : des couloirs vides.'
            : <>{vides} couloir{vides > 1 ? 's' : ''} sur {couloirs.length} {vides > 1 ? 'sont restés vides' : 'est resté vide'} : personne n’est entré chez ces clientes cette semaine. C’est la règle, et c’est ce qu’on montre quand on nous demande qui a vu quoi.</>}
          {suspensionAmbre && <> La barre ambre chez {suspensionAmbre.orgNom} n’est pas une visite : c’est une suspension, un instant qui change un état.</>}
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted [text-wrap:pretty]">
          Le journal est écrit par le serveur, jamais par ce poste — une application qui écrirait son propre journal pourrait aussi bien l’omettre, et ne prouverait donc rien. Un accès dure une heure, avec un rôle imposé, et se ferme seul.
        </p>
      </div>
    </article>
  );
}
