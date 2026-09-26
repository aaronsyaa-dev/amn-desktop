import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProfilesOptionnel } from '../../state/ProfilesContext';
import { AMBRE, ROUGE } from '../jetons';
import { useCyber, type ModeleCyber, type PostureOrg } from '../donnees/cyber';
import { useSourceBureaux } from '../donnees/source';
import { Carte, Chargement, EnTete, Erreur, Invitation, Ligne, LienFort, Paire } from '../ui/kit';
import { hhmm, jourCourt, prenomDe, signe } from '../format';
import { EcranVide } from '../../components/EtatEcran';

/**
 * CYBER · L'ACCUEIL — le rempart (cahier 11 `45b`).
 *
 * Un pan de mur par organisation, de la plus fragile à la plus solide ; la
 * hauteur est le score de posture, chaque point ouvert une encoche dans le
 * couronnement (huit au plus, le reste en chiffre). Le rouge : la brèche,
 * seule, pour un incident critique ouvert. L'ambre : le couronnement et la
 * tendance du pan qui a le plus baissé en sept jours.
 */

const PISTE = 260;
const PANS_MAX = 12;

export function CyberAccueil() {
  const c = useCyber();
  const src = useSourceBureaux();
  const profils = useProfilesOptionnel();
  const nom = (e: string | null | undefined) => (e ? profils?.profileFor(e).name?.split(' ')[0] || prenomDe(e) : '—');
  const notes = c.orgs.filter((o) => o.score !== null);
  const vide = c.pret && notes.length === 0;
  const { titre, lede } = useMemo(() => phrases(c, nom), [c, profils]);

  if (!c.pret) {
    return (
      <>
        <EnTete accueil surtitre="Cyber · Posture du parc" titre="Le rempart se relève." />
        <Carte dominante titre="Le rempart · posture par organisation">
          <Chargement texte="Relevé des contrôles" compte={src.organisations.length ? { n: 0, sur: src.organisations.length } : null} />
        </Carte>
      </>
    );
  }

  const pans = c.orgs.filter((o) => o.score !== null).slice(0, PANS_MAX);
  const reste = notes.length - pans.length;
  return (
    <EcranVide quand={vide} premierJour={vide}>
      <EnTete accueil surtitre={`Cyber · Posture du parc${c.parc !== null ? ` · ${c.parc} / 100` : ''}`} titre={titre} lede={lede} />
      {src.pannes.length > 0 && <Erreur pannes={src.pannes} at={src.at} relancer={() => void src.recharger()} />}
      <Carte dominante pad="p-7" titre="Le rempart · posture par organisation, de la plus fragile à la plus solide" droite="hauteur = score · encoche = point ouvert">
        {vide ? (
          <>
            <Mur pans={[]} c={c} />
            <div className="mt-6">
              <Invitation
                titre="Aucun contrôle relevé pour l’instant."
                texte="Le rempart se dresse dès qu’une organisation a un contrôle relevé : un certificat suivi par SSL Monitor, un relevé de nuit, ou une déclaration dans la matrice."
                action={<Link to="/cyber/posture" className="bx-btn2">Ouvrir la matrice</Link>}
              />
            </div>
          </>
        ) : (
          <>
            <Mur pans={pans} c={c} />
            {reste > 0 && <p className="mt-3 font-mono text-[10px] tracking-[0.12em] text-text-muted">{reste} ORGANISATIONS PLUS SOLIDES, DANS LA MATRICE</p>}
            {c.ambre && (
              <div className="mt-6 flex flex-wrap items-center gap-5 border-t border-[#1d2121] pt-5">
                <p className="min-w-0 flex-1 text-[13.5px] leading-[1.6] text-text-secondary">
                  {c.ambre.nom} a perdu {Math.abs(c.ambre.tendance ?? 0)} point{Math.abs(c.ambre.tendance ?? 0) > 1 ? 's' : ''} en une semaine
                  {c.ambre.points.length ? ` : ${c.ambre.points.slice(0, 3).join(', ').toLowerCase()}.` : '.'}
                </p>
                <Link to={`/cyber/inventaire/${c.ambre.id}`} className="bx-btn2">
                  Ouvrir {c.ambre.nom}
                </Link>
              </div>
            )}
          </>
        )}
      </Carte>
      <div className="mt-[18px]">
        <Paire>
          <Carte titre="Échéances · 14 jours" droite={c.echeancesProches.length || ''}>
            {c.echeancesProches.length === 0 ? (
              <p className="text-[13px] text-text-secondary">Aucune échéance dans les quatorze jours.</p>
            ) : (
              c.echeancesProches.slice(0, 5).map((x) => <Ligne key={x.id} a={jourCourt(x.date)} b={x.quoi} c={x.type === 'certificat' ? 'SSL' : x.type.toUpperCase()} />)
            )}
            {c.echeancesProches.length > 5 && (
              <div className="mt-4">
                <LienFort to="/cyber/echeances">5 · Échéances</LienFort>
              </div>
            )}
          </Carte>
          <Carte titre={`Incidents ouverts · ${c.incidents.length}`}>
            {c.incidents.length === 0 ? (
              <p className="text-[13px] text-text-secondary">Aucun incident ouvert.</p>
            ) : (
              c.incidents.slice(0, 4).map((g) => (
                <Ligne
                  key={`${g.orgId}-${g.critique}`}
                  a={hhmm(g.prisLe ?? g.depuis)}
                  b={`${g.orgNom} · ${g.titre}${g.prisPar ? ` · pris par ${nom(g.prisPar)}` : ''}`}
                  c={g.critique ? 'CRITIQUE' : 'NORMAL'}
                  lien={`/cyber/incidents/${g.incidents[0].id}`}
                />
              ))
            )}
            <div className="mt-4">
              <LienFort to="/supervision">3 · Incidents</LienFort>
            </div>
          </Carte>
        </Paire>
      </div>
    </EcranVide>
  );
}

