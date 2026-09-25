import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCollection } from '../../state/SyncContext';
import { garde, SILENCE_DEFAUT } from '../../lib/garde';
import type { GardeRemontee, GardeRonde } from '../../shared/garde';
import { AMBRE, ROUGE } from '../jetons';
import { useGardeBureau } from '../donnees/gardeBureau';
import { useSourceBureaux } from '../donnees/source';
import { Carte, Chargement, EnTete, Invitation } from '../ui/kit';
import { deuxChiffres, enLettres, enLettresF, hhmm } from '../format';

/**
 * LA GARDE · CETTE NUIT (cahier 14, `50c`).
 *
 * Une voie par chef, du début à la fin du silence de nuit (22 h → 7 h par
 * défaut, le réglage de la Garde fait foi) ; chaque passage d'une de ses
 * gardes est un cran — si serrés chez les Sites qu'ils forment une trame, si
 * rares ailleurs qu'on les compte. Une remontée est une marque posée sur la
 * voie, à son heure. On lit la nuit comme un électrocardiogramme : plat, sauf
 * là où quelque chose s'est produit.
 *
 * L'ambre : la seule remontée de la nuit qui attend encore une lecture (la
 * plus ancienne s'il y en a plusieurs). Le rouge : une remontée critique, la
 * seule chose qui lève le silence — une seule par écran.
 *
 * Les passages viennent de `/v1/garde/rondes`, bornés des deux côtés : la
 * nuit se lit en entière. Un serveur plus ancien plafonne à 500 ; l'écran le
 * dit plutôt que de dessiner une nuit tronquée comme si elle était complète.
 */

