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
  ENCRE_SURTITRE_PLAQUE,
  Ecran50,
  LigneBarre,
  PiedDominante,
  donnees,
} from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import { medianeNombres } from '../lib/cinquante/marketing';
import {
  type DocumentPartage,
  type EnregistrementPartage,
  type Papillon,
  agePapillon,
  appliquer,
  initiales,
  papillonEnAmbre,
} from '../lib/cinquante/ajouts';
import { useLangue } from '../i18n';

/**
 * ÉDITEUR PARTAGÉ — les papillons (`39g`).
 *
 * Le document est une page, et la marge est à tous. Chaque proposition est un
 * papillon collé en face du paragraphe qu'il vise, un peu de travers : ses
 * initiales, son auteur, la modification proposée, son âge. Le texte ne
 * change qu'à l'acceptation ; plusieurs papillons sur un même paragraphe
 * s'empilent, et deux papillons contradictoires restent tous deux visibles.
 *
 * Le papillon est aligné sur son paragraphe EN FLUX — une rangée de grille
 * par paragraphe, jamais en position absolue : il descend avec le texte.
 */

type P = Papillon & { id: string; updatedAt: string };
type D = DocumentPartage & { id: string; updatedAt: string };

function PapillonColle({ p, ambre, rang, maintenant }: { p: P; ambre: boolean; rang: number; maintenant: Date }) {
  return (
    <div
      data-signal-groupe={ambre ? 'papillon' : undefined}
      className={`px-[11px] py-[9px] ${ambre ? 'bg-signal shadow-[0_0_28px_-7px_rgba(208,154,74,.85)]' : 'bg-[#e4e1c9] shadow-[0_6px_14px_-8px_rgba(0,0,0,.9)]'}`}
      style={{ transform: `rotate(${ambre ? -1 : rang % 2 ? -1 : 1}deg)` }}
    >
      <span className="flex justify-between gap-2">
        <span className="font-mono text-[9.5px] font-bold text-[#1a1a1a]">
          {initiales(p.auteur)} · {p.auteur.split(/\s+/)[0]}
        </span>
        <span className={`tnum whitespace-nowrap font-mono text-[9.5px] ${ambre ? `font-bold ${ENCRE_SURTITRE_PLAQUE}` : 'text-[#5c5a55]'}`}>{agePapillon(p.poseLe, maintenant)}</span>
      </span>
      <span className="mt-1 block text-[12px] leading-[1.4] text-[#1a1a1a]">{p.note}</span>
    </div>
  );
}

