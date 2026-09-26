import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Bloc,
  BoutonPrimaire,
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
import { SaisieModule, Saisies, depuisCents, versCents, versIso, versJour } from '../components/SaisieModule';
import { uid, useCollection, useSync } from '../state/SyncContext';
import { formatCentsCompact } from '../lib/money';
import { enLettres } from '../lib/cinquante/lettres';
import { type EnregistrementVeille, mouvements, passeSousVous, positionMoyenne, releveDesPrix } from '../lib/cinquante/marketing';
import { useLangue } from '../i18n';

/**
 * VEILLE — le relevé des prix (`35h`).
 *
 * Une ligne par prestation, chacune avec SA règle (bornes du marché relevé,
 * imprimées sous le nom) : deux lignes ne se comparent qu'en position
 * relative. Votre prix est un cran vertical plein ; les concurrents, des
 * jetons ronds centrés sur leur prix (`translateX(-50%)`). Un prix qui a
 * bougé depuis le relevé précédent est relié à son ancienne position. Un prix
 * non relevé n'a pas de jeton — il n'est jamais estimé.
 *
 * L'ambre : le mouvement de la semaine qui passe SOUS votre prix. « Revoir ce
 * tarif » ouvre votre prix à la modification, sur place.
 */

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const euros = (c: number) => formatCentsCompact(c).replace(/\s?€$/, '');

