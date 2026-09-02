import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Eraser, PenTool, ShieldCheck, ShieldAlert, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface SignatureData {
  title: string;
  signer: string;
  signedAt: string;
  imageDataUrl: string;
  hash: string;
  byEmail: string;
}

/** SHA-256 hexadécimal de ce qui est scellé ensemble : document, signataire, heure, tracé. */
export async function empreinte(s: Pick<SignatureData, 'title' | 'signer' | 'signedAt' | 'imageDataUrl'>): Promise<string> {
  const data = new TextEncoder().encode(`${s.title}|${s.signer}|${s.signedAt}|${s.imageDataUrl}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * LA SIGNATURE SUR PLACE — un devis ou un bon signé au doigt sur l'écran.
 *
 * Pour qui : un artisan, un livreur, une boutique dont le client accepte de
 * vive voix puis conteste. Ce que ça règle : le document nommé, le nom du
 * signataire, l'heure et le tracé sont scellés ensemble par une empreinte
 * SHA-256 vérifiable à tout moment — si l'un des quatre change, l'empreinte
 * ne correspond plus. Ce n'est pas une signature qualifiée au sens eIDAS :
 * c'est une preuve simple, honnête sur ce qu'elle est, et suffisante pour un
 * bon de livraison ou un devis accepté sur place.
 */
export function SignatureScreen() {
  const { t } = useLangue();
  const { user } = useAuth();
  const { upsert, remove } = useSync();
  const brutes = useCollection<SignatureData>('signatures');
  const [title, setTitle] = useState('');
  const [signer, setSigner] = useState('');
  const [trace, setTrace] = useState(false);
  const [verifs, setVerifs] = useState<Record<string, boolean>>({});
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dessin = useRef(false);

  const signatures = useMemo(() => [...brutes].sort((a, b) => b.signedAt.localeCompare(a.signedAt)), [brutes]);
  const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const ceMois = signatures.filter((s) => s.signedAt >= debutMois).length;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const largeur = c.clientWidth;
    c.width = Math.round(largeur * ratio);
    c.height = Math.round(180 * ratio);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#f5f5f5';
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const debut = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    dessin.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const mouvement = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dessin.current) return;
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setTrace(true);
  };
  const fin = () => { dessin.current = false; };
  const effacer = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    setTrace(false);
  };
  const enregistrer = async () => {
    const c = canvasRef.current;
    if (!c || !trace || !title.trim() || !signer.trim()) return;
    const base = { title: title.trim(), signer: signer.trim(), signedAt: new Date().toISOString(), imageDataUrl: c.toDataURL('image/png') };
    await upsert('signatures', uid('sig'), { ...base, hash: await empreinte(base), byEmail: user?.email ?? '' });
    setTitle(''); setSigner(''); effacer();
  };
  const verifier = async (s: SignatureData & { id: string }) => {
    const ok = (await empreinte(s)) === s.hash;
    setVerifs((v) => ({ ...v, [s.id]: ok }));
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('pilotage.surtitre', { module: t('signature.titre') })}
          title={t('signature.titre')}
          description={t('signature.description')}
          stats={[
            { label: t('signature.stat.signatures'), value: signatures.length },
            { label: t('signature.stat.mois'), value: ceMois },
            { label: t('signature.stat.derniere'), value: signatures[0] ? relativeTime(signatures[0].signedAt) : '—' },
          ]}
        />
      </motion.div>

      <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void enregistrer(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('signature.champDocument')} aria-label={t('signature.champDocument')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
        <input value={signer} onChange={(e) => setSigner(e.target.value)} placeholder={t('signature.champSignataire')} aria-label={t('signature.champSignataire')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
        <div className="sm:col-span-2">
          <p className="eyebrow mb-1 flex items-center gap-2"><PenTool size={11} /> {t('signature.tracer')}</p>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={t('signature.tracer')}
            onPointerDown={debut}
            onPointerMove={mouvement}
            onPointerUp={fin}
            onPointerCancel={fin}
            onPointerLeave={fin}
            className="h-[180px] w-full rounded-lg border border-dashed border-border-strong bg-bg"
            style={{ touchAction: 'none' }}
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button type="submit" disabled={!trace || !title.trim() || !signer.trim()} className="flex min-h-11 items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-40 md:min-h-0 md:py-2"><Check size={14} /> {t('signature.enregistrer')}</button>
          <button type="button" onClick={effacer} className="flex min-h-11 items-center gap-2 border border-border px-4 text-sm text-text-secondary hover:text-text-primary md:min-h-0 md:py-2"><Eraser size={14} /> {t('signature.effacer')}</button>
        </div>
      </motion.form>

      {signatures.length === 0 ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('signature.vide.titre')}>{t('signature.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.ul variants={staggerItem} className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(18rem,1fr))]">
          {signatures.map((s) => {
            const verif = verifs[s.id];
            return (
              <li key={s.id} className="group flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{s.title}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{s.signer} · {t('signature.signeeLe', { quand: relativeTime(s.signedAt) })}</p>
                  </div>
                  <button type="button" onClick={() => void remove('signatures', s.id)} aria-label={t('signature.supprimer')} title={t('signature.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
                </div>
                <img src={s.imageDataUrl} alt={`${t('signature.titre')} · ${s.signer}`} className="h-20 w-full rounded-lg border border-border bg-bg object-contain" />
                <p className="truncate font-mono text-[10px] text-text-muted" title={s.hash}>{t('signature.empreinte')} {s.hash.slice(0, 16)}…</p>
                <button type="button" onClick={() => void verifier(s)} className={`flex min-h-11 items-center justify-center gap-2 border px-3 text-xs md:min-h-0 md:py-1.5 ${verif === undefined ? 'border-border text-text-secondary hover:text-text-primary' : verif ? 'border-success/40 text-success' : 'border-danger/40 text-danger'}`}>
                  {verif === undefined ? <ShieldCheck size={13} /> : verif ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
                  {verif === undefined ? t('signature.verifier') : verif ? t('signature.intacte') : t('signature.alteree')}
                </button>
              </li>
            );
          })}
        </motion.ul>
      )}
    </motion.section>
  );
}
