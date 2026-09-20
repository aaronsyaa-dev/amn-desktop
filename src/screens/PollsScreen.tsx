import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Plus, Vote } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { EcranVide, useHaloSignal } from '../components/EtatEcran';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../auth/AuthContext';
import { isAdminRole } from '../auth/roles';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useProfiles } from '../state/ProfilesContext';
import { useMembers } from '../state/useMembers';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface PollData {
  question: string;
  options: string[];
  votes: Record<string, number>;
  createdBy: string;
  createdAt: string;
  closedAt: string | null;
  anonymous: boolean;
}
type Sondage = PollData & { id: string };

interface ShiftData {
  email: string;
  day: string;
  kind: 'matin' | 'apresmidi' | 'journee' | 'repos';
}
const HEURES_DU_POSTE: Record<ShiftData['kind'], number> = { matin: 4, apresmidi: 4, journee: 8, repos: 0 };
/* Le besoin quotidien du plan d'équipe (`15e`). Recopié ici plutôt
   qu'importé : les deux écrans n'ont aucune raison de se tenir l'un l'autre,
   et une constante de 12 h se relit là où elle sert. Si le plan change de
   besoin, ce rapprochement le dira faux — d'où le commentaire. */
const BESOIN_H = 12;

/*
  ════════════════════════════════════════════════════════════════════
  LE DÉPOUILLEMENT EN BÂTONS — pourquoi ce n'est pas une barre lissée
  ════════════════════════════════════════════════════════════════════

  À cinq personnes, une barre de progression ment par lissage : trois voix
  sur quatre y font 75 % d'un rectangle, et 75 % d'un rectangle a exactement
  la même allure que 750 voix sur 1 000. Le petit nombre disparaît.

  Les bâtons ne peuvent pas mentir : trois voix, ce sont trois traits qu'on
  compte du regard. C'est aussi la façon dont un dépouillement se fait
  réellement à la main, et cette familiarité fait la moitié du travail.

  LE GROUPEMENT PAR CINQ AVEC BARRE OBLIQUE n'est pas décoratif : c'est lui
  qui rend le comptage visuel possible au-delà de quatre. Sans lui, on
  recompte trait par trait et on se trompe à partir de sept.
*/
const BATON_H = 30;
const BATON_H_MENU = 18;
/** Quatre verticales, la cinquième en oblique par-dessus. */
const PAR_GROUPE = 5;

/** Les tailles de groupes successives pour `n` voix : [5, 5, 3] pour treize. */
function groupesDe(n: number): number[] {
  const groupes: number[] = [];
  for (let reste = n; reste > 0; reste -= PAR_GROUPE) groupes.push(Math.min(PAR_GROUPE, reste));
  return groupes;
}

/**
 * UN GROUPE DE BÂTONS. Quatre verticales au plus ; la cinquième voix est
 * l'oblique qui les barre, comme sur un carnet.
 */
function Groupe({ taille, hauteur, couleur }: { taille: number; hauteur: number; couleur: string }) {
  const verticales = Math.min(4, taille);
  const largeur = 4 * 7 + 4;
  return (
    <svg
      width={(largeur * hauteur) / (BATON_H + 4)}
      height={hauteur}
      viewBox={`0 0 ${largeur} ${BATON_H + 4}`}
      aria-hidden
      className="flex-shrink-0"
    >
      {Array.from({ length: verticales }, (_, i) => (
        <line key={i} x1={4 + i * 7} y1={2} x2={4 + i * 7} y2={BATON_H + 2} stroke={couleur} strokeWidth={1.8} strokeLinecap="round" />
      ))}
      {taille === PAR_GROUPE && (
        <line x1={1} y1={BATON_H} x2={largeur - 3} y2={4} stroke={couleur} strokeWidth={1.8} strokeLinecap="round" />
      )}
    </svg>
  );
}

/** La ligne de bâtons d'une option : un `<svg>` par groupe de cinq. */
function Batons({ voix, hauteur, couleur }: { voix: number; hauteur: number; couleur: string }) {
  /* Une option à zéro voix GARDE SA LIGNE, sans bâton. Elle a été proposée ;
     l'effacer ferait croire qu'on ne l'a jamais envisagée. */
  if (voix === 0) return <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">—</span>;
  return (
    <span className="flex flex-wrap items-end gap-2">
      {groupesDe(voix).map((taille, i) => (
        <Groupe key={i} taille={taille} hauteur={hauteur} couleur={couleur} />
      ))}
    </span>
  );
}

