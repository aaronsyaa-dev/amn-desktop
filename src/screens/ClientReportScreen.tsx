import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Loader2, Printer } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { bridge } from '../lib/bridge';
import { lireMaturite, SIGNAUX, type Maturite, type Signal } from '../lib/maturiteSoc';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';
import type { AdminOrganization, AdminOrgUser, InputAlert, ModuleRequestForOperator, OrgPulse, SupportRequestForOperator } from '../shared/api';

interface Dossier {
  org: AdminOrganization;
  membres: AdminOrgUser[];
  pouls: OrgPulse | null;
  support: SupportRequestForOperator[];
  maturite: Maturite;
  entrees30: number;
  catalogue: Map<string, string>;
}

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

  useEffect(() => {
    bridge().remote.admin.listOrganizations().then((liste) => {
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
    ]).then(([membres, pouls, support, entrees, modules, catalogue]) => {
      if (!vivant) return;
      const org = orgs.find((o) => o.id === orgId);
      if (!org) return;
      const trenteJours = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const dOrg = (support as SupportRequestForOperator[]).filter((s) => s.orgId === orgId);
      setDossier({
        org,
        membres: membres as AdminOrgUser[],
        pouls: pouls as OrgPulse | null,
        support: dOrg,
        maturite: lireMaturite(org, pouls as OrgPulse | null, entrees as InputAlert[], dOrg, modules as ModuleRequestForOperator[]),
        entrees30: (entrees as InputAlert[]).filter((e) => e.createdAt >= trenteJours).length,
        catalogue: new Map((catalogue as { key: string; label: string }[]).map((m) => [m.key, m.label])),
      });
    }).catch(() => { if (vivant) setEtat('echec'); });
    return () => { vivant = false; };
  }, [orgId, orgs]);

  const signal = (s: Signal) => t(`maturite.signal.${s}` as Parameters<typeof t>[0]);
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
  const modulesOuverts = useMemo(() => {
    if (!dossier) return [];
    if (!dossier.org.modules) return [t('rapportClient.tousModules')];
    return dossier.org.modules.map((k) => dossier.catalogue.get(k) ?? k);
  }, [dossier, t]);

  const markdown = () => {
    if (!dossier) return '';
    const p = dossier.pouls;
    const lignes = [
      `# ${dossier.org.name}`,
      '',
      `- ${t('rapportClient.formule')} : ${t(`comparatif.formule.${dossier.org.plan}` as Parameters<typeof t>[0])}`,
      `- ${t('rapportClient.depuis')} : ${date(dossier.org.createdAt)}`,
      `- ${t('rapportClient.membres')} : ${dossier.membres.filter((m) => m.status === 'active').length}/${dossier.membres.length}${dossier.org.seats ? ` (${dossier.org.seats} ${t('rapportClient.places')})` : ''}`,
      `- ${t('rapportClient.modules')} : ${modulesOuverts.join(', ')}`,
      '',
      `## ${t('rapportClient.activite')}`,
      `- ${t('rapportClient.joursActifs')} : ${p?.activeDaysLast30 ?? 0}/30`,
      `- ${t('rapportClient.enregistrements')} : ${p?.records.last7Days ?? 0} / ${p?.records.last30Days ?? 0}`,
      `- ${t('rapportClient.sites')} : ${p?.sites.online ?? 0}/${p?.sites.total ?? 0}`,
      `- ${t('rapportClient.critiques')} : ${p?.events.critical7Days ?? 0}`,
      `- ${t('rapportClient.support')} : ${dossier.support.filter((s) => s.status === 'pending').length} ${t('rapportClient.enAttente')}, ${dossier.support.length} ${t('rapportClient.enTout')}`,
      `- ${t('rapportClient.entrees')} : ${dossier.entrees30}`,
      '',
      `## ${t('maturite.titre')} — ${t(`maturite.niveau.${dossier.maturite.niveau}` as Parameters<typeof t>[0])} (${dossier.maturite.verts}/6)`,
      ...dossier.maturite.lectures.map((l) => `- ${l.ok ? '✓' : '✗'} ${signal(l.signal)} (${l.valeur})`),
    ];
    return lignes.join('\n');
  };
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
        <motion.article variants={staggerItem} className="grid gap-4 rounded-xl border border-border bg-surface p-5 print:border-0 md:grid-cols-2">
          <section className="md:col-span-2">
            <p className="eyebrow">{t('rapportClient.identite')}</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-text-primary">{dossier.org.name}</h2>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3"><dt className="text-text-muted">{t('rapportClient.formule')}</dt><dd className="text-text-primary">{t(`comparatif.formule.${dossier.org.plan}` as Parameters<typeof t>[0])}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-text-muted">{t('rapportClient.depuis')}</dt><dd className="text-text-primary">{date(dossier.org.createdAt)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-text-muted">{t('rapportClient.membres')}</dt><dd className="tnum text-text-primary">{dossier.membres.filter((m) => m.status === 'active').length}/{dossier.membres.length}{dossier.org.seats ? ` · ${dossier.org.seats} ${t('rapportClient.places')}` : ''}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-text-muted">{t('rapportClient.derniereActivite')}</dt><dd className="text-text-primary">{dossier.org.lastActivityAt ? relativeTime(dossier.org.lastActivityAt) : '—'}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-text-muted">{t('rapportClient.modules')} : <span className="text-text-secondary">{modulesOuverts.join(', ')}</span></p>
          </section>
          <section>
            <p className="eyebrow">{t('rapportClient.activite')}</p>
            <dl className="mt-2 flex flex-col divide-y divide-border text-sm">
              {[
                [t('rapportClient.joursActifs'), `${dossier.pouls?.activeDaysLast30 ?? 0}/30`],
                [t('rapportClient.enregistrements'), `${dossier.pouls?.records.last7Days ?? 0} / ${dossier.pouls?.records.last30Days ?? 0}`],
                [t('rapportClient.sites'), `${dossier.pouls?.sites.online ?? 0}/${dossier.pouls?.sites.total ?? 0}`],
                [t('rapportClient.critiques'), String(dossier.pouls?.events.critical7Days ?? 0)],
                [t('rapportClient.support'), `${dossier.support.filter((s) => s.status === 'pending').length} ${t('rapportClient.enAttente')} · ${dossier.support.length} ${t('rapportClient.enTout')}`],
                [t('rapportClient.entrees'), String(dossier.entrees30)],
              ].map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-1.5"><dt className="text-text-muted">{k}</dt><dd className="tnum text-text-primary">{v}</dd></div>)}
            </dl>
            {dossier.pouls && dossier.pouls.byCollection.length > 0 && (
              <p className="mt-2 text-xs text-text-muted">{t('rapportClient.collections')} : {[...dossier.pouls.byCollection].sort((a, b) => b.count - a.count).slice(0, 5).map((c) => `${c.collection} (${c.count})`).join(', ')}</p>
            )}
          </section>
          <section>
            <p className="eyebrow">{t('maturite.titre')} · {t(`maturite.niveau.${dossier.maturite.niveau}` as Parameters<typeof t>[0])} · {dossier.maturite.verts}/6</p>
            <ul className="mt-2 flex flex-col divide-y divide-border text-sm">
              {SIGNAUX.map((s) => { const l = dossier.maturite.lectures.find((x) => x.signal === s); return l ? <li key={s} className="flex justify-between gap-3 py-1.5"><span className={l.ok ? 'text-text-primary' : 'text-warning'}>{l.ok ? '✓' : '✗'} {signal(s)}</span><span className="tnum text-text-secondary">{l.valeur}</span></li> : null; })}
            </ul>
          </section>
        </motion.article>
      )}
    </motion.section>
  );
}
