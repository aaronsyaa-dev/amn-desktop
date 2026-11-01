import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, CircleAlert, Moon } from 'lucide-react';
import { Bouton } from '../../../socle/ui/Bouton';
import { Raccourci } from '../../../socle/ui/Pastilles';
import { IconeEtincelle, Interrupteur, Selecteur, SuggestionAjmani, cleSuivante } from '../../../socle/ui/controles';
import { useFermetureEchap } from '../../../lib/useFermetureEchap';
import type { CleMots } from './i18n';
import type { CategorieMatrice, SuggestionMoinsDeBruit } from './modele';
import { CANAUX, HEURES_PROPOSEES, NIVEAUX_BRUIT, SILENCE_MS, estVerrouillee, silenceEnCours, type ChangementReglage, type NiveauBruit, type ReglagesNotifications } from './reglages';

/**
 * LE VOLET DROIT (H40, v3) — 300 px, trois cartes : les réglages rapides du bruit.
 *
 *   · « Niveau de bruit » (`NoiseLevel`) : trois crans en boutons radio (« Tout, en direct », « L'essentiel »,
 *     « Urgences seulement ») avec leurs petites barres de niveau, « Silence 1 h » (compte à rebours quand il court),
 *     puis la ligne « Heures calmes » (la plage en monospace, modifiable d'un clic, et son interrupteur) ;
 *   · « Par type » (`ChannelMatrix`) : cinq types × App, Mail, Mobile en cases à cocher, chacune enregistrée au clic ;
 *     la dernière case de « Sécurité » reste cochée (« Les alertes de sécurité restent actives ») ;
 *   · la suggestion d'Ajmani « Moins de bruit » quand son déclencheur réel le dit (`suggestionMoinsDeBruit`), sinon
 *     la carte « Astuce » : jamais un vide. Elle s'étire jusqu'au bas du fil.
 *
 * Les réglages sont locaux : ils s'affichent tout de suite, même pendant le chargement du fil (rubrique 8).
 * Un enregistrement refusé fait revenir le réglage et affiche « Le réglage n'a pas pu être enregistré. » avec
 * « Réessayer » (`magasinReglages`).
 */
type Tm = (cle: CleMots, params?: Record<string, string | number>) => string;

export interface ColonneReglagesProps {
  tm: Tm;
  reglages: ReglagesNotifications;
  lignes: readonly CategorieMatrice[];
  echec: boolean;
  suggestion: SuggestionMoinsDeBruit | null;
  maintenant: Date;
  onChanger: (changements: ChangementReglage[]) => boolean;
  onReessayer: () => void;
  onPasserEnResume: (suggestion: SuggestionMoinsDeBruit) => void;
  onGarder: (suggestion: SuggestionMoinsDeBruit) => void;
}

const COLONNES = { app: 'canal.app', mail: 'canal.mail', mobile: 'canal.mobile' } as const satisfies Record<(typeof CANAUX)[number], CleMots>;
const CRANS: Record<NiveauBruit, { titre: CleMots; aide: CleMots; barres: number }> = {
  tout: { titre: 'bruit.tout', aide: 'bruit.tout.aide', barres: 3 },
  essentiel: { titre: 'bruit.essentiel', aide: 'bruit.essentiel.aide', barres: 2 },
  urgences: { titre: 'bruit.urgences', aide: 'bruit.urgences.aide', barres: 1 },
};

/** « 08:00 » devient « 8:00 » (l'heure du résumé, telle que l'écrit la maquette). */
export const heureSansZero = (hhmm: string): string => hhmm.replace(/^0(\d)/, '$1');

