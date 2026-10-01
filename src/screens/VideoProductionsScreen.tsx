import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { Champ } from '../components/formulaire/Champ';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { SaveIndicator } from '../components/SaveIndicator';
import { PiecesJointes } from '../components/PiecesJointes';
import {
  ArrowLeft,
  Calendar,
  Clapperboard,
  Film,
  Image as ImageIcon,
  Link2,
  Mail,
  Phone,
  Plus,
  UserCheck,
  Users,
} from 'lucide-react';
import { useExclusive } from '@edition/exclusive';
import { useMembers } from '../state/useMembers';
import { useProfiles } from '../state/ProfilesContext';
import {
  STATUT_LABEL,
  brouillonVide,
  useVideoProductions,
  type ContactVideo,
  type PersonneConception,
  type StatutProductionVideo,
  type VideoProduction,
  type VideoProductionDraft,
} from '../state/useVideoProductions';

/**
 * PRODUCTION VIDÉO — une fiche par vidéo, de l'idée à la publication.
 *
 * Demande de Syraagensy : suivre une sortie vidéo de bout en bout, sans fil
 * de discussion ni tableur à part. Trois sections fixes sur chaque fiche —
 * Conception, Statut, Détails — exactement celles demandées ; voir
 * docs/production-video.md pour ce qui reste à préciser avec la cliente
 * (le statut n'est pas figé : la liste se complète ici, à un seul endroit).
 *
 * Même rangement que l'écran Clients : une liste à gauche de l'objet
 * sélectionné, la fiche à droite, « ← Vidéos » pour revenir. Contrairement à
 * Clients, cet écran ne reçoit jamais de focus par état de navigation — donc
 * pas le défaut corrigé là-bas (« pas de retour depuis une fiche client »).
 */

const STATUTS: StatutProductionVideo[] = ['idee', 'tournage', 'montage', 'publie'];
const PASTILLE: Record<StatutProductionVideo, string> = {
  idee: 'bg-text-muted',
  tournage: 'bg-warning',
  montage: 'bg-accent',
  publie: 'bg-success',
};
const ACCEPTE_IMAGE = 'image/png,image/jpeg,image/webp,image/gif';

