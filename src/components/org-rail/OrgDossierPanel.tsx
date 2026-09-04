import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { roleLabel } from '../../lib/roleLabels';
import { motion } from 'framer-motion';
import { Check, Lock, ShieldAlert, Tag, X } from 'lucide-react';
import { useSync, useCollection } from '../../state/SyncContext';
import { bridge } from '../../lib/bridge';
import { cleanErrorMessage } from '../../lib/errorMessage';
import { SaveIndicator } from '../SaveIndicator';
import { ACCENTS, DEFAULT_ACCENT_ID } from '../../lib/accent';
import { CLIENT_SECTIONS, CLIENT_NAV_ITEMS } from '../../client-context/ClientSidebar';
import { ModuleGrid } from '../ModuleGrid';
import type { NavItem } from '../../data/navigation';
import type { AdminOrganization, AdminOrgUser, ModuleLock, OrgPulse } from '../../shared/api';
import { relativeTime } from '../../lib/time';
import { useFermetureEchap } from '../../lib/useFermetureEchap';
import { useLangue, libelleNav } from '../../i18n';
import { ALWAYS_ON_MODULES } from '../../data/spaces';

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

/**
 * Les modules réglables : TOUT le catalogue de la cliente, moins ce qui est
 * ouvert quoi qu'il arrive (accueil, réglages, membres, assistance,
 * personnel, bibliothèque, découvrir).
 *
 * Dérivé du catalogue, jamais recopié. La liste figée qui vivait ici
 * s'arrêtait aux onze modules d'origine : les cinquante suivants tombaient
 * dans la branche « inclus », avec un cadenas — et il était impossible
 * d'ajouter un module à une organisation. C'est le défaut qu'Aaron a vu.
 */
const REGLABLES: NavItem[] = CLIENT_NAV_ITEMS.filter((item) => !ALWAYS_ON_MODULES.includes(item.key));

/**
 * LA FICHE DE CONFIGURATION (BLOC 5)
 * ══════════════════════════════════
 *
 * « Je ne dois jamais me sentir perdu en gérant plusieurs clientes. » Jusqu'ici
 * la seule façon de savoir ce qu'une organisation avait était de PARCOURIR la
 * grille de cases à cocher et de les compter. C'est lisible pour une cliente,
 * pénible pour quatre, et ça se retient de mémoire — donc ça se trompe.
 *
 * La fiche est DÉRIVÉE de la configuration réelle, jamais saisie : elle ne peut
 * pas mentir, et elle suit toute modification sans que personne la mette à jour.
 *
 * Le rangement est celui que la cliente a sous les yeux (`CLIENT_SECTIONS`,
 * importé et non recopié) : Aaron lit sa configuration dans les mêmes mots
 * qu'elle voit dans sa barre latérale, ce qui est la seule façon de parler de
 * la même chose au téléphone.
 *
 * Les modules NON réglables — Accueil, Commandes, Calculateurs, Paramètres —
 * sont annoncés « toujours ouvert » plutôt que passés sous silence : leur
 * absence de la grille ne veut pas dire qu'ils sont fermés, et une fiche qui
 * les omettrait laisserait croire l'inverse.
 */
/**
 * Les identifiants de forfait ne sont pas des mots — même raison que dans
 * OrgBanner, où `business_premium` s'affichait « BUSINESS_PREMIUM ».
 */
const PLAN_LABELS: Record<string, string> = {
  business_standard: 'Business standard',
  business_premium: 'Business premium',
  internal: 'Interne',
};

interface LigneFiche {
  section: string;
  ouverts: string[];
  fermes: string[];
  /** Modules de la section qui ne se règlent pas : ils sont là quoi qu'il arrive. */
  permanents: number;
}

