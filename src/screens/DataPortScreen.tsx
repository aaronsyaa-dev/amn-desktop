import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Upload } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { useSync, uid } from '../state/SyncContext';
import { useClients } from '../state/useClients';
import { bridge } from '../lib/bridge';
import { downloadText } from '../lib/download';
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
  const cles = entete.map((h) => h.trim().replace(/^﻿/, '').toLowerCase());
  return corps.map((l) => Object.fromEntries(cles.map((k, i) => [k, (l[i] ?? '').trim()])));
}
const colonne = (ligne: Record<string, string>, ...noms: string[]) => noms.map((n) => ligne[n]).find((v) => v !== undefined && v !== '') ?? '';

/**
 * L'IMPORT / EXPORT — vos données, dans les deux sens.
 *
 * Pour qui : une organisation qui veut ses chiffres dans un tableur, ou qui
 * arrive avec un fichier de clients et un inventaire. Ce que ça règle :
 * chaque collection en CSV, l'organisation entière en JSON (le même export
 * que celui des Paramètres), et l'import CSV des clients et du stock — les
 * deux fichiers qu'on a toujours déjà quelque part. Rien n'est transformé en
 * silence : l'import dit combien de lignes il a lues et combien il a posées.
 */
export function DataPortScreen() {
  const { t } = useLangue();
  const { upsert } = useSync();
  const { createClient } = useClients();
  const [etat, setEtat] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const fichierClients = useRef<HTMLInputElement | null>(null);
  const fichierStock = useRef<HTMLInputElement | null>(null);
  const jour = new Date().toISOString().slice(0, 10);

  const exporterCsv = async (nom: SyncedCollection, cle: string) => {
    setOccupe(true);
    try {
      const records = await bridge().remote.listRecords(nom);
      const lignes = records.filter((r) => !r.deleted).map((r) => ({ id: r.id, ...cellules(r.data as Record<string, unknown>), updatedAt: r.updatedAt }));
      downloadText(`﻿${versCsv(lignes)}`, `${cle}-${jour}.csv`, 'text/csv');
      setEtat(t('donnees.exporte', { n: lignes.length, quoi: t(`donnees.collection.${cle}` as Parameters<typeof t>[0]) }));
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
      setEtat(t('donnees.exporteJson'));
    } catch {
      setEtat(t('donnees.echec'));
    } finally {
      setOccupe(false);
    }
  };
  const importerClients = async (fichier: File) => {
    setOccupe(true);
    try {
      const lignes = lireCsv(await fichier.text());
      let poses = 0;
      for (const l of lignes) {
        const name = colonne(l, 'name', 'nom', 'client');
        if (!name) continue;
        createClient({ name, company: colonne(l, 'company', 'société', 'societe', 'entreprise'), email: colonne(l, 'email', 'e-mail', 'mail'), phone: colonne(l, 'phone', 'téléphone', 'telephone', 'tel') });
        poses += 1;
      }
      setEtat(t('donnees.importe', { lu: lignes.length, pose: poses, quoi: t('donnees.collection.clients') }));
    } catch {
      setEtat(t('donnees.echec'));
    } finally {
      setOccupe(false);
    }
  };
  const importerStock = async (fichier: File) => {
    setOccupe(true);
    try {
      const lignes = lireCsv(await fichier.text());
      let poses = 0;
      const now = new Date().toISOString();
      for (const l of lignes) {
        const name = colonne(l, 'name', 'article', 'nom', 'désignation', 'designation');
        if (!name) continue;
        const quantity = Number(colonne(l, 'quantity', 'quantité', 'quantite', 'qte', 'stock').replace(',', '.')) || 0;
        const seuil = colonne(l, 'minquantity', 'seuil', 'minimum', 'min');
        await upsert('stockItems', uid('stk'), { name, unit: colonne(l, 'unit', 'unité', 'unite'), quantity, minQuantity: seuil === '' ? null : Number(seuil.replace(',', '.')) || 0, createdAt: now, movedAt: now });
        poses += 1;
      }
      setEtat(t('donnees.importe', { lu: lignes.length, pose: poses, quoi: t('donnees.collection.stock') }));
    } catch {
      setEtat(t('donnees.echec'));
    } finally {
      setOccupe(false);
    }
  };

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

      <motion.div variants={staggerItem} className="grid gap-4 lg:grid-cols-2">
        <section aria-label={t('donnees.exporter')} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <p className="eyebrow">{t('donnees.exporter')}</p>
          <p className="text-xs text-text-muted">{t('donnees.exporterAide')}</p>
          <ul className="flex flex-wrap gap-1">
            {COLLECTIONS.map((c) => (
              <li key={c.nom}>
                <button type="button" disabled={occupe} onClick={() => void exporterCsv(c.nom, c.cle)} className="flex min-h-11 items-center gap-1 border border-border px-3 text-xs text-text-secondary hover:text-text-primary disabled:opacity-40 md:min-h-0 md:py-1.5"><Download size={11} /> {t(`donnees.collection.${c.cle}` as Parameters<typeof t>[0])}</button>
              </li>
            ))}
          </ul>
          <button type="button" disabled={occupe} onClick={() => void exporterJson()} className="flex min-h-11 w-fit items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-40 md:min-h-0 md:py-2"><Download size={14} /> {t('donnees.toutJson')}</button>
        </section>
        <section aria-label={t('donnees.importer')} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <p className="eyebrow">{t('donnees.importer')}</p>
          <p className="text-xs text-text-muted">{t('donnees.importerAide')}</p>
          <input ref={fichierClients} type="file" accept=".csv,text/csv" className="sr-only" aria-label={t('donnees.importerClients')} onChange={(e) => { const f = e.target.files?.[0]; if (f) void importerClients(f); e.target.value = ''; }} />
          <input ref={fichierStock} type="file" accept=".csv,text/csv" className="sr-only" aria-label={t('donnees.importerStock')} onChange={(e) => { const f = e.target.files?.[0]; if (f) void importerStock(f); e.target.value = ''; }} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={occupe} onClick={() => fichierClients.current?.click()} className="flex min-h-11 items-center gap-2 border border-border-strong px-4 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-40 md:min-h-0 md:py-2"><Upload size={14} /> {t('donnees.importerClients')}</button>
            <button type="button" disabled={occupe} onClick={() => fichierStock.current?.click()} className="flex min-h-11 items-center gap-2 border border-border-strong px-4 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-40 md:min-h-0 md:py-2"><Upload size={14} /> {t('donnees.importerStock')}</button>
          </div>
          <p className="text-xs text-text-muted">{t('donnees.colonnes')}</p>
        </section>
      </motion.div>
    </motion.section>
  );
}
