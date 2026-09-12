import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarOff, Check, Plus, X } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../auth/AuthContext';
import { isAdminRole } from '../auth/roles';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useProfiles } from '../state/ProfilesContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

type LeaveKind = 'conge' | 'maladie' | 'teletravail' | 'autre';
type LeaveStatus = 'pending' | 'approved' | 'declined';
interface LeaveData {
  email: string;
  from: string;
  to: string;
  kind: LeaveKind;
  note: string;
  status: LeaveStatus;
  decidedBy: string | null;
  createdAt: string;
}
const KINDS: LeaveKind[] = ['conge', 'maladie', 'teletravail', 'autre'];
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/**
 * LES ABSENCES — congés, maladie, télétravail, et qui est là aujourd'hui.
 *
 * Pour qui : une équipe où l'absence se dit à l'oral et se découvre le jour
 * même. Ce que ça règle : une demande datée, validée par qui gère, lisible
 * par tous ; et en haut, la seule question du matin — « qui est absent
 * aujourd'hui ? ». Pas de compteur de jours acquis : ce serait une paie, et
 * ce n'en est pas une.
 *
 * ## Ce qui domine : la frise des quinze jours
 *
 * L'écran empilait trois listes — à valider, à venir, passées — et la seule
 * question du matin, celle que ce fichier annonce en tête, était reléguée dans
 * la ligne de description, en 14 px gris. Pire : « à venir » rangeait par date
 * de début, ce qui ne dit rien de la question qui compte vraiment pour qui
 * gère — QUAND est-ce que l'équipe sera trop mince.
 *
 * Une absence n'est pas une case, c'est une PLAGE : `from` → `to`. La
 * composition part de là. Quinze jours en abscisse, une ligne par personne
 * concernée, une barre continue par absence, un trait vertical sur
 * aujourd'hui. On lit d'un coup les chevauchements, c'est-à-dire les jours où
 * il manquera deux personnes en même temps.
 *
 * ## L'écart avec le Planning d'équipe, qui est l'écran voisin
 *
 * Les deux parlent de personnes et de jours, et c'était le vrai risque de
 * cette famille. Ils ne se ressemblent pas parce que leurs données n'ont pas
 * la même forme : le planning est fait d'ENREGISTREMENTS PAR JOUR, donc de
 * jetons qu'on pose et qu'on retire un par un ; une absence est un
 * INTERVALLE, donc une barre qui s'étend. Le planning se range par jour, la
 * frise par personne. Aucune grille ici, aucune barre là-bas.
 *
 * ## L'ambre
 *
 * Sur les demandes à valider, et seulement pour qui peut les valider. C'est la
 * seule décision de l'écran : une absence en attente bloque quelqu'un qui ne
 * sait pas s'il peut réserver son train. Être absent n'est pas une décision,
 * c'est un fait ; la frise n'a donc aucun ambre, même sur un jour à deux
 * absents.
 */
