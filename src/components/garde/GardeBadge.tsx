import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { garde } from '../../lib/garde';
import { useLangue } from '../../i18n';
import type { GardePouls } from '../../shared/garde';

/**
 * L'INSIGNE DE LA GARDE, EN HAUT À DROITE (Bloc 9).
 *
 * Sur n'importe quel écran, un point dit le pouls (calme, attention, critique)
 * et bat quand un garde est en ronde ; le mot à côté dit qui fait quoi, à
 * l'instant, chez qui — « Disponibilité · chez Fleuriste d'Essai ». Un clic
 * mène à la Salle. Sur téléphone, seul le point reste : une pastille.
 *
 * Tout vient des trames poussées par le Capitaine (`garde:presence`,
 * `garde:ronde`, `garde:remontee…`) ; la première lecture vient du pouls.
 * Sans Garde sur le serveur, l'insigne s'efface : rien de faux à l'écran.
 */
interface Presence { agent: string; nom: string; phrase: string; orgId: string | null; actif: boolean; at: string }

export function GardeBadge() {
  const { t } = useLangue();
  const [pouls, setPouls] = useState<GardePouls | null>(null);
  const [absent, setAbsent] = useState(false);
  const [enRonde, setEnRonde] = useState<Map<string, Presence>>(new Map());
  const [dernier, setDernier] = useState<Presence | null>(null);
  const attente = useRef<number | null>(null);

  const relire = useCallback(() => {
    if (attente.current) window.clearTimeout(attente.current);
    attente.current = window.setTimeout(() => {
      attente.current = null;
      garde.pouls().then((p) => { setPouls(p); setAbsent(false); }).catch(() => setAbsent(true));
    }, 400);
  }, []);
  useEffect(() => {
    garde.pouls().then((p) => { setPouls(p); setAbsent(false); }).catch(() => setAbsent(true));
    garde.salle().then((s) => {
      const m = new Map<string, Presence>();
      for (const a of s.agents) if (a.etat === 'ronde') m.set(a.key, { agent: a.key, nom: a.nom, phrase: a.phrase, orgId: null, actif: true, at: a.derniereRondeAt ?? '' });
      setEnRonde(m);
    }).catch(() => undefined);
    return () => { if (attente.current) window.clearTimeout(attente.current); };
  }, []);
  useEffect(() => garde.onGarde((trame) => {
    if (trame.type === 'garde:presence') {
      const p: Presence = { agent: String(trame.agent), nom: String(trame.nom ?? trame.agent), phrase: String(trame.phrase ?? ''), orgId: (trame.orgId as string | null) ?? null, actif: Boolean(trame.actif), at: String(trame.at ?? '') };
      setEnRonde((m) => { const n = new Map(m); if (p.actif) n.set(p.agent, p); else n.delete(p.agent); return n; });
      setDernier(p);
    } else if (['garde:ronde', 'garde:remontee', 'garde:remontee-decidee', 'garde:remontee-resolue', 'garde:absence'].includes(trame.type)) {
      relire();
    }
  }), [relire]);

  if (absent || !pouls) return null;
  const actifs = [...enRonde.values()];
  const couleur = pouls.niveau === 'critique' ? 'bg-danger' : pouls.niveau === 'attention' ? 'bg-warning' : 'bg-success';
  const enCours = actifs.length > 0;
  const mot = enCours
    ? t('garde.insigne.enRonde', { agent: actifs[0].nom, n: actifs.length })
    : dernier && Date.now() - Date.parse(dernier.at || '') < 120_000
      ? `${dernier.nom} · ${dernier.phrase.replace(/\.$/, '')}`.slice(0, 64)
      : t(`garde.insigne.${pouls.niveau}`);
  return (
    <Link
      to="/garde"
      aria-label={`${t('garde.insigne.titre')} : ${mot}`}
      title={dernier?.phrase || pouls.phrase}
      data-garde-insigne={pouls.niveau}
      data-garde-en-ronde={actifs.length}
      className="flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-[12px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
    >
      <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
        {enCours && <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping ${couleur}`} aria-hidden />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${couleur}`} aria-hidden />
      </span>
      <Shield size={14} strokeWidth={1.75} className="flex-shrink-0 sm:hidden" aria-hidden />
      <span className="hidden max-w-[220px] truncate sm:inline">{mot}</span>
    </Link>
  );
}
