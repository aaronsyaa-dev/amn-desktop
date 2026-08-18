import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useSync, useCollection, uid, stripMeta } from './SyncContext';
import { IS_BUSINESS } from '../edition/edition';

/**
 * Notes (Bloc 2). Deux portées — mais une seule dans l'édition Business.
 *
 *  - ÉQUIPE : partagée et synchronisée, via la collection `notes`. Le serveur
 *    la détient, donc elle survit à une réinstallation, se lit depuis le
 *    téléphone, et figure dans l'export de portabilité.
 *  - PERSONNELLE : privée, donc elle ne PEUT PAS passer par la collection
 *    partagée — l'y router la diffuserait à l'autre opérateur, ce qui est
 *    exactement ce que « non partagée » interdit. Elle vit donc dans le
 *    localStorage, et le prix de cette confidentialité est qu'elle reste sur
 *    cette machine.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI ELLE N'EXISTE PAS DANS L'ÉDITION BUSINESS (BLOC B)
 *
 * Ce compromis se défend entre deux opérateurs qui partagent une organisation :
 * on choisit sciemment la confidentialité contre la durabilité. Il ne se
 * défend PAS chez une cliente, pour deux raisons cumulées :
 *
 *   1. elle est seule dans son organisation. « Non partagée » ne la protège de
 *      personne — il n'y a personne. Le compromis n'achète donc rien, et coûte
 *      tout : note invisible depuis son téléphone, effacée par une
 *      réinstallation, absente de l'export de ses données ;
 *   2. l'écran ne LUI DIT PAS. Le badge de portée est masqué en Business
 *      (`!TEAM_ENABLED ? null`), donc deux notes côte à côte, visuellement
 *      identiques, dont l'une seulement survivrait à un changement de machine.
 *
 * C'est le défaut exact de la photo de profil — la même donnée à deux endroits,
 * dont un que le serveur ignore. Il est ici fermé À LA SOURCE plutôt qu'au
 * bouton : `createNote` ignore la portée demandée quand il n'y a pas d'équipe.
 * Un futur appelant ne peut donc pas rouvrir la brèche par inadvertance.
 *
 * Les notes personnelles déjà écrites ne sont pas abandonnées pour autant :
 * l'effet de reprise ci-dessous les remonte une fois vers le serveur, puis vide
 * le stockage local. Supprimer sans remonter aurait été la perte de données
 * qu'on cherche justement à empêcher.
 *
 * La portée se LIT depuis la collection d'équipe, jamais depuis le préfixe de
 * l'identifiant (voir `isTeamNote`).
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

  /*
    LA REPRISE DES NOTES PERSONNELLES DÉJÀ ÉCRITES (BLOC B).

    Fermer la porte ne suffit pas : quelqu'un peut déjà être derrière. Une
    cliente qui a écrit des notes personnelles avec une version antérieure les
    verrait disparaître de l'écran à la mise à jour — précisément le scénario
    qu'on veut rendre impossible.

    Elles sont donc remontées vers le serveur, puis retirées du stockage local.
    L'ordre compte : on n'efface qu'après avoir écrit. `upsert` est optimiste et
    la file de synchronisation garde ce qu'elle n'a pas encore pu envoyer, donc
    même hors ligne la note existe côté état partagé avant que la copie locale
    parte. Le drapeau `migrated` évite de rejouer la reprise à chaque rendu.
  */
  const migrated = useRef(false);
  useEffect(() => {
    if (!IS_BUSINESS || migrated.current || personal.length === 0) return;
    migrated.current = true;
    for (const note of personal) {
      upsert('notes', note.id, {
        title: note.title ?? '',
        body: note.body ?? '',
        authorEmail: note.authorEmail || email,
        pinned: Boolean(note.pinned),
        projectId: note.projectId,
        createdAt: note.createdAt ?? note.updatedAt,
      } satisfies TeamNoteData);
    }
    persistPersonal([]);
  }, [personal, upsert, email, persistPersonal]);

  const createNote = useCallback(
    (scopeDemande: 'team' | 'personal'): string => {
      /*
        La portée demandée est IGNORÉE quand il n'y a pas d'équipe.

        Le garde est ici, et pas dans l'écran, parce que l'écran n'est pas le
        seul appelant possible — et parce qu'un bouton corrigé se re-casse à la
        prochaine refonte, alors qu'une donnée qui ne peut pas être écrite au
        mauvais endroit ne se re-casse pas.
      */
      const scope = IS_BUSINESS ? 'team' : scopeDemande;
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
