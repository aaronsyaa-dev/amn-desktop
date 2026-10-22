import React, { useState } from 'react';
import { Copy } from 'lucide-react';
import { Bouton, Saisie } from '../../socle/ui';
import { CadreAtelier, Chiffre, Etat, Tableau, type Ton } from '../_commun/Cadre';
import { AUJOURDHUI_BAC_A_SABLE, dateLisible, euros, versCentimes } from '../_commun/nombres';
import { ECHEANCIERS } from './donnees';
import { useTextes } from './i18n';
import {
  NOMBRE_MAX,
  NOMBRE_MIN,
  ajusterPayees,
  basculerPayee,
  echeances,
  synthese,
  verifier,
  type Echeance,
  type Echeancier,
  type EtatEcheance,
  type ErreurEcheancier,
} from './logique';
import { MODULE } from './module';

interface Brouillon {
  montant: string;
  acompte: string;
  nombre: string;
  date: string;
}

const enBrouillon = (e: Echeancier): Brouillon => ({
  montant: String(e.montantTTC / 100),
  acompte: e.acompte ? String(e.acompte / 100) : '',
  nombre: String(e.nombre),
  date: e.premiereDate,
});

const appliquer = (e: Echeancier, b: Brouillon): Echeancier =>
  ajusterPayees({
    ...e,
    montantTTC: versCentimes(b.montant.trim() === '' ? Number.NaN : b.montant),
    acompte: b.acompte.trim() === '' ? 0 : versCentimes(b.acompte),
    nombre: b.nombre.trim() === '' ? Number.NaN : Number(b.nombre),
    premiereDate: b.date,
  });

const TON: Record<EtatEcheance, Ton> = { payee: 'succes', aVenir: 'neutre', enRetard: 'danger' };

