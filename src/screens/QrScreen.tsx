import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Link2, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { EcranVide, useHaloSignal } from '../components/EtatEcran';
import { useAuth } from '../auth/AuthContext';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { publicOrigin } from '../lib/publicUrl';
import { downloadBlob, downloadText } from '../lib/download';
import { encoderQr, svgQr, type NiveauQr } from '../lib/qr';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

/** Un code enregistré. Voir `qrCodes` dans src/shared/api.ts. */
interface QrCodeData {
  label: string;
  target: string;
  /** Où il est collé, en clair — « vitrine, en bas à droite ». */
  placement: string;
  scans: number;
  lastScanAt: string | null;
  createdAt: string;
}
interface ProspectData {
  name: string;
  source: string;
}

/*
  ═══════════════════════════════════════════════════════════════════
  LE CODE, À LA TAILLE OÙ ON LE SCANNE
  ═══════════════════════════════════════════════════════════════════

  264 px de matrice et 18 px de papier blanc autour. Les deux nombres comptent
  et pour des raisons différentes :

  · 264 px est la taille à laquelle un téléphone accroche le code DEPUIS
    L'ÉCRAN, sans impression. C'est le geste réel de qui vérifie son code
    avant de l'envoyer à l'imprimeur, et un code de 120 px ne le permet pas.
  · 18 px de blanc autour ne sont pas une marge de mise en page : un QR a
    besoin d'une zone de silence pour être décodé. L'encodeur en pose déjà
    quatre modules ; ce cadre-ci la prolonge et garantit qu'elle survit même
    quand le code est posé sur un fond sombre — c'est-à-dire ici, toujours.
*/
const CODE_PX = 264;
const PAPIER_MARGE = 18;
/** Les barres de scans du pied de page. */
const BARRE_H = 10;

/**
 * LES QR CODES — une adresse, un code à imprimer, et ce qu'il rapporte.
 *
 * Pour qui : une boutique qui met sa page de rendez-vous sur un flyer, une
 * vitrine, une carte. Le code est calculé sur le poste (`lib/qr.ts`), sans
 * service en ligne, et s'enregistre en SVG net ou en PNG.
 *
 * ## Ce qui domine : le code
 *
 * C'est le cas le plus littéral du principe de cette famille — l'objet
 * dominant d'un utilitaire est CE QU'IL PRODUIT, jamais son formulaire de
 * réglages. L'écran ouvrait sur un champ de texte et une case vide à côté ;
 * il ouvre maintenant sur le code lui-même, à la taille où on le scanne, et
 * le champ de fabrication descend sous lui.
 *
 * ## Le compteur de scans, et pourquoi il a demandé une route de serveur
 *
 * Un module de QR codes qui ne compte pas les scans ne peut rien dire de ce
 * qu'il fabrique : un code collé trop bas et un code qui marche ont
 * exactement la même allure. Or le poste ne PEUT PAS le savoir — c'est le
 * téléphone d'un passant qui ouvre l'adresse, et il n'a pas de session.
 *
 * Le code enregistré porte donc son identifiant dans l'adresse (`?qr=<id>`),
 * la page publique appelle `POST /v1/qr/:orgId/:id/scan` en s'ouvrant, et le
 * compteur remonte par la synchronisation ordinaire. Le poste ne l'écrit
 * jamais lui-même : un compteur qu'on peut incrémenter depuis l'écran qui
 * l'affiche ne mesure plus rien. Voir `docs/patchs/README.md`.
 *
 * ## L'ambre : le compteur du code affiché
 *
 * Son surtitre et sa valeur, deux nœuds, une région. Y compris à zéro — et
 * SURTOUT à zéro : un code qui n'a jamais été scanné est exactement la chose
 * de cet écran qui demande une décision.
 *
 * ## L'écart avec la maquette
 *
 * La table du système de design décrit « une grille de 25 × 25 modules » et
 * précise qu'en production c'est un vrai QR. C'en est un : la taille de la
 * matrice suit donc le CONTENU (21 × 21 en version 1, 25 × 25 en version 2,
 * etc.), et l'en-tête l'affiche. Figer 25 × 25 aurait cassé les codes longs.
 */
