import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Megaphone, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { UserAvatar } from '../components/UserAvatar';
import { FirstRun } from '../components/EmptyState';
import { EcranVide, useHaloSignal } from '../components/EtatEcran';
import { useAuth } from '../auth/AuthContext';
import { isAdminRole } from '../auth/roles';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useProfiles } from '../state/ProfilesContext';
import { useMembers } from '../state/useMembers';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface AnnouncementData {
  title: string;
  body: string;
  authorEmail: string;
  createdAt: string;
  readBy: string[];
}
type Annonce = AnnouncementData & { id: string };

/*
  LA PORTÉE DE LECTURE — une barre par destinataire, jamais un pourcentage.

  `BARRE_H` est la hauteur commune des barres, sur la carte dominante comme
  dans le registre : c'est ce qui rend deux portées comparables d'un coup
  d'œil. Une barre plus courte signifierait quelque chose, et elle ne
  signifierait rien.

  Le nombre de barres est le nombre de DESTINATAIRES, toujours — y compris
  ceux qui n'ont pas lu, qui sont justement ceux qu'on vient chercher. C'est
  la raison pour laquelle il n'y a pas de pourcentage ici : à cinq personnes,
  « 60 % » est une abstraction qu'il faut retraduire en « trois sur cinq »,
  puis en « il manque Marc et Inès ». Les barres sautent les deux étapes.
*/
const BARRE_H = 56;
const BARRE_L = 40;
const BARRE_H_MENUE = 24;
const BARRE_L_MENUE = 26;

/** Le prénom, sous la barre : à cinq personnes, il suffit et il tient. */
const prenomDe = (nom: string) => nom.split(/\s+/)[0] ?? nom;

/**
 * LES ANNONCES — ce que tout le monde doit avoir lu.
 *
 * Pour qui : la personne qui gère et qui, aujourd'hui, redit trois fois la
 * même chose dans le fil parce que le fil défile. Ce que ça règle : une
 * annonce reste visible jusqu'à ce que chacun l'ait lue, et l'auteure voit
 * QUI l'a lue — pas un « vu » anonyme, des noms. Rien d'autre : ni
 * commentaires (c'est le fil), ni pièces jointes (c'est Médias).
 *
 * ## Ce qui domine : la portée, pas le texte
 *
 * Une annonce n'est pas un message envoyé, c'est un message REÇU. Tant qu'on
 * regarde ce qu'on a écrit, on ne voit rien ; l'écran ne montre donc que la
 * lecture. Sous chaque annonce, une barre par destinataire — pleine s'il a
 * lu, creuse sinon, son prénom dessous. Les cinq barres sont TOUJOURS
 * dessinées : c'est ce qui rend l'écart entre ce qu'on a diffusé et ce qui
 * est arrivé immédiat, sans soustraction à faire de tête.
 *
 * ## L'ambre : la MOINS LUE, et non la plus récente
 *
 * C'est le seul point de cet écran où l'on pourrait se tromper sans le voir.
 * Mettre en tête la dernière annonce serait trier par date, et la date ne
 * demande aucune décision : une annonce d'hier que tout le monde a lue est
 * réglée, tandis qu'une annonce de la semaine dernière lue par une seule
 * personne ne l'est pas du tout. L'ambre va donc à la plus mal reçue ; à
 * égalité, à la plus ancienne, qui a eu plus de temps pour être lue.
 *
 * Quand toutes les annonces sont lues par tout le monde, il n'y a plus d'ambre
 * du tout — il n'y a plus rien à relancer.
 */
