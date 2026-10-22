import React, { useRef, useState } from 'react';
import { CheckCheck, Plus } from 'lucide-react';
import { Bouton, Saisie } from '../../socle/ui';
import { CadreAtelier, Chiffre, Choix, Etat, Tableau, type Ton } from '../_commun/Cadre';
import { AUJOURDHUI_BAC_A_SABLE, dateLisible } from '../_commun/nombres';
import { PARC } from './donnees';
import { useTextes } from './i18n';
import {
  ETATS,
  TYPES,
  aPlanifier,
  compter,
  etatVisite,
  marquerFaites,
  prochaineVisite,
  verifierInstallation,
  type EtatVisite,
  type ErreurInstallation,
  type Installation,
  type TypeInstallation,
} from './logique';
import { MODULE } from './module';

const TON: Record<EtatVisite, Ton> = { retard: 'danger', ceMois: 'attention', bientot: 'neutre', aJour: 'succes' };
const AUJ = AUJOURDHUI_BAC_A_SABLE;
const CASE = 'h-4 w-4 accent-[var(--color-socle-texte)] [color-scheme:dark]';

export default function EcranEntretiens() {
  const { tx, langue } = useTextes();
  const [parc, setParc] = useState<Installation[]>(PARC);
  const [choisis, setChoisis] = useState<ReadonlySet<string>>(new Set());
  const [filtre, setFiltre] = useState<EtatVisite | 'tous'>('tous');
  const [annonce, setAnnonce] = useState('');
  const [ajout, setAjout] = useState({ client: '', type: 'chaudiere' as TypeInstallation, commune: '', derniereVisite: AUJ, periodicite: '12' });
  const [ajoutTente, setAjoutTente] = useState(false);
  const suivant = useRef(PARC.length);

  const nombres = compter(parc, AUJ);
  const tournee = aPlanifier(parc, AUJ);
  const visibles = parc
    .filter((i) => filtre === 'tous' || etatVisite(i, AUJ) === filtre)
    .sort((a, b) => prochaineVisite(a).localeCompare(prochaineVisite(b)));

  const basculer = (id: string) => {
    const s = new Set(choisis);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setChoisis(s);
    setAnnonce('');
  };
  const nomType = (t: TypeInstallation) => tx(`type.${t}`);
  const caseDe = (i: Installation) => (
    <input type="checkbox" className={CASE} checked={choisis.has(i.id)} onChange={() => basculer(i.id)} aria-label={tx('choisir.ligne', { client: i.client, type: nomType(i.type) })} />
  );

  const candidat = { client: ajout.client, type: ajout.type, commune: ajout.commune, derniereVisite: ajout.derniereVisite, periodiciteMois: Number(ajout.periodicite) };
  const fautesAjout = verifierInstallation(candidat, AUJ);
  const faute = (f: ErreurInstallation) => (ajoutTente && fautesAjout.includes(f) ? tx(`erreur.${f}`) : undefined);

  return (
    <CadreAtelier famille={MODULE.famille} nom={tx('nom')} intro={tx('intro')}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {ETATS.map((e) => (
          <Chiffre key={e} intitule={tx(`etat.${e}`)} valeur={String(nombres[e])} detail={tx(`chiffre.detail.${e}`)} fort={e === 'retard' && nombres.retard > 0} />
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('section.tournee')}</h2>
          <Bouton
            variante="primaire"
            icone={<CheckCheck size={16} />}
            disabled={choisis.size === 0}
            onClick={() => {
              setParc(marquerFaites(parc, choisis, AUJ));
              setAnnonce(tx('marquer.fait', { n: choisis.size, d: dateLisible(AUJ, langue) }));
              setChoisis(new Set());
            }}
          >
            {choisis.size === 0 ? tx('marquer.aucun') : tx('marquer', { n: choisis.size })}
          </Bouton>
        </div>
        <p aria-live="polite" className="text-[13px] text-socle-texte-doux empty:hidden">
          {annonce && <Etat ton="succes">{annonce}</Etat>}
        </p>
        {tournee.length === 0 ? (
          <p className="text-[14px] text-socle-texte-doux">{tx('tournee.vide')}</p>
        ) : (
          <div className="grid items-start gap-3 md:grid-cols-3">
            {tournee.map((g) => (
              <div key={g.commune} className="flex flex-col gap-2 rounded-xl border border-socle-bord bg-socle-surface p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[14px] font-semibold text-socle-texte">{g.commune}</h3>
                  <span className="text-[12px] text-socle-texte-discret">{tx('tournee.compte', { n: g.installations.length })}</span>
                </div>
                <ul className="flex flex-col gap-2">
                  {g.installations.map((i) => (
                    <li key={i.id} className="flex items-start gap-2.5 border-t border-socle-bord pt-2 first:border-t-0 first:pt-0">
                      <span className="pt-0.5">{caseDe(i)}</span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[13.5px] text-socle-texte">{i.client}</span>
                        <span className="text-[12px] text-socle-texte-discret">
                          {nomType(i.type)} · {dateLisible(prochaineVisite(i), langue)}
                        </span>
                        <Etat ton={TON[etatVisite(i, AUJ)]}>{tx(`etat.${etatVisite(i, AUJ)}`)}</Etat>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('section.parc')}</h2>
          <div className="w-full sm:w-64">
            <Choix
              etiquette={tx('filtre')}
              valeur={filtre}
              onChange={setFiltre}
              options={[{ valeur: 'tous' as const, libelle: tx('filtre.tous') }, ...ETATS.map((e) => ({ valeur: e, libelle: tx(`etat.${e}`) }))]}
            />
          </div>
        </div>
        {visibles.length === 0 ? (
          <p className="text-[14px] text-socle-texte-doux">{tx('parc.vide')}</p>
        ) : (
          <Tableau
            entetes={[tx('col.choisir'), tx('col.client'), tx('col.installation'), tx('col.commune'), tx('col.derniere'), tx('col.prochaine'), tx('col.etat')]}
            lignes={visibles.map((i) => [
              caseDe(i),
              <span key="c" className="text-socle-texte">{i.client}</span>,
              nomType(i.type),
              i.commune,
              <span key="d" className="whitespace-nowrap tabular-nums">{dateLisible(i.derniereVisite, langue)}</span>,
              <span key="p" className="whitespace-nowrap tabular-nums">{dateLisible(prochaineVisite(i), langue)}</span>,
              <Etat key="e" ton={TON[etatVisite(i, AUJ)]}>
                {tx(`etat.${etatVisite(i, AUJ)}`)}
              </Etat>,
            ])}
          />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('section.ajouter')}</h2>
        <form
          className="grid gap-3 rounded-xl border border-socle-bord bg-socle-surface p-4 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            setAjoutTente(true);
            if (fautesAjout.length > 0) return;
            suivant.current += 1;
            setParc([...parc, { id: `i${suivant.current}`, ...candidat, client: candidat.client.trim(), commune: candidat.commune.trim() }]);
            setAjout({ ...ajout, client: '', commune: '' });
            setAjoutTente(false);
          }}
        >
          <Saisie etiquette={tx('ajout.client')} value={ajout.client} erreur={faute('client')} onChange={(e) => setAjout({ ...ajout, client: e.target.value })} />
          <Choix
            etiquette={tx('ajout.type')}
            valeur={ajout.type}
            onChange={(type) => setAjout({ ...ajout, type })}
            options={TYPES.map((t) => ({ valeur: t, libelle: nomType(t) }))}
          />
          <Saisie etiquette={tx('ajout.commune')} value={ajout.commune} erreur={faute('commune')} onChange={(e) => setAjout({ ...ajout, commune: e.target.value })} />
          <Saisie
            etiquette={tx('ajout.derniere')}
            type="date"
            max={AUJ}
            className="[color-scheme:dark]"
            value={ajout.derniereVisite}
            erreur={faute('date') ?? faute('dateFuture')}
            onChange={(e) => setAjout({ ...ajout, derniereVisite: e.target.value })}
          />
          <Saisie
            etiquette={tx('ajout.periodicite')}
            aide={tx('ajout.periodicite.aide')}
            inputMode="numeric"
            suffixe={tx('ajout.periodicite.unite')}
            value={ajout.periodicite}
            erreur={faute('periodicite')}
            onChange={(e) => setAjout({ ...ajout, periodicite: e.target.value })}
          />
          <div className="sm:col-span-2 lg:col-span-5">
            <Bouton type="submit" variante="secondaire" icone={<Plus size={16} />}>
              {tx('ajout.bouton')}
            </Bouton>
          </div>
        </form>
      </section>
    </CadreAtelier>
  );
}
