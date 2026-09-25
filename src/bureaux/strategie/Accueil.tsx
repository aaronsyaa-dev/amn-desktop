import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSync } from '../../state/SyncContext';
import { useStrategie, numeroDeSemaine, EN_COURS, type ModeleStrategie } from '../donnees/strategie';
import { Carte, Chargement, EnTete, Erreur, Invitation, Paire, Stat } from '../ui/kit';
import { Mur, disposer } from './Mur';
import { enLettres, enLettresF, jourCourt } from '../format';
import { EcranVide } from '../../components/EtatEcran';

/**
 * STRATÉGIE · L'ACCUEIL — le mur (cahier 11 `45d`).
 *
 * L'ambre : la punaise et le bandeau de la seule pièce qui attend Riyad
 * aujourd'hui. Une campagne programmée n'attend personne : elle reste au
 * papier. Le mur respire de 2 px en 14 s.
 *
 * Les états (`49e`) : vide — le mur et sa trame, trois emplacements en
 * pointillé ; chargement — rien de punaisé tant que les pièces n'ont pas
 * répondu (un fil n'apparaît qu'avec ses deux bouts) ; chargé — au-delà de
 * 40 pièces, le mur se range par zones et replie les zones inactives ;
 * erreur — le dernier mur connu, atténué, daté, et la relance.
 */
