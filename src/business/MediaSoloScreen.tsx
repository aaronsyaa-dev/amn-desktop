import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Contact, ImagePlus, Loader2, X } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { useClients } from '../state/useClients';
import { useCollection, useSync, uid, stripMeta } from '../state/SyncContext';
import { resizeImageToDataUrl } from '../lib/imageResize';
import { relativeTime } from '../lib/time';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useFermetureEchap } from '../lib/useFermetureEchap';
import { useHaloSignal } from '../components/EtatEcran';

/**
 * Médiathèque de l'édition Business.
 *
 * La médiathèque interne n'est pas un stockage : c'est une vue dérivée des
 * pièces jointes du chat d'équipe. Sans chat, elle n'aurait rien à afficher —
 * d'où une collection `media` à part, où les fichiers sont déposés
 * directement.
 *
 * Les images sont redimensionnées côté client avant d'être stockées en
 * data-URL, exactement comme les photos de fiches clients : au-delà, il
 * faudrait un vrai stockage objet côté amn-api, ce qui est un autre chantier.
 * La limite est donc annoncée à l'écran plutôt que découverte à l'usage.
 */

const MAX_DIMENSION = 1600;

/* ─── LE PAVAGE — l'objet dominant des Médias (`18c`) ─────────────────────── */

/*
  UNE LISTE TRIÉE PAR POIDS DEMANDE DE COMPARER DES NOMBRES ; LE PAVAGE MONTRE
  LE RAPPORT DE SURFACE.

  L'espace occupé est un rectangle de 280 px de haut, et chaque dossier y
  prend exactement sa part de surface. Qu'un seul dossier mange la moitié de
  la place devient une évidence avant toute lecture — c'est le genre de fait
  qu'aucun tableau de tailles ne donne d'un coup d'œil.

  LE « DOSSIER », ICI, EST LE CLIENT. Ce n'est pas une transposition : c'est
  le seul rangement que cet écran connaisse, et celui que la personne fait
  elle-même en rattachant une photo à une fiche. Les médias sans client
  forment leur propre pavé — ne pas les montrer reviendrait à cacher la part
  qui n'est justement rangée nulle part.

  IL N'Y A PAS DE QUOTA dans ce produit. Les parts sont donc rapportées au
  TOTAL réel, et la règle du module — « le pavé qui occupe la moitié de
  l'espace » — se lit sur ce total. Afficher « 62 % d'un quota » inexistant
  inventerait une contrainte.

  LES SURFACES SONT PROPORTIONNELLES AUX POIDS RÉELS, en `flex` imbriqués :
  la bande est coupée en deux colonnes de poids comparables, chacune
  découpée en pavés dont le `flex-grow` EST le nombre d'octets. Aucune taille
  n'est écrite. Un pavé trop petit pour son texte le TRONQUE — il ne grandit
  pas, sans quoi la surface mentirait.
*/
const PAVAGE_H = 280;
/** Au-delà de cette part, le pavé porte aussi son compte et sa phrase. */
const PAVE_GRAND_MIN = 18;
/** La part à partir de laquelle un pavé « mange la moitié de l'espace ». */
const PAVE_SEUIL_AMBRE = 50;

interface PaveDuStockage {
  cle: string;
  nom: string;
  octets: number;
  fichiers: number;
  part: number;
}

/**
 * Le poids réel d'un média.
 *
 * Une `data:` URL est du base64 : quatre caractères pour trois octets, moins
 * le préfixe. C'est une mesure, pas une estimation — et c'est le seul poids
 * que ce produit connaisse, puisqu'il stocke ses images ainsi.
 */
function octetsDe(dataUrl: string): number {
  const virgule = dataUrl.indexOf(',');
  const charge = virgule >= 0 ? dataUrl.length - virgule - 1 : dataUrl.length;
  return Math.max(0, Math.round((charge * 3) / 4));
}

