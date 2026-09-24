import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Bell, Camera, Check, Download, Info, KeyRound, Loader2, Power, UserCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useProfiles } from '../state/ProfilesContext';
import { useAppointments } from '../state/useAppointments';
import { relativeToNow, timeLabel } from '../lib/calendar';
import { bridge } from '../lib/bridge';
import { cleanErrorMessage } from '../lib/errorMessage';
import { resizeImageToDataUrl } from '../lib/imageResize';
import { ensurePushSubscription, sendPushTest } from '../lib/webPush';
import { UserAvatar } from '../components/UserAvatar';
import { Logo } from '../components/Logo';
import { SettingsPanel as Panel } from '../components/SettingsPanel';
import { ModulesSection } from '../components/settings/ModulesSection';
import { APP_VERSION, EDITION_PRODUCT_NAME, IS_BUSINESS } from '../edition/edition';
import { OllamaSection, WhisperSection, useExclusive } from '@edition/exclusive';
import { AccountSecuritySection } from '../components/settings/AccountSecuritySection';
import { MfaSection } from '../components/settings/MfaSection';
import { DataSection } from '../components/settings/DataSection';
import { UpdateSection } from '../components/settings/UpdateSection';

/** Une phrase d'identité par édition — celle de l'interne nomme AMN DevSec. */
const ABOUT_TAGLINE = IS_BUSINESS
  ? 'Votre espace de gestion d’activité — agenda, clients, tâches et documents.'
  : 'Poste de commandement AMN DEVSEC — supervision, équipe et clients.';

/**
 * LA SIGNATURE DE MARQUE, À UN SEUL ENDROIT (BLOC M)
 * ═════════════════════════════════════════════════
 *
 * Aaron veut que l'application livrée dise qui l'a faite. C'est légitime, et
 * c'est aussi la seule mention de notre raison sociale que voit une cliente :
 * partout ailleurs, son application est LA SIENNE, et notre nom au milieu de
 * ses factures ferait d'elle l'utilisatrice d'un outil d'AMN DevSec plutôt que
 * la propriétaire de son espace.
 *
 * ## Pourquoi l'écran « À propos », et pas le pied de page
 *
 * Le pied de page (`StatusRail`) était le premier candidat — c'est
 * littéralement un `<footer>`. Mais il est déclaré `hidden … md:flex` : il
 * n'existe pas sur téléphone. Or l'édition Business s'utilise aussi au
 * téléphone. Une signature invisible sur la moitié des écrans n'est pas une
 * signature discrète, c'est une signature absente.
 *
 * « À propos » est l'endroit où l'on va justement pour savoir CE QU'EST ce
 * logiciel et d'où il vient. La mention y est attendue plutôt que subie, elle
 * est atteignable sur tous les formats, et elle n'apparaît qu'une fois.
 *
 * ## Cette chaîne est surveillée
 *
 * `scripts/check-business-bundle.mjs` interdit « AMN DevSec » dans le bundle
 * d'une cliente. La règle n'est pas contournée : elle autorise EXACTEMENT
 * cette chaîne-ci, une seule fois (voir `allowExact` dans
 * business-bundle-rules.mjs). Recopier la signature ailleurs, ou la répéter,
 * fait échouer le contrôle — ce qui est le comportement voulu.
 */
const BRAND_SIGNATURE = 'by AMN DevSec';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { CHANGELOG } from '../data/changelog';
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '../shared/api';
import { AccentSection } from '../components/settings/AccentSection';
import { CONSEQUENCES, consequenceDe } from '../data/consequencesReglages';
import { navItemByKey } from '../data/navigation';
import { useHaloSignal } from '../components/EtatEcran';
import { LangueSection } from '../components/settings/LangueSection';
import { AccueilSection } from '../components/settings/AccueilSection';
import { VeilleSection } from '@edition/accueils';
import { GuideSection } from '../guide/GuideSection';
import { ExtensionsSection } from '../components/settings/ExtensionsSection';
import { useSupportContext } from '../state/OrgContextContext';
import { useLangue, t as tr } from '../i18n';

