import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ClipboardCheck, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';
import { useHaloSignal } from '../components/EtatEcran';

/**
 * LA CARTE PERFORÉE — l'objet dominant de Contrôles qualité (`15b`).
 *
 * LA RÈGLE DU CHIFFRE GRAVÉ : le numéro d'une case suit la clarté de SON
 * REMPLISSAGE, pas celle du fond de page. Sur `#3a3a3a`, l'encre est
 * `#e4e4e1`. Un chiffre en encre sombre sur un gris de remplissage tombe sous
 * 2,3:1 — c'est le défaut que `check:contraste` a trouvé sur la colonne
 * d'Abonnements, et la même faute se répéterait ici case par case.
 */
const CARTE_PASSAGES = 12;
const CASE_COTE = 26;

interface ChecklistData {
  title: string;
  items: string[];
  createdAt: string;
}
interface CheckRunData {
  checklistId: string;
  doneAt: string;
  byEmail: string;
  checked: boolean[];
  note: string;
}

/**
 * LES CONTRÔLES QUALITÉ — des listes à cocher, et la trace de chaque passage.
 *
 * Pour qui : un commerce, un atelier, un traiteur dont la liste d'ouverture
 * est dans la tête de la personne qui ouvre. Ce que ça règle : un modèle
 * écrit une fois, et chaque passage daté et signé — qui, quand, combien de
 * points conformes. La trace existe le jour où on la demande (hygiène,
 * sécurité, assurance) sans avoir été faite pour ça.
 */