export function LeavesScreen() {
  const { t, langue } = useLangue();
  const { user, role } = useAuth();
  const { upsert, remove } = useSync();
  const { profileFor } = useProfiles();
  const brutes = useCollection<LeaveData>('leaves');
  const [ouvert, setOuvert] = useState(false);
  const [kind, setKind] = useState<LeaveKind>('conge');
  const [from, setFrom] = useState(aujourdhui());
  const [to, setTo] = useState(aujourdhui());
  const [note, setNote] = useState('');
  const moi = user?.email ?? '';
  const admin = isAdminRole(role);
  const jour = aujourdhui();

  const absences = useMemo(() => [...brutes].sort((a, b) => a.from.localeCompare(b.from)), [brutes]);
  const absentsAujourdhui = absences.filter((a) => a.status === 'approved' && a.from <= jour && a.to >= jour);
  const enAttente = absences.filter((a) => a.status === 'pending');
  const aVenir = absences.filter((a) => a.status === 'approved' && a.to >= jour);
  const passees = absences.filter((a) => a.status !== 'pending' && a.to < jour);

  const libelleKind = (k: LeaveKind) => t(`absences.type.${k}` as Parameters<typeof t>[0]);
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const dates = (a: LeaveData) => {
    const f = new Date(`${a.from}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    const d = new Date(`${a.to}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    return a.from === a.to ? f : `${f} → ${d}`;
  };

  /*
    LA FRISE — quinze jours, une ligne par personne concernée.

    Quinze et pas trente : au-delà, les barres deviennent des traits et on ne
    lit plus rien à 1180 px. Quinze jours couvrent la question qu'on se pose
    vraiment — « et la semaine prochaine ? ».

    Seules les absences VALIDÉES y figurent. Une demande en attente n'est pas
    un fait : la dessiner ferait croire que le trou est acquis alors que c'est
    justement ce qu'on doit décider, et c'est le rôle de la carte de tête.
  */
  const FENETRE = 15;
  const frise = useMemo(() => {
    const debut = new Date(`${jour}T00:00:00`);
    const jours = Array.from({ length: FENETRE }, (_, i) => {
      const d = new Date(debut);
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const fin = jours[jours.length - 1];
    const dedans = absences.filter((a) => a.status === 'approved' && a.to >= jour && a.from <= fin);
    const parPersonne = new Map<string, (LeaveData & { id: string })[]>();
    for (const a of dedans) parPersonne.set(a.email, [...(parPersonne.get(a.email) ?? []), a]);
    /* Combien de personnes manquent chaque jour : c'est le chiffre que qui
       gère cherche, et il ne se lit pas dans une liste triée par date. */
    const parJour = jours.map((d) => dedans.filter((a) => a.from <= d && a.to >= d).length);
    const pire = parJour.reduce((best, n, i) => (n > parJour[best] ? i : best), 0);
    return { jours, parPersonne: [...parPersonne.entries()], parJour, pire };
  }, [absences, jour]);

  const dateCourte = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  const demander = async () => {
    if (!moi || !from || !to || to < from) return;
    await upsert('leaves', uid('leave'), { email: moi, from, to, kind, note: note.trim(), status: admin ? 'approved' : 'pending', decidedBy: admin ? moi : null, createdAt: new Date().toISOString() });
    setNote('');
    setOuvert(false);
  };
  const decider = (a: LeaveData & { id: string }, status: LeaveStatus) => upsert('leaves', a.id, { ...a, status, decidedBy: moi });

  const Ligne = ({ a }: { a: LeaveData & { id: string } }) => (
    <li className="flex flex-wrap items-center justify-between gap-3 bg-surface px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar email={a.email} size={32} />
        <div className="min-w-0">
          <p className="truncate text-sm text-text-primary">
            {profileFor(a.email).name} <span className="text-text-muted">· {libelleKind(a.kind)}</span>
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            {dates(a)}
            {a.note && <span className="normal-case tracking-normal"> · {a.note}</span>}
          </p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1.5">
        <span className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${a.status === 'approved' ? 'border-success/40 text-success' : a.status === 'declined' ? 'border-border text-text-muted' : 'border-warning/40 text-warning'}`}>
          {t(`absences.statut.${a.status}` as Parameters<typeof t>[0])}
        </span>
        {a.status === 'pending' && admin && a.email !== moi && (
          <>
            <button type="button" onClick={() => void decider(a, 'approved')} className="flex min-h-11 items-center gap-1 border border-border-strong px-2.5 text-xs text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1.5"><Check size={12} /> {t('absences.valider')}</button>
            <button type="button" onClick={() => void decider(a, 'declined')} className="flex min-h-11 items-center gap-1 border border-border px-2.5 text-xs text-text-muted hover:text-text-primary md:min-h-0 md:py-1.5"><X size={12} /> {t('absences.refuser')}</button>
          </>
        )}
        {(a.email === moi || admin) && a.status !== 'approved' && (
          <button type="button" onClick={() => void remove('leaves', a.id)} className="border border-border px-2.5 py-1.5 text-xs text-text-muted hover:text-danger">{t('absences.retirer')}</button>
        )}
      </div>
    </li>
  );

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('collectif.surtitre', { module: t('absences.titre') })}
          title={t('absences.titre')}
          description={absentsAujourdhui.length > 0 ? t('absences.aujourdhui', { noms: absentsAujourdhui.map((a) => profileFor(a.email).name).join(', ') }) : t('absences.toutLeMonde')}
          stats={[
            { label: t('absences.stat.absents'), value: absentsAujourdhui.length, emphasis: absentsAujourdhui.length > 0 },
            { label: t('absences.stat.aValider'), value: enAttente.length, emphasis: admin && enAttente.length > 0 },
            { label: t('absences.stat.aVenir'), value: aVenir.length },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('absences.demander')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void demander(); }} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              {t('absences.champType')}
              <select value={kind} onChange={(e) => setKind(e.target.value as LeaveKind)} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none">
                {KINDS.map((k) => <option key={k} value={k}>{libelleKind(k)}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              {t('absences.champDu')}
              <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              {t('absences.champAu')}
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
            </label>
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('absences.champNote')} aria-label={t('absences.champNote')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="bg-accent px-4 py-2 text-sm font-semibold text-bg">{admin ? t('absences.enregistrer') : t('absences.envoyer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {absences.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('absences.vide.titre')} action={{ label: t('absences.vide.action'), onClick: () => setOuvert(true) }}>{t('absences.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem} className="flex flex-col gap-5">
          {/*
            LA CARTE DE TÊTE — la décision d'abord, le fait ensuite.

            Pour qui valide, ce sont les demandes en attente ; pour les autres,
            qui manque aujourd'hui. Deux publics, deux questions, jamais les
            deux en même temps.
          */}
          <section className="panel-raised p-5 sm:p-6" data-signal-groupe="a-valider">
            {admin && enAttente.length > 0 ? (
              <>
                <p className="signal-plate mb-3 inline-flex px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider">{t('absences.stat.aValider')}</p>
                <p className="text-[21px] font-semibold leading-tight text-text-primary sm:text-[27px]">
                  {enAttente.length === 1 ? t('absences.uneDemandeAValider') : t('absences.demandesAValider', { n: enAttente.length })}
                </p>
                <ul className="mt-4 flex flex-col gap-px overflow-hidden rounded-lg border border-border bg-border">
                  {enAttente.map((a) => <Ligne key={a.id} a={a} />)}
                </ul>
              </>
            ) : (
              <>
                <p className="eyebrow mb-3">{t('absences.absentsCeJour')}</p>
                {absentsAujourdhui.length === 0 ? (
                  <p className="text-[21px] font-semibold leading-tight text-text-primary sm:text-[27px]">{t('absences.toutLeMondeLa')}</p>
                ) : (
                  <ul className="flex flex-wrap gap-3">
                    {absentsAujourdhui.map((a) => (
                      <li key={a.id} className="flex items-center gap-2.5 border border-border bg-surface px-3 py-2">
                        <UserAvatar email={a.email} size={32} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-text-primary">{profileFor(a.email).name}</span>
                          <span className="block font-mono text-[10px] uppercase tracking-wider text-text-muted">{libelleKind(a.kind)} · {dates(a)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>

          {/*
            LA FRISE — l'objet propre de ce module : des PLAGES, pas des cases.
            Voir l'en-tête du fichier pour l'écart avec le Planning d'équipe.
          */}
          <section className="panel p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="eyebrow">{t('absences.frise')}</p>
              <p className="text-[11px] text-text-muted">{t('absences.friseAide')}</p>
            </div>

            {frise.parPersonne.length === 0 ? (
              <p className="mt-4 text-sm text-text-secondary">{t('absences.personneNeManque')}</p>
            ) : (
              <>
                <p className="mt-3 text-sm text-text-secondary">
                  {t('absences.jourLePlusMince', { jour: dateCourte(frise.jours[frise.pire]), n: frise.parJour[frise.pire] })}
                </p>
                <div className="mt-4 overflow-x-auto">
                  <div className="min-w-[34rem]">
                    {/* L'échelle des jours, et le trait d'aujourd'hui à gauche. */}
                    <div className="mb-1.5 flex">
                      <span className="w-28 flex-shrink-0" />
                      <span className="flex flex-1">
                        {frise.jours.map((d, i) => (
                          <span key={d} className={`flex-1 text-center font-mono text-[9px] uppercase tracking-wider ${i === 0 ? 'text-text-primary' : 'text-text-muted'}`}>
                            {new Date(`${d}T00:00:00`).getDate()}
                          </span>
                        ))}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {frise.parPersonne.map(([email, siennes]) => (
                        <li key={email} className="flex items-center">
                          <span className="flex w-28 flex-shrink-0 items-center gap-2 pr-3">
                            <UserAvatar email={email} size={22} />
                            <span className="min-w-0 truncate text-xs text-text-primary">{profileFor(email).name}</span>
                          </span>
                          <span className="relative flex h-7 flex-1 items-center">
                            {/* La règle de fond : quinze cases vides, pour que
                                l'œil situe la barre sans compter les jours. */}
                            <span className="absolute inset-0 flex" aria-hidden>
                              {frise.jours.map((d) => (
                                <span key={d} className="flex-1 border-r border-border last:border-r-0" />
                              ))}
                            </span>
                            {siennes.map((a) => {
                              const de = Math.max(0, frise.jours.indexOf(a.from < frise.jours[0] ? frise.jours[0] : a.from));
                              const jusqua = a.to > frise.jours[frise.jours.length - 1] ? frise.jours.length - 1 : frise.jours.indexOf(a.to);
                              const largeur = Math.max(1, jusqua - de + 1);
                              return (
                                <span
                                  key={a.id}
                                  title={`${libelleKind(a.kind)} · ${dates(a)}`}
                                  className="absolute flex h-5 items-center overflow-hidden border border-border-strong bg-elevated px-2"
                                  style={{ left: `${(de / frise.jours.length) * 100}%`, width: `${(largeur / frise.jours.length) * 100}%` }}
                                >
                                  <span className="truncate font-mono text-[9px] uppercase tracking-wider text-text-secondary">{libelleKind(a.kind)}</span>
                                </span>
                              );
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* LE REGISTRE — ce qui n'est ni décision ni frise : la trace. */}
          <section>
            <p className="eyebrow mb-2 flex items-center gap-2"><CalendarOff size={12} /> {t('absences.leRegistre')}</p>
            <ul className="flex flex-col gap-px overflow-hidden rounded-xl border border-border bg-border">
              {[...(admin ? [] : enAttente), ...aVenir, ...passees].map((a) => <Ligne key={a.id} a={a} />)}
            </ul>
          </section>
        </motion.div>
      )}
    </motion.section>
  );
}
