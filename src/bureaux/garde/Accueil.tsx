import React from 'react';
import { Link } from 'react-router-dom';
import { AMBRE, ROUGE } from '../jetons';
import { useGardeBureau, type Chef, type ModeleGarde } from '../donnees/gardeBureau';
import { useSourceBureaux } from '../donnees/source';
import { Carte, Chargement, EnTete, Erreur, Paire, Stat } from '../ui/kit';
import { deuxChiffres, enLettres, hhmm, prenomDe } from '../format';
import { EcranVide } from '../../components/EtatEcran';
import { useProfilesOptionnel } from '../../state/ProfilesContext';

/**
 * LA GARDE · L'ACCUEIL — l'organigramme vivant (cahier 11 `45e`, planche `50d`).
 *
 * Le Capitaine en tête, un bus, ses chefs en rang, et sous chacun ses gardes.
 * Un point blanc qui bat est une garde en ronde à cet instant. Les colonnes
 * sont une grille à gouttière nulle (respiration en marge interne de 5 px) :
 * le trait de chaque chef tombe exactement à (i + 0,5) / n de la largeur.
 * L'ambre : la colonne du chef dont un compte rendu attend une lecture
 * humaine. Le rouge : le point du dossier critique, dans « Ce qui attend un
 * humain ».
 */

const REPLI = 12;

