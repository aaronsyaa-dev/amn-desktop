import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MailQuestion, UserPlus } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { MembersSection } from '../components/settings/MembersSection';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { UserAvatar } from '../components/UserAvatar';
import { EcranVide, useHaloSignal } from '../components/EtatEcran';
import { bridge } from '../lib/bridge';
import { useAuth } from '../auth/AuthContext';
import { isAdminRole } from '../auth/roles';
import { roleLabel } from '../lib/roleLabels';
import { cleanErrorMessage } from '../lib/errorMessage';
import { useProfiles } from '../state/ProfilesContext';
import { NAV_SECTIONS } from '../data/navigation';
import type { OrgMember, SupportRequest } from '../shared/api';

/*
  ═══════════════════════════════════════════════════════════════════════
  LES PLACES — et pourquoi la place VIDE est dessinée comme les autres
  ═══════════════════════════════════════════════════════════════════════

  Un tableau de comptes avec un bouton « inviter » ne dit pas ce qui est PAYÉ
  ET NON UTILISÉ. Il montre ce qui existe, et le vide n'y a pas de forme : une
  formule à trois places dont deux servent ressemble exactement à une formule
  à deux places, et personne ne s'aperçoit qu'il paie un siège inoccupé.

  Les places sont donc dessinées TOUTES, la vide comprise, au même format :
  un médaillon, un nom, un rôle, et ce à quoi la place donne accès. La place
  libre porte un cadre en pointillé, la mention qu'elle est comprise dans
  l'abonnement, et depuis quand elle l'est.

  ELLE N'A PAS D'ACTION PRIMAIRE. Inviter quelqu'un est un geste d'en-tête,
  pas la conséquence d'un trou dans une grille : on n'invite pas une personne
  parce qu'il reste un siège.
*/
const MEDAILLON = 44;

/** Une place = un compte qui travaille. Même règle qu'amn-api (`countsAsSeat`). */
function occupeUnePlace(m: OrgMember): boolean {
  return m.role !== 'guest' && (m.status === 'active' || m.status === 'invited');
}

/** La propriétaire d'abord, puis les administrateurs, puis le reste. */
const RANG: Record<string, number> = { owner: 0, admin: 1, member: 2, guest: 3 };

/**
 * MEMBRES — les places de la formule, la vide comprise (`26e`)
 *
 * Pour qui : celle qui paie l'abonnement, et qui doit voir d'un coup ce
 * qu'elle paie. Le Trombinoscope montre les mêmes personnes AU TRAVAIL ;
 * cet écran-ci montre les COMPTES et ce qu'ils coûtent.
 *
 * ## L'ambre : le compte propriétaire
 *
 * Trois nœuds dans une seule place — son médaillon, son rôle, le détail de
 * ses accès. C'est le seul compte qui peut donner ou retirer une place :
 * l'écran ne se contente pas de l'écrire, il le montre.
 *
 * ## Deux écarts assumés avec le paquet de design
 *
 * 1. `MODULES.md` dit « les cinq personnes du trombinoscope ne sont pas cinq
 *    comptes ». Dans CE produit, si : le Trombinoscope lit exactement la même
 *    liste de membres que cet écran (`useMembers` → `members.list()`). Il
 *    n'existe pas de fiche de personne sans compte. La phrase du pied dit
 *    donc la vérité du produit plutôt que celle de la maquette.
 *
 * 2. « Les familles auxquelles cette place donne accès » : les modules
 *    ouverts le sont PAR ORGANISATION, pas par place — `ModuleRoute` lit la
 *    formule, jamais le rôle. Toutes les places voient donc les mêmes
 *    familles. Ce qui diffère réellement, et que l'écran nomme : Personnel
 *    n'est jamais partagé (chaque compte a le sien, sur son poste), et les
 *    gestes de Système sont réservés à la propriétaire et aux
 *    administrateurs. Annoncer un accès par place que le produit n'applique
 *    pas aurait été un mensonge d'écran.
 */
