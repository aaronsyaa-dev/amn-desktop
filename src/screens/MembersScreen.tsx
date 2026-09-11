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
              {/*
                UNE PLACE, UN SEGMENT.

                La jauge était une barre continue : à 4 sur 4 comme à 11 sur 12,
                elle est pleine, et il fallait lire le chiffre à côté pour
                savoir de combien on parle. Des segments SE COMPTENT — c'est la
                seule chose qu'on vienne faire sur cet écran, et une formule à
                douze places se distingue d'une formule à quatre au premier
                coup d'œil.

                Aucune couleur d'alarme : des places prises ne sont pas un
                incident, c'est une formule qui sert.
              */}
              <div className="mt-3 flex items-center gap-3">
                <div
                  className="flex flex-1 gap-1"
                  role="img"
                  aria-label={`${occupees} place(s) occupée(s) sur ${total}`}
                >
                  {Array.from({ length: total }, (_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 flex-1 ${i < occupees ? 'bg-text-secondary' : 'bg-border'}`}
                    />
                  ))}
                </div>
                <span className="tnum font-mono text-[11px] uppercase tracking-wider text-text-secondary">
                  {occupees} sur {total}
                </span>
              </div>
              <p className="mt-3 max-w-xl text-[12px] leading-relaxed text-text-secondary">
                {pleines
                  ? 'Toutes les places sont prises. Une place se libère en suspendant un compte, ou s’ajoute en changeant de formule.'
                  : `Il reste ${total - occupees} place${total - occupees > 1 ? 's' : ''}. Une place est un compte qui travaille : un invité occasionnel n’en occupe pas.`}
              </p>
              {peutGerer && (
                <div className="mt-4">
                  {demandeEnCours ? (
                    /*
                      LA DEMANDE EN COURS — L'UNIQUE AMBRE DE L'ÉCRAN.

                      Elle s'écrivait en gris, à la même encre que la phrase
                      d'explication au-dessus : la seule chose EN SUSPENS de
                      l'écran avait exactement le poids du texte d'aide. On
                      redemandait donc une place déjà demandée, faute de voir
                      que la première était partie.

                      Ambre parce qu'une demande ouverte attend une réponse, et
                      qu'une attente qu'on ne voit pas se répète. La phrase en
                      dessous reste sobre : elle dit qui répond, pas qu'il faut
                      agir.
                    */
                    <div data-signal-groupe="place-demandee">
                      <p className="signal-plate inline-flex items-center gap-2 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider">
                        <MailQuestion size={13} strokeWidth={2} />
                        Une place de plus est demandée
                      </p>
                      <p className="mt-2.5 max-w-xl text-[12px] leading-relaxed text-text-secondary">
                        Votre prestataire a été prévenu — quelqu’un la lit. Aucun robot ne facture quoi
                        que ce soit.
                      </p>
                    </div>
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

        {/*
          LA RÈGLE D'ÉCRITURE SE DIT AUSSI À CELUI QUI L'A.

          Elle n'apparaissait qu'aux comptes SANS droit de gestion — donc
          jamais à la personne qui peut retirer quelqu'un de l'organisation.
          Or c'est elle qui a besoin de savoir que la liste est lue par tous :
          suspendre un compte se voit, et mieux vaut le savoir avant.
        */}
        <StaggerItem>
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">
            <Users size={12} />
            Tout le monde lit cette liste ; seuls la propriétaire et les administrateurs la modifient.
          </p>
        </StaggerItem>
      </StaggerGroup>
    </section>
  );
}
