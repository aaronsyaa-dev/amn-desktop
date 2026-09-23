import React, { useMemo, useState } from 'react';
import { ShoppingBasket } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Bloc,
  BoutonSecondaire,
  Calmes,
  CarteCalme,
  CarteReleves,
  Dominante,
  ENCRE_SURTITRE_PLAQUE,
  Ecran50,
  LigneBarre,
  PiedDominante,
  donnees,
  noteTechnique,
} from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import { formatCents, formatCentsCompact } from '../lib/money';
import { enLettres } from '../lib/cinquante/lettres';
import {
  type ColonneAchat,
  type EnregistrementBoutique,
  type Id,
  type PanierBoutique,
  montantPanier,
  parcoursAchat,
} from '../lib/cinquante/guichet';
import { useLangue } from '../i18n';

/**
 * BOUTIQUE — les paniers laissés (`34a`).
 *
 * Le parcours d'achat en cinq colonnes égales, et chaque panier abandonné
 * RESTE POSÉ sous l'étape où l'acheteur s'est arrêté. On ne lit pas un taux de
 * conversion : on voit où les paniers s'entassent.
 *
 * L'ambre est calculé (`parcoursAchat`), jamais posé : il va à l'étape qui a
 * le plus de paniers laissés, et sa plaque porte la somme EXACTE de la pile —
 * les deux règles sont éprouvées par `check:cinquante`.
 */

const LIBELLE_ETAPE: Record<string, { nom: string; phrase: string }> = {
  vu: { nom: 'Vu', phrase: 'visites de la boutique' },
  panier: { nom: 'Panier', phrase: 'paniers ouverts' },
  livraison: { nom: 'Livraison', phrase: 'ont vu les frais de port' },
  paiement: { nom: 'Paiement', phrase: 'ont saisi une carte' },
  paye: { nom: 'Payé', phrase: 'commandes' },
};

/** Une plaque de panier : 28 px, un carré de 6 px par article, le montant à droite. */
function PlaquePanier({ panier }: { panier: Id<PanierBoutique> }) {
  const articles = Math.min(6, panier.articles.reduce((n, a) => n + a.quantite, 0));
  return (
    <div
      className="flex h-7 items-center gap-[7px] border border-border-section bg-[#151515] px-[9px]"
      title={panier.articles.map((a) => `${a.quantite} × ${a.produit}`).join(', ')}
    >
      <ShoppingBasket size={12} strokeWidth={1.9} className="flex-none text-text-muted" aria-hidden />
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: articles }, (_, i) => (
          <span key={i} className="h-1.5 w-1.5 bg-[#4a4a48]" />
        ))}
      </span>
      <span className="tnum ml-auto font-mono text-[11px] font-medium text-text-secondary">
        {formatCentsCompact(montantPanier(panier))}
      </span>
    </div>
  );
}

function Colonne({ colonne, ambre, payes }: { colonne: ColonneAchat; ambre: boolean; payes: { cents: number; moyenCents: number } }) {
  const lib = LIBELLE_ETAPE[colonne.etape];
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="mb-1.5 border-b-2 border-[#2b2b2b] pb-3">
        <span className="block font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-text-muted">{lib.nom}</span>
        <span className="tnum mt-[7px] block font-mono text-[27px] font-bold leading-none tracking-[-0.04em] text-text-primary">
          {colonne.atteints}
        </span>
        <span className="mt-1 block text-[11.5px] text-text-muted">{lib.phrase}</span>
      </div>

      {colonne.etape === 'vu' && (
        <span className="text-[12px] leading-[1.5] text-text-muted">Aucun panier : on regarde, on n’ajoute rien.</span>
      )}

      {colonne.etape === 'paye' && colonne.atteints > 0 && (
        <div className="border border-[#2b2b2b] bg-[#151515] px-3 py-2.5">
          <span className="tnum block font-mono text-[18px] font-bold tracking-[-0.02em] text-text-primary">
            {formatCentsCompact(payes.cents)}
          </span>
          <span className="mt-[3px] block text-[11.5px] text-text-secondary">
            encaissés, panier moyen {formatCents(payes.moyenCents)}
          </span>
        </div>
      )}

      {/* L'AMBRE : la plaque « PANIERS LAISSÉS ICI », surtitre et relevé en un seul nœud. */}
      {ambre && (
        <div data-signal-groupe="paniers-laisses" className="bg-signal px-2.5 py-[9px] shadow-[0_0_28px_-7px_var(--color-signal-glow)]">
          <span className={`block font-mono text-[9px] font-bold uppercase tracking-[0.14em] ${ENCRE_SURTITRE_PLAQUE}`}>
            Paniers laissés ici
          </span>
          <span className="tnum mt-1 block font-mono text-[16px] font-bold tracking-[-0.02em] text-signal-ink">
            {colonne.laisses.length} · {formatCentsCompact(colonne.laissesCents)}
          </span>
        </div>
      )}

      {colonne.pile.map((p) => (
        <PlaquePanier key={p.id} panier={p} />
      ))}
      {colonne.reste > 0 && (
        <span className="tnum pt-1 text-center font-mono text-[11px] text-text-muted">+ {colonne.reste}</span>
      )}
    </div>
  );
}

