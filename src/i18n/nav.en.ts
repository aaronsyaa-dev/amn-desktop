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
  equipment: { label: 'Equipment', hint: 'Who has what, when — no double booking' },
  rounds: { label: 'Rounds', hint: 'Today’s deliveries, stop by stop' },
  cashCount: { label: 'Daily till', hint: 'The float, the cash counted, the gap' },
  clientReport: { label: 'Enriched client report', hint: 'Everything known about a client, on one printable page' },
  customAlerts: { label: 'Custom alerts', hint: 'Your own thresholds on the fleet' },
  orgCompare: { label: 'Client comparison', hint: 'All organisations side by side' },
  socMaturity: { label: 'SOC maturity', hint: 'Where each client stands, on real signals' },
  dataPort: { label: 'Import / export', hint: 'Your data, both ways' },
  automations: { label: 'Automations', hint: 'If this happens, then that gets done' },
  templates: { label: 'Templates', hint: 'Ready texts, with blanks' },
  converters: { label: 'Converters', hint: 'Units, VAT, currencies: the right number right away' },
  qr: { label: 'QR codes', hint: 'An address, a code to print' },
  pomodoro: { label: 'Pomodoro', hint: '25 minutes, then a break — and the time logged' },
  diary: { label: 'Personal diary', hint: 'A few lines a day, for you' },
  personalGoals: { label: 'Personal goals', hint: 'What you aim for, and the steps to get there' },
  habits: { label: 'Habits', hint: 'Yours, day after day' },
  portfolio: { label: 'Portfolio', hint: 'Your work, shown on the mini-page' },
  esign: { label: 'On-the-spot signature', hint: 'Have a quote or slip signed on screen' },
  newsletter: { label: 'Newsletter', hint: 'A word to all your customers, from your own mail' },
  minisite: { label: 'Public mini-page', hint: 'Your page, with your reviews and portfolio' },
  forms: { label: 'Forms', hint: 'A question asked publicly, answers here' },
  logbook: { label: 'Logbook', hint: 'What happened, dated, rereadable' },
  routines: { label: 'Routines', hint: 'What recurs, ticked each day' },
  priorities: { label: 'Today’s priorities', hint: 'Three things, not ten' },
  meetings: { label: 'Meetings', hint: 'An agenda, decisions, follow-ups' },
  weekly: { label: 'Weekly review', hint: 'Five questions on Friday, a clearer week ahead' },
  okr: { label: 'Objectives & results', hint: 'Three objectives, measured results, one season' },
  bom: { label: 'Composition & cost price', hint: 'What goes into a product, and what it costs' },
  aftersales: { label: 'After-sales', hint: 'After-sales requests, from opening to resolution' },
  assembly: { label: 'Assembly tracking', hint: 'Each job, step by step' },
  checklists: { label: 'Quality checks', hint: 'Checklists, and the record of each run' },
  shifts: { label: 'Team schedule', hint: 'Who is in on which day, week by week' },
  suppliers: { label: 'Suppliers', hint: 'Who supplies what, and since when' },
  stock: { label: 'Stock', hint: 'What is left, and what will run out' },
  board: { label: 'Project board', hint: 'Projects in columns, moved in one gesture' },
  booking: { label: 'Online booking', hint: 'A public page wired to the Calendar' },
  referrals: { label: 'Referrals', hint: 'Who brought whom, and what is owed' },
  loyalty: { label: 'Loyalty', hint: 'The stamp card, without the cardboard' },
  reviews: { label: 'Reviews', hint: 'What customers say, kept together' },
  contracts: { label: 'Contracts', hint: 'What is signed, until when, for how much' },
  subscriptions: { label: 'Subscriptions', hint: 'What recurs monthly, invoiced in one move' },
  reminders: { label: 'Reminders', hint: 'Overdue invoices, and the message to send' },
  pipeline: { label: 'Prospects', hint: 'Prospects, from contact to won' },
  calls: { label: 'Calls', hint: 'Call a member, invite a visitor by link' },
  directory: { label: 'People', hint: 'Faces, roles, who is in' },
  leaves: { label: 'Time off', hint: 'Leave, sick days, remote — who is in' },
  polls: { label: 'Polls', hint: 'One question, one vote per person' },
  announcements: { label: 'Announcements', hint: 'What everyone must have read' },
  groups: { label: 'Groups', hint: 'Threads for a few people, by topic or team' },
  dm: { label: 'Direct messages', hint: 'Write to one person, not the group' },
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
  shop: { label: 'Shop', hint: 'What people buy on their own, and where baskets are left' },
  ticketing: { label: 'Ticketing', hint: 'Seats sold, then entries at the door' },
  donations: { label: 'Donations', hint: 'A fundraiser, and what is still missing' },
  deposits: { label: 'Online deposit', hint: 'Signed online, paid online — and what waits in between' },
  chatbot: { label: 'Chatbot', hint: 'Questions asked, and those left unanswered' },
  switchboard: { label: 'Switchboard', hint: 'What the assistant promised on your behalf, on the phone' },
  video: { label: 'Video editing', hint: 'A short film, against the target format length' },
  adVisuals: { label: 'Ad visuals', hint: 'One visual, in every format' },
  postPlanner: { label: 'Post planner', hint: 'This week’s posts, against when the audience is there' },
  podcast: { label: 'Podcast', hint: 'The whole episode, its chapters and what can go' },
  brand: { label: 'Brand identity', hint: 'The logo at the size of each use' },
  productShots: { label: 'Product images', hint: 'The product fixed, the setting changing' },
  sentiment: { label: 'Sentiment', hint: 'What people tell you, in one sentence' },
  watch: { label: 'Market watch', hint: 'Your prices, against the market' },
  nps: { label: 'NPS', hint: 'Who pulls which way, and where the score lands' },
  cashForecast: { label: 'Cash forecast', hint: 'The balance over twelve weeks, and when the worst case hits zero' },
  scenarios: { label: 'Scenarios', hint: 'Budget assumptions, and which one weighs' },
  loanSim: { label: 'Loan simulator', hint: 'Same loan, three terms, and what cash flow can carry' },
  analytics: { label: 'Project analytics', hint: 'Quoted margin against actual margin' },
  reconciliation: { label: 'Reconciliation', hint: 'The statement and the entries, pair by pair' },
  taxForecast: { label: 'Tax forecast', hint: 'What part of the balance already belongs to the tax office' },
  currencies: { label: 'Multi-currency', hint: 'What you are owed in foreign currencies, and what one point of rate costs' },
  expenseClaims: { label: 'Expense claims', hint: 'A receipt photographed, read, and checked against itself' },
  incomingInvoices: { label: 'Incoming invoices', hint: 'Supplier invoices, sorted by due date' },
  recruitment: { label: 'Recruitment', hint: 'The gap in the week, and who fills it' },
  procedures: { label: 'Procedures', hint: 'Procedures as they are pinned in the workshop' },
  training: { label: 'Training', hint: 'What is known, and what fades' },
  certifications: { label: 'Certifications', hint: 'Who may work on what, and until when' },
  payslips: { label: 'Payslips', hint: 'From employer cost to net pay' },
  clauses: { label: 'Clause builder', hint: 'The contract, and what it leaves out' },
  remoteSign: { label: 'Remote signature', hint: 'Who holds the document, and since when' },
  gdpr: { label: 'GDPR', hint: 'Everything the product keeps about one person' },
  csr: { label: 'CSR impact', hint: 'The year’s footprint, in 100 kg cubes' },
  kyc: { label: 'Identity check', hint: 'A file’s checks, and the one that blocks' },
  dashboard: { label: 'Dashboard', hint: 'One dial in the centre, chosen by you' },
  leadScoring: { label: 'Lead scoring', hint: 'Which card to play first, and why' },
  itineraries: { label: 'Routes', hint: 'Tomorrow’s stop order, optimised the day before' },
  stockForecast: { label: 'Stock forecast', hint: 'When each item runs out, and when to order' },
  fleet: { label: 'Vehicles', hint: 'Each vehicle, its odometer and its due dates' },
  binder: { label: 'Binder', hint: 'Documents and their versions, the signed one included' },
  sharedEditor: { label: 'Shared editor', hint: 'A document, and what each person proposes to change' },
  rooms: { label: 'Rooms', hint: 'The rooms, who is in them, until when' },
  writing: { label: 'Writing', hint: 'Your draft, and what the assistant corrects' },
  translation: { label: 'Translation', hint: 'Each line, and its translation right below' },
};

/**
 * Les intitulés de SECTION, par libellé français : les sections du contexte de
 * support n'ont pas de clé, seulement leur libellé — la correspondance par
 * texte est ce qui couvre les trois surfaces d'un coup. Un libellé renommé
 * côté catalogue retombe sur le français, visiblement.
 */
export const SECTIONS_EN_COMMUN: Record<string, string> = {
  'Parc': 'Fleet',
  'Outils': 'Tools',
  'Collectif': 'Team',
  Pilotage: 'Planning',
  'Clients & revenus': 'Clients & revenue',
  Production: 'Production',
  Documents: 'Documents',
  Personnel: 'Personal',
  Système: 'System',
  Guichet: 'Self-service',
  Marketing: 'Marketing',
  Finance: 'Finance',
  RH: 'HR',
  Juridique: 'Legal',
};


