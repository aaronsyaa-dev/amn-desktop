import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { bridge } from '../lib/bridge';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';
import type { AdminOrganization, OrgPulse, ParcInsights } from '../shared/api';
import { echantillonParc } from '../lib/parcEchantillon';

interface Ligne {
  org: AdminOrganization;
  pouls: OrgPulse | null;
  records7d: number;
  previous7d: number;
  connections: number;
}
type Colonne = 'nom' | 'formule' | 'membres' | 'modules' | 'activite' | 'sites' | 'tendance' | 'derniere';

/**
 * LE COMPARATIF CLIENTES — toutes les organisations côte à côte.
 *
 * Pour qui : Aaron, quand il faut décider où passer du temps. Ce que ça
 * règle : une ligne par organisation avec les mêmes colonnes, triables — la
 * formule, les membres, les modules ouverts, les jours actifs, les sites,
 * la tendance de la semaine et la dernière activité. Rien n'est calculé
 * ici : ce sont le pouls et les mesures du parc, mis en face.
 */
export function OrgCompareScreen() {
  const { t } = useLangue();
  const [etat, setEtat] = useState<'chargement' | 'pret' | 'echec'>('chargement');
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [tri, setTri] = useState<{ colonne: Colonne; desc: boolean }>({ colonne: 'activite', desc: true });

  useEffect(() => {
    let vivant = true;
    const lire = async () => {
      try {
        const admin = bridge().remote.admin;
        const [orgs, insights] = await Promise.all([echantillonParc(), admin.insights()]);
        const clientes = (orgs as AdminOrganization[]).filter((o) => o.plan !== 'internal');
        const pouls = await Promise.all(clientes.map((o) => admin.organizationPulse(o.id).catch(() => null)));
        if (!vivant) return;
        const parId = new Map((insights as ParcInsights).orgs.map((o) => [o.id, o]));
        setLignes(clientes.map((org, i) => ({ org, pouls: pouls[i] as OrgPulse | null, records7d: parId.get(org.id)?.records7d ?? 0, previous7d: parId.get(org.id)?.previous7d ?? 0, connections: parId.get(org.id)?.connections ?? 0 })));
        setEtat('pret');
      } catch {
        if (vivant) setEtat('echec');
      }
    };
    void lire();
    const id = window.setInterval(() => void lire(), 60_000);
    return () => { vivant = false; window.clearInterval(id); };
  }, []);

  const valeur = (l: Ligne, c: Colonne): number | string => {
    switch (c) {
      case 'nom': return l.org.name.toLowerCase();
      case 'formule': return l.org.plan;
      case 'membres': return l.pouls?.users.active ?? l.org.userCount;
      case 'modules': return l.org.modules ? l.org.modules.length : 999;
      case 'activite': return l.pouls?.activeDaysLast30 ?? 0;
      case 'sites': return l.pouls?.sites.total ?? 0;
      case 'tendance': return l.records7d - l.previous7d;
      case 'derniere': return l.org.lastActivityAt ?? '';
      default: return 0;
    }
  };
  const triees = useMemo(() => [...lignes].sort((a, b) => {
    const va = valeur(a, tri.colonne); const vb = valeur(b, tri.colonne);
    const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
    return tri.desc ? -cmp : cmp;
  }), [lignes, tri]);
  const actives7 = lignes.filter((l) => l.org.lastActivityAt && Date.now() - Date.parse(l.org.lastActivityAt) < 7 * 86_400_000).length;
  const membresActifs = lignes.reduce((n, l) => n + (l.pouls?.users.active ?? 0), 0);
  const COLONNES: Colonne[] = ['nom', 'formule', 'membres', 'modules', 'activite', 'sites', 'tendance', 'derniere'];
  const entete = (c: Colonne) => t(`comparatif.colonne.${c}` as Parameters<typeof t>[0]);
  const formule = (p: string) => t(`comparatif.formule.${p}` as Parameters<typeof t>[0]);
  const trier = (c: Colonne) => setTri((x) => ({ colonne: c, desc: x.colonne === c ? !x.desc : c !== 'nom' }));

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('parcSup.surtitre', { module: t('comparatif.titre') })}
          title={t('comparatif.titre')}
          description={t('comparatif.description')}
          stats={[
            { label: t('comparatif.stat.organisations'), value: lignes.length },
            { label: t('comparatif.stat.actives7'), value: actives7 },
            { label: t('comparatif.stat.membres'), value: membresActifs },
          ]}
        />
      </motion.div>
      {etat === 'chargement' && <motion.p variants={staggerItem} className="flex items-center gap-2 text-sm text-text-muted"><Loader2 size={14} className="animate-spin" /> {t('parcSup.lecture')}</motion.p>}
      {etat === 'echec' && <motion.p variants={staggerItem} role="alert" className="text-sm text-danger">{t('parcSup.echec')}</motion.p>}
      {etat === 'pret' && lignes.length === 0 && <motion.div variants={staggerItem}><FirstRun title={t('comparatif.vide.titre')}>{t('comparatif.vide.texte')}</FirstRun></motion.div>}
      {etat === 'pret' && lignes.length > 0 && (
        <motion.div variants={staggerItem} className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[56rem] border-collapse text-sm">
            <thead>
              <tr>
                {COLONNES.map((c) => (
                  <th key={c} scope="col" className="p-2 text-left">
                    <button type="button" onClick={() => trier(c)} aria-sort={tri.colonne === c ? (tri.desc ? 'descending' : 'ascending') : 'none'} className="eyebrow flex min-h-11 items-center gap-1 hover:text-text-primary md:min-h-0">
                      {entete(c)} {tri.colonne === c ? (tri.desc ? <ArrowDown size={10} /> : <ArrowUp size={10} />) : null}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {triees.map((l) => {
                const delta = l.records7d - l.previous7d;
                return (
                  <tr key={l.org.id} className="border-t border-border">
                    <th scope="row" className="p-2 text-left font-medium text-text-primary">{l.org.name}{l.org.status === 'suspended' && <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-warning">{t('comparatif.suspendue')}</span>}</th>
                    <td className="p-2 text-text-secondary">{formule(l.org.plan)}</td>
                    <td className="tnum p-2 text-text-primary">{l.pouls ? `${l.pouls.users.active}/${l.pouls.users.total}` : l.org.userCount}{l.org.seats ? <span className="text-text-muted"> · {l.org.seats}</span> : null}</td>
                    <td className="tnum p-2 text-text-primary">{l.org.modules ? l.org.modules.length : t('comparatif.tous')}</td>
                    <td className="tnum p-2 text-text-primary">{l.pouls ? `${l.pouls.activeDaysLast30}/30` : '—'}</td>
                    <td className="tnum p-2 text-text-primary">{l.pouls ? `${l.pouls.sites.online}/${l.pouls.sites.total}` : '—'}</td>
                    <td className={`tnum p-2 ${delta > 0 ? 'text-success' : delta < 0 ? 'text-warning' : 'text-text-muted'}`}>{delta > 0 ? '+' : ''}{delta} <span className="text-text-muted">({l.records7d})</span></td>
                    <td className="p-2 text-text-secondary">{l.org.lastActivityAt ? relativeTime(l.org.lastActivityAt) : t('comparatif.jamais')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      )}
    </motion.section>
  );
}
