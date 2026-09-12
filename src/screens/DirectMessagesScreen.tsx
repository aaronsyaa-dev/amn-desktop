import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowUp, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../auth/AuthContext';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useProfiles } from '../state/ProfilesContext';
import { useMembers } from '../state/useMembers';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';
import { useNavigate } from 'react-router-dom';

interface DmData {
  from: string;
  to: string;
  body: string;
  createdAt: string;
}

/** La clé d'une conversation à deux : la même dans les deux sens. */
const cle = (a: string, b: string) => [a, b].sort().join('|');

/**
 * LES MESSAGES PRIVÉS — écrire à une personne, sans le groupe.
 *
 * Pour qui : Mohamed et Riyad, qui se parlaient dans le fil d'équipe pour
 * des choses qui ne regardaient qu'eux deux. Ce que ça règle : une
 * conversation à deux, à côté du fil, avec la présence et la dernière
 * connexion sous les yeux.
 *
 * Une limite dite en clair, parce qu'elle décide de l'usage : la
 * synchronisation est celle de l'ORGANISATION. Ces messages restent hors du
 * fil et hors de l'écran des autres, mais ils vivent dans les données de
 * l'organisation, comme une fiche client — pas dans un coffre chiffré entre
 * deux personnes. Pour un secret, il y a le Coffre-fort.
 *
 * ## Ce qui domine : celui à qui vous devez une réponse
 *
 * L'écran ouvrait sur un rail de personnes et un panneau vide — « Choisissez
 * une personne à gauche ». Trois autres écrans font déjà ce rail (Notes,
 * Pages, Contrôles), et un quatrième en aurait fait un gabarit de plus.
 *
 * Or ce module sait quelque chose que le rail ne disait pas. Le modèle n'a pas
 * de `readBy`, mais il n'en a pas besoin : si le DERNIER message d'un fil vient
 * de l'autre, la balle est dans mon camp. C'est une vraie dette, calculée sans
 * rien ajouter au modèle, et c'est la seule chose de cet écran qui demande une
 * décision.
 *
 * Celui qui attend depuis le plus longtemps passe donc en tête, son dernier
 * mot cité à la taille où on le lit, avec de quoi répondre SUR PLACE. Les
 * autres descendent en liste. Choisir quelqu'un ouvre le fil en pleine
 * largeur : une conversation n'a pas à se lire dans un tiers d'écran.
 *
 * ## L'écart avec les trois autres écrans qui montrent des gens
 *
 * Annonces demande qui a lu, Appels qui est joignable à la seconde, Groupes
 * quelle salle a parlé en dernier. Ici la question est : à qui dois-je une
 * réponse. Quatre questions différentes, quatre compositions différentes — et
 * c'est la boîte de réponse posée dans la carte de tête qui fait celle-ci :
 * on n'y regarde pas des gens, on y répond à quelqu'un.
 *
 * ## L'ambre
 *
 * Sur « attend votre réponse », et nulle part ailleurs. La présence n'est pas
 * ambre : être en ligne est un état, et un état sain. Un message sans réponse
 * depuis trois jours est une dette.
 */
