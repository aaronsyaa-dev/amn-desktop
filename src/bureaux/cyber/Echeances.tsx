import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useSync } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import { useCyber, type Echeance } from '../donnees/cyber';
import { useSupervisor } from '../donnees/useSupervisor';
import { Carte, Chargement, EnTete, Ligne } from '../ui/kit';
import { jourCourt, jourLong } from '../format';
import { EcranVide } from '../../components/EtatEcran';

/**
 * CYBER · LE MONITEUR D'ÉCHÉANCES — la frise des 90 jours (cahier 13, `47e`).
 *
 * Une ligne par type d'échéance, un bâton par jour, haut du nombre
 * d'échéances de ce jour ; les quatorze premiers jours clairs, le reste
 * sourd. À droite de chaque ligne, la part qui se renouvelle seule : ce qui
 * compte, c'est l'autre. L'ambre : le bâton et la carte de la première
 * échéance qui ne se renouvellera pas sans quelqu'un.
 */

const LIGNES: { cle: Echeance['type']; nom: string }[] = [
  { cle: 'certificat', nom: 'Certificats' },
  { cle: 'domaine', nom: 'Domaines' },
  { cle: 'licence', nom: 'Licences' },
  { cle: 'renouvellement', nom: 'Renouvellements' },
  { cle: 'secret', nom: 'Secrets à faire tourner' },
];
const JOURS = 90;

