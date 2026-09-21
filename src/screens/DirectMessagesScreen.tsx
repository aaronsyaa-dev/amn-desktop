import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowUp, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { EcranVide, useHaloSignal } from '../components/EtatEcran';
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

type Message = DmData & { id: string };

const JOUR_MS = 24 * 60 * 60 * 1000;

/*
  ════════════════════════════════════════════════════════════════════════
  LE FIL À ÉCHELLE DE TEMPS — les quatre nombres qui le gouvernent
  ════════════════════════════════════════════════════════════════════════

  Un fil de discussion ordinaire tasse tout à intervalle égal : deux messages
  séparés de quarante secondes et deux messages séparés de six jours ont
  exactement la même allure. Le silence, qui est l'information, disparaît.

  Ici l'espace vertical AVANT un message est proportionnel au temps écoulé
  depuis le précédent, à raison de `ESPACE_PAR_JOUR`. Le chiffre n'est pas
  arbitraire : le système de design pose « un blanc de six jours fait 96 px »,
  soit exactement 16 px par jour.

  `ESPACE_MIN` empêche deux messages d'une même minute de se toucher.

  `ESPACE_MAX` est la règle sans laquelle l'instrument s'effondre : un silence
  de six mois ferait 2 928 px, et le fil deviendrait illisible pour la raison
  même qui le rendait bon. Le blanc se PLAFONNE donc à dix jours — mais la
  mention, elle, porte toujours la durée RÉELLE (« silence de 183 jours »).
  C'est le point exact où le dessin ment et où le texte rétablit.

  `SILENCE_SEUIL` est le seuil à partir duquel un blanc est NOMMÉ. Il vaut
  deux jours, et ce n'est pas un réglage esthétique : à 16 px par jour, deux
  jours font 32 px, soit la hauteur minimale où un trait et sa mention tiennent
  sans se chevaucher. Le seuil et l'échelle sont donc liés — bouger l'un sans
  l'autre casserait le dessin.
*/
const ESPACE_PAR_JOUR = 16;
const ESPACE_MIN = 6;
const ESPACE_MAX = 160;
const SILENCE_SEUIL = 2 * JOUR_MS;

/** Le blanc, en pixels, qui précède un message arrivé `ms` après le précédent. */
function blancDe(ms: number): number {
  return Math.min(ESPACE_MAX, Math.max(ESPACE_MIN, (ms / JOUR_MS) * ESPACE_PAR_JOUR));
}

/** Un blanc est-il un SILENCE — c'est-à-dire mérite-t-il d'être nommé ? */
const estUnSilence = (ms: number) => ms >= SILENCE_SEUIL;

/** Le nombre de jours porté par la mention : la durée réelle, jamais la plafonnée. */
const joursDe = (ms: number) => Math.max(2, Math.round(ms / JOUR_MS));

interface Palier {
  /** Le blanc qui précède, en pixels. */
  blanc: number;
  /** La durée de ce blanc en millisecondes, si elle est nommée. */
  silence: number | null;
  /** Le message qui suit le blanc ; absent pour le blanc final, encore ouvert. */
  message: Message | null;
}

/**
 * Le fil déplié : un palier par message, plus un palier final sans message
 * qui porte le silence EN COURS — celui qui va du dernier mot à maintenant.
 */
function paliersDe(fil: Message[], maintenant: number): Palier[] {
  const paliers: Palier[] = [];
  fil.forEach((message, i) => {
    const ecart = i === 0 ? 0 : Date.parse(message.createdAt) - Date.parse(fil[i - 1].createdAt);
    paliers.push({
      blanc: i === 0 ? 0 : blancDe(ecart),
      silence: i > 0 && estUnSilence(ecart) ? ecart : null,
      message,
    });
  });
  const dernier = fil[fil.length - 1];
  if (dernier) {
    const depuis = maintenant - Date.parse(dernier.createdAt);
    paliers.push({ blanc: blancDe(depuis), silence: estUnSilence(depuis) ? depuis : null, message: null });
  }
  return paliers;
}

