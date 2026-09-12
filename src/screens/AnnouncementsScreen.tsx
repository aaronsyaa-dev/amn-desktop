import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Megaphone, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { UserAvatar } from '../components/UserAvatar';
import { FirstRun } from '../components/EmptyState';
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

/**
 * LES ANNONCES — ce que tout le monde doit avoir lu.
 *
 * Pour qui : la personne qui gère et qui, aujourd'hui, redit trois fois la
 * même chose dans le fil parce que le fil défile. Ce que ça règle : une
 * annonce reste en haut jusqu'à ce que chacun l'ait lue, et l'auteure voit
 * QUI l'a lue — pas un « vu » anonyme, des noms. Rien d'autre : ni
 * commentaires (c'est le fil), ni pièces jointes (c'est Médias).
 *
 * ## Ce qui domine : la COUVERTURE, pas le texte
 *
 * Une annonce n'a pas fini son travail parce qu'elle est écrite : elle l'a fini
 * quand tout le monde l'a lue. C'est donc la lecture qui est l'objet de cet
 * écran, et pas le message — qu'on a déjà relu trois fois en l'écrivant.
 *
 * L'écran empilait des cartes égales, avec la couverture en gris, en fin de
 * carte, sous la forme « lu par 3 sur 5 · Nadia, Inès, Marc ». Une liste de
 * noms PRÉSENTS ne dit pas qui manque — or la seule question de l'autrice est
 * exactement celle-là : à qui faut-il redire ?
 *
 * La tête d'écran montre donc les deux groupes en visages : ceux qui ont lu,
 * et ceux qui n'ont pas lu. Un visage manquant se compte d'un coup d'œil là où
 * une phrase demande une soustraction.
 *
 * ## L'ambre dépend de qui regarde, et c'est voulu
 *
 * Si JE ne l'ai pas lue, la décision est la mienne et l'ambre est sur « la
 * marquer lue ». Si je l'ai lue mais que d'autres non, la décision est de
 * relancer, et l'ambre passe sur les manquants. Quand tout le monde a lu,
 * l'annonce n'appelle plus rien : aucun ambre.
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
  const nonLues = annonces.filter((a) => !(a.readBy ?? []).includes(moi) && a.authorEmail !== moi);

  /*
    LA TÊTE : la plus récente que tout le monde n'a PAS encore lue.

    « Pas encore lue par tous », et non « pas lue par moi » : une annonce que
    j'ai lue mais que deux personnes ignorent reste en travail. Quand tout est
    lu, on montre quand même la plus récente — l'écran ne doit pas se vider
    d'un coup parce que le travail est fini.
  */
  const destinataires = membres.map((m) => m.email).filter((e) => e !== '');
  const manquantsDe = (a: AnnouncementData) =>
    destinataires.filter((e) => !(a.readBy ?? []).includes(e));
  const enTete = annonces.find((a) => manquantsDe(a).length > 0) ?? annonces[0] ?? null;
  const reste = annonces.filter((a) => a.id !== enTete?.id);

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
  const lire = (a: AnnouncementData & { id: string }) =>
    upsert('announcements', a.id, { ...a, readBy: [...new Set([...(a.readBy ?? []), moi])] });

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('collectif.surtitre', { module: t('annonces.titre') })}
          title={t('annonces.titre')}
          description={t('annonces.description')}
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

      {annonces.length === 0 && !ouverte ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('annonces.vide.titre')} action={{ label: t('annonces.vide.action'), onClick: () => setOuverte(true) }}>
            {t('annonces.vide.texte')}
          </FirstRun>
        </motion.div>
      ) : (
        <>
          {enTete && (() => {
            const lus = enTete.readBy ?? [];
            const manquants = manquantsDe(enTete);
            const jeLAiLue = lus.includes(moi);
            const peutSupprimer = enTete.authorEmail === moi || isAdminRole(role);
            return (
              <motion.article
                variants={staggerItem}
                className="panel-raised p-5 sm:p-6"
                data-signal-groupe="couverture"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <UserAvatar email={enTete.authorEmail} size={24} />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    {profileFor(enTete.authorEmail).name} · {relativeTime(enTete.createdAt)}
                  </span>
                </div>

                <h2 className="mt-3.5 text-[23px] font-semibold leading-snug text-text-primary [overflow-wrap:anywhere] sm:text-[27px]">
                  {enTete.title}
                </h2>
                {enTete.body && (
                  <p className="mt-2.5 max-w-2xl whitespace-pre-wrap text-[15px] leading-relaxed text-text-body">
                    {enTete.body}
                  </p>
                )}

                {/*
                  LA COUVERTURE EN VISAGES.

                  Deux groupes, pas une phrase : les noms de ceux qui ont lu ne
                  disent pas qui manque, et c'est qui manque qu'on vient voir.
                */}
                <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:gap-8">
                  <div>
                    <p className="eyebrow mb-2">{t('annonces.ontLu', { n: lus.length, total: destinataires.length })}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {lus.map((e) => (
                        <span key={e} title={profileFor(e).name}>
                          <UserAvatar email={e} size={26} />
                        </span>
                      ))}
                    </div>
                  </div>

                  {manquants.length > 0 && (
                    <div>
                      <p className={`eyebrow mb-2 ${jeLAiLue ? 'eyebrow-signal' : ''}`}>
                        {t('annonces.nOntPasLu', { n: manquants.length })}
                      </p>
                      {/* Les manquants en creux : un visage éteint se compte
                          aussi bien qu'un visage plein, et dit mieux l'absence. */}
                      <div className="flex flex-wrap gap-1.5">
                        {manquants.map((e) => (
                          <span key={e} title={profileFor(e).name} className="opacity-40 grayscale">
                            <UserAvatar email={e} size={26} />
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {!jeLAiLue && (
                    <button
                      type="button"
                      onClick={() => void lire(enTete)}
                      className="signal-plate flex min-h-10 items-center gap-2 px-4 font-mono text-[11px] font-bold uppercase tracking-wider"
                    >
                      <Check size={14} strokeWidth={2.5} /> {t('annonces.marquerLu')}
                    </button>
                  )}
                  {peutSupprimer && (
                    <button
                      type="button"
                      onClick={() => void remove('announcements', enTete.id)}
                      className="flex min-h-10 items-center gap-1.5 border border-border px-3 font-mono text-[10px] uppercase tracking-wider text-text-muted transition-colors hover:border-danger/60 hover:text-danger"
                    >
                      <Trash2 size={12} /> {t('annonces.supprimer')}
                    </button>
                  )}
                </div>
              </motion.article>
            );
          })()}

          {/*
            LE REGISTRE — les annonces précédentes, une ligne chacune.

            Elles ont fait leur travail ou sont en train de le faire ; ce qui
            reste à en savoir tient dans un compte.
          */}
          {reste.length > 0 && (
            <motion.section variants={staggerItem} className="panel">
              <p className="eyebrow border-b border-border px-4 py-2.5">{t('annonces.precedentes')}</p>
              <ul className="flex flex-col">
                {reste.map((a) => {
                  const lus = a.readBy ?? [];
                  const manquants = manquantsDe(a);
                  const lue = lus.includes(moi);
                  const peutSupprimer = a.authorEmail === moi || isAdminRole(role);
                  return (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 last:border-b-0"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-text-primary">{a.title}</span>
                        <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-text-muted">
                          {profileFor(a.authorEmail).name} · {relativeTime(a.createdAt)}
                        </span>
                      </span>
                      <span className="tnum flex-shrink-0 font-mono text-[11px] text-text-secondary">
                        {t('annonces.luPar', { n: lus.length, total: destinataires.length })}
                      </span>
                      <span className="flex flex-shrink-0 gap-2">
                        {!lue && (
                          <button
                            type="button"
                            onClick={() => void lire(a)}
                            className="flex items-center gap-1.5 border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary hover:text-text-primary"
                          >
                            <Check size={11} /> {t('annonces.marquerLu')}
                          </button>
                        )}
                        {manquants.length === 0 && (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                            {t('annonces.toutLeMondeALu')}
                          </span>
                        )}
                        {peutSupprimer && (
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
                  );
                })}
              </ul>
            </motion.section>
          )}
        </>
      )}
    </motion.section>
  );
}
