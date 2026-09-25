import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useCollection, useSync } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import { useCyber } from '../donnees/cyber';
import type { RapportPosture } from '../donnees/types';
import { Carte, EnTete, Ligne, Stat } from '../ui/kit';
import { deNom, jourLong, moisLong } from '../format';

/**
 * CYBER · LE RAPPORT DE POSTURE MENSUEL — la page que la cliente reçoit
 * (cahier 13, `47h`).
 *
 * L'aperçu, sur papier, à l'échelle A4 : le score en grand, sa courbe sur
 * huit semaines, trois choses à faire, dans l'ordre. La première page tient
 * seule, pour une cliente qui ne lit que celle-là. Le talon ambre dit la
 * seule échéance du mois : c'est l'ambre de l'écran.
 *
 * L'envoi est noté (`rapportsPosture`) : ce que la cliente a reçu reste tel
 * qu'il est parti, même quand sa posture change ensuite.
 */
export function CyberRapports() {
  const c = useCyber();
  const { user } = useAuth();
  const { upsert } = useSync();
  const [params] = useSearchParams();
  const rapports = useCollection<RapportPosture>('rapportsPosture');
  const notes = c.orgs.filter((o) => o.score !== null);
  const [orgId, setOrgId] = useState<string>(() => params.get('org') ?? c.ambre?.id ?? notes[0]?.id ?? '');
  const [mot, setMot] = useState<string | null>(null);
  const o = c.orgs.find((x) => x.id === orgId) ?? notes[0] ?? null;
  const mois = new Date().toISOString().slice(0, 7);
  const nomMois = moisLong(new Date()).split(' ')[0];
  const envoye = o ? rapports.find((r) => r.orgId === o.id && r.mois === mois) ?? null : null;
  const echeance = useMemo(() => (o ? c.echeances.filter((e) => e.orgId === o.id && e.jours >= 0 && e.jours <= 31 && !e.renouvelleSeul)[0] ?? null : null), [c.echeances, o]);
  const aFaire = o ? o.points.slice(0, 3) : [];
  const prets = c.orgs.filter((x) => x.score !== null).length;
  const arrivee = c.orgs.filter((x) => x.score === null).length;
  const prochainPremier = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

  if (!o) return <EnTete surtitre="Cyber · Rapports" titre="Aucune posture relevée : pas encore de rapport à envoyer." />;
  const precedent = o.courbe.filter((v): v is number => v !== null)[0] ?? null;
  const ecart = o.score !== null && precedent !== null ? o.score - precedent : null;
  const envoyer = () => {
    void upsert('rapportsPosture', `${o.id}-${mois}`, { orgId: o.id, mois, score: o.score, courbe: o.courbe, aFaire, echeance: echeance ? { quoi: echeance.quoi, date: echeance.date } : null, envoyeLe: new Date().toISOString(), par: user?.email ?? '', ...(mot ? { mot } : {}) });
  };
  const pts = o.courbe.map((v, i) => (v === null ? null : [i, v] as [number, number])).filter(Boolean) as [number, number][];

  return (
    <>
      <EnTete
        surtitre={`Cyber · Rapports · ${nomMois}`}
        titre={`Le rapport de ${nomMois} ${deNom(o.nom)}`}
        actions={
          <select value={o.id} onChange={(e) => setOrgId(e.target.value)} aria-label="La cliente" className="h-9 border border-[#2b3030] bg-[#111414] px-2.5 text-[13px] text-[#f7f7f5]">
            {notes.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nom}
              </option>
            ))}
          </select>
        }
      />
      <section className="bx-dom grid grid-cols-1 gap-8 p-8 lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className="bx-papier relative flex aspect-[1/1.414] flex-col p-8" aria-label="Aperçu de la première page">
          <div className="flex justify-between font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#55554f]">
            <span>Rapport de posture · {moisLong(new Date())}</span>
            <span>1 / 4</span>
          </div>
          <h2 className="mt-6 text-[26px] font-bold tracking-[-0.02em] text-[#111]">{o.nom}</h2>
          <div className="mt-4 flex items-end gap-3">
            <span className="font-sans text-[64px] font-bold leading-none tracking-[-0.04em] text-[#111]">{o.score}</span>
            <span className="pb-2 text-[12px] leading-snug text-[#3a3a38]">
              <b className="block text-[#111]">sur 100</b>
              {ecart === null ? 'premier relevé' : ecart === 0 ? 'stable sur huit semaines' : `${Math.abs(ecart)} point${Math.abs(ecart) > 1 ? 's' : ''} de ${ecart < 0 ? 'moins' : 'plus'} qu’il y a huit semaines`}
            </span>
          </div>
          {pts.length > 1 && (
            <svg viewBox="0 0 280 60" className="mt-4 h-[60px] w-full" aria-hidden>
              <path d={pts.map(([i, v], k) => `${k ? 'L' : 'M'}${20 + (i / 7) * 240} ${55 - (v / 100) * 50}`).join(' ')} fill="none" stroke="#111" strokeWidth={1.4} />
            </svg>
          )}
          <div className="mt-4 border-t border-[#111] pt-3">
            <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#55554f]">Ce qui compte ce mois-ci</span>
            {aFaire.length === 0 ? (
              <p className="mt-2 text-[12.5px] text-[#3a3a38]">Rien à corriger : chaque contrôle relevé est conforme.</p>
            ) : (
              <ol className="mt-1.5">
                {aFaire.map((a, i) => (
                  <li key={i} className="flex gap-3 border-b border-[#cfcdc7] py-2 text-[12.5px] leading-snug text-[#111]">
                    <span className="font-semibold">{i + 1}</span>
                    <span className={i === 0 ? 'font-semibold' : ''}>{a}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          {mot && <p className="mt-3 text-[12px] italic leading-snug text-[#3a3a38]">{mot}</p>}
          {echeance && (
            <div className="absolute inset-x-0 bottom-0 flex justify-between px-8 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ background: AMBRE, color: '#080808' }} data-signal-groupe="rapport-talon">
              <span>
                À faire avant le {echeance.jours <= 6 ? `${jourLong(echeance.date)} ${new Date(`${echeance.date}T12:00:00`).getDate()}` : echeance.date.split('-').reverse().slice(0, 2).join('/')}
              </span>
              <span>1 action</span>
            </div>
          )}
        </div>
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#a3a3a0]">Ce que la cliente reçoit</span>
          <p className="mt-3 text-[14px] leading-relaxed text-[#e4e4e1]">Quatre pages, le 1ᵉʳ du mois, en PDF. La première tient seule : le score, sa courbe sur huit semaines, et trois choses à faire, dans l’ordre. Les trois autres détaillent les contrôles, les incidents du mois et l’inventaire.</p>
          <div className="mt-4">
            <Ligne colonnes="70px minmax(0,1fr)" a="Page 2" b="les 8 contrôles, ligne par ligne" />
            <Ligne colonnes="70px minmax(0,1fr)" a="Page 3" b="les incidents du mois et ce qui a été fait" />
            <Ligne colonnes="70px minmax(0,1fr)" a="Page 4" b="l’inventaire et les échéances à 90 jours" />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-4">
            <Stat l="Envoi" v={envoye?.envoyeLe ? 'envoyé' : `1er ${moisLong(prochainPremier).split(' ')[0]}`} />
            <Stat l="Rapports prêts" v={`${prets} / ${c.orgs.length}`} />
            <Stat l="Non relevées" v={arrivee || '—'} />
          </div>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <button type="button" className="bx-btn" disabled={Boolean(envoye)} onClick={envoyer}>
              {envoye ? 'Envoyé ce mois-ci' : 'Relire et envoyer'}
            </button>
            <button type="button" className="bx-btn2" onClick={() => setMot(mot === null ? `Un mot de l’équipe : ${aFaire[0] ? 'la première action compte plus que les deux autres.' : 'merci pour votre vigilance ce mois-ci.'}` : null)}>
              {mot === null ? 'Ajouter un mot' : 'Retirer le mot'}
            </button>
            <button type="button" className="bx-btn2" onClick={() => window.print()}>
              Imprimer
            </button>
          </div>
          {envoye && <p className="mt-3 text-[12.5px] text-[#a3a3a0]">Noté comme envoyé le {envoye.envoyeLe?.slice(8, 10)}/{envoye.envoyeLe?.slice(5, 7)} : ce qu’elle a reçu reste tel qu’il est parti.</p>}
        </div>
      </section>
      <div className="mt-[18px]">
        <Carte titre="Le parc ce mois-ci" droite={`${rapports.filter((r) => r.mois === mois).length} envoyé${rapports.filter((r) => r.mois === mois).length > 1 ? 's' : ''}`}>
          {notes.slice(0, 8).map((x) => {
            const r = rapports.find((y) => y.orgId === x.id && y.mois === mois);
            return <Ligne key={x.id} colonnes="44px minmax(0,1fr) auto" a={String(x.score)} b={x.nom} c={r ? 'envoyé' : 'prêt'} />;
          })}
        </Carte>
      </div>
    </>
  );
}
