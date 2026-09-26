import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Bloc, Calmes, CarteCalme, CarteReleves, Dominante, Ecran50, LigneRegistre, PiedDominante } from '../components/cinquante-kit';
import { SaisieModule, versIso, versJour, versNombre } from '../components/SaisieModule';
import { uid, useCollection, useSync } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import { type EnregistrementNps, FENETRE_NPS_J, type ReglageNps, type ReponseNps, corde } from '../lib/cinquante/marketing';
import { useLangue } from '../i18n';

/**
 * NPS — la corde (`35i`).
 *
 * Une corde tendue d'un bord à l'autre. Les détracteurs tirent à gauche, les
 * promoteurs à droite — un carré de 12 px par répondant, exactement autant
 * que de répondants ; les passifs pendent au milieu, sous la corde. Le nœud
 * se place à `50 % + score / 2` sur l'échelle −100 → +100, et le trimestre
 * précédent reste marqué d'un filet gris. Le score n'est pas un chiffre posé
 * à côté : c'est l'endroit où la corde s'arrête.
 */

const GROUPE: Record<string, string> = { detracteur: 'détracteurs', passif: 'passifs', promoteur: 'promoteurs' };
const signe = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
const signeEspace = (n: number) => (n > 0 ? `+ ${n}` : n < 0 ? `− ${Math.abs(n)}` : '0');

function Carres({ n, couleur, colonnes }: { n: number; couleur: string; colonnes: number }) {
  return (
    <span
      className="grid gap-1 [grid-template-columns:repeat(var(--ct),12px)] sm:[grid-template-columns:repeat(var(--c),12px)]"
      style={{ '--c': Math.max(1, Math.min(colonnes, n)), '--ct': Math.max(1, Math.min(4, colonnes, n)) } as React.CSSProperties}
      aria-hidden
    >
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={`h-3 w-3 ${couleur}`} />
      ))}
    </span>
  );
}

