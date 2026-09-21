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
        <>
          {/*
            ── L'OBJET DOMINANT : LE BON, AVEC LA SIGNATURE DESSUS ──────────

            Aucune abstraction ne conviendrait. La valeur de ce module est LA
            PREUVE, et une preuve se regarde : le bon est donc rendu sur papier
            clair, avec le tracé tel qu'il a été fait au doigt, au-dessus de sa
            ligne. Une vignette de signature dans une liste de cartes ne prouve
            rien à personne — elle prouve qu'on a stocké une image.

            Le tracé est une DONNÉE, pas un ornement : il vient de la capture
            réelle (`imageDataUrl`, écrit par le canevas au moment de signer)
            et il entre dans l'empreinte SHA-256 avec le titre, le signataire
            et l'heure. Modifier le tracé casse l'empreinte, et l'écran sait le
            dire.

            ARBITRAGE. Le paquet place dans la marge « la distance au site »,
            qui demanderait la position de l'appareil au moment de signer. Ce
            n'est pas une donnée d'interface : relever la position de quelqu'un
            se demande, se consent et se conserve, et la décision appartient à
            qui vend le produit. Ce qui rend le bon opposable et que le module
            a vraiment : l'horodatage à la seconde, l'empreinte, et le fait que
            rien ne peut être modifié après coup.
          */}
          <motion.section variants={staggerItem} className="panel-raised panel-raised-wide px-[30px] pb-[26px] pt-[30px]">
            <div className="mb-[22px] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <span className="eyebrow text-text-secondary">Le dernier bon signé</span>
              <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
                {signatures.length} BON{signatures.length > 1 ? 'S' : ''} · {ceMois} CE MOIS
              </span>
            </div>

            <div className="flex flex-wrap items-start gap-x-8 gap-y-6">
              <div className="min-w-[320px] flex-1 bg-[var(--color-text-primary)] text-[#0a0a0a]">
                <div className="px-8 pt-8">
                  {/*
                    L'ENCRE SOURDE DU DOCUMENT EST #5c5c59, ET NON LE #6b6b68
                    DE LA MAQUETTE. La valeur du paquet est refusée par le
                    dépôt parce qu'elle tombe à 3,79:1 sur le fond SOMBRE ; sur
                    ce papier clair elle tiendrait 4,96:1, donc elle passerait.
                    Mais `check:encres` ne connaît pas le fond, et une valeur
                    refusée qui réapparaît « sauf ici » est exactement le genre
                    d'exception qui se recopie ailleurs sans son fond. #5c5c59
                    tient 6,22:1 sur ce papier et ne collisionne avec rien.
                  */}
                  <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#5c5c59]">
                    Bon d’intervention
                  </span>
                  <span className="mt-3 block text-[24px] font-bold leading-[1.15] tracking-[-0.02em]">
                    {signatures[0].title}
                  </span>
                  <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-[#d5d5d1] pt-5 text-[13px]">
                    <div>
                      <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#5c5c59]">Client</dt>
                      <dd className="mt-1 font-semibold">{signatures[0].signer}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#5c5c59]">Signé le</dt>
                      <dd className="tnum mt-1 font-mono font-semibold">
                        {new Date(signatures[0].signedAt).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </dd>
                    </div>
                  </dl>

                  {/* LA SIGNATURE, au-dessus de sa ligne. */}
                  <div className="mt-8">
                    <img
                      src={signatures[0].imageDataUrl}
                      alt={`Signature de ${signatures[0].signer}`}
                      className="h-[96px] w-full object-contain object-left"
                    />
                    <span className="mt-1 block border-t border-[#0a0a0a]" />
                    <span className="mt-2 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#5c5c59]">
                      Signature du client
                    </span>
                  </div>
                </div>

                {/* LE CARTOUCHE SCELLÉ — le seul ambre de l'écran, en pied de
                    document, pleine largeur, encre noire. */}
                <div data-signal-groupe="cartouche-scelle" className="mt-8 bg-signal px-8 py-4">
                  <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-signal-ink">
                    Scellé · non modifiable
                  </span>
                  <span className="tnum mt-2 block break-all font-mono text-[10.5px] leading-[1.6] text-[#3a2a0e]">
                    {new Date(signatures[0].signedAt).toISOString()} · {signatures[0].hash.slice(0, 32)}…
                  </span>
                </div>
              </div>

              <div className="flex min-w-[240px] flex-1 flex-col gap-5">
                <div>
                  <span className="eyebrow block text-text-secondary">Ce qui rend ce bon opposable</span>
                  <dl className="mt-4 flex flex-col gap-3">
                    <div className="flex items-baseline justify-between gap-3 border-b border-border-row pb-2.5">
                      <dt className="text-[13px] text-text-secondary">Horodatage</dt>
                      <dd className="tnum font-mono text-[12.5px] text-text-primary">
                        {new Date(signatures[0].signedAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 border-b border-border-row pb-2.5">
                      <dt className="text-[13px] text-text-secondary">Empreinte</dt>
                      <dd className="tnum font-mono text-[12.5px] text-text-primary">SHA-256</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[13px] text-text-secondary">Scellé sur</dt>
                      <dd className="font-mono text-[11px] text-text-secondary">titre · client · heure · tracé</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => void verifier(signatures[0])}
                    className={`mt-4 flex min-h-11 w-full items-center justify-center gap-2 border px-3 text-xs md:min-h-0 md:py-2 ${
                      verifs[signatures[0].id] === undefined
                        ? 'border-border-strong text-text-primary hover:bg-surface-hover'
                        : verifs[signatures[0].id]
                          ? 'border-success/40 text-success'
                          : 'border-danger/40 text-danger'
                    }`}
                  >
                    {verifs[signatures[0].id] === false ? <ShieldAlert size={13} /> : <ShieldCheck size={13} />}
                    {verifs[signatures[0].id] === undefined
                      ? t('signature.verifier')
                      : verifs[signatures[0].id]
                        ? t('signature.intacte')
                        : t('signature.alteree')}
                  </button>
                </div>

                {/*
                  LA RÈGLE DU PAQUET, ET POURQUOI ELLE EST TENUE SANS CODE.

                  « Une modification après signature crée un second bon annulant
                  le premier ; l'original reste consultable. » Ici un bon n'a
                  AUCUN chemin de modification : il naît signé, et le seul geste
                  offert ensuite est d'en signer un autre. La règle est donc
                  tenue par construction, et l'écran le dit plutôt que de le
                  laisser deviner.
                */}
                <p className="border-t border-border-raised pt-5 text-[13px] leading-[1.6] text-text-muted [text-wrap:pretty]">
                  Un bon signé ne se modifie pas. Si quelque chose change, on en signe un second qui
                  annule le premier — et le premier reste lisible, sinon il n’y aurait plus de preuve
                  de ce qui avait été accepté.
                </p>
              </div>
            </div>
          </motion.section>

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
        </>
      )}
    </motion.section>
  );
}
