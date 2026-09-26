import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { garde } from '../../lib/garde';
import { AMBRE, ROUGE } from '../jetons';
import { CRANS, DELAI_ALERTE_MS, useCyber, type AlerteCyber, type GraviteAlerte } from '../donnees/cyber';
import { useSourceBureaux } from '../donnees/source';
import { Carte, Chargement, EnTete, Stat } from '../ui/kit';
import { UserAvatar } from '../../components/UserAvatar';
import { duree, hhmm } from '../format';
import { EcranVide } from '../../components/EtatEcran';

/**
 * CYBER · ALERTES — le tamis (cahier 13, `47b`).
 *
 * À gauche, ce qui a été filtré avant d'arriver ici, sur 24 h : événements
 * reçus → réglés par la Garde → alertes ouvertes → devenues incidents, à
 * l'échelle logarithmique pour que les petits nombres restent visibles. À
 * droite, les alertes triées par gravité puis par délai. L'ambre : l'alerte
 * haute sans personne dont le délai tombe le plus tôt. Le rouge : la jauge et
 * l'étiquette de l'incident critique.
 */

type Filtre = 'toutes' | 'personne' | 'moi' | 'haute';
const MONTREES = 8;

export function CyberAlertes() {
  const c = useCyber();
  const src = useSourceBureaux();
  const { user } = useAuth();
  const moi = user?.email?.toLowerCase() ?? '';
  const [filtre, setFiltre] = useState<Filtre>('toutes');
  const [tout, setTout] = useState(false);
  const [tamis, setTamis] = useState<{ recus: number; regles: number; plafond: boolean } | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    garde
      .journal({ since: new Date(Date.now() - 86_400_000).toISOString(), limit: 5000 })
      .then((j) => vivant && setTamis({ recus: j.length, regles: j.filter((x) => x.resultat === 'regle').length, plafond: j.length >= 5000 }))
      .catch(() => vivant && setTamis(null));
    return () => {
      vivant = false;
    };
  }, []);

  if (!c.pret) {
    return (
      <>
        <EnTete surtitre="Cyber · Alertes" titre="Le tamis se remplit." />
        <Chargement texte="Lecture des alertes de la Garde" />
      </>
    );
  }

  const filtres: Record<Filtre, (a: AlerteCyber) => boolean> = {
    toutes: () => true,
    personne: (a) => !a.qui,
    moi: (a) => (a.qui ?? '').toLowerCase() === moi,
    haute: (a) => CRANS[a.gravite] >= 3,
  };
  const liste = c.alertes.filter(filtres[filtre]);
  const montrees = tout ? liste : liste.slice(0, MONTREES);
  const idRouge = montrees.find((a) => a.gravite === 'critique' && c.rouge?.id === a.orgId)?.id ?? null;
  const ambre = c.alerteAmbre;
  const incidents24 = src.incidents.filter((i) => Date.now() - Date.parse(i.firstSeenAt) < 86_400_000).length;
  const vide = c.alertes.length === 0;
  const prendre = async (a: AlerteCyber) => {
    setEnCours(a.id);
    try {
      await garde.prendre(a.dossier.id, true);
      await src.recharger();
    } finally {
      setEnCours(null);
    }
  };

  return (
    <EcranVide quand={vide} premierJour={false}>
      <EnTete
        surtitre={`Cyber · Alertes${c.alertes.length ? ` · ${c.alertes.length} ouverte${c.alertes.length > 1 ? 's' : ''}` : ''}`}
        titre={ambre ? `${ambre.orgNom} : ${ambre.titre.replace(/\.$/, '').replace(/^./, (x) => x.toLowerCase())}, et personne dessus.` : vide ? 'Aucune alerte ouverte : la Garde a tout réglé.' : 'Chaque alerte haute a quelqu’un.'}
        largeurTitre="44ch"
      />
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <Carte titre="Le tamis · 24 h" className="self-start">
          <Tamis
            etages={[
              ['Événements reçus · 24 h', tamis?.recus ?? null],
              ['Réglés par la Garde', tamis?.regles ?? null],
              ['Alertes ouvertes', c.alertes.length],
              ['Devenues incidents', incidents24],
            ]}
          />
          <p className="mt-4 border-t border-[#1d2121] pt-3 text-[12px] leading-relaxed text-text-secondary">
            La largeur est à l’échelle logarithmique : sinon les petits nombres seraient invisibles sous les grands.{tamis?.plafond ? ' Le journal compte au moins ce nombre d’événements.' : ''}
          </p>
        </Carte>
        <Carte dominante pad="p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {(
              [
                ['toutes', 'Toutes'],
                ['personne', 'Personne'],
                ['moi', 'Moi'],
                ['haute', 'Haute et plus'],
              ] as [Filtre, string][]
            ).map(([f, l]) => {
              const n = c.alertes.filter(filtres[f]).length;
              return (
                <button key={f} type="button" aria-pressed={filtre === f} onClick={() => setFiltre(f)} className="flex h-8 items-center gap-2 border px-3 font-mono text-[12px] font-semibold" style={{ borderColor: filtre === f ? '#8a8a87' : '#2b3030', color: filtre === f ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                  {l}
                  {n > 0 && <span className="text-[10.5px] font-medium text-text-secondary">{n}</span>}
                </button>
              );
            })}
            <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">Tri : gravité, puis délai</span>
          </div>
          {liste.length === 0 ? (
            <p className="py-8 text-[13px] text-text-secondary">{vide ? 'Rien d’ouvert : tout ce que la Garde a vu, elle l’a réglé.' : 'Aucune alerte dans ce filtre.'}</p>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#212525] font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">
                  <th className="py-2.5 pl-3 font-normal">Gravité</th>
                  <th className="py-2.5 font-normal">Organisation · alerte</th>
                  <th className="py-2.5 font-normal">Qui</th>
                  <th className="py-2.5 font-normal">Statut</th>
                  <th className="py-2.5 pr-3 font-normal">Délai</th>
                </tr>
              </thead>
              <tbody>
                {montrees.map((a) => {
                  const estAmbre = ambre?.id === a.id;
                  // Le rouge, une fois : la première alerte critique de l'organisation au critique — sa jauge et son étiquette.
                  const rouge = a.id === idRouge;
                  return (
                    <tr key={a.id} className="border-b border-[#171a1a]" style={estAmbre ? { background: 'rgba(208,154,74,.06)', boxShadow: `inset 2px 0 0 ${AMBRE}` } : undefined} data-signal-groupe={estAmbre ? 'alerte-ambre' : undefined} data-critique-groupe={rouge ? 'alerte-critique' : undefined}>
                      <td className="py-3.5 pl-3">
                        <Jauge gravite={a.gravite} rouge={rouge} />
                      </td>
                      <td className="max-w-[260px] py-3.5">
                        <Link to="/garde/pile" className="block truncate text-[13.5px] font-semibold text-text-primary hover:underline">
                          {a.orgNom}
                        </Link>
                        <span className="block truncate text-[12px] text-text-muted">{a.titre}</span>
                      </td>
                      <td className="py-3.5">
                        {a.qui ? (
                          <UserAvatar email={a.qui} size={20} />
                        ) : (
                          <button type="button" disabled={enCours === a.id} onClick={() => void prendre(a)} className="font-mono text-[9.5px] font-semibold tracking-[0.14em] underline decoration-dotted underline-offset-4" style={{ color: estAmbre ? AMBRE : 'var(--color-text-body)' }} title="Me l’attribuer">
                            PERSONNE
                          </button>
                        )}
                      </td>
                      <td className="py-3.5">
                        <Statut a={a} rouge={rouge} />
                      </td>
                      <td className="whitespace-nowrap py-3.5 pr-3 font-mono text-[11.5px] font-semibold tabular-nums" style={{ color: estAmbre ? AMBRE : 'var(--color-text-body)' }}>
                        {a.qui && a.dossier.prisLe ? `pris à ${hhmm(a.dossier.prisLe)}` : a.resteMs >= 0 ? `reste ${duree(a.resteMs)}` : `dépassé de ${duree(a.resteMs)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!tout && liste.length > MONTREES && (
            <button type="button" onClick={() => setTout(true)} className="mt-3 text-[12px] text-text-secondary hover:text-text-primary">
              + {liste.length - MONTREES} alerte{liste.length - MONTREES > 1 ? 's' : ''} plus loin
            </button>
          )}
        </Carte>
      </div>
      <div className="mt-[18px]">
        <Carte pad="p-5">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {(['critique', 'haute', 'moyenne', 'faible'] as GraviteAlerte[]).map((g) => (
              <Stat key={g} l={`Délai · ${g}`} v={duree(DELAI_ALERTE_MS[g])} />
            ))}
          </div>
        </Carte>
      </div>
    </EcranVide>
  );
}

function Tamis({ etages }: { etages: [string, number | null][] }) {
  const max = Math.max(1, ...etages.map(([, n]) => n ?? 0));
  const largeur = (n: number) => (n <= 0 ? 0 : Math.max(8, (Math.log10(n + 1) / Math.log10(max + 1)) * 100));
  return (
    <div className="flex flex-col gap-3.5">
      {etages.map(([nom, n]) => (
        <div key={nom}>
          <div className="flex h-[18px] justify-center">
            <span className="block h-full bg-[#2b3131]" style={{ width: `${n === null ? 0 : largeur(n)}%` }} />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-secondary">{nom}</span>
            <span className="font-mono text-[14px] font-semibold tabular-nums text-text-primary">{n === null ? '—' : n.toLocaleString('fr-FR')}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Jauge({ gravite, rouge }: { gravite: GraviteAlerte; rouge: boolean }) {
  const n = CRANS[gravite];
  return (
    <span className="flex gap-[3px]" aria-label={`gravité ${gravite}`}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className="h-[14px] w-[6px]" style={{ background: i <= n ? (rouge ? ROUGE.trait : '#8a8a87') : '#2b3030' }} />
      ))}
    </span>
  );
}

function Statut({ a, rouge }: { a: AlerteCyber; rouge: boolean }) {
  const texte = a.gravite === 'critique' ? 'INCIDENT' : a.qui ? 'EN COURS' : 'NOUVELLE';
  return (
    <span className="inline-block border px-1.5 py-[3px] font-mono text-[9.5px] font-semibold tracking-[0.1em]" style={rouge ? { borderColor: ROUGE.bordure, color: ROUGE.texte, background: ROUGE.fond } : { borderColor: '#2b3030', color: 'var(--color-text-secondary)' }}>
      {texte}
    </span>
  );
}
