import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Loader2, ShieldCheck, UserMinus, UserPlus, Users } from 'lucide-react';
import { bridge } from '../../lib/bridge';
import { isAdminRole } from '../../auth/roles';
import { useAuth } from '../../auth/AuthContext';
import { roleLabel, assignableRoles } from '../../lib/roleLabels';
import { cleanErrorMessage } from '../../lib/errorMessage';
import type { MemberInvitation, OrgMember, UserRole } from '../../shared/api';
import { SettingsPanel as Panel } from '../SettingsPanel';
import { useLangue } from '../../i18n';

/**
 * QUI TRAVAILLE ICI, ET AVEC QUELS DROITS (BLOCS 6 ET 7)
 * ══════════════════════════════════════════════════════
 *
 * Tout le monde lit cette liste ; seuls `owner` et `admin` la modifient. C'est
 * le serveur qui tranche — les routes refusent d'elles-mêmes — et l'écran se
 * contente de ne pas proposer un geste voué au refus.
 *
 * ## Pourquoi cet écran manquait, et ce que ça coûtait
 *
 * Les routes existaient depuis longtemps côté amn-api (`GET /v1/auth/users`,
 * `POST /v1/auth/invitations`) et AUCUN écran ne les appelait. Conséquence
 * concrète : une organisation cliente devait nous écrire pour ajouter
 * quelqu'un chez elle. À vingt-six comptes, ça n'est plus un service, c'est un
 * goulot.
 *
 * ## Le lien d'invitation, et pourquoi il s'affiche en clair
 *
 * amn-api n'a AUCUN transport mail — c'est un choix assumé de son côté, écrit
 * dans le code : « inventing one here would be worse ». Le lien est donc rendu
 * une seule fois, à copier et à transmettre soi-même.
 *
 * Il n'est pas récupérable ensuite : le serveur n'en garde que l'empreinte. Si
 * on le perd, on réémet — d'où le bandeau qui insiste, et le bouton Copier
 * plutôt qu'une simple sélection de texte.
 *
 * La personne invitée choisit SON mot de passe sur l'écran d'activation. On
 * n'en fabrique jamais un à sa place : un mot de passe qu'on dicte est un mot
 * de passe connu de deux personnes.
 *
 * ## Ce que l'écran ne fait pas
 *
 * Il ne supprime pas de compte. Retirer quelqu'un est un geste plus lourd,
 * qui vit dans la console d'AMN DevSec avec sa protection du dernier
 * propriétaire ; le suspendre suffit à lui couper l'accès à l'instant, et se
 * défait.
 */
