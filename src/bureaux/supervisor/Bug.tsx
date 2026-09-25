import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useCollection, useSync } from '../../state/SyncContext';
import { useProfilesOptionnel } from '../../state/ProfilesContext';
import { bridge } from '../../lib/bridge';
import { NAV_SECTIONS } from '../../data/navigation';
import { AMBRE } from '../jetons';
import { useSupervisor } from '../donnees/useSupervisor';
import { useSourceBureaux } from '../donnees/source';
import { STATIONS_BUG, type DossierOrg, type ParcoursBug, type StationBug } from '../donnees/types';
import { Carte, EnTete, Stat } from '../ui/kit';
import { hhmm, prenomDe } from '../format';

/**
 * SUPERVISOR · UN BUG CHEZ UN SEUL CLIENT — la voie isolée (cahier 12, `46g`).
 *
 * En haut, la voie commune : le module pour toutes les autres organisations,
 * qui NE S'ARRÊTE JAMAIS. Au signalement, la cliente la quitte pour une voie
 * isolée où se succèdent les sept stations ; elle la rejoint à la clôture,
 * après 48 h sans rechute. La correction part pour toutes (trait pointillé
 * vers la voie commune) ; la réactivation ne rouvre le module que chez elle.
 * Les sept stations sont au centre de sept colonnes égales, `(i + 0,5) / 7`,
 * et leurs libellés dans ces mêmes colonnes. L'ambre : la station en cours
 * et le tronçon qu'elle occupe.
 *
 * Les gestes sont réels : la pause ferme le module chez elle seule (et le
 * note à son dossier), la réactivation le rouvre chez elle seule.
 */

type Parcours = ParcoursBug & { id: string };
const DESCRIPTIONS: Record<StationBug, (p: Parcours, nomModule: string, orgNom: string) => string> = {
  signalement: (p) => p.message ? 'depuis son desktop' : 'signalé à l’équipe',
  fiche: (p, _m, o) => `${p.incidentId ?? 'fiche'}, rattachée à ${o}`,
  protection: (p, m) => (p.protection === 'epinglee' ? `${m} épinglé en ${p.version ?? 'version antérieure'}` : `${m} en pause chez elle seule`),
  message: () => 'la cliente est prévenue',
  correction: (p) => (p.version ? `${p.version} en recette` : 'en cours'),
  reactivation: (_p, m) => `${m} rouvert chez elle`,
  cloture: () => 'après 48 h sans rechute',
};
const NOMS: Record<StationBug, string> = { signalement: 'Signalement', fiche: 'Fiche incident', protection: 'Pause pour elle', message: 'Message', correction: 'Correction', reactivation: 'Réactivation', cloture: 'Clôture' };

const nomModule = (cle: string) => NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.key === cle)?.label ?? cle;

export function SupervisorBug() {
  const { id = '' } = useParams();
  if (id === 'nouveau') return <NouveauParcours />;
  return <Parcours id={id} />;
}

