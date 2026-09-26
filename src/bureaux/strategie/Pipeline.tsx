import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { uid } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import { ETAPES_PIPELINE, EN_COURS, initiales, useStrategie, type Prospect } from '../donnees/strategie';
import type { ProspectStrategie } from '../donnees/types';
import { Carte, EnTete, Invitation } from '../ui/kit';
import { enLettres, hhmm, jourCourt, prenomDe } from '../format';
import { aujourdHui, champ, useEcrire } from './commun';

/**
 * STRATÉGIE · LE PIPELINE ET LA FICHE PROSPECT (cahier 14, `49d`).
 *
 * En tête, les cinq étapes du module Prospects (même collection : Stratégie
 * n'a pas un second fichier), chacune à la largeur de ce qu'elle contient ;
 * la somme des étapes en cours est le chiffre « Prospects » de l'accueil.
 * Dessous, la fiche du prospect ouvert : qui, d'où il vient, l'historique
 * des échanges — envois, ouvertures, pages consultées — et la prochaine
 * étape.
 *
 * L'ambre : la prochaine étape quand elle est due (aujourd'hui ou en retard).
 */

type Echange = NonNullable<ProspectStrategie['echanges']>[number];
const MOIS_COURTS = ['JANV.', 'FÉVR.', 'MARS', 'AVR.', 'MAI', 'JUIN', 'JUIL.', 'AOÛT', 'SEPT.', 'OCT.', 'NOV.', 'DÉC.'];
const TYPES: { cle: Echange['type']; nom: string }[] = [
  { cle: 'appel', nom: 'Appel' },
  { cle: 'envoi', nom: 'Envoi' },
  { cle: 'rdv', nom: 'Rendez-vous' },
  { cle: 'note', nom: 'Note' },
];

