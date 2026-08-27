import type { PageBlock, PageData, PageEditorRole } from '../shared/api';

/**
 * LE MOTEUR DE PAGES — LOGIQUE PURE (BLOC 3)
 * ══════════════════════════════════════════
 *
 * Tout ce qui peut être faux sans qu'on le voie vit ici, séparé de l'écran :
 * la forme d'un tableau, l'ordre des blocs, le droit de modifier. `npm run
 * check:pages` éprouve ces règles, et chacune y est éprouvée par mutation.
 *
 * ## Pourquoi une normalisation, et pas de la confiance
 *
 * Une page arrive de la synchronisation, donc d'une AUTRE machine, écrite par
 * une autre version de l'application. Un tableau dont une ligne a trois
 * cellules pour quatre colonnes rendrait une cellule `undefined` — et
 * `undefined` dans un `<td>` ne plante pas, il s'affiche vide, ce qui se lit
 * comme une donnée manquante plutôt que comme un défaut. On ne fait donc pas
 * confiance à la forme reçue : on la remet d'équerre à la lecture.
 */

/** Identifiant court, suffisant pour distinguer des blocs dans une page. */
export function blockId(prefix = 'b'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Remet une page reçue d'équerre.
 *
 * Ne jette RIEN : un bloc d'un type inconnu (écrit par une version plus
 * récente) est conservé tel quel en mémoire et simplement ignoré à l'affichage.
 * Le supprimer ferait qu'ouvrir la page sur un poste en retard EFFACERAIT du
 * contenu chez tout le monde à la première modification — la pire panne
 * possible pour un document partagé.
 */
export function normalizePage(raw: Partial<PageData> | null | undefined): PageData {
  const blocs = Array.isArray(raw?.blocks) ? raw!.blocks : [];
  return {
    title: typeof raw?.title === 'string' && raw.title.trim() ? raw.title : 'Sans titre',
    icon: typeof raw?.icon === 'string' ? raw.icon : undefined,
    blocks: blocs.map(normalizeBlock),
    editorRoles: normalizeRoles(raw?.editorRoles),
    scope: typeof raw?.scope === 'string' ? raw.scope : undefined,
    template: typeof raw?.template === 'string' ? raw.template : undefined,
    updatedBy: typeof raw?.updatedBy === 'string' ? raw.updatedBy : undefined,
  };
}

function normalizeBlock(bloc: PageBlock): PageBlock {
  if (!bloc || typeof bloc !== 'object') return { id: blockId(), type: 'text', text: '' };
  if (bloc.type === 'table') {
    // La largeur fait foi : chaque ligne est tronquée ou complétée pour porter
    // exactement autant de cellules qu'il y a de colonnes. C'est ce qui rend
    // « ajouter une colonne » sûr sur une page déjà remplie.
    const columns = Array.isArray(bloc.columns) && bloc.columns.length > 0 ? bloc.columns : ['Colonne'];
    const rows = Array.isArray(bloc.rows) ? bloc.rows : [];
    return {
      ...bloc,
      columns,
      rows: rows.map((ligne) => {
        const cellules = Array.isArray(ligne) ? ligne : [];
        return columns.map((_, i) => (typeof cellules[i] === 'string' ? cellules[i] : ''));
      }),
    };
  }
  if (bloc.type === 'checklist') {
    const items = Array.isArray(bloc.items) ? bloc.items : [];
    return {
      ...bloc,
      items: items.map((it) => ({
        id: typeof it?.id === 'string' ? it.id : blockId('i'),
        text: typeof it?.text === 'string' ? it.text : '',
        done: Boolean(it?.done),
      })),
    };
  }
  return bloc;
}

/**
 * Les rôles autorisés à modifier.
 *
 * `owner` est TOUJOURS ajouté, et ce n'est pas une commodité : sans lui, une
 * page pourrait être enregistrée avec une liste vide — ou une liste ne citant
 * qu'un rôle que plus personne ne porte — et deviendrait alors impossible à
 * corriger par qui que ce soit, y compris la propriétaire de l'organisation.
 * Une porte fermée à clé de l'intérieur, sans serrure.
 */
export function normalizeRoles(roles: unknown): PageEditorRole[] {
  const connus: PageEditorRole[] = ['owner', 'admin', 'member'];
  const liste = Array.isArray(roles) ? roles : [];
  const gardés = connus.filter((r) => liste.includes(r));
  return gardés.includes('owner') ? gardés : ['owner', ...gardés];
}

/** Ce rôle peut-il modifier cette page ? La lecture, elle, n'est jamais restreinte. */
export function canEditPage(role: string | null | undefined, page: PageData): boolean {
  if (!role) return false;
  return normalizeRoles(page.editorRoles).includes(role as PageEditorRole);
}

/**
 * Déplace un bloc d'un cran.
 *
 * Rend la liste inchangée quand le mouvement sort du document, plutôt que de
 * la réordonner de travers : un bouton « monter » sur le premier bloc ne doit
 * rien faire, pas l'envoyer à la fin.
 */
