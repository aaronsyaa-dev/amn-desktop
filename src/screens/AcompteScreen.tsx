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
  LigneBarre,
  PiedDominante,
  donnees,
} from '../components/cinquante-kit';
import { SaisieModule, depuisCents, versCents, versIso, versJour, versNombre } from '../components/SaisieModule';
import { uid, useCollection, useSync } from '../state/SyncContext';
import { formatCentsCompact } from '../lib/money';
import { enLettres } from '../lib/cinquante/lettres';
import { type DevisAcompte, acompteDe, delaisSignatureAcompte, sas } from '../lib/cinquante/guichet';
import { useLangue } from '../i18n';

/**
 * ACOMPTE EN LIGNE — le sas (`34d`).
 *
 * Cinq pistes : les devis envoyés, la porte SIGNATURE, LE SAS, la porte
 * ACOMPTE, les devis payés et lancés. Seul le sas est grand : chaque devis qui
 * y attend est un jeton avec la barre de ses jours d'attente (échelle 14 j).
 * Un devis ne franchit la seconde porte que sur un PAIEMENT RÉEL — rien ici ne
 * permet de le faire passer à la main, et c'est voulu.
 */

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const ilYa = (iso: string, maintenant: Date) => {
  const j = Math.floor((maintenant.getTime() - new Date(iso).getTime()) / 86_400_000);
  return j <= 0 ? 'aujourd’hui' : `il y a ${j} j`;
};

/** Une porte : deux montants verticaux de 3 px et son nom à la verticale. */
function Porte({ nom }: { nom: string }) {
  return (
    <div className="flex items-stretch justify-center gap-1 md:flex-col md:items-center" aria-hidden>
      <span className="h-[3px] flex-1 bg-border-strong md:h-auto md:w-[3px]" />
      <span className="px-2 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted md:px-0 md:py-2 md:[writing-mode:vertical-rl]">
        {nom}
      </span>
      <span className="h-[3px] flex-1 bg-border-strong md:h-auto md:w-[3px]" />
    </div>
  );
}

