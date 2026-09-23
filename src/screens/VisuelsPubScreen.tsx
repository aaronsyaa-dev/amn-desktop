import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Bloc,
  BoutonSecondaire,
  Calmes,
  CarteCalme,
  CarteReleves,
  Dominante,
  Ecran50,
  LigneRegistre,
  PiedDominante,
  donnees,
} from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import { type CampagneVisuels, type FormatVisuel, aLEchelle, horsZone, recomposer, rectZoneSure } from '../lib/cinquante/marketing';
import { useLangue } from '../i18n';

/**
 * VISUELS PUB — l'imposition (`35b`).
 *
 * Les formats côte à côte, à leurs proportions RÉELLES et à la même échelle
 * (1 px pour 6,4 px), alignés sur leur bord bas comme sur une planche
 * d'imprimeur. La zone sûre de chaque plateforme en pointillé ; le titre, le
 * produit, la marge posés dedans. Un format ne se redimensionne jamais pour
 * remplir sa colonne : sur un téléphone, la planche passe à la ligne.
 *
 * Le verdict « hors zone » vient de `horsZone` — une intersection de
 * rectangles en pixels finaux, pas un regard.
 */

const ARTICLE: Record<string, string> = { story: 'la story', feed: 'le feed', carre: 'le carré', banniere: 'la bannière' };
const COTE: Record<string, string> = { droite: 'à droite', gauche: 'à gauche', haut: 'en haut', bas: 'en bas' };
const dernierMot = (s: string) => s.replace(/[.,;:!?’'»\s]+$/, '').split(/[\s’']+/).pop() ?? s;

function Format({ f, titre, ambre }: { f: FormatVisuel; titre: string; ambre: boolean }) {
  const z = rectZoneSure(f);
  const e = (px: number) => `${aLEchelle(px)}px`;
  const hz = horsZone(f);
  return (
    <div className="flex flex-none flex-col items-start gap-[9px]">
      <div className="relative overflow-visible border border-[#333] bg-[#1c1c1c]" style={{ width: e(f.largeurPx), height: e(f.hauteurPx) }}>
        <span className="absolute border border-dashed border-[#4a4a48]" style={{ left: e(z.x), top: e(z.y), width: e(z.l), height: e(z.h) }} />
        <span
          className="absolute flex items-center justify-center bg-[#2b2b2b] font-mono text-[8px] text-text-muted"
          style={{ left: e(f.produit.x), top: e(f.produit.y), width: e(f.produit.l), height: e(f.produit.h) }}
        >
          PRODUIT
        </span>
        <span
          data-signal-groupe={ambre ? 'hors-zone' : undefined}
          className={`absolute bg-text-body px-1.5 py-[5px] text-[10px] font-bold leading-[1.15] text-[#0a0a0a] ${
            ambre ? 'shadow-[0_0_28px_-7px_var(--color-signal-glow)] outline outline-2 outline-offset-2 outline-signal' : ''
          }`}
          style={{ left: e(f.titre.x), top: e(f.titre.y), width: e(f.titre.l) }}
        >
          {titre}
        </span>
      </div>
      <span className="block">
        <span className="block text-[12.5px] font-semibold text-text-primary">{f.nom}</span>
        <span className="tnum mt-0.5 block font-mono text-[10px] text-text-muted">
          {f.largeurPx} × {f.hauteurPx}
        </span>
        {ambre && (
          <span data-signal-groupe="hors-zone" className="mt-1.5 block font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-signal">
            Titre hors zone sûre
          </span>
        )}
        {!ambre && hz.dehors && (
          <span className="mt-1.5 block font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-muted">titre hors zone</span>
        )}
      </span>
    </div>
  );
}

