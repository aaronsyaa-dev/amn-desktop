import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useSync, useCollection, uid, stripMeta } from './SyncContext';

/**
 * Notes (Bloc 2). Two scopes:
 *  - TEAM notes are shared and live-synced, via the `notes` collection (same
 *    path as tasks/decisions/knowledge) — both operators see edits in real time.
 *  - PERSONAL notes are private and MUST NOT touch the shared API, so they live
 *    in localStorage keyed by the operator's email. (Routing them through the
 *    synced collection would broadcast them to the other operator, breaking
 *    "non partagées".) The trade-off: personal notes stay on this machine.
 *
 * Scope is encoded in the id prefix (`tnote-` / `pnote-`) so every operation can
 * route without a separate lookup.
 */

export interface Note {
  id: string;
  scope: 'team' | 'personal';
  title: string;
  body: string;
  authorEmail: string;
  pinned: boolean;
  /**
   * Projet auquel cet enregistrement se rattache (A.3), ou absent.
   *
   * Un simple identifiant : le projet ne tient aucune liste et ne recopie
   * rien — il retrouve ce qui le concerne en filtrant cette collection. Cet
   * enregistrement garde donc un seul endroit où il vit.
   */
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

interface TeamNoteData {
  title: string;
  body: string;
  authorEmail: string;
  pinned: boolean;
  /** Projet lié (A.3). Optionnel : la grande majorité des notes n'en a pas. */
  projectId?: string;
  createdAt: string;
}

type PersonalNote = Omit<Note, 'scope'>;

const personalKey = (email: string) => `amn.notes.personal.${email}`;

function readPersonal(email: string): PersonalNote[] {
  try {
    const raw = window.localStorage.getItem(personalKey(email));
    return raw ? (JSON.parse(raw) as PersonalNote[]) : [];
  } catch {
    return [];
  }
}

export function useNotes() {
  const { user } = useAuth();
  const email = user?.email ?? 'anon';
  const { upsert, remove } = useSync();
  const teamRaw = useCollection<TeamNoteData>('notes');

  const [personal, setPersonal] = useState<PersonalNote[]>(() => readPersonal(email));
  useEffect(() => setPersonal(readPersonal(email)), [email]);

  const persistPersonal = useCallback(
    (next: PersonalNote[]) => {
      setPersonal(next);
      try {
        window.localStorage.setItem(personalKey(email), JSON.stringify(next));
      } catch {
        /* storage full — keep in memory for this session */
      }
    },
    [email],
  );

  const notes = useMemo<Note[]>(() => {
    const team: Note[] = teamRaw.map((n) => ({
      id: n.id,
      scope: 'team',
      title: n.title ?? '',
      body: n.body ?? '',
      authorEmail: n.authorEmail ?? '',
      pinned: Boolean(n.pinned),
      projectId: n.projectId,
      createdAt: n.createdAt ?? n.updatedAt,
      updatedAt: n.updatedAt,
    }));
    const perso: Note[] = personal.map((n) => ({ ...n, scope: 'personal' }));
    return [...team, ...perso].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || (b.updatedAt || '').localeCompare(a.updatedAt || ''),
    );
  }, [teamRaw, personal]);

  const createNote = useCallback(
    (scope: 'team' | 'personal'): string => {
      const now = new Date().toISOString();
      if (scope === 'team') {
        const id = uid('tnote');
        upsert('notes', id, {
          title: '',
          body: '',
          authorEmail: email,
          pinned: false,
          createdAt: now,
        } satisfies TeamNoteData);
        return id;
      }
      const id = uid('pnote');
      persistPersonal([
        { id, title: '', body: '', authorEmail: email, pinned: false, createdAt: now, updatedAt: now },
        ...personal,
      ]);
      return id;
    },
    [email, upsert, persistPersonal, personal],
  );

  /*
    La portée d'une note se LIT, elle ne se devine pas.

    Ces deux fonctions déduisaient la portée du préfixe de l'identifiant
    (`tnote-` / `pnote-`). Cela ne vaut que pour les notes créées par cette
    version du code : une note d'équipe restaurée d'une sauvegarde, importée,
    ou écrite par une version antérieure porte un autre identifiant, tombait
    dans la branche « personnelle », et sa suppression allait chercher dans le
    stockage local une note qui n'y est pas. Résultat : elle ne pouvait être ni
    modifiée ni supprimée, en silence — le bug « Elie Sy », sur un autre écran.

    On interroge donc la collection d'équipe elle-même, qui est la seule à
    savoir ce qu'elle contient.
  */
  const isTeamNote = useCallback((id: string) => teamRaw.some((n) => n.id === id), [teamRaw]);

  const updateNote = useCallback(
    (id: string, patch: { title?: string; body?: string; pinned?: boolean }) => {
      if (isTeamNote(id)) {
        const current = teamRaw.find((n) => n.id === id);
        if (!current) return;
        upsert('notes', id, {
          ...stripMeta(current),
          title: patch.title ?? current.title ?? '',
          body: patch.body ?? current.body ?? '',
          pinned: patch.pinned ?? Boolean(current.pinned),
        });
      } else {
        persistPersonal(
          personal.map((n) =>
            n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n,
          ),
        );
      }
    },
    [isTeamNote, teamRaw, upsert, personal, persistPersonal],
  );

  const togglePin = useCallback(
    (note: Note) => updateNote(note.id, { pinned: !note.pinned }),
    [updateNote],
  );

  const deleteNote = useCallback(
    (id: string) => {
      if (isTeamNote(id)) remove('notes', id);
      else persistPersonal(personal.filter((n) => n.id !== id));
    },
    [isTeamNote, remove, personal, persistPersonal],
  );

  return { notes, createNote, updateNote, togglePin, deleteNote };
}