export function SettingsScreen() {
  // Abonnement à la langue : les textes ci-dessous passent par `tr`, lu au rendu.
  useLangue();
  const { user, org } = useAuth();
  // `support` vaut null hors contexte client. Lu ici plutôt que dans la section
  // elle-même : c'est l'écran qui sait dans quel contexte il est monté.
  const support = useSupportContext();

  if (!user) return null;

  return (
    <StaggerGroup className="flex flex-col gap-6">
      <StaggerItem>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">{tr('hist.settings.parametres')}</h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-muted">{tr('hist.settings.profilSecuriteNotifications')}</p>
        </div>
      </StaggerItem>

      {/* ═══ L'OBJET DOMINANT : le plan, avant les interrupteurs ═══ */}
      <StaggerItem>
        <PlanDesReglages />
      </StaggerItem>

      <StaggerItem>
        <FormuleEtPlaces />
      </StaggerItem>

      <StaggerItem>
        <div id="reglages-profil">
          <ProfileSection email={user.email} />
        </div>
      </StaggerItem>
      <StaggerItem>
        <div id="reglages-accueil" className="flex flex-col gap-4">
          <AccueilSection />
          <VeilleSection />
          <GuideSection />
          <ExtensionsSection />
        </div>
      </StaggerItem>
      <StaggerItem>
        <div id="reglages-securite">
          <PasswordSection email={user.email} remote={org !== null} />
        </div>
      </StaggerItem>
      <StaggerItem>
        <div id="reglages-notifications">
          <NotificationsSection email={user.email} />
        </div>
      </StaggerItem>
      {/*
        LA COULEUR APPARTIENT À L'ORGANISATION QUI L'UTILISE (BLOC C).

        Masquée pendant une session de support : un opérateur d'AMN DevSec ne
        choisit pas l'identité visuelle d'une cliente à sa place. S'il faut
        l'aider, il le fait depuis le dossier interne, où le geste est tracé —
        et le serveur refuse de toute façon cette route à une session de support.

        Réservée aussi à qui peut engager l'organisation : c'est un réglage
        d'organisation, pas de profil. Le serveur tranche (403 pour un simple
        membre) ; l'écran évite seulement de proposer un geste voué au refus.
      */}
      {/* Le rôle n'est pas porté par le profil local : c'est le SERVEUR qui
          tranche (403 pour un simple membre). L'écran propose donc le réglage,
          et relaie le refus si l'organisation ne l'y autorise pas — plutôt que
          de deviner un rôle qu'il n'a pas. */}
      {!support && (
        <StaggerItem>
          <div id="reglages-apparence">
            <AccentSection />
          </div>
        </StaggerItem>
      )}
      {/* La langue du POSTE — un choix de personne, en localStorage : il ne
          part pas en synchronisation et ne change rien pour personne d'autre.
          La langue de l'ORGANISATION se choisit à l'atelier. */}
      <StaggerItem>
        <LangueSection />
      </StaggerItem>
      {/*
        Sécurité du compte : appareils connectés et journal d'accès.

        Sur TOUTES les plateformes, sans condition — un téléphone perdu se
        révoque justement depuis un autre appareil, donc réserver cette section
        à Electron aurait retiré le cas d'usage principal.
      */}
      <StaggerItem>
        <MfaSection />
        <AccountSecuritySection />
      </StaggerItem>
      {/*
        Les mises à jour, dans les DEUX éditions.

        Chez la cliente c'est même le cas le plus utile : son application ne
        s'auto-met pas à jour aujourd'hui, et ce bouton est le seul endroit où
        elle peut le constater plutôt que le supposer.
      */}
      <StaggerItem>
        <div id="reglages-poste">
          <UpdateSection />
        </div>
      </StaggerItem>
      {!bridge().env.isElectron && (
        <StaggerItem>
          <PushSection email={user.email} />
        </StaggerItem>
      )}
      {bridge().env.isElectron && (
        <StaggerItem>
          <OllamaSection />
          <WhisperSection />
        </StaggerItem>
      )}
      {bridge().env.isElectron && (
        <StaggerItem>
          <StartupSection />
        </StaggerItem>
      )}
      {/*
        LE CATALOGUE DES MODULES (BLOC 4).

        Masqué en session de support : la demande doit venir d'elle. Une
        demande faite « en son nom » par AMN DevSec apparaîtrait dans une liste
        dont tout l'intérêt est qu'elle exprime SON envie — et le serveur la
        refuse de toute façon (`allowSupport: false`).
      */}
      {/*
        LES MEMBRES (BLOCS 6 et 7).

        Masqué en session de support pour la même raison que le catalogue de
        modules : ces routes agissent sur l'organisation de la SESSION. Un
        opérateur d'AMN DevSec y verrait — et y modifierait — les comptes de
        SON organisation à lui, affichés sous la bannière de la cliente.
      */}
      {/* Les membres ont leur ÉCRAN depuis le 1er septembre (Système → Membres) :
          la section vivait ici, au fond, et personne ne la trouvait. */}
      {!support && (
        <StaggerItem>
          <div id="reglages-modules">
            <ModulesSection />
          </div>
        </StaggerItem>
      )}
      <StaggerItem>
        <div id="reglages-donnees">
          <DataSection />
        </div>
      </StaggerItem>
      <StaggerItem>
        <AboutSection />
      </StaggerItem>
    </StaggerGroup>
  );
}


/*
  ══════════════════════════════════════════════════════════════════════
  LE PLAN DE L'ESPACE DE TRAVAIL — et le piège qu'il évite
  ══════════════════════════════════════════════════════════════════════

  Le piège de la famille Système était l'écran de réglages générique : une
  colonne d'interrupteurs, chacun disant ce qu'il EST, aucun ne disant ce
  qu'il FAIT. On y entre pour changer une chose et on en ressort sans savoir
  ce qui vient de bouger ailleurs.

  MÊME UN MODULE DE PARAMÈTRES A UN OBJET DOMINANT, ET C'EST L'ÉTAT DU
  SYSTÈME. Ici : sept rubriques posées à plat, chacune annonçant combien de
  réglages elle contient ET lequel a une conséquence ailleurs dans le
  produit. Les interrupteurs, eux, sont dessous — on descend quand on sait
  où l'on va.

  LE COMPTE « CITÉS N FOIS » EST RÉEL : il vient de
  `src/data/consequencesReglages.ts`, où chaque lecteur est un fichier, et
  `npm run check:consequences` ouvre ces fichiers pour refuser un lecteur qui
  ne lit plus le réglage. Une rubrique sans conséquence ailleurs n'a pas de
  compte de citations — elle n'affiche rien plutôt qu'un zéro.
*/
interface Rubrique {
  cle: string;
  titre: string;
  /** Les réglages de la rubrique, comptés — pas une estimation. */
  reglages: string[];
  ancre: string;
}