export function moveBlock(blocks: PageBlock[], index: number, direction: -1 | 1): PageBlock[] {
  const cible = index + direction;
  if (index < 0 || index >= blocks.length || cible < 0 || cible >= blocks.length) return blocks;
  const copie = [...blocks];
  [copie[index], copie[cible]] = [copie[cible], copie[index]];
  return copie;
}

/** Un bloc vide du type demandé, prêt à être rempli. */
export function emptyBlock(type: PageBlock['type']): PageBlock {
  const id = blockId();
  switch (type) {
    case 'image':
      return { id, type: 'image', url: '' };
    case 'video':
      return { id, type: 'video', url: '' };
    case 'checklist':
      return { id, type: 'checklist', items: [{ id: blockId('i'), text: '', done: false }] };
    case 'table':
      return { id, type: 'table', columns: ['Colonne 1', 'Colonne 2'], rows: [['', '']] };
    default:
      return { id, type: 'text', text: '' };
  }
}

/**
 * Ajoute une colonne SANS abîmer les lignes déjà saisies.
 *
 * Écrit ici plutôt que dans l'écran parce que c'est exactement l'opération qui
 * se fait de travers : allonger `columns` sans allonger chaque `row` laisse un
 * tableau incohérent que `normalizePage` réparerait en silence au prochain
 * chargement — donc un défaut invisible jusqu'à ce qu'il efface une cellule.
 */
export function addColumn(bloc: Extract<PageBlock, { type: 'table' }>, nom: string) {
  return {
    ...bloc,
    columns: [...bloc.columns, nom],
    rows: bloc.rows.map((ligne) => [...ligne, '']),
  };
}

/** Retire une colonne, et la cellule correspondante de chaque ligne. */
export function removeColumn(bloc: Extract<PageBlock, { type: 'table' }>, index: number) {
  if (bloc.columns.length <= 1) return bloc; // un tableau sans colonne n'est plus un tableau
  return {
    ...bloc,
    columns: bloc.columns.filter((_, i) => i !== index),
    rows: bloc.rows.map((ligne) => ligne.filter((_, i) => i !== index)),
  };
}

/* ------------------------------- Les gabarits ------------------------------ */

/**
 * Des points de départ, pas des formulaires.
 *
 * Chaque gabarit pose une structure qu'on remplit et qu'on peut démonter : ce
 * ne sont que des blocs ordinaires une fois créés. Un gabarit qui contraindrait
 * la suite deviendrait un obstacle le jour où le tournage change de lieu.
 */
export interface PageTemplate {
  id: string;
  label: string;
  description: string;
  scope?: string;
  build: () => Pick<PageData, 'title' | 'icon' | 'blocks'>;
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: 'vierge',
    label: 'Page vierge',
    description: 'Un titre, un paragraphe. À composer librement.',
    build: () => ({ title: 'Nouvelle page', icon: '📄', blocks: [emptyBlock('text')] }),
  },
  {
    id: 'production',
    label: 'Fiche de production',
    description: 'Lieu, horaires, équipe, matériel — ce qu’on relit sur le tournage.',
    build: () => ({
      title: 'Fiche de production',
      icon: '🎬',
      blocks: [
        { id: blockId(), type: 'text', text: 'Lieu, accès et horaires. Cette page est la référence : si le lieu change, on la corrige ici et tout le monde le voit.' },
        {
          id: blockId(),
          type: 'table',
          columns: ['Moment', 'Ce qui se passe', 'Qui'],
          rows: [['08:00', 'Arrivée et installation', ''], ['', '', '']],
        },
        {
          id: blockId(),
          type: 'checklist',
          items: [
            { id: blockId('i'), text: 'Matériel chargé', done: false },
            { id: blockId('i'), text: 'Autorisation de tournage', done: false },
          ],
        },
      ],
    }),
  },
  {
    id: 'brief',
    label: 'Brief simple',
    description: 'L’objectif, ce qui est attendu, pour quand.',
    build: () => ({
      title: 'Brief',
      icon: '🎯',
      blocks: [
        { id: blockId(), type: 'text', text: 'L’objectif, en deux phrases.' },
        {
          id: blockId(),
          type: 'checklist',
          items: [{ id: blockId('i'), text: 'Ce qui est attendu', done: false }],
        },
      ],
    }),
  },
  {
    id: 'equipe',
    label: 'Page d’information d’équipe',
    description: 'Ce que tout le monde doit savoir, au même endroit.',
    build: () => ({
      title: 'Informations d’équipe',
      icon: '📌',
      blocks: [
        { id: blockId(), type: 'text', text: 'Les informations utiles à tous. Modifiable par les rôles choisis, visible par tout le monde.' },
        { id: blockId(), type: 'table', columns: ['Sujet', 'À retenir'], rows: [['', '']] },
      ],
    }),
  },
];

export function templateById(id: string): PageTemplate | undefined {
  return PAGE_TEMPLATES.find((t) => t.id === id);
}