/* Les jours de la semaine, pour rapprocher un créneau du plan d'équipe. */
const JOURS_DE_LA_SEMAINE = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** L'indice de jour nommé dans un libellé d'option, ou `null`. */
function jourNommeDans(libelle: string): number | null {
  const nu = sansAccents(libelle);
  const i = JOURS_DE_LA_SEMAINE.findIndex((j) => nu.includes(sansAccents(j)));
  return i < 0 ? null : i;
}
/** La date ISO de ce jour dans la semaine courante (lundi → dimanche). */
function dateDuJour(indice: number): string {
  const d = new Date();
  const lundi = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const decalage = indice === 0 ? 6 : indice - 1;
  const cible = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + decalage);
  return `${cible.getFullYear()}-${String(cible.getMonth() + 1).padStart(2, '0')}-${String(cible.getDate()).padStart(2, '0')}`;
}

/**
 * LES SONDAGES — trancher à plusieurs sans réunion.
 *
 * Pour qui : un collectif qui décide d'une date, d'un nom, d'un fournisseur.
 * Ce que ça règle : la question posée trois fois dans le fil et jamais
 * tranchée. Un vote par personne (la clé de vote est l'adresse — le serveur
 * ne peut pas le garantir mieux, et c'est dit), et une clôture qui fige.
 *
 * ## Ce qui domine : le dépouillement
 *
 * L'écran montrait des barres de progression avec un pourcentage à droite. À
 * cinq votants, c'est la pire des représentations : « 75 % » demande deux
 * traductions mentales avant de redevenir « trois sur quatre, il manque
 * Marc ». Les bâtons font le chemin inverse — ils montrent le nombre AVANT
 * d'être lus, et la rangée de cases montre d'un coup ce qui manque.
 *
 * Voir l'en-tête des constantes pour le groupement par cinq, qui est ce qui
 * rend le comptage possible au-delà de quatre.
 *
 * ## L'ambre : l'option en tête
 *
 * Trois nœuds sur une ligne — le libellé, les bâtons, le décompte — et une
 * seule région. Pas d'ambre quand personne n'a voté ou quand deux options
 * sont à égalité : il n'y a alors pas de tête, et une tête inventée serait le
 * genre de mensonge que cet écran existe pour éviter.
 */
