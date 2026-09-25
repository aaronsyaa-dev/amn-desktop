import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useSync, uid } from '../../state/SyncContext';
import { bridge } from '../../lib/bridge';
import type { AdminOrgUser } from '../../shared/api';
import { AMBRE } from '../jetons';
import { CONTROLES, useCyber } from '../donnees/cyber';
import { useSourceBureaux } from '../donnees/source';
import type { Actif, FamilleActif } from '../donnees/types';
import { Carte, Chargement, EnTete, Invitation, Ligne } from '../ui/kit';
import { enLettres, jourCourt, jourLong, jourMois, signe } from '../format';

/**
 * CYBER · L'INVENTAIRE D'UNE CLIENTE — le trousseau (cahier 13, `47d`).
 *
 * Tout ce qui est surveillé chez elle, en six familles, un jeton par actif.
 * Un actif qui a une échéance porte une jauge qui se remplit à mesure
 * qu'elle approche ; un défaut est écrit en encre claire. Les sources sont
 * dites : les sites et leurs certificats sont RELEVÉS (le registre des sites,
 * SSL Monitor) ; les comptes sont ceux de son desktop ; le reste est DÉCLARÉ
 * — et le jeton le porte. L'ambre : l'actif dont l'échéance est la plus
 * proche.
 */

const FAMILLES: { cle: FamilleActif; nom: string }[] = [
  { cle: 'domaine', nom: 'Domaines' },
  { cle: 'site', nom: 'Sites' },
  { cle: 'certificat', nom: 'Certificats' },
  { cle: 'compte', nom: 'Comptes' },
  { cle: 'poste', nom: 'Postes' },
  { cle: 'sauvegarde', nom: 'Sauvegardes' },
];

interface Jeton {
  id: string;
  famille: FamilleActif;
  nom: string;
  ligne: string;
  echeance: string | null;
  jours: number | null;
  defaut: string | null;
  source: 'releve' | 'desktop' | 'declare';
}

const JOUR = 86_400_000;

export function CyberInventaire() {
  const { orgId } = useParams();
  const c = useCyber();
  const src = useSourceBureaux();
  const navigate = useNavigate();
  const cible = orgId ?? c.ambre?.id ?? c.orgs.find((o) => c.actifs.some((a) => a.orgId === o.id))?.id ?? c.orgs[0]?.id ?? null;
  useEffect(() => {
    if (!orgId && cible) navigate(`/cyber/inventaire/${cible}`, { replace: true });
  }, [orgId, cible, navigate]);
  if (!c.pret) return <Chargement texte="Lecture de l’inventaire" />;
  if (!cible) return <EnTete surtitre="Cyber · Inventaire" titre="Aucune organisation au parc." />;
  return <Trousseau orgId={cible} />;
}

