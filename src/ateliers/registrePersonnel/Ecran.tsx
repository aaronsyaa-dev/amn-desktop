import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Bouton, Saisie } from '../../socle/ui';
import { CadreAtelier, Chiffre, Choix, Etat, Tableau } from '../_commun/Cadre';
import { AUJOURDHUI_BAC_A_SABLE, dateLisible } from '../_commun/nombres';
import { PERSONNES } from './donnees';
import { useTextes } from './i18n';
import { effectifPresent, manques, registre, type Contrat, type Ligne, type Personne, type Sexe } from './logique';
import { MODULE } from './module';

const CONTRATS: readonly Contrat[] = ['cdi', 'cdiPartiel', 'cdd', 'apprentissage', 'interim', 'stage'];

const VIDE: Personne = {
  id: '',
  nom: '',
  prenoms: '',
  nationalite: '',
  titreExige: false,
  dateNaissance: '',
  sexe: 'F',
  emploi: '',
  qualification: '',
  contrat: 'cdi',
  entree: AUJOURDHUI_BAC_A_SABLE,
};

export default function EcranRegistrePersonnel() {
  const { tx, langue } = useTextes();
  const [personnes, setPersonnes] = useState<Personne[]>(PERSONNES);
  const [brouillon, setBrouillon] = useState<Personne>(VIDE);
  const [suivant, setSuivant] = useState(1);

  const r = registre(personnes, AUJOURDHUI_BAC_A_SABLE);
  const toutes = [...r.salaries, ...r.stagiaires];
  const nomDe = (p: Personne) => `${p.prenoms} ${p.nom}`.trim() || '—';
  const date = (d?: string) => (d ? dateLisible(d, langue) : '—');
  const court = (d?: string) =>
    d ? new Intl.DateTimeFormat(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`)) : '—';
  const manquesBrouillon = manques(brouillon);
  const champ = (k: keyof Personne) => ({
    value: String(brouillon[k] ?? ''),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setBrouillon({ ...brouillon, [k]: e.target.value }),
  });

  const GRAVITE = { danger: 0, attention: 1, neutre: 2 } as const;
  const aTraiter = toutes.flatMap((l) => [
    ...(l.manques.length ? [{ cle: `${l.personne.id}-m`, ton: 'attention' as const, texte: tx('ligne.manques', { p: nomDe(l.personne), m: l.manques.map((m) => tx(`manque.${m}`)).join(', ') }) }] : []),
    ...l.alertes.map((a) => ({
      cle: `${l.personne.id}-${a}`,
      ton: a === 'titreExpire' ? ('danger' as const) : a === 'titreBientot' ? ('attention' as const) : ('neutre' as const),
      texte: tx(`alerte.${a}`, { p: nomDe(l.personne), d: date(l.personne.titreExpiration) }),
    })),
  ]).sort((x, y) => GRAVITE[x.ton] - GRAVITE[y.ton]);

  const lignes = (ls: Ligne[]) =>
    ls.map((l) => {
      const p = l.personne;
      return [
        l.numero,
        <span key="n" className="font-medium text-socle-texte">
          {p.nom.toUpperCase()} {p.prenoms}
        </span>,
        p.nationalite || '—',
        court(p.dateNaissance),
        p.sexe,
        [p.emploi, p.qualification].filter(Boolean).join(' · ') || '—',
        tx(`contrat.${p.contrat}`),
        court(p.entree),
        p.sortie ? court(p.sortie) : <Etat key="s" ton="succes">{tx('present')}</Etat>,
        p.titreExige ? `${p.titreType ?? '—'} · ${p.titreNumero ?? '—'}` : '—',
      ];
    });
  const entetes = [tx('col.no'), tx('col.nom'), tx('col.nationalite'), tx('col.naissance'), tx('col.sexe'), tx('col.emploi'), tx('col.contrat'), tx('col.entree'), tx('col.sortie'), tx('col.titre')];

  return (
    <CadreAtelier famille={MODULE.famille} nom={tx('nom')} intro={tx('intro')}>
      <div className="grid grid-cols-3 gap-3">
        <Chiffre fort intitule={tx('chiffre.effectif')} valeur={String(effectifPresent(r))} />
        <Chiffre intitule={tx('chiffre.manques')} valeur={String(toutes.reduce((s, l) => s + l.manques.length, 0))} />
        <Chiffre intitule={tx('chiffre.alertes')} valeur={String(toutes.reduce((s, l) => s + l.alertes.length, 0))} />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('section.traiter')}</h2>
        {aTraiter.length ? (
          <ul className="flex flex-col gap-1.5 rounded-xl border border-socle-bord bg-socle-surface p-4">
            {aTraiter.map((x) => (
              <li key={x.cle}>
                <Etat ton={x.ton}>{x.texte}</Etat>
              </li>
            ))}
          </ul>
        ) : (
          <Etat ton="succes">{tx('rien')}</Etat>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('section.salaries')}</h2>
        <Tableau entetes={entetes} lignes={lignes(r.salaries)} droite={[0]} />
      </section>

      {r.stagiaires.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-semibold text-socle-texte-discret">{tx('section.stagiaires')}</h2>
          <Tableau entetes={entetes} lignes={lignes(r.stagiaires)} droite={[0]} />
        </section>
      )}

      <fieldset className="flex flex-col gap-4 rounded-xl border border-socle-bord p-4">
        <legend className="px-1 text-[13px] font-semibold text-socle-texte-discret">{tx('section.ajout')}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Saisie etiquette={tx('champ.nom')} {...champ('nom')} />
          <Saisie etiquette={tx('champ.prenoms')} {...champ('prenoms')} />
          <Saisie etiquette={tx('champ.nationalite')} {...champ('nationalite')} />
          <Saisie type="date" etiquette={tx('champ.naissance')} {...champ('dateNaissance')} />
          <Choix<Sexe>
            etiquette={tx('champ.sexe')}
            valeur={brouillon.sexe}
            onChange={(v) => setBrouillon({ ...brouillon, sexe: v })}
            options={[
              { valeur: 'F', libelle: tx('sexe.F') },
              { valeur: 'M', libelle: tx('sexe.M') },
            ]}
          />
          <Choix<Contrat> etiquette={tx('champ.contrat')} valeur={brouillon.contrat} onChange={(v) => setBrouillon({ ...brouillon, contrat: v })} options={CONTRATS.map((c) => ({ valeur: c, libelle: tx(`contrat.${c}`) }))} />
          <Saisie etiquette={tx('champ.emploi')} {...champ('emploi')} />
          <Saisie etiquette={tx('champ.qualification')} {...champ('qualification')} />
          <Saisie type="date" etiquette={tx('champ.entree')} {...champ('entree')} />
        </div>
        <label className="inline-flex items-center gap-2 text-[14px] text-socle-texte-doux">
          <input type="checkbox" checked={brouillon.titreExige} onChange={(e) => setBrouillon({ ...brouillon, titreExige: e.target.checked })} className="h-4 w-4 accent-socle-texte" />
          {tx('champ.titreExige')}
        </label>
        {brouillon.titreExige && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Saisie etiquette={tx('champ.titreType')} {...champ('titreType')} />
            <Saisie etiquette={tx('champ.titreNumero')} {...champ('titreNumero')} />
            <Saisie type="date" etiquette={tx('champ.titreExpiration')} {...champ('titreExpiration')} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Bouton
            variante="primaire"
            icone={<UserPlus size={16} />}
            disabled={manquesBrouillon.length > 0}
            onClick={() => {
              setPersonnes([...personnes, { ...brouillon, id: `n${suivant}` }]);
              setSuivant(suivant + 1);
              setBrouillon(VIDE);
            }}
          >
            {tx('inscrire')}
          </Bouton>
          {manquesBrouillon.length > 0 && <span className="text-[12.5px] text-socle-texte-discret">{tx('inscrire.manque', { m: manquesBrouillon.map((m) => tx(`manque.${m}`)).join(', ') })}</span>}
        </div>
      </fieldset>
    </CadreAtelier>
  );
}
