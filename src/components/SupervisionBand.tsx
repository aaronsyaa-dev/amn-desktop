import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, CloudOff, PenLine, Radar, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { useParcInsights } from '../state/parcInsights';
import { useRemoteSites } from '../state/RemoteSitesContext';
import { computeTrend } from '../lib/trend';
import { relativeTime } from '../lib/time';

/**
 * LA BANDE DE SUPERVISION, SOUS LA VEILLE (BLOC K)
 * ═══════════════════════════════════════════════
 *
 * La veille juste au-dessus dit ce qui se passe DEHORS — des actualités
 * techniques, écrites par d'autres. Celle-ci dit ce qui se passe CHEZ NOUS :
 * qui travaille dans son espace en ce moment, ce que le parc a produit cette
 * semaine, qui s'est tu, et quels sites ne répondent plus.
 *
 * ## Rien n'est simulé, et rien n'est arrondi
 *
 * Chaque phrase vient d'une mesure : `/v1/admin/insights` pour les
 * organisations (connexions ouvertes comptées par le serveur, écritures
 * réelles sur deux fenêtres de sept jours) et le parc de sites déjà chargé
 * pour les incidents. Aucune source nouvelle n'est inventée — Aaron a demandé
 * de réutiliser le relevé existant plutôt que d'en dupliquer un, et c'est
 * aussi ce qui garantit que cette bande et la Tour de contrôle ne pourront
 * jamais annoncer deux chiffres différents.
 *
 * Quand il n'y a rien de vrai à dire, la bande ne s'affiche pas. Elle ne
 * remplit jamais le silence : une bande qui annonce « 0 » toute la journée
 * apprend à ne plus être lue, et le jour où le zéro veut dire quelque chose,
 * personne ne le voit.
 *
 * ## Pourquoi elle tourne au lieu de défiler
 *
 * La veille défile parce que ses titres sont nombreux et de même poids. Ici
 * les faits sont peu nombreux et inégaux : « deux sites hors ligne » ne se lit
 * pas comme « trois écritures cette semaine ». Un défilement les mettrait au
 * même niveau et obligerait à attendre que le bon repasse. La rotation montre
 * une chose à la fois, se met en pause au survol, et affiche combien d'autres
 * attendent — la même grammaire que la bande d'une cliente, ce qui n'est pas
 * un hasard : c'est la même promesse des deux côtés.
 */

const ROTATION_MS = 8000;
/** Au-delà, une organisation est « silencieuse » — deux semaines sans une ligne. */
const SILENCE_JOURS = 14;

interface Fait {
  cle: string;
  icone: typeof Activity;
  texte: string;
  to?: string;
  /** Vrai pour ce qui appelle un geste, et se lit donc autrement. */
  alerte?: boolean;
}

