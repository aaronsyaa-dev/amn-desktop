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
} from '../components/cinquante-kit';
import { SaisieModule, Saisies, versIso, versJour, versNombre } from '../components/SaisieModule';
import { uid, useCollection, useSync } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import { COURONNE, type DemandeRgpd, type EnregistrementRgpd, type Purge, type Revue, type Traitement, empreinte, positionCouronne } from '../lib/cinquante/juridique';
import type { Id } from '../lib/cinquante/guichet';
import { useLangue } from '../i18n';

/**
 * RGPD — l'empreinte d'une personne (`38c`).
 *
 * Le registre lu DEPUIS une personne : elle au centre, et autour les modules
 * qui détiennent réellement ses données — trouvés par une requête sur leurs
 * collections, « jamais d'une liste type ». Positions en couronne :
 * `50 % + 34 % · cos θ`, `190 + 140 · sin θ` dans un conteneur de 380 px.
 *
 * L'ambre : le module qui garde une donnée au-delà de la durée du registre.
 * La purge est PROPOSÉE (deux gestes), jamais automatique — et jamais sur une
 * donnée liée à une facture.
 */

type Ligne = { id: string; texte: string; date: string | null; description?: string };
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const initiales = (n: string) =>
  n
    .split(/\s+/)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase() ?? '')
    .join('');
const pluriel = (n: number, s: string) => `${n} ${s}${n > 1 ? 's' : ''}`;

