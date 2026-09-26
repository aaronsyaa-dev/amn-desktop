import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Check, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface Arret {
  id: string;
  label: string;
  address: string;
  doneAt: string | null;
  /**
   * LES KILOMÈTRES DEPUIS L'ARRÊT PRÉCÉDENT, et la durée sur place.
   *
   * `MODULES.md` (`15a`) fait de la DISTANCE ENTRE DEUX NŒUDS le sujet de
   * l'objet : « les longs trajets se voient comme de longs vides ». Sans
   * distance, l'espacement serait régulier, et un fil à espacement régulier
   * n'est qu'une liste verticale — exactement ce que le module dit de ne pas
   * faire. Le produit n'avait pas le champ ; il l'a.
   *
   * Absents sur les tournées écrites avant : le fil retombe alors sur un
   * espacement régulier ET LE DIT, plutôt que d'inventer des kilomètres.
   */
  km?: number;
  dureeMin?: number;
}
interface RoundData {
  title: string;
  day: string;
  stops: Arret[];
  /** L'heure de départ, « 08:30 ». Les heures des arrêts s'en DÉDUISENT. */
  departAt?: string;
  createdAt: string;
  /** Le véhicule qui fait la tournée : ses arrêts pointés font avancer son compteur dans Flotte. */
  vehiculeId?: string;
}

/**
 * LE FIL DE LA ROUTE — l'objet dominant de Tournées (`15a`).
 *
 * Un itinéraire ne se lit pas en liste : il se lit comme une DESCENTE. La
 * distance entre deux nœuds est proportionnelle au trajet réel, donc les longs
 * trajets se voient comme de longs vides — et c'est la seule chose qu'on
 * regarde en préparant une tournée.
 *
 * LE PLANCHER. L'espacement est une pure proportion (`km / kmMax × FIL_MAX`),
 * bornée par le bas à `FIL_MIN` : un saut de trois cents mètres collerait
 * sinon deux nœuds l'un sur l'autre et rendrait les deux illisibles. Le
 * plancher ne joue QUE vers le bas — aucun trajet n'est raccourci, seulement
 * les plus courts reçoivent de quoi respirer, et l'écran le dit.
 */
const FIL_MIN = 44;
const FIL_MAX = 150;
/** Vitesse de trajet en ville, pour déduire l'heure d'arrivée. Écrite ici. */
const KMH_VILLE = 28;

