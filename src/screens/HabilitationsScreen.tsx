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
import {
  type Cle,
  type Detenteur,
  type EnregistrementHabilitations,
  type InterventionPlanifiee,
  cassee,
  chantiersAVenir,
  cleQuiLache,
} from '../lib/cinquante/rh';
import type { Id } from '../lib/cinquante/guichet';
import { useLangue } from '../i18n';

/**
 * HABILITATIONS — le trousseau (`37d`).
 *
 * Chaque personne est un trousseau : un anneau et une clé par habilitation,
 * avec son échéance. Une clé valide est tracée en encre claire ; une clé
 * échue est CASSÉE (tige coupée, nom barré). Les chantiers des deux
 * prochaines semaines viennent d'Interventions (une règle d'exigence dit
 * quel titre exige quelle habilitation) et de ceux posés ici.
 *
 * L'ambre : la clé qui échoit AVANT un chantier qui l'exige. Une clé déjà
 * échue sans chantier concerné reste grise : elle ne bloque rien de planifié.
 */

const MOIS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
/** Minuscule initiale, sauf pour un sigle (H0B0, SST, CACES). */
const enMinuscule = (s: string) => (/^.[a-zà-ÿ]/.test(s) ? s.replace(/^./, (c) => c.toLowerCase()) : s);
const quand = (iso: string, maintenant: Date) => {
  const d = new Date(iso);
  if (d.getFullYear() === maintenant.getFullYear() && d.getTime() - maintenant.getTime() < 120 * 86_400_000) return `${d.getDate()} ${MOIS[d.getMonth()]}`;
  return d.getMonth() === 11 && d.getDate() === 31 ? String(d.getFullYear()) : `${MOIS_LONGS[d.getMonth()]} ${d.getFullYear()}`;
};

function Clef({ couleur, cassee: c }: { couleur: string; cassee: boolean }) {
  return (
    <svg viewBox="0 0 44 16" className="h-4 w-11 flex-none" aria-hidden>
      <circle cx={8} cy={8} r={6} fill="none" stroke={couleur} strokeWidth={2.2} />
      <path d={c ? 'M14 8 L22 8 M27 8 L40 8' : 'M14 8 L40 8'} stroke={couleur} strokeWidth={2.2} />
      {!c && <path d="M33 8 L33 13 M38 8 L38 12" stroke={couleur} strokeWidth={2.2} />}
    </svg>
  );
}