export function StrategiePipeline() {
  const m = useStrategie();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const ecrire = useEcrire<ProspectStrategie>('prospects');
  const [echange, setEchange] = useState<{ type: Echange['type']; texte: string } | null>(null);
  const [prochaine, setProchaine] = useState<{ quoi: string; jour: string; appel: boolean } | null>(null);
  const auj = aujourdHui();
  const moisCourant = auj.slice(0, 7);
  const vivants = m.prospects.filter((p) => p.name || p.company);
  const colonnes = ETAPES_PIPELINE.map((e) => ({
    ...e,
    nom: e.cle === 'gagne' || e.cle === 'perdu' ? `${e.nom} · ${MOIS_COURTS[Number(moisCourant.slice(5)) - 1]}` : e.nom,
    liste: vivants.filter((p) => p.stage === e.cle && (EN_COURS.includes(p.stage) || p.movedAt?.slice(0, 7) === moisCourant)),
  }));
  const enCours = vivants.filter((p) => EN_COURS.includes(p.stage));
  const p = vivants.find((x) => x.id === id) ?? m.ambre ?? enCours.find((x) => x.stage === 'proposition') ?? enCours[0] ?? null;

  if (!p) {
    return (
      <>
        <EnTete surtitre="Stratégie · Pipeline" titre="Aucun prospect en cours." />
        <Invitation titre="Le pipeline est vide." texte="Les prospects se notent dans le module Prospects du poste ; ils apparaissent ici avec leur prochaine étape et l’historique des échanges." action={<Link to="/pipeline" className="bx-btn2">Ouvrir Prospects</Link>} />
      </>
    );
  }

  const echanges = [...(p.echanges ?? [])].sort((a, b) => a.at.localeCompare(b.at));
  const dernierEnvoi = [...echanges].reverse().find((e) => e.type === 'envoi') ?? null;
  const ouvertures = echanges.filter((e) => e.type === 'ouverture' && (!dernierEnvoi || e.at > dernierEnvoi.at)).length;
  const due = p.prochaine && p.prochaine.at.slice(0, 10) <= auj ? p.prochaine : null;
  const etape = ETAPES_PIPELINE.find((e) => e.cle === p.stage);
  const suivante = ETAPES_PIPELINE[ETAPES_PIPELINE.findIndex((e) => e.cle === p.stage) + 1];
  const autres = vivants.filter((x) => x.stage === p.stage && x.id !== p.id && (EN_COURS.includes(x.stage) || x.movedAt?.slice(0, 7) === moisCourant));
  const pageDuJour = [...echanges].reverse().find((e) => e.type === 'page' && e.at.slice(0, 10) === auj) ?? null;
  const nom = p.company || p.name;

  const titre =
    ouvertures >= 2 && p.stage === 'proposition'
      ? `${nom} a ouvert son devis ${ouvertures === 2 ? 'deux' : enLettres(ouvertures)} fois.`
      : due
        ? `${nom} attend votre ${due.appel ? 'appel' : 'relance'}.`
        : `${enLettres(enCours.length, true)} prospect${enCours.length > 1 ? 's' : ''} en cours.`;

  const noter = (type: Echange['type'], texte: string, clore = false) =>
    ecrire(p.id, (b) => ({
      echanges: [...(b?.echanges ?? []), { id: uid('e'), type, texte, at: new Date().toISOString(), par: user?.email ?? null }],
      ...(clore ? { prochaine: null } : {}),
    }));
  const avancer = (stage: ProspectStrategie['stage']) => ecrire(p.id, () => ({ stage, movedAt: new Date().toISOString(), ...(stage === 'gagne' || stage === 'perdu' ? { prochaine: null } : {}) }));
  const ligneAutre = (x: Prospect): { texte: string; tag: string } => {
    const d = x.prochaine;
    const ouv = (x.echanges ?? []).filter((e) => e.type === 'ouverture').length;
    if (d && d.at.slice(0, 10) >= auj) return { texte: `${d.quoi} le ${Number(d.at.slice(8, 10))}`, tag: d.quoi.toLowerCase().includes('rendez') ? 'RDV' : d.appel ? 'APPEL' : 'RELANCE' };
    if (d) return { texte: `${d.quoi} depuis le ${Number(d.at.slice(8, 10))}, sans réponse`, tag: 'RELANCE' };
    if (ouv) return { texte: `devis ouvert ${ouv === 1 ? 'une fois' : `${ouv} fois`}`, tag: 'OUVERT' };
    return { texte: x.stage === 'proposition' ? `devis envoyé le ${Number(x.movedAt.slice(8, 10))}/${x.movedAt.slice(5, 7)}` : `à cette étape depuis le ${Number(x.movedAt.slice(8, 10))}/${x.movedAt.slice(5, 7)}`, tag: '' };
  };

  return (
    <>
      <EnTete surtitre={`Stratégie · Pipeline · ${enCours.length} en cours`} titre={titre} />
      <div className="mb-[18px] flex gap-2" role="list" aria-label="Les étapes">
        {colonnes.map((c) => {
          const on = c.cle === p.stage;
          return (
            <button
              key={c.cle}
              type="button"
              role="listitem"
              onClick={() => c.liste[0] && navigate(`/strategie/pipeline/${c.liste[0].id}`)}
              className="min-w-[124px] px-3 pb-3 pt-2.5 text-left"
              style={{ flexGrow: Math.max(1, c.liste.length), flexBasis: 0, background: on ? '#1b1b1e' : '#141416', border: `1px solid ${on ? '#4a4a50' : '#28282c'}` }}
              aria-current={on ? 'true' : undefined}
            >
              <span className="block truncate font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-secondary">{c.nom}</span>
              <span className="mt-1.5 block font-mono text-[18px] font-semibold tabular-nums text-text-primary">{c.liste.length || '—'}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <Carte dominante pad="p-6" className="self-start" titre={`${nom} · prospect`} droite={`${etape?.nom ?? ''}${p.venuPar ? ` · venu par ${p.venuPar}` : p.source ? ` · ${libelleSource(p.source)}` : ''}`}>
          <div className="flex items-center gap-4">
            <span className="flex h-[50px] w-[50px] flex-none items-center justify-center border border-[#3a3a40] bg-[#1b1b1e] font-mono text-[15px] font-semibold text-text-secondary">{initiales(nom)}</span>
            <span className="min-w-0">
              <span className="block text-[21px] font-bold tracking-[-0.02em] text-text-primary">{nom}</span>
              <span className="mt-1 block text-[12.5px] text-text-secondary">{[p.secteur, p.ville, p.name && p.name !== nom ? `${p.name}${p.role ? `, ${p.role}` : ''}` : null, p.telephone].filter(Boolean).join(' · ') || '—'}</span>
            </span>
          </div>

          <span className="mt-6 block font-mono text-[9.5px] uppercase tracking-[0.16em] text-text-muted">L’historique des échanges</span>
          {echanges.length === 0 ? (
            <p className="mt-2 text-[13px] text-text-secondary">Aucun échange noté.</p>
          ) : (
            <ol className="mt-2">
              {echanges.slice(-8).map((e) => (
                <li key={e.id} className="grid grid-cols-[112px_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-[#222226] py-2.5">
                  <span className="font-mono text-[10.5px] uppercase tabular-nums text-text-muted">
                    {jourCourt(e.at)} · {hhmm(e.at)}
                  </span>
                  <span className="text-[13.5px] text-text-body">{e.texte}</span>
                  <span className="font-mono text-[10px] text-text-muted">{e.type === 'ouverture' || e.type === 'page' ? '—' : e.par ? prenomDe(e.par).slice(0, 2).toUpperCase() : ''}</span>
                </li>
              ))}
            </ol>
          )}

          {due ? (
            <div className="mt-5 flex flex-wrap items-center gap-4 px-4 py-4" style={{ border: `1px solid ${AMBRE}`, background: 'rgba(208,154,74,.07)', boxShadow: '0 0 30px -14px rgba(208,154,74,.6)' }} data-signal-groupe="pipeline-prochaine">
              <div className="min-w-0 flex-1">
                <span className="block font-mono text-[9.5px] font-bold uppercase tracking-[0.14em]" style={{ color: AMBRE }}>
                  La prochaine étape · {due.at.slice(0, 10) === auj ? 'aujourd’hui' : `depuis le ${Number(due.at.slice(8, 10))}`}
                </span>
                <span className="mt-1.5 block text-[14.5px] font-semibold text-text-primary">
                  {due.quoi.charAt(0).toUpperCase() + due.quoi.slice(1)} {p.name && !due.quoi.includes(p.name) ? p.name : ''}
                  {ouvertures >= 2 ? ` : ${p.name ? 'elle' : 'il'} a ouvert le devis ${ouvertures === 2 ? 'deux' : enLettres(ouvertures)} fois sans répondre` : ''}
                </span>
                <span className="mt-1 block text-[12.5px] text-text-secondary">{due.detail ?? (pageDuJour ? `${pageDuJour.texte} à ${hhmm(pageDuJour.at)}.` : 'Rien de neuf depuis le dernier échange.')}</span>
              </div>
              <div className="flex flex-none gap-2">
                {due.appel && p.telephone ? (
                  <a href={`tel:${p.telephone.replace(/\s+/g, '')}`} className="bx-btn2">
                    Appeler
                  </a>
                ) : null}
                <button type="button" className="bx-btn2" onClick={() => noter(due.appel ? 'appel' : 'envoi', `${due.quoi.charAt(0).toUpperCase() + due.quoi.slice(1)} : fait`, true)}>
                  C’est fait
                </button>
              </div>
            </div>
          ) : p.prochaine ? (
            <div className="mt-5 border border-[#28282c] px-4 py-3.5">
              <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">La prochaine étape · le {Number(p.prochaine.at.slice(8, 10))}</span>
              <span className="mt-1 block text-[13.5px] text-text-primary">{p.prochaine.quoi.charAt(0).toUpperCase() + p.prochaine.quoi.slice(1)}</span>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2.5 border-t border-[#222226] pt-4">
            <button type="button" className="bx-btn2" onClick={() => setEchange({ type: 'appel', texte: '' })}>
              Noter un échange
            </button>
            <button type="button" className="bx-btn2" onClick={() => setProchaine({ quoi: p.prochaine?.quoi ?? 'appeler', jour: p.prochaine?.at.slice(0, 10) ?? auj, appel: p.prochaine?.appel ?? true })}>
              {p.prochaine ? 'Déplacer la prochaine étape' : 'Fixer la prochaine étape'}
            </button>
            {suivante && EN_COURS.includes(p.stage) && (
              <button type="button" className="bx-btn2" onClick={() => avancer(suivante.cle)}>
                Passer à « {suivante.nom} »
              </button>
            )}
            {EN_COURS.includes(p.stage) && (
              <button type="button" className="bx-lien self-center" onClick={() => avancer('perdu')}>
                Perdu
              </button>
            )}
          </div>
          {echange && (
            <form
              className="mt-3 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!echange.texte.trim()) return;
                noter(echange.type, echange.texte.trim());
                setEchange(null);
              }}
            >
              <select value={echange.type} onChange={(e) => setEchange({ ...echange, type: e.target.value as Echange['type'] })} aria-label="Le genre d’échange" className={`${champ} h-9 bg-[#141416]`}>
                {TYPES.map((t) => (
                  <option key={t.cle} value={t.cle}>
                    {t.nom}
                  </option>
                ))}
              </select>
              <input autoFocus value={echange.texte} onChange={(e) => setEchange({ ...echange, texte: e.target.value })} placeholder="Ce qui s’est dit, ce qui est parti…" aria-label="L’échange" className={`${champ} h-9 min-w-0 flex-1`} />
              <button type="submit" className="bx-btn" disabled={!echange.texte.trim()}>
                Noter
              </button>
              <button type="button" className="bx-lien" onClick={() => setEchange(null)}>
                Annuler
              </button>
            </form>
          )}
          {prochaine && (
            <form
              className="mt-3 flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!prochaine.quoi.trim() || !prochaine.jour) return;
                ecrire(p.id, () => ({ prochaine: { quoi: prochaine.quoi.trim(), at: `${prochaine.jour}T09:00:00`, appel: prochaine.appel } }));
                setProchaine(null);
              }}
            >
              <input autoFocus value={prochaine.quoi} onChange={(e) => setProchaine({ ...prochaine, quoi: e.target.value })} aria-label="La prochaine étape" className={`${champ} h-9 min-w-0 flex-1`} />
              <input type="date" value={prochaine.jour} onChange={(e) => setProchaine({ ...prochaine, jour: e.target.value })} aria-label="Le jour" className={`${champ} h-9 [color-scheme:dark]`} />
              <label className="flex items-center gap-2 text-[12.5px] text-text-secondary">
                <input type="checkbox" checked={prochaine.appel} onChange={(e) => setProchaine({ ...prochaine, appel: e.target.checked })} className="accent-[#8a8a87]" />
                un appel
              </label>
              <button type="submit" className="bx-btn">
                Fixer
              </button>
              <button type="button" className="bx-lien" onClick={() => setProchaine(null)}>
                Annuler
              </button>
            </form>
          )}
        </Carte>

        <Carte className="self-start" titre={`Les autres · ${etape?.nom.toLowerCase() ?? ''}`} droite={autres.length || ''}>
          {autres.length === 0 ? (
            <p className="text-[13px] text-text-secondary">Aucun autre prospect à cette étape.</p>
          ) : (
            autres.slice(0, 8).map((x) => {
              const l = ligneAutre(x);
              return (
                <Link key={x.id} to={`/strategie/pipeline/${x.id}`} className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-[#222226] py-3 hover:bg-white/[0.02]">
                  <span className="truncate font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-secondary">{x.company || x.name}</span>
                  <span className="text-[13px] leading-snug text-text-body">{l.texte}</span>
                  <span className="font-mono text-[10px] uppercase text-text-muted">{l.tag}</span>
                </Link>
              );
            })
          )}
        </Carte>
      </div>
    </>
  );
}

function libelleSource(s: string): string {
  return s === 'bouche' ? 'bouche à oreille' : s === 'site' ? 'venu par le site' : s === 'salon' ? 'rencontré au salon' : s;
}
