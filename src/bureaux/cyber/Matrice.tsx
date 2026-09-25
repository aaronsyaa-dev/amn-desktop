import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useSync } from '../../state/SyncContext';
import { AMBRE, ROUGE } from '../jetons';
import { CONTROLES, useCyber, type EtatReleve, type ModeleCyber, type PostureOrg } from '../donnees/cyber';
import { useSourceBureaux } from '../donnees/source';
import type { ControleCle, ControlesOrg, EtatControle } from '../donnees/types';
import { useCollection } from '../../state/SyncContext';
import { Carte, Chargement, EnTete, Erreur, Invitation, Ligne } from '../ui/kit';
import { enLettres, hhmm } from '../format';
import { EcranVide } from '../../components/EtatEcran';

/**
 * CYBER · POSTURE — la matrice des contrôles (cahier 13, `47a`, planche `47j`).
 *
 * Une ligne par organisation, de la plus fragile à la plus solide ; huit
 * colonnes de contrôles. Case pleine = conforme, demi = partiel, vide = non
 * conforme, rouge = critique (une seule, la brèche). On lit en ligne ce qui
 * manque à une cliente, en colonne ce qui manque au parc. L'ambre : la
 * colonne dont la correction ferait gagner le plus de points au parc.
 *
 * Une case se déclare d'un clic (source « déclaré ») ; les deux contrôles
 * déduits des faits — les certificats (SSL) et la brèche (incident critique)
 * — ne se déclarent pas : on ne réécrit pas un relevé à la main.
 */

const MONTREES = 12;
const REPLI = 400;
const VALEUR: Record<EtatControle, number> = { conforme: 1, partiel: 0.5, non_conforme: 0, critique: 0 };
const VERIFIE: Record<ControleCle, [string, string]> = {
  certificats: ['Certificat valide, à plus de 14 jours de son échéance', 'AUTO'],
  courriel: ['SPF, DKIM et DMARC publiés et alignés', 'DÉCLARÉ'],
  mfa: ['Tous les comptes du desktop l’ont activée', 'DÉCLARÉ'],
  sauvegardes: ['Une sauvegarde réussie la nuit dernière, restaurable', 'DÉCLARÉ'],
  mises_a_jour: ['Les postes à jour à 30 jours près', 'DÉCLARÉ'],
  exposition: ['Aucun port d’administration ouvert sur Internet ; aucun incident critique', 'AUTO'],
  fuites: ['Aucune adresse de l’équipe dans une fuite publique récente', 'DÉCLARÉ'],
  journalisation: ['Les journaux gardés 90 jours', 'DÉCLARÉ'],
};

/** Ce que la correction d'un contrôle partout rapporterait à la posture moyenne du parc. */
export function gains(c: ModeleCyber): Record<ControleCle, number> {
  const g = {} as Record<ControleCle, number>;
  const notes = c.orgs.filter((o) => o.score !== null);
  for (const k of CONTROLES) {
    let somme = 0;
    for (const o of notes) {
      const connus = CONTROLES.map((x) => o.controles[x.cle]).filter(Boolean) as EtatReleve[];
      const actuel = o.controles[k.cle];
      if (!actuel) continue;
      const total = connus.reduce((s, x) => s + VALEUR[x.etat], 0);
      somme += (100 * (total - VALEUR[actuel.etat] + 1)) / connus.length - (o.score ?? 0);
    }
    g[k.cle] = notes.length ? somme / notes.length : 0;
  }
  return g;
}

