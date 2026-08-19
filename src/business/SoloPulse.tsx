import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckSquare, ReceiptEuro } from 'lucide-react';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { useAppointments } from '../state/useAppointments';
import { useCollection } from '../state/SyncContext';
import { useInvoices, invoiceTotals } from '../state/useInvoices';
import { formatCentsCompact } from '../lib/money';
import { dayKey } from '../lib/calendar';

/**
 * Le pouls de son activité — trois nombres, sur l'accueil Business (BLOC B).
 *
 * ## Pourquoi ce bloc existe
 *
 * L'accueil interne ouvre sur trois compteurs animés qui donnent l'état du
 * parc en une seconde. L'accueil Business ouvrait sur une salutation et quatre
 * cartes : correct, mais muet. On y lisait ce qu'il y avait *dans* les listes,
 * jamais où on en était.
 *
 * ## La règle que ces trois nombres respectent
 *
 * La même que côté interne, et c'est elle qui décide de leur choix : **aucun
 * n'est une métrique de vanité, chacun mène à l'écran qui le résout.** « Sept
 * clients » ne se résout pas — c'est un état de fait. « 1 240 € à encaisser »
 * se résout : on clique, on relance.
 *
 *   · les rendez-vous de la semaine → l'agenda ;
 *   · les tâches ouvertes           → les tâches ;
 *   · ce qui reste à encaisser      → la facturation.
 *
 * Le troisième est celui qui compte le plus pour quelqu'un qui travaille seul,
 * et c'est justement celui qu'aucun écran ne donnait sans aller le chercher.
 *
 * ## Le compteur animé n'est pas une décoration
 *
 * Il balaie de zéro à la valeur en moins d'une seconde. Ce mouvement dit une
 * chose utile : ce nombre vient d'être calculé, sur des données à jour. Un
 * nombre qui apparaît d'un coup pourrait aussi bien être une constante.
 */

interface TacheLigne {
  status?: string;
}

/** Lundi de la semaine de `date`, à minuit. La semaine française commence lundi. */
function lundiDeLaSemaine(date: Date): Date {
  const lundi = new Date(date);
  const jour = (lundi.getDay() + 6) % 7; // dimanche = 6
  lundi.setDate(lundi.getDate() - jour);
  lundi.setHours(0, 0, 0, 0);
  return lundi;
}

export function SoloPulse() {
  const { appointments } = useAppointments();
  const { invoices } = useInvoices();
  const taches = useCollection<TacheLigne>('tasks');

  const maintenant = new Date();
  const debut = useMemo(() => lundiDeLaSemaine(maintenant), [dayKey(maintenant)]);
  const fin = useMemo(() => {
    const f = new Date(debut);
    f.setDate(f.getDate() + 7);
    return f;
  }, [debut]);

  const semaine = useMemo(
    () =>
      appointments.filter((a) => {
        if (a.status === 'cancelled') return false;
        const t = new Date(a.startAt).getTime();
        return t >= debut.getTime() && t < fin.getTime();
      }).length,
    [appointments, debut, fin],
  );

  const ouvertes = useMemo(
    () => taches.filter((t) => t.status !== 'done').length,
    [taches],
  );

  // Émises et pas encore payées. Les brouillons n'ont pas quitté le bureau :
  // les compter reviendrait à annoncer un encaissement qu'on n'a pas demandé.
  const aEncaisser = useMemo(
    () =>
      invoices
        .filter((f) => f.status === 'issued')
        .reduce((somme, f) => somme + invoiceTotals(f).grossCents, 0),
    [invoices],
  );

  const chiffres = [
    {
      cle: 'semaine',
      icone: CalendarDays,
      rendu: <AnimatedCounter value={semaine} />,
      // « rendez-vous » est invariable : le pluriel se lit sur le nombre, pas sur le mot.
      libelle: 'rendez-vous cette semaine',
      to: '/agenda',
    },
    {
      cle: 'taches',
      icone: CheckSquare,
      rendu: <AnimatedCounter value={ouvertes} />,
      libelle: ouvertes > 1 ? 'tâches ouvertes' : 'tâche ouverte',
      to: '/tasks',
    },
    {
      cle: 'encaisser',
      icone: ReceiptEuro,
      // Un montant ne se balaie pas comme un compte : voir défiler des euros
      // au hasard donne l'impression que la somme hésite. Il s'affiche.
      rendu: <span>{formatCentsCompact(aEncaisser)}</span>,
      libelle: 'à encaisser',
      to: '/facturation',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {chiffres.map(({ cle, icone: Icone, rendu, libelle, to }) => (
        <Link
          key={cle}
          to={to}
          className="elev-hover group flex items-center gap-3 border border-border bg-surface px-4 py-3 transition-colors duration-200 hover:border-border-strong hover:bg-surface-hover"
        >
          <span className="text-text-muted transition-colors duration-200 group-hover:text-text-primary">
            <Icone size={18} strokeWidth={1.5} />
          </span>
          <span className="min-w-0">
            <span className="block text-xl font-bold leading-none tracking-tight text-text-primary">
              {rendu}
            </span>
            <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
              {libelle}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
