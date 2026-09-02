import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2, X } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { bridge } from '../lib/bridge';
import { lireMaturite, SIGNAUX, type Maturite, type Niveau, type Signal } from '../lib/maturiteSoc';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';
import type { AdminOrganization, InputAlert, ModuleRequestForOperator, OrgPulse, SupportRequestForOperator } from '../shared/api';

/**
 * LA MATURITÉ SOC — où en est chaque cliente, sur des signaux réels.
 *
 * Pour qui : Aaron et Mohamed, devant le parc. Ce que ça règle : au lieu
 * d'une impression (« elle est calme, celle-là »), six signaux lus dans le
 * pouls que le serveur tient déjà, et le niveau qui en découle — avec, pour
 * chaque signal au rouge, le chiffre qui l'a décidé. Voir `lib/maturiteSoc`.
 */
export function SocMaturityScreen() {
  const { t } = useLangue();
  const [etat, setEtat] = useState<'chargement' | 'pret' | 'echec'>('chargement');
  const [maturites, setMaturites] = useState<Maturite[]>([]);
  const [luA, setLuA] = useState<Date | null>(null);

  useEffect(() => {
    let vivant = true;
    const lire = async () => {
      try {
        const admin = bridge().remote.admin;
        const [orgs, entrees, support, modules] = await Promise.all([
          admin.listOrganizations(),
          admin.inputAlerts({ limit: 500 }),
          admin.supportRequests('pending'),
          admin.moduleRequests('pending'),
        ]);
        const clientes = (orgs as AdminOrganization[]).filter((o) => o.plan !== 'internal');
        const pouls = await Promise.all(clientes.map((o) => admin.organizationPulse(o.id).catch(() => null)));
        if (!vivant) return;
        setMaturites(clientes.map((o, i) => lireMaturite(o, pouls[i] as OrgPulse | null, entrees as InputAlert[], support as SupportRequestForOperator[], modules as ModuleRequestForOperator[])).sort((a, b) => a.verts - b.verts || a.org.name.localeCompare(b.org.name)));
        setEtat('pret');
        setLuA(new Date());
      } catch {
        if (vivant) setEtat('echec');
      }
    };
    void lire();
    const id = window.setInterval(() => void lire(), 60_000);
    return () => { vivant = false; window.clearInterval(id); };
  }, []);

  const parNiveau = useMemo(() => ({ fragile: maturites.filter((m) => m.niveau === 'fragile').length, enProgres: maturites.filter((m) => m.niveau === 'enProgres').length, solide: maturites.filter((m) => m.niveau === 'solide').length }), [maturites]);
  const niveau = (n: Niveau) => t(`maturite.niveau.${n}` as Parameters<typeof t>[0]);
  const signal = (s: Signal) => t(`maturite.signal.${s}` as Parameters<typeof t>[0]);
  const manque = (s: Signal) => t(`maturite.manque.${s}` as Parameters<typeof t>[0]);

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('parcSup.surtitre', { module: t('maturite.titre') })}
          title={t('maturite.titre')}
          description={t('maturite.description')}
          stats={[
            { label: t('maturite.stat.organisations'), value: maturites.length },
            { label: t('maturite.stat.solides'), value: parNiveau.solide },
            { label: t('maturite.stat.fragiles'), value: parNiveau.fragile, emphasis: parNiveau.fragile > 0 },
          ]}
        />
      </motion.div>

      {etat === 'chargement' && <motion.p variants={staggerItem} className="flex items-center gap-2 text-sm text-text-muted"><Loader2 size={14} className="animate-spin" /> {t('parcSup.lecture')}</motion.p>}
      {etat === 'echec' && <motion.p variants={staggerItem} role="alert" className="text-sm text-danger">{t('parcSup.echec')}</motion.p>}
      {etat === 'pret' && maturites.length === 0 && (
        <motion.div variants={staggerItem}><FirstRun title={t('maturite.vide.titre')}>{t('maturite.vide.texte')}</FirstRun></motion.div>
      )}
      {etat === 'pret' && maturites.length > 0 && (
        <>
          <motion.p variants={staggerItem} className="text-xs text-text-muted">{t('maturite.methode')}{luA ? ` · ${t('parcSup.luA', { heure: luA.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) })}` : ''}</motion.p>
          <motion.div variants={staggerItem} className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(20rem,1fr))]">
            {maturites.map((m) => (
              <article key={m.org.id} className={`flex flex-col gap-2 rounded-xl border bg-surface p-4 ${m.niveau === 'solide' ? 'border-success/30' : m.niveau === 'fragile' ? 'border-warning/40' : 'border-border'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{m.org.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{niveau(m.niveau)} · {t('maturite.verts', { n: m.verts })}</p>
                  </div>
                  <span className={`tnum text-lg font-medium ${m.niveau === 'solide' ? 'text-success' : m.niveau === 'fragile' ? 'text-warning' : 'text-text-primary'}`}>{m.verts}/6</span>
                </div>
                <ul className="flex flex-col divide-y divide-border">
                  {SIGNAUX.map((s) => {
                    const l = m.lectures.find((x) => x.signal === s);
                    if (!l) return null;
                    return (
                      <li key={s} className="flex items-start gap-2 py-1.5 text-xs">
                        {l.ok ? <Check size={13} className="mt-0.5 shrink-0 text-success" /> : <X size={13} className="mt-0.5 shrink-0 text-warning" />}
                        <span className="min-w-0 flex-1 text-text-primary">{signal(s)}{!l.ok && <span className="block text-text-muted">{manque(s)}</span>}</span>
                        <span className="tnum shrink-0 font-mono text-text-secondary">{l.valeur}</span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))}
          </motion.div>
        </>
      )}
    </motion.section>
  );
}
