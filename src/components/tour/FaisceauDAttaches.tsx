import React, { useEffect, useMemo, useState } from 'react';
import { useHaloSignal } from '../EtatEcran';
import { useParcInsights, insightFor } from '../../state/parcInsights';
import { garde } from '../../lib/garde';
import { bridge } from '../../lib/bridge';
import { relativeTime } from '../../lib/time';
import { nomPalier } from '../../lib/paliers';
import type { GardeAgent } from '../../shared/garde';
import type { OrgPulse, ParcOrganization } from '../../shared/api';

/**
 * ORGANISATIONS — le faisceau d'attaches.
 *
 * Le dossier d'une organisation est rendu par CE QUE SA SUSPENSION COUPERAIT :
 * sessions ouvertes, comptes de l'équipe, sites supervisés, rondes de la
 * Garde — chacune avec son compte et ce qu'elle implique. Un bouton
 * « suspendre » sous une fiche ne dit pas ce qu'il détruit ; le faisceau le
 * dit avant le geste.
 *
 * L'AMBRE, unique : la ligne des sessions ouvertes — la seule attache dont la
 * coupure se voit IMMÉDIATEMENT côté cliente. Sans session ouverte, rien de
 * visible ne serait coupé à l'instant, et la ligne ne porte alors pas d'ambre.
 *
 * SUSPENDUE N'EST PAS SILENCIEUSE. Une organisation suspendue a été coupée par
 * nous ; une organisation silencieuse a cessé d'écrire et personne ne lui a
 * rien fait. Les arrivées récentes ne sont ni l'une ni l'autre : elles n'ont
 * pas commencé (`lastActivityAt === null`). Les états réels du produit sont
 * `active` et `suspended`, et rien d'autre — pas de cycle de vie à quatre
 * étapes, il n'existe pas.
 *
 * QUATRE ATTACHES, PAS CINQ. La direction en décrit une cinquième, les
 * invitations en attente. Le produit ne les compte nulle part : ni
 * `OrgPulse`, ni `ParcOrganization`, ni `organizationDossier` ne rend ce
 * nombre, et `admin` n'expose aucune route qui le donnerait. Inventer une
 * ligne « 2 invitations » serait poser un chiffre faux sous un geste
 * irréversible — exactement ce que le faisceau existe pour éviter. La
 * cinquième attache viendra le jour où le serveur la comptera.
 */

interface Attache {
  cle: string;
  n: number;
  titre: string;
  detail: string;
  /** Vrai quand le compte n'est pas encore connu : on écrit un tiret, jamais un zéro. */
  inconnu?: boolean;
}

