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
import { SaisieModule, depuisCents, versCents, versIso, versJour } from '../components/SaisieModule';
import { uid, useCollection, useSync } from '../state/SyncContext';
import { formatCents } from '../lib/money';
import { enLettres } from '../lib/cinquante/lettres';
import { CONFIANCE_MIN, type LigneTicket, type NoteDeFrais, bloquant, champAmbre, champsLisibles } from '../lib/cinquante/finance';
import { useLangue } from '../i18n';

/**
 * NOTES DE FRAIS — la lecture (`36h`).
 *
 * Le ticket redressé, sur papier clair, à l'échelle de lecture : chaque zone
 * comprise y est cerclée et numérotée ; à droite, les champs reprennent ces
 * numéros avec la valeur lue et sa confiance en barre. On ne vérifie pas un
 * formulaire, on vérifie une LECTURE, sur le document même.
 *
 * « Chaque champ extrait est relié à une zone du ticket : un champ sans zone
 * n'est jamais pré-rempli. » Sous 70 % de confiance, le champ est ambre et
 * bloque la validation jusqu'à ce qu'on le confirme.
 */

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function Ticket({ lignes, ambre }: { lignes: LigneTicket[]; ambre: number | null }) {
  return (
    <div className="ml-[26px] flex w-[250px] max-w-[calc(100%-26px)] flex-col gap-[9px] bg-[#e8e6e0] px-[22px] pb-[26px] pt-[22px] shadow-[0_30px_60px_-26px_rgba(0,0,0,1)]">
      {lignes.map((l, i) => {
        if (l.style === 'filet') return <span key={i} className="my-1 h-px bg-[#c4c2bc]" />;
        const corps = l.style === 'fort' ? 'text-[13px] font-bold' : l.style === 'petit' ? 'text-[10px] text-[#5c5a55]' : 'text-[11px]';
        const contenu = l.droite ? (
          <span className="flex justify-between gap-2">
            <span>{l.texte}</span>
            <span>{l.droite}</span>
          </span>
        ) : (
          l.texte
        );
        if (l.zone === undefined) {
          return (
            <span key={i} className={`font-mono text-[#1a1a1a] ${corps}`}>
              {contenu}
            </span>
          );
        }
        const a = l.zone === ambre;
        return (
          <div
            key={i}
            data-signal-groupe={a ? 'lecture-incertaine' : undefined}
            className={`relative -mx-1.5 px-1.5 py-[3px] font-mono text-[#1a1a1a] ${corps} ${
              a ? 'shadow-[0_0_28px_-7px_var(--color-signal-glow)] outline outline-2 outline-signal' : 'outline outline-[1.5px] outline-[#0a0a0a]'
            }`}
          >
            <span
              className={`absolute -left-[7px] top-1/2 flex h-[18px] w-[18px] -translate-x-full -translate-y-1/2 items-center justify-center rounded-full font-mono text-[9px] font-bold ${
                a ? 'bg-signal text-signal-ink' : 'bg-[#0a0a0a] text-[#e8e6e0]'
              }`}
            >
              {l.zone}
            </span>
            {contenu}
          </div>
        );
      })}
    </div>
  );
}

