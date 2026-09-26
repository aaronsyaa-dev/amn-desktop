import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { uid } from '../../state/SyncContext';
import { AMBRE } from '../jetons';
import { useStrategie } from '../donnees/strategie';
import type { Publication } from '../donnees/types';
import { Carte, EnTete } from '../ui/kit';
import { enLettresF, moisLong } from '../format';
import { aujourdHui, champ, useEcrire } from './commun';

/**
 * STRATÉGIE · LE CALENDRIER ÉDITORIAL (cahier 14, `49c`).
 *
 * Le mois en colonnes, les canaux en lignes : une case pleine est une
 * publication faite, une case cerclée une publication programmée, une case
 * vide un jour sans rien. On voit d'un coup les trous et les doublons.
 *
 * L'ambre : la publication du jour qui attend une validation — sa case et sa
 * carte (une seule région). Une publication à valider d'un jour passé attend
 * aussi : c'est alors la plus ancienne qui prend l'ambre.
 */

type Canal = Publication['canal'];
type Pub = Publication & { id: string };

const CANAUX: { cle: Canal; nom: string }[] = [
  { cle: 'LI', nom: 'LinkedIn' },
  { cle: 'IG', nom: 'Instagram' },
  { cle: 'FB', nom: 'Facebook' },
  { cle: 'NL', nom: 'Lettre' },
  { cle: 'YT', nom: 'YouTube' },
  { cle: 'TT', nom: 'TikTok' },
];
const PAR_DEFAUT: Canal[] = ['LI', 'IG', 'FB', 'NL'];
const nomCanal = (c: Canal) => CANAUX.find((x) => x.cle === c)?.nom ?? c;

