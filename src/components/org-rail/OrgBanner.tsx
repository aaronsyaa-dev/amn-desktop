import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Building2, Loader2 } from 'lucide-react';
import type { AdminOrganization, OrgPulse } from '../../shared/api';
import { PresenceDot } from './PresenceDot';
import { insightFor, useParcInsights } from '../../state/parcInsights';
import { OrgAvatar } from './OrgAvatar';
import { bridge } from '../../lib/bridge';
import { relativeTime } from '../../lib/time';

/**
 * LA BANDEROLE D'UNE ORGANISATION CLIENTE (BLOC E)
 * ════════════════════════════════════════════════
 *
 * « En banderole ouverte en ligne » : une bande horizontale pleine largeur, qui
 * se DÉPLIE au survol pour révéler ce que l'organisation produit réellement.
 *
 * Pourquoi une bande et pas une carte. Une grille de cartes fait tenir six
 * organisations sur un écran, mais elle réserve à chacune la même surface
 * carrée — la moitié vide pour une cliente calme, trop petite pour une cliente
 * active. La bande donne toute la largeur au nom au repos, et toute la hauteur
 * nécessaire à celle qu'on regarde. C'est aussi ce qui la rend lisible en liste
 * de vingt : vingt bandes se parcourent, vingt cartes se scannent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE LE DÉPLIEMENT MONTRE, ET POURQUOI C'EST RÉEL
 *
 * Rien ici n'est décoratif ni figé. Au dépliement, la banderole demande le
 * POULS de l'organisation à amn-api (`GET /v1/admin/organizations/:id/pulse`),
 * qui n'est qu'une série de COUNT sur ses vraies tables. Si la cliente saisit
 * une facture pendant qu'on regarde, le chiffre aura bougé au prochain
 * dépliement. Un chiffre d'exemple aurait été pire qu'aucun chiffre : on finit
 * par lui faire confiance.
 *
 * Le pouls est demandé AU DÉPLIEMENT, jamais au montage de la liste : précharger
 * vingt pouls pour n'en lire qu'un ferait vingt requêtes pour une réponse lue.
 * Une fois obtenu, il est gardé — replier puis rouvrir ne redemande rien, et le
 * chiffre affiché reste celui qu'on vient de lire plutôt que de clignoter.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * L'ANIMATION, ET CE QU'ELLE COMMUNIQUE
 *
 * Le dépliement en hauteur n'est pas un effet : c'est ce qui dit que le contenu
 * révélé APPARTIENT à cette ligne-là et n'a pas remplacé la page. Un panneau
 * qui apparaîtrait d'un coup ailleurs à l'écran obligerait à retrouver de quoi
 * il parle. La durée est courte (0,22 s) — assez pour lier la cause à l'effet,
 * trop courte pour se faire attendre.
 */

/** Ce qu'on écrit quand une organisation n'a encore rien produit. */
const NOTHING_YET = 'Aucune activité enregistrée';

/**
 * Les identifiants de plan ne sont pas des mots.
 *
 * `business_premium` affiché tel quel se lisait « BUSINESS_PREMIUM » une fois
 * passé en capitales par la feuille de style — un identifiant de base de
 * données montré à un humain. Repéré en relisant la banderole dans un vrai
 * navigateur, pas à la lecture du code.
 */
const PLAN_LABELS: Record<string, string> = {
  business_standard: 'Business standard',
  business_premium: 'Business premium',
  internal: 'Interne',
};