export function HabilitationsScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const tout = useCollection<EnregistrementHabilitations>('certifications');
  const interventions = useCollection<InterventionPlanifiee>('interventions');
  const [maintenant] = useState(() => new Date());
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const personnes = tout.filter((e): e is Id<Detenteur> & { updatedAt: string } => e.kind === 'personne');
  const chantiers = useMemo(() => chantiersAVenir(tout, interventions, maintenant), [tout, interventions, maintenant]);
  const ambre = useMemo(() => cleQuiLache(personnes, chantiers, maintenant), [personnes, chantiers, maintenant]);
  const vide = personnes.length === 0;
  const cles = personnes.flatMap((p) => p.cles);
  const valides = cles.filter((k) => !cassee(k, maintenant)).length;
  const echues = cles.length - valides;
  const ceMois = cles.filter((k) => {
    const d = new Date(k.echeance);
    return !cassee(k, maintenant) && d.getMonth() === maintenant.getMonth() && d.getFullYear() === maintenant.getFullYear();
  }).length;
  const autresDetenteurs = ambre
    ? personnes.filter((p) => p.id !== (ambre.personne as Id<Detenteur>).id && p.cles.some((k) => k.habilitation === ambre.cle.habilitation && new Date(k.echeance) > new Date(ambre.chantier.le))).map((p) => p.nom)
    : [];

  const inscrire = async () => {
    if (!ambre) return;
    const p = personnes.find((x) => x.nom === ambre.personne.nom);
    if (!p) return;
    const nouvelles: Cle[] = p.cles.map((k) => (k.habilitation === ambre.cle.habilitation ? { ...k, recyclageInscritLe: new Date().toISOString() } : k));
    await upsert('certifications', p.id, { ...donnees(p), cles: nouvelles });
  };

  const description = vide
    ? t('m50.certifications.descriptionVide')
    : ambre
      ? t('m50.certifications.description')
      : t('m50.certifications.descriptionSansManque');

  return (
    <Ecran50 vide={vide} premierJour={tout.length === 0}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.rh'), module: t('m50.certifications.titre') })}
          title={t('m50.certifications.titre')}
          description={description}
          phraseVide={t('m50.certifications.phraseVide')}
        />
      </Bloc>

      <Dominante surtitre="Les trousseaux" note={vide ? undefined : 'Clé = habilitation · clé cassée = échue'}>
        {vide ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Chaque personne aura ici son trousseau, une clé par habilitation avec son échéance. Une clé qui lâchera avant un
            chantier qui l’exige se verra avant qu’il ne soit trop tard.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              {personnes.map((p) => (
                <div key={p.id} className="flex min-w-0 flex-col gap-3 border border-border-raised bg-raised px-3.5 py-4">
                  <span className="flex items-center gap-2.5">
                    <span className="h-[22px] w-[22px] flex-none rounded-full border-[3px] border-[#4a4a48]" />
                    <span className="text-[14px] font-semibold text-text-primary">{p.nom}</span>
                  </span>
                  {p.cles.map((k) => {
                    const a = ambre?.personne.nom === p.nom && ambre.cle.habilitation === k.habilitation;
                    const c = cassee(k, maintenant);
                    const couleur = a ? 'var(--color-signal)' : c ? '#4a4a48' : 'var(--color-text-secondary)';
                    return (
                      <div
                        key={k.habilitation}
                        data-signal-groupe={a ? 'cle-qui-lache' : undefined}
                        className={`flex items-center gap-2.5 ${a ? '-mx-1.5 bg-[#1c1408] py-2 pl-[15px] pr-1.5 shadow-[0_0_28px_-7px_var(--color-signal-glow)] outline outline-2 outline-signal' : 'pl-[9px]'}`}
                      >
                        <Clef couleur={couleur} cassee={c} />
                        <span className="min-w-0">
                          <span className={`block text-[12.5px] font-semibold [overflow-wrap:anywhere] ${c ? 'text-text-muted line-through' : 'text-text-body'}`}>{k.habilitation}</span>
                          <span className={`tnum mt-0.5 block font-mono text-[10px] ${a ? 'font-bold text-signal' : 'text-text-muted'}`}>
                            {c ? `échue en ${MOIS_LONGS[new Date(k.echeance).getMonth()]}` : quand(k.echeance, maintenant)}
                            {k.recyclageInscritLe ? ' · recyclage' : ''}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <PiedDominante
              action={ambre ? <BoutonSecondaire onClick={() => void inscrire()}>Inscrire {ambre.personne.nom} au recyclage</BoutonSecondaire> : undefined}
            >
              {ambre
                ? `L’habilitation ${enMinuscule(ambre.cle.habilitation)} de ${ambre.personne.nom} échoit le ${new Date(ambre.cle.echeance).getDate()} ${MOIS_LONGS[new Date(ambre.cle.echeance).getMonth()]}. Le chantier « ${ambre.chantier.nom} » l’exige le ${new Date(ambre.chantier.le).getDate()} ${MOIS_LONGS[new Date(ambre.chantier.le).getMonth()]}. ${
                    autresDetenteurs.length === 0 ? 'Personne d’autre ne la détient.' : autresDetenteurs.length === 1 ? `Une seule autre personne la détient : ${autresDetenteurs[0]}.` : `${autresDetenteurs.join(', ')} la détiennent aussi.`
                  }`
                : 'Aucune clé ne lâche avant un chantier qui l’exige dans les deux prochaines semaines.'}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre="Les deux prochaines semaines" note={chantiers.length ? 'Chantier · exige' : undefined}>
          {chantiers.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucun chantier planifié sur deux semaines.</p>
          ) : (
            chantiers.map((c, i) => (
              <LigneRegistre key={`${c.nom}-${c.le}`} colonnes="minmax(0,1fr) auto minmax(0,130px)" derniere={i === chantiers.length - 1}>
                <span className="min-w-0 text-[13.5px] text-text-primary">{c.nom}</span>
                <span className="font-mono text-[11.5px] text-text-secondary">{new Date(c.le).getDate()} {MOIS[new Date(c.le).getMonth()]}</span>
                <span className="min-w-0 text-right font-mono text-[11.5px] text-text-secondary">{c.exige.length ? c.exige.map(enMinuscule).join(', ') : 'aucune'}</span>
              </LigneRegistre>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Les habilitations"
          releves={[
            { label: 'Valides', valeur: valides },
            { label: 'Échues', valeur: echues },
            { label: 'À recycler ce mois', valeur: ceMois },
          ]}
        >
          {`${L(personnes.length, true)} personne${personnes.length > 1 ? 's' : ''}, ${L(cles.length)} habilitation${cles.length > 1 ? 's' : ''}. Une personne sans clé valide ne peut pas être affectée au chantier qui l’exige.`}
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