export function CyberMatrice() {
  const c = useCyber();
  const src = useSourceBureaux();
  const navigate = useNavigate();
  const [tout, setTout] = useState(false);
  const [edition, setEdition] = useState<{ orgId: string; cle: ControleCle } | null>(null);
  const g = useMemo(() => gains(c), [c]);
  const notes = c.orgs.filter((o) => o.score !== null);
  const nonReleves = c.orgs.filter((o) => o.score === null);
  const colonneAmbre = useMemo(() => {
    const tri = CONTROLES.filter((k) => g[k.cle] > 0.05).sort((a, b) => g[b.cle] - g[a.cle]);
    return tri[0]?.cle ?? null;
  }, [g]);
  const manque = colonneAmbre ? notes.filter((o) => o.controles[colonneAmbre] && o.controles[colonneAmbre]!.etat !== 'conforme').length : 0;
  const nomAmbre = colonneAmbre ? CONTROLES.find((k) => k.cle === colonneAmbre)!.nom : '';
  const vide = c.pret && notes.length === 0;
  const lignes = tout ? notes.slice(0, REPLI) : notes.slice(0, MONTREES);
  const repliees = notes.length - lignes.length;
  const critique = c.rouge;

  if (!c.pret) {
    return (
      <>
        <EnTete surtitre="Cyber · Posture · matrice" titre="La matrice se relève." />
        <Carte dominante>
          <Chargement texte="Relevé des contrôles" compte={src.organisations.length ? { n: 0, sur: src.organisations.length } : null} />
        </Carte>
      </>
    );
  }

  const titre = vide
    ? 'Aucun contrôle relevé pour l’instant.'
    : colonneAmbre
      ? `${manque} organisation${manque > 1 ? 's' : ''} sans ${nomAmbre.toLowerCase()}.`
      : 'Chaque contrôle tient sur tout le parc relevé.';

  const matrice = (
    <Carte dominante pad="p-6" titre={`La matrice des contrôles · 8 contrôles × ${c.orgs.length} organisations`} droite="plein = conforme · demi = partiel · vide = non conforme">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#212525] align-bottom font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#9a9a97]">
              <th className="py-2.5 pl-2.5 font-normal">Organisation</th>
              <th className="py-2.5 font-normal">Score</th>
              <th className="py-2.5 font-normal">8 sem.</th>
              {CONTROLES.map((k) => (
                <th key={k.cle} className="h-[92px] w-[54px] font-normal" style={colonneAmbre === k.cle ? { background: 'rgba(208,154,74,.06)' } : undefined} data-signal-groupe={colonneAmbre === k.cle ? 'matrice-colonne' : undefined}>
                  <span className="mx-auto block w-max whitespace-nowrap pb-2 [writing-mode:vertical-rl] rotate-180" style={{ color: colonneAmbre === k.cle ? AMBRE : undefined, fontWeight: colonneAmbre === k.cle ? 700 : 400 }}>
                    {k.court}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vide
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="h-[39px] border-b border-[#171a1a]" aria-hidden>
                    <td className="pl-2.5">
                      <span className="block h-2 w-32 bg-[#1a1d1d]" />
                    </td>
                    <td />
                    <td />
                    {CONTROLES.map((k) => (
                      <td key={k.cle} className="text-center">
                        <span className="mx-auto block h-[18px] w-[26px] border border-dashed border-[#2b3030]" />
                      </td>
                    ))}
                  </tr>
                ))
              : lignes.map((o) => <LigneMatrice key={o.id} o={o} colonneAmbre={colonneAmbre} rouge={critique?.id === o.id} onEditer={(cle) => setEdition({ orgId: o.id, cle })} edition={edition?.orgId === o.id ? edition.cle : null} onFermer={() => setEdition(null)} />)}
            {nonReleves.slice(0, 3).map((o) => (
              <tr key={o.id} className="h-[34px] border-b border-[#171a1a] bg-[#0c0e0e]">
                <td colSpan={11} className="pl-2.5 text-[12.5px]">
                  <span className="font-semibold text-[#f7f7f5]">{o.nom}</span>
                  <span className="ml-3 text-[#9a9a97]">{o.org.lastActivityAt ? 'non relevée · déclarez un premier contrôle depuis son inventaire' : 'en arrivée · évaluée à l’activation de l’espace'}</span>
                </td>
              </tr>
            ))}
            {repliees > 0 && (
              <tr className="bg-[#0c0e0e]">
                <td colSpan={11}>
                  <button type="button" onClick={() => setTout(true)} className="flex h-10 w-full items-center gap-3 px-2.5 text-left hover:bg-white/[0.02]">
                    <ChevronRight size={14} className="text-[#a3a3a0]" aria-hidden />
                    <span className="text-[13px] font-semibold text-[#f7f7f5]">{repliees} autre{repliees > 1 ? 's' : ''} organisation{repliees > 1 ? 's' : ''}</span>
                    <span className="text-[12px] text-[#9a9a97]">
                      de {notes[lignes.length]?.score} à {notes[notes.length - 1]?.score} · triées par score{notes.length > REPLI ? ` · ${REPLI} au plus, le reste par tranche` : ''}
                    </span>
                  </button>
                </td>
              </tr>
            )}
          </tbody>
          {!vide && (
            <tfoot>
              <tr className="font-mono text-[10.5px] text-[#a3a3a0]">
                <td colSpan={3} className="py-3 pl-2.5 text-[9.5px] uppercase tracking-[0.14em] text-[#9a9a97]">
                  Conformes sur les {notes.length}
                </td>
                {CONTROLES.map((k) => {
                  const connus = notes.filter((o) => o.controles[k.cle]);
                  const pct = connus.length ? Math.round((100 * connus.filter((o) => o.controles[k.cle]!.etat === 'conforme').length) / connus.length) : null;
                  return (
                    <td key={k.cle} className="py-3 text-center tabular-nums" style={colonneAmbre === k.cle ? { color: AMBRE, fontWeight: 700, background: 'rgba(208,154,74,.06)' } : undefined} data-signal-groupe={colonneAmbre === k.cle ? 'matrice-colonne' : undefined}>
                      {pct === null ? '—' : `${pct} %`}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {vide ? (
        <div className="mt-5">
          <Invitation titre="La matrice attend son premier relevé." texte="Les certificats se relèvent seuls dès qu’un site d’une cliente est suivi par SSL Monitor ; les autres contrôles se déclarent d’un clic sur leur case, ou depuis l’inventaire d’une cliente." />
        </div>
      ) : (
        colonneAmbre && (
          <div className="mt-5 flex flex-wrap items-center gap-5 border-t border-[#1d2121] pt-5">
            <p className="min-w-0 flex-1 text-[13.5px] leading-[1.6] text-[#a3a3a0]">
              {nomAmbre} est le contrôle le moins tenu du parc : {manque} organisation{manque > 1 ? 's' : ''} n’y {manque > 1 ? 'sont' : 'est'} pas. {manque > 1 ? 'Le corriger partout' : 'Le corriger'} ferait gagner {Math.max(1, Math.round(g[colonneAmbre]))} point{Math.round(g[colonneAmbre]) > 1 ? 's' : ''} à la posture moyenne, plus que tout autre contrôle.
            </p>
            <button type="button" className="bx-btn2" onClick={() => navigate(`/cyber/playbooks?campagne=${colonneAmbre}`)}>
              Préparer une campagne
            </button>
          </div>
        )
      )}
    </Carte>
  );

  return (
    <EcranVide quand={vide} premierJour={vide}>
      <EnTete surtitre="Cyber · Posture · matrice" titre={titre} />
      {src.pannes.length > 0 ? (
        <Erreur pannes={src.pannes} at={src.at} relancer={() => void src.recharger()}>
          {matrice}
        </Erreur>
      ) : (
        matrice
      )}
      <div className="mt-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-2">
        <Carte titre="Ce que chaque contrôle vérifie">
          {CONTROLES.map((k) => (
            <Ligne key={k.cle} colonnes="104px minmax(0,1fr) auto" a={k.court} b={VERIFIE[k.cle][0]} c={VERIFIE[k.cle][1]} />
          ))}
        </Carte>
        <Carte titre="Le critique" droite={critique ? '1' : ''}>
          {critique?.breche ? (
            <>
              <Ligne a={hhmm(critique.breche.prisLe ?? critique.breche.depuis)} b={`${critique.nom} · exposition : ${critique.breche.titre}`} c="CRITIQUE" />
              <p className="mt-4 text-[13px] leading-relaxed text-[#a3a3a0]">
                {critique.breche.prisPar ? `Suivi, pris à ${hhmm(critique.breche.prisLe ?? critique.breche.depuis)}.` : 'Personne ne l’a encore pris.'} La case est rouge dans la matrice ; ici, à l’encre.
                {c.orgs.filter((o) => o.breche).length > 1 ? ` ${enLettres(c.orgs.filter((o) => o.breche).length - 1, true)} autre${c.orgs.filter((o) => o.breche).length > 2 ? 's' : ''} organisation${c.orgs.filter((o) => o.breche).length > 2 ? 's' : ''} au critique, écrite${c.orgs.filter((o) => o.breche).length > 2 ? 's' : ''} à l’encre dans leur ligne.` : ''}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-[#a3a3a0]">Aucun critique ouvert au parc.</p>
          )}
        </Carte>
      </div>
    </EcranVide>
  );
}

function Sparkline({ valeurs }: { valeurs: (number | null)[] }) {
  const pts = valeurs.map((v, i) => (v === null ? null : [i, v] as [number, number])).filter(Boolean) as [number, number][];
  if (pts.length < 2) return <span className="font-mono text-[10px] text-[#9a9a97]">—</span>;
  const min = Math.min(...pts.map((p) => p[1]));
  const max = Math.max(...pts.map((p) => p[1]));
  const y = (v: number) => (max === min ? 8 : 14 - ((v - min) / (max - min)) * 12);
  return (
    <svg viewBox="0 0 70 16" className="h-4 w-[70px]" aria-hidden>
      <path d={pts.map(([i, v], k) => `${k ? 'L' : 'M'}${(i / 7) * 70} ${y(v).toFixed(1)}`).join(' ')} fill="none" stroke="#8a8a87" strokeWidth={1} />
    </svg>
  );
}

function Case({ e, rouge }: { e: EtatReleve | null; rouge: boolean }) {
  if (!e) return <span className="mx-auto block h-[18px] w-[26px] border border-dashed border-[#2b3030]" title="non relevé" />;
  if (e.etat === 'critique') {
    return rouge ? (
      <span className="mx-auto block h-[18px] w-[26px]" style={{ background: ROUGE.trait, boxShadow: '0 0 12px rgba(255,66,48,.5)' }} title="critique" />
    ) : (
      <span className="mx-auto flex h-[18px] w-[26px] items-center justify-center border border-[#e4e4e1] font-mono text-[8px] font-bold text-[#e4e4e1]" title="critique">
        CR
      </span>
    );
  }
  if (e.etat === 'conforme') return <span className="mx-auto block h-[18px] w-[26px] bg-[#3a3f3f]" title={`conforme · ${e.source}`} />;
  if (e.etat === 'partiel') return <span className="mx-auto block h-[18px] w-[26px] border border-[#4a5050]" style={{ background: 'linear-gradient(90deg,#3a3f3f 50%,transparent 50%)' }} title={`partiel · ${e.pourquoi ?? e.source}`} />;
  return <span className="mx-auto block h-[18px] w-[26px] border border-[#6b7070]" title={`non conforme · ${e.pourquoi ?? e.source}`} />;
}

function LigneMatrice({ o, colonneAmbre, rouge, onEditer, edition, onFermer }: { o: PostureOrg; colonneAmbre: ControleCle | null; rouge: boolean; onEditer: (cle: ControleCle) => void; edition: ControleCle | null; onFermer: () => void }) {
  const { user } = useAuth();
  const { upsert } = useSync();
  const tous = useCollection<ControlesOrg>('postureControles');
  const declarer = (cle: ControleCle, etat: EtatControle | null) => {
    const actuel = (tous.find((x) => x.id === o.id)?.controles ?? {}) as ControlesOrg['controles'];
    const suivant = { ...actuel };
    if (etat) suivant[cle] = { etat, source: 'declare', at: new Date().toISOString(), par: user?.email ?? '' };
    else delete suivant[cle];
    void upsert('postureControles', o.id, { controles: suivant });
    onFermer();
  };
  return (
    <tr className="h-[39px] border-b border-[#171a1a] hover:bg-white/[0.015]">
      <td className="max-w-[220px] truncate pl-2.5 text-[13px] font-semibold text-[#f7f7f5]">{o.nom}</td>
      <td className="font-mono text-[13px] font-semibold tabular-nums text-[#f7f7f5]">{o.score}</td>
      <td>
        <Sparkline valeurs={o.courbe} />
      </td>
      {CONTROLES.map((k) => {
        const e = o.controles[k.cle];
        const deduit = e && (e.source === 'releve' && (k.cle === 'certificats' || e.etat === 'critique'));
        return (
          <td key={k.cle} className="relative text-center" style={colonneAmbre === k.cle ? { background: 'rgba(208,154,74,.06)' } : undefined} data-signal-groupe={colonneAmbre === k.cle ? 'matrice-colonne' : undefined}>
            <button type="button" disabled={Boolean(deduit)} onClick={() => onEditer(k.cle)} className="block w-full py-2 disabled:cursor-default" aria-label={`${o.nom}, ${k.nom} : ${e ? e.etat.replace('_', ' ') : 'non relevé'}${deduit ? ' (relevé automatique)' : ', déclarer'}`}>
              <Case e={e} rouge={rouge && e?.etat === 'critique'} />
            </button>
            {edition === k.cle && (
              <div className="absolute right-0 top-full z-20 w-[170px] border border-[#2b3030] bg-[#111414] p-1.5 text-left shadow-[0_18px_40px_-16px_rgba(0,0,0,1)]" role="menu">
                {(['conforme', 'partiel', 'non_conforme'] as EtatControle[]).map((x) => (
                  <button key={x} type="button" role="menuitem" onClick={() => declarer(k.cle, x)} className="block w-full px-2.5 py-1.5 text-left text-[12.5px] text-[#e4e4e1] hover:bg-[#1a1f1f]">
                    {x === 'non_conforme' ? 'Non conforme' : x.charAt(0).toUpperCase() + x.slice(1)}
                  </button>
                ))}
                <button type="button" role="menuitem" onClick={() => declarer(k.cle, null)} className="block w-full px-2.5 py-1.5 text-left text-[12.5px] text-[#a3a3a0] hover:bg-[#1a1f1f]">
                  Effacer la déclaration
                </button>
                <button type="button" role="menuitem" onClick={onFermer} className="block w-full px-2.5 py-1.5 text-left text-[12px] text-[#9a9a97] hover:bg-[#1a1f1f]">
                  Fermer
                </button>
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
}
