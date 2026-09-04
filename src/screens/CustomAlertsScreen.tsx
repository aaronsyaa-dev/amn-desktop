import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BellRing, Loader2, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { bridge } from '../lib/bridge';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';
import type { AdminOrganization, ModuleRequestForOperator, OrgPulse, SupportRequestForOperator } from '../shared/api';
import { echantillonParc } from '../lib/parcEchantillon';

type Nature = 'silence' | 'critiques' | 'support' | 'sitesHorsLigne' | 'modules';
interface AlertRuleData {
  kind: Nature;
  threshold: number;
  enabled: boolean;
  createdAt: string;
}
const NATURES: Nature[] = ['silence', 'critiques', 'support', 'sitesHorsLigne', 'modules'];
const SEUIL_DEFAUT: Record<Nature, number> = { silence: 14, critiques: 1, support: 3, sitesHorsLigne: 1, modules: 7 };
const JOUR = 86_400_000;

interface Parc {
  orgs: AdminOrganization[];
  pouls: Map<string, OrgPulse | null>;
  support: SupportRequestForOperator[];
  modules: ModuleRequestForOperator[];
}
interface Declenchee {
  regle: AlertRuleData & { id: string };
  org: AdminOrganization;
  valeur: string;
}

/** Ce que chaque règle voit, organisation par organisation. */
export function evaluer(regles: (AlertRuleData & { id: string })[], parc: Parc, maintenant = Date.now()): Declenchee[] {
  const out: Declenchee[] = [];
  for (const regle of regles) {
    if (!regle.enabled) continue;
    for (const org of parc.orgs) {
      const p = parc.pouls.get(org.id) ?? null;
      switch (regle.kind) {
        case 'silence': {
          const jours = org.lastActivityAt ? Math.floor((maintenant - Date.parse(org.lastActivityAt)) / JOUR) : Infinity;
          if (jours >= regle.threshold) out.push({ regle, org, valeur: Number.isFinite(jours) ? `${jours} j` : '∞' });
          break;
        }
        case 'critiques': {
          const n = p?.events.critical7Days ?? 0;
          if (n >= regle.threshold) out.push({ regle, org, valeur: String(n) });
          break;
        }
        case 'support': {
          const limite = new Date(maintenant - regle.threshold * JOUR).toISOString();
          const n = parc.support.filter((s) => s.orgId === org.id && s.status === 'pending' && s.createdAt < limite).length;
          if (n > 0) out.push({ regle, org, valeur: String(n) });
          break;
        }
        case 'sitesHorsLigne': {
          const hors = (p?.sites.total ?? 0) - (p?.sites.online ?? 0);
          if (hors >= regle.threshold && hors > 0) out.push({ regle, org, valeur: `${hors}/${p?.sites.total ?? 0}` });
          break;
        }
        case 'modules': {
          const limite = new Date(maintenant - regle.threshold * JOUR).toISOString();
          const n = parc.modules.filter((m) => m.orgId === org.id && m.status === 'pending' && String(m.createdAt ?? '') < limite).length;
          if (n > 0) out.push({ regle, org, valeur: String(n) });
          break;
        }
        default:
          break;
      }
    }
  }
  return out;
}

/**
 * LES ALERTES PERSONNALISÉES — vos propres seuils sur le parc.
 *
 * Pour qui : Aaron, qui sait mieux que l'application ce qui l'inquiète :
 * une cliente silencieuse depuis deux semaines, une demande sans réponse
 * depuis trois jours, un site hors ligne. Ce que ça règle : des règles à
 * seuil, gardées dans l'organisation interne, évaluées à chaque minute sur
 * les chiffres que le serveur tient déjà. Les alertes du SOC restent celles
 * du SOC ; celles-ci sont les siennes.
 */
