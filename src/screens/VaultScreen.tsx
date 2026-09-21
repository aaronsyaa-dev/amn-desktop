import React, { useMemo, useRef, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useVault, type VaultDraft } from '../state/useVault';
import { useUndo } from '../state/UndoContext';
import { copyWithAutoClear } from '../lib/clipboard';
import { downloadBlob } from '../lib/download';
import { bridge } from '../lib/bridge';
import type { VaultCategory, VaultEntry } from '../shared/api';
import { VAULT_CATEGORIES as CATEGORIES, vaultCategoryLabel as categoryLabel } from '../lib/vaultCategories';
import { useLangue, t as tr } from '../i18n';

/**
 * Vingt signes au hasard cryptographique, avec au moins une minuscule, une
 * majuscule, un chiffre et un symbole — sans les caractères qu'on confond
 * (l, I, 1, O, 0).
 */
export function genererMotDePasse(longueur = 20): string {
  const familles = ['abcdefghijkmnpqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!#$%&*+-=?@_'];
  const tout = familles.join('');
  const tirer = (alphabet: string) => alphabet[crypto.getRandomValues(new Uint32Array(1))[0] % alphabet.length];
  const signes = familles.map(tirer);
  while (signes.length < longueur) signes.push(tirer(tout));
  for (let i = signes.length - 1; i > 0; i -= 1) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [signes[i], signes[j]] = [signes[j], signes[i]];
  }
  return signes.join('');
}

const emptyDraft = (): VaultDraft => ({
  label: '',
  username: '',
  password: '',
  url: '',
  notes: '',
  category: 'accounts',
});

type CategoryFilter = VaultCategory | 'all';

interface EditState {
  id?: string;
  draft: VaultDraft;
}

/**
 * Coffre-fort — local-only password vault. See VaultEntry (shared/api.ts) and
 * useVault: nothing here ever calls amn-api or touches the sync machinery.
 * Encrypted at rest in Electron (OS keychain via safeStorage), plain
 * localStorage in the browser — `encrypted` (from useVault) says which, and
 * the browser case is called out explicitly rather than glossed over.
 */

/*
  ══════════════════════════════════════════════════════════════════════
  LA PORTE FERMÉE — l'objet qui REFUSE, et ce qu'il refuse vraiment
  ══════════════════════════════════════════════════════════════════════

  À l'état verrouillé, l'objet dominant n'est pas une liste grisée : c'est une
  PLAQUE. Une liste grisée montre ce qu'elle protège — les intitulés, leur
  nombre, leur ordre — et ne refuse que la valeur. Une porte ne montre rien,
  et c'est la composition qui doit le dire avant le premier mot de texte.

  CE QUE L'ON APPREND SANS OUVRIR : combien de secrets, quand la porte a été
  ouverte pour la dernière fois, qui a la clé, et les CATÉGORIES en barres —
  lisibles porte fermée, valeurs jamais.

  CE QUE CETTE PORTE EST, ET L'ÉCRAN LE DIT SANS DÉTOUR. Elle ne chiffre
  rien : le chiffrement, quand il existe, vient du trousseau du système
  d'exploitation. Elle empêche un coffre ouvert de rester affiché sur un
  écran que quelqu'un d'autre regarde, et elle se referme en quittant. La
  faire passer pour une serrure serait exactement le genre de mensonge
  qu'un module de secrets ne peut pas se permettre.

  LA CLÉ NE SE RÉCUPÈRE PAS. Il n'y a pas de phrase de passe à perdre — il y
  a un trousseau de machine, qui ne voyage pas. La conséquence est la même,
  et l'écran l'écrit : si cette machine disparaît, les secrets aussi.
*/
const CADRAN = 160;
const CADRAN_R = 68;
const CRANS = 40;
const CRAN_L = 2;
const VIS = 7;

/** Le moment de la dernière ouverture, gardé sur ce poste. */
const CLE_OUVERTURES = 'amn.vault.ouvertures';

