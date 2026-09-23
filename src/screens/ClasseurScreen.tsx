import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Bloc, BoutonSecondaire, Calmes, CarteCalme, CarteReleves, Dominante, Ecran50, LigneRegistre, PiedDominante, donnees } from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import {
  type DocumentClasseur,
  type EnregistrementClasseur,
  type ParagraphePalimpseste,
  type VersionClasseur,
  palimpseste,
} from '../lib/cinquante/ajouts';
import { useLangue } from '../i18n';

/**
 * CLASSEUR — le palimpseste (`39f`).
 *
 * Le document courant est rendu sur papier, et les versions précédentes
 * transparaissent sous lui, pâles et barrées, exactement là où le texte a
 * changé. Dans la marge, chaque réécriture porte sa version et son auteur ;
 * au-dessus, la frise des versions situe la signature.
 *
 * « Une version signée est figée » : les versions sont des enregistrements
 * distincts, jamais réécrits — on en dépose une nouvelle. L'écart entre la
 * version signée et la version courante passe en ambre.
 */

const MOIS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const date = (iso: string) => `${new Date(iso).getDate()} ${MOIS[new Date(iso).getMonth()]}`;
const prenom = (nom: string) => nom.split(/\s+/)[0];
const place = (octets: number) =>
  octets >= 1e9 ? `${(octets / 1e9).toFixed(1).replace('.', ',')} Go` : octets >= 1e6 ? `${Math.round(octets / 1e6)} Mo` : `${Math.max(1, Math.round(octets / 1e3))} Ko`;
/** « Art. 4 · Prix » → « Art. 4 ». */
const article = (titre: string) => titre.split(' · ')[0];

function Paragraphe({ p, ambre }: { p: ParagraphePalimpseste; ambre: boolean }) {
  return (
    <p
      className={`m-0 text-[13px] leading-[1.6] text-[#1a1a1a] ${
        ambre ? 'bg-[rgba(208,154,74,.28)] shadow-[0_0_28px_-7px_rgba(208,154,74,.85)] outline outline-2 outline-offset-[3px] outline-signal' : ''
      }`}
    >
      <b>{p.titre}.</b>{' '}
      {p.phrases.map((ph, i) => (
        <React.Fragment key={i}>
          {i > 0 && ' '}
          {ph.tete}
          {ph.couches.map((c, k) => (
            <React.Fragment key={k}>
              {(ph.tete || k > 0) && ' '}
              <s className={c.apresSignature ? 'text-[#5e4f36]' : 'text-[#67655e]'}>{c.texte}</s>
            </React.Fragment>
          ))}
          {ph.couches.length > 0 && ph.actuel && ` ${ph.actuel}`}
          {ph.queue && (ph.couches.length ? ` ${ph.queue}` : '')}
        </React.Fragment>
      ))}
    </p>
  );
}