function heureApres(depart: string, minutes: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(depart.trim());
  if (!m) return '';
  const total = Number(m[1]) * 60 + Number(m[2]) + Math.round(minutes);
  const h = Math.floor((total % 1440) / 60);
  const mn = Math.round(total % 60);
  return `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
}
const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** « Boulangerie Martin, 12 rue des Lilas, Nantes » → un arrêt : le premier morceau nomme, le reste adresse. */
export function lireArret(ligne: string): Arret | null {
  const [label, ...reste] = ligne.split(',').map((p) => p.trim());
  if (!label) return null;
  return { id: uid('stp'), label, address: reste.join(', '), doneAt: null };
}
const carte = (a: Arret) => `https://www.openstreetmap.org/search?query=${encodeURIComponent(a.address || a.label)}`;

/**
 * LES TOURNÉES — les livraisons du jour, arrêt par arrêt.
 *
 * Pour qui : un traiteur, un fleuriste, un artisan qui livre et note ses
 * arrêts sur un papier qui reste dans le camion. Ce que ça règle : une
 * tournée par jour avec ses arrêts dans l'ordre, cochés en route depuis le
 * téléphone, et la carte ouverte d'un geste — la recherche OpenStreetMap,
 * sans compte ni clé. L'ordre se règle à la main : personne ne connaît la
 * ville mieux que celui qui la livre.
 */
export function DeliveryRoundsScreen() {
  const { t, langue } = useLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const { upsert, remove } = useSync();
  const brutes = useCollection<RoundData>('deliveryRounds');
  const [ouvert, setOuvert] = useState(false);
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(isoJour(new Date()));
  const [stops, setStops] = useState('');
  const vehicules = useCollection<{ kind?: string; nom: string }>('vehicles').filter((v) => v.kind === 'vehicule');
  const [vehiculeId, setVehiculeId] = useState('');
  const aujourdhui = isoJour(new Date());

  const [ouverteId, setOuverteId] = useState<string | null>(null);
  const tournees = useMemo(() => [...brutes].sort((a, b) => b.day.localeCompare(a.day) || a.createdAt.localeCompare(b.createdAt)), [brutes]);
  /*
    LA TOURNÉE OUVERTE — celle qu'on est en train de faire.

    On ouvre cet écran pour LIVRER, pas pour consulter : la tournée du jour
    déjà COMMENCÉE et pas finie passe donc devant, puis celle qui n'est pas
    commencée, puis la plus récente.

    Le repli précédent — « la première du jour » — dépendait de l'ordre de
    création, et deux tournées créées à la même minute le laissaient à
    l'arbitraire du tableau. Sur le bac à sable, l'écran s'ouvrait donc sur la
    tournée de l'après-midi, qui n'a pas de kilomètres notés : le fil
    proportionnel, qui est l'objet dominant du module, ne se voyait jamais
    alors que la tournée du matin, juste à côté, le porte.
  */
  const duJour = useMemo(() => tournees.filter((r) => r.day === aujourdhui), [tournees, aujourdhui]);
  const enRoute = (r: RoundData & { id: string }) => {
    const faits = r.stops.filter((s) => s.doneAt).length;
    return faits > 0 && faits < r.stops.length;
  };
  const ouverte =
    tournees.find((r) => r.id === ouverteId) ??
    duJour.find(enRoute) ??
    duJour.find((r) => r.stops.every((s) => !s.doneAt)) ??
    duJour[0] ??
    tournees[0] ??
    null;
  const autresTournees = useMemo(
    () => tournees.filter((r) => r.id !== ouverte?.id),
    [tournees, ouverte],
  );
  const faitsOuverte = ouverte ? ouverte.stops.filter((s) => s.doneAt).length : 0;
  /*
    L'ARRÊT EN COURS — le premier qui n'est pas livré.

    C'est l'ambre que la table du paquet nomme. Une tournée finie n'en a pas :
    il n'y a plus rien à décider, et l'écran n'a plus d'ambre du tout.
  */
  const arretEnCours = ouverte?.stops.find((s) => !s.doneAt) ?? null;

  /* ------------------------------------------------ le fil de la route -- */

  /*
    LE FIL. Chaque nœud reçoit son espacement — proportionnel au trajet qui
    le précède — et son heure d'arrivée, DÉDUITE du départ, des kilomètres et
    des durées sur place. Déduite plutôt que stockée : une heure écrite se
    périme dès qu'un arrêt bouge, et personne ne pense à la corriger.
  */
  const fil = useMemo(() => {
    const stops = ouverte?.stops ?? [];
    const kms = stops.map((a) => (typeof a.km === 'number' && a.km >= 0 ? a.km : null));
    const mesure = kms.some((k) => k !== null);
    const kmMax = Math.max(1, ...kms.map((k) => k ?? 0));
    let minutes = 0;
    return stops.map((a, i) => {
      const km = kms[i] ?? 0;
      minutes += (km / KMH_VILLE) * 60;
      const heure = ouverte?.departAt ? heureApres(ouverte.departAt, minutes) : '';
      minutes += typeof a.dureeMin === 'number' ? a.dureeMin : 0;
      return {
        arret: a,
        km: kms[i],
        heure,
        /*
          Proportion pure, plancher vers le bas seulement : aucun trajet n'est
          raccourci, les plus courts reçoivent de quoi respirer.

          LE PREMIER TRAJET COMPTE AUSSI. Il était à zéro — le fil commençait
          au premier arrêt comme si on y était né. Mais le kilométrage porté
          par le premier arrêt est bien celui du dépôt jusqu'à lui, il entre
          dans le total affiché en tête, et le masquer faisait dire au fil
          14,5 km là où le compteur en annonçait 17,6. Il se dessine donc,
          avec son étiquette, et le fil s'ouvre sur le trajet de sortie.
        */
        espace: mesure && km > 0 ? Math.max(FIL_MIN, (km / kmMax) * FIL_MAX) : i === 0 ? 0 : FIL_MIN,
      };
    });
  }, [ouverte]);
  const filMesure = fil.some((n) => n.km !== null);
  const kmTotal = fil.reduce((n, x) => n + (x.km ?? 0), 0);
  const minutesRoute = Math.round((kmTotal / KMH_VILLE) * 60);
  const restants = duJour.reduce((n, r) => n + r.stops.filter((s) => !s.doneAt).length, 0);
  const faits = duJour.reduce((n, r) => n + r.stops.filter((s) => s.doneAt).length, 0);

  const ajouter = async () => {
    const arrets = stops.split('\n').map(lireArret).filter((a): a is Arret => Boolean(a));
    if (!title.trim() || arrets.length === 0) return;
    await upsert('deliveryRounds', uid('rnd'), { title: title.trim(), day, stops: arrets, createdAt: new Date().toISOString(), ...(vehiculeId ? { vehiculeId } : {}) });
    setTitle(''); setStops(''); setVehiculeId(''); setOuvert(false);
  };
  const basculer = (r: RoundData & { id: string }, a: Arret) => upsert('deliveryRounds', r.id, { ...r, stops: r.stops.map((s) => (s.id === a.id ? { ...s, doneAt: s.doneAt ? null : new Date().toISOString() } : s)) });
  const deplacer = (r: RoundData & { id: string }, index: number, delta: number) => {
    const cible = index + delta;
    if (cible < 0 || cible >= r.stops.length) return;
    const stops = [...r.stops];
    [stops[index], stops[cible]] = [stops[cible], stops[index]];
    return upsert('deliveryRounds', r.id, { ...r, stops });
  };
  const dateLongue = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const dateCourte = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  const heureCourte = (iso: string) =>
    iso ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('production.surtitre', { module: t('tournees.titre') })}
          title={t('tournees.titre')}
          description={t('tournees.description')}
          stats={[
            { label: t('tournees.stat.aujourdhui'), value: duJour.length },
            { label: t('tournees.stat.restants'), value: restants, emphasis: restants > 0 },
            { label: t('tournees.stat.faits'), value: faits },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('tournees.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('tournees.champTitre')} aria-label={t('tournees.champTitre')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <label className="flex flex-col gap-1 text-xs text-text-muted">{t('tournees.champJour')}<input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" /></label>
          {vehicules.length > 0 && (
            <label className="flex flex-col gap-1 text-xs text-text-muted sm:col-span-2">
              Véhicule (son compteur avance dans Flotte)
              <select value={vehiculeId} onChange={(e) => setVehiculeId(e.target.value)} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none">
                <option value="">Aucun véhicule suivi</option>
                {vehicules.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nom}
                  </option>
                ))}
              </select>
            </label>
          )}
          <textarea value={stops} onChange={(e) => setStops(e.target.value)} rows={5} placeholder={t('tournees.champArrets')} aria-label={t('tournees.champArrets')} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none sm:col-span-2" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={!title.trim() || !stops.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('tournees.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {tournees.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('tournees.vide.titre')} action={{ label: t('tournees.vide.action'), onClick: () => setOuvert(true) }}>{t('tournees.vide.texte')}</FirstRun>
        </motion.div>
      ) : ouverte ? (
        /*
          LA ROUTE DU JOUR — l'objet dominant de l'écran Tournées.

          Les tournées étaient empilées, toutes dépliées, chaque arrêt sur une
          ligne portant six cibles côte à côte (cocher, carte, monter,
          descendre…). Une tournée de douze arrêts faisait soixante-douze
          boutons de la même taille, et rien ne disait OÙ ON EN EST.

          Le tracé vertical le dit : les arrêts livrés au-dessus, barrés et
          horodatés, l'arrêt EN COURS levé sur sa propre carte avec ses gestes,
          et ce qui reste en dessous. C'est la lecture qu'on fait depuis un
          camion, à un feu rouge.
        */
        <motion.div variants={staggerItem} className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <p className="eyebrow">
                  {[dateLongue(ouverte.day), t('tournees.nSurMLivres', { fait: faitsOuverte, total: ouverte.stops.length })].join(' · ')}
                </p>
                <h2 className="mt-3 text-[26px] font-bold leading-none tracking-[-0.03em] text-text-primary sm:text-[30px]">
                  {ouverte.title}
                </h2>
              </div>
              {/* Supprimer la tournée vivait sur chaque carte empilée ; il n'y a
                  plus qu'une tournée ouverte, donc il vit ici. Le geste n'a pas
                  disparu avec la refonte — il a suivi son objet. */}
              <button
                type="button"
                onClick={() => {
                  setOuverteId(null);
                  void remove('deliveryRounds', ouverte.id);
                }}
                aria-label={t('tournees.supprimer')}
                title={t('tournees.supprimer')}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-text-muted transition-colors hover:text-danger"
              >
                <Trash2 size={14} strokeWidth={1.9} />
              </button>
            </div>

            {/* LES COMPTEURS — arrêts, kilomètres, temps de route. */}
            <div className="mb-5 flex flex-wrap gap-x-8 gap-y-3 border-b border-border-raised pb-4">
              <div>
                <p className="eyebrow mb-1.5">Arrêts</p>
                <p className="tnum font-mono text-[21px] font-semibold tracking-[-0.03em] text-text-primary">
                  {ouverte.stops.length}
                </p>
              </div>
              <div className="border-l border-border-section pl-8">
                <p className="eyebrow mb-1.5">Kilomètres</p>
                <p className="tnum font-mono text-[21px] font-semibold tracking-[-0.03em] text-text-primary">
                  {filMesure ? String(Math.round(kmTotal * 10) / 10).replace('.', ',') : '—'}
                </p>
              </div>
              <div className="border-l border-border-section pl-8">
                <p className="eyebrow mb-1.5">Temps de route</p>
                <p className="tnum font-mono text-[21px] font-semibold tracking-[-0.03em] text-text-primary">
                  {filMesure ? `${Math.floor(minutesRoute / 60)} h ${String(minutesRoute % 60).padStart(2, '0')}` : '—'}
                </p>
              </div>
              {ouverte.departAt && (
                <div className="border-l border-border-section pl-8">
                  <p className="eyebrow mb-1.5">Départ</p>
                  <p className="tnum font-mono text-[21px] font-semibold tracking-[-0.03em] text-text-primary">
                    {ouverte.departAt}
                  </p>
                </div>
              )}
            </div>

            {!filMesure && (
              <p className="mb-4 text-[12.5px] leading-relaxed text-text-muted">
                Cette tournée n’a pas de kilomètres notés : le fil retombe sur un espacement
                régulier. Il le dit plutôt que d’inventer des distances — un fil à pas constant
                n’est qu’une liste verticale, et c’est exactement ce que cet objet évite quand il
                a de quoi mesurer.
              </p>
            )}

            <ol className="relative flex flex-col">
              {/* Le trait qui relie les arrêts : c'est la route, et elle
                  s'arrête au dernier arrêt, pas au bord du cadre. */}
              <span
                className="absolute bottom-6 left-[15px] top-6 w-px bg-border"
                aria-hidden
              />
              {fil.map(({ arret: a, km, heure, espace }, i) => {
                const livre = Boolean(a.doneAt);
                const enCours = a.id === arretEnCours?.id;
                return (
                  <li
                    key={a.id}
                    data-signal-groupe={enCours ? 'arret-en-cours' : undefined}
                    className={`relative flex items-start gap-4 ${
                      enCours ? 'panel-raised my-2 px-4 py-4' : 'py-3.5'
                    }`}
                    /*
                      L'ESPACEMENT EST LE TRAJET. Posé en `marginTop` sur le
                      nœud, et non en `gap` régulier : un fil à pas constant
                      n'est qu'une liste verticale, et le module dit
                      exactement de ne pas en faire une.
                    */
                    style={espace > 0 ? { marginTop: espace } : undefined}
                  >
                    {/* LE SEGMENT ET SON KILOMÉTRAGE, posés DANS le vide que
                        le trajet a creusé au-dessus du nœud. */}
                    {espace > 0 && km !== null && km > 0 && (
                      <span
                        className="absolute left-[30px] -translate-y-1/2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted"
                        style={{ top: -espace / 2 }}
                      >
                        {String(km).replace('.', ',')} km
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void basculer(ouverte, a)}
                      aria-pressed={livre}
                      aria-label={livre ? t('tournees.livre') : t('tournees.aLivrer')}
                      className={`relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                        enCours
                          ? 'signal-plate border-signal font-mono'
                          : livre
                            ? 'border-border-strong bg-surface text-text-muted'
                            : 'border-border bg-surface font-mono text-text-muted'
                      }`}
                    >
                      {livre ? <Check size={14} strokeWidth={2.5} /> : String(i + 1).padStart(2, '0')}
                    </button>

                    <div className="min-w-0 flex-1 pt-1">
                      <p
                        className={`truncate text-[15.5px] ${
                          livre ? 'text-text-muted line-through' : enCours ? 'font-semibold text-text-primary' : 'text-text-primary'
                        }`}
                      >
                        {a.label}
                      </p>
                      {a.address && <p className="mt-1 truncate text-[13px] text-text-muted">{a.address}</p>}
                      {(heure || typeof a.dureeMin === 'number') && (
                        <p
                          className={`tnum mt-1 font-mono text-[10px] uppercase tracking-[0.14em] ${
                            enCours ? 'text-signal' : 'text-text-muted'
                          }`}
                          data-signal-groupe={enCours ? 'arret-en-cours' : undefined}
                        >
                          {[heure, typeof a.dureeMin === 'number' ? `${a.dureeMin} min sur place` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                    </div>

                    {livre ? (
                      <p className="eyebrow flex-shrink-0 pt-1.5">
                        {t('tournees.livreA', { heure: heureCourte(a.doneAt ?? '') })}
                      </p>
                    ) : (
                      <div className="flex flex-shrink-0 items-center gap-2">
                        {enCours && (
                          <button
                            type="button"
                            onClick={() => void basculer(ouverte, a)}
                            className="min-h-11 bg-accent px-4 text-[12.5px] font-semibold text-bg shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)] transition-colors hover:bg-accent-hover"
                          >
                            {t('tournees.cocherLivre')}
                          </button>
                        )}
                        <a
                          href={carte(a)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-h-11 items-center gap-1.5 border border-border-strong px-3 text-[12.5px] font-semibold text-text-primary transition-colors hover:bg-surface-hover md:min-h-0 md:py-2"
                        >
                          {t('tournees.carte')}
                          <ExternalLink size={12} strokeWidth={2} />
                        </a>
                        {/* Monter et descendre ne sont offerts que sur l'arrêt
                            en cours : réordonner un arrêt déjà livré n'a pas de
                            sens, et six cibles par ligne en avaient trop. */}
                        {enCours && (
                          <span className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => void deplacer(ouverte, i, -1)}
                              disabled={i === 0}
                              aria-label={t('tournees.monter')}
                              className="flex h-6 w-8 items-center justify-center border border-border text-text-muted transition-colors hover:text-text-primary disabled:opacity-30"
                            >
                              <ArrowUp size={11} strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void deplacer(ouverte, i, 1)}
                              disabled={i === ouverte.stops.length - 1}
                              aria-label={t('tournees.descendre')}
                              className="flex h-6 w-8 items-center justify-center border border-t-0 border-border text-text-muted transition-colors hover:text-text-primary disabled:opacity-30"
                            >
                              <ArrowDown size={11} strokeWidth={2} />
                            </button>
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>

            {/* La phrase de l'en-tête du fichier, enfin écrite à l'écran : elle
                explique pourquoi il n'y a pas d'optimisation d'itinéraire. */}
            <p className="font-mono text-[9.5px] uppercase leading-[1.8] tracking-[0.14em] text-text-muted">
              {t('tournees.lOrdreSeRegle')}
            </p>
          </div>

          <div className="flex flex-col gap-5">
            {/* L'avancement : une barre à un segment par arrêt. */}
            <div className="panel p-4">
              <p className="eyebrow mb-3.5">{t('tournees.avancementCourt')}</p>
              <div className="flex gap-1" aria-hidden>
                {ouverte.stops.map((a) => (
                  <span
                    key={a.id}
                    data-signal-groupe={a.id === arretEnCours?.id ? 'arret-en-cours' : undefined}
                    className={`h-[7px] min-w-0 flex-1 ${
                      a.doneAt ? 'bg-[#4a4a48]' : a.id === arretEnCours?.id ? 'bg-signal' : 'bg-[#2b2b2b]'
                    }`}
                  />
                ))}
              </div>
              <p className="tnum mt-4 font-mono text-[32px] font-bold leading-none tracking-[-0.04em] text-text-primary">
                {faitsOuverte} / {ouverte.stops.length}
              </p>
              <p className="mt-3 text-[13.5px] text-text-secondary">{t('tournees.arretsLivres')}</p>
            </div>

            {/* Les autres jours : le rail, sans déplier quoi que ce soit. */}
            {autresTournees.length > 0 && (
              <div className="panel p-4">
                <p className="eyebrow mb-3.5">{t('tournees.autresJours')}</p>
                <div className="flex flex-col">
                  {autresTournees.map((r) => {
                    const f = r.stops.filter((s) => s.doneAt).length;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setOuverteId(r.id)}
                        className="flex flex-col gap-1.5 border-b border-[#1a1a1a] py-3 text-left transition-colors last:border-b-0 hover:text-text-primary"
                      >
                        <span className="truncate text-[14px] text-text-body">{r.title}</span>
                        <span className="eyebrow">
                          {[
                            r.day === aujourdhui ? t('tournees.aujourdhui') : dateCourte(r.day),
                            `${f} / ${r.stops.length}`,
                          ].join(' · ')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      ) : null}

    </motion.section>
  );
}