function lireOuvertures(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(CLE_OUVERTURES) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function noterUneOuverture(): void {
  try {
    const suite = [new Date().toISOString(), ...lireOuvertures()].slice(0, 60);
    window.localStorage.setItem(CLE_OUVERTURES, JSON.stringify(suite));
  } catch {
    /* Stockage refusé : la porte s'ouvre quand même, et le pied dit « aucune ». */
  }
}

function PorteFermee({
  entries,
  encrypted,
  onOuvrir,
}: {
  entries: VaultEntry[];
  encrypted: boolean;
  onOuvrir: () => void;
}) {
  const ouvertures = useMemo(() => lireOuvertures(), []);
  const derniere = ouvertures[0] ?? null;
  const QUATORZE = 14 * 86_400_000;
  const recentes = ouvertures.filter((d) => Date.now() - Date.parse(d) < QUATORZE).length;

  /* LES CATÉGORIES, PORTE FERMÉE. Un compte par catégorie — jamais un
     intitulé, jamais une valeur. Savoir qu'il y a quatre accès de serveur
     n'apprend rien sur eux. */
  const parCategorie = useMemo(() => {
    const m = new Map<VaultCategory, number>();
    for (const e of entries) m.set(e.category, (m.get(e.category) ?? 0) + 1);
    return CATEGORIES.map((c) => ({ ...c, n: m.get(c.value) ?? 0 })).filter((c) => c.n > 0);
  }, [entries]);
  const maxCat = Math.max(1, ...parCategorie.map((c) => c.n));

  const centre = CADRAN / 2;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* ═══ L'OBJET DOMINANT : la plaque, ses vis, son cadran ═══ */}
      <section
        className="relative flex flex-col items-center justify-center overflow-hidden p-8 sm:p-10"
        style={{
          background: 'linear-gradient(145deg, var(--color-raised), var(--color-sunken))',
          border: '1px solid var(--color-border-strong)',
        }}
      >
        {/* LES QUATRE VIS — aux angles, comme sur une vraie plaque. */}
        {[
          { top: 12, left: 12 },
          { top: 12, right: 12 },
          { bottom: 12, left: 12 },
          { bottom: 12, right: 12 },
        ].map((coin, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute rounded-full"
            style={{
              ...coin,
              width: VIS,
              height: VIS,
              background: 'var(--color-border-strong)',
              boxShadow: 'inset 0 1px 0 var(--color-sunken)',
            }}
          />
        ))}

        <p className="eyebrow mb-6 self-start">Le coffre est fermé</p>

        <button
          type="button"
          onClick={() => {
            noterUneOuverture();
            onOuvrir();
          }}
          aria-label="Ouvrir le coffre-fort"
          className="input-focus relative"
          style={{ width: CADRAN, height: CADRAN }}
        >
          <svg
            viewBox={`0 0 ${CADRAN} ${CADRAN}`}
            className="halo-signal block h-full w-full"
            role="img"
            aria-label="Cadran de la serrure"
          >
            {/* L'ANNEAU À CRANS. La période vient du rayon : changer le rayon
                garde les quarante crans, exactement comme le cadran du
                Pomodoro. */}
            <circle
              data-signal-groupe="cadran"
              cx={centre}
              cy={centre}
              r={CADRAN_R}
              fill="none"
              stroke="var(--color-signal)"
              strokeWidth={9}
              strokeDasharray={`${CRAN_L} ${(2 * Math.PI * CADRAN_R) / CRANS - CRAN_L}`}
            />
            {/* L'INDEX — le trait qui dit où en est la serrure. */}
            <line
              data-signal-groupe="cadran"
              x1={centre}
              y1={centre - CADRAN_R + 16}
              x2={centre}
              y2={centre - CADRAN_R - 4}
              stroke="var(--color-signal)"
              strokeWidth={3}
            />
            {/* LE MOYEU. */}
            <circle data-signal-groupe="cadran" cx={centre} cy={centre} r={13} fill="var(--color-signal)" />
          </svg>
        </button>

        <p className="mt-6 max-w-prose text-center text-sm leading-relaxed text-text-body">
          Ce module refuse de montrer ce qu’il contient tant qu’on ne l’ouvre pas. Cliquez le cadran.
        </p>
      </section>

      {/* CE QU'ON APPREND SANS OUVRIR. */}
      <aside className="panel p-4">
        <p className="eyebrow mb-3">Sans ouvrir</p>
        <dl className="flex flex-col gap-2.5">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">Secrets rangés</dt>
            <dd className="text-[23px] font-semibold tabular-nums leading-tight text-text-primary">{entries.length}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">Dernière ouverture</dt>
            <dd className="text-[15px] font-semibold leading-tight text-text-primary">
              {derniere ? new Date(derniere).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : 'Jamais depuis ce poste'}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">Qui a la clé</dt>
            <dd className="text-[13px] leading-relaxed text-text-secondary">
              {encrypted
                ? 'Le trousseau de cette machine, et lui seul. Il ne voyage pas.'
                : 'Personne : ce navigateur n’a pas de trousseau, le contenu est en clair sur ce poste.'}
            </dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-border pt-3 text-[12px] leading-relaxed text-text-body">
          Il n’y a pas de phrase de passe à perdre — et rien à récupérer pour autant : si cette machine
          disparaît, les secrets disparaissent avec elle. La copie de secours, une fois ouverte, est le seul
          moyen de les sortir d’ici.
        </p>
        <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-text-muted">
          Cette porte ne chiffre rien : elle évite qu’un coffre ouvert reste affiché. Elle se referme quand
          vous quittez l’écran.
        </p>
      </aside>

      {/* EN PIED — les catégories en barres, et les ouvertures récentes. */}
      <section className="panel p-4 lg:col-span-2">
        <p className="eyebrow mb-3">Ce qu’il y a dedans, en catégories</p>
        {parCategorie.length === 0 ? (
          <p className="text-sm leading-relaxed text-text-secondary">
            Rien n’y est rangé pour l’instant. Ouvrez la porte pour y poser un premier secret.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {parCategorie.map((c) => (
              <li key={c.value} className="flex items-center gap-3">
                <span className="w-32 flex-shrink-0 truncate text-sm text-text-primary">{c.label}</span>
                <span className="flex min-w-0 flex-1 items-center">
                  <span
                    className="h-2"
                    style={{ width: `${(c.n / maxCat) * 100}%`, backgroundColor: 'var(--color-text-body)' }}
                  />
                </span>
                <span className="w-8 flex-shrink-0 text-right font-mono text-[11px] tabular-nums text-text-muted">
                  {c.n}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 border-t border-border pt-3 text-[12px] leading-relaxed text-text-muted">
          Les catégories se lisent porte fermée ; aucun intitulé et aucune valeur ne s’y lisent.
          {recentes > 0
            ? ` Ouvert ${recentes} fois depuis ce poste ces quatorze derniers jours.`
            : ' Aucune ouverture depuis ce poste ces quatorze derniers jours.'}
        </p>
      </section>
    </div>
  );
}

export function VaultScreen() {
  const { entries, encrypted, loading, saveEntry, deleteEntry } = useVault();
  const { scheduleDelete, isPending } = useUndo();

  /* LA PORTE. Fermée à chaque arrivée sur l'écran — un état de session, pas
     une préférence : une porte qu'on retrouve ouverte n'est pas une porte. */
  const [ouvert, setOuvert] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => !isPending(`vault:${e.id}`))
      .filter((e) => (category === 'all' ? true : e.category === category))
      .filter((e) => !q || e.label.toLowerCase().includes(q))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [entries, category, query, isPending]);

  const selected = useMemo(() => entries.find((e) => e.id === selectedId) ?? null, [entries, selectedId]);
  const hasDetail = Boolean(editing || selected);
  const closeDetail = () => {
    setSelectedId(null);
    setEditing(null);
  };

  const save = (state: EditState) => {
    saveEntry(state.draft, state.id);
    setSelectedId(state.id ?? null);
    setEditing(null);
  };

  const remove = (entry: VaultEntry) => {
    setSelectedId(null);
    setEditing(null);
    scheduleDelete({
      key: `vault:${entry.id}`,
      label: `Entrée « ${entry.label} »`,
      commit: () => deleteEntry(entry.id),
    });
  };

  if (!loading && !ouvert) {
    return (
      <section className="flex flex-col gap-4">
        <ScreenHeader
          eyebrow={tr('hist.surtitre', { module: tr('hist.vault.titre') })}
          title={tr('hist.vault.titre')}
          description="Une porte fermée : ce module ne montre pas ce qu’il contient tant qu’on ne l’ouvre pas."
          stats={[{ label: tr('hist.vault.entrees'), value: entries.length, title: tr('hist.vault.leContenuNeQuitte') }]}
        />
        <PorteFermee entries={entries} encrypted={encrypted} onOuvrir={() => setOuvert(true)} />
      </section>
    );
  }

  return (
    <section className={`flex flex-col gap-4 ${entries.length === 0 ? '' : 'screen-h'}`}>
      <ScreenHeader
        eyebrow={tr('hist.surtitre', { module: tr('hist.vault.titre') })}
        title={tr('hist.vault.titre')}
        description={
          /* La description DIT CE QUI EST MESURÉ : le bandeau juste en dessous
             annonce déjà « sans chiffrement » dans un navigateur, et un titre
             qui promettait le contraire se contredisait à trois lignes près. */
          encrypted
            ? tr('hist.vault.chiffreSurCetteMachine')
            : 'Gardé sur ce poste, en clair : ce navigateur n’a pas de trousseau pour le chiffrer.'
        }
        stats={[
          {
            label: tr('hist.vault.entrees'),
            value: loading ? '…' : entries.length,
            title: tr('hist.vault.leContenuNeQuitte'),
          },
        ]}
        actions={
        <div className="flex flex-shrink-0 items-center gap-2">
          {/*
            LA SORTIE DE SECOURS.

            Ce coffre ne peut pas être sauvegardé par le serveur (sa clé de
            chiffrement n'existe que sur cette machine). Sans un moyen d'en
            sortir le contenu, la limite devient un piège : on y met ses accès
            pendant des mois, et une réinstallation les efface.

            Le fichier produit est EN CLAIR, et le bouton le dit : un export
            chiffré qu'on ne saurait pas relire n'est pas une sauvegarde. À
            ranger dans un endroit sûr — c'est un choix conscient, pas un
            détail qu'on découvre après.
          */}
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const contenu = JSON.stringify(
                  {
                    exporteLe: new Date().toISOString(),
                    avertissement:
                      'Ce fichier contient vos mots de passe EN CLAIR. Rangez-le dans un endroit sûr, ou supprimez-le après usage.',
                    entrees: entries,
                  },
                  null,
                  2,
                );
                downloadBlob(
                  new Blob([contenu], { type: 'application/json' }),
                  `coffre-fort-${new Date().toISOString().slice(0, 10)}.json`,
                );
              }}
              title={tr('hist.vault.enregistrerUneCopieDe')}
              className="flex items-center gap-2 border border-border px-3 py-2.5 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              <Download size={15} strokeWidth={1.9} />
              <span className="hidden sm:inline">Copie de secours</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditing({ draft: emptyDraft() });
              setSelectedId(null);
            }}
            className="flex items-center gap-2 bg-accent px-3 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            <Plus size={16} strokeWidth={2.25} />
            <span className="hidden sm:inline">{tr('hist.vault.nouvelleEntree')}</span>
          </button>
        </div>
        }
      />

      {/*
        CE BANDEAU DISAIT UNE PROPRIÉTÉ, PAS SA CONSÉQUENCE.

        « Jamais synchronisé, jamais transmis sur le réseau » se lit comme une
        bonne nouvelle — et c'en est une, pour la confidentialité. Mais quelqu'un
        qui n'est pas technicien en tire l'inverse de ce qu'il faudrait en tirer :
        il comprend « c'est bien protégé », pas « si je perds cet ordinateur, tout
        est perdu », ni « mon téléphone montrera un coffre vide », ni « ceci
        n'est pas dans l'export de mes données ».

        Le bandeau énonce donc maintenant les trois conséquences, et l'écran
        offre une copie de secours juste à côté. Une limite qu'on ne peut pas
        lever dans l'immédiat doit au moins être dite dans les termes de qui la
        subit.
      */}
      {!loading &&
        (encrypted ? (
          <div className="flex items-start gap-2 border border-border bg-surface px-4 py-2.5 text-xs text-text-secondary">
            <ShieldCheck size={14} className="mt-0.5 flex-shrink-0 text-success" strokeWidth={2} />
            <span>
              <span className="text-text-primary">{tr('hist.vault.ceCoffreResteSur')}</span> Il est
              chiffré par le trousseau du système et ne part jamais sur le réseau — donc personne
              d’autre ne peut le lire, mais il n’est ni synchronisé avec vos autres appareils, ni
              sauvegardé, ni inclus dans l’export de vos données. Faites-en une copie.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 border border-warning/40 bg-warning-muted px-4 py-2.5 font-mono text-xs text-text-secondary">
            <AlertTriangle size={14} className="mt-px flex-shrink-0 text-warning" strokeWidth={2} />
            {bridge().env.isElectron
              ? tr('hist.vault.sansTrousseau')
              : tr('hist.vault.navigateur')}
          </div>
        ))}

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={15}
            strokeWidth={1.9}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr('hist.vault.rechercherParNom')}
            className="input-focus w-full border border-border bg-surface py-2 pl-9 pr-3 font-mono text-sm text-text-primary placeholder:text-text-muted"
          />
        </div>
        <div className="flex max-w-full items-center overflow-x-auto border border-border bg-surface">
          {([{ value: 'all', label: tr('hist.vault.tous') }, ...CATEGORIES] as { value: CategoryFilter; label: string }[]).map(
            (opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCategory(opt.value)}
                /*
                Voir `docs/PRINCIPE-CONFORT.md`. Ces filtres se touchent, et
                c'est JUSTE : un contrôle segmenté se lit comme un seul objet, et
                le segment actif est rempli — on ne se trompe pas de cible parce
                qu'on ne voit pas la frontière, on la voit très bien.

                Ce qui manquait n'était pas l'écart mais la HAUTEUR : 31 px
                mesurés, sous les 44 px qui rendent un geste confortable sans
                qu'on ait à viser. `min-h-11` les y porte.
            */
                className={`flex min-h-11 flex-shrink-0 items-center whitespace-nowrap px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors duration-150 ${
                  category === opt.value
                    ? 'bg-accent-muted text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {opt.label}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Même règle : pas de colonne de détail sans sujet (BLOC A). */}
      <div
        className={`grid min-h-0 flex-1 gap-4 ${
          entries.length === 0
            ? 'grid-cols-1'
            : 'grid-cols-1 lg:grid-cols-[minmax(0,20rem)_1fr]'
        }`}
      >
        {/* List — full width on mobile until a detail is opened. */}
        <div
          className={`min-h-0 flex-col overflow-y-auto rounded-lg border border-border bg-surface ${
            hasDetail ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {visible.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <KeyRound size={22} strokeWidth={1.9} className="text-text-muted" />
              <p className="text-sm text-text-secondary">
                {entries.length === 0 ? tr('hist.vault.aucuneEntree') : tr('hist.vault.aucuneEntreeFiltres')}
              </p>
            </div>
          ) : (
            visible.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setSelectedId(entry.id);
                  setEditing(null);
                }}
                className={`flex flex-col gap-1 border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface-hover ${
                  selectedId === entry.id && !editing ? 'bg-surface-hover' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex-shrink-0 rounded-sm border border-border bg-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-muted">
                    {categoryLabel(entry.category)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                    {entry.label || 'Sans nom'}
                  </span>
                </div>
                {entry.username && (
                  <span className="truncate font-mono text-[11px] text-text-muted">{entry.username}</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Detail / editor — full-screen on mobile, right-hand column on lg+. */}
        <div
          className={`min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface ${
            hasDetail ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {hasDetail && (
            <button
              type="button"
              onClick={closeDetail}
              className="flex items-center gap-1.5 border-b border-border px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary lg:hidden"
            >
              <ArrowLeft size={13} strokeWidth={2} />{tr('hist.vault.retourALaListe')}</button>
          )}
          {editing ? (
            <VaultEditor
              state={editing}
              onChange={setEditing}
              onSave={() => save(editing)}
              onCancel={() => setEditing(null)}
            />
          ) : selected ? (
            <VaultReader
              entry={selected}
              onEdit={() =>
                setEditing({
                  id: selected.id,
                  draft: {
                    label: selected.label,
                    username: selected.username,
                    password: selected.password,
                    url: selected.url,
                    notes: selected.notes,
                    category: selected.category,
                  },
                })
              }
              onRemove={() => remove(selected)}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <Lock size={26} strokeWidth={1.9} className="text-text-muted" />
              <p className="text-sm font-medium text-text-primary">{tr('hist.vault.selectionnezUneEntree')}</p>
              <p className="max-w-sm text-sm text-text-secondary">{tr('hist.vault.ouCreezEnUne')}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- Reader -------------------------------- */

function VaultReader({
  entry,
  onEdit,
  onRemove,
}: {
  entry: VaultEntry;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copiedField, setCopiedField] = useState<'username' | 'password' | null>(null);

  const copy = async (field: 'username' | 'password', value: string) => {
    if (!value) return;
    await copyWithAutoClear(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 1600);
  };

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <span className="mb-2 inline-block rounded-sm border border-border bg-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-muted">
            {categoryLabel(entry.category)}
          </span>
          <h2 className="truncate text-2xl font-semibold leading-tight text-text-primary">{entry.label}</h2>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="flex min-h-9 items-center gap-1.5 rounded-sm px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
          >
            <Pencil size={13} strokeWidth={1.9} />{tr('hist.vault.editer')}</button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={tr('hist.vault.supprimer')}
            className="flex h-9 w-9 items-center justify-center rounded text-text-muted hover:text-danger"
          >
            <Trash2 size={15} strokeWidth={1.9} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {entry.username && (
          <VaultField
            label="Identifiant"
            value={entry.username}
            copied={copiedField === 'username'}
            onCopy={() => copy('username', entry.username)}
          />
        )}

        <div>
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Mot de passe
          </span>
          <div className="flex items-center gap-1.5 border border-border bg-bg px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-sm text-text-primary">
              {revealed ? entry.password || '—' : entry.password ? '•'.repeat(Math.min(entry.password.length, 20)) : '—'}
            </span>
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? 'Masquer le mot de passe' : 'Révéler le mot de passe'}
              className="flex-shrink-0 text-text-muted transition-colors hover:text-text-primary"
            >
              {revealed ? <EyeOff size={15} strokeWidth={1.9} /> : <Eye size={15} strokeWidth={1.9} />}
            </button>
            <button
              type="button"
              onClick={() => copy('password', entry.password)}
              aria-label={tr('hist.vault.copierLeMotDe')}
              className="flex-shrink-0 text-text-muted transition-colors hover:text-text-primary"
            >
              {copiedField === 'password' ? (
                <Check size={15} strokeWidth={2} className="text-success" />
              ) : (
                <Copy size={15} strokeWidth={1.9} />
              )}
            </button>
          </div>
          <p className="mt-1 font-mono text-[10px] text-text-muted">{tr('hist.vault.laCopieSEfface')}</p>
        </div>

        {entry.url && (
          <div>
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-text-muted">URL</span>
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-sm text-text-secondary underline decoration-border underline-offset-4 hover:text-text-primary hover:decoration-text-primary"
            >
              {entry.url}
            </a>
          </div>
        )}

        {entry.notes && (
          <div>
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Notes
            </span>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{entry.notes}</p>
          </div>
        )}
      </div>
    </>
  );
}

function VaultField({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</span>
      <div className="flex items-center gap-1.5 border border-border bg-bg px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-sm text-text-primary">{value}</span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copier ${label.toLowerCase()}`}
          className="flex-shrink-0 text-text-muted transition-colors hover:text-text-primary"
        >
          {copied ? <Check size={15} strokeWidth={2} className="text-success" /> : <Copy size={15} strokeWidth={1.9} />}
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- Editor -------------------------------- */

function VaultEditor({
  state,
  onChange,
  onSave,
  onCancel,
}: {
  state: EditState;
  onChange: (s: EditState) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { draft } = state;
  const setDraft = (patch: Partial<VaultDraft>) => onChange({ ...state, draft: { ...draft, ...patch } });
  const [showPassword, setShowPassword] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
          {state.id ? 'Éditer l’entrée' : 'Nouvelle entrée'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Fermer"
          className="flex h-9 w-9 items-center justify-center text-text-secondary hover:text-text-primary"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Nom *</span>
          <input
            ref={labelRef}
            autoFocus
            value={draft.label}
            onChange={(e) => setDraft({ label: e.target.value })}
            placeholder="Ex : API Stripe production"
            className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{tr('hist.vault.categorie')}</span>
          <select
            value={draft.category}
            onChange={(e) => setDraft({ category: e.target.value as VaultCategory })}
            className="input-focus cursor-pointer border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Identifiant</span>
          <input
            value={draft.username}
            onChange={(e) => setDraft({ username: e.target.value })}
            placeholder="email, nom d’utilisateur…"
            className="input-focus border border-border bg-bg px-3 py-2 font-mono text-sm text-text-primary outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Mot de passe *</span>
          <div className="flex items-center gap-1.5 border border-border bg-bg px-3 py-1">
            <input
              type={showPassword ? 'text' : 'password'}
              value={draft.password}
              onChange={(e) => setDraft({ password: e.target.value })}
              className="input-focus min-w-0 flex-1 bg-transparent py-1.5 font-mono text-sm text-text-primary outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Masquer' : 'Révéler'}
              className="flex-shrink-0 text-text-muted transition-colors hover:text-text-primary"
            >
              {showPassword ? <EyeOff size={15} strokeWidth={1.9} /> : <Eye size={15} strokeWidth={1.9} />}
            </button>
          </div>
          {/*
            Le générateur : vingt signes tirés au hasard cryptographique, avec
            au moins une minuscule, une majuscule, un chiffre et un symbole.
            Un mot de passe qu'on n'a pas choisi est un mot de passe qu'on ne
            réutilise pas — c'est ce que le coffre-fort doit rendre facile.
          */}
          <button
            type="button"
            onClick={() => {
              setDraft({ password: genererMotDePasse(20) });
              setShowPassword(true);
            }}
            className="flex min-h-11 w-fit items-center gap-1.5 border border-border px-3 text-xs text-text-secondary transition-colors hover:text-text-primary md:min-h-0 md:py-1.5"
          >
            <KeyRound size={13} strokeWidth={1.9} />{tr('hist.vault.genererUnMotDe')}</button>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">URL</span>
          <input
            value={draft.url}
            onChange={(e) => setDraft({ url: e.target.value })}
            placeholder="https://…"
            className="input-focus border border-border bg-bg px-3 py-2 font-mono text-sm text-text-primary outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Notes</span>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft({ notes: e.target.value })}
            rows={4}
            placeholder="Contexte, restrictions, contact…"
            className="input-focus resize-none border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
          />
        </label>
      </div>

      <div className="flex items-center gap-2 border-t border-border p-3">
        <button
          type="button"
          onClick={onSave}
          disabled={!draft.label.trim() || !draft.password.trim()}
          className="bg-accent px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
        >{tr('hist.vault.enregistrer')}</button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          Annuler
        </button>
      </div>
    </>
  );
}
