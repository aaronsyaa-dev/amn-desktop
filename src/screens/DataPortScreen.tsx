import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Upload } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { useHaloSignal } from '../components/EtatEcran';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useClients } from '../state/useClients';
import { bridge } from '../lib/bridge';
import { downloadText } from '../lib/download';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';
import type { SyncedCollection } from '../shared/api';

/** Les collections exportables en CSV : celles qu'on relit dans un tableur, avec un nom lisible. */
const COLLECTIONS: { nom: SyncedCollection; cle: string }[] = [
  { nom: 'clients', cle: 'clients' },
  { nom: 'invoices', cle: 'factures' },
  { nom: 'tasks', cle: 'taches' },
  { nom: 'appointments', cle: 'agenda' },
  { nom: 'prospects', cle: 'pipeline' },
  { nom: 'stockItems', cle: 'stock' },
  { nom: 'suppliers', cle: 'fournisseurs' },
  { nom: 'tickets', cle: 'sav' },
  { nom: 'formAnswers', cle: 'reponses' },
  { nom: 'logbook', cle: 'journal' },
];

/** Aplatit un enregistrement en cellules : les objets deviennent du JSON, les tableaux se joignent. */
function cellules(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) out[k] = '';
    else if (typeof v === 'object') out[k] = JSON.stringify(v);
    else out[k] = String(v);
  }
  return out;
}
export function versCsv(lignes: Record<string, string>[]): string {
  const colonnes = [...new Set(lignes.flatMap((l) => Object.keys(l)))];
  const echapper = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [colonnes.join(';'), ...lignes.map((l) => colonnes.map((c) => echapper(l[c] ?? '')).join(';'))].join('\r\n');
}
/** Lit un CSV (séparateur ; ou ,) avec guillemets ; la première ligne nomme les colonnes. */
export function lireCsv(texte: string): Record<string, string>[] {
  const sep = (texte.split('\n')[0] ?? '').includes(';') ? ';' : ',';
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let cellule = '';
  let entreGuillemets = false;
  for (let i = 0; i < texte.length; i += 1) {
    const c = texte[i];
    if (entreGuillemets) {
      if (c === '"' && texte[i + 1] === '"') { cellule += '"'; i += 1; }
      else if (c === '"') entreGuillemets = false;
      else cellule += c;
    } else if (c === '"') entreGuillemets = true;
    else if (c === sep) { ligne.push(cellule); cellule = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texte[i + 1] === '\n') i += 1;
      ligne.push(cellule); cellule = '';
      if (ligne.some((v) => v.trim())) lignes.push(ligne);
      ligne = [];
    } else cellule += c;
  }
  ligne.push(cellule);
  if (ligne.some((v) => v.trim())) lignes.push(ligne);
  const [entete = [], ...corps] = lignes;
  const cles = entete.map((h) => h.trim().replace(/^\uFEFF/, '').toLowerCase());
  return corps.map((l) => Object.fromEntries(cles.map((k, i) => [k, (l[i] ?? '').trim()])));
}
const colonne = (ligne: Record<string, string>, ...noms: string[]) => noms.map((n) => ligne[n]).find((v) => v !== undefined && v !== '') ?? '';


/*
  ═════════════════════════════════════════════════════════════════════
  L'AIGUILLAGE — et la seule règle qui compte : RIEN N'EST ÉCRIT AVANT
  ═════════════════════════════════════════════════════════════════════

  Un import n'est pas une barre de progression. Une barre de progression
  répond à « où en est-on », alors que la seule question d'un import est
  « qu'est-ce que ça va faire à mes données ». Et cette question n'a de sens
  qu'AVANT — après, il est trop tard, et la réponse ne sert plus à rien.

  L'écran lisait le fichier et écrivait dans la foulée : on découvrait le
  résultat en même temps que le serveur. Il lit désormais, TRIE, montre le
  tri, et n'écrit que sur validation. Le surtitre le répète, et il le répète
  parce qu'on ne le croit pas la première fois.

  `CRAN` vaut 7 px et c'est ce qui distingue cet objet d'un camembert : les
  voies sont crantées, donc on voit qu'elles portent des UNITÉS — des lignes
  d'un fichier, qu'on pourrait compter — et non un pourcentage. Une voie
  lisse à 12 % et une voie lisse à 12 % de dix fois plus de lignes ont la même
  allure ; crantées, jamais.
*/
const CRAN = 7;
const VOIE_H = 34;
const VOIE_ECART = 10;

