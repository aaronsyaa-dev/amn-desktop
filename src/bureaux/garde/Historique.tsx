import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { garde } from '../../lib/garde';
import type { GardeJournalEntree, GardeRemontee } from '../../shared/garde';
import { useProfilesOptionnel } from '../../state/ProfilesContext';
import { AMBRE } from '../jetons';
import { useGardeBureau } from '../donnees/gardeBureau';
import { Carte, Chargement, EnTete } from '../ui/kit';
import { enLettresF, prenomDe } from '../format';

/**
 * LA GARDE · L'HISTORIQUE D'UN CHEF (cahier 14, `50b`).
 *
 * Trente jours, un bâton par jour, dont la hauteur et le ton disent ce qui
 * s'y est passé : réglé seul (bas, sombre), collaboration arbitrée par le
 * Capitaine, remonté à un humain, question encore ouverte, décision renversée
 * par un humain. Un chef se juge sur la durée, pas sur un jour.
 *
 * Chaque décision du journal compte dans UNE catégorie, la plus parlante :
 * renversée > question ouverte > remontée > collaboration > réglée seule. Les
 * relevés somment donc au total annoncé. Un échec de ronde n'est pas une
 * décision et ne compte pas.
 *
 * L'ambre : le dernier jour où un humain a renversé une décision du chef, et
 * la règle que le chef en a tirée.
 */

