import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSync } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import { useStudio, LIBELLE_ETAT, type ModeleStudio, type Piece } from '../donnees/studio';
import { Carte, Chargement, EnTete, Erreur, Invitation, Ligne, Paire } from '../ui/kit';
import { enLettres, enLettresF, ilYA, jourCourt } from '../format';
import { EcranVide } from '../../components/EtatEcran';

/**
 * STUDIO · L'ACCUEIL — la façade (cahier 11 `45c`, planche `48e`).
 *
 * Un immeuble de trois étages de quatre fenêtres, une par pièce projet.
 * Allumée = en ligne ; échafaudage = chantier ; store baissé = attente
 * client. À l'entrée, les fenêtres s'allument une à une en 600 ms, puis plus
 * rien ne bouge, sauf la fenêtre ambre qui respire : la seule pièce où c'est
 * Mohamed qu'on attend.
 *
 * Les états (`48e`) : vide — la façade dessinée, une invitation, pas d'ambre ;
 * chargement — la façade éteinte tant que les pièces n'ont pas répondu ;
 * chargé — au-delà de trois étages ouverts, le haut se replie étage par
 * étage ; erreur — la dernière façade connue, atténuée, datée, et la relance.
 */

const PAR_ETAGE = 4;
const ETAGES_OUVERTS = 3;

export function StudioAccueil() {
  const s = useStudio();
  const { ready, pullFailed } = useSync();
  const [ouverts, setOuverts] = useState(ETAGES_OUVERTS);
  const vide = s.pieces.length === 0;
  const n = s.pieces.length;
  const chargement = !ready && vide;
  const etages = Math.ceil(n / PAR_ETAGE);
  const montrees = s.pieces.slice(0, PAR_ETAGE * ouverts);
  const ambreRepliee = s.ambre && !montrees.includes(s.ambre) ? s.ambre : null;
  const derniere = s.pieces.map((p) => (p as { updatedAt?: string }).updatedAt ?? '').sort().pop() || null;
  const titre = chargement
    ? 'La façade s’allume.'
    : vide
      ? 'La façade attend sa première pièce.'
      : `${enLettresF(n, true)} pièce${n > 1 ? 's' : ''}. ${s.ambre ? `${s.retoursOuverts.length > 1 ? `${enLettresF(s.retoursOuverts.length, true)} attendent` : 'Une attend'} votre réponse.` : 'Aucune ne vous attend.'}`;
  const lede = chargement ? undefined : vide ? 'Chaque site ou application devient une pièce : une porte dans la barre, une fenêtre dans la façade.' : phrase(s);

  const facade = (
    <>
      {etages > ouverts && (
        <div className="mb-3 flex flex-col gap-1.5">
          {etages - ouverts >= 2 && (
            <Repli
              texte={`${ouverts + 2}ᵉ → ${etages}ᵉ étage · ${n - PAR_ETAGE * (ouverts + 1)} pièces`}
              ambre={Boolean(ambreRepliee && s.pieces.indexOf(ambreRepliee) >= PAR_ETAGE * (ouverts + 1))}
              onClick={() => setOuverts(etages)}
            />
          )}
          <Repli texte={`${ouverts + 1}ᵉ étage`} ambre={Boolean(ambreRepliee && s.pieces.indexOf(ambreRepliee) < PAR_ETAGE * (ouverts + 1))} onClick={() => setOuverts(ouverts + 1)} />
        </div>
      )}
      <Facade pieces={montrees} ambre={s.ambre} />
    </>
  );

  return (
    <EcranVide quand={vide && !chargement} premierJour={vide && !chargement}>
      <EnTete accueil surtitre={`Studio · ${chargement ? 'lecture des pièces' : `${n} pièce${n > 1 ? 's' : ''}`}`} titre={titre} lede={lede} />
      <Carte dominante pad="p-7" titre="La façade · une fenêtre par pièce" droite="allumée = en ligne · échafaudage = chantier · store baissé = attente client">
        {chargement ? (
          <>
            <Facade pieces={[]} ambre={null} />
            <Chargement texte="Lecture des pièces" />
          </>
        ) : vide ? (
          <>
            <Facade pieces={[]} ambre={null} />
            <div className="mt-6">
              <Invitation titre="Aucune pièce n’est encore ouverte." texte="Une pièce se crée pour chaque site ou application confié : son organisation, ce qu’on y construit, puis ses croquis, ses prompts et sa livraison." />
            </div>
          </>
        ) : ready && pullFailed ? (
          <Erreur pannes={['l’état des pièces']} at={derniere} relancer={() => window.dispatchEvent(new Event('online'))}>
            {facade}
          </Erreur>
        ) : (
          facade
        )}
      </Carte>
      <div className="mt-[18px]">
        <Paire>
          <Carte titre="Mises en ligne · 7 jours" droite={s.misesEnLigne.length || ''}>
            {s.misesEnLigne.length === 0 ? (
              <p className="text-[13px] text-[#a3a3a0]">Rien n’est parti en ligne cette semaine.</p>
            ) : (
              s.misesEnLigne.slice(-5).map((m) => <Ligne key={`${m.piece.id}-${m.version}-${m.at}`} a={jourCourt(m.at).split(' ')[0]} b={`${m.piece.plaque} · ${m.piece.orgNom} · ${/^\d/.test(m.version) ? `v${m.version}` : m.version}`} c="EN LIGNE" lien={`/studio/pieces/${m.piece.id}/livraison`} />)
            )}
          </Carte>
          <Carte titre="Qui attend qui">
            {s.quiAttend.length === 0 ? (
              <p className="text-[13px] text-[#a3a3a0]">Personne n’attend personne.</p>
            ) : (
              s.quiAttend.slice(0, 5).map((q, i) => <Ligne key={`${q.piece.id}-${q.qui}-${i}`} a={q.piece.plaque} b={q.texte} c={q.qui === 'vous' ? 'VOUS' : 'ELLE'} lien={`/studio/pieces/${q.piece.id}/${q.qui === 'vous' ? 'retours' : q.texte.includes('trancher') ? 'croquis' : 'livraison'}`} />)
            )}
          </Carte>
        </Paire>
      </div>
    </EcranVide>
  );
}