export function AcompteScreen() {
  const { t, langue } = useLangue();
  const { upsert, remove } = useSync();
  const devis = useCollection<DevisAcompte>('depositQuotes');
  const [maintenant] = useState(() => new Date());
  const [renvoye, setRenvoye] = useState<string | null>(null);

  const s = useMemo(() => sas(devis, maintenant), [devis, maintenant]);
  const delais = useMemo(() => delaisSignatureAcompte(devis, maintenant), [devis, maintenant]);
  const vide = devis.filter((d) => !d.annuleLe).length === 0;
  const L = (n: number, maj = false) => enLettres(n, langue, maj);
  const plusAncien = s.dansLeSas[0] ?? null;

  const moisCourant = maintenant.toISOString().slice(0, 7);
  const recusDuMois = devis
    .filter((d) => d.acompteRecuLe && d.acompteRecuLe.slice(0, 7) === moisCourant)
    .reduce((x, d) => x + acompteDe(d), 0);
  const tauxCourant = devis.length ? Math.round(devis[devis.length - 1].tauxAcompte * 100) : 30;
  const lents = delais.plusTard + delais.jamais;

  const renvoyer = async () => {
    if (!plusAncien) return;
    const brut = devis.find((d) => d.id === plusAncien.id);
    if (!brut) return;
    await upsert('depositQuotes', brut.id, { ...donnees(brut), lienRenvoyeLe: new Date().toISOString() });
    /* Rien ne part tout seul : le paiement en ligne n'est pas branché. La relance est NOTÉE, et l'écran le dit. */
    setRenvoye(`Relance notée pour ${brut.client}. Le lien de paiement ne part pas encore tout seul : écrivez-lui directement.`);
  };

  /* SAISIE — un devis envoyé, puis ses deux portes à la main : signé, acompte reçu (et le chantier planifié). */
  const enregistrer = async (v: Record<string, string>, id?: string) => {
    const avant = devis.find((d) => d.id === id);
    await upsert('depositQuotes', id ?? uid(), {
      ...(avant ? donnees(avant) : {}),
      client: v.client.trim(),
      montantCents: versCents(v.montant) ?? 0,
      tauxAcompte: (versNombre(v.taux) ?? 30) / 100,
      envoyeLe: versIso(v.envoye),
      signeLe: v.signe ? versIso(v.signe) : undefined,
      acompteRecuLe: v.recu ? versIso(v.recu) : undefined,
      planifieLe: v.planifie ? versIso(v.planifie) : undefined,
    });
  };

  const description = vide
    ? t('m50.deposits.descriptionVide')
    : s.dansLeSas.length === 0
      ? t('m50.deposits.descriptionSasVide')
      : t('m50.deposits.description', { n: L(s.dansLeSas.length, true) });

  return (
    <Ecran50 vide={vide} premierJour={devis.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.guichet'), module: t('m50.deposits.titre') })}
          title={t('m50.deposits.titre')}
          description={description}
          phraseVide={t('m50.deposits.phraseVide')}
        />
      </Bloc>

      <SaisieModule
        ajouter="Ajouter un devis"
        ouvertParDefaut={vide}
        note="Signature et paiement en ligne pas encore branchés : cochez chaque étape à la main"
        surtitreListe="Les devis"
        champs={[
          { cle: 'client', intitule: 'Client', type: 'texte', requis: true },
          { cle: 'montant', intitule: 'Montant du devis', type: 'montant', requis: true },
          { cle: 'taux', intitule: 'Acompte demandé', type: 'pourcent', requis: true, defaut: String(tauxCourant) },
          { cle: 'envoye', intitule: 'Envoyé le', type: 'date', requis: true, defaut: versJour(maintenant.toISOString()) },
          { cle: 'signe', intitule: 'Signé le', type: 'date' },
          { cle: 'recu', intitule: 'Acompte reçu le', type: 'date' },
          { cle: 'planifie', intitule: 'Chantier planifié le', type: 'date' },
        ]}
        enregistrer={enregistrer}
        elements={[...devis]
          .filter((d) => !d.annuleLe)
          .sort((a, b) => b.envoyeLe.localeCompare(a.envoyeLe))
          .slice(0, 80)
          .map((d) => ({
            id: d.id,
            libelle: `${d.client} · ${formatCentsCompact(d.montantCents)}`,
            detail: d.acompteRecuLe ? 'acompte reçu' : d.signeLe ? 'signé, acompte attendu' : 'envoyé, pas encore signé',
            valeurs: {
              client: d.client,
              montant: depuisCents(d.montantCents),
              taux: String(Math.round(d.tauxAcompte * 100)),
              envoye: versJour(d.envoyeLe),
              signe: versJour(d.signeLe),
              recu: versJour(d.acompteRecuLe),
              planifie: versJour(d.planifieLe),
            },
          }))}
        supprimer={(id) => remove('depositQuotes', id)}
      />

      <Dominante
        surtitre={vide ? 'Le circuit des devis' : `Le circuit des ${s.envoyes.length + s.dansLeSas.length + s.lances.length} devis`}
        note={vide ? undefined : 'Porte 1 : le client signe · porte 2 : il paie l’acompte'}
      >
        {vide ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Un devis envoyé passera deux portes : la signature, puis l’acompte payé en ligne. Ceux qui ont signé sans
            payer attendront ici, dans le sas — tant que l’acompte n’est pas arrivé, rien ne se planifie.
          </p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-[1fr_22px_1.7fr_22px_1fr] md:gap-0">
              {/* Envoyés, pas signés — compacts. */}
              <div className="min-w-0 md:pr-3">
                <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-text-muted">Envoyés · pas signés</span>
                <div className="mt-3 flex flex-col gap-2">
                  {s.envoyes.length === 0 && <span className="text-[12px] text-text-muted">Aucun.</span>}
                  {s.envoyes.map((d) => (
                    <div key={d.id} className="border border-border bg-surface px-2.5 py-2">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[12.5px] text-text-primary">{d.client}</span>
                        <span className="tnum flex-none font-mono text-[11px] text-text-secondary">{formatCentsCompact(d.montantCents)}</span>
                      </span>
                      <span className="mt-1 block text-[11px] text-text-muted">envoyé {ilYa(d.envoyeLe, maintenant)}{d.note ? ` — ${d.note}` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Porte nom="Signature" />

              {/* LE SAS — l'ambre : son cadre de 2 px et son libellé. Les jetons restent en encre claire. */}
              <div
                data-signal-groupe={s.dansLeSas.length > 0 ? 'sas' : undefined}
                className={`flex min-w-0 flex-col gap-[9px] p-3.5 ${s.dansLeSas.length > 0 ? 'border-2 border-signal shadow-[0_0_34px_-10px_rgba(208,154,74,.8),inset_0_0_40px_-24px_rgba(208,154,74,.6)]' : 'border-2 border-dashed border-border-strong'}`}
              >
                {/* Le libellé en encre ambre, comme au cahier (`34d`) : 10 et 12 px, contraste de 7,5:1 sur la carte dominante. */}
                <span className={`block whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-[0.18em] ${s.dansLeSas.length > 0 ? 'text-signal' : 'text-text-muted'}`}>
                  Dans le sas · {s.dansLeSas.length}
                </span>
                {s.dansLeSas.length > 0 && (
                  <span className="tnum block whitespace-nowrap font-mono text-[12px] font-bold text-signal">
                    {formatCentsCompact(s.attenduCents)} d’acomptes attendus
                  </span>
                )}
                <div className="mt-1 flex flex-col gap-2.5">
                  {s.dansLeSas.length === 0 && <span className="text-[12.5px] text-text-secondary">Personne n’attend entre les deux portes.</span>}
                  {s.dansLeSas.map((d) => (
                    <div key={d.id} className="border border-[#2b2b2b] bg-[#151515] px-3 py-2.5">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[13.5px] font-semibold text-text-primary">{d.client}</span>
                        <span className="tnum flex-none font-mono text-[13px] font-semibold text-text-primary">{formatCentsCompact(d.acompteCents)}</span>
                      </span>
                      <span className="mt-1 block text-[11.5px] text-text-secondary">
                        devis {formatCentsCompact(d.montantCents)} · acompte {Math.round(d.tauxAcompte * 100)} %
                      </span>
                      <span className="mt-2 block h-1 bg-[#191919]">
                        <span className="block h-1 bg-text-secondary" style={{ width: `${d.barrePct.toFixed(1)}%` }} />
                      </span>
                      <span className="mt-1.5 block font-mono text-[10px] text-text-muted">signé {ilYa(d.signeLe as string, maintenant)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Porte nom="Acompte" />

              {/* Payés, lancés — compacts. */}
              <div className="min-w-0 md:pl-3">
                <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-text-muted">Payés · lancés</span>
                <div className="mt-3 flex flex-col gap-2">
                  {s.lances.length === 0 && <span className="text-[12px] text-text-muted">Aucun pour l’instant.</span>}
                  {s.lances.slice(0, 5).map((d) => (
                    <div key={d.id} className="border border-border bg-surface px-2.5 py-2">
                      <span className="block truncate text-[12.5px] text-text-primary">{d.client}</span>
                      <span className="tnum mt-1 block font-mono text-[10.5px] text-text-secondary">
                        {formatCentsCompact(d.montantCents)} · {formatCentsCompact(acompteDe(d))} reçus
                      </span>
                      {d.planifieLe && (
                        <span className="mt-0.5 block text-[11px] text-text-muted">
                          planifié {JOURS[new Date(d.planifieLe).getDay()]} {new Date(d.planifieLe).getDate()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {plusAncien && (
              <PiedDominante
                action={
                  <BoutonSecondaire onClick={() => void renvoyer()} disabled={!!renvoye}>
                    Noter une relance
                  </BoutonSecondaire>
                }
              >
                {renvoye ??
                  `Le plus ancien attend depuis ${L(plusAncien.attenteJours)} jour${plusAncien.attenteJours > 1 ? 's' : ''} : ${plusAncien.client} a signé ${ilYa(plusAncien.signeLe as string, maintenant)}${
                    plusAncien.lienRenvoyeLe ? `, et une relance a été notée ${ilYa(plusAncien.lienRenvoyeLe, maintenant)}` : ', et aucune relance n’a été notée'
                  }.`}
              </PiedDominante>
            )}
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Du oui à l’argent · 90 derniers jours" note={delais.total > 0 ? 'Délai entre signature et acompte' : undefined}>
          {delais.total === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun devis signé depuis trois mois : pas encore de délai à mesurer.</p>
          ) : (
            <>
              {[
                ['dans l’heure', delais.pct.heure],
                ['sous 48 h', delais.pct.deuxJours],
                ['plus tard', delais.pct.plusTard],
                ['jamais — devis annulé', delais.pct.jamais],
              ].map(([nom, pct], i) => (
                <LigneBarre key={nom as string} nom={nom} part={(pct as number) / 100} valeur={`${pct} %`} derniere={i === 3} />
              ))}
              {lents > 0 && (
                <p className="mt-4 text-[13px] leading-[1.55] text-text-secondary">
                  Un devis qui passe plus de deux jours dans le sas n’est payé que {L(delais.plusTard)} fois sur {L(lents)}.
                </p>
              )}
            </>
          )}
        </CarteCalme>
        <CarteReleves
          surtitre={MOIS[maintenant.getMonth()].replace(/^./, (c) => c.toUpperCase())}
          releves={[
            { label: 'Acomptes reçus', valeur: formatCentsCompact(recusDuMois) },
            { label: 'En attente', valeur: formatCentsCompact(s.attenduCents) },
            { label: 'Taux', valeur: `${tauxCourant} % du devis` },
          ]}
        >
          Un devis ne passe la seconde porte que par un paiement réel : un acompte promis au téléphone ne compte pas.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
