import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Link2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useAuth } from '../auth/AuthContext';
import { publicOrigin } from '../lib/publicUrl';
import { downloadBlob, downloadText } from '../lib/download';
import { encoderQr, svgQr, type NiveauQr } from '../lib/qr';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

/**
 * LES QR CODES — une adresse, un code à imprimer.
 *
 * Pour qui : une boutique qui veut mettre sa page de rendez-vous, sa
 * mini-page ou son formulaire sur un flyer, une vitrine, une carte. Ce que
 * ça règle : le code est calculé sur le poste (voir `lib/qr.ts`), sans
 * service en ligne, et s'enregistre en SVG net ou en PNG. Les adresses de
 * l'organisation sont proposées d'un clic : aucune à recopier.
 */
export function QrScreen() {
  const { t } = useLangue();
  const { org } = useAuth();
  const [texte, setTexte] = useState('');
  const [niveau, setNiveau] = useState<NiveauQr>('M');
  const origine = publicOrigin();
  const raccourcis = useMemo(() => {
    if (!origine || !org) return [];
    const id = encodeURIComponent(org.id);
    return [
      { label: t('qr.raccourci.rdv'), valeur: `${origine}/#/rdv?org=${id}` },
      { label: t('qr.raccourci.page'), valeur: `${origine}/#/p?org=${id}` },
    ];
  }, [origine, org, t]);
  const code = useMemo(() => (texte.trim() ? encoderQr(texte.trim(), { niveau }) : null), [texte, niveau]);
  const svg = useMemo(() => (code ? svgQr(code, { taillePx: 320 }) : ''), [code]);
  const octets = new TextEncoder().encode(texte.trim()).length;

  const enregistrerSvg = () => {
    if (!code) return;
    downloadText(svgQr(code, { taillePx: 1024 }), 'qr-code.svg', 'image/svg+xml');
  };
  const enregistrerPng = async () => {
    if (!code) return;
    const taille = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = taille;
    canvas.height = taille;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const marge = 4;
    const total = code.taille + marge * 2;
    const pas = taille / total;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, taille, taille);
    ctx.fillStyle = '#000000';
    for (let y = 0; y < code.taille; y += 1) for (let x = 0; x < code.taille; x += 1) if (code.modules[y][x]) ctx.fillRect(Math.round((x + marge) * pas), Math.round((y + marge) * pas), Math.ceil(pas), Math.ceil(pas));
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) downloadBlob(blob, 'qr-code.png');
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('outils.surtitre', { module: t('qr.titre') })}
          title={t('qr.titre')}
          description={t('qr.description')}
          stats={[
            { label: t('qr.stat.octets'), value: octets },
            { label: t('qr.stat.version'), value: code ? code.version : '—' },
            { label: t('qr.stat.modules'), value: code ? `${code.taille} × ${code.taille}` : '—' },
          ]}
        />
      </motion.div>

      <motion.div variants={staggerItem} className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={4} placeholder={t('qr.champ')} aria-label={t('qr.champ')} className="input-focus border border-border bg-bg px-3 py-2 font-mono text-sm text-text-primary outline-none" />
          {raccourcis.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {raccourcis.map((r) => (
                <button key={r.valeur} type="button" onClick={() => setTexte(r.valeur)} className="flex min-h-11 items-center gap-1 border border-border px-3 text-xs text-text-secondary hover:text-text-primary md:min-h-0 md:py-1.5"><Link2 size={11} /> {r.label}</button>
              ))}
            </div>
          )}
          <div role="radiogroup" aria-label={t('qr.niveau')} className="flex flex-wrap items-center gap-1">
            <span className="mr-2 text-xs text-text-muted">{t('qr.niveau')}</span>
            {(['L', 'M'] as NiveauQr[]).map((n) => (
              <button key={n} type="button" role="radio" aria-checked={niveau === n} onClick={() => setNiveau(n)} className={`min-h-11 border px-3 text-xs md:min-h-0 md:py-1 ${niveau === n ? 'border-border-strong bg-surface-hover text-text-primary' : 'border-border text-text-muted hover:text-text-primary'}`}>{t(`qr.niveau${n}` as Parameters<typeof t>[0])}</button>
            ))}
          </div>
          {texte.trim() && !code && <p role="alert" className="text-sm text-danger">{t('qr.tropLong')}</p>}
        </section>
        <section className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface p-4">
          {code ? (
            <>
              <div role="img" aria-label={t('qr.image', { texte: texte.trim().slice(0, 60) })} className="rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: svg }} />
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => void enregistrerPng()} className="flex min-h-11 items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg md:min-h-0 md:py-2"><Download size={14} /> {t('qr.png')}</button>
                <button type="button" onClick={enregistrerSvg} className="flex min-h-11 items-center gap-2 border border-border-strong px-4 text-sm text-text-primary hover:bg-surface-hover md:min-h-0 md:py-2"><Download size={14} /> {t('qr.svg')}</button>
              </div>
            </>
          ) : (
            <FirstRun title={t('qr.vide.titre')} action={raccourcis[0] ? { label: t('qr.vide.action'), onClick: () => setTexte(raccourcis[0].valeur) } : undefined}>{t('qr.vide.texte')}</FirstRun>
          )}
        </section>
      </motion.div>
    </motion.section>
  );
}