function phrases(c: ModeleCyber, nom: (e: string | null | undefined) => string) {
  const breche = c.rouge?.breche ?? null;
  const bas = c.parc !== null && c.parc < 50;
  const titre = !c.orgs.some((o) => o.score !== null)
    ? 'Le rempart n’a pas encore de pierres.'
    : `${bas ? 'Le rempart est bas.' : 'Le rempart tient.'}${breche ? ` Une brèche est ouverte chez ${c.rouge!.nom}.` : ' Aucune brèche.'}`;
  const morceaux: string[] = [];
  if (breche) morceaux.push(breche.prisPar ? `La brèche est tenue par ${nom(breche.prisPar)}${breche.prisLe ? ` depuis ${hhmm(breche.prisLe)}` : ''}.` : 'Personne ne tient encore la brèche.');
  if (c.ambre) morceaux.push(`${breche ? 'Le point qui vous attend est ailleurs : ' : ''}${c.ambre.nom} a perdu ${Math.abs(c.ambre.tendance ?? 0)} point${Math.abs(c.ambre.tendance ?? 0) > 1 ? 's' : ''} en une semaine.`);
  else if (!breche && c.parc !== null) morceaux.push('Aucun pan n’a baissé cette semaine.');
  return { titre, lede: morceaux.join(' ') };
}

