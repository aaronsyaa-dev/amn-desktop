import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { Refus } from '../components/messages/MessagesSysteme';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';
import { useHaloSignal } from '../components/EtatEcran';

interface ResourceData {
  name: string;
  kind: string;
  createdAt: string;
}
interface BookingData {
  resourceId: string;
  startAt: string;
  endAt: string;
  purpose: string;
  byEmail: string;
  createdAt: string;
}
/* La journée ouvrable dessinée par la grille d'occupation. Au-delà, une
   réservation reste possible — elle n'est simplement pas sur la règle. */
const HEURE_DEBUT = 8;
const HEURE_FIN = 20;
const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
export const chevauche = (aDebut: string, aFin: string, bDebut: string, bFin: string) => aDebut < bFin && bDebut < aFin;

/**
 * LE MATÉRIEL — qui a quoi, quand, sans double réservation.
 *
 * Pour qui : un atelier avec une camionnette, une salle, un vidéoprojecteur,
 * une machine que trois personnes veulent le même mardi. Ce que ça règle :
 * une ressource, un créneau, et un chevauchement refusé AVANT d'exister —
 * l'écran dit qui l'a déjà. Le rendez-vous d'un client vit dans l'Agenda ;
 * ici, c'est l'objet qu'on réserve.
 */
