import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Check, CheckSquare, Contact, EyeOff, FolderKanban, NotebookPen, Plus, ReceiptEuro, BellRing, Settings, Users } from 'lucide-react';
import { Bouton, Carte, Saisie } from '../../socle/ui';
import type { Famille } from '../../socle/familles';
import { useAssistant } from '../../assistant/AssistantContext';
import { guideVu, signalerGuide } from '../../guide/memoire';
import { Ajmani, type Geste } from './ajmani/Ajmani';
import { Bulle } from './ajmani/Bulle';
import type { Emotion } from './ajmani/expressions';
import { lireParole, useParole, quelquUnEstOccupe } from './ajmani/memoire';
import { astuceDuMoment, choisir, masquerAstuce, noterAstuce, noterReaction, peutReagir, repliqueDuJour } from './ajmani/parole';
import { useRegistre } from './ajmani/registre';
import { accueilEcoute, ecouterFetes, MOMENTS_FETES } from './ajmani/reactions';
import type { Astuce } from './ajmani/phrases';
import { ajouter, basculerFait, masquer, toutReafficher, troisChoses, type LigneFil } from './filDuJour';
import { useAccueilLangue, type CleAccueil } from './i18n';
import { choisirScene, type Scene } from './scenes';
import { useJourneeVivante, type JourneeVivante } from './useJourneeVivante';

/**
 * L'ACCUEIL VIVANT (`42k`) — Ajmani, le fil du jour, les modules à leur place.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * En haut, une SCÈNE qui change avec le moment (`scenes.ts`) : Ajmani, ce
 * qu'il dit, et ce qu'il propose. En dessous, le fil du jour, modifiable.
 * Tout en bas, la grille des modules — toujours la même, au même endroit,
 * quelle que soit la scène.
 *
 * Ajmani est la même personne que l'assistant ⌘J : un clic sur lui ouvre le
 * panneau ; quand l'assistant réfléchit ou écoute, son visage le montre.
 */

const SCENE_TITRE: Record<Scene, CleAccueil> = {
  neuf: 'scene.neuf',
  alerte: 'scene.alerte',
  matin: 'scene.matin',
  calme: 'scene.calme',
  soir: 'scene.soir',
};

/** La grille fixe. L'ordre ne dépend de rien : c'est ce qui permet de la retrouver les yeux fermés. */
const MODULES: { cle: CleAccueil; vers: string; famille: Famille; icone: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }> }[] = [
  { cle: 'module.agenda', vers: '/agenda', famille: 'jour', icone: CalendarDays },
  { cle: 'module.tasks', vers: '/tasks', famille: 'jour', icone: CheckSquare },
  { cle: 'module.clients', vers: '/clients', famille: 'contacts', icone: Contact },
  { cle: 'module.invoices', vers: '/facturation', famille: 'argent', icone: ReceiptEuro },
  { cle: 'module.reminders', vers: '/relances', famille: 'argent', icone: BellRing },
  { cle: 'module.notes', vers: '/notes', famille: 'ecrire', icone: NotebookPen },
  { cle: 'module.team', vers: '/team', famille: 'echanger', icone: Users },
  { cle: 'module.projects', vers: '/projets', famille: 'creer', icone: FolderKanban },
  { cle: 'module.settings', vers: '/settings', famille: 'outils', icone: Settings },
];