/** Les deux sélecteurs d'heure des heures calmes : un petit panneau sous la ligne, fermé par Échap ou un clic ailleurs. */
function EditeurHeures({ tm, reglages, onChanger, onFermer }: { tm: Tm; reglages: ReglagesNotifications; onChanger: ColonneReglagesProps['onChanger']; onFermer: () => void }): React.ReactElement {
  const racine = useRef<HTMLDivElement>(null);
  const fermer = useRef(onFermer);
  fermer.current = onFermer;
  useFermetureEchap(true, onFermer);
  useEffect(() => {
    racine.current?.querySelector<HTMLElement>('select')?.focus();
    const dehors = (e: MouseEvent) => {
      const cible = e.target as HTMLElement;
      if (racine.current?.contains(cible) || cible.closest('[data-calmes-declencheur]')) return;
      fermer.current();
    };
    document.addEventListener('mousedown', dehors);
    return () => document.removeEventListener('mousedown', dehors);
  }, []);
  const options = (valeur: string): string[] => (HEURES_PROPOSEES.includes(valeur) ? [...HEURES_PROPOSEES] : [...HEURES_PROPOSEES, valeur].sort());
  return (
    <div ref={racine} role="group" aria-label={tm('calmes.modifier')} className="sc-notif__heures">
      <div className="sc-notif__heures-champs">
        {(['de', 'a'] as const).map((champ) => (
          <Selecteur key={champ} etiquette={tm(champ === 'de' ? 'calmes.de' : 'calmes.a')} value={reglages.heuresCalmes[champ]} onChange={(e) => onChanger([{ chemin: `heuresCalmes.${champ}`, valeur: e.target.value }])}>
            {options(reglages.heuresCalmes[champ]).map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </Selecteur>
        ))}
      </div>
      <div className="sc-notif__heures-actions">
        <Bouton variante="secondaire" taille="petit" onClick={onFermer}>
          {tm('calmes.fermer')}
        </Bouton>
      </div>
    </div>
  );
}

/** Les trois petites barres d'un cran : autant d'allumées que de bruit laissé passer. */
function Barres({ n }: { n: number }): React.ReactElement {
  return (
    <span aria-hidden className="sc-notif__barres">
      {[1, 2, 3].map((i) => (
        <i key={i} data-rang={i} data-allumee={i <= n || undefined} />
      ))}
    </span>
  );
}

function NiveauDeBruit({ tm, reglages, maintenant, onChanger }: Pick<ColonneReglagesProps, 'tm' | 'reglages' | 'maintenant' | 'onChanger'>): React.ReactElement {
  const id = useId();
  const [editeur, setEditeur] = useState(false);
  const refs = useRef(new Map<NiveauBruit, HTMLButtonElement>());
  const calmes = reglages.heuresCalmes;
  const silence = silenceEnCours(reglages, maintenant);
  const restantes = silence ? Math.max(1, Math.ceil((silence.getTime() - maintenant.getTime()) / 60_000)) : 0;
  const choisir = (niveau: NiveauBruit) => {
    if (niveau !== reglages.niveau) onChanger([{ chemin: 'niveau', valeur: niveau }]);
  };
  return (
    <section className="sc-notif__carte sc-notif__bruit" aria-labelledby={id}>
      <header className="sc-notif__carte-entete">
        <h2 id={id} className="sc-notif__carte-titre">
          {tm('bruit.titre')}
        </h2>
        <Bouton
          variante="secondaire"
          taille="petit"
          icone={<Moon aria-hidden />}
          aria-pressed={silence !== null}
          aria-label={silence ? tm('bruit.silence.arreter', { n: restantes }) : undefined}
          onClick={() => onChanger([{ chemin: 'silence', valeur: silence ? '' : new Date(maintenant.getTime() + SILENCE_MS).toISOString() }])}
        >
          {silence ? tm('bruit.silence.enCours', { n: restantes }) : tm('bruit.silence')}
        </Bouton>
      </header>
      <div role="radiogroup" aria-labelledby={id} className="sc-notif__crans">
        {NIVEAUX_BRUIT.map((niveau) => {
          const cran = CRANS[niveau];
          const actif = reglages.niveau === niveau;
          return (
            <button
              key={niveau}
              ref={(el) => {
                if (el) refs.current.set(niveau, el);
                else refs.current.delete(niveau);
              }}
              type="button"
              role="radio"
              aria-checked={actif}
              tabIndex={actif ? 0 : -1}
              className="sc-notif__cran"
              onClick={() => choisir(niveau)}
              onKeyDown={(e) => {
                const suivant = cleSuivante(NIVEAUX_BRUIT, niveau, e.key) as NiveauBruit | null;
                if (!suivant) return;
                e.preventDefault();
                choisir(suivant);
                refs.current.get(suivant)?.focus();
              }}
            >
              <span aria-hidden className="sc-notif__radio" />
              <span className="sc-notif__cran-texte">
                <span className="sc-notif__cran-titre">{tm(cran.titre)}</span>
                <span className="sc-notif__cran-aide">{tm(cran.aide, { heure: heureSansZero(reglages.resume.heure) })}</span>
              </span>
              <Barres n={cran.barres} />
            </button>
          );
        })}
      </div>
      <div className="sc-notif__calmes">
        <Moon aria-hidden className="sc-notif__calmes-lune" />
        <div className="sc-notif__calmes-texte">
          <span className="sc-notif__calmes-titre">{tm('calmes.titre')}</span>
          {calmes.actif ? (
            <button
              type="button"
              data-calmes-declencheur
              className="sc-notif__calmes-aide sc-notif__calmes-aide--bouton"
              aria-expanded={editeur}
              aria-label={`${tm('calmes.modifier')}. ${tm('calmes.plage', { de: calmes.de, a: calmes.a })} · ${tm('calmes.aide')}`}
              onClick={() => setEditeur((o) => !o)}
            >
              <span className="sc-mono">{tm('calmes.plage', { de: calmes.de, a: calmes.a })}</span> · {tm('calmes.aide')}
            </button>
          ) : (
            <span className="sc-notif__calmes-aide">{tm('calmes.off')}</span>
          )}
        </div>
        <Interrupteur
          actif={calmes.actif}
          libelle={tm('calmes.titre')}
          onChange={(actif) => {
            if (!actif) setEditeur(false);
            onChanger([{ chemin: 'heuresCalmes.actif', valeur: actif }]);
          }}
        />
        {editeur && calmes.actif && <EditeurHeures tm={tm} reglages={reglages} onChanger={onChanger} onFermer={() => setEditeur(false)} />}
      </div>
    </section>
  );
}

function ParType({ tm, reglages, lignes, echec, onChanger, onReessayer }: Pick<ColonneReglagesProps, 'tm' | 'reglages' | 'lignes' | 'echec' | 'onChanger' | 'onReessayer'>): React.ReactElement {
  const id = useId();
  return (
    <section className="sc-notif__carte sc-notif__matrice-carte" aria-labelledby={id}>
      <div className="sc-notif__matrice" role="group" aria-label={tm('matrice.libelle')}>
        <h2 id={id} className="sc-notif__carte-titre">
          {tm('matrice.titre')}
        </h2>
        {CANAUX.map((canal) => (
          <span key={canal} className="sc-notif__canal">
            {tm(COLONNES[canal])}
          </span>
        ))}
        {lignes.map((categorie) => (
          <div key={categorie} className="sc-notif__rangee">
            <span>{tm(`ligne.${categorie}`)}</span>
            {CANAUX.map((canal) => {
              const verrouillee = estVerrouillee(reglages, categorie, canal);
              const cochee = reglages.canaux[categorie][canal];
              const libelle = tm('matrice.case', { ligne: tm(`ligne.${categorie}`), canal: tm(COLONNES[canal]) });
              return (
                <span key={canal} className="sc-notif__cellule" title={verrouillee ? tm('matrice.securite') : undefined}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={cochee}
                    aria-label={verrouillee ? `${libelle}. ${tm('matrice.securite')}` : libelle}
                    aria-disabled={verrouillee || undefined}
                    className="sc-notif__case"
                    onClick={() => {
                      if (!verrouillee) onChanger([{ chemin: `canaux.${categorie}.${canal}`, valeur: !cochee }]);
                    }}
                  >
                    <span aria-hidden className="sc-notif__case-boite">
                      {cochee && <Check aria-hidden />}
                    </span>
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {echec && (
        <div role="alert" className="sc-notif__echec">
          <CircleAlert aria-hidden />
          <span>{tm('matrice.echec')}</span>
          <Bouton variante="secondaire" taille="petit" onClick={onReessayer}>
            {tm('matrice.reessayer')}
          </Bouton>
        </div>
      )}
    </section>
  );
}

export function ColonneReglages(p: ColonneReglagesProps): React.ReactElement {
  const { tm } = p;

  const suggestion = p.suggestion;
  const touches = tm('astuce.touches');
  const [avantTouches, apresTouches = ''] = tm('astuce.texte', { touches: '\u0000' }).split('\u0000');

  return (
    <div className="sc-notif__volet sc-notif__volet--droit" data-mvt="cascade">
      <NiveauDeBruit tm={tm} reglages={p.reglages} maintenant={p.maintenant} onChanger={p.onChanger} />
      <ParType tm={tm} reglages={p.reglages} lignes={p.lignes} echec={p.echec} onChanger={p.onChanger} onReessayer={p.onReessayer} />
      {suggestion ? (
        <SuggestionAjmani
          titre={tm('suggestion.titre')}
          texte={tm(`suggestion.texte.${suggestion.categorie}`, { n: Math.max(2, Math.floor(suggestion.jours / 7)) })}
          primaire={{ libelle: tm('suggestion.passer'), onClick: () => p.onPasserEnResume(suggestion) }}
          secondaire={{ libelle: tm('suggestion.garder'), onClick: () => p.onGarder(suggestion) }}
        />
      ) : (
        <section className="sc-notif__carte sc-notif__astuce" aria-label={tm('astuce.titre')}>
          <p className="sc-notif__astuce-entete">
            <IconeEtincelle taille={12} />
            <span>{tm('astuce.titre')}</span>
          </p>
          <p className="sc-notif__astuce-texte">
            {avantTouches}
            <Raccourci>{touches}</Raccourci>
            {apresTouches}
          </p>
        </section>
      )}
    </div>
  );
}