export function PollsScreen() {
  const { t } = useLangue();
  const { user, role } = useAuth();
  const { upsert, remove } = useSync();
  const { profileFor } = useProfiles();
  const { membres } = useMembers();
  const brutes = useCollection<PollData>('polls');
  const postes = useCollection<ShiftData>('shifts');
  const [ouvert, setOuvert] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState('');
  const [anonyme, setAnonyme] = useState(false);

  const moi = user?.email ?? '';
  const sondages = useMemo(() => [...brutes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [brutes]);
  const ouverts = sondages.filter((s) => !s.closedAt);
  const clos = sondages.filter((s) => s.closedAt);
  const enAttenteDeMoi = ouverts.filter((s) => s.votes?.[moi] === undefined);
  const aVoter = enAttenteDeMoi.length;
  const attendus = useMemo(() => membres.map((m) => m.email).filter(Boolean), [membres]);

  const voixDites = (n: number) => (n === 1 ? t('sondages.participantUn') : t('sondages.participants', { n }));

  /** Les comptes d'un sondage, dans l'ordre de ses options. */
  const comptesDe = (s: PollData) => {
    const votes = s.votes ?? {};
    return s.options.map((_, i) => Object.values(votes).filter((v) => v === i).length);
  };
  const enTeteDe = (s: PollData) => {
    const comptes = comptesDe(s);
    const max = Math.max(0, ...comptes);
    const index = comptes.indexOf(max);
    const total = Object.keys(s.votes ?? {}).length;
    return { index, libelle: s.options[index] ?? '', voix: max, total, exaequo: comptes.filter((c) => c === max).length > 1 };
  };

  /*
    LE SONDAGE DÉPOUILLÉ — le plus ancien de ceux qui attendent ma voix, et à
    défaut le plus récent encore ouvert. Le plus ancien, pas le plus récent :
    un sondage qui traîne retient une décision que les autres ont déjà prise.
  */
  const aTrancher = enAttenteDeMoi.length > 0 ? enAttenteDeMoi[enAttenteDeMoi.length - 1] : null;
  const depouille: Sondage | null = aTrancher ?? ouverts[0] ?? null;
  const comptes = depouille ? comptesDe(depouille) : [];
  const tete = depouille ? enTeteDe(depouille) : null;
  /* Pas de tête sans voix, et pas de tête à égalité. */
  const indexAmbre = tete && tete.voix > 0 && !tete.exaequo ? tete.index : null;
  const halo = useHaloSignal(indexAmbre !== null);
  const votants = depouille ? Object.keys(depouille.votes ?? {}) : [];
  const reste = sondages.filter((s) => s.id !== depouille?.id && !s.closedAt);

  /*
    LE LIEN AVEC LE PLAN D'ÉQUIPE.

    Quand l'option en tête NOMME un jour de la semaine, on va lire ce jour-là
    dans `shifts` et on dit combien d'heures y sont posées. Ce n'est pas un
    rapprochement décoratif : décider une réunion le jour où il manque déjà
    des heures est exactement la faute que deux écrans séparés laissent faire.

    Le rapprochement se tait quand le libellé ne nomme aucun jour, et quand le
    plan de la semaine est vide — mieux vaut rien qu'un « 0 h » qui accuserait.
  */
  const creneauEtPlanning = useMemo(() => {
    if (!depouille || indexAmbre === null) return null;
    const indice = jourNommeDans(depouille.options[indexAmbre] ?? '');
    if (indice === null) return null;
    const jour = dateDuJour(indice);
    const duJour = postes.filter((p) => p.day === jour);
    if (duJour.length === 0) return null;
    const heures = duJour.reduce((n, p) => n + (HEURES_DU_POSTE[p.kind] ?? 0), 0);
    return { nomDuJour: JOURS_DE_LA_SEMAINE[indice], heures, manque: Math.max(0, BESOIN_H - heures) };
  }, [depouille, indexAmbre, postes]);

  /*
    LES VOIX MANQUANTES PEUVENT-ELLES ENCORE RENVERSER LE RÉSULTAT ?

    Arithmétique, et donc sûre : si l'avance de la tête sur la deuxième est
    STRICTEMENT plus grande que le nombre de voix qui manquent, aucune
    distribution des manquantes ne change le vainqueur.
  */
  const irreversible = useMemo(() => {
    if (!depouille || indexAmbre === null) return null;
    const tries = [...comptes].sort((a, b) => b - a);
    const avance = (tries[0] ?? 0) - (tries[1] ?? 0);
    const manquantes = Math.max(0, attendus.length - votants.length);
    return { avance, manquantes, fige: avance > manquantes };
  }, [depouille, indexAmbre, comptes, attendus.length, votants.length]);

  const creer = async () => {
    const choix = options.split('\n').map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || choix.length < 2 || !moi) return;
    await upsert('polls', uid('poll'), {
      question: question.trim(),
      options: choix,
      votes: {},
      createdBy: moi,
      createdAt: new Date().toISOString(),
      closedAt: null,
      anonymous: anonyme,
    });
    setQuestion('');
    setOptions('');
    setAnonyme(false);
    setOuvert(false);
  };
  const voter = (s: Sondage, idx: number) => upsert('polls', s.id, { ...s, votes: { ...(s.votes ?? {}), [moi]: idx } });
  const clore = (s: Sondage) => upsert('polls', s.id, { ...s, closedAt: new Date().toISOString() });

  const vide = sondages.length === 0 && !ouvert;
  const joursOuvert = depouille ? Math.max(0, Math.floor((Date.now() - Date.parse(depouille.createdAt)) / 86_400_000)) : 0;

  return (
    <EcranVide quand={vide} premierJour={vide}>
      <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={staggerItem}>
          <ScreenHeader
            eyebrow={t('collectif.surtitre', { module: t('sondages.titre') })}
            title={t('sondages.titre')}
            description={t('sondages.description')}
            phraseVide={t('sondages.vide.phrase')}
            stats={[
              { label: t('sondages.stat.aVoter'), value: aVoter, emphasis: aVoter > 0 },
              { label: t('sondages.stat.ouverts'), value: ouverts.length },
              { label: t('sondages.stat.total'), value: sondages.length },
            ]}
            actions={
              <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
                <Plus size={16} strokeWidth={2} />
                {t('sondages.nouveau')}
              </button>
            }
          />
        </motion.div>

        {ouvert && (
          <motion.form
            variants={staggerItem}
            onSubmit={(e) => {
              e.preventDefault();
              void creer();
            }}
            className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t('sondages.champQuestion')} aria-label={t('sondages.champQuestion')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
            <textarea value={options} onChange={(e) => setOptions(e.target.value)} placeholder={t('sondages.champOptions')} aria-label={t('sondages.champOptions')} rows={4} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none" />
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={anonyme} onChange={(e) => setAnonyme(e.target.checked)} className="h-4 w-4" />
              {t('sondages.anonyme')}
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={!question.trim() || options.split('\n').filter((o) => o.trim()).length < 2} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">
                {t('sondages.lancer')}
              </button>
              <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
                {t('chrome.fermer')}
              </button>
            </div>
          </motion.form>
        )}

        {vide ? (
          <motion.div variants={staggerItem}>
            <FirstRun title={t('sondages.vide.titre')} action={{ label: t('sondages.vide.action'), onClick: () => setOuvert(true) }}>
              {t('sondages.vide.texte')}
            </FirstRun>
          </motion.div>
        ) : (
          <>
            {/* ═══ L'OBJET DOMINANT : le dépouillement ═══ */}
            {depouille && (
              <motion.section variants={staggerItem} className={`panel-raised p-5 sm:p-6 ${halo}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {depouille.votes?.[moi] === undefined && (
                    <span className="border border-border-strong px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">
                      {t('sondages.attendVotreVoix')}
                    </span>
                  )}
                  <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    {profileFor(depouille.createdBy).name} · {relativeTime(depouille.createdAt)} · {voixDites(votants.length)}
                    {depouille.anonymous && ` · ${t('sondages.anonymeCourt')}`}
                  </span>
                </div>

                <p className="mt-3.5 text-[23px] font-semibold leading-snug text-text-primary [overflow-wrap:anywhere] sm:text-[27px]">
                  {depouille.question}
                </p>

                <ol className="mt-6 flex flex-col gap-4">
                  {depouille.options.map((option, i) => {
                    const ambre = i === indexAmbre;
                    const gens = depouille.anonymous
                      ? []
                      : Object.entries(depouille.votes ?? {}).filter(([, v]) => v === i).map(([e]) => e);
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => void voter(depouille, i)}
                          className="input-focus flex w-full flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-border pb-3 text-left"
                        >
                          <span className="flex min-w-0 flex-1 flex-col gap-2.5">
                            {/* Le libellé — sur plaque ambre à encre sombre pour
                                l'option en tête, jamais en texte ambre. */}
                            <span
                              data-signal-groupe={ambre ? 'en-tete' : undefined}
                              className={
                                ambre
                                  ? 'self-start bg-signal px-2 py-0.5 text-[15px] font-semibold text-signal-ink'
                                  : 'self-start text-[15px] text-text-primary'
                              }
                            >
                              {option}
                            </span>
                            <span data-signal-groupe={ambre ? 'en-tete' : undefined} className="flex">
                              <Batons voix={comptes[i]} hauteur={BATON_H} couleur={ambre ? 'var(--color-signal)' : 'var(--color-text-body)'} />
                            </span>
                          </span>
                          <span className="flex flex-shrink-0 items-center gap-2.5">
                            {gens.slice(0, 5).map((e) => (
                              <UserAvatar key={e} email={e} size={20} />
                            ))}
                            <span
                              data-signal-groupe={ambre ? 'en-tete' : undefined}
                              className={
                                ambre
                                  ? 'bg-signal px-2 py-0.5 font-mono text-[13px] font-bold tabular-nums text-signal-ink'
                                  : 'font-mono text-[13px] tabular-nums text-text-secondary'
                              }
                            >
                              {comptes[i]}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>

                {/*
                  LA RANGÉE DE CASES — une par personne attendue, pleine si elle
                  a voté. C'est ce qui rend visible ce qui MANQUE : un compte de
                  voix seul ne dit jamais combien de voix on espérait.
                */}
                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border-strong pt-4">
                  <span className="flex gap-1.5">
                    {attendus.map((email) => {
                      const vote = (depouille.votes ?? {})[email] !== undefined;
                      return (
                        <span
                          key={email}
                          title={profileFor(email).name}
                          className="h-5 w-5"
                          style={{
                            backgroundColor: vote ? 'var(--color-text-body)' : 'transparent',
                            border: vote ? 'none' : '1.5px solid var(--color-border-strong)',
                          }}
                        />
                      );
                    })}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">
                    {t('sondages.casesDites', { n: votants.length, total: attendus.length })}
                  </span>
                </div>

                {/* SOUS LES OPTIONS — le lien avec le plan d'équipe. */}
                {creneauEtPlanning && (
                  <p className="mt-4 max-w-prose text-sm leading-relaxed text-text-body">
                    {creneauEtPlanning.manque > 0
                      ? t('sondages.creneauADecouvert', {
                          jour: creneauEtPlanning.nomDuJour,
                          heures: creneauEtPlanning.heures,
                          manque: creneauEtPlanning.manque,
                        })
                      : t('sondages.creneauCouvert', { jour: creneauEtPlanning.nomDuJour, heures: creneauEtPlanning.heures })}
                  </p>
                )}
              </motion.section>
            )}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* À GAUCHE — les sondages clos, avec leur participation. */}
              <motion.section variants={staggerItem} className="panel">
                <p className="eyebrow border-b border-border px-4 py-2.5">{t('sondages.lesClos')}</p>
                {clos.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-text-muted">{t('sondages.aucunClos')}</p>
                ) : (
                  <ul className="flex flex-col">
                    {clos.map((s) => {
                      const resultat = enTeteDe(s);
                      return (
                        <li key={s.id} className="flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-border px-4 py-3.5 last:border-b-0">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-text-primary">{s.question}</span>
                            <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-wider text-text-muted">
                              {resultat.exaequo ? t('sondages.exaequo') : resultat.libelle} · {relativeTime(s.closedAt ?? s.createdAt)}
                            </span>
                          </span>
                          <span className="flex flex-shrink-0 items-end gap-2.5">
                            <Batons voix={resultat.voix} hauteur={BATON_H_MENU} couleur="var(--color-text-body)" />
                            <span className="font-mono text-[11px] tabular-nums text-text-secondary">
                              {resultat.total}/{attendus.length}
                            </span>
                            <Lock size={11} className="text-text-muted" />
                            {(s.createdBy === moi || isAdminRole(role)) && (
                              <button
                                type="button"
                                onClick={() => void remove('polls', s.id)}
                                className="border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-muted hover:border-danger/60 hover:text-danger"
                              >
                                {t('sondages.supprimer')}
                              </button>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {reste.length > 0 && (
                  <>
                    <p className="eyebrow border-y border-border px-4 py-2.5">{t('sondages.autresOuverts')}</p>
                    <ul className="flex flex-col">
                      {reste.map((s) => {
                        const resultat = enTeteDe(s);
                        return (
                          <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 last:border-b-0">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-text-primary">{s.question}</span>
                              <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-text-muted">
                                {profileFor(s.createdBy).name} · {relativeTime(s.createdAt)} · {voixDites(resultat.total)}
                              </span>
                            </span>
                            <span className="flex flex-shrink-0 items-center gap-2">
                              <Vote size={12} className="text-text-muted" />
                              <span className="text-sm text-text-secondary">{resultat.exaequo ? t('sondages.exaequo') : resultat.libelle}</span>
                              <span className="font-mono text-[11px] tabular-nums text-text-muted">
                                {resultat.voix}/{resultat.total}
                              </span>
                              {(s.createdBy === moi || isAdminRole(role)) && (
                                <button
                                  type="button"
                                  onClick={() => void clore(s)}
                                  className="border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary hover:text-text-primary"
                                >
                                  {t('sondages.clore')}
                                </button>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </motion.section>

              {/* À DROITE — le temps ouvert, et si le résultat peut encore bouger. */}
              <motion.aside variants={staggerItem} className="panel p-4">
                <p className="eyebrow mb-3">{t('sondages.ouEnEst')}</p>
                {depouille ? (
                  <>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('sondages.ouvertDepuis')}</p>
                    <p className="text-[23px] font-semibold tabular-nums leading-tight text-text-primary">
                      {t('sondages.enJours', { n: joursOuvert })}
                    </p>
                    {/*
                      ARBITRAGE, dit à l'écran : le système de design demande ici
                      « les jours restants ». Le modèle `polls` n'a PAS de date
                      limite — un sondage se clôt à la main, quand quelqu'un
                      décide que c'est tranché. Inventer une échéance aurait été
                      afficher un chiffre faux ; on dit donc depuis combien de
                      temps il est ouvert, ce qui est la même inquiétude sans la
                      donnée manquante.
                    */}
                    <p className="mt-2 text-xs leading-relaxed text-text-muted">{t('sondages.pasDEcheance')}</p>
                    {irreversible && (
                      <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-text-body">
                        {irreversible.manquantes === 0
                          ? t('sondages.toutLeMondeAVote')
                          : irreversible.fige
                            ? t('sondages.plusRenversable', { n: irreversible.manquantes })
                            : t('sondages.encoreRenversable', { n: irreversible.manquantes })}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm leading-relaxed text-text-secondary">{t('sondages.aucunOuvert')}</p>
                )}
              </motion.aside>
            </div>
          </>
        )}
      </motion.section>
    </EcranVide>
  );
}
