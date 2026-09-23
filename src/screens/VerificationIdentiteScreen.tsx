import React, { useMemo, useState } from 'react';
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
  LigneRegistre,
  PiedDominante,
  donnees,
} from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import { formatCentsCompact } from '../lib/money';
import { enLettres } from '../lib/cinquante/lettres';
import { type EnregistrementKyc, type ReglageKyc, SERRURE, type Verification, serrure } from '../lib/cinquante/juridique';
import type { Id } from '../lib/cinquante/guichet';
import { useLangue } from '../i18n';

/**
 * VÉRIFICATION D'IDENTITÉ — les goupilles (`38e`).
 *
 * Une serrure à goupilles : chaque contrôle indépendant est une goupille en
 * deux parties, et une ligne de cisaillement traverse la serrure. Un contrôle
 * réussi pose la coupure EXACTEMENT sur la ligne ; un contrôle en échec la
 * décale d'autant que l'écart constaté. La serrure ne s'ouvre que si toutes
 * les coupures sont sur la ligne — et un client ne passe jamais « vérifié »
 * avec une goupille désalignée.
 */

const MOIS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const quand = (iso: string, maintenant: Date) => {
  const j = Math.floor((maintenant.getTime() - new Date(iso).getTime()) / 86_400_000);
  return j <= 0 ? 'aujourd’hui' : j === 1 ? 'hier' : `${new Date(iso).getDate()} ${MOIS[new Date(iso).getMonth()]}`;
};

