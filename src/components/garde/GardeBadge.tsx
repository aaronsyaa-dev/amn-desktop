import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { garde } from '../../lib/garde';
import { useLangue } from '../../i18n';
import type { GardePouls } from '../../shared/garde';

/**
 * L'INSIGNE DE LA GARDE, EN HAUT À DROITE.
 *
 * Un point et un mot : le pouls (calme, attention, critique). Un clic mène à
 * la Salle ; le titre dit qui est en ronde, chez qui. Sur téléphone, seul le
 * point reste.
 *
 * UN INDICATEUR D'ÉTAT NE BOUGE QUE QUAND L'ÉTAT CHANGE (Bloc 0 de
 * l'Automatique). La première version réécrivait son texte à chaque trame de
 * présence (« Disponibilité · en ronde », puis le nom du dernier passé, puis le
 * pouls), relisait le pouls à chaque ronde, faisait battre le point à chaque
 * passage, et DISPARAISSAIT à la première lecture en échec — d'où, chez
 * Aaron, une pastille qui se réaffichait et clignotait toutes les trente
 * secondes à côté du badge « Synchronisé ». Désormais :
 *
 *   · le texte visible est le niveau du pouls, rien d'autre ; la ronde en
 *     cours et le dernier passage ne vivent que dans le titre (survol) ;
 *   · le pouls est relu au plus une fois par minute, et seulement quand une
 *     trame peut l'avoir changé (remontée, décision, absence) — jamais sur une
 *     simple présence ;
 *   · une lecture en échec garde le dernier état connu ; l'insigne ne
 *     s'efface qu'après trois échecs de suite, et ne revient qu'après une
 *     lecture réussie — pas de va-et-vient ;
 *   · le point ne bat pas : sa couleur change quand le niveau change.
 */
interface Presence { agent: string; nom: string; phrase: string; actif: boolean; at: string }
const RELECTURE_MIN_MS = 60_000;
const ECHECS_AVANT_EFFACEMENT = 3;

export function GardeBadge() {
  const { t } = useLangue();
  const [pouls, setPouls] = useState<GardePouls | null>(null);
  const [efface, setEfface] = useState(false);
  const echecs = useRef(0);
  const derniereLecture = useRef(0);
  const attente = useRef<number | null>(null);
  const enRonde = useRef<Map<string, Presence>>(new Map());
  const [titre, setTitre] = useState<string | null>(null);

  const lire = () => {
    derniereLecture.current = Date.now();
    garde.pouls().then((p) => {
      echecs.current = 0;
      setEfface(false);
      // Ne pas réécrire un état identique : pas de re-rendu pour rien.
      setPouls((prev) => (prev && prev.niveau === p.niveau && prev.compte.ouvertes === p.compte.ouvertes && prev.compte.critiques === p.compte.critiques ? prev : p));
    }).catch(() => {
      echecs.current += 1;
      if (echecs.current >= ECHECS_AVANT_EFFACEMENT) setEfface(true);
    });
  };
  // Une relecture au plus par minute, groupée : la trame qui arrive pendant l'attente n'en déclenche pas une deuxième.
  const relire = () => {
    if (attente.current) return;
    const delai = Math.max(1500, RELECTURE_MIN_MS - (Date.now() - derniereLecture.current));
    attente.current = window.setTimeout(() => { attente.current = null; lire(); }, delai);
  };

  useEffect(() => {
    lire();
    return () => { if (attente.current) window.clearTimeout(attente.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => garde.onGarde((trame) => {
    if (trame.type === 'garde:presence') {
      const p: Presence = { agent: String(trame.agent), nom: String(trame.nom ?? trame.agent), phrase: String(trame.phrase ?? ''), actif: Boolean(trame.actif), at: String(trame.at ?? '') };
      if (p.actif) enRonde.current.set(p.agent, p); else enRonde.current.delete(p.agent);
      // Le titre seulement : ce que l'œil voit ne bouge pas.
      const actifs = [...enRonde.current.values()];
      setTitre(actifs.length ? t('garde.insigne.enRonde', { agent: actifs[0].nom, n: actifs.length }) : null);
    } else if (['garde:remontee', 'garde:remontee-decidee', 'garde:remontee-resolue', 'garde:absence', 'garde:releve'].includes(trame.type)) {
      relire();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  if (efface || !pouls) return null;
  const couleur = pouls.niveau === 'critique' ? 'bg-danger' : pouls.niveau === 'attention' ? 'bg-warning' : 'bg-success';
  const mot = t(`garde.insigne.${pouls.niveau}`);
  return (
    <Link
      to="/garde"
      aria-label={`${t('garde.insigne.titre')} : ${mot}`}
      title={titre ?? pouls.phrase}
      data-garde-insigne={pouls.niveau}
      className="flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-[12px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
    >
      <span className={`inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full transition-colors duration-700 ${couleur}`} aria-hidden />
      <Shield size={14} strokeWidth={1.9} className="flex-shrink-0 sm:hidden" aria-hidden />
      <span className="hidden sm:inline">{mot}</span>
    </Link>
  );
}