export default function EcranEcheancier() {
  const { tx, langue } = useTextes();
  const [liste, setListe] = useState<Echeancier[]>(ECHEANCIERS);
  const [brouillons, setBrouillons] = useState<Record<string, Brouillon>>(() => Object.fromEntries(ECHEANCIERS.map((e) => [e.id, enBrouillon(e)])));
  const [choisi, setChoisi] = useState(ECHEANCIERS[0].id);
  const [copie, setCopie] = useState(false);

  const courants = liste.map((e) => appliquer(e, brouillons[e.id]));
  const syntheses = courants.map((e) => synthese(e, AUJOURDHUI_BAC_A_SABLE));
  const valides = syntheses.filter((s): s is NonNullable<typeof s> => s !== null);
  const totalReste = valides.reduce((s, x) => s + x.resteDu, 0);
  const totalRetard = valides.reduce((s, x) => s + x.enRetard, 0);
  const nbRetard = valides.reduce((s, x) => s + x.nbEnRetard, 0);
  const totalEncaisse = valides.reduce((s, x) => s + x.encaisse, 0);
  const enCours = valides.filter((s) => !s.solde).length;

  const indice = Math.max(0, courants.findIndex((e) => e.id === choisi));
  const e = courants[indice];
  const b = brouillons[e.id];
  const s = syntheses[indice];
  const lignes = echeances(e, AUJOURDHUI_BAC_A_SABLE);
  const fautes = verifier(e);
  const vars = { min: NOMBRE_MIN, max: NOMBRE_MAX };
  const faute = (f: ErreurEcheancier) => (fautes.includes(f) ? tx(`erreur.${f}`, vars) : undefined);
  const champ = (c: keyof Brouillon) => ({
    value: b[c],
    onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
      setBrouillons({ ...brouillons, [e.id]: { ...b, [c]: ev.target.value } });
      setCopie(false);
    },
  });
  const basculer = (i: number) => setListe(liste.map((x) => (x.id === e.id ? { ...x, payees: basculerPayee(e, i).payees } : x)));
  const libelleEtat = (x: Echeance) => (x.etat === 'enRetard' ? tx('etat.enRetard', { j: x.retard }) : tx(`etat.${x.etat}`));

  const pourLeClient = lignes
    ? [
        tx('client.titre', { ref: e.reference, objet: e.objet }),
        tx('client.total', { t: euros(e.montantTTC, langue) }),
        ...(e.acompte ? [tx('client.acompte', { a: euros(e.acompte, langue) })] : []),
        ...lignes.map((x) =>
          tx('client.ligne', { r: x.rang, m: euros(x.montant, langue), d: dateLisible(x.date, langue), etat: x.etat === 'payee' ? tx('client.payee') : '' }),
        ),
      ].join('\n')
    : '';

  return (
    <CadreAtelier famille={MODULE.famille} nom={tx('nom')} intro={tx('intro')}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Chiffre intitule={tx('total.reste')} valeur={euros(totalReste, langue)} detail={tx('total.reste.detail', { n: enCours })} />
        <Chiffre
          intitule={tx('total.retard')}
          valeur={euros(totalRetard, langue)}
          detail={nbRetard === 0 ? tx('total.retard.aucun') : nbRetard === 1 ? tx('total.retard.detail.un') : tx('total.retard.detail', { n: nbRetard })}
        />
        <Chiffre intitule={tx('total.encaisse')} valeur={euros(totalEncaisse, langue)} detail={tx('total.encaisse.detail')} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <nav aria-label={tx('section.liste')} className="flex min-w-0 flex-col gap-2">
          <h2 className="mb-1 text-[13px] font-semibold text-socle-texte-discret">{tx('section.liste')}</h2>
          {courants.map((x, i) => {
            const sx = syntheses[i];
            const actif = x.id === e.id;
            return (
              <button
                key={x.id}
                type="button"
                aria-current={actif || undefined}
                onClick={() => {
                  setChoisi(x.id);
                  setCopie(false);
                }}
                className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-socle-focus ${
                  actif ? 'border-socle-bord-fort bg-socle-eleve' : 'border-socle-bord bg-socle-surface hover:bg-socle-survol'
                }`}
              >
                <span className="text-[14px] font-semibold text-socle-texte">{x.client}</span>
                <span className="text-[12.5px] text-socle-texte-discret">
                  {x.reference} · {x.objet}
                </span>
                {sx &&
                  (sx.solde ? (
                    <Etat ton="succes">{tx('carte.solde')}</Etat>
                  ) : (
                    <Etat ton={sx.nbEnRetard > 0 ? 'danger' : 'neutre'}>{tx('carte.reste', { m: euros(sx.resteDu, langue) })}</Etat>
                  ))}
              </button>
            );
          })}
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          <header className="flex flex-col gap-1">
            <h2 className="text-[18px] font-semibold text-socle-texte">{e.client}</h2>
            <p className="text-[13px] text-socle-texte-discret">
              {e.reference} · {e.objet}
            </p>
          </header>

          {s && (
            <Chiffre
              fort
              intitule={tx('res.reste')}
              valeur={euros(s.resteDu, langue)}
              detail={[
                tx('res.reste.detail', { e: euros(s.encaisse, langue), t: euros(e.montantTTC, langue) }),
                s.prochaine ? tx('res.prochaine', { m: euros(s.prochaine.montant, langue), d: dateLisible(s.prochaine.date, langue) }) : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          )}

          <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-[13px] font-semibold text-socle-texte-discret sm:col-span-2">{tx('section.reglages')}</legend>
            <Saisie etiquette={tx('montant')} suffixe="€" inputMode="decimal" erreur={faute('montant')} {...champ('montant')} />
            <Saisie etiquette={tx('acompte')} aide={tx('acompte.aide')} suffixe="€" inputMode="decimal" erreur={faute('acompte')} {...champ('acompte')} />
            <Saisie etiquette={tx('nombre')} aide={tx('nombre.aide', vars)} inputMode="numeric" erreur={faute('nombre') ?? faute('tropPetit')} {...champ('nombre')} />
            <Saisie etiquette={tx('date')} aide={tx('date.aide')} type="date" erreur={faute('date')} {...champ('date')} />
          </fieldset>

          <section aria-live="polite" className="flex flex-col gap-3">
            <h3 className="text-[13px] font-semibold text-socle-texte-discret">{tx('section.echeances')}</h3>
            {lignes ? (
              <>
                <Tableau
                  entetes={[tx('col.rang'), tx('col.date'), tx('col.etat'), tx('col.payee')]}
                  lignes={lignes.map((x, i) => [
                    String(x.rang),
                    <span key="d" className="flex flex-col whitespace-nowrap">
                      <span>{dateLisible(x.date, langue)}</span>
                      <span className="font-semibold tabular-nums text-socle-texte">{euros(x.montant, langue)}</span>
                    </span>,
                    <span key="e" className="whitespace-nowrap">
                      <Etat ton={TON[x.etat]}>{libelleEtat(x)}</Etat>
                    </span>,
                    <input
                      key="p"
                      type="checkbox"
                      checked={x.etat === 'payee'}
                      onChange={() => basculer(i)}
                      aria-label={tx('marquer', { r: x.rang })}
                      className="h-4 w-4 cursor-pointer accent-socle-texte"
                    />,
                  ])}
                />
                <p className="text-[12.5px] leading-relaxed text-socle-texte-discret">{tx('regle')}</p>
                <div>
                  <Bouton
                    variante="primaire"
                    icone={<Copy size={16} />}
                    onClick={() => {
                      void navigator.clipboard?.writeText(pourLeClient).then(() => setCopie(true));
                    }}
                  >
                    {copie ? tx('copie') : tx('copier')}
                  </Bouton>
                </div>
              </>
            ) : (
              <p className="text-[14px] text-socle-texte-doux">{fautes.map((f) => tx(`erreur.${f}`, vars)).join(' ')}</p>
            )}
          </section>
        </div>
      </div>
    </CadreAtelier>
  );
}
