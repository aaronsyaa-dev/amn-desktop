import React from 'react';
import { useCollection } from '../../state/SyncContext';
import { invoiceTotals } from '../../state/useInvoices';
import { dayKey } from '../../lib/calendar';
import { EnTeteAccueil, SiPremierJour, enLettres, euros } from './communs';
import { OUVERTURE, useJournee } from './journee';
import { barreEcart, ecartRelatif, hors, joursDeReference, mediane, plusGrandEcart } from '../formules';

/**
 * C8 · LES ÉCARTS (`40h`).
 *
 * Une médiane verticale — la journée habituelle — et une ligne par indicateur
 * qui s'en écarte : barre à gauche en dessous, à droite au-dessus, flèche au
 * bord au-delà du double. Ce qui est dans l'habitude disparaît.
 *
 * Règles (ACCUEILS.md), dans `accueils/formules` et éprouvées par
 * `check:cinquante` : habitude = médiane des vingt derniers mêmes jours de
 * semaine ; affichage au-delà de ± 5 % ; barre = min(|écart|, 100 %) / 2.
 * L'ambre : l'écart le plus grand, sa barre et sa valeur.
 *
 * Les indicateurs horodatés sont comparés À LA MÊME HEURE (« encaissé à
 * 16 h »). Ceux que l'espace ne date qu'au jour (encaissements, devis
 * envoyés) comparent la journée entière : avant la fermeture, un « en
 * dessous » n'est donc pas encore un écart et n'est pas montré.
 */

interface Appel {
  kind: string;
  debutLe?: string;
}
interface Pointage {
  startedAt: string;
  endedAt: string;
}
interface Intervention {
  at: string;
}
interface Panier {
  kind: string;
  etape?: string;
  arreteLe?: string;
}

interface Ligne {
  cle: string;
  nom: string;
  valeur: number;
  habitude: number;
  ecart: number;
  texte: (v: number) => string;
}

const MIN_JOURS = 3;
const heures = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')}`;