export function EquipmentBookingScreen() {
  const { t, langue } = useLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const { user } = useAuth();
  const { upsert, remove } = useSync();
  const ressources = useCollection<ResourceData>('resources');
  const reservations = useCollection<BookingData>('resourceBookings');
  const [nom, setNom] = useState('');
  const [kind, setKind] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [startAt, setStartAt] = useState(() => localISO(new Date(Math.ceil(Date.now() / 1_800_000) * 1_800_000)));
  const [endAt, setEndAt] = useState(() => localISO(new Date(Math.ceil(Date.now() / 1_800_000) * 1_800_000 + 3_600_000)));
  const [purpose, setPurpose] = useState('');
  /*
    LE REFUS N'EST PLUS UNE PHRASE GRISE, c'est un objet.

    Il portait `string | null` et s'affichait en `text-warning` sous les champs.
    Le paquet de design en fait une forme à part entière (`Refus`, bloc 3), et
    ce module en est le MODÈLE — le composant a été écrit d'après cette maquette.
    Il lui faut donc ce qu'il promet : ce qui bloque, qui le bloque, et des
    sorties RÉELLES.
  */
  const [refus, setRefus] = useState<{
    quoi: string;
    parQui?: string;
    /** L'identifiant de la réservation qui bloque — pour la teinter dans la grille. */
    conflitId?: string;
    libres: { debut: string; fin: string }[];
  } | null>(null);

  const triees = useMemo(() => [...ressources].sort((a, b) => a.name.localeCompare(b.name)), [ressources]);
  const cible = resourceId || triees[0]?.id || '';
  const maintenant = localISO(new Date());
  const finJour = `${maintenant.slice(0, 10)}T23:59`;
  const aujourdhui = reservations.filter((r) => r.startAt <= finJour && r.endAt >= `${maintenant.slice(0, 10)}T00:00`).length;
  const aVenir = reservations.filter((r) => r.endAt >= maintenant).sort((a, b) => a.startAt.localeCompare(b.startAt));
  const nomDe = (id: string) => triees.find((r) => r.id === id)?.name ?? '—';

  const creerRessource = async () => {
    if (!nom.trim()) return;
    await upsert('resources', uid('res'), { name: nom.trim(), kind: kind.trim(), createdAt: new Date().toISOString() });
    setNom(''); setKind('');
  };
  const reserver = async () => {
    setRefus(null);
    if (!cible || !startAt || !endAt || endAt <= startAt) {
      setRefus({ quoi: t('materiel.creneauInvalide'), libres: [] });
      return;
    }
    const conflit = reservations.find((r) => r.resourceId === cible && chevauche(startAt, endAt, r.startAt, r.endAt));
    if (conflit) {
      setRefus({
        quoi: t('materiel.conflit', { qui: conflit.byEmail.split('@')[0], quand: quand(conflit.startAt, conflit.endAt) }),
        parQui: t('materiel.rienEnregistre'),
        conflitId: conflit.id,
        libres: creneauxLibres(cible, startAt.slice(0, 10)),
      });
      return;
    }
    await upsert('resourceBookings', uid('rsv'), { resourceId: cible, startAt, endAt, purpose: purpose.trim(), byEmail: user?.email ?? '', createdAt: new Date().toISOString() });
    setPurpose('');
  };
  const quand = (a: string, b: string) => `${new Date(a).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} → ${new Date(b).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;

  /*
    LES CRÉNEAUX LIBRES D'UNE RESSOURCE SUR UN JOUR — les sorties du refus.

    Calculés, jamais suggérés : le composant `Refus` exige des chemins réels,
    « jamais une suggestion inventée pour adoucir le non ». On prend la journée
    ouvrable (8 h → 20 h), on en retire les réservations existantes, et ce qui
    reste au-delà d'une demi-heure est proposable. Moins d'une demi-heure n'est
    pas un créneau, c'est un interstice.
  */
  const creneauxLibres = (ressourceId: string, jourISO: string) => {
    const bornes = (h: number) => `${jourISO}T${String(h).padStart(2, '0')}:00`;
    const prises = reservations
      .filter((r) => r.resourceId === ressourceId && r.startAt.slice(0, 10) === jourISO)
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
    const libres: { debut: string; fin: string }[] = [];
    let curseur = bornes(HEURE_DEBUT);
    for (const prise of prises) {
      if (prise.startAt > curseur) libres.push({ debut: curseur, fin: prise.startAt });
      if (prise.endAt > curseur) curseur = prise.endAt;
    }
    if (curseur < bornes(HEURE_FIN)) libres.push({ debut: curseur, fin: bornes(HEURE_FIN) });
    const demiHeure = 30 * 60_000;
    return libres
      .filter((c) => new Date(c.fin).getTime() - new Date(c.debut).getTime() >= demiHeure)
      .slice(0, 2);
  };

  const heure = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const dureeLibre = (c: { debut: string; fin: string }) => {
    const min = Math.round((new Date(c.fin).getTime() - new Date(c.debut).getTime()) / 60_000);
    return min % 60 === 0 ? `${min / 60} h` : `${Math.floor(min / 60)} h ${min % 60}`;
  };

  /** L'occupation du jour, ressource par ressource, bornée à la journée ouvrable. */
  const jourISO = maintenant.slice(0, 10);
  /*
    LA CARTE DE CONFLIT — l'objet dominant de Matériel (`15c`).

    LA RÈGLE QUI LE TIENT : les rangées ne se fusionnent JAMAIS. Deux
    réservations simultanées occupent deux lignes, sinon le chevauchement
    disparaît derrière la barre du dessus et le conflit devient invisible —
    ce qui est exactement le contraire de ce que la carte sert à montrer.

    Le découpage en rangées est un partitionnement d'intervalles glouton : on
    parcourt les réservations dans l'ordre du début, et chacune va dans la
    première rangée dont la dernière barre est finie. Le nombre de rangées est
    donc le nombre maximal de réservations simultanées — c'est-à-dire, à
    l'œil, la hauteur du conflit.
  */
  const occupation = useMemo(
    () =>
      triees.map((r) => {
        const prises = reservations
          .filter((b) => b.resourceId === r.id && b.startAt.slice(0, 10) === jourISO)
          .sort((a, b) => a.startAt.localeCompare(b.startAt));
        const rangees: (BookingData & { id: string })[][] = [];
        for (const b of prises) {
          const place = rangees.find((rg) => rg[rg.length - 1].endAt <= b.startAt);
          if (place) place.push(b);
          else rangees.push([b]);
        }
        /* Les identifiants des barres qui en chevauchent une autre : ce sont
           elles qui font le conflit, et elles seules. */
        const enConflit = new Set<string>();
        for (const a of prises)
          for (const b of prises)
            if (a.id !== b.id && chevauche(a.startAt, a.endAt, b.startAt, b.endAt)) enConflit.add(a.id);
        return { ressource: r, prises, rangees, enConflit };
      }),
    [triees, reservations, jourISO],
  );

  /*
    L'AMBRE. Le produit REFUSE un chevauchement à la création — un conflit
    présent dans les données vient donc forcément de deux appareils qui ont
    écrit hors ligne, exactement comme les numéros de facture en double. C'est
    un fait rare et grave, et c'est lui qui prend l'ambre quand il existe. À
    défaut, l'ambre va au refus en cours, qui est l'autre conflit de l'écran —
    celui qu'on vient d'éviter.
  */
  const conflitReel = useMemo(() => {
    for (const o of occupation) {
      const barre = o.prises.find((b) => o.enConflit.has(b.id));
      if (barre) return { ressource: o.ressource, barre };
    }
    return null;
  }, [occupation]);
  const halo = useHaloSignal(!!conflitReel || !!refus);
  const champ = 'input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none';

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('production.surtitre', { module: t('materiel.titre') })}
          title={t('materiel.titre')}
          description={t('materiel.description')}
          stats={[
            { label: t('materiel.stat.ressources'), value: triees.length },
            { label: t('materiel.stat.aujourdhui'), value: aujourdhui },
            { label: t('materiel.stat.aVenir'), value: aVenir.length },
          ]}
        />
      </motion.div>

      <motion.div variants={staggerItem} className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <section aria-label={t('materiel.ressources')} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <p className="eyebrow">{t('materiel.ressources')}</p>
          <form onSubmit={(e) => { e.preventDefault(); void creerRessource(); }} className="flex flex-col gap-2">
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder={t('materiel.champNom')} aria-label={t('materiel.champNom')} className={champ} />
            <input value={kind} onChange={(e) => setKind(e.target.value)} placeholder={t('materiel.champGenre')} aria-label={t('materiel.champGenre')} className={champ} />
            <button type="submit" disabled={!nom.trim()} className="flex min-h-11 items-center justify-center gap-2 border border-border-strong px-3 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-40 md:min-h-0 md:py-1.5"><Plus size={14} /> {t('materiel.ajouterRessource')}</button>
          </form>
          <ul className="flex flex-col divide-y divide-border">
            {triees.map((r) => (
              <li key={r.id} className="group flex items-center gap-2 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate text-text-primary">{r.name}{r.kind && <span className="text-text-muted"> · {r.kind}</span>}</span>
                <button type="button" onClick={() => void remove('resources', r.id)} aria-label={t('materiel.supprimerRessource')} title={t('materiel.supprimerRessource')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={12} /></button>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col gap-4">
          {triees.length === 0 ? (
            <FirstRun title={t('materiel.vide.titre')}>{t('materiel.vide.texte')}</FirstRun>
          ) : (
            <>
              <form onSubmit={(e) => { e.preventDefault(); void reserver(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-text-muted sm:col-span-2">{t('materiel.champRessource')}
                  <select value={cible} onChange={(e) => setResourceId(e.target.value)} className={champ}>
                    {triees.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-text-muted">{t('materiel.champDebut')}<input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={champ} /></label>
                <label className="flex flex-col gap-1 text-xs text-text-muted">{t('materiel.champFin')}<input type="datetime-local" value={endAt} min={startAt} onChange={(e) => setEndAt(e.target.value)} className={champ} /></label>
                <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t('materiel.champMotif')} aria-label={t('materiel.champMotif')} className={`${champ} sm:col-span-2`} />
                <div className="sm:col-span-2">
                  <button type="submit" className="min-h-11 w-full bg-accent px-4 text-[12.5px] font-semibold text-bg shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)] transition-colors hover:bg-accent-hover">
                    {t('materiel.reserver')}
                  </button>
                </div>
              </form>

              {/*
                LE REFUS, À L'ENDROIT DU GESTE — le composant partagé du bloc 3,
                qui a justement été écrit d'après cette maquette. Ses `issues`
                sont les créneaux libres RÉELS de la journée : cliquer l'un
                d'eux remplit le formulaire, ce qui fait du refus un chemin et
                non un mur.

                C'est aussi l'AMBRE de l'écran — son filet, et le créneau qui
                bloque dans la grille en dessous, groupés pour n'en faire qu'un.
              */}
              {refus && (
                <div data-signal-groupe="creneau-pris">
                  <Refus
                    quoi={refus.quoi}
                    parQui={refus.parQui}
                    issues={refus.libres.map((c) => ({
                      label: `${heure(c.debut)} → ${heure(c.fin)} · ${dureeLibre(c)} libres`,
                      onClick: () => {
                        setStartAt(c.debut);
                        setEndAt(c.fin);
                        setRefus(null);
                      },
                    }))}
                  />
                </div>
              )}

              {/*
                L'OCCUPATION DU JOUR — une règle de 8 h à 20 h, une ligne par
                ressource. La liste « à venir » disait QUAND chaque réservation
                tombe ; elle ne disait pas ce qui est LIBRE, qui est la question
                qu'on se pose en arrivant devant le tableau des clés.
              */}
              {occupation.length > 0 && (
                <section>
                  <div className="mb-2 flex items-center gap-4">
                    <p className="eyebrow flex-shrink-0">{t('materiel.aujourdHuiCourt')}</p>
                    <span className="h-px flex-1 bg-border-section" aria-hidden />
                    <p className="eyebrow flex-shrink-0">{HEURE_DEBUT} h → {HEURE_FIN} h</p>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="min-w-[620px] border border-border">
                      {/* La règle des heures, une graduation toutes les deux heures. */}
                      <div className="flex border-b border-border">
                        <span className="eyebrow w-[160px] flex-shrink-0 px-3 py-2.5">{t('materiel.ressourceCourt')}</span>
                        <span className="relative flex-1">
                          {Array.from({ length: (HEURE_FIN - HEURE_DEBUT) / 2 }, (_, i) => (
                            <span
                              key={i}
                              className="absolute top-2.5 font-mono text-[9.5px] tracking-[0.1em] text-text-muted"
                              style={{ left: `${((i * 2) / (HEURE_FIN - HEURE_DEBUT)) * 100}%` }}
                            >
                              {String(HEURE_DEBUT + i * 2).padStart(2, '0')}
                            </span>
                          ))}
                        </span>
                      </div>
                      {occupation.map(({ ressource, rangees, enConflit }) => (
                        <div key={ressource.id} className="flex border-b border-border-row last:border-b-0">
                          <span className="w-[160px] flex-shrink-0 px-3 py-4">
                            <span className="block truncate text-[14px] text-text-primary">{ressource.name}</span>
                            {ressource.kind && <span className="eyebrow mt-1 block truncate">{ressource.kind}</span>}
                            {rangees.length > 1 && (
                              <span className="eyebrow mt-1 block text-signal" data-signal-groupe="creneau-pris">
                                {rangees.length} en même temps
                              </span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1 py-2">
                            {rangees.length === 0 ? (
                              <span className="eyebrow block px-3 py-2.5">
                                {t('materiel.libreToutLeJour')}
                              </span>
                            ) : (
                              /*
                                UNE RANGÉE PAR PILE. Elles ne fusionnent jamais :
                                c'est la superposition HORIZONTALE de deux barres
                                sur la même plage qui fait voir le conflit, sans
                                qu'on ait à lire le mot « conflit ».
                              */
                              rangees.map((rangee, ri) => (
                                <span key={ri} className="relative block h-9">
                                  {rangee.map((b) => {
                                    const bloque =
                                      b.id === refus?.conflitId || enConflit.has(b.id);
                                    const part = (iso: string) => {
                                      const d = new Date(iso);
                                      const h = d.getHours() + d.getMinutes() / 60;
                                      return Math.min(
                                        100,
                                        Math.max(0, ((h - HEURE_DEBUT) / (HEURE_FIN - HEURE_DEBUT)) * 100),
                                      );
                                    };
                                    const gauche = part(b.startAt);
                                    return (
                                      <span
                                        key={b.id}
                                        data-signal-groupe={bloque ? 'creneau-pris' : undefined}
                                        title={`${b.byEmail.split('@')[0]} · ${quand(b.startAt, b.endAt)}${b.purpose ? ` · ${b.purpose}` : ''}`}
                                        className={`absolute top-1/2 flex -translate-y-1/2 items-center overflow-hidden whitespace-nowrap px-2 py-1.5 font-mono text-[10px] ${
                                          bloque ? `signal-plate ${halo}` : 'bg-raised text-text-secondary'
                                        }`}
                                        style={{
                                          left: `${gauche}%`,
                                          width: `${Math.max(6, part(b.endAt) - gauche)}%`,
                                        }}
                                      >
                                        {/* LE BLOC EST LARGE COMME SA DURÉE,
                                            pas comme son texte : une heure
                                            de camionnette fait quarante
                                            pixels. Le nom passe donc en
                                            troncature propre plutôt qu'en
                                            coupure nette au bord, et la
                                            bulle de survol porte l'heure,
                                            la plage et le motif entiers. */}
                                        <span className="min-w-0 truncate">
                                          {b.byEmail.split('@')[0]} · {heure(b.startAt)}
                                        </span>
                                      </span>
                                    );
                                  })}
                                </span>
                              ))
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {conflitReel && (
                    <p className="mt-3 text-[12.5px] leading-relaxed text-text-secondary">
                      <span className="font-semibold text-signal" data-signal-groupe="creneau-pris">
                        {conflitReel.ressource.name} est réservé deux fois sur la même plage
                      </span>{' '}
                      ({quand(conflitReel.barre.startAt, conflitReel.barre.endAt)}). L’écran refuse
                      un chevauchement à la création : celui-ci vient donc de deux appareils qui ont
                      écrit hors ligne, comme un numéro de facture en double. Les deux rangées le
                      montrent plutôt que de le cacher — il faut trancher à la main.
                    </p>
                  )}
                </section>
              )}
              {aVenir.length === 0 ? (
                <p className="text-sm text-text-secondary">{t('materiel.aucune')}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {aVenir.map((r) => (
                    <li key={r.id} className="group flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary">{nomDe(r.resourceId)}{r.purpose && <span className="font-normal text-text-secondary"> · {r.purpose}</span>}</p>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{quand(r.startAt, r.endAt)} · {r.byEmail.split('@')[0]}</p>
                      </div>
                      <button type="button" onClick={() => void remove('resourceBookings', r.id)} aria-label={t('materiel.supprimer')} title={t('materiel.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.section>
  );
}
