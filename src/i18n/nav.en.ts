/**
 * ENGLISH NAV LEXICON — the catalogue keeps speaking French, this translates it.
 *
 * The module catalogues (`src/edition/modules.*.ts`, `ClientSidebar`) are the
 * SINGLE French source: guard scripts parse their literals (check-modules
 * compares support vs business wording), so their strings must stay plain.
 * English therefore lives here, keyed by MODULE KEY, and is resolved at the
 * moment of rendering by `libelleNav`/`indiceNav` (src/i18n/index.ts).
 *
 * One English name per module key, on purpose: the same screen must carry the
 * same name wherever it appears — the exact rule check-modules enforces on the
 * French side. Hints may differ by SURFACE (the internal edition speaks to an
 * operator, the Business edition to the owner, the support context about her),
 * hence the optional per-surface fields.
 *
 * A missing entry falls back to the French literal — visible, honest, and
 * caught by a screenshot rather than by a hole.
 *
 * THIS FILE IS COMPILED INTO THE BUSINESS BUNDLE: it may only name modules
 * that edition ships. Internal-only entries (SOC, products, spaces) live in
 * `src/edition/navLexique.internal.ts`, resolved through the same
 * `@edition/navLexique` alias that keeps the catalogues apart — the
 * bundle-purity guard (check-business-bundle) is what caught the difference.
 */

export interface TraductionNav {
  label?: string;
  /** L'indice commun ; les champs par surface priment quand ils existent. */
  hint?: string;
  hintBusiness?: string;
  hintSupport?: string;
}

export const NAV_EN_COMMUN: Record<string, TraductionNav> = {
  library: { label: 'Library', hint: 'Every module, by section' },
  discover: { label: 'Discover', hint: 'Everything that exists, arranged' },
  home: { label: 'Home', hint: 'Today’s HQ', hintBusiness: 'Your day', hintSupport: 'Their day' },
  agenda: {
    label: 'Calendar',
    hint: 'Appointments & availability',
    hintSupport: 'Appointments',
  },
  projects: { label: 'Projects', hint: 'What’s moving, what’s stuck' },
  tasks: {
    label: 'Tasks',
    hint: 'Shared work',
    hintBusiness: 'What’s left to do',
    hintSupport: 'What’s left to do',
  },
  clients: { label: 'Clients', hint: 'Records & quotes' },
  invoices: { label: 'Invoicing', hint: 'Invoices & payments' },
  orders: { label: 'Orders', hint: 'Straight from the website' },
  evenements: { label: 'Events', hint: 'Dates, capacity, break-even' },
  time: { label: 'Time', hint: 'Timer & time spent' },
  expenses: {
    label: 'Expenses',
    hint: 'Costs & receipts',
    hintBusiness: 'What goes out, receipts included',
  },
  calculators: { label: 'Calculators', hint: 'Pricing, margins, splits' },
  notes: { label: 'Notes', hint: 'Notebook' },
  pages: { label: 'Pages', hint: 'Shared pages & materials' },
  reports: {
    label: 'Reports',
    hint: 'Client deliverables',
    hintBusiness: 'Written reports',
    hintSupport: 'Written reports',
  },
  media: {
    label: 'Media',
    hint: 'Library',
    hintBusiness: 'Photos & files',
    hintSupport: 'Photos & files',
  },
  budget: { label: 'Before payday', hint: 'What’s left to spend' },
  courses: { label: 'Groceries', hint: 'Shopping list & personal pages' },
  settings: { label: 'Settings', hint: 'Profile & notifications', hintSupport: 'Profile' },
  members: { label: 'Members', hint: 'Who works here, and the seats' },
  assistance: { label: 'Support', hint: 'Write to your provider' },
  vault: { label: 'Vault', hint: 'Keys & access', hintBusiness: 'Passwords & access' },
};

/**
 * Les intitulés de SECTION, par libellé français : les sections du contexte de
 * support n'ont pas de clé, seulement leur libellé — la correspondance par
 * texte est ce qui couvre les trois surfaces d'un coup. Un libellé renommé
 * côté catalogue retombe sur le français, visiblement.
 */
export const SECTIONS_EN_COMMUN: Record<string, string> = {
  Pilotage: 'Planning',
  'Clients & revenus': 'Clients & revenue',
  Production: 'Production',
  Documents: 'Documents',
  Personnel: 'Personal',
  Système: 'System',
};


