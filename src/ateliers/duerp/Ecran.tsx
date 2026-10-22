import React, { useState } from 'react';
import { Copy, Plus } from 'lucide-react';
import { Bouton, Saisie } from '../../socle/ui';
import { CadreAtelier, Chiffre, Choix, Etat, Tableau, type Ton } from '../_commun/Cadre';
import { AUJOURDHUI_BAC_A_SABLE, dateLisible } from '../_commun/nombres';
import { ENTREPRISE, RISQUES, UNITES } from './donnees';
import { useTextes } from './i18n';
import {
  CATEGORIES,
  criticite,
  enRetard,
  miseAJour,
  niveau,
  planDAction,
  synthese,
  trier,
  verifierRisque,
  type Categorie,
  type ErreurRisque,
  type Niveau,
  type Risque,
} from './logique';
import { MODULE } from './module';

const TON: Record<Niveau, Ton> = {
  faible: 'succes',
  moyen: 'neutre',
  eleve: 'attention',
  critique: 'danger',
};
const COTES = ['1', '2', '3', '4'] as const;
type Cote = (typeof COTES)[number];

const VIDE = {
  uniteId: UNITES[0].id,
  categorie: 'manutention' as Categorie,
  danger: '',
  gravite: '2' as Cote,
  probabilite: '2' as Cote,
  mesures: '',
  action: '',
  responsable: '',
  echeance: '',
};