export function StrategieCalendrier() {
  const m = useStrategie();
  const { user } = useAuth();
  const ecrire = useEcrire<Publication>('publications');
  const [params, setParams] = useSearchParams();
  const [nouvelle, setNouvelle] = useState<{ jour: string; canal: Canal; titre: string; heure: string; etat: Publication['etat'] } | null>(null);
  const auj = aujourdHui();
  const mois = /^\d{4}-\d{2}$/.test(params.get('m') ?? '') ? params.get('m')! : auj.slice(0, 7);
  const [a, mo] = mois.split('-').map(Number);
  const nbJours = new Date(a, mo, 0).getDate();
  const jours = Array.from({ length: nbJours }, (_, i) => `${mois}-${String(i + 1).padStart(2, '0')}`);
  const pubs = m.publications.filter((p) => p.jour.startsWith(mois)) as Pub[];
  const canaux = CANAUX.filter((c) => PAR_DEFAUT.includes(c.cle) || pubs.some((p) => p.canal === c.cle));
  const attente = (m.publications as Pub[]).filter((p) => p.etat === 'a_valider' && p.jour <= auj).sort((x, y) => x.jour.localeCompare(y.jour) || (x.heure ?? '').localeCompare(y.heure ?? ''));
  const ambre = attente[0] ?? null;
  const decale = (n: number) => {
    const d = new Date(a, mo - 1 + n, 1);
    setParams({ m: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }, { replace: true });
  };
  const valider = (p: Pub) => ecrire(p.id, () => ({ etat: p.jour < auj ? 'publiee' : 'programmee' }));

  const titre = ambre
    ? attente.length > 1
      ? `${enLettresF(attente.length, true)} publications attendent votre accord.`
      : `Une publication attend votre accord${ambre.jour === auj && ambre.heure ? ` avant ${ambre.heure}` : ambre.jour < auj ? ', depuis le ' + Number(ambre.jour.slice(8, 10)) : ''}.`
    : pubs.length
      ? `${enLettresF(pubs.length, true)} publication${pubs.length > 1 ? 's' : ''} en ${moisLong(`${mois}-01`).split(' ')[0]}, rien n’attend votre accord.`
      : `Rien de prévu en ${moisLong(`${mois}-01`).split(' ')[0]}.`;

  // Ce qui marche, par canal : la moyenne des publications faites qui ont leur chiffre.
  const marche = canaux
    .map((c) => {
      const v = pubs.filter((p) => p.canal === c.cle && p.etat === 'publiee' && typeof p.engagement === 'number').map((p) => p.engagement!);
      return { c, moyenne: v.length ? v.reduce((s, x) => s + x, 0) / v.length : null };
    })
    .filter((x) => x.moyenne !== null);

  const trous = trousDuMois(pubs, canaux.map((c) => c.cle), jours, auj);

  return (
    <>
      <EnTete
        surtitre="Stratégie · Calendrier éditorial"
        titre={titre}
        actions={
          <>
            <button type="button" className="bx-btn2" onClick={() => decale(-1)} aria-label="Le mois précédent">
              ←
            </button>
            <button type="button" className="bx-btn2" onClick={() => decale(1)} aria-label="Le mois suivant">
              →
            </button>
            <button type="button" className="bx-btn2" onClick={() => setNouvelle({ jour: auj, canal: 'LI', titre: '', heure: '18:00', etat: 'a_valider' })}>
              Programmer une publication
            </button>
          </>
        }
      />
      {nouvelle && (
        <Carte pad="p-5" className="mb-[18px]" titre="Une publication" droite="« à valider » tant que le texte ou l’image n’ont pas votre accord">
          <form
            className="grid grid-cols-2 gap-2 md:grid-cols-[150px_150px_minmax(0,1fr)_100px_150px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              if (!nouvelle.titre.trim()) return;
              ecrire(`pub-${uid()}`, () => ({ jour: nouvelle.jour, canal: nouvelle.canal, titre: nouvelle.titre.trim(), heure: nouvelle.heure || null, etat: nouvelle.etat, par: user?.email ?? '' }));
              setNouvelle(null);
            }}
          >
            <input type="date" value={nouvelle.jour} onChange={(e) => setNouvelle({ ...nouvelle, jour: e.target.value })} aria-label="Le jour" className={`${champ} h-9 [color-scheme:dark]`} />
            <select value={nouvelle.canal} onChange={(e) => setNouvelle({ ...nouvelle, canal: e.target.value as Canal })} aria-label="Le canal" className={`${champ} h-9 bg-[#141416]`}>
              {CANAUX.map((c) => (
                <option key={c.cle} value={c.cle}>
                  {c.nom}
                </option>
              ))}
            </select>
            <input autoFocus value={nouvelle.titre} onChange={(e) => setNouvelle({ ...nouvelle, titre: e.target.value })} placeholder="Ce qu’on publie…" aria-label="Le titre" className={`${champ} col-span-2 h-9 md:col-span-1`} />
            <input type="time" value={nouvelle.heure} onChange={(e) => setNouvelle({ ...nouvelle, heure: e.target.value })} aria-label="L’heure" className={`${champ} h-9 [color-scheme:dark]`} />
            <select value={nouvelle.etat} onChange={(e) => setNouvelle({ ...nouvelle, etat: e.target.value as Publication['etat'] })} aria-label="L’état" className={`${champ} h-9 bg-[#141416]`}>
              <option value="a_valider">à valider</option>
              <option value="programmee">programmée</option>
              <option value="publiee">publiée</option>
            </select>
            <span className="flex gap-2">
              <button type="submit" className="bx-btn" disabled={!nouvelle.titre.trim()}>
                Poser
              </button>
              <button type="button" className="bx-btn2" onClick={() => setNouvelle(null)}>
                Annuler
              </button>
            </span>
          </form>
        </Carte>
      )}

      <Carte dominante pad="p-6" titre={`${moisLong(`${mois}-01`).split(' ')[0]} · ${canaux.length} canaux · ${pubs.length} publication${pubs.length > 1 ? 's' : ''}`} droite="plein = publiée · cerclée = programmée">
        <div className="overflow-x-auto">
          <table className="w-full border-separate" style={{ borderSpacing: '3px' }}>
            <thead>
              <tr>
                <th className="w-[92px]" />
                {jours.map((j) => (
                  <th key={j} scope="col" className="text-center font-mono text-[9.5px] font-medium tabular-nums" style={{ color: j === auj ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontWeight: j === auj ? 700 : 400 }}>
                    {Number(j.slice(8))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {canaux.map((c) => (
                <tr key={c.cle}>
                  <th scope="row" className="pr-2 text-left font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] text-text-secondary">
                    {c.nom}
                  </th>
                  {jours.map((j) => {
                    const ici = pubs.filter((p) => p.canal === c.cle && p.jour === j);
                    const p = ici[0] ?? null;
                    const estAmbre = Boolean(p && ambre && ici.some((x) => x.id === ambre.id));
                    const style: React.CSSProperties = estAmbre
                      ? { background: AMBRE, boxShadow: '0 0 18px -4px rgba(208,154,74,.8)' }
                      : !p
                        ? { background: j === auj ? '#1b1b1e' : 'transparent', border: j === auj ? '1px solid #3a3a40' : undefined }
                        : p.etat === 'publiee'
                          ? { background: '#44444a' }
                          : { border: `1px ${p.etat === 'a_valider' ? 'dashed' : 'solid'} var(--color-text-secondary)` };
                    return (
                      <td key={j} className="p-0">
                        <span
                          className="relative mx-auto block aspect-square w-full max-w-[26px]"
                          style={style}
                          title={ici.length ? ici.map((x) => `${x.titre} · ${x.etat === 'publiee' ? 'publiée' : x.etat === 'programmee' ? `programmée${x.heure ? ` à ${x.heure}` : ''}` : 'à valider'}`).join('\n') : undefined}
                          aria-label={ici.length ? `${nomCanal(c.cle)}, le ${Number(j.slice(8))} : ${ici.map((x) => x.titre).join(', ')}` : undefined}
                          data-signal-groupe={estAmbre ? 'calendrier-ambre' : undefined}
                        >
                          {ici.length > 1 && <span className="absolute -right-1 -top-1 font-mono text-[8.5px] font-bold text-text-primary">{ici.length}</span>}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ambre && (
          <div className="mt-5 flex flex-wrap items-center gap-5 px-4 py-4" style={{ border: `1px solid ${AMBRE}`, background: 'rgba(208,154,74,.07)' }} data-signal-groupe="calendrier-ambre">
            <div className="min-w-0 flex-1">
              <span className="block font-mono text-[9.5px] font-bold uppercase tracking-[0.14em]" style={{ color: AMBRE }}>
                {ambre.jour === auj ? 'Aujourd’hui' : `Depuis le ${Number(ambre.jour.slice(8))}`} · {nomCanal(ambre.canal)} · à valider
              </span>
              <span className="mt-1.5 block text-[15px] font-semibold text-text-primary">« {ambre.titre} »</span>
              <span className="mt-1 block text-[12.5px] text-text-secondary">
                {ambre.heure ? `Programmée à ${ambre.heure}. ` : ''}
                {ambre.note ?? 'Le texte et l’image attendent votre accord.'}
              </span>
            </div>
            <button type="button" className="bx-btn2" onClick={() => valider(ambre)}>
              Valider
            </button>
          </div>
        )}
      </Carte>

      <div className="mt-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-2">
        <Carte titre="Ce qui marche, par canal" droite={`engagement moyen · ${moisLong(`${mois}-01`).split(' ')[0]}`}>
          {marche.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-text-secondary">Aucune publication du mois n’a encore son chiffre d’engagement.</p>
          ) : (
            <>
              {marche.map(({ c, moyenne }) => (
                <div key={c.cle} className="grid grid-cols-[100px_minmax(0,1fr)_56px] items-center gap-3 py-2">
                  <span className="text-[13px] font-semibold text-text-body">{c.nom}</span>
                  <span className="h-[6px] bg-[#1f1f23]" aria-hidden>
                    <span className="block h-full bg-[#8a8a8f]" style={{ width: `${c.cle === 'NL' ? 100 : (moyenne! / maxMarcheReseaux(marche)) * 100}%` }} />
                  </span>
                  <span className="text-right font-mono text-[11px] tabular-nums text-text-secondary">{moyenne!.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %</span>
                </div>
              ))}
              <p className="mt-3 text-[12px] leading-relaxed text-text-muted">La lettre se mesure en ouverture, les réseaux en engagement : les barres ne se comparent pas d’un canal à l’autre.</p>
            </>
          )}
        </Carte>
        <Carte titre="Les trous" droite={trous[0]?.resume ?? ''}>
          {trous.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-text-secondary">Pas de trou : chaque canal publie au moins tous les dix jours.</p>
          ) : (
            trous.map((t, i) => (
              <div key={i} className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-baseline gap-3.5 border-b border-[#222226] py-3">
                <span className="font-mono text-[11px] tabular-nums text-text-muted">{t.quand}</span>
                <span className="text-[13px] leading-[1.5] text-text-body">{t.texte}</span>
                <span className="font-mono text-[10.5px] uppercase text-text-muted">{t.canal}</span>
              </div>
            ))
          )}
        </Carte>
      </div>
    </>
  );
}

/** Les barres des réseaux se comparent entre elles ; la lettre (ouverture) reste à part. */
function maxMarcheReseaux(marche: { c: { cle: Canal }; moyenne: number | null }[]): number {
  return Math.max(1, ...marche.filter((x) => x.c.cle !== 'NL').map((x) => x.moyenne ?? 0));
}

/** Les trous du mois : dix jours sans rien sur un canal, rien de programmé après aujourd'hui, une seule lettre. */
export function trousDuMois(pubs: Pub[], canaux: Canal[], jours: string[], auj: string): { quand: string; texte: string; canal: string; resume: string }[] {
  const r: { quand: string; texte: string; canal: string; resume: string; poids: number }[] = [];
  const dernier = jours[jours.length - 1];
  const moisCourant = auj.slice(0, 7) === jours[0].slice(0, 7);
  for (const c of canaux) {
    if (c === 'NL') continue;
    const ici = [...new Set(pubs.filter((p) => p.canal === c).map((p) => p.jour))].sort();
    if (!ici.length) continue;
    const bornes = [jours[0], ...ici, dernier];
    for (let i = 0; i < bornes.length - 1; i += 1) {
      const de = Number(bornes[i].slice(8));
      const a = Number(bornes[i + 1].slice(8));
      const vide = a - de - 1;
      if (vide >= 10) {
        r.push({ quand: `${de + 1} → ${a - 1}`, texte: `${nomCanal(c)} : aucune publication pendant ${vide >= 14 ? `${vide >= 21 ? 'trois' : 'deux'} semaines` : `${vide} jours`}`, canal: c, resume: `${vide >= 14 ? `${vide >= 21 ? 'trois' : 'deux'} semaines` : `${vide} jours`} sans ${nomCanal(c)}`, poids: vide });
      }
    }
    const apres = pubs.some((p) => p.canal === c && p.jour > auj);
    const derniere = ici[ici.length - 1];
    if (moisCourant && !apres && derniere <= auj && Number(dernier.slice(8)) - Number(auj.slice(8)) >= 3) {
      r.push({ quand: `${Number(auj.slice(8)) + 1} → ${Number(dernier.slice(8))}`, texte: `Rien de programmé sur ${nomCanal(c)} après la publication du ${Number(derniere.slice(8))}`, canal: c, resume: `rien après le ${Number(derniere.slice(8))} sur ${nomCanal(c)}`, poids: 5 });
    }
  }
  const lettres = pubs.filter((p) => p.canal === 'NL').length;
  if (lettres === 1) r.push({ quand: jours[0].slice(5, 7) === auj.slice(5, 7) ? 'ce mois' : 'le mois', texte: 'Une seule lettre dans le mois', canal: 'lettre', resume: 'une seule lettre', poids: 1 });
  return r.sort((x, y) => y.poids - x.poids).slice(0, 5);
}
