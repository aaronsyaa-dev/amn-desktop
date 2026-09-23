import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Bloc,
  BoutonSecondaire,
  Calmes,
  CarteCalme,
  CarteReleves,
  Dominante,
  Ecran50,
  LigneRegistre,
  PiedDominante,
  donnees,
} from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import {
  CADRAN,
  type EnregistrementPlanif,
  type PostPlanif,
  type ReseauPlanif,
  aiguilleDansLeCreux,
  angleAiguille,
  cheminSecteur,
  picAudience,
  pointPolaire,
  semaineDe,
} from '../lib/cinquante/marketing';
import type { Id } from '../lib/cinquante/guichet';
import { useLangue } from '../i18n';

/**
 * PLANIFICATEUR — l'horloge d'audience (`35c`).
 *
 * Un cadran de 24 heures par réseau, minuit en haut. La couronne a 24
 * secteurs dont l'ÉPAISSEUR suit la part d'abonnés en ligne à cette heure,
 * de 56 à 100 px de rayon, sur une échelle commune aux trois cadrans
 * (21 % = 44 px) ; au-delà de 12 %, un secteur est plus clair. Chaque post
 * de la semaine est une aiguille à `(heure + minutes / 60) × 15°`. Un cadran
 * sans post reste affiché, sans aiguille.
 */

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const hh = (h: number) => String(h).padStart(2, '0');
const heureMinute = (d: Date) => `${hh(d.getHours())}:${hh(d.getMinutes())}`;
const partLisible = (p: number) => `${Math.round(p)} %`;

function Cadran({ reseau, posts, ambreId }: { reseau: ReseauPlanif; posts: Array<Id<PostPlanif>>; ambreId: string | null }) {
  return (
    <svg viewBox={CADRAN.viewBox} className="block w-full max-w-[236px]" role="img" aria-label={`Audience de ${reseau.nom}, heure par heure`}>
      <circle r={54} fill="var(--color-sunken)" stroke="var(--color-border-raised)" />
      {reseau.audience.map((part, h) => (
        <path key={h} d={cheminSecteur(h, part)} fill={part > CADRAN.seuilClair ? 'var(--color-text-muted)' : 'var(--color-border-strong)'} />
      ))}
      {/* Les quatre repères, aux coordonnées du cahier (la ligne de base du texte compense sa hauteur). */}
      {([[0, 0, -118], [6, 120, 4], [12, 0, 124], [18, -122, 4]] as const).map(([h, x, y]) => (
        <text key={h} x={x} y={y} textAnchor="middle" fill="var(--color-text-muted)" fontFamily="JetBrains Mono, monospace" fontSize={9}>
          {hh(h)}
        </text>
      ))}
      {posts.map((p) => {
        const d = new Date(p.le);
        const a = angleAiguille(d);
        const bout = pointPolaire(CADRAN.aiguille, a);
        const ambre = p.id === ambreId;
        const lib = pointPolaire(72, a);
        return (
          <g key={p.id} data-signal-groupe={ambre ? 'aiguille-creux' : undefined}>
            <line x1={0} y1={0} x2={bout.x.toFixed(1)} y2={bout.y.toFixed(1)} stroke={ambre ? 'var(--color-signal)' : 'var(--color-text-body)'} strokeWidth={ambre ? 3 : 2} strokeLinecap="round" />
            <circle cx={bout.x.toFixed(1)} cy={bout.y.toFixed(1)} r={ambre ? 5 : 3.5} fill={ambre ? 'var(--color-signal)' : 'var(--color-text-body)'} />
            {ambre && (
              <text x={lib.x.toFixed(1)} y={(lib.y - 10).toFixed(1)} fill="var(--color-signal)" fontFamily="JetBrains Mono, monospace" fontWeight={700} fontSize={10}>
                {heureMinute(d)}
              </text>
            )}
          </g>
        );
      })}
      <circle r={6} fill="var(--color-elevated)" stroke="#4a4a48" strokeWidth={2} />
    </svg>
  );
}

