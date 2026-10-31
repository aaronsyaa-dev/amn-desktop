import React, { useRef } from 'react';
import { ArrowRight, Book, Box, CalendarDays, CircleAlert, House, LayoutGrid, Plus, RotateCcw, Truck, Users, Zap } from 'lucide-react';
import { Bouton, Carte, Chargement, Saisie, Squelette } from '../../../socle/ui';
import { IconeEtincelle, Interrupteur, Segmente, Tag } from '../../../socle/ui/controles';
import { BlocEtat } from '../../../socle/ui/situations';
import { useMots } from './i18n';
import { MODELES, TAILLES, modeleParId, tuileVoisine, type IconeModele, type TailleEquipe } from './modeles';
import './demarrage.css';

/**
 * QUEL EST VOTRE MÉTIER ? (H47) — la VUE : tout ce qu'elle montre arrive en props, elle ne sait rien du poste.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Elle se rend donc sans navigateur ni fournisseur (`check:systeme-demarrage`). `PageMetier.tsx` la branche sur le
 * magasin du métier, les allègements de la barre et l'assistant.
 */

const ICONES: Record<Exclude<IconeModele, 'etincelle'>, React.ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>> = {
  camion: Truck,
  cube: Box,
  utilisateurs: Users,
  eclair: Zap,
  maison: House,
  calendrier: CalendarDays,
  livre: Book,
};

function IconeTuile({ nom }: { nom: IconeModele }) {
  if (nom === 'etincelle') return <IconeEtincelle taille={18} />;
  const Icone = ICONES[nom];
  return <Icone aria-hidden size={18} strokeWidth={1.7} />;
}

export interface LigneModule {
  id: string;
  nom: string;
  /** La famille du MODULE (pas celle du métier) : la couleur du point. */
  teinte: string | undefined;
  actif: boolean;
  /** Toujours ouvert : l'interrupteur reste allumé et grisé. */
  toujours: boolean;
}

export interface VueMetierProps {
  /** L'identifiant du modèle choisi, ou `null` au premier affichage. */
  choix: string | null;
  taille: TailleEquipe;
  lignes: readonly LigneModule[];
  autres: number;
  /** La famille de chaque carte d'aperçu (couleur du point). */
  teintesApercu: readonly (string | undefined)[];
  /** Il ne reste qu'un module activable allumé : son interrupteur ne s'éteint pas. */
  dernierActif: boolean;
  horsLigne: boolean;
  erreurEnregistrement: boolean;
  decrireOuvert: boolean;
  phrase: string;
  composeEnvoye: boolean;
  onChoisir: (id: string) => void;
  onTaille: (taille: TailleEquipe) => void;
  onBasculer: (id: string) => void;
  onContinuer: () => void;
  onPasser: () => void;
  onReessayer: () => void;
  onDecrire: () => void;
  onPhrase: (texte: string) => void;
  onComposer: () => void;
}

/* ── Le squelette : la même forme, pour le temps que l'écran se charge (fallback de `lazy`) ── */

export function SqueletteMetier() {
  const { tm } = useMots();
  return (
    <Chargement libelle={tm('chargement')} className="met-page">
      <div aria-hidden className="met-grille">
        <div className="met-gauche">
          <div className="met-tuiles">
            {MODELES.map((m) => (
              <Squelette key={m.id} largeur="100%" hauteur={127} rayon="14px" />
            ))}
          </div>
          <Squelette largeur="100%" hauteur={65} rayon="14px" />
          <Squelette largeur="100%" hauteur={165} rayon="14px" />
          <Squelette largeur="100%" hauteur={61} rayon="14px" />
        </div>
        <div className="met-droite">
          <Squelette largeur="100%" hauteur={369} rayon="14px" />
        </div>
      </div>
    </Chargement>
  );
}

/* ── La vue ───────────────────────────────────────────────────────────────── */