/** Un étage replié, en haut de la façade (`48e`, chargé). */
function Repli({ texte, ambre, onClick }: { texte: string; ambre: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center justify-between border border-[#2a2826] bg-[#100f0e] px-3.5 py-2 text-left hover:border-[#3a3834]" data-signal-groupe={ambre ? 'facade-ambre' : undefined}>
      <span className="text-[12.5px] font-semibold text-[#e4e4e1]">› {texte}</span>
      <span className="font-mono text-[10px] tracking-[0.12em]" style={{ color: ambre ? AMBRE : '#9a9a97' }}>
        {ambre ? 'UNE PIÈCE VOUS ATTEND · REPLIÉ' : 'REPLIÉ'}
      </span>
    </button>
  );
}

function phrase(s: ModeleStudio): string {
  const m: string[] = [];
  const bouts: string[] = [];
  if (s.compte.en_ligne) bouts.push(`${enLettres(s.compte.en_ligne, true)} ${s.compte.en_ligne > 1 ? 'sites et applications sont' : 'est'} en ligne`);
  if (s.compte.chantier) bouts.push(`${enLettres(s.compte.chantier)} en chantier`);
  if (s.compte.attente) bouts.push(`${enLettres(s.compte.attente)} attend${s.compte.attente > 1 ? 'ent' : ''} un retour du client`);
  if (bouts.length) m.push(`${bouts.join(', ').replace(/^./, (c) => c.toUpperCase())}.`);
  if (s.ambre?.retourOuvert) m.push(`Chez ${s.ambre.orgNom}, le client a laissé un retour${s.ambre.retourOuvert.page ? ` sur la page ${s.ambre.retourOuvert.page}` : ''} ${ilYA(s.ambre.retourOuvert.at)}.`);
  return m.join(' ');
}

function Facade({ pieces, ambre }: { pieces: Piece[]; ambre: Piece | null }) {
  const cases: (Piece | null)[] = pieces.length ? [...pieces] : Array.from({ length: PAR_ETAGE * ETAGES_OUVERTS }, () => null);
  while (cases.length % PAR_ETAGE) cases.push(null);
  const etages: (Piece | null)[][] = [];
  for (let i = 0; i < cases.length; i += PAR_ETAGE) etages.push(cases.slice(i, i + PAR_ETAGE));
  let rang = 0;
  return (
    <div className="relative mx-auto" style={{ background: '#0f0e0d', padding: '0 10px', boxShadow: 'inset 10px 0 0 #1a1917, inset -10px 0 0 #1a1917' }}>
      <div className="h-2" style={{ background: '#22211e', margin: '0 -10px' }} aria-hidden />
      {etages.map((etage, e) => (
        <div key={e}>
          <ol className="grid grid-cols-2 gap-x-5 gap-y-4 px-4 pb-4 pt-5 md:grid-cols-4" aria-label={`Étage ${e + 1}`}>
            {etage.map((p, i) => {
              const r = rang;
              if (p) rang += 1;
              return p ? <Fenetre key={p.id} p={p} ambre={ambre?.id === p.id} rang={r} /> : <FenetreVide key={`v${e}-${i}`} />;
            })}
          </ol>
          <div className="h-[3px]" style={{ background: '#22211e' }} aria-hidden />
        </div>
      ))}
    </div>
  );
}

function Vitre({ etat, ambre }: { etat: Piece['etat'] | 'vide'; ambre: boolean }) {
  const meneaux = (
    <>
      <span aria-hidden className="absolute bottom-0 left-1/2 top-0 w-[3px] -translate-x-1/2 bg-[#0d0c0b]" />
      <span aria-hidden className="absolute left-0 right-0 top-[42%] h-[3px] bg-[#0d0c0b]" />
    </>
  );
  if (ambre) return <span className="relative block h-full w-full" style={{ background: AMBRE }}>{meneaux}</span>;
  if (etat === 'en_ligne')
    return (
      <span className="relative block h-full w-full" style={{ background: 'linear-gradient(180deg,#dcdad4,#b3b1ab)', boxShadow: '0 0 30px -10px rgba(220,218,212,.55)' }}>
        {meneaux}
      </span>
    );
  if (etat === 'chantier')
    return (
      <span className="relative block h-full w-full" style={{ background: '#1b1a18', backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.12) 0 1px, transparent 1px 8px)' }}>
        <span aria-hidden className="absolute left-0 right-0 top-[68%] h-[4px] bg-[#3a3834]" />
        {meneaux}
      </span>
    );
  if (etat === 'attente')
    return (
      <span className="relative block h-full w-full bg-[#141312]">
        <span aria-hidden className="absolute left-0 right-0 top-0 h-[46%] bg-[#2a2826]" />
        <span aria-hidden className="absolute left-0 right-0 top-[46%] h-px bg-[#3a3834]" />
        {meneaux}
      </span>
    );
  return <span className="relative block h-full w-full border border-dashed border-[#2a2826]" />;
}

function Fenetre({ p, ambre, rang }: { p: Piece; ambre: boolean; rang: number }) {
  return (
    <li className="min-w-0" data-signal-groupe={ambre ? 'facade-ambre' : undefined}>
      <Link to={`/studio/pieces/${p.id}${ambre ? '/retours' : ''}`} className="bx-nav group block" aria-label={`${p.plaque}, ${p.orgNom} : ${p.quoi}. ${ambre ? 'Retour à traiter' : LIBELLE_ETAT[p.etat].toLowerCase()}.`}>
        <span
          data-mv
          className={`block h-[96px] ${ambre ? 'bx-ambre-respire' : 'bx-allume'}`}
          style={{ animationDelay: ambre ? undefined : `${rang * 50}ms` }}
        >
          <Vitre etat={p.etat} ambre={ambre} />
        </span>
        <span className="mt-3 flex items-center gap-2">
          <span className="border border-[#2a2826] px-[5px] py-[2px] font-mono text-[9.5px] font-semibold tracking-[0.1em] text-[#9a9a97]">{p.plaque}</span>
          <span className="truncate text-[13px] font-semibold text-[#f7f7f5] group-hover:underline">{p.orgNom}</span>
        </span>
        <span className="mt-1.5 flex items-baseline justify-between gap-2">
          <span className="truncate text-[12px] text-[#9a9a97]">{p.quoi}</span>
          <span className="flex-none font-mono text-[9.5px] font-semibold tracking-[0.12em]" style={{ color: ambre ? AMBRE : '#9a9a97' }}>
            {ambre ? 'RETOUR À TRAITER' : LIBELLE_ETAT[p.etat]}
          </span>
        </span>
      </Link>
    </li>
  );
}

function FenetreVide() {
  return (
    <li className="min-w-0" aria-hidden>
      <span className="block h-[96px]">
        <Vitre etat="vide" ambre={false} />
      </span>
      <span className="mt-3 block h-[34px]" />
    </li>
  );
}
