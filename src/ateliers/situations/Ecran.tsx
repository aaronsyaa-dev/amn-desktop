import React, { useState } from 'react';
import { Copy } from 'lucide-react';
import { Bouton, Saisie } from '../../socle/ui';
import { CadreAtelier, Chiffre, Etat, Tableau } from '../_commun/Cadre';
import { euros, nombre, versCentimes } from '../_commun/nombres';
import { CHANTIER, COURANT, HISTORIQUE, MARCHE } from './donnees';
import { useTextes } from './i18n';
import { calculerSituation, totalHT, totalTTC, verifierAvancements, verifierMarche, type Marche } from './logique';
import { MODULE } from './module';

/** Un montant qui ne se coupe pas en fin de ligne. */
function Net({ children, fort = false }: { children: React.ReactNode; fort?: boolean }) {
  return <span className={`whitespace-nowrap ${fort ? 'text-socle-texte' : ''}`}>{children}</span>;
}

const num = (s: string) => (s.trim() === '' ? Number.NaN : Number(s.replace(',', '.')));

export default function EcranSituations() {
  const { tx, langue } = useTextes();
  const [retenue, setRetenue] = useState(String(MARCHE.tauxRetenue));
  const [acompte, setAcompte] = useState(String(MARCHE.acompteTTC / 100));
  const [saisies, setSaisies] = useState<Record<string, string>>(() => Object.fromEntries(MARCHE.lots.map((l) => [l.id, String(COURANT[l.id] ?? 0)])));
  const [copie, setCopie] = useState(false);

  const marche: Marche = { ...MARCHE, tauxRetenue: num(retenue), acompteTTC: versCentimes(acompte) };
  const precedent = HISTORIQUE[HISTORIQUE.length - 1] ?? {};
  const courant = Object.fromEntries(MARCHE.lots.map((l) => [l.id, num(saisies[l.id])]));
  const fautesMarche = verifierMarche(marche);
  const fautesLots = verifierAvancements(MARCHE.lots, precedent, courant);
  const r = calculerSituation(marche, HISTORIQUE, courant);
  const numero = HISTORIQUE.length + 1;
  const e = (n: number) => euros(n, langue);
  const pct = (n: number) => `${nombre(n, 1, langue)} %`;
  const libelleDe = (id: string) => MARCHE.lots.find((l) => l.id === id)?.libelle ?? id;

  const resume = r
    ? [
        `${tx('section.recap', { n: r.numero })} — ${CHANTIER}`,
        ...r.lignes.filter((l) => l.periodeHT !== 0).map((l) => `${l.libelle} : ${pct(l.avancementPrecedent)} → ${pct(l.avancement)}, ${e(l.periodeHT)} HT`),
        `${tx('recap.ht')} : ${e(r.periodeHT)}`,
        ...r.parTaux.filter((t) => t.ht !== 0).map((t) => `${tx('recap.tva')} ${nombre(t.taux, 1, langue)} % : ${e(t.tva)}`),
        `${tx('recap.ttc')} : ${e(r.periodeTTC)}`,
        `${tx('recap.retenue', { t: nombre(marche.tauxRetenue, 2, langue) })} : − ${e(r.retenue)}`,
        `${tx('recap.acompte')} : − ${e(r.deductionAcompte)}`,
        `${tx('recap.net')} : ${e(r.netAPayer)}`,
      ].join('\n')
    : '';

  return (
    <CadreAtelier famille={MODULE.famille} nom={tx('nom')} intro={tx('intro')}>
      <p className="text-[13px] text-socle-texte-doux">
        <span className="text-socle-texte-discret">{tx('chantier')} · </span>
        {CHANTIER}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Chiffre intitule={tx('chiffre.marche')} valeur={e(totalHT(MARCHE.lots))} detail={tx('chiffre.marche.detail', { ttc: e(totalTTC(MARCHE.lots)), n: MARCHE.lots.length })} />
        <Chiffre
          intitule={tx('chiffre.avancement')}
          valeur={r ? pct(r.avancementGlobal) : '—'}
          detail={r ? tx('chiffre.avancement.detail', { cumul: e(r.cumulHT) }) : undefined}
        />
        <Chiffre intitule={tx('chiffre.retenue')} valeur={r ? e(r.retenueCumulee) : '—'} detail={tx('chiffre.retenue.detail')} />
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-[13px] font-semibold text-socle-texte-discret">{tx('section.reglages')}</legend>
        <Saisie
          etiquette={tx('retenue')}
          aide={tx('retenue.aide')}
          suffixe="%"
          inputMode="decimal"
          value={retenue}
          onChange={(ev) => setRetenue(ev.target.value)}
          erreur={fautesMarche.includes('retenue') ? tx('erreur.retenue') : undefined}
        />
        <Saisie
          etiquette={tx('acompte')}
          aide={tx('acompte.aide')}
          suffixe="€"
          inputMode="decimal"
          value={acompte}
          onChange={(ev) => setAcompte(ev.target.value)}
          erreur={fautesMarche.includes('acompte') ? tx('erreur.acompte') : undefined}
        />
      </fieldset>

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('section.lots', { n: numero })}</h2>
        <Tableau
          entetes={[tx('col.lot'), tx('col.precedent'), tx('col.avancement'), tx('col.periode'), tx('col.cumul'), tx('col.montant'), tx('col.tva')]}
          droite={[1, 2, 3, 4, 5, 6]}
          lignes={MARCHE.lots.map((l) => {
            const faute = fautesLots[l.id];
            const avance = num(saisies[l.id]);
            const fini = Number.isFinite(avance) && !faute;
            const avantHT = Math.round((l.montantHT * (precedent[l.id] ?? 0)) / 100);
            const cumulHT = fini ? Math.round((l.montantHT * avance) / 100) : null;
            return [
              <span key="l" className="text-socle-texte">
                {l.libelle}
              </span>,
              <Net key="p">{pct(precedent[l.id] ?? 0)}</Net>,
              <span key="a" className="inline-flex items-center justify-end gap-1">
                <input
                  aria-label={tx('avancement.aria', { lot: l.libelle })}
                  aria-invalid={faute ? true : undefined}
                  inputMode="decimal"
                  value={saisies[l.id]}
                  onChange={(ev) => setSaisies({ ...saisies, [l.id]: ev.target.value })}
                  className={`w-16 rounded-md border bg-socle-creux px-2 py-1 text-right text-[13.5px] tabular-nums text-socle-texte outline-none focus-visible:border-socle-focus focus-visible:ring-2 focus-visible:ring-socle-focus/25 ${faute ? 'border-etat-danger' : 'border-socle-bord-fort'}`}
                />
                <span aria-hidden className="text-socle-texte-discret">
                  %
                </span>
              </span>,
              cumulHT === null ? '—' : <Net key="q" fort={cumulHT - avantHT > 0}>{e(cumulHT - avantHT)}</Net>,
              cumulHT === null ? '—' : <Net key="c">{e(cumulHT)}</Net>,
              <Net key="m">{e(l.montantHT)}</Net>,
              <Net key="t">{`${nombre(l.tauxTva, 1, langue)} %`}</Net>,
            ];
          })}
        />
        {Object.keys(fautesLots).length > 0 && (
          <ul className="flex flex-col gap-1">
            {Object.entries(fautesLots).map(([id, f]) => (
              <li key={id}>
                <Etat ton="danger">{tx(`erreur.${f}`, { lot: libelleDe(id), p: nombre(precedent[id] ?? 0, 1, langue) })}</Etat>
              </li>
            ))}
          </ul>
        )}
      </section>

      {r && (
        <section aria-live="polite" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('section.recap', { n: r.numero })}</h2>
            <Tableau
              entetes={[tx('col.taux'), tx('col.ht'), tx('col.montantTva')]}
              droite={[1, 2]}
              lignes={r.parTaux.map((t) => [`${nombre(t.taux, 1, langue)} %`, e(t.ht), e(t.tva)])}
            />
            <dl className="flex flex-col divide-y divide-socle-bord rounded-xl border border-socle-bord text-[13.5px]">
              {(
                [
                  [tx('recap.ht'), e(r.periodeHT)],
                  [tx('recap.tva'), e(r.tva)],
                  [tx('recap.ttc'), e(r.periodeTTC)],
                  [tx('recap.retenue', { t: nombre(marche.tauxRetenue, 2, langue) }), `− ${e(r.retenue)}`],
                  [tx('recap.acompte'), `− ${e(r.deductionAcompte)}`],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt className="text-socle-texte-doux">{k}</dt>
                  <dd className="tabular-nums text-socle-texte">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex flex-col gap-4 lg:pt-7">
            <Chiffre fort intitule={tx('recap.net')} valeur={e(r.netAPayer)} detail={tx('recap.net.detail', { n: r.numero })} />
            <Bouton
              variante="primaire"
              icone={<Copy size={16} />}
              onClick={() => {
                void navigator.clipboard?.writeText(resume).then(() => setCopie(true));
              }}
            >
              {copie ? tx('copie') : tx('copier')}
            </Bouton>
          </div>
        </section>
      )}
      {!r && fautesMarche.length > 0 && <p className="text-[14px] text-socle-texte-doux">{fautesMarche.map((f) => tx(`erreur.${f}`)).join(' ')}</p>}
    </CadreAtelier>
  );
}
