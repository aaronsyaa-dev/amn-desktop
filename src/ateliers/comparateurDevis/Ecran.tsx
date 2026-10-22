import React, { useState } from 'react';
import { Copy } from 'lucide-react';
import { Bouton, Saisie } from '../../socle/ui';
import { CadreAtelier, Etat } from '../_commun/Cadre';
import { euros, nombre, versCentimes } from '../_commun/nombres';
import { BESOIN, OFFRES, POIDS } from './donnees';
import { useTextes } from './i18n';
import { comparer, CRITERES, verifier, verifierOffre, type Critere, type Offre } from './logique';
import { MODULE } from './module';

type ChampOffre = 'fournisseur' | 'prix' | 'delai' | 'garantie' | 'qualite' | 'acompte';
type LigneTexte = { id: string } & Record<ChampOffre, string>;

const enTexte = (o: Offre): LigneTexte => ({
  id: o.id,
  fournisseur: o.fournisseur,
  prix: String(o.prixHT / 100),
  delai: String(o.delaiJours),
  garantie: String(o.garantieMois),
  qualite: String(o.qualite),
  acompte: String(o.acomptePct),
});
const num = (s: string) => (s.trim() === '' ? Number.NaN : Number(s.replace(',', '.')));
const versOffre = (l: LigneTexte): Offre => ({
  id: l.id,
  fournisseur: l.fournisseur,
  prixHT: versCentimes(l.prix),
  delaiJours: num(l.delai),
  garantieMois: num(l.garantie),
  qualite: num(l.qualite),
  acomptePct: num(l.acompte),
});

const COLONNES: readonly ChampOffre[] = ['fournisseur', 'prix', 'delai', 'garantie', 'qualite', 'acompte'];

export default function EcranComparateurDevis() {
  const { tx, langue } = useTextes();
  const [lignes, setLignes] = useState<LigneTexte[]>(() => OFFRES.map(enTexte));
  const [poids, setPoids] = useState<Record<Critere, string>>(() => Object.fromEntries(CRITERES.map((c) => [c, String(POIDS[c])])) as Record<Critere, string>);
  const [copie, setCopie] = useState(false);

  const offres = lignes.map(versOffre);
  const p = Object.fromEntries(CRITERES.map((c) => [c, num(poids[c])])) as Record<Critere, number>;
  const fautes = verifier(offres, p);
  const r = comparer(offres, p);
  const changer = (id: string, champ: ChampOffre, valeur: string) => setLignes(lignes.map((l) => (l.id === id ? { ...l, [champ]: valeur } : l)));

  const texte = r
    ? [`${tx('besoin')} : ${BESOIN}`, ...r.map((n) => `${n.rang}. ${n.offre.fournisseur} — ${nombre(n.total, 1, langue)}/100 — ${euros(n.offre.prixHT, langue)}`)].join('\n')
    : '';

  return (
    <CadreAtelier famille={MODULE.famille} nom={tx('nom')} intro={tx('intro')}>
      <p className="text-[14px] text-socle-texte">
        <span className="text-socle-texte-discret">{tx('besoin')} · </span>
        {BESOIN}
      </p>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-[13px] font-semibold text-socle-texte-discret">{tx('section.poids')}</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {CRITERES.map((c) => (
            <Saisie key={c} etiquette={tx(`critere.${c}`)} inputMode="decimal" value={poids[c]} onChange={(e) => setPoids({ ...poids, [c]: e.target.value })} />
          ))}
        </div>
        <p className="text-[12.5px] text-socle-texte-discret">{tx('poids.aide')}</p>
      </fieldset>

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('section.offres')}</h2>
        <div className="overflow-x-auto rounded-xl border border-socle-bord">
          <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
            <thead>
              <tr className="bg-socle-surface">
                {COLONNES.map((c) => (
                  <th key={c} scope="col" className={`px-3 py-2 text-[12px] font-semibold text-socle-texte-discret ${c === 'fournisseur' ? 'text-left' : 'text-right'}`}>
                    {tx(`col.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => {
                const erreurs = verifierOffre(versOffre(l));
                return (
                  <tr key={l.id} className="border-t border-socle-bord">
                    {COLONNES.map((c) => (
                      <td key={c} className="px-2 py-1.5">
                        <input
                          aria-label={`${tx(`col.${c}`)} — ${l.fournisseur || l.id}`}
                          aria-invalid={erreurs.includes(c) || undefined}
                          inputMode={c === 'fournisseur' ? undefined : 'decimal'}
                          value={l[c]}
                          onChange={(e) => changer(l.id, c, e.target.value)}
                          className={`w-full rounded-md border bg-socle-creux px-2 py-1.5 text-socle-texte outline-none focus-visible:border-socle-focus ${
                            c === 'fournisseur' ? 'min-w-[200px] text-left' : 'min-w-[84px] text-right tabular-nums'
                          } ${erreurs.includes(c) ? 'border-etat-danger' : 'border-socle-bord'}`}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-live="polite" className="flex flex-col gap-3">
        <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('section.classement')}</h2>
        {r ? (
          <>
            <p className="text-[16px] font-semibold">{tx('res.premier', { f: r[0].offre.fournisseur, n: nombre(r[0].total, 1, langue) })}</p>
            <ol className="flex flex-col gap-2">
              {r.map((n) => (
                <li key={n.offre.id} className="flex flex-col gap-2 rounded-xl border border-socle-bord bg-socle-surface p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-[14.5px] font-semibold">
                      <span className="mr-2 tabular-nums text-socle-texte-discret">{n.rang}.</span>
                      {n.offre.fournisseur}
                    </span>
                    <span className="tabular-nums text-[14px]">
                      <span className="font-semibold">{nombre(n.total, 1, langue)}</span>
                      <span className="text-socle-texte-discret">/100 · {euros(n.offre.prixHT, langue)}</span>
                    </span>
                  </div>
                  <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-socle-creux">
                    <div className="h-full rounded-full bg-socle-texte-doux" style={{ width: `${Math.max(0, Math.min(100, n.total))}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-socle-texte-discret">
                    {CRITERES.map((c) => (
                      <span key={c}>
                        {tx(`critere.${c}`)} {nombre(n.notes[c], 0, langue)}
                      </span>
                    ))}
                    <span>{n.ecartAuMoinsCher === 0 ? tx('res.ecart0') : `+${euros(n.ecartAuMoinsCher, langue)}`}</span>
                  </div>
                  {n.anormalementBasse && <Etat ton="attention">{tx('res.anormal', { p: n.sousLaMoyennePct })}</Etat>}
                </li>
              ))}
            </ol>
            <div>
              <Bouton
                variante="primaire"
                icone={<Copy size={16} />}
                onClick={() => {
                  void navigator.clipboard?.writeText(texte).then(() => setCopie(true));
                }}
              >
                {copie ? tx('copie') : tx('copier')}
              </Bouton>
            </div>
          </>
        ) : (
          <p className="text-[14px] text-socle-texte-doux">
            {fautes
              .map((f) =>
                f === 'nombre' || f === 'poids' ? tx(`erreur.${f}`) : tx('erreur.offre', { f: lignes.find((l) => l.id === f.offre)?.fournisseur || f.offre }),
              )
              .join(' ')}
          </p>
        )}
      </section>
    </CadreAtelier>
  );
}