export function VeillePrixScreen() {
  const { t, langue } = useLangue();
  const { upsert, remove } = useSync();
  const tout = useCollection<EnregistrementVeille>('competitorPrices');
  const [maintenant] = useState(() => new Date());
  const [edition, setEdition] = useState<string | null>(null);
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const r = useMemo(() => releveDesPrix(tout), [tout]);
  const mv = useMemo(() => mouvements(r.lignes, maintenant), [r, maintenant]);
  const ambre = useMemo(() => passeSousVous(r.lignes, maintenant), [r, maintenant]);
  const semaine = mv.filter((m) => maintenant.getTime() - new Date(m.jeton.le).getTime() <= 7 * 86_400_000);
  const dernierReleve = r.releves.map((x) => x.le).sort().pop();
  const vide = r.prestations.length === 0;
  const position = positionMoyenne(r.lignes);

  const enregistrer = async (id: string) => {
    const p = r.prestations.find((x) => x.id === id);
    if (!p || edition === null) return;
    const cents = Math.round(Number(edition.replace(',', '.')) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return;
    await upsert('competitorPrices', p.id, { ...donnees(p), votrePrixCents: cents });
    setEdition(null);
  };

  /*
    SAISIE — ce que vous vendez et à quel prix, les concurrents suivis, puis
    chaque prix relevé chez eux. Rien n'est lu automatiquement sur leurs sites :
    un relevé est un prix vu et noté.
  */
  const enregistrerPrestation = async (v: Record<string, string>, id?: string) => {
    const avant = r.prestations.find((x) => x.id === id);
    await upsert('competitorPrices', id ?? uid(), {
      kind: 'prestation',
      nom: v.nom.trim(),
      votrePrixCents: versCents(v.prix) ?? 0,
      ordre: avant?.ordre ?? r.prestations.length,
      ...(avant?.marcheBasCents !== undefined ? { marcheBasCents: avant.marcheBasCents } : {}),
      ...(avant?.marcheHautCents !== undefined ? { marcheHautCents: avant.marcheHautCents } : {}),
    });
  };
  const enregistrerConcurrent = async (v: Record<string, string>, id?: string) => {
    const nom = v.nom.trim();
    await upsert('competitorPrices', id ?? uid(), { kind: 'concurrent', nom, initiale: nom.charAt(0).toUpperCase() });
  };
  const enregistrerReleve = async (v: Record<string, string>, id?: string) => {
    await upsert('competitorPrices', id ?? uid(), { kind: 'releve', concurrentId: v.concurrent, prestationId: v.prestation, prixCents: versCents(v.prix) ?? 0, le: versIso(v.le) });
  };
  const nomDe = (id: string) => [...r.concurrents, ...r.prestations].find((x) => x.id === id)?.nom ?? '—';

  const description = vide
    ? t('m50.watch.descriptionVide')
    : ambre
      ? semaine.length === 1
        ? t('m50.watch.description', { n: L(r.prestations.length), c: L(r.concurrents.length) })
        : t('m50.watch.descriptionPlusieurs', { n: L(r.prestations.length), c: L(r.concurrents.length), bouge: L(semaine.length, true) })
      : t('m50.watch.descriptionCalme', { n: L(r.prestations.length), c: L(r.concurrents.length) });

  const dateReleve = dernierReleve ? `${new Date(dernierReleve).getDate()} ${MOIS[new Date(dernierReleve).getMonth()]}` : '';

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.marketing'), module: t('m50.watch.titre') })}
          title={t('m50.watch.titre')}
          description={description}
          phraseVide={t('m50.watch.phraseVide')}
        />
      </Bloc>

      <Saisies>
        <SaisieModule
          ajouter="Ajouter une prestation"
          ouvertParDefaut={vide}
          surtitreListe="Vos prestations"
          champs={[
            { cle: 'nom', intitule: 'Prestation', type: 'texte', requis: true, aide: '« Vidange », « Coupe femme », « Menu du midi ».' },
            { cle: 'prix', intitule: 'Votre prix', type: 'montant', requis: true },
          ]}
          enregistrer={enregistrerPrestation}
          elements={r.prestations.map((x) => ({ id: x.id, libelle: x.nom, detail: formatCentsCompact(x.votrePrixCents), valeurs: { nom: x.nom, prix: depuisCents(x.votrePrixCents) } }))}
          supprimer={(id) => remove('competitorPrices', id)}
        />
        {r.prestations.length > 0 && (
          <SaisieModule
            ajouter="Suivre un concurrent"
            surtitreListe="Les concurrents"
            champs={[{ cle: 'nom', intitule: 'Concurrent', type: 'texte', requis: true }]}
            enregistrer={enregistrerConcurrent}
            elements={r.concurrents.map((c) => ({ id: c.id, libelle: c.nom, valeurs: { nom: c.nom } }))}
            supprimer={(id) => remove('competitorPrices', id)}
          />
        )}
        {r.prestations.length > 0 && r.concurrents.length > 0 && (
          <SaisieModule
            ajouter="Noter un prix relevé"
            surtitreListe="Les relevés"
            champs={[
              { cle: 'concurrent', intitule: 'Chez', type: 'choix', requis: true, options: r.concurrents.map((c) => ({ valeur: c.id, libelle: c.nom })) },
              { cle: 'prestation', intitule: 'Pour', type: 'choix', requis: true, options: r.prestations.map((x) => ({ valeur: x.id, libelle: x.nom })) },
              { cle: 'prix', intitule: 'Prix vu', type: 'montant', requis: true },
              { cle: 'le', intitule: 'Relevé le', type: 'date', requis: true, defaut: versJour(maintenant.toISOString()) },
            ]}
            enregistrer={enregistrerReleve}
            elements={[...r.releves]
              .sort((a, b) => b.le.localeCompare(a.le))
              .slice(0, 60)
              .map((x) => ({
                id: x.id,
                libelle: `${nomDe(x.concurrentId)} · ${nomDe(x.prestationId)}`,
                detail: `${formatCentsCompact(x.prixCents)} · ${versJour(x.le)}`,
                valeurs: { concurrent: x.concurrentId, prestation: x.prestationId, prix: depuisCents(x.prixCents), le: versJour(x.le) },
              }))}
            supprimer={(id) => remove('competitorPrices', id)}
          />
        )}
      </Saisies>

      <Dominante
        surtitre={dernierReleve ? `Vos prix face au marché · relevé du ${dateReleve}` : 'Vos prix face au marché'}
        note={vide ? undefined : ['Cran plein = vous', ...r.concurrents.map((c) => `${c.initiale} ${c.nom}`)].join(' · ')}
      >
        {vide ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Chacune de vos prestations aura ici sa règle de prix, votre cran et les jetons des concurrents suivis. Un prix
            qui bouge laissera un trait entre son ancienne et sa nouvelle position.
          </p>
        ) : (
          <>
            {r.lignes.map((l) => (
              <div
                key={l.prestation.id}
                className="grid grid-cols-[minmax(0,1fr)_56px] items-center gap-x-3 gap-y-2 border-b border-border py-3.5 sm:grid-cols-[200px_minmax(0,1fr)_60px] sm:gap-[18px]"
              >
                <span className="min-w-0 max-sm:col-span-2">
                  <span className="block text-[13.5px] font-semibold text-text-primary">{l.prestation.nom}</span>
                  <span className="tnum mt-[3px] block font-mono text-[10px] text-text-muted">
                    {euros(l.basCents)} → {formatCentsCompact(l.hautCents)}
                  </span>
                </span>
                <span className="relative h-10">
                  <span className="absolute inset-x-0 top-[19px] h-0.5 bg-border-raised" />
                  {l.jetons.map((j) => {
                    const estAmbre = ambre?.ligne.prestation.id === l.prestation.id && ambre.jeton.concurrent.id === j.concurrent.id;
                    return (
                      <React.Fragment key={j.concurrent.id}>
                        {j.avant && (
                          <>
                            <span
                              data-signal-groupe={estAmbre ? 'passe-sous' : undefined}
                              className={`absolute top-[34px] h-[3px] ${estAmbre ? 'bg-signal shadow-[0_0_28px_-7px_var(--color-signal-glow)]' : 'bg-[#4a4a48]'}`}
                              style={{ left: `${Math.min(j.pct, j.avant.pct)}%`, width: `${Math.abs(j.pct - j.avant.pct)}%` }}
                            />
                            <span className="absolute top-7 h-3 w-px -translate-x-1/2 bg-[#4a4a48]" style={{ left: `${j.avant.pct}%` }} />
                          </>
                        )}
                        <span
                          data-signal-groupe={estAmbre ? 'passe-sous' : undefined}
                          title={`${j.concurrent.nom} · ${formatCentsCompact(j.prixCents)}`}
                          className={`absolute top-2 flex h-[22px] w-[22px] -translate-x-1/2 items-center justify-center rounded-full border font-mono text-[9.5px] font-bold ${
                            estAmbre ? 'border-signal bg-signal text-signal-ink' : 'border-border-strong bg-[#1a1a1a] text-text-secondary'
                          }`}
                          style={{ left: `${j.pct}%` }}
                        >
                          {j.concurrent.initiale}
                        </span>
                      </React.Fragment>
                    );
                  })}
                  <span className="absolute inset-y-0 w-[3px] -translate-x-1/2 bg-text-primary" style={{ left: `${l.vousPct}%` }} />
                </span>
                <span className="tnum text-right font-mono text-[15px] font-bold text-text-primary">{formatCentsCompact(l.prestation.votrePrixCents)}</span>
              </div>
            ))}

            <PiedDominante
              action={
                ambre ? (
                  edition === null ? (
                    <BoutonSecondaire onClick={() => setEdition(String(ambre.ligne.prestation.votrePrixCents / 100))}>Revoir ce tarif</BoutonSecondaire>
                  ) : (
                    <span className="flex items-center gap-2">
                      <input
                        value={edition}
                        onChange={(e) => setEdition(e.target.value)}
                        inputMode="decimal"
                        aria-label={`Votre prix pour ${ambre.ligne.prestation.nom}, en euros`}
                        className="input-focus h-11 w-24 border border-border-strong bg-sunken px-2.5 text-right font-mono text-[13px] text-text-primary outline-none sm:h-[30px]"
                      />
                      <BoutonPrimaire onClick={() => void enregistrer(ambre.ligne.prestation.id)}>Enregistrer</BoutonPrimaire>
                    </span>
                  )
                ) : undefined
              }
            >
              {ambre && ambre.jeton.avant
                ? `${ambre.jeton.concurrent.nom} a ${ambre.jeton.prixCents < ambre.jeton.avant.prixCents ? 'baissé' : 'changé'} son prix « ${ambre.ligne.prestation.nom} » de ${euros(ambre.jeton.avant.prixCents)} à ${formatCentsCompact(ambre.jeton.prixCents)}, sous vos ${formatCentsCompact(ambre.ligne.prestation.votrePrixCents)}.`
                : semaine.length
                  ? 'Les prix qui ont bougé cette semaine restent au-dessus des vôtres.'
                  : 'Aucun prix n’a bougé cette semaine.'}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Les mouvements · 30 jours" note={mv.length ? 'Concurrent · prestation' : undefined}>
          {mv.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun prix n’a bougé sur trente jours.</p>
          ) : (
            mv.map(({ ligne, jeton }, i) => (
              <LigneRegistre key={`${ligne.prestation.id}-${jeton.concurrent.id}`} colonnes="minmax(0,120px) minmax(0,1fr) auto" derniere={i === mv.length - 1}>
                <span className="min-w-0 text-[13.5px] text-text-primary">{jeton.concurrent.nom}</span>
                <span className="min-w-0 font-mono text-[11.5px] text-text-secondary">{ligne.prestation.nom}</span>
                <span className="tnum whitespace-nowrap text-right font-mono text-[11.5px] text-text-secondary">
                  {euros(jeton.avant?.prixCents ?? jeton.prixCents)} → {formatCentsCompact(jeton.prixCents)}
                </span>
              </LigneRegistre>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="La veille"
          releves={[
            { label: 'Concurrents', valeur: r.concurrents.length },
            { label: 'Prix relevés', valeur: r.lignes.reduce((s, l) => s + l.jetons.length, 0) },
            { label: 'Votre position', valeur: position ?? '—' },
          ]}
        >
          Les prix sont relevés sur les pages publiques des concurrents, une fois par semaine.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
