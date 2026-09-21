import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Phone, Search } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { UserAvatar } from '../components/UserAvatar';
import { FirstRun } from '../components/EmptyState';
import { EcranVide } from '../components/EtatEcran';
import { useMembers } from '../state/useMembers';
import { useProfiles } from '../state/ProfilesContext';
import { useSync, useCollection } from '../state/SyncContext';
import { useCall } from '../state/CallContext';
import { useAuth } from '../auth/AuthContext';
import { roleLabel } from '../lib/roleLabels';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';
import type { OrgMember } from '../shared/api';

interface ShiftData {
  email: string;
  day: string;
  kind: 'matin' | 'apresmidi' | 'journee' | 'repos';
}
const HEURES_DU_POSTE: Record<ShiftData['kind'], number> = { matin: 4, apresmidi: 4, journee: 8, repos: 0 };
/* La semaine pleine au sens légal français. Sert UNIQUEMENT à compter les
   temps partiels dans le relevé de droite ; rien d'autre n'en dépend. */
const TEMPS_PLEIN_H = 35;

/*
  ══════════════════════════════════════════════════════════════════
  L'ANNUAIRE À ONGLETS — les trois nombres du geste
  ══════════════════════════════════════════════════════════════════

  `ONGLET_H` : de combien l'onglet dépasse au-dessus de la fiche. Il dépasse
  TOUJOURS, y compris sur la fiche ouverte — c'est ce qui fait qu'on lit encore
  un rang de fiches rangées et non une carte posée à côté de quatre autres.

  `SORTIE_Y` : de combien la fiche consultée remonte. 26 px, soit plus que
  l'onglet : le décalage doit se voir sans qu'on le cherche.

  `PART_OUVERTE` : la part de largeur de la fiche ouverte, contre 1 pour
  chacune des autres. 2,1 et non 3 — la fiche doit gagner de la place sans
  écraser le rang, sinon on a réinventé la fiche de détail à côté d'une liste.
*/
const ONGLET_H = 18;
const SORTIE_Y = 26;
const PART_OUVERTE = 2.1;

/** Une place = un compte qui travaille. Même règle qu'amn-api (`countsAsSeat`). */
const occupeUnePlace = (m: OrgMember) => m.role !== 'guest' && (m.status === 'active' || m.status === 'invited');

const initialesDe = (nom: string) =>
  nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0]?.toUpperCase() ?? '')
    .join('');

/** Le lundi de la semaine courante, en ISO. */
function lundiCourant(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
}

/**
 * LE TROMBINOSCOPE — les visages, les rôles, et qui est là.
 *
 * Pour qui : une équipe qui ne se croise pas tous les jours. Ce que ça
 * règle : « c'est qui, déjà, et est-ce qu'il est là ? ». Rien n'est saisi
 * ici : les visages viennent des profils, les rôles des comptes, la présence
 * de la liaison, les heures du plan d'équipe. Un écran qui LIT.
 *
 * ## Ce qui domine : un rang de fiches, dont une sort
 *
 * L'écran rangeait les gens en grille de cartes égales, groupées par rôle.
 * Une grille traite tout le monde pareil, ce qui est juste comme politique et
 * mauvais comme instrument : on cherche quelqu'un en particulier, et on ne
 * peut pas le regarder sans perdre le rang.
 *
 * Un annuaire à onglets tient les deux. Les fiches sont de front, chacune
 * avec son onglet d'initiales qui dépasse ; celle qu'on consulte s'élargit et
 * remonte, sans sortir de la rangée. Les trois nombres du geste sont
 * documentés plus haut.
 *
 * ## Les fiches fermées restent LISIBLES
 *
 * Elles portent nom et rôle, pas seulement des initiales. Un annuaire dont
 * les fiches fermées ne disent rien oblige à les ouvrir une par une, ce qui
 * est exactement le travail qu'il devait supprimer.
 *
 * ## L'ambre, et l'arbitrage qu'il a demandé
 *
 * La fiche sortie du rang est ambre, entière — onglet, fond, nom, rôle et
 * détails en encre sombre, une seule région.
 *
 * ARBITRAGE ASSUMÉ. La règle générale du système de design veut que l'ambre
 * marque une DÉCISION, et une fiche ouverte n'en est pas une ; ce fichier
 * affirmait d'ailleurs le contraire (« cet écran ne demande rien, zéro ambre
 * est la bonne réponse »). La table du module `20a` tranche autrement, et sur
 * ce module-là elle a raison pour une raison précise : ici l'ambre ne dit pas
 * « décide », il dit OÙ REGARDE L'ŒIL. Sur une rangée de fiches identiques,
 * c'est la seule marque qui survit au fait que la fiche ouverte reste au
 * milieu des autres. Le garde-fou `check:signal` compte toujours un seul
 * objet, ce qui est la règle qui compte vraiment.
 */