export function CustomAlertsScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const regles = useCollection<AlertRuleData>('customAlerts');
  const [parc, setParc] = useState<Parc | null>(null);
  const [echec, setEchec] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [kind, setKind] = useState<Nature>('silence');
  const [threshold, setThreshold] = useState(String(SEUIL_DEFAUT.silence));

  useEffect(() => {
    let vivant = true;
    const lire = async () => {
      try {
        const admin = bridge().remote.admin;
        const [orgs, support, modules] = await Promise.all([echantillonParc(), admin.supportRequests('pending'), admin.moduleRequests('pending')]);
        const clientes = (orgs as AdminOrganization[]).filter((o) => o.plan !== 'internal');
        const pouls = await Promise.all(clientes.map((o) => admin.organizationPulse(o.id).catch(() => null)));
        if (!vivant) return;
        setParc({ orgs: clientes, pouls: new Map(clientes.map((o, i) => [o.id, pouls[i] as OrgPulse | null])), support: support as SupportRequestForOperator[], modules: modules as ModuleRequestForOperator[] });
        setEchec(false);
      } catch {
        if (vivant) setEchec(true);
      }
    };
    void lire();
    const id = window.setInterval(() => void lire(), 60_000);
    return () => { vivant = false; window.clearInterval(id); };
  }, []);

  const declenchees = useMemo(() => (parc ? evaluer(regles, parc) : []), [regles, parc]);
  const concernees = new Set(declenchees.map((d) => d.org.id)).size;
  const nature = (n: Nature) => t(`alertesPerso.nature.${n}` as Parameters<typeof t>[0]);
  const unite = (n: Nature) => t(`alertesPerso.unite.${n}` as Parameters<typeof t>[0]);

  const creer = async () => {
    const seuil = Math.max(1, Math.round(Number(threshold) || SEUIL_DEFAUT[kind]));
    await upsert('customAlerts', uid('alr'), { kind, threshold: seuil, enabled: true, createdAt: new Date().toISOString() });
    setOuvert(false);
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('parcSup.surtitre', { module: t('alertesPerso.titre') })}
          title={t('alertesPerso.titre')}
          description={t('alertesPerso.description')}
          stats={[
            { label: t('alertesPerso.stat.regles'), value: regles.length },
            { label: t('alertesPerso.stat.declenchees'), value: declenchees.length, emphasis: declenchees.length > 0 },
            { label: t('alertesPerso.stat.organisations'), value: concernees },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('alertesPerso.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void creer(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-text-muted sm:col-span-2">{t('alertesPerso.champNature')}
            <select value={kind} onChange={(e) => { const k = e.target.value as Nature; setKind(k); setThreshold(String(SEUIL_DEFAUT[k])); }} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none">
              {NATURES.map((n) => <option key={n} value={n}>{nature(n)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">{t('alertesPerso.champSeuil')} ({unite(kind)})
            <input value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="numeric" className="input-focus tnum min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-3">
            <button type="submit" className="bg-accent px-4 py-2 text-sm font-semibold text-bg">{t('alertesPerso.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {echec && <motion.p variants={staggerItem} role="alert" className="text-sm text-danger">{t('parcSup.echec')}</motion.p>}
      {!parc && !echec && <motion.p variants={staggerItem} className="flex items-center gap-2 text-sm text-text-muted"><Loader2 size={14} className="animate-spin" /> {t('parcSup.lecture')}</motion.p>}

      {regles.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('alertesPerso.vide.titre')} action={{ label: t('alertesPerso.vide.action'), onClick: () => setOuvert(true) }}>{t('alertesPerso.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem} className="grid gap-4 lg:grid-cols-2">
          <section aria-label={t('alertesPerso.regles')} className="flex flex-col gap-2">
            <p className="eyebrow">{t('alertesPerso.regles')}</p>
            {regles.map((r) => (
              <div key={r.id} className={`group flex items-center gap-3 rounded-xl border bg-surface p-3 ${r.enabled ? 'border-border' : 'border-dashed border-border opacity-70'}`}>
                <BellRing size={14} className="shrink-0 text-text-muted" />
                <p className="min-w-0 flex-1 text-sm text-text-primary">{nature(r.kind)} <span className="tnum text-text-muted">· {r.threshold} {unite(r.kind)}</span></p>
                <button type="button" onClick={() => void upsert('customAlerts', r.id, { ...r, enabled: !r.enabled })} aria-pressed={r.enabled} className="min-h-11 border border-border px-3 text-xs text-text-secondary hover:text-text-primary md:min-h-0 md:py-1">{r.enabled ? t('alertesPerso.suspendre') : t('alertesPerso.reprendre')}</button>
                <button type="button" onClick={() => void remove('customAlerts', r.id)} aria-label={t('alertesPerso.supprimer')} title={t('alertesPerso.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
              </div>
            ))}
          </section>
          <section aria-label={t('alertesPerso.declenchees')} className="flex flex-col gap-2">
            <p className="eyebrow">{t('alertesPerso.declenchees')}</p>
            {parc && declenchees.length === 0 && <p className="text-sm text-text-secondary">{t('alertesPerso.rien')}</p>}
            {declenchees.map((d) => (
              <div key={`${d.regle.id}-${d.org.id}`} className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/5 p-3">
                <p className="min-w-0 flex-1 text-sm text-text-primary"><span className="font-semibold">{d.org.name}</span> <span className="text-text-secondary">· {nature(d.regle.kind)}</span></p>
                <span className="tnum font-mono text-xs text-warning">{d.valeur}</span>
              </div>
            ))}
          </section>
        </motion.div>
      )}
    </motion.section>
  );
}
