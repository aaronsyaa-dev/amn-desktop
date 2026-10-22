import React, { useState } from 'react';
import { Copy } from 'lucide-react';
import { Bouton, Saisie } from '../../socle/ui';
import { CadreAtelier, Chiffre, Choix, Etat, Tableau } from '../_commun/Cadre';
import { dateLisible, estDateIso, euros, nombre } from '../_commun/nombres';
import { CREANCIER, DEBITEURS, FACTURES, PARAMETRES } from './donnees';
import { useTextes } from './i18n';
import { calculerPenalites, verifierParametres, type Debiteur, type Parametres } from './logique';
import { MODULE } from './module';

const num = (s: string) => (s.trim() === '' ? Number.NaN : Number(s.replace(',', '.')));

export default function EcranPenalites() {
  const { tx, langue } = useTextes();
  const [idDebiteur, setIdDebiteur] = useState(DEBITEURS[0].id);
  const [dateCalcul, setDateCalcul] = useState(PARAMETRES.dateCalcul);
  const [tauxContractuel, setTauxContractuel] = useState('');
  const [tauxBce, setTauxBce] = useState(String(PARAMETRES.tauxBce));
  const [tauxLegal, setTauxLegal] = useState(String(PARAMETRES.tauxLegal));
  const [miseEnDemeure, setMiseEnDemeure] = useState<Record<string, string>>(() =>
    Object.fromEntries(DEBITEURS.map((d) => [d.id, d.dateMiseEnDemeure ?? ''])),
  );
  const [copie, setCopie] = useState(false);

  const base = DEBITEURS.find((d) => d.id === idDebiteur) ?? DEBITEURS[0];
  const med = miseEnDemeure[base.id] ?? '';
  const debiteur: Debiteur = { ...base, dateMiseEnDemeure: base.type === 'particulier' && med.trim() !== '' ? med : undefined };
  const parametres: Parametres = {
    dateCalcul,
    tauxContractuel: tauxContractuel.trim() === '' ? undefined : num(tauxContractuel),
    tauxBce: num(tauxBce),
    tauxLegal: num(tauxLegal),
  };
  const fautes = verifierParametres(parametres);
  const medFausse = base.type === 'particulier' && med.trim() !== '' && !estDateIso(med);
  const r = calculerPenalites(debiteur, FACTURES, parametres);
  const e = (c: number) => euros(c, langue);
  const d = (s: string) => (estDateIso(s) ? dateLisible(s, langue) : s);
  const taux = (t: number) => nombre(t, 2, langue);
  const faute = (f: (typeof fautes)[number]) => (fautes.includes(f) ? tx(`erreur.${f}`) : undefined);
  const pro = base.type === 'pro';

  const echues = r ? r.lignes.filter((l) => l.joursRetard > 0) : [];
  const lettre =
    r && echues.length > 0
      ? [
          CREANCIER,
          `${debiteur.nom}`,
          '',
          tx('lettre.objet'),
          '',
          tx('lettre.salut'),
          '',
          tx('lettre.intro', { date: d(dateCalcul) }),
          ...echues.map((l) => tx('lettre.ligne', { numero: l.facture.numero, echeance: d(l.facture.echeance), montant: e(l.facture.montantTTC), jours: l.joursRetard })),
          '',
          pro
            ? tx('lettre.pro', { taux: taux(r.taux), interets: e(r.interets), date: d(dateCalcul), indemnites: e(r.indemnites) })
            : [tx('lettre.particulier', { taux: taux(r.taux) }), debiteur.dateMiseEnDemeure ? tx('lettre.particulier.courus', { depuis: d(debiteur.dateMiseEnDemeure), interets: e(r.interets) }) : '']
                .filter(Boolean)
                .join(' '),
          '',
          tx('lettre.demande', { total: e(r.total) }),
          '',
          tx('lettre.fin'),
          CREANCIER,
        ].join('\n')
      : '';

  return (
    <CadreAtelier famille={MODULE.famille} nom={tx('nom')} intro={tx('intro')}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Choix
            etiquette={tx('debiteur')}
            valeur={idDebiteur}
            onChange={(v) => {
              setIdDebiteur(v);
              setCopie(false);
            }}
            options={DEBITEURS.map((x) => ({ valeur: x.id, libelle: `${x.nom} · ${tx(x.type === 'pro' ? 'debiteur.pro' : 'debiteur.particulier')}` }))}
          />
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-[13px] font-semibold text-socle-texte-discret">{tx('section.taux')}</legend>
            <Saisie etiquette={tx('dateCalcul')} type="date" value={dateCalcul} onChange={(ev) => setDateCalcul(ev.target.value)} erreur={faute('dateCalcul')} />
            {pro ? (
              <Saisie
                etiquette={tx('tauxContractuel')}
                aide={tx('tauxContractuel.aide')}
                suffixe="%"
                inputMode="decimal"
                value={tauxContractuel}
                onChange={(ev) => setTauxContractuel(ev.target.value)}
                erreur={faute('tauxContractuel')}
              />
            ) : (
              <Saisie
                etiquette={tx('miseEnDemeure')}
                aide={tx('miseEnDemeure.aide')}
                type="date"
                value={med}
                onChange={(ev) => setMiseEnDemeure({ ...miseEnDemeure, [base.id]: ev.target.value })}
                erreur={medFausse ? tx('erreur.dateCalcul') : undefined}
              />
            )}
            {pro && (
              <Saisie etiquette={tx('tauxBce')} aide={tx('tauxBce.aide')} suffixe="%" inputMode="decimal" value={tauxBce} onChange={(ev) => setTauxBce(ev.target.value)} erreur={faute('tauxBce')} />
            )}
            <Saisie
              etiquette={tx('tauxLegal')}
              aide={tx('tauxLegal.aide')}
              suffixe="%"
              inputMode="decimal"
              value={tauxLegal}
              onChange={(ev) => setTauxLegal(ev.target.value)}
              erreur={faute('tauxLegal')}
            />
          </fieldset>
        </div>

        <section aria-live="polite" className="flex flex-col gap-3 lg:pt-7">
          {r ? (
            <>
              <Chiffre fort intitule={tx('res.total')} valeur={e(r.total)} detail={tx('res.total.detail', { i: e(r.interets), f: e(r.indemnites) })} />
              <Chiffre intitule={tx('res.taux')} valeur={`${taux(r.taux)} %`} detail={tx(`base.${r.base}`)} />
              {echues.length === 0 && <Etat ton="neutre">{tx('res.rien')}</Etat>}
            </>
          ) : (
            <p className="text-[14px] text-socle-texte-doux">{[...fautes.map((f) => tx(`erreur.${f}`)), medFausse ? tx('erreur.dateCalcul') : ''].join(' ')}</p>
          )}
        </section>
      </div>

      {r && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('section.factures')}</h2>
          <Tableau
            entetes={[tx('col.numero'), tx('col.retard'), tx('col.interets'), tx('col.indemnite'), tx('col.montant'), tx('col.echeance')]}
            droite={[1, 2, 3, 4]}
            lignes={r.lignes.map((l) => [
              <span key="n" className="flex flex-col gap-0.5">
                <span className="whitespace-nowrap text-socle-texte">{l.facture.numero}</span>
                <Etat ton={l.joursRetard > 0 ? 'attention' : 'neutre'}>{tx(l.joursRetard > 0 ? 'etat.retard' : 'etat.aVenir')}</Etat>
              </span>,
              <span key="j" className="whitespace-nowrap">
                {tx('jours', { n: l.joursRetard })}
              </span>,
              <span key="i" className="whitespace-nowrap">
                {e(l.interets)}
              </span>,
              <span key="f" className="whitespace-nowrap">
                {e(l.indemnite)}
              </span>,
              <span key="m" className="whitespace-nowrap">
                {e(l.facture.montantTTC)}
              </span>,
              <span key="d" className="whitespace-nowrap">
                {d(l.facture.echeance)}
              </span>,
            ])}
          />
        </section>
      )}

      {lettre && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('section.lettre')}</h2>
            <p className="text-[12.5px] text-socle-texte-discret">{tx('lettre.aide')}</p>
          </div>
          <pre className="whitespace-pre-wrap rounded-xl border border-socle-bord bg-socle-surface p-4 font-[inherit] text-[13.5px] leading-relaxed text-socle-texte-doux">{lettre}</pre>
          <div>
            <Bouton
              variante="primaire"
              icone={<Copy size={16} />}
              onClick={() => {
                void navigator.clipboard?.writeText(lettre).then(() => setCopie(true));
              }}
            >
              {copie ? tx('copie') : tx('copier')}
            </Bouton>
          </div>
        </section>
      )}
    </CadreAtelier>
  );
}
