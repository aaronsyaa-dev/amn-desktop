import React, { useState } from 'react';
import { Copy } from 'lucide-react';
import { Bouton, Saisie } from '../../socle/ui';
import { CadreAtelier, Chiffre, Etat, Tableau, type Ton } from '../_commun/Cadre';
import { AUJOURDHUI_BAC_A_SABLE, dateLisible, euros, versCentimes } from '../_commun/nombres';
import { DONNEUR_D_ORDRE, SOUS_TRAITANTS } from './donnees';
import { useTextes } from './i18n';
import {
  bilans,
  REGLAGE_PAR_DEFAUT,
  relances,
  verifierReglage,
  type EtatPiece,
  type EtatSousTraitant,
  type ErreurReglage,
  type Piece,
  type Reglage,
} from './logique';
import { MODULE } from './module';

const TON_ST: Record<EtatSousTraitant, Ton> = {
  bloquant: 'danger',
  aRelancer: 'attention',
  aJour: 'succes',
  nonConcerne: 'neutre',
};
const TON_PIECE: Record<EtatPiece, Ton> = {
  manquante: 'danger',
  illisible: 'danger',
  expiree: 'danger',
  bientot: 'attention',
  valide: 'succes',
};
const ETATS: readonly EtatSousTraitant[] = ['bloquant', 'aRelancer', 'aJour', 'nonConcerne'];

const num = (s: string) => (s.trim() === '' ? Number.NaN : Number(s.replace(',', '.')));