export function QrScreen() {
  const { t } = useLangue();
  const { org } = useAuth();
  const { upsert, remove } = useSync();
  const codes = useCollection<QrCodeData>('qrCodes');
  const prospects = useCollection<ProspectData>('prospects');
  const [texte, setTexte] = useState('');
  const [intitule, setIntitule] = useState('');
  const [ou, setOu] = useState('');
  const [niveau, setNiveau] = useState<NiveauQr>('M');
  const [choisi, setChoisi] = useState<string | null>(null);
  const [fabrique, setFabrique] = useState(false);
  const origine = publicOrigin();

  const raccourcis = useMemo(() => {
    if (!origine || !org) return [];
    const id = encodeURIComponent(org.id);
    return [
      { label: t('qr.raccourci.rdv'), valeur: `${origine}/#/rdv?org=${id}` },
      { label: t('qr.raccourci.page'), valeur: `${origine}/#/p?org=${id}` },
    ];
  }, [origine, org, t]);

  /* Les codes enregistrés, du plus scanné au moins scanné : c'est l'ordre qui
     répond à la seule question qu'on pose à cet écran. */
  const enregistres = useMemo(
    () => [...codes].sort((a, b) => (b.scans ?? 0) - (a.scans ?? 0) || a.label.localeCompare(b.label, 'fr')),
    [codes],
  );
  const affiche = enregistres.find((c) => c.id === choisi) ?? enregistres[0] ?? null;

  /* Le code DESSINÉ : celui qu'on est en train de fabriquer s'il y a du texte,
     sinon le code enregistré qu'on regarde. L'un ou l'autre, jamais les deux —
     l'écran ne montre qu'un code à la fois, c'est tout son propos. */
  const contenu = fabrique ? texte.trim() : affiche?.target ?? '';
  const code = useMemo(() => (contenu ? encoderQr(contenu, { niveau }) : null), [contenu, niveau]);
  const svg = useMemo(() => (code ? svgQr(code, { taillePx: CODE_PX }) : ''), [code]);
  const octets = new TextEncoder().encode(contenu).length;

  const halo = useHaloSignal(!fabrique && affiche !== null);

  /* DEVENUS PROSPECTS — les fiches dont la source nomme ce code. Le lien n'est
     pas inventé : c'est le champ `source` du module Prospects, celui-là même
     qu'on renseigne en saisissant une fiche venue d'un flyer. */
  const prospectsDuCode = useMemo(
    () =>
      affiche
        ? prospects.filter((p) => (p.source ?? '').toLowerCase().includes(affiche.label.toLowerCase())).length
        : 0,
    [prospects, affiche],
  );

  const scansMax = Math.max(1, ...enregistres.map((c) => c.scans ?? 0));
  /* LE CODE QUI NE SERT PAS : le moins scanné, quand l'écart avec le meilleur
     est franc. Sous un rapport de trois, ce n'est pas un diagnostic, c'est du
     bruit — deux codes peuvent servir inégalement sans que l'un soit raté. */
  const inutile = useMemo(() => {
    if (enregistres.length < 2) return null;
    const dernier = enregistres[enregistres.length - 1];
    const premier = enregistres[0];
    return (premier.scans ?? 0) >= 3 * Math.max(1, dernier.scans ?? 0) ? { dernier, premier } : null;
  }, [enregistres]);

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

  /*
    GARDER LE CODE. L'identifiant est tiré AVANT l'adresse, parce que l'adresse
    doit le porter : sans `?qr=<id>`, la page publique ne saurait pas quel
    compteur incrémenter, et le code serait muet pour toujours.
  */
  const garder = async () => {
    const cible = texte.trim();
    if (!cible || !intitule.trim()) return;
    const id = uid('qr');
    const avecMarque = cible.includes('?') ? `${cible}&qr=${id}` : `${cible}?qr=${id}`;
    await upsert('qrCodes', id, {
      label: intitule.trim(),
      target: avecMarque,
      placement: ou.trim(),
      scans: 0,
      lastScanAt: null,
      createdAt: new Date().toISOString(),
    } satisfies QrCodeData);
    setTexte('');
    setIntitule('');
    setOu('');
    setFabrique(false);
    setChoisi(id);
  };

  const vide = enregistres.length === 0 && !fabrique;

  return (
    <EcranVide quand={vide} premierJour={vide}>
      <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={staggerItem}>
          <ScreenHeader
            eyebrow={t('outils.surtitre', { module: t('qr.titre') })}
            title={t('qr.titre')}
            description={t('qr.description')}
            phraseVide={t('qr.vide.phrase')}
            stats={[
              { label: t('qr.stat.codes'), value: enregistres.length },
              { label: t('qr.stat.octets'), value: octets },
              { label: t('qr.stat.modules'), value: code ? `${code.taille} × ${code.taille}` : '—' },
            ]}
            actions={
              <button
                type="button"
                onClick={() => setFabrique((v) => !v)}
                className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
              >
                <Plus size={16} strokeWidth={2} /> {t('qr.fabriquer')}
              </button>
            }
          />
        </motion.div>

        {vide ? (
          <motion.div variants={staggerItem}>
            <FirstRun title={t('qr.vide.titre')} action={{ label: t('qr.vide.action'), onClick: () => setFabrique(true) }}>
              {t('qr.vide.texte')}
            </FirstRun>
          </motion.div>
        ) : (
          <>
            {/* ═══ L'OBJET DOMINANT : le code ═══ */}
            <motion.section variants={staggerItem} className={`panel-raised p-5 sm:p-6 ${halo}`}>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                <div className="flex-shrink-0">
                  {code ? (
                    <div
                      role="img"
                      aria-label={t('qr.image', { texte: contenu.slice(0, 60) })}
                      className="bg-white"
                      style={{ padding: PAPIER_MARGE, width: CODE_PX + PAPIER_MARGE * 2 }}
                      dangerouslySetInnerHTML={{ __html: svg }}
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center border border-dashed border-border-strong text-center text-sm text-text-muted"
                      style={{ width: CODE_PX + PAPIER_MARGE * 2, height: CODE_PX + PAPIER_MARGE * 2 }}
                    >
                      {t('qr.tapezUneAdresse')}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void enregistrerPng()} disabled={!code} className="flex min-h-10 items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-40"><Download size={14} /> {t('qr.png')}</button>
                    <button type="button" onClick={enregistrerSvg} disabled={!code} className="flex min-h-10 items-center gap-2 border border-border-strong px-4 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-40"><Download size={14} /> {t('qr.svg')}</button>
                  </div>
                </div>

                {/* À DROITE DU CODE — destination, où il est collé, deux relevés. */}
                <div className="min-w-0 flex-1">
                  {!fabrique && affiche ? (
                    <>
                      <p className="eyebrow eyebrow-signal mb-1" data-signal-groupe="scans">{t('qr.scans')}</p>
                      <p className="text-[44px] font-semibold leading-none tabular-nums text-signal" data-signal-groupe="scans">
                        {affiche.scans ?? 0}
                      </p>
                      <p className="mt-4 text-[17px] font-semibold leading-tight text-text-primary">{affiche.label}</p>
                      <p className="mt-1 break-all font-mono text-[11px] text-text-secondary">{affiche.target}</p>
                      <p className="mt-3 max-w-prose text-sm leading-relaxed text-text-body">
                        {affiche.placement ? t('qr.colleA', { ou: affiche.placement }) : t('qr.sansEmplacement')}
                      </p>
                      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-border-strong pt-4">
                        <div>
                          <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('qr.devenusProspects')}</dt>
                          <dd className="text-[19px] font-semibold tabular-nums leading-tight text-text-primary">{prospectsDuCode}</dd>
                        </div>
                        <div>
                          <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('qr.dernierScan')}</dt>
                          <dd className="text-[19px] font-semibold leading-tight text-text-primary">
                            {affiche.lastScanAt ? relativeTime(affiche.lastScanAt) : t('qr.jamais')}
                          </dd>
                        </div>
                      </dl>
                    </>
                  ) : (
                    /* LA FABRICATION — sous le code, et non à sa place. */
                    <div className="flex flex-col gap-3">
                      <p className="eyebrow">{t('qr.fabriquer')}</p>
                      <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={3} placeholder={t('qr.champ')} aria-label={t('qr.champ')} className="input-focus border border-border bg-bg px-3 py-2 font-mono text-sm text-text-primary outline-none" />
                      {raccourcis.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {raccourcis.map((r) => (
                            <button key={r.valeur} type="button" onClick={() => setTexte(r.valeur)} className="flex min-h-11 items-center gap-1 border border-border px-3 text-xs text-text-secondary hover:text-text-primary md:min-h-0 md:py-1.5"><Link2 size={11} /> {r.label}</button>
                          ))}
                        </div>
                      )}
                      <input value={intitule} onChange={(e) => setIntitule(e.target.value)} placeholder={t('qr.champIntitule')} aria-label={t('qr.champIntitule')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
                      <input value={ou} onChange={(e) => setOu(e.target.value)} placeholder={t('qr.champOu')} aria-label={t('qr.champOu')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
                      <div role="radiogroup" aria-label={t('qr.niveau')} className="flex flex-wrap items-center gap-1">
                        <span className="mr-2 text-xs text-text-muted">{t('qr.niveau')}</span>
                        {(['L', 'M'] as NiveauQr[]).map((n) => (
                          <button key={n} type="button" role="radio" aria-checked={niveau === n} onClick={() => setNiveau(n)} className={`min-h-11 border px-3 text-xs md:min-h-0 md:py-1 ${niveau === n ? 'border-border-strong bg-surface-hover text-text-primary' : 'border-border text-text-muted hover:text-text-primary'}`}>{t(`qr.niveau${n}` as Parameters<typeof t>[0])}</button>
                        ))}
                      </div>
                      {texte.trim() && !code && <p role="alert" className="text-sm text-danger">{t('qr.tropLong')}</p>}
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => void garder()} disabled={!code || !intitule.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('qr.garder')}</button>
                        {enregistres.length > 0 && (
                          <button type="button" onClick={() => setFabrique(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed text-text-muted">{t('qr.pourquoiGarder')}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.section>

            {/* EN PIED — les codes en barres de scans, et le diagnostic. */}
            {enregistres.length > 0 && (
              <motion.section variants={staggerItem} className="panel">
                <p className="eyebrow border-b border-border px-4 py-2.5">{t('qr.lesCodes')}</p>
                <ul className="flex flex-col">
                  {enregistres.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => {
                          setChoisi(c.id);
                          setFabrique(false);
                        }}
                        aria-current={affiche?.id === c.id && !fabrique ? 'true' : undefined}
                        className="input-focus min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate text-sm text-text-primary">{c.label}</span>
                        <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-text-muted">
                          {c.placement || t('qr.sansEmplacementCourt')}
                        </span>
                      </button>
                      <span className="flex min-w-[10rem] flex-1 items-center gap-3">
                        <span className="flex h-3 min-w-0 flex-1 items-center">
                          <span
                            className="bg-border-strong"
                            style={{ height: BARRE_H, width: `${((c.scans ?? 0) / scansMax) * 100}%` }}
                            aria-hidden
                          />
                        </span>
                        <span className="w-10 flex-shrink-0 text-right font-mono text-[12px] tabular-nums text-text-secondary">{c.scans ?? 0}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => void remove('qrCodes', c.id)}
                        aria-label={t('qr.oublier')}
                        title={t('qr.oublier')}
                        className="flex-shrink-0 border border-border px-2 py-1 text-text-muted hover:border-danger/60 hover:text-danger"
                      >
                        <Trash2 size={11} />
                      </button>
                    </li>
                  ))}
                </ul>
                {inutile && (
                  <p className="border-t border-border px-4 py-3 text-sm leading-relaxed text-text-body">
                    {t('qr.neSertPas', {
                      faible: inutile.dernier.label,
                      n: inutile.dernier.scans ?? 0,
                      fort: inutile.premier.label,
                      m: inutile.premier.scans ?? 0,
                      ou: inutile.dernier.placement || t('qr.sansEmplacementCourt'),
                    })}
                  </p>
                )}
              </motion.section>
            )}
          </>
        )}
      </motion.section>
    </EcranVide>
  );
}