export function AnnouncementsScreen() {
  const { t } = useLangue();
  const { user, role } = useAuth();
  const { upsert, remove } = useSync();
  const { profileFor } = useProfiles();
  const { membres } = useMembers();
  const brutes = useCollection<AnnouncementData>('announcements');
  const [titre, setTitre] = useState('');
  const [corps, setCorps] = useState('');
  const [ouverte, setOuverte] = useState(false);

  const moi = user?.email ?? '';
  const annonces = useMemo(() => [...brutes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [brutes]);
  const destinataires = useMemo(() => membres.map((m) => m.email).filter(Boolean), [membres]);
  const aLu = (a: Annonce, email: string) => (a.readBy ?? []).includes(email);
  const porteeDe = (a: Annonce) => destinataires.filter((e) => aLu(a, e)).length;
  const nonLues = annonces.filter((a) => !aLu(a, moi) && a.authorEmail !== moi);

  /*
    LA MOINS LUE. Le tri porte sur la PORTÉE d'abord, la date ensuite — et
    l'ordre de ces deux clés est tout l'écran. Une annonce lue par tout le
    monde n'entre pas dans la course : elle a fini son travail.
  */
  const laMoinsLue = useMemo(() => {
    const encoreEnTravail = annonces.filter((a) => porteeDe(a) < destinataires.length);
    return (
      [...encoreEnTravail].sort((a, b) => porteeDe(a) - porteeDe(b) || a.createdAt.localeCompare(b.createdAt))[0] ?? null
    );
  }, [annonces, destinataires]);
  const lesAutres = annonces.filter((a) => a.id !== laMoinsLue?.id);
  const halo = useHaloSignal(Boolean(laMoinsLue));

  /*
    QUI LIT QUOI — une barre par personne, sur les annonces en cours.

    « En cours » : celles que tout le monde n'a pas encore lues. Compter les
    annonces réglées ferait remonter tout le monde à 100 % et effacerait
    précisément ce qu'on veut voir.
  */
  const enCours = useMemo(() => annonces.filter((a) => porteeDe(a) < destinataires.length), [annonces, destinataires]);
  const parPersonne = useMemo(
    () =>
      destinataires
        .map((email) => ({
          email,
          nom: profileFor(email).name,
          lues: enCours.filter((a) => aLu(a, email)).length,
        }))
        .sort((a, b) => a.lues - b.lues || a.nom.localeCompare(b.nom, 'fr')),
    [destinataires, enCours, profileFor],
  );

  /*
    LA PORTÉE MOYENNE, ET LA LONGUEUR.

    Le constat « les annonces longues perdent des lecteurs » n'est pas une
    formule écrite d'avance : il est MESURÉ sur les annonces réelles, en
    comparant la portée moyenne des plus longues à celle des plus courtes. Il
    ne s'affiche donc que s'il est vrai ici, et pas parce qu'il est vrai en
    général.
  */
  const porteeMoyenne = annonces.length === 0 ? 0 : annonces.reduce((n, a) => n + porteeDe(a), 0) / annonces.length;
  const longueurEtPortee = useMemo(() => {
    if (annonces.length < 4) return null;
    const tries = [...annonces].sort((a, b) => (a.body ?? '').length - (b.body ?? '').length);
    const moitie = Math.floor(tries.length / 2);
    const courtes = tries.slice(0, moitie);
    const longues = tries.slice(tries.length - moitie);
    const moy = (liste: Annonce[]) => liste.reduce((n, a) => n + porteeDe(a), 0) / liste.length;
    const mCourtes = moy(courtes);
    const mLongues = moy(longues);
    return mLongues < mCourtes ? { courtes: mCourtes, longues: mLongues } : null;
  }, [annonces, destinataires]);

  const publier = async () => {
    if (!titre.trim() || !moi) return;
    await upsert('announcements', uid('ann'), {
      title: titre.trim(),
      body: corps.trim(),
      authorEmail: moi,
      createdAt: new Date().toISOString(),
      readBy: [moi],
    });
    setTitre('');
    setCorps('');
    setOuverte(false);
  };
  const lire = (a: Annonce) => upsert('announcements', a.id, { ...a, readBy: [...new Set([...(a.readBy ?? []), moi])] });

  const vide = annonces.length === 0 && !ouverte;

  return (
    <EcranVide quand={vide} premierJour={vide}>
      <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={staggerItem}>
          <ScreenHeader
            eyebrow={t('collectif.surtitre', { module: t('annonces.titre') })}
            title={t('annonces.titre')}
            description={t('annonces.description')}
            phraseVide={t('annonces.vide.phrase')}
            stats={[
              { label: t('annonces.stat.nonLues'), value: nonLues.length, emphasis: nonLues.length > 0 },
              { label: t('annonces.stat.total'), value: annonces.length },
            ]}
            actions={
              <button type="button" onClick={() => setOuverte((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
                <Megaphone size={16} strokeWidth={2} />
                {t('annonces.publier')}
              </button>
            }
          />
        </motion.div>

        {ouverte && (
          <motion.form
            variants={staggerItem}
            onSubmit={(e) => {
              e.preventDefault();
              void publier();
            }}
            className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder={t('annonces.champTitre')}
              aria-label={t('annonces.champTitre')}
              className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none"
              autoFocus
            />
            <textarea
              value={corps}
              onChange={(e) => setCorps(e.target.value)}
              placeholder={t('annonces.champCorps')}
              aria-label={t('annonces.champCorps')}
              rows={4}
              className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={!titre.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">
                {t('annonces.envoyer')}
              </button>
              <button type="button" onClick={() => setOuverte(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
                {t('chrome.fermer')}
              </button>
            </div>
          </motion.form>
        )}

        {vide ? (
          <motion.div variants={staggerItem}>
            <FirstRun title={t('annonces.vide.titre')} action={{ label: t('annonces.vide.action'), onClick: () => setOuverte(true) }}>
              {t('annonces.vide.texte')}
            </FirstRun>
          </motion.div>
        ) : (
          <>
            {/* ═══ L'OBJET DOMINANT : l'annonce la moins lue, et sa portée ═══ */}
            {laMoinsLue && (
              <motion.article
                variants={staggerItem}
                data-signal-groupe="la-moins-lue"
                className={`bg-signal p-5 text-signal-ink sm:p-6 ${halo}`}
              >
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">
                  {t('annonces.laMoinsLue')} · {relativeTime(laMoinsLue.createdAt)}
                </p>
                <h2 className="mt-3 text-[23px] font-semibold leading-snug [overflow-wrap:anywhere] sm:text-[27px]">{laMoinsLue.title}</h2>
                {laMoinsLue.body && <p className="mt-2.5 max-w-2xl whitespace-pre-wrap text-[15px] leading-relaxed opacity-85">{laMoinsLue.body}</p>}

                {/* Les cinq barres, toujours dessinées. Pleines en encre noire,
                    creuses en noir transparent. */}
                <div className="mt-5 flex flex-wrap items-end gap-3">
                  {destinataires.map((email) => {
                    const lu = aLu(laMoinsLue, email);
                    return (
                      <div key={email} className="flex flex-col items-center gap-1.5" style={{ width: BARRE_L }}>
                        <span
                          className="w-full"
                          style={{
                            height: BARRE_H,
                            backgroundColor: lu ? 'var(--color-signal-ink)' : 'rgba(8, 8, 8, 0.12)',
                            border: lu ? 'none' : '1.5px solid rgba(8, 8, 8, 0.5)',
                          }}
                          aria-hidden
                        />
                        <span className={`w-full truncate text-center font-mono text-[9.5px] font-bold uppercase tracking-wider ${lu ? '' : 'opacity-60'}`}>
                          {prenomDe(profileFor(email).name)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-wider">
                  {t('annonces.recueParSur', { n: porteeDe(laMoinsLue), total: destinataires.length })}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {!aLu(laMoinsLue, moi) && (
                    <button
                      type="button"
                      onClick={() => void lire(laMoinsLue)}
                      style={{ border: '1.5px solid var(--color-signal-ink)' }}
                      className="flex min-h-10 items-center gap-2 px-4 font-mono text-[11px] font-bold uppercase tracking-wider"
                    >
                      <Check size={14} strokeWidth={2.5} /> {t('annonces.marquerLu')}
                    </button>
                  )}
                  {(laMoinsLue.authorEmail === moi || isAdminRole(role)) && (
                    <button
                      type="button"
                      onClick={() => void remove('announcements', laMoinsLue.id)}
                      style={{ border: '1.5px solid rgba(8, 8, 8, 0.45)' }}
                      className="flex min-h-10 items-center gap-1.5 px-3 font-mono text-[10px] font-bold uppercase tracking-wider opacity-70"
                    >
                      <Trash2 size={12} /> {t('annonces.supprimer')}
                    </button>
                  )}
                </div>
              </motion.article>
            )}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* LES AUTRES ANNONCES — mêmes barres, même règle, sans ambre. */}
              <motion.section variants={staggerItem} className="panel">
                <p className="eyebrow border-b border-border px-4 py-2.5">{t('annonces.lesAutres')}</p>
                {lesAutres.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-text-muted">{t('annonces.aucuneAutre')}</p>
                ) : (
                  <ul className="flex flex-col">
                    {lesAutres.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-border px-4 py-3.5 last:border-b-0">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-text-primary">{a.title}</span>
                          <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-text-muted">
                            {profileFor(a.authorEmail).name} · {relativeTime(a.createdAt)}
                          </span>
                        </span>
                        <span className="flex flex-shrink-0 items-end gap-1.5">
                          {destinataires.map((email) => (
                            <span key={email} className="flex flex-col items-center gap-1" style={{ width: BARRE_L_MENUE }}>
                              <span
                                className="w-full"
                                style={{
                                  height: BARRE_H_MENUE,
                                  backgroundColor: aLu(a, email) ? 'var(--color-text-body)' : 'transparent',
                                  border: aLu(a, email) ? 'none' : '1.5px solid var(--color-border-strong)',
                                }}
                                aria-hidden
                              />
                              <span className="w-full truncate text-center font-mono text-[8.5px] uppercase tracking-wider text-text-muted">
                                {prenomDe(profileFor(email).name)}
                              </span>
                            </span>
                          ))}
                        </span>
                        <span className="flex flex-shrink-0 items-center gap-2">
                          {!aLu(a, moi) && (
                            <button
                              type="button"
                              onClick={() => void lire(a)}
                              className="flex items-center gap-1.5 border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary hover:text-text-primary"
                            >
                              <Check size={11} /> {t('annonces.marquerLu')}
                            </button>
                          )}
                          {(a.authorEmail === moi || isAdminRole(role)) && (
                            <button
                              type="button"
                              onClick={() => void remove('announcements', a.id)}
                              aria-label={t('annonces.supprimer')}
                              title={t('annonces.supprimer')}
                              className="border border-border px-2 py-1 text-text-muted hover:border-danger/60 hover:text-danger"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.section>

              <div className="flex flex-col gap-5">
                {/* À GAUCHE DU PLI SUR TÉLÉPHONE, À DROITE SUR ÉCRAN : qui lit quoi. */}
                <motion.aside variants={staggerItem} className="panel p-4">
                  <p className="eyebrow mb-3">{t('annonces.quiLitQuoi')}</p>
                  {enCours.length === 0 ? (
                    <p className="text-sm leading-relaxed text-text-secondary">{t('annonces.toutEstLu')}</p>
                  ) : (
                    <ul className="flex flex-col gap-2.5">
                      {parPersonne.map((p) => (
                        <li key={p.email} className="flex items-center gap-2.5">
                          <UserAvatar email={p.email} size={22} />
                          <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{p.nom}</span>
                          <span className="flex flex-shrink-0 gap-1">
                            {enCours.map((a) => (
                              <span
                                key={a.id}
                                className="h-4 w-2.5"
                                style={{
                                  backgroundColor: aLu(a, p.email) ? 'var(--color-text-body)' : 'transparent',
                                  border: aLu(a, p.email) ? 'none' : '1.5px solid var(--color-border-strong)',
                                }}
                                aria-hidden
                              />
                            ))}
                          </span>
                          <span className="w-10 flex-shrink-0 text-right font-mono text-[11px] tabular-nums text-text-secondary">
                            {p.lues}/{enCours.length}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.aside>

                <motion.aside variants={staggerItem} className="panel p-4">
                  <p className="eyebrow mb-3">{t('annonces.laPortee')}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('annonces.porteeMoyenne')}</p>
                  <p className="text-[23px] font-semibold tabular-nums leading-tight text-text-primary">
                    {porteeMoyenne.toFixed(1).replace('.', ',')} / {destinataires.length}
                  </p>
                  {longueurEtPortee && (
                    <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-text-body">
                      {t('annonces.longuesPerdent', {
                        longues: longueurEtPortee.longues.toFixed(1).replace('.', ','),
                        courtes: longueurEtPortee.courtes.toFixed(1).replace('.', ','),
                      })}
                    </p>
                  )}
                </motion.aside>
              </div>
            </div>
          </>
        )}
      </motion.section>
    </EcranVide>
  );
}