export default function EcranDuerp() {
  const { tx, langue } = useTextes();
  const auj = AUJOURDHUI_BAC_A_SABLE;
  const [risques, setRisques] = useState<Risque[]>(() => [...RISQUES]);
  const [derniere, setDerniere] = useState(ENTREPRISE.derniereMiseAJour);
  const [filtre, setFiltre] = useState<string>('toutes');
  const [form, setForm] = useState(VIDE);
  const [fautes, setFautes] = useState<ErreurRisque[]>([]);
  const [copie, setCopie] = useState(false);

  const nomUnite = (id: string) => UNITES.find((u) => u.id === id)?.nom ?? id;
  const s = synthese(risques, auj);
  const maj = miseAJour(derniere, ENTREPRISE.effectif, auj);
  const visibles = trier(risques).filter((r) => filtre === 'toutes' || r.uniteId === filtre);
  const plan = planDAction(risques, UNITES, auj);
  const faute = (f: ErreurRisque) => (fautes.includes(f) ? tx(`erreur.${f}`) : undefined);

  const texteDuPlan = [
    tx('plan.titre', { nom: ENTREPRISE.nom, date: dateLisible(auj, langue) }),
    '',
    ...(plan.length === 0
      ? [tx('plan.vide')]
      : plan.map((l) =>
          tx('plan.ligne', {
            niveau: tx(`niveau.${l.niveau}`).toUpperCase(),
            c: l.criticite,
            unite: l.unite,
            danger: l.risque.danger,
            action: l.risque.actionPrevue,
            qui: l.risque.responsable || '?',
            date: dateLisible(l.risque.echeance, langue),
            retard: l.retard ? tx('plan.retard') : '',
          }),
        )),
  ].join('\n');

  const ajouter = () => {
    const r: Risque = {
      id: `n${risques.length + 1}`,
      uniteId: form.uniteId,
      categorie: form.categorie,
      danger: form.danger,
      gravite: Number(form.gravite),
      probabilite: Number(form.probabilite),
      mesuresExistantes: form.mesures,
      actionPrevue: form.action,
      responsable: form.responsable,
      echeance: form.echeance,
      faite: false,
    };
    const f = verifierRisque(r, UNITES);
    setFautes(f);
    if (f.length === 0) {
      setRisques([...risques, r]);
      setForm({ ...VIDE, uniteId: form.uniteId });
    }
  };

  const action = (r: Risque) =>
    r.actionPrevue ? (
      <span key="a" className="flex flex-col gap-0.5">
        <span className={r.faite ? 'text-socle-texte-discret line-through' : 'text-socle-texte'}>{r.actionPrevue}</span>
        <span className="text-[12px] text-socle-texte-discret">
          {tx('actionDetail', {
            qui: r.responsable || '?',
            date: dateLisible(r.echeance, langue),
          })}
        </span>
        {enRetard(r, auj) && <Etat ton="danger">{tx('enRetard')}</Etat>}
      </span>
    ) : (
      <span key="a" className="text-socle-texte-discret">
        {tx('aucuneAction')}
      </span>
    );

  const caseFaite = (r: Risque) => (
    <input
      key="f"
      type="checkbox"
      checked={r.faite}
      aria-label={tx('faite.libelle', { danger: r.danger })}
      onChange={() => setRisques(risques.map((x) => (x.id === r.id ? { ...x, faite: !x.faite } : x)))}
      className="h-4 w-4 accent-socle-texte"
    />
  );

  const champ = (c: 'danger' | 'mesures' | 'action' | 'responsable' | 'echeance') => ({
    value: form[c],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [c]: e.target.value }),
  });

  return (
    <CadreAtelier famille={MODULE.famille} nom={tx('nom')} intro={tx('intro')}>
      <section className="flex flex-col gap-3 rounded-xl border border-socle-bord bg-socle-surface p-4">
        <p className="text-[13px] font-semibold text-socle-texte">{tx('entreprise', { nom: ENTREPRISE.nom, n: ENTREPRISE.effectif })}</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Etat ton={maj.etat === 'enRetard' ? 'danger' : maj.etat === 'conseillee' ? 'attention' : 'succes'}>
            {tx(`maj.${maj.etat}`, {
              date: dateLisible(derniere, langue),
              j: maj.joursDepuis,
            })}
          </Etat>
          {maj.etat !== 'aJour' && (
            <Bouton variante="secondaire" taille="petit" onClick={() => setDerniere(auj)}>
              {tx('maj.marquer')}
            </Bouton>
          )}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Chiffre
          intitule={tx('chiffre.total')}
          valeur={String(s.total)}
          detail={tx('chiffre.total.detail', {
            c: s.parNiveau.critique,
            e: s.parNiveau.eleve,
          })}
        />
        <Chiffre
          fort={s.actionsEnRetard > 0}
          intitule={tx('chiffre.retard')}
          valeur={String(s.actionsEnRetard)}
          detail={tx('chiffre.retard.detail', { o: s.actionsOuvertes })}
        />
        <Chiffre intitule={tx('chiffre.sansAction')} valeur={String(s.sansAction)} detail={tx('chiffre.sansAction.detail')} />
      </div>

      <section className="flex flex-col gap-3">
        <div className="max-w-xs">
          <Choix
            etiquette={tx('filtre')}
            valeur={filtre}
            onChange={setFiltre}
            options={[{ valeur: 'toutes', libelle: tx('filtre.toutes') }, ...UNITES.map((u) => ({ valeur: u.id, libelle: u.nom }))]}
          />
        </div>
        <ul className="flex flex-col gap-3 md:hidden">
          {visibles.map((r) => {
            const c = criticite(r);
            const n = niveau(c);
            return (
              <li key={r.id} className="flex flex-col gap-2 rounded-xl border border-socle-bord bg-socle-surface p-4 text-[13.5px]">
                <div className="flex items-center justify-between gap-3">
                  <Etat ton={TON[n]}>
                    {c} · {tx(`niveau.${n}`)}
                  </Etat>
                  <span className="text-[12px] text-socle-texte-discret">{nomUnite(r.uniteId)}</span>
                </div>
                <span className="text-[12px] text-socle-texte-discret">{tx(`cat.${r.categorie}`)}</span>
                <span className="text-socle-texte">{r.danger}</span>
                <span className="text-socle-texte-doux">
                  {tx('col.mesures')} : {r.mesuresExistantes || tx('aucuneMesure')}
                </span>
                {action(r)}
                {r.actionPrevue && (
                  <label className="flex items-center gap-2 text-socle-texte-doux">
                    {caseFaite(r)}
                    {tx('col.faite')}
                  </label>
                )}
              </li>
            );
          })}
        </ul>
        <div className="hidden md:block">
          <Tableau
            entetes={[tx('col.cotation'), tx('col.unite'), tx('col.risque'), tx('col.mesures'), tx('col.action'), tx('col.faite')]}
            lignes={visibles.map((r) => {
              const c = criticite(r);
              const n = niveau(c);
              return [
                <span key="c" className="flex flex-col gap-0.5 whitespace-nowrap">
                  <span className="font-semibold tabular-nums text-socle-texte">{c}</span>
                  <Etat ton={TON[n]}>{tx(`niveau.${n}`)}</Etat>
                </span>,
                nomUnite(r.uniteId),
                <span key="r" className="flex flex-col gap-0.5">
                  <span className="text-[12px] text-socle-texte-discret">{tx(`cat.${r.categorie}`)}</span>
                  <span className="text-socle-texte">{r.danger}</span>
                </span>,
                r.mesuresExistantes || <span className="text-socle-texte-discret">{tx('aucuneMesure')}</span>,
                action(r),
                r.actionPrevue ? caseFaite(r) : '',
              ];
            })}
          />
        </div>
        <p className="text-[12.5px] leading-relaxed text-socle-texte-discret">{tx('methode')}</p>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-socle-bord p-4">
        <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('ajout.titre')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Choix
            etiquette={tx('ajout.unite')}
            valeur={form.uniteId}
            onChange={(v) => setForm({ ...form, uniteId: v })}
            options={UNITES.map((u) => ({ valeur: u.id, libelle: u.nom }))}
          />
          <Choix
            etiquette={tx('ajout.categorie')}
            valeur={form.categorie}
            onChange={(v) => setForm({ ...form, categorie: v })}
            options={CATEGORIES.map((c) => ({
              valeur: c,
              libelle: tx(`cat.${c}`),
            }))}
          />
          <div className="sm:col-span-2">
            <Saisie etiquette={tx('ajout.danger')} aide={tx('ajout.danger.aide')} erreur={faute('danger')} {...champ('danger')} />
          </div>
          <Choix
            etiquette={tx('ajout.gravite')}
            valeur={form.gravite}
            onChange={(v) => setForm({ ...form, gravite: v })}
            options={COTES.map((c) => ({
              valeur: c,
              libelle: tx(`gravite.${c}`),
            }))}
          />
          <Choix
            etiquette={tx('ajout.probabilite')}
            valeur={form.probabilite}
            onChange={(v) => setForm({ ...form, probabilite: v })}
            options={COTES.map((c) => ({
              valeur: c,
              libelle: tx(`proba.${c}`),
            }))}
          />
          <Saisie etiquette={tx('ajout.mesures')} {...champ('mesures')} />
          <Saisie etiquette={tx('ajout.action')} erreur={faute('actionSansEcheance')} {...champ('action')} />
          <Saisie etiquette={tx('ajout.responsable')} {...champ('responsable')} />
          <Saisie etiquette={tx('ajout.echeance')} type="date" erreur={faute('echeance')} {...champ('echeance')} />
        </div>
        <div>
          <Bouton variante="secondaire" icone={<Plus size={16} />} onClick={ajouter}>
            {tx('ajout.bouton')}
          </Bouton>
        </div>
      </section>

      <div>
        <Bouton
          variante="primaire"
          icone={<Copy size={16} />}
          onClick={() => {
            void navigator.clipboard?.writeText(texteDuPlan).then(() => setCopie(true));
          }}
        >
          {copie ? tx('copie') : tx('copier')}
        </Bouton>
      </div>
    </CadreAtelier>
  );
}
