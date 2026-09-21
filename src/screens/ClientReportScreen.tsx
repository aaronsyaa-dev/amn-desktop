import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Loader2, Printer } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { bridge } from '../lib/bridge';
import { lireMaturite, type Signal } from '../lib/maturiteSoc';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';
import type { AdminOrganization, AdminOrgUser, InputAlert, ModuleRequestForOperator, OrgPulse, ParcInsights, SupportRequestForOperator } from '../shared/api';
import { echantillonParc } from '../lib/parcEchantillon';
import { DosDuRapport } from '../components/parc/DosDuRapport';
import { markdownDuRapport, sectionsDuRapport, type Dossier } from '../lib/rapportClient';

/**
 * LE RAPPORT CLIENT ENRICHI — tout ce qu'on sait d'une cliente, en une page.
 *
 * Pour qui : Aaron, avant un rendez-vous ou un point trimestriel. Ce que ça
 * règle : le module Rapports rédige ; celui-ci COMPOSE, depuis ce que le
 * serveur sait déjà — identité, formule, membres, modules ouverts, activité,
 * sites, échanges de support, entrées suspectes, maturité SOC — une page à
 * imprimer ou à copier en Markdown dans un rapport rédigé. Aucun chiffre
 * n'est saisi à la main.
 */
export function ClientReportScreen() {
  const { t, langue } = useLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const [orgs, setOrgs] = useState<AdminOrganization[]>([]);
  const [orgId, setOrgId] = useState('');
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [etat, setEtat] = useState<'chargement' | 'pret' | 'echec'>('chargement');
  const [copie, setCopie] = useState(false);
  /* Les sections retenues. Le tableau décide de celles qui partent décochées ; l'opérateur décide ensuite. */
  const [choisies, setChoisies] = useState<Set<string> | null>(null);

  useEffect(() => {
    echantillonParc().then((liste) => {
      const clientes = (liste as AdminOrganization[]).filter((o) => o.plan !== 'internal').sort((a, b) => a.name.localeCompare(b.name));
      setOrgs(clientes);
      setOrgId((id) => id || clientes[0]?.id || '');
      setEtat('pret');
    }).catch(() => setEtat('echec'));
  }, []);

  useEffect(() => {
    if (!orgId) return undefined;
    let vivant = true;
    setDossier(null);
    const admin = bridge().remote.admin;
    Promise.all([
      admin.listUsers(orgId),
      admin.organizationPulse(orgId).catch(() => null),
      admin.supportRequests(),
      admin.inputAlerts({ orgId, limit: 500 }),
      admin.moduleRequests('pending'),
      bridge().remote.modules.catalogue().catch(() => []),
      admin.insights().catch(() => null),
    ]).then(([membres, pouls, support, entrees, modules, catalogue, insights]) => {
      if (!vivant) return;
      const org = orgs.find((o) => o.id === orgId);
      if (!org) return;
      const trenteJours = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const dOrg = (support as SupportRequestForOperator[]).filter((s) => s.orgId === orgId);
      const parId = new Map(((insights as ParcInsights | null)?.orgs ?? []).map((o) => [o.id, o]));
      const series = [...parId.values()].map((o) => o.records7d).sort((a, b) => a - b);
      setDossier({
        org,
        membres: membres as AdminOrgUser[],
        pouls: pouls as OrgPulse | null,
        support: dOrg,
        maturite: lireMaturite(org, pouls as OrgPulse | null, entrees as InputAlert[], dOrg, modules as ModuleRequestForOperator[]),
        entrees30: (entrees as InputAlert[]).filter((e) => e.createdAt >= trenteJours).length,
        catalogue: new Map((catalogue as { key: string; label: string }[]).map((m) => [m.key, m.label])),
        /*
          LA POSITION DANS LE PARC, SANS NOMMER PERSONNE. `insights` rend les
          écritures de sept jours de CHAQUE organisation en un appel : la
          médiane se calcule donc sur des chiffres réels, et la section ne
          publie que des positions, jamais un nom.
        */
        parc: {
          clientes: series.length,
          ecrituresMediane7j: series.length > 0 ? series[Math.floor(series.length / 2)] : 0,
          ecritures7j: parId.get(orgId)?.records7d ?? 0,
        },
      });
    }).catch(() => { if (vivant) setEtat('echec'); });
    return () => { vivant = false; };
  }, [orgId, orgs]);

  const signal = useCallback((s: Signal) => t(`maturite.signal.${s}` as Parameters<typeof t>[0]), [t]);
  const date = useCallback((iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '—'), [locale]);

  /*
    UN SEUL TABLEAU. Le sommaire, le dos et le Markdown lisent `sections` :
    c'est ce qui garantit que la hauteur d'un segment est bien le poids de ce
    que la section écrit, et qu'aucune section ne puisse exister d'un côté sans
    l'autre.
  */
  const sections = useMemo(() => (dossier ? sectionsDuRapport(dossier, {
    identite: t('rapportClient.identite'),
    formule: t('rapportClient.formule'),
    depuis: t('rapportClient.depuis'),
    membres: t('rapportClient.membres'),
    places: t('rapportClient.places'),
    derniereActivite: t('rapportClient.derniereActivite'),
    modules: t('rapportClient.modules'),
    tousModules: t('rapportClient.tousModules'),
    activite: t('rapportClient.activite'),
    joursActifs: t('rapportClient.joursActifs'),
    enregistrements: t('rapportClient.enregistrements'),
    sites: t('rapportClient.sites'),
    critiques: t('rapportClient.critiques'),
    support: t('rapportClient.support'),
    enAttente: t('rapportClient.enAttente'),
    enTout: t('rapportClient.enTout'),
    entrees: t('rapportClient.entrees'),
    maturite: t('maturite.titre'),
    nomDuSignal: (x: string) => signal(x as Signal),
    formuleDe: (plan: string) => t(`comparatif.formule.${plan}` as Parameters<typeof t>[0]),
    date,
  }) : []), [dossier, t, signal, date]);

  /* Les décochées par défaut viennent du tableau, une seule fois par cliente ouverte. */
  const retenues = useMemo(() => choisies ?? new Set(sections.filter((x) => !x.parDefautDecochee).map((x) => x.cle)), [choisies, sections]);
  const basculer = (cle: string) => setChoisies(new Set(
    retenues.has(cle) ? [...retenues].filter((c) => c !== cle) : [...retenues, cle],
  ));

  const markdown = () => (dossier ? markdownDuRapport(dossier.org.name, sections, retenues) : '');

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(markdown());
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      /* presse-papiers refusé */
    }
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('parcSup.surtitre', { module: t('rapportClient.titre') })}
          title={t('rapportClient.titre')}
          description={t('rapportClient.description')}
          stats={[
            { label: t('rapportClient.stat.organisations'), value: orgs.length },
            { label: t('rapportClient.membres'), value: dossier ? dossier.membres.filter((m) => m.status === 'active').length : '—' },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void copier()} disabled={!dossier} className="flex min-h-11 items-center gap-2 border border-border px-3 text-sm text-text-secondary hover:text-text-primary disabled:opacity-40">{copie ? <Check size={14} /> : <Copy size={14} />} <span className="hidden sm:inline">{copie ? t('rapportClient.copie') : t('rapportClient.copier')}</span></button>
              <button type="button" onClick={() => window.print()} disabled={!dossier} className="flex min-h-11 items-center gap-2 bg-accent px-3 text-sm font-semibold text-bg disabled:opacity-40"><Printer size={14} /> <span className="hidden sm:inline">{t('rapportClient.imprimer')}</span></button>
            </div>
          }
        />
      </motion.div>

      <motion.label variants={staggerItem} className="flex flex-col gap-1 text-xs text-text-muted">
        {t('rapportClient.choisir')}
        <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="input-focus min-h-11 w-full max-w-md border border-border bg-bg px-3 text-sm text-text-primary outline-none">
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </motion.label>

      {etat === 'echec' && <motion.p variants={staggerItem} role="alert" className="text-sm text-danger">{t('parcSup.echec')}</motion.p>}
      {etat === 'pret' && orgs.length === 0 && <motion.div variants={staggerItem}><FirstRun title={t('rapportClient.vide.titre')}>{t('rapportClient.vide.texte')}</FirstRun></motion.div>}
      {orgId && !dossier && etat !== 'echec' && <motion.p variants={staggerItem} className="flex items-center gap-2 text-sm text-text-muted"><Loader2 size={14} className="animate-spin" /> {t('parcSup.lecture')}</motion.p>}
      {dossier && (
        <motion.div variants={staggerItem} className="print:hidden">
          <DosDuRapport sections={sections} choisies={retenues} onBasculer={basculer} />
        </motion.div>
      )}
      {dossier && (
        <motion.article variants={staggerItem} className="grid gap-5 rounded-xl border border-border bg-surface p-5 print:border-0 md:grid-cols-2">
          <h2 className="text-xl font-bold tracking-tight text-text-primary md:col-span-2">{dossier.org.name}</h2>
          {sections.filter((x) => x.obligatoire || retenues.has(x.cle)).map((x) => (
            <section key={x.cle} className={x.lignes.length > 6 ? 'md:col-span-2' : undefined}>
              <p className="eyebrow">{x.titre}</p>
              <dl className="mt-2 flex flex-col divide-y divide-border text-sm">
                {x.lignes.map((l) => (
                  <div key={`${l.k}${l.v}`} className="flex justify-between gap-3 py-1.5">
                    <dt className="min-w-0 truncate text-text-muted">{l.k}</dt>
                    <dd className="tnum flex-none text-text-primary">{l.v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </motion.article>
      )}
    </motion.section>
  );
}
