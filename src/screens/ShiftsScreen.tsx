import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection } from '../state/SyncContext';
import { useMembers } from '../state/useMembers';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

type Poste = 'matin' | 'apresmidi' | 'journee' | 'repos';
interface ShiftData {
  email: string;
  day: string;
  kind: Poste;
  updatedAt: string;
}
const CYCLE: (Poste | null)[] = ['matin', 'apresmidi', 'journee', 'repos', null];
const JOUR = 86_400_000;

const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Le lundi de la semaine de `d`, à minuit local. */
function lundi(d: Date): Date {
  const j = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const decalage = (j.getDay() + 6) % 7;
  j.setDate(j.getDate() - decalage);
  return j;
}
const nomCourt = (email: string) => email.split('@')[0].replace(/[._-]+/g, ' ');
/*
  La MAJUSCULE INITIALE, et elle seule.

  `capitalize` de CSS met une capitale à CHAQUE mot : « Lundi 7 Septembre », où
  le français n'en veut pas sur le mois. Et `toLocaleDateString` rend le jour
  en minuscule, ce qui ne peut pas ouvrir une phrase.
*/
const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

/**
 * LE PLANNING D'ÉQUIPE — qui est là quel jour.
 *
 * Pour qui : une boutique ou un atelier à plusieurs, où « qui ouvre jeudi ? »
 * se règle par SMS. Ce que ça règle : sept jours, une chaîne de postes par
 * jour, un clic qui tourne entre matin, après-midi, journée et repos. Les
 * membres viennent de l'organisation elle-même : pas de liste à tenir à
 * côté. Les absences validées restent dans Absences ; ici c'est le planning
 * voulu, pas les imprévus.
 *
 * ## Ce qui domine : le jour où personne n'est prévu
 *
 * L'écran était une grille membres × jours — et `5d Routines` en a déjà une,
 * routines × jours, avec sa colonne du jour en plaque ambre. Deux matrices à
 * deux axes dans la même application, c'est une famille indistincte : on
 * reconnaît le gabarit avant de lire le sujet.
 *
 * Elle est donc RETOURNÉE : une ligne par jour, les membres en jetons dans la
 * ligne. Ce n'est pas une coquetterie, c'est l'axe qui compte ici. La question
 * que pose un planning n'est pas « que fait Nadia cette semaine » — ça, c'est
 * son affaire — mais « est-ce que jeudi tient ». La COUVERTURE du jour ouvre
 * donc chaque ligne, en chiffre, et le premier jour sans personne passe en
 * tête de l'écran.
 *
 * Le geste ne change pas : chaque membre garde un jeton par jour, et un clic
 * fait tourner son poste comme avant. Les membres sans poste restent visibles
 * en pointillé sur la ligne — c'est ce qui permet d'en ajouter un sans
 * chercher où cliquer.
 *
 * ## L'ambre
 *
 * Sur le premier jour non couvert à partir d'aujourd'hui, et sur lui seul. Un
 * jour vide est une décision à prendre, pas un état : soit on met quelqu'un,
 * soit on ferme. Une semaine entièrement couverte n'a aucun ambre — et le dire
 * calmement, en une phrase, est la bonne réponse.
 *
 * « Repos » ne compte pas dans la couverture : quelqu'un en repos n'ouvre pas
 * la boutique. C'est la règle que l'écran appliquait déjà pour son relevé
 * « présents aujourd'hui » ; elle vaut maintenant pour les sept jours.
 */
