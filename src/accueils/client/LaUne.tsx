import React, { useState } from 'react';
import { useCollection } from '../../state/SyncContext';
import { dayKey } from '../../lib/calendar';
import { invoiceTotals } from '../../state/useInvoices';
import { SiPremierJour, euros } from './communs';
import { hhmm, useJournee } from './journee';

/**
 * C2 · LA UNE (`40b`).
 *
 * Une première page de quotidien : l'en-tête et son double filet, le bandeau
 * « À LA UNE », un titre de 46 px sur 22 caractères, une accroche de deux
 * phrases, puis trois colonnes de brèves (Argent, Stock, Équipe).
 *
 * Règles : le titre est une PHRASE DÉCLARATIVE, jamais un chiffre seul. Une
 * colonne n'existe que si sa famille a quelque chose à dire ; à deux, la
 * grille passe à deux colonnes — jamais une colonne vide. « L'édition de
 * 16:04 » est l'heure de COMPOSITION : la une se recompose à chaque
 * ouverture, pas en continu.
 */

const JOURS = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];
const MOIS = ['JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE'];
const EN_LETTRES = ['zéro', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];
const nombre = (n: number) => (n <= 10 ? EN_LETTRES[n] : String(n));
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Intervention {
  title: string;
  clientName: string;
  at: string;
  closedAt: string;
}

interface Breve {
  surtitre: string;
  titre: string;
  texte: string;
}

export function LaUne() {
  const j = useJournee(60_000);
  /* L'heure d'édition : celle de la composition, figée à l'ouverture. */
  const [edition] = useState(() => new Date());
  const interventions = useCollection<Intervention>('interventions');
  const duJourInt = interventions.filter((i) => dayKey(new Date(i.at)) === dayKey(edition));

  const minutes = j.enJeu ? Math.max(0, Math.round((new Date(j.enJeu.rdv.startAt).getTime() - edition.getTime()) / 60_000)) : 0;
  const [titre, accroche] = (() => {
    if (j.enJeu) {
      const h = hhmm(new Date(j.enJeu.rdv.startAt));
      const sujet = j.enJeu.motif === 'devis' ? `Le devis ${j.enJeu.rdv.clientName}` : `La facture de ${j.enJeu.rdv.clientName}`;
      const attente = j.enJeu.jours !== null ? `${majuscule(nombre(j.enJeu.jours))} jour${j.enJeu.jours > 1 ? 's' : ''} ${j.enJeu.motif === 'devis' ? 'sans réponse' : 'd’impayé'}` : 'Toujours en attente';
      const quand = minutes < 60 ? `dans ${minutes <= 10 ? nombre(minutes) : minutes} minute${minutes > 1 ? 's' : ''}` : `à ${h}`;
      return [`${sujet} se joue à ${h}`, `${attente}, et un rendez-vous en main propre ${quand}. C’est la seule chose de la journée qui ne se rattrape pas demain.`];
    }
    if (j.retard.n > 0) return [`${euros(j.retard.cents)} attendent d’être encaissés`, `${majuscule(nombre(j.retard.n))} facture${j.retard.n > 1 ? 's' : ''} ${j.retard.n > 1 ? 'ont' : 'a'} passé leur échéance. Une relance peut partir aujourd’hui.`];
    if (j.ruptures.length) return [`Il manque ${j.ruptures[0].name.toLowerCase()} en stock`, 'La prochaine commande fournisseur le rattrape. Rien d’autre ne presse.'];
    return ['La journée est tenue', 'Aucun rendez-vous n’attend de décision, aucune facture ne traîne. On peut avancer ce qui attend.'];
  })();

  const breves: Breve[] = [];
  if (j.retard.n > 0 || j.encaisseJour > 0) {
    const plus = [...j.retard.factures].sort((a, b) => invoiceTotals(b).grossCents - invoiceTotals(a).grossCents)[0];
    breves.push({
      surtitre: 'ARGENT',
      titre: j.retard.n > 0 ? `${euros(j.retard.cents)} attendent au-delà de l’échéance` : `${euros(j.encaisseJour)} encaissés aujourd’hui`,
      texte:
        j.retard.n > 0
          ? `${majuscule(nombre(j.retard.n))} facture${j.retard.n > 1 ? 's' : ''}${plus ? `, dont celle de ${plus.billTo.name}` : ''}. La relance peut partir ce soir.`
          : 'Aucune facture ne dépasse son échéance.',
    });
  }
  if (j.ruptures.length) {
    breves.push({
      surtitre: 'STOCK',
      titre: j.ruptures.length === 1 ? `Plus de ${j.ruptures[0].name.toLowerCase()} en réserve` : `${majuscule(nombre(j.ruptures.length))} articles en rupture`,
      texte: `${j.ruptures.slice(0, 3).map((a) => a.name).join(', ')} : à commander avant la prochaine intervention.`,
    });
  }
  if (duJourInt.length) {
    const faites = duJourInt.filter((i) => i.closedAt).length;
    const enCours = duJourInt.find((i) => !i.closedAt);
    breves.push({
      surtitre: 'ÉQUIPE',
      titre: `${majuscule(nombre(duJourInt.length))} intervention${duJourInt.length > 1 ? 's' : ''} aujourd’hui`,
      texte: `${majuscule(nombre(faites))} faite${faites > 1 ? 's' : ''}${enCours ? `, une en cours chez ${enCours.clientName}` : ''}.`,
    });
  }

  const cols = breves.length === 3 ? 'md:grid-cols-3' : breves.length === 2 ? 'md:grid-cols-2' : '';

  return (
    <SiPremierJour j={j}>
      <section className="panel-raised panel-raised-wide px-5 py-[30px] sm:px-9">
        <h1 className="sr-only">Accueil — La une</h1>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-[3px] border-double border-[#333] pb-3.5">
          <span className="font-mono text-[11px] font-bold tracking-[0.24em] text-text-body">L’ESPACE {(j.org?.name ?? '').toUpperCase()}</span>
          <span className="tnum font-mono text-[11px] tracking-[0.12em] text-text-muted">
            {JOURS[edition.getDay()]} {edition.getDate()} {MOIS[edition.getMonth()]} · ÉDITION DE {hhmm(edition)}
          </span>
        </div>
        <span
          className="mt-6 inline-block bg-signal px-2.5 py-[5px] font-mono text-[10px] font-bold tracking-[0.2em] text-[#0a0a0a] shadow-[0_0_30px_-7px_rgba(208,154,74,.85)]"
          data-signal-groupe="une"
        >
          À LA UNE
        </span>
        <h2 className="mt-3.5 max-w-[22ch] text-[32px] font-bold leading-[1.02] tracking-[-0.035em] text-text-primary [text-wrap:balance] sm:text-[46px]">{titre}</h2>
        <p className="mt-3.5 max-w-[62ch] text-[16px] leading-[1.55] text-text-secondary [text-wrap:pretty]">{accroche}</p>
        {breves.length > 0 && (
          <div className={`mt-7 grid gap-7 ${cols}`}>
            {breves.map((b) => (
              <div key={b.surtitre} className="min-w-0 border-t border-[#333] pt-3.5">
                <span className="block font-mono text-[9.5px] font-bold tracking-[0.18em] text-text-muted">{b.surtitre}</span>
                <span className="mt-2.5 block text-[18px] font-bold leading-[1.25] tracking-[-0.015em] text-text-primary [text-wrap:pretty]">{b.titre}</span>
                <p className="mt-2 text-[13.5px] leading-[1.6] text-text-secondary [text-wrap:pretty]">{b.texte}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </SiPremierJour>
  );
}