export function FaisceauDAttaches({ org, onOuvrirDossier }: { org: ParcOrganization; onOuvrirDossier: (id: string) => void }) {
  const parc = useParcInsights();
  const insight = insightFor(parc, org.id);
  const [pulse, setPulse] = useState<OrgPulse | null>(null);
  const [agents, setAgents] = useState<GardeAgent[]>([]);

  useEffect(() => {
    let vivant = true;
    setPulse(null);
    void bridge().remote.admin.organizationPulse(org.id).then((p) => { if (vivant) setPulse(p); }).catch(() => undefined);
    return () => { vivant = false; };
  }, [org.id]);

  useEffect(() => {
    let vivant = true;
    void garde.salle().then((s) => { if (vivant) setAgents(s.agents); }).catch(() => undefined);
    return () => { vivant = false; };
  }, []);

  /*
    LES RONDES QUI PASSENT CHEZ ELLE. Une garde déclare les organisations
    qu'elle laisse tranquilles (`geleOrgs`) ; celles qui ne l'ont pas gelée et
    qui tournent encore sont celles que la suspension mettrait en pause. Le
    compte se dérive donc de la Salle, il ne se devine pas.
  */
  const rondes = useMemo(() => agents.filter((a) => a.actif && !a.geleOrgs.includes(org.id)).length, [agents, org.id]);

  const sessions = insight?.connections ?? null;
  const attaches: Attache[] = [
    {
      cle: 'sessions',
      n: sessions ?? 0,
      inconnu: sessions === null,
      titre: 'Sessions ouvertes',
      detail: sessions === null
        ? 'Le relevé du parc n’est pas encore arrivé.'
        : sessions === 0
          ? 'Personne n’est connecté en ce moment : rien ne se couperait sous les yeux de quelqu’un.'
          : 'Connectées à l’instant. La coupure est immédiate, et elle se voit côté cliente.',
    },
    { cle: 'comptes', n: pulse?.users.total ?? org.userCount, titre: 'Comptes de l’équipe', detail: 'Chacun perd l’accès à l’instant. Rien n’est supprimé : la suspension coupe, elle ne détruit pas.' },
    { cle: 'sites', n: pulse?.sites.total ?? 0, inconnu: pulse === null, titre: 'Sites supervisés', detail: 'Le battement de cœur s’arrête. Les incidents déjà ouverts, eux, restent ouverts.' },
    { cle: 'rondes', n: rondes, titre: 'Rondes de la Garde', detail: 'Le Capitaine les met en pause sur cette organisation ; il ne les supprime pas.' },
  ];

  /* L'ambre ne s'allume que s'il y a quelque chose de visible à couper. */
  const ambre = sessions !== null && sessions > 0;
  const halo = useHaloSignal(ambre);
  const palier = nomPalier(org.plan);

  return (
    <article className="grid items-start gap-8 border border-border-raised bg-elevated px-6 py-[30px] sm:px-8 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-[38px]" data-faisceau={org.id}>
      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">Ce que la suspension couperait</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{attaches.length} attaches vivantes</span>
        </div>
        <ul>
          {attaches.map((a) => {
            const enAmbre = ambre && a.cle === 'sessions';
            const groupe = enAmbre ? 'sessions-ouvertes' : undefined;
            return (
              <li key={a.cle} data-signal-groupe={groupe} className="grid grid-cols-[46px_minmax(0,1fr)_72px] items-center gap-3.5 border-b border-border py-3 last:border-b-0" data-attache={a.cle}>
                {/* Un compte inconnu se dit par un tiret : « 0 » affirmerait qu'on a compté. */}
                <span data-signal-groupe={groupe} className={`font-mono text-[17px] tabular-nums tracking-[-0.02em] ${enAmbre ? `font-bold text-signal ${halo}` : 'font-semibold text-text-primary'}`}>
                  {a.inconnu ? '—' : a.n}
                </span>
                <span className="min-w-0">
                  <span data-signal-groupe={groupe} className={`block text-[13.5px] font-semibold ${enAmbre ? 'text-text-primary' : 'text-text-body'}`}>{a.titre}</span>
                  <span className="mt-[3px] block text-[12px] text-text-muted [text-wrap:pretty]">{a.detail}</span>
                </span>
                {/* La hiérarchie de l'ambre passe aussi par la casse : seule la ligne qui décide crie. */}
                <span data-signal-groupe={groupe} className={`text-right font-mono text-[10px] tracking-[0.1em] ${enAmbre ? 'font-bold uppercase text-signal' : 'text-text-muted'}`}>
                  {a.inconnu ? '—' : a.n > 0 ? 'coupé' : '—'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <div className="border border-border-sheet bg-sunken px-5 py-[18px]">
          <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">L’organisation</span>
          <span className="mt-2 block text-[19px] font-bold tracking-[-0.02em] text-text-primary">{org.name}</span>
          <div className="mt-4 flex flex-col gap-[13px]">
            <span>
              <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">Dernière écriture</span>
              {/* « jamais » n'est pas « il y a 0 jour » : une organisation qui n'a pas commencé se dit en mots. */}
              <span className="mt-1.5 block font-mono text-[19px] font-semibold tabular-nums tracking-tight text-text-primary">
                {org.lastActivityAt ? relativeTime(org.lastActivityAt) : 'jamais'}
              </span>
            </span>
            <span>
              <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">Écritures · 7 j</span>
              <span className="mt-1.5 block font-mono text-[19px] font-semibold tabular-nums tracking-tight text-text-primary">
                {pulse ? pulse.records.last7Days : '—'}
              </span>
            </span>
            <span>
              <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted">Palier</span>
              <span className="mt-1.5 block font-mono text-[19px] font-semibold tracking-tight text-text-primary">{palier}</span>
            </span>
          </div>
        </div>
        <div className="border border-border bg-sunken px-[18px] py-4">
          <p className="text-[13px] leading-relaxed text-text-secondary [text-wrap:pretty]">
            {org.status === 'suspended'
              ? <><b className="font-semibold text-text-body">{org.name}</b> est suspendue : elle a été coupée par nous. Une organisation silencieuse, elle, a cessé d’écrire et personne ne lui a rien fait — ce sont deux états différents.</>
              : <>Une suspension se retire aussi vite qu’elle se pose. Elle coupe l’accès sans rien détruire, et c’est ce qui la distingue de la suppression.</>}
          </p>
          <button type="button" onClick={() => onOuvrirDossier(org.id)} className="mt-3.5 w-fit border-b border-border-strong pb-0.5 text-[12.5px] font-semibold text-text-primary hover:border-text-primary">
            Ouvrir son dossier
          </button>
        </div>
      </div>
    </article>
  );
}
