import React, { useMemo } from 'react';
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
import { SaisieModule, Saisies, versNombre } from '../components/SaisieModule';
import { uid, useCollection, useSync } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import {
  CORPS_MIN_PX,
  type EnregistrementIdentite,
  type LogoKit,
  type UsageLogo,
  lisibilite,
  seuilVersionReduite,
  usageIllisible,
} from '../lib/cinquante/marketing';
import type { Id } from '../lib/cinquante/guichet';
import { useLangue } from '../i18n';

/**
 * IDENTITÉ VISUELLE — l'échelle de lisibilité (`35e`).
 *
 * Le logo rendu À LA TAILLE RÉELLE de chacun de ses usages, en pixels CSS,
 * sans transformation d'échelle : ce qui disparaît à 16 px disparaît
 * vraiment. Le verdict se calcule — aucun élément ne doit descendre sous
 * 6 px de corps — et la version réduite est proposée d'elle-même sous le
 * seuil où la mention y passe.
 */

/** « à » + article : à le → au, à les → aux, à l’ et à la restent. */
const versA = (s: string) => (s.startsWith('le ') ? `au ${s.slice(3)}` : s.startsWith('les ') ? `aux ${s.slice(4)}` : `à ${s}`);
const virgule = (n: number) => n.toFixed(1).replace('.', ',').replace(/,0$/, '');

function Tuile({ logo, taille, reduite, ambre = false }: { logo: LogoKit; taille: number; reduite: boolean; ambre?: boolean }) {
  return (
    <span
      data-signal-groupe={ambre ? 'illisible' : undefined}
      className={`flex flex-none flex-col items-center justify-center bg-text-primary text-[#0a0a0a] ${
        ambre ? 'shadow-[0_0_28px_-7px_var(--color-signal-glow)] outline outline-2 outline-offset-[5px] outline-signal' : ''
      }`}
      style={{ width: taille, height: taille }}
      aria-hidden
    >
      <span className="font-bold leading-none tracking-[-0.04em]" style={{ fontSize: taille * logo.ratioMonogramme }}>
        {logo.monogramme}
      </span>
      {!reduite && (
        <span
          className="font-mono font-semibold leading-none tracking-[0.2em]"
          style={{ fontSize: taille * logo.ratioMention, marginTop: taille * 0.04 }}
        >
          {logo.mention}
        </span>
      )}
    </span>
  );
}