export function VerificationIdentiteScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const tout = useCollection<EnregistrementKyc>('kycChecks');
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const verifs = useMemo(
    () => tout.filter((e): e is Id<Verification> & { updatedAt: string } => e.kind === 'verification').sort((a, b) => b.demandeeLe.localeCompare(a.demandeeLe)),
    [tout],
  );
  const reglage = tout.find((e): e is Id<ReglageKyc> & { updatedAt: string } => e.kind === 'reglage') ?? null;
  const v = verifs.find((x) => !x.valideeLe) ?? verifs[0] ?? null;
  const s = v ? serrure(v, maintenant) : null;
  const vide = !v;
  const verifies = verifs.filter((x) => x.valideeLe).length;
  const bloques = verifs.filter((x) => !x.valideeLe && !serrure(x, maintenant).ouverte).length;
  const adresse = v?.controles.find((c) => c.cle === 'adresse' && c.dateJustificatif);

  const demander = async () => {
    if (!v) return;
    await upsert('kycChecks', v.id, { ...donnees(v), justificatifDemandeLe: new Date().toISOString() });
  };
  const valider = async () => {
    if (!v || !s?.ouverte) return;
    await upsert('kycChecks', v.id, { ...donnees(v), valideeLe: new Date().toISOString() });
  };

  const description = vide
    ? t('m50.kyc.descriptionVide')
    : s?.ouverte
      ? t('m50.kyc.descriptionOuverte', { n: L(v.controles.length, true) })
      : t('m50.kyc.description', { n: L(v.controles.length, true), alignees: L(v.controles.length - (s?.goupilles.filter((g) => g.px > 0).length ?? 0)) });

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.juridique'), module: t('m50.kyc.titre') })}
          title={t('m50.kyc.titre')}
          description={description}
          phraseVide={t('m50.kyc.phraseVide')}
        />
      </Bloc>

      <Dominante surtitre={v ? `La serrure · ${v.client}` : 'La serrure'} note={v ? 'Coupure sur la ligne = contrôle réussi' : undefined}>
        {!v || !s ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Chaque nouveau client professionnel passera ici par cinq contrôles indépendants, comme les goupilles d’une
            serrure : elle ne s’ouvre que si toutes s’alignent sur la même ligne.
          </p>
        ) : (
          <>
            <div className="relative border border-border-raised bg-sunken px-3 pb-5 pt-[18px] sm:px-[26px]">
              <span className="absolute inset-x-0 h-0.5 bg-text-body" style={{ top: 18 + SERRURE.ligne }} aria-hidden />
              <div className="relative flex gap-2 sm:gap-[18px]">
                {s.goupilles.map((g) => {
                  const a = g === s.ambre;
                  return (
                    <div key={g.c.cle} className="flex min-w-0 flex-1 flex-col items-center" data-signal-groupe={a ? 'goupille' : undefined}>
                      <div className="relative w-[26px] sm:w-[34px]" style={{ height: SERRURE.goupille }} aria-hidden>
                        <span
                          className={`absolute inset-x-0 rounded-t-[3px] ${a ? 'bg-signal shadow-[0_0_28px_-7px_var(--color-signal-glow)]' : 'bg-text-muted'}`}
                          style={{ top: SERRURE.haut + g.px, height: SERRURE.pilote }}
                        />
                        <span
                          className={`absolute inset-x-0 rounded-b-[12px] ${a ? 'border-2 border-signal bg-[#1c1408]' : 'border border-border-strong bg-[#2b2b2b]'}`}
                          style={{ top: SERRURE.ligne + g.px, height: SERRURE.bas - SERRURE.ligne - g.px }}
                        />
                      </div>
                      <span className="mt-3 text-center text-[12px] font-semibold text-text-primary sm:text-[13px]">{g.c.nom}</span>
                      <span className={`mt-[3px] text-center font-mono text-[9.5px] leading-[1.4] sm:text-[10px] ${a ? 'font-bold text-signal' : 'text-text-muted'}`}>{g.raison ?? g.c.detail}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <PiedDominante
              action={
                s.ouverte ? (
                  !v.valideeLe ? <BoutonPrimaire onClick={() => void valider()}>Valider le client</BoutonPrimaire> : undefined
                ) : s.ambre?.c.cle === 'adresse' && !v.justificatifDemandeLe ? (
                  <BoutonSecondaire onClick={() => void demander()}>Demander un justificatif récent</BoutonSecondaire>
                ) : undefined
              }
            >
              {s.ouverte
                ? v.valideeLe
                  ? `La vérification de ${v.client} est validée (${quand(v.valideeLe, maintenant)}).`
                  : 'Toutes les goupilles sont sur la ligne : la serrure s’ouvre.'
                : s.ambre?.c.cle === 'adresse' && adresse?.dateJustificatif
                  ? `Le justificatif d’adresse fourni date de ${MOIS_LONGS[new Date(adresse.dateJustificatif).getMonth()]}. Tout justificatif de moins de trois mois aligne la goupille et ouvre la serrure.${
                      v.justificatifDemandeLe ? ` Un justificatif récent a été demandé le ${quand(v.justificatifDemandeLe, maintenant)}.` : ''
                    }`
                  : `La goupille « ${s.ambre?.c.nom} » bloque : ${s.ambre?.raison}. Le client ne peut pas passer « vérifié ».`}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Les vérifications récentes" note={verifs.length ? 'Client · issue' : undefined}>
          {verifs.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucune vérification pour l’instant.</p>
          ) : (
            verifs.slice(0, 6).map((x, i, arr) => {
              const sx = serrure(x, maintenant);
              return (
                <LigneRegistre key={x.id} colonnes="minmax(0,1fr) auto minmax(0,140px)" derniere={i === arr.length - 1}>
                  <span className="min-w-0 text-[13.5px] text-text-primary">{x.client}</span>
                  <span className="font-mono text-[11.5px] text-text-muted">{quand(x.demandeeLe, maintenant)}</span>
                  <span className="text-right font-mono text-[11.5px] text-text-secondary">
                    {x.valideeLe ? 'validée' : sx.ouverte ? 'ouverte' : `bloquée · ${sx.ambre?.c.nom.toLowerCase()}`}
                  </span>
                </LigneRegistre>
              );
            })
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Les vérifications"
          releves={[
            { label: 'Clients vérifiés', valeur: verifies },
            { label: 'Bloqués', valeur: bloques },
            { label: 'Pièces gardées', valeur: reglage ? `${reglage.conservationAns} ans` : '—' },
          ]}
        >
          {reglage
            ? `Seuls les clients professionnels au-delà de ${formatCentsCompact(reglage.seuilCaAnnuelCents)} par an passent par cette serrure.`
            : 'Les pièces sont conservées cinq ans, puis purgées, comme le prévoit le registre RGPD.'}
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