type Categorie = 'seul' | 'arbitre' | 'remonte' | 'question' | 'renverse';
const CATEGORIES: { cle: Categorie; nom: string; court: string; ton: string; hauteur: number }[] = [
  { cle: 'seul', nom: 'Réglé seul', court: 'Réglé seul', ton: '#2c2c2c', hauteur: 18 },
  { cle: 'arbitre', nom: 'Collaboration arbitrée', court: 'Arbitré', ton: '#4d4d4d', hauteur: 30 },
  { cle: 'remonte', nom: 'Remonté à un humain', court: 'Remonté', ton: '#8a8a87', hauteur: 44 },
  { cle: 'question', nom: 'Question ouverte', court: 'Question', ton: '#e8e8e5', hauteur: 44 },
  { cle: 'renverse', nom: 'Décision renversée par un humain', court: 'Renversé', ton: AMBRE, hauteur: 60 },
];
const RANG: Record<Categorie, number> = { seul: 0, arbitre: 1, remonte: 2, question: 3, renverse: 4 };
const JOURS = 30;
const jourDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function GardeHistorique() {
  const { equipe } = useParams();
  const g = useGardeBureau();
  const profils = useProfilesOptionnel();
  const [donnees, setDonnees] = useState<{ journal: GardeJournalEntree[]; renverses: GardeJournalEntree[]; ouvertes: GardeRemontee[] } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const debut = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (JOURS - 1));
    return d;
  }, []);

  useEffect(() => {
    if (!equipe) return;
    let vivant = true;
    setDonnees(null);
    const since = debut.toISOString();
    Promise.all([
      garde.journal({ equipe, since, limit: 1000 }),
      garde.journal({ equipe, since, mauvais: '1', limit: 200 }),
      garde.remontees('ouverte', { equipe, limit: 200 }).then((r) => r.remontees),
    ])
      .then(([journal, renverses, ouvertes]) => vivant && setDonnees({ journal, renverses, ouvertes }))
      .catch((e) => vivant && setErreur(e instanceof Error ? e.message : 'La Garde n’a pas répondu.'));
    return () => {
      vivant = false;
    };
  }, [equipe, debut]);

  const chef = g.chefs.find((c) => c.key === equipe) ?? null;
  const nom = (e: string | null) => (e ? profils?.profileFor(e).name?.split(' ')[0] || prenomDe(e) : 'un humain');

  const calcul = useMemo(() => {
    if (!donnees) return null;
    const parId = new Map<string, GardeJournalEntree>();
    for (const e of [...donnees.journal, ...donnees.renverses]) parId.set(e.id, e);
    const decisions = [...parId.values()].filter((e) => e.resultat !== 'echec' && Date.parse(e.createdAt) >= debut.getTime());
    // Les questions encore ouvertes, par jour : autant de remontées de ce jour-là restent « question ».
    const ouvertesParJour = new Map<string, number>();
    for (const r of donnees.ouvertes) ouvertesParJour.set(jourDe(new Date(r.createdAt)), (ouvertesParJour.get(jourDe(new Date(r.createdAt))) ?? 0) + 1);
    const jours = Array.from({ length: JOURS }, (_, i) => {
      const d = new Date(debut);
      d.setDate(d.getDate() + i);
      return { cle: jourDe(d), date: d, compte: { seul: 0, arbitre: 0, remonte: 0, question: 0, renverse: 0 } as Record<Categorie, number> };
    });
    const index = new Map(jours.map((j, i) => [j.cle, i]));
    const reste = new Map(ouvertesParJour);
    for (const e of [...decisions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      const i = index.get(jourDe(new Date(e.createdAt)));
      if (i === undefined) continue;
      let c: Categorie = 'seul';
      if (e.mauvais) c = 'renverse';
      else if (e.resultat === 'remonte') {
        const q = reste.get(jours[i].cle) ?? 0;
        if (q > 0) {
          c = 'question';
          reste.set(jours[i].cle, q - 1);
        } else c = 'remonte';
      } else if (e.action === 'collaboration') c = 'arbitre';
      jours[i].compte[c] += 1;
    }
    const totaux = { seul: 0, arbitre: 0, remonte: 0, question: 0, renverse: 0 } as Record<Categorie, number>;
    for (const j of jours) for (const k of Object.keys(totaux) as Categorie[]) totaux[k] += j.compte[k];
    const total = Object.values(totaux).reduce((s, x) => s + x, 0);
    const dernierRenverse = [...parId.values()].filter((e) => e.mauvais).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
    const tronque = donnees.journal.length >= 1000 ? donnees.journal[donnees.journal.length - 1]?.createdAt ?? null : null;
    return { jours, totaux, total, dernierRenverse, tronque };
  }, [donnees, debut]);

  if (!chef && g.pret) {
    return (
      <>
        <EnTete surtitre="La Garde · historique" titre="Ce chef n’existe pas." />
        <Link to="/garde/bureaux" className="bx-lien">
          Les bureaux
        </Link>
      </>
    );
  }
  if (erreur) return <EnTete surtitre="La Garde · historique" titre="La Garde n’a pas répondu." lede={erreur} />;
  if (!calcul) {
    return (
      <>
        <EnTete surtitre={`La Garde · ${chef?.titre ?? ''} · historique`} titre="Trente jours se relisent." />
        <Chargement texte="Lecture du journal du chef" />
      </>
    );
  }

  const { jours, totaux, total, dernierRenverse, tronque } = calcul;
  const nRenverses = totaux.renverse;
  const jourAmbre = dernierRenverse ? jourDe(new Date(dernierRenverse.createdAt)) : null;
  const hier = jourDe(new Date(Date.now() - 86_400_000));
  const quand = jourAmbre === jourDe(new Date()) ? 'aujourd’hui' : jourAmbre === hier ? 'hier' : jourAmbre ? `le ${Number(jourAmbre.slice(8))}/${jourAmbre.slice(5, 7)}` : '';
  const titre = nRenverses === 0 ? 'Aucune décision renversée en trente jours.' : `${enLettresF(nRenverses, true)} décision${nRenverses > 1 ? 's renversées' : ' renversée'} en trente jours.`;

  return (
    <>
      <EnTete surtitre={`La Garde · ${chef?.titre ?? ''} · historique`} titre={titre} />
      <nav className="mb-[18px] flex flex-wrap gap-1.5" aria-label="Les chefs">
        {g.chefs.map((c) => (
          <Link key={c.key} to={`/garde/bureaux/${encodeURIComponent(c.key)}/historique`} aria-current={c.key === equipe ? 'page' : undefined} className="h-8 border px-3 pt-[6px] text-[12.5px]" style={{ borderColor: c.key === equipe ? '#8a8a87' : 'var(--color-border-raised)', color: c.key === equipe ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
            {c.nom}
          </Link>
        ))}
      </nav>
      <section className="bx-dom">
        <div className="p-6">
          <div className="mb-[22px] flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-secondary">
              {chef?.titre} · {JOURS} jours · {total} décision{total > 1 ? 's' : ''}
            </span>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">un bâton par jour · sa hauteur dit ce qui s’est passé</span>
          </div>
          <div className="flex h-[64px] items-end gap-[4px]" role="img" aria-label={`Trente jours : ${total} décisions, dont ${totaux.renverse} renversée${totaux.renverse > 1 ? 's' : ''}`}>
            {jours.map((j) => {
              const pire = (Object.keys(j.compte) as Categorie[]).filter((k) => j.compte[k] > 0).sort((a, b) => RANG[b] - RANG[a])[0] ?? null;
              const cat = CATEGORIES.find((c) => c.cle === pire) ?? null;
              const estAmbre = j.cle === jourAmbre;
              const n = Object.values(j.compte).reduce((s, x) => s + x, 0);
              return (
                <span
                  key={j.cle}
                  className="min-w-0 flex-1"
                  style={{ height: cat ? cat.hauteur : 6, background: cat ? cat.ton : '#1a1a1a', boxShadow: estAmbre ? '0 0 22px -4px rgba(208,154,74,.8)' : undefined }}
                  title={`${j.date.getDate()}/${String(j.date.getMonth() + 1).padStart(2, '0')} : ${n ? `${n} décision${n > 1 ? 's' : ''}${cat ? ` — ${cat.nom.toLowerCase()}` : ''}` : 'rien'}`}
                  data-signal-groupe={estAmbre ? 'historique-renverse' : undefined}
                />
              );
            })}
          </div>
          <div className="mt-2 flex gap-[4px] font-mono text-[9.5px] tabular-nums text-text-muted">
            {jours.map((j, i) => (
              <span key={j.cle} className="min-w-0 flex-1 text-center">
                {i % 5 === 0 || i === jours.length - 1 ? j.date.getDate() : ''}
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {CATEGORIES.map((c) => (
              <span key={c.cle} className="flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-secondary">
                <span aria-hidden className="h-[9px] w-[9px]" style={{ background: c.cle === 'renverse' ? 'transparent' : c.ton, border: c.cle === 'renverse' ? `1px solid ${'var(--color-text-secondary)'}` : undefined }} />
                {c.nom}
              </span>
            ))}
          </div>
          {tronque && <p className="mt-3 text-[12px] text-text-secondary">Le journal rendu s’arrête au {tronque.slice(8, 10)}/{tronque.slice(5, 7)} (mille lignes) : les jours d’avant sont comptés en partie.</p>}
          {dernierRenverse ? (
            <div className="mt-5 flex flex-wrap items-center gap-5 px-4 py-4" style={{ border: `1px solid ${AMBRE}`, background: 'rgba(208,154,74,.07)' }} data-signal-groupe="historique-renverse">
              <div className="min-w-0 flex-1">
                <span className="block font-mono text-[9.5px] font-bold uppercase tracking-[0.14em]" style={{ color: AMBRE }}>
                  Renversée {quand} par {nom(dernierRenverse.mauvaisPar)}
                </span>
                <span className="mt-1.5 block text-[14.5px] font-semibold text-text-primary">
                  « {dernierRenverse.pourquoi || dernierRenverse.action} »{dernierRenverse.mauvaisNote ? ` : ${dernierRenverse.mauvaisNote}` : ''}
                </span>
                <span className="mt-1 block text-[12.5px] text-text-secondary">{dernierRenverse.correction ? `Le chef en a tiré une règle proposée : ${dernierRenverse.correction.texte}` : 'Le chef n’en a pas encore tiré de règle.'}</span>
              </div>
              <Link to={`/garde/bureaux/${encodeURIComponent(equipe ?? '')}`} className="bx-btn2">
                Voir la règle proposée
              </Link>
            </div>
          ) : (
            <p className="mt-5 border-t border-[#1d1d1d] pt-4 text-[13px] text-text-secondary">Aucun humain n’a renversé une décision de ce chef sur la période.</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-[#1d1d1d] bg-[#1d1d1d] md:grid-cols-5">
          {CATEGORIES.map((c) => (
            <span key={c.cle} className="bg-[#101010] px-4 py-4 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-text-body">
              {c.court} · {totaux[c.cle]}
            </span>
          ))}
        </div>
      </section>
      <Carte className="mt-[18px]" titre="Comment on lit" droite="chaque décision compte une fois">
        <p className="text-[13px] leading-relaxed text-text-secondary">
          Réglé seul : le chef a appliqué sa règle. Arbitré : deux chefs se sont sollicités, le Capitaine a tranché. Remonté : le chef a écrit à un humain. Question : il attend encore la réponse. Renversé : un humain a marqué la décision « mauvaise » — et le chef en tire une règle proposée, qu’il n’applique pas sans accord.
        </p>
      </Carte>
    </>
  );
}