function Mur({ pans, c }: { pans: PostureOrg[]; c: ModeleCyber }) {
  const n = Math.max(pans.length, 1);
  return (
    <div className="flex gap-3">
      <div className="relative w-7 flex-none" style={{ height: PISTE }} aria-hidden>
        {[100, 75, 50, 25].map((v) => (
          <span key={v} className="absolute right-0 -translate-y-1/2 font-mono text-[9.5px] text-text-muted" style={{ top: PISTE - (v / 100) * PISTE }}>
            {v}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height: PISTE }}>
          {[100, 75, 50, 25].map((v) => (
            <span key={v} aria-hidden className="absolute left-0 right-0 border-t border-dashed border-[#1f2424]" style={{ top: PISTE - (v / 100) * PISTE }} />
          ))}
          <div data-mv className="bx-veille" style={{ ['--bx-course' as string]: '1100px' }} aria-hidden />
          <ol className="relative grid h-full items-end gap-[10px]" style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }} aria-label="Les pans du rempart">
            {pans.map((o) => (
              <Pan key={o.id} o={o} ambre={c.ambre?.id === o.id} rouge={c.rouge?.id === o.id} />
            ))}
          </ol>
        </div>
        <ol className="mt-3.5 grid gap-[10px]" style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }} aria-hidden>
          {pans.map((o) => {
            const ambre = c.ambre?.id === o.id;
            return (
              <li key={o.id} className="min-w-0" data-signal-groupe={ambre ? 'rempart-ambre' : undefined}>
                <span className="block text-[12.5px] font-semibold leading-tight text-text-primary">{o.nom}</span>
                <span className="mt-2 block font-mono text-[19px] font-semibold tabular-nums tracking-[-0.03em] text-text-primary">{o.score}</span>
                <span className="mt-1 block font-mono text-[9.5px] font-semibold tracking-[0.1em]" style={{ color: ambre ? AMBRE : 'var(--color-text-secondary)' }}>
                  {o.nouvelle || o.tendance === null ? 'NOUVELLE' : `${signe(o.tendance)} EN 7 J`}
                </span>
                <span className="mt-1 block font-mono text-[9.5px] leading-[1.4] tracking-[0.06em] text-text-muted">
                  {o.points.length === 0 ? 'RIEN D’OUVERT' : o.points.length > 8 ? `${o.points.length} POINTS OUVERTS · 8 MONTRÉS` : `${o.points.length} POINT${o.points.length > 1 ? 'S' : ''} OUVERT${o.points.length > 1 ? 'S' : ''}`}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function Pan({ o, ambre, rouge }: { o: PostureOrg; ambre: boolean; rouge: boolean }) {
  const h = Math.round(((o.score ?? 0) / 100) * PISTE);
  const encoches = Math.min(8, o.points.length);
  return (
    <li className="relative min-w-0" style={{ height: h }} data-signal-groupe={ambre ? 'rempart-ambre' : undefined}>
      <Link
        to={`/cyber/inventaire/${o.id}`}
        className="bx-nav absolute inset-0 block"
        title={`${o.nom} · ${o.score} / 100 · ${o.points.length} point${o.points.length > 1 ? 's' : ''} ouvert${o.points.length > 1 ? 's' : ''}`}
        aria-label={`${o.nom} : ${o.score} sur 100, ${o.points.length} points ouverts${o.breche ? ', incident critique ouvert' : ''}`}
        style={{
          background: '#1f2323',
          backgroundImage: 'repeating-linear-gradient(180deg, transparent 0 13px, rgba(0,0,0,.45) 13px 14px)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05)',
        }}
      >
        {/* Le couronnement : ses encoches, régulièrement espacées. */}
        <span className="absolute left-0 right-0 top-0 flex justify-evenly" aria-hidden>
          {Array.from({ length: encoches }, (_, i) => (
            <span key={i} className="block h-[9px] w-[6px]" style={{ background: '#090a0a' }} />
          ))}
        </span>
        {ambre && <span aria-hidden className="absolute -top-[3px] left-0 right-0 h-[3px]" style={{ background: AMBRE, boxShadow: '0 0 14px rgba(208,154,74,.6)' }} />}
        {rouge && o.breche && (
          <span aria-hidden className="absolute left-1/2 top-0 w-3 -translate-x-1/2" style={{ height: '46%', background: ROUGE.trait, boxShadow: '0 0 18px rgba(255,66,48,.55)' }} />
        )}
      </Link>
    </li>
  );
}

