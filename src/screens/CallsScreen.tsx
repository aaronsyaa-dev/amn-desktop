import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Link2, Phone, PhoneMissed } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { EcranVide, useHaloSignal } from '../components/EtatEcran';
import { UserAvatar } from '../components/UserAvatar';
import { CallLinkPanel } from '../components/call/CallLinkPanel';
import { useAuth } from '../auth/AuthContext';
import { useSync, useCollection } from '../state/SyncContext';
import { useCall } from '../state/CallContext';
import { useProfiles } from '../state/ProfilesContext';
import { useMembers } from '../state/useMembers';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

/** Un appel journalisé. Voir `calls` dans src/shared/api.ts. */
interface CallData {
  withEmail: string;
  sens: 'entrant' | 'sortant';
  at: string;
  seconds: number;
  manque: boolean;
}
interface DmData {
  from: string;
  to: string;
  body: string;
  createdAt: string;
}

/*
  ═══════════════════════════════════════════════════════════════════
  LE TRAIN D'IMPULSIONS — ce que la règle des 50 % garantit
  ═══════════════════════════════════════════════════════════════════

  L'axe médian est à EXACTEMENT la moitié de la hauteur, et les deux
  directions partagent LA MÊME ÉCHELLE. Ce n'est pas une préférence de
  dessin : sans cela, un appel sortant de huit minutes pourrait paraître plus
  court qu'un entrant de six, et le graphique dirait le contraire de ce que
  disent les nombres. Une seule division (`TRAIN_H / 2 − MARGE`) sert donc aux
  deux sens, et il n'existe aucun second facteur d'échelle dans ce fichier.

  `IMPULSION_L` vaut 3 px et ne s'adapte à rien : la largeur ne porte aucune
  information, seule la hauteur en porte. C'est aussi pourquoi les impulsions
  sont des boîtes positionnées en pourcentage plutôt qu'un `<svg>` étiré —
  un viewBox mis à l'échelle en largeur rendrait ces 3 px variables.

  `IMPULSION_MIN` empêche un appel d'une minute de disparaître : il a eu lieu,
  il doit se voir.
*/
const TRAIN_H = 200;
const TRAIN_MARGE = 8;
const IMPULSION_L = 3;
const IMPULSION_MIN = 4;
/** L'amplitude d'un seul côté — la même en haut et en bas. */
const AMPLITUDE = TRAIN_H / 2 - TRAIN_MARGE;
/** Jamais moins de huit heures d'axe : sinon deux appels voisins se collent. */
const AXE_H_MIN = 8;

interface Impulsion {
  id: string;
  appel: CallData & { id: string };
  /** La position sur l'axe horaire, en pourcentage. */
  x: number;
  /** La hauteur, en pixels, dans un sens comme dans l'autre. */
  hauteur: number;
}

const enHeures = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
};
const aLHeure = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/**
 * LES APPELS — appeler un membre, inviter un visiteur par lien.
 *
 * Pour qui : une équipe sur deux villes, et une cliente qui veut parler à
 * quelqu'un qui n'a pas de compte. Ce que ça règle : l'appel vivait dans la
 * barre de présence, sans écran à lui.
 *
 * ## Ce qui domine : le rythme de la journée
 *
 * L'écran montrait qui était joignable à la seconde. C'est nécessaire, et
 * c'est en dessous. Mais la présence est un état sans mémoire : rouvert cinq
 * minutes plus tard, l'écran ne savait rien de ce qui s'était passé.
 *
 * Un train d'impulsions le sait. Chaque appel est un trait de 3 px sur un axe
 * horaire — vers le haut pour un entrant, vers le bas pour un sortant — et sa
 * hauteur est sa durée. On ne compte pas les appels : on voit les grappes du
 * matin, le creux du déjeuner, et la pointe unique qui a mangé vingt minutes.
 *
 * Le journal qui rend cela possible n'existait pas : il a été ajouté dans
 * `CallContext` (collection `calls`), qui écrit la durée RÉELLE au démontage
 * de chaque appel. Un appel manqué y figure aussi, avec une durée nulle — et
 * c'est pourquoi il n'a pas d'impulsion : une impulsion de hauteur zéro serait
 * indiscernable de l'axe, et dessiner un appel qui n'a pas eu lieu à côté
 * d'appels qui ont eu lieu ferait un graphique faux. Les manqués se comptent,
 * dans la carte calme.
 *
 * ## L'ambre : l'appel le plus long
 *
 * Son impulsion, son étiquette en haut de l'axe et sa graduation — trois
 * nœuds, une région. Il n'y a pas d'ambre quand la journée n'a produit aucun
 * appel abouti : il n'y a alors pas de pointe, et une pointe inventée serait
 * la seule chose fausse de cet écran.
 */
