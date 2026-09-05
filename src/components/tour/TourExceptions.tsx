import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { garde } from '../../lib/garde';
import { useLangue } from '../../i18n';
import { relativeTime } from '../../lib/time';
import type { GardeExceptions } from '../../shared/garde';

/**
 * LES EXCEPTIONS D'ABORD (Bloc 7) — ce qui attend une décision, avant tout.
 *
 * La Tour, c'est décider. On l'ouvre pour savoir si quelque chose réclame un
 * humain : des dossiers critiques, des demandes sans réponse, des règlements
 * en retard, un garde dont les rondes échouent. Chaque ligne tient en un
 * geste — un seul clic vers l'endroit où l'on décide. Quand rien n'attend,
 * une phrase le dit, et le reste de l'écran (le parc) suit.
 */
const LIEN = 'inline-flex min-h-11 items-center border border-border-strong bg-surface px-3 text-sm font-medium text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1';

export function TourExceptions() {
  const { t } = useLangue();
  const [x, setX] = useState<GardeExceptions | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(async () => {
    try { setX(await garde.exceptions()); setErreur(null); } catch (err) { setErreur(err instanceof Error ? err.message : String(err)); }
  }, []);
  useEffect(() => { void charger(); }, [charger]);
  useEffect(() => garde.onGarde((trame) => { if (trame.type.startsWith('garde:remontee') || trame.type === 'garde:ronde') void charger(); }), [charger]);

  if (erreur) return <p className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-text-primary" role="alert">{t('garde.erreur', { message: erreur })}</p>;
  if (!x) return <p className="font-mono text-xs text-text-muted">{t('tour.exceptions.chargement')}</p>;

  const lignes: { cle: string; texte: string; vers: string; geste: string; grave: boolean }[] = [];
  if (x.critiques.n > 0) lignes.push({ cle: 'critiques', texte: t('tour.exceptions.critiques', { n: x.critiques.n, quoi: x.critiques.dossiers.map((d) => d.titre.replace(/\.$/, '')).join(' ; ') }), vers: '/garde/pile', geste: t('tour.exceptions.ouvrirPile'), grave: true });
  if (x.demandes.support + x.demandes.modules > 0) lignes.push({ cle: 'demandes', texte: t('tour.exceptions.demandes', { n: x.demandes.support + x.demandes.modules, depuis: x.demandes.depuis ? relativeTime(x.demandes.depuis) : '' }), vers: '/tour/organisations', geste: t('tour.exceptions.repondre'), grave: false });
  if (x.comptes.impayes + x.comptes.grace + x.comptes.suspendus > 0) lignes.push({ cle: 'comptes', texte: t('tour.exceptions.comptes', { impayes: x.comptes.impayes, grace: x.comptes.grace, suspendus: x.comptes.suspendus }), vers: '/garde/bureaux/comptes', geste: t('tour.exceptions.reglements'), grave: x.comptes.suspendus > 0 });
  if (x.enEchec.length > 0) lignes.push({ cle: 'echec', texte: t('tour.exceptions.enEchec', { n: x.enEchec.length, quoi: x.enEchec.map((a) => a.nom).join(', ') }), vers: '/garde', geste: t('tour.exceptions.voirSalle'), grave: false });

  return (
    <section className={`rounded-xl border p-4 ${lignes.some((l) => l.grave) ? 'border-danger/50' : 'border-border-strong'} bg-surface`} aria-label={t('tour.exceptions.titre')} data-exceptions={lignes.length}>
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('tour.exceptions.titre')}</h2>
        <span className="font-mono text-[10px] text-text-muted">{t('tour.exceptions.pile', { dossiers: x.pile.dossiers, remontees: x.pile.remontees })}</span>
      </div>
      {lignes.length === 0 ? (
        <p className="flex flex-wrap items-center gap-3 text-[14px] text-text-primary">
          {t('tour.exceptions.calme')}
          <Link to="/garde" className={LIEN}>{t('tour.exceptions.voirGarde')}</Link>
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-border">
          {lignes.map((l) => (
            <li key={l.cle} className="flex flex-wrap items-center gap-3 py-2" data-exception={l.cle}>
              <span className={`h-2 w-2 flex-shrink-0 rounded-full ${l.grave ? 'bg-danger' : 'bg-warning'}`} aria-hidden />
              <span className="min-w-0 flex-1 text-[14px] leading-snug text-text-primary">{l.texte}</span>
              <Link to={l.vers} className={LIEN}>{l.geste}</Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
