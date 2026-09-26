import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useCollection, useSync } from '../../state/SyncContext';
import { useProfilesOptionnel } from '../../state/ProfilesContext';
import { bridge } from '../../lib/bridge';
import { garde } from '../../lib/garde';
import { AMBRE } from '../jetons';
import { Carte, Chargement, EnTete } from '../ui/kit';
import { hhmm, jourLong, prenomDe } from '../format';

/**
 * CYBER · LE JOURNAL D'AUDIT — la bande d'activité (cahier 13, `47f`).
 *
 * Avant la liste, une bande par personne (et la Garde) : une case par heure
 * où elle a agi sur les 24 dernières heures. Une heure inhabituelle se voit
 * avant de lire une ligne. Dessous, le journal : heure, qui, quoi, sur quel
 * objet ; filtrable, exportable en CSV signé (une empreinte SHA-256 du
 * contenu, en pied de fichier). Rien ne s'efface : le journal est écrit par
 * le serveur, et une relecture s'ajoute, elle ne retire rien.
 *
 * L'ambre : l'action hors horaires qui n'a pas encore été relue — sa case et
 * sa ligne.
 */

interface Entree {
  id: string;
  at: string;
  qui: string;
  garde: boolean;
  quoi: string;
  objet: string;
  assistance: boolean;
}

const HORAIRES = { de: 8, a: 20 };
const horsHoraires = (iso: string) => {
  const d = new Date(iso);
  const h = d.getHours();
  return h < HORAIRES.de || h >= HORAIRES.a || d.getDay() === 0 || d.getDay() === 6;
};
const ACTIONS: Record<string, [string, string]> = {
  enter: ['Session d’assistance ouverte chez', 'ASSISTANCE'],
  leave: ['Session d’assistance close chez', 'ASSISTANCE'],
  suspend: ['Organisation suspendue :', 'ORGANISATION'],
  reactivate: ['Organisation réactivée :', 'ORGANISATION'],
  invite: ['Invitation envoyée chez', 'COMPTES'],
  password: ['Mot de passe réinitialisé chez', 'COMPTES'],
};
type Filtre = 'tout' | 'humains' | 'garde' | 'hors' | 'assistance';

