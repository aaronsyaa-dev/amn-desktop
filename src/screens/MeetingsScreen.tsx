import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Circle, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface Suite {
  id: string;
  label: string;
  doneAt: string | null;
}
interface MeetingData {
  title: string;
  at: string;
  attendees: string;
  agenda: string;
  decisions: string[];
  actions: Suite[];
  byEmail: string;
  createdAt: string;
}
const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * LES RÉUNIONS — un ordre du jour, des décisions, des suites.
 *
 * Pour qui : une équipe qui se réunit et, trois semaines plus tard, ne sait
 * plus ce qui avait été dit. Ce que ça règle : chaque réunion garde son ordre
 * du jour, ses décisions et ses suites — cochées quand elles sont faites.
 * Pas de compte rendu rédigé : des lignes, pour être relues en dix secondes.
 */
export function MeetingsScreen() {
  const { t, langue } = useLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const { user } = useAuth();
  const { upsert, remove } = useSync();
  const brutes = useCollection<MeetingData>('meetings');
  const [ouvert, setOuvert] = useState(false);
  const [title, setTitle] = useState('');
  const [at, setAt] = useState(() => localISO(new Date()));
  const [attendees, setAttendees] = useState('');
  const [agenda, setAgenda] = useState('');
  const [brouillons, setBrouillons] = useState<Record<string, { decision: string; action: string }>>({});
  const [ouverteId, setOuverteId] = useState<string | null>(null);

  const reunions = useMemo(() => [...brutes].sort((a, b) => b.at.localeCompare(a.at)), [brutes]);
  /* La réunion ouverte : celle qu'on a choisie, sinon la plus récente — on
     revient presque toujours à la dernière, et un compte rendu qui s'ouvre sur
     rien demande un clic qui n'a rien à trancher. */
  const ouverte = reunions.find((r) => r.id === ouverteId) ?? reunions[0] ?? null;
  const debutMois = localISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const ceMois = reunions.filter((r) => r.at >= debutMois).length;
  const decisions = reunions.reduce((n, r) => n + r.decisions.length, 0);
  const suitesOuvertes = reunions.reduce((n, r) => n + r.actions.filter((a) => !a.doneAt).length, 0);

  const ajouter = async () => {
    if (!title.trim()) return;
    await upsert('meetings', uid('mtg'), { title: title.trim(), at, attendees: attendees.trim(), agenda: agenda.trim(), decisions: [], actions: [], byEmail: user?.email ?? '', createdAt: new Date().toISOString() });
    setTitle(''); setAttendees(''); setAgenda(''); setOuvert(false);
  };
  const brouillon = (id: string) => brouillons[id] ?? { decision: '', action: '' };
  const noterDecision = async (r: MeetingData & { id: string }) => {
    const texte = brouillon(r.id).decision.trim();
    if (!texte) return;
    await upsert('meetings', r.id, { ...r, decisions: [...r.decisions, texte] });
    setBrouillons((b) => ({ ...b, [r.id]: { ...brouillon(r.id), decision: '' } }));
  };
  const noterAction = async (r: MeetingData & { id: string }) => {
    const texte = brouillon(r.id).action.trim();
    if (!texte) return;
    await upsert('meetings', r.id, { ...r, actions: [...r.actions, { id: uid('act'), label: texte, doneAt: null }] });
    setBrouillons((b) => ({ ...b, [r.id]: { ...brouillon(r.id), action: '' } }));
  };
  const basculer = (r: MeetingData & { id: string }, s: Suite) =>
    upsert('meetings', r.id, { ...r, actions: r.actions.map((a) => (a.id === s.id ? { ...a, doneAt: a.doneAt ? null : new Date().toISOString() } : a)) });
  const quand = (iso: string) => new Date(iso).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('pilotage.surtitre', { module: t('reunions.titre') })}
          title={t('reunions.titre')}
          description={t('reunions.description')}
          stats={[
            { label: t('reunions.stat.mois'), value: ceMois },
            { label: t('reunions.stat.decisions'), value: decisions },
            { label: t('reunions.stat.actionsOuvertes'), value: suitesOuvertes, emphasis: suitesOuvertes > 0 },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('reunions.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('reunions.champTitre')} aria-label={t('reunions.champTitre')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <label className="flex flex-col gap-1 text-xs text-text-muted">{t('reunions.champQuand')}<input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" /></label>
          <input value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder={t('reunions.champPresents')} aria-label={t('reunions.champPresents')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={3} placeholder={t('reunions.champOrdre')} aria-label={t('reunions.champOrdre')} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none sm:col-span-2" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={!title.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('reunions.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {reunions.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('reunions.vide.titre')} action={{ label: t('reunions.vide.action'), onClick: () => setOuvert(true) }}>{t('reunions.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        /*
          UN RAIL, ET UNE RÉUNION OUVERTE.

          Les réunions étaient empilées, toutes dépliées : trois réunions
          faisaient trois cartes de six cents pixels, avec leurs décisions,
          leurs suites et leurs deux formulaires de saisie — soit six champs de
          texte visibles en même temps, dont cinq ne servaient à rien. On ne
          consulte pas trois comptes rendus à la fois : on en ouvre un.

          L'objet dominant que lui donne la table du paquet est « l'ordre du
          jour ». Il occupe donc une feuille, et les autres réunions tiennent
          dans un rail rangé par mois.
        */
        <motion.div variants={staggerItem} className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <RailDesReunions
            reunions={reunions}
            ouverteId={ouverte?.id ?? null}
            onOuvrir={setOuverteId}
            locale={locale}
            t={t}
          />
          {ouverte && (
            <FeuilleDeReunion
              key={ouverte.id}
              reunion={ouverte}
              quand={quand}
              brouillon={brouillon(ouverte.id)}
              onBrouillon={(champ, valeur) =>
                setBrouillons((b) => ({ ...b, [ouverte.id]: { ...brouillon(ouverte.id), [champ]: valeur } }))
              }
              onNoterDecision={() => void noterDecision(ouverte)}
              onNoterAction={() => void noterAction(ouverte)}
              onBasculer={(s) => void basculer(ouverte, s)}
              onSupprimer={() => void remove('meetings', ouverte.id)}
              t={t}
            />
          )}
        </motion.div>
      )}

    </motion.section>
  );
}