/**
 * Le délai de réponse HABITUEL d'un contact sur ce fil : la médiane des temps
 * qu'il a mis, dans l'historique, à répondre à un message de ma part.
 *
 * Médiane et non moyenne : un seul oubli de trois semaines tirerait une
 * moyenne au point de la rendre fausse pour les vingt réponses de dix minutes
 * qui l'entourent. Ce qu'on veut dire est « ce qu'il fait d'ordinaire ».
 *
 * `null` quand il n'a jamais répondu : on ne compare pas un silence à rien.
 */
function delaiHabituel(fil: Message[], moi: string): number | null {
  const delais: number[] = [];
  for (let i = 1; i < fil.length; i += 1) {
    if (fil[i - 1].from === moi && fil[i].from !== moi) {
      delais.push(Date.parse(fil[i].createdAt) - Date.parse(fil[i - 1].createdAt));
    }
  }
  if (delais.length === 0) return null;
  delais.sort((a, b) => a - b);
  const milieu = Math.floor(delais.length / 2);
  return delais.length % 2 === 1 ? delais[milieu] : Math.round((delais[milieu - 1] + delais[milieu]) / 2);
}

/**
 * LES MESSAGES PRIVÉS — écrire à une personne, sans le groupe.
 *
 * Pour qui : Mohamed et Riyad, qui se parlaient dans le fil d'équipe pour
 * des choses qui ne regardaient qu'eux deux. Ce que ça règle : une
 * conversation à deux, à côté du fil, avec la présence sous les yeux.
 *
 * Une limite dite en clair, parce qu'elle décide de l'usage : la
 * synchronisation est celle de l'ORGANISATION. Ces messages restent hors du
 * fil et hors de l'écran des autres, mais ils vivent dans les données de
 * l'organisation, comme une fiche client — pas dans un coffre chiffré entre
 * deux personnes. Pour un secret, il y a le Coffre-fort.
 *
 * ## Ce qui domine : le fil où le silence a une hauteur
 *
 * L'écran ouvrait sur un rail de personnes et un panneau vide, puis sur une
 * carte « attend votre réponse ». Les deux disaient quelque chose de vrai,
 * mais aucune ne montrait la chose qui compte dans une conversation à deux :
 * LE TEMPS ENTRE LES MESSAGES. Un fil ordinaire l'écrase — six jours et
 * quarante secondes s'y dessinent pareil.
 *
 * Ici l'espace vertical est le temps. Un silence de six jours occupe 96 px,
 * barré d'un trait qui le nomme. On voit la coupure avant d'avoir lu une
 * seule ligne, et c'est la seule composition qui la rende visible sans la
 * commenter. Voir l'en-tête des quatre constantes plus haut pour l'échelle et
 * pour le plafond qui la sauve d'elle-même.
 *
 * ## L'ambre, et l'arbitrage qu'il a demandé
 *
 * L'ambre est sur le dernier message que J'AI envoyé et qui n'a pas reçu de
 * réponse — la bulle, son horodatage « sans réponse », et le trait de silence
 * qui la borde. Une seule région, trois nœuds, `data-signal-groupe`.
 *
 * La table du système de design écrit que le trait ambre « précède » la
 * bulle. Dans un fil chronologique, c'est impossible : le silence qui mesure
 * l'absence de réponse SUIT forcément le message resté sans réponse, puisque
 * c'est lui qui court jusqu'à maintenant. Le trait est donc dessiné dessous,
 * au contact de la bulle et dans la même région ambre. C'est l'ordre du temps
 * qui l'emporte sur la lettre de la consigne — la consigne décrivait une
 * maquette figée, où le blanc du bas ne courait pas.
 *
 * ## L'écart avec les trois autres écrans qui montrent des gens
 *
 * Annonces demande qui a lu, Appels qui est joignable, Groupes qui appartient
 * à quoi. Ici la question est : depuis combien de temps est-ce que j'attends.
 * Quatre questions, quatre instruments.
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

  /*
    MAINTENANT, FIGÉ À L'OUVERTURE — et rafraîchi chaque minute.

    Le blanc final court jusqu'à l'instant présent : sans horloge, il serait
    calculé une fois au premier rendu et ne bougerait plus de la journée. Une
    minute suffit largement pour un instrument gradué en jours, et c'est le
    battement le moins coûteux qui garde le dessin honnête.
  */
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const battement = window.setInterval(() => setMaintenant(Date.now()), 60_000);
    return () => window.clearInterval(battement);
  }, []);

  const autres = useMemo(() => membres.filter((m) => m.email !== moi), [membres, moi]);
  const miens = useMemo(() => brutes.filter((m) => m.from === moi || m.to === moi), [brutes, moi]);

  /** Chaque fil trié du plus ancien au plus récent, indexé par le courriel de l'autre. */
  const filsPar = useMemo(() => {
    const map = new Map<string, Message[]>();
    for (const m of miens) {
      const autre = m.from === moi ? m.to : m.from;
      const liste = map.get(autre);
      if (liste) liste.push(m);
      else map.set(autre, [m]);
    }
    for (const liste of map.values()) liste.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return map;
  }, [miens, moi]);

  /*
    LE FIL DOMINANT — celui où j'attends depuis le plus longtemps.

    Un fil « attend » quand son DERNIER message est de moi : personne n'a
    répondu depuis. Entre plusieurs, c'est l'ancienneté du silence qui tranche,
    pas la date du message — c'est le même nombre, mais ce n'est pas la même
    phrase, et c'est la phrase qui décide de l'ordre.

    Sans aucun fil en attente, l'écran ouvre sur la conversation la plus
    récente et n'a AUCUN ambre. C'est la bonne réponse : rien ne demande de
    décision.
  */
  const enAttente = useMemo(
    () =>
      autres
        .map((m) => ({ membre: m, fil: filsPar.get(m.email) ?? [] }))
        .filter((x) => x.fil.length > 0 && x.fil[x.fil.length - 1].from === moi)
        .sort((a, b) => a.fil[a.fil.length - 1].createdAt.localeCompare(b.fil[b.fil.length - 1].createdAt)),
    [autres, filsPar, moi],
  );
  const plusRecent = useMemo(
    () =>
      autres
        .map((m) => ({ membre: m, fil: filsPar.get(m.email) ?? [] }))
        .filter((x) => x.fil.length > 0)
        .sort((a, b) => b.fil[b.fil.length - 1].createdAt.localeCompare(a.fil[a.fil.length - 1].createdAt))[0] ?? null,
    [autres, filsPar],
  );
  const dominant = enAttente[0] ?? plusRecent;

  /* L'écran regardé : le fil ouvert à la main l'emporte sur le fil dominant. */
  const regarde = avec ?? dominant?.membre.email ?? null;
  const fil = useMemo(() => (regarde ? filsPar.get(regarde) ?? [] : []), [filsPar, regarde]);
  const paliers = useMemo(() => paliersDe(fil, maintenant), [fil, maintenant]);

  /*
    LA BULLE AMBRE — le dernier message envoyé resté sans réponse.

    Elle n'existe que si le fil regardé est un fil EN ATTENTE. Ouvrir à la
    main une conversation où l'autre a eu le dernier mot retire donc l'ambre,
    et c'est juste : il n'y a plus rien à attendre.
  */
  const dernier = fil[fil.length - 1] ?? null;
  const bulleAmbre = dernier && dernier.from === moi ? dernier : null;
  const silenceEnCours = dernier ? maintenant - Date.parse(dernier.createdAt) : 0;
  const halo = useHaloSignal(Boolean(bulleAmbre));

  /* Le délai habituel du contact regardé, et le rapport au silence en cours. */
  const habituel = useMemo(() => (regarde ? delaiHabituel(fil, moi) : null), [fil, moi, regarde]);
  const rapport = habituel && habituel > 0 ? silenceEnCours / habituel : null;

  /* Les autres fils, avec le délai de réponse habituel de chacun. */
  const lesAutresFils = useMemo(
    () =>
      autres
        .filter((m) => m.email !== regarde)
        .map((m) => {
          const f = filsPar.get(m.email) ?? [];
          return { membre: m, fil: f, habituel: delaiHabituel(f, moi), dernier: f[f.length - 1] ?? null };
        })
        .sort((a, b) => (b.dernier?.createdAt ?? '').localeCompare(a.dernier?.createdAt ?? '')),
    [autres, filsPar, moi, regarde],
  );

  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'end' });
  }, [fil.length, regarde]);

  const envoyerA = async (destinataire: string, corps: string) => {
    if (!corps.trim() || !destinataire || !moi) return;
    await upsert('dms', uid('dm'), { from: moi, to: destinataire, body: corps.trim(), createdAt: new Date().toISOString() });
  };
  const envoyer = async () => {
    if (!regarde) return;
    const corps = texte;
    setTexte('');
    await envoyerA(regarde, corps);
  };

  /** « 6 jours », « 14 h », « 40 min » — la durée telle qu'on la dit. */
  const ditLaDuree = (ms: number): string => {
    if (ms >= JOUR_MS) return t('dm.enJours', { n: Math.round(ms / JOUR_MS) });
    if (ms >= 60 * 60 * 1000) return t('dm.enHeures', { n: Math.round(ms / (60 * 60 * 1000)) });
    return t('dm.enMinutes', { n: Math.max(1, Math.round(ms / 60_000)) });
  };

  const vide = prets && autres.length === 0;
  const nom = regarde ? profileFor(regarde).name : '';

  return (
    <EcranVide quand={Boolean(vide)} premierJour={Boolean(vide)}>
      <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={staggerItem}>
          <ScreenHeader
            eyebrow={t('collectif.surtitre', { module: t('dm.titre') })}
            title={t('dm.titre')}
            description={t('dm.description')}
            phraseVide={t('dm.vide.phrase')}
            stats={[
              { label: t('dm.stat.attendent'), value: enAttente.length, emphasis: enAttente.length > 0 },
              { label: t('dm.stat.conversations'), value: filsPar.size },
              { label: t('dm.stat.enLigne'), value: autres.filter((m) => onlineEmails.has(m.email)).length },
            ]}
          />
        </motion.div>

        {vide ? (
          <motion.div variants={staggerItem}>
            <FirstRun title={t('dm.vide.titre')} action={{ label: t('dm.vide.action'), onClick: () => navigate('/membres') }}>
              {t('dm.vide.texte')}
            </FirstRun>
          </motion.div>
        ) : (
          <>
            {/* ═══ L'OBJET DOMINANT : le fil où le silence a une hauteur ═══ */}
            {regarde && (
              <motion.section variants={staggerItem} className={`panel-raised ${halo}`}>
                <header className="flex items-center gap-3 border-b border-border-strong px-4 py-3 sm:px-6">
                  {avec && (
                    <button
                      type="button"
                      onClick={() => setAvec(null)}
                      aria-label={t('dm.retour')}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover"
                    >
                      <ArrowLeft size={16} />
                    </button>
                  )}
                  <span className="relative flex-shrink-0">
                    <UserAvatar email={regarde} size={36} />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-elevated ${onlineEmails.has(regarde) ? 'bg-success' : 'bg-text-muted'}`}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-semibold leading-tight text-text-primary">{nom}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {bulleAmbre ? t('dm.jAttendsDepuis', { duree: ditLaDuree(silenceEnCours) }) : t('dm.derniereActivite', { quand: dernier ? relativeTime(dernier.createdAt) : '—' })}
                    </p>
                  </div>
                </header>

                {/*
                  LE FIL LUI-MÊME. `overflow-y-auto` avec une hauteur bornée :
                  l'échelle de temps fait des fils longs, et un écran qui
                  s'allonge sans fin n'a plus de pied de page à lire.
                */}
                <div className="max-h-[52vh] overflow-y-auto px-4 py-4 sm:px-6">
                  {fil.length === 0 && <p className="py-8 text-center text-sm text-text-muted">{t('dm.premier', { nom })}</p>}
                  {paliers.map((palier, i) => {
                    /*
                      LA RÉGION AMBRE, ET RIEN DE PLUS.

                      Elle tient en trois nœuds : la bulle, son horodatage
                      « sans réponse », et LE SEUL trait qui mesure ce
                      silence-là — celui du bas, qui court jusqu'à maintenant.
                      Le blanc qui précède la bulle mesure autre chose (le
                      temps que j'ai mis à répondre, moi) ; le peindre en ambre
                      aussi donnerait deux traits ambre pour une seule dette et
                      diluerait exactement ce que le signal désigne.
                    */
                    const ambre =
                      Boolean(bulleAmbre) &&
                      ((palier.message !== null && palier.message.id === bulleAmbre?.id) ||
                        (palier.message === null && palier.silence !== null));
                    const traitAmbre = Boolean(bulleAmbre) && palier.message === null && palier.silence !== null;
                    return (
                      <React.Fragment key={palier.message ? palier.message.id : 'blanc-final'}>
                        {i > 0 && (
                          <div className="relative w-full" style={{ height: palier.blanc }} aria-hidden={palier.silence === null}>
                            {palier.silence !== null && (
                              <div
                                className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center gap-2"
                                data-signal-groupe={traitAmbre ? 'sans-reponse' : undefined}
                              >
                                <span className={`h-px flex-1 ${traitAmbre ? 'bg-signal' : 'bg-border'}`} />
                                {/* L'ambre est TOUJOURS une plaque pleine à encre sombre —
                                    jamais du texte ambre sur fond noir. */}
                                <span
                                  className={`flex-shrink-0 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] ${traitAmbre ? 'bg-signal text-signal-ink' : 'text-text-muted'}`}
                                >
                                  {t('dm.silenceDe', { n: joursDe(palier.silence) })}
                                </span>
                                <span className={`h-px flex-1 ${traitAmbre ? 'bg-signal' : 'bg-border'}`} />
                              </div>
                            )}
                          </div>
                        )}
                        {palier.message && (
                          <Bulle
                            message={palier.message}
                            mien={palier.message.from === moi}
                            ambre={palier.message.id === bulleAmbre?.id}
                            horodatage={
                              palier.message.id === bulleAmbre?.id ? t('dm.sansReponse') : relativeTime(palier.message.createdAt)
                            }
                            onSupprimer={() => void remove('dms', palier.message!.id)}
                            libelleSupprimer={t('dm.supprimer')}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                  <div ref={fin} />
                </div>

                {/*
                  SOUS LE FIL — ce qui reste en suspens.

                  Le système de design demande ici « le rappel que le rendez-vous
                  n'a jamais été confirmé ». ARBITRAGE : le modèle `dms` est du
                  texte libre, sans objet attaché — aucun rendez-vous n'y est
                  rattachable, et le déduire du corps du message serait deviner.
                  Ce qui EXISTE et dit la même chose : la demande elle-même,
                  citée, et le fait que la personne s'est connectée depuis sans
                  y répondre. Les deux sont vrais dans les données.
                */}
                {bulleAmbre && (
                  <div className="border-t border-border-strong px-4 py-4 sm:px-6">
                    <p className="eyebrow mb-2">{t('dm.enSuspens')}</p>
                    <p className="max-w-prose text-sm leading-relaxed text-text-body">
                      {onlineEmails.has(regarde) ? t('dm.enLigneSansRepondre', { nom }) : t('dm.pasRevuDepuis', { nom, duree: ditLaDuree(silenceEnCours) })}
                    </p>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void envoyer();
                  }}
                  className="flex items-center gap-2 border-t border-border-strong p-2 sm:px-4"
                >
                  <input
                    value={texte}
                    onChange={(e) => setTexte(e.target.value)}
                    placeholder={t('dm.ecrire', { nom })}
                    aria-label={t('dm.ecrire', { nom })}
                    className="input-focus min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-sm text-text-primary outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!texte.trim()}
                    aria-label={t('dm.envoyer')}
                    className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-bg disabled:opacity-40"
                  >
                    <ArrowUp size={16} strokeWidth={2.5} />
                  </button>
                </form>
              </motion.section>
            )}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* À GAUCHE — les autres fils et le délai de réponse habituel de chacun. */}
              <motion.section variants={staggerItem} className="panel">
                <p className="eyebrow border-b border-border px-4 py-2.5">{t('dm.lesAutresFils')}</p>
                {lesAutresFils.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-text-muted">{t('dm.aucunAutreFil')}</p>
                ) : (
                  <ul className="flex flex-col gap-px bg-border">
                    {lesAutresFils.map((entree) => (
                      <li key={entree.membre.id}>
                        <button
                          type="button"
                          onClick={() => setAvec(entree.membre.email)}
                          className="input-focus flex min-h-11 w-full items-center gap-3 bg-surface px-4 py-2.5 text-left transition-colors hover:bg-surface-hover"
                        >
                          <span className="relative flex-shrink-0">
                            <UserAvatar email={entree.membre.email} size={32} />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${onlineEmails.has(entree.membre.email) ? 'bg-success' : 'bg-text-muted'}`}
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-text-primary">{profileFor(entree.membre.email).name}</span>
                            <span className="block truncate text-xs text-text-muted">
                              {entree.dernier ? `${entree.dernier.from === moi ? t('dm.vous') : ''}${entree.dernier.body}` : t('dm.aucunMessage')}
                            </span>
                          </span>
                          <span className="flex-shrink-0 text-right">
                            <span className="block font-mono text-[11px] tabular-nums text-text-secondary">
                              {entree.habituel === null ? '—' : ditLaDuree(entree.habituel)}
                            </span>
                            <span className="block font-mono text-[9px] uppercase tracking-wider text-text-muted">{t('dm.repondDHabitude')}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.section>

              {/* À DROITE — l'habitude de ce contact contre le silence en cours. */}
              <motion.aside variants={staggerItem} className="panel p-4">
                <p className="eyebrow mb-3">{t('dm.lHabitudeEtLeSilence')}</p>
                {habituel === null ? (
                  <p className="text-sm leading-relaxed text-text-secondary">{t('dm.jamaisRepondu', { nom })}</p>
                ) : (
                  <>
                    <dl className="flex flex-col gap-3">
                      <div>
                        <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('dm.repondDHabitudeEn')}</dt>
                        <dd className="text-[19px] font-semibold tabular-nums leading-tight text-text-primary">{ditLaDuree(habituel)}</dd>
                      </div>
                      <div>
                        <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('dm.silenceActuel')}</dt>
                        <dd className="text-[19px] font-semibold tabular-nums leading-tight text-text-primary">{ditLaDuree(silenceEnCours)}</dd>
                      </div>
                    </dl>
                    {rapport !== null && rapport >= 2 && (
                      <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-text-body">
                        {t('dm.foisPlusLong', { n: Math.round(rapport) })}
                      </p>
                    )}
                  </>
                )}
                {/* La règle du plafond, dite là où elle se constate. */}
                {silenceEnCours / JOUR_MS > ESPACE_MAX / ESPACE_PAR_JOUR && (
                  <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-text-muted">{t('dm.plafond')}</p>
                )}
              </motion.aside>
            </div>
          </>
        )}
      </motion.section>
    </EcranVide>
  );
}