export function OrgBanner({
  org,
  onOpen,
  /** Libellé du bouton d'entrée — le geste n'est pas le même partout. */
  openLabel = 'Ouvrir le dossier',
  busy = false,
  /**
   * Les gestes propres à l'écran hôte, posés AVANT le bouton d'entrée.
   *
   * Le registre des organisations suspend, réactive et ouvre le dossier
   * interne ; la Tour de contrôle ne fait qu'entrer. La banderole ne connaît
   * aucun de ces gestes : les câbler ici obligerait à leur trouver un sens
   * dans les deux écrans, et l'un des deux aurait forcément tort.
   */
  actions,
}: {
  org: AdminOrganization;
  onOpen: () => void;
  openLabel?: string;
  busy?: boolean;
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  /*
    LA PRÉSENCE VIENT DU RELEVÉ PARTAGÉ, PAS D'UNE REQUÊTE PAR BANDEROLE (BLOC F)

    Vingt banderoles à l'écran feraient vingt rondes d'interrogation sur une
    donnée strictement identique pour toutes. `useParcInsights` n'en tient
    qu'une, quel que soit le nombre d'abonnés — voir state/parcInsights.ts.

    À la différence du pouls, la présence n'attend PAS le dépliement : c'est
    justement ce qu'on veut voir en balayant la liste sans rien survoler.
  */
  const parc = useParcInsights();
  const presence = insightFor(parc, org.id);
  const [pulse, setPulse] = React.useState<OrgPulse | null>(null);
  const [pulseError, setPulseError] = React.useState(false);
  const asked = React.useRef(false);

  const suspended = org.status === 'suspended';

  // Le pouls, une seule fois, au premier dépliement.
  React.useEffect(() => {
    if (!open || asked.current) return;
    asked.current = true;
    let alive = true;
    void bridge()
      .remote.admin.organizationPulse(org.id)
      .then((p) => {
        if (alive) setPulse(p);
      })
      .catch(() => {
        // Un pouls indisponible n'est pas une erreur d'écran : la banderole
        // reste utilisable, elle dit simplement qu'elle ne sait pas. Prétendre
        // « 0 enregistrement » serait un mensonge, et c'est exactement le
        // genre de zéro qu'on finirait par croire.
        if (alive) setPulseError(true);
      });
    return () => {
      alive = false;
    };
  }, [open, org.id]);

  const lastActivity = pulse?.records.lastAt ?? org.lastActivityAt;

  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      // Le clavier ouvre la banderole comme le pointeur : un dépliement qui
      // n'existe qu'à la souris rend l'information inatteignable autrement.
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
      className={`panel group relative overflow-hidden transition-colors duration-200 ${
        open ? 'border-border-strong' : ''
      } ${suspended ? 'opacity-60' : ''}`}
    >
      {/* La bande au repos : tout ce qu'il faut pour reconnaître et trier. */}
      <div className="flex items-center gap-4 px-4 py-3">
        <OrgAvatar name={org.name} logoDataUrl={org.logoDataUrl} size={38} rounded="rounded-lg" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <PresenceDot insight={presence} unknown={parc.stale || parc.loading} />
            <p className="truncate text-[15px] font-medium leading-tight text-text-primary">
              {org.name}
            </p>
            {suspended && (
              <span className="flex flex-shrink-0 items-center gap-1 border border-warning/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-warning">
                <AlertTriangle size={9} strokeWidth={2.5} />
                Suspendue
              </span>
            )}
          </div>
          <p className="eyebrow mt-1.5 truncate">
            {PLAN_LABELS[org.plan] ?? org.plan} · {org.userCount} compte
            {org.userCount > 1 ? 's' : ''} ·{' '}
            {lastActivity ? `actif ${relativeTime(lastActivity)}` : NOTHING_YET}
          </p>
        </div>

        {/*
          Les trois relevés du repos viennent de la LISTE, déjà chargée : ils
          s'affichent sans une requête de plus. Le dépliement en ajoute, il ne
          les remplace pas — sinon la bande changerait de contenu sous le
          curseur, ce qui se lit comme un rechargement.
        */}
        <div className="hidden flex-shrink-0 items-center gap-6 lg:flex">
          <Relevé label="Comptes" value={org.userCount} />
          <Relevé
            label="Depuis"
            value={new Date(org.createdAt).toLocaleDateString('fr-FR', {
              month: 'short',
              year: '2-digit',
            })}
          />
        </div>

        {actions}

        <button
          type="button"
          onClick={onOpen}
          disabled={suspended || busy}
          className="flex flex-shrink-0 items-center gap-1.5 border border-border-strong bg-surface px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : <ArrowRight size={11} />}
          {openLabel}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="pulse"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-border bg-raised"
          >
            <div className="px-4 py-3">
              {pulseError ? (
                <p className="text-xs text-text-muted">
                  Le détail de cette organisation n’a pas pu être lu. Rien n’est affiché plutôt
                  qu’un zéro qui passerait pour une mesure.
                </p>
              ) : !pulse ? (
                <p className="flex items-center gap-2 text-xs text-text-muted">
                  <Loader2 size={12} className="animate-spin" />
                  Lecture du pouls…
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-x-8 gap-y-3">
                    <Relevé
                      label="Enregistrements"
                      value={pulse.records.total}
                      hint="Tout ce que l’organisation a produit, hors éléments supprimés."
                    />
                    <Relevé
                      label="7 derniers jours"
                      value={pulse.records.last7Days}
                      strong={pulse.records.last7Days > 0}
                      hint="Écritures des sept derniers jours — la mesure de ce qui bouge maintenant."
                    />
                    <Relevé
                      label="Jours actifs / 30"
                      value={`${pulse.activeDaysLast30}/30`}
                      hint="Jours DISTINCTS où quelque chose a bougé. Distingue une organisation régulière d’une qui a tout saisi en une soirée."
                    />
                    <Relevé
                      label="Comptes actifs"
                      value={`${pulse.users.active}/${pulse.users.total}`}
                    />
                    {pulse.sites.total > 0 && (
                      <Relevé
                        label="Sites en ligne"
                        value={`${pulse.sites.online}/${pulse.sites.total}`}
                        strong={pulse.sites.online < pulse.sites.total}
                      />
                    )}
                    {pulse.events.critical7Days > 0 && (
                      <Relevé
                        label="Critiques / 7 j"
                        value={pulse.events.critical7Days}
                        strong
                        hint="Événements de sévérité critique sur les sept derniers jours."
                      />
                    )}
                  </div>

                  {pulse.byCollection.length > 0 && (
                    /*
                      La répartition par module : des noms de collection et des
                      comptes, jamais de contenu. C'est ce qui dit d'un coup
                      d'œil de quoi cette organisation se sert vraiment — et
                      donc, en creux, ce qu'on lui a ouvert pour rien.
                    */
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="eyebrow mr-1">Ce qu’elle utilise</span>
                      {pulse.byCollection.map((c) => (
                        <span
                          key={c.collection}
                          className="border border-border px-2 py-0.5 font-mono text-[10px] text-text-secondary"
                        >
                          {c.collection}
                          <span className="ml-1.5 text-text-muted">{c.count}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Un relevé : l'étiquette au-dessus, le chiffre en dessous, toujours mono. */
function Relevé({
  label,
  value,
  strong = false,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col" title={hint}>
      <span className="eyebrow mb-1.5">{label}</span>
      <span
        className={`tnum text-[15px] font-medium leading-none ${
          strong ? 'text-text-primary' : 'text-text-secondary'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/** Rendu quand aucune organisation n'existe encore. */
export function OrgBannerEmpty({ message }: { message: string }) {
  return (
    <div className="panel flex items-center gap-3 px-4 py-6 text-sm text-text-muted">
      <Building2 size={16} strokeWidth={1.75} />
      {message}
    </div>
  );
}
