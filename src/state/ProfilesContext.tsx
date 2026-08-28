import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useSync, useCollection } from './SyncContext';
import { useClientView } from './ClientViewContext';
import type { UpdateProfileInput, UserProfile } from '../shared/api';

/**
 * Operator profiles (name, photo, custom presence text). Backed by the synced
 * `profiles` collection so a photo one operator uploads is visible to the other
 * everywhere (messages, tasks, decisions, presence, account). Keyed by email.
 */

interface ProfileData {
  name: string;
  photoDataUrl: string;
  presenceText: string;
  /**
   * ISO timestamp of the last time this operator opened the Équipe tab.
   * Shared (it lives on the synced profile) so the OTHER operator can tell
   * whether their messages have been read — the read-receipt signal (A3.1).
   */
  teamSeenAt?: string;
}

interface ProfilesContextValue {
  profiles: UserProfile[];
  profileFor: (email: string) => UserProfile;
  /**
   * Enregistre une modification du profil. Rend `false` — sans rien écrire —
   * quand le miroir n'est pas encore fiable : voir `miroirFiable` plus bas.
   * L'écran doit dire « pas enregistré » plutôt que d'afficher une coche.
   */
  updateSelf: (email: string, patch: UpdateProfileInput) => Promise<boolean>;
  /** Marks the Équipe tab as read now for this operator (read receipts). */
  markTeamSeen: (email: string) => void;
  /** When the given operator last opened the Équipe tab, or null if never. */
  teamSeenAt: (email: string) => string | null;
}

const ProfilesContext = createContext<ProfilesContextValue | undefined>(undefined);

/**
 * Majuscule à CHAQUE mot, pas seulement au premier.
 *
 * `marie.dupont` → « Marie Dupont », et non « Marie dupont ». Ces noms sont
 * dérivés d'une adresse tant que la personne n'a pas rempli son profil : ils
 * s'affichent donc partout, y compris sur son premier écran. Écorcher un nom
 * de famille est une petite faute qui se voit beaucoup.
 */
function titleCase(s: string): string {
  return s
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .map((mot) => (mot ? mot[0].toUpperCase() + mot.slice(1) : mot))
    .join(' ');
}

/**
 * Normalises any value that is *supposed* to be an operator email.
 *
 * Deliberately total: `profileFor(task.assigneeEmail)` is called from a dozen
 * screens, and a single record with a missing author — a task synced before
 * the field existed, an import, a half-written row — used to throw on
 * `.trim()` and take the whole screen down through the error boundary. One
 * incomplete row must never cost the operator an entire tab.
 */
function normaliseEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * Le préfixe d'un visiteur anonyme dans la signalisation d'appel (BLOC B.2).
 * Il ne peut collisionner avec aucune adresse : le deux-points est interdit
 * dans la partie locale non citée d'une adresse email.
 */
const GUEST_PREFIX = 'visiteur:';

function fallbackProfile(email: string): UserProfile {
  // Un visiteur anonyme n'a pas d'adresse, et son identifiant de liaison n'est
  // pas un nom : l'afficher tel quel donnerait « Visiteur:3f2a-… » à l'écran.
  // Traité ici plutôt que dans l'écran d'appel, pour que l'avatar, la liste des
  // appels manqués et la notification disent tous la même chose.
  if (email.startsWith(GUEST_PREFIX)) {
    return { email, name: 'Visiteur', photoDataUrl: '', presenceText: 'Appel par lien', updatedAt: '' };
  }
  return {
    email,
    // An empty key means the record never named anyone — say so rather than
    // rendering a blank avatar with no name.
    name: email ? titleCase(email.split('@')[0] || email) : 'Non attribué',
    photoDataUrl: '',
    presenceText: '',
    updatedAt: '',
  };
}