export function SupervisionBand() {
  const parc = useParcInsights();
  const { sites } = useRemoteSites();
  const [index, setIndex] = useState(0);
  const [enPause, setEnPause] = useState(false);

  const faits = useMemo<Fait[]>(() => {
    const out: Fait[] = [];
    const releve = parc.data;

    if (releve && !parc.stale) {
      const enLigne = releve.orgs.filter((o) => o.connections > 0);
      if (enLigne.length === 1) {
        out.push({
          cle: 'en-ligne',
          icone: Users,
          texte: `${enLigne[0].name} travaille dans son espace en ce moment.`,
          to: '/tour/organisations',
        });
      } else if (enLigne.length > 1) {
        out.push({
          cle: 'en-ligne',
          icone: Users,
          texte: `${enLigne.length} espaces clients sont ouverts en ce moment.`,
          to: '/tour/organisations',
        });
      }
    }

    if (releve && releve.totals.records7d > 0) {
      const tendance = computeTrend(releve.totals.records7d, releve.totals.previous7d);
      const suffixe =
        tendance.direction === 'up' || tendance.direction === 'down'
          ? ` — ${tendance.sentence}`
          : '';
      out.push({
        cle: 'volume',
        icone: tendance.direction === 'down' ? TrendingDown : TrendingUp,
        texte:
          `${releve.totals.records7d} écriture${releve.totals.records7d > 1 ? 's' : ''} ` +
          `chez vos clientes sur ${releve.windowDays} jours${suffixe}.`,
        to: '/tour/organisations',
      });
    }

    if (releve) {
      // La plus silencieuse, et elle seule : lister toutes les endormies
      // ferait de cette bande un rapport, alors qu'elle doit donner UNE chose
      // à savoir. Celle dont le silence dure le plus longtemps est la plus
      // utile à rappeler.
      const seuil = Date.now() - SILENCE_JOURS * 24 * 60 * 60 * 1000;
      const endormies = releve.orgs
        .filter((o) => o.lastActivityAt && new Date(o.lastActivityAt).getTime() < seuil)
        .sort(
          (a, b) =>
            new Date(a.lastActivityAt as string).getTime() -
            new Date(b.lastActivityAt as string).getTime(),
        );
      if (endormies.length > 0) {
        const muette = endormies[0];
        out.push({
          cle: 'silence',
          icone: PenLine,
          texte: `${muette.name} n’a rien écrit depuis ${relativeTime(muette.lastActivityAt as string)}.`,
          to: '/tour/organisations',
        });
      }

      const jamais = releve.orgs.filter((o) => o.lastActivityAt === null);
      if (jamais.length > 0) {
        out.push({
          cle: 'jamais',
          icone: Radar,
          texte:
            jamais.length === 1
              ? `${jamais[0].name} n’a encore rien produit dans son espace.`
              : `${jamais.length} espaces clients n’ont encore rien produit.`,
          to: '/tour/organisations',
        });
      }
    }

    const horsLigne = sites.filter((s) => s.status === 'offline');
    const degrades = sites.filter((s) => s.status === 'degraded');
    if (horsLigne.length > 0) {
      out.push({
        cle: 'hors-ligne',
        icone: CloudOff,
        texte:
          horsLigne.length === 1
            ? `${horsLigne[0].name} ne répond plus.`
            : `${horsLigne.length} sites supervisés ne répondent plus.`,
        to: '/sites',
        alerte: true,
      });
    } else if (degrades.length > 0) {
      out.push({
        cle: 'degrade',
        icone: Activity,
        texte:
          degrades.length === 1
            ? `${degrades[0].name} répond mal.`
            : `${degrades.length} sites supervisés répondent mal.`,
        to: '/sites',
        alerte: true,
      });
    }

    return out;
  }, [parc.data, parc.stale, sites]);

  useEffect(() => {
    if (index >= faits.length) setIndex(0);
  }, [faits.length, index]);

  useEffect(() => {
    if (faits.length < 2 || enPause) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % faits.length), ROTATION_MS);
    return () => clearInterval(t);
  }, [faits.length, enPause]);

  if (faits.length === 0) return null;

  const fait = faits[Math.min(index, faits.length - 1)];
  const Icone = fait.icone;

  const contenu = (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className={fait.alerte ? 'text-warning' : 'text-text-muted'}>
        <Icone size={14} strokeWidth={1.75} />
      </span>
      <span className="truncate text-xs text-text-secondary">{fait.texte}</span>
    </span>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      onMouseEnter={() => setEnPause(true)}
      onMouseLeave={() => setEnPause(false)}
      className={`mt-2 flex items-center gap-3 rounded-full border py-1.5 pl-3 pr-4 ${
        fait.alerte ? 'border-warning/40 bg-warning-muted' : 'border-border bg-surface/60'
      }`}
      role="status"
      aria-live="polite"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={fait.cle}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="min-w-0 flex-1"
        >
          {fait.to ? (
            <Link to={fait.to} className="-my-1 block min-w-0 py-1 hover:text-text-primary">
              {contenu}
            </Link>
          ) : (
            contenu
          )}
        </motion.div>
      </AnimatePresence>

      {faits.length > 1 && (
        <span className="flex flex-shrink-0 items-center gap-1" aria-hidden>
          {faits.map((f, i) => (
            <span
              key={f.cle}
              className={`h-1 w-1 rounded-full transition-colors duration-300 ${
                i === index ? 'bg-text-secondary' : 'bg-border-strong'
              }`}
            />
          ))}
        </span>
      )}
    </motion.div>
  );
}