/** « 1,4 Mo », « 320 ko » — jamais un nombre d'octets nu. */
function enPoids(octets: number): string {
  if (octets >= 1_000_000) return `${(octets / 1_000_000).toFixed(1).replace('.', ',')} Mo`;
  if (octets >= 1_000) return `${Math.round(octets / 1_000)} ko`;
  return `${octets} o`;
}

interface MediaData {
  name: string;
  dataUrl: string;
  clientId: number | null;
  clientName: string;
  createdAt: string;
}

export function MediaSoloScreen() {
  const { upsert, remove } = useSync();
  const { clients } = useClients();
  const rows = useCollection<Partial<MediaData>>('media');
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [preview, setPreview] = useState<string | null>(null);

  /*
    L'aperçu plein écran se ferme à Échap. Sortir d'un plein écran est
    précisément ce que cette touche fait partout ailleurs — dans le
    navigateur, dans le lecteur vidéo, dans le système.
  */
  useFermetureEchap(preview !== null, () => setPreview(null));

  const items = useMemo(
    () =>
      rows
        .map((row) => ({
          id: row.id,
          name: row.name ?? 'Sans nom',
          dataUrl: row.dataUrl ?? '',
          clientId: row.clientId ?? null,
          clientName: row.clientName ?? '',
          createdAt: row.createdAt ?? row.updatedAt,
        }))
        .filter((item) => item.dataUrl)
        .filter((item) => !filter || String(item.clientId) === filter)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [rows, filter],
  );

  /*
    LE PAVAGE SE CALCULE SUR TOUS LES MÉDIAS, jamais sur les filtrés.

    Un pavage de l'espace occupé qui change quand on filtre par client n'est
    plus un pavage de l'espace occupé : c'est un pavage de la sélection. Le
    filtre sert à retrouver une photo ; le pavage dit ce que la bibliothèque
    pèse, et ces deux questions ne se répondent pas sur le même ensemble.
  */
  const pavage = useMemo(() => {
    const parDossier = new Map<string, { nom: string; octets: number; fichiers: number }>();
    let total = 0;
    let vieuxOctets = 0;
    let vieux = 0;
    const seuil = Date.now() - 90 * 86_400_000;
    for (const row of rows) {
      const dataUrl = row.dataUrl ?? '';
      if (!dataUrl) continue;
      const octets = octetsDe(dataUrl);
      total += octets;
      const cle = row.clientId ? String(row.clientId) : 'sans';
      const nom = row.clientId ? row.clientName || `Client ${row.clientId}` : 'Sans client';
      const entree = parDossier.get(cle) ?? { nom, octets: 0, fichiers: 0 };
      entree.octets += octets;
      entree.fichiers += 1;
      parDossier.set(cle, entree);
      const quand = Date.parse(row.createdAt ?? row.updatedAt ?? '');
      if (Number.isFinite(quand) && quand < seuil) {
        vieux += 1;
        vieuxOctets += octets;
      }
    }
    const paves: PaveDuStockage[] = [...parDossier.entries()]
      .map(([cle, v]) => ({
        cle,
        nom: v.nom,
        octets: v.octets,
        fichiers: v.fichiers,
        part: total > 0 ? (v.octets / total) * 100 : 0,
      }))
      .sort((a, b) => b.octets - a.octets);
    return { paves, total, vieux, vieuxOctets };
  }, [rows]);

  const paveAmbre = pavage.paves.find((p) => p.part >= PAVE_SEUIL_AMBRE) ?? null;
  const haloPavage = useHaloSignal(paveAmbre !== null);

  const onPick = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(fileList)) {
        if (!file.type.startsWith('image/')) {
          setError('Pour l’instant, seules les images sont acceptées.');
          continue;
        }
        const dataUrl = await resizeImageToDataUrl(file, MAX_DIMENSION);
        const linked = filter ? clients.find((c) => String(c.id) === filter) : undefined;
        upsert('media', uid('media'), {
          name: file.name,
          dataUrl,
          clientId: linked ? linked.id : null,
          clientName: linked ? linked.name : '',
          createdAt: new Date().toISOString(),
        } satisfies MediaData);
      }
    } catch {
      setError('Impossible de lire ce fichier.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const relink = (id: string, clientId: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const linked = clientId ? clients.find((c) => String(c.id) === clientId) : undefined;
    upsert('media', id, {
      ...stripMeta(row),
      clientId: linked ? linked.id : null,
      clientName: linked ? linked.name : '',
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/*
        `ScreenHeader`, comme les vingt-six écrans de l'autre édition.

        Cet écran écrivait son titre à la main, en `text-lg` — 18 px, contre
        les 22 à 24 du composant. Son jumeau interne (`MediaLibraryScreen`)
        passe par `ScreenHeader` depuis la refonte. Deux voix pour le même
        produit, et c'est l'édition CLIENTE qui avait la moins soignée.

        Le contrôle `check:ecrans` ne pouvait pas le voir : il ne lisait que
        `src/screens/`. Il lit désormais `src/business/` aussi.
      */}
      <ScreenHeader
        eyebrow="Mon espace · Médias"
        title="Médias"
        description="Photos et fichiers de votre activité, rassemblés."
        stats={[
          { label: 'Éléments', value: items.length },
          { label: 'Clients', value: new Set(items.map((i) => i.clientId).filter(Boolean)).size },
        ]}
        actions={
          <>
          {/*
            LE FILTRE ACTIF SE VOIT, ET SE RETIRE.

            C'était un `<select>` : une fois un client choisi, la liste
            déroulante l'affichait comme n'importe quelle autre option, du même
            gris que le reste. On ne voyait pas qu'on regardait une grille
            FILTRÉE — d'où le « il me manque des photos » qui n'en était pas un.

            L'AMBRE de cet écran, que la table du paquet nomme « le filtre
            actif », est donc cette pastille : elle dit ce qui est filtré,
            combien il reste, et porte la croix qui l'enlève. Sans filtre, pas
            de pastille et pas d'ambre — la grille est complète, il n'y a rien
            à décider.
          */}
          {filter && (
            <span
              className="signal-plate flex items-center gap-2.5 py-2 pl-3 pr-2 font-mono text-[9.5px] font-bold uppercase tracking-[0.2em]"
              data-signal-groupe="filtre-actif"
            >
              {clients.find((c) => String(c.id) === filter)?.name ?? 'Client'} · {items.length}
              <button
                type="button"
                onClick={() => setFilter('')}
                aria-label="Retirer le filtre"
                className="flex h-5 w-5 items-center justify-center transition-opacity hover:opacity-70"
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            </span>
          )}
          <select
            // Un `<select>` sans étiquette s'annonce « liste déroulante », et
            // rien de plus : on ne sait pas ce qu'il filtre. La première
            // option porte le sens à l'œil, jamais à l'oreille.
            aria-label="Filtrer par cliente"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input-focus cursor-pointer border border-border bg-surface px-2.5 py-2 font-mono text-[10px] uppercase tracking-wider text-text-secondary outline-none"
          >
            <option value="">Toutes les clientes</option>
            {clients.map((client) => (
              <option key={client.id} value={String(client.id)}>
                {client.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} strokeWidth={2} />}
            Ajouter
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => void onPick(e.target.files)}
          />
          </>
        }
      />

      {/* ── LE PAVAGE — l'objet dominant (`18c`) ─────────────────────────── */}
      {pavage.paves.length > 0 && (
        <motion.section variants={staggerItem} className="panel-raised panel-raised-wide p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="eyebrow">L’espace occupé · {enPoids(pavage.total)}</p>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
              chaque pavé prend exactement sa part de surface
            </p>
          </div>

          <div className="mt-4 flex w-full gap-1" style={{ height: PAVAGE_H }}>
            {[0, 1].map((colonne) => {
              /* Deux colonnes de poids comparables : on remplit la première
                 jusqu'à la moitié du total, le reste suit. */
              let cumul = 0;
              const dedans = pavage.paves.filter((p) => {
                const avant = cumul;
                cumul += p.octets;
                return colonne === 0 ? avant < pavage.total / 2 : avant >= pavage.total / 2;
              });
              if (dedans.length === 0) return null;
              const poidsColonne = dedans.reduce((n, p) => n + p.octets, 0);
              return (
                <div
                  key={colonne}
                  className="flex min-w-0 flex-col gap-1"
                  style={{ flexGrow: poidsColonne, flexBasis: 0 }}
                >
                  {dedans.map((pave) => {
                    const signal = paveAmbre?.cle === pave.cle;
                    const grand = pave.part >= PAVE_GRAND_MIN;
                    return (
                      <button
                        key={pave.cle}
                        type="button"
                        onClick={() => setFilter(pave.cle === 'sans' ? '' : pave.cle)}
                        title={`${pave.nom} · ${enPoids(pave.octets)} · ${pave.fichiers} fichier${pave.fichiers > 1 ? 's' : ''}`}
                        className={`flex min-h-0 flex-col justify-between overflow-hidden border p-2.5 text-left transition-colors ${
                          signal
                            ? `border-signal-line bg-signal-muted ${haloPavage}`
                            : 'border-border bg-raised hover:bg-surface-hover'
                        }`}
                        style={{ flexGrow: pave.octets, flexBasis: 0 }}
                        data-signal-groupe={signal ? 'pave-dominant' : undefined}
                      >
                        <span className="block min-w-0">
                          <span
                            className={`block truncate text-[13.5px] font-semibold ${signal ? 'text-signal' : 'text-text-primary'}`}
                            data-signal-groupe={signal ? 'pave-dominant' : undefined}
                          >
                            {pave.nom}
                          </span>
                          <span
                            className={`tnum block truncate font-mono text-[10px] uppercase tracking-wider ${signal ? 'text-signal' : 'text-text-muted'}`}
                            data-signal-groupe={signal ? 'pave-dominant' : undefined}
                          >
                            {enPoids(pave.octets)} · {Math.round(pave.part)} %
                            {grand && ` · ${pave.fichiers} fichier${pave.fichiers > 1 ? 's' : ''}`}
                          </span>
                        </span>
                        {/* LA PHRASE — seulement sur les grands pavés. Un petit
                            pavé tronque son texte, il ne grandit pas. */}
                        {grand && (
                          <span
                            className={`block truncate text-[11.5px] ${signal ? 'text-signal' : 'text-text-secondary'}`}
                            data-signal-groupe={signal ? 'pave-dominant' : undefined}
                          >
                            {signal
                              ? 'À lui seul, la moitié de la bibliothèque.'
                              : `${Math.round(pave.part)} % de ce qui est stocké.`}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="mt-5 grid gap-5 border-t border-border-row pt-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div>
              <p className="eyebrow">Ce qui est rattaché</p>
              {/*
                LA MAQUETTE COMPTE DES FICHIERS ORPHELINS — « vingt-trois ne
                sont référencés nulle part ». Ici, le rattachement existe
                vraiment : c'est le client. Le chiffre est donc CALCULÉ, pas
                repris de la maquette — et il désigne quelque chose qu'on peut
                corriger en deux clics depuis la liste ci-dessous.
              */}
              <p className="mt-2 text-[12.5px] leading-relaxed text-text-secondary">
                {(() => {
                  const sans = pavage.paves.find((p) => p.cle === 'sans');
                  if (!sans) return 'Chaque média est rattaché à un client.';
                  return `${sans.fichiers} média${sans.fichiers > 1 ? 's ne sont' : ' n’est'} rattaché${sans.fichiers > 1 ? 's' : ''} à aucun client — ${enPoids(sans.octets)}. Un média sans client ne se retrouve que par sa date : le rattacher est le seul rangement que cet écran connaisse.`;
                })()}
              </p>
            </div>
            <div>
              <p className="eyebrow">Le poids</p>
              <p className="tnum mt-2 text-[27px] font-semibold leading-none text-text-primary">
                {enPoids(pavage.total)}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                {pavage.paves.reduce((n, p) => n + p.fichiers, 0)} média
                {pavage.paves.reduce((n, p) => n + p.fichiers, 0) > 1 ? 's' : ''}
              </p>
              <p className="mt-3 border-t border-border-row pt-3 text-[12.5px] leading-relaxed text-text-muted">
                {pavage.vieux > 0 ? (
                  <>
                    Archiver les {pavage.vieux} média{pavage.vieux > 1 ? 's' : ''} de plus de trois
                    mois libérerait {enPoids(pavage.vieuxOctets)}. Rien ne les archive tout seul :
                    c’est une mesure, pas une promesse.
                  </>
                ) : (
                  <>Aucun média n’a plus de trois mois.</>
                )}
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted">
                Le produit ne fixe pas de quota : les parts sont rapportées au total réel, pas à une
                limite.
              </p>
            </div>
          </div>
        </motion.section>
      )}

      {/*
        LES TROIS RÈGLES DU MODULE, dites une fois sous la grille.

        Elles existaient dans le code et nulle part à l'écran : images
        uniquement, réduites avant d'être enregistrées, et l'aperçu plein écran
        qui se ferme à Échap. Les deux premières expliquent un refus avant qu'il
        arrive ; la troisième est un raccourci qu'on ne devine pas.
      */}
      {error && (
        <p role="alert" className="border border-danger/40 bg-danger-muted px-3 py-2 font-mono text-xs text-danger">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-secondary">
            {filter ? 'Aucun média pour ce client.' : 'Aucun média pour l’instant.'}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Les images sont réduites à {MAX_DIMENSION} px avant d’être enregistrées
          </p>
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {items.map((item) => (
            <motion.figure
              key={item.id}
              variants={staggerItem}
              className="flex flex-col border border-border bg-surface"
            >
              <button
                type="button"
                onClick={() => setPreview(item.dataUrl)}
                className="aspect-square overflow-hidden bg-bg"
              >
                <img
                  src={item.dataUrl}
                  alt={item.name}
                  className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
                />
              </button>
              <figcaption className="flex flex-col gap-1.5 p-2">
                <span className="truncate text-xs text-text-primary">{item.name}</span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
                  {relativeTime(item.createdAt)}
                </span>
                <div className="flex items-center gap-1">
                  <Contact size={11} strokeWidth={1.9} className="flex-shrink-0 text-text-muted" />
                  <select
                    value={item.clientId === null ? '' : String(item.clientId)}
                    onChange={(e) => relink(item.id, e.target.value)}
                    className="input-focus min-w-0 flex-1 cursor-pointer border border-border bg-bg px-1 py-0.5 font-mono text-[9px] text-text-secondary outline-none"
                  >
                    <option value="">Sans client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={String(client.id)}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                  <ConfirmDelete onConfirm={() => remove('media', item.id)} label="Supprimer le média" size={12} />
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </motion.div>
      )}

      {items.length > 0 && (
        <p className="font-mono text-[9.5px] uppercase leading-[1.8] tracking-[0.14em] text-text-muted">
          Images seules · réduites à 1600 px avant enregistrement · l’aperçu plein écran se ferme à Échap
        </p>
      )}

      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreview(null)}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-6"
          >
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => setPreview(null)}
              className="absolute right-4 top-4 text-white/70 hover:text-white"
            >
              <X size={20} strokeWidth={2} />
            </button>
            <img src={preview} alt="" className="max-h-full max-w-full object-contain" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
