import React, { useMemo, useRef, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Bloc,
  BoutonPrimaire,
  BoutonSecondaire,
  Calmes,
  CarteCalme,
  CarteReleves,
  Dominante,
  Ecran50,
  LigneBarre,
  PiedDominante,
  donnees,
} from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import {
  type Carte,
  type CritereLead,
  DONNE,
  type EnregistrementLead,
  type Lead,
  carteDe,
  dernierRecalcul,
  donne,
  poidsAppris,
} from '../lib/cinquante/ajouts';
import { useLangue } from '../i18n';

/**
 * SCORING DES LEADS — la donne (`39b`).
 *
 * Les leads ouverts sont une main de cartes tenue en éventail : chaque carte
 * porte le score, le nom et les trois raisons qui l'expliquent. La plus forte
 * sort de la main, relevée, au centre ; plus une carte est faible, plus elle
 * s'éloigne vers les bords. Sept cartes au plus, de 104 px, tous les 112 px,
 * inclinées de 1° par rang : elles ne se recouvrent jamais.
 *
 * Au téléphone la main se réduit à trois cartes (le centre et ses deux
 * voisines) : sept cartes de 104 px ne tiennent pas dans 390 px sans se
 * recouvrir, et la règle interdit le recouvrement. Les autres vont à la pioche.
 */

const pct = (n: number) => `${n} %`;

function CarteLead({ c, sortie }: { c: Carte; sortie: boolean }) {
  return (
    <>
      <span className={`tnum font-mono text-[24px] font-bold tracking-[-0.04em] ${sortie ? 'text-signal' : 'text-text-body'}`}>
        {c.score}
        <span className="text-[14px]">%</span>
      </span>
      <span className="mt-1.5 text-[12px] font-semibold leading-[1.3] text-text-primary [overflow-wrap:anywhere]">{c.lead.nom}</span>
      <span className="mt-auto flex flex-col gap-1">
        {c.raisons.map((r) => (
          <span key={r} className="text-[10.5px] leading-[1.35] text-text-secondary">
            · {r}
          </span>
        ))}
      </span>
    </>
  );
}

