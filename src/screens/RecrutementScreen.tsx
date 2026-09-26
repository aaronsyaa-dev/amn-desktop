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
  LigneBarre,
  PiedDominante,
  donnees,
} from '../components/cinquante-kit';
import { SaisieModule, Saisies, versIso, versJour } from '../components/SaisieModule';
import { uid, useCollection, useSync } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import {
  type Candidat,
  type CreneauPlanning,
  type EnregistrementRecrutement,
  HEURES,
  JOURS_OUVRES,
  type PosteOuvert,
  cle,
  comble,
  trouDeLaSemaine,
} from '../lib/cinquante/rh';
import type { Id } from '../lib/cinquante/guichet';
import { useLangue } from '../i18n';

/**
 * RECRUTEMENT — la pièce manquante (`37a`).
 *
 * La semaine de l'équipe, cinq jours sur dix heures, LUE DANS PLANNING
 * D'ÉQUIPE : les heures tenues sont pleines, celles que personne ne tient
 * forment un trou hachuré — la raison du recrutement. Chaque finaliste est une
 * petite grille de la MÊME géométrie ; ses cases qui tombent dans le trou
 * s'allument, avec `disponibles ∩ trou / heures du trou`.
 *
 * L'ambre : la carte du finaliste qui comble le mieux le trou.
 */

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
const JOURS_LONGS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
const HACHURE = 'repeating-linear-gradient(135deg,rgba(255,255,255,.08) 0 2px,transparent 2px 6px)';

function Petite({ dispo, trou, ambre }: { dispo: Set<string>; trou: Set<string>; ambre: boolean }) {
  return (
    <div className="grid grid-cols-5 gap-0.5" aria-hidden>
      {HEURES.flatMap((h) =>
        JOURS_OUVRES.map((j) => {
          const k = cle(j, h);
          const dansTrou = trou.has(k);
          const libre = dispo.has(k);
          const cls = dansTrou && libre ? (ambre ? 'bg-signal' : 'bg-text-body') : dansTrou ? 'border border-dashed border-[#4a4a48]' : libre ? 'bg-border-strong' : 'bg-raised';
          return <span key={k} className={`h-[9px] ${cls}`} />;
        }),
      )}
    </div>
  );
}