export function VisuelsPubScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const campagnes = useCollection<CampagneVisuels>('adVisuals');
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const tries = useMemo(() => [...campagnes].sort((a, b) => b.creeLe.localeCompare(a.creeLe)), [campagnes]);
  const c = tries[0] ?? null;
  const vide = !c;
  /* Un seul ambre : le format dont le titre déborde le plus. */
  const pire = c
    ? c.formats
        .map((f, i) => ({ i, h: horsZone(f) }))
        .filter((x) => x.h.dehors)
        .sort((a, b) => b.h.px - a.h.px)[0] ?? null
    : null;
  const fautif = c && pire ? c.formats[pire.i] : null;
  const annee = tries.filter((x) => new Date(x.creeLe).getFullYear() === maintenant.getFullYear());

  const recomposerFautif = async () => {
    if (!c || !pire) return;
    const formats = c.formats.map((f, i) => (i === pire.i ? recomposer(f) : f));
    await upsert('adVisuals', c.id, { ...donnees(c), formats });
  };

  const description = !c
    ? t('m50.adVisuals.descriptionVide')
    : fautif
      ? t('m50.adVisuals.description', { n: L(c.formats.length), fautif: ARTICLE[fautif.cle] ?? fautif.nom })
      : t('m50.adVisuals.descriptionTient', { n: L(c.formats.length) });

  return (
    <Ecran50 vide={vide} premierJour={vide}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.marketing'), module: t('m50.adVisuals.titre') })}
          title={t('m50.adVisuals.titre')}
          description={description}
          phraseVide={t('m50.adVisuals.phraseVide')}
        />
      </Bloc>

      <Dominante
        surtitre={c ? `La planche · même échelle pour les ${L(c.formats.length)} formats` : 'La planche'}
        note={c ? 'Pointillé = zone sûre de la plateforme' : undefined}
      >
        {!c ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Un visuel de campagne sera posé ici dans chacun de ses formats, côte à côte et à la même échelle, avec la zone
            sûre de chaque plateforme en pointillé : ce qu’un format coupe se verra à l’œil.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-[30px]">
              {c.formats.map((f, i) => (
                <Format key={f.nom} f={f} titre={c.titre} ambre={pire?.i === i} />
              ))}
            </div>
            <p className="mt-3 font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-muted">Échelle 1 : 6,4 · 1 px pour 6,4 px de pixel final</p>
            <PiedDominante
              action={
                fautif ? (
                  <BoutonSecondaire onClick={() => void recomposerFautif()}>
                    Recomposer {ARTICLE[fautif.cle] ?? fautif.nom}
                  </BoutonSecondaire>
                ) : undefined
              }
            >
              {fautif && pire
                ? `Sur ${ARTICLE[fautif.cle] ?? fautif.nom}, le titre dépasse la zone sûre de ${pire.h.px} px ${COTE[pire.h.cote]} : les plateformes qui recadrent le couperont${
                    pire.h.cote === 'droite' ? ` au mot « ${dernierMot(c.titre)} »` : ''
                  }.`
                : `Les ${L(c.formats.length)} formats gardent le titre dans leur zone sûre : le visuel peut partir.`}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre={c ? `Les déclinaisons · campagne « ${c.nom} »` : 'Les déclinaisons'} note={c ? 'Format · état' : undefined}>
          {!c ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucune campagne pour l’instant.</p>
          ) : (
            c.formats.map((f, i) => (
              <LigneRegistre key={f.nom} colonnes="minmax(0,1fr) 100px 64px" derniere={i === c.formats.length - 1}>
                <span className="min-w-0 text-[13.5px] text-text-primary">{f.nom}</span>
                <span className="tnum font-mono text-[11.5px] text-text-secondary">{f.largeurPx} × {f.hauteurPx}</span>
                <span className="text-right font-mono text-[11.5px] text-text-secondary">{horsZone(f).dehors ? 'à revoir' : 'prête'}</span>
              </LigneRegistre>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Cette année"
          releves={[
            { label: 'Campagnes', valeur: annee.length },
            { label: 'Visuels', valeur: annee.reduce((s, x) => s + x.visuels, 0) },
            { label: 'Formats par visuel', valeur: c ? c.formats.length : '—' },
          ]}
        >
          Un visuel ne part qu’une fois tous ses formats dans leur zone sûre.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