export function ClasseurScreen() {
  const { t } = useLangue();
  const { upsert } = useSync();
  const tout = useCollection<EnregistrementClasseur>('documentVersions');
  const [maintenant] = useState(() => new Date());

  const documents = useMemo(() => tout.filter((e): e is DocumentClasseur & { id: string; updatedAt: string } => e.kind === 'document'), [tout]);
  const versions = useMemo(() => tout.filter((e): e is VersionClasseur & { id: string; updatedAt: string } => e.kind === 'version'), [tout]);
  const versionsDe = (id: string) => versions.filter((v) => v.documentId === id).sort((a, b) => a.numero - b.numero);

  const lus = documents.map((d) => {
    const vs = versionsDe(d.id);
    const pal = palimpseste(vs, d.signeeVersion ?? null);
    return { d, vs, pal, apresSignature: pal.some((p) => p.apresSignature), dernier: vs[vs.length - 1]?.deposeLe ?? '' };
  });
  /* Le document montré : celui dont la version courante s'écarte de la signée ; sinon le plus récent. */
  const courant = lus.find((x) => x.apresSignature) ?? [...lus].sort((a, b) => b.dernier.localeCompare(a.dernier))[0] ?? null;
  const vide = documents.length === 0;
  const derniere = courant?.vs[courant.vs.length - 1] ?? null;
  const ambreP = courant?.pal.find((p) => p.apresSignature) ?? null;

  const moisIso = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`;
  const versionsMois = versions.filter((v) => v.deposeLe.startsWith(moisIso)).length;
  const octets = versions.reduce((s, v) => s + (v.octets || 0), 0);

  const envoyer = async () => {
    if (!courant) return;
    await upsert('documentVersions', courant.d.id, { ...donnees(courant.d), envoyeeASignerLe: new Date().toISOString() });
  };

  const etat = (x: (typeof lus)[number]) => (x.d.signeeVersion ? `v${x.d.signeeVersion} signée` : x.d.etat ?? 'brouillon');

  const pied = (() => {
    if (!courant || !derniere) return '';
    if (!courant.d.signeeVersion) return `Version ${derniere.numero}, déposée par ${prenom(derniere.auteur)} le ${date(derniere.deposeLe)}. Aucune version n’est signée.`;
    const s = courant.d.signeeVersion;
    if (!ambreP) return `${courant.d.signataire ?? 'Le client'} a signé la version ${s}, qui est la version courante.`;
    const changees = ambreP.phrases.flatMap((ph) => ph.couches.filter((c) => c.apresSignature).map((c) => ({ avant: c.texte, apres: ph.actuel })));
    const ch = changees[changees.length - 1];
    return `${courant.d.signataire ?? 'Le client'} a signé la version ${s}${ch ? `, à « ${ch.avant} »` : ''}. La version ${derniere.numero} porte ${
      ch ? `« ${ch.apres} »` : 'un autre texte'
    } : ce changement n’engage le client que s’il signe à nouveau.${courant.d.envoyeeASignerLe ? ` La v${derniere.numero} est partie à signer le ${date(courant.d.envoyeeASignerLe)}.` : ''}`;
  })();

  const description = vide
    ? t('m50.binder.descriptionVide')
    : courant?.apresSignature
      ? t('m50.binder.description')
      : t('m50.binder.descriptionSansEcart');

  return (
    <Ecran50 vide={vide} premierJour={vide}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.documents'), module: t('m50.binder.titre') })}
          title={t('m50.binder.titre')}
          description={description}
          phraseVide={t('m50.binder.phraseVide')}
        />
      </Bloc>

      <Dominante surtitre="Le document et ses couches" note={courant ? 'Pâle et barré = texte d’une version antérieure' : undefined}>
        {!courant || !derniere ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Chaque document déposé gardera ici la trace de ses versions : sous le texte actuel, les versions antérieures
            transparaîtront là où elles différaient.
          </p>
        ) : (
          <>
            <div className="mb-[18px] flex flex-wrap items-center gap-1.5">
              {courant.vs.map((v, i) => {
                const signee = v.numero === courant.d.signeeVersion;
                const cour = i === courant.vs.length - 1;
                return (
                  <React.Fragment key={v.id}>
                    {i > 0 && <span className="h-px w-3.5 bg-[#2b2b2b]" aria-hidden />}
                    <span
                      className={`border px-2.5 py-[5px] font-mono text-[11px] font-semibold ${
                        signee ? 'border-text-body text-text-primary' : cour ? 'border-[#4a4a48] bg-[#1e1e1e] text-text-primary' : 'border-[#2b2b2b] text-text-muted'
                      }`}
                    >
                      v{v.numero}
                      {signee ? ' · signée' : ''}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>

            {/*
              Le papier est un fond posé derrière la colonne de gauche : chaque
              note de marge reste ainsi sur la même rangée que son paragraphe
              (une rangée de grille par paragraphe), hors du papier sur écran
              large, dessous au téléphone.
            */}
            <div className="relative grid gap-x-6 px-5 py-6 sm:px-[26px] md:grid-cols-[minmax(0,1fr)_200px] md:pr-0">
              <span className="absolute inset-y-0 left-0 right-0 bg-[#e8e6e0] shadow-[0_30px_60px_-26px_rgba(0,0,0,1)] md:right-[224px]" aria-hidden />
              <span className="relative mb-3.5 block bg-[#e8e6e0] text-[16px] font-bold text-[#0a0a0a] md:col-span-1">{courant.d.titre}</span>
              <span className="max-md:hidden" />
              {courant.pal.map((p, i) => {
                const a = p === ambreP;
                const derniereR = p.reecritures[p.reecritures.length - 1];
                const bas = i === courant.pal.length - 1 ? '' : 'pb-3';
                return (
                  <React.Fragment key={p.titre}>
                    <div className={`relative bg-[#e8e6e0] ${bas}`} data-signal-groupe={a ? 'ecart' : undefined}>
                      <Paragraphe p={p} ambre={a} />
                    </div>
                    {derniereR ? (
                      a ? (
                        <span className={`relative mb-3 self-start border-2 border-signal bg-[#1c1408] px-[11px] py-2.5 md:mb-0 ${bas}`} data-signal-groupe="ecart">
                          <span className="block font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-signal">
                            Modifié en v{derniereR.vers} · la v{courant.d.signeeVersion} est signée
                          </span>
                          <span className="mt-1 block text-[12px] text-text-body">
                            {prenom(derniereR.auteur)}, {date(derniereR.le)}
                          </span>
                        </span>
                      ) : (
                        <span className={`relative mb-3 self-start max-md:bg-[#e8e6e0] md:mb-0 ${bas}`}>
                          <span className="block font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#5c5a55] md:text-text-muted">
                            {article(p.titre)} · v{derniereR.de} → v{derniereR.vers}
                          </span>
                          <span className="mt-[3px] block text-[12px] text-[#5c5a55] md:text-text-secondary">
                            {prenom(derniereR.auteur)}, {date(derniereR.le)}
                          </span>
                        </span>
                      )
                    ) : (
                      <span className="max-md:hidden" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <PiedDominante
              action={
                ambreP && !courant.d.envoyeeASignerLe ? <BoutonSecondaire onClick={() => void envoyer()}>Envoyer la v{derniere.numero} à signer</BoutonSecondaire> : undefined
              }
            >
              {pied}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Le classeur" note={vide ? undefined : 'Versions · état'}>
          {vide ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun document déposé.</p>
          ) : (
            lus.map((x, i) => (
              <LigneRegistre key={x.d.id} colonnes="minmax(0,1fr) 40px auto" derniere={i === lus.length - 1}>
                <span className="min-w-0 text-[13.5px] text-text-primary">{x.d.titre}</span>
                <span className="tnum font-mono text-[11.5px] text-text-secondary">{x.vs.length}</span>
                <span className="text-right font-mono text-[11.5px] text-text-secondary">{etat(x)}</span>
              </LigneRegistre>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Le classeur"
          releves={[
            { label: 'Documents', valeur: documents.length },
            { label: 'Versions ce mois', valeur: versionsMois },
            { label: 'Place', valeur: place(octets) },
          ]}
        >
          Une version n’est jamais effacée : on en dépose une nouvelle.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