export function RgpdScreen() {
  const { t, langue } = useLangue();
  const { upsert, remove } = useSync();
  const tout = useCollection<EnregistrementRgpd>('gdprRegister');
  /* Les collections que le registre peut nommer — lues pour de vrai. */
  const clients = useCollection<{ name: string; company: string; email: string; phone: string; createdAt: string }>('clients');
  const factures = useCollection<{ billTo?: { name?: string; company?: string }; issuedAt?: string; number?: string }>('invoices');
  const appels = useCollection<{ kind: string; appelant?: string; debutLe?: string }>('switchboardCalls');
  const contrats = useCollection<{ party?: string; title?: string; startsAt?: string; createdAt?: string }>('contracts');
  const nps = useCollection<{ kind: string; client?: string; le?: string }>('npsResponses');
  const acomptes = useCollection<{ client?: string; envoyeLe?: string }>('depositQuotes');
  const [maintenant] = useState(() => new Date());
  const [aConfirmer, setAConfirmer] = useState(false);
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const traitements = tout.filter((e): e is Id<Traitement> & { updatedAt: string } => e.kind === 'traitement');
  const demandes = tout.filter((e): e is Id<DemandeRgpd> & { updatedAt: string } => e.kind === 'demande').sort((a, b) => b.le.localeCompare(a.le));
  const purges = tout.filter((e): e is Id<Purge> & { updatedAt: string } => e.kind === 'purge');
  const revue = tout.filter((e): e is Id<Revue> & { updatedAt: string } => e.kind === 'revue').sort((a, b) => b.le.localeCompare(a.le))[0] ?? null;
  const personne = demandes[0]?.personne ?? null;

  const sources = useMemo<Record<string, Ligne[]>>(
    () => ({
      clients: clients.map((c) => ({ id: c.id, texte: `${c.name} ${c.company}`, date: c.createdAt ?? null, description: [c.name && 'nom', c.email && 'courriel', c.phone && 'téléphone'].filter(Boolean).join(', ') })),
      invoices: factures.map((f) => ({ id: f.id, texte: `${f.billTo?.name ?? ''} ${f.billTo?.company ?? ''}`, date: f.issuedAt || null, description: 'factures, paiements' })),
      switchboardCalls: appels.filter((a) => a.kind === 'appel').map((a) => ({ id: a.id, texte: a.appelant ?? '', date: a.debutLe ?? null, description: 'enregistrements d’appel' })),
      contracts: contrats.map((c) => ({ id: c.id, texte: `${c.party ?? ''} ${c.title ?? ''}`, date: c.startsAt ?? c.createdAt ?? null, description: 'contrat' })),
      npsResponses: nps.filter((r) => r.kind === 'reponse').map((r) => ({ id: r.id, texte: r.client ?? '', date: r.le ?? null, description: 'réponses au sondage' })),
      depositQuotes: acomptes.map((d) => ({ id: d.id, texte: d.client ?? '', date: d.envoyeLe ?? null, description: 'devis signés' })),
    }),
    [clients, factures, appels, contrats, nps, acomptes],
  );
  const e = useMemo(() => (personne ? empreinte(personne, traitements, sources, maintenant) : null), [personne, traitements, sources, maintenant]);
  const vide = traitements.length === 0;
  const a = e?.ambre ?? null;
  const n = e?.trouves.length ?? 0;
  const dePurger = a ? a.x.ids.filter((id) => {
    const l = (sources[a.x.traitement.collection] ?? []).find((x) => x.id === id);
    return l?.date && (maintenant.getTime() - new Date(l.date).getTime()) / 86_400_000 > (a.x.traitement.dureeJours ?? Infinity);
  }) : [];

  const purger = async () => {
    if (!a || a.x.traitement.lieAFacture || dePurger.length === 0) return;
    for (const id of dePurger) await remove(a.x.traitement.collection as never, id);
    await upsert('gdprRegister', `purge-${Date.now().toString(36)}`, { kind: 'purge', collection: a.x.traitement.collection, nombre: dePurger.length, le: new Date().toISOString() } satisfies Purge);
    setAConfirmer(false);
  };

  /*
    SAISIE — le registre se tient à la main : chaque traitement nomme les
    données du produit qu'il couvre (ce que l'empreinte ira lire), sa base
    légale et sa durée. Puis chaque demande reçue d'une personne.
  */
  const DONNEES: Array<{ valeur: string; libelle: string; module: string; nom: string }> = [
    { valeur: 'clients', libelle: 'Fiches clients', module: 'Clients', nom: 'Gestion de la clientèle' },
    { valeur: 'invoices', libelle: 'Factures', module: 'Facturation', nom: 'Facturation et comptabilité' },
    { valeur: 'contracts', libelle: 'Contrats', module: 'Contrats', nom: 'Gestion des contrats' },
    { valeur: 'depositQuotes', libelle: 'Devis et acomptes', module: 'Acompte', nom: 'Devis signés' },
    { valeur: 'switchboardCalls', libelle: 'Appels du standard', module: 'Standard', nom: 'Enregistrement des appels' },
    { valeur: 'npsResponses', libelle: 'Réponses au sondage', module: 'NPS', nom: 'Mesure de la satisfaction' },
  ];
  const enregistrerTraitement = async (v: Record<string, string>, id?: string) => {
    const d = DONNEES.find((x) => x.valeur === v.collection) ?? DONNEES[0];
    const ans = versNombre(v.duree);
    await upsert('gdprRegister', id ?? uid(), {
      kind: 'traitement',
      nom: v.nom.trim() || d.nom,
      module: d.module,
      collection: d.valeur,
      baseLegale: v.baseLegale,
      dureeJours: ans && ans > 0 ? Math.round(ans * 365) : null,
      dureeLibelle: ans && ans > 0 ? `${String(ans).replace('.', ',')} an${ans > 1 ? 's' : ''}` : 'le temps de la relation',
      ...(d.valeur === 'invoices' ? { lieAFacture: true } : {}),
    });
  };
  const enregistrerDemande = async (v: Record<string, string>, id?: string) => {
    await upsert('gdprRegister', id ?? uid(), { kind: 'demande', personne: v.personne.trim(), type: v.type, le: versIso(v.le) });
  };

  const description = vide
    ? t('m50.gdpr.descriptionVide')
    : a
      ? t('m50.gdpr.description')
      : t('m50.gdpr.descriptionDansLesTemps');

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.juridique'), module: t('m50.gdpr.titre') })}
          title={t('m50.gdpr.titre')}
          description={description}
          phraseVide={t('m50.gdpr.phraseVide')}
        />
      </Bloc>

      <Saisies>
        <SaisieModule
          ajouter="Ajouter un traitement au registre"
          ouvertParDefaut={vide}
          surtitreListe="Le registre"
          champs={[
            { cle: 'collection', intitule: 'Données concernées', type: 'choix', requis: true, options: DONNEES.map((d) => ({ valeur: d.valeur, libelle: d.libelle })) },
            { cle: 'nom', intitule: 'Nom du traitement', type: 'texte', aide: 'Vide : « Gestion de la clientèle », « Facturation »… selon les données.' },
            {
              cle: 'baseLegale',
              intitule: 'Base légale',
              type: 'choix',
              requis: true,
              options: ['Exécution du contrat', 'Obligation légale', 'Intérêt légitime', 'Consentement'].map((b) => ({ valeur: b, libelle: b })),
            },
            { cle: 'duree', intitule: 'Conservation', type: 'nombre', suffixe: 'ans', aide: 'Vide : le temps de la relation. Factures : 10 ans.' },
          ]}
          enregistrer={enregistrerTraitement}
          elements={traitements.map((x) => ({
            id: x.id,
            libelle: x.nom,
            detail: `${x.baseLegale} · ${x.dureeLibelle}`,
            valeurs: { collection: x.collection, nom: x.nom, baseLegale: x.baseLegale, duree: x.dureeJours ? String(Math.round((x.dureeJours / 365) * 10) / 10).replace('.', ',') : '' },
          }))}
          supprimer={(id) => remove('gdprRegister', id)}
        />
        {traitements.length > 0 && (
          <SaisieModule
            ajouter="Noter une demande reçue"
            surtitreListe="Les demandes"
            champs={[
              { cle: 'personne', intitule: 'Personne', type: 'texte', requis: true, aide: 'Son nom tel qu’il figure dans vos fiches : l’empreinte le cherche partout.' },
              {
                cle: 'type',
                intitule: 'Elle demande',
                type: 'choix',
                options: [
                  { valeur: 'acces', libelle: 'L’accès à ses données' },
                  { valeur: 'effacement', libelle: 'L’effacement de ses données' },
                ],
              },
              { cle: 'le', intitule: 'Reçue le', type: 'date', requis: true, defaut: versJour(maintenant.toISOString()) },
            ]}
            enregistrer={enregistrerDemande}
            elements={demandes.map((d) => ({
              id: d.id,
              libelle: d.personne,
              detail: `${d.type === 'acces' ? 'accès' : 'effacement'} · ${versJour(d.le)}`,
              valeurs: { personne: d.personne, type: d.type, le: versJour(d.le) },
            }))}
            supprimer={(id) => remove('gdprRegister', id)}
          />
        )}
      </Saisies>

      <Dominante surtitre={personne ? `${personne} · demande d’accès` : 'L’empreinte d’une personne'} note={personne ? 'Ce que le produit garde, et combien de temps' : undefined}>
        {!personne || !e ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            À la première demande d’accès, la personne sera posée ici au centre, et autour d’elle chaque module qui garde
            quelque chose d’elle, avec la durée prévue au registre.
          </p>
        ) : n === 0 ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">Aucun module du registre ne garde de donnée sur {personne}.</p>
        ) : (
          <>
            <div className="relative max-md:hidden" style={{ height: COURONNE.hauteur }}>
              <svg viewBox={`0 0 1000 ${COURONNE.hauteur}`} preserveAspectRatio="none" className="absolute inset-0 w-full" style={{ height: COURONNE.hauteur }} aria-hidden>
                {e.trouves.map((x, i) => {
                  const p = positionCouronne(i, n);
                  const estA = a?.x === x;
                  return (
                    <line
                      key={x.traitement.collection}
                      data-signal-groupe={estA ? 'garde-trop' : undefined}
                      x1={500}
                      y1={COURONNE.centreY}
                      x2={p.xVb.toFixed(1)}
                      y2={p.y.toFixed(1)}
                      stroke={estA ? 'var(--color-signal)' : '#2b2b2b'}
                      strokeWidth={estA ? 2.4 : 1.4}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </svg>
              <div className="absolute left-1/2 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 border-[#4a4a48] bg-[#1e1e1e] text-center" style={{ top: COURONNE.centreY }}>
                <span className="font-mono text-[15px] font-bold text-text-primary">{initiales(personne)}</span>
                <span className="mt-1 px-2 text-[12px] text-text-secondary">{personne}</span>
              </div>
              {e.trouves.map((x, i) => {
                const p = positionCouronne(i, n);
                const estA = a?.x === x;
                return (
                  <div
                    key={x.traitement.collection}
                    data-signal-groupe={estA ? 'garde-trop' : undefined}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 px-3 py-2.5 ${estA ? 'border-2 border-signal bg-[#1c1408] shadow-[0_0_28px_-7px_var(--color-signal-glow)]' : 'border border-[#2b2b2b] bg-[#151515]'}`}
                    style={{ left: `${p.xPct}%`, top: p.y, width: COURONNE.carte }}
                  >
                    <span className="block text-[13px] font-semibold text-text-primary">{x.traitement.module}</span>
                    <span className="mt-0.5 block text-[11.5px] text-text-secondary">{x.nombre > 1 ? pluriel(x.nombre, 'élément') : x.description}{x.nombre > 1 && x.description ? ` · ${x.description}` : ''}</span>
                    <span className={`mt-1 block font-mono text-[9.5px] ${estA ? 'font-bold text-signal' : 'text-text-muted'}`}>
                      {estA && a ? `conservés ${a.ageJ} j · durée prévue ${x.traitement.dureeJours} j` : x.traitement.dureeLibelle}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Sur un téléphone ou une tablette étroite, la couronne devient une liste. */}
            <div className="flex flex-col gap-2 md:hidden">
              {e.trouves.map((x) => {
                const estA = a?.x === x;
                return (
                  <div key={x.traitement.collection} data-signal-groupe={estA ? 'garde-trop' : undefined} className={`px-3 py-2.5 ${estA ? 'border-2 border-signal bg-[#1c1408]' : 'border border-[#2b2b2b] bg-[#151515]'}`}>
                    <span className="block text-[13px] font-semibold text-text-primary">{x.traitement.module}</span>
                    <span className="block text-[11.5px] text-text-secondary">{x.description}</span>
                    <span className={`block font-mono text-[9.5px] ${estA ? 'font-bold text-signal' : 'text-text-muted'}`}>
                      {estA && a ? `conservés ${a.ageJ} j · durée prévue ${x.traitement.dureeJours} j` : x.traitement.dureeLibelle}
                    </span>
                  </div>
                );
              })}
            </div>

            <PiedDominante
              action={
                a && !a.x.traitement.lieAFacture && dePurger.length ? (
                  aConfirmer ? (
                    <span className="flex gap-2">
                      <BoutonPrimaire onClick={() => void purger()}>Confirmer la purge</BoutonPrimaire>
                      <BoutonSecondaire onClick={() => setAConfirmer(false)}>Annuler</BoutonSecondaire>
                    </span>
                  ) : (
                    <BoutonSecondaire onClick={() => setAConfirmer(true)}>Purger {pluriel(dePurger.length, 'enregistrement')}</BoutonSecondaire>
                  )
                ) : undefined
              }
            >
              {a
                ? `${a.x.traitement.module} garde des données de ${personne} depuis ${a.ageJ} jours, pour une durée prévue de ${a.x.traitement.dureeJours} jours.${
                    a.x.traitement.lieAFacture ? ' Ces données sont liées à une facture : elles ne se purgent pas d’un geste.' : aConfirmer ? ` La purge efface ${pluriel(dePurger.length, 'enregistrement')}, sans retour.` : ''
                  }`
                : `Chaque donnée gardée sur ${personne} est dans la durée prévue par le registre.`}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Le registre" note={traitements.length ? 'Base légale · durée' : undefined}>
          {traitements.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun traitement au registre.</p>
          ) : (
            traitements.map((x, i) => (
              <LigneRegistre key={x.id} colonnes="minmax(0,1fr) minmax(0,120px) auto" derniere={i === traitements.length - 1}>
                <span className="min-w-0 text-[13.5px] text-text-primary">{x.nom}</span>
                <span className="min-w-0 font-mono text-[11px] text-text-secondary">{x.baseLegale}</span>
                <span className="text-right font-mono text-[11px] text-text-secondary">{x.dureeLibelle}</span>
              </LigneRegistre>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Cette année"
          releves={[
            { label: 'Demandes d’accès', valeur: demandes.filter((d) => new Date(d.le).getFullYear() === maintenant.getFullYear()).length },
            { label: 'Données purgées', valeur: purges.filter((p) => new Date(p.le).getFullYear() === maintenant.getFullYear()).reduce((s, p) => s + p.nombre, 0) },
            { label: 'Dernière revue', valeur: revue ? MOIS[new Date(revue.le).getMonth()] : '—' },
          ]}
        >
          {`${L(traitements.length, true)} traitement${traitements.length > 1 ? 's' : ''} au registre. Une demande d’accès doit être satisfaite sous un mois.`}
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
