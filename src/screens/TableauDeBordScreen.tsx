import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { useInvoices, invoiceTotals, isOverdue, netDueCents } from '../state/useInvoices';
import { useClients } from '../state/useClients';
import type { TimeEntry } from '../state/timeEngine';
import { formatCentsCompact } from '../lib/money';
import { enLettres } from '../lib/cinquante/lettres';
import { type EnregistrementBoutique, type Id, parcoursAchat } from '../lib/cinquante/guichet';
import { type EnregistrementNps, FENETRE_NPS_J, corde } from '../lib/cinquante/marketing';
import {
  PUPITRE,
  type Pupitre,
  ajouterAuBandeau,
  arcCadran,
  joursRestantsDuMois,
  lePlusSouventAuCentre,
  lundiDe,
  mettreAuCentre,
  pointCadran,
} from '../lib/cinquante/ajouts';
import { useLangue } from '../i18n';

/**
 * TABLEAU DE BORD — le pupitre (`39a`).
 *
 * Un seul grand cadran au centre, que l'on choisit, et un bandeau de petits
 * cadrans au-dessous, tous de même taille. N'importe quel indicateur peut
 * prendre la place centrale ; l'ancien rejoint le bandeau. Le pupitre refuse
 * la grille de tuiles égales.
 *
 * « Chaque cadran lit sa valeur dans son module d'origine, jamais dans une
 * copie » : les indicateurs ci-dessous lisent les collections des modules
 * (factures, devis, temps, paniers, NPS, stock) avec les MÊMES fonctions que
 * ces modules — `corde` pour le NPS, `parcoursAchat` pour la Boutique, le
 * seuil du Stock. Le pupitre ne stocke que sa composition.
 */

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DE_MOIS = (m: number) => (/^[aeiou]/.test(MOIS[m]) ? `d’${MOIS[m]}` : `de ${MOIS[m]}`);
const heures = (h: number) => `${String(Math.round(h * 10) / 10).replace('.', ',')} h`;
const signeEspace = (n: number) => (n > 0 ? `+ ${n}` : n < 0 ? `− ${Math.abs(n)}` : '0');
/** « La durée légale » : sans objectif fixé, la semaine se mesure sur 35 h. */
const SEMAINE_LEGALE_H = 35;

interface ArticleStock {
  name: string;
  quantity: number;
  minQuantity: number | null;
}

/** Ce qu'un indicateur montre, calculé depuis son module. */
interface Mesure {
  cle: string;
  libelle: string;
  court: string;
  module: string;
  valeur: string;
  part: number;
  sous: string;
  pied: string;
  action?: { libelle: string; route: string };
}

function Cadran({ part, taille, ambre }: { part: number; taille: 'grand' | 'petit'; ambre: boolean }) {
  const g = PUPITRE[taille];
  const fond = arcCadran(1, g.r) as string;
  const arc = arcCadran(part, g.r);
  const a = pointCadran(part, g.aiguille);
  return (
    <svg viewBox={g.viewBox} className="block w-full" style={{ maxWidth: taille === 'grand' ? 300 : 110 }} aria-hidden>
      <path d={fond} fill="none" stroke="var(--color-border)" strokeWidth={g.trait} />
      {arc && (
        <path
          d={arc}
          fill="none"
          stroke={ambre ? 'var(--color-signal)' : '#5e5e5b'}
          strokeWidth={g.trait}
          style={ambre ? { filter: 'drop-shadow(0 0 6px rgba(208,154,74,.6))' } : undefined}
        />
      )}
      <line x1={0} y1={0} x2={a.x} y2={a.y} stroke={ambre ? 'var(--color-signal)' : 'var(--color-text-body)'} strokeWidth={taille === 'grand' ? 4 : 2} strokeLinecap="round" />
      <circle r={g.moyeu} fill="var(--color-elevated)" stroke="#4a4a48" strokeWidth={2} />
    </svg>
  );
}

