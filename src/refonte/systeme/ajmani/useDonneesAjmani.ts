import { useCallback, useMemo } from 'react';
import { useLangue, libelleNav, indiceNav } from '../../../i18n';
import { useSocleLangue } from '../../../socle/i18n';
import { toutesLesSections } from '../../../data/spaces';
import { useCollection } from '../../../state/SyncContext';
import { useClients } from '../../../state/useClients';
import { useInvoices, netDueCents, isoDay } from '../../../state/useInvoices';
import { useAppointments, appointmentEnd } from '../../../state/useAppointments';
import { useAttention } from '../../../state/useAttention';
import { useNavAlleges } from '../../../state/useNavAlleges';
import { usePoulsGarde } from '../../coquille/pouls';
import { entreeDuRegistre } from '../../navigation/registre';
import { formatCents } from '../../../lib/money';
import { cleMessagePalier, type PalierRelance } from '../../../lib/relances';
import type { ActionProposee, DonneesAjmani, FactureAjmani } from './intentions';

interface RelanceNotee {
  invoiceId: string;
  sentAt: string;
  palier?: PalierRelance;
}

const STATUT: Record<string, FactureAjmani['statut']> = { draft: 'brouillon', issued: 'emise', paid: 'payee', cancelled: 'annulee' };

/**
 * CE QU'AJMANI SAIT — lu dans les accès existants de l'application, rien d'inventé.
 *
 * Les factures, les clients, les relances déjà notées, les rendez-vous du jour, ce qui demande l'attention, le
 * pouls de La Garde et les modules ouverts à l'organisation : tout vient des mêmes sources que l'Accueil et la
 * coquille. Rien n'est écrit d'ici ; l'analyseur (`intentions.ts`) ne lit que ce qui est rendu.
 */
export function useDonneesAjmani(): DonneesAjmani {
  const { langue } = useLangue();
  const { ts } = useSocleLangue();
  const alleges = useNavAlleges();
  const { invoices } = useInvoices();
  const { clients } = useClients();
  const relances = useCollection<RelanceNotee>('paymentReminders');
  const { appointments } = useAppointments();
  const { items: attention } = useAttention();
  const pouls = usePoulsGarde();
  const aujourdhui = isoDay();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const catalogue = useMemo(() => toutesLesSections().flatMap((s) => s.items), [alleges]);

  return useMemo<DonneesAjmani>(() => {
    const maintenant = new Date();
    return {
      aujourdhui,
      factures: invoices
        .filter((f) => f.kind !== 'creditNote')
        .map((f) => ({
          id: f.id,
          numero: f.number,
          clientId: f.clientId,
          clientNom: f.billTo.company || f.billTo.name,
          courriel: Boolean((f.billTo.email ?? '').trim()),
          statut: STATUT[f.status] ?? 'brouillon',
          echeance: f.dueAt,
          resteDuCentimes: netDueCents(f, invoices),
        })),
      clients: clients.map((c) => ({ id: c.id, recordId: c.recordId, nom: c.name, societe: c.company })),
      relances: relances.map((r) => ({ factureId: r.invoiceId, le: r.sentAt, palier: r.palier })),
      modules: catalogue.map((item) => {
        const entree = entreeDuRegistre(item.key);
        return {
          cle: item.key,
          libelle: libelleNav(item),
          indice: indiceNav(item),
          route: item.to,
          famille: entree?.teinte,
          familleLibelle: entree ? ts(`famille.${entree.teinte}`) : undefined,
          verbes: entree?.verbes,
          motsCles: entree?.motsCles,
        };
      }),
      attentes: attention.slice(0, 5).map((a) => ({ cle: a.key, titre: a.title, route: a.to })),
      rendezVousAujourdhui: appointments.filter((a) => a.status === 'scheduled' && isoDay(new Date(a.startAt)) === aujourdhui && appointmentEnd(a) > maintenant).length,
      garde: { etat: pouls.etat, points: pouls.points },
    };
    // `ts` suit la langue : on relit les libellés quand elle change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aujourdhui, invoices, clients, relances, catalogue, attention, appointments, pouls.etat, pouls.points, langue]);
}

/**
 * LE TEXTE D'UNE RELANCE PROPOSÉE — exactement celui que l'écran Relances copie ou envoie : le modèle du palier
 * (`cleMessagePalier`), rempli des faits de la facture (destinataire, numéro, reste dû, échéance, jours). Ajmani ne
 * l'écrit pas, il le montre ; rien ne part d'ici.
 */
export function useTexteRelance(): (p: ActionProposee) => string | null {
  const { t, langue } = useLangue();
  const { invoices } = useInvoices();
  return useCallback(
    (p: ActionProposee) => {
      const f = invoices.find((x) => x.id === p.factureId);
      if (!f || !f.dueAt) return null;
      const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
      return t(cleMessagePalier(p.palier), {
        nom: f.billTo.name,
        numero: f.number,
        montant: formatCents(netDueCents(f, invoices)),
        echeance: new Date(`${f.dueAt}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long' }),
        jours: p.jours,
      });
    },
    [invoices, langue, t],
  );
}