const PIECES_MAX = 40;
export function StrategieAccueil() {
  const m = useStrategie();
  const { ready, pullFailed } = useSync();
  const pieces = useMemo(() => disposer(m), [m]);
  const vide = pieces.epingles.length === 0;
  const chargement = !ready && vide;
  // Toutes les pièces que le mur pourrait porter, zone par zone.
  const zones = [
    { nom: 'Campagnes', n: m.campagnes.filter((c) => c.etape !== 'close').length, lien: '/strategie/campagnes', active: Boolean(m.bloquee) },
    { nom: 'Pipeline', n: m.prospects.filter((p) => EN_COURS.includes(p.stage)).length, lien: '/strategie/pipeline', active: Boolean(m.ambre) },
    { nom: 'Enquête', n: m.mur.filter((p) => p.type === 'question' || p.type === 'indice').length, lien: '/strategie/enquete', active: false },
    { nom: 'Liège', n: m.mur.filter((p) => p.type === 'note').length, lien: '/strategie/liege', active: false },
  ];
  const charge = zones.reduce((s, z) => s + z.n, 0) > PIECES_MAX;
  const derniere = [...m.campagnes, ...m.prospects, ...m.mur].map((x) => (x as { updatedAt?: string }).updatedAt ?? '').sort().pop() || null;
  const { titre, lede } = phrases(m, pieces.epingles.map((e) => e.genre));

  return (
    <EcranVide quand={vide && !chargement} premierJour={vide && !chargement}>
      <EnTete accueil surtitre={`Stratégie · semaine ${numeroDeSemaine(Date.now())}`} titre={titre} lede={lede} />
      {charge && (
        <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Le mur, rangé par zones">
          {zones.map((z) => (
            <Link key={z.nom} to={z.lien} className="border border-[#28282c] bg-[#101012] px-3 py-1.5 text-[12.5px] text-[#e4e4e1] hover:border-[#4a4a50]">
              › {z.nom} · {z.n}
              {z.active ? '' : ', repliée'}
            </Link>
          ))}
        </div>
      )}
      <section className="bx-dom p-0" aria-label="Le mur">
        {chargement ? (
          <div className="p-7">
            <div className="grid grid-cols-3 gap-8" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className="border border-dashed border-[#2f2f34]" style={{ height: 120, transform: `rotate(${i - 1}deg)` }} />
              ))}
            </div>
            <Chargement texte="Les pièces arrivent" />
          </div>
        ) : ready && pullFailed && !vide ? (
          <Erreur pannes={['le mur']} at={derniere} relancer={() => window.dispatchEvent(new Event('online'))}>
            <Mur m={m} pieces={pieces} />
          </Erreur>
        ) : vide ? (
          <div className="p-7">
            <div className="grid grid-cols-3 gap-8" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className="border border-dashed border-[#2f2f34]" style={{ height: 120, transform: `rotate(${i - 1}deg)` }} />
              ))}
            </div>
            <div className="mt-7">
              <Invitation titre="Le mur est vide." texte="Une campagne, un prospect ou un chiffre punaisés ici se relient d’eux-mêmes dès qu’un lien existe entre eux." action={<Link to="/strategie/campagnes" className="bx-btn2">Ouvrir les campagnes</Link>} />
            </div>
          </div>
        ) : (
          <Mur m={m} pieces={pieces} />
        )}
      </section>
      <div className="mt-[18px]">
        <Paire>
          <Carte titre="Le calendrier de la semaine" droite={<span title="LinkedIn, Instagram, Facebook">LI · IG · FB</span>}>
            <ol className="grid grid-cols-7 gap-1.5">
              {m.semaine.map((jour) => {
                const pubs = m.publications.filter((p) => p.jour === jour);
                const auj = jour === m.aujourdHui;
                return (
                  <li key={jour} className="min-h-[92px] border px-2 py-2" style={{ borderColor: auj ? '#3a3a40' : '#222226', background: auj ? '#1b1b1e' : 'transparent' }}>
                    <span className="block font-mono text-[9.5px] tracking-[0.08em]" style={{ color: auj ? '#f7f7f5' : '#a3a3a0', fontWeight: auj ? 600 : 400 }}>
                      {jourCourt(jour)}
                    </span>
                    <span className="mt-2 flex flex-col items-start gap-1">
                      {pubs.map((p) => (
                        <span key={p.id} title={`${p.titre} · ${p.etat === 'publiee' ? 'publiée' : p.etat === 'programmee' ? 'programmée' : 'à valider'}`} className="border px-1 font-mono text-[9.5px] font-semibold" style={{ borderColor: '#3a3a40', color: '#e4e4e1', borderStyle: p.etat === 'programmee' ? 'dashed' : 'solid' }}>
                          {p.canal}
                        </span>
                      ))}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Carte>
          <Carte titre="Le pipeline" droite="cette semaine">
            <div className="grid grid-cols-3 gap-4">
              <Stat l="Prospects" v={m.pipeline.prospects || '—'} />
              <Stat l="Devis envoyés" v={m.pipeline.devis || '—'} />
              <Stat l="À relancer" v={m.pipeline.aRelancer || '—'} />
            </div>
            {m.ambre && <p className="mt-5 border-t border-[#222226] pt-4 text-[13px] leading-relaxed text-[#e4e4e1]">{phraseProspect(m)}</p>}
            <div className="mt-4">
              <Link to="/strategie/pipeline" className="bx-lien">
                5 · Pipeline
              </Link>
            </div>
          </Carte>
        </Paire>
      </div>
    </EcranVide>
  );
}

function phrases(m: ModeleStrategie, genres: string[]) {
  const nom = m.ambre ? m.ambre.company || m.ambre.name : null;
  const part = m.partAujourdHui.length;
  let titre: string;
  if (part && nom) titre = `${part > 1 ? `${enLettresF(part, true)} campagnes partent` : 'Une campagne part'} aujourd’hui, et ${nom} attend un appel.`;
  else if (nom) titre = `${nom} attend un appel.`;
  else if (part) titre = `${part > 1 ? `${enLettresF(part, true)} campagnes partent` : 'Une campagne part'} aujourd’hui.`;
  else if (m.bloquee) titre = `La campagne « ${m.bloquee.titre} » est bloquée.`;
  else titre = genres.length ? 'Le mur est à jour.' : 'Le mur attend ses premières pièces.';
  const c = genres.filter((g) => g === 'campagne').length;
  const v = genres.filter((g) => g === 'prospect' || g === 'client').length;
  const ch = genres.filter((g) => g === 'chiffre').length;
  const bouts = [c ? `${enLettresF(c, true)} campagne${c > 1 ? 's' : ''}` : '', v ? `${enLettres(v)} visage${v > 1 ? 's' : ''}` : '', ch ? `${enLettres(ch)} chiffre${ch > 1 ? 's' : ''} qui comptent` : ''].filter(Boolean);
  const lede = bouts.length ? `${bouts.join(', ').replace(/^./, (x) => x.toUpperCase())}. Tout ce qui est relié par un fil se décide ensemble.` : '';
  return { titre, lede };
}

function phraseProspect(m: ModeleStrategie): string {
  const p = m.ambre!;
  const lundi = m.semaine[0];
  const ouvertures = (p.echanges ?? []).filter((e) => e.type === 'ouverture' && e.at.slice(0, 10) >= lundi).length;
  const nom = p.company || p.name;
  if (ouvertures >= 2) return `${nom} a ouvert son devis ${enLettres(ouvertures)} fois depuis lundi, sans répondre.`;
  return `${nom} attend un appel aujourd’hui${p.prochaine?.quoi ? ` : ${p.prochaine.quoi}` : ''}.`;
}
