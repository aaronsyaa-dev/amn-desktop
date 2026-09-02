import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

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
  const [refus, setRefus] = useState<string | null>(null);

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
      setRefus(t('materiel.creneauInvalide'));
      return;
    }
    const conflit = reservations.find((r) => r.resourceId === cible && chevauche(startAt, endAt, r.startAt, r.endAt));
    if (conflit) {
      setRefus(t('materiel.conflit', { qui: conflit.byEmail.split('@')[0], quand: quand(conflit.startAt, conflit.endAt) }));
      return;
    }
    await upsert('resourceBookings', uid('rsv'), { resourceId: cible, startAt, endAt, purpose: purpose.trim(), byEmail: user?.email ?? '', createdAt: new Date().toISOString() });
    setPurpose('');
  };
  const quand = (a: string, b: string) => `${new Date(a).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} → ${new Date(b).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
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
                {refus && <p role="alert" className="text-sm text-warning sm:col-span-2">{refus}</p>}
                <div className="sm:col-span-2">
                  <button type="submit" className="bg-accent px-4 py-2 text-sm font-semibold text-bg">{t('materiel.reserver')}</button>
                </div>
              </form>
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