export function IdentiteVisuelleScreen() {
  const { t, langue } = useLangue();
  const { upsert, remove } = useSync();
  const tout = useCollection<EnregistrementIdentite>('brandKit');
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const logo = tout.find((e): e is Id<LogoKit> & { updatedAt: string } => e.kind === 'logo') ?? null;
  const usages = useMemo(
    () => tout.filter((e): e is Id<UsageLogo> & { updatedAt: string } => e.kind === 'usage').sort((a, b) => b.taillePx - a.taillePx),
    [tout],
  );
  const vide = !logo || usages.length === 0;
  const ambre = logo ? usageIllisible(logo, usages) : null;
  const seuil = logo ? seuilVersionReduite(logo) : 0;
  /* Les usages que la version réduite corrigerait : la mention y passe sous 6 px. */
  const aReduire = logo ? usages.filter((u) => u.declinaison === 'complete' && u.taillePx < seuil) : [];
  const lisibleJusqua = logo
    ? [...usages].sort((a, b) => a.taillePx - b.taillePx).find((u) => lisibilite(logo, { ...u, declinaison: 'reduite' }).corpsMonogramme >= CORPS_MIN_PX)
    : null;

  const adopter = async () => {
    for (const u of aReduire) await upsert('brandKit', u.id, { ...donnees(u), declinaison: 'reduite' });
  };

  /*
    SAISIE — le logo en mots (le monogramme, la mention, les couleurs, les
    polices) et les endroits où il s'imprime, à leur taille réelle. À la
    première pose, les six usages courants sont proposés d'office ; chacun se
    corrige ou se retire.
  */
  const enregistrerLogo = async (v: Record<string, string>, id?: string) => {
    const liste = (x: string) => x.split(/[,;\n]/).map((y) => y.trim()).filter(Boolean);
    await upsert('brandKit', id ?? logo?.id ?? uid(), {
      kind: 'logo',
      monogramme: v.monogramme.trim(),
      mention: v.mention.trim(),
      ratioMonogramme: logo?.ratioMonogramme ?? 0.42,
      ratioMention: logo?.ratioMention ?? 0.085,
      couleurs: liste(v.couleurs),
      polices: liste(v.polices),
      declinaisons: logo?.declinaisons ?? ['complète', 'réduite', 'monochrome', 'négatif'],
    });
    if (usages.length === 0) {
      const courants: Array<[string, number, string, string?]> = [
        ['Enseigne', 220, '3 m', 'l’enseigne'],
        ['Véhicule', 96, '60 cm', 'le véhicule'],
        ['Avatar', 64, '64 px', 'l’avatar'],
        ['Signature mail', 40, '40 px', 'la signature mail'],
        ['Onglet', 24, '24 px', 'l’onglet'],
        ['Favicon', 16, '16 px', 'le favicon'],
      ];
      for (const [i, [nom, taillePx, reel, avecArticle]] of courants.entries()) {
        await upsert('brandKit', uid(), { kind: 'usage', nom, taillePx, reel, ...(avecArticle ? { avecArticle } : {}), declinaison: 'complete', ordre: i });
      }
    }
  };
  const enregistrerUsage = async (v: Record<string, string>, id?: string) => {
    const avant = usages.find((u) => u.id === id);
    await upsert('brandKit', id ?? uid(), {
      kind: 'usage',
      nom: v.nom.trim(),
      taillePx: Math.max(8, Math.round(versNombre(v.taille) ?? 16)),
      reel: v.reel.trim() || `${v.taille} px`,
      declinaison: avant?.declinaison ?? 'complete',
      ordre: avant?.ordre ?? usages.length,
    });
  };

  const premier = usages[0];
  const dernier = usages[usages.length - 1];
  const description = vide
    ? t('m50.brand.descriptionVide')
    : t('m50.brand.description', {
        de: premier.avecArticle ?? premier.nom.toLowerCase(),
        a: langue === 'fr' ? versA(dernier.avecArticle ?? dernier.nom.toLowerCase()) : dernier.avecArticle ?? dernier.nom.toLowerCase(),
        n: L(usages.length),
      });

  const grisOuNoir = (hex: string) => {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
    return !m || (m[1] === m[2] && m[2] === m[3]);
  };
  const accents = logo ? logo.couleurs.filter((c) => !grisOuNoir(c)).length : 0;

  const lAmbre = logo && ambre ? lisibilite(logo, ambre) : null;

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.marketing'), module: t('m50.brand.titre') })}
          title={t('m50.brand.titre')}
          description={description}
          phraseVide={t('m50.brand.phraseVide')}
        />
      </Bloc>

      <Saisies>
        <SaisieModule
          ajouter={logo ? 'Modifier le logo' : 'Décrire le logo'}
          ouvertParDefaut={!logo}
          surtitreListe="Le logo"
          champs={[
            { cle: 'monogramme', intitule: 'Monogramme', type: 'texte', requis: true, aide: 'Les lettres ou le signe du logo : « LM ».' },
            { cle: 'mention', intitule: 'Mention', type: 'texte', requis: true, aide: 'Le texte posé sous le monogramme : « NETTOYAGE ».' },
            { cle: 'couleurs', intitule: 'Couleurs', type: 'texte', aide: 'Codes séparés par des virgules : « #0a0a0a, #f7f7f5 ».' },
            { cle: 'polices', intitule: 'Polices', type: 'texte', aide: 'Séparées par des virgules.' },
          ]}
          enregistrer={(v) => enregistrerLogo(v, logo?.id)}
          elements={logo ? [{ id: logo.id, libelle: `${logo.monogramme} · ${logo.mention}`, detail: logo.couleurs.join(', '), valeurs: { monogramme: logo.monogramme, mention: logo.mention, couleurs: logo.couleurs.join(', '), polices: logo.polices.join(', ') } }] : []}
          supprimer={(id) => remove('brandKit', id)}
        />
        {logo && (
          <SaisieModule
            ajouter="Ajouter un usage"
            surtitreListe="Les usages"
            champs={[
              { cle: 'nom', intitule: 'Usage', type: 'texte', requis: true, aide: '« Tampon », « Étiquette de pot ».' },
              { cle: 'taille', intitule: 'Hauteur à l’écran', type: 'nombre', requis: true, suffixe: 'px', aide: 'La taille à laquelle le logo y est vu.' },
              { cle: 'reel', intitule: 'Taille réelle', type: 'texte', aide: '« 3 cm », « 2 m ».' },
            ]}
            enregistrer={enregistrerUsage}
            elements={usages.map((u) => ({ id: u.id, libelle: u.nom, detail: `${u.taillePx} px · ${u.reel}`, valeurs: { nom: u.nom, taille: String(u.taillePx), reel: u.reel } }))}
            supprimer={(id) => remove('brandKit', id)}
          />
        )}
      </Saisies>

      <Dominante surtitre="Le logo à toutes ses tailles" note={vide ? undefined : 'Taille réelle de chaque usage'}>
        {vide || !logo ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Le logo sera posé ici à la vraie taille de chacun de ses usages, de l’enseigne au favicon, sur une même ligne
            de base : on verra où il cesse d’être lisible.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-6">
              {usages.map((u) => {
                const estAmbre = u.id === ambre?.id;
                return (
                  <span key={u.id} className="flex flex-col items-center gap-3.5">
                    <Tuile logo={logo} taille={u.taillePx} reduite={u.declinaison === 'reduite'} ambre={estAmbre} />
                    <span className="h-12 text-center">
                      <span
                        data-signal-groupe={estAmbre ? 'illisible' : undefined}
                        className={`tnum block font-mono text-[11px] font-semibold ${estAmbre ? 'text-signal' : 'text-text-body'}`}
                      >
                        {u.taillePx} px
                      </span>
                      <span className="mt-0.5 block whitespace-nowrap text-[11.5px] text-text-muted">
                        {u.nom.toLowerCase()}
                        {u.reel && !/px$/.test(u.reel) && u.taillePx >= 200 ? ` · ${u.reel}` : ''}
                      </span>
                      {estAmbre && lAmbre && (
                        <span data-signal-groupe="illisible" className="mt-[5px] block whitespace-nowrap font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-signal">
                          {lAmbre.mentionIllisible ? 'Mention illisible' : 'Monogramme illisible'}
                        </span>
                      )}
                    </span>
                  </span>
                );
              })}
            </div>

            {aReduire.length > 0 && (
              <div className="mt-[26px] flex flex-wrap items-center gap-[22px] border-t border-border-raised pt-[18px]">
                <span className="whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">Version réduite proposée</span>
                {[...aReduire].sort((a, b) => a.taillePx - b.taillePx).slice(0, 2).reverse().map((u) => (
                  <Tuile key={u.id} logo={logo} taille={u.taillePx} reduite />
                ))}
                <span className="text-[13px] text-text-secondary">
                  « {logo.monogramme} » seul, sans la mention, sous {Math.ceil(seuil)} px.
                </span>
              </div>
            )}

            <PiedDominante
              action={aReduire.length > 0 ? <BoutonSecondaire onClick={() => void adopter()}>Adopter la version réduite</BoutonSecondaire> : undefined}
            >
              {ambre && lAmbre
                ? lAmbre.mentionIllisible && lAmbre.corpsMention !== null
                  ? `À ${ambre.taillePx} px, la mention « ${logo.mention} » tombe à ${virgule(lAmbre.corpsMention)} px de corps : elle devient une ligne grise.${
                      lisibleJusqua ? ` Le monogramme seul reste lisible jusqu’à ${lisibleJusqua.taillePx} px.` : ''
                    }`
                  : `À ${ambre.taillePx} px, le monogramme tombe à ${virgule(lAmbre.corpsMonogramme)} px de corps : sous ${CORPS_MIN_PX} px, il ne se lit plus.`
                : `À toutes ses tailles d’usage, chaque élément du logo garde au moins ${CORPS_MIN_PX} px de corps.`}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Où le logo apparaît" note={usages.length ? 'Taille · déclinaison' : undefined}>
          {usages.length === 0 || !logo ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun usage relevé.</p>
          ) : (
            usages.map((u, i) => {
              const l = lisibilite(logo, u);
              return (
                <LigneRegistre key={u.id} colonnes="minmax(0,1fr) 64px minmax(0,150px)" derniere={i === usages.length - 1}>
                  <span className="min-w-0 text-[13.5px] text-text-primary">{u.nom}</span>
                  <span className="tnum font-mono text-[11.5px] text-text-secondary">{u.reel}</span>
                  <span className="text-right font-mono text-[11.5px] text-text-secondary">
                    {u.declinaison === 'complete' ? 'complète' : 'réduite'}
                    {l.mentionIllisible || l.monogrammeIllisible ? ' · à changer' : ''}
                  </span>
                </LigneRegistre>
              );
            })
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Le kit"
          releves={[
            { label: 'Couleurs', valeur: logo?.couleurs.length ?? '—' },
            { label: 'Polices', valeur: logo?.polices.length ?? '—' },
            { label: 'Déclinaisons', valeur: logo?.declinaisons.length ?? '—' },
          ]}
        >
          {logo
            ? accents === 0
              ? 'Le kit ne contient aucune couleur d’accent : la marque est en noir et blanc.'
              : `Le kit contient ${L(accents)} couleur${accents > 1 ? 's' : ''} d’accent.`
            : undefined}
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