export function CyberJournalAudit() {
  const { user } = useAuth();
  const { upsert } = useSync();
  const profils = useProfilesOptionnel();
  const relus = useCollection<{ par?: string }>('suivis');
  const [entrees, setEntrees] = useState<Entree[] | null>(null);
  const [filtre, setFiltre] = useState<Filtre>('tout');
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    const depuis = new Date(Date.now() - 86_400_000).toISOString();
    Promise.allSettled([bridge().remote.admin.accessLog({ limit: 500 }), garde.journal({ since: depuis, limit: 2000 })]).then(([acces, g]) => {
      if (!vivant) return;
      const r: Entree[] = [];
      if (acces.status === 'fulfilled') {
        for (const a of acces.value) {
          const [verbe, objet] = ACTIONS[a.action] ?? [a.action, 'ORGANISATION'];
          r.push({ id: `acces:${a.id}`, at: a.createdAt, qui: a.actorEmail, garde: false, quoi: `${verbe} ${a.orgName}${a.detail ? ` — ${a.detail}` : ''}`, objet, assistance: a.action === 'enter' || a.action === 'leave' });
        }
      }
      if (g.status === 'fulfilled') {
        for (const e of g.value) r.push({ id: `garde:${e.id}`, at: e.createdAt, qui: 'La Garde', garde: true, quoi: e.pourquoi || e.action, objet: e.equipe.toUpperCase(), assistance: false });
      }
      if (acces.status === 'rejected' && g.status === 'rejected') setErreur('Le journal n’a pas répondu.');
      setEntrees(r.sort((a, b) => b.at.localeCompare(a.at)));
    });
    return () => {
      vivant = false;
    };
  }, []);

  const lu = useMemo(() => new Set(relus.filter((s) => s.id.startsWith('relu:')).map((s) => s.id.slice(5))), [relus]);
  const aRelire = useMemo(() => (entrees ?? []).filter((e) => !e.garde && horsHoraires(e.at) && !lu.has(e.id)), [entrees, lu]);
  const ambre = aRelire[0] ?? null;

  if (!entrees) {
    return (
      <>
        <EnTete surtitre="Cyber · Journal d’audit" titre="Le journal se lit." />
        <Chargement texte="Lecture du journal du serveur et de la Garde" />
      </>
    );
  }

  const nom = (e: Entree) => (e.garde ? 'La Garde' : profils?.profileFor(e.qui).name?.split(' ')[0] || prenomDe(e.qui));
  const personnes = [...new Set(entrees.filter((e) => !e.garde).map((e) => e.qui))];
  const debut = Date.now() - 24 * 3_600_000;
  const heureDe = (iso: string) => Math.floor((Date.parse(iso) - debut) / 3_600_000);
  const bande = (liste: Entree[]) => {
    const cases = Array.from({ length: 24 }, () => 0);
    for (const e of liste) {
      const h = heureDe(e.at);
      if (h >= 0 && h < 24) cases[h] += 1;
    }
    return cases;
  };
  const filtres: Record<Filtre, (e: Entree) => boolean> = {
    tout: () => true,
    humains: (e) => !e.garde,
    garde: (e) => e.garde,
    hors: (e) => !e.garde && horsHoraires(e.at),
    assistance: (e) => e.assistance,
  };
  const liste = entrees.filter(filtres[filtre]).slice(0, 60);
  const exporter = async () => {
    const lignes = [['date', 'qui', 'quoi', 'objet'], ...entrees.filter(filtres[filtre]).map((e) => [e.at, e.garde ? 'La Garde' : e.qui, e.quoi, e.objet])];
    const csv = lignes.map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\n');
    const octets = new TextEncoder().encode(csv);
    const empreinte = [...new Uint8Array(await crypto.subtle.digest('SHA-256', octets))].map((b) => b.toString(16).padStart(2, '0')).join('');
    const fichier = `${csv}\n# empreinte SHA-256 du contenu ci-dessus : ${empreinte}\n# exporté par ${user?.email ?? '—'} le ${new Date().toISOString()}\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([fichier], { type: 'text/csv;charset=utf-8' }));
    a.download = `journal-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const relire = (e: Entree) => void upsert('suivis', `relu:${e.id}`, { par: user?.email ?? '', at: new Date().toISOString() });
  const hier = new Date(debut);

  return (
    <>
      <EnTete
        surtitre="Cyber · Journal d’audit"
        titre={ambre ? `${aRelire.length > 1 ? `${aRelire.length} actions hors horaires` : 'Une action hors horaires'}, ${new Date(ambre.at).getHours() >= 20 || new Date(ambre.at).getHours() < 6 ? 'cette nuit' : 'à relire'}.` : erreur ? erreur : 'Rien d’inhabituel sur 24 heures.'}
      />
      <Carte dominante pad="p-6" titre={`Qui a fait quoi · ${jourLong(hier)} ${hier.getDate()} → ${jourLong(new Date())} ${new Date().getDate()}`} droite="une case par heure active">
        <div className="flex flex-col gap-2">
          {[...personnes.map((p) => ({ cle: p, nom: profils?.profileFor(p).name?.split(' ')[0] || prenomDe(p), liste: entrees.filter((e) => e.qui === p) })), { cle: 'garde', nom: 'La Garde', liste: entrees.filter((e) => e.garde) }].map((b) => (
            <div key={b.cle} className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-3">
              <span className="flex items-center gap-2 text-[12.5px] font-semibold text-text-body">
                <span className="flex h-[20px] w-[20px] items-center justify-center border border-[#2b3030] font-mono text-[8.5px] text-text-secondary">{b.cle === 'garde' ? 'G' : b.nom.slice(0, 2).toUpperCase()}</span>
                {b.nom}
              </span>
              <span className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[3px]">
                {bande(b.liste).map((n, h) => {
                  const estAmbre = ambre && b.cle === ambre.qui && heureDe(ambre.at) === h;
                  return <span key={h} title={n ? `${n} action${n > 1 ? 's' : ''} vers ${String(new Date(debut + h * 3_600_000).getHours()).padStart(2, '0')} h` : undefined} className="h-[18px]" style={{ background: estAmbre ? AMBRE : n ? (b.cle === 'garde' ? '#3a3f3f' : '#6b7070') : '#161919' }} data-signal-groupe={estAmbre ? 'journal-ambre' : undefined} />;
                })}
              </span>
            </div>
          ))}
          <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 font-mono text-[9.5px] text-text-muted">
            <span />
            <span className="flex justify-between">
              {[0, 6, 12, 18, 23].map((h) => (
                <span key={h}>{String(new Date(debut + h * 3_600_000).getHours()).padStart(2, '0')}</span>
              ))}
            </span>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#1d2121] pt-4">
          {(
            [
              ['tout', 'Tout'],
              ['humains', 'Humains'],
              ['garde', 'La Garde'],
              ['hors', 'Hors horaires'],
              ['assistance', 'Sessions d’assistance'],
            ] as [Filtre, string][]
          ).map(([f, l]) => (
            <button key={f} type="button" aria-pressed={filtre === f} onClick={() => setFiltre(f)} className="h-8 border px-3 font-mono text-[12px] font-semibold" style={{ borderColor: filtre === f ? '#8a8a87' : '#2b3030', color: filtre === f ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
              {l} · {entrees.filter(filtres[f]).length}
            </button>
          ))}
          <button type="button" className="bx-btn2 ml-auto" onClick={() => void exporter()}>
            Exporter · CSV signé
          </button>
        </div>
        <div className="mt-3">
          {liste.length === 0 && <p className="py-6 text-[13px] text-text-secondary">Rien dans ce filtre.</p>}
          {liste.map((e) => {
            const estAmbre = ambre?.id === e.id;
            return (
              <div key={e.id} className="grid grid-cols-[64px_34px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#171a1a] px-2 py-2.5" style={estAmbre ? { background: 'rgba(208,154,74,.06)', boxShadow: `inset 2px 0 0 ${AMBRE}` } : undefined} data-signal-groupe={estAmbre ? 'journal-ambre' : undefined}>
                <span className="font-mono text-[11px] tabular-nums text-text-secondary">{hhmm(e.at)}</span>
                <span className="flex h-[20px] w-[20px] items-center justify-center rounded-full bg-[#1d2121] font-mono text-[8.5px] text-text-body">{e.garde ? 'G' : nom(e).slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0 truncate text-[13px] text-text-body">
                  {e.quoi}
                  {estAmbre && (
                    <>
                      <span className="ml-2 font-mono text-[9.5px] font-bold tracking-[0.12em]" style={{ color: AMBRE }}>
                        · HORS HORAIRES, À RELIRE
                      </span>
                      <button type="button" onClick={() => relire(e)} className="ml-3 text-[11.5px] font-semibold text-text-primary underline decoration-trait-sourd underline-offset-2">
                        Relu
                      </button>
                    </>
                  )}
                </span>
                <span className="font-mono text-[9.5px] tracking-[0.12em] text-text-muted">{e.objet}</span>
              </div>
            );
          })}
        </div>
      </Carte>
    </>
  );
}