export function TableauDeBordScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const pupitres = useCollection<Pupitre>('dashboardDials');
  const { invoices } = useInvoices();
  const { quotes } = useClients();
  const temps = useCollection<TimeEntry>('timeEntries');
  const boutique = useCollection<EnregistrementBoutique>('shopCarts');
  const nps = useCollection<EnregistrementNps>('npsResponses');
  const stock = useCollection<ArticleStock>('stockItems');

  /* Le compte, par son adresse : l'identifiant local vaut 0 pour toute session amn-api. */
  const moi = user?.email?.trim().toLowerCase() || 'local';
  const prenom = (user?.name?.split(/\s+/)[0] ?? '').replace(/^./, (x) => x.toUpperCase());
  const enregistre = pupitres.find((p) => p.kind === 'pupitre' && p.utilisateur === moi) as (Id<Pupitre> & { updatedAt: string }) | undefined;
  const objectifs = enregistre?.objectifs ?? {};
  const [choix, setChoix] = useState<'centre' | 'ajout' | null>(null);

  const mesures = useMemo<Mesure[]>(() => {
    const m = maintenant.getMonth();
    const moisIso = `${maintenant.getFullYear()}-${String(m + 1).padStart(2, '0')}`;
    const jour = `${moisIso}-${String(maintenant.getDate()).padStart(2, '0')}`;
    const r: Mesure[] = [];

    // Facturation — l'encaissé du mois.
    const factures = invoices.filter((f) => f.kind !== 'creditNote');
    if (factures.length) {
      const encaisse = factures.filter((f) => f.status === 'paid' && f.paidAt.startsWith(moisIso)).reduce((s, f) => s + invoiceTotals(f).grossCents, 0);
      const moisPrec = [1, 2, 3].map((k) => {
        const d = new Date(maintenant.getFullYear(), m - k, 1);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return factures.filter((f) => f.status === 'paid' && f.paidAt.startsWith(iso)).reduce((s, f) => s + invoiceTotals(f).grossCents, 0);
      });
      const moyenne = Math.round(moisPrec.reduce((s, x) => s + x, 0) / 3);
      const objectif = objectifs.encaisse ?? null;
      const cible = objectif ?? moyenne;
      const retard = factures.filter((f) => isOverdue(f, jour, invoices)).reduce((s, f) => s + netDueCents(f, invoices), 0);
      const reste = cible - encaisse;
      const jours = joursRestantsDuMois(maintenant);
      r.push({
        cle: 'encaisse',
        libelle: 'Encaissé du mois',
        court: 'encaissé',
        module: 'Facturation',
        valeur: formatCentsCompact(encaisse),
        part: cible > 0 ? encaisse / cible : 0,
        sous: objectif
          ? `encaissés en ${MOIS[m]}, sur un objectif de ${formatCentsCompact(objectif)}`
          : `encaissés en ${MOIS[m]}, contre ${formatCentsCompact(moyenne)} en moyenne sur les trois mois précédents`,
        pied:
          reste > 0
            ? `Il reste ${L(jours)} jour${jours > 1 ? 's' : ''} pour encaisser ${formatCentsCompact(reste)}.${
                retard > 0
                  ? retard >= reste
                    ? ` Les ${formatCentsCompact(retard)} de factures en retard suffiraient à passer ${objectif ? 'l’objectif' : 'la moyenne'}.`
                    : ` Les ${formatCentsCompact(retard)} de factures en retard en couvriraient une partie.`
                  : ''
              }`
            : objectif
              ? `L’objectif est ${reste === 0 ? 'atteint' : `dépassé de ${formatCentsCompact(-reste)}`}.`
              : `La moyenne des trois mois précédents est ${reste === 0 ? 'atteinte' : `dépassée de ${formatCentsCompact(-reste)}`}.`,
        action: retard > 0 && reste > 0 ? { libelle: 'Ouvrir Relances', route: '/relances' } : undefined,
      });
    }

    // Devis — signés sur envoyés, ce mois-ci.
    const envoyes = quotes.filter((q) => q.status !== 'draft' && (q.sentAt ?? q.createdAt).startsWith(moisIso));
    if (quotes.length) {
      const signes = envoyes.filter((q) => q.status === 'accepted').length;
      const attente = envoyes.filter((q) => q.status === 'sent').length;
      r.push({
        cle: 'devis',
        libelle: 'Devis signés',
        court: 'devis signés',
        module: 'Devis',
        valeur: `${signes} / ${envoyes.length}`,
        part: envoyes.length ? signes / envoyes.length : 0,
        sous: `devis signés sur ${envoyes.length} envoyé${envoyes.length > 1 ? 's' : ''} en ${MOIS[m]}`,
        pied: attente ? `${L(attente, true)} devis ${DE_MOIS(m)} attend${attente > 1 ? 'ent' : ''} encore une réponse.` : `Aucun devis ${DE_MOIS(m)} n’attend de réponse.`,
      });
    }

    // Temps — les heures de la semaine.
    if (temps.length) {
      const lundi = lundiDe(maintenant).getTime();
      const h = temps
        .filter((e) => new Date(e.startedAt).getTime() >= lundi)
        .reduce((s, e) => s + Math.max(0, (e.endedAt ? new Date(e.endedAt).getTime() : maintenant.getTime()) - new Date(e.startedAt).getTime()), 0) / 3_600_000;
      const objectif = objectifs.heures ?? null;
      const cible = objectif ?? SEMAINE_LEGALE_H;
      r.push({
        cle: 'heures',
        libelle: 'Heures de la semaine',
        court: 'heures',
        module: 'Temps',
        valeur: objectif ? `${heures(h)} / ${objectif}` : heures(h),
        part: h / cible,
        sous: objectif ? `cette semaine, sur ${objectif} h prévues` : `cette semaine, sur les ${SEMAINE_LEGALE_H} h de la durée légale`,
        pied: h < cible ? `Il manque ${heures(cible - h)} pour tenir la semaine ${objectif ? 'prévue' : 'légale'}.` : `La semaine ${objectif ? 'prévue' : 'légale'} est tenue.`,
      });
    }

    // Boutique — les paniers payés sur trente jours, lus comme la Boutique les lit.
    if (boutique.length) {
      const p = parcoursAchat(boutique as Id<EnregistrementBoutique>[], maintenant);
      const ouverts = p.colonnes.find((c) => c.etape === 'panier')?.atteints ?? 0;
      r.push({
        cle: 'paniers',
        libelle: 'Paniers payés',
        court: 'paniers',
        module: 'Boutique',
        valeur: `${p.payes.n} / ${ouverts}`,
        part: ouverts ? p.payes.n / ouverts : 0,
        sous: `paniers payés sur ${ouverts} ouvert${ouverts > 1 ? 's' : ''} en trente jours`,
        pied: p.laisses.n
          ? `${L(p.laisses.n, true)} panier${p.laisses.n > 1 ? 's' : ''} laissé${p.laisses.n > 1 ? 's' : ''} en trente jours, dont ${L(p.laisses.relancables)} qu’on peut relancer.`
          : 'Aucun panier laissé en trente jours.',
        action: p.laisses.relancables ? { libelle: 'Ouvrir Boutique', route: '/boutique' } : undefined,
      });
    }

    // NPS — la corde du module NPS, sur sa fenêtre.
    if (nps.some((e) => e.kind === 'reponse')) {
      const c = corde(nps, maintenant);
      r.push({
        cle: 'nps',
        libelle: 'NPS',
        court: 'NPS',
        module: 'Marketing · NPS',
        valeur: signeEspace(c.score),
        part: (c.score + 100) / 200,
        sous: `sur ${FENETRE_NPS_J} jours, ${c.n} réponse${c.n > 1 ? 's' : ''}`,
        pied: c.n ? `${L(c.promoteurs, true)} promoteur${c.promoteurs > 1 ? 's' : ''}, ${L(c.detracteurs)} détracteur${c.detracteurs > 1 ? 's' : ''}.` : 'Aucune réponse sur la fenêtre.',
      });
    }

    // Stock — les articles sous leur seuil, avec la règle du module Stock.
    if (stock.length) {
      const sous = stock.filter((a) => a.minQuantity !== null && a.quantity <= a.minQuantity);
      r.push({
        cle: 'stock',
        libelle: 'Stock sous seuil',
        court: 'stock',
        module: 'Stock',
        valeur: String(sous.length),
        part: sous.length / stock.length,
        sous: `article${sous.length > 1 ? 's' : ''} sous le seuil, sur ${stock.length} suivi${stock.length > 1 ? 's' : ''}`,
        pied: sous.length ? `Sous le seuil : ${sous.slice(0, 3).map((a) => a.name).join(', ')}${sous.length > 3 ? '…' : ''}.` : 'Aucun article sous son seuil.',
        action: sous.length ? { libelle: 'Ouvrir Stock', route: '/stock' } : undefined,
      });
    }
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, quotes, temps, boutique, nps, stock, maintenant, objectifs.encaisse, objectifs.heures, langue]);

  const parCle = new Map(mesures.map((x) => [x.cle, x]));
  const vide = mesures.length === 0;

  /* Sans pupitre composé : le premier indicateur au centre, les autres en bandeau. */
  const pupitre: Pupitre = enregistre ?? {
    kind: 'pupitre',
    utilisateur: moi,
    centre: mesures[0]?.cle ?? '',
    bandeau: mesures.slice(1, 1 + PUPITRE.bandeauMax).map((x) => x.cle),
    modifieLe: '',
    centres: [],
  };
  const centre = parCle.get(pupitre.centre) ?? mesures[0] ?? null;
  const bandeau = pupitre.bandeau.filter((c) => c !== centre?.cle && parCle.has(c)).map((c) => parCle.get(c) as Mesure);
  const absents = mesures.filter((x) => x.cle !== centre?.cle && !bandeau.some((b) => b.cle === x.cle));

  const ecrire = async (p: Pupitre) => {
    await upsert('dashboardDials', enregistre?.id ?? `pupitre-${moi.replace(/[^a-z0-9]+/g, '-')}`, { ...p });
    setChoix(null);
  };
  const auCentre = (cle: string) => void ecrire(mettreAuCentre({ ...pupitre, centre: centre?.cle ?? pupitre.centre }, cle, new Date()));
  const ajouter = (cle: string) => {
    const p = ajouterAuBandeau({ ...pupitre, bandeau: bandeau.map((b) => b.cle) }, cle, new Date());
    if (p) void ecrire(p);
  };

  const modifieJ = enregistre?.modifieLe ? Math.floor((maintenant.getTime() - new Date(enregistre.modifieLe).getTime()) / 86_400_000) : null;
  const souvent = parCle.get(lePlusSouventAuCentre(pupitre))?.court ?? centre?.court ?? '—';

  const description = vide
    ? t('m50.dashboard.descriptionVide')
    : t('m50.dashboard.description');

  return (
    <Ecran50 vide={vide} premierJour={vide}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.pilotage'), module: t('m50.dashboard.titre') })}
          title={t('m50.dashboard.titre')}
          description={description}
          phraseVide={t('m50.dashboard.phraseVide')}
          actions={
            vide ? undefined : (
              <span className="flex flex-wrap items-center gap-[13px]">
                <BoutonSecondaire onClick={() => setChoix(choix === 'centre' ? null : 'centre')}>Changer le centre</BoutonSecondaire>
                <BoutonPrimaire onClick={() => setChoix(choix === 'ajout' ? null : 'ajout')} disabled={bandeau.length >= PUPITRE.bandeauMax || absents.length === 0}>
                  Ajouter un cadran
                </BoutonPrimaire>
              </span>
            )
          }
        >
          {choix && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{choix === 'centre' ? 'Au centre :' : 'Au bandeau :'}</span>
              {(choix === 'centre' ? mesures.filter((x) => x.cle !== centre?.cle) : absents).map((x) => (
                <BoutonSecondaire key={x.cle} onClick={() => (choix === 'centre' ? auCentre(x.cle) : ajouter(x.cle))}>
                  {x.libelle}
                </BoutonSecondaire>
              ))}
            </div>
          )}
        </ScreenHeader>
      </Bloc>

      <Dominante surtitre={prenom ? `Le pupitre de ${prenom}` : 'Le pupitre'} note="Un seul instrument au centre">
        {!centre ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Dès qu’un module aura quelque chose à mesurer (encaissé, devis, heures, stock), il pourra prendre la place du
            grand cadran. Un seul au centre, les autres en bandeau.
          </p>
        ) : (
          <>
            <div className="flex flex-col items-center" data-signal-groupe="centre">
              <Cadran part={centre.part} taille="grand" ambre />
              <span className="tnum -mt-1.5 font-mono text-[34px] font-bold tracking-[-0.04em] text-signal">{centre.valeur}</span>
              <span className="mt-1 text-center text-[13.5px] text-text-secondary">{centre.sous}</span>
            </div>

            {bandeau.length > 0 && (
              <div
                className="mt-[26px] grid grid-cols-3 gap-[14px] border-t border-border-raised pt-5 sm:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]"
                style={{ '--n': bandeau.length } as React.CSSProperties}
              >
                {bandeau.map((b) => (
                  <button
                    key={b.cle}
                    type="button"
                    onClick={() => auCentre(b.cle)}
                    title={`Mettre « ${b.libelle} » au centre`}
                    className="flex min-w-0 flex-col items-center gap-1.5 transition-opacity hover:opacity-80"
                  >
                    <Cadran part={b.part} taille="petit" ambre={false} />
                    <span className="tnum whitespace-nowrap font-mono text-[13px] font-semibold text-text-body">{b.valeur}</span>
                    <span className="text-center text-[11.5px] text-text-muted">{b.libelle}</span>
                  </button>
                ))}
              </div>
            )}

            <PiedDominante
              action={centre.action ? <BoutonSecondaire onClick={() => navigate(centre.action?.route ?? '/')}>{centre.action.libelle}</BoutonSecondaire> : undefined}
            >
              {centre.pied}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Les indicateurs disponibles" note={vide ? undefined : 'Vient de'}>
          {vide ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun module n’a encore de quoi alimenter un cadran.</p>
          ) : (
            mesures.map((x, i) => (
              <LigneRegistre key={x.cle} colonnes="minmax(0,1fr) minmax(0,150px)" derniere={i === mesures.length - 1}>
                <span className="min-w-0 text-[13.5px] text-text-primary">{x.libelle}</span>
                <span className="min-w-0 text-right font-mono text-[11.5px] text-text-secondary">{x.module}</span>
              </LigneRegistre>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Le pupitre"
          releves={[
            { label: 'Cadrans', valeur: (centre ? 1 : 0) + bandeau.length },
            { label: 'Modifié', valeur: modifieJ === null ? 'jamais' : modifieJ <= 0 ? 'aujourd’hui' : `il y a ${modifieJ} j` },
            { label: 'Le plus souvent au centre', valeur: souvent },
          ]}
        >
          Chaque personne compose son pupitre : celui-ci n’est que le vôtre, et chaque cadran lit son module d’origine.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