const RUBRIQUES: Rubrique[] = [
  { cle: 'profil', titre: 'Profil', reglages: ['Votre nom', 'Votre photo', 'Votre fonction'], ancre: 'reglages-profil' },
  { cle: 'guide', titre: 'Guide', reglages: ['La visite guidée', 'Les présentations', 'Le profil de départ'], ancre: 'reglages-guide' },
  { cle: 'extensions', titre: 'Extensions', reglages: ['Teintes de familles', 'Index des familles', 'Célébrations', 'Le Hall'], ancre: 'reglages-extensions' },
  {
    cle: 'securite',
    titre: 'Sécurité du compte',
    reglages: ['Mot de passe', 'Double facteur', 'Appareils connectés', 'Journal d’accès'],
    ancre: 'reglages-securite',
  },
  { cle: 'notifications', titre: 'Notifications', reglages: ['Ce qui vous prévient', 'Sur ce navigateur'], ancre: 'reglages-notifications' },
  { cle: 'apparence', titre: 'Apparence et langue', reglages: ['Couleur d’accent', 'Langue du poste'], ancre: 'reglages-apparence' },
  { cle: 'poste', titre: 'Ce poste', reglages: ['Mises à jour', 'Démarrage', 'Modèles locaux'], ancre: 'reglages-poste' },
  { cle: 'modules', titre: 'Modules', reglages: ['Les modules ouverts', 'Ce qui se demande'], ancre: 'reglages-modules' },
  { cle: 'donnees', titre: 'Données', reglages: ['Export', 'Effacement', 'Version installée'], ancre: 'reglages-donnees' },
];

/** Le plan : sept rubriques en trois colonnes, et une seule en ambre. */
function PlanDesReglages() {
  /* LA RUBRIQUE AMBRE : celle dont le réglage est le PLUS cité ailleurs. Une
     seule, même si deux rubriques ont une conséquence — l'ambre marque ce
     qui porte le plus loin, pas tout ce qui porte. */
  const laPlusCitee = [...CONSEQUENCES].sort((a, b) => b.lecteurs.length - a.lecteurs.length)[0] ?? null;
  const halo = useHaloSignal(Boolean(laPlusCitee));
  const citee = laPlusCitee ? RUBRIQUES.find((r) => r.cle === laPlusCitee.rubrique) ?? null : null;

  return (
    <section className={`panel-raised p-5 sm:p-6 ${halo}`}>
      <p className="eyebrow mb-4">Ce que vous pouvez changer, et ce que ça change</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RUBRIQUES.map((r) => {
          const c = consequenceDe(r.cle);
          const ambre = citee?.cle === r.cle;
          return (
            <li
              key={r.cle}
              data-signal-groupe={ambre ? 'rubrique-citee' : undefined}
              className={`p-4 ${ambre ? 'border border-signal-line bg-signal-muted' : 'panel'}`}
            >
              <a
                href={`#${r.ancre}`}
                data-signal-groupe={ambre ? 'rubrique-citee' : undefined}
                className={`text-sm font-semibold leading-tight ${ambre ? 'text-signal' : 'text-text-primary'}`}
              >
                {r.titre}
              </a>
              <p
                data-signal-groupe={ambre ? 'rubrique-citee' : undefined}
                className={`mt-1 font-mono text-[10px] uppercase tracking-[0.16em] tabular-nums ${
                  ambre ? 'text-signal' : 'text-text-muted'
                }`}
              >
                {r.reglages.length} réglages
                {c ? ` · cités ${c.lecteurs.length} fois` : ''}
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-text-secondary">
                {c ? `« ${c.reglage} » est lu ailleurs dans le produit.` : 'Ne change rien hors de cette rubrique.'}
              </p>
            </li>
          );
        })}
      </ul>

      {/* SOUS LE PLAN — ce que change CE réglage, nommément. */}
      {laPlusCitee && citee && (
        <p className="mt-4 max-w-prose border-t border-border-strong pt-3 text-sm leading-relaxed text-text-body">
          {`« ${laPlusCitee.reglage} » (${citee.titre}) est lu par ${laPlusCitee.lecteurs.length} modules : `}
          {laPlusCitee.lecteurs
            .map((l) => navItemByKey(l.module)?.label ?? l.module)
            .join(', ')}
          {'. Le changer les réécrit tous d’un coup.'}
        </p>
      )}
    </section>
  );
}