export function ChecklistsScreen() {
  const { t } = useLangue();
  const { user } = useAuth();
  const { upsert, remove } = useSync();
  const modeles = useCollection<ChecklistData>('checklists');
  const passages = useCollection<CheckRunData>('checkRuns');
  const [ouvert, setOuvert] = useState(false);
  const [title, setTitle] = useState('');
  const [points, setPoints] = useState('');
  const [enCours, setEnCours] = useState<{ id: string; checked: boolean[] } | null>(null);
  const [ouvertId, setOuvertId] = useState<string | null>(null);

  const tries = useMemo(() => [...modeles].sort((a, b) => a.title.localeCompare(b.title)), [modeles]);
  const parModele = useMemo(() => {
    const m = new Map<string, (CheckRunData & { id: string })[]>();
    for (const p of passages) {
      const l = m.get(p.checklistId) ?? [];
      l.push(p);
      m.set(p.checklistId, l);
    }
    for (const l of m.values()) l.sort((a, b) => b.doneAt.localeCompare(a.doneAt));
    return m;
  }, [passages]);
  /*
    LE MODÈLE OUVERT PAR DÉFAUT — celui qui a QUELQUE CHOSE À DIRE.

    Priorité au choix explicite, puis au passage en cours (on ne quitte pas
    une liste qu'on est en train de cocher par accident). Ensuite, et c'est le
    cas courant : le modèle le plus PASSÉ.

    Ce dernier point est un correctif, pas une préférence. Le repli était
    `tries[0]`, c'est-à-dire le premier par ordre alphabétique. Sur le bac à
    sable, l'écran s'ouvrait donc sur « Contrôle frigo » et son passage unique
    — une carte perforée d'UNE colonne, qui ne peut montrer ni colonne trouée,
    ni point problématique, ni ambre. L'objet dominant existait et ne disait
    rien. Une carte perforée se lit sur une série ; l'écran doit s'ouvrir sur
    la série la plus longue, et à égalité sur la plus récente.
  */
  const leMieuxDocumente = useMemo(() => {
    let choisi: (ChecklistData & { id: string }) | null = null;
    let meilleur = -1;
    let recent = '';
    for (const m of tries) {
      const l = parModele.get(m.id) ?? [];
      const dernier = l[0]?.doneAt ?? '';
      if (l.length > meilleur || (l.length === meilleur && dernier > recent)) {
        choisi = m;
        meilleur = l.length;
        recent = dernier;
      }
    }
    return choisi;
  }, [tries, parModele]);

  const ouvertModele =
    tries.find((m) => m.id === ouvertId) ??
    tries.find((m) => m.id === enCours?.id) ??
    leMieuxDocumente ??
    tries[0] ??
    null;
  const actif = ouvertModele && enCours?.id === ouvertModele.id ? enCours : null;
  const historiqueDuModele = ouvertModele ? parModele.get(ouvertModele.id) ?? [] : [];
  const dernierDuModele = historiqueDuModele[0];
  const moi = user?.email?.split('@')[0] ?? '';
  const dateEtHeure = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  /* ------------------------------------------ la carte perforée (`15b`) -- */

  /*
    LE MODÈLE DEVIENT UNE GRILLE DE CASES — une par point de contrôle et par
    passage. La grille entière se lit d'un coup : les COLONNES QUI TROUENT sont
    les points qui échouent régulièrement, et aucune liste de passages ne
    montre ça — il faudrait comparer douze listes ligne à ligne.
  */
  const carte = useMemo(() => {
    if (!ouvertModele) return null;
    const runs = (parModele.get(ouvertModele.id) ?? []).slice(0, CARTE_PASSAGES);
    const points = ouvertModele.items;
    /* Les manques par point, sur les passages affichés — pas sur toute la
       base : un chiffre qui ne correspond pas à ce qu'on voit n'est pas
       vérifiable. */
    const manques = points.map((_, i) => runs.filter((r) => !r.checked?.[i]).length);
    const pire = manques.reduce((best, n, i) => (n > manques[best] ? i : best), 0);
    return {
      runs: [...runs].reverse(),
      points,
      manques,
      /* Le point problématique n'existe que s'il échoue VRAIMENT : un point
         qui n'a jamais manqué n'est pas « le pire », il n'y en a pas. */
      pire: manques[pire] > 0 ? pire : null,
    };
  }, [ouvertModele, parModele]);

  /*
    L'ENTOURAGE DE LA CARTE — les passages du mois, et le détail du point qui
    échoue. Ils vivent DANS la carte dominante, à droite de la grille : une
    carte perforée de six colonnes occupe un quart de la largeur, et laisser
    les trois quarts vides ferait d'un dominant une vignette.
  */
  const autourDeLaCarte = useMemo(() => {
    if (!ouvertModele || !carte) return null;
    const debutDuMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const duMois = (parModele.get(ouvertModele.id) ?? []).filter((r) => r.doneAt >= debutDuMois);
    const parQui = new Map<string, number>();
    for (const r of duMois) {
      const qui = r.byEmail.split('@')[0] || '—';
      parQui.set(qui, (parQui.get(qui) ?? 0) + 1);
    }
    return {
      duMois: duMois.length,
      parQui: [...parQui.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [ouvertModele, carte, parModele]);

  /*
    L'AMBRE, ET L'ARBITRAGE.

    `MODULES.md` le met sur l'étiquette du point problématique. L'écran portait
    déjà un ambre sur le modèle EN COURS de passage — une liste qu'on est en
    train de cocher et qu'il faut valider ou fermer avant de partir. Les deux
    ne peuvent pas coexister : un écran n'a qu'une région ambre.

    Un passage en cours l'emporte quand il existe : c'est une décision VIVE,
    là où le point problématique est une statistique, vraie mais sans urgence.
    Sans passage en cours — le cas courant — l'ambre va où `MODULES.md` le
    met, sur la colonne qui troue.
  */
  const pointAmbre = enCours ? null : (carte?.pire ?? null);
  const halo = useHaloSignal(!!enCours || pointAmbre !== null);

  const ilYaSeptJours = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const passagesSemaine = passages.filter((p) => p.doneAt >= ilYaSeptJours).length;

  const creer = async () => {
    const items = points.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!title.trim() || items.length === 0) return;
    await upsert('checklists', uid('chk'), { title: title.trim(), items, createdAt: new Date().toISOString() });
    setTitle(''); setPoints(''); setOuvert(false);
  };
  const lancer = (m: ChecklistData & { id: string }) => setEnCours({ id: m.id, checked: m.items.map(() => false) });
  const cocher = (i: number) => setEnCours((c) => (c ? { ...c, checked: c.checked.map((v, j) => (j === i ? !v : v)) } : c));
  const valider = async () => {
    if (!enCours) return;
    await upsert('checkRuns', uid('run'), { checklistId: enCours.id, doneAt: new Date().toISOString(), byEmail: user?.email ?? '', checked: enCours.checked, note: '' });
    setEnCours(null);
  };
  const nombreConformes = (p: CheckRunData) => p.checked.filter(Boolean).length;

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('production.surtitre', { module: t('controles.titre') })}
          title={t('controles.titre')}
          description={t('controles.description')}
          stats={[
            { label: t('controles.stat.modeles'), value: tries.length },
            { label: t('controles.stat.passages'), value: passages.length },
            { label: t('controles.stat.passagesSemaine'), value: passagesSemaine },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('controles.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void creer(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('controles.champTitre')} aria-label={t('controles.champTitre')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <textarea value={points} onChange={(e) => setPoints(e.target.value)} rows={5} placeholder={t('controles.champPoints')} aria-label={t('controles.champPoints')} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none" />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!title.trim() || !points.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('controles.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {tries.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('controles.vide.titre')} action={{ label: t('controles.vide.action'), onClick: () => setOuvert(true) }}>{t('controles.vide.texte')}</FirstRun>
        </motion.div>
      ) : ouvertModele ? (
        /*
          RAIL DE MODÈLES + FEUILLE + TRACE.

          C'était une grille de cartes de 18 rem, chacune portant son titre, un
          aperçu de quatre points, son bouton, et son historique — soit quatre
          modèles qui se disputaient l'attention alors qu'on n'en fait qu'un à la
          fois, debout, en ouvrant la boutique.

          Le modèle ouvert devient une FEUILLE : ses points en pleine largeur,
          cochables à 44 px, et la trace de ses trois derniers passages en
          dessous. Les autres tiennent dans un rail.
        */
        <>
        {/* ── LA CARTE PERFORÉE — l'objet dominant (`15b`) ──────────────── */}
        {carte && carte.runs.length > 0 && (
          <motion.section
            variants={staggerItem}
            className="panel-raised panel-raised-wide panel-ticks mb-5 px-6 py-6"
          >
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <p className="eyebrow">
                {ouvertModele.title} · {carte.runs.length} passage{carte.runs.length > 1 ? 's' : ''}
              </p>
              <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
                les colonnes qui trouent sont les points qui échouent
              </p>
            </div>

            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
            <div className="overflow-x-auto">
              <div className="inline-flex flex-col gap-1.5">
                {carte.runs.map((r) => (
                  <div key={r.id} className="flex items-center gap-1.5">
                    <span className="tnum w-[88px] flex-shrink-0 font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-muted">
                      {new Date(r.doneAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                    </span>
                    {carte.points.map((_, i) => {
                      const conforme = !!r.checked?.[i];
                      return (
                        <span
                          key={i}
                          style={{ width: CASE_COTE, height: CASE_COTE }}
                          className={`flex flex-shrink-0 items-center justify-center font-mono text-[10px] font-bold ${
                            conforme
                              ? /* LE CHIFFRE SUIT LA CLARTÉ DU REMPLISSAGE :
                                   `#e4e4e1` sur `#3a3a3a`, pas l'encre de fond. */
                                'bg-border-strong text-text-body'
                              : 'border border-border-strong text-transparent'
                          }`}
                          title={`${carte.points[i]} · ${conforme ? 'conforme' : 'non conforme'}`}
                        >
                          {i + 1}
                        </span>
                      );
                    })}
                  </div>
                ))}

                {/* LA RANGÉE DES ÉTIQUETTES — même pas de colonnes que la grille. */}
                <div className="mt-1 flex items-start gap-1.5">
                  <span className="w-[88px] flex-shrink-0" aria-hidden />
                  {carte.points.map((pt, i) => {
                    const signal = pointAmbre === i;
                    return (
                      <span
                        key={i}
                        style={{ width: CASE_COTE }}
                        className="flex flex-shrink-0 flex-col items-center gap-1"
                      >
                        <span
                          className={`tnum font-mono text-[9.5px] ${
                            signal ? 'font-bold text-signal' : 'text-text-muted'
                          }`}
                          data-signal-groupe={signal ? 'point-faible' : undefined}
                        >
                          {carte.manques[i] > 0 ? `−${carte.manques[i]}` : '·'}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* L'ENTOURAGE — en matière, toujours : la région ambre de
                l'écran est la colonne qui troue, pas son commentaire. */}
            {autourDeLaCarte && (
              <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2 lg:border-l lg:border-border-row lg:pl-10">
                <div>
                  <p className="eyebrow">Les passages du mois</p>
                  <p className="tnum mt-2 text-[27px] font-semibold leading-none text-text-primary">
                    {autourDeLaCarte.duMois}
                  </p>
                  {autourDeLaCarte.parQui.length === 0 ? (
                    <p className="mt-3 text-[12.5px] leading-relaxed text-text-muted">
                      Aucun passage sur ce modèle depuis le début du mois.
                    </p>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {autourDeLaCarte.parQui.map(([qui, n]) => (
                        <li key={qui} className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate text-[13px] capitalize text-text-secondary">
                            {qui}
                          </span>
                          <span className="tnum flex-shrink-0 font-mono text-[11px] text-text-muted">
                            {n} passage{n > 1 ? 's' : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="eyebrow">Le point qui échoue</p>
                  {pointAmbre === null ? (
                    <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
                      Aucun point de ce modèle n’a manqué sur les {carte.runs.length} derniers
                      passages : la carte n’a pas de colonne trouée.
                    </p>
                  ) : (
                    <>
                      <p className="mt-2 text-[15px] font-semibold leading-snug text-text-primary">
                        {carte.points[pointAmbre]}
                      </p>
                      <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted">
                        Manqué les jours suivants :
                      </p>
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {carte.runs
                          .filter((r) => !r.checked?.[pointAmbre])
                          .map((r) => (
                            <li
                              key={r.id}
                              className="tnum border border-border-strong px-2 py-1 font-mono text-[10px] text-text-secondary"
                            >
                              {new Date(r.doneAt).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                              })}
                            </li>
                          ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            )}
            </div>

            {pointAmbre !== null && (
              <p className="mt-6 border-t border-border-row pt-3 text-[13px] leading-relaxed text-text-secondary">
                <span
                  className={`signal-plate px-2 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] ${halo}`}
                  data-signal-groupe="point-faible"
                >
                  Point {pointAmbre + 1}
                </span>{' '}
                <span className="font-semibold text-text-primary">{carte.points[pointAmbre]}</span> a
                manqué {carte.manques[pointAmbre]} fois sur {carte.runs.length} passages. C’est la
                colonne qui troue, et elle ne se voit pas dans une liste de passages.
              </p>
            )}
            {pointAmbre === null && enCours && (
              <p className="mt-6 border-t border-border-row pt-3 text-[13px] leading-relaxed text-text-muted">
                Un passage est en cours : il faut le valider ou le fermer. Le point le plus fragile
                reprendra l’ambre ensuite — une statistique attend, une liste ouverte non.
              </p>
            )}
          </motion.section>
        )}

        <motion.div variants={staggerItem} className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <div className="flex flex-col">
            {tries.map((m) => {
              const h = parModele.get(m.id) ?? [];
              const dernier = h[0];
              const tourne = enCours?.id === m.id;
              const choisi = m.id === ouvertModele.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setOuvertId(m.id)}
                  /* L'AMBRE de l'écran : le modèle EN COURS de passage. Pas le
                     modèle sélectionné — celui qu'on est en train de cocher, et
                     qu'il faut valider ou fermer avant de partir. */
                  data-signal-groupe={tourne ? 'modele-en-cours' : undefined}
                  className={`relative flex flex-col gap-1.5 border-b border-[#161616] px-3 py-3.5 text-left transition-colors last:border-b-0 ${
                    choisi ? 'bg-raised' : 'hover:bg-surface-hover'
                  }`}
                >
                  {choisi && (
                    <span
                      className={`absolute inset-y-0 left-0 w-[2px] ${tourne ? 'bg-signal' : 'bg-border-strong'}`}
                      aria-hidden
                    />
                  )}
                  <span className={`truncate text-[14.5px] ${choisi ? 'font-semibold text-text-primary' : 'text-text-body'}`}>
                    {m.title}
                  </span>
                  {/* Le rail dit le strict nécessaire pour CHOISIR : combien de
                      points, et quand ça a été fait pour la dernière fois. Le
                      « par qui » est sur la feuille, en tête — l'écrire ici
                      poussait la ligne sur trois niveaux dans 240 px. */}
                  <span className={`eyebrow ${tourne ? 'text-signal' : ''}`}>
                    {tourne
                      ? t('controles.passageEnCours')
                      : [
                          m.items.length === 1
                            ? t('controles.unPoint')
                            : t('controles.nPoints', { n: m.items.length }),
                          dernier ? relativeTime(dernier.doneAt) : t('controles.aucunPassage'),
                        ].join(' · ')}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-5">
            <div className="panel-sheet">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-sheet px-5 py-3.5 sm:px-8">
                <p className="eyebrow">
                  {actif
                    ? t('controles.passageDuJour', { date: dateEtHeure(new Date().toISOString()), qui: moi })
                    : dernierDuModele
                      ? t('controles.dernierPassageLe', { date: dateEtHeure(dernierDuModele.doneAt), qui: dernierDuModele.byEmail.split('@')[0] })
                      : t('controles.aucunPassage')}
                </p>
                <button
                  type="button"
                  onClick={() => void remove('checklists', ouvertModele.id)}
                  aria-label={t('controles.supprimer')}
                  title={t('controles.supprimer')}
                  className="ml-auto flex h-8 w-8 items-center justify-center text-text-muted transition-colors hover:text-danger"
                >
                  <Trash2 size={13} strokeWidth={1.9} />
                </button>
              </div>

              <div className="p-5 sm:p-8">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <h2 className="text-[24px] font-bold leading-[1.15] tracking-[-0.028em] text-text-primary sm:text-[30px]">
                    {ouvertModele.title}
                  </h2>
                  <p className="tnum font-mono text-[15px] text-text-secondary">
                    {t('controles.conforme', {
                      n: actif ? actif.checked.filter(Boolean).length : dernierDuModele ? nombreConformes(dernierDuModele) : 0,
                      total: ouvertModele.items.length,
                    })}
                  </p>
                </div>

                <ol className="mt-6 flex flex-col">
                  {ouvertModele.items.map((item, i) => {
                    const coche = actif ? actif.checked[i] : false;
                    return (
                      <li key={`${item}-${i}`} className="border-b border-[#1f1f1f] last:border-b-0">
                        <button
                          type="button"
                          onClick={() => (actif ? cocher(i) : lancer(ouvertModele))}
                          aria-pressed={coche}
                          className="flex min-h-[52px] w-full items-center gap-4 text-left transition-colors hover:bg-surface-hover"
                        >
                          <span
                            className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center border ${
                              coche ? 'border-text-primary bg-text-primary' : 'border-border-strong'
                            }`}
                          >
                            {coche && <Check size={14} strokeWidth={3} className="text-bg" />}
                          </span>
                          <span className={`text-[15.5px] ${coche ? 'text-text-primary' : 'text-text-secondary'}`}>{item}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>

                <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                  {actif ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void valider()}
                        className="min-h-11 bg-accent px-5 text-[12.5px] font-semibold text-bg shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)] transition-colors hover:bg-accent-hover"
                      >
                        {t('controles.valider')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnCours(null)}
                        className="min-h-11 border border-border-strong px-5 text-[12.5px] font-semibold text-text-primary transition-colors hover:bg-surface-hover"
                      >
                        {t('chrome.fermer')}
                      </button>
                      {/* La promesse du bouton, écrite avant qu'on le presse :
                          un passage validé est une trace signée, pas une case. */}
                      <p className="eyebrow leading-[1.7]">{t('controles.validerEnregistre')}</p>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => lancer(ouvertModele)}
                      className="flex min-h-11 items-center gap-2 bg-accent px-5 text-[12.5px] font-semibold text-bg shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)] transition-colors hover:bg-accent-hover"
                    >
                      <ClipboardCheck size={14} strokeWidth={2} />
                      {t('controles.lancer')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* LA TRACE — ce qui existe le jour où on la demande. */}
            {historiqueDuModele.length > 0 && (
              <section>
                <div className="mb-1 flex items-center gap-4">
                  <p className="eyebrow flex-shrink-0">{t('controles.laTrace')}</p>
                  <span className="h-px flex-1 bg-border-section" aria-hidden />
                  <p className="eyebrow flex-shrink-0">{t('controles.troisDerniers')}</p>
                </div>
                <ul className="flex flex-col">
                  {historiqueDuModele.slice(0, 3).map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-[#161616] py-3 last:border-b-0"
                    >
                      <span className="tnum w-[180px] flex-shrink-0 font-mono text-[12.5px] tracking-[0.1em] text-text-muted">
                        {dateEtHeure(p.doneAt)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] text-text-secondary">
                        {p.byEmail.split('@')[0]}
                      </span>
                      <span
                        className={`tnum flex-shrink-0 font-mono text-[13.5px] ${
                          nombreConformes(p) === p.checked.length ? 'text-text-primary' : 'text-text-secondary'
                        }`}
                      >
                        {t('controles.conforme', { n: nombreConformes(p), total: p.checked.length })}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </motion.div>
        </>
      ) : null}

    </motion.section>
  );
}