function ficheConfiguration(modules: string[] | null | undefined, reglable: Map<string, string>): LigneFiche[] {
  // `null` en base = tout le catalogue, y compris ce qui viendra plus tard.
  const actif = (cle: string) => modules === null || modules === undefined || modules.includes(cle);

  const lignes = CLIENT_SECTIONS.map((section) => {
    const ouverts: string[] = [];
    const fermes: string[] = [];
    let permanents = 0;
    for (const cle of section.keys) {
      const label = reglable.get(cle);
      if (!label) {
        permanents += 1;
        continue;
      }
      (actif(cle) ? ouverts : fermes).push(label);
    }
    return { section: section.label, ouverts, fermes, permanents };
  });

  /*
    CE QU'AUCUNE SECTION NE RÉCLAME NE DOIT PAS DISPARAÎTRE.

    Défaut mesuré à la première version : la fiche annonçait « 10/10 modules »
    alors que onze se règlent. « Coffre-fort » n'appartient à aucun groupe de
    `CLIENT_SECTIONS`, il n'était donc jamais parcouru — donc ni compté, ni
    affiché. Une fiche de configuration qui omet un module en silence est pire
    qu'absente : on la croit.

    Même remède que `clientSections()` dans ClientSidebar, qui range déjà ses
    orphelins dans le dernier groupe plutôt que de les perdre.
  */
  const reclames = new Set(CLIENT_SECTIONS.flatMap((section) => section.keys));
  const orphelins = [...reglable].filter(([key]) => !reclames.has(key)).map(([key, label]) => ({ key, label }));
  if (orphelins.length > 0) {
    const derniere = lignes[lignes.length - 1];
    for (const m of orphelins) (actif(m.key) ? derniere.ouverts : derniere.fermes).push(m.label);
  }

  return lignes.filter((l) => l.ouverts.length + l.fermes.length + l.permanents > 0);
}

interface DossierData {
  body: string;
  updatedBy: string;
}