export function AccueilVivant() {
  const j = useJourneeVivante();
  const { langue, ta } = useAccueilLangue();
  const registre = useRegistre();
  const [parole, transformer] = useParole(j.email);
  const assistant = useAssistant();
  const navigate = useNavigate();

  const mise = useMemo(() => choisirScene(j.journee), [j.journee]);

  /* La réplique de la scène : choisie une fois par jour et par scène. */
  const repliqueScene = useMemo(
    () => repliqueDuJour(parole, j.jour, mise.scene, langue, mise.situation, registre, mise.params),
    [parole, j.jour, mise.scene, mise.situation, mise.params, langue, registre],
  );
  useEffect(() => {
    if (repliqueScene.etat !== parole) transformer(() => repliqueScene.etat);
  }, [repliqueScene, parole, transformer]);

  /* Une réaction en cours (facture encaissée, nouveau client) prend le pas quelques secondes. */
  const [reaction, setReaction] = useState<{ texte: string; cle: number } | null>(null);
  const [cleGeste, setCleGeste] = useState(0);
  useEffect(() => {
    accueilEcoute.prendre();
    const off = ecouterFetes((m) => {
      const maintenant = Date.now();
      const jour = j.jour;
      const etat = lireParole(j.email);
      if (!peutReagir(etat, maintenant, jour) || quelquUnEstOccupe(maintenant)) return;
      const { replique, etat: apres } = choisir(etat, langue, MOMENTS_FETES[m.type], registre);
      transformer(() => noterReaction(apres, maintenant, jour));
      setReaction({ texte: replique.texte, cle: maintenant });
      setCleGeste((n) => n + 1);
    });
    return () => {
      off();
      accueilEcoute.rendre();
    };
  }, [j.jour, j.email, langue, registre, transformer]);
  useEffect(() => {
    if (!reaction) return undefined;
    const t = setTimeout(() => setReaction(null), 5000);
    return () => clearTimeout(t);
  }, [reaction]);

  /* Le visage suit l'assistant : il réfléchit, il écoute. */
  let emotion: Emotion = mise.emotion;
  let geste: Geste | null = mise.geste;
  if (reaction) {
    emotion = 'tres-content';
    geste = 'sautiller';
  } else if (assistant.isThinking) {
    emotion = 'concentre';
    geste = null;
  } else if (assistant.voixEtat === 'enregistrement' || assistant.voixEtat === 'transcription') {
    emotion = 'curieux';
    geste = null;
  }
  // Le geste de la scène est joué une fois à l'arrivée, puis il se repose (sauf pointer, tenu sur l'alerte).
  const [gesteJoue, setGesteJoue] = useState(false);
  useEffect(() => {
    setGesteJoue(false);
    const t = setTimeout(() => setGesteJoue(true), 1600);
    return () => clearTimeout(t);
  }, [mise.scene]);
  const gesteAffiche = reaction ? geste : geste === 'pointer' && mise.scene === 'alerte' ? geste : gesteJoue ? null : geste;

  const texte = reaction?.texte ?? repliqueScene.texte;

  /* L'astuce du jour : au plus deux par jour, jamais une masquée, jamais pendant une alerte. */
  const astuce = mise.scene === 'alerte' || mise.scene === 'neuf' ? null : astuceDuMoment(parole, j.jour);
  const [astuceAffichee, setAstuceAffichee] = useState<{ astuce: Astuce; texte: string } | null>(null);
  // Une astuce par passage sur l'Accueil, au plus : la fermer n'en appelle pas une autre.
  const astuceMontree = useRef(false);
  useEffect(() => {
    if (!astuce || astuceAffichee || astuceMontree.current) return undefined;
    // Il attend que la page se soit posée, et que personne n'écrive.
    const t = setTimeout(() => {
      if (quelquUnEstOccupe()) return;
      astuceMontree.current = true;
      const { replique, etat } = choisir(lireParole(j.email), langue, astuce, registre);
      transformer(() => noterAstuce(etat, j.jour, astuce));
      setAstuceAffichee({ astuce, texte: replique.texte });
    }, 2500);
    return () => clearTimeout(t);
  }, [astuce, astuceAffichee, j.jour, j.email, langue, registre, transformer]);

  return (
    <div className="flex flex-col gap-6" data-accueil="vivant">
      <h1 className="sr-only">{ta('accueil.titre')}</h1>

      {/* ── La scène ───────────────────────────────────────────────────── */}
      <section aria-labelledby="accueil-scene" className="grid items-center gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8">
        <button
          type="button"
          onClick={() => assistant.open('chat')}
          aria-label={ta('accueil.parler')}
          title={ta('accueil.ajmani')}
          className="justify-self-center rounded-3xl p-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-socle-focus sm:justify-self-start"
        >
          <Ajmani emotion={emotion} geste={gesteAffiche} cleGeste={cleGeste} direction="droite" taille={196} entree />
        </button>
        <div className="flex min-w-0 flex-col gap-4">
          <p id="accueil-scene" className="font-mono text-[11px] uppercase tracking-[0.14em] text-socle-texte-doux">
            {ta(SCENE_TITRE[mise.scene])}
          </p>
          <Bulle texte={texte} alerte={mise.scene === 'alerte'} />
          {!reaction && <ContenuScene scene={mise.scene} j={j} />}
        </div>
      </section>

      {astuceAffichee && (
        <div role="note" className="flex flex-wrap items-center gap-3 rounded-xl border border-socle-bord bg-socle-surface px-4 py-3 text-[14px] text-socle-texte-doux">
          <span className="min-w-0 flex-1">{astuceAffichee.texte}</span>
          <Bouton
            taille="petit"
            variante="discret"
            onClick={() => {
              transformer((e) => masquerAstuce(e, astuceAffichee.astuce));
              setAstuceAffichee(null);
            }}
          >
            {ta('astuce.masquer')}
          </Bouton>
          <Bouton taille="petit" variante="discret" onClick={() => setAstuceAffichee(null)} aria-label={ta('astuce.fermer')}>
            ×
          </Bouton>
        </div>
      )}

      {/* ── Le fil du jour ─────────────────────────────────────────────── */}
      <FilDuJour j={j} />

      {/* ── Les modules : toujours là, toujours dans cet ordre ──────────── */}
      <nav aria-label={ta('modules.titre')}>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-socle-texte-doux">{ta('modules.titre')}</p>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
          {MODULES.map((m) => {
            const Icone = m.icone;
            return (
              <li key={m.cle} data-famille={m.famille}>
                <button
                  type="button"
                  onClick={() => navigate(m.vers)}
                  className="flex min-h-[72px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-socle-bord bg-socle-surface px-2 py-3 text-[12.5px] font-semibold text-socle-texte hover:bg-socle-survol focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-socle-focus"
                >
                  <span className="text-[var(--fam-texte)]">
                    <Icone size={18} aria-hidden />
                  </span>
                  {ta(m.cle)}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/* ── Ce que chaque scène propose sous la bulle ─────────────────────────── */

function ContenuScene({ scene, j }: { scene: Scene; j: JourneeVivante }) {
  const { ta } = useAccueilLangue();
  const navigate = useNavigate();

  if (scene === 'neuf') {
    const etapes: { cle: CleAccueil; fait: boolean; aller: () => void }[] = [
      { cle: 'neuf.etape.client', fait: j.etapes.client, aller: () => navigate('/clients') },
      { cle: 'neuf.etape.rdv', fait: j.etapes.rdv, aller: () => navigate('/agenda') },
      // La visite est celle du guide existant : sa mémoire dit si elle a été vue, son événement la rouvre.
      { cle: 'neuf.etape.visite', fait: guideVu('general', j.email), aller: () => signalerGuide() },
    ];
    return (
      <ol className="flex flex-col gap-2">
        {etapes.map((e, i) => (
          <li key={e.cle} className="flex items-center gap-3 rounded-xl border border-socle-bord bg-socle-surface px-3 py-2.5">
            <span aria-hidden className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-[12px] font-bold ${e.fait ? 'bg-etat-succes-fond text-etat-succes-texte' : 'border border-socle-bord-fort text-socle-texte-doux'}`}>
              {e.fait ? <Check size={14} /> : i + 1}
            </span>
            <span className={`min-w-0 flex-1 text-[14px] ${e.fait ? 'text-socle-texte-discret line-through' : 'text-socle-texte'}`}>{ta(e.cle)}</span>
            {e.fait ? (
              <span className="text-[12px] text-socle-texte-doux">{ta('neuf.fait')}</span>
            ) : (
              <Bouton taille="petit" variante={i === etapes.findIndex((x) => !x.fait) ? 'primaire' : 'secondaire'} onClick={e.aller}>
                {ta('neuf.faire')}
              </Bouton>
            )}
          </li>
        ))}
      </ol>
    );
  }

  if (scene === 'alerte' && j.alerte) {
    const a = j.alerte;
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-socle-bord-fort bg-socle-surface px-4 py-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-socle-texte">{a.titre}</span>
          <span className="block text-[12.5px] text-socle-texte-doux">{a.detail}</span>
        </span>
        <Bouton variante="primaire" taille="petit" onClick={() => navigate(a.vers)}>
          {ta('alerte.ouvrir')}
        </Bouton>
      </div>
    );
  }

  if (scene === 'matin') {
    const trois = troisChoses(j.fil);
    if (!trois.length) return null;
    return (
      <ol className="grid gap-2 sm:grid-cols-3">
        {trois.map((l, i) => (
          <li key={l.cle} data-famille={l.famille}>
            <button
              type="button"
              onClick={() => l.vers && navigate(l.vers)}
              disabled={!l.vers}
              className="flex h-full w-full flex-col items-start gap-1 rounded-xl border border-socle-bord bg-socle-surface px-3 py-2.5 text-left hover:bg-socle-survol focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-socle-focus disabled:hover:bg-socle-surface"
            >
              <span className="font-mono text-[11px] text-[var(--fam-texte)]">{i + 1}</span>
              <span className="text-[14px] font-semibold text-socle-texte">{l.titre}</span>
              {l.detail && <span className="text-[12px] text-socle-texte-doux">{l.detail}</span>}
            </button>
          </li>
        ))}
      </ol>
    );
  }

  if (scene === 'calme') {
    return (
      <div>
        <Bouton variante="secondaire" taille="petit" onClick={() => navigate(j.module.vers)}>
          {ta('calme.ouvrir', { module: ta(j.module.cle) })}
        </Bouton>
      </div>
    );
  }

  if (scene === 'soir') {
    return (
      <dl className="flex gap-6">
        <div>
          <dt className="sr-only">{ta('soir.faits')}</dt>
          <dd className="tnum text-[28px] font-bold leading-none text-socle-texte">{j.journee.faitsAujourdhui}</dd>
          <dd className="mt-1 text-[12px] text-socle-texte-doux">{ta('soir.faits')}</dd>
        </div>
        <div>
          <dt className="sr-only">{ta('soir.restants')}</dt>
          <dd className="tnum text-[28px] font-bold leading-none text-socle-texte-doux">{j.journee.restants}</dd>
          <dd className="mt-1 text-[12px] text-socle-texte-doux">{ta('soir.restants')}</dd>
        </div>
      </dl>
    );
  }
  return null;
}

/* ── Le fil du jour ────────────────────────────────────────────────────── */

function FilDuJour({ j }: { j: JourneeVivante }) {
  const { ta } = useAccueilLangue();
  const navigate = useNavigate();
  const [ajout, setAjout] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const champ = useRef<HTMLInputElement>(null);

  const valider = (e: React.FormEvent) => {
    e.preventDefault();
    j.retoucher((r, jour) => ajouter(r, jour, ajout, Date.now().toString(36)));
    setAjout('');
    setOuvert(false);
  };

  return (
    <Carte
      famille="jour"
      surtitre={ta('fil.titre')}
      actions={
        !ouvert && (
          <Bouton taille="petit" variante="discret" icone={<Plus size={14} aria-hidden />} onClick={() => setOuvert(true)}>
            {ta('fil.ajouter')}
          </Bouton>
        )
      }
    >
      <p className="mb-3 text-[12.5px] text-socle-texte-doux">{ta('fil.aide')}</p>
      {ouvert && (
        <form onSubmit={valider} className="mb-3 flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            {/* Le champ ne prend le focus que parce qu'on vient de demander à écrire. */}
            <Saisie ref={champ} etiquette={ta('fil.ajouter')} aide={ta('fil.ajouter.aide')} value={ajout} maxLength={140} onChange={(e) => setAjout(e.target.value)} autoFocus />
          </div>
          <Bouton type="submit" taille="moyen" variante="secondaire" disabled={!ajout.trim()}>
            {ta('fil.ajouter.ok')}
          </Bouton>
        </form>
      )}
      {j.fil.length === 0 ? (
        <p className="py-4 text-[14px] text-socle-texte-doux">{ta('fil.vide')}</p>
      ) : (
        <ul className="flex flex-col">
          {j.fil.map((l) => (
            <LigneDuFil key={l.cle} l={l} onFait={() => j.retoucher((r, jour) => basculerFait(r, jour, l.cle))} onMasquer={() => j.retoucher((r, jour) => masquer(r, jour, l.cle))} onOuvrir={l.vers ? () => navigate(l.vers as string) : undefined} />
          ))}
        </ul>
      )}
      {j.masquees > 0 && (
        <Bouton className="mt-2" taille="petit" variante="discret" onClick={() => j.retoucher((r, jour) => toutReafficher(r, jour))}>
          {ta('fil.reafficher', { n: j.masquees })}
        </Bouton>
      )}
    </Carte>
  );
}

function LigneDuFil({ l, onFait, onMasquer, onOuvrir }: { l: LigneFil & { fait: boolean }; onFait: () => void; onMasquer: () => void; onOuvrir?: () => void }) {
  const { ta } = useAccueilLangue();
  return (
    <li data-famille={l.famille} className="flex items-center gap-3 border-b border-socle-bord py-2 last:border-b-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={l.fait}
        aria-label={`${l.fait ? ta('fil.defait') : ta('fil.fait')} : ${l.titre}`}
        onClick={onFait}
        className={`flex h-6 w-6 flex-none items-center justify-center rounded-md border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-socle-focus ${
          l.fait ? 'border-[var(--fam)] bg-[var(--fam-fond)] text-[var(--fam-texte)]' : 'border-socle-bord-fort'
        }`}
      >
        {l.fait && <Check size={14} aria-hidden />}
      </button>
      <span aria-hidden className="h-2 w-2 flex-none rounded-full bg-[var(--fam)]" />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[14px] ${l.fait ? 'text-socle-texte-discret line-through' : 'text-socle-texte'}`}>{l.titre}</span>
        {l.detail && <span className="block text-[12px] text-socle-texte-doux">{l.detail}</span>}
      </span>
      {onOuvrir && !l.fait && (
        <Bouton taille="petit" variante="discret" onClick={onOuvrir}>
          {ta('fil.ouvrir')}
        </Bouton>
      )}
      <Bouton taille="petit" variante="discret" onClick={onMasquer} aria-label={`${ta('fil.masquer')} : ${l.titre}`} title={ta('fil.masquer')}>
        <EyeOff size={14} aria-hidden />
      </Bouton>
    </li>
  );
}