export function NotesDeFraisScreen() {
  const { t, langue } = useLangue();
  const { upsert, remove } = useSync();
  const notes = useCollection<NoteDeFrais>('expenseClaims');
  const [maintenant] = useState(() => new Date());
  const [choisie, setChoisie] = useState<string | null>(null);
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const aVerifier = useMemo(() => notes.filter((n) => n.statut === 'a-verifier').sort((a, b) => b.le.localeCompare(a.le)), [notes]);
  const note = notes.find((n) => n.id === choisie) ?? aVerifier.find((n) => champAmbre(n)) ?? aVerifier[0] ?? [...notes].sort((a, b) => b.le.localeCompare(a.le))[0] ?? null;
  const vide = notes.length === 0;
  const ambre = note ? champAmbre(note) : null;
  const champs = note ? champsLisibles(note) : [];
  const duMois = notes.filter((n) => new Date(n.le).getMonth() === maintenant.getMonth() && new Date(n.le).getFullYear() === maintenant.getFullYear());
  const parPersonne = [...new Set(duMois.map((n) => n.personne))]
    .map((p) => ({ p, n: duMois.filter((x) => x.personne === p) }))
    .map((x) => ({ ...x, total: x.n.reduce((s, n) => s + n.montantCents, 0) }))
    .sort((a, b) => b.total - a.total);
  /*
    SAISIE — une note tapée à la main, sans photo : le ticket affiché est
    celui de la saisie (marchand, date, total), chaque champ sûr puisqu'il a
    été tapé. La lecture automatique des photos n'est pas branchée.
  */
  const enregistrer = async (v: Record<string, string>, id?: string) => {
    const avant = notes.find((n) => n.id === id);
    const montantCents = versCents(v.montant) ?? 0;
    const le = versIso(v.le);
    const statut = v.statut as NoteDeFrais['statut'];
    const maintenantIso = new Date().toISOString();
    await upsert('expenseClaims', id ?? uid(), {
      kind: 'note',
      personne: v.personne.trim(),
      le,
      montantCents,
      ticket: [
        { texte: 'Saisie à la main', style: 'petit' },
        { texte: v.marchand.trim() || 'Marchand', style: 'fort', zone: 1 },
        { texte: v.le.split('-').reverse().join('/'), zone: 2 },
        { texte: '', style: 'filet' },
        { texte: 'TOTAL TTC', droite: formatCents(montantCents), style: 'fort', zone: 3 },
      ],
      champs: [
        { zone: 1, champ: 'Marchand', valeur: v.marchand.trim() || '—', confiance: 1 },
        { zone: 2, champ: 'Date', valeur: v.le.split('-').reverse().join('/'), confiance: 1 },
        { zone: 3, champ: 'Montant', valeur: formatCents(montantCents), confiance: 1 },
      ],
      statut,
      ...(statut !== 'a-verifier' ? { valideeLe: avant?.valideeLe ?? maintenantIso } : {}),
      ...(statut === 'remboursee' ? { rembourseeLe: avant?.rembourseeLe ?? maintenantIso } : {}),
    });
  };
  const rembourses = notes.filter((n) => n.rembourseeLe && n.valideeLe);
  const delai = rembourses.length
    ? Math.round(rembourses.reduce((s, n) => s + (new Date(n.rembourseeLe as string).getTime() - new Date(n.valideeLe as string).getTime()) / 86_400_000, 0) / rembourses.length)
    : null;

  const confirmer = async () => {
    if (!note || !ambre) return;
    const champsMaj = note.champs.map((c) => (c.zone === ambre.zone ? { ...c, confirmeLe: new Date().toISOString() } : c));
    await upsert('expenseClaims', note.id, { ...donnees(note), champs: champsMaj });
  };
  const valider = async () => {
    if (!note || champs.some(bloquant)) return;
    await upsert('expenseClaims', note.id, { ...donnees(note), statut: 'validee', valideeLe: new Date().toISOString() });
  };

  const description = vide
    ? t('m50.expenseClaims.descriptionVide')
    : ambre
      ? t('m50.expenseClaims.description')
      : t('m50.expenseClaims.descriptionSure');

  return (
    <Ecran50 vide={vide} premierJour={vide}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.finance'), module: t('m50.expenseClaims.titre') })}
          title={t('m50.expenseClaims.titre')}
          description={description}
          phraseVide={t('m50.expenseClaims.phraseVide')}
        />
      </Bloc>

      <SaisieModule
        ajouter="Saisir une note de frais"
        ouvertParDefaut={vide}
        note="La lecture des photos de tickets n’est pas encore branchée"
        champs={[
          { cle: 'personne', intitule: 'Qui a payé', type: 'texte', requis: true },
          { cle: 'marchand', intitule: 'Chez qui', type: 'texte', requis: true, aide: '« Total Énergies », « Brasserie du Port ».' },
          { cle: 'montant', intitule: 'Montant TTC', type: 'montant', requis: true },
          { cle: 'le', intitule: 'Date du ticket', type: 'date', requis: true, defaut: versJour(maintenant.toISOString()) },
          {
            cle: 'statut',
            intitule: 'Où en est-elle',
            type: 'choix',
            options: [
              { valeur: 'a-verifier', libelle: 'À vérifier' },
              { valeur: 'validee', libelle: 'Validée' },
              { valeur: 'remboursee', libelle: 'Remboursée' },
            ],
          },
        ]}
        enregistrer={enregistrer}
        elements={[...notes]
          .sort((a, b) => b.le.localeCompare(a.le))
          .slice(0, 60)
          .map((n) => ({
            id: n.id,
            libelle: `${n.personne} · ${formatCents(n.montantCents)}`,
            detail: `${versJour(n.le)} · ${{ 'a-verifier': 'à vérifier', validee: 'validée', remboursee: 'remboursée' }[n.statut]}`,
            valeurs: {
              personne: n.personne,
              marchand: n.champs.find((c) => c.champ === 'Marchand')?.valeur ?? '',
              montant: depuisCents(n.montantCents),
              le: versJour(n.le),
              statut: n.statut,
            },
          }))}
        supprimer={(id) => remove('expenseClaims', id)}
      />

      <Dominante
        surtitre={note ? `Le ticket de ${note.personne} et ce qu’on y a lu` : 'Le ticket et ce qu’on y a lu'}
        note={note ? 'Zone cerclée = lue · numéro = champ' : undefined}
      >
        {!note ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Un ticket photographié s’affichera ici redressé, chaque zone lue cerclée et numérotée sur le papier même, et
            les champs de la note en face, avec la confiance de chaque lecture.
          </p>
        ) : (
          <>
            <div className="grid items-start gap-8 lg:grid-cols-[290px_minmax(0,1fr)] lg:gap-12">
              <Ticket lignes={note.ticket} ambre={ambre?.zone ?? null} />
              <div className="min-w-0">
                {champs.map((c) => {
                  const a = c.zone === ambre?.zone;
                  return (
                    <div key={c.zone} className="grid grid-cols-[22px_minmax(0,1fr)_96px] items-center gap-x-3 gap-y-1 border-b border-border py-[11px] sm:grid-cols-[22px_110px_minmax(0,1fr)_120px]">
                      <span
                        data-signal-groupe={a ? 'lecture-incertaine' : undefined}
                        className={`flex h-[18px] w-[18px] items-center justify-center rounded-full font-mono text-[9px] font-bold ${a ? 'bg-signal text-signal-ink' : 'bg-[#2b2b2b] text-text-body'}`}
                      >
                        {c.zone}
                      </span>
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-text-muted max-sm:col-span-2">{c.champ}</span>
                      <span
                        data-signal-groupe={a ? 'lecture-incertaine' : undefined}
                        className={`tnum min-w-0 font-mono text-[14px] font-semibold max-sm:col-start-2 ${a ? 'text-signal' : 'text-text-primary'}`}
                      >
                        {c.valeur}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-[5px] flex-1 bg-[#191919]">
                          <span
                            data-signal-groupe={a ? 'lecture-incertaine' : undefined}
                            className={`block h-[5px] ${a ? 'bg-signal' : 'bg-[#4a4a48]'}`}
                            style={{ width: `${Math.round(c.confiance * 100)}%` }}
                          />
                        </span>
                        <span
                          data-signal-groupe={a ? 'lecture-incertaine' : undefined}
                          className={`tnum w-8 flex-none text-right font-mono text-[10px] font-medium ${a ? 'text-signal' : 'text-text-muted'}`}
                        >
                          {Math.round(c.confiance * 100)} %
                        </span>
                      </span>
                    </div>
                  );
                })}
                {ambre?.note && <p className="mt-3.5 text-[12.5px] leading-[1.55] text-text-secondary">{ambre.note}</p>}
              </div>
            </div>

            <PiedDominante
              action={
                ambre ? (
                  <BoutonSecondaire onClick={() => void confirmer()}>Confirmer {ambre.valeur}</BoutonSecondaire>
                ) : note.statut === 'a-verifier' ? (
                  <BoutonPrimaire onClick={() => void valider()}>Valider la note</BoutonPrimaire>
                ) : undefined
              }
            >
              {ambre
                ? `La zone ${ambre.zone} a été lue à ${Math.round(ambre.confiance * 100)} % : sous ${Math.round(CONFIANCE_MIN * 100)} %, la note ne se valide pas avant qu’on confirme la valeur.`
                : note.statut === 'a-verifier'
                  ? 'Chaque zone a été lue avec assez de confiance, ou confirmée : la note peut partir en remboursement.'
                  : `Cette note est ${note.statut === 'validee' ? 'validée' : 'remboursée'}.`}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre={`Les notes de ${MOIS[maintenant.getMonth()]}`} note={parPersonne.length ? 'Par personne' : undefined}>
          {parPersonne.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucune note ce mois-ci.</p>
          ) : (
            parPersonne.map((x, i) => (
              <button key={x.p} type="button" className="block w-full text-left" onClick={() => setChoisie(x.n[0]?.id ?? null)}>
                <LigneRegistre colonnes="minmax(0,1fr) auto auto" derniere={i === parPersonne.length - 1}>
                  <span className="text-[13.5px] text-text-primary">{x.p}</span>
                  <span className="font-mono text-[11.5px] text-text-muted">
                    {x.n.length} note{x.n.length > 1 ? 's' : ''}
                  </span>
                  <span className="tnum text-right font-mono text-[11.5px] text-text-secondary">{formatCents(x.total)}</span>
                </LigneRegistre>
              </button>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre={MOIS[maintenant.getMonth()].replace(/^./, (c) => c.toUpperCase())}
          releves={[
            { label: 'En attente', valeur: aVerifier.length },
            { label: 'Montant', valeur: formatCents(duMois.reduce((s, n) => s + n.montantCents, 0)) },
            { label: 'Remboursement', valeur: delai === null ? '—' : `sous ${delai} j` },
          ]}
        >
          {`${L(aVerifier.length, true)} note${aVerifier.length > 1 ? 's' : ''} à vérifier ; une note validée part en remboursement.`}
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}