/**
 * UNE BULLE. Reçue à gauche sur le plan surélevé (#141414), envoyée à droite
 * un cran au-dessus (#1e1e1e) : le côté dit qui parle, la valeur de gris dit
 * la même chose une seconde fois, pour qui lit mal les côtés.
 *
 * En ambre, la bulle devient une plaque pleine à encre sombre — la règle du
 * système de design, sans exception.
 */
function Bulle({
  message,
  mien,
  ambre,
  horodatage,
  onSupprimer,
  libelleSupprimer,
}: {
  message: Message;
  mien: boolean;
  ambre: boolean;
  horodatage: string;
  onSupprimer: () => void;
  libelleSupprimer: string;
}) {
  return (
    <div className={`group flex max-w-[80%] flex-col ${mien ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
      <div
        data-signal-groupe={ambre ? 'sans-reponse' : undefined}
        className={`rounded-2xl px-3 py-2 text-sm leading-relaxed [overflow-wrap:anywhere] ${
          ambre ? 'bg-signal text-signal-ink' : mien ? 'bg-[#1e1e1e] text-text-primary' : 'bg-raised text-text-primary'
        }`}
      >
        {message.body}
      </div>
      <span
        data-signal-groupe={ambre ? 'sans-reponse' : undefined}
        className={`mt-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider ${
          ambre ? 'bg-signal px-1.5 py-0.5 font-bold text-signal-ink' : 'text-text-muted'
        }`}
      >
        {horodatage}
        {mien && !ambre && (
          <button
            type="button"
            onClick={onSupprimer}
            aria-label={libelleSupprimer}
            title={libelleSupprimer}
            className="opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
          >
            <Trash2 size={11} />
          </button>
        )}
      </span>
    </div>
  );
}
