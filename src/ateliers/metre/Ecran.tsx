import React, { useRef, useState } from 'react';
import { Copy, Plus, X } from 'lucide-react';
import { Bouton, Saisie } from '../../socle/ui';
import { CadreAtelier, Chiffre, Etat, Tableau } from '../_commun/Cadre';
import { euros, nombre, versCentimes } from '../_commun/nombres';
import { MATERIAUX, PIECES } from './donnees';
import { useTextes } from './i18n';
import {
  OUVRAGES,
  coutTotal,
  enM2,
  quantitatif,
  surfacePiece,
  verifierMateriau,
  verifierPiece,
  versCm,
  type Materiau,
  type Ouvrage,
  type Piece,
} from './logique';
import { MODULE } from './module';

interface FormOuverture {
  nom: string;
  largeur: string;
  hauteur: string;
  nombre: string;
}
interface FormPiece {
  id: string;
  nom: string;
  longueur: string;
  largeur: string;
  hauteur: string;
  ouvertures: FormOuverture[];
}
interface FormMateriau {
  actif: boolean;
  libelle: string;
  unite: string;
  rendementM2: string;
  couches: string;
  chute: string;
  prix: string;
}

const enMetres = (cm: number) => String(cm / 100).replace('.', ',');
const num = (s: string) => (s.trim() === '' ? Number.NaN : Number(s.replace(/\s/g, '').replace(',', '.')));

const formPiece = (p: Piece): FormPiece => ({
  id: p.id,
  nom: p.nom,
  longueur: enMetres(p.longueur),
  largeur: enMetres(p.largeur),
  hauteur: enMetres(p.hauteur),
  ouvertures: p.ouvertures.map((o) => ({ nom: o.nom, largeur: enMetres(o.largeur), hauteur: enMetres(o.hauteur), nombre: String(o.nombre) })),
});

const versPiece = (f: FormPiece): Piece => ({
  id: f.id,
  nom: f.nom,
  longueur: versCm(f.longueur),
  largeur: versCm(f.largeur),
  hauteur: versCm(f.hauteur),
  ouvertures: f.ouvertures.map((o) => ({ nom: o.nom, largeur: versCm(o.largeur), hauteur: versCm(o.hauteur), nombre: num(o.nombre) })),
});

const formMateriau = (m: Materiau): FormMateriau => ({
  actif: true,
  libelle: m.libelle,
  unite: m.unite,
  rendementM2: String(m.rendementM2).replace('.', ','),
  couches: String(m.couches),
  chute: String(m.chute).replace('.', ','),
  prix: String(m.prixUnitaire / 100).replace('.', ','),
});

const versMateriau = (f: FormMateriau): Materiau => ({
  libelle: f.libelle,
  unite: f.unite,
  rendementM2: num(f.rendementM2),
  couches: num(f.couches),
  chute: num(f.chute),
  prixUnitaire: versCentimes(f.prix),
});