export function ScoringLeadsScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const tout = useCollection<EnregistrementLead>('leadScores');
  const [maintenant] = useState(() => new Date());
  const criteresRef = useRef<HTMLDivElement>(null);
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const criteres = useMemo(() => tout.filter((e): e is CritereLead & { id: string; updatedAt: string } => e.kind === 'critere'), [tout]);
  const leads = useMemo(() => tout.filter((e): e is Lead & { id: string; updatedAt: string } => e.kind === 'lead'), [tout]);
  const poids = useMemo(() => poidsAppris(criteres, leads, maintenant), [criteres, leads, maintenant]);
  const ouverts = leads.filter((l) => !l.closLe);
  /* Un score sans ses trois raisons n'est pas montré : ces leads-là n'ont pas de carte. */
  const cartes = ouverts.map((l) => carteDe(l, poids)).filter((c): c is Carte => c !== null);
  const d = donne(cartes);
  const sortie = d.sortie;
  const forts = cartes.filter((c) => c.score >= DONNE.seuilFort).length;
  const vide = ouverts.length === 0;

  const joues = leads.filter((l) => l.joueEnPremierLe && l.closLe);
  const tauxJoues = joues.length ? Math.round((joues.filter((l) => l.signe).length / joues.length) * 100) : null;
  const recalcul = dernierRecalcul(leads, maintenant);
  const recalculTexte = (() => {
    const h = `${recalcul.le.getHours()} h${recalcul.le.getMinutes() ? ` ${String(recalcul.le.getMinutes()).padStart(2, '0')}` : ''}`;
    const memeJour = recalcul.le.toDateString() === maintenant.toDateString();
    if (recalcul.parEvenement) return memeJour ? `à ${h}` : `hier, ${h}`;
    return memeJour ? `ce matin, ${h}` : `hier, ${h}`;
  })();

  const jouer = async () => {
    if (!sortie) return;
    await upsert('leadScores', sortie.lead.id, { ...donnees(sortie.lead), joueEnPremierLe: new Date().toISOString() });
    if (sortie.lead.telephone) window.location.href = `tel:${sortie.lead.telephone.replace(/\s+/g, '')}`;
  };

  const description = vide ? t('m50.leadScoring.descriptionVide') : t('m50.leadScoring.description');
  const maxPoids = Math.max(1, ...criteres.map((c) => poids.get(c.cle) ?? 0));
  const criteresTries = [...criteres].sort((a, b) => (poids.get(b.cle) ?? 0) - (poids.get(a.cle) ?? 0));

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.commerce'), module: t('m50.leadScoring.titre') })}
          title={t('m50.leadScoring.titre')}
          description={description}
          phraseVide={t('m50.leadScoring.phraseVide')}
          actions={
            vide ? undefined : (
              <span className="flex flex-wrap items-center gap-[13px]">
                <BoutonSecondaire onClick={() => criteresRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Critères</BoutonSecondaire>
                <BoutonPrimaire onClick={() => void jouer()} disabled={!sortie}>
                  Appeler le premier
                </BoutonPrimaire>
              </span>
            )
          }
        />
      </Bloc>

      <Dominante surtitre="La main du jour" note={sortie ? 'La carte qui sort est celle à jouer' : undefined}>
        {!sortie ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            {vide
              ? 'Les leads ouverts se distribueront ici comme une main de cartes : la plus forte sortira de la main, avec ses trois raisons écrites en clair.'
              : 'Aucun lead ouvert n’a encore trois raisons à faire valoir : un score sans explication n’est pas montré.'}
          </p>
        ) : (
          <>
            <div className="relative -mx-3 overflow-hidden sm:mx-0" style={{ height: 300 }}>
              {d.main.map((m) => {
                const s = m.rang === 0;
                return (
                  <div
                    key={m.carte.lead.id}
                    data-signal-groupe={s ? 'sortie' : undefined}
                    className={`absolute flex flex-col px-[9px] pb-[9px] pt-2.5 ${Math.abs(m.rang) === 2 ? 'max-sm:hidden' : Math.abs(m.rang) === 3 ? 'max-lg:hidden' : ''} ${
                      s
                        ? 'border-2 border-signal bg-[#1c1408] shadow-[0_0_28px_-7px_rgba(208,154,74,.85)]'
                        : 'border border-[#333] bg-[#171717] shadow-[0_14px_28px_-14px_rgba(0,0,0,.9)]'
                    }`}
                    style={{
                      left: `calc(50% + ${m.dxPx}px)`,
                      top: m.hautPx,
                      width: DONNE.largeur,
                      height: DONNE.hauteur,
                      transform: `translateX(-50%) rotate(${m.rotationDeg}deg)`,
                      transformOrigin: '50% 120%',
                      zIndex: m.z,
                    }}
                  >
                    <CarteLead c={m.carte} sortie={s} />
                  </div>
                );
              })}
            </div>

            {(d.pioche.length > 0 || d.main.length > 3) && (
              <p className={`mt-2 font-mono text-[11px] leading-[1.6] text-text-muted ${d.pioche.length ? '' : d.main.length > 5 ? 'lg:hidden' : 'sm:hidden'}`}>
                <span className="uppercase tracking-[0.1em]">La pioche · </span>
                {[...d.main.filter((m) => Math.abs(m.rang) > 1), ...d.pioche.map((carte) => ({ carte, rang: 9 }))].map((m, i, arr) => (
                  <span key={m.carte.lead.id} className={Math.abs(m.rang) === 2 ? 'sm:hidden' : Math.abs(m.rang) === 3 ? 'lg:hidden' : ''}>
                    {m.carte.lead.nom} {pct(m.carte.score)}
                    {i < arr.length - 1 ? ' · ' : ''}
                  </span>
                ))}
              </p>
            )}

            <PiedDominante action={<BoutonSecondaire onClick={() => void jouer()}>Appeler {sortie.lead.nom}</BoutonSecondaire>}>
              {`${sortie.lead.nom} : ${sortie.raisons.join(', ')}. ${
                forts === 0
                  ? `Aucun lead ne dépasse ${DONNE.seuilFort} %.`
                  : forts === 1
                    ? `C’est le seul lead au-dessus de ${DONNE.seuilFort} %.`
                    : `${L(forts, true)} leads sont au-dessus de ${DONNE.seuilFort} %.`
              }`}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <div ref={criteresRef} className="min-w-0 scroll-mt-6">
          <CarteCalme surtitre="Les critères du score" note={criteres.length ? 'Poids' : undefined}>
            {criteres.length === 0 ? (
              <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun critère défini.</p>
            ) : (
              criteresTries.map((c, i) => (
                <LigneBarre key={c.cle} nom={c.nom} part={(poids.get(c.cle) ?? 0) / maxPoids} valeur={pct(poids.get(c.cle) ?? 0)} derniere={i === criteresTries.length - 1} />
              ))
            )}
          </CarteCalme>
        </div>
        <CarteReleves
          surtitre="Les leads"
          releves={[
            { label: 'Ouverts', valeur: ouverts.length },
            { label: 'Signés quand joués en premier', valeur: tauxJoues === null ? '—' : pct(tauxJoues) },
            { label: 'Recalcul', valeur: recalculTexte },
          ]}
        >
          Les critères sont appris sur les signatures des douze derniers mois, et affichés tels quels.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