export function DirectoryScreen() {
  const { t } = useLangue();
  const navigate = useNavigate();
  const { user, org } = useAuth();
  const { membres, prets } = useMembers();
  const { profileFor } = useProfiles();
  const { onlineEmails, configured } = useSync();
  const { call, callsAvailable, phase } = useCall();
  const postes = useCollection<ShiftData>('shifts');
  const [recherche, setRecherche] = useState('');
  const [ouverte, setOuverte] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return membres
      .map((m) => ({ ...m, nom: profileFor(m.email).name }))
      .filter((m) => !q || `${m.nom} ${m.email} ${roleLabel(m.role, null)}`.toLowerCase().includes(q))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [membres, recherche, profileFor]);
  const enLigne = membres.filter((m) => m.email === user?.email || onlineEmails.has(m.email)).length;

  /* La fiche consultée : celle qu'on a choisie, sinon la première du rang.
     Il y a TOUJOURS une fiche ouverte — un annuaire refermé sur lui-même
     n'aurait plus d'objet dominant, seulement un rang. */
  const emailOuvert = visibles.some((m) => m.email === ouverte) ? ouverte : visibles[0]?.email ?? null;

  /* LES HEURES POSÉES DE LA SEMAINE, par personne — lues dans le plan
     d'équipe, jamais saisies ici. */
  const heuresDe = useMemo(() => {
    const lundi = lundiCourant();
    const jours = new Set(
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + i);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }),
    );
    const par = new Map<string, number>();
    for (const p of postes) {
      if (!jours.has(p.day)) continue;
      par.set(p.email, (par.get(p.email) ?? 0) + (HEURES_DU_POSTE[p.kind] ?? 0));
    }
    return par;
  }, [postes]);
  const heuresMax = Math.max(1, ...[...heuresDe.values()]);
  const tempsPartiels = membres.filter((m) => {
    const h = heuresDe.get(m.email) ?? 0;
    return h > 0 && h < TEMPS_PLEIN_H;
  }).length;
  const placesOccupees = membres.filter(occupeUnePlace).length;

  const ligneDePresence = (m: (typeof visibles)[number]) => {
    const moi = m.email === user?.email;
    const online = moi || onlineEmails.has(m.email);
    const profil = profileFor(m.email);
    if (moi) return profil.presenceText || t('equipe.enLigne');
    if (!configured) return t('equipe.presenceIndisponible');
    if (online) return profil.presenceText || t('equipe.enLigne');
    return m.lastSeenAt ? t('equipe.connecteIlYa', { quand: relativeTime(m.lastSeenAt) }) : t('equipe.jamaisConnecte');
  };

  const vide = prets && membres.length <= 1;

  return (
    <EcranVide quand={Boolean(vide)} premierJour={Boolean(vide)}>
      <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={staggerItem}>
          <ScreenHeader
            eyebrow={t('collectif.surtitre', { module: t('trombi.titre') })}
            title={t('trombi.titre')}
            description={t('trombi.description')}
            phraseVide={t('trombi.vide.phrase')}
            stats={[
              { label: t('trombi.stat.membres'), value: membres.length },
              { label: t('trombi.stat.enLigne'), value: enLigne, emphasis: enLigne > 1 },
            ]}
          />
        </motion.div>

        {vide ? (
          <motion.div variants={staggerItem}>
            <FirstRun title={t('trombi.vide.titre')} action={{ label: t('trombi.vide.action'), onClick: () => navigate('/membres') }}>
              {t('trombi.vide.texte')}
            </FirstRun>
          </motion.div>
        ) : (
          <>
            <motion.div variants={staggerItem}>
              <label className="input-focus flex min-h-11 max-w-md items-center gap-2 rounded-lg border border-border bg-surface px-3">
                <Search size={15} className="flex-shrink-0 text-text-muted" />
                <input
                  type="search"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder={t('trombi.rechercher')}
                  aria-label={t('trombi.rechercher')}
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
                />
              </label>
            </motion.div>

            {visibles.length === 0 ? (
              <motion.p variants={staggerItem} className="panel px-4 py-7 text-center text-sm text-text-secondary">{t('trombi.aucunTrouve')}</motion.p>
            ) : (
              /* ═══ L'OBJET DOMINANT : le rang de fiches ═══ */
              <motion.section variants={staggerItem} className="panel-raised p-5 sm:p-6">
                <p className="eyebrow mb-3">{t('trombi.leRang')}</p>
                <div
                  className="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-2"
                  style={{ paddingTop: ONGLET_H + SORTIE_Y }}
                >
                  {visibles.map((m) => {
                    const ouvert = m.email === emailOuvert;
                    const moi = m.email === user?.email;
                    const online = moi || onlineEmails.has(m.email);
                    const heures = heuresDe.get(m.email) ?? 0;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setOuverte(m.email)}
                        aria-pressed={ouvert}
                        data-signal-groupe={ouvert ? 'fiche-ouverte' : undefined}
                        className={`input-focus relative min-w-0 border p-3 pt-4 text-left transition-[flex-grow] duration-300 motion-reduce:transition-none ${
                          ouvert
                            ? 'border-transparent bg-signal text-signal-ink md:-translate-y-[26px]'
                            : 'border-border bg-surface hover:border-border-strong'
                        }`}
                        style={{ flexGrow: ouvert ? PART_OUVERTE : 1, flexBasis: 0 }}
                      >
                        {/* L'ONGLET — il dépasse toujours, fiche ouverte comprise. */}
                        <span
                          className={`absolute left-3 flex items-center justify-center px-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${
                            ouvert ? 'bg-signal text-signal-ink' : 'border border-b-0 border-border bg-elevated text-text-secondary'
                          }`}
                          style={{ top: -ONGLET_H, height: ONGLET_H }}
                        >
                          {initialesDe(m.nom)}
                        </span>

                        <span className="flex items-center gap-2.5">
                          <span className="relative flex-shrink-0">
                            <UserAvatar email={m.email} size={ouvert ? 40 : 30} surAmbre={ouvert} />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 ${online ? 'bg-success' : 'bg-text-muted'} ${ouvert ? 'border-transparent' : 'border-surface'}`}
                            />
                          </span>
                          <span className="min-w-0">
                            {/* Une fiche fermée porte nom ET rôle : sans cela,
                                il faudrait toutes les ouvrir une par une. */}
                            <span className={`block truncate font-semibold leading-tight ${ouvert ? 'text-[19px]' : 'text-[13px] text-text-primary'}`}>
                              {m.nom}
                            </span>
                            <span className={`block truncate text-[11px] ${ouvert ? 'opacity-80' : 'text-text-secondary'}`}>
                              {roleLabel(m.role, null)}
                            </span>
                          </span>
                        </span>

                        {ouvert && (
                          <span style={{ borderTop: '1px solid rgba(8, 8, 8, 0.25)' }}
                            className="mt-3 flex flex-col gap-1 pt-3 text-[12px] leading-relaxed">
                            <span className="truncate">{m.email}</span>
                            <span className="truncate">{ligneDePresence(m)}</span>
                            <span className="truncate">
                              {heures > 0 ? t('trombi.heuresPosees', { n: heures }) : t('trombi.aucuneHeurePosee')}
                            </span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.section>
            )}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* À GAUCHE — qui fait quoi, et les heures posées de la semaine. */}
              <motion.section variants={staggerItem} className="panel p-4">
                <p className="eyebrow mb-3">{t('trombi.quiFaitQuoi')}</p>
                <ul className="flex flex-col gap-2.5">
                  {visibles.map((m) => {
                    const heures = heuresDe.get(m.email) ?? 0;
                    return (
                      <li key={m.id} className="flex items-center gap-3">
                        <UserAvatar email={m.email} size={22} />
                        <span className="w-28 flex-shrink-0 truncate text-sm text-text-primary">{m.nom}</span>
                        <span className="w-24 flex-shrink-0 truncate font-mono text-[10px] uppercase tracking-wider text-text-muted">
                          {roleLabel(m.role, null)}
                        </span>
                        <span className="flex h-4 min-w-0 flex-1 items-center">
                          <span
                            className="h-2.5 bg-border-strong"
                            style={{ width: `${(heures / heuresMax) * 100}%` }}
                            aria-hidden
                          />
                        </span>
                        <span className="w-12 flex-shrink-0 text-right font-mono text-[11px] tabular-nums text-text-secondary">
                          {heures > 0 ? `${heures} h` : '—'}
                        </span>
                        {m.email !== user?.email && onlineEmails.has(m.email) && configured && (
                          <button
                            type="button"
                            onClick={() => void call(m.email)}
                            disabled={!callsAvailable || phase !== 'idle'}
                            aria-label={t('equipe.appeler', { nom: m.nom })}
                            title={t('equipe.appeler', { nom: m.nom })}
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-40"
                          >
                            <Phone size={14} strokeWidth={1.9} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </motion.section>

              {/* À DROITE — les trois chiffres de l'effectif. */}
              <motion.aside variants={staggerItem} className="panel p-4">
                <p className="eyebrow mb-3">{t('trombi.lEffectif')}</p>
                <dl className="flex flex-col gap-3">
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('trombi.stat.membres')}</dt>
                    <dd className="text-[23px] font-semibold tabular-nums leading-tight text-text-primary">{membres.length}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('trombi.placesOccupees')}</dt>
                    <dd className="text-[23px] font-semibold tabular-nums leading-tight text-text-primary">
                      {org?.seats ? `${placesOccupees} / ${org.seats}` : placesOccupees}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('trombi.tempsPartiels')}</dt>
                    <dd className="text-[23px] font-semibold tabular-nums leading-tight text-text-primary">{tempsPartiels}</dd>
                    <dd className="mt-1 text-xs leading-relaxed text-text-muted">{t('trombi.tempsPartielsAide')}</dd>
                  </div>
                </dl>
              </motion.aside>
            </div>
          </>
        )}
      </motion.section>
    </EcranVide>
  );
}