export function PlanificateurScreen() {
  const { t } = useLangue();
  const { upsert } = useSync();
  const tout = useCollection<EnregistrementPlanif>('scheduledPosts');
  const [maintenant] = useState(() => new Date());

  const reseaux = useMemo(
    () => tout.filter((e): e is Id<ReseauPlanif> & { updatedAt: string } => e.kind === 'reseau').sort((a, b) => a.ordre - b.ordre),
    [tout],
  );
  const posts = useMemo(() => tout.filter((e): e is Id<PostPlanif> & { updatedAt: string } => e.kind === 'post'), [tout]);
  const semaine = semaineDe(maintenant);
  const dansLaSemaine = posts
    .filter((p) => new Date(p.le) >= semaine.debut && new Date(p.le) < semaine.fin)
    .sort((a, b) => a.le.localeCompare(b.le));
  const creux = aiguilleDansLeCreux(reseaux, dansLaSemaine, maintenant);
  const vide = reseaux.length === 0;

  const moisCourant = maintenant.getMonth();
  const publiesMois = posts.filter((p) => p.publieLe && new Date(p.publieLe).getMonth() === moisCourant && new Date(p.publieLe).getFullYear() === maintenant.getFullYear());
  const porteeMoyenne = publiesMois.length ? Math.round(publiesMois.reduce((s, p) => s + (p.portee ?? 0), 0) / publiesMois.length) : null;
  const parHeure = new Map<number, number[]>();
  for (const p of publiesMois) {
    const h = new Date(p.publieLe as string).getHours();
    parHeure.set(h, [...(parHeure.get(h) ?? []), p.portee ?? 0]);
  }
  const meilleure = [...parHeure.entries()]
    .map(([h, v]) => ({ h, m: v.reduce((a, b) => a + b, 0) / v.length }))
    .sort((a, b) => b.m - a.m)[0];

  /* Le réseau délaissé : le plus longtemps sans post, s'il n'en a reçu aucun depuis trente jours. */
  const delaisse = reseaux
    .map((r) => {
      const derniers = posts.filter((p) => p.reseau === r.nom && (p.publieLe ?? p.le) <= maintenant.toISOString()).map((p) => p.publieLe ?? p.le).sort();
      return { r, dernier: derniers[derniers.length - 1] ?? null };
    })
    .filter((x) => !x.dernier || maintenant.getTime() - new Date(x.dernier).getTime() > 30 * 86_400_000)
    .sort((a, b) => (a.dernier ?? '').localeCompare(b.dernier ?? ''))[0];

  const deplacer = async () => {
    if (!creux) return;
    const d = new Date(creux.post.le);
    d.setHours(picAudience(creux.reseau.audience), 0, 0, 0);
    const brut = posts.find((p) => p.id === creux.post.id);
    if (!brut) return;
    await upsert('scheduledPosts', brut.id, { ...donnees(brut), le: d.toISOString() });
  };

  const pic = creux ? picAudience(creux.reseau.audience) : 0;
  const description = vide
    ? t('m50.postPlanner.descriptionVide')
    : creux
      ? t('m50.postPlanner.description')
      : t('m50.postPlanner.descriptionSansCreux');

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.marketing'), module: t('m50.postPlanner.titre') })}
          title={t('m50.postPlanner.titre')}
          description={description}
          phraseVide={t('m50.postPlanner.phraseVide')}
        />
      </Bloc>

      <Dominante
        surtitre="L’audience, heure par heure · 28 derniers jours"
        note={vide ? undefined : 'Couronne épaisse = abonnés en ligne · aiguille = post prévu'}
      >
        {vide ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Chaque réseau relié aura ici son cadran de vingt-quatre heures : la couronne s’épaissira aux heures où vos
            abonnés sont en ligne, et chaque post prévu y sera une aiguille.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-3">
              {reseaux.map((r) => {
                const siens = dansLaSemaine.filter((p) => p.reseau === r.nom);
                const n = siens.length;
                const creuxIci = creux && creux.reseau.nom === r.nom ? new Date(creux.post.le).getHours() : null;
                return (
                  <div key={r.id} className="flex min-w-0 flex-col items-center gap-3">
                    <Cadran reseau={r} posts={siens} ambreId={creux?.post.id ?? null} />
                    <span className="text-center">
                      <span className="block text-[13.5px] font-semibold text-text-primary">{r.nom}</span>
                      <span className="tnum mt-[3px] block font-mono text-[10px] text-text-muted">
                        {n === 0 ? 'aucun post' : n === 1 ? '1 post' : `${n} posts`}
                        {creuxIci !== null ? ` · creux à ${hh(creuxIci)} h` : ''}, pic à {hh(picAudience(r.audience))} h
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            <PiedDominante
              action={creux ? <BoutonSecondaire onClick={() => void deplacer()}>Le déplacer à {hh(pic)}:00</BoutonSecondaire> : undefined}
            >
              {creux
                ? `Le post de ${JOURS_LONGS[new Date(creux.post.le).getDay()]} ${heureMinute(new Date(creux.post.le))} part dans le creux ${
                    /^[aeiouyéèh]/i.test(creux.reseau.nom) ? 'd’' : 'de '
                  }${creux.reseau.nom} : ${partLisible(creux.part)} des abonnés en ligne, contre ${partLisible(creux.reseau.audience[pic])} à ${hh(pic)}:00.`
                : 'Aucun post de la semaine ne tombe dans un creux d’audience.'}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Les posts de la semaine" note={dansLaSemaine.length ? 'Jour · heure · réseau' : undefined}>
          {dansLaSemaine.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun post prévu cette semaine.</p>
          ) : (
            dansLaSemaine.map((p, i) => {
              const d = new Date(p.le);
              return (
                <LigneRegistre key={p.id} colonnes="64px 44px minmax(0,110px) minmax(0,1fr)" derniere={i === dansLaSemaine.length - 1}>
                  <span className="text-[13.5px] text-text-primary">{JOURS[d.getDay()]} {d.getDate()}</span>
                  <span className="tnum font-mono text-[11.5px] text-text-secondary">{heureMinute(d)}</span>
                  <span className="min-w-0 font-mono text-[11.5px] text-text-secondary [overflow-wrap:anywhere]">{p.reseau}</span>
                  <span className="min-w-0 text-right font-mono text-[11.5px] text-text-secondary">{p.sujet}</span>
                </LigneRegistre>
              );
            })
          )}
        </CarteCalme>
        <CarteReleves
          surtitre={MOIS[moisCourant].replace(/^./, (c) => c.toUpperCase())}
          releves={[
            { label: 'Posts publiés', valeur: publiesMois.length },
            { label: 'Portée moyenne', valeur: porteeMoyenne === null ? '—' : porteeMoyenne.toLocaleString('fr-FR') },
            { label: 'Meilleure heure', valeur: meilleure ? `${hh(meilleure.h)}:00` : '—' },
          ]}
        >
          {delaisse
            ? `${delaisse.r.nom} n’a reçu aucun post ${
                delaisse.dernier ? `depuis ${MOIS[new Date(delaisse.dernier).getMonth()]}` : 'pour l’instant'
              }, alors que son pic tombe à ${picAudience(delaisse.r.audience)} h.`
            : 'Chaque réseau a reçu au moins un post ces trente derniers jours.'}
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
