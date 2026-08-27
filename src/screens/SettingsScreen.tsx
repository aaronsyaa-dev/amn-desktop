import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Bell, Camera, Check, Download, Info, KeyRound, Loader2, Power, UserCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useProfiles } from '../state/ProfilesContext';
import { bridge } from '../lib/bridge';
import { cleanErrorMessage } from '../lib/errorMessage';
import { downloadBackup } from '../lib/backup';
import { resizeImageToDataUrl } from '../lib/imageResize';
import { ensurePushSubscription, sendPushTest } from '../lib/webPush';
import { UserAvatar } from '../components/UserAvatar';
import { Logo } from '../components/Logo';
import { SettingsPanel as Panel } from '../components/SettingsPanel';
import { ModulesSection } from '../components/settings/ModulesSection';
import { APP_VERSION, EDITION_PRODUCT_NAME, IS_BUSINESS } from '../edition/edition';
import { OllamaSection, useExclusive } from '@edition/exclusive';
import { AccountSecuritySection } from '../components/settings/AccountSecuritySection';
import { MfaSection } from '../components/settings/MfaSection';
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
import { useSupportContext } from '../state/OrgContextContext';

export function SettingsScreen() {
  const { user, org } = useAuth();
  // `support` vaut null hors contexte client. Lu ici plutôt que dans la section
  // elle-même : c'est l'écran qui sait dans quel contexte il est monté.
  const support = useSupportContext();

  if (!user) return null;

  return (
    <StaggerGroup className="flex flex-col gap-6">
      <StaggerItem>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">Paramètres</h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-muted">
            Profil · sécurité · notifications
          </p>
        </div>
      </StaggerItem>

      <StaggerItem>
        <ProfileSection email={user.email} />
      </StaggerItem>
      <StaggerItem>
        <PasswordSection email={user.email} remote={org !== null} />
      </StaggerItem>
      <StaggerItem>
        <NotificationsSection email={user.email} />
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
          <AccentSection />
        </StaggerItem>
      )}
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
        <UpdateSection />
      </StaggerItem>
      {!bridge().env.isElectron && (
        <StaggerItem>
          <PushSection email={user.email} />
        </StaggerItem>
      )}
      {bridge().env.isElectron && (
        <StaggerItem>
          <OllamaSection />
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
      {!support && (
        <StaggerItem>
          <ModulesSection />
        </StaggerItem>
      )}
      <StaggerItem>
        <BackupSection />
      </StaggerItem>
      <StaggerItem>
        <AboutSection />
      </StaggerItem>
    </StaggerGroup>
  );
}

function BackupSection() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const run = async () => {
    setBusy(true);
    setDone(false);
    try {
      await downloadBackup();
      setDone(true);
      window.setTimeout(() => setDone(false), 2500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      icon={Download}
      title="Mes données"
      subtitle="Emportez une copie de tout ce que contient votre espace, dans un seul fichier."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/*
          Le sous-titre énumérait « clients, devis, tâches, messages… » — la
          liste de ce que l'export contenait VRAIMENT, à savoir neuf
          collections sur vingt-deux, et pas celles d'une cliente. Il ne
          promet plus une énumération qu'il faudrait tenir à jour : il promet
          tout, et c'est le serveur qui tient la liste (voir lib/backup.ts).
        */}
        <p className="text-xs text-text-muted">
          Un fichier JSON, à conserver en lieu sûr : vos fiches, vos documents et vos réglages
          y sont. Le coffre-fort en est absent — il ne quitte pas cet appareil.
        </p>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="flex items-center gap-2 border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-40"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : done ? <Check size={14} /> : <Download size={14} />}
          {busy ? 'Export…' : done ? 'Exporté' : 'Exporter mes données'}
        </button>
      </div>
    </Panel>
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
    <Panel icon={Info} title="À propos" subtitle="Version, historique des mises à jour et identité de l’application.">
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
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Historique des versions
          </p>
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
      title="Démarrage"
      subtitle={`Lancer ${EDITION_PRODUCT_NAME} automatiquement, discrètement en arrière-plan.`}
    >
      {loading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-text-primary">Démarrer avec Windows</p>
            <p className="text-xs text-text-muted">
              L’app démarre en arrière-plan à l’ouverture de session et reste dans la barre système.
            </p>
          </div>
          <Toggle on={autoLaunch} onClick={toggle} label="Démarrer avec Windows" />
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

  useEffect(() => {
    setName(profile.name);
    setPresenceText(profile.presenceText);
  }, [profile.email, profile.name, profile.presenceText]);

  const flashSaved = () => {
    setSavedTick(true);
    window.setTimeout(() => setSavedTick(false), 1200);
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    const dataUrl = await resizeImageToDataUrl(file, 512, 0.85);
    await updateSelf(email, { photoDataUrl: dataUrl });
    flashSaved();
  };

  const saveName = async () => {
    if (name.trim() && name !== profile.name) {
      await updateSelf(email, { name: name.trim() });
      flashSaved();
    }
  };
  const savePresence = async () => {
    if (presenceText !== profile.presenceText) {
      await updateSelf(email, { presenceText: presenceText.trim() });
      flashSaved();
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
            title="Changer la photo"
          >
            <UserAvatar email={email} size={88} ring />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera size={20} strokeWidth={1.75} className="text-white" />
            </span>
          </button>
          {profile.photoDataUrl && (
            <button
              type="button"
              onClick={async () => {
                await updateSelf(email, { photoDataUrl: '' });
                flashSaved();
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
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Nom affiché</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Statut personnalisé (optionnel)
            </span>
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
              <Check size={13} strokeWidth={2.25} /> Enregistré
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
      setMsg({ ok: false, text: 'La confirmation ne correspond pas.' });
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
      setMsg({ ok: true, text: 'Mot de passe mis à jour.' });
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
            <span className="font-semibold">Ce mot de passe n’est pas le vôtre.</span> Il vous a été
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
function NotificationsSection({ email }: { email: string }) {
  const { NOTIFICATION_PREFS } = useExclusive();
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

  return (
    <Panel
      icon={Bell}
      title="Notifications système"
      subtitle="Choisissez les événements qui déclenchent une notification de bureau."
    >
      {loading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <div className="divide-y divide-border/60">
          {NOTIFICATION_PREFS.map(({ key, label, detail }) => (
            <div key={key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-text-primary">{label}</p>
                <p className="text-xs text-text-muted">{detail}</p>
              </div>
              <Toggle on={prefs[key]} onClick={() => toggle(key)} label={label} />
            </div>
          ))}
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
      setMessage(err instanceof Error ? err.message : 'Échec du test.');
    }
  };

  return (
    <Panel
      icon={Bell}
      title="Notifications sur cet appareil"
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
          >
            Envoyer un test
          </button>
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
      className={`relative h-5 w-9 flex-shrink-0 rounded-full border transition-colors ${
        on ? 'border-accent bg-accent' : 'border-border-strong bg-transparent'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 34 }}
        className={`absolute top-0.5 h-3.5 w-3.5 rounded-full ${on ? 'right-0.5 bg-bg' : 'left-0.5 bg-text-muted'}`}
      />
    </button>
  );
}