export function RecrutementScreen() {
  const { t, langue } = useLangue();
  const { upsert, remove } = useSync();
  const tout = useCollection<EnregistrementRecrutement>('candidates');
  const creneaux = useCollection<CreneauPlanning>('shifts');
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const poste = tout.find((e): e is Id<PosteOuvert> & { updatedAt: string } => e.kind === 'poste') ?? null;
  const candidats = tout.filter((e): e is Id<Candidat> & { updatedAt: string } => e.kind === 'candidat');
  const semaine = useMemo(() => trouDeLaSemaine(creneaux, maintenant), [creneaux, maintenant]);
  const finalistes = candidats
    .filter((c) => c.finaliste)
    .map((c) => ({ c, m: comble(c.dispo, semaine.trou) }))
    .sort((a, b) => b.m.pct - a.m.pct)
    .slice(0, 3);
  const meilleur = finalistes[0] && finalistes[0].m.heures > 0 ? finalistes[0] : null;
  const vide = !poste;
  const apresMidis = new Set([...semaine.trou].filter((k) => Number(k.split('-')[1]) >= 13).map((k) => k.split('-')[0])).size;
  const restant = meilleur ? [...semaine.trou].filter((k) => !meilleur.m.cases.has(k)) : [];
  const joursDepuis = poste ? Math.floor((maintenant.getTime() - new Date(poste.publieLe).getTime()) / 86_400_000) : 0;

  const proposer = async () => {
    if (!meilleur) return;
    await upsert('candidates', meilleur.c.id, { ...donnees(meilleur.c), etape: 'essai', essaiProposeLe: new Date().toISOString() });
  };

  /*
    SAISIE — le poste ouvert, puis chaque candidature. Les disponibilités se
    disent comme on les dit au téléphone (« lundi, mardi, jeudi » et un
    moment de la journée) ; elles deviennent les cases de la semaine type.
  */
  const JOURS_SAISIE = ['lun', 'mar', 'mer', 'jeu', 'ven'];
  const HEURES_SAISIE: Record<string, number[]> = { matin: [8, 9, 10, 11], apresmidi: [13, 14, 15, 16], journee: [8, 9, 10, 11, 13, 14, 15, 16] };
  const versDispo = (jours: string, moment: string) => {
    const lus = JOURS_SAISIE.map((j, i) => (jours.toLowerCase().includes(j) ? i + 1 : 0)).filter(Boolean);
    return (lus.length ? lus : [1, 2, 3, 4, 5]).flatMap((j) => (HEURES_SAISIE[moment] ?? HEURES_SAISIE.journee).map((h) => `${j}-${h}`));
  };
  const depuisDispo = (dispo: string[]) => {
    const jours = [...new Set(dispo.map((k) => Number(k.split('-')[0])))].sort();
    const heures = new Set(dispo.map((k) => Number(k.split('-')[1])));
    const moment = heures.has(8) && heures.has(13) ? 'journee' : heures.has(13) ? 'apresmidi' : 'matin';
    return { jours: jours.map((j) => ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'][j - 1]).join(', '), moment };
  };
  const enregistrerPoste = async (v: Record<string, string>, id?: string) => {
    const avant = id ? (tout.find((e) => e.id === id) as Id<PosteOuvert> | undefined) : undefined;
    await upsert('candidates', id ?? uid(), {
      kind: 'poste',
      intitule: v.intitule.trim(),
      publieLe: versIso(v.publieLe),
      refusees: avant?.refusees ?? 0,
      refuseesDepuis: avant?.refuseesDepuis ?? versIso(v.publieLe),
    });
  };
  const enregistrerCandidat = async (v: Record<string, string>, id?: string) => {
    const avant = id ? (tout.find((e) => e.id === id) as Id<Candidat> | undefined) : undefined;
    await upsert('candidates', id ?? uid(), {
      kind: 'candidat',
      nom: v.nom.trim(),
      etape: v.etape as Candidat['etape'],
      finaliste: v.finaliste === 'oui',
      dispo: versDispo(v.jours, v.moment),
      ...(avant?.essaiProposeLe ? { essaiProposeLe: avant.essaiProposeLe } : {}),
    });
  };
  const postes = tout.filter((e): e is Id<PosteOuvert> & { updatedAt: string } => e.kind === 'poste');

  const parcours: Array<[string, number]> = [
    ['Reçues', candidats.length],
    ['Entretiens', candidats.filter((c) => c.etape === 'entretien' || c.etape === 'essai').length],
    ['Essais proposés', candidats.filter((c) => c.etape === 'essai').length],
  ];

  const description = vide
    ? t('m50.recruitment.descriptionVide')
    : semaine.trou.size === 0
      ? t('m50.recruitment.descriptionSansTrou')
      : t(finalistes.length === 0 ? 'm50.recruitment.description0' : finalistes.length === 1 ? 'm50.recruitment.description1' : 'm50.recruitment.description', { n: L(apresMidis), f: L(finalistes.length) });

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.rh'), module: t('m50.recruitment.titre') })}
          title={t('m50.recruitment.titre')}
          description={description}
          phraseVide={t('m50.recruitment.phraseVide')}
        />
      </Bloc>

      <Saisies>
        <SaisieModule
          ajouter={postes.length ? 'Ouvrir un autre poste' : 'Ouvrir un poste'}
          ouvertParDefaut={postes.length === 0}
          surtitreListe="Les postes ouverts"
          champs={[
            { cle: 'intitule', intitule: 'Intitulé du poste', type: 'texte', requis: true, aide: '« Technicien·ne d’intervention », « Vendeur·se à mi-temps ».' },
            { cle: 'publieLe', intitule: 'Annonce publiée le', type: 'date', requis: true, defaut: versJour(maintenant.toISOString()) },
          ]}
          enregistrer={enregistrerPoste}
          elements={postes.map((x) => ({ id: x.id, libelle: x.intitule, detail: `publié le ${versJour(x.publieLe)}`, valeurs: { intitule: x.intitule, publieLe: versJour(x.publieLe) } }))}
          supprimer={(id) => remove('candidates', id)}
        />
        {postes.length > 0 && (
          <SaisieModule
            ajouter="Ajouter une candidature"
            surtitreListe="Les candidatures"
            champs={[
              { cle: 'nom', intitule: 'Nom', type: 'texte', requis: true },
              {
                cle: 'etape',
                intitule: 'Où en est-elle',
                type: 'choix',
                options: [
                  { valeur: 'recu', libelle: 'Candidature reçue' },
                  { valeur: 'entretien', libelle: 'Entretien passé' },
                  { valeur: 'essai', libelle: 'Essai proposé' },
                ],
              },
              {
                cle: 'finaliste',
                intitule: 'Retenue pour la fin',
                type: 'choix',
                options: [
                  { valeur: 'non', libelle: 'Pas encore' },
                  { valeur: 'oui', libelle: 'Oui, finaliste' },
                ],
              },
              { cle: 'jours', intitule: 'Jours disponibles', type: 'texte', aide: '« lundi, mardi, jeudi ». Vide : toute la semaine.' },
              {
                cle: 'moment',
                intitule: 'Moment de la journée',
                type: 'choix',
                options: [
                  { valeur: 'journee', libelle: 'Journée entière' },
                  { valeur: 'matin', libelle: 'Matins' },
                  { valeur: 'apresmidi', libelle: 'Après-midis' },
                ],
              },
            ]}
            enregistrer={enregistrerCandidat}
            elements={candidats.map((c) => {
              const d = depuisDispo(c.dispo);
              return {
                id: c.id,
                libelle: c.nom,
                detail: [{ recu: 'reçue', entretien: 'entretien', essai: 'essai proposé' }[c.etape], c.finaliste ? 'finaliste' : '', d.jours].filter(Boolean).join(' · '),
                valeurs: { nom: c.nom, etape: c.etape, finaliste: c.finaliste ? 'oui' : 'non', jours: d.jours, moment: d.moment },
              };
            })}
            supprimer={(id) => remove('candidates', id)}
          />
        )}
      </Saisies>

      <Dominante surtitre="La semaine de l’équipe" note={vide ? undefined : 'Plein = tenu · hachuré = personne'}>
        {vide ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Dès qu’un poste sera ouvert, la semaine de l’équipe s’affichera ici telle que le Planning la tient : les heures
            que personne ne tient formeront le trou, et chaque finaliste y sera posé.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[32px_repeat(5,minmax(0,1fr))] gap-[3px] sm:grid-cols-[40px_repeat(5,minmax(0,1fr))]">
              <span />
              {JOURS.map((j) => (
                <span key={j} className="pb-1 text-center font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-text-muted">{j}</span>
              ))}
              {HEURES.map((h) => (
                <React.Fragment key={h}>
                  <span className="tnum self-center font-mono text-[9.5px] text-text-muted">{h}h</span>
                  {JOURS_OUVRES.map((j) => {
                    const k = cle(j, h);
                    return semaine.trou.has(k) ? (
                      <span key={k} className="h-5 border border-dashed border-text-muted" style={{ backgroundImage: HACHURE }} />
                    ) : semaine.tenu.has(k) ? (
                      <span key={k} className="h-5 bg-[#2b2b2b]" />
                    ) : (
                      <span key={k} className="h-5" />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            <span className="mb-3 mt-6 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">
              {finalistes.length ? `Les ${L(finalistes.length)} finalistes, posés contre le trou` : 'Aucun finaliste pour l’instant'}
            </span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {finalistes.map(({ c, m }) => {
                const a = c.id === meilleur?.c.id;
                return (
                  <div
                    key={c.id}
                    data-signal-groupe={a ? 'meilleure-piece' : undefined}
                    className={`flex min-w-0 flex-col gap-3 p-4 ${a ? 'border-2 border-signal bg-[#1c1408] shadow-[0_0_28px_-7px_var(--color-signal-glow)]' : 'border border-border-raised bg-raised'}`}
                  >
                    <span className="flex items-baseline justify-between gap-2.5">
                      <span className="min-w-0 text-[14px] font-semibold text-text-primary">{c.nom}</span>
                      <span className={`tnum flex-none font-mono text-[17px] font-bold ${a ? 'text-signal' : 'text-text-secondary'}`}>{m.pct} %</span>
                    </span>
                    <Petite dispo={new Set(c.dispo)} trou={semaine.trou} ambre={a} />
                    <span className={`font-mono text-[9.5px] uppercase tracking-[0.08em] ${a ? 'text-signal' : 'text-text-muted'}`}>
                      Comble {m.heures} des {m.sur} heures
                    </span>
                  </div>
                );
              })}
            </div>

            <PiedDominante
              action={meilleur && meilleur.c.etape !== 'essai' ? <BoutonSecondaire onClick={() => void proposer()}>Proposer un essai à {meilleur.c.nom.split(' ')[0]}</BoutonSecondaire> : undefined}
            >
              {semaine.trou.size === 0
                ? 'Le Planning tient toutes les heures d’ouverture de la semaine : il n’y a pas de trou à combler.'
                : meilleur
                  ? `${meilleur.c.nom.split(' ')[0]} tient ${meilleur.m.heures} des ${meilleur.m.sur} heures manquantes.${
                      restant.length
                        ? ` Il reste ${restant
                            .slice(0, 3)
                            .map((k) => `le ${JOURS_LONGS[Number(k.split('-')[0]) - 1]} à ${k.split('-')[1]} h`)
                            .join(', ')}${restant.length > 3 ? '…' : ''}.`
                        : ' Le trou entier est comblé.'
                    }${meilleur.c.etape === 'essai' ? ' Un essai lui est proposé.' : ''}`
                  : 'Aucun finaliste n’a de disponibilité dans le trou.'}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Les candidatures" note={poste ? 'Depuis l’annonce' : undefined}>
          {/* Sur un écran vide, on écrit la phrase, pas trois zéros (check:signal, compte Groupe Vernet). */}
          {vide ? (
            <p className="mt-3 text-[13px] leading-relaxed text-text-secondary">L’annonce n’est pas encore posée : les candidatures se compteront ici, étape par étape.</p>
          ) : (
            parcours.map(([nom, n], i) => (
              <LigneBarre key={nom} nom={nom} part={n / Math.max(1, parcours[0][1])} valeur={n} derniere={i === parcours.length - 1} />
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Le trou"
          releves={[
            { label: 'Heures non tenues', valeur: `${semaine.trou.size} / semaine` },
            { label: 'Interventions refusées', valeur: poste ? poste.refusees : '—' },
            { label: 'Annonce en ligne', valeur: poste ? `depuis ${joursDepuis} j` : '—' },
          ]}
        >
          {poste && poste.refusees > 0
            ? `${L(poste.refusees, true)} intervention${poste.refusees > 1 ? 's' : ''} refusée${poste.refusees > 1 ? 's' : ''} faute de bras${poste.refuseesApresMidi ? ', toutes un après-midi' : ''}.`
            : 'Aucune intervention refusée faute de bras.'}
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
