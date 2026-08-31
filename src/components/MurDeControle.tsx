import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Logo } from './Logo';
import { useRemoteSites } from '../state/RemoteSitesContext';
import { usePoulsDuParc } from '../state/poulsDuParc';

/**
 * LA SALLE DE CONTRÔLE — le mur de supervision (Signes Vitaux)
 * ════════════════════════════════════════════════════════════
 *
 * L'horloge de veille était une des premières fiertés du projet ; elle devient
 * un vrai mur : NOIR ABSOLU (le seul lieu de l'application qui y a droit —
 * le noir total est un événement, pas un fond de travail), chaque site est un
 * point de lumière qui respire, un incident l'embrase, l'horloge et le pouls
 * au centre.
 *
 * ## La constellation est DÉTERMINISTE
 *
 * Chaque site a sa place, la même à chaque ouverture : une spirale de
 * phyllotaxie (l'angle d'or), ordonnée par nom. Un mur qu'on regarde tous les
 * jours devient un lieu — on sait où est « son » site sans le chercher. Aucun
 * aléa à l'exécution : la phase de respiration de chaque point dérive de son
 * identifiant, pour que le mur scintille sans jamais clignoter d'un bloc.
 *
 * ## Ce que la lumière dit — et rien d'autre
 *
 *   point qui respire, blanc   le site est EN LIGNE, observé
 *   point terne, immobile      hors ligne — un pixel mort ne respire pas
 *   anneau creux               jamais vu : le traceur n'a encore rien envoyé
 *   point de BRAISE            un incident ouvert couve là (braise sombre
 *                              désaturée, docs/ROUGE.md — cent incidents ne
 *                              font pas cent points rouge vif ; le seul rouge
 *                              vif du mur est la ligne de synthèse)
 *
 * Les phrases décoratives de l'ancien écran de veille (« Rien d'urgent à
 * l'horizon ») pouvaient s'afficher au-dessus de douze sites hors ligne. Le
 * verdict est maintenant CALCULÉ, jamais tiré au sort : l'invitation à la
 * pause n'apparaît que quand le parc est réellement calme.
 *
 * Uniquement des animations d'opacité (couches pré-rendues), phases décalées ;
 * en mouvement réduit, le mur est une photographie — l'information reste.
 */

const NOMBRE_D_OR = 137.50776405003785;

/** Une phase stable par site : le mur scintille, il ne clignote jamais d'un bloc. */
function phaseDe(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 4000;
  return h;
}

export function MurDeControle({ enVeille = false }: { enVeille?: boolean }) {
  const { sites } = useRemoteSites();
  const pouls = usePoulsDuParc();

  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  /*
    La spirale : ordonnée par NOM (stable), rayon en racine carrée de l'indice
    (densité constante), démarrée au-delà du disque central pour ne jamais
    passer sous l'horloge. Les positions sont en pourcentage du demi-côté.
  */
  const points = useMemo(() => {
    const tries = [...sites].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
    return tries.slice(0, 144).map((site, i) => {
      const angle = (i * NOMBRE_D_OR * Math.PI) / 180;
      const rayon = 0.34 + 0.58 * Math.sqrt((i + 1) / Math.max(tries.length, 12));
      return {
        site,
        x: 50 + 46 * rayon * Math.cos(angle),
        y: 50 + 46 * rayon * Math.sin(angle),
        phase: phaseDe(site.id),
      };
    });
  }, [sites]);

  const horsLigne = sites.filter((s) => s.status === 'offline').length;
  const enLigne = sites.filter((s) => s.status === 'online').length;

  const verdict = useMemo(() => {
    if (!pouls.vivant && sites.length === 0) return 'La supervision se met en place.';
    if (pouls.critiques > 0) {
      return `${pouls.critiques} incident${pouls.critiques > 1 ? 's' : ''} critique${pouls.critiques > 1 ? 's' : ''} ouvert${pouls.critiques > 1 ? 's' : ''}.`;
    }
    if (horsLigne > 0) return `${horsLigne} site${horsLigne > 1 ? 's' : ''} hors ligne.`;
    if (sites.length === 0) return 'Aucun site supervisé pour l’instant.';
    return `Parc calme — ${enLigne} site${enLigne > 1 ? 's' : ''} sous veille.`;
  }, [pouls.vivant, pouls.critiques, horsLigne, enLigne, sites.length]);

  const calme = pouls.critiques === 0 && horsLigne === 0;

  const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* La constellation. Décorative à l'oreille : les comptes sont dans le
          verdict, lisible en texte. */}
      <div aria-hidden className="absolute inset-0">
        {points.map(({ site, x, y, phase }) => {
          const incident = pouls.enIncident.get(site.id);
          const embrase = incident === 'critical';
          const jamaisVu = site.status !== 'online' && site.status !== 'offline';
          const enligne = site.status === 'online';
          return (
            <span
              key={site.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {embrase ? (
                /*
                  LA BRAISE, PAS L'INCENDIE (docs/ROUGE.md, F1). Cent incidents
                  ne font pas cent points rouge vif : le point critique est une
                  braise sombre désaturée, sans lueur, au souffle court. Le
                  SEUL rouge vif du mur est la ligne de synthèse, plus bas.
                */
                <span
                  className="sv-souffle-tendu block h-2.5 w-2.5 rounded-full bg-braise"
                  style={{ animationDelay: `-${phase}ms` }}
                />
              ) : incident ? (
                <span
                  className="sv-souffle-calme block h-2 w-2 rounded-full bg-braise opacity-70"
                  style={{ animationDelay: `-${phase}ms` }}
                />
              ) : enligne ? (
                <span
                  className="sv-souffle-calme block h-1.5 w-1.5 rounded-full bg-white"
                  style={{ animationDelay: `-${phase}ms` }}
                />
              ) : jamaisVu ? (
                <span className="block h-1.5 w-1.5 rounded-full border border-border-strong" />
              ) : (
                /* hors ligne : un pixel mort ne respire pas. */
                <span className="block h-1.5 w-1.5 rounded-full bg-border-strong" />
              )}
            </span>
          );
        })}
      </div>

      {/* Le centre : l'horloge et le pouls. */}
      <div className="relative flex h-full flex-col items-center justify-center text-center">
        <div className="mb-10 opacity-40">
          <Logo height={30} />
        </div>

        <motion.p
          animate={{ opacity: [0.72, 1, 0.72] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="font-mono text-7xl font-light tracking-tight text-text-primary sm:text-8xl"
        >
          {time}
        </motion.p>

        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.3em] text-text-muted">
          {date}
        </p>

        <p
          className={`mt-12 text-v3 font-medium tracking-tight ${
            pouls.critiques > 0 ? 'text-danger-ink' : calme ? 'text-text-secondary' : 'text-text-primary'
          }`}
        >
          {verdict}
        </p>

        {/* Les comptes, en une ligne — les seuls chiffres du mur. */}
        {sites.length > 0 && (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.25em] text-text-muted">
            {enLigne} en ligne
            <span className="mx-2 text-border-strong">·</span>
            {horsLigne} hors ligne
            {pouls.ouverts > 0 && (
              <>
                <span className="mx-2 text-border-strong">·</span>
                {pouls.ouverts} incident{pouls.ouverts > 1 ? 's' : ''}
              </>
            )}
          </p>
        )}

        {enVeille && (
          <p className="mt-16 font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted/60">
            Bougez la souris pour reprendre
          </p>
        )}
      </div>
    </div>
  );
}