export function GardeAccueil() {
  const g = useGardeBureau();
  const src = useSourceBureaux();
  const profils = useProfilesOptionnel();
  const nom = (e: string | null | undefined) => (e ? profils?.profileFor(e).name?.split(' ')[0] || prenomDe(e) : '—');
  if (!g.pret) {
    return (
      <>
        <EnTete accueil surtitre="La Garde" titre="La Garde se présente." />
        <Carte dominante titre="L’organigramme">
          <Chargement texte="Les chefs s’allument" />
        </Carte>
      </>
    );
  }
  const vide = g.chefs.length === 0 && !g.muette;
  const { titre, lede } = phrases(g);
  const chefAmbre = g.compteRendu?.equipe ?? null;
  return (
    <EcranVide quand={vide} premierJour={vide}>
      <EnTete accueil surtitre={`La Garde · relève de ${deuxChiffres(g.heureReleve)}:00`} titre={titre} lede={lede} />
      {g.muette && (
        <Erreur pannes={src.pannes} at={src.at} relancer={() => void src.recharger()}>
          <p className="p-6 text-[13px] text-[#e4e4e1]">La Garde ne répond plus : c’est en soi une remontée haute, pour Harun.</p>
        </Erreur>
      )}
      <Carte
        dominante
        pad="p-7"
        titre={`L’organigramme · ${g.gardes} garde${g.gardes > 1 ? 's' : ''}, ${g.chefs.length} chef${g.chefs.length > 1 ? 's' : ''}, 1 capitaine`}
        droite="point blanc = en ronde à cet instant"
      >
        <Organigramme chefs={g.chefs} chefAmbre={chefAmbre} agentAmbre={g.compteRendu?.agent ?? null} comptes={g.comptesRendus} />
      </Carte>
      <div className="mt-[18px]">
        <Paire>
          <Carte titre={`Cette nuit · ${deuxChiffres(22)} h → ${deuxChiffres(g.heureReleve)} h`}>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <Stat l="Rondes" v={g.nuit.rondes ?? '—'} />
              <Stat l="Réglé seul" v={g.nuit.regles ?? '—'} />
              <Stat l="Remontées" v={g.nuit.remontees ?? '—'} />
              <Stat l="Réveils" v={g.nuit.reveils ?? '—'} />
            </div>
            <div className="mt-5">
              <Link to="/garde/nuit" className="bx-lien">
                Voir la nuit, chef par chef
              </Link>
            </div>
          </Carte>
          <Carte titre={`Ce qui attend un humain · ${g.attend.length}`}>
            {g.attend.length === 0 ? (
              <p className="text-[13px] text-[#a3a3a0]">Rien n’attend votre lecture.</p>
            ) : (
              <ul>
                {g.attend.slice(0, 5).map((d) => {
                  const critique = d.gravite === 'critique';
                  const rouge = critique && d.id === g.critique?.id;
                  const chef = g.chefs.find((c) => c.key === d.equipe);
                  return (
                    <li key={d.id}>
                      <Link to={critique ? '/garde/pile' : `/garde/compte-rendu/${d.id}`} className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-[#1a1a1a] py-3 hover:bg-white/[0.02]">
                        <span aria-hidden className="h-[7px] w-[7px] translate-y-[-1px] rounded-full" style={{ background: rouge ? ROUGE.trait : '#6b6b68', boxShadow: rouge ? '0 0 10px rgba(255,66,48,.6)' : undefined }} />
                        <span className="text-[13px] leading-snug text-[#e4e4e1]">
                          {critique ? `Dossier critique · ${d.orgNom ?? 'AMN DevSec'}, ${d.n} incidents regroupés${d.prisPar ? ` · pris par ${nom(d.prisPar)}${d.prisLe ? ` à ${hhmm(d.prisLe)}` : ''}` : ' · personne ne l’a pris'}` : `Compte rendu du ${chef?.titre ?? d.equipe} · ${d.titre}`}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#9a9a97]">{chef?.nom ?? d.equipe}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Carte>
        </Paire>
      </div>
    </EcranVide>
  );
}

function phrases(g: ModeleGarde) {
  const n = g.comptesRendus.length;
  const calme = !g.nuit.reveils;
  const titre = `${calme ? 'La nuit a été calme.' : 'La nuit n’a pas été calme.'} ${n ? `${n > 1 ? `${enLettres(n, true)} comptes rendus attendent` : 'Un compte rendu attend'} votre lecture.` : 'Rien n’attend votre lecture.'}`;
  const bouts: string[] = [];
  if (g.nuit.rondes !== null) bouts.push(`${enLettres(g.nuit.rondes, true)} ronde${g.nuit.rondes > 1 ? 's' : ''}`);
  if (g.nuit.regles !== null) bouts.push(`${g.nuit.regles} alerte${g.nuit.regles > 1 ? 's' : ''} réglée${g.nuit.regles > 1 ? 's' : ''} sans vous`);
  if (g.nuit.remontees !== null) bouts.push(`${enLettres(g.nuit.remontees)} remontée${g.nuit.remontees > 1 ? 's' : ''}`);
  const lede: string[] = [];
  if (bouts.length) lede.push(`${bouts.join(', ').replace(/^./, (c) => c.toUpperCase())}.`);
  if (g.compteRendu) {
    const chef = g.chefs.find((c) => c.key === g.compteRendu!.equipe);
    lede.push(`Le ${chef?.titre ?? 'chef'} a écrit${g.compteRendu.orgNom ? ` sur ${g.compteRendu.orgNom}` : ''} : ${g.compteRendu.titre.replace(/\.$/, '')}.`);
  }
  return { titre, lede: lede.join(' ') };
}

function Organigramme({ chefs, chefAmbre, agentAmbre, comptes }: { chefs: Chef[]; chefAmbre: string | null; agentAmbre: string | null; comptes: { equipe: string }[] }) {
  const n = Math.max(chefs.length, 1);
  const colonnes = `repeat(${n}, minmax(0,1fr))`;
  const iAmbre = chefs.findIndex((c) => c.key === chefAmbre);
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: Math.max(640, n * 120) }}>
        <div className="mx-auto w-[300px] max-w-full border border-[#2a2a2a] bg-[#171717] px-5 py-3.5 text-center" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05)' }}>
          <span className="block font-mono text-[9.5px] tracking-[0.2em] text-[#9a9a97]">LE CAPITAINE</span>
          <span className="mt-1.5 block text-[14px] font-semibold text-[#f7f7f5]">Arbitre des collaborations</span>
          <span className="mt-1 block text-[11.5px] text-[#a3a3a0]">ne dort jamais · déterministe</span>
        </div>
        {/* Le bus : du Capitaine au rang des chefs ; chaque trait tombe à (i + 0,5) / n. */}
        <svg viewBox="0 0 1000 36" preserveAspectRatio="none" className="block h-9 w-full" aria-hidden>
          <path d="M500 0 V18" stroke="#3a3a3a" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          {chefs.length > 1 && <path d={`M${(0.5 / n) * 1000} 18 H${((n - 0.5) / n) * 1000}`} stroke="#3a3a3a" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
          {chefs.map((c, i) => (
            <path key={c.key} d={`M${((i + 0.5) / n) * 1000} 18 V36`} stroke={i === iAmbre ? AMBRE : '#3a3a3a'} strokeWidth={i === iAmbre ? 1.6 : 1} vectorEffect="non-scaling-stroke" data-signal-groupe={i === iAmbre ? 'organigramme-ambre' : undefined} />
          ))}
        </svg>
        {/* Deux rangs de la même grille : les plaques ont toutes la même hauteur, les listes pendent dessous. */}
        <ol className="grid items-stretch" style={{ gridTemplateColumns: colonnes }}>
          {chefs.map((c, i) => {
            const ambre = i === iAmbre;
            const cr = comptes.filter((x) => x.equipe === c.key).length;
            return (
              <li key={c.key} className="flex min-w-0 px-[5px]" data-signal-groupe={ambre ? 'organigramme-ambre' : undefined}>
                <Link
                  to={`/garde/bureaux/${c.key}`}
                  className="bx-nav flex w-full flex-col px-3 py-2.5"
                  style={{ background: ambre ? AMBRE : '#171717', border: `1px solid ${ambre ? AMBRE : '#2a2a2a'}`, boxShadow: ambre ? '0 0 26px -8px rgba(208,154,74,.8)' : 'inset 0 1px 0 rgba(255,255,255,.05)' }}
                >
                  <span className="block truncate text-[14px] font-semibold" style={{ color: ambre ? '#080808' : '#f7f7f5' }}>{c.nom}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug" style={{ color: ambre ? '#2a1d08' : '#a3a3a0' }}>{c.titre}</span>
                  <span className="mt-auto block whitespace-nowrap pt-2.5 font-mono text-[9.5px] font-semibold tracking-[0.12em]" style={{ color: ambre ? '#080808' : '#9a9a97' }}>
                    {ambre && cr ? `${cr} COMPTE${cr > 1 ? 'S' : ''} RENDU${cr > 1 ? 'S' : ''}` : `${c.agents.length} GARDE${c.agents.length > 1 ? 'S' : ''}`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
        <ol className="grid" style={{ gridTemplateColumns: colonnes }} aria-label="Les gardes, sous leur chef">
          {chefs.map((c, i) => {
            const ambre = i === iAmbre;
            return (
              <li key={c.key} className="min-w-0 px-[5px]">
                <ul className="mt-3 border-l border-[#252525] pl-3">
                  {(c.agents.length > REPLI ? c.agents.slice(0, REPLI - 1) : c.agents).map((a) => {
                    const ronde = a.etat === 'ronde';
                    const produit = ambre && a.key === agentAmbre;
                    return (
                      <li key={a.key} className="flex items-baseline gap-2 py-[5px]" data-signal-groupe={produit ? 'organigramme-ambre' : undefined}>
                        <span data-mv={ronde ? '' : undefined} className={`h-[6px] w-[6px] flex-none translate-y-[-1px] rounded-full ${ronde ? 'bx-halo bg-[#f7f7f5]' : 'bg-[#4a4a48]'}`} aria-label={ronde ? 'en ronde' : undefined} />
                        <span className="text-[12.5px] leading-tight" style={{ color: produit ? AMBRE : ronde ? '#f7f7f5' : '#a3a3a0' }}>{a.nom}</span>
                      </li>
                    );
                  })}
                  {c.agents.length > REPLI && <li className="py-[5px] font-mono text-[10px] tracking-[0.1em] text-[#9a9a97]">+ {c.agents.length - REPLI + 1} GARDES</li>}
                </ul>
                <Link to={`/garde/bureaux/${encodeURIComponent(c.key)}/historique`} className="ml-3 mt-1.5 inline-block font-mono text-[9.5px] tracking-[0.1em] text-[#9a9a97] hover:text-[#f7f7f5]" aria-label={`Les trente derniers jours de ${c.titre}`}>
                  30 JOURS →
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