export default function EcranMetre() {
  const { tx, langue } = useTextes();
  const [pieces, setPieces] = useState<FormPiece[]>(() => PIECES.map(formPiece));
  const [materiaux, setMateriaux] = useState<Record<Ouvrage, FormMateriau>>(() => ({
    sol: formMateriau(MATERIAUX.sol),
    murs: formMateriau(MATERIAUX.murs),
    plafond: formMateriau(MATERIAUX.plafond),
  }));
  const [copie, setCopie] = useState(false);
  const suivant = useRef(1);

  const vraies = pieces.map(versPiece);
  const actifs: Partial<Record<Ouvrage, Materiau>> = {};
  for (const o of OUVRAGES) if (materiaux[o].actif) actifs[o] = versMateriau(materiaux[o]);
  const lignes = quantitatif(vraies, actifs);

  const majPiece = (i: number, champ: keyof Omit<FormPiece, 'id' | 'ouvertures'>, valeur: string) =>
    setPieces(pieces.map((p, j) => (j === i ? { ...p, [champ]: valeur } : p)));
  const majOuverture = (i: number, k: number, champ: keyof FormOuverture, valeur: string) =>
    setPieces(pieces.map((p, j) => (j === i ? { ...p, ouvertures: p.ouvertures.map((o, l) => (l === k ? { ...o, [champ]: valeur } : o)) } : p)));
  const majMateriau = (o: Ouvrage, champ: keyof FormMateriau, valeur: string | boolean) => setMateriaux({ ...materiaux, [o]: { ...materiaux[o], [champ]: valeur } });

  const nomOuvrage = (o: Ouvrage) => tx(`ouvrage.${o}`);
  const resume = lignes
    ? [
        ...lignes.map((l) => `${nomOuvrage(l.ouvrage)} : ${nombre(enM2(l.surfaceCm2), 2, langue)} m² — ${l.materiau.libelle} : ${l.quantite} × ${l.materiau.unite} — ${euros(l.cout, langue)}`),
        `${tx('res.total')} : ${euros(coutTotal(lignes), langue)}`,
      ].join('\n')
    : '';

  return (
    <CadreAtelier famille={MODULE.famille} nom={tx('nom')} intro={tx('intro')}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-4">
            <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('section.pieces')}</h2>
            {pieces.map((f, i) => {
              const p = vraies[i];
              const fautes = verifierPiece(p);
              return (
                <div key={f.id} className="flex flex-col gap-4 rounded-xl border border-socle-bord bg-socle-surface p-4">
                  <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
                    <Saisie etiquette={tx('piece.nom')} value={f.nom} onChange={(e) => majPiece(i, 'nom', e.target.value)} erreur={fautes.includes('nom') ? tx('erreur.nom') : undefined} />
                    <Saisie etiquette={tx('piece.longueur')} suffixe="m" inputMode="decimal" value={f.longueur} onChange={(e) => majPiece(i, 'longueur', e.target.value)} />
                    <Saisie etiquette={tx('piece.largeur')} suffixe="m" inputMode="decimal" value={f.largeur} onChange={(e) => majPiece(i, 'largeur', e.target.value)} />
                    <Saisie etiquette={tx('piece.hauteur')} suffixe="m" inputMode="decimal" value={f.hauteur} onChange={(e) => majPiece(i, 'hauteur', e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-[12px] font-semibold text-socle-texte-discret">{tx('ouverture.titre')}</h3>
                    {f.ouvertures.map((o, k) => (
                      <div key={k} className="grid grid-cols-[repeat(3,minmax(0,1fr))_auto] items-end gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto]">
                        <div className="col-span-4 sm:col-span-1">
                          <Saisie etiquette={tx('ouverture.nom')} value={o.nom} onChange={(e) => majOuverture(i, k, 'nom', e.target.value)} />
                        </div>
                        <Saisie etiquette={tx('ouverture.largeur')} suffixe="m" inputMode="decimal" value={o.largeur} onChange={(e) => majOuverture(i, k, 'largeur', e.target.value)} />
                        <Saisie etiquette={tx('ouverture.hauteur')} suffixe="m" inputMode="decimal" value={o.hauteur} onChange={(e) => majOuverture(i, k, 'hauteur', e.target.value)} />
                        <Saisie etiquette={tx('ouverture.nombre')} inputMode="numeric" value={o.nombre} onChange={(e) => majOuverture(i, k, 'nombre', e.target.value)} />
                        <Bouton
                          variante="discret"
                          taille="petit"
                          aria-label={`${tx('ouverture.retirer')} ${o.nom}`}
                          icone={<X size={14} />}
                          className="mb-1.5"
                          onClick={() => setPieces(pieces.map((q, j) => (j === i ? { ...q, ouvertures: q.ouvertures.filter((_, l) => l !== k) } : q)))}
                        />
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Bouton
                        variante="discret"
                        taille="petit"
                        icone={<Plus size={14} />}
                        onClick={() => setPieces(pieces.map((q, j) => (j === i ? { ...q, ouvertures: [...q.ouvertures, { nom: tx('ouverture.defaut'), largeur: '0,9', hauteur: '2,04', nombre: '1' }] } : q)))}
                      >
                        {tx('ouverture.ajouter')}
                      </Bouton>
                      {pieces.length > 1 && (
                        <Bouton variante="discret" taille="petit" onClick={() => setPieces(pieces.filter((_, j) => j !== i))}>
                          {tx('piece.retirer')}
                        </Bouton>
                      )}
                    </div>
                  </div>
                  {fautes.length === 0 ? (
                    <p className="text-[12.5px] tabular-nums text-socle-texte-discret">
                      {tx('piece.surfaces', { s: nombre(enM2(surfacePiece(p, 'sol')), 2, langue), m: nombre(enM2(surfacePiece(p, 'murs')), 2, langue) })}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {fautes
                        .filter((x) => x !== 'nom')
                        .map((x) => (
                          <Etat key={x} ton="danger">
                            {tx(`erreur.${x}`)}
                          </Etat>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div>
              <Bouton
                variante="secondaire"
                icone={<Plus size={16} />}
                onClick={() => {
                  suivant.current += 1;
                  setPieces([
                    ...pieces,
                    { id: `piece-${suivant.current}`, nom: tx('piece.nouvelle', { n: pieces.length + 1 }), longueur: '4', largeur: '3', hauteur: '2,5', ouvertures: [] },
                  ]);
                }}
              >
                {tx('piece.ajouter')}
              </Bouton>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('section.ouvrages')}</h2>
            {OUVRAGES.map((o) => {
              const f = materiaux[o];
              const fautes = f.actif ? verifierMateriau(versMateriau(f)) : [];
              const faute = (x: (typeof fautes)[number]) => (fautes.includes(x) ? tx(`erreur.${x}`) : undefined);
              return (
                <div key={o} className="flex flex-col gap-4 rounded-xl border border-socle-bord bg-socle-surface p-4">
                  <label className="flex items-center gap-2 text-[14px] font-semibold text-socle-texte">
                    <input type="checkbox" checked={f.actif} onChange={(e) => majMateriau(o, 'actif', e.target.checked)} className="h-4 w-4 accent-[var(--color-socle-texte)] [color-scheme:dark]" />
                    {tx('ouvrage.compter', { o: nomOuvrage(o).toLowerCase() })}
                  </label>
                  {f.actif && (
                    <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3">
                      <div className="col-span-2">
                        <Saisie etiquette={tx('mat.libelle')} value={f.libelle} onChange={(e) => majMateriau(o, 'libelle', e.target.value)} />
                      </div>
                      <Saisie etiquette={tx('mat.unite')} value={f.unite} onChange={(e) => majMateriau(o, 'unite', e.target.value)} />
                      <Saisie
                        etiquette={tx('mat.rendement')}
                        aide={tx('mat.rendement.aide')}
                        suffixe="m²"
                        inputMode="decimal"
                        value={f.rendementM2}
                        erreur={faute('rendement')}
                        onChange={(e) => majMateriau(o, 'rendementM2', e.target.value)}
                      />
                      <Saisie etiquette={tx('mat.couches')} inputMode="numeric" value={f.couches} erreur={faute('couches')} onChange={(e) => majMateriau(o, 'couches', e.target.value)} />
                      <Saisie etiquette={tx('mat.chute')} suffixe="%" inputMode="decimal" value={f.chute} erreur={faute('chute')} onChange={(e) => majMateriau(o, 'chute', e.target.value)} />
                      <Saisie etiquette={tx('mat.prix')} suffixe="€" inputMode="decimal" value={f.prix} erreur={faute('prix')} onChange={(e) => majMateriau(o, 'prix', e.target.value)} />
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </div>

        <section aria-live="polite" className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('section.resultat')}</h2>
          {!lignes ? (
            <p className="text-[14px] text-socle-texte-doux">{tx('erreur.global')}</p>
          ) : lignes.length === 0 ? (
            <p className="text-[14px] text-socle-texte-doux">{tx('res.aucun')}</p>
          ) : (
            <>
              <Chiffre fort intitule={tx('res.total')} valeur={euros(coutTotal(lignes), langue)} detail={tx('res.total.detail')} />
              <Tableau
                entetes={[tx('col.ouvrage'), tx('col.surface'), tx('col.quantite'), tx('col.cout')]}
                droite={[1, 2, 3]}
                lignes={lignes.map((l) => [
                  <span key="o" className="flex flex-col">
                    <span className="text-socle-texte">{nomOuvrage(l.ouvrage)}</span>
                    <span className="text-[12px] text-socle-texte-discret">{l.materiau.libelle}</span>
                  </span>,
                  `${nombre(enM2(l.surfaceCm2), 2, langue)} m²`,
                  <span key="q" className="whitespace-nowrap">
                    <span className="text-socle-texte">{l.quantite}</span>
                    <span className="text-[12px] text-socle-texte-discret"> × {l.materiau.unite}</span>
                  </span>,
                  euros(l.cout, langue),
                ])}
              />
              <Bouton
                variante="primaire"
                icone={<Copy size={16} />}
                onClick={() => {
                  void navigator.clipboard?.writeText(resume).then(() => setCopie(true));
                }}
              >
                {copie ? tx('copie') : tx('copier')}
              </Bouton>
            </>
          )}
        </section>
      </div>
    </CadreAtelier>
  );
}
