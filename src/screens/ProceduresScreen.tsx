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
  LigneRegistre,
  PiedDominante,
  donnees,
} from '../components/cinquante-kit';
import { useCollection, useSync } from '../state/SyncContext';
import { enLettres } from '../lib/cinquante/lettres';
import { CORPS_ETAPE_PX, type Detenteur, type Procedure, etapePerimee } from '../lib/cinquante/rh';
import { useLangue } from '../i18n';

/**
 * PROCÉDURES — la fiche plastifiée (`37b`).
 *
 * La procédure rendue telle qu'on l'affiche à l'atelier : une fiche A5 sous
 * plastique (cadre brillant de 10 px), un papier clair, un titre de 22 px,
 * des étapes numérotées en gros (corps minimal 15 px), un encadré de
 * sécurité, et en pied la version et la dernière relecture.
 *
 * Chaque étape est vérifiée MÉCANIQUEMENT contre le reste du produit : un
 * article absent de Stock, un matériel sorti de Matériel, une habilitation
 * qui n'existe plus → l'étape est périmée. Aucun jugement.
 */

const MOIS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const age = (iso: string, maintenant: Date) => {
  const j = Math.floor((maintenant.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (j < 14) return `il y a ${Math.max(0, j)} j`;
  if (j < 60) return `il y a ${Math.round(j / 7)} sem.`;
  return `il y a ${Math.round(j / 30.4)} mois`;
};

export function ProceduresScreen() {
  const { t, langue } = useLangue();
  const { upsert } = useSync();
  const procedures = useCollection<Procedure>('procedures');
  const stock = useCollection<{ name: string }>('stockItems');
  const materiel = useCollection<{ name: string }>('resources');
  const habilitations = useCollection<Detenteur | { kind: string }>('certifications');
  const [maintenant] = useState(() => new Date());
  const [choisie, setChoisie] = useState<string | null>(null);
  const [edition, setEdition] = useState<string | null>(null);
  const L = (n: number, maj = false) => enLettres(n, langue, maj);

  const reel = useMemo(
    () => ({
      stock: stock.map((s) => s.name),
      materiel: materiel.map((m) => m.name),
      habilitations: habilitations.flatMap((h) => (h.kind === 'personne' ? (h as Detenteur).cles.map((c) => c.habilitation) : [])),
    }),
    [stock, materiel, habilitations],
  );
  const perimees = (p: Procedure) => p.etapes.map((e, i) => ({ i, motif: etapePerimee(e, reel) })).filter((x) => x.motif !== null);
  const triees = [...procedures].sort((a, b) => a.relueLe.localeCompare(b.relueLe));
  const fiche = procedures.find((p) => p.id === choisie) ?? procedures.find((p) => perimees(p).length > 0) ?? triees[triees.length - 1] ?? null;
  const vide = procedures.length === 0;
  const perimee = fiche ? perimees(fiche)[0] ?? null : null;
  const relues = procedures.filter((p) => new Date(p.relueLe).getFullYear() === maintenant.getFullYear()).length;
  const totalPerimees = procedures.reduce((s, p) => s + perimees(p).length, 0);
  const plusAncienne = triees[0] ?? null;

  const corriger = async () => {
    if (!fiche || !perimee || edition === null || !edition.trim()) return;
    const etapes = fiche.etapes.map((e, i) => (i === perimee.i ? { texte: edition.trim() } : e));
    await upsert('procedures', fiche.id, { ...donnees(fiche), etapes, version: fiche.version + 1, relueLe: new Date().toISOString() });
    setEdition(null);
  };

  const description = vide
    ? t('m50.procedures.descriptionVide')
    : perimee
      ? t('m50.procedures.description')
      : t('m50.procedures.descriptionAJour');

  return (
    <Ecran50 vide={vide} premierJour={vide}>
      <Bloc>
        <ScreenHeader
          eyebrow={t('m50.surtitre', { famille: t('m50.famille.rh'), module: t('m50.procedures.titre') })}
          title={t('m50.procedures.titre')}
          description={description}
          phraseVide={t('m50.procedures.phraseVide')}
        />
      </Bloc>

      <Dominante surtitre="La fiche, telle qu’elle est punaisée" note={fiche ? 'A5 · lue à un mètre' : undefined}>
        {!fiche ? (
          <p className="max-w-[60ch] text-[14.5px] leading-[1.7] text-text-secondary">
            Chaque procédure sera composée ici comme la fiche plastifiée qu’on punaise à l’atelier, lisible à un mètre avec
            des gants — et chacune de ses étapes vérifiée contre le stock et le matériel réels.
          </p>
        ) : (
          <>
            <div className="flex justify-center">
              <div className="w-full max-w-[470px] rounded-[14px] bg-[linear-gradient(135deg,rgba(255,255,255,.22),rgba(255,255,255,.06)_40%,rgba(255,255,255,.16))] p-2.5 shadow-[0_34px_68px_-28px_rgba(0,0,0,1)]">
                <div className="rounded-md bg-[#e8e6e0] px-4 pb-[18px] pt-6 sm:px-6">
                  <span className="block font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] text-[#5c5a55]">Procédure · {fiche.categorie}</span>
                  <span className="mt-2 block text-[22px] font-bold tracking-[-0.02em] text-[#0a0a0a]">{fiche.titre}</span>
                  <div className="mt-4 flex flex-col gap-1">
                    {fiche.etapes.map((e, i) => {
                      const a = perimee?.i === i;
                      return (
                        <div
                          key={i}
                          data-signal-groupe={a ? 'etape-perimee' : undefined}
                          className={`flex items-start gap-3.5 px-3 py-2.5 ${a ? 'bg-signal shadow-[0_0_28px_-7px_var(--color-signal-glow)]' : ''}`}
                        >
                          <span
                            className={`tnum flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full font-mono text-[15px] font-bold ${a ? 'bg-signal-ink text-signal' : 'bg-[#1a1a1a] text-[#e8e6e0]'}`}
                          >
                            {i + 1}
                          </span>
                          <span className="flex-1 font-semibold leading-[1.4] text-[#0a0a0a] [text-wrap:pretty]" style={{ fontSize: CORPS_ETAPE_PX }}>
                            {e.texte}
                            {a && perimee?.motif && (
                              <span className={`mt-1 block font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] ${ENCRE_SURTITRE_PLAQUE}`}>Étape périmée · {perimee.motif}</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {fiche.securite && (
                    <div className="mt-3.5 border-2 border-[#0a0a0a] px-3 py-2.5 text-[13px] font-semibold leading-[1.4] text-[#0a0a0a]">{fiche.securite}</div>
                  )}
                  <span className="mt-3.5 block font-mono text-[10px] uppercase text-[#5c5a55]">
                    Version {fiche.version} · relue le {new Date(fiche.relueLe).getDate()} {MOIS[new Date(fiche.relueLe).getMonth()]} · {fiche.relueePar}
                  </span>
                </div>
              </div>
            </div>

            <PiedDominante
              action={
                perimee ? (
                  edition === null ? (
                    <BoutonSecondaire onClick={() => setEdition(fiche.etapes[perimee.i].texte)}>Corriger l’étape {perimee.i + 1}</BoutonSecondaire>
                  ) : (
                    <BoutonPrimaire onClick={() => void corriger()} disabled={!edition.trim()}>
                      Enregistrer la version {fiche.version + 1}
                    </BoutonPrimaire>
                  )
                ) : undefined
              }
            >
              {perimee && edition !== null ? (
                <textarea
                  value={edition}
                  onChange={(e) => setEdition(e.target.value)}
                  rows={2}
                  aria-label={`Nouveau texte de l’étape ${perimee.i + 1}`}
                  className="input-focus w-full border border-border-strong bg-sunken px-3 py-2 text-[13.5px] text-text-primary outline-none"
                />
              ) : perimee ? (
                `L’étape ${perimee.i + 1} cite « ${fiche.etapes[perimee.i].cite?.nom} » : ${perimee.motif}. Suivre l’étape telle qu’elle est écrite, c’est chercher ce qui n’existe plus.`
              ) : (
                'Chaque étape de cette fiche correspond au stock, au matériel et aux habilitations réels.'
              )}
            </PiedDominante>
          </>
        )}
      </Dominante>

      <Calmes>
        <CarteCalme surtitre={`Les ${L(procedures.length)} procédures`} note={procedures.length ? 'Dernière relecture' : undefined}>
          {procedures.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-text-secondary">Aucune procédure écrite.</p>
          ) : (
            triees.map((p, i) => (
              <button key={p.id} type="button" onClick={() => { setChoisie(p.id); setEdition(null); }} className={`block w-full text-left ${p.id === fiche?.id ? 'bg-surface-hover/40' : ''}`}>
                <LigneRegistre colonnes="minmax(0,1fr) auto" derniere={i === triees.length - 1}>
                  <span className="min-w-0 text-[13.5px] text-text-primary">{p.titre}</span>
                  <span className="text-right font-mono text-[11.5px] text-text-secondary">{age(p.relueLe, maintenant)}</span>
                </LigneRegistre>
              </button>
            ))
          )}
        </CarteCalme>
        <CarteReleves
          surtitre="Les procédures"
          releves={[
            { label: 'Relues cette année', valeur: `${relues} / ${procedures.length}` },
            { label: 'Étapes périmées', valeur: totalPerimees },
            { label: 'La plus ancienne', valeur: plusAncienne ? age(plusAncienne.relueLe, maintenant).replace('il y a ', '') : '—' },
          ]}
        >
          Une étape devient périmée dès que ce qu’elle cite sort du stock, du parc ou des habilitations.
        </CarteReleves>
      </Calmes>
    </Ecran50>
  );
}