export default function EcranVigilance() {
  const { tx, langue } = useTextes();
  const auj = AUJOURDHUI_BAC_A_SABLE;
  const [v, setV] = useState({
    seuil: String(REGLAGE_PAR_DEFAUT.seuil / 100),
    mois: String(REGLAGE_PAR_DEFAUT.moisImmatriculation),
    alerte: String(REGLAGE_PAR_DEFAUT.joursAlerte),
  });
  const [copie, setCopie] = useState(false);

  const saisi: Reglage = {
    seuil: versCentimes(v.seuil),
    moisImmatriculation: num(v.mois),
    joursAlerte: num(v.alerte),
  };
  const fautes = verifierReglage(saisi);
  // Un réglage illisible retombe sur le défaut : l'écran ne montre jamais un état calculé sur du vide.
  const reglage: Reglage = {
    seuil: fautes.includes('seuil') ? REGLAGE_PAR_DEFAUT.seuil : saisi.seuil,
    moisImmatriculation: fautes.includes('mois') ? REGLAGE_PAR_DEFAUT.moisImmatriculation : saisi.moisImmatriculation,
    joursAlerte: fautes.includes('alerte') ? REGLAGE_PAR_DEFAUT.joursAlerte : saisi.joursAlerte,
  };
  const liste = bilans(SOUS_TRAITANTS, auj, reglage);
  const aRelancer = relances(liste);
  const compte = (e: EtatSousTraitant) => liste.filter((b) => b.etat === e).length;
  const faute = (f: ErreurReglage) => (fautes.includes(f) ? tx(`erreur.${f}`) : undefined);
  const champ = (c: keyof typeof v) => ({
    value: v[c],
    inputMode: 'decimal' as const,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [c]: e.target.value }),
  });

  // Sous le seuil, rien n'est exigé : une pièce absente n'y est pas une alarme.
  const cellule = (p: Piece, concerne: boolean) => (
    <Etat ton={concerne ? TON_PIECE[p.etat] : 'neutre'}>
      {p.finValidite
        ? tx(`piece.${p.etat as 'expiree' | 'bientot' | 'valide'}`, {
            date: dateLisible(p.finValidite, langue),
          })
        : tx(`piece.${p.etat as 'manquante' | 'illisible'}`)}
    </Etat>
  );

  const message = [
    tx('message.titre', {
      donneur: DONNEUR_D_ORDRE,
      date: dateLisible(auj, langue),
    }),
    ...aRelancer.flatMap((b) => [
      '',
      `${b.sousTraitant.nom}`,
      tx('message.bonjour', { contact: b.sousTraitant.contact }),
      tx('message.demande', {
        montant: euros(b.sousTraitant.montantContrat, langue),
      }),
      ...b.pieces
        .filter((p) => p.etat !== 'valide')
        .map((p) =>
          tx(`message.ligne.${p.etat as Exclude<EtatPiece, 'valide'>}`, {
            piece: tx(`piece.${p.type}`),
            date: p.finValidite ? dateLisible(p.finValidite, langue) : '',
          }),
        ),
      tx('message.merci'),
    ]),
  ].join('\n');

  return (
    <CadreAtelier famille={MODULE.famille} nom={tx('nom')} intro={tx('intro')}>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 text-[13px] font-semibold text-socle-texte-discret">{tx('reglages')}</legend>
        <Saisie etiquette={tx('seuil')} aide={tx('seuil.aide')} suffixe="€" erreur={faute('seuil')} {...champ('seuil')} />
        <Saisie etiquette={tx('mois')} aide={tx('mois.aide')} suffixe={tx('unite.mois')} erreur={faute('mois')} className="pr-16" {...champ('mois')} />
        <Saisie etiquette={tx('alerte')} suffixe={tx('unite.jours')} erreur={faute('alerte')} className="pr-16" {...champ('alerte')} />
      </fieldset>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ETATS.map((e) => (
          <Chiffre
            key={e}
            fort={e === 'bloquant' && compte(e) > 0}
            intitule={tx(`chiffre.${e}`)}
            valeur={String(compte(e))}
            detail={tx(`chiffre.${e}.detail`)}
          />
        ))}
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {liste.map((b) => (
          <li key={b.sousTraitant.id} className="flex flex-col gap-2 rounded-xl border border-socle-bord bg-socle-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-socle-texte">{b.sousTraitant.nom}</span>
                <span className="text-[12px] text-socle-texte-discret">
                  {tx('contrat', {
                    metier: b.sousTraitant.metier,
                    montant: euros(b.sousTraitant.montantContrat, langue),
                  })}
                </span>
              </span>
              <span className="shrink-0 whitespace-nowrap">
                <Etat ton={TON_ST[b.etat]}>{tx(`etat.${b.etat}`)}</Etat>
              </span>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
              {b.pieces.map((p) => (
                <React.Fragment key={p.type}>
                  <dt className="text-socle-texte-discret">{tx(`piece.court.${p.type}`)}</dt>
                  <dd>{cellule(p, b.concerne)}</dd>
                </React.Fragment>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden md:block">
        <Tableau
          entetes={[tx('col.sousTraitant'), tx('col.etat'), tx('piece.court.urssaf'), tx('piece.court.immatriculation'), tx('piece.court.assurance')]}
          lignes={liste.map((b) => [
            <span key="n" className="flex flex-col gap-0.5">
              <span className="font-medium text-socle-texte">{b.sousTraitant.nom}</span>
              <span className="text-[12px] text-socle-texte-discret">
                {tx('contrat', {
                  metier: b.sousTraitant.metier,
                  montant: euros(b.sousTraitant.montantContrat, langue),
                })}
              </span>
            </span>,
            <Etat key="e" ton={TON_ST[b.etat]}>
              {tx(`etat.${b.etat}`)}
            </Etat>,
            ...b.pieces.map((p) => <React.Fragment key={p.type}>{cellule(p, b.concerne)}</React.Fragment>),
          ])}
        />
      </div>
      <p className="text-[12.5px] leading-relaxed text-socle-texte-discret">{tx('regles')}</p>

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('relances.titre')}</h2>
        {aRelancer.length === 0 ? (
          <p className="text-[14px] text-socle-texte-doux">{tx('relances.vide')}</p>
        ) : (
          <>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-socle-bord bg-socle-creux p-4 font-[Inter,system-ui,sans-serif] text-[13px] leading-relaxed text-socle-texte-doux">
              {message}
            </pre>
            <div>
              <Bouton
                variante="primaire"
                icone={<Copy size={16} />}
                onClick={() => {
                  void navigator.clipboard?.writeText(message).then(() => setCopie(true));
                }}
              >
                {copie ? tx('copie') : tx('copier')}
              </Bouton>
            </div>
          </>
        )}
      </section>
    </CadreAtelier>
  );
}