const jourLisible = (iso: string) => {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Les comptes qui peuvent être cochés comme présents sur la conception — les mêmes qu'ailleurs dans l'organisation. */
function usePersonnesDisponibles(): PersonneConception[] {
  const { TEAM_MEMBERS } = useExclusive();
  const { membres } = useMembers();
  const { profileFor } = useProfiles();
  return useMemo(() => {
    const vus = new Map<string, PersonneConception>();
    for (const m of membres) if (m.id !== 'moi' && m.email) vus.set(m.email, { email: m.email, nom: profileFor(m.email).name || m.email.split('@')[0] });
    for (const m of TEAM_MEMBERS) if (!vus.has(m.email)) vus.set(m.email, { email: m.email, nom: m.name });
    return [...vus.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [membres, TEAM_MEMBERS, profileFor]);
}

export function VideoProductionsScreen() {
  const { videos, creerVideo, patchVideo, supprimerVideo } = useVideoProductions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => videos.find((v) => v.id === selectedId) ?? null, [videos, selectedId]);

  const nouvelle = () => {
    const id = creerVideo(brouillonVide());
    setSelectedId(id);
  };

  if (selected) {
    return (
      <FicheVideo
        video={selected}
        onPatch={(patch) => patchVideo(selected.id, patch)}
        onSupprimer={() => {
          supprimerVideo(selected.id);
          setSelectedId(null);
        }}
        onFermer={() => setSelectedId(null)}
      />
    );
  }

  return (
    <ListeVideos
      videos={videos}
      onOuvrir={setSelectedId}
      onNouvelle={nouvelle}
    />
  );
}

function ListeVideos({
  videos,
  onOuvrir,
  onNouvelle,
}: {
  videos: VideoProduction[];
  onOuvrir: (id: string) => void;
  onNouvelle: () => void;
}) {
  const [filtre, setFiltre] = useState<StatutProductionVideo | 'toutes'>('toutes');
  const comptes = useMemo(() => {
    const c: Record<string, number> = { toutes: videos.length };
    for (const s of STATUTS) c[s] = videos.filter((v) => v.statut === s).length;
    return c;
  }, [videos]);
  const affichees = filtre === 'toutes' ? videos : videos.filter((v) => v.statut === filtre);
  const enCours = videos.filter((v) => v.statut !== 'publie').length;

  return (
    <section className="flex flex-col gap-5 p-4 sm:p-6">
      <ScreenHeader
        eyebrow="Marketing · Production vidéo"
        title="Production vidéo"
        description={
          videos.length > 0
            ? `${enCours} vidéo${enCours > 1 ? 's' : ''} en cours, de l’idée à la publication.`
            : 'Suivez chaque vidéo de l’idée jusqu’à la publication : une fiche, trois temps.'
        }
        stats={
          videos.length > 0
            ? [
                { label: 'Fiches', value: videos.length },
                { label: 'En tournage', value: comptes.tournage },
                { label: 'En montage', value: comptes.montage },
                { label: 'Publiées', value: comptes.publie },
              ]
            : undefined
        }
        actions={
          <button
            type="button"
            onClick={onNouvelle}
            className="flex items-center gap-1.5 bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            <Plus size={15} strokeWidth={2.25} /> Nouvelle vidéo
          </button>
        }
      />

      {videos.length === 0 ? (
        <FirstRun
          icone={Film}
          title="Aucune vidéo pour l’instant"
          action={{ label: 'Créer la première fiche', onClick: onNouvelle }}
        >
          Chaque vidéo a sa fiche : l’idée, le synopsis, le jour de tournage, le texte à lire, et
          ensuite le statut jusqu’à la publication.
        </FirstRun>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrer par statut">
            {(['toutes', ...STATUTS] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={filtre === s}
                onClick={() => setFiltre(s)}
                className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition-colors ${
                  filtre === s
                    ? 'border-border-strong bg-surface text-text-primary'
                    : 'border-border text-text-secondary hover:bg-surface-hover'
                }`}
              >
                {s !== 'toutes' && <span className={`h-1.5 w-1.5 rounded-full ${PASTILLE[s]}`} aria-hidden />}
                {s === 'toutes' ? 'Toutes' : STATUT_LABEL[s]}
                <span className="font-mono text-[10px] text-text-muted">{comptes[s]}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col divide-y divide-border border border-border bg-surface">
            {affichees.length === 0 ? (
              <p className="p-4 text-sm text-text-secondary">Aucune vidéo dans ce statut.</p>
            ) : (
              affichees.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onOuvrir(v.id)}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                >
                  <span className={`h-2 w-2 flex-none rounded-full ${PASTILLE[v.statut]}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-text-primary">
                      {v.idee || 'Sans titre'}
                    </span>
                    {v.synopsis && (
                      <span className="block truncate text-xs text-text-muted">{v.synopsis}</span>
                    )}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                    {STATUT_LABEL[v.statut]}
                  </span>
                  <span className="w-32 flex-none text-right font-mono text-[11px] text-text-muted">
                    {jourLisible(v.jourDeSortiePrevu) ? `sortie ${jourLisible(v.jourDeSortiePrevu)}` : 'sortie à fixer'}
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}

function FicheVideo({
  video,
  onPatch,
  onSupprimer,
  onFermer,
}: {
  video: VideoProduction;
  onPatch: (patch: Partial<VideoProductionDraft> & { inspiPieces?: VideoProduction['inspiPieces'] }) => void;
  onSupprimer: () => void;
  onFermer: () => void;
}) {
  const personnesDisponibles = usePersonnesDisponibles();
  const [sauvegarde, setSauvegarde] = useState(false);

  /* Chaque champ s'enregistre à la perte de focus / au changement — pas de bouton « Enregistrer »
     séparé, comme le reste des fiches synchronisées du produit (Clients, Tâches…). */
  const champ = <K extends keyof VideoProductionDraft>(cle: K, valeur: VideoProductionDraft[K]) => {
    onPatch({ [cle]: valeur } as Partial<VideoProductionDraft>);
    setSauvegarde(true);
    window.setTimeout(() => setSauvegarde(false), 1200);
  };

  const basculerPersonne = (p: PersonneConception) => {
    const present = video.personnesPresentes.some((x) => x.email === p.email);
    champ(
      'personnesPresentes',
      present ? video.personnesPresentes.filter((x) => x.email !== p.email) : [...video.personnesPresentes, p],
    );
  };

  const contact = (patch: Partial<ContactVideo>) => champ('contact', { ...video.contact, ...patch });

  return (
    <div className="flex flex-col p-4 sm:p-6">
      <div className="border border-border bg-surface">
        {/* Le fil d'Ariane : un bouton local, sans état de navigation — jamais le défaut de Clients. */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <button
            type="button"
            onClick={onFermer}
            className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-text-secondary transition-colors hover:text-text-primary"
          >
            <ArrowLeft size={13} strokeWidth={1.9} />
            Vidéos
            <span className="eyebrow">·</span>
            <span className="eyebrow normal-case tracking-normal text-text-primary">{video.idee || 'Sans titre'}</span>
          </button>
          <div className="flex items-center gap-3">
            <SaveIndicator saved={sauvegarde} />
            <ConfirmDelete onConfirm={onSupprimer} label="Supprimer la vidéo" />
          </div>
        </div>

        <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-2">
          {/* ───────────────────────────── Conception ───────────────────────────── */}
          <section className="flex flex-col gap-4">
            <p className="eyebrow flex items-center gap-1.5 text-text-secondary">
              <Clapperboard size={13} strokeWidth={2} /> Conception
            </p>
            <Champ intitule="Idée" aide="Le titre de travail, en une phrase.">
              <input
                value={video.idee}
                onChange={(e) => champ('idee', e.target.value)}
                placeholder="« Le café qui ouvre à 5 h du matin »"
              />
            </Champ>
            <Champ intitule="Synopsis" aide="Ce qu’on voit, dans l’ordre, en quelques lignes.">
              <textarea rows={4} value={video.synopsis} onChange={(e) => champ('synopsis', e.target.value)} />
            </Champ>
            <Champ intitule="Jour de tournage">
              <input type="date" value={video.jourDeTournage} onChange={(e) => champ('jourDeTournage', e.target.value)} />
            </Champ>
            <Champ intitule="Texte à lire" aide="Ce qui sera dit ou lu à l’écran, mot pour mot.">
              <textarea rows={5} value={video.texteALire} onChange={(e) => champ('texteALire', e.target.value)} />
            </Champ>
            <div className="flex flex-col gap-2">
              <p className="eyebrow flex items-center gap-1.5">
                <ImageIcon size={12} strokeWidth={2} /> Inspi photo
              </p>
              <Champ intitule="Lien d’inspiration" aide="Pinterest, Instagram, une page — collé tel quel.">
                <input
                  value={video.inspiLien}
                  onChange={(e) => champ('inspiLien', e.target.value)}
                  placeholder="https://…"
                />
              </Champ>
              {video.inspiLien && (
                <a
                  href={video.inspiLien}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex w-fit items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary"
                >
                  <Link2 size={12} /> Ouvrir le lien
                </a>
              )}
              <PiecesJointes
                pieces={video.inspiPieces}
                onChange={(pieces) => onPatch({ inspiPieces: pieces })}
                accepte={ACCEPTE_IMAGE}
                libelle="Joindre une image d’inspiration"
              />
            </div>
          </section>

          {/* ───────────────────────────── Statut ───────────────────────────── */}
          <section className="flex flex-col gap-4">
            <p className="eyebrow flex items-center gap-1.5 text-text-secondary">
              <Calendar size={13} strokeWidth={2} /> Statut
            </p>
            <Champ intitule="Jour de sortie prévu">
              <input
                type="date"
                value={video.jourDeSortiePrevu}
                onChange={(e) => champ('jourDeSortiePrevu', e.target.value)}
              />
            </Champ>
            <Champ intitule="Statut de la production" aide="La liste peut s’allonger : Reportée, Annulée… à préciser avec vous.">
              <select value={video.statut} onChange={(e) => champ('statut', e.target.value as StatutProductionVideo)}>
                {STATUTS.map((s) => (
                  <option key={s} value={s}>
                    {STATUT_LABEL[s]}
                  </option>
                ))}
              </select>
            </Champ>
            <div className="flex items-center gap-2 border border-border bg-sunken px-3.5 py-2.5">
              <span className={`h-2 w-2 flex-none rounded-full ${PASTILLE[video.statut]}`} aria-hidden />
              <span className="text-sm text-text-secondary">
                Actuellement <strong className="font-semibold text-text-primary">{STATUT_LABEL[video.statut]}</strong>
                {jourLisible(video.jourDeSortiePrevu) ? ` · sortie prévue le ${jourLisible(video.jourDeSortiePrevu)}` : ''}
              </span>
            </div>

            {/* ───────────────────────────── Détails ───────────────────────────── */}
            <p className="eyebrow mt-2 flex items-center gap-1.5 text-text-secondary">Détails</p>
            <Champ intitule="Description">
              <textarea rows={3} value={video.description} onChange={(e) => champ('description', e.target.value)} />
            </Champ>
            <Champ intitule="Compte de publication" aide="Sur quel compte ça sort : « Instagram @syraagensy », « YouTube — chaîne principale »…">
              <input
                value={video.comptePublication}
                onChange={(e) => champ('comptePublication', e.target.value)}
              />
            </Champ>

            <div className="flex flex-col gap-2">
              <p className="eyebrow flex items-center gap-1.5">
                <Users size={12} strokeWidth={2} /> Personnes présentes sur la conception
              </p>
              {personnesDisponibles.length === 0 ? (
                <p className="text-xs text-text-muted">Aucun autre compte dans l’organisation pour l’instant.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {personnesDisponibles.map((p) => {
                    const coche = video.personnesPresentes.some((x) => x.email === p.email);
                    return (
                      <button
                        key={p.email}
                        type="button"
                        onClick={() => basculerPersonne(p)}
                        aria-pressed={coche}
                        className={`flex items-center gap-1.5 border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          coche
                            ? 'border-border-strong bg-surface text-text-primary'
                            : 'border-border text-text-secondary hover:bg-surface-hover'
                        }`}
                      >
                        {coche && <UserCheck size={12} strokeWidth={2.2} />}
                        {p.nom}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border border-border bg-sunken p-3.5">
              <p className="eyebrow">Fiche contact adaptée</p>
              <p className="text-xs text-text-muted">Qui contacter pour cette vidéo — pas forcément une fiche client existante.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Champ intitule="Nom">
                  <input value={video.contact.nom} onChange={(e) => contact({ nom: e.target.value })} />
                </Champ>
                <Champ intitule="Rôle">
                  <input value={video.contact.role} onChange={(e) => contact({ role: e.target.value })} placeholder="Talent, assistant·e, lieu…" />
                </Champ>
                <Champ intitule="Téléphone">
                  <input value={video.contact.telephone} onChange={(e) => contact({ telephone: e.target.value })} />
                </Champ>
                <Champ intitule="E-mail">
                  <input value={video.contact.email} onChange={(e) => contact({ email: e.target.value })} />
                </Champ>
              </div>
              <Champ intitule="Notes">
                <textarea rows={2} value={video.contact.notes} onChange={(e) => contact({ notes: e.target.value })} />
              </Champ>
              {(video.contact.telephone || video.contact.email) && (
                <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
                  {video.contact.telephone && (
                    <a href={`tel:${video.contact.telephone}`} className="flex items-center gap-1.5 hover:text-text-primary">
                      <Phone size={12} /> {video.contact.telephone}
                    </a>
                  )}
                  {video.contact.email && (
                    <a href={`mailto:${video.contact.email}`} className="flex items-center gap-1.5 hover:text-text-primary">
                      <Mail size={12} /> {video.contact.email}
                    </a>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