export function NpsScreen() {
  const { t, langue } = useLangue();
  const tout = useCollection<EnregistrementNps>('npsResponses');
  const { upsert, remove } = useSync();
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const c = useMemo(() => corde(tout, maintenant), [tout, maintenant]);
  const reglage = tout.find((e): e is ReglageNps & { id: string; updatedAt: string } => e.kind === 'reglage') ?? null;
  const vide = c.n === 0;
  const motifDetracteurs = c.motifs.filter((m) => m.groupe === 'detracteur');

  /* SAISIE — une réponse recueillie au comptoir, au téléphone ou sur papier. L'envoi automatique du sondage n'est pas branché. */
  const reponses = tout.filter((e): e is ReponseNps & { id: string; updatedAt: string } => e.kind === 'reponse').sort((a, b) => b.le.localeCompare(a.le));
  const enregistrerReponse = async (v: Record<string, string>, id?: string) => {
    await upsert('npsResponses', id ?? uid(), {
      kind: 'reponse',
      note: Math.min(10, Math.max(0, Math.round(versNombre(v.note) ?? 0))),
      le: versIso(v.le),
      client: v.client.trim(),
      ...(v.motif.trim() ? { motif: v.motif.trim() } : {}),
    });
  };

  const description = vide
    ? t('m50.nps.descriptionVide')
    : t(c.precedent ? (c.score > c.precedent.score ? 'm50.nps.descriptionDroite' : c.score < c.precedent.score ? 'm50.nps.descriptionGauche' : 'm50.nps.descriptionImmobile') : 'm50.nps.descriptionSeule', {
        pro: L(c.promoteurs, true),
        det: L(c.detracteurs),
        pas: L(c.passifs),
      });

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.marketing'), module: t('m50.nps.titre') })}
          title={t('m50.nps.titre')}
          description={description}
          phraseVide={t('m50.nps.phraseVide')}
        />
      </Bloc>

      <SaisieModule
        ajouter="Noter une réponse"
        ouvertParDefaut={vide}
        note="L’envoi automatique du sondage n’est pas encore branché"
        surtitreListe="Les réponses"
        champs={[
          { cle: 'client', intitule: 'Client', type: 'texte', requis: true },
          { cle: 'note', intitule: 'Note de 0 à 10', type: 'nombre', requis: true, aide: '« Recommanderiez-vous… ? » 9 ou 10 : promoteur ; 0 à 6 : détracteur.' },
          { cle: 'motif', intitule: 'Ce qu’il ou elle a dit', type: 'texte', large: true },
          { cle: 'le', intitule: 'Le', type: 'date', requis: true, defaut: versJour(maintenant.toISOString()) },
        ]}
        enregistrer={enregistrerReponse}
        elements={reponses.slice(0, 80).map((r) => ({
          id: r.id,
          libelle: `${r.client} · ${r.note} / 10`,
          detail: [versJour(r.le), r.motif].filter(Boolean).join(' · '),
          valeurs: { client: r.client, note: String(r.note), motif: r.motif ?? '', le: versJour(r.le) },
        }))}
        supprimer={(id) => remove('npsResponses', id)}
      />

      <Dominante
        surtitre={`La corde · ${FENETRE_NPS_J} derniers jours`}
        note={vide ? undefined : `${c.n} réponses · détracteurs à gauche, promoteurs à droite`}
      >
        {vide ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Après chaque intervention, un sondage part. Les réponses tendront ici une corde : les détracteurs tirent à
            gauche, les promoteurs à droite, et le nœud s’arrête sur le score.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[64px_minmax(0,1fr)_76px] items-center gap-3 sm:grid-cols-[104px_minmax(0,1fr)_124px] sm:gap-[18px]">
              <div className="flex flex-col items-start gap-2">
                <Carres n={c.detracteurs} couleur="bg-text-muted" colonnes={4} />
                <span className="tnum font-mono text-[11px] font-semibold text-text-secondary">
                  {c.detracteurs} <span className="max-sm:block">détracteur{c.detracteurs > 1 ? 's' : ''}</span>
                </span>
              </div>
              <div className="flex min-w-0 flex-col gap-3">
                <div className="relative h-[100px]">
                  <span className="absolute inset-x-0 top-[60px] h-2 rounded bg-[repeating-linear-gradient(115deg,#6b6b68_0_4px,#3a3a3a_4px_8px)]" />
                  <span className="absolute left-1/2 top-[50px] h-7 w-px bg-[#4a4a48]" />
                  {c.precedent && (
                    <>
                      <span className="absolute top-12 h-8 w-0.5 -translate-x-1/2 bg-[#4a4a48]" style={{ left: `${c.precedent.pct}%` }} />
                      <span
                        className="absolute top-[86px] -translate-x-1/2 whitespace-nowrap font-mono text-[9px] tracking-[0.08em] text-text-muted"
                        style={{ left: `${c.precedent.pct}%` }}
                      >
                        T{c.precedent.trimestre} · {signe(c.precedent.score)}
                      </span>
                    </>
                  )}
                  <span
                    data-signal-groupe="noeud"
                    className="absolute top-[49px] h-[30px] w-[30px] -translate-x-1/2 rounded-full bg-signal shadow-[0_0_28px_-7px_var(--color-signal-glow)]"
                    style={{ left: `${c.noeudPct}%` }}
                  />
                  <span
                    data-signal-groupe="noeud"
                    className="tnum absolute top-2.5 -translate-x-1/2 whitespace-nowrap font-mono text-[24px] font-bold tracking-[-0.03em] text-signal"
                    style={{ left: `${c.noeudPct}%` }}
                  >
                    {signeEspace(c.score)}
                  </span>
                </div>
                <span className="flex flex-col items-center gap-1.5 self-center">
                  <Carres n={c.passifs} couleur="bg-[#2b2b2b]" colonnes={4} />
                  <span className="tnum whitespace-nowrap font-mono text-[10px] font-medium text-text-muted">
                    {c.passifs} passif{c.passifs > 1 ? 's' : ''}
                  </span>
                </span>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Carres n={c.promoteurs} couleur="bg-text-body" colonnes={6} />
                <span className="tnum text-right font-mono text-[11px] font-semibold text-text-body">
                  {c.promoteurs} <span className="max-sm:block">promoteur{c.promoteurs > 1 ? 's' : ''}</span>
                </span>
              </div>
            </div>
            <div className="mt-1 grid grid-cols-[64px_minmax(0,1fr)_76px] gap-3 sm:grid-cols-[104px_minmax(0,1fr)_124px] sm:gap-[18px]">
              <span />
              <span className="relative h-[13px] font-mono text-[9.5px] tracking-[0.08em] text-text-muted">
                <span className="absolute left-0">−100</span>
                <span className="absolute left-1/2 -translate-x-1/2">0</span>
                <span className="absolute right-0">+100</span>
              </span>
              <span />
            </div>

            <PiedDominante>
              {c.detracteurs === 0
                ? 'Aucun détracteur sur la période.'
                : motifDetracteurs.length === 1 && motifDetracteurs[0].n === c.detracteurs
                  ? `${c.detracteurs > 1 ? `Les ${L(c.detracteurs)} détracteurs citent tous` : 'Le détracteur cite'} le même motif : ${motifDetracteurs[0].motif.toLowerCase()}.`
                  : motifDetracteurs.length > 0
                    ? `Le motif le plus cité par les détracteurs : ${motifDetracteurs[0].motif.toLowerCase()} (${motifDetracteurs[0].n} sur ${c.detracteurs}).`
                    : `${L(c.detracteurs, true)} détracteur${c.detracteurs > 1 ? 's' : ''}, sans motif donné.`}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Pourquoi ils le disent" note={c.motifs.length ? 'Motif cité' : undefined}>
          {c.motifs.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun motif cité sur la période.</p>
          ) : (
            c.motifs.slice(0, 6).map((m, i, arr) => (
              <LigneRegistre key={`${m.groupe}-${m.motif}`} colonnes="minmax(0,1fr) 88px 32px" derniere={i === arr.length - 1}>
                <span className="min-w-0 text-[13.5px] text-text-primary">{m.motif}</span>
                <span className="font-mono text-[11.5px] text-text-secondary">{GROUPE[m.groupe]}</span>
                <span className="tnum text-right font-mono text-[11.5px] text-text-secondary">{m.n}</span>
              </LigneRegistre>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Le sondage"
          releves={[
            { label: 'Réponses', valeur: c.n },
            { label: 'Taux de réponse', valeur: c.tauxReponsePct === null ? '—' : `${c.tauxReponsePct} %` },
            { label: 'Envoi', valeur: reglage ? `${reglage.delaiEnvoiH} h après` : '—' },
          ]}
        >
          {reglage
            ? `Le sondage part ${L(reglage.delaiEnvoiH)} heure${reglage.delaiEnvoiH > 1 ? 's' : ''} après la fin d’une intervention, jamais le soir.`
            : 'Le sondage part après la fin d’une intervention, jamais le soir.'}
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