export function VueMetier(p: VueMetierProps) {
  const { tm, langue } = useMots();
  const modele = modeleParId(p.choix);
  const tuiles = useRef<(HTMLButtonElement | null)[]>([]);
  const grille = useRef<HTMLDivElement>(null);
  const peutContinuer = modele !== null;

  /* Les flèches parcourent la grille comme un groupe `radio` : ← → d'une tuile, ↑ ↓ d'une rangée. */
  const surTouche = (i: number, ev: React.KeyboardEvent) => {
    const colonnes = Math.max(1, (grille.current ? window.getComputedStyle(grille.current).gridTemplateColumns.split(' ').length : 4) || 4);
    const voisin = tuileVoisine(i, ev.key, colonnes, MODELES.length);
    if (voisin === null) return;
    ev.preventDefault();
    p.onChoisir(MODELES[voisin].id);
    tuiles.current[voisin]?.focus();
  };

  const decrireBouton = (
    <span title={p.horsLigne ? tm('horsLigne') : undefined}>
      <Bouton variante="secondaire" taille="petit" disabled={p.horsLigne} aria-expanded={p.decrireOuvert} onClick={p.onDecrire}>
        {tm('decrire.bouton')}
      </Bouton>
    </span>
  );

  return (
    <div className="met-page" data-refonte-police="inter">
      <header className="dem-entete">
        <div className="dem-entete__titres">
          <h1 className="dem-titre" data-guide="titre">
            {tm('metier.titre')}
          </h1>
          <p className="dem-sous">{tm('metier.sous')}</p>
        </div>
        <div className="dem-actions">
          <Bouton variante="secondaire" taille="petit" onClick={p.onPasser}>
            {tm('metier.passer')}
          </Bouton>
          <span title={peutContinuer ? undefined : tm('metier.continuer.info')}>
            <Bouton variante={p.decrireOuvert ? 'secondaire' : 'primaire'} taille="petit" disabled={!peutContinuer} icone={<ArrowRight size={14} strokeWidth={2} aria-hidden />} onClick={p.onContinuer}>
              {tm('metier.continuer')}
            </Bouton>
          </span>
        </div>
      </header>

      {p.erreurEnregistrement && (
        <div role="alert" className="dem-bandeau met-erreur">
          <p className="dem-bandeau__texte">
            <CircleAlert aria-hidden size={16} strokeWidth={1.8} />
            {tm('erreur.enregistrement')}
          </p>
          <Bouton variante="secondaire" taille="petit" icone={<RotateCcw size={14} strokeWidth={1.9} aria-hidden />} onClick={p.onReessayer}>
            {tm('erreur.reessayer')}
          </Bouton>
        </div>
      )}

      <div className="met-grille">
        <div className="met-gauche">
          <div ref={grille} role="radiogroup" aria-label={tm('metier.grille')} className="met-tuiles">
            {MODELES.map((m, i) => {
              const choisi = p.choix === m.id;
              return (
                <button
                  key={m.id}
                  ref={(el) => {
                    tuiles.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={choisi}
                  tabIndex={choisi || (p.choix === null && i === 0) ? 0 : -1}
                  className="met-tuile sc-focus"
                  onClick={() => p.onChoisir(m.id)}
                  onKeyDown={(ev) => surTouche(i, ev)}
                >
                  <span className="met-tuile__icone">
                    <IconeTuile nom={m.icone} />
                  </span>
                  <span className="met-tuile__titre">{m.nom[langue]}</span>
                  <span className="met-tuile__texte">{m.description[langue]}</span>
                  {choisi && (
                    <span aria-hidden className="met-tuile__coche">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <Carte sansMarge className="met-taille" aria-label={tm('taille.titre')}>
            <div className="met-taille__corps">
              <div>
                <h2 className="met-carte__titre">{tm('taille.titre')}</h2>
                <p className="met-carte__aide">{tm('taille.aide')}</p>
              </div>
              <Segmente
                libelle={tm('taille.titre')}
                options={TAILLES.map((t) => ({ cle: t, libelle: tm(`taille.${t}`) }))}
                valeur={p.taille}
                onChange={(cle) => p.onTaille(cle as TailleEquipe)}
              />
            </div>
          </Carte>

          <Carte sansMarge className="met-apercu" aria-label={tm('apercu.titre')}>
            <div className="met-apercu__entete">
              <div>
                <h2 className="met-carte__titre">{tm('apercu.titre')}</h2>
                <p className="met-carte__aide">{tm('apercu.aide')}</p>
              </div>
              {modele && (
                <span title={tm('apercu.exemple.aide')}>
                  <Tag>{tm('apercu.exemple')}</Tag>
                </span>
              )}
            </div>
            {modele ? (
              <ul key={modele.id} className="met-apercu__cartes">
                {modele.apercu.map((c, i) => (
                  <li key={i} className="met-apercu__carte" data-famille={p.teintesApercu[i]}>
                    <p className="met-apercu__etiquette">
                      <span aria-hidden className="sc-point" data-taille="6" />
                      {c.etiquette[langue]}
                    </p>
                    <p className="met-apercu__titre">{c.titre[langue]}</p>
                    <p className="met-apercu__detail">{c.detail[langue]}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="met-apercu__vide">{tm('apercu.vide')}</p>
            )}
          </Carte>

          <Carte sansMarge className="met-decrire" aria-label={tm('decrire.texte')}>
            <div>
              <div className="met-decrire__ligne">
                <Plus aria-hidden size={16} strokeWidth={1.8} />
                <p className="met-decrire__texte">{tm('decrire.texte')}</p>
                {decrireBouton}
              </div>
              {p.decrireOuvert && (
                <div className="met-decrire__champ">
                  <Saisie
                    etiquette={tm('decrire.champ')}
                    aide={tm('decrire.fermer')}
                    placeholder={tm('decrire.placeholder')}
                    value={p.phrase}
                    autoFocus
                    onChange={(ev) => p.onPhrase(ev.target.value)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' && p.phrase.trim() && !p.horsLigne) {
                        ev.preventDefault();
                        p.onComposer();
                      }
                    }}
                  />
                  <span title={p.horsLigne ? tm('horsLigne') : undefined}>
                    <Bouton variante="primaire" taille="petit" disabled={p.horsLigne || !p.phrase.trim()} icone={<IconeEtincelle taille={14} />} onClick={p.onComposer}>
                      {tm('decrire.composer')}
                    </Bouton>
                  </span>
                </div>
              )}
              {p.composeEnvoye && (
                <p role="status" className="met-decrire__note">
                  {tm('decrire.envoye')}
                </p>
              )}
            </div>
          </Carte>
        </div>

        <div className="met-droite">
          {modele ? (
            <Carte sansMarge className="met-compose" aria-label={tm('compose.titre')}>
              <div key={modele.id} className="met-compose__corps">
                <div className="met-compose__entete">
                  <h2 className="met-carte__titre">{tm('compose.titre')}</h2>
                  <p className="met-carte__aide">{tm('compose.sous')}</p>
                </div>
                <ul className="met-liste" aria-label={tm('compose.liste')}>
                  {p.lignes.map((l) => (
                    <li key={l.id} className="met-ligne" data-famille={l.teinte}>
                      <span aria-hidden className="sc-point" data-taille="8" />
                      <span className="met-ligne__nom">{l.nom}</span>
                      <span title={l.toujours ? tm('compose.toujours') : p.dernierActif && l.actif ? tm('compose.dernier') : undefined}>
                        <Interrupteur actif={l.actif || l.toujours} libelle={l.nom} disabled={l.toujours || (p.dernierActif && l.actif)} onChange={() => p.onBasculer(l.id)} />
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="met-compose__pied">{p.autres > 0 ? tm('compose.autres', { n: p.autres }) : tm('compose.autres.zero')}</p>
              </div>
            </Carte>
          ) : (
            <Carte sansMarge className="met-compose met-compose--vide" aria-label={tm('compose.titre')}>
              <BlocEtat
                icone={<LayoutGrid aria-hidden size={20} strokeWidth={1.7} />}
                titre={tm('vide.titre')}
                texte={tm('vide.texte')}
                niveauTitre={2}
                actions={
                  <span title={p.horsLigne ? tm('horsLigne') : undefined}>
                    <Bouton variante="secondaire" taille="petit" disabled={p.horsLigne} onClick={p.onDecrire}>
                      {tm('vide.action')}
                    </Bouton>
                  </span>
                }
              />
            </Carte>
          )}
        </div>
      </div>
    </div>
  );
}
