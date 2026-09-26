import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useCollection, useSync } from '../../state/SyncContext';
import { useProfilesOptionnel } from '../../state/ProfilesContext';
import { useOrgContext } from '../../state/OrgContextContext';
import { bridge } from '../../lib/bridge';
import { NAV_SECTIONS } from '../../data/navigation';
import { PALIER_PRIX_EUR, nomPalier } from '../../lib/paliers';
import type { AdminOrgUser } from '../../shared/api';
import { AMBRE } from '../jetons';
import { useSupervisor } from '../donnees/useSupervisor';
import { useCyber } from '../donnees/cyber';
import { useSourceBureaux } from '../donnees/source';
import { LIBELLE_TYPE, texteReste } from '../donnees/file';
import { STATIONS_BUG, type DossierOrg, type EtatModuleSeule, type ParcoursBug } from '../donnees/types';
import { Carte, Chargement, EnTete, Ligne, Stat } from '../ui/kit';
import { GestesElement } from './ATraiter';
import { NOMS as NOMS_STATIONS } from './Bug';
import { deNom, hhmm, ilYA, moisLong, prenomDe, signe } from '../format';
import { initiales } from '../donnees/strategie';

/**
 * SUPERVISOR · LE DOSSIER CLIENT, EN PAGE (cahier 12, `46e`).
 *
 * En tête, la fiche d'identité et, dans la même carte, ce qui l'attend
 * (l'ambre). Dessous, son espace : les modules installés, par famille, chacun
 * avec son état POUR ELLE SEULE — actif, en pause pour elle, version
 * épinglée, alternative temporaire. Les cinq gestes du dossier sous
 * l'espace. Une action faite « pour elle seule » ne touche jamais les autres
 * organisations : la pause ferme le module chez elle (l'ajustement de sa
 * formule, côté serveur), l'alternative l'ouvre chez elle ; l'épinglage est
 * noté au dossier — le serveur ne sait pas encore servir une version
 * ancienne d'un module, et l'écran le dit.
 */

type Geste = null | 'pause' | 'epingler' | 'alternative';
const ROLES: Record<string, string> = { owner: 'propriétaire', admin: 'administration', member: 'membre' };

/** Le libellé et la famille d'un module, lus dans le catalogue — jamais une liste recopiée. */
function catalogueModules() {
  const parCle = new Map<string, { nom: string; famille: string; ordre: number }>();
  NAV_SECTIONS.forEach((s, i) => {
    if ((s.space ?? 'workspace') !== 'workspace') return;
    for (const it of s.items) if (!parCle.has(it.key)) parCle.set(it.key, { nom: it.label, famille: s.label, ordre: i });
  });
  return parCle;
}