export function EditeurPartageScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const tout = useCollection<EnregistrementPartage>('sharedDocs');
  const [maintenant] = useState(() => new Date());
  const [reponse, setReponse] = useState(false);
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const documents = useMemo(() => tout.filter((e): e is D => e.kind === 'document'), [tout]);
  const papillons = useMemo(() => tout.filter((e): e is P => e.kind === 'papillon'), [tout]);
  const enAttente = papillons.filter((p) => p.statut === 'attente');
  const ambre = papillonEnAmbre(enAttente, maintenant);
  /* Le document montré : celui du papillon en ambre ; sinon celui qui a le plus de papillons en attente. */
  const doc =
    documents.find((d) => d.id === ambre?.documentId) ??
    [...documents].sort((a, b) => enAttente.filter((p) => p.documentId === b.id).length - enAttente.filter((p) => p.documentId === a.id).length)[0] ??
    null;
  const vide = documents.length === 0;

  const voisins = ambre ? enAttente.filter((p) => p.id !== ambre.id && p.paragrapheId === ambre.paragrapheId && p.documentId === ambre.documentId) : [];

  const repondre = async (accepte: boolean) => {
    if (!ambre || !doc) return;
    const le = new Date().toISOString();
    await upsert('sharedDocs', ambre.id, { ...donnees(ambre), statut: accepte ? 'acceptee' : 'refusee', reponduLe: le });
    if (accepte) {
      await upsert('sharedDocs', doc.id, {
        ...donnees(doc),
        paragraphes: doc.paragraphes.map((q) => (q.id === ambre.paragrapheId ? { ...q, texte: appliquer(q.texte, ambre) } : q)),
      });
      /* « Répondre à la première règle les deux » : la proposition concurrente sur le même passage tombe. */
      for (const v of voisins.filter((x) => x.cible && x.cible === ambre.cible)) {
        await upsert('sharedDocs', v.id, { ...donnees(v), statut: 'caduque', reponduLe: le });
      }
    }
    setReponse(false);
  };

  const moisIso = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`;
  const duMois = papillons.filter((p) => p.poseLe.startsWith(moisIso));
  const redacteurs = new Set(duMois.map((p) => p.auteur)).size;
  const acceptees = papillons.filter((p) => p.statut === 'acceptee' && p.reponduLe?.startsWith(moisIso)).length;
  const delais = papillons.filter((p) => p.reponduLe?.startsWith(moisIso)).map((p) => (new Date(p.reponduLe as string).getTime() - new Date(p.poseLe).getTime()) / 86_400_000);
  const mediane = delais.length ? Math.round(medianeNombres(delais.map((d) => Math.round(d * 10))) / 10) : null;
  const maxAttente = Math.max(1, ...documents.map((d) => enAttente.filter((p) => p.documentId === d.id).length));

  const nomDe = (p: Papillon) => p.auteur.split(/\s+/)[0];
  const joursAmbre = ambre ? Math.floor((maintenant.getTime() - new Date(ambre.poseLe).getTime()) / 86_400_000) : 0;
  const pied = ambre
    ? `La proposition de ${nomDe(ambre)} attend depuis ${L(joursAmbre)} jours${
        voisins.length
          ? `, et ${voisins.length === 1 ? `celle de ${nomDe(voisins[0])}, arrivée ensuite,` : `${L(voisins.length)} autres, arrivées ensuite,`} vise${voisins.length > 1 ? 'nt' : ''} la même phrase. Répondre à la première règle ${voisins.length === 1 ? 'les deux' : 'le paragraphe'}.`
          : '.'
      }`
    : enAttente.length
      ? `${L(enAttente.length, true)} papillon${enAttente.length > 1 ? 's' : ''} en attente, aucun depuis plus de trois jours.`
      : 'Aucune proposition en attente : le document est à jour.';

  const auteursDoc = doc ? new Set(papillons.filter((p) => p.documentId === doc.id).map((p) => p.auteur)).size : 0;
  const description = vide
    ? t('m50.sharedEditor.descriptionVide')
    : auteursDoc > 1
      ? t('m50.sharedEditor.description', { n: L(auteursDoc) })
      : t('m50.sharedEditor.descriptionSeul');

  return (
    <Ecran50 vide={vide} premierJour={vide}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.documents'), module: t('m50.sharedEditor.titre') })}
          title={t('m50.sharedEditor.titre')}
          description={description}
          phraseVide={t('m50.sharedEditor.phraseVide')}
        />
      </Bloc>

      <Dominante surtitre="Le document et sa marge" note={doc ? 'Papillon = proposition en attente' : undefined}>
        {!doc ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Un document partagé s’ouvrira ici comme une page ; chaque proposition y sera collée dans la marge, en face du
            paragraphe visé, en attente d’un oui ou d’un non.
          </p>
        ) : (
          <>
            <div className="bg-[#e8e6e0] px-5 py-[22px] shadow-[0_30px_60px_-26px_rgba(0,0,0,1)] sm:px-6">
              <span className="mb-3.5 block text-[16px] font-bold text-[#0a0a0a]">{doc.titre}</span>
              {doc.paragraphes.map((q) => {
                const siens = enAttente.filter((p) => p.documentId === doc.id && p.paragrapheId === q.id).sort((a, b) => a.poseLe.localeCompare(b.poseLe));
                return (
                  <div key={q.id} className="grid items-start gap-x-[22px] gap-y-2 border-t border-[#d4d2cc] py-2.5 md:grid-cols-[minmax(0,1fr)_230px]">
                    <p className="m-0 text-[13.5px] leading-[1.6] text-[#1a1a1a] [text-wrap:pretty]">{q.texte}</p>
                    <div className="flex flex-col gap-[7px]">
                      {siens.map((p, i) => (
                        <PapillonColle key={p.id} p={p} ambre={p.id === ambre?.id} rang={i} maintenant={maintenant} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <PiedDominante
              action={
                ambre ? (
                  reponse ? (
                    <span className="flex flex-wrap gap-2">
                      <BoutonSecondaire onClick={() => void repondre(false)}>Refuser</BoutonSecondaire>
                      <BoutonPrimaire onClick={() => void repondre(true)}>Accepter</BoutonPrimaire>
                    </span>
                  ) : (
                    <BoutonSecondaire onClick={() => setReponse(true)}>Répondre à {nomDe(ambre)}</BoutonSecondaire>
                  )
                ) : undefined
              }
            >
              {pied}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Les documents partagés" note={vide ? undefined : 'Papillons en attente'}>
          {vide ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun document partagé.</p>
          ) : (
            documents.map((d, i) => {
              const n = enAttente.filter((p) => p.documentId === d.id).length;
              return <LigneBarre key={d.id} nom={d.titre.split(' · ')[0]} part={n / maxAttente} valeur={n || 'aucun'} derniere={i === documents.length - 1} />;
            })
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Le mois"
          releves={[
            { label: 'Rédacteurs', valeur: redacteurs },
            { label: 'Acceptées', valeur: acceptees },
            { label: 'Réponse médiane', valeur: mediane === null ? '—' : `${mediane} j` },
          ]}
        >
          Un papillon refusé reste consultable dans l’historique, avec son auteur.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