export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { upsert, ready, configured, pullFailed } = useSync();
  const records = useCollection<ProfileData>('profiles');

  const profiles = useMemo<UserProfile[]>(
    () =>
      records.map((r) => ({
        email: r.id,
        name: r.name || titleCase(r.id.split('@')[0]),
        photoDataUrl: r.photoDataUrl || '',
        presenceText: r.presenceText || '',
        updatedAt: r.updatedAt,
      })),
    [records],
  );

  // Seed only *your own* profile if it doesn't exist yet — never overwrite the
  // other operator's row, so their photo is never clobbered by a default.
  //
  // Guarded on `!pullFailed`: a transient amn-api hiccup during the initial
  // pull can leave `records` empty in memory even though the profile — with a
  // real photo — exists on the server. Seeding in that window used to upsert
  // a blank profile straight over the real one, permanently wiping the photo
  // (last-writer-wins). Only seed once the pull is confirmed to have
  // succeeded, or when sync isn't configured at all (nothing to pull).
  // Jamais dans le dossier d'une cliente : l'opérateur n'a rien à faire dans sa
  // collection de profils. Sans ce garde-fou, ouvrir son espace y déposait une
  // fiche « Aaron / aaron@amn-devsec.com » — une trace de nous dans ses données,
  // créée par le seul fait de la dépanner.
  /*
    LA PHOTO QUI DISPARAÎT — la cause, reproduite (BLOC 11).

    Le profil est un enregistrement ENTIER : la synchronisation ne connaît pas
    les modifications partielles, tout écrit remplace tout. `baseData` relit
    donc l'enregistrement existant avant chaque écriture… et rendait un repli
    — `photoDataUrl: ''` — quand `records` ne le contenait pas encore.

    Or `markTeamSeen` s'exécute à l'ouverture de l'écran Équipe, sans attendre
    quoi que ce soit. Sur une liaison lente, l'écran monte AVANT que le miroir
    soit hydraté : le repli part alors sur le serveur et efface la photo pour
    tout le monde, en dernier écrivain.

    Reproduit, avec témoin, sur l'application réellement construite :

      · arrivée directe sur #/team, liaison normale ........ photo intacte
      · mêmes conditions, GET de synchro retardés de 3 s ... PHOTO EFFACÉE
      · idem retardés de 8 s .............................. PHOTO EFFACÉE
      · témoin : arrivée sur #/ (aucun markTeamSeen) ...... photo intacte

    Le témoin est ce qui désigne le coupable : même lenteur, même compte, même
    amorçage — seul l'écran change. Et le retard explique enfin pourquoi le bug
    s'observait depuis un téléphone.

    Le correctif est en dessous : plus aucune écriture de profil ne peut être
    bâtie sur un repli tant que le miroir n'est pas fiable. Ce n'est pas un
    garde posé sur `markTeamSeen` seul — l'accusé d'aujourd'hui — mais sur
    `baseData`, la fabrique que tous les chemins d'écriture traversent.
  */
  const miroirFiable = ready && (!configured || !pullFailed);

  const clientView = useClientView();
  useEffect(() => {
    if (clientView) return;
    if (miroirFiable && user && !records.some((r) => r.id === user.email)) {
      upsert('profiles', user.email, { name: user.name, photoDataUrl: '', presenceText: '' });
    }
  }, [clientView, miroirFiable, user, records, upsert]);

  const profileFor = useCallback(
    (email: string) => {
      const key = normaliseEmail(email);
      return profiles.find((p) => p.email === key) ?? fallbackProfile(key);
    },
    [profiles],
  );

  // Full existing profile data (preserving fields not in ProfileData's core
  // three, e.g. teamSeenAt) so no patch silently drops the read-receipt marker.
  /*
    La base d'une écriture — ou `null` quand il n'y en a pas de sûre.

    Rendre un repli pour un enregistrement absent est LÉGITIME quand le miroir
    est fiable : l'enregistrement n'existe alors réellement pas, et il n'y a
    rien à perdre. C'est quand le miroir n'est PAS fiable que le même repli
    devient un effacement, parce qu'« absent du miroir » n'y veut pas dire
    « inexistant ».

    Rendre `null` plutôt que d'écrire quand même rend l'effacement
    inexprimable, au lieu de le laisser à la vigilance de chaque appelant.
  */
  const baseData = useCallback(
    (key: string): ProfileData | null => {
      const existing = records.find((r) => r.id === key);
      if (existing) {
        return {
          name: existing.name,
          photoDataUrl: existing.photoDataUrl,
          presenceText: existing.presenceText,
          teamSeenAt: existing.teamSeenAt,
        };
      }
      if (!miroirFiable) return null;
      return { name: fallbackProfile(key).name, photoDataUrl: '', presenceText: '' };
    },
    [records, miroirFiable],
  );

  const updateSelf = useCallback(
    async (email: string, patch: UpdateProfileInput): Promise<boolean> => {
      const key = normaliseEmail(email);
      if (!key) return false; // nothing to update without an identity
      const base = baseData(key);
      // Refuser plutôt qu'écrire à l'aveugle : enregistrer un nom par-dessus
      // une photo qu'on n'a pas encore lue la supprimerait.
      if (!base) return false;
      await upsert('profiles', key, { ...base, ...patch });
      return true;
    },
    [baseData, upsert],
  );

  const markTeamSeen = useCallback(
    (email: string) => {
      const key = normaliseEmail(email);
      if (!key) return;
      const base = baseData(key);
      // Le chemin exact de la disparition. Un accusé de lecture se réémet à
      // chaque message suivant : le sauter une fois ne coûte rien, alors
      // qu'une photo effacée ne revient pas.
      if (!base) return;
      void upsert('profiles', key, { ...base, teamSeenAt: new Date().toISOString() });
    },
    [baseData, upsert],
  );

  const teamSeenAt = useCallback(
    (email: string): string | null => {
      const key = normaliseEmail(email);
      if (!key) return null;
      return records.find((r) => r.id === key)?.teamSeenAt ?? null;
    },
    [records],
  );

  const value = useMemo(
    () => ({ profiles, profileFor, updateSelf, markTeamSeen, teamSeenAt }),
    [profiles, profileFor, updateSelf, markTeamSeen, teamSeenAt],
  );

  return <ProfilesContext.Provider value={value}>{children}</ProfilesContext.Provider>;
}

export function useProfiles(): ProfilesContextValue {
  const ctx = useContext(ProfilesContext);
  if (!ctx) throw new Error('useProfiles must be used within a ProfilesProvider');
  return ctx;
}