export function ShiftsScreen() {
  const { t, langue } = useLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const navigate = useNavigate();
  const { upsert, remove } = useSync();
  const { membres } = useMembers();
  const brutes = useCollection<ShiftData>('shifts');
  const [semaine, setSemaine] = useState(0);

  const debut = useMemo(() => {
    const l = lundi(new Date());
    l.setDate(l.getDate() + semaine * 7);
    return l;
  }, [semaine]);
  const jours = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(debut.getTime() + i * JOUR)), [debut]);
  const actifs = useMemo(() => membres.filter((m) => m.status === 'active').sort((a, b) => a.email.localeCompare(b.email)), [membres]);
  const parCase = useMemo(() => {
    const m = new Map<string, ShiftData & { id: string }>();
    for (const s of brutes) m.set(`${s.email}|${s.day}`, s);
    return m;
  }, [brutes]);
  const aujourdhui = isoJour(new Date());
  /*
    LA COUVERTURE DE CHAQUE JOUR — « repos » ne couvre pas.

    Quelqu'un en repos n'ouvre pas la boutique. C'est la règle que le relevé
    « présents aujourd'hui » appliquait déjà ; elle vaut maintenant pour les
    sept jours, et c'est elle qui ouvre chaque ligne.
  */
  const couverture = useMemo(() => {
    const compte = (day: string) =>
      actifs.filter((m) => {
        const k = parCase.get(`${m.email}|${day}`)?.kind;
        return k !== undefined && k !== 'repos';
      }).length;
    const m = new Map<string, number>();
    for (const j of jours) m.set(isoJour(j), compte(isoJour(j)));
    /* Aujourd'hui n'est pas toujours dans la semaine affichée, et le relevé
       d'en-tête en parle quand même. */
    if (!m.has(aujourdhui)) m.set(aujourdhui, compte(aujourdhui));
    return m;
  }, [jours, actifs, parCase, aujourdhui]);
  const couvertureDe = (day: string) => couverture.get(day) ?? 0;
  const presents = couvertureDe(aujourdhui);
  const posees = jours.reduce((n, j) => n + actifs.filter((m) => parCase.has(`${m.email}|${isoJour(j)}`)).length, 0);

  /*
    LE PREMIER TROU — à partir d'aujourd'hui, jamais avant.

    Un lundi déjà passé sans personne n'est plus une décision : c'est de
    l'histoire, et le signaler le mercredi ferait clignoter un écran pour
    quelque chose qu'on ne peut plus changer. Sur une semaine future, tous les
    jours comptent.
  */
  const trou = useMemo(
    () => jours.find((j) => isoJour(j) >= aujourdhui && (couverture.get(isoJour(j)) ?? 0) === 0) ?? null,
    [jours, couverture, aujourdhui],
  );
  const ditLaCouverture = (n: number) => (n === 0 ? t('planning.aucunPoste') : n === 1 ? t('planning.unePersonne') : t('planning.nPersonnes', { n }));
  const jourEntier = (d: Date) => majuscule(d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }));

  const tourner = async (email: string, day: string) => {
    const actuel = parCase.get(`${email}|${day}`);
    const suivant = CYCLE[(CYCLE.indexOf(actuel?.kind ?? null) + 1) % CYCLE.length];
    if (!suivant) {
      if (actuel) await remove('shifts', actuel.id);
      return;
    }
    await upsert('shifts', actuel?.id ?? `shift-${email}-${day}`, { email, day, kind: suivant, updatedAt: new Date().toISOString() });
  };
  const poste = (k: Poste) => t(`planning.kind.${k}` as Parameters<typeof t>[0]);
  const dateCourte = (d: Date) => d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
  const teinte: Record<Poste, string> = {
    matin: 'bg-accent/15 text-text-primary border-accent/40',
    apresmidi: 'bg-accent/10 text-text-primary border-accent/30',
    journee: 'bg-accent/25 text-text-primary border-accent/60',
    repos: 'bg-bg text-text-muted border-border',
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('production.surtitre', { module: t('planning.titre') })}
          title={t('planning.titre')}
          description={t('planning.description')}
          stats={[
            { label: t('planning.stat.presents'), value: presents },
            { label: t('planning.stat.cases'), value: posees },
            { label: t('planning.stat.membres'), value: actifs.length },
          ]}
          actions={
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setSemaine((s) => s - 1)} aria-label={t('planning.semainePrecedente')} title={t('planning.semainePrecedente')} className="flex min-h-11 min-w-11 items-center justify-center border border-border text-text-secondary hover:text-text-primary"><ChevronLeft size={16} /></button>
              <button type="button" onClick={() => setSemaine(0)} className="min-h-11 border border-border px-3 text-sm text-text-primary hover:bg-surface-hover">
                {semaine === 0 ? t('planning.cetteSemaine') : t('planning.semaineDu', { date: debut.toLocaleDateString(locale, { day: 'numeric', month: 'short' }) })}
              </button>
              <button type="button" onClick={() => setSemaine((s) => s + 1)} aria-label={t('planning.semaineSuivante')} title={t('planning.semaineSuivante')} className="flex min-h-11 min-w-11 items-center justify-center border border-border text-text-secondary hover:text-text-primary"><ChevronRight size={16} /></button>
            </div>
          }
        />
      </motion.div>

      {actifs.length <= 1 && brutes.length === 0 ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('planning.vide.titre')} action={{ label: t('planning.vide.action'), onClick: () => navigate('/membres') }}>{t('planning.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <>
          {/* LE TROU, OU LA SEMAINE COUVERTE — l'objet dominant. */}
          <motion.section variants={staggerItem} className="panel-raised p-5 sm:p-6" data-signal-groupe="le-trou">
            {trou ? (
              <>
                <p className="signal-plate mb-3 inline-flex px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider">{t('planning.couverture')}</p>
                <p className="text-[21px] font-semibold leading-tight text-text-primary sm:text-[27px]">
                  {t('planning.trou', { jour: jourEntier(trou) })}
                </p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">{t('planning.trouAide')}</p>
              </>
            ) : (
              <>
                <p className="eyebrow mb-3">{t('planning.couverture')}</p>
                <p className="text-[21px] font-semibold leading-tight text-text-primary sm:text-[27px]">{t('planning.semaineCouverte')}</p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">{t('planning.semaineCouverteAide')}</p>
              </>
            )}
          </motion.section>

          {/*
            LA SEMAINE EN LIGNES DE JOURS — la matrice retournée.

            Une ligne par jour, la couverture en chiffre à gauche, les membres
            en jetons à droite. Un membre sans poste reste visible en pointillé :
            c'est ce qui permet d'en poser un sans chercher où cliquer. Voir
            l'en-tête du fichier pour l'arbitrage contre la deuxième matrice.
          */}
          <motion.ul variants={staggerItem} className="flex flex-col gap-px overflow-hidden rounded-xl border border-border bg-border">
            {jours.map((j) => {
              const day = isoJour(j);
              const n = couvertureDe(day);
              const cejour = day === aujourdhui;
              const vide = n === 0;
              return (
                <li key={day} className={`flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 ${cejour ? 'bg-elevated' : 'bg-surface'}`}>
                  <div className="flex w-full items-baseline gap-3 sm:w-52 sm:flex-shrink-0">
                    <span className={`text-[21px] font-semibold leading-none tabular-nums ${vide ? 'text-text-muted' : 'text-text-primary'}`}>{n}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-text-primary">{jourEntier(j)}</span>
                      <span className="block font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        {cejour ? t('planning.aujourdhui') : ditLaCouverture(n)}
                      </span>
                    </span>
                  </div>
                  <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                    {actifs.map((m) => {
                      const k = parCase.get(`${m.email}|${day}`)?.kind ?? null;
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => void tourner(m.email, day)}
                            aria-label={`${nomCourt(m.email)} · ${dateCourte(j)} · ${k ? poste(k) : t('planning.kind.vide')}`}
                            className={`input-focus flex min-h-11 items-center gap-1.5 border px-2.5 text-xs transition-colors hover:bg-surface-hover md:min-h-0 md:py-1.5 ${
                              k ? teinte[k] : 'border-dashed border-border text-text-muted'
                            }`}
                          >
                            <span className="capitalize">{nomCourt(m.email)}</span>
                            {k && <span className="font-mono text-[9px] uppercase tracking-wider opacity-80">{poste(k)}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </motion.ul>
          <motion.p variants={staggerItem} className="text-xs text-text-muted">{t('planning.legende')}</motion.p>
        </>
      )}
    </motion.section>
  );
}
