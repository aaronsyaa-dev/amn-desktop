import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { uid } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import type { Piece } from '../donnees/studio';
import type { PieceStudio } from '../donnees/types';
import { Carte, Invitation } from '../ui/kit';
import { enLettres } from '../format';
import { ecartMots, jjmm, segmentsMots, TetePiece, useEcrirePiece, usePieceCourante } from './commun';

/**
 * STUDIO · LA BIBLIOTHÈQUE DE PROMPTS (cahier 14, `48b`).
 *
 * Chaque prompt a sa lignée de versions, v1 → vN, reliées par un filet ; la
 * version en ligne est encadrée. À droite, le prompt ouvert : son texte en
 * mono, copiable, le résultat retenu, et ce qui a changé depuis la version
 * précédente, barré puis remplacé. On ne perd jamais un prompt qui a marché :
 * une nouvelle version s'ajoute, elle ne remplace rien.
 *
 * L'ambre : la version en ligne du prompt ouvert.
 */

type Prompt = NonNullable<PieceStudio['prompts']>[number];
type Version = Prompt['versions'][number];

export function StudioPrompts() {
  const { p, absente } = usePieceCourante();
  if (!p) return <>{absente}</>;
  return <Bibliotheque p={p} />;
}

function Bibliotheque({ p }: { p: Piece }) {
  const ecrire = useEcrirePiece();
  const { user } = useAuth();
  const prompts = p.prompts ?? [];
  const [ouvert, setOuvert] = useState<{ id: string; v: number | null } | null>(null);
  const [comparer, setComparer] = useState(false);
  const [copie, setCopie] = useState(false);
  const [redaction, setRedaction] = useState<{ mode: 'prompt' | 'version'; nom: string; categorie: string; texte: string; resultat: string } | null>(null);

  const pr = prompts.find((x) => x.id === ouvert?.id) ?? prompts[0] ?? null;
  const versions = pr ? [...pr.versions].sort((a, b) => a.v - b.v) : [];
  const enLigne = versions.find((v) => v.enLigne) ?? null;
  const version = (pr && ouvert?.id === pr.id && ouvert.v !== null ? versions.find((v) => v.v === ouvert.v) : null) ?? enLigne ?? versions[versions.length - 1] ?? null;
  const precedente = version ? [...versions].reverse().find((v) => v.v < version.v) ?? null : null;
  const n = prompts.length;

  const majPrompt = (id: string, f: (x: Prompt) => Prompt) => ecrire(p.id, (b) => ({ prompts: (b.prompts ?? []).map((x) => (x.id === id ? f(x) : x)) }));
  const mettreEnLigne = (v: Version) => pr && majPrompt(pr.id, (x) => ({ ...x, versions: x.versions.map((y) => ({ ...y, enLigne: y.v === v.v })) }));
  const copier = async (texte: string) => {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      setTimeout(() => setCopie(false), 1600);
    } catch {
      /* presse-papiers refusé : le texte reste sélectionnable */
    }
  };
  const enregistrer = () => {
    if (!redaction || !redaction.texte.trim()) return;
    const maintenant = new Date().toISOString();
    const par = user?.email ?? '';
    if (redaction.mode === 'prompt') {
      if (!redaction.nom.trim()) return;
      const id = uid('pr');
      ecrire(p.id, (b) => ({ prompts: [...(b.prompts ?? []), { id, nom: redaction.nom.trim(), categorie: redaction.categorie.trim() || undefined, versions: [{ v: 1, texte: redaction.texte.trim(), resultat: redaction.resultat.trim() || undefined, at: maintenant, par }] }] }));
      setOuvert({ id, v: 1 });
    } else if (pr) {
      const v = Math.max(...pr.versions.map((x) => x.v)) + 1;
      majPrompt(pr.id, (x) => ({ ...x, versions: [...x.versions, { v, texte: redaction.texte.trim(), resultat: redaction.resultat.trim() || undefined, at: maintenant, par }] }));
      setOuvert({ id: pr.id, v });
    }
    setRedaction(null);
    setComparer(false);
  };

  const titre = n === 0 ? 'Aucun prompt encore.' : `${enLettres(n, true)} prompt${n > 1 ? 's' : ''}, et ce qu’il${n > 1 ? 's ont' : ' a'} donné.`;
  const champ = 'w-full border border-[#2a2826] bg-transparent px-2.5 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-[#8a8a87]';

  return (
    <>
      <TetePiece
        p={p}
        onglet="prompts"
        titre={titre}
        actions={
          <button type="button" className="bx-btn2" onClick={() => setRedaction({ mode: 'prompt', nom: '', categorie: '', texte: '', resultat: '' })}>
            Nouveau prompt
          </button>
        }
      />
      {redaction && (
        <Carte pad="p-5" className="mb-[18px]" titre={redaction.mode === 'prompt' ? 'Nouveau prompt' : `${pr?.nom ?? ''} · nouvelle version`} droite={redaction.mode === 'version' ? 'la version précédente reste dans la lignée' : ''}>
          {redaction.mode === 'prompt' && (
            <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_200px]">
              <input value={redaction.nom} onChange={(e) => setRedaction({ ...redaction, nom: e.target.value })} placeholder="Son nom (« Texte du hero »)" aria-label="Nom du prompt" className={`${champ} h-9`} />
              <input value={redaction.categorie} onChange={(e) => setRedaction({ ...redaction, categorie: e.target.value })} placeholder="Où il sert (« Accueil »)" aria-label="Où il sert" className={`${champ} h-9`} />
            </div>
          )}
          <textarea value={redaction.texte} onChange={(e) => setRedaction({ ...redaction, texte: e.target.value })} rows={4} placeholder="Le texte du prompt…" aria-label="Le texte du prompt" className={`${champ} resize-y py-2 font-mono`} />
          <input value={redaction.resultat} onChange={(e) => setRedaction({ ...redaction, resultat: e.target.value })} placeholder="Le résultat retenu, s’il y en a un" aria-label="Le résultat retenu" className={`${champ} mt-2 h-9`} />
          <div className="mt-3 flex gap-2.5">
            <button type="button" className="bx-btn" disabled={!redaction.texte.trim() || (redaction.mode === 'prompt' && !redaction.nom.trim())} onClick={enregistrer}>
              Enregistrer
            </button>
            <button type="button" className="bx-btn2" onClick={() => setRedaction(null)}>
              Annuler
            </button>
          </div>
        </Carte>
      )}
      {n === 0 ? (
        <Invitation titre="La bibliothèque est vide." texte="Chaque prompt garde sa lignée : v1, v2, v3… et celle qui est en ligne. Une nouvelle version s’ajoute, elle n’efface jamais celle qui a marché." />
      ) : (
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_420px]">
          <Carte dominante pad="p-6" className="self-start" titre={`Les prompts · ${n}`} droite="lignée des versions · encadrée = en ligne">
            <ul>
              {prompts.map((x) => {
                const on = x.id === pr?.id;
                const vs = [...x.versions].sort((a, b) => a.v - b.v);
                return (
                  <li key={x.id} className="flex items-center gap-4 border-b border-[#1f1e1c] px-3 py-3.5" style={on ? { background: '#1c1b19', boxShadow: 'inset 2px 0 0 var(--color-text-primary)' } : undefined}>
                    <button type="button" onClick={() => { setOuvert({ id: x.id, v: null }); setComparer(false); }} className="min-w-0 flex-1 text-left" aria-pressed={on}>
                      <span className="block truncate text-[14px] font-semibold text-text-primary">{x.nom}</span>
                      {x.categorie && <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">{x.categorie}</span>}
                    </button>
                    <span className="flex flex-none items-center" aria-label={`Les versions de ${x.nom}`}>
                      {vs.map((v, i) => {
                        const vue = on && version?.v === v.v;
                        const ambre = on && v.enLigne;
                        return (
                          <React.Fragment key={v.v}>
                            {i > 0 && <span aria-hidden className="h-px w-[18px] bg-[#3a3834]" />}
                            <button
                              type="button"
                              onClick={() => { setOuvert({ id: x.id, v: v.v }); setComparer(false); }}
                              className="flex h-[22px] min-w-[26px] items-center justify-center px-1 font-mono text-[10.5px] font-semibold"
                              style={{
                                border: `1px solid ${ambre ? AMBRE : v.enLigne ? 'var(--color-text-primary)' : '#3a3834'}`,
                                color: ambre ? AMBRE : v.enLigne || vue ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                                background: vue && !v.enLigne ? '#26241f' : ambre ? 'rgba(208,154,74,.08)' : 'transparent',
                              }}
                              aria-label={`${x.nom}, version ${v.v}${v.enLigne ? ', en ligne' : ''}`}
                              aria-pressed={vue}
                              data-signal-groupe={ambre ? 'prompt-en-ligne' : undefined}
                            >
                              v{v.v}
                            </button>
                          </React.Fragment>
                        );
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Carte>

          {pr && version && (
            <Carte pad="p-6" className="self-start" titre={`${pr.nom} · v${version.v}`} droite={version.enLigne ? `en ligne depuis le ${jjmm(version.at)}` : `écrite le ${jjmm(version.at)}`}>
              <div className="whitespace-pre-wrap border border-[#2a2826] bg-[#0b0a09] p-4 font-mono text-[12.5px] leading-[1.7] text-text-body">
                {comparer && precedente
                  ? segmentsMots(precedente.texte, version.texte).map((s, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && ' '}
                        {s.genre === 'meme' ? s.texte : s.genre === 'retire' ? <del className="text-text-muted">{s.texte}</del> : <ins className="text-text-primary no-underline" style={{ boxShadow: 'inset 0 -1px 0 var(--color-text-primary)' }}>{s.texte}</ins>}
                      </React.Fragment>
                    ))
                  : version.texte}
              </div>
              <div className="mt-3 flex flex-wrap gap-2.5">
                <button type="button" className="bx-btn2" onClick={() => void copier(version.texte)}>
                  {copie ? 'Copié' : 'Copier'}
                </button>
                {precedente && (
                  <button type="button" className="bx-btn2" aria-pressed={comparer} onClick={() => setComparer(!comparer)}>
                    {comparer ? 'Revenir au texte' : `Comparer à v${precedente.v}`}
                  </button>
                )}
                {!version.enLigne && (
                  <button type="button" className="bx-btn2" onClick={() => mettreEnLigne(version)}>
                    La mettre en ligne
                  </button>
                )}
                <button type="button" className="bx-btn2" onClick={() => setRedaction({ mode: 'version', nom: pr.nom, categorie: pr.categorie ?? '', texte: version.texte, resultat: '' })}>
                  Nouvelle version
                </button>
              </div>
              <span className="mt-6 block font-mono text-[9.5px] uppercase tracking-[0.16em] text-text-muted">{version.enLigne ? 'Résultat retenu' : 'Ce qu’elle a donné'}</span>
              {version.resultat ? (
                <p className="mt-2 text-[17px] font-semibold leading-snug text-text-primary">{version.resultat}</p>
              ) : (
                <ResultatANoter onNoter={(r) => majPrompt(pr.id, (x) => ({ ...x, versions: x.versions.map((y) => (y.v === version.v ? { ...y, resultat: r } : y)) }))} />
              )}
              {precedente && (
                <div className="mt-5 border-t border-[#2a2826] pt-4">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-text-muted">
                    De v{precedente.v} à v{version.v}
                  </span>
                  <p className="mt-2 font-mono text-[12px] leading-relaxed text-text-body">
                    {resume(precedente.texte, version.texte).map((c, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <span className="text-text-muted"> · </span>}
                        {c.retire && <del className="text-text-muted">{c.retire}</del>}
                        {c.retire && c.ajoute && ' → '}
                        {!c.retire && '+ '}
                        {c.ajoute}
                      </React.Fragment>
                    ))}
                  </p>
                </div>
              )}
            </Carte>
          )}
        </div>
      )}
    </>
  );
}

/** Le résumé de l'écart : la longueur si elle a bougé, puis les trois premiers changements. */
function resume(avant: string, apres: string): { retire: string; ajoute: string }[] {
  const mots = (t: string) => t.split(/\s+/).filter(Boolean).length;
  const r: { retire: string; ajoute: string }[] = [];
  if (Math.abs(mots(avant) - mots(apres)) >= 3) r.push({ retire: `${mots(avant)} mots`, ajoute: `${mots(apres)} mots` });
  const changes = ecartMots(avant, apres).map((c) => ({ retire: c.retire.length > 42 ? `${c.retire.slice(0, 40)}…` : c.retire, ajoute: c.ajoute.length > 42 ? `${c.ajoute.slice(0, 40)}…` : c.ajoute }));
  return [...r, ...changes].slice(0, 4);
}

function ResultatANoter({ onNoter }: { onNoter: (r: string) => void }) {
  const [t, setT] = useState('');
  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (t.trim()) onNoter(t.trim());
      }}
    >
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Pas encore noté : ce qu’elle a donné…" aria-label="Le résultat de cette version" className="h-9 min-w-0 flex-1 border border-[#2a2826] bg-transparent px-2.5 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-[#8a8a87]" />
      <button type="submit" className="bx-btn2" disabled={!t.trim()}>
        Noter
      </button>
    </form>
  );
}