export function DirectMessagesScreen() {
  const { t } = useLangue();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { upsert, remove, onlineEmails } = useSync();
  const { profileFor } = useProfiles();
  const { membres, prets } = useMembers();
  const brutes = useCollection<DmData>('dms');
  const [avec, setAvec] = useState<string | null>(null);
  const [texte, setTexte] = useState('');
  const fin = useRef<HTMLDivElement | null>(null);
  const moi = user?.email ?? '';

  const autres = useMemo(() => membres.filter((m) => m.email !== moi), [membres, moi]);
  const miens = useMemo(() => brutes.filter((m) => m.from === moi || m.to === moi), [brutes, moi]);
  const dernierPar = useMemo(() => {
    const map = new Map<string, DmData & { id: string }>();
    for (const m of miens) {
      const autre = m.from === moi ? m.to : m.from;
      const prev = map.get(autre);
      if (!prev || prev.createdAt < m.createdAt) map.set(autre, m);
    }
    return map;
  }, [miens, moi]);
  const fil = useMemo(
    () => (avec ? miens.filter((m) => cle(m.from, m.to) === cle(moi, avec)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : []),
    [miens, avec, moi],
  );
  const contacts = useMemo(
    () =>
      [...autres].sort((a, b) => {
        const da = dernierPar.get(a.email)?.createdAt ?? '';
        const db = dernierPar.get(b.email)?.createdAt ?? '';
        return db.localeCompare(da) || profileFor(a.email).name.localeCompare(profileFor(b.email).name, 'fr');
      }),
    [autres, dernierPar, profileFor],
  );

  /*
    LA DETTE — les fils dont le dernier mot vient de l'autre.

    Pas de `readBy` dans le modèle, et il n'en faut pas : « j'ai lu » n'est pas
    la question, « j'ai répondu » l'est. Le plus ancien passe en tête, parce
    qu'un silence de trois jours pèse plus qu'un silence d'une heure.
  */
  const enDette = useMemo(
    () =>
      autres
        .map((m) => ({ membre: m, dernier: dernierPar.get(m.email) }))
        .filter((x) => x.dernier && x.dernier.from !== moi)
        .sort((a, b) => (a.dernier as DmData).createdAt.localeCompare((b.dernier as DmData).createdAt)),
    [autres, dernierPar, moi],
  );
  const dette = enDette[0] ?? null;
  /* Les autres dettes remontent en tête de la liste : l'en-tête annonce
     « attendent : 2 », et la deuxième ne doit pas se retrouver derrière trois
     conversations où c'est moi qui ai eu le dernier mot. */
  const enDetteAussi = useMemo(() => new Set(enDette.map((x) => x.membre.email)), [enDette]);
  const suite = useMemo(
    () =>
      contacts
        .filter((m) => m.email !== dette?.membre.email)
        .sort((a, b) => Number(enDetteAussi.has(b.email)) - Number(enDetteAussi.has(a.email))),
    [contacts, dette, enDetteAussi],
  );

  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'end' });
  }, [fil.length, avec]);

  /* `destinataire` explicite : la carte de tête répond sans ouvrir le fil, donc
     sans passer par `avec`. */
  const envoyerA = async (destinataire: string, corps: string) => {
    if (!corps.trim() || !destinataire || !moi) return;
    await upsert('dms', uid('dm'), { from: moi, to: destinataire, body: corps.trim(), createdAt: new Date().toISOString() });
  };
  const envoyer = async () => {
    if (!avec) return;
    const corps = texte;
    setTexte('');
    await envoyerA(avec, corps);
  };
  const [reponseRapide, setReponseRapide] = useState('');
  const repondreSurPlace = async () => {
    if (!dette) return;
    const corps = reponseRapide;
    setReponseRapide('');
    await envoyerA(dette.membre.email, corps);
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('collectif.surtitre', { module: t('dm.titre') })}
          title={t('dm.titre')}
          description={t('dm.description')}
          stats={[
            { label: t('dm.stat.attendent'), value: enDette.length, emphasis: enDette.length > 0 },
            { label: t('dm.stat.conversations'), value: dernierPar.size },
            { label: t('dm.stat.enLigne'), value: autres.filter((m) => onlineEmails.has(m.email)).length },
          ]}
        />
      </motion.div>

      {prets && autres.length === 0 ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('dm.vide.titre')} action={{ label: t('dm.vide.action'), onClick: () => navigate('/membres') }}>
            {t('dm.vide.texte')}
          </FirstRun>
        </motion.div>
      ) : (
        <>
          {/* LE FIL OUVERT — pleine largeur. Une conversation ne se lit pas
              dans un tiers d'écran à côté d'un rail de noms. */}
          {avec ? (
            <motion.div variants={staggerItem} className="flex min-h-[60vh] flex-col rounded-xl border border-border bg-surface">
              <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                <button type="button" onClick={() => setAvec(null)} aria-label={t('dm.retour')} className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover">
                  <ArrowLeft size={16} />
                </button>
                <UserAvatar email={avec} size={32} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{profileFor(avec).name}</p>
                  <p className="text-xs text-text-muted">{onlineEmails.has(avec) ? t('equipe.enLigne') : avec}</p>
                </div>
              </header>
              <div className="flex min-h-[40vh] flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
                {fil.length === 0 && <p className="m-auto text-sm text-text-muted">{t('dm.premier', { nom: profileFor(avec).name })}</p>}
                {fil.map((m) => {
                  const mien = m.from === moi;
                  return (
                    <div key={m.id} className={`group flex max-w-[80%] flex-col ${mien ? 'self-end items-end' : 'self-start items-start'}`}>
                      <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed [overflow-wrap:anywhere] ${mien ? 'bg-accent-muted text-text-primary' : 'bg-bg text-text-primary'}`}>{m.body}</div>
                      <span className="mt-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        {relativeTime(m.createdAt)}
                        {mien && (
                          <button type="button" onClick={() => void remove('dms', m.id)} aria-label={t('dm.supprimer')} title={t('dm.supprimer')} className="opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100">
                            <Trash2 size={11} />
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
                <div ref={fin} />
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void envoyer();
                }}
                className="flex items-center gap-2 border-t border-border p-2"
              >
                <input
                  value={texte}
                  onChange={(e) => setTexte(e.target.value)}
                  placeholder={t('dm.ecrire', { nom: profileFor(avec).name })}
                  aria-label={t('dm.ecrire', { nom: profileFor(avec).name })}
                  className="input-focus min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-sm text-text-primary outline-none"
                />
                <button type="submit" disabled={!texte.trim()} aria-label={t('dm.envoyer')} className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-bg disabled:opacity-40">
                  <ArrowUp size={16} strokeWidth={2.5} />
                </button>
              </form>
            </motion.div>
          ) : (
            <>
              {/* LA DETTE — celui qui attend depuis le plus longtemps, son mot
                  cité, et de quoi répondre sans ouvrir le fil. */}
              {dette && dette.dernier ? (
                <motion.section variants={staggerItem} className="panel-raised p-5 sm:p-6" data-signal-groupe="attend-ma-reponse">
                  <p className="eyebrow eyebrow-signal mb-3">{t('dm.attendVotreReponse')}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="relative flex-shrink-0">
                      <UserAvatar email={dette.membre.email} size={44} />
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-elevated ${onlineEmails.has(dette.membre.email) ? 'bg-success' : 'bg-text-muted'}`} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[17px] font-semibold leading-tight text-text-primary">{profileFor(dette.membre.email).name}</p>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        {t('dm.depuis', { quand: relativeTime(dette.dernier.createdAt) })}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 max-w-prose whitespace-pre-wrap text-[15px] leading-relaxed text-text-primary [overflow-wrap:anywhere]">{dette.dernier.body}</p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void repondreSurPlace();
                    }}
                    className="mt-5 flex items-center gap-2"
                  >
                    <input
                      value={reponseRapide}
                      onChange={(e) => setReponseRapide(e.target.value)}
                      placeholder={t('dm.ecrire', { nom: profileFor(dette.membre.email).name })}
                      aria-label={t('dm.ecrire', { nom: profileFor(dette.membre.email).name })}
                      className="input-focus min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-sm text-text-primary outline-none"
                    />
                    <button type="submit" disabled={!reponseRapide.trim()} aria-label={t('dm.envoyer')} className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-bg disabled:opacity-40">
                      <ArrowUp size={16} strokeWidth={2.5} />
                    </button>
                    <button type="button" onClick={() => setAvec(dette.membre.email)} className="flex min-h-11 items-center px-3 text-xs text-text-secondary hover:text-text-primary">
                      {t('dm.ouvrirLeFil')}
                    </button>
                  </form>
                </motion.section>
              ) : (
                <motion.section variants={staggerItem} className="panel p-5">
                  <p className="text-[17px] font-semibold leading-tight text-text-primary">{t('dm.personneNAttend')}</p>
                  <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-text-secondary">{t('dm.personneNAttendAide')}</p>
                </motion.section>
              )}

              {suite.length > 0 && (
                <motion.section variants={staggerItem} className="panel">
                  <p className="eyebrow border-b border-border px-4 py-2.5">{t('dm.lesAutres')}</p>
                  <ul className="flex flex-col gap-px bg-border">
                    {suite.map((m) => {
                      const dernier = dernierPar.get(m.email);
                      const online = onlineEmails.has(m.email);
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => setAvec(m.email)}
                            className="input-focus flex min-h-11 w-full items-center gap-3 bg-surface px-4 py-2.5 text-left transition-colors hover:bg-surface-hover"
                          >
                            <span className="relative flex-shrink-0">
                              <UserAvatar email={m.email} size={32} />
                              <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${online ? 'bg-success' : 'bg-text-muted'}`} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-text-primary">{profileFor(m.email).name}</span>
                              <span className="block truncate text-xs text-text-muted">
                                {dernier ? `${dernier.from === moi ? t('dm.vous') : ''}${dernier.body}` : t('dm.aucunMessage')}
                              </span>
                            </span>
                            {enDetteAussi.has(m.email) && (
                              <span className="flex-shrink-0 font-mono text-[9px] uppercase tracking-wider text-text-secondary">{t('dm.sansReponse')}</span>
                            )}
                            {dernier && <span className="flex-shrink-0 font-mono text-[10px] uppercase text-text-muted">{relativeTime(dernier.createdAt)}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </motion.section>
              )}
            </>
          )}
        </>
      )}
    </motion.section>
  );
}