export function MembersScreen() {
  const { org, role, user } = useAuth();
  const { profileFor } = useProfiles();
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

  const occupants = useMemo(
    () => (membres ?? []).filter(occupeUnePlace).sort((a, b) => (RANG[a.role] ?? 9) - (RANG[b.role] ?? 9)),
    [membres],
  );
  const occupees = occupants.length;
  const libres = total === null ? 0 : Math.max(0, total - occupees);
  const pleines = total !== null && libres === 0;
  const demandeEnCours = demandes.find((d) => d.kind === 'seat' && d.status === 'pending');

  /*
    DEPUIS QUAND LA PLACE EST-ELLE LIBRE ?

    La date de la DERNIÈRE arrivée : après elle, plus personne n'est venu
    occuper le siège. C'est une date relue, pas un chiffre écrit à la main —
    et quand aucune arrivée n'est datée, l'écran le dit au lieu d'inventer
    une ancienneté.
  */
  const derniereArrivee = useMemo(() => {
    const dates = occupants.map((m) => m.joinedAt ?? m.invitedAt).filter((d): d is string => Boolean(d)).sort();
    return dates.length > 0 ? dates[dates.length - 1] : null;
  }, [occupants]);

  const moisDepuis = (iso: string) => {
    const d = new Date(iso);
    const maintenant = new Date();
    return Math.max(0, (maintenant.getFullYear() - d.getFullYear()) * 12 + (maintenant.getMonth() - d.getMonth()));
  };

  /* Les familles réellement ouvertes à cette organisation — la MÊME source
     que la barre latérale, jamais une liste recopiée ici. */
  const familles = useMemo(() => NAV_SECTIONS.map((s) => s.label), []);
  const partagees = useMemo(() => familles.filter((f) => f !== 'Personnel' && f !== 'Système'), [familles]);

  const vide = membres !== null && occupants.length === 0;
  const halo = useHaloSignal(occupants.some((m) => m.role === 'owner'));

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

  /** Une place prise. L'ambre n'appartient qu'à la propriétaire. */
  const PlacePrise = ({ m }: { m: OrgMember }) => {
    const ambre = m.role === 'owner';
    const nom = profileFor(m.email).name || m.email;
    return (
      <li
        data-signal-groupe={ambre ? 'place-proprietaire' : undefined}
        className={`flex flex-col gap-3 p-4 ${ambre ? 'border border-signal-line bg-signal-muted' : 'panel'}`}
      >
        <div className="flex items-center gap-3">
          <span data-signal-groupe={ambre ? 'place-proprietaire' : undefined}>
            <UserAvatar email={m.email} size={MEDAILLON} surAmbre={ambre} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold leading-tight text-text-primary">{nom}</p>
            <p
              data-signal-groupe={ambre ? 'place-proprietaire' : undefined}
              className={`mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${ambre ? 'text-signal' : 'text-text-muted'}`}
            >
              {roleLabel(m.role, null)}
            </p>
          </div>
        </div>
        <p className="border-t border-border pt-2.5 text-[12px] leading-relaxed text-text-secondary">
          {ambre
            ? `Ouvre les ${partagees.length} familles partagées, et c’est le seul compte qui donne ou retire une place.`
            : `Ouvre les ${partagees.length} familles partagées. Son Personnel reste sur son poste.`}
        </p>
      </li>
    );
  };

  /** La place libre : même format, aucune action. */
  const PlaceLibre = ({ rang }: { rang: number }) => (
    <li className="flex flex-col gap-3 border border-dashed border-border p-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex flex-shrink-0 items-center justify-center rounded-full border border-dashed border-border"
          style={{ width: MEDAILLON, height: MEDAILLON }}
        />
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold leading-tight text-text-muted">Place libre</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
            Comprise dans l’abonnement
          </p>
        </div>
      </div>
      <p className="border-t border-border pt-2.5 text-[12px] leading-relaxed text-text-muted">
        {/* « il y a 0 mois » ne veut rien dire : sous le mois, on dit le mois. */}
        {rang === 0 && derniereArrivee
          ? moisDepuis(derniereArrivee) >= 1
            ? `Libre depuis la dernière arrivée, il y a ${moisDepuis(derniereArrivee)} mois. Elle est payée avec la formule.`
            : 'Libre depuis la dernière arrivée, ce mois-ci. Elle est payée avec la formule.'
          : 'Payée avec la formule, qu’elle serve ou non.'}
      </p>
    </li>
  );

  return (
    <EcranVide quand={vide}>
      <section className="flex flex-col">
        <ScreenHeader
          eyebrow="Système · Membres"
          title="Membres"
          description="Les places de votre formule, la vide comprise — et ce que chacune ouvre."
          stats={[
            {
              label: 'Places prises',
              value: membres === null ? '…' : total === null ? occupees : `${occupees} / ${total}`,
              title: 'Une place = un compte actif ou invité. Un compte suspendu libère la sienne.',
            },
            ...(total !== null && libres > 0
              ? [{ label: 'Place(s) libre(s)', value: libres, title: 'Payées avec la formule, qu’elles servent ou non.' }]
              : []),
          ]}
          actions={
            peutGerer && !pleines ? (
              <a
                href="#membres-gestion"
                className="flex min-h-11 items-center gap-2 border border-border-strong bg-surface px-4 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover md:min-h-0 md:py-2"
              >
                <UserPlus size={15} strokeWidth={1.9} /> Inviter
              </a>
            ) : undefined
          }
        />

        <StaggerGroup className="mt-6 flex flex-col gap-4">
          {membres === null && !erreur && (
            <StaggerItem>
              <p className="flex items-center gap-2 text-xs text-text-muted">
                <Loader2 size={13} className="animate-spin" /> Lecture…
              </p>
            </StaggerItem>
          )}

          {/* ═══ L'OBJET DOMINANT : les places, toutes dessinées ═══ */}
          {/* `seats === null` : une organisation sans limite de places (c'est le
              cas d'AMN DevSec elle-même, voir seatsForOrg côté serveur). On
              dessine alors les places PRISES et aucune place vide — inventer
              un siège libre là où il n'y a pas de plafond serait faux. */}
          {membres !== null && (
            <StaggerItem>
              <section className={`panel-raised p-5 sm:p-6 ${halo}`}>
                <p className="eyebrow mb-4">
                  {total === null ? 'Les comptes de votre organisation' : 'Les places de votre formule'}
                </p>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {occupants.map((m) => (
                    <PlacePrise key={m.id} m={m} />
                  ))}
                  {Array.from({ length: libres }, (_, i) => (
                    <PlaceLibre key={`libre-${i}`} rang={i} />
                  ))}
                </ul>

                {/* SOUS LES PLACES — la clarification, et rien d'autre. */}
                <p className="mt-4 max-w-prose border-t border-border-strong pt-3 text-sm leading-relaxed text-text-body">
                  {total === null
                    ? `Cette organisation n’a pas de plafond de places : ${occupees} compte${occupees > 1 ? 's' : ''} y travaillent, et rien ne les limite. Le Trombinoscope montre exactement les mêmes — dans ce produit, il n’existe pas de fiche de personne sans compte.`
                    : `Ces ${occupees} place${occupees > 1 ? 's' : ''} sont ${occupees} compte${occupees > 1 ? 's' : ''}. Le Trombinoscope montre exactement les mêmes : dans ce produit, il n’existe pas de fiche de personne sans compte.`}
                </p>

                {peutGerer && demandeEnCours && (
                  <p className="mt-3 max-w-prose text-[12px] leading-relaxed text-text-secondary">
                    Une place de plus est déjà demandée. Votre prestataire a été prévenu — quelqu’un la lit,
                    aucun robot ne facture quoi que ce soit.
                  </p>
                )}
                {peutGerer && !demandeEnCours && pleines && (
                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={envoi}
                      onClick={() => void demanderUnePlace()}
                      className="flex min-h-11 items-center gap-2 border border-border-strong bg-surface px-3 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-40 md:min-h-0 md:py-2"
                    >
                      {envoi ? <Loader2 size={13} className="animate-spin" /> : <MailQuestion size={13} />}
                      Demander une place de plus
                    </button>
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
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* À GAUCHE — ce que voit une place, famille par famille. */}
              <section className="panel p-4">
                <p className="eyebrow mb-3">Ce que voit une place</p>
                <ul className="flex flex-col gap-px bg-border">
                  {NAV_SECTIONS.map((s) => {
                    const jamaisPartagee = s.label === 'Personnel';
                    const gestesReserves = s.label === 'Système';
                    return (
                      <li key={s.key} className="flex items-baseline justify-between gap-3 bg-surface px-3 py-2">
                        <span className="min-w-0 truncate text-sm text-text-primary">{s.label}</span>
                        <span className="flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                          {jamaisPartagee
                            ? 'Jamais partagée'
                            : gestesReserves
                              ? 'Gestes réservés'
                              : `${s.items.length} modules, pour tous`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 max-w-prose text-[12px] leading-relaxed text-text-muted">
                  Les modules sont ouverts par organisation, pas par place : toutes les places voient les mêmes
                  familles. Ce qui diffère est ici — Personnel reste sur le poste de chacun, et les gestes de
                  Système demandent le rôle de propriétaire ou d’administrateur.
                </p>
              </section>

              {/* À DROITE — la place inutilisée, dite sans détour. */}
              <aside className="panel p-4">
                <p className="eyebrow mb-3">La formule</p>
                <dl className="flex flex-col gap-2.5">
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {total === null ? 'Plafond de places' : 'Places payées'}
                    </dt>
                    <dd className="text-[19px] font-semibold tabular-nums leading-tight text-text-primary">
                      {total ?? 'Aucun'}
                    </dd>
                  </div>
                  {libres > 0 && (
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        Payée(s) et inutilisée(s)
                      </dt>
                      <dd className="text-[19px] font-semibold tabular-nums leading-tight text-text-primary">{libres}</dd>
                    </div>
                  )}
                </dl>
                <p className="mt-3 border-t border-border pt-3 text-[12px] leading-relaxed text-text-secondary">
                  {total === null
                    ? 'Cette organisation n’est pas facturée à la place : il n’y a ni siège payé d’avance, ni siège à libérer.'
                    : libres > 0
                    ? 'Il n’existe pas de formule à la place près : une place libre n’est pas une erreur de facturation, c’est de la marge d’embauche. Elle se garde ou se change en changeant de formule.'
                    : 'Toutes les places servent. Une place se libère en suspendant un compte, ou s’ajoute en changeant de formule.'}
                </p>
              </aside>
            </div>
          </StaggerItem>

          {/* LA GESTION — la liste réelle, les invitations, les rôles. */}
          <StaggerItem>
            <div id="membres-gestion">
              <MembersSection onChange={charger} />
            </div>
          </StaggerItem>

          <StaggerItem>
            <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
              {user ? 'Tout le monde lit cette liste ; seuls la propriétaire et les administrateurs la modifient.' : ''}
            </p>
          </StaggerItem>
        </StaggerGroup>
      </section>
    </EcranVide>
  );
}
