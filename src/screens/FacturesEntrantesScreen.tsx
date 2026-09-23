import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Bloc, Calmes, CarteCalme, CarteReleves, Dominante, Ecran50, LigneBarre, PiedDominante } from '../components/cinquante-kit';
import { useCollection } from '../state/SyncContext';
import { formatCents, formatCentsCompact } from '../lib/money';
import { enLettres } from '../lib/cinquante/lettres';
import { type Casier, type FactureEntrante, delaiMoyenPaiement, tri, trimestreDe } from '../lib/cinquante/finance';
import { useLangue } from '../i18n';

/**
 * FACTURES ENTRANTES — le casier (`36i`).
 *
 * Quatre casiers côte à côte, rebord épais en bas comme un casier de tri
 * postal : à payer cette semaine, ce mois, plus tard, et à vérifier. Chaque
 * facture est un pli. « Une facture n'entre dans un casier d'échéance que si
 * fournisseur, montant et échéance ont été lus avec une confiance d'au moins
 * 90 % ; sinon elle va dans “À vérifier”. » Les casiers se classent par
 * échéance, jamais par montant ; les totaux sont la somme exacte des plis.
 *
 * L'ambre : le casier « À vérifier », son cadre, son rebord et son relevé.
 */

const NOM: Record<Casier, string> = { semaine: 'Cette semaine', mois: 'Ce mois', 'plus-tard': 'Plus tard', verifier: 'À vérifier' };
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const jjmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export function FacturesEntrantesScreen() {
  const { t, langue } = useLangue();
  const factures = useCollection<FactureEntrante>('incomingInvoices');
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const casiers = useMemo(() => tri(factures, maintenant), [factures, maintenant]);
  const aVerifier = casiers.find((c) => c.casier === 'verifier');
  const vide = factures.filter((f) => !f.payeeLe).length === 0;
  const recues = factures.filter((f) => !f.payeeLe).length;
  const ambre = aVerifier && aVerifier.plis.length > 0;
  const semaine = casiers.find((c) => c.casier === 'semaine');
  const mois = casiers.find((c) => c.casier === 'mois');
  const trim = trimestreDe(maintenant);
  const parFournisseur = [...new Set(factures.filter((f) => f.fournisseur && new Date(f.recueLe) >= trim.debut).map((f) => f.fournisseur as string))]
    .map((nom) => ({ nom, total: factures.filter((f) => f.fournisseur === nom && new Date(f.recueLe) >= trim.debut).reduce((s, f) => s + (f.montantCents ?? 0), 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const delai = delaiMoyenPaiement(factures);
  const inconnu = aVerifier?.plis.find((p) => p.fournisseur && !p.fournisseurConnu) ?? null;
  const illisible = aVerifier?.plis.find((p) => p.montantCents === null) ?? null;

  const description = vide
    ? t('m50.incomingInvoices.descriptionVide')
    : ambre
      ? t('m50.incomingInvoices.description', { n: L(recues, true), verifier: L(aVerifier.plis.length) })
      : t('m50.incomingInvoices.descriptionRangee', { n: L(recues, true) });

  return (
    <Ecran50 vide={vide} premierJour={factures.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.finance'), module: t('m50.incomingInvoices.titre') })}
          title={t('m50.incomingInvoices.titre')}
          description={description}
          phraseVide={t('m50.incomingInvoices.phraseVide')}
        />
      </Bloc>

      <Dominante
        surtitre={`Le tri · au ${maintenant.getDate()} ${MOIS[maintenant.getMonth()]}`}
        note={vide ? undefined : 'Un casier par échéance · le dernier pour ce qui reste à lire'}
      >
        {vide ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Les factures fournisseurs reçues par courriel ou photographiées se rangeront ici d’elles-mêmes, par échéance.
            Ce que la lecture n’aura pas su trancher restera dans le dernier casier, à vérifier.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {casiers.map((c) => {
                const a = c.casier === 'verifier' && ambre;
                return (
                  <div
                    key={c.casier}
                    data-signal-groupe={a ? 'a-verifier' : undefined}
                    className={`flex min-w-0 flex-col border border-b-[6px] bg-[#0f0f0f] p-3 ${a ? 'border-signal shadow-[0_0_28px_-7px_var(--color-signal-glow)]' : 'border-border-raised'}`}
                  >
                    <span className={`whitespace-nowrap font-mono text-[9px] font-bold uppercase tracking-[0.14em] ${a ? 'text-signal' : 'text-text-secondary'}`}>{NOM[c.casier]}</span>
                    <span className={`tnum mb-3 mt-[5px] block whitespace-nowrap font-mono text-[12px] ${a ? 'font-bold text-signal' : 'font-medium text-text-muted'}`}>
                      {c.plis.length === 0 ? 'vide' : `${c.plis.length} · ${c.totalCents === null ? 'montant incomplet' : formatCents(c.totalCents)}`}
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {c.plis.map((p) => (
                        <div key={p.id} className="border border-border-raised border-l-[3px] border-l-border-strong bg-border-row px-[11px] py-[9px]">
                          <span className="flex justify-between gap-2.5">
                            <span className="min-w-0 text-[12.5px] font-semibold text-text-body [overflow-wrap:anywhere]">{p.fournisseur ?? 'Fournisseur illisible'}</span>
                            <span className="tnum flex-none font-mono text-[12px] font-semibold text-text-primary">
                              {p.montantCents === null ? '— €' : formatCents(p.montantCents)}
                            </span>
                          </span>
                          <span className="tnum mt-[3px] block font-mono text-[10px] text-text-muted [overflow-wrap:anywhere]">
                            {c.casier === 'verifier'
                              ? p.motif ?? (p.montantCents === null ? 'montant illisible' : !p.fournisseurConnu ? 'fournisseur inconnu' : 'lecture incertaine')
                              : `éch. ${p.echeance ? jjmm(p.echeance) : '—'}${p.reference ? ` · ${p.reference}` : ''}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <PiedDominante>
              {inconnu
                ? `${inconnu.fournisseur} ne figure pas parmi vos fournisseurs${inconnu.reference ? '' : ' et sa facture n’a aucun bon de commande en face'}. À vérifier avant tout paiement.`
                : illisible
                  ? `Le montant de la facture ${illisible.fournisseur ? `de ${illisible.fournisseur} ` : ''}n’a pas pu être lu : elle attend qu’on le saisisse.`
                  : `Toutes les factures sont rangées par échéance : ${semaine?.plis.length ?? 0} à payer cette semaine.`}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Les fournisseurs du trimestre" note={parFournisseur.length ? 'Facturé' : undefined}>
          {parFournisseur.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucune facture ce trimestre.</p>
          ) : (
            parFournisseur.map((x, i) => (
              <LigneBarre key={x.nom} nom={x.nom} part={x.total / Math.max(1, parFournisseur[0].total)} valeur={formatCentsCompact(x.total)} derniere={i === parFournisseur.length - 1} />
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Les paiements"
          releves={[
            { label: 'Cette semaine', valeur: semaine?.totalCents === null || !semaine ? '—' : formatCents(semaine.totalCents) },
            { label: 'Ce mois', valeur: formatCents((semaine?.totalCents ?? 0) + (mois?.totalCents ?? 0)) },
            { label: 'Délai moyen', valeur: delai === null ? '—' : `${delai} j` },
          ]}
        >
          Une facture n’entre dans un casier d’échéance que lue à 90 % au moins : fournisseur, montant et échéance.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
