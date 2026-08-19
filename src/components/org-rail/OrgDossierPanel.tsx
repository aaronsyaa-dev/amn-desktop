import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Lock, ShieldAlert, X } from 'lucide-react';
import { useSync, useCollection } from '../../state/SyncContext';
import { bridge } from '../../lib/bridge';
import { cleanErrorMessage } from '../../lib/errorMessage';
import { SaveIndicator } from '../SaveIndicator';
import { ACCENTS, DEFAULT_ACCENT_ID } from '../../lib/accent';
import type { AdminOrganization, AdminOrgUser, OrgPulse } from '../../shared/api';
import { relativeTime } from '../../lib/time';

/**
 * Le dossier d'une organisation cliente, vu d'AMN DevSec (BLOC E).
 *
 * Deux choses qui n'existaient nulle part, réunies parce qu'elles répondent à
 * la même question — « où est-ce que je gère CETTE cliente » :
 *
 *   1. **Les modules qui lui sont ouverts.** Décidés par le serveur et
 *      appliqués par son application. Ce n'est PAS une frontière de sécurité :
 *      ça retire des écrans, l'isolation des données reste celle d'amn-api.
 *   2. **Nos notes internes sur elle** — contact, historique, particularités.
 *      Elles vivent dans le tenant d'AMN DevSec, avec l'id de la cliente comme
 *      identifiant d'enregistrement. Elles ne sont donc jamais dans SES
 *      données : l'isolation par organisation qui existe déjà suffit à ce
 *      qu'elle ne puisse pas les lire, sans règle supplémentaire à ne pas
 *      oublier.
 */

/**
 * Le nom d'un module tel qu'on le dit à voix haute.
 *
 * Le pouls rend des noms de COLLECTION (`invoices`, `timeEntries`) — le
 * vocabulaire de la base. Les afficher tels quels obligerait à traduire de tête
 * au moment exact où on cherche à comprendre un problème.
 */
const NOM_COLLECTION: Record<string, string> = {
  appointments: 'Agenda',
  clients: 'Clients',
  quotes: 'Devis',
  invoices: 'Facturation',
  billing: 'Identité de facturation',
  projects: 'Projets',
  projectConfig: 'Réglages des projets',
  tasks: 'Tâches',
  expenses: 'Dépenses',
  expenseConfig: 'Catégories de dépenses',
  timeEntries: 'Temps',
  timeConfig: 'Réglages du temps',
  orders: 'Commandes',
  notes: 'Notes',
  media: 'Médias',
  reports: 'Comptes-rendus',
  profiles: 'Profil',
};

function moduleLabel(collection: string): string {
  return NOM_COLLECTION[collection] ?? collection;
}

/** Les modules réglables. Doit rester aligné sur `ORG_MODULES` d'amn-api. */
const TOGGLEABLE: { key: string; label: string }[] = [
  { key: 'agenda', label: 'Agenda' },
  { key: 'clients', label: 'Clients' },
  { key: 'invoices', label: 'Facturation' },
  { key: 'projects', label: 'Projets' },
  { key: 'tasks', label: 'Tâches' },
  { key: 'expenses', label: 'Dépenses' },
  { key: 'time', label: 'Temps' },
  { key: 'notes', label: 'Notes' },
  { key: 'media', label: 'Médias' },
  { key: 'reports', label: 'Rapports' },
  { key: 'vault', label: 'Coffre-fort' },
];

interface DossierData {
  body: string;
  updatedBy: string;
}