export function CallsScreen() {
  const { t } = useLangue();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { onlineEmails, configured } = useSync();
  const { call, callsAvailable, phase, missed, clearMissed } = useCall();
  const { profileFor } = useProfiles();
  const { membres, prets } = useMembers();
  const journal = useCollection<CallData>('calls');
  const messages = useCollection<DmData>('dms');
  const [lien, setLien] = useState(false);
  const moi = user?.email ?? '';
  const autres = membres.filter((m) => m.email !== moi);
  const joignables = autres.filter((m) => onlineEmails.has(m.email));

  /*
    LE JOUR REGARDÉ : le dernier jour où le téléphone a servi.

    Pas « aujourd'hui » : ouvrir l'écran un lundi matin sur un axe vide
    n'apprendrait rien, alors que la journée de vendredi, elle, a un rythme.
    Le titre dit toujours de quel jour il s'agit.
  */
  const jourRegarde = useMemo(() => {
    const jours = journal.map((c) => c.at.slice(0, 10)).sort();
    return jours[jours.length - 1] ?? null;
  }, [journal]);
  const duJour = useMemo(
    () => journal.filter((c) => c.at.slice(0, 10) === jourRegarde).sort((a, b) => a.at.localeCompare(b.at)),
    [journal, jourRegarde],
  );
  const aboutis = duJour.filter((c) => !c.manque && c.seconds > 0);
  const manques = duJour.filter((c) => c.manque);

  /* L'axe horaire : borné par les appels, jamais plus étroit que huit heures. */
  const axe = useMemo(() => {
    if (aboutis.length === 0) return { debut: 8, fin: 8 + AXE_H_MIN };
    const heures = aboutis.map((c) => enHeures(c.at));
    let debut = Math.floor(Math.min(...heures));
    let fin = Math.ceil(Math.max(...heures));
    while (fin - debut < AXE_H_MIN) {
      if (debut > 0) debut -= 1;
      if (fin - debut < AXE_H_MIN && fin < 24) fin += 1;
      if (debut === 0 && fin === 24) break;
    }
    return { debut, fin };
  }, [aboutis]);

  const plusLong = useMemo(
    () => aboutis.reduce<(CallData & { id: string }) | null>((best, c) => (!best || c.seconds > best.seconds ? c : best), null),
    [aboutis],
  );

  const impulsions = useMemo<Impulsion[]>(() => {
    const max = Math.max(1, ...aboutis.map((c) => c.seconds));
    const largeur = axe.fin - axe.debut;
    return aboutis.map((c) => ({
      id: c.id,
      appel: c,
      x: largeur <= 0 ? 50 : ((enHeures(c.at) - axe.debut) / largeur) * 100,
      hauteur: Math.max(IMPULSION_MIN, (c.seconds / max) * AMPLITUDE),
    }));
  }, [aboutis, axe]);

  const graduations = useMemo(
    () => Array.from({ length: axe.fin - axe.debut + 1 }, (_, i) => axe.debut + i),
    [axe],
  );
  const halo = useHaloSignal(Boolean(plusLong));

  /*
    LE LIEN AVEC LE FIL DE MESSAGES.

    Un appel de vingt minutes ne laisse aucune trace écrite : ce qui s'y est
    dit n'existe que dans deux têtes. On regarde donc le fil privé avec la même
    personne, et on dit depuis quand il est muet. C'est le seul endroit de
    l'application où l'on peut constater qu'un échange important n'est écrit
    nulle part.
  */
  const echoDansLeFil = useMemo(() => {
    if (!plusLong) return null;
    const avec = plusLong.withEmail;
    const fil = messages
      .filter((m) => (m.from === moi && m.to === avec) || (m.from === avec && m.to === moi))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const dernier = fil[fil.length - 1];
    if (!dernier) return { nom: profileFor(avec).name, jours: null as number | null };
    if (dernier.createdAt > plusLong.at) return null;
    return {
      nom: profileFor(avec).name,
      jours: Math.max(0, Math.round((Date.parse(plusLong.at) - Date.parse(dernier.createdAt)) / 86_400_000)),
    };
  }, [plusLong, messages, moi, profileFor]);

  const lesPlusLongs = useMemo(
    () => [...journal.filter((c) => !c.manque)].sort((a, b) => b.seconds - a.seconds).slice(0, 6),
    [journal],
  );
  const dureeCumulee = duJour.reduce((n, c) => n + c.seconds, 0);
  const enMinutes = (secondes: number) => Math.max(1, Math.round(secondes / 60));

  const sousTitre = !configured
    ? t('appels.indisponible')
    : joignables.length === 0
      ? t('appels.personne')
      : joignables.length === 1
        ? t('appels.joignableUne')
        : t('appels.joignables', { n: joignables.length });

  const vide = Boolean(prets && autres.length === 0);

  return (
    <EcranVide quand={vide} premierJour={vide}>
      <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={staggerItem}>
          <ScreenHeader
            eyebrow={t('collectif.surtitre', { module: t('appels.titre') })}
            title={t('appels.titre')}
            description={sousTitre}
            phraseVide={t('appels.vide.phrase')}
            stats={[
              { label: t('appels.stat.joignables'), value: joignables.length, emphasis: joignables.length > 0 },
              { label: t('appels.stat.manques'), value: missed.length, emphasis: missed.length > 0 },
            ]}
            actions={
              <button type="button" onClick={() => setLien(true)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
                <Link2 size={16} strokeWidth={2} /> {t('appels.inviter')}
              </button>
            }
          />
        </motion.div>

        {vide ? (
          <motion.div variants={staggerItem}>
            <FirstRun title={t('appels.vide.titre')} action={{ label: t('trombi.vide.action'), onClick: () => navigate('/membres') }}>
              {t('appels.vide.texte')}
            </FirstRun>
          </motion.div>
        ) : (
          <>
            {/* ═══ L'OBJET DOMINANT : le train d'impulsions ═══ */}
            <motion.section variants={staggerItem} className={`panel-raised p-5 sm:p-6 ${halo}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="eyebrow">{t('appels.leRythme')}</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  {jourRegarde
                    ? new Date(`${jourRegarde}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
                    : ''}
                </p>
              </div>

              {aboutis.length === 0 ? (
                <p className="mt-4 max-w-prose text-sm leading-relaxed text-text-secondary">{t('appels.aucunAbouti')}</p>
              ) : (
                <>
                  {/* L'étiquette de la pointe, posée en haut de l'axe. */}
                  {plusLong && (
                    <p
                      data-signal-groupe="la-pointe"
                      className="mt-4 inline-flex bg-signal px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-signal-ink"
                    >
                      {aLHeure(plusLong.at)} · {t('appels.enMinutes', { n: enMinutes(plusLong.seconds) })} ·{' '}
                      {profileFor(plusLong.withEmail).name}
                    </p>
                  )}

                  <div className="relative mt-3 w-full" style={{ height: TRAIN_H }}>
                    {/* L'axe médian, à exactement la moitié de la hauteur. */}
                    <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border-strong" aria-hidden />
                    {impulsions.map((imp) => {
                      const ambre = imp.appel.id === plusLong?.id;
                      const entrant = imp.appel.sens === 'entrant';
                      return (
                        <span
                          key={imp.id}
                          data-signal-groupe={ambre ? 'la-pointe' : undefined}
                          title={`${aLHeure(imp.appel.at)} · ${profileFor(imp.appel.withEmail).name} · ${enMinutes(imp.appel.seconds)} min`}
                          className="absolute"
                          style={{
                            left: `${imp.x}%`,
                            width: IMPULSION_L,
                            height: imp.hauteur,
                            [entrant ? 'bottom' : 'top']: '50%',
                            backgroundColor: ambre ? 'var(--color-signal)' : 'var(--color-text-body)',
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* LA GRADUATION — même largeur que le train, jamais recalée. */}
                  <div className="relative h-5 w-full">
                    {graduations.map((h, i) => {
                      const x = ((h - axe.debut) / (axe.fin - axe.debut)) * 100;
                      const ambre = Boolean(plusLong) && Math.floor(enHeures(plusLong!.at)) === h;
                      /* Les graduations des DEUX BOUTS ne sont pas centrées sur
                         leur trait : centrées, la moitié de l'étiquette sortirait
                         de la carte et le dernier « 17 h » passerait à la ligne. */
                      const premiere = i === 0;
                      const derniere = i === graduations.length - 1;
                      return (
                        <span
                          key={h}
                          data-signal-groupe={ambre ? 'la-pointe' : undefined}
                          className={`absolute top-0 whitespace-nowrap font-mono text-[9.5px] uppercase tracking-wider ${
                            premiere ? '' : derniere ? '-translate-x-full' : '-translate-x-1/2'
                          } ${ambre ? 'bg-signal px-1 font-bold text-signal-ink' : 'text-text-muted'}`}
                          style={{ left: `${x}%` }}
                        >
                          {String(h).padStart(2, '0')} h
                        </span>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[9.5px] uppercase tracking-wider text-text-muted">
                    <span>{t('appels.versLeHaut')}</span>
                    <span>{t('appels.versLeBas')}</span>
                  </div>

                  {/* SOUS L'AXE — ce que l'appel n'a laissé nulle part. */}
                  {echoDansLeFil && (
                    <p className="mt-4 max-w-prose border-t border-border-strong pt-3 text-sm leading-relaxed text-text-body">
                      {echoDansLeFil.jours === null
                        ? t('appels.aucunFilAvec', { nom: echoDansLeFil.nom })
                        : t('appels.riendDansLeFil', { nom: echoDansLeFil.nom, n: echoDansLeFil.jours })}
                    </p>
                  )}
                </>
              )}
            </motion.section>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* À GAUCHE — les appels les plus longs. */}
              <motion.section variants={staggerItem} className="panel">
                <p className="eyebrow border-b border-border px-4 py-2.5">{t('appels.lesPlusLongs')}</p>
                {lesPlusLongs.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-text-muted">{t('appels.aucunJournalise')}</p>
                ) : (
                  <ul className="flex flex-col">
                    {lesPlusLongs.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
                        <UserAvatar email={c.withEmail} size={26} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-text-primary">{profileFor(c.withEmail).name}</span>
                          <span className="block font-mono text-[10px] uppercase tracking-wider text-text-muted">
                            {c.sens === 'entrant' ? t('appels.entrant') : t('appels.sortant')} · {relativeTime(c.at)}
                          </span>
                        </span>
                        <span className="flex-shrink-0 font-mono text-[13px] tabular-nums text-text-secondary">
                          {t('appels.enMinutes', { n: enMinutes(c.seconds) })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.section>

              {/* À DROITE — les trois chiffres du jour, manqués compris. */}
              <motion.aside variants={staggerItem} className="panel p-4">
                <p className="eyebrow mb-3">{t('appels.leJour')}</p>
                <dl className="flex flex-col gap-3">
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('appels.appelsAboutis')}</dt>
                    <dd className="text-[23px] font-semibold tabular-nums leading-tight text-text-primary">{aboutis.length}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('appels.dureeCumulee')}</dt>
                    <dd className="text-[23px] font-semibold tabular-nums leading-tight text-text-primary">
                      {t('appels.enMinutes', { n: enMinutes(dureeCumulee) })}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('appels.stat.manques')}</dt>
                    <dd className="text-[23px] font-semibold tabular-nums leading-tight text-text-primary">{manques.length}</dd>
                    <dd className="mt-1 text-xs leading-relaxed text-text-muted">{t('appels.manquesSansImpulsion')}</dd>
                  </div>
                </dl>
              </motion.aside>
            </div>

            {/* LES JOIGNABLES — le geste du module, sous son instrument. */}
            <motion.section variants={staggerItem} className="panel p-5">
              <p className="eyebrow mb-4">{t('appels.joignablesMaintenant')}</p>
              {joignables.length === 0 ? (
                <div>
                  <p className="text-[19px] font-semibold leading-snug text-text-primary">{t('appels.personneEnGrand')}</p>
                  <p className="mt-1.5 max-w-md text-sm leading-relaxed text-text-secondary">{t('appels.personneRaison')}</p>
                </div>
              ) : (
                <ul className="flex flex-wrap gap-3">
                  {joignables.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => void call(m.email)}
                        disabled={!callsAvailable || phase !== 'idle'}
                        aria-label={t('equipe.appeler', { nom: profileFor(m.email).name })}
                        className="input-focus flex min-h-[76px] w-[188px] items-center gap-3 border border-border bg-surface px-3.5 text-left transition-colors hover:border-border-strong hover:bg-surface-hover disabled:opacity-40"
                      >
                        <span className="relative flex-shrink-0">
                          <UserAvatar email={m.email} size={44} />
                          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-success" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] text-text-primary">{profileFor(m.email).name}</span>
                          <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                            <Phone size={11} strokeWidth={2} /> {t('appels.appeler')}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </motion.section>

            {/* LES MANQUÉS DE LA SESSION — sans ambre : l'ambre est sur la pointe. */}
            {missed.length > 0 && (
              <motion.section variants={staggerItem} className="panel p-4">
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <p className="eyebrow flex items-center gap-2">
                    <PhoneMissed size={12} strokeWidth={2.5} /> {t('appels.manques')} · {missed.length}
                  </p>
                  <button type="button" onClick={clearMissed} className="text-xs text-text-muted hover:text-text-primary">{t('appels.effacer')}</button>
                </div>
                <ul className="flex flex-col gap-px bg-border">
                  {missed.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 bg-surface px-3 py-2">
                      <span className="flex items-center gap-2 text-sm text-text-primary"><UserAvatar email={m.fromEmail} size={24} /> {profileFor(m.fromEmail).name}</span>
                      <span className="flex items-center gap-3">
                        <span className="font-mono text-[10px] uppercase text-text-muted">{relativeTime(m.at)}</span>
                        {onlineEmails.has(m.fromEmail) && (
                          <button type="button" onClick={() => void call(m.fromEmail)} disabled={!callsAvailable || phase !== 'idle'} className="flex min-h-11 items-center gap-1.5 border border-border-strong px-3 text-xs text-text-primary md:min-h-0 md:py-1.5"><Phone size={12} /> {t('appels.rappeler')}</button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.section>
            )}
          </>
        )}

        {lien && <CallLinkPanel onClose={() => setLien(false)} />}
      </motion.section>
    </EcranVide>
  );
}
