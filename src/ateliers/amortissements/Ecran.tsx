import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Bouton, Saisie } from '../../socle/ui';
import { CadreAtelier, Chiffre, Choix, Etat, Tableau } from '../_commun/Cadre';
import { dateLisible, euros, versCentimes } from '../_commun/nombres';
import { EXERCICE_EXEMPLE, IMMOS_EXEMPLE } from './donnees';
import { useTextes } from './i18n';
import { dateCloture, dotationsExercice, exerciceDe, petitMateriel, planAmortissement, verifier, type ErreurImmo, type Immobilisation } from './logique';
import { MODULE } from './module';

const MOIS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function EcranAmortissements() {
  const { tx, langue } = useTextes();
  const [immos, setImmos] = useState<Immobilisation[]>(IMMOS_EXEMPLE);
  const [moisCloture, setMoisCloture] = useState(12);
  const [exercice, setExercice] = useState(EXERCICE_EXEMPLE);
  const [choisie, setChoisie] = useState(IMMOS_EXEMPLE[0].id);
  const [form, setForm] = useState({ designation: '', valeur: '', date: '2026-10-22', duree: '5' });
  const [fautes, setFautes] = useState<ErreurImmo[]>([]);
  const [ok, setOk] = useState('');

  const plans = immos.map((i) => planAmortissement(i, moisCloture));
  const annees = plans.flat().map((l) => l.exercice);
  const premiere = Math.min(...annees, EXERCICE_EXEMPLE);
  const derniere = Math.max(...annees, EXERCICE_EXEMPLE);
  const exercices = Array.from({ length: derniere - premiere + 1 }, (_, i) => premiere + i);
  const d = dotationsExercice(immos, exercice, moisCloture);
  const cloture = dateLisible(dateCloture(exercice, moisCloture), langue);
  const immo = immos.find((i) => i.id === choisie) ?? immos[0];
  const plan = planAmortissement(immo, moisCloture);
  const nomMois = (m: number) => new Intl.DateTimeFormat(langue === 'fr' ? 'fr-FR' : 'en-GB', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, m - 1, 1)));

  const ajouter = (ev: React.FormEvent) => {
    ev.preventDefault();
    const nouvelle = { designation: form.designation, valeur: versCentimes(form.valeur), miseEnService: form.date, dureeAnnees: Number(form.duree) };
    const f = verifier(nouvelle);
    setFautes(f);
    if (f.length) {
      setOk('');
      return;
    }
    const id = `immo-${immos.length + 1}`;
    setImmos([...immos, { ...nouvelle, designation: nouvelle.designation.trim(), id }]);
    setChoisie(id);
    setExercice(exerciceDe(nouvelle.miseEnService, moisCloture));
    setOk(tx('ajout.ok', { d: nouvelle.designation.trim() }));
    setForm({ ...form, designation: '', valeur: '' });
  };
  const faute = (f: ErreurImmo) => (fautes.includes(f) ? tx(`erreur.${f}`) : undefined);

  return (
    <CadreAtelier famille={MODULE.famille} nom={tx('nom')} intro={tx('intro')}>
      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
        <Choix
          etiquette={tx('exercice')}
          valeur={String(exercice)}
          onChange={(v) => setExercice(Number(v))}
          options={exercices.map((e) => ({ valeur: String(e), libelle: tx('exercice.option', { d: dateLisible(dateCloture(e, moisCloture), langue) }) }))}
        />
        <Choix
          etiquette={tx('cloture')}
          aide={tx('cloture.aide')}
          valeur={String(moisCloture)}
          onChange={(v) => setMoisCloture(Number(v))}
          options={MOIS.map((m) => ({ valeur: String(m), libelle: nomMois(m) }))}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Chiffre fort intitule={tx('chiffre.dotations')} valeur={euros(d.total, langue)} detail={tx('chiffre.dotations.detail', { d: cloture })} />
        <Chiffre intitule={tx('chiffre.vnc')} valeur={euros(d.vncTotale, langue)} detail={tx('chiffre.vnc.detail')} />
        <Chiffre intitule={tx('chiffre.immos')} valeur={String(immos.length)} detail={tx('chiffre.immos.detail', { n: immos.filter(petitMateriel).length })} />
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="titre-exercice">
        <h2 id="titre-exercice" className="text-[13px] font-semibold text-socle-texte-discret">
          {tx('liste.titre')}
        </h2>
        <Tableau
          entetes={[tx('col.designation'), tx('col.miseEnService'), tx('col.valeur'), tx('col.duree'), tx('col.dotation'), tx('col.vnc')]}
          droite={[2, 3, 4, 5]}
          lignes={d.lignes.map((l) => [
            <span key="n" className="flex min-w-[11rem] flex-col gap-1">
              <span className="text-socle-texte">{l.immo.designation}</span>
              {petitMateriel(l.immo) && <Etat ton="attention">{tx('petitMateriel')}</Etat>}
            </span>,
            <span key="m" className="whitespace-nowrap">
              {dateLisible(l.immo.miseEnService, langue)}
            </span>,
            <span key="v" className="whitespace-nowrap">
              {euros(l.immo.valeur, langue)}
            </span>,
            <span key="d" className="whitespace-nowrap">
              {tx('duree.ans', { n: l.immo.dureeAnnees })}
            </span>,
            l.pasEncore ? (
              <span key="p" className="whitespace-nowrap text-socle-texte-discret">
                {tx('pasEncore')}
              </span>
            ) : (
              <span key="t" className="whitespace-nowrap font-semibold text-socle-texte">
                {euros(l.dotation, langue)}
              </span>
            ),
            <span key="vn" className="whitespace-nowrap">
              {l.pasEncore ? '—' : euros(l.vnc, langue)}
            </span>,
          ])}
        />
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="flex flex-col gap-3" aria-labelledby="titre-plan">
          <h2 id="titre-plan" className="text-[13px] font-semibold text-socle-texte-discret">
            {tx('plan.titre')}
          </h2>
          <div className="max-w-sm">
            <Choix etiquette={tx('plan.immo')} valeur={immo.id} onChange={setChoisie} options={immos.map((i) => ({ valeur: i.id, libelle: i.designation }))} />
          </div>
          <Tableau
            entetes={[tx('col.exercice'), tx('col.jours'), tx('col.dotation'), tx('col.cumul'), tx('col.vnc')]}
            droite={[1, 2, 3, 4]}
            lignes={plan.map((l) => [
              <span key="e" className={`whitespace-nowrap ${l.exercice === exercice ? 'font-semibold text-socle-texte' : ''}`}>
                {dateLisible(l.cloture, langue)}
              </span>,
              l.jours,
              <span key="d" className="whitespace-nowrap">
                {euros(l.dotation, langue)}
              </span>,
              <span key="c" className="whitespace-nowrap">
                {euros(l.cumul, langue)}
              </span>,
              <span key="v" className="whitespace-nowrap">
                {euros(l.vnc, langue)}
              </span>,
            ])}
          />
          <p className="text-[12.5px] leading-relaxed text-socle-texte-discret">{tx('methode')}</p>
        </section>

        <form onSubmit={ajouter} className="flex flex-col gap-4 self-start rounded-xl border border-socle-bord bg-socle-surface p-4" aria-labelledby="titre-ajout">
          <h2 id="titre-ajout" className="text-[15px] font-semibold">
            {tx('ajout.titre')}
          </h2>
          <Saisie etiquette={tx('ajout.designation')} value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} erreur={faute('designation')} />
          <div className="grid grid-cols-2 gap-4">
            <Saisie
              etiquette={tx('ajout.valeur')}
              suffixe="€"
              inputMode="decimal"
              value={form.valeur}
              onChange={(e) => setForm({ ...form, valeur: e.target.value })}
              erreur={faute('valeur')}
            />
            <Saisie etiquette={tx('ajout.date')} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} erreur={faute('date')} />
          </div>
          <Saisie
            etiquette={tx('ajout.duree')}
            aide={tx('ajout.duree.aide')}
            suffixe={langue === 'fr' ? 'ans' : 'yrs'}
            inputMode="numeric"
            value={form.duree}
            onChange={(e) => setForm({ ...form, duree: e.target.value })}
            erreur={faute('duree')}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Bouton type="submit" variante="primaire" icone={<Plus size={16} />}>
              {tx('ajout.bouton')}
            </Bouton>
            {ok && (
              <p role="status">
                <Etat ton="succes">{ok}</Etat>
              </p>
            )}
          </div>
        </form>
      </div>
    </CadreAtelier>
  );
}