type Voie = 'creations' | 'maj' | 'rejets';
type Cible = 'clients' | 'stock';

interface LigneTriee {
  /** Le numéro de ligne dans le fichier, en-tête comprise — pour le dire à qui corrige. */
  rang: number;
  voie: Voie;
  /** Le motif, pour les rejets seulement. */
  motif: string;
  brut: Record<string, string>;
  nom: string;
}

interface Tri {
  cible: Cible;
  nomDuFichier: string;
  lignes: LigneTriee[];
  /** Les colonnes trouvées dans le fichier, dans l'ordre. */
  colonnes: string[];
}

/** Les champs que l'import sait remplir, et les intitulés de colonne acceptés. */
const CORRESPONDANCES: Record<Cible, { champ: string; accepte: string[] }[]> = {
  clients: [
    { champ: 'name', accepte: ['name', 'nom', 'client'] },
    { champ: 'company', accepte: ['company', 'société', 'societe', 'entreprise'] },
    { champ: 'email', accepte: ['email', 'e-mail', 'mail'] },
    { champ: 'phone', accepte: ['phone', 'téléphone', 'telephone', 'tel'] },
  ],
  stock: [
    { champ: 'name', accepte: ['name', 'article', 'nom', 'désignation', 'designation'] },
    { champ: 'unit', accepte: ['unit', 'unité', 'unite'] },
    { champ: 'quantity', accepte: ['quantity', 'quantité', 'quantite', 'qte', 'stock'] },
    { champ: 'minQuantity', accepte: ['minquantity', 'seuil', 'minimum', 'min'] },
  ],
};

/** Les exports récents, gardés sur CE poste. Voir le commentaire de la carte. */
const CLE_EXPORTS = 'amn.exports.recents';
interface ExportFait {
  quoi: string;
  lignes: number;
  quand: string;
}

/**
 * L'IMPORT / EXPORT — vos données, dans les deux sens.
 *
 * Pour qui : une organisation qui veut ses chiffres dans un tableur, ou qui
 * arrive avec un fichier de clients et un inventaire. Chaque collection en
 * CSV, l'organisation entière en JSON, et l'import CSV des clients et du
 * stock — les deux fichiers qu'on a toujours déjà quelque part.
 *
 * ## Ce qui domine : l'aiguillage, et le moment où l'on peut encore dire non
 *
 * Voir l'en-tête des constantes : pourquoi un tri et pas une progression,
 * pourquoi des crans et pas un pourcentage, et pourquoi rien n'est écrit
 * avant la validation.
 *
 * ## L'ambre : la voie des rejets
 *
 * Son libellé, son remplissage cranté et son décompte — trois nœuds, une
 * région. Pas d'ambre quand il n'y a aucun rejet : un fichier qui passe
 * entier ne demande rien, il se valide.
 */