export function GardeNuit() {
  const g = useGardeBureau();
  const src = useSourceBureaux();
  const suivis = useCollection<{ par?: string }>('suivis');
  const [donnees, setDonnees] = useState<{ rondes: GardeRonde[]; remontees: GardeRemontee[] } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const silence = src.salle?.reglages?.silence ?? SILENCE_DEFAUT;

  // La nuit écoulée : du début du silence la veille à sa fin ce matin ; avant la fin, la nuit en cours.
  const { debut, fin, enCours } = useMemo(() => {
    const maintenant = new Date();
    const finDuJour = new Date(maintenant);
    finDuJour.setHours(silence.a, 0, 0, 0);
    const enCoursNuit = maintenant.getTime() < finDuJour.getTime();
    const f = enCoursNuit ? maintenant : finDuJour;
    const d = new Date(finDuJour);
    d.setDate(d.getDate() - 1);
    d.setHours(silence.de, 0, 0, 0);
    return { debut: d, fin: f, enCours: enCoursNuit };
  }, [silence.de, silence.a]);

  useEffect(() => {
    let vivant = true;
    Promise.all([garde.rondes({ since: debut.toISOString(), avant: fin.toISOString(), limit: 5000 }), garde.remontees('toutes', { limit: 200 }).then((r) => r.remontees)])
      .then(([rondes, remontees]) => {
        if (!vivant) return;
        const dans = (iso: string) => iso >= debut.toISOString() && iso < fin.toISOString();
        setDonnees({ rondes: rondes.filter((r) => dans(r.debut)), remontees: remontees.filter((r) => dans(r.createdAt)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) });
      })
      .catch((e) => vivant && setErreur(e instanceof Error ? e.message : 'La Garde n’a pas répondu.'));
    return () => {
      vivant = false;
    };
  }, [debut, fin]);

  const agents = new Map((src.salle?.agents ?? []).map((a) => [a.key, a.equipe]));
  const pile = src.accueil?.pile.dossiers ?? [];
  const dossierDe = (r: GardeRemontee) => pile.find((d) => d.remontees.includes(r.id)) ?? null;
  const lue = (r: GardeRemontee) => {
    const d = dossierDe(r);
    return r.etat !== 'ouverte' || Boolean(d?.prisPar) || suivis.some((s) => s.id === `lu:${r.id}` || (d && s.id === `lu:${d.id}`));
  };

  if (erreur) return <EnTete surtitre="La Garde · cette nuit" titre="La Garde n’a pas répondu." lede={erreur} />;
  if (!donnees || !g.pret) {
    return (
      <>
        <EnTete surtitre="La Garde · cette nuit" titre="La nuit se relit." />
        <Chargement texte="Lecture des rondes de la nuit" />
      </>
    );
  }

  const { rondes, remontees } = donnees;
  const duree = fin.getTime() - debut.getTime();
  const x = (iso: string) => ((Date.parse(iso) - debut.getTime()) / duree) * 100;
  const critique = remontees.find((r) => r.gravite === 'critique') ?? null;
  const aLire = remontees.filter((r) => !lue(r) && r.id !== critique?.id);
  const ambre = aLire[0] ?? null;
  const lues = remontees.filter((r) => lue(r)).length;
  const tronquee = rondes.length >= 500 && rondes.length < 5000 && rondes[rondes.length - 1] && Date.parse(rondes[rondes.length - 1].debut) - debut.getTime() > 30 * 60_000;
  const nomChef = (equipe: string) => g.chefs.find((c) => c.key === equipe)?.nom ?? equipe;
  const heures: number[] = [];
  for (let h = silence.de; ; h = (h + 2) % 24) {
    heures.push(h);
    if (heures.length > 8 || (h + 2) % 24 === silence.a || h === silence.a) break;
  }
  const ticks = heures.map((h) => {
    const d = new Date(debut);
    if (h < silence.de) d.setDate(d.getDate() + 1);
    d.setHours(h, 0, 0, 0);
    return { h, p: ((d.getTime() - debut.getTime()) / duree) * 100 };
  }).filter((t) => t.p <= 85);
  const titre = critique
    ? `Le silence a été levé cette nuit, à ${hhmm(critique.createdAt)}.`
    : remontees.length === 0 && rondes.length === 0
      ? 'La nuit n’a laissé aucune trace.'
      : `La nuit a été calme. ${ambre ? (aLire.length > 1 ? `${enLettresF(aLire.length, true)} remontées attendent encore.` : 'Une remontée attend encore.') : 'Rien n’attend.'}`;
  const jourDebut = debut.getDate();
  const jourFin = fin.getDate();

  return (
    <>
      <EnTete surtitre={`La Garde · ${enCours ? 'la nuit en cours' : 'cette nuit'}`} titre={titre} />
      <Carte dominante pad="p-6" titre={`La nuit du ${jourDebut} au ${jourFin} · ${rondes.length} passage${rondes.length > 1 ? 's' : ''} de gardes`} droite="cran = un passage de garde · marque = une remontée">
        {g.chefs.length === 0 ? (
          <Invitation titre="Aucun chef en poste." texte="Les voies de la nuit se dessinent quand la Garde a pris son poste." />
        ) : (
          <div className="flex flex-col">
            {g.chefs.map((c) => {
              const passages = rondes.filter((r) => agents.get(r.agent) === c.key);
              const marques = remontees.filter((r) => r.equipe === c.key);
              return (
                <div key={c.key} className="grid grid-cols-[110px_minmax(0,1fr)_78px] items-center gap-4 border-b border-[#1a1a1a] py-2">
                  <span className="text-[13px] font-semibold text-[#e4e4e1]">{c.nom}</span>
                  <span className="relative block h-[26px]">
                    <svg viewBox="0 0 1000 26" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
                      {passages.map((r) => (
                        <line key={r.id} x1={x(r.debut) * 10} x2={x(r.debut) * 10} y1={7} y2={19} stroke="#4a4a48" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                      ))}
                    </svg>
                    {/* Les marques ordinaires d'abord : l'ambre et le rouge restent visibles par-dessus. */}
                    {[...marques].sort((a, b) => Number(a.id === critique?.id || a.id === ambre?.id) - Number(b.id === critique?.id || b.id === ambre?.id)).map((r) => {
                      const rouge = critique?.id === r.id;
                      const estAmbre = ambre?.id === r.id;
                      return (
                        <span
                          key={r.id}
                          className="absolute top-0 h-[26px] w-[7px] -translate-x-1/2"
                          style={{ left: `${x(r.createdAt)}%`, background: rouge ? ROUGE.trait : estAmbre ? AMBRE : '#8a8a87', boxShadow: estAmbre ? '0 0 14px rgba(208,154,74,.8)' : undefined }}
                          title={`${hhmm(r.createdAt)} · ${r.titre}`}
                          data-signal-groupe={estAmbre ? 'nuit-ambre' : undefined}
                        />
                      );
                    })}
                  </span>
                  <span className="text-right font-mono text-[10.5px] leading-tight tabular-nums text-[#a3a3a0]">
                    {passages.length} passage{passages.length > 1 ? 's' : ''}
                  </span>
                </div>
              );
            })}
            <div className="grid grid-cols-[110px_minmax(0,1fr)_78px] gap-4 pt-2">
              <span />
              <span className="relative block h-4 font-mono text-[9.5px] tabular-nums text-[#9a9a97]">
                {ticks.map((t, i) => (
                  <span key={t.h} className="absolute" style={{ left: `${t.p}%`, transform: i === 0 ? 'none' : 'translateX(-50%)' }}>
                    {deuxChiffres(t.h)}:00
                  </span>
                ))}
                <span className="absolute right-0">{enCours ? hhmm(fin) : `${deuxChiffres(silence.a)}:00`}</span>
              </span>
              <span />
            </div>
          </div>
        )}
        {tronquee && <p className="mt-3 text-[12px] text-[#a3a3a0]">Le serveur n’a rendu que les 500 derniers passages : le début de la nuit manque sur les voies.</p>}
        {ambre && (
          <div className="mt-5 flex flex-wrap items-center gap-5 px-4 py-4" style={{ border: `1px solid ${AMBRE}`, background: 'rgba(208,154,74,.07)', boxShadow: '0 0 30px -14px rgba(208,154,74,.6)' }} data-signal-groupe="nuit-ambre">
            <div className="min-w-0 flex-1">
              <span className="block font-mono text-[9.5px] font-bold uppercase tracking-[0.14em]" style={{ color: AMBRE }}>
                {hhmm(ambre.createdAt)} · {nomChef(ambre.equipe)} · la remontée qui attend encore
              </span>
              <span className="mt-1.5 block text-[14.5px] font-semibold text-[#f7f7f5]">{ambre.titre}</span>
              <span className="mt-1 block text-[12.5px] text-[#a3a3a0]">
                {critique ? 'Le silence a été levé une fois cette nuit, pour le critique. ' : 'Rien de critique cette nuit : le silence n’a pas été levé. '}
                {remontees.length > 1 ? `Les ${enLettres(remontees.length)} remontées ont attendu la Relève${lues ? `, et ${enLettres(lues)} ${lues > 1 ? 'sont' : 'est'} déjà lue${lues > 1 ? 's' : ''}` : ''}.` : ''}
              </span>
            </div>
            <Link to={dossierDe(ambre) ? `/garde/compte-rendu/${encodeURIComponent(dossierDe(ambre)!.id)}` : '/garde/pile'} className="bx-btn2">
              Ouvrir le dossier
            </Link>
          </div>
        )}
      </Carte>
      <div className="mt-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-2">
        <Carte titre={remontees.length ? `Les ${remontees.length > 20 ? remontees.length : enLettres(remontees.length)} remontée${remontees.length > 1 ? 's' : ''}` : 'Les remontées'} droite={remontees.length && !critique ? `toutes ont attendu ${deuxChiffres(silence.a)}:00` : ''}>
          {remontees.length === 0 ? (
            <p className="text-[13px] text-[#a3a3a0]">Aucune remontée cette nuit.</p>
          ) : (
            remontees.slice(0, 12).map((r) => (
              <div key={r.id} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-baseline gap-3.5 border-b border-[#1a1a1a] py-2.5">
                <span className="font-mono text-[11px] tabular-nums text-[#9a9a97]">{hhmm(r.createdAt)}</span>
                <span className="text-[13px] leading-snug text-[#e4e4e1]">
                  {nomChef(r.equipe)} · {r.titre}
                </span>
                <span className="font-mono text-[10px] uppercase" style={{ color: critique?.id === r.id ? ROUGE.texte : '#9a9a97' }}>
                  {critique?.id === r.id ? 'critique' : lue(r) ? 'lu' : 'à lire'}
                </span>
              </div>
            ))
          )}
        </Carte>
        <Carte titre="Le silence de nuit" droite={`${deuxChiffres(silence.de)}:00 → ${deuxChiffres(silence.a)}:00`}>
          <p className="text-[13.5px] leading-relaxed text-[#e4e4e1]">
            Rien ne réveille personne, sauf le critique. {critique ? `Levé une fois, à ${hhmm(critique.createdAt)} : ${critique.titre}` : 'Aucune exception cette nuit.'}
          </p>
        </Carte>
      </div>
    </>
  );
}