export function BoutiqueScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const enregistrements = useCollection<EnregistrementBoutique>('shopCarts');
  const [maintenant] = useState(() => new Date());
  const [relance, setRelance] = useState<string | null>(null);

  const p = useMemo(() => parcoursAchat(enregistrements, maintenant), [enregistrements, maintenant]);
  const ouverts = p.colonnes.find((c) => c.etape === 'panier')?.atteints ?? 0;
  const vide = ouverts === 0;
  const colAmbre = p.colonnes.find((c) => c.etape === p.etapeAmbre) ?? null;

  const aRelancer = useMemo(
    () => p.colonnes.flatMap((c) => c.laisses).filter((x) => x.adresse && !x.relanceLe),
    [p],
  );
  const relancer = async () => {
    const le = new Date().toISOString();
    for (const x of aRelancer) await upsert('shopCarts', x.id, { ...donnees(x), relanceLe: le });
    setRelance(t('m50.shop.relances', { n: aRelancer.length }));
  };

  const L = (n: number, maj = false) => enLettres(n, langue, maj);
  const description = vide
    ? t('m50.shop.descriptionVide')
    : colAmbre
      ? t('m50.shop.description', {
          ouverts: L(ouverts, true),
          payes: L(p.payes.n),
          laisses: L(p.laisses.n),
          ici: L(colAmbre.laisses.length),
          etape: LIBELLE_ETAPE[colAmbre.etape].nom.toLowerCase(),
        })
      : t('m50.shop.descriptionSansAbandon', { ouverts: L(ouverts, true), payes: L(p.payes.n) });

  return (
    <Ecran50 vide={vide} premierJour={enregistrements.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.guichet'), module: t('m50.shop.titre') })}
          title={t('m50.shop.titre')}
          description={description}
          phraseVide={t('m50.shop.phraseVide')}
        />
      </Bloc>

      <Dominante
        surtitre="Le parcours d’achat · 30 derniers jours"
        note={vide ? undefined : 'Chaque panier laissé reste à l’étape où l’acheteur s’est arrêté'}
      >
        {vide ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Les cinq étapes du parcours — vu, panier, livraison, paiement, payé — s’afficheront ici dès le premier
            panier ouvert. Un panier abandonné reste posé sous l’étape où l’acheteur s’est arrêté.
          </p>
        ) : (
          <>
            {/* Les cinq colonnes côte à côte dès la tablette ; sur un téléphone,
                les étapes se suivent de haut en bas, dans le même ordre — rien
                ne défile latéralement, rien n'est caché hors cadre. */}
            <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-5 md:gap-3.5">
              {p.colonnes.map((c) => (
                <Colonne key={c.etape} colonne={c} ambre={c.etape === p.etapeAmbre} payes={p.payes} />
              ))}
            </div>
            {colAmbre && (
              <PiedDominante
                action={
                  aRelancer.length > 0 ? (
                    <BoutonSecondaire onClick={() => void relancer()}>
                      {t('m50.shop.relancer', { n: aRelancer.length })}
                    </BoutonSecondaire>
                  ) : undefined
                }
              >
                {relance ??
                  `L’étape ${LIBELLE_ETAPE[colAmbre.etape].nom.toLowerCase()} retient ${colAmbre.laisses.length} des ${p.laisses.n} paniers laissés en route, pour ${formatCentsCompact(colAmbre.laissesCents)}. C’est là que l’acheteur s’arrête le plus souvent.`}
              </PiedDominante>
            )}
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme
          surtitre="Ce que contenaient les paniers laissés"
          note={vide ? undefined : noteTechnique([`${p.laisses.n} paniers`, formatCentsCompact(p.laisses.cents)])}
        >
          {p.contenu.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">
              Aucun panier laissé : tout ce qui a été mis au panier a été payé.
            </p>
          ) : (
            p.contenu.slice(0, 6).map((c, i, arr) => (
              <LigneBarre
                key={c.produit}
                nom={c.produit}
                part={c.quantite / arr[0].quantite}
                valeur={`${c.quantite} × ${formatCents(c.prixCents)}`}
                derniere={i === arr.length - 1}
              />
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Le mois"
          releves={[
            { label: 'Commandes payées', valeur: p.payes.n },
            { label: 'Panier moyen', valeur: formatCents(p.payes.moyenCents) },
            { label: 'Laissé en route', valeur: formatCentsCompact(p.laisses.cents) },
          ]}
        >
          {vide
            ? 'Un panier laissé ne sera relancé que si l’acheteur a donné son adresse.'
            : `Un panier laissé n’est relancé que si l’acheteur a donné son adresse — ${L(p.laisses.relancables)} sur ${L(p.laisses.n)}.`}
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