/** Combien de suites restent ouvertes sur cette réunion. */
function suitesOuvertesDe(r: { actions: Suite[] }): number {
  return r.actions.filter((a) => !a.doneAt).length;
}

/**
 * UNE RÉUNION QUI A DÉCIDÉ SANS RIEN METTRE EN FACE.
 *
 * C'est l'ambre que la table du paquet nomme « la décision sans suite ». Le
 * modèle ne relie pas une suite À une décision — `decisions` est une liste de
 * phrases, `actions` une liste d'items cochables — donc on ne peut pas
 * désigner LAQUELLE des trois décisions est restée lettre morte sans changer
 * le modèle et migrer les réunions déjà écrites.
 *
 * Ce qui se dit sans rien inventer, en revanche, c'est la version de la même
 * alerte à la maille disponible : cette réunion a pris des décisions et il ne
 * reste aucune suite ouverte pour les porter. C'est exactement le risque que
 * le signal existe pour montrer — « on a décidé, personne ne fait rien » — et
 * c'est vrai ou faux, jamais approximatif.
 */
function sansSuite(r: { decisions: string[]; actions: Suite[] }): boolean {
  return r.decisions.length > 0 && suitesOuvertesDe(r) === 0;
}

function RailDesReunions({
  reunions,
  ouverteId,
  onOuvrir,
  locale,
  t,
}: {
  reunions: (MeetingData & { id: string })[];
  ouverteId: string | null;
  onOuvrir: (id: string) => void;
  locale: string;
  t: ReturnType<typeof useLangue>['t'];
}) {
  /* Rangées par mois : trois réunions ne demandent pas de repère, trente si.
     Le mois courant n'est pas titré — il est en haut, c'est celui qu'on lit. */
  const groupes = useMemo(() => {
    const out: { mois: string; items: (MeetingData & { id: string })[] }[] = [];
    const moisCourant = new Date().toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    for (const r of reunions) {
      const mois = new Date(r.at).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
      const dernier = out[out.length - 1];
      if (dernier && dernier.mois === mois) dernier.items.push(r);
      else out.push({ mois: mois === moisCourant ? '' : mois, items: [r] });
    }
    return out;
  }, [reunions, locale]);

  return (
    <div className="flex flex-col gap-5">
      {groupes.map((groupe, i) => (
        <section key={`${groupe.mois}-${i}`}>
          {groupe.mois && <p className="eyebrow mb-2.5">{groupe.mois}</p>}
          <div className="flex flex-col">
            {groupe.items.map((r) => {
              const active = r.id === ouverteId;
              const ouvertes = suitesOuvertesDe(r);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onOuvrir(r.id)}
                  className={`relative flex flex-col gap-1.5 border-b border-[#161616] px-3 py-3.5 text-left transition-colors last:border-b-0 ${
                    active ? 'bg-raised' : 'hover:bg-surface-hover'
                  }`}
                >
                  {active && <span className="absolute inset-y-0 left-0 w-[2px] bg-border-strong" aria-hidden />}
                  <span className={`truncate text-[14.5px] ${active ? 'font-semibold text-text-primary' : 'text-text-body'}`}>
                    {r.title}
                  </span>
                  <span className="eyebrow">
                    {new Date(r.at).toLocaleString(locale, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {active && (r.decisions.length > 0 || ouvertes > 0) && (
                    <span className="eyebrow">
                      {/* Le pluriel s'écrit, il ne se parenthèse pas : « 3
                          DÉCISION(S) · 2 SUITE(S) OUVERTE(S) » tenait sur deux
                          lignes dans un rail de 280 px, pour dire trois mots. */}
                      {[
                        r.decisions.length === 1
                          ? t('reunions.uneDecision')
                          : r.decisions.length > 1
                            ? t('reunions.nDecisionsPlur', { n: r.decisions.length })
                            : null,
                        ouvertes === 1
                          ? t('reunions.uneSuiteOuverte')
                          : ouvertes > 1
                            ? t('reunions.nSuitesOuvertesPlur', { n: ouvertes })
                            : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function FeuilleDeReunion({
  reunion,
  quand,
  brouillon,
  onBrouillon,
  onNoterDecision,
  onNoterAction,
  onBasculer,
  onSupprimer,
  t,
}: {
  reunion: MeetingData & { id: string };
  quand: (iso: string) => string;
  brouillon: { decision: string; action: string };
  onBrouillon: (champ: 'decision' | 'action', valeur: string) => void;
  onNoterDecision: () => void;
  onNoterAction: () => void;
  onBasculer: (s: Suite) => void;
  onSupprimer: () => void;
  t: ReturnType<typeof useLangue>['t'];
}) {
  const ouvertes = suitesOuvertesDe(reunion);
  const alerte = sansSuite(reunion);

  return (
    <div className="panel-sheet flex flex-col">
      <div className="flex items-start gap-4 p-5 sm:p-8">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">
            {[quand(reunion.at), reunion.attendees || null].filter(Boolean).join(' · ')}
          </p>
          <h2 className="mt-3 text-[24px] font-bold leading-[1.15] tracking-[-0.028em] text-text-primary sm:text-[30px]">
            {reunion.title}
          </h2>
          {reunion.agenda && (
            <p className="mt-5 max-w-[62ch] whitespace-pre-wrap text-[15.5px] leading-[1.7] text-text-body [text-wrap:pretty]">
              {reunion.agenda}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onSupprimer}
          aria-label={t('reunions.supprimer')}
          title={t('reunions.supprimer')}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-text-muted transition-colors hover:text-danger"
        >
          <Trash2 size={14} strokeWidth={1.9} />
        </button>
      </div>

      <div className="grid border-t border-border-sheet md:grid-cols-2">
        {/* Les décisions — ce qui a été tranché. */}
        <section aria-label={t('reunions.decisions')} className="flex flex-col gap-4 border-b border-border-sheet p-5 sm:p-6 md:border-b-0 md:border-r">
          <div className="flex items-center gap-3">
            <p className="eyebrow flex-shrink-0">{t('reunions.decisions')}</p>
            <span className="h-px flex-1 bg-border-section" aria-hidden />
            {/*
              L'AMBRE DE L'ÉCRAN, et le seul : des décisions, aucune suite
              ouverte pour les porter. Il disparaît dès qu'une suite est notée,
              ce qui est le geste qu'il demande.
            */}
            {alerte ? (
              <span
                className="signal-plate flex-shrink-0 px-2 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.2em]"
                data-signal-groupe="sans-suite"
              >
                {t('reunions.sansSuite')}
              </span>
            ) : (
              <p className="tnum flex-shrink-0 font-mono text-[11px] text-text-muted">{reunion.decisions.length}</p>
            )}
          </div>

          {reunion.decisions.length > 0 ? (
            <ul className="flex flex-col gap-4">
              {reunion.decisions.map((d, i) => (
                <li
                  key={`${d}-${i}`}
                  className="border-l-2 border-border-strong pl-4 text-[15px] leading-[1.6] text-text-body [text-wrap:pretty]"
                >
                  {d}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-text-muted">{t('reunions.aucuneDecision')}</p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onNoterDecision();
            }}
            className="mt-auto flex gap-2 pt-1"
          >
            <input
              value={brouillon.decision}
              onChange={(e) => onBrouillon('decision', e.target.value)}
              placeholder={t('reunions.ajouterDecision')}
              aria-label={t('reunions.ajouterDecision')}
              className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-sunken px-3 text-[13.5px] text-text-primary outline-none placeholder:text-text-muted"
            />
            <button
              type="submit"
              disabled={!brouillon.decision.trim()}
              className="min-h-11 bg-accent px-4 text-[12.5px] font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              {t('reunions.noter')}
            </button>
          </form>
        </section>

        {/* Les suites — ce que quelqu'un doit faire ensuite. */}
        <section aria-label={t('reunions.actions')} className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <p className="eyebrow flex-shrink-0">{t('reunions.actions')}</p>
            <span className="h-px flex-1 bg-border-section" aria-hidden />
            <p className="eyebrow flex-shrink-0">
              {ouvertes === 0
                ? reunion.actions.length > 0
                  ? t('reunions.toutesFaites')
                  : ''
                : ouvertes === 1
                  ? t('reunions.uneOuverte')
                  : t('reunions.nOuvertesPlur', { n: ouvertes })}
            </p>
          </div>

          {reunion.actions.length > 0 ? (
            <ul className="flex flex-col">
              {reunion.actions.map((s) => (
                <li key={s.id} className="border-b border-[#1a1a1a] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onBasculer(s)}
                    aria-pressed={Boolean(s.doneAt)}
                    className="flex min-h-11 w-full items-start gap-3 py-2.5 text-left"
                  >
                    {s.doneAt ? (
                      <Check size={14} strokeWidth={2.25} className="mt-0.5 flex-shrink-0 text-text-muted" />
                    ) : (
                      <Circle size={14} strokeWidth={1.9} className="mt-0.5 flex-shrink-0 text-text-secondary" />
                    )}
                    <span
                      className={`min-w-0 flex-1 text-[14.5px] leading-[1.5] ${
                        s.doneAt ? 'text-text-muted line-through' : 'text-text-primary'
                      }`}
                    >
                      {s.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-text-muted">{t('reunions.aucuneSuite')}</p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onNoterAction();
            }}
            className="mt-auto flex gap-2 pt-1"
          >
            <input
              value={brouillon.action}
              onChange={(e) => onBrouillon('action', e.target.value)}
              placeholder={t('reunions.ajouterAction')}
              aria-label={t('reunions.ajouterAction')}
              className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-sunken px-3 text-[13.5px] text-text-primary outline-none placeholder:text-text-muted"
            />
            <button
              type="submit"
              disabled={!brouillon.action.trim()}
              className="min-h-11 bg-accent px-4 text-[12.5px] font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              {t('reunions.noter')}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
