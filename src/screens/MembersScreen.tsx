import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MailQuestion, Users } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { MembersSection } from '../components/settings/MembersSection';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { bridge } from '../lib/bridge';
import { useAuth } from '../auth/AuthContext';
import { isAdminRole } from '../auth/roles';
import { cleanErrorMessage } from '../lib/errorMessage';
import type { OrgMember, SupportRequest } from '../shared/api';

/**
 * MEMBRES — qui travaille ici, avec quels droits, et combien de places il reste
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Le manque le plus visible du produit (audit du 1er septembre) : la section
 * existait au fond des Réglages, et personne ne la trouvait. C'est maintenant
 * un écran, dans les deux éditions, avec ce que la section ne disait pas :
 * les PLACES de la formule.
 *
 * Les places sont comptées par le SERVEUR (une place = un compte actif ou
 * invité, hors invité occasionnel) et imposées par lui à l'invitation. Cet
 * écran ne les applique pas — il les montre, et quand tout est pris il
 * propose le seul geste utile : demander une place de plus, lue par un humain
 * dans la Tour de contrôle. Aucun robot ne facture rien.
 */

/** Une place = un compte qui travaille. Même règle qu'amn-api (`countsAsSeat`). */
function occupeUnePlace(m: OrgMember): boolean {
  return m.role !== 'guest' && (m.status === 'active' || m.status === 'invited');
}

export function MembersScreen() {
  const { org, role } = useAuth();
  const peutGerer = isAdminRole(role);
  const total = org?.seats ?? null;

  const [membres, setMembres] = useState<OrgMember[] | null>(null);
  const [demandes, setDemandes] = useState<SupportRequest[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const [liste, dem] = await Promise.all([
        bridge().remote.members.list(),
        peutGerer ? bridge().remote.assistance.list().catch(() => [] as SupportRequest[]) : Promise.resolve([] as SupportRequest[]),
      ]);
      setMembres(liste);
      setDemandes(dem);
    } catch (err) {
      setErreur(cleanErrorMessage(err, 'La liste des membres n’a pas pu être lue.'));
    }
  }, [peutGerer]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const occupees = useMemo(() => (membres ?? []).filter(occupeUnePlace).length, [membres]);
  const pleines = total !== null && occupees >= total;
  const demandeEnCours = demandes.find((d) => d.kind === 'seat' && d.status === 'pending');

  const demanderUnePlace = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      await bridge().remote.assistance.send({ kind: 'seat' });
      await charger();
    } catch (err) {
      setErreur(cleanErrorMessage(err, 'La demande n’a pas pu partir.'));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <section className="flex flex-col">
      <ScreenHeader
        eyebrow="Système · Membres"
        title="Membres"
        description="Qui travaille dans cette organisation, avec quels droits — et les places de la formule."
        stats={[
          {
            label: 'Membres',
            value: membres === null ? '…' : membres.filter((m) => m.status !== 'suspended').length,
            title: 'Comptes actifs ou invités, hors comptes suspendus.',
          },
          ...(total !== null
            ? [
                {
                  label: 'Places',
                  value: membres === null ? '…' : `${occupees} / ${total}`,
                  title: 'Une place = un compte actif ou invité. Un compte suspendu libère la sienne.',
                  emphasis: pleines,
                },
              ]
            : []),
        ]}
      />

      <StaggerGroup className="mt-6 flex flex-col gap-4">
        {total !== null && (
          <StaggerItem>
            <section className="panel p-4">
              <p className="eyebrow mb-2">Les places de votre formule</p>
              {/* La jauge : une barre qui se remplit, sans couleur d'alarme —
                  des places prises ne sont pas un incident. */}
              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden bg-border" aria-hidden>
                  <div
                    className="h-full bg-text-secondary transition-[width] duration-500"
                    style={{ width: `${total > 0 ? Math.min(100, (occupees / total) * 100) : 0}%` }}
                  />
                </div>
                <span className="tnum font-mono text-[11px] uppercase tracking-wider text-text-secondary">
                  {occupees} sur {total}
                </span>
              </div>
              <p className="mt-3 max-w-xl text-[12px] leading-relaxed text-text-secondary">
                {pleines
                  ? 'Toutes les places sont prises. Une place se libère en suspendant un compte, ou s’ajoute en changeant de formule — demandez-la, quelqu’un la lit.'
                  : `Il reste ${total - occupees} place${total - occupees > 1 ? 's' : ''}. Une place est un compte qui travaille : un invité occasionnel n’en occupe pas.`}
              </p>
              {peutGerer && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {demandeEnCours ? (
                    <p className="flex items-center gap-2 text-xs text-text-secondary">
                      <MailQuestion size={14} />
                      Une place de plus est demandée — votre prestataire a été prévenu.
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={envoi}
                      onClick={() => void demanderUnePlace()}
                      className="flex min-h-11 items-center gap-2 border border-border-strong bg-surface px-3 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-40 md:min-h-0 md:py-2"
                    >
                      {envoi ? <Loader2 size={13} className="animate-spin" /> : <MailQuestion size={13} />}
                      Demander une place de plus
                    </button>
                  )}
                </div>
              )}
              {erreur && (
                <p className="mt-3 border border-warning/40 bg-warning-muted px-3 py-2 text-xs leading-relaxed text-text-primary">
                  {erreur}
                </p>
              )}
            </section>
          </StaggerItem>
        )}

        <StaggerItem>
          <MembersSection onChange={charger} />
        </StaggerItem>

        {!peutGerer && (
          <StaggerItem>
            <p className="flex items-center gap-2 text-[12px] text-text-muted">
              <Users size={13} />
              Tout le monde lit cette liste ; seuls la propriétaire et les administrateurs la modifient.
            </p>
          </StaggerItem>
        )}
      </StaggerGroup>
    </section>
  );
}