export function OrgDossierPanel({
  org,
  tags: tagsInitiales = [],
  locks = [],
  onClose,
  onSaved,
}: {
  org: AdminOrganization;
  /** Les étiquettes du parc posées sur elle (Bloc 4). */
  tags?: string[];
  /** Les modules dont elle a fermé le contenu à son prestataire (Bloc 4). */
  locks?: ModuleLock[];
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
  // Échap ferme, comme partout ailleurs. Voir lib/useFermetureEchap.
  useFermetureEchap(true, onClose);

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
  /*
    IDENTITÉ ET FORFAIT — les deux réglages qu'on ne pouvait pas changer.

    Le Dossier savait ouvrir des modules, poser une couleur et prendre des
    notes. Il ne savait ni renommer une organisation (une raison sociale change,
    et c'est ce nom qui part sur ses devis) ni changer sa formule. La
    supervision permettait donc de consulter et de suspendre, pas de gérer.
  */
  const [nom, setNom] = useState(org.name);
  const [forfait, setForfait] = useState(org.plan);
  const [places, setPlaces] = useState<number | null>(org.seats ?? null);
  const { t, langue } = useLangue();
  const reglable = useMemo(
    // Les intitulés suivent la langue : `langue` est la vraie dépendance.
    () => new Map(REGLABLES.map((item) => [item.key, libelleNav(item)])),
    [langue],
  );

  // La fiche et sa synthèse, dérivées de la configuration réelle à chaque
  // rendu : un réglage modifié ci-dessous se lit immédiatement en haut.
  const fiche = useMemo(() => ficheConfiguration(org.modules, reglable), [org.modules, reglable]);

  /*
    LA FORMULE ET SES AJUSTEMENTS — rendus par le serveur, jamais recalculés
    ici. Le dossier n'a aucune règle de formule à connaître : il affiche ce
    qu'amn-api lui rend (ce que la formule inclut, ce qui a été ajouté hors
    formule, ce qui en a été retiré), et chaque tuile dit d'où vient son état.
  */
  const formule = org.formula ?? null;
  const ajoutes = useMemo(() => new Set(org.modulesAdded ?? []), [org.modulesAdded]);
  const retires = useMemo(() => new Set(org.modulesRemoved ?? []), [org.modulesRemoved]);
  const dansFormule = (cle: string) => (formule ? formule.modules === null || formule.modules.includes(cle) : false);
  const origine = (cle: string) =>
    ajoutes.has(cle)
      ? t('biblio.composer.ajoute')
      : retires.has(cle)
        ? t('biblio.composer.retire')
        : dansFormule(cle)
          ? t('biblio.composer.formule')
          : null;
  const nbAjustements = ajoutes.size + retires.size;
  const resume = useMemo(() => {
    const ouverts = fiche.reduce((n, l) => n + l.ouverts.length, 0);
    const total = fiche.reduce((n, l) => n + l.ouverts.length + l.fermes.length, 0);
    const sections = fiche.filter((l) => l.ouverts.length + l.permanents > 0).length;
    return { ouverts, total, sections };
  }, [fiche]);
  const [identiteEnCours, setIdentiteEnCours] = useState(false);
  const identiteModifiee = nom.trim() !== org.name || forfait !== org.plan || places !== (org.seats ?? null);

  const [nouvelEmail, setNouvelEmail] = useState('');
  const [ouverture, setOuverture] = useState(false);
  /**
   * Le lien d'activation du dernier compte ouvert, rendu UNE fois.
   *
   * Il n'est pas stocké côté serveur — seule son empreinte l'est — donc il ne
   * peut plus être retrouvé après. L'afficher tout de suite, en clair, avec de
   * quoi le copier, est la seule façon qu'il serve à quelque chose.
   */
  /*
    LE SECRET MONTRÉ UNE FOIS (BLOC 5.2)

    Un seul état pour les deux gestes qui produisent quelque chose qu'on ne
    reverra pas : un lien d'activation et un mot de passe temporaire. Deux
    états séparés auraient permis d'en afficher deux à la fois — et le second
    aurait poussé le premier hors de l'écran alors qu'il n'était pas encore
    copié.

    `genre` sert au texte : « envoyez-lui ce lien » et « dictez-lui ce mot de
    passe » ne se transmettent pas de la même façon, et un libellé commun
    aurait été juste pour aucun des deux.
  */
  const [lienOuvert, setLienOuvert] = useState<{ genre: 'lien' | 'motdepasse' | 'bienvenue'; email: string; url: string | null; token: string } | null>(
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

  /*
    Un module, un geste, un mot dans le journal. Le serveur traduit « ouvrir »
    ou « fermer » en ajustement par rapport à la formule (ajouté hors
    formule, retiré de la formule, retour à la formule) : c'est lui qui
    connaît la formule, et lui seul qui écrit.
  */
  const toggle = async (key: string) => {
    setError(null);
    setPendingModule(key);
    try {
      await bridge().remote.admin.setOrganizationModule(org.id, key, !isOn(key));
      onSaved();
    } catch (err) {
      setError(cleanErrorMessage(err, 'amn-api a refusé la modification.'));
    } finally {
      setPendingModule(null);
    }
  };
  const revenirFormule = async () => {
    setError(null);
    setPendingModule('__formule');
    try {
      await bridge().remote.admin.resetOrganizationModules(org.id);
      onSaved();
    } catch (err) {
      setError(cleanErrorMessage(err, 'amn-api a refusé le retour à la formule.'));
    } finally {
      setPendingModule(null);
    }
  };
  // Les places occupées : un compte qui travaille, actif ou invité. Même
  // règle que `countsAsSeat` côté serveur — qui reste seul juge.
  const occupees = (comptes ?? []).filter((c) => c.status === 'active' || c.status === 'invited').length;
  const sousPlancher = places !== null && places < occupees;

  /*
    LES ÉTIQUETTES (Bloc 4) : segmenter le parc à la main — « pilote »,
    « fleuristes », « à relancer ». Un mot, jamais une phrase ; posées ici,
    filtrées dans le registre, journalisées.
  */
  const [tags, setTags] = useState<string[]>(tagsInitiales);
  const [tagSaisi, setTagSaisi] = useState('');
  const [tagsEnCours, setTagsEnCours] = useState(false);
  useEffect(() => setTags(tagsInitiales), [tagsInitiales]);
  const poserTags = async (suivantes: string[]) => {
    setTagsEnCours(true);
    setError(null);
    try {
      setTags(await bridge().remote.admin.setOrganizationTags(org.id, suivantes));
      onSaved();
    } catch (err) {
      setError(cleanErrorMessage(err, 'amn-api a refusé ces étiquettes.'));
    } finally {
      setTagsEnCours(false);
    }
  };
  const ajouterTag = () => {
    const t = tagSaisi.trim();
    if (!t || tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    setTagSaisi('');
    void poserTags([...tags, t]);
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
            {/*
              La configuration en une ligne, SANS DÉFILER. C'est la question
              qu'on se pose en ouvrant le dossier d'une cliente qu'on n'a pas vue
              depuis trois semaines : « elle a quoi, déjà ? ». Le détail par
              section attend plus bas, à côté des réglages qui le changent.
            */}
            <p className="mt-1 truncate font-mono text-[10px] text-text-secondary">
              {PLAN_LABELS[org.plan] ?? org.plan} · {resume.ouverts}/{resume.total} modules ·{' '}
              {resume.sections} section{resume.sections > 1 ? 's' : ''}
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
            <p className="mb-3 border border-border border-l-2 border-l-danger bg-surface px-3 py-2 text-xs text-text-primary">
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

          {/* ------------------------------------------------ étiquettes ----- */}
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Étiquettes</p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Des mots pour segmenter le parc — « pilote », « fleuristes », « à relancer » — et agir sur un segment d’un geste depuis le registre.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {tags.map((t) => (
              <span key={t} className="flex items-center gap-1 border border-border bg-surface px-2 py-1 text-xs text-text-primary">
                <Tag size={10} className="text-text-muted" /> {t}
                <button type="button" onClick={() => void poserTags(tags.filter((x) => x !== t))} disabled={tagsEnCours} aria-label={`Retirer l’étiquette ${t}`} className="-my-2 px-1 py-2 text-text-muted hover:text-danger"><X size={11} /></button>
              </span>
            ))}
            <form onSubmit={(e) => { e.preventDefault(); ajouterTag(); }} className="flex items-center gap-1">
              <input value={tagSaisi} onChange={(e) => setTagSaisi(e.target.value)} placeholder="Nouvelle étiquette" aria-label="Nouvelle étiquette" maxLength={40} className="input-focus min-h-11 w-40 border border-border bg-bg px-2 text-xs text-text-primary outline-none md:min-h-0 md:py-1.5" />
              <button type="submit" disabled={tagsEnCours || !tagSaisi.trim()} className="min-h-11 border border-border-strong px-2 text-xs text-text-primary hover:bg-surface-hover disabled:opacity-40 md:min-h-0 md:py-1.5">Poser</button>
            </form>
          </div>

          {/* --------------------------------------------- consentement ----- */}
          <p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-text-muted">Ce qu’elle nous a fermé</p>
          {locks.length === 0 ? (
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              Aucun verrou : la session d’assistance ouvre tous ses modules.{' '}
              <span className="text-text-muted">Elle peut en fermer le contenu depuis ses réglages, à tout moment ; nous ne pouvons pas rouvrir à sa place.</span>
            </p>
          ) : (
            <ul className="mt-2 flex flex-col divide-y divide-border border border-warning/40 bg-surface">
              {locks.map((l) => (
                <li key={l.module} className="flex items-center gap-2 px-3 py-2 text-xs">
                  <Lock size={12} className="flex-shrink-0 text-warning" />
                  <span className="flex-1 text-text-primary">{reglable.get(l.module) ?? l.module}</span>
                  <span className="text-text-muted">fermé par {l.byEmail.split('@')[0]} · {relativeTime(l.lockedAt)}</span>
                </li>
              ))}
              <li className="px-3 py-2 text-[11px] leading-relaxed text-text-muted">
                Le contenu de ces modules ne s’ouvre pas en session d’assistance. Son compte, sa formule et ses places restent réglables ici. Seule la cliente rouvre.
              </li>
            </ul>
          )}
          <div className="my-5 border-t border-border" />

          {/* ------------------------------------------------- modules ----- */}
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Sa configuration
          </p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Rangée comme dans SA barre latérale — de quoi en parler avec elle dans les mêmes
            mots.{' '}
            <span className="text-text-muted">
              Générée depuis la configuration réelle : elle suit les réglages ci-dessous sans que
              personne la tienne à jour.
            </span>
          </p>
          <div className="mt-3 flex flex-col gap-1.5 border border-border bg-surface px-3 py-2.5">
            {fiche.map((ligne) => (
              <div key={ligne.section} className="flex items-baseline gap-2 text-xs">
                <span className="w-32 flex-shrink-0 truncate text-text-muted">{ligne.section}</span>
                <span className="min-w-0 flex-1 text-text-secondary">
                  {ligne.ouverts.length === 0 && ligne.permanents === 0 ? (
                    <span className="text-text-muted">— fermée</span>
                  ) : (
                    <>
                      {ligne.ouverts.join(', ')}
                      {ligne.permanents > 0 && (
                        <span className="text-text-muted">
                          {ligne.ouverts.length > 0 ? ' · ' : ''}
                          {ligne.permanents} toujours ouvert{ligne.permanents > 1 ? 's' : ''}
                        </span>
                      )}
                    </>
                  )}
                  {ligne.fermes.length > 0 && (
                    <span className="text-text-muted"> · fermé : {ligne.fermes.join(', ')}</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {t('dossier.modules.titre')}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">{t('dossier.modules.aide')}</p>

          {/*
            LA MÊME GRILLE QUE LA BIBLIOTHÈQUE, en mode « composer » : c'est ici
            qu'Aaron compose un desktop. Rangée par les sections que la cliente
            voit chez elle (CLIENT_SECTIONS), avec ce qui est inclus quoi qu'il
            arrive marqué comme tel — on ne coche pas l'accueil.
          */}
          <div className="mt-3">
            <ModuleGrid
              mode="composer"
              surface="support"
              sections={CLIENT_SECTIONS.map((section) => ({
                key: section.label,
                label: section.label,
                items: section.keys
                  .map((cle) => CLIENT_NAV_ITEMS.find((item) => item.key === cle))
                  .filter((item): item is NavItem => Boolean(item)),
              }))}
              etat={(cle) => (ALWAYS_ON_MODULES.includes(cle) ? 'inclus' : isOn(cle) ? 'ouvert' : 'disponible')}
              annotation={origine}
              enCours={pendingModule}
              onToggle={(cle) => void toggle(cle)}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-border bg-surface px-3 py-2">
            <p className="text-xs text-text-secondary">
              {nbAjustements === 0
                ? t('dossier.formule.aucunAjustement')
                : t('dossier.formule.ajustements', { ajoutes: ajoutes.size, retires: retires.size })}
            </p>
            {nbAjustements > 0 && (
              <button
                type="button"
                disabled={pendingModule !== null}
                onClick={() => void revenirFormule()}
                title={t('dossier.formule.revenirAide')}
                className="min-h-11 border border-border-strong px-3 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-40 md:min-h-0 md:py-1.5"
              >
                {t('dossier.formule.revenir')}
              </button>
            )}
          </div>

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

          {/* --------------------------------------- identité et forfait --- */}
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Identité et forfait
          </p>

          <label className="mt-3 flex flex-col gap-1.5">
            <span className="text-xs text-text-secondary">
              Raison sociale{' '}
              <span className="text-text-muted">— c’est ce nom qui figure sur ses devis.</span>
            </span>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="input-focus w-full border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            />
          </label>

          <label className="mt-3 flex flex-col gap-1.5">
            <span className="text-xs text-text-secondary">Formule</span>
            <select
              value={forfait}
              onChange={(e) => setForfait(e.target.value as typeof forfait)}
              className="input-focus w-full cursor-pointer border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            >
              <option value="business_standard">Business standard</option>
              <option value="business_premium">Business premium</option>
            </select>
          </label>

          {/*
            LES PLACES (Bloc 1). C'est la seule chose de cette carte qui a un
            effet réel : le serveur refuse l'invitation au-delà. « La formule
            décide » vaut deux places en standard, cinq en premium.
          */}
          <label className="mt-3 flex flex-col gap-1.5">
            <span className="text-xs text-text-secondary">Places</span>
            <select
              value={places === null ? '' : String(places)}
              onChange={(e) => setPlaces(e.target.value === '' ? null : Number(e.target.value))}
              className="input-focus w-full cursor-pointer border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            >
              <option value="">
                {forfait === org.plan && formule?.seats != null
                  ? t('dossier.places.formule', { n: formule.seats })
                  : t('dossier.places.formuleSansNombre')}
              </option>
              {[1, 2, 5, 10, 25].map((n) => (
                <option key={n} value={n} disabled={n < occupees}>
                  {n === 1 ? t('dossier.places.une') : t('dossier.places.plusieurs', { n })}
                </option>
              ))}
            </select>
          </label>
          {/*
            LE PLANCHER : jamais moins de places que de comptes. Les options
            en dessous sont grisées, la phrase dit combien retirer, et le
            serveur refuse de toute façon (409 `seats_below_accounts`) — un
            appel scripté n'y échappe pas.
          */}
          {occupees > 0 && (
            <p className="mt-1 text-[11px] leading-relaxed text-text-muted">{t('dossier.places.occupees', { comptes: occupees })}</p>
          )}
          {sousPlancher && (
            <p role="alert" className="mt-1 text-[11px] leading-relaxed text-warning">
              {t('dossier.places.plancher', { comptes: occupees, retirer: occupees - (places ?? 0), places: places ?? 0 })}
            </p>
          )}

          {/*
            CE QUE LA FORMULE CHANGE — désormais quelque chose, et il faut le dire.

            Longtemps « Business standard » n'a été qu'une étiquette : aucun
            module, aucune place n'en dépendait, et ce panneau l'écrivait pour
            qu'on ne prenne pas l'étiquette pour un verrou. Depuis septembre
            2026 la formule est la SOURCE : elle inclut des modules et des
            places (amn-api, `PLAN_FORMULAS`), l'organisation en hérite, et
            Aaron ajuste par-dessus, module par module, journalisé. « Inclus »
            décrit ; il n'interdit rien.
          */}
          <p className="mt-2 text-[11px] leading-relaxed text-text-muted">{t('dossier.formule.explication')}</p>
          {formule && forfait === org.plan && (
            <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
              {formule.modules === null
                ? t('dossier.formule.inclutTout', {
                    formule: PLAN_LABELS[org.plan] ?? org.plan,
                    modules: REGLABLES.length,
                    places: formule.seats ?? '—',
                  })
                : t('dossier.formule.inclut', {
                    formule: PLAN_LABELS[org.plan] ?? org.plan,
                    modules: formule.modules.length,
                    places: formule.seats ?? '—',
                  })}
            </p>
          )}

          <button
            type="button"
            disabled={!identiteModifiee || identiteEnCours || !nom.trim() || sousPlancher}
            onClick={() => {
              if (!identiteModifiee || identiteEnCours || sousPlancher) return;
              setIdentiteEnCours(true);
              setError(null);
              const gestes: Promise<unknown>[] = [];
              if (nom.trim() !== org.name) {
                gestes.push(bridge().remote.admin.updateOrganization(org.id, { name: nom.trim() }));
              }
              if (forfait !== org.plan) {
                gestes.push(bridge().remote.admin.setOrganizationPlan(org.id, forfait));
              }
              if (places !== (org.seats ?? null)) {
                gestes.push(bridge().remote.admin.updateOrganization(org.id, { seats: places }));
              }
              void Promise.all(gestes)
                .then(() => onSaved())
                .catch((err) => setError(cleanErrorMessage(err, 'Modification refusée.')))
                .finally(() => setIdentiteEnCours(false));
            }}
            className="mt-3 min-h-11 w-full border border-border-strong px-3 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {identiteEnCours ? 'Enregistrement…' : 'Enregistrer l’identité'}
          </button>

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
                    setLienOuvert({ genre: 'lien', email, url: res.invitation.url, token: res.invitation.token });
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
                {lienOuvert.genre === 'lien' ? 'Compte ouvert pour ' : lienOuvert.genre === 'bienvenue' ? 'Lien de bienvenue pour ' : 'Nouveau mot de passe pour '}
                <span className="font-mono text-[11px]">{lienOuvert.email}</span>.{' '}
                {lienOuvert.genre === 'lien' || lienOuvert.genre === 'bienvenue' ? 'Envoyez-lui ce lien' : 'Transmettez-le-lui'} —{' '}
                <span className="text-text-muted">il ne sera plus affiché.</span>
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
              {lienOuvert.genre === 'motdepasse' && (
                <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
                  Ses sessions ouvertes ont été fermées, et son application lui rappellera de
                  choisir le sien — ce mot de passe est connu de deux personnes.
                </p>
              )}
              {lienOuvert.genre === 'bienvenue' && (
                <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
                  Sept jours, usage unique. La page la félicite, lui fait accepter la politique
                  d’utilisation, affiche ses accès une fois, puis se détruit quand elle confirme.
                  Tout est journalisé — émis, lu, consommé.
                </p>
              )}
              {(lienOuvert.genre === 'lien' || lienOuvert.genre === 'bienvenue') && !lienOuvert.url && (
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
                      {/* Le rôle DANS SA LANGUE (BLOC 6) : « Gérante » chez une
                          boutique, « Président » chez une association. Seul
                          l'intitulé change — les droits restent ceux
                          qu'arbitre amn-api. */}
                      <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        {roleLabel(compte.role, org.trade)}
                        {compte.status !== 'active' ? ` · ${compte.status}` : ''}
                      </p>
                    </div>
                    {/*
                      LES DEUX GESTES DU SUPPORT (BLOC 5.2)

                      Ils existaient dans l'API et dans le pont depuis
                      longtemps, et n'avaient d'écran QUE dans l'atelier, au
                      moment de la création. Autrement dit : quand une cliente
                      appelait en disant « je n'arrive plus à me connecter »,
                      il n'y avait aucun bouton — ni loin, ni caché : aucun.
                      L'audit des clics cherchait des gestes trop longs ; il a
                      trouvé des gestes absents, ce qui coûte plus cher.

                      Ils vivent ici, dans le dossier, parce que c'est là qu'on
                      est quand on a la personne au téléphone : à côté de son
                      adresse, de son rôle et de l'état de son compte.
                    */}
                    <button
                      type="button"
                      disabled={compteEnCours !== null}
                      title={`Remettre un mot de passe temporaire à ${compte.email}`}
                      onClick={() => {
                        if (compteEnCours) return;
                        setCompteEnCours(compte.id);
                        setError(null);
                        void bridge()
                          .remote.admin.resetPassword(org.id, compte.id)
                          .then((res) => {
                            setLienOuvert({
                              genre: 'motdepasse',
                              email: compte.email,
                              url: null,
                              token: res.password,
                            });
                            // Le compte passe « actif » côté serveur : la liste
                            // doit le dire, sinon l'écran continue d'afficher
                            // « invited » pour quelqu'un qui peut entrer.
                            chargerComptes();
                          })
                          .catch((err) => setError(cleanErrorMessage(err, 'Mot de passe refusé.')))
                          .finally(() => setCompteEnCours(null));
                      }}
                      className="flex-shrink-0 border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      {compteEnCours === compte.id ? '…' : 'Mot de passe'}
                    </button>
                    {/* LE LIEN DE BIENVENUE (Bloc 2) — la remise digne du produit : une
                        page à notre image qui félicite, fait accepter la politique, montre
                        les accès une fois et se détruit. Pour tout compte non suspendu. */}
                    {compte.status !== 'suspended' && (
                      <button
                        type="button"
                        disabled={compteEnCours !== null}
                        title={`Émettre un lien de bienvenue pour ${compte.email}`}
                        onClick={() => {
                          setCompteEnCours(compte.id);
                          setError(null);
                          void bridge()
                            .remote.admin.createWelcomeLink(org.id, compte.id)
                            .then((res) => {
                              setLienOuvert({ genre: 'bienvenue', email: compte.email, url: res.url, token: res.token });
                              chargerComptes();
                            })
                            .catch((err) => setError(cleanErrorMessage(err, 'Le lien de bienvenue n’a pas pu être émis.')))
                            .finally(() => setCompteEnCours(null));
                        }}
                        className="flex-shrink-0 border border-border-strong px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Bienvenue
                      </button>
                    )}
                    {/* Réinviter n'a de sens que pour qui n'est jamais entré :
                        proposer un nouveau lien d'activation à un compte actif
                        offrirait un geste qui ne répond à aucune situation. */}
                    {compte.status === 'invited' && (
                      <button
                        type="button"
                        disabled={compteEnCours !== null}
                        title={`Réémettre le lien d’activation de ${compte.email}`}
                        onClick={() => {
                          if (compteEnCours) return;
                          setCompteEnCours(compte.id);
                          setError(null);
                          void bridge()
                            .remote.admin.reissueInvitation(org.id, compte.email)
                            .then((res) => {
                              setLienOuvert({
                                genre: 'lien',
                                email: compte.email,
                                url: res.invitation.url,
                                token: res.invitation.token,
                              });
                            })
                            .catch((err) => setError(cleanErrorMessage(err, 'Réémission refusée.')))
                            .finally(() => setCompteEnCours(null));
                        }}
                        className="flex-shrink-0 border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Réinviter
                      </button>
                    )}
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
            <p className="mt-2 border border-border border-l-2 border-l-danger bg-surface px-3 py-2 text-xs leading-relaxed text-text-primary">
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