export function DataPortScreen() {
  const { t } = useLangue();
  const { upsert } = useSync();
  const { createClient } = useClients();
  const clients = useClients().clients;
  const stock = useCollection<{ name: string }>('stockItems');
  const [etat, setEtat] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [tri, setTri] = useState<Tri | null>(null);
  const [exports, setExports] = useState<ExportFait[]>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(CLE_EXPORTS) ?? '[]') as ExportFait[];
    } catch {
      return [];
    }
  });
  const fichierClients = useRef<HTMLInputElement | null>(null);
  const fichierStock = useRef<HTMLInputElement | null>(null);
  const jour = new Date().toISOString().slice(0, 10);

  const noterLExport = (quoi: string, lignes: number) => {
    const suite = [{ quoi, lignes, quand: new Date().toISOString() }, ...exports].slice(0, 6);
    setExports(suite);
    try {
      window.localStorage.setItem(CLE_EXPORTS, JSON.stringify(suite));
    } catch {
      /* Stockage refusé : la liste vit le temps de la session, et c'est tout
         ce qu'elle a jamais promis. */
    }
  };

  const exporterCsv = async (nom: SyncedCollection, cle: string) => {
    setOccupe(true);
    try {
      const records = await bridge().remote.listRecords(nom);
      const lignes = records.filter((r) => !r.deleted).map((r) => ({ id: r.id, ...cellules(r.data as Record<string, unknown>), updatedAt: r.updatedAt }));
      downloadText(`﻿${versCsv(lignes)}`, `${cle}-${jour}.csv`, 'text/csv');
      const quoi = t(`donnees.collection.${cle}` as Parameters<typeof t>[0]);
      noterLExport(quoi, lignes.length);
      setEtat(t('donnees.exporte', { n: lignes.length, quoi }));
    } catch {
      setEtat(t('donnees.echec'));
    } finally {
      setOccupe(false);
    }
  };
  const exporterJson = async () => {
    setOccupe(true);
    try {
      const tout = await bridge().remote.exportOrganization();
      downloadText(JSON.stringify(tout, null, 2), `organisation-${jour}.json`, 'application/json');
      noterLExport(t('donnees.toutJson'), 0);
      setEtat(t('donnees.exporteJson'));
    } catch {
      setEtat(t('donnees.echec'));
    } finally {
      setOccupe(false);
    }
  };

  /*
    LA LECTURE — et rien d'autre. Aucune écriture ne part d'ici, pas même une
    création « évidente » : c'est la promesse du surtitre, et une promesse à
    laquelle on fait une exception n'en est plus une.
  */
  const lire = async (fichier: File, cible: Cible) => {
    setOccupe(true);
    setEtat(null);
    try {
      const texte = await fichier.text();
      const lignes = lireCsv(texte);
      const colonnes = Object.keys(lignes[0] ?? {});
      const dejaLa = new Set(
        (cible === 'clients' ? clients.map((c) => c.name) : stock.map((s) => s.name)).map((n) => n.trim().toLowerCase()),
      );
      const vuesDansLeFichier = new Set<string>();
      const triees: LigneTriee[] = lignes.map((brut, i) => {
        const rang = i + 2;
        const nom =
          cible === 'clients'
            ? colonne(brut, 'name', 'nom', 'client')
            : colonne(brut, 'name', 'article', 'nom', 'désignation', 'designation');
        if (!nom) return { rang, voie: 'rejets' as Voie, motif: t('donnees.motif.sansNom'), brut, nom: '' };
        const cle = nom.trim().toLowerCase();
        if (vuesDansLeFichier.has(cle)) {
          return { rang, voie: 'rejets' as Voie, motif: t('donnees.motif.doublon'), brut, nom };
        }
        vuesDansLeFichier.add(cle);
        if (cible === 'stock') {
          const brute = colonne(brut, 'quantity', 'quantité', 'quantite', 'qte', 'stock');
          if (brute !== '' && !Number.isFinite(Number(brute.replace(',', '.')))) {
            return { rang, voie: 'rejets' as Voie, motif: t('donnees.motif.quantite'), brut, nom };
          }
        }
        return { rang, voie: dejaLa.has(cle) ? ('maj' as Voie) : ('creations' as Voie), motif: '', brut, nom };
      });
      setTri({ cible, nomDuFichier: fichier.name, lignes: triees, colonnes });
    } catch {
      setEtat(t('donnees.echec'));
    } finally {
      setOccupe(false);
    }
  };

  /* LA VALIDATION — le seul endroit du fichier qui écrit. */
  const valider = async () => {
    if (!tri) return;
    setOccupe(true);
    try {
      const now = new Date().toISOString();
      let poses = 0;
      for (const l of tri.lignes) {
        if (l.voie === 'rejets') continue;
        if (tri.cible === 'clients') {
          createClient({
            name: l.nom,
            company: colonne(l.brut, 'company', 'société', 'societe', 'entreprise'),
            email: colonne(l.brut, 'email', 'e-mail', 'mail'),
            phone: colonne(l.brut, 'phone', 'téléphone', 'telephone', 'tel'),
          });
        } else {
          const quantity = Number(colonne(l.brut, 'quantity', 'quantité', 'quantite', 'qte', 'stock').replace(',', '.')) || 0;
          const seuil = colonne(l.brut, 'minquantity', 'seuil', 'minimum', 'min');
          await upsert('stockItems', uid('stk'), {
            name: l.nom,
            unit: colonne(l.brut, 'unit', 'unité', 'unite'),
            quantity,
            minQuantity: seuil === '' ? null : Number(seuil.replace(',', '.')) || 0,
            createdAt: now,
            movedAt: now,
          });
        }
        poses += 1;
      }
      setEtat(t('donnees.importe', { lu: tri.lignes.length, pose: poses, quoi: t(`donnees.collection.${tri.cible}` as Parameters<typeof t>[0]) }));
      setTri(null);
    } catch {
      setEtat(t('donnees.echec'));
    } finally {
      setOccupe(false);
    }
  };

  /* LES LIGNES REJETÉES, RÉCUPÉRABLES — un CSV aux mêmes colonnes, plus le
     motif. Sans ça, « 3 rejets » est une information qu'on ne peut pas
     utiliser, donc une information qui ne sert à rien. */
  const telechargerLesRejets = () => {
    if (!tri) return;
    const rejets = tri.lignes.filter((l) => l.voie === 'rejets');
    if (rejets.length === 0) return;
    downloadText(
      `﻿${versCsv(rejets.map((l) => ({ ...l.brut, ligne: String(l.rang), motif: l.motif })))}`,
      `rejets-${jour}.csv`,
      'text/csv',
    );
  };

  const comptes = useMemo(() => {
    const par: Record<Voie, number> = { creations: 0, maj: 0, rejets: 0 };
    for (const l of tri?.lignes ?? []) par[l.voie] += 1;
    return par;
  }, [tri]);
  const total = tri?.lignes.length ?? 0;
  const halo = useHaloSignal(comptes.rejets > 0);

  /* Les motifs de rejet, comptés et rangés du plus fréquent au moins. */
  const motifs = useMemo(() => {
    const par = new Map<string, number>();
    for (const l of tri?.lignes ?? []) {
      if (l.voie !== 'rejets') continue;
      par.set(l.motif, (par.get(l.motif) ?? 0) + 1);
    }
    return [...par.entries()].sort((a, b) => b[1] - a[1]);
  }, [tri]);

  const VOIES: { cle: Voie; libelle: string }[] = [
    { cle: 'creations', libelle: t('donnees.voie.creations') },
    { cle: 'maj', libelle: t('donnees.voie.maj') },
    { cle: 'rejets', libelle: t('donnees.voie.rejets') },
  ];

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('outils.surtitre', { module: t('donnees.titre') })}
          title={t('donnees.titre')}
          description={t('donnees.description')}
          stats={[{ label: t('donnees.stat.collections'), value: COLLECTIONS.length }]}
        />
      </motion.div>

      {etat && <motion.p variants={staggerItem} role="status" className="rounded-xl border border-border bg-surface p-3 text-sm text-text-primary">{etat}</motion.p>}

      {/*
        ═══ L'OBJET DOMINANT : l'aiguillage ═══

        Il est DESSINÉ MÊME À VIDE, voies nommées et compteurs à zéro. Un
        aiguillage qui n'apparaîtrait qu'une fois le fichier lu laisserait
        l'écran sans objet au repos — et surtout, il n'apprendrait rien avant :
        or ce qu'on veut savoir AVANT de choisir un fichier, c'est justement
        que l'import trie en trois voies et n'écrit rien tout seul.
      */}
      <motion.section variants={staggerItem} className={`panel-raised p-5 sm:p-6 ${halo}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            {/* LE SURTITRE RÉPÈTE LA PROMESSE. C'est sa seule raison d'être. */}
            <p className="eyebrow">{t('donnees.rienEcritAvant')}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
              {tri ? `${tri.nomDuFichier} · ${t('donnees.lignesLues', { n: total })}` : t('donnees.aucunFichierLu')}
            </p>
          </div>

          <div className="mt-5 flex flex-col" style={{ gap: VOIE_ECART }}>
            {VOIES.map((v) => {
              const n = comptes[v.cle];
              const part = total === 0 ? 0 : (n / total) * 100;
              const ambre = v.cle === 'rejets' && n > 0;
              return (
                <div key={v.cle} className="flex items-center gap-3">
                  <span
                    data-signal-groupe={ambre ? 'les-rejets' : undefined}
                    className={`w-32 flex-shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${
                      ambre ? 'bg-signal px-1.5 py-0.5 text-signal-ink' : 'text-text-secondary'
                    }`}
                  >
                    {v.libelle}
                  </span>
                  <span className="flex h-full min-w-0 flex-1 items-center" style={{ height: VOIE_H }}>
                    {/*
                      LE REMPLISSAGE CRANTÉ. Le dégradé répété donne un trait
                      clair tous les 7 px : c'est ce qui fait lire des unités
                      là où un aplat ferait lire un pourcentage.
                    */}
                    <span
                      data-signal-groupe={ambre ? 'les-rejets' : undefined}
                      className="h-full"
                      style={{
                        width: `${part}%`,
                        minWidth: n > 0 ? CRAN * 2 : 0,
                        backgroundColor: ambre ? 'var(--color-signal)' : 'var(--color-border-strong)',
                        backgroundImage: `repeating-linear-gradient(90deg, transparent 0 ${CRAN - 1}px, ${
                          ambre ? 'rgba(8,8,8,0.35)' : 'var(--color-sunken)'
                        } ${CRAN - 1}px ${CRAN}px)`,
                      }}
                      aria-hidden
                    />
                  </span>
                  <span
                    data-signal-groupe={ambre ? 'les-rejets' : undefined}
                    className={`w-14 flex-shrink-0 text-right text-[19px] font-semibold tabular-nums leading-none ${
                      ambre ? 'bg-signal px-1.5 py-0.5 text-signal-ink' : 'text-text-primary'
                    }`}
                  >
                    {n}
                  </span>
                </div>
              );
            })}
          </div>

          {/* SOUS LES VOIES — les motifs, et comment récupérer les rejets. */}
          {motifs.length > 0 && (
            <div className="mt-5 border-t border-border-strong pt-4">
              <ul className="flex flex-col gap-1.5">
                {motifs.map(([motif, n]) => (
                  <li key={motif} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 text-text-body">{motif}</span>
                    <span className="flex-shrink-0 font-mono tabular-nums text-text-secondary">{n}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-text-secondary">{t('donnees.recupererAide')}</p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {!tri && (
              <>
                <button type="button" disabled={occupe} onClick={() => fichierClients.current?.click()} className="flex min-h-11 items-center gap-2 border border-border-strong px-4 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-40 md:min-h-0 md:py-2.5"><Upload size={14} /> {t('donnees.importerClients')}</button>
                <button type="button" disabled={occupe} onClick={() => fichierStock.current?.click()} className="flex min-h-11 items-center gap-2 border border-border-strong px-4 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-40 md:min-h-0 md:py-2.5"><Upload size={14} /> {t('donnees.importerStock')}</button>
              </>
            )}
            {tri && <button type="button" disabled={occupe || comptes.creations + comptes.maj === 0} onClick={() => void valider()} className="bg-accent px-4 py-2.5 text-sm font-semibold text-bg disabled:opacity-40">
              {t('donnees.valider', { n: comptes.creations + comptes.maj })}
            </button>}
            {comptes.rejets > 0 && (
              <button type="button" onClick={telechargerLesRejets} className="flex items-center gap-2 border border-border-strong px-4 py-2.5 text-sm text-text-primary hover:bg-surface-hover">
                <Download size={14} /> {t('donnees.telechargerRejets')}
              </button>
            )}
            {tri && (
              <button type="button" onClick={() => setTri(null)} className="border border-border px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary">
                {t('donnees.abandonner')}
              </button>
            )}
          </div>
      </motion.section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* À GAUCHE — la correspondance des colonnes, avec les flèches. */}
        <motion.section variants={staggerItem} className="panel p-4">
          <p className="eyebrow mb-3">{t('donnees.importer')}</p>
          <p className="max-w-prose text-sm leading-relaxed text-text-secondary">{t('donnees.importerAide')}</p>
          <input ref={fichierClients} type="file" accept=".csv,text/csv" className="hidden" aria-label={t('donnees.importerClients')} onChange={(e) => { const f = e.target.files?.[0]; if (f) void lire(f, 'clients'); e.target.value = ''; }} />
          <input ref={fichierStock} type="file" accept=".csv,text/csv" className="hidden" aria-label={t('donnees.importerStock')} onChange={(e) => { const f = e.target.files?.[0]; if (f) void lire(f, 'stock'); e.target.value = ''; }} />

          <p className="eyebrow mb-2 mt-5">{t('donnees.correspondance')}</p>
          <ul className="flex flex-col gap-1.5">
            {CORRESPONDANCES[tri?.cible ?? 'clients'].map((c) => {
              const trouvee = tri ? tri.colonnes.find((col) => c.accepte.includes(col)) : null;
              return (
                <li key={c.champ} className="flex items-center gap-3 text-sm">
                  <span className={`w-40 flex-shrink-0 truncate font-mono text-[11px] ${trouvee ? 'text-text-primary' : 'text-text-muted'}`}>
                    {trouvee ?? c.accepte.join(', ')}
                  </span>
                  <span aria-hidden className="flex-shrink-0 text-text-muted">→</span>
                  <span className="min-w-0 truncate text-text-secondary">{c.champ}</span>
                </li>
              );
            })}
          </ul>
        </motion.section>

        {/* À DROITE — les exports récents. */}
        <motion.aside variants={staggerItem} className="panel p-4">
          <p className="eyebrow mb-3">{t('donnees.exporter')}</p>
          <ul className="flex flex-wrap gap-1">
            {COLLECTIONS.map((c) => (
              <li key={c.nom}>
                <button type="button" disabled={occupe} onClick={() => void exporterCsv(c.nom, c.cle)} className="flex min-h-11 items-center gap-1 border border-border px-3 text-xs text-text-secondary hover:text-text-primary disabled:opacity-40 md:min-h-0 md:py-1.5"><Download size={11} /> {t(`donnees.collection.${c.cle}` as Parameters<typeof t>[0])}</button>
              </li>
            ))}
          </ul>
          <button type="button" disabled={occupe} onClick={() => void exporterJson()} className="mt-3 flex min-h-11 w-fit items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-40 md:min-h-0 md:py-2"><Download size={14} /> {t('donnees.toutJson')}</button>

          <p className="eyebrow mb-2 mt-5">{t('donnees.exportsRecents')}</p>
          {exports.length === 0 ? (
            <p className="text-sm text-text-muted">{t('donnees.aucunExport')}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {exports.map((e, i) => (
                <li key={`${e.quand}-${i}`} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-text-secondary">{e.quoi}</span>
                  <span className="flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-muted">{relativeTime(e.quand)}</span>
                </li>
              ))}
            </ul>
          )}
          {/*
            ARBITRAGE DIT À L'ÉCRAN : il n'existe aucun journal d'export dans le
            modèle, et en inventer un côté serveur pour une carte de coin
            d'écran serait disproportionné. Cette liste est donc celle de CE
            poste, et la phrase le dit plutôt que de laisser croire qu'un
            collègue verrait la même.
          */}
          <p className="mt-3 text-xs leading-relaxed text-text-muted">{t('donnees.exportsLocaux')}</p>
        </motion.aside>
      </div>
    </motion.section>
  );
}