export function OrgDossierPanel({
  org,
  onClose,
  onSaved,
}: {
  org: AdminOrganization;
  onClose: () => void;
  onSaved: () => void;
}) {
  /*
    Le pouls de l'organisation — chargé à l'ouverture du dossier, pas avant.

    Une seule requête, et elle ne rend que des comptes et des dates. Un échec
    n'est pas traité comme une panne du dossier : le reste du panneau (modules,
    notes) marche sans lui, et un dossier qui refuserait de s'ouvrir parce
    qu'un chiffre manque serait un mauvais échange.
  */
  const [pulse, setPulse] = useState<OrgPulse | null>(null);

  /*
    LA SUPPRESSION — dans le dossier, pas sur la carte.

    Elle aurait pu vivre à côté de « Suspendre », dans le registre. Elle n'y est
    pas, et c'est délibéré : à cet endroit, détruire l'espace d'une cliente
    serait à un clic de le suspendre, entre deux lignes qui se ressemblent.
    Ici, il faut avoir OUVERT son dossier — donc avoir vu ce qu'il contient,
    combien de comptes, combien d'enregistrements, quand elle a travaillé pour
    la dernière fois — avant que le geste soit seulement proposé.

    Le nom recopié n'est pas une politesse d'interface : le serveur le
    revérifie. L'écran empêche le clic distrait ; le serveur empêche le reste
    — un appel scripté, un identifiant recopié depuis la mauvaise ligne.
  */
  /*
    LES COMPTES DE L'ORGANISATION — le cycle de vie qui s'arrêtait au milieu.

    On savait inviter et réémettre un mot de passe. On ne savait pas retirer,
    alors que c'est le geste réel : un employé part de chez la cliente, ou un
    compte a été créé par erreur. Il fallait donc laisser un accès ouvert, ou
    demander à la cliente de s'en occuper elle-même — ce qui est précisément ce
    qu'une supervision doit lui épargner.
  */
  const [comptes, setComptes] = useState<AdminOrgUser[] | null>(null);
  const [compteEnCours, setCompteEnCours] = useState<string | null>(null);
  const [nouvelEmail, setNouvelEmail] = useState('');
  const [ouverture, setOuverture] = useState(false);
  /**
   * Le lien d'activation du dernier compte ouvert, rendu UNE fois.
   *
   * Il n'est pas stocké côté serveur — seule son empreinte l'est — donc il ne
   * peut plus être retrouvé après. L'afficher tout de suite, en clair, avec de
   * quoi le copier, est la seule façon qu'il serve à quelque chose.
   */
  const [lienOuvert, setLienOuvert] = useState<{ email: string; url: string | null; token: string } | null>(
    null,
  );

  const chargerComptes = useCallback(() => {
    void bridge()
      .remote.admin.listUsers(org.id)
      .then(setComptes)
      .catch(() => setComptes([]));
  }, [org.id]);
  useEffect(chargerComptes, [chargerComptes]);

  const [confirmation, setConfirmation] = useState('');
  const [suppression, setSuppression] = useState(false);
  const nomExact = confirmation.trim() === org.name.trim();

  const { upsert } = useSync();
  const dossiers = useCollection<DossierData>('orgDossier');
  const existing = dossiers.find((d) => d.id === org.id);

  const [notes, setNotes] = useState(existing?.body ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingModule, setPendingModule] = useState<string | null>(null);

  // `null` en base = tous les modules. On matérialise la liste pour l'affichage
  // seulement : enregistrer « tout coché » écrirait une liste explicite, ce qui
  // figerait cette organisation sur le catalogue d'aujourd'hui.
  const enabled = useMemo(
    () => (org.modules === null || org.modules === undefined ? null : new Set(org.modules)),
    [org.modules],
  );
  const isOn = (key: string) => (enabled === null ? true : enabled.has(key));

  /*
    Le champ se recale quand on change D'ORGANISATION, jamais quand le contenu
    distant bouge : se resynchroniser à chaque écriture de l'autre opérateur
    écraserait la phrase qu'on est en train de taper.

    `existing` est donc lu à travers une référence plutôt que mis en dépendance
    — même intention qu'un tableau de dépendances réduit, mais sans désactiver
    de règle de lint.
  */
  const latestBody = useRef(existing?.body ?? '');
  latestBody.current = existing?.body ?? '';
  useEffect(() => {
    setNotes(latestBody.current);
  }, [org.id]);

  const applyOrgAccent = async (accent: string) => {
    setError(null);
    try {
      await bridge().remote.admin.updateOrganization(org.id, { accent });
      onSaved();
    } catch (err) {
      setError(cleanErrorMessage(err, 'amn-api a refusé la couleur.'));
    }
  };

  const toggle = async (key: string) => {
    setError(null);
    setPendingModule(key);
    try {
      const base = enabled === null ? new Set(TOGGLEABLE.map((m) => m.key)) : new Set(enabled);
      if (base.has(key)) base.delete(key);
      else base.add(key);
      await bridge().remote.admin.updateOrganization(org.id, { modules: [...base] });
      onSaved();
    } catch (err) {
      setError(cleanErrorMessage(err, 'amn-api a refusé la modification.'));
    } finally {
      setPendingModule(null);
    }
  };

  const saveNotes = () => {
    setSavingNotes(true);
    upsert('orgDossier', org.id, { body: notes, updatedBy: '' } satisfies DossierData);
    window.setTimeout(() => setSavingNotes(false), 400);
  };

  useEffect(() => {
    let vivant = true;
    void bridge()
      .remote.admin.organizationPulse(org.id)
      .then((p) => vivant && setPulse(p))
      .catch(() => {
        /* le dossier vaut d'être ouvert même sans ses chiffres */
      });
    return () => {
      vivant = false;
    };
  }, [org.id]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="relative flex max-h-[88vh] w-full max-w-lg flex-col border border-border-strong bg-surface"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-text-primary">{org.name}</h2>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-muted">
              Dossier interne · non visible chez elle
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-text-secondary hover:text-text-primary"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {error && (
            <p className="mb-3 border border-danger/50 bg-danger-muted px-3 py-2 text-xs text-text-primary">
              {error}
            </p>
          )}

          {/* ------------------------------------------- ce qui a bougé ---- */}
          {/*
            EN PREMIER, ET C'EST VOULU.

            Quand on ouvre ce dossier, c'est presque toujours parce qu'elle
            vient de signaler quelque chose. La première chose à voir est donc
            l'état de son espace, pas la liste de ses modules — celle-ci se
            règle une fois à la création et ne se relit qu'ensuite.
          */}
          {pulse && (
            <>
              <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Ce qui a bougé chez elle
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                Des comptes et des dates, jamais le contenu.{' '}
                <span className="text-text-muted">
                  De quoi situer un problème sans ouvrir de session de support — qui, elle,
                  s’inscrit à son journal d’accès.
                </span>
              </p>

              <div className="mt-3 border border-border">
                <div className="flex items-baseline justify-between gap-3 border-b border-border px-3 py-2">
                  <span className="text-xs text-text-secondary">Dernière écriture</span>
                  <span className="font-mono text-[11px] text-text-primary">
                    {pulse.records.lastAt ? relativeTime(pulse.records.lastAt) : 'jamais'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-b border-border px-3 py-2">
                  <span className="text-xs text-text-secondary">Jours actifs sur 30</span>
                  <span className="font-mono text-[11px] text-text-primary">
                    {pulse.activeDaysLast30}
                  </span>
                </div>

                {pulse.byCollection.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-text-muted">
                    Rien de saisi pour l’instant — son espace est encore vide.
                  </p>
                ) : (
                  pulse.byCollection.map((entry) => (
                    <div
                      key={entry.collection}
                      className="flex items-baseline justify-between gap-3 border-b border-border/60 px-3 py-2 last:border-b-0"
                    >
                      <span className="min-w-0 flex-1 truncate text-xs text-text-primary">
                        {moduleLabel(entry.collection)}
                      </span>
                      <span className="flex-shrink-0 font-mono text-[11px] text-text-secondary">
                        {entry.count}
                        {entry.last7Days ? ` · +${entry.last7Days} cette semaine` : ''}
                      </span>
                      <span className="flex-shrink-0 font-mono text-[10px] text-text-muted">
                        {entry.lastAt ? relativeTime(entry.lastAt) : '—'}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="my-5 border-t border-border" />
            </>
          )}

          {/* ------------------------------------------------- modules ----- */}
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Modules ouverts
          </p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Retire l’écran et sa navigation chez elle.{' '}
            <span className="text-text-muted">
              Ce n’est pas une barrière de sécurité : ses données restent isolées par organisation,
              comme celles de toutes les autres.
            </span>
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {TOGGLEABLE.map((module) => {
              const on = isOn(module.key);
              return (
                <button
                  key={module.key}
                  type="button"
                  disabled={pendingModule !== null}
                  onClick={() => void toggle(module.key)}
                  className={`flex min-h-11 items-center gap-2.5 border px-3 text-left text-sm transition-colors disabled:opacity-50 ${
                    on
                      ? 'border-border-strong text-text-primary'
                      : 'border-border text-text-muted'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 flex-shrink-0 items-center justify-center border ${
                      on ? 'border-accent bg-accent text-bg' : 'border-border'
                    }`}
                  >
                    {on && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="truncate">{module.label}</span>
                </button>
              );
            })}
          </div>

          {org.modules === null || org.modules === undefined ? (
            <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-text-muted">
              Aucun réglage : tous les modules du catalogue, y compris ceux à venir
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void bridge().remote.admin.updateOrganization(org.id, { modules: null }).then(onSaved)}
              className="mt-2 font-mono text-[9px] uppercase tracking-widest text-text-muted underline-offset-2 hover:text-text-secondary hover:underline"
            >
              Revenir à « tous les modules »
            </button>
          )}

          {/* -------------------------------------------------- accent ----- */}
          <div className="mt-6 border-t border-border pt-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Couleur d’accent
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              Un seul paramètre change — la structure noir et blanc reste.{' '}
              <span className="text-text-muted">
                Palette restreinte : chaque couleur est vérifiée lisible sur fond sombre.
              </span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ACCENTS.map((option) => {
                const on = (org.accent ?? DEFAULT_ACCENT_ID) === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => void applyOrgAccent(option.id)}
                    title={option.label}
                    aria-label={option.label}
                    className={`flex min-h-11 items-center gap-2 border px-2.5 transition-colors ${
                      on ? 'border-border-strong' : 'border-border hover:border-border-strong'
                    }`}
                  >
                    <span
                      className="h-4 w-4 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: option.value }}
                      aria-hidden
                    />
                    <span className="text-xs text-text-primary">{option.label}</span>
                    {on && <Check size={12} strokeWidth={3} className="text-text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ------------------------------------------------- dossier ----- */}
          <div className="mt-6 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                <Lock size={11} strokeWidth={2} />
                Notes internes
              </p>
              <SaveIndicator saved={!savingNotes && notes !== (existing?.body ?? '')} />
            </div>
            <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-text-secondary">
              <ShieldAlert size={13} strokeWidth={2} className="mt-0.5 flex-shrink-0 text-text-muted" />
              <span>
                Contact, historique, particularités. Conservées dans notre organisation, jamais dans
                la sienne — elle n’y a aucun accès, même en se connectant.
              </span>
            </p>
            <textarea
              rows={7}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              placeholder={
                'Interlocutrice principale, canal préféré…\n' +
                'Historique : migration, incidents, demandes en cours.\n' +
                'Particularités : facturation, délais, contraintes.'
              }
              className="input-focus mt-2 w-full resize-none border border-border bg-bg px-3 py-2 text-sm leading-relaxed text-text-primary outline-none"
            />
          </div>

          <div className="my-5 border-t border-border" />

          {/* ------------------------------------------------- comptes ----- */}
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Comptes de l’organisation
          </p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Retirer un compte coupe son accès à l’instant.{' '}
            <span className="text-text-muted">
              Ce qu’il a saisi reste chez elle : une fiche ou une facture appartient à
              l’organisation, pas à la personne qui l’a tapée.
            </span>
          </p>

          {/*
            OUVRIR UN COMPTE — le geste qui manquait.

            Aaron choisit un nombre de sièges à l'Atelier, puis n'avait aucun
            moyen de les remplir : la console savait réémettre un accès à un
            compte existant, jamais en ouvrir un. Ici il ouvre la porte ; la
            personne choisit sa clé en suivant le lien.
          */}
          <div className="mt-3 flex gap-2">
            <input
              value={nouvelEmail}
              onChange={(e) => setNouvelEmail(e.target.value)}
              inputMode="email"
              autoComplete="off"
              placeholder="adresse@sa-cliente.fr"
              className="input-focus min-w-0 flex-1 border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
            <button
              type="button"
              disabled={ouverture || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(nouvelEmail.trim())}
              onClick={() => {
                const email = nouvelEmail.trim().toLowerCase();
                setOuverture(true);
                setError(null);
                void bridge()
                  .remote.admin.createUser(org.id, { email, role: 'member' })
                  .then((res) => {
                    setNouvelEmail('');
                    setLienOuvert({ email, url: res.invitation.url, token: res.invitation.token });
                    chargerComptes();
                  })
                  .catch((err) => setError(cleanErrorMessage(err, 'Impossible d’ouvrir ce compte.')))
                  .finally(() => setOuverture(false));
              }}
              className="flex-shrink-0 border border-border-strong px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {ouverture ? '…' : 'Ouvrir'}
            </button>
          </div>

          {lienOuvert && (
            <div className="mt-2 border border-border bg-surface px-3 py-2">
              <p className="text-xs leading-relaxed text-text-primary">
                Compte ouvert pour{' '}
                <span className="font-mono text-[11px]">{lienOuvert.email}</span>. Envoyez-lui ce
                lien — <span className="text-text-muted">il ne sera plus affiché.</span>
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto border border-border bg-bg px-2 py-1.5 font-mono text-[11px] text-text-primary">
                  {lienOuvert.url ?? lienOuvert.token}
                </code>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(lienOuvert.url ?? lienOuvert.token)}
                  className="flex-shrink-0 border border-border-strong px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors hover:bg-surface-hover"
                >
                  Copier
                </button>
              </div>
              {!lienOuvert.url && (
                <p className="mt-2 text-[11px] leading-relaxed text-warning">
                  Aucune adresse d’application Business n’est configurée sur amn-api
                  (APP_BUSINESS_PUBLIC_URL) : seul le jeton est disponible, et il ne se colle nulle
                  part tel quel.
                </p>
              )}
            </div>
          )}

          <div className="mt-3 border border-border">
            {comptes === null ? (
              <p className="px-3 py-3 text-xs text-text-muted">Chargement…</p>
            ) : comptes.length === 0 ? (
              <p className="px-3 py-3 text-xs text-text-muted">Aucun compte.</p>
            ) : (
              comptes.map((compte) => {
                // Le dernier propriétaire actif est protégé côté serveur ; on
                // évite de proposer ici un geste qu'il refusera de toute façon.
                const dernierProprietaire =
                  compte.role === 'owner' &&
                  comptes.filter((c) => c.role === 'owner' && c.status !== 'suspended').length <= 1;
                return (
                  <div
                    key={compte.id}
                    className="flex items-center gap-2 border-b border-border/60 px-3 py-2 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-text-primary">{compte.email}</p>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        {compte.role}
                        {compte.status !== 'active' ? ` · ${compte.status}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={dernierProprietaire || compteEnCours !== null}
                      title={
                        dernierProprietaire
                          ? 'Dernier propriétaire : le retirer rendrait l’organisation inadministrable.'
                          : `Retirer ${compte.email}`
                      }
                      onClick={() => {
                        if (dernierProprietaire || compteEnCours) return;
                        setCompteEnCours(compte.id);
                        setError(null);
                        void bridge()
                          .remote.admin.deleteUser(org.id, compte.id)
                          .then(() => {
                            setComptes((liste) => (liste ?? []).filter((c) => c.id !== compte.id));
                          })
                          .catch((err) => setError(cleanErrorMessage(err, 'Suppression refusée.')))
                          .finally(() => setCompteEnCours(null));
                      }}
                      className="flex-shrink-0 border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary transition-colors hover:border-danger hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      {compteEnCours === compte.id ? '…' : 'Retirer'}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="my-5 border-t border-border" />

          {/* --------------------------------------------- suppression ----- */}
          <p className="font-mono text-[10px] uppercase tracking-widest text-danger">
            Supprimer cette organisation
          </p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Définitif, et sans corbeille.{' '}
            <span className="text-text-muted">
              Pour lui couper l’accès sans rien détruire — le cas le plus fréquent —
              suspendez-la depuis le registre.
            </span>
          </p>

          {/*
            CE QU'ON S'APPRÊTE À DÉTRUIRE, CHIFFRÉ.

            Le pouls est déjà chargé pour la section du haut : le réutiliser ici
            transforme un avertissement générique (« tout sera perdu ») en un
            poids réel (« 1 compte, 47 enregistrements »). C'est la différence
            entre une formule qu'on survole et une phrase qui arrête la main.
          */}
          {pulse && (
            <p className="mt-2 border border-danger/30 bg-danger-muted px-3 py-2 text-xs leading-relaxed text-text-primary">
              Disparaîtront : <span className="font-mono">{pulse.users.total}</span> compte
              {pulse.users.total > 1 ? 's' : ''},{' '}
              <span className="font-mono">{pulse.records.total}</span> enregistrement
              {pulse.records.total > 1 ? 's' : ''}
              {pulse.sites.total > 0 && (
                <>
                  , <span className="font-mono">{pulse.sites.total}</span> site
                  {pulse.sites.total > 1 ? 's' : ''}
                </>
              )}
              , son journal d’accès et ses invitations en attente. Ses sessions ouvertes cessent
              immédiatement de fonctionner.
            </p>
          )}

          <label className="mt-3 flex flex-col gap-1.5">
            <span className="text-xs text-text-secondary">
              Recopiez <span className="font-mono text-text-primary">{org.name}</span> pour confirmer
            </span>
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder={org.name}
              className="input-focus w-full border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
          </label>

          <button
            type="button"
            disabled={!nomExact || suppression}
            onClick={() => {
              if (!nomExact || suppression) return;
              setSuppression(true);
              setError(null);
              void bridge()
                .remote.admin.deleteOrganization(org.id, confirmation.trim())
                .then(() => {
                  // On ferme AVANT de rafraîchir : le panneau décrit une
                  // organisation qui n'existe plus, le laisser ouvert le temps
                  // d'un aller-retour réseau afficherait un dossier fantôme.
                  onClose();
                  onSaved();
                })
                .catch((err) => {
                  setError(cleanErrorMessage(err, 'La suppression a échoué.'));
                  setSuppression(false);
                });
            }}
            className="mt-2 min-h-11 w-full border border-danger/60 bg-danger-muted px-3 text-sm font-semibold text-text-primary transition-colors hover:border-danger disabled:cursor-not-allowed disabled:opacity-40"
          >
            {suppression ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>

        <div className="flex flex-shrink-0 gap-2 border-t border-border p-3">
          <button
            type="button"
            onClick={() => {
              saveNotes();
              onClose();
            }}
            className="min-h-11 flex-1 bg-accent px-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            Enregistrer et fermer
          </button>
        </div>
      </motion.div>
    </div>
  );
}