export function MembersSection({ onChange }: { onChange?: () => void } = {}) {
  const { role, user } = useAuth();
  const [membres, setMembres] = useState<OrgMember[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  // Le retrait demande une confirmation POSÉE : la question, la conséquence
  // (sessions fermées, place libérée, données conservées), puis le geste.
  const [aRetirer, setARetirer] = useState<OrgMember | null>(null);
  const [retire, setRetire] = useState<string | null>(null);
  const { t } = useLangue();

  const [ouvrirInvitation, setOuvrirInvitation] = useState(false);
  const [email, setEmail] = useState('');
  const [roleInvite, setRoleInvite] = useState<UserRole>('member');
  const [invitation, setInvitation] = useState<MemberInvitation | null>(null);
  const [copie, setCopie] = useState(false);

  // Le serveur reste seul juge ; l'écran évite seulement de proposer un geste
  // qu'il refusera. `role` vient de la session revalidée (voir auth/session.ts).
  const peutGerer = isAdminRole(role);
  const trade = null; // les libellés métier suivent l'organisation ; non exposé ici

  const charger = useCallback(async () => {
    try {
      setMembres(await bridge().remote.members.list());
    } catch (err) {
      setErreur(cleanErrorMessage(err, 'La liste des membres n’a pas pu être lue.'));
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const changerRole = async (membre: OrgMember, suivant: UserRole) => {
    setEnCours(membre.id);
    setErreur(null);
    try {
      const maj = await bridge().remote.members.setRole(membre.id, suivant);
      setMembres((prev) => (prev ? prev.map((m) => (m.id === maj.id ? maj : m)) : prev));
    } catch (err) {
      // Le message du serveur est la réponse — « Seul un propriétaire peut
      // nommer ou retirer un propriétaire. » dit exactement ce qu'il faut.
      setErreur(cleanErrorMessage(err, 'Changement de rôle refusé.'));
    } finally {
      setEnCours(null);
    }
  };

  const retirer = async (membre: OrgMember) => {
    setEnCours(membre.id);
    setErreur(null);
    try {
      await bridge().remote.members.remove(membre.id);
      setARetirer(null);
      setRetire(membre.email);
      await charger();
      onChange?.();
    } catch (err) {
      setErreur(cleanErrorMessage(err, 'Le compte n’a pas pu être retiré.'));
    } finally {
      setEnCours(null);
    }
  };

  const changerStatut = async (membre: OrgMember) => {
    const suivant = membre.status === 'suspended' ? 'active' : 'suspended';
    setEnCours(membre.id);
    setErreur(null);
    try {
      const maj = await bridge().remote.members.setStatus(membre.id, suivant);
      setMembres((prev) => (prev ? prev.map((m) => (m.id === maj.id ? maj : m)) : prev));
      onChange?.();
    } catch (err) {
      setErreur(cleanErrorMessage(err, 'Changement de statut refusé.'));
    } finally {
      setEnCours(null);
    }
  };

  const inviter = async () => {
    const adresse = email.trim().toLowerCase();
    setEnCours('invitation');
    setErreur(null);
    try {
      const res = await bridge().remote.members.invite({ email: adresse, role: roleInvite });
      setInvitation(res);
      setEmail('');
      setOuvrirInvitation(false);
      void charger();
      onChange?.();
    } catch (err) {
      setErreur(cleanErrorMessage(err, 'L’invitation n’a pas pu être émise.'));
    } finally {
      setEnCours(null);
    }
  };

  const copier = async (texte: string) => {
    try {
      await navigator.clipboard?.writeText(texte);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2200);
    } catch {
      /* presse-papiers refusé : le texte reste sélectionnable à la main. */
    }
  };

  const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  return (
    <Panel
      icon={Users}
      title="Membres"
      subtitle="Qui travaille dans cette organisation, et avec quels droits."
    >
      {erreur && (
        <p className="mb-3 border border-warning/40 bg-warning-muted px-3 py-2 text-xs leading-relaxed text-text-primary">
          {erreur}
        </p>
      )}

      {membres === null && !erreur && (
        <p className="flex items-center gap-2 text-xs text-text-muted">
          <Loader2 size={13} className="animate-spin" />
          Lecture des membres…
        </p>
      )}

      {membres !== null && (
        <>
          <ul className="flex flex-col gap-px bg-border">
            {membres.map((m) => {
              const moi = m.email === user?.email;
              const suspendu = m.status === 'suspended';
              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 bg-surface px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text-primary">
                      {m.email}
                      {moi && <span className="ml-2 text-[11px] text-text-muted">(vous)</span>}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {roleLabel(m.role, trade)}
                      {m.status === 'invited' && ' · jamais entré'}
                      {suspendu && ' · suspendu'}
                    </p>
                  </div>

                  {/* Ni son propre rôle ni celui d'un invité qui n'est jamais
                      entré : le serveur refuse le premier, et le second n'a pas
                      encore de compte à gouverner. */}
                  {peutGerer && !moi ? (
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      <label className="sr-only" htmlFor={`role-${m.id}`}>
                        Rôle de {m.email}
                      </label>
                      <select
                        id={`role-${m.id}`}
                        value={m.role}
                        disabled={enCours !== null || m.role === 'guest'}
                        onChange={(e) => void changerRole(m, e.target.value as UserRole)}
                        className="input-focus min-h-11 border border-border bg-bg px-2 text-xs text-text-primary outline-none disabled:opacity-40 md:min-h-0 md:py-1.5"
                      >
                        {assignableRoles(trade).map((r) => (
                          <option key={r.role} value={r.role}>
                            {r.label}
                          </option>
                        ))}
                        {m.role === 'guest' && <option value="guest">Invité</option>}
                      </select>
                      <button
                        type="button"
                        disabled={enCours !== null}
                        onClick={() => void changerStatut(m)}
                        title={suspendu ? 'Réactiver ce compte' : 'Suspendre ce compte'}
                        className="flex min-h-11 items-center border border-border px-2.5 font-mono text-[10px] uppercase tracking-wider text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-40 md:min-h-0 md:py-2"
                      >
                        {enCours === m.id ? '…' : suspendu ? 'Réactiver' : 'Suspendre'}
                      </button>
                      <button
                        type="button"
                        disabled={enCours !== null}
                        onClick={() => setARetirer(m)}
                        title={t('membres.retirerTitre')}
                        className="flex min-h-11 items-center gap-1 border border-border px-2.5 font-mono text-[10px] uppercase tracking-wider text-text-secondary transition-colors hover:border-danger/60 hover:text-danger disabled:opacity-40 md:min-h-0 md:py-2"
                      >
                        <UserMinus size={12} strokeWidth={2} />
                        {t('membres.retirer')}
                      </button>
                    </div>
                  ) : (
                    <span className="flex flex-shrink-0 items-center gap-1.5 text-[11px] text-text-muted">
                      {!peutGerer && <ShieldCheck size={12} />}
                      {!peutGerer ? 'lecture seule' : ''}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {aRetirer && (
            <div role="alertdialog" aria-labelledby="retirer-titre" className="border border-border-strong bg-bg px-4 py-3">
              <p id="retirer-titre" className="text-sm font-medium text-text-primary">
                {t('membres.retirerQuestion', { email: aRetirer.email })}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">{t('membres.retirerConsequence')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={enCours !== null}
                  onClick={() => void retirer(aRetirer)}
                  className="flex min-h-11 items-center gap-1.5 border border-danger/60 px-3 text-xs text-danger transition-colors hover:bg-danger-muted disabled:opacity-40 md:min-h-0 md:py-2"
                >
                  {enCours === aRetirer.id ? <Loader2 size={13} className="animate-spin" /> : <UserMinus size={13} />}
                  {t('membres.retirerConfirmer')}
                </button>
                <button
                  type="button"
                  disabled={enCours !== null}
                  onClick={() => setARetirer(null)}
                  className="flex min-h-11 items-center border border-border px-3 text-xs text-text-secondary transition-colors hover:text-text-primary md:min-h-0 md:py-2"
                >
                  {t('membres.retirerGarder')}
                </button>
              </div>
            </div>
          )}
          {retire && !aRetirer && (
            <p role="status" className="text-xs text-text-secondary">
              {t('membres.retirerFait', { email: retire })}
            </p>
          )}

          {peutGerer && (
            <div className="mt-4">
              {!ouvrirInvitation ? (
                <button
                  type="button"
                  onClick={() => setOuvrirInvitation(true)}
                  className="flex min-h-11 items-center gap-2 border border-border-strong bg-surface px-3 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover md:min-h-0 md:py-2"
                >
                  <UserPlus size={14} />
                  Inviter un membre
                </button>
              ) : (
                <div className="border border-border bg-bg p-3">
                  <p className="eyebrow mb-2">Inviter un membre</p>
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      inputMode="email"
                      autoComplete="off"
                      placeholder="adresse@exemple.fr"
                      className="input-focus min-h-11 min-w-[13rem] flex-1 border border-border bg-surface px-3 text-sm text-text-primary outline-none placeholder:text-text-muted md:min-h-0 md:py-2"
                    />
                    <label className="sr-only" htmlFor="role-invitation">
                      Rôle initial
                    </label>
                    <select
                      id="role-invitation"
                      value={roleInvite}
                      onChange={(e) => setRoleInvite(e.target.value as UserRole)}
                      className="input-focus min-h-11 border border-border bg-surface px-2 text-xs text-text-primary outline-none md:min-h-0 md:py-2"
                    >
                      {assignableRoles(trade).map((r) => (
                        <option key={r.role} value={r.role}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!emailValide || enCours !== null}
                      onClick={() => void inviter()}
                      className="flex min-h-11 items-center gap-2 border border-border-strong bg-surface px-3 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-40 md:min-h-0 md:py-2"
                    >
                      {enCours === 'invitation' ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                      Émettre le lien
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOuvrirInvitation(false); setEmail(''); }}
                      className="min-h-11 px-2 text-xs text-text-muted transition-colors hover:text-text-primary md:min-h-0"
                    >
                      Annuler
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
                    Un lien d’activation est créé&nbsp;: transmettez-le vous-même. La personne
                    choisit son propre mot de passe — vous n’en fabriquez jamais un à sa place.
                  </p>
                </div>
              )}
            </div>
          )}

          {invitation && (
            <div className="mt-3 border border-border bg-surface px-3 py-2.5">
              <p className="text-xs leading-relaxed text-text-primary">
                Invitation émise pour{' '}
                <span className="font-mono text-[11px]">{invitation.user.email}</span>.{' '}
                Envoyez-lui ce lien —{' '}
                <span className="text-text-muted">il ne sera plus affiché.</span>
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto border border-border bg-bg px-2 py-1.5 font-mono text-[11px] text-text-primary">
                  {invitation.invitation.url ?? invitation.invitation.token}
                </code>
                <button
                  type="button"
                  onClick={() => void copier(invitation.invitation.url ?? invitation.invitation.token)}
                  className="flex min-h-11 flex-shrink-0 items-center gap-1.5 border border-border-strong px-2.5 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors hover:bg-surface-hover md:min-h-0 md:py-1.5"
                >
                  {copie ? <Check size={12} /> : <Copy size={12} />}
                  {copie ? 'Copié' : 'Copier'}
                </button>
              </div>
              {/* Sans adresse publique configurée, le serveur ne rend qu'un
                  jeton — qui ne se colle nulle part tel quel. Le dire vaut
                  mieux que laisser copier quelque chose d'inutilisable. */}
              {!invitation.invitation.url && (
                <p className="mt-2 text-[11px] leading-relaxed text-warning">
                  Aucune adresse publique n’est configurée sur le serveur : seul le jeton est
                  disponible, et il ne s’ouvre pas tel quel dans un navigateur.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
