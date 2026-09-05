import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Conversation, EtatPoint, GraviteChip, JournalLigne } from '../../components/garde/GardeUi';
import { ComptesBureau } from '../../components/garde/ComptesBureau';
import { garde } from '../../lib/garde';
import { useLangue } from '../../i18n';
import { relativeTime } from '../../lib/time';
import type { GardeBureau, GardeEquipe, GardeSalle } from '../../shared/garde';

/**
 * LES BUREAUX DES CHEFS DE GARDE — on entre, on parle, il répond avec ses preuves.
 *
 * Chaque chef tient l'historique de tout ce que son équipe a fait ; Aaron
 * pointe une action et la marque « mauvaise » : le chef ordonne la
 * correction (annulation si c'est réversible, plan sinon), tout est tracé, et
 * la règle qui l'a produite est comptée puis, s'il le faut, proposée à
 * l'ajustement. Le Capitaine a son bureau aussi.
 */
export function GardeBureauxScreen() {
  const { t } = useLangue();
  const { equipe } = useParams<{ equipe?: string }>();
  const [salle, setSalle] = useState<GardeSalle | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => { garde.salle().then(setSalle).catch((err) => setErreur(err instanceof Error ? err.message : String(err))); }, []);

  if (equipe) return <Bureau equipeKey={equipe} definition={salle?.equipes.find((e) => e.key === equipe) ?? null} />;
  return (
    <section className="flex flex-col gap-5">
      <ScreenHeader eyebrow={t('garde.surtitre')} title={t('garde.bureaux.titre')} description={t('garde.bureaux.description')} />
      {erreur && <p role="alert" className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-text-primary">{t('garde.erreur', { message: erreur })}</p>}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <li>
          <Link to="/garde/bureaux/capitaine" className="flex h-full flex-col gap-1 rounded-xl border border-border-strong bg-surface p-4 transition-colors hover:bg-surface-hover">
            <p className="text-sm font-semibold text-text-primary">{t('garde.bureaux.capitaine')}</p>
            <p className="text-[12px] text-text-secondary">{t('garde.bureaux.capitaineRole')}</p>
            <span className="mt-auto pt-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('garde.bureaux.entrer')} →</span>
          </Link>
        </li>
        {(salle?.equipes ?? []).map((e) => (
          <li key={e.key}>
            <Link to={`/garde/bureaux/${e.key}`} className="flex h-full flex-col gap-1 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-hover">
              <p className="text-sm font-semibold text-text-primary">{e.chef.nom}</p>
              <p className="text-[12px] text-text-secondary">{e.nom} · {e.chef.role}</p>
              <p className="text-[11px] text-text-muted">{e.agents.map((a) => a.nom).join(', ')}</p>
              <span className="mt-auto pt-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('garde.bureaux.entrer')} →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Bureau({ equipeKey, definition }: { equipeKey: string; definition: GardeEquipe | null }) {
  const { t } = useLangue();
  const [bureau, setBureau] = useState<GardeBureau | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [couloirs, setCouloirs] = useState<Record<string, { min: string; max: string }>>({});
  const charger = useCallback(async () => {
    try { setBureau(await garde.bureau(equipeKey)); setErreur(null); } catch (err) { setErreur(err instanceof Error ? err.message : String(err)); }
  }, [equipeKey]);
  useEffect(() => { void charger(); }, [charger]);
  useEffect(() => garde.onGarde((trame) => { if (['garde:journal', 'garde:remontee', 'garde:ronde', 'garde:correction'].includes(trame.type)) void charger(); }), [charger]);
  const c = bureau?.comptes ?? {};
  const rapides = [t('garde.bureau.q.nuit'), t('garde.bureau.q.semaine'), t('garde.bureau.q.quoi'), ...(equipeKey === 'capitaine' ? [] : [t('garde.bureau.q.ronde')])];

  return (
    <section className="flex flex-col gap-5">
      <ScreenHeader
        eyebrow={`${t('garde.surtitre')} · ${t('garde.bureaux.titre')}`}
        title={bureau?.equipe.chef.nom ?? '…'}
        description={bureau ? `${bureau.equipe.nom} · ${bureau.equipe.chef.role}` : ''}
        stats={bureau ? [{ label: t('garde.bureau.regles'), value: c.regle ?? 0 }, { label: t('garde.bureau.remontes'), value: c.remonte ?? 0, emphasis: (c.remonte ?? 0) > 0 }, { label: t('garde.bureau.echecs'), value: c.echec ?? 0, emphasis: (c.echec ?? 0) > 0 }] : []}
      >
        <Link to="/garde/bureaux" className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-[12px] text-text-secondary hover:border-border-strong hover:text-text-primary">← {t('garde.bureaux.titre')}</Link>
      </ScreenHeader>
      {erreur && <p role="alert" className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-text-primary">{t('garde.erreur', { message: erreur })}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.bureau.question')}>
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.bureau.question')}</h2>
            <Conversation envoyer={async (texte, confirmer) => { const r = await garde.question(equipeKey, texte, confirmer); void charger(); return r; }} rapides={rapides} />
          </section>

          {bureau && bureau.propositions.length > 0 && (
            <section className="rounded-xl border border-warning/40 bg-surface p-4" aria-label={t('garde.bureau.propositions')}>
              <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.bureau.propositions')}</h2>
              <ul className="flex flex-col gap-3">
                {bureau.propositions.map((p) => (
                  <li key={p.id} className="flex flex-col gap-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
                    <p className="text-sm text-text-primary">{t('garde.bureau.proposition', { parametre: p.parametre, actuelle: p.valeurActuelle, proposee: p.valeurProposee })} <span className="font-mono text-[10px] text-text-muted">({p.regle})</span></p>
                    {p.preuve?.stats && <p className="text-[12px] text-text-secondary">{t('garde.bureau.preuve', { mauvais: p.preuve.stats.mauvais, total: p.preuve.stats.total })}{p.preuve.etSi && typeof p.preuve.etSi.apres === 'number' ? ` · ${t('garde.bureau.etsi', { avant: p.preuve.etSi.avant ?? '—', apres: p.preuve.etSi.apres })}` : ''}</p>}
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => void garde.deciderProposition(p.id, 'acceptee').then(charger)} className="border border-accent bg-accent px-2.5 py-1 text-xs font-medium text-bg">{t('garde.bureau.accepter')}</button>
                      <button type="button" onClick={() => void garde.deciderProposition(p.id, 'refusee').then(charger)} className="border border-border px-2.5 py-1 text-xs text-text-secondary">{t('garde.bureau.refuser')}</button>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('garde.bureau.couloir')}</span>
                      <input type="number" value={couloirs[p.id]?.min ?? ''} onChange={(e) => setCouloirs((k) => ({ ...k, [p.id]: { min: e.target.value, max: k[p.id]?.max ?? '' } }))} placeholder="min" aria-label="min" className="input-focus w-16 border border-border bg-bg px-2 py-1 text-xs text-text-primary outline-none" />
                      <input type="number" value={couloirs[p.id]?.max ?? ''} onChange={(e) => setCouloirs((k) => ({ ...k, [p.id]: { min: k[p.id]?.min ?? '', max: e.target.value } }))} placeholder="max" aria-label="max" className="input-focus w-16 border border-border bg-bg px-2 py-1 text-xs text-text-primary outline-none" />
                      <button type="button" disabled={!couloirs[p.id]?.min || !couloirs[p.id]?.max} onClick={() => void garde.deciderProposition(p.id, 'acceptee', { min: Number(couloirs[p.id].min), max: Number(couloirs[p.id].max) }).then(charger)} className="border border-border-strong px-2.5 py-1 text-xs text-text-primary disabled:opacity-50">{t('garde.bureau.couloir')}</button>
                    </div>
                    <p className="text-[11px] text-text-muted">{t('garde.bureau.couloirAide')}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Le Chef des Comptes a un pupitre : les jetons et les règlements (Bloc 5). */}
          {equipeKey === 'comptes' && <ComptesBureau />}
          <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.bureau.historique')}>
            <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.bureau.historique')}</h2>
            {bureau && bureau.journal.length === 0 && <p className="font-mono text-xs text-text-muted">{t('garde.salle.rienRecent')}</p>}
            <ul>
              {(bureau?.journal ?? []).map((e) => <JournalLigne key={e.id} entree={e} onMauvais={async (id, note) => { await garde.mauvais(id, note); await charger(); }} />)}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.bureau.messages')}>
            <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.bureau.messages')}</h2>
            {bureau && bureau.messages.length === 0 && <p className="font-mono text-xs text-text-muted">{t('garde.bureau.rienEcrit')}</p>}
            <ul className="flex flex-col gap-2">
              {(bureau?.messages ?? []).map((m) => <li key={m.id} className="text-[13px] leading-relaxed text-text-secondary"><span className="font-mono text-[10px] text-text-muted">{relativeTime(m.createdAt)} · </span>{m.texte}</li>)}
            </ul>
          </section>
          {bureau && bureau.remontees.length > 0 && (
            <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.pile.titre')}>
              <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.pile.titre')}</h2>
              <ul className="flex flex-col gap-2">
                {bureau.remontees.map((r) => <li key={r.id} className="flex items-start gap-2 text-[13px] text-text-primary"><GraviteChip gravite={r.gravite} /><span>{r.titre}</span></li>)}
              </ul>
              <Link to="/garde/pile" className="mt-2 inline-block font-mono text-[10px] uppercase tracking-widest text-text-muted hover:text-text-primary">{t('garde.pile.titre')} →</Link>
            </section>
          )}
          {definition && definition.agents.length > 0 && (
            <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('garde.bureau.agents')}>
              <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">{t('garde.bureau.agents')}</h2>
              <ul className="flex flex-col gap-3">
                {definition.agents.map((a) => {
                  const etat = bureau?.agents.find((x) => x.key === a.key);
                  return (
                    <li key={a.key} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2"><EtatPoint etat={etat?.etat ?? 'repos'} actif={etat?.actif ?? true} /><span className="text-sm font-medium text-text-primary">{a.nom}</span><span className="text-[11px] text-text-muted">{a.role}</span></div>
                      <p className="text-[11px] text-text-muted"><span className="font-mono uppercase tracking-wider">{t('garde.bureau.prises')}</span> — {a.prises.lit.join(', ') || '—'} · {a.prises.modifie.join(', ') || '—'} · {a.prises.demande.join(', ') || '—'}</p>
                      {Object.entries(a.regles).length > 0 && (
                        <ul className="flex flex-col gap-0.5 pl-3">
                          {Object.entries(a.regles).map(([k, r]) => {
                            const parametres = (etat?.parametres?.[k] ?? r.parametres) as Record<string, unknown>;
                            const premier = Object.keys(r.parametres)[0];
                            return (
                              <li key={k} className="text-[11px] text-text-secondary">
                                {r.description}{Object.keys(r.parametres).length ? ` (${Object.entries(parametres).map(([n, v]) => `${n} ${String(v)}`).join(', ')})` : ''}
                                {r.rejouable && premier && <EtSi agent={a.key} regle={k} parametre={premier} valeur={Number(parametres[premier] ?? r.parametres[premier])} />}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * « ET SI ? » — un seuil rejoué sur le mois écoulé, sans rien changer.
 *
 * Le garde relit ses propres traces (pings, incidents, demandes) avec la
 * valeur proposée et dit ce que le mois aurait produit, contre ce qu'il a
 * produit. Rien n'est modifié : c'est une lecture. Pour changer la règle,
 * on passe par la proposition d'ajustement ou par un ordre.
 */
function EtSi({ agent, regle, parametre, valeur }: { agent: string; regle: string; parametre: string; valeur: number }) {
  const { t } = useLangue();
  const [essai, setEssai] = useState(String(valeur));
  const [resultat, setResultat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rejouer = async () => {
    const v = Number(essai);
    if (!Number.isFinite(v) || busy) return;
    setBusy(true);
    try {
      const r = await garde.etSi(agent, regle, parametre, v);
      setResultat(r.apres === null ? (r.note ?? t('garde.bureau.etsiImpossible')) : t('garde.bureau.etsiResultat', { parametre, valeur: v, apres: r.apres, avant: r.avant ?? '—' }));
    } catch (err) { setResultat(t('garde.erreur', { message: err instanceof Error ? err.message : String(err) })); } finally { setBusy(false); }
  };
  return (
    <form className="mt-1 flex flex-wrap items-center gap-2" aria-label={`${t('garde.bureau.etsiTitre')} ${regle}`} onSubmit={(e) => { e.preventDefault(); void rejouer(); }}>
      <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{t('garde.bureau.etsiTitre')}</span>
      <label className="flex items-center gap-1 text-[11px] text-text-secondary">{parametre}
        <input type="number" inputMode="numeric" value={essai} onChange={(e) => setEssai(e.target.value)} aria-label={`${t('garde.bureau.etsiTitre')} ${parametre}`} className="input-focus w-20 border border-border bg-bg px-2 py-0.5 text-[12px] text-text-primary outline-none" />
      </label>
      <button type="submit" disabled={busy} className="min-h-11 border border-border px-2 text-[11px] text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-50 md:min-h-0 md:py-0.5">{t('garde.bureau.etsiEssayer')}</button>
      {resultat && <span className="text-[11px] text-text-primary" data-etsi={regle}>{resultat}</span>}
    </form>
  );
}