/*
  LA FORMULE — et deux manques dits plutôt que meublés.

  `MODULES.md` demande ici « les cinq derniers changements avec leur valeur
  et leur date » et « le prochain prélèvement ». Ni l'un ni l'autre n'existe
  dans ce produit :

  · AUCUN CHANGEMENT DE RÉGLAGE N'EST JOURNALISÉ. Le journal d'organisation
    enregistre des GESTES (connexion, changement de rôle, suspension), pas la
    valeur d'un réglage avant et après. Afficher « cinq derniers
    changements » en y mettant des connexions serait un panneau qui ment sur
    son titre ; le remplir de valeurs inventées serait pire.

  · IL N'Y A PAS DE PRÉLÈVEMENT AUTOMATIQUE. Une place de plus se DEMANDE, un
    humain la lit dans la Tour de contrôle, et aucun robot ne facture quoi
    que ce soit (voir Membres et routes/modules.js). Une date de prochain
    prélèvement serait une promesse que rien ne tient.

  Le panneau dit donc ce qui est vrai : la formule, les places, et les deux
  absences nommées.
*/
function FormuleEtPlaces() {
  const { org } = useAuth();
  if (!org) return null;
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="panel p-4">
        <p className="eyebrow mb-3">Ce que ce produit ne garde pas</p>
        <ul className="flex flex-col gap-2">
          <li className="flex items-baseline gap-2 text-[13px] leading-relaxed text-text-secondary">
            <span aria-hidden className="text-text-muted">—</span>
            <span>
              L’historique de vos réglages. Le journal de l’organisation enregistre des gestes — une connexion,
              un changement de rôle — pas la valeur d’un réglage avant et après.
            </span>
          </li>
          <li className="flex items-baseline gap-2 text-[13px] leading-relaxed text-text-secondary">
            <span aria-hidden className="text-text-muted">—</span>
            <span>
              Aucune date de prélèvement. Une place de plus se demande, un humain la lit ; rien n’est facturé
              automatiquement.
            </span>
          </li>
        </ul>
      </div>
      <aside className="panel p-4">
        <p className="eyebrow mb-3">La formule</p>
        <dl className="flex flex-col gap-2.5">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">Organisation</dt>
            <dd className="text-[15px] font-semibold leading-tight text-text-primary">{org.name}</dd>
          </div>
          {org.seats != null && (
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">Places</dt>
              <dd className="text-[19px] font-semibold tabular-nums leading-tight text-text-primary">{org.seats}</dd>
            </div>
          )}
        </dl>
      </aside>
    </section>
  );
}