function NouveauParcours() {
  const [params] = useSearchParams();
  const orgId = params.get('org') ?? '';
  const src = useSourceBureaux();
  const { user } = useAuth();
  const { upsert } = useSync();
  const navigate = useNavigate();
  const org = src.organisations.find((o) => o.id === orgId) ?? null;
  const modules = (org?.modules ?? org?.formula?.modules ?? NAV_SECTIONS.filter((s) => (s.space ?? 'workspace') === 'workspace').flatMap((s) => s.items.map((i) => i.key))).filter((k) => nomModule(k) !== k);
  const [module, setModule] = useState(modules[0] ?? '');
  const [titre, setTitre] = useState('');
  const [cause, setCause] = useState('');
  const [gravite, setGravite] = useState<ParcoursBug['gravite']>('moyenne');
  if (!org) return <EnTete surtitre="Supervisor · Dossiers clients" titre="Ouvrez le parcours depuis le dossier d’une cliente." />;
  const creer = async () => {
    const maintenant = new Date().toISOString();
    const pid = `bug-${Date.now().toString(36)}`;
    const numero = `INC-${String(Date.now()).slice(-4)}`;
    await upsert('parcoursBugs', pid, {
      orgId: org.id,
      module,
      titre: titre.trim(),
      cause: cause.trim() || undefined,
      gravite,
      stations: { signalement: maintenant, fiche: maintenant },
      touchees: 1,
      suiviPar: user?.email ?? '',
      ouvertLe: maintenant,
      incidentId: numero,
    } satisfies ParcoursBug);
    navigate(`/supervisor/bug/${pid}`);
  };
  const champ = 'h-10 border border-[#2b2b2b] bg-[#141414] px-3 text-[13.5px] text-[#f7f7f5] outline-none focus:border-[#8a8a87]';
  return (
    <>
      <EnTete surtitre={`Supervisor · Dossiers clients · ${org.name}`} titre={`Un bug chez ${org.name} seule`} lede="Le module continue pour toutes les autres organisations. Chez elle seule, il passe par sept stations : de la fiche à la clôture." />
      <Carte dominante pad="p-7">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[12px] text-[#a3a3a0]">
            Le module
            <select value={module} onChange={(e) => setModule(e.target.value)} className={champ}>
              {modules.map((k) => (
                <option key={k} value={k}>
                  {nomModule(k)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] text-[#a3a3a0]">
            La gravité
            <select value={gravite} onChange={(e) => setGravite(e.target.value as ParcoursBug['gravite'])} className={champ}>
              {(['faible', 'moyenne', 'haute', 'critique'] as const).map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] text-[#a3a3a0] md:col-span-2">
            Ce qui se passe, chez elle
            <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Stock refuse l’import du fichier de la cliente" className={champ} />
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] text-[#a3a3a0] md:col-span-2">
            La cause, si on la connaît
            <input value={cause} onChange={(e) => setCause(e.target.value)} placeholder="Une colonne avec des décimales à la virgule…" className={champ} />
          </label>
        </div>
        <div className="mt-5 flex gap-2.5">
          <button type="button" className="bx-btn" disabled={!module || !titre.trim()} onClick={() => void creer()}>
            Ouvrir le parcours
          </button>
          <Link to={`/supervisor/dossiers/${org.id}`} className="bx-btn2">
            Retour au dossier
          </Link>
        </div>
      </Carte>
    </>
  );
}

function Parcours({ id }: { id: string }) {
  const liste = useCollection<ParcoursBug>('parcoursBugs');
  const p = liste.find((x) => x.id === id) as Parcours | undefined;
  const m = useSupervisor();
  const src = useSourceBureaux();
  const { user } = useAuth();
  const { upsert } = useSync();
  const profils = useProfilesOptionnel();
  const [etat, setEtat] = useState<string | null>(null);
  const [version, setVersion] = useState('');
  const org = p ? src.organisations.find((o) => o.id === p.orgId) ?? null : null;
  const dossier: DossierOrg = (p && m.dossiers.get(p.orgId)) || {};
  const nomMod = p ? nomModule(p.module) : '';
  const autres = Math.max(0, src.organisations.length - 1);
  const courante = useMemo(() => (p ? STATIONS_BUG.find((s) => !p.stations[s.cle])?.cle ?? null : null), [p]);
  const [message, setMessage] = useState<string | null>(null);

  if (!p) return <EnTete surtitre="Supervisor · Dossiers clients" titre="Ce parcours n’existe pas, ou plus." />;
  const orgNom = org?.name ?? 'la cliente';
  const prenomContact = dossier.contact?.nom?.split(' ')[0] ?? null;
  const texte = message ?? `Bonjour${prenomContact ? ` ${prenomContact}` : ''},\n\n${p.titre}${p.cause ? ` : ${p.cause.charAt(0).toLowerCase()}${p.cause.slice(1)}` : ''}. Nous avons mis le module ${nomMod} en pause chez vous le temps de corriger, pour qu’aucune donnée ne soit abîmée ; vos autres modules fonctionnent normalement. Nous vous écrivons dès qu’il est rouvert.\n\n${prenomDe(user?.email)}, équipe AMN`;

  const faire = async (station: StationBug, extra: Partial<ParcoursBug> = {}, geste?: () => Promise<unknown>) => {
    try {
      if (geste) await geste();
      const { id: _id, ...reste } = p;
      await upsert('parcoursBugs', p.id, { ...reste, ...extra, stations: { ...p.stations, [station]: new Date().toISOString() } });
      setEtat(null);
    } catch (e) {
      setEtat(e instanceof Error ? e.message : 'Refusé par le serveur.');
    }
  };
  const poserDossier = async (etatModule: 'pause' | null) => {
    const modules = { ...(dossier.modules ?? {}) };
    if (etatModule) modules[p.module] = { etat: 'pause', raison: p.titre, par: user?.email ?? '', depuis: new Date().toISOString() };
    else delete modules[p.module];
    const { id: _i, ...reste } = dossier as DossierOrg & { id?: string };
    await upsert('orgDossier', p.orgId, { ...reste, modules });
  };
  const reactive = p.stations.reactivation ? Date.parse(p.stations.reactivation) : null;
  const clotureOuverte = reactive !== null && Date.now() - reactive >= 48 * 3_600_000;
  const depuis = p.stations.protection ? Math.max(1, Math.round((Date.now() - Date.parse(p.stations.protection)) / 86_400_000)) : null;
  const titre = p.stations.cloture
    ? `${nomMod} a rejoint la voie commune chez ${orgNom}.`
    : p.stations.reactivation
      ? `${nomMod} est rouvert chez elle ; clôture après 48 h sans rechute.`
      : p.stations.protection
        ? `${nomMod} est ${p.protection === 'epinglee' ? 'épinglé' : 'en pause'} chez elle seule, depuis ${depuis && depuis > 1 ? `${depuis === 2 ? 'deux' : depuis} jours` : 'aujourd’hui'}`
        : `${nomMod} ne va pas chez ${orgNom}. Les autres ne voient rien.`;

  return (
    <>
      <EnTete surtitre={`Supervisor · Dossiers clients · ${orgNom} · ${p.incidentId ?? ''}`} titre={titre} />
      <Carte dominante pad="p-7" titre={`Le parcours · ${p.incidentId ?? ''} · ${nomMod}, ${p.titre.toLowerCase()}`} droite="la voie commune ne s’arrête jamais">
        <Voie p={p} courante={courante} nomModule={nomMod} autres={autres} orgNom={orgNom} />
        <ol className="mt-2 grid grid-cols-7 gap-0" aria-label="Les sept stations">
          {STATIONS_BUG.map((s) => {
            const fait = p.stations[s.cle];
            const enCours = courante === s.cle;
            return (
              <li key={s.cle} className="px-1.5 text-center" data-signal-groupe={enCours ? 'bug-station' : undefined}>
                <span className="block text-[13px] font-semibold" style={{ color: enCours ? AMBRE : fait ? '#f7f7f5' : '#a3a3a0' }}>{NOMS[s.cle]}</span>
                <span className="mt-1 block font-mono text-[10px] tabular-nums text-[#a3a3a0]">{fait ? `${fait.slice(8, 10)}/${fait.slice(5, 7)} · ${hhmm(fait)}` : s.cle === 'cloture' ? 'après 48 h' : 'à venir'}</span>
                <span className="mt-1 block text-[11.5px] leading-snug text-[#9a9a97]">{DESCRIPTIONS[s.cle](p, nomMod, orgNom)}</span>
              </li>
            );
          })}
        </ol>
        {courante && (
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[#1f1f1f] pt-5">
            <span className="text-[13px] text-[#e4e4e1]">Station en cours : {NOMS[courante]}.</span>
            {courante === 'protection' && (
              <>
                <button type="button" className="bx-btn" onClick={() => void faire('protection', { protection: 'pause' }, async () => { await bridge().remote.admin.setOrganizationModule(p.orgId, p.module, false); await poserDossier('pause'); })}>
                  Mettre {nomMod} en pause pour elle
                </button>
                <button type="button" className="bx-btn2" onClick={() => void faire('protection', { protection: 'epinglee', version: 'version antérieure' })}>
                  Épingler la version d’avant
                </button>
              </>
            )}
            {courante === 'message' && (
              <button type="button" className="bx-btn" onClick={() => void faire('message', { message: texte }, async () => navigator.clipboard?.writeText(texte).catch(() => undefined))}>
                Copier le message et le marquer envoyé
              </button>
            )}
            {courante === 'correction' && (
              <>
                <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v4.2.1" aria-label="La version corrigée" className="h-9 w-28 border border-[#2b2b2b] bg-[#141414] px-3 text-[13px] text-[#f7f7f5] outline-none focus:border-[#8a8a87]" />
                <button type="button" className="bx-btn" disabled={!version.trim()} onClick={() => void faire('correction', { version: version.trim() })}>
                  Correction livrée pour toutes
                </button>
              </>
            )}
            {courante === 'reactivation' && (
              <button type="button" className="bx-btn" onClick={() => void faire('reactivation', {}, async () => { if (p.protection !== 'epinglee') await bridge().remote.admin.setOrganizationModule(p.orgId, p.module, true); await poserDossier(null); })}>
                Rouvrir {nomMod} chez elle seule
              </button>
            )}
            {courante === 'cloture' && (
              <button type="button" className="bx-btn" disabled={!clotureOuverte} onClick={() => void faire('cloture')} title={clotureOuverte ? undefined : 'La clôture attend 48 h sans rechute après la réactivation.'}>
                {clotureOuverte ? 'Clore le parcours' : 'Clôture possible 48 h après la réactivation'}
              </button>
            )}
            {etat && (
              <span className="text-[12.5px] text-[#e4e4e1]" role="alert">
                {etat}
              </span>
            )}
          </div>
        )}
      </Carte>
      <div className="mt-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-2">
        <Carte titre="La carte d’incident" droite="composant réutilisable">
          <div className="border border-[#2b2b2b] bg-[#151515] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="border border-[#3a3a3a] px-1.5 py-[3px] font-mono text-[10px] font-semibold tracking-[0.1em] text-[#e4e4e1]">{p.incidentId}</span>
              <span className="border border-[#3a3a3a] px-1.5 py-[3px] font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[#e4e4e1]">{p.gravite}</span>
              <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-[#9a9a97]">ouvert {anciennete(p.ouvertLe)}</span>
            </div>
            <p className="mt-3 text-[15px] font-semibold text-[#f7f7f5]">{p.titre}</p>
            {p.cause && <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#a3a3a0]">{p.cause}</p>}
            <div className="mt-4 grid grid-cols-3 gap-4">
              <Stat l="Organisation" v={`${p.touchees ?? 1} / ${src.organisations.length || '—'}`} />
              <Stat l="Pour elle" v={p.stations.reactivation ? 'rouvert' : p.stations.protection ? (p.protection === 'epinglee' ? 'épinglé' : 'en pause') : 'actif'} />
              <Stat l="Suivi" v={p.suiviPar ? (profils?.profileFor(p.suiviPar).name?.split(' ')[0] || prenomDe(p.suiviPar)) : '—'} />
            </div>
          </div>
        </Carte>
        <Carte titre="Le message à la cliente" droite={p.stations.message ? `envoyé le ${p.stations.message.slice(8, 10)}/${p.stations.message.slice(5, 7)} à ${hhmm(p.stations.message)}` : 'à envoyer'}>
          <textarea
            value={p.message ?? texte}
            readOnly={Boolean(p.stations.message)}
            onChange={(e) => setMessage(e.target.value)}
            rows={9}
            aria-label="Le message à la cliente"
            className="bx-papier w-full resize-none p-4 text-[13.5px] leading-relaxed outline-none"
          />
        </Carte>
      </div>
    </>
  );
}

function anciennete(iso: string): string {
  const h = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 3_600_000));
  return h >= 24 ? `depuis ${Math.floor(h / 24)} j ${h % 24} h` : `depuis ${h} h`;
}

/** La voie : la commune en haut, l'isolée dessous, les sept stations à (i + 0,5) / 7. */
function Voie({ p, courante, nomModule, autres, orgNom }: { p: Parcours; courante: StationBug | null; nomModule: string; autres: number; orgNom: string }) {
  const X = (i: number) => ((i + 0.5) / 7) * 1000;
  const H = 150;
  const haut = 30;
  const bas = 120;
  const iCour = courante ? STATIONS_BUG.findIndex((s) => s.cle === courante) : 7;
  const faite = (i: number) => Boolean(p.stations[STATIONS_BUG[i].cle]);
  return (
    <div className="relative">
      <div className="mb-1 flex justify-between font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#9a9a97]">
        <span>
          {nomModule} · pour les {autres} autres organisations, sans interruption
        </span>
        {p.stations.correction && p.version && <span>correction {p.version} pour toutes</span>}
      </div>
      <svg viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none" className="block h-[150px] w-full" role="img" aria-label={`La voie commune continue ; ${orgNom} suit la voie isolée, station en cours : ${courante ?? 'aucune, parcours clos'}.`}>
        <line x1={0} y1={haut} x2={1000} y2={haut} stroke="#4a4a48" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {/* La sortie de la voie commune, au signalement. */}
        <path d={`M${X(0)} ${haut} C ${X(0) + 60} ${haut}, ${X(0) + 60} ${bas}, ${X(1) - 40} ${bas}`} fill="none" stroke="#e4e4e1" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {STATIONS_BUG.slice(1, 6).map((_, k) => {
          const i = k + 1;
          const suivant = i + 1;
          const plein = faite(i) && (suivant < 7 ? faite(suivant) || suivant === iCour : true);
          const ambre = suivant === iCour;
          return <line key={i} x1={X(i)} y1={bas} x2={X(suivant)} y2={bas} stroke={ambre ? AMBRE : plein ? '#e4e4e1' : '#4a4a48'} strokeWidth={ambre ? 3 : 2} strokeDasharray={plein || ambre ? undefined : '6 6'} vectorEffect="non-scaling-stroke" />;
        })}
        <line x1={X(1) - 40} y1={bas} x2={X(1)} y2={bas} stroke="#e4e4e1" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {/* Le retour sur la voie commune, à la clôture. */}
        <path d={`M${X(5)} ${bas} C ${X(6) - 30} ${bas}, ${X(6) - 30} ${haut}, ${X(6)} ${haut}`} fill="none" stroke={p.stations.cloture ? '#e4e4e1' : '#4a4a48'} strokeWidth={2} strokeDasharray={p.stations.cloture ? undefined : '6 6'} vectorEffect="non-scaling-stroke" />
        {/* La correction part pour toutes. */}
        <line x1={X(4)} y1={bas} x2={X(4)} y2={haut} stroke="#6b6b68" strokeWidth={1} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        {STATIONS_BUG.map((s, i) => {
          const y = i === 0 || i === 6 ? haut : bas;
          const fait = faite(i);
          const enCours = i === iCour;
          return <circle key={s.cle} cx={X(i)} cy={y} r={enCours ? 7 : 6} fill={enCours ? AMBRE : fait ? '#f7f7f5' : '#0f0f0f'} stroke={enCours ? AMBRE : fait ? '#f7f7f5' : '#8a8a87'} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#9a9a97]" style={{ paddingLeft: `${(1.5 / 7) * 100}%` }}>
        La voie isolée · {orgNom} seule
      </div>
    </div>
  );
}