export function SupervisorDossier() {
  const { orgId = '' } = useParams();
  const m = useSupervisor();
  const cyber = useCyber();
  const src = useSourceBureaux();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { upsert } = useSync();
  const profils = useProfilesOptionnel();
  const { enterOrganization } = useOrgContext();
  const o = m.orgs.find((x) => x.id === orgId) ?? null;
  const dossier: DossierOrg = m.dossiers.get(orgId) ?? {};
  const posture = cyber.orgs.find((x) => x.id === orgId) ?? null;
  const [personnes, setPersonnes] = useState<AdminOrgUser[] | null>(null);
  const [geste, setGeste] = useState<Geste>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const catalogue = useMemo(catalogueModules, []);
  /* Les parcours de bug de cette cliente : on doit pouvoir y revenir une fois la page quittée. Les ouverts d'abord. */
  const tousParcours = useCollection<ParcoursBug>('parcoursBugs');
  const parcours = useMemo(
    () =>
      tousParcours
        .filter((p) => p.orgId === orgId)
        .sort((a, b) => Number(Boolean(a.stations.cloture)) - Number(Boolean(b.stations.cloture)) || b.ouvertLe.localeCompare(a.ouvertLe)),
    [tousParcours, orgId],
  );

  useEffect(() => {
    if (!orgId) return;
    let vivant = true;
    bridge()
      .remote.admin.listUsers(orgId)
      .then((u) => vivant && setPersonnes(u))
      .catch(() => vivant && setPersonnes([]));
    return () => {
      vivant = false;
    };
  }, [orgId]);

  if (!m.pret) {
    return (
      <>
        <EnTete surtitre="Supervisor · Dossiers clients" titre="Le dossier s’ouvre." />
        <Carte dominante>
          <Chargement texte="Lecture du dossier" />
        </Carte>
      </>
    );
  }
  if (!o) {
    return (
      <>
        <EnTete surtitre="Supervisor · Dossiers clients" titre="Ce dossier n’existe pas, ou plus." lede="L’organisation a pu être retirée du parc." actions={<Link to="/tour/organisations" className="bx-btn2">Tous les dossiers</Link>} />
      </>
    );
  }

  const nomDe = (e: string | null | undefined) => (e ? profils?.profileFor(e).name?.split(' ')[0] || prenomDe(e) : '—');
  const rang = m.tri.findIndex((x) => x.id === o.id) + 1;
  const attend = m.file.filter((x) => x.orgId === o.id);
  const premier = attend[0] ?? null;
  const etats = dossier.modules ?? {};
  // Son espace : les modules ouverts chez elle, et ceux qu'on a mis en pause POUR ELLE (fermés, donc absents de sa liste).
  const ouverts = o.org.modules ?? o.org.formula?.modules ?? null;
  // Une formule qui ouvre tout : tout le catalogue est listé (la liste se cherche et se replie, voir ListeModules).
  const cles = [...new Set([...(ouverts ?? [...catalogue.keys()]), ...Object.keys(etats)])].filter((k) => catalogue.has(k));
  const familles = new Map<string, string[]>();
  for (const k of cles) {
    const f = catalogue.get(k)!.famille;
    familles.set(f, [...(familles.get(f) ?? []), k]);
  }
  const ordreFamilles = [...familles.entries()].sort((a, b) => catalogue.get(a[1][0])!.ordre - catalogue.get(b[1][0])!.ordre);
  const places = o.org.seats ?? o.org.formula?.seats ?? null;
  const prix = PALIER_PRIX_EUR[o.org.plan];
  const actifs = (personnes ?? []).filter((p) => p.status !== 'suspended');

  const poserEtat = async (cle: string, etat: EtatModuleSeule | null, ouvrir: boolean | null) => {
    try {
      if (ouvrir !== null) await bridge().remote.admin.setOrganizationModule(o.id, cle, ouvrir);
      const suivants = { ...etats };
      if (etat) suivants[cle] = etat;
      else delete suivants[cle];
      await upsert('orgDossier', o.id, { ...stripId(dossier), modules: suivants, updatedBy: user?.email ?? '' });
      setMessage(null);
      void src.recharger();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Refusé par le serveur.');
    }
  };
  const ajouterNote = () => {
    if (!note.trim() || !user?.email) return;
    const notes = [...(dossier.notes ?? []), { id: `n${Date.now()}`, texte: note.trim(), par: user.email, at: new Date().toISOString() }];
    void upsert('orgDossier', o.id, { ...stripId(dossier), notes, updatedBy: user.email });
    setNote('');
  };
  const suivre = () => user?.email && void upsert('suivis', `org:${o.id}`, { par: user.email, at: new Date().toISOString() });

  const suiviTexte = o.suivi.type === 'humain' ? nomDe(o.suivi.email) : o.suivi.type === 'garde' ? 'la Garde' : o.suivi.type === 'personne' ? 'personne' : '—';
  const contact = dossier.contact;

  return (
    <>
      <EnTete surtitre={`Supervisor · Dossiers clients · ${rang} / ${m.orgs.length}`} titre={`Le dossier ${deNom(o.nom)}`} />
      <section className="bx-dom grid grid-cols-1 gap-6 p-7 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0">
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 flex-none items-center justify-center border border-[#2b2b2b] bg-[#1a1a1a] font-mono text-[14px] font-semibold text-text-body">{initiales(o.nom)}</span>
            <div className="min-w-0">
              <h2 className="truncate text-[30px] font-bold leading-tight tracking-[-0.03em] text-text-primary">{o.nom}</h2>
              <p className="text-[12.5px] text-text-secondary">
                {[dossier.metier, dossier.ville, `cliente depuis ${moisLong(o.org.createdAt)}`, dossier.groupe ? `groupe ${dossier.groupe}` : 'seule, sans groupe'].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Stat l="Formule" v={`${prix ? `${prix} €` : nomPalier(o.org.plan)} · ${places ?? '∞'} place${(places ?? 2) > 1 ? 's' : ''}`} />
            <Stat l="Posture" v={posture?.score !== null && posture?.score !== undefined ? `${posture.score}${posture.tendance !== null ? ` · ${signe(posture.tendance)} en 7 j` : ''}` : 'non relevée'} />
            <Stat l="Desktop" v={o.org.lastActivityAt ? `ouvert ${ilYA(o.org.lastActivityAt, m.maintenant)}` : 'jamais ouvert'} />
            <span>
              <Stat l="Suivi" v={suiviTexte} />
              {o.suivi.type !== 'humain' && (
                <button type="button" onClick={suivre} className="mt-1.5 text-[12px] font-semibold text-text-body underline decoration-trait-sourd underline-offset-4">
                  La suivre
                </button>
              )}
            </span>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-border pt-4 text-[12.5px] text-text-secondary">
            {contact?.nom ? (
              <>
                <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#2b2b2b] font-mono text-[9px] font-semibold text-text-body">{initiales(contact.nom)}</span>
                <span className="font-semibold text-text-primary">{contact.nom}</span>
                {[contact.role, contact.tel, contact.email].filter(Boolean).join(' · ')}
              </>
            ) : (
              'Pas encore de contact principal au dossier.'
            )}
          </div>
        </div>
        {premier ? (
          <div className="p-5" style={{ border: `1px solid ${AMBRE}`, background: 'rgba(208,154,74,.06)', boxShadow: '0 0 30px -14px rgba(208,154,74,.7)' }} data-signal-groupe="dossier-ambre">
            <span className="block font-mono text-[9.5px] font-bold uppercase tracking-[0.18em]" style={{ color: AMBRE }}>
              Ce qui l’attend
            </span>
            <span className="mt-3 block text-[16.5px] font-semibold leading-snug text-text-primary">
              {premier.phrase.replace(/[.\s]+$/, '')}
              {premier.qui ? '.' : `, ${ilYA(premier.depuis, m.maintenant)}.`}
            </span>
            <span className="mt-2 block text-[12px] leading-relaxed text-text-secondary">
              {LIBELLE_TYPE[premier.type].toLowerCase()} · {texteReste(premier.resteMs)}
              {attend.length > 1 ? ` · et ${attend.length - 1} autre${attend.length > 2 ? 's' : ''}` : ''}
            </span>
            <div className="mt-4">
              <GestesElement x={premier} relire={() => void src.recharger()} compact />
            </div>
          </div>
        ) : (
          <div className="border border-[#252525] p-5 text-[13px] leading-relaxed text-text-secondary">Rien ne l’attend en ce moment.</div>
        )}
      </section>

      <div className="mt-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="flex flex-col gap-[18px]">
          <Carte titre={`Son espace · ${cles.length} module${cles.length > 1 ? 's' : ''}${ouverts ? ' installés' : ''}`} droite="groupés par famille, avec leur état pour elle">
            {ouverts === null && <p className="mb-4 text-[12.5px] text-text-secondary">Sa formule ouvre tout le catalogue : chaque module est listé, avec son état pour elle.</p>}
            <ListeModules
              cles={cles}
              ordreFamilles={ordreFamilles}
              etats={etats}
              nomDe={(k) => catalogue.get(k)!.nom}
              tuile={(k) => <TuileModule key={k} nom={catalogue.get(k)!.nom} etat={etats[k] ?? null} alt={etats[k]?.alternative ? catalogue.get(etats[k].alternative!)?.nom ?? etats[k].alternative! : null} onReactiver={() => void poserEtat(k, null, etats[k]?.etat === 'pause' ? true : null)} />}
            />
            <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
              <GesteDossier titre="Ajouter un module" sous="le chercheur, pour elle" onClick={() => navigate(`/supervisor/chercheur?org=${o.id}`)} />
              <GesteDossier titre="Mettre un module en pause" sous="pour elle seule" actif={geste === 'pause'} onClick={() => setGeste(geste === 'pause' ? null : 'pause')} />
              <GesteDossier titre="Épingler une version" sous="pour elle seule" actif={geste === 'epingler'} onClick={() => setGeste(geste === 'epingler' ? null : 'epingler')} />
              <GesteDossier titre="Proposer une alternative" sous="temporaire" actif={geste === 'alternative'} onClick={() => setGeste(geste === 'alternative' ? null : 'alternative')} />
              <GesteDossier titre="Ouvrir une session d’assistance" sous="sur son desktop, avec son accord" onClick={() => void enterOrganization(o.id)} />
            </div>
            {geste && (
              <FormGeste
                geste={geste}
                modules={cles.filter((k) => !etats[k]).map((k) => [k, catalogue.get(k)!.nom] as [string, string])}
                tous={[...catalogue.entries()].filter(([k]) => !cles.includes(k)).map(([k, v]) => [k, v.nom] as [string, string])}
                onValider={(cle, extra) => {
                  const base = { par: user?.email ?? '', depuis: new Date().toISOString(), raison: extra.raison || undefined };
                  if (geste === 'pause') void poserEtat(cle, { ...base, etat: 'pause' }, false);
                  if (geste === 'epingler') void poserEtat(cle, { ...base, etat: 'epinglee', version: extra.version || 'version actuelle' }, null);
                  if (geste === 'alternative' && extra.alternative) {
                    void bridge().remote.admin.setOrganizationModule(o.id, extra.alternative, true).catch(() => undefined);
                    void poserEtat(cle, { ...base, etat: 'alternative', alternative: extra.alternative }, null);
                  }
                  setGeste(null);
                }}
                onAnnuler={() => setGeste(null)}
              />
            )}
            {message && (
              <p className="mt-3 text-[12.5px] text-text-body" role="alert">
                {message}
              </p>
            )}
          </Carte>
          <Carte titre={`Demandes et incidents${attend.length ? ` · ${attend.length}` : ''}`}>
            {attend.length === 0 ? (
              <p className="text-[13px] text-text-secondary">Aucune demande ni incident ouvert.</p>
            ) : (
              attend.map((x) => <Ligne key={x.cle} colonnes="78px minmax(0,1fr) auto" a={LIBELLE_TYPE[x.type]} b={x.phrase} c={ilYA(x.depuis, m.maintenant).replace('il y a ', '')} lien="/supervisor/a-traiter" />)
            )}
            {parcours.length > 0 && (
              <div className="mt-4">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-text-muted">Bugs chez elle seule</span>
                {parcours.map((p) => {
                  const station = STATIONS_BUG.find((s) => !p.stations[s.cle]);
                  return (
                    <Ligne
                      key={p.id}
                      colonnes="78px minmax(0,1fr) auto"
                      a={p.incidentId ?? 'bug'}
                      b={`${catalogue.get(p.module)?.nom ?? p.module} · ${p.titre}`}
                      c={station ? NOMS_STATIONS[station.cle] : 'clos'}
                      lien={`/supervisor/bug/${p.id}`}
                    />
                  );
                })}
              </div>
            )}
            <div className="mt-4">
              <Link to={`/supervisor/bug/nouveau?org=${o.id}`} className="bx-lien">
                Un bug chez elle seule
              </Link>
            </div>
          </Carte>
        </div>
        <div className="flex flex-col gap-[18px]">
          <Carte titre={`Les personnes${personnes ? ` · ${actifs.length} / ${places ?? '∞'}` : ''}`}>
            {personnes === null ? (
              <Chargement texte="Les comptes" />
            ) : personnes.length === 0 ? (
              <p className="text-[13px] text-text-secondary">Aucun compte encore.</p>
            ) : (
              personnes.map((p) => (
                <div key={p.id} className="flex items-center gap-3 border-b border-[#1a1a1a] py-2.5">
                  <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-[#2b2b2b] font-mono text-[9px] font-semibold text-text-body">{initiales(prenomDe(p.email))}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-text-primary">{p.email}</span>
                    <span className="block text-[11.5px] text-text-muted">{ROLES[p.role] ?? p.role}</span>
                  </span>
                  <span className="font-mono text-[10.5px] text-text-muted">{p.status === 'invited' ? 'invitée' : p.status === 'suspended' ? 'suspendue' : p.joinedAt ? ilYA(p.joinedAt, m.maintenant).replace('il y a ', '') : ''}</span>
                </div>
              ))
            )}
          </Carte>
          <Carte titre="Notes internes" droite="visibles de l’équipe seule">
            {(dossier.notes ?? []).length === 0 && <p className="text-[13px] text-text-secondary">Pas encore de note.</p>}
            {[...(dossier.notes ?? [])].reverse().slice(0, 4).map((n) => (
              <div key={n.id} className="mb-3">
                <p className="border-l border-border-strong bg-raised px-3.5 py-2.5 text-[13px] leading-relaxed text-text-body">{n.texte}</p>
                <span className="mt-1.5 block font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-muted">
                  {nomDe(n.par)} · {moisLong(n.at).split(' ')[0] === moisLong(new Date()).split(' ')[0] ? hhmm(n.at) : moisLong(n.at)}
                </span>
              </div>
            ))}
            {dossier.body && <p className="mb-3 whitespace-pre-line text-[12.5px] text-text-secondary">{dossier.body}</p>}
            <div className="mt-2 flex gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ajouterNote()} placeholder="Une note pour l’équipe…" aria-label="Une note pour l’équipe" className="h-9 min-w-0 flex-1 border border-[#2b2b2b] bg-transparent px-3 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-[#8a8a87]" />
              <button type="button" className="bx-btn2" disabled={!note.trim()} onClick={ajouterNote}>
                Noter
              </button>
            </div>
          </Carte>
          <Carte titre="Les échanges" droite={(dossier.echanges ?? []).length > 4 ? 'les 4 derniers' : ''}>
            {(dossier.echanges ?? []).length === 0 ? (
              <p className="text-[13px] text-text-secondary">Aucun échange noté.</p>
            ) : (
              [...(dossier.echanges ?? [])]
                .sort((a, b) => b.at.localeCompare(a.at))
                .slice(0, 4)
                .map((x) => <Ligne key={x.id} a={`${x.at.slice(8, 10)}/${x.at.slice(5, 7)}`} b={x.resume} c={prenomDe(x.par).slice(0, 2).toUpperCase()} />)
            )}
          </Carte>
        </div>
      </div>
    </>
  );
}

const stripId = (d: DossierOrg) => {
  const { id: _id, updatedAt: _u, ...reste } = d as DossierOrg & { id?: string; updatedAt?: string };
  return reste;
};

/*
  LA LISTE DES MODULES, CHERCHABLE ET REPLIABLE.

  Une cliente peut avoir tout le catalogue ouvert : cent vingt tuiles à faire
  défiler pour trouver celle qui est en pause, c'était plusieurs secondes de
  molette. On cherche par le nom, on filtre par état, et les familles se
  replient : repliées d'office quand la liste est longue, SAUF celles où un
  module a un état pour elle — c'est ce qu'on vient voir dans un dossier.
*/
type FiltreModules = 'tous' | 'etat' | 'pause' | 'actifs';
const REPLIER_AU_DELA = 24;

function ListeModules({ cles, ordreFamilles, etats, nomDe, tuile }: { cles: string[]; ordreFamilles: [string, string[]][]; etats: Record<string, EtatModuleSeule>; nomDe: (k: string) => string; tuile: (k: string) => React.ReactNode }) {
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState<FiltreModules>('tous');
  const [ouvertes, setOuvertes] = useState<Set<string> | null>(null);
  const plier = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const q = plier(recherche.trim());
  const garde = (k: string) =>
    (!q || plier(nomDe(k)).includes(q)) &&
    (filtre === 'tous' || (filtre === 'etat' && Boolean(etats[k])) || (filtre === 'pause' && etats[k]?.etat === 'pause') || (filtre === 'actifs' && !etats[k]));
  const familles = ordreFamilles.map(([f, liste]) => [f, liste.filter(garde)] as [string, string[]]).filter(([, l]) => l.length > 0);
  const visibles = familles.reduce((n, [, l]) => n + l.length, 0);
  const longue = cles.length > REPLIER_AU_DELA;
  // Par défaut : tout déplié si la liste est courte ; sinon seules les familles qui ont un module avec un état.
  const ouverteParDefaut = (liste: string[]) => !longue || liste.some((k) => etats[k]);
  const estOuverte = (f: string, liste: string[]) => Boolean(q) || filtre !== 'tous' || (ouvertes ? ouvertes.has(f) : ouverteParDefaut(liste));
  const basculer = (f: string) =>
    setOuvertes((prec) => {
      const suiv = new Set(prec ?? ordreFamilles.filter(([, l]) => ouverteParDefaut(l)).map(([ff]) => ff));
      if (suiv.has(f)) suiv.delete(f);
      else suiv.add(f);
      return suiv;
    });
  const compte = (f: FiltreModules) => cles.filter((k) => f === 'tous' || (f === 'etat' && etats[k]) || (f === 'pause' && etats[k]?.etat === 'pause') || (f === 'actifs' && !etats[k])).length;
  const FILTRES: [FiltreModules, string][] = [['tous', 'Tous'], ['etat', 'Avec un état pour elle'], ['pause', 'En pause'], ['actifs', 'Actifs']];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Chercher un module (« stock », « factures »…)"
          aria-label="Chercher un module de son espace"
          className="h-9 min-w-[220px] flex-1 border border-[#2b2b2b] bg-transparent px-3 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-[#8a8a87]"
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrer par état">
          {FILTRES.map(([f, nom]) => {
            const n = compte(f);
            if (f !== 'tous' && (n === 0 || n === cles.length)) return null;
            return (
              <button key={f} type="button" aria-pressed={filtre === f} onClick={() => setFiltre(f)} className="h-9 border px-2.5 text-[12px]" style={{ borderColor: filtre === f ? '#8a8a87' : '#2b2b2b', color: filtre === f ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', background: filtre === f ? '#1a1a1a' : 'transparent' }}>
                {nom} <span className="font-mono text-[10.5px] text-text-muted">{n}</span>
              </button>
            );
          })}
        </div>
        {longue && !q && filtre === 'tous' && (
          <span className="flex gap-3 text-[12px]">
            <button type="button" className="text-text-secondary underline decoration-trait-sourd underline-offset-4 hover:text-text-primary" onClick={() => setOuvertes(new Set(ordreFamilles.map(([f]) => f)))}>
              Tout déplier
            </button>
            <button type="button" className="text-text-secondary underline decoration-trait-sourd underline-offset-4 hover:text-text-primary" onClick={() => setOuvertes(new Set())}>
              Tout replier
            </button>
          </span>
        )}
      </div>
      {visibles === 0 ? (
        <p className="py-4 text-[13px] text-text-secondary">Aucun module de son espace ne correspond{q ? ` à « ${recherche.trim()} »` : ''}.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {familles.map(([famille, liste]) => {
            const ouverte = estOuverte(famille, ordreFamilles.find(([f]) => f === famille)![1]);
            const avecEtat = liste.filter((k) => etats[k]).length;
            return (
              <div key={famille} className="border-t border-[#1f1f1f] pt-2">
                <button type="button" aria-expanded={ouverte} onClick={() => basculer(famille)} className="flex w-full items-baseline gap-3 py-1 text-left" disabled={Boolean(q) || filtre !== 'tous'}>
                  <span className="w-3 font-mono text-[10px] text-text-muted" aria-hidden>
                    {ouverte ? '▾' : '▸'}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-secondary">{famille}</span>
                  <span className="font-mono text-[10px] text-text-muted">{liste.length}</span>
                  {avecEtat > 0 && <span className="font-mono text-[10px] text-text-body">· {avecEtat} avec un état</span>}
                </button>
                {ouverte && <div className="mt-2 grid grid-cols-2 gap-1.5 pb-2 sm:grid-cols-4">{liste.map((k) => tuile(k))}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TuileModule({ nom, etat, alt, onReactiver }: { nom: string; etat: EtatModuleSeule | null; alt: string | null; onReactiver: () => void }) {
  const pause = etat?.etat === 'pause';
  return (
    <div
      className="min-h-[58px] px-3 py-2.5"
      title={etat?.raison ? `Pour elle : ${etat.raison}` : undefined}
      style={{
        background: pause ? '#111' : 'var(--color-surface-hover)',
        border: pause ? '1px dashed #4a4a48' : '1px solid #252525',
        backgroundImage: pause ? 'repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 1px, transparent 1px 7px)' : undefined,
      }}
    >
      <span className="block truncate text-[12.5px] font-semibold" style={{ color: pause ? 'var(--color-text-secondary)' : 'var(--color-text-primary)' }}>{nom}</span>
      <span className="mt-1.5 block font-mono text-[9.5px] uppercase leading-snug tracking-[0.12em] text-text-muted">
        {!etat && 'actif'}
        {pause && '‖ en pause pour elle'}
        {etat?.etat === 'epinglee' && `⌖ ${etat.version} épinglée`}
        {etat?.etat === 'alternative' && `⇄ ${alt ?? 'alternative'}, temporaire`}
      </span>
      {etat && (
        <button type="button" onClick={onReactiver} className="mt-1 text-[11px] font-semibold text-text-body underline decoration-trait-sourd underline-offset-2">
          {pause ? 'Réactiver pour elle' : 'Retirer'}
        </button>
      )}
    </div>
  );
}

function GesteDossier({ titre, sous, onClick, actif = false }: { titre: string; sous: string; onClick: () => void; actif?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={actif} className="border px-3.5 py-2 text-left hover:border-trait-sourd" style={{ borderColor: actif ? '#8a8a87' : '#2b2b2b', background: actif ? '#1a1a1a' : 'transparent' }}>
      <span className="block text-[12.5px] font-semibold text-text-primary">{titre}</span>
      <span className="block text-[11.5px] text-text-muted">{sous}</span>
    </button>
  );
}

function FormGeste({ geste, modules, tous, onValider, onAnnuler }: { geste: Exclude<Geste, null>; modules: [string, string][]; tous: [string, string][]; onValider: (cle: string, extra: { raison: string; version: string; alternative: string }) => void; onAnnuler: () => void }) {
  const [cle, setCle] = useState(modules[0]?.[0] ?? '');
  const [raison, setRaison] = useState('');
  const [version, setVersion] = useState('');
  const [alternative, setAlternative] = useState(tous[0]?.[0] ?? '');
  const champ = 'h-9 border border-[#2b2b2b] bg-raised px-2.5 text-[13px] text-text-primary outline-none focus:border-[#8a8a87]';
  return (
    <div className="mt-4 border border-[#2b2b2b] bg-[#0f0f0f] p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <select value={cle} onChange={(e) => setCle(e.target.value)} className={champ} aria-label="Le module">
          {modules.map(([k, n]) => (
            <option key={k} value={k}>
              {n}
            </option>
          ))}
        </select>
        {geste === 'epingler' && <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v3.1" aria-label="La version épinglée" className={`${champ} w-24`} />}
        {geste === 'alternative' && (
          <select value={alternative} onChange={(e) => setAlternative(e.target.value)} className={champ} aria-label="Le module proposé à la place">
            {tous.map(([k, n]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </select>
        )}
        <input value={raison} onChange={(e) => setRaison(e.target.value)} placeholder="Pourquoi, pour elle" aria-label="La raison" className={`${champ} min-w-0 flex-1`} />
      </div>
      <p className="mt-2.5 text-[12px] leading-relaxed text-text-muted">
        {geste === 'pause' && 'Le module se ferme chez elle seule ; ses données restent. Il se rouvre d’un geste, ici.'}
        {geste === 'epingler' && 'La version est notée au dossier et suivie par l’équipe produit ; le serveur ne sert pas encore une version ancienne d’un module automatiquement.'}
        {geste === 'alternative' && 'Le module proposé s’ouvre chez elle seule, le temps que l’autre soit réparé.'}
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" className="bx-btn" disabled={!cle || (geste === 'alternative' && !alternative)} onClick={() => onValider(cle, { raison, version, alternative })}>
          {geste === 'pause' ? 'Mettre en pause pour elle' : geste === 'epingler' ? 'Épingler' : 'Proposer'}
        </button>
        <button type="button" className="bx-btn2" onClick={onAnnuler}>
          Annuler
        </button>
      </div>
    </div>
  );
}