function AboutSection() {
  const [version, setVersion] = useState(APP_VERSION);

  useEffect(() => {
    let active = true;
    bridge()
      .system.getAppInfo()
      .then((info) => {
        if (active && info?.version && info.version !== '0.0.0-dev') setVersion(info.version);
      })
      .catch(() => {
        /* on garde la version injectée à la construction */
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Panel icon={Info} title={tr('hist.settings.aPropos')} subtitle="Version, historique des mises à jour et identité de l’application.">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
          <div className="flex flex-col gap-2">
            <Logo height={30} showAppName />
            <p className="text-xs text-text-muted">
              {ABOUT_TAGLINE}
            </p>
            {IS_BUSINESS && (
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
                {BRAND_SIGNATURE}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Version</p>
            <p className="font-mono text-lg font-semibold text-text-primary">{version}</p>
          </div>
        </div>

        <div>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">{tr('hist.settings.historiqueDesVersions')}</p>
          <div className="space-y-4">
            {CHANGELOG.map((entry) => (
              <div key={entry.version} className="border-l border-border pl-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-sm font-semibold text-text-primary">{entry.version}</span>
                  <span className="font-mono text-[11px] text-text-muted">{entry.date}</span>
                  {entry.title && <span className="text-xs text-text-secondary">— {entry.title}</span>}
                </div>
                <ul className="mt-1.5 space-y-1">
                  {entry.changes.map((change, i) => (
                    <li key={i} className="flex gap-2 text-xs text-text-secondary">
                      <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-muted" />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function StartupSection() {
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    bridge()
      .system.getAutoLaunch()
      .then((v) => active && setAutoLaunch(v))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const toggle = async () => {
    const next = !autoLaunch;
    setAutoLaunch(next); // optimistic
    const confirmed = await bridge().system.setAutoLaunch(next);
    setAutoLaunch(confirmed);
  };

  return (
    <Panel
      icon={Power}
      title={tr('hist.settings.demarrage')}
      subtitle={`Lancer ${EDITION_PRODUCT_NAME} automatiquement, discrètement en arrière-plan.`}
    >
      {loading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-text-primary">{tr('hist.settings.demarrerAvecWindows')}</p>
            <p className="text-xs text-text-muted">{tr('hist.settings.lAppDemarreEn')}</p>
          </div>
          <Toggle on={autoLaunch} onClick={toggle} label={tr('hist.settings.demarrerAvecWindows')} />
        </div>
      )}
    </Panel>
  );
}

function ProfileSection({ email }: { email: string }) {
  const { TEAM_ENABLED } = useExclusive();
  const { profileFor, updateSelf } = useProfiles();
  const profile = profileFor(email);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(profile.name);
  const [presenceText, setPresenceText] = useState(profile.presenceText);
  const [savedTick, setSavedTick] = useState(false);
  /*
    Ce que dit l'écran quand l'enregistrement est REFUSÉ (BLOC 11).

    `updateSelf` rend `false` tant que le miroir n'a pas été relu — écrire un
    nom par-dessus une photo qu'on n'a pas encore lue l'effacerait. Afficher la
    coche « enregistré » dans ce cas serait un mensonge, et la personne
    quitterait l'écran en croyant sa photo posée.
  */
  const [refus, setRefus] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setPresenceText(profile.presenceText);
  }, [profile.email, profile.name, profile.presenceText]);

  const flashSaved = () => {
    setRefus(false);
    setSavedTick(true);
    window.setTimeout(() => setSavedTick(false), 1200);
  };

  /** Une écriture rendue par `updateSelf` : coche si elle a eu lieu, message sinon. */
  const rendreCompte = (enregistre: boolean) => {
    if (enregistre) flashSaved();
    else setRefus(true);
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    const dataUrl = await resizeImageToDataUrl(file, 512, 0.85);
    rendreCompte(await updateSelf(email, { photoDataUrl: dataUrl }));
  };

  const saveName = async () => {
    if (name.trim() && name !== profile.name) {
      rendreCompte(await updateSelf(email, { name: name.trim() }));
    }
  };
  const savePresence = async () => {
    if (presenceText !== profile.presenceText) {
      rendreCompte(await updateSelf(email, { presenceText: presenceText.trim() }));
    }
  };

  return (
    <Panel
      icon={UserCircle}
      title="Profil"
      subtitle={
        TEAM_ENABLED
          ? 'Votre photo et votre nom, visibles par l’équipe partout dans l’app.'
          : 'Votre photo et votre nom, tels qu’ils apparaissent dans l’application.'
      }
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative overflow-hidden rounded-full"
            title={tr('hist.settings.changerLaPhoto')}
          >
            <UserAvatar email={email} size={88} ring />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera size={20} strokeWidth={1.9} className="text-white" />
            </span>
          </button>
          {profile.photoDataUrl && (
            <button
              type="button"
              onClick={async () => {
                rendreCompte(await updateSelf(email, { photoDataUrl: '' }));
              }}
              className="font-mono text-[10px] uppercase tracking-wider text-text-muted hover:text-danger"
            >
              Retirer
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onPhoto(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>

        <div className="flex-1 space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{tr('hist.settings.nomAffiche')}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{tr('hist.settings.statutPersonnaliseOptionnel')}</span>
            <input
              value={presenceText}
              onChange={(e) => setPresenceText(e.target.value)}
              onBlur={savePresence}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              maxLength={60}
              placeholder="ex. en mission chez client"
              className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
          </label>
          <p className="font-mono text-[11px] text-text-muted">{email}</p>
          {savedTick && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1 text-xs text-success"
            >
              <Check size={13} strokeWidth={2.25} />{tr('hist.settings.enregistre')}</motion.p>
          )}
          {refus && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-warning"
            >
              Pas enregistré : votre profil n’a pas encore été relu depuis le serveur.
              Réessayez dans un instant — écrire maintenant effacerait votre photo.
            </motion.p>
          )}
        </div>
      </div>
    </Panel>
  );
}

/**
 * `remote` distingue les deux annuaires : un compte amn-api (organisation)
 * change son mot de passe sur le serveur, un compte local (poste interne, mode
 * hors-ligne) dans la base SQLite du poste. Envoyer l'un à l'autre échouerait
 * silencieusement — le mot de passe changerait là où personne ne le vérifie.
 */
function PasswordSection({ email, remote }: { email: string; remote: boolean }) {
  const { passwordFromSupport, clearPasswordFromSupport } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setMsg(null);
    if (next !== confirm) {
      setMsg({ ok: false, text: tr('hist.settings.laConfirmationNeCorrespond') });
      return;
    }
    setBusy(true);
    try {
      if (remote) {
        await bridge().remote.session.changePassword(current, next);
      } else {
        const res = await bridge().auth.changePassword({
          email,
          currentPassword: current,
          newPassword: next,
        });
        if (!res.ok) throw new Error(res.error ?? 'Échec de la mise à jour.');
      }
      setMsg({ ok: true, text: tr('hist.settings.motDePasseMis') });
      // Le serveur a déjà baissé le drapeau ; on l'éteint ici pour que le
      // bandeau disparaisse dans le même geste que la validation.
      clearPasswordFromSupport();
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setMsg({ ok: false, text: cleanErrorMessage(err, 'Échec de la mise à jour.') });
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void) => (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(e) => set(e.target.value)}
        className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
      />
    </label>
  );

  return (
    <Panel icon={KeyRound} title="Mot de passe" subtitle="Changez votre mot de passe (minimum 8 caractères).">
      {/*
        LE RAPPEL QUE LE MESSAGE FAISAIT SEUL.

        Le courriel de remise dit « changez-le dès votre première connexion ».
        L'application ne le rappelait nulle part — la consigne ne tenait donc
        qu'à la mémoire de quelqu'un qui lit un message une seule fois, à
        propos d'un mot de passe qui a voyagé par courriel et que deux
        personnes connaissent.

        Il n'y a PAS de bouton pour le fermer, et c'est voulu : ce qui le fait
        disparaître est le geste lui-même. Un avertissement qu'on peut chasser
        d'un clic finit par se chasser d'un clic.
      */}
      {passwordFromSupport && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 border border-warning/50 bg-warning-muted px-3 py-2.5"
        >
          <AlertTriangle size={15} strokeWidth={2} className="mt-px flex-shrink-0 text-warning" />
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-text-primary">
            <span className="font-semibold">{tr('hist.settings.ceMotDePasse')}</span> Il vous a été
            envoyé par message, donc il est écrit quelque part et une autre personne le connaît.
            Choisissez-en un vous-même ci-dessous — ce sera le seul à ne pas avoir circulé.
          </p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {field('Actuel', current, setCurrent)}
        {field('Nouveau', next, setNext)}
        {field('Confirmer', confirm, setConfirm)}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !current || !next || !confirm}
          className="flex items-center gap-2 bg-accent px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Mettre à jour
        </button>
        {msg && <span className={`text-xs ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</span>}
      </div>
    </Panel>
  );
}

/*
  LA LISTE VIENT DE L'ÉDITION, ELLE N'EST PLUS ÉCRITE ICI.

  Elle l'était, et elle décrivait un autre produit que celui qu'une cliente a
  sous les yeux : site supervisé hors ligne, attaque détectée, mention dans un
  fil d'équipe, tâche assignée par quelqu'un. Quatre événements dont AUCUN ne
  peut lui arriver — elle n'a ni parc de sites, ni équipe. Quatre
  interrupteurs sans effet, donc, et pas de réglage pour le rappel de
  rendez-vous, qui est la seule notification qu'elle reçoive vraiment.

  Un écran de réglages qui ne correspond pas à ce qu'on vit apprend surtout à
  ne plus lire les réglages. Voir NOTIFICATION_PREFS dans @edition/exclusive.
*/
/*
  Les trois règles sont RECOPIÉES d'`AppointmentReminders`, pas devinées :
  préavis réglé par rendez-vous (30 min à l'ouverture du formulaire, zéro pour
  aucun rappel), abandon au-delà de cinq minutes de retard, et liste des
  rappels déjà émis conservée pour qu'un redémarrage ne les refasse pas sonner.
*/
const REGLES_DU_RAPPEL = [
  {
    terme: 'Préavis',
    texte:
      'Réglé rendez-vous par rendez-vous, dans l’agenda — 30 minutes à l’ouverture du formulaire. À zéro, aucun rappel.',
  },
  {
    terme: 'Retard',
    texte:
      'Un rappel en retard de plus de cinq minutes est abandonné : ouvrir l’application le soir ne déclenche pas la journée écoulée.',
  },
  {
    terme: 'Doublon',
    texte: 'Un rappel déjà émis ne sonne pas deux fois, même après un redémarrage.',
  },
];

function NotificationsSection({ email }: { email: string }) {
  const { NOTIFICATION_PREFS } = useExclusive();
  const { appointments } = useAppointments();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    bridge()
      .prefs.get(email)
      .then((p) => active && setPrefs(p))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [email]);

  const toggle = async (key: keyof NotificationPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await bridge().prefs.update(email, { [key]: next[key] });
  };

  /*
    L'APERÇU EST CONSTRUIT COMME LA VRAIE NOTIFICATION, PAS COMME UNE IMAGE.

    Titre et corps reprennent exactement la composition d'`AppointmentReminders`
    — `Rendez-vous <relatif>`, puis heure, intitulé, client et lieu joints par
    des points médians. Un aperçu écrit à part se serait décalé du vrai texte au
    premier changement de l'un des deux, et un aperçu faux est pire que pas
    d'aperçu : il promet une chose et la journée en apporte une autre.

    Sur le prochain rendez-vous réel quand il y en a un. Sinon, rien : inventer
    un rendez-vous pour illustrer reviendrait à montrer une notification qui ne
    tombera jamais.
  */
  const prochain = useMemo(() => {
    const maintenant = Date.now();
    return [...appointments]
      .filter((a) => a.status === 'scheduled' && a.reminderMin > 0 && new Date(a.startAt).getTime() > maintenant)
      .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
  }, [appointments]);

  /*
    LE TITRE EST CELUI QUE LA NOTIFICATION PORTERA, PAS UN DÉLAI D'ATTENTE.

    `relativeToNow` est appelé par le moteur AU MOMENT de l'émission, donc
    toujours à `reminderMin` minutes du rendez-vous : la notification dira
    « dans 30 min », quel que soit le jour où on regarde ce réglage.

    Deux versions fausses avant celle-ci, pour la même raison — avoir daté
    l'aperçu d'un instant plutôt que d'un ÉCART. Mesuré depuis maintenant sur
    l'heure du rendez-vous, il annonçait « dans 37 h 04 » ; mesuré sur l'heure
    de déclenchement, « dans 36 h 25 ». Aucune des deux n'est jamais tombée
    sur un écran.

    L'écart, lui, est connu : c'est le préavis. On le lit donc tel quel, en
    posant une date à `reminderMin` minutes d'ici, ce qui redonne exactement
    la phrase du moteur sans la réécrire à la main.
  */
  const apercu = prochain
    ? {
        titre: `Rendez-vous ${relativeToNow(
          new Date(Date.now() + prochain.reminderMin * 60_000).toISOString(),
        )}`,
        corps: [
          `${timeLabel(prochain.startAt)} — ${prochain.title || 'Rendez-vous'}`,
          prochain.clientName,
          prochain.location,
        ]
          .filter(Boolean)
          .join(' · '),
      }
    : null;

  return (
    <Panel
      icon={Bell}
      title={tr('hist.settings.notificationsSysteme')}
      subtitle={tr('hist.settings.unSeulEvenement')}
    >
      {loading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <div className="flex flex-col gap-4">
            {NOTIFICATION_PREFS.map(({ key, label, detail }) => (
              <div key={key} className="border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[17px] font-semibold leading-snug text-text-primary">{label}</p>
                    <p className="mt-1 text-sm leading-relaxed text-text-secondary">{detail}</p>
                  </div>
                  <Toggle on={prefs[key]} onClick={() => toggle(key)} label={label} />
                </div>

                {/*
                  LES TROIS RÈGLES DU RAPPEL, DITES OÙ ON LE RÈGLE.

                  Elles existaient, tenues par `AppointmentReminders`, et
                  n'étaient écrites que dans son en-tête : un préavis réglé
                  rendez-vous par rendez-vous, un rappel en retard abandonné,
                  un rappel déjà émis qui ne sonne pas deux fois.

                  Ne pas les dire ici, c'est laisser croire que l'interrupteur
                  gouverne tout — et faire passer pour une panne le rappel du
                  matin qui ne tombe pas le soir, alors que c'est la règle.
                */}
                {key === 'appointmentReminder' && (
                  <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[88px_1fr] sm:gap-x-5">
                    {REGLES_DU_RAPPEL.map(({ terme, texte }) => (
                      <React.Fragment key={terme}>
                        <dt className="eyebrow sm:pt-1">{terme}</dt>
                        <dd className="text-sm leading-relaxed text-text-secondary">{texte}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <div className="border border-border bg-sunken p-4">
              <p className="eyebrow">{tr('hist.settings.ceQueVousVerrez')}</p>
              {apercu ? (
                <>
                  <div className="mt-3 flex gap-3 border border-border bg-raised p-3">
                    <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[6px] border border-border text-text-secondary">
                      <Bell size={13} strokeWidth={2} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-snug text-text-primary">
                        {apercu.titre}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-text-secondary">
                        {apercu.corps}
                      </span>
                    </span>
                  </div>
                  <p className="mt-3 font-mono text-[10px] uppercase leading-relaxed tracking-wider text-text-muted">
                    {tr('hist.settings.notificationDuSysteme')}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-text-secondary">{tr('hist.settings.aucunRendezVousAVenir')}</p>
              )}
            </div>

            {/*
              CE QUI N'EXISTE PAS, DIT PLUTÔT QUE LAISSÉ DEVINER.

              Trois réglages ont été retirés parce qu'ils ne pouvaient rien
              déclencher chez une cliente qui n'a ni parc supervisé ni équipe.
              Leur retrait sans un mot laisse une question sans réponse — « je
              croyais pouvoir être prévenue si le site tombe » — et cette
              question revient, par message, faute d'être traitée à l'écran.
            */}
            <div className="border border-dashed border-border p-4">
              <p className="eyebrow">{tr('hist.settings.ceQuiNExistePasIci')}</p>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                {tr('hist.settings.siteHorsLigneAlerte')}
              </p>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

/**
 * Push notifications on mobile / PWA (A.3).
 *
 * Only shown on the web build: Electron has real OS notifications and needs
 * none of this. The button is deliberate rather than automatic because both
 * iOS and Android require the permission prompt to come from a user gesture —
 * asking on page load is silently refused, which is one of the reasons an
 * incoming call produced nothing at all on a phone.
 */
function PushSection({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'on' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Already granted on a previous visit: re-register silently. A push
  // subscription can be rotated by the browser, so this must not be one-shot.
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    void ensurePushSubscription(email).then((r) => {
      if (r.ok) setState('on');
    });
  }, [email]);

  const enable = async () => {
    setState('working');
    setMessage('');
    const result = await ensurePushSubscription(email, { force: true });
    if (result.ok) {
      setState('on');
      setMessage(
        IS_BUSINESS
          ? 'Cet appareil vous préviendra avant vos rendez-vous, même application fermée.'
          : 'Cet appareil recevra les appels et alertes, même application fermée.',
      );
      return;
    }

    /*
      « PAS DE CLÉ » N'EST PAS UN ÉCHEC POUR ELLE.

      `ensurePushSubscription` demande l'autorisation AVANT d'interroger le
      serveur (voir lib/webPush.ts). Quand le serveur n'a pas de clé VAPID,
      l'autorisation est donc déjà accordée — et c'est tout ce dont ses rappels
      de rendez-vous ont besoin, puisqu'ils sont émis par l'application
      elle-même. Seule tombe la notification application FERMÉE.

      Le message d'origine annonçait « clé VAPID absente », en rouge : un nom de
      variable de serveur, présenté comme une panne, à quelqu'un qui venait
      d'obtenir exactement ce qu'il lui fallait. Elle en aurait conclu que ses
      rappels ne marchent pas, et serait repartie.
    */
    if (result.reason === 'no-key' && IS_BUSINESS) {
      setState('on');
      setMessage(
        'Cet appareil vous préviendra avant vos rendez-vous tant que l’application est ouverte. ' +
          'Les rappels application fermée ne sont pas encore activés de notre côté.',
      );
      return;
    }

    setState('error');
    setMessage(
      {
        denied: 'Notifications refusées pour ce site — réautorisez-les dans les réglages du navigateur.',
        unsupported: 'Ce navigateur ne gère pas les notifications.',
        'no-key': 'Le serveur AMN n’a pas de clé VAPID configurée : les push sont désactivées côté serveur.',
        'not-configured': 'Session incomplète — reconnectez-vous.',
        electron: '',
        error: result.detail || 'Échec de l’enregistrement.',
      }[result.reason ?? 'error'] || 'Échec de l’enregistrement.',
    );
  };

  const test = async () => {
    try {
      const { sent, disabled } = await sendPushTest(email);
      setMessage(
        disabled
          ? 'Push désactivées côté serveur (clé VAPID absente).'
          : sent > 0
            ? `Notification de test envoyée à ${sent} appareil${sent > 1 ? 's' : ''}.`
            : 'Aucun appareil enregistré pour ce compte.',
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : tr('hist.settings.echecDuTest'));
    }
  };

  return (
    <Panel
      icon={Bell}
      title={tr('hist.settings.notificationsSurCetAppareil')}
      /*
        Le sous-titre parlait d'« un appel entrant » — une fonctionnalité d'AMN
        DevSec, que la cliente n'a pas. Ce bouton est pourtant le SEUL endroit
        où elle peut autoriser les notifications, et cette autorisation est ce
        dont ses rappels de rendez-vous ont besoin : décrite par une
        fonctionnalité qu'elle n'a pas, elle passait son chemin, et ne recevait
        plus jamais de rappel. L'autorisation ne se redemande pas depuis un
        minuteur (iOS l'exige au geste), donc l'occasion manquée l'était pour de
        bon.
      */
      subtitle={
        IS_BUSINESS
          ? 'À autoriser une fois, pour recevoir vos rappels de rendez-vous sur cet appareil.'
          : 'Nécessaire pour être prévenu d’un appel entrant quand l’application est fermée.'
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void enable()}
          disabled={state === 'working'}
          className="rounded-lg border border-border-strong px-3 py-2 text-xs font-medium uppercase tracking-wider text-text-primary transition-colors hover:bg-accent-muted disabled:opacity-50"
        >
          {state === 'on' ? 'Réenregistrer cet appareil' : 'Autoriser les notifications'}
        </button>
        {state === 'on' && (
          <button
            type="button"
            onClick={() => void test()}
            className="rounded-lg border border-border px-3 py-2 text-xs uppercase tracking-wider text-text-secondary transition-colors hover:text-text-primary"
          >{tr('hist.settings.envoyerUnTest')}</button>
        )}
      </div>
      {message && (
        <p className={`mt-3 text-xs ${state === 'error' ? 'text-danger' : 'text-text-muted'}`}>
          {message}
        </p>
      )}
    </Panel>
  );
}

/**
 * Un interrupteur — qui DIT ce qu'il commande.
 *
 * Il ne le disait pas : `role="switch"` et `aria-checked`, mais aucun nom. Un
 * lecteur d'écran annonçait donc « interrupteur, activé » sans jamais dire de
 * quoi, et il y en a quatre à la suite sur cet écran. Le libellé est à côté,
 * visuellement — ce qui suffit à l'œil et ne suffit à rien d'autre.
 */
function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      /*
        LA PASTILLE FAIT 20 × 36, LA CIBLE FAIT 36 × 52.

        L'interrupteur visuel garde sa taille — c'est la convention, et le
        grossir le rendrait grossier. Mais ce qu'on TOUCHE n'a pas à être ce
        qu'on voit : le bouton porte le rembourrage, la pastille n'est qu'un
        `<span>` à l'intérieur. `-m-2` rend au voisinage ce que `p-2` a pris,
        donc rien ne bouge à l'écran.

        Vingt pixels de haut, c'est sous le minimum de WCAG 2.5.8 (24), et il
        y en a quatre à la suite sur cet écran : rater le bon en bascule un
        autre, et on ne s'en aperçoit pas tout de suite.
      */
      className="-m-2 flex-shrink-0 p-2"
    >
      <span
        className={`relative block h-5 w-9 rounded-full border transition-colors ${
          on ? 'border-accent bg-accent' : 'border-border-strong bg-transparent'
        }`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 34 }}
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full ${on ? 'right-0.5 bg-bg' : 'left-0.5 bg-text-muted'}`}
        />
      </span>
    </button>
  );
}
