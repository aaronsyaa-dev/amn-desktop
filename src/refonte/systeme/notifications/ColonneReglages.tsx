import React, { useEffect, useId, useRef, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { Bouton } from '../../../socle/ui/Bouton';
import { Raccourci } from '../../../socle/ui/Pastilles';
import { Squelette } from '../../../socle/ui/Etats';
import { Interrupteur, Selecteur, SuggestionAjmani } from '../../../socle/ui/controles';
import { useFermetureEchap } from '../../../lib/useFermetureEchap';
import type { CleMots } from './i18n';
import type { CategorieMatrice, SuggestionMoinsDeBruit } from './modele';
import { CANAUX, HEURES_PROPOSEES, estVerrouillee, heureEnMots, type ChangementReglage, type ReglagesNotifications } from './reglages';

/**
 * LA COLONNE DE DROITE (H40) — 400 px, trois cartes : la matrice, les heures calmes et le résumé du matin, la
 * suggestion d'Ajmani (ou l'astuce quand il n'y a rien à suggérer : jamais un vide).
 *
 * La matrice : quinze interrupteurs (cinq types × App, Mail, Mobile). Chaque clic s'enregistre tout de suite ; la
 * dernière case de « Sécurité » est verrouillée avec son info-bulle. Un enregistrement refusé fait revenir la case et
 * affiche « Le réglage n'a pas pu être enregistré. » avec « Réessayer ».
 */
type Tm = (cle: CleMots, params?: Record<string, string | number>) => string;

export interface ColonneReglagesProps {
  tm: Tm;
  reglages: ReglagesNotifications;
  lignes: readonly CategorieMatrice[];
  echec: boolean;
  suggestion: SuggestionMoinsDeBruit | null;
  chargement: boolean;
  onChanger: (changements: ChangementReglage[]) => boolean;
  onReessayer: () => void;
  onPasserEnResume: (suggestion: SuggestionMoinsDeBruit) => void;
  onGarder: (suggestion: SuggestionMoinsDeBruit) => void;
}

const COLONNES = { app: 'canal.app', mail: 'canal.mail', mobile: 'canal.mobile' } as const satisfies Record<(typeof CANAUX)[number], CleMots>;

function CarteSquelette({ hauteur }: { hauteur: number }): React.ReactElement {
  return (
    <div className="sc-notif__carte sc-notif__squelette-carte" style={{ minHeight: hauteur }}>
      <div className="sc-notif__squelette-texte">
        <Squelette largeur="55%" hauteur={14} />
        <Squelette largeur="90%" hauteur={10} />
        <Squelette largeur="70%" hauteur={10} />
      </div>
    </div>
  );
}

/** Les deux sélecteurs d'heure des heures calmes : un petit panneau sous la phrase, fermé par Échap ou un clic ailleurs. */
function EditeurHeures({ tm, reglages, onChanger, onFermer }: { tm: Tm; reglages: ReglagesNotifications; onChanger: ColonneReglagesProps['onChanger']; onFermer: () => void }): React.ReactElement {
  const racine = useRef<HTMLDivElement>(null);
  const fermer = useRef(onFermer);
  fermer.current = onFermer;
  useFermetureEchap(true, onFermer);
  useEffect(() => {
    racine.current?.querySelector<HTMLElement>('select')?.focus();
    const dehors = (e: MouseEvent) => {
      const cible = e.target as HTMLElement;
      // Le bouton qui l'a ouvert gère lui-même sa bascule.
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
        <Bouton variante="secondaire" onClick={onFermer}>
          {tm('calmes.fermer')}
        </Bouton>
      </div>
    </div>
  );
}

export function ColonneReglages(p: ColonneReglagesProps): React.ReactElement {
  const { tm, reglages } = p;
  const [editeur, setEditeur] = useState(false);
  const idMatrice = useId();

  if (p.chargement) {
    return (
      <div className="sc-notif__droite" aria-hidden>
        <CarteSquelette hauteur={304} />
        <CarteSquelette hauteur={136} />
        <CarteSquelette hauteur={156} />
      </div>
    );
  }

  const calmes = reglages.heuresCalmes;
  const suggestion = p.suggestion;
  const touches = tm('astuce.touches');
  const [avantTouches, apresTouches = ''] = tm('astuce.texte', { touches: '\u0000' }).split('\u0000');

  return (
    <div className="sc-notif__droite">
      <section className="sc-notif__carte sc-notif__carte--matrice" aria-labelledby={idMatrice}>
        <h2 id={idMatrice} className="sc-notif__carte-titre">
          {tm('matrice.titre')}
        </h2>
        <div className="sc-notif__matrice" role="group" aria-label={tm('matrice.libelle')}>
          <span aria-hidden />
          {CANAUX.map((canal) => (
            <span key={canal} className="sc-notif__canal">
              {tm(COLONNES[canal])}
            </span>
          ))}
          {p.lignes.map((categorie) => (
            <div key={categorie} className="sc-notif__rangee">
              <span>{tm(`ligne.${categorie}`)}</span>
              {CANAUX.map((canal) => {
                const verrouillee = estVerrouillee(reglages, categorie, canal);
                const libelle = tm('matrice.interrupteur', { ligne: tm(`ligne.${categorie}`), canal: tm(COLONNES[canal]) });
                return (
                  <span key={canal} className="sc-notif__cellule" title={verrouillee ? tm('matrice.securite') : undefined}>
                    <Interrupteur
                      actif={reglages.canaux[categorie][canal]}
                      libelle={verrouillee ? `${libelle}. ${tm('matrice.securite')}` : libelle}
                      disabled={verrouillee}
                      onChange={(actif) => p.onChanger([{ chemin: `canaux.${categorie}.${canal}`, valeur: actif }])}
                    />
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        {p.echec && (
          <div role="alert" className="sc-notif__echec">
            <CircleAlert aria-hidden />
            <span>{tm('matrice.echec')}</span>
            <Bouton variante="secondaire" onClick={p.onReessayer}>
              {tm('matrice.reessayer')}
            </Bouton>
          </div>
        )}
      </section>

      <section className="sc-notif__carte sc-notif__carte--reglages" aria-label={`${tm('calmes.titre')}, ${tm('resume.titre')}`}>
        <div className="sc-notif__reglage">
          <div className="sc-notif__reglage-texte">
            <span className="sc-notif__reglage-titre">{tm('calmes.titre')}</span>
            {calmes.actif ? (
              <button type="button" data-calmes-declencheur className="sc-notif__reglage-aide sc-notif__reglage-aide--bouton sc-focus" aria-expanded={editeur} aria-label={`${tm('calmes.modifier')}. ${tm('calmes.texte', { de: calmes.de, a: calmes.a })}`} onClick={() => setEditeur((o) => !o)}>
                {tm('calmes.texte', { de: calmes.de, a: calmes.a })}
              </button>
            ) : (
              <p className="sc-notif__reglage-aide">{tm('calmes.off')}</p>
            )}
          </div>
          <Interrupteur
            actif={calmes.actif}
            libelle={tm('calmes.titre')}
            onChange={(actif) => {
              if (!actif) setEditeur(false);
              p.onChanger([{ chemin: 'heuresCalmes.actif', valeur: actif }]);
            }}
          />
          {editeur && calmes.actif && <EditeurHeures tm={tm} reglages={reglages} onChanger={p.onChanger} onFermer={() => setEditeur(false)} />}
        </div>
        <div className="sc-notif__reglage">
          <div className="sc-notif__reglage-texte">
            <span className="sc-notif__reglage-titre">{tm('resume.titre')}</span>
            <p className="sc-notif__reglage-aide">{tm('resume.texte', { heure: heureEnMots(reglages.resume.heure) })}</p>
          </div>
          <Interrupteur actif={reglages.resume.actif} libelle={tm('resume.titre')} onChange={(actif) => p.onChanger([{ chemin: 'resume.actif', valeur: actif }])} />
        </div>
      </section>

      {suggestion ? (
        <SuggestionAjmani
          titre={tm('suggestion.titre')}
          texte={tm(`suggestion.texte.${suggestion.categorie}`, { n: suggestion.jours })}
          primaire={{ libelle: tm('suggestion.passer'), onClick: () => p.onPasserEnResume(suggestion) }}
          secondaire={{ libelle: tm('suggestion.garder'), onClick: () => p.onGarder(suggestion) }}
        />
      ) : (
        <section className="sc-notif__carte sc-notif__astuce" aria-label={tm('astuce.titre')}>
          <h2 className="sc-notif__carte-titre">{tm('astuce.titre')}</h2>
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
