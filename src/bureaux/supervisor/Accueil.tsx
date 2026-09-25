import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useProfilesOptionnel } from '../../state/ProfilesContext';
import { useSync } from '../../state/SyncContext';
import { garde, deOrganisation } from '../../lib/garde';
import { useSupervisor, type ModeleSupervisor } from '../donnees/useSupervisor';
import { useSourceBureaux } from '../donnees/source';
import { LIBELLE_TYPE } from '../donnees/file';
import { HORIZON } from '../donnees/parc';
import { Carte, Chargement, EnTete, Erreur, Invitation, Ligne, LienFort, Paire } from '../ui/kit';
import { Horizon, Legende, nombreOrgs } from './Horizon';
import { enLettres, hhmm, ilYA, jourLong, jourMois, prenomDe } from '../format';
import { EcranVide } from '../../components/EtatEcran';

/**
 * SUPERVISOR · L'ACCUEIL — l'horizon (cahier 11 `45a`, cahier 12 `46a`, `46i`).
 *
 * Le titre nomme ce qui attend quelqu'un ; la phrase dit le reste du parc
 * dans le même ordre que l'horizon — le critique et qui le tient, la
 * première organisation sans personne, puis ce que la Garde règle seule.
 */
export function SupervisorAccueil() {
  const m = useSupervisor();
  const src = useSourceBureaux();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { upsert } = useSync();
  const profils = useProfilesOptionnel();
  const nom = (email: string | null | undefined) => (email ? profils?.profileFor(email).name?.split(' ')[0] || prenomDe(email) : '—');

  const vide = m.pret && m.orgs.length === 0;
  const prendre = (orgId: string) => {
    if (!user?.email) return;
    void upsert('suivis', `org:${orgId}`, { par: user.email, at: new Date().toISOString() });
  };

  const { titre, lede } = useMemo(() => phrases(m, nom), [m, profils]);
  const n = m.orgs.length;
  const maintenant = new Date(m.maintenant);
  const surtitre = n > HORIZON.toursMax ? `Supervisor · Mur de situation · ${n} organisations` : `Supervisor · ${jourLong(maintenant)} ${jourMois(maintenant)} · ${hhmm(maintenant)}`;

  if (!m.pret) {
    return (
      <>
        <EnTete accueil surtitre="Supervisor" titre="Le parc se pèse." lede="Chaque organisation est pesée par ce qui demande un humain : critiques, incidents, jetons de places, arrivées, demandes, alertes de la Garde." largeurTitre="14ch" />
        <Carte dominante titre="L’horizon · ce qui demande un humain, par organisation">
          <Chargement texte="Pesée des organisations" compte={src.organisations.length ? { n: 0, sur: src.organisations.length } : null} />
        </Carte>
      </>
    );
  }

  const contenu = (
    <>
      <Carte
        dominante
        pad="p-7"
        titre={n > HORIZON.toursMax ? `L’horizon · ${n} organisations` : 'L’horizon · ce qui demande un humain, par organisation'}
        droite={<BasculeVue vue="horizon" />}
      >
        <Horizon orgs={m.orgs} ambre={m.ambre} rouge={m.rouge} pret={m.pret} />
        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-[#1f1f1f] pt-5">
          <Legende rouge={Boolean(m.rouge)} />
          {m.ambre && (
            <span className="ml-auto flex gap-2.5">
              <Link to={`/supervisor/dossiers/${m.ambre.id}`} className="bx-btn2">
                Ouvrir le dossier
              </Link>
              <button type="button" className="bx-btn" onClick={() => prendre(m.ambre!.id)}>
                Prendre {m.ambre.nom}
              </button>
            </span>
          )}
        </div>
      </Carte>
      <div className="mt-[18px]">
        <Paire>
          <DepuisVotreVenue m={m} nom={nom} />
          <Carte titre={`À traiter · ${m.file.length}`} droite={m.file.length > 3 ? 'les trois premiers' : ''}>
            {m.file.length === 0 ? (
              <p className="text-[13px] text-[#a3a3a0]">Rien n’attend un humain. La Garde tient le reste.</p>
            ) : (
              m.file.slice(0, 3).map((x) => (
                <Ligne
                  key={x.cle}
                  colonnes="78px minmax(0,1fr) auto"
                  a={LIBELLE_TYPE[x.type]}
                  b={`${x.orgNom} : ${x.phrase}`}
                  c={x.qui ? prenomDe(x.qui).slice(0, 2).toUpperCase() : x.source.kind === 'dossier' ? 'GARDE' : ilYA(x.depuis, m.maintenant)}
                  lien="/supervisor/a-traiter"
                />
              ))
            )}
            <div className="mt-4">
              <LienFort to="/supervisor/a-traiter">Ouvrir la file</LienFort>
            </div>
          </Carte>
        </Paire>
      </div>
    </>
  );

  return (
    <EcranVide quand={vide} premierJour={vide}>
      <EnTete accueil surtitre={surtitre} titre={titre} lede={lede} largeurTitre="15ch" />
      {vide ? (
        <Carte dominante titre="L’horizon">
          <div className="flex h-[200px] items-end border-b border-[#2b2b2b]" aria-hidden />
          <div className="mt-6">
            <Invitation titre="Aucune organisation n’est encore suivie." texte="L’horizon se dresse dès la première organisation créée : une tour par cliente, haute de ce qui demande un humain." action={<Link to="/tour/generateur" className="bx-btn2">Créer une organisation</Link>} />
          </div>
        </Carte>
      ) : src.pannes.length && !src.organisations.length ? (
        <Erreur pannes={src.pannes} at={src.at} relancer={() => void src.recharger()} />
      ) : (
        <>
          {src.pannes.length > 0 && <Erreur pannes={src.pannes} at={src.at} relancer={() => void src.recharger()} />}
          {contenu}
        </>
      )}
    </EcranVide>
  );
}

export function BasculeVue({ vue }: { vue: 'horizon' | 'grille' }) {
  return (
    <span className="inline-flex border border-[#2b2b2b] normal-case tracking-normal" role="group" aria-label="Vue du mur de situation">
      <Link to="/supervisor" aria-current={vue === 'horizon' ? 'page' : undefined} className="px-3 py-1.5 font-sans text-[12px] font-semibold" style={vue === 'horizon' ? { background: '#f7f7f5', color: '#0a0a0a' } : { color: '#a3a3a0' }}>
        Horizon
      </Link>
      <Link to="/supervisor/grille" aria-current={vue === 'grille' ? 'page' : undefined} className="px-3 py-1.5 font-sans text-[12px] font-semibold" style={vue === 'grille' ? { background: '#f7f7f5', color: '#0a0a0a' } : { color: '#a3a3a0' }}>
        Grille
      </Link>
    </span>
  );
}

function phrases(m: ModeleSupervisor, nom: (e: string | null | undefined) => string): { titre: string; lede: string } {
  const n = m.orgs.length;
  if (!n) return { titre: 'L’horizon attend sa première organisation.', lede: 'Rien n’est encore suivi.' };
  const sp = m.sansPersonne;
  const morceaux: string[] = [];
  if (n > HORIZON.toursMax) {
    const humains = m.orgs.filter((o) => o.poids > 0 && (o.points.critique > 0 || o.suivi.type === 'personne' || o.poids >= HORIZON.poidsMin)).length;
    const petits = m.orgs.filter((o) => o.poids > 0).length - Math.min(humains, HORIZON.toursMax);
    const rien = m.orgs.filter((o) => o.poids === 0).length;
    morceaux.push(`${nombreOrgs(Math.min(humains, HORIZON.toursMax), true)} organisation${humains > 1 ? 's demandent' : ' demande'} un humain et ${humains > 1 ? 'ont leur' : 'a sa'} tour.`);
    if (petits > 0) morceaux.push(`${nombreOrgs(petits, true)} ${petits > 1 ? 'ont' : 'a'} de petits points que la Garde ne règle pas seule.`);
    if (rien > 0) morceaux.push(`${nombreOrgs(rien, true)} ne demande${rien > 1 ? 'nt' : ''} rien.`);
  } else {
    morceaux.push(`${nombreOrgs(n, true)} organisation${n > 1 ? 's' : ''} sous surveillance.`);
    if (m.rouge?.critique) {
      morceaux.push(
        m.rouge.critique.prisPar
          ? `${m.rouge.nom} est critique, mais ${nom(m.rouge.critique.prisPar)} la tient${m.rouge.critique.depuis ? ` depuis ${hhmm(m.rouge.critique.depuis)}` : ''}.`
          : `${m.rouge.nom} est critique, et personne ne la tient encore.`,
      );
    }
    if (m.ambre) {
      const ouverts = Object.values(m.ambre.points).reduce((s, x) => s + x, 0);
      morceaux.push(`${m.ambre.nom} a ${enLettres(ouverts)} chose${ouverts > 1 ? 's' : ''} ouverte${ouverts > 1 ? 's' : ''} et personne pour les suivre.`);
    }
    const seules = m.orgs.filter((o) => o.suivi.type === 'garde' || o.suivi.type === 'rien').length;
    if (seules > 0 && seules < n) morceaux.push(`Les ${enLettres(seules)} de droite ne demandent rien que la Garde ne règle seule.`);
    else if (seules === n) morceaux.push('Rien ne demande un humain que la Garde ne règle seule.');
  }
  let titre: string;
  if (sp.length === 1 && m.ambre) titre = `${m.ambre.nom} attend quelqu’un.`;
  else if (sp.length > 1 && m.ambre) titre = `${enLettres(sp.length, true)} organisations n’ont personne. ${m.ambre.nom} d’abord.`;
  else if (m.rouge?.critique && !m.rouge.critique.prisPar) titre = `${m.rouge.nom} est critique, et personne ne la tient.`;
  else if (m.file.length) titre = 'Chaque organisation a quelqu’un.';
  else titre = 'Le parc est calme.';
  return { titre, lede: morceaux.join(' ') };
}

/* ── « Depuis votre dernière venue » ─────────────────────────────────── */

const CLE_VENUE = 'amn.supervisor.venue';

function DepuisVotreVenue({ m, nom }: { m: ModeleSupervisor; nom: (e: string | null | undefined) => string }) {
  const src = useSourceBureaux();
  const [venue] = useState<number>(() => {
    try {
      const v = Number(window.localStorage.getItem(CLE_VENUE));
      return Number.isFinite(v) && v > 0 ? v : Date.now() - 86_400_000;
    } catch {
      return Date.now() - 86_400_000;
    }
  });
  // La venue d'aujourd'hui devient la « dernière venue » de la prochaine fois.
  useEffect(() => () => {
    try {
      window.localStorage.setItem(CLE_VENUE, String(Date.now()));
    } catch {
      /* rien */
    }
  }, []);
  const [reglees, setReglees] = useState<{ n: number; derniere: string | null } | null>(null);
  useEffect(() => {
    let vivant = true;
    garde
      .journal({ since: new Date(venue).toISOString(), limit: 1000 })
      .then((j) => {
        if (!vivant) return;
        const r = j.filter((x) => x.resultat === 'regle');
        setReglees({ n: r.length, derniere: r[0]?.createdAt ?? null });
      })
      .catch(() => vivant && setReglees(null));
    return () => {
      vivant = false;
    };
  }, [venue]);

  const faits = useMemo(() => {
    const f: { at: string; texte: string; qui: string }[] = [];
    for (const o of src.organisations) if (Date.parse(o.createdAt) > venue) f.push({ at: o.createdAt, texte: `${o.name} a rejoint le parc.`, qui: '' });
    for (const d of src.accueil?.pile.dossiers ?? []) {
      if (d.prisPar && d.prisLe && Date.parse(d.prisLe) > venue) f.push({ at: d.prisLe, texte: `${nom(d.prisPar)} a pris le dossier${d.gravite === 'critique' ? ' critique' : ''}${d.orgNom ? ` ${deOrganisation(d.orgNom)}` : ''}.`, qui: d.prisPar });
    }
    for (const s of m.suivis) {
      if (s.par && s.at && !s.relache && Date.parse(s.at) > venue && s.id.startsWith('org:')) {
        const o = src.organisations.find((x) => x.id === s.id.slice(4));
        if (o) f.push({ at: s.at, texte: `${nom(s.par)} suit désormais ${o.name}.`, qui: s.par });
      }
    }
    if (reglees && reglees.n > 0) f.push({ at: reglees.derniere ?? new Date().toISOString(), texte: `La Garde a réglé ${reglees.n} alerte${reglees.n > 1 ? 's' : ''} sans vous.`, qui: 'GARDE' });
    return f.sort((a, b) => a.at.localeCompare(b.at)).slice(-5);
  }, [src.organisations, src.accueil, m.suivis, reglees, venue]);

  const hier = new Date(venue);
  return (
    <Carte titre="Depuis votre dernière venue" droite={`${new Date().getDate() !== hier.getDate() ? 'hier ' : ''}${hhmm(hier)}`}>
      {faits.length === 0 ? (
        <p className="text-[13px] text-[#a3a3a0]">Rien n’a bougé depuis {hhmm(hier)}.</p>
      ) : (
        faits.map((x, i) => <Ligne key={i} a={hhmm(x.at)} b={x.texte} c={x.qui === 'GARDE' ? 'GARDE' : x.qui ? prenomDe(x.qui).slice(0, 2).toUpperCase() : ''} />)
      )}
    </Carte>
  );
}