export function CyberEcheances() {
  const c = useCyber();
  const sup = useSupervisor();
  const { user } = useAuth();
  const { upsert } = useSync();
  const [prevenu, setPrevenu] = useState<string | null>(null);
  if (!c.pret) return <Chargement texte="Lecture des échéances" />;
  const frise = c.echeances.filter((e) => e.jours >= 0 && e.jours < JOURS);
  const manuelles = frise.filter((e) => !e.renouvelleSeul);
  const premiere = manuelles.sort((a, b) => a.jours - b.jours)[0] ?? null;
  const max = Math.max(1, ...LIGNES.flatMap((l) => Array.from({ length: JOURS }, (_, j) => frise.filter((e) => e.type === l.cle && e.jours === j).length)));
  const proches = c.echeancesProches;
  const vide = frise.length === 0;
  const prevenir = (e: Echeance) => {
    const o = e.orgId ? sup.orgs.find((x) => x.id === e.orgId) : null;
    const pour = o?.suivi.type === 'humain' ? o.suivi.email : user?.email ?? '';
    void upsert('tasks', `echeance-${e.id}`, { title: `Prévenir ${e.orgNom} : ${e.quoi}`, detail: `Échéance le ${jourCourt(e.date).toLowerCase()} — ne se renouvelle pas sans quelqu’un.`, assigneeEmail: pour, status: 'todo', siteId: null, clientId: null, createdAt: new Date().toISOString() });
    setPrevenu(e.id);
  };
  const aujourdHui = new Date();
  return (
    <EcranVide quand={vide} premierJour={vide}>
      <EnTete surtitre="Cyber · Échéances · 90 jours" titre={vide ? 'Aucune échéance dans les trois mois.' : `${frise.length} échéance${frise.length > 1 ? 's' : ''} en trois mois, dont ${manuelles.length} à la main.`} />
      <Carte dominante pad="p-6" titre={`La frise · 90 jours · ${frise.length} échéance${frise.length > 1 ? 's' : ''}`} droite={`hauteur à l’échelle du jour le plus chargé (${max}) · clair = sous 14 jours`}>
        <div className="grid grid-cols-[170px_minmax(0,1fr)_70px] gap-x-4">
          <span />
          <div className="relative mb-1.5 h-4 font-mono text-[9.5px] text-[#9a9a97]">
            <span className="absolute left-0 font-semibold text-[#e4e4e1]">AUJ. {String(aujourdHui.getDate()).padStart(2, '0')}/{String(aujourdHui.getMonth() + 1).padStart(2, '0')}</span>
            <span className="absolute" style={{ left: `${(14 / JOURS) * 100}%` }}>
              | 14 J
            </span>
            {[30, 60].map((j) => {
              const d = new Date(Date.now() + j * 86_400_000);
              return (
                <span key={j} className="absolute" style={{ left: `${(j / JOURS) * 100}%` }}>
                  {String(d.getDate()).padStart(2, '0')}/{String(d.getMonth() + 1).padStart(2, '0')}
                </span>
              );
            })}
          </div>
          <span />
          {LIGNES.map((l) => {
            const de = frise.filter((e) => e.type === l.cle);
            const auto = de.length ? Math.round((100 * de.filter((e) => e.renouvelleSeul).length) / de.length) : null;
            return (
              <React.Fragment key={l.cle}>
                <div className="border-b border-[#171a1a] py-3">
                  <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#a3a3a0]">{l.nom}</span>
                  <span className="mt-1 block font-mono text-[11px] text-[#e4e4e1]">{de.length ? `${de.length} · ${de.filter((e) => !e.renouvelleSeul).length} à la main` : '—'}</span>
                </div>
                <div className="flex items-end gap-px border-b border-[#171a1a] py-3" style={{ height: 52 }} role="img" aria-label={`${l.nom} : ${de.length} échéances sur 90 jours`}>
                  {Array.from({ length: JOURS }, (_, j) => {
                    const ce = de.filter((e) => e.jours === j);
                    const estAmbre = premiere && ce.some((e) => e.id === premiere.id);
                    return (
                      <span
                        key={j}
                        title={ce.length ? `${jourCourt(ce[0].date)} · ${ce.map((e) => e.quoi).join(', ')}` : undefined}
                        className="flex-1"
                        style={{ height: ce.length ? Math.max(4, (ce.length / max) * 26) : 1, background: estAmbre ? AMBRE : ce.length ? (j < 14 ? '#a3a3a0' : '#4a5050') : '#1d2121' }}
                        data-signal-groupe={estAmbre ? 'echeance-ambre' : undefined}
                      />
                    );
                  })}
                </div>
                <div className="flex items-end justify-end border-b border-[#171a1a] py-3 font-mono text-[11px] text-[#a3a3a0]">{auto === null ? '' : `${auto} % auto`}</div>
              </React.Fragment>
            );
          })}
        </div>
        {premiere && (
          <div className="mt-5 flex flex-wrap items-center gap-4 p-4" style={{ border: `1px solid ${AMBRE}`, background: 'rgba(208,154,74,.06)' }} data-signal-groupe="echeance-ambre">
            <div className="min-w-0 flex-1">
              <span className="block font-mono text-[9.5px] font-bold uppercase tracking-[0.18em]" style={{ color: AMBRE }}>
                La première qui ne se renouvelle pas seule
              </span>
              <span className="mt-1.5 block text-[14.5px] font-semibold text-[#f7f7f5]">
                {premiere.quoi} · {premiere.orgNom} · {premiere.jours <= 6 ? jourLong(premiere.date) : jourCourt(premiere.date).toLowerCase()} {premiere.jours <= 6 ? new Date(`${premiere.date}T12:00:00`).getDate() : ''}
              </span>
            </div>
            <button type="button" className="bx-btn2" disabled={prevenu === premiere.id} onClick={() => prevenir(premiere)}>
              {prevenu === premiere.id ? 'Tâche posée pour son suivi' : 'Prévenir la cliente'}
            </button>
          </div>
        )}
      </Carte>
      <div className="mt-[18px]">
        <Carte titre={`Sous 14 jours · ${proches.length}`} droite="triées par date">
          {proches.length === 0 && <p className="text-[13px] text-[#a3a3a0]">Rien dans les quatorze jours.</p>}
          {proches.slice(0, 8).map((e) => (
            <Ligne key={e.id} a={jourCourt(e.date)} b={`${e.quoi} · ${e.orgNom} · ${e.renouvelleSeul ? 'auto' : 'manuelle'}`} c={e.type === 'certificat' ? 'CERT.' : e.type.toUpperCase()} />
          ))}
          {proches.length > 8 && (
            <p className="mt-3 text-[12px] text-[#9a9a97]">
              + {proches.length - 8} échéance{proches.length - 8 > 1 ? 's' : ''}, dont {proches.slice(8).filter((e) => e.renouvelleSeul).length} se renouvellent seules
            </p>
          )}
        </Carte>
      </div>
    </EcranVide>
  );
}