export function Ecarts() {
  const j = useJournee(60_000);
  const appels = useCollection<Appel>('switchboardCalls').filter((c) => c.kind === 'appel' && c.debutLe);
  const temps = useCollection<Pointage>('timeEntries');
  const interventions = useCollection<Intervention>('interventions');
  const paniers = useCollection<Panier>('shopCarts').filter((p) => p.kind === 'panier' && p.etape !== 'paye' && p.arreteLe);

  const now = j.maintenant;
  const minuteDuJour = now.getHours() * 60 + now.getMinutes();
  const ferme = now.getHours() >= OUVERTURE.finH;
  /** La même heure, un autre jour. */
  const aLHeure = (jour: Date) => new Date(jour.getFullYear(), jour.getMonth(), jour.getDate(), 0, minuteDuJour).getTime();
  const debutJour = (jour: Date) => new Date(jour.getFullYear(), jour.getMonth(), jour.getDate()).getTime();

  /** Un indicateur horodaté : combien d'instants entre le début du jour et la même heure. */
  function compte(cle: string, nom: string, instants: number[], texte: (v: number) => string): Ligne | null {
    if (!instants.length) return null;
    const depuis = new Date(Math.min(...instants));
    const ref = joursDeReference(now, depuis);
    if (ref.length < MIN_JOURS) return null;
    const valeurDe = (d: Date) => instants.filter((t) => t >= debutJour(d) && t <= aLHeure(d)).length;
    const habitude = mediane(ref.map(valeurDe)) ?? 0;
    const valeur = valeurDe(now);
    return { cle, nom, valeur, habitude, ecart: ecartRelatif(valeur, habitude), texte };
  }

  const lignes: Ligne[] = [];
  const pousse = (l: Ligne | null) => l && lignes.push(l);

  pousse(compte('rdv', 'Rendez-vous', j.appointments.map((a) => new Date(a.startAt).getTime()), (v) => String(v)));
  pousse(compte('appels', 'Appels reçus', appels.map((c) => new Date(c.debutLe as string).getTime()), (v) => String(v)));
  pousse(compte('interventions', 'Interventions', interventions.map((i) => new Date(i.at).getTime()), (v) => String(v)));
  pousse(compte('paniers', 'Paniers laissés', paniers.map((p) => new Date(p.arreteLe as string).getTime()), (v) => String(v)));

  /* Heures pointées : les minutes pointées jusqu'à la même heure. */
  if (temps.length) {
    const depuis = new Date(Math.min(...temps.map((p) => new Date(p.startedAt).getTime())));
    const ref = joursDeReference(now, depuis);
    if (ref.length >= MIN_JOURS) {
      const minutesDe = (d: Date) =>
        temps.reduce((s, p) => {
          const a = Math.max(new Date(p.startedAt).getTime(), debutJour(d));
          const b = Math.min(p.endedAt ? new Date(p.endedAt).getTime() : now.getTime(), aLHeure(d));
          return s + Math.max(0, b - a) / 60_000;
        }, 0);
      const habitude = mediane(ref.map(minutesDe)) ?? 0;
      const valeur = minutesDe(now);
      lignes.push({ cle: 'temps', nom: 'Heures pointées', valeur, habitude, ecart: ecartRelatif(valeur, habitude), texte: heures });
    }
  }

  /* Encaissé : l'espace ne date un règlement qu'au jour — la journée entière. */
  const payees = j.invoices.filter((f) => f.kind !== 'creditNote' && f.status === 'paid' && f.paidAt);
  if (payees.length) {
    const depuis = new Date(`${payees.map((f) => f.paidAt).sort()[0]}T12:00:00`);
    const ref = joursDeReference(now, depuis);
    if (ref.length >= MIN_JOURS) {
      const encaisse = (d: Date) => payees.filter((f) => f.paidAt === dayKey(d)).reduce((s, f) => s + invoiceTotals(f).grossCents, 0);
      const habitude = mediane(ref.map(encaisse)) ?? 0;
      const valeur = j.encaisseJour;
      const ecart = ecartRelatif(valeur, habitude);
      if (ecart > 0 || ferme) lignes.push({ cle: 'encaisse', nom: ferme ? 'Encaissé' : `Encaissé à ${now.getHours()} h`, valeur, habitude, ecart, texte: (v) => euros(Math.round(v)) });
    }
  }

  /* Le délai du devis à enjeu, contre le délai habituel de réponse. */
  if (j.enJeu?.motif === 'devis' && j.enJeu.jours !== null) {
    const delais = j.quotes
      .filter((q) => (q.status === 'accepted' || q.status === 'refused') && q.sentAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 20)
      .map((q) => Math.max(0, Math.round((new Date(q.updatedAt).getTime() - new Date(`${q.sentAt}T12:00:00`).getTime()) / 86_400_000)));
    if (delais.length >= MIN_JOURS) {
      const habitude = mediane(delais) ?? 0;
      const valeur = j.enJeu.jours;
      lignes.push({ cle: 'devis', nom: `Délai du devis ${j.enJeu.rdv.clientName}`, valeur, habitude, ecart: ecartRelatif(valeur, habitude), texte: (v) => `${Math.round(v)} j` });
    }
  }

  const affichees = lignes.filter((l) => hors(l.ecart)).sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart));
  const ambre = plusGrandEcart(affichees);
  const dansLHabitude = lignes.length - affichees.length;

  return (
    <SiPremierJour j={j}>
      <div className="flex flex-col gap-6">
        <EnTeteAccueil j={j} nom="Les écarts" />
        <section className="panel-raised panel-raised-wide px-5 pb-6 pt-7 sm:px-8">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="eyebrow text-text-secondary">Écarts à une journée ordinaire</span>
            <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">MÉDIANE = HABITUEL · À GAUCHE MOINS · À DROITE PLUS</span>
          </div>
          {affichees.length > 0 && (
            <div className="mb-1.5 hidden grid-cols-[200px_minmax(0,1fr)_210px] gap-[18px] md:grid">
              <span />
              <span className="flex justify-between font-mono text-[9.5px] tracking-[0.08em] text-text-muted">
                <span>− 100 %</span>
                <span>HABITUEL</span>
                <span>+ 100 %</span>
              </span>
              <span />
            </div>
          )}
          {affichees.map((l) => {
            const b = barreEcart(l.ecart);
            const est = l === ambre;
            const groupe = est ? { 'data-signal-groupe': 'ecart' } : {};
            return (
              <div key={l.cle} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-[18px] gap-y-1 py-1.5 md:grid-cols-[200px_minmax(0,1fr)_210px]">
                <span className={`min-w-0 text-[13.5px] ${est ? 'font-bold text-text-primary' : 'font-medium text-text-body'}`}>{l.nom}</span>
                <span className="relative order-last col-span-2 h-[30px] md:order-none md:col-span-1">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-[#4a4a48]" />
                  <span
                    {...groupe}
                    className={`absolute top-2 h-3.5 ${est ? 'bg-signal shadow-[0_0_20px_-3px_rgba(208,154,74,.9)]' : b.cote === 'droite' ? 'bg-border-strong' : 'bg-[#4a4a48]'}`}
                    style={{ width: `${b.largeur * 100}%`, ...(b.cote === 'droite' ? { left: '50%' } : { right: '50%' }) }}
                  />
                  {b.fleche && (
                    <span
                      {...groupe}
                      aria-hidden
                      className={`absolute top-[5px] h-0 w-0 border-y-[10px] border-y-transparent ${
                        b.cote === 'droite' ? `left-[calc(100%-2px)] border-l-[10px] ${est ? 'border-l-signal' : 'border-l-border-strong'}` : `right-[calc(100%-2px)] border-r-[10px] ${est ? 'border-r-signal' : 'border-r-[#4a4a48]'}`
                      }`}
                    />
                  )}
                </span>
                <span {...groupe} className={`tnum whitespace-nowrap text-right font-mono text-[12.5px] ${est ? 'font-bold text-signal' : 'font-medium text-text-secondary'}`}>
                  {l.texte(l.valeur)} · habituel {l.texte(l.habitude)}
                </span>
              </div>
            );
          })}
          <p className={`text-[13.5px] leading-[1.6] text-text-secondary [text-wrap:pretty] ${affichees.length ? 'mt-4 border-t border-border-raised pt-4' : ''}`}>
            {affichees.length === 0
              ? lignes.length
                ? 'Tout est dans l’habitude aujourd’hui : aucun indicateur ne s’en écarte de plus de 5 %.'
                : 'Pas encore assez d’historique pour dire ce qu’est une journée ordinaire : il faut trois semaines de données.'
              : dansLHabitude === 0
                ? 'Aucun autre indicateur à comparer.'
                : `${dansLHabitude === 1 ? 'Un autre indicateur est' : `${enLettres(dansLHabitude).replace(/^./, (c) => c.toUpperCase())} autres indicateurs sont`} dans ${dansLHabitude === 1 ? 'son' : 'leur'} habitude et ne s’affiche${dansLHabitude === 1 ? '' : 'nt'} pas.`}
          </p>
        </section>
      </div>
    </SiPremierJour>
  );
}
