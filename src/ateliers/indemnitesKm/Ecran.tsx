import React, { useState } from 'react';
import { Copy, Plus, X } from 'lucide-react';
import { Bouton, Saisie } from '../../socle/ui';
import { CadreAtelier, Chiffre, Choix, Tableau } from '../_commun/Cadre';
import { AUJOURDHUI_BAC_A_SABLE, euros, nombre } from '../_commun/nombres';
import { ANNEE_EXEMPLE, PUISSANCE_EXEMPLE, TRAJETS } from './donnees';
import { useTextes } from './i18n';
import { BAREME_2025, PUISSANCES, bilan, formule, verifierTrajet, type ErreurTrajet, type Puissance, type Trajet } from './logique';
import { MODULE } from './module';

const VIDE = { date: AUJOURDHUI_BAC_A_SABLE, motif: '', depart: '', arrivee: '', km: '', allerRetour: true };

function dateCourte(s: string, langue: 'fr' | 'en'): string {
  const [a, m, j] = s.split('-').map(Number);
  return new Intl.DateTimeFormat(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(Date.UTC(a, m - 1, j));
}

function nomDuMois(mois: string, langue: 'fr' | 'en'): string {
  const [a, m] = mois.split('-').map(Number);
  return new Intl.DateTimeFormat(langue === 'fr' ? 'fr-FR' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(a, m - 1, 1));
}

export default function EcranIndemnitesKm() {
  const { tx, langue } = useTextes();
  const [puissance, setPuissance] = useState<Puissance>(PUISSANCE_EXEMPLE);
  const [electrique, setElectrique] = useState(false);
  const [trajets, setTrajets] = useState<Trajet[]>(TRAJETS);
  const [neuf, setNeuf] = useState(VIDE);
  const [tente, setTente] = useState(false);
  const [suivant, setSuivant] = useState(1);
  const [copie, setCopie] = useState(false);

  const b = bilan(trajets, ANNEE_EXEMPLE, puissance, electrique);
  const f = formule(b.kmTotal, puissance);
  const texteFormule = `d × ${nombre(f.taux, 3, langue)}${f.fixe ? ` + ${euros(f.fixe, langue)}` : ''}${electrique ? ` + ${BAREME_2025.majorationElectrique} %` : ''}`;

  const candidat = { ...neuf, km: neuf.km.trim() === '' ? Number.NaN : Number(neuf.km.replace(',', '.')) };
  const fautes = verifierTrajet(candidat);
  const faute = (e: ErreurTrajet) => (tente && fautes.includes(e) ? tx(`erreur.${e}`) : undefined);
  const champ = (c: 'date' | 'motif' | 'depart' | 'arrivee' | 'km') => ({
    value: neuf[c],
    onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setNeuf({ ...neuf, [c]: ev.target.value }),
  });

  const ajouter = () => {
    setTente(true);
    if (fautes.length > 0) return;
    setTrajets([...trajets, { id: `n${suivant}`, ...candidat }]);
    setSuivant(suivant + 1);
    setNeuf({ ...VIDE, date: neuf.date });
    setTente(false);
  };

  const recap = [
    tx('recap.titre', { annee: b.annee, puissance: tx(`puissance.${puissance}`) }),
    `${tx('res.km')} : ${nombre(b.kmTotal, 1, langue)} km`,
    `${tx('res.indemnite', { annee: b.annee })} : ${euros(b.indemnite, langue)} (${texteFormule})`,
    ...b.parMois.map((m) => `${nomDuMois(m.mois, langue)} : ${nombre(m.km, 1, langue)} km, ${euros(m.montant, langue)}`),
    tx('bareme', { annee: BAREME_2025.annee }),
  ].join('\n');

  return (
    <CadreAtelier famille={MODULE.famille} nom={tx('nom')} intro={tx('intro')}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <fieldset className="flex min-w-0 flex-col gap-4">
            <legend className="mb-3 text-[13px] font-semibold text-socle-texte-discret">{tx('section.vehicule')}</legend>
            <Choix etiquette={tx('puissance')} valeur={puissance} onChange={setPuissance} options={PUISSANCES.map((p) => ({ valeur: p, libelle: tx(`puissance.${p}`) }))} />
            <label className="flex items-center gap-2.5 text-[14px] text-socle-texte">
              <input type="checkbox" checked={electrique} onChange={(e) => setElectrique(e.target.checked)} className="h-4 w-4 accent-socle-texte" />
              {tx('electrique', { p: BAREME_2025.majorationElectrique })}
            </label>
            <p className="text-[12.5px] leading-relaxed text-socle-texte-discret">{tx('bareme', { annee: BAREME_2025.annee })}</p>
          </fieldset>

          <section aria-live="polite" className="flex flex-col gap-3">
            <Chiffre fort intitule={tx('res.indemnite', { annee: b.annee })} valeur={euros(b.indemnite, langue)} detail={tx('res.indemnite.detail', { formule: texteFormule })} />
            <div className="grid grid-cols-2 gap-3">
              <Chiffre intitule={tx('res.km')} valeur={`${nombre(b.kmTotal, 1, langue)} km`} detail={tx('res.km.detail', { t: b.tranche, borne: tx(`borne.${b.tranche}`) })} />
              <Chiffre intitule={tx('res.trajets')} valeur={String(b.parTrajet.length)} detail={tx('res.trajets.detail')} />
            </div>
            <Bouton
              variante="primaire"
              icone={<Copy size={16} />}
              disabled={b.parTrajet.length === 0}
              onClick={() => {
                void navigator.clipboard?.writeText(recap).then(() => setCopie(true));
              }}
            >
              {copie ? tx('copie') : tx('copier')}
            </Bouton>
          </section>

          <fieldset className="flex min-w-0 flex-col gap-4">
            <legend className="mb-3 text-[13px] font-semibold text-socle-texte-discret">{tx('section.ajouter')}</legend>
            <div className="grid grid-cols-2 gap-4">
              <Saisie etiquette={tx('date')} type="date" erreur={faute('date')} {...champ('date')} />
              <Saisie etiquette={tx('km')} suffixe="km" inputMode="decimal" erreur={faute('km')} {...champ('km')} />
            </div>
            <Saisie etiquette={tx('motif')} erreur={faute('motif')} {...champ('motif')} />
            <div className="grid grid-cols-2 gap-4">
              <Saisie etiquette={tx('depart')} erreur={faute('lieux')} {...champ('depart')} />
              <Saisie etiquette={tx('arrivee')} {...champ('arrivee')} />
            </div>
            <label className="flex items-center gap-2.5 text-[14px] text-socle-texte">
              <input type="checkbox" checked={neuf.allerRetour} onChange={(e) => setNeuf({ ...neuf, allerRetour: e.target.checked })} className="h-4 w-4 accent-socle-texte" />
              {tx('allerRetour')}
            </label>
            <div>
              <Bouton variante="secondaire" icone={<Plus size={16} />} onClick={ajouter}>
                {tx('ajouter')}
              </Bouton>
            </div>
          </fieldset>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('section.journal', { annee: b.annee })}</h2>
            {b.parTrajet.length === 0 ? (
              <p className="text-[14px] text-socle-texte-doux">{tx('vide', { annee: b.annee })}</p>
            ) : (
              <Tableau
                entetes={[tx('col.date'), tx('col.motif'), tx('col.km'), tx('col.montant'), '']}
                droite={[2, 3]}
                lignes={b.parTrajet.map((p) => [
                  <span key="d" className="whitespace-nowrap">{dateCourte(p.trajet.date, langue)}</span>,
                  <span key="t" className="flex flex-col">
                    <span className="text-socle-texte">{p.trajet.motif}</span>
                    <span className="text-[12.5px] text-socle-texte-discret">
                      {p.trajet.depart} → {p.trajet.arrivee}
                      {p.trajet.allerRetour ? ` (${tx('ar')})` : ''}
                    </span>
                  </span>,
                  nombre(p.km, 1, langue),
                  <span key="m" className="whitespace-nowrap">{euros(p.montant, langue)}</span>,
                  <Bouton
                    key="r"
                    variante="discret"
                    taille="petit"
                    aria-label={`${tx('retirer')} : ${p.trajet.motif}`}
                    title={tx('retirer')}
                    onClick={() => setTrajets(trajets.filter((t) => t.id !== p.trajet.id))}
                  >
                    <X size={14} />
                  </Bouton>,
                ])}
              />
            )}
          </section>
          {b.parMois.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('section.mois')}</h2>
              <Tableau
                entetes={[tx('col.mois'), tx('col.km'), tx('col.montant')]}
                droite={[1, 2]}
                lignes={b.parMois.map((m) => [nomDuMois(m.mois, langue), nombre(m.km, 1, langue), euros(m.montant, langue)])}
              />
            </section>
          )}
        </div>
      </div>
    </CadreAtelier>
  );
}
