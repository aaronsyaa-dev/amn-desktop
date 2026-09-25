import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { uid, useCollection, useSync } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import { useCyber } from '../donnees/cyber';
import type { Secret } from '../donnees/types';
import { Carte, EnTete, Invitation } from '../ui/kit';
import { jourMois } from '../format';

/**
 * CYBER · LA ROTATION DES SECRETS (cahier 15, `51c` · 07).
 *
 * Les clés et mots de passe techniques de chaque cliente, et la date où
 * chacun doit tourner. Ce module ne garde JAMAIS un secret : son nom, son
 * genre, la date de sa dernière rotation et sa période. La valeur reste dans
 * le coffre où elle vit.
 *
 * L'ambre : le secret le plus en retard sur sa rotation.
 */

type S = Secret & { id: string };
const GENRES = ['Clé d’API', 'Mot de passe technique', 'Jeton de déploiement', 'Clé SSH', 'Certificat client'];

export function CyberSecrets() {
  const c = useCyber();
  const { user } = useAuth();
  const { upsert } = useSync();
  const secrets = useCollection<Secret>('rotationsSecrets') as S[];
  const [nouveau, setNouveau] = useState<{ orgId: string; nom: string; type: string; periodeJours: string; derniere: string } | null>(null);
  const maintenant = Date.now();
  const echeance = (s: S) => (s.derniereRotation ? Date.parse(s.derniereRotation) + s.periodeJours * 86_400_000 : null);
  const jours = (s: S) => {
    const e = echeance(s);
    return e === null ? null : Math.round((e - maintenant) / 86_400_000);
  };
  const tries = [...secrets].sort((a, b) => (jours(a) ?? -9999) - (jours(b) ?? -9999));
  const enRetard = tries.filter((s) => (jours(s) ?? -1) < 0);
  const ambre = enRetard[0] ?? null;
  const nom = (id: string) => c.orgs.find((o) => o.id === id)?.nom ?? 'une cliente';
  const tourne = (s: S) => {
    const { id, ...reste } = s;
    void upsert('rotationsSecrets', id, { ...reste, derniereRotation: new Date().toISOString(), par: user?.email ?? '' });
  };
  const titre = ambre
    ? `${ambre.nom} ${nom(ambre.orgId) ? `chez ${nom(ambre.orgId)}` : ''} devait tourner il y a ${-(jours(ambre) ?? 0)} jour${-(jours(ambre) ?? 0) > 1 ? 's' : ''}.`
    : secrets.length
      ? 'Chaque secret a tourné à temps.'
      : 'Aucun secret suivi.';
  const champ = 'h-9 border border-[#212525] bg-transparent px-2.5 text-[13px] text-[#f7f7f5] outline-none placeholder:text-[#9a9a97] focus:border-[#8a8a87]';

  return (
    <>
      <EnTete
        surtitre="Cyber · Échéances · Rotation des secrets"
        titre={titre}
        lede="Le nom, le genre, la date : jamais la valeur. Un secret vit dans le coffre ; ici, on suit quand il doit tourner."
        actions={
          <button type="button" className="bx-btn2" onClick={() => setNouveau({ orgId: c.orgs[0]?.id ?? '', nom: '', type: GENRES[0], periodeJours: '90', derniere: new Date().toISOString().slice(0, 10) })}>
            Suivre un secret
          </button>
        }
      />
      {nouveau && (
        <Carte pad="p-5" className="mb-[18px]" titre="Suivre un secret" droite="sans sa valeur">
          <form
            className="grid grid-cols-1 gap-2 md:grid-cols-[200px_minmax(0,1fr)_190px_110px_150px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              const p = Number(nouveau.periodeJours);
              if (!nouveau.orgId || !nouveau.nom.trim() || !(p > 0)) return;
              void upsert('rotationsSecrets', `sec-${uid()}`, { orgId: nouveau.orgId, nom: nouveau.nom.trim(), type: nouveau.type, periodeJours: Math.round(p), derniereRotation: nouveau.derniere ? `${nouveau.derniere}T12:00:00.000Z` : null, par: user?.email ?? '' });
              setNouveau(null);
            }}
          >
            <select value={nouveau.orgId} onChange={(e) => setNouveau({ ...nouveau, orgId: e.target.value })} aria-label="La cliente" className={`${champ} bg-[#0f1111]`}>
              {c.orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nom}
                </option>
              ))}
            </select>
            <input value={nouveau.nom} onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })} placeholder="« Clé d’API du paiement »" aria-label="Le nom" className={champ} />
            <select value={nouveau.type} onChange={(e) => setNouveau({ ...nouveau, type: e.target.value })} aria-label="Le genre" className={`${champ} bg-[#0f1111]`}>
              {GENRES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
            <input value={nouveau.periodeJours} onChange={(e) => setNouveau({ ...nouveau, periodeJours: e.target.value })} inputMode="numeric" aria-label="Tous les … jours" className={`${champ} font-mono`} />
            <input type="date" value={nouveau.derniere} onChange={(e) => setNouveau({ ...nouveau, derniere: e.target.value })} aria-label="Dernière rotation" className={`${champ} [color-scheme:dark]`} />
            <button type="submit" className="bx-btn">
              Suivre
            </button>
          </form>
        </Carte>
      )}
      {secrets.length === 0 ? (
        <Invitation titre="Aucun secret suivi." texte="Les clés d’API, mots de passe techniques et jetons de chaque cliente, avec leur période de rotation. Jamais leur valeur." />
      ) : (
        <Carte dominante pad="p-6" titre={`Les secrets · ${secrets.length}`} droite="barre = la période écoulée depuis la dernière rotation">
          {tries.map((s) => {
            const j = jours(s);
            const estAmbre = ambre?.id === s.id;
            const ecoule = s.derniereRotation ? Math.min(1.2, (maintenant - Date.parse(s.derniereRotation)) / (s.periodeJours * 86_400_000)) : 1.2;
            return (
              <div key={s.id} className="grid grid-cols-[minmax(0,1fr)_200px_150px_auto] items-center gap-4 border-b border-[#1d2121] py-3" style={estAmbre ? { boxShadow: `inset 2px 0 0 ${AMBRE}`, paddingLeft: 10, background: 'rgba(208,154,74,.05)' } : undefined} data-signal-groupe={estAmbre ? 'secret-ambre' : undefined}>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-[#f7f7f5]">{s.nom}</span>
                  <span className="block truncate text-[12px] text-[#a3a3a0]">
                    {nom(s.orgId)} · {s.type} · tous les {s.periodeJours} jours
                  </span>
                </span>
                <span className="relative h-[8px] bg-[#1d2121]" aria-hidden>
                  <span className="block h-full" style={{ width: `${Math.min(100, (ecoule / 1.2) * 100)}%`, background: estAmbre ? AMBRE : ecoule >= 1 ? '#bdbdb9' : '#6b7070' }} />
                  <span className="absolute -bottom-1 -top-1 w-px bg-[#f7f7f5]" style={{ left: `${(1 / 1.2) * 100}%` }} />
                </span>
                <span className="font-mono text-[11px] tabular-nums" style={{ color: estAmbre ? AMBRE : '#a3a3a0' }}>
                  {j === null ? 'jamais tourné' : j < 0 ? `en retard de ${-j} j` : `dans ${j} j`}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-[#9a9a97]">{s.derniereRotation ? `le ${jourMois(s.derniereRotation)}` : ''}</span>
                  <button type="button" className="bx-lien" onClick={() => tourne(s)}>
                    Tourné aujourd’hui
                  </button>
                </span>
              </div>
            );
          })}
        </Carte>
      )}
    </>
  );
}