function Trousseau({ orgId }: { orgId: string }) {
  const c = useCyber();
  const src = useSourceBureaux();
  const { user } = useAuth();
  const { upsert } = useSync();
  const navigate = useNavigate();
  const [comptes, setComptes] = useState<AdminOrgUser[]>([]);
  const [ajout, setAjout] = useState<{ famille: FamilleActif; nom: string; echeance: string; seul: boolean; defaut: string } | null>(null);
  const posture = c.orgs.find((o) => o.id === orgId) ?? null;
  const org = src.organisations.find((o) => o.id === orgId) ?? null;
  useEffect(() => {
    let vivant = true;
    bridge()
      .remote.admin.listUsers(orgId)
      .then((u) => vivant && setComptes(u))
      .catch(() => vivant && setComptes([]));
    return () => {
      vivant = false;
    };
  }, [orgId]);

  const jetons = useMemo<Jeton[]>(() => {
    const auj = Date.now();
    const jours = (d: string | null) => (d ? Math.round((Date.parse(`${d.slice(0, 10)}T12:00:00`) - auj) / JOUR) : null);
    const j: Jeton[] = [];
    for (const a of c.actifs.filter((x) => x.orgId === orgId)) {
      j.push({ id: a.id, famille: a.famille, nom: a.nom, ligne: a.defaut ?? (a.echeance ? jourMois(a.echeance) : a.source === 'declare' ? 'déclaré' : 'suivi'), echeance: a.echeance ?? null, jours: jours(a.echeance ?? null), defaut: a.defaut ?? null, source: a.source });
    }
    const noms = new Set(j.map((x) => `${x.famille}:${x.nom}`));
    for (const s of src.sites.filter((x) => x.clientOrgId === orgId)) {
      if (!noms.has(`site:${s.name}`)) j.push({ id: `site:${s.id}`, famille: 'site', nom: s.name, ligne: s.state?.status === 'online' ? 'en ligne' : s.state?.status === 'unknown' ? 'pas encore vu' : s.state?.status ?? 'suivi', echeance: null, jours: null, defaut: null, source: 'releve' });
    }
    const sitesIds = new Set(src.sites.filter((x) => x.clientOrgId === orgId).map((s) => s.id));
    for (const s of src.ssl.filter((x) => x.site && sitesIds.has(x.site.id))) {
      if (noms.has(`certificat:${s.host}`)) continue;
      j.push({ id: `ssl:${s.host}`, famille: 'certificat', nom: s.host, ligne: s.error ? s.error : s.validTo ? jourMois(s.validTo) : 'relevé', echeance: s.validTo?.slice(0, 10) ?? null, jours: s.daysLeft, defaut: s.error ?? null, source: 'releve' });
    }
    for (const u of comptes) {
      if (j.some((x) => x.famille === 'compte' && x.nom.toLowerCase() === u.email.toLowerCase())) continue;
      j.push({ id: `compte:${u.id}`, famille: 'compte', nom: u.email, ligne: u.status === 'invited' ? 'invitation en attente' : 'compte du desktop', echeance: null, jours: null, defaut: null, source: 'desktop' });
    }
    return j;
  }, [c.actifs, src.sites, src.ssl, comptes, orgId]);

  const avecEcheance = jetons.filter((x) => x.jours !== null && x.jours >= 0).sort((a, b) => (a.jours ?? 0) - (b.jours ?? 0));
  const ambre = avecEcheance[0] && (avecEcheance[0].jours ?? 99) <= 30 ? avecEcheance[0] : null;
  const n = jetons.length;
  const titre = !n
    ? 'Rien n’est encore inventorié chez elle.'
    : `${enLettres(n, true)} actif${n > 1 ? 's' : ''}.${ambre ? ` ${ambre.famille === 'certificat' ? 'Un certificat' : ambre.famille === 'domaine' ? 'Un domaine' : 'Une échéance'} tombe ${ambre.jours! <= 6 ? jourLong(ambre.echeance!) : `le ${jourMois(ambre.echeance!)}`}.` : ' Aucune échéance dans le mois.'}`;
  // Ce qui fait baisser sa posture : le poids de chaque contrôle en défaut.
  const connus = posture ? CONTROLES.filter((k) => posture.controles[k.cle]) : [];
  const pertes = posture
    ? CONTROLES.filter((k) => posture.controles[k.cle] && posture.controles[k.cle]!.etat !== 'conforme')
        .map((k) => {
          const e = posture.controles[k.cle]!;
          const v = e.etat === 'partiel' ? 0.5 : 0;
          return { k, perte: Math.round((100 * (1 - v)) / Math.max(1, connus.length)), pourquoi: e.pourquoi ?? `${k.nom} ${e.etat === 'partiel' ? 'partiel' : 'non conforme'}` };
        })
        .sort((a, b) => b.perte - a.perte)
    : [];

  const declarer = () => {
    if (!ajout || !ajout.nom.trim()) return;
    const a: Actif = { orgId, famille: ajout.famille, nom: ajout.nom.trim(), source: 'declare', echeance: ajout.echeance || null, echeanceType: ajout.echeance ? (ajout.famille === 'domaine' ? 'domaine' : ajout.famille === 'certificat' ? 'certificat' : 'licence') : null, renouvelleSeul: ajout.seul, defaut: ajout.defaut.trim() || null, at: new Date().toISOString(), par: user?.email ?? '' };
    void upsert('inventaire', `actif-${uid()}`, { ...a });
    setAjout(null);
  };
  const champ = 'h-9 border border-[#2b3030] bg-[#111414] px-2.5 text-[13px] text-[#f7f7f5] outline-none focus:border-[#8a8a87]';

  return (
    <>
      <EnTete
        surtitre={`Cyber · Inventaire · ${org?.name ?? ''}`}
        titre={titre}
        actions={
          <select value={orgId} onChange={(e) => navigate(`/cyber/inventaire/${e.target.value}`)} className={champ} aria-label="L’organisation">
            {c.orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nom}
              </option>
            ))}
          </select>
        }
      />
      <Carte dominante pad="p-6" titre={`Le trousseau · ${n} actif${n > 1 ? 's' : ''} surveillé${n > 1 ? 's' : ''}`} droite="jauge = proximité de l’échéance">
        {!n ? (
          <Invitation titre="Le trousseau est vide." texte="Ses sites rattachés et leurs certificats s’y rangent d’eux-mêmes ; le reste — domaines, postes, sauvegardes — se déclare ici." />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {FAMILLES.map((f) => {
              const liste = jetons.filter((x) => x.famille === f.cle);
              return (
                <div key={f.cle} className="min-w-0">
                  <span className="block border-b border-[#212525] pb-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#a3a3a0]">
                    {f.nom} {liste.length > 0 && liste.length}
                  </span>
                  <div className="mt-2.5 flex flex-col gap-2">
                    {liste.map((x) => (
                      <JetonActif key={x.id} x={x} ambre={ambre?.id === x.id} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-5 border-t border-[#1d2121] pt-4">
          {ajout ? (
            <div className="flex flex-wrap items-center gap-2">
              <select value={ajout.famille} onChange={(e) => setAjout({ ...ajout, famille: e.target.value as FamilleActif })} className={champ} aria-label="La famille">
                {FAMILLES.map((f) => (
                  <option key={f.cle} value={f.cle}>
                    {f.nom}
                  </option>
                ))}
              </select>
              <input value={ajout.nom} onChange={(e) => setAjout({ ...ajout, nom: e.target.value })} placeholder="jardin-elise.fr" aria-label="L’actif" className={`${champ} w-[200px]`} />
              <input type="date" value={ajout.echeance} onChange={(e) => setAjout({ ...ajout, echeance: e.target.value })} aria-label="Son échéance" className={champ} />
              <label className="flex items-center gap-1.5 text-[12.5px] text-[#a3a3a0]">
                <input type="checkbox" checked={ajout.seul} onChange={(e) => setAjout({ ...ajout, seul: e.target.checked })} className="accent-[#8a8a87]" /> se renouvelle seul
              </label>
              <input value={ajout.defaut} onChange={(e) => setAjout({ ...ajout, defaut: e.target.value })} placeholder="un défaut connu" aria-label="Un défaut connu" className={`${champ} w-[180px]`} />
              <button type="button" className="bx-btn" disabled={!ajout.nom.trim()} onClick={declarer}>
                Déclarer
              </button>
              <button type="button" className="bx-btn2" onClick={() => setAjout(null)}>
                Annuler
              </button>
            </div>
          ) : (
            <button type="button" className="bx-btn2" onClick={() => setAjout({ famille: 'domaine', nom: '', echeance: '', seul: false, defaut: '' })}>
              Déclarer un actif
            </button>
          )}
        </div>
      </Carte>
      <div className="mt-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-2">
        <Carte titre="Ce qui fait baisser sa posture" droite={posture?.tendance !== null && posture?.tendance !== undefined ? `${signe(posture.tendance)} en 7 j` : ''}>
          {pertes.length === 0 ? <p className="text-[13px] text-[#a3a3a0]">{posture?.score === null ? 'Posture non relevée : moins de trois contrôles connus.' : 'Rien : chaque contrôle relevé est conforme.'}</p> : pertes.map((p) => <Ligne key={p.k.cle} colonnes="44px minmax(0,1fr) auto" a={`−${p.perte}`} b={p.pourquoi} c={p.k.court} />)}
        </Carte>
        <Carte titre="Sources" droite="comment l’inventaire se tient">
          <p className="text-[13px] leading-relaxed text-[#a3a3a0]">
            Sites et certificats : relevés — le registre des sites et SSL Monitor, pour les sites rattachés à la cliente. Comptes : ceux de son desktop. Domaines, postes et sauvegardes : déclarés ici, et le jeton le porte (« DÉCLARÉ »). Rien n’est relevé sur ses postes sans le desktop.
          </p>
          <div className="mt-4">
            <Link to="/cyber/echeances" className="bx-lien">
              5 · Échéances
            </Link>
          </div>
        </Carte>
      </div>
    </>
  );
}

function JetonActif({ x, ambre }: { x: Jeton; ambre: boolean }) {
  const remplissage = x.jours === null ? null : Math.max(0.04, Math.min(1, 1 - x.jours / 90));
  return (
    <div className="px-3 py-2.5" style={{ background: ambre ? 'rgba(208,154,74,.08)' : '#161919', border: `1px solid ${ambre ? AMBRE : '#212525'}` }} data-signal-groupe={ambre ? 'trousseau-ambre' : undefined} title={`${x.nom} · ${x.source === 'declare' ? 'déclaré' : x.source === 'desktop' ? 'remonté par son desktop' : 'relevé'}`}>
      <span className="block truncate font-mono text-[12.5px] font-semibold text-[#f7f7f5]">{x.nom}</span>
      <span className="mt-1 block truncate font-mono text-[10.5px]" style={{ color: ambre ? AMBRE : x.defaut ? '#e4e4e1' : '#9a9a97' }}>
        {x.jours !== null && x.jours >= 0 && x.jours <= 6 ? jourCourt(x.echeance!).toLowerCase() : x.ligne}
        {x.source === 'declare' && !x.defaut ? ' · déclaré' : ''}
      </span>
      {remplissage !== null && (
        <span className="mt-2 block h-[3px] bg-[#2b3030]" aria-hidden>
          <span className="block h-full" style={{ width: `${remplissage * 100}%`, background: ambre ? AMBRE : '#6b7070' }} />
        </span>
      )}
    </div>
  );
}
