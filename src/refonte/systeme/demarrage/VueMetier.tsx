import React, { useRef } from 'react';
import { ArrowRight, Book, Box, CalendarDays, Check, CircleAlert, File, House, Layers, Pencil, RotateCcw, Truck, Users, Zap } from 'lucide-react';
import { Bouton, Carte, Chargement, PageHead, Saisie, Squelette, type ActionPage } from '../../../socle/ui';
import { IconeEtincelle, Segmente } from '../../../socle/ui/controles';
import { ICONES_FAMILLE } from '../../../socle/coquille/BarreLaterale';
import { useMots } from './i18n';
import { MODELES, TAILLES, modeleParId, tuileVoisine, type IconeModele, type TailleEquipe } from './modeles';
import './demarrage.css';

/**
 * QUEL EST VOTRE MÉTIER ? (H47, v3) — la VUE : tout ce qu'elle montre arrive en props, elle ne sait rien du poste.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Elle se rend donc sans navigateur ni fournisseur (`check:systeme-demarrage`, aperçu `scripts/apercu/ecrans/H47.tsx`).
 * `PageMetier.tsx` la branche sur le magasin du métier, le registre, les allègements de la barre et l'assistant.
 *
 * La surface : huit CARTES de métier (groupe `radio`) qui montrent chacune ce que l'espace deviendra (bande de couleurs
 * des familles, quatre modules, « + N autres, T en tout ») ; sous la grille, « Votre espace, demain matin » : la barre
 * latérale miniature, trois exemples de journée (des exemples du modèle, jamais les données de la personne), « Combien
 * êtes-vous ? » et « Pas dans la liste ? ». Un seul bouton primaire : « Continuer avec {métier} ».
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
  if (nom === 'etincelle') return <IconeEtincelle taille={15} />;
  const Icone = ICONES[nom];
  return <Icone aria-hidden size={15} strokeWidth={1.7} />;
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

/** Une carte de métier, calculée par la page depuis le modèle et le registre. */
export interface CarteMetier {
  id: string;
  /** Ses quatre premiers modules. */
  lignes: readonly LigneModule[];
  /** La bande de composition : modules par famille (`teinte` : la couleur du socle). */
  bande: readonly { teinte: string; n: number }[];
  autres: number;
  total: number;
}

/** Un groupe de la barre latérale miniature : une famille et ses modules. */
export interface GroupeBarre {
  famille: string;
  teinte: string | undefined;
  nom: string;
  modules: readonly string[];
}

/** Un encart du modèle (automatisations, modèles de documents) — seulement si le modèle en a. */
export interface ExtraModele {
  icone: 'automatisations' | 'documents';
  titre: string;
  detail: string;
}

export interface VueMetierProps {
  /** L'identifiant du modèle choisi, ou `null` au premier affichage. */
  choix: string | null;
  taille: TailleEquipe;
  cartes: readonly CarteMetier[];
  barre: readonly GroupeBarre[];
  /** Les modules dans la barre (six au plus) et les autres modules activés (« prêts à servir »). */
  dansLaBarre: number;
  autresPrets: number;
  extras: readonly ExtraModele[];
  /** Le nombre de modules du registre (« Les 101 modules restent… »). */
  totalModules: number;
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

/* ── Le squelette : la même forme, pour le temps que l'écran se charge (repli de `lazy`) ── */

export function SqueletteMetier() {
  const { tm } = useMots();
  return (
    <Chargement libelle={tm('chargement')} className="met-page">
      <div aria-hidden className="met-surface">
        <div className="met-tuiles">
          {MODELES.map((m) => (
            <Squelette key={m.id} largeur="100%" hauteur={189} rayon="14px" />
          ))}
        </div>
        <Squelette largeur="100%" hauteur={258} rayon="14px" />
      </div>
    </Chargement>
  );
}

/* ── Une carte de métier : un `radio` qui couvre la carte, les mini-interrupteurs par-dessus ── */

function CarteDeMetier({ c, i, p, onTouche, refRadio }: { c: CarteMetier; i: number; p: VueMetierProps; onTouche: (i: number, ev: React.KeyboardEvent) => void; refRadio: (el: HTMLButtonElement | null) => void }) {
  const { tm, langue } = useMots();
  const m = modeleParId(c.id);
  if (!m) return null;
  const choisi = p.choix === c.id;
  const total = c.bande.reduce((s, b) => s + b.n, 0) || 1;
  return (
    <div className="met-carte" data-choisi={choisi || undefined} data-mvt="entree" style={{ '--sc-mvt-rang': i } as React.CSSProperties}>
      <button
        ref={refRadio}
        type="button"
        role="radio"
        aria-checked={choisi}
        aria-label={`${m.nom[langue]}, ${m.description[langue]}`}
        tabIndex={choisi || (p.choix === null && i === 0) ? 0 : -1}
        className="met-carte__choix sc-focus"
        onClick={() => p.onChoisir(c.id)}
        onKeyDown={(ev) => onTouche(i, ev)}
      />
      <div className="met-carte__entete">
        <span aria-hidden className="met-carte__tuile">
          <IconeTuile nom={m.icone} />
        </span>
        <span className="met-carte__textes">
          <span className="met-carte__nom">{m.nom[langue]}</span>
          <span className="met-carte__mots">{m.description[langue]}</span>
        </span>
        {choisi && (
          <span aria-hidden className="met-carte__coche">
            <Check size={11} strokeWidth={3.2} />
          </span>
        )}
      </div>
      <span role="img" aria-label={tm('carte.bande')} className="met-bande-couleurs">
        {c.bande.map((b) => (
          <span key={b.teinte} className="met-bande-couleurs__segment" data-famille={b.teinte} style={{ flexGrow: b.n / total }} />
        ))}
      </span>
      <ul className="met-carte__modules">
        {c.lignes.map((l) => (
          <li key={l.id} className="met-carte__module" data-famille={l.teinte}>
            <span aria-hidden className="sc-point" data-taille="6" />
            <span className="met-carte__module-nom">{l.nom}</span>
            {choisi && (
              <button
                type="button"
                role="switch"
                aria-checked={l.actif || l.toujours}
                aria-label={tm('carte.module', { module: l.nom })}
                title={l.toujours ? tm('carte.toujours') : p.dernierActif && l.actif ? tm('carte.dernier') : undefined}
                disabled={l.toujours || (p.dernierActif && l.actif)}
                className="met-mini sc-focus"
                onClick={() => p.onBasculer(l.id)}
              >
                <span aria-hidden className="met-mini__pastille" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="met-carte__pied">{c.autres > 0 ? tm('carte.autres', { n: c.autres, total: c.total }) : tm('carte.autres.zero', { total: c.total })}</p>
    </div>
  );
}

/* ── La vue ───────────────────────────────────────────────────────────────── */

export function VueMetier(p: VueMetierProps) {
  const { tm, langue } = useMots();
  const modele = modeleParId(p.choix);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const grille = useRef<HTMLDivElement>(null);
  const peutContinuer = modele !== null;

  /* Les flèches parcourent la grille comme un groupe `radio` : ← → d'une carte, ↑ ↓ d'une rangée. */
  const surTouche = (i: number, ev: React.KeyboardEvent) => {
    const colonnes = Math.max(1, (grille.current ? window.getComputedStyle(grille.current).gridTemplateColumns.split(' ').length : 4) || 4);
    const voisin = tuileVoisine(i, ev.key, colonnes, p.cartes.length);
    if (voisin === null) return;
    ev.preventDefault();
    p.onChoisir(p.cartes[voisin].id);
    radios.current[voisin]?.focus();
  };

  const phrase = (() => {
    const n = p.dansLaBarre;
    if (n <= 1) return p.autresPrets > 0 ? tm('apercu.phrase.un', { autres: p.autresPrets }) : tm('apercu.phrase.un.sans');
    const nombre = n <= 6 ? tm(`nombre.${n as 2 | 3 | 4 | 5 | 6}`) : String(n);
    return p.autresPrets > 0 ? tm('apercu.phrase', { nombre, autres: p.autresPrets }) : tm('apercu.phrase.sans', { nombre });
  })();

  /* « Continuer » : primaire tant que le volet « Décrire » est fermé, secondaire ensuite (le volet porte alors le primaire). */
  const continuer: ActionPage = {
    libelle: modele ? tm('metier.continuer.avec', { metier: modele.nom[langue] }) : tm('metier.continuer'),
    icone: <ArrowRight aria-hidden />,
    disabled: !peutContinuer,
    infobulle: peutContinuer ? undefined : tm('metier.continuer.info'),
    onClick: p.onContinuer,
  };

  return (
    <div className="met-page" data-refonte-police="inter">
      <PageHead
        className="dem-entete"
        titre={tm('metier.titre')}
        attributsTitre={{ 'data-guide': 'titre' }}
        sousTitre={tm('metier.sous')}
        secondaires={[{ libelle: tm('metier.passer'), onClick: p.onPasser }, ...(p.decrireOuvert ? [continuer] : [])]}
        primaire={p.decrireOuvert ? undefined : continuer}
      />

      {p.erreurEnregistrement && (
        <div role="alert" className="dem-bandeau met-erreur">
          <p className="dem-bandeau__texte">
            <CircleAlert aria-hidden size={16} strokeWidth={1.8} />
            {tm('erreur.enregistrement')}
          </p>
          <Bouton variante="secondaire" icone={<RotateCcw aria-hidden />} onClick={p.onReessayer}>
            {tm('erreur.reessayer')}
          </Bouton>
        </div>
      )}

      <div className="met-surface">
        <div ref={grille} role="radiogroup" aria-label={tm('metier.grille')} className="met-tuiles">
          {p.cartes.map((c, i) => (
            <CarteDeMetier
              key={c.id}
              c={c}
              i={i}
              p={p}
              onTouche={surTouche}
              refRadio={(el) => {
                radios.current[i] = el;
              }}
            />
          ))}
        </div>

        <Carte sansMarge className="met-bande" rang={8} aria-label={tm('apercu.titre')}>
          <div className="met-bande__corps">
            <div className="met-barre" role="group" aria-label={tm('barre.titre')}>
              <p className="met-barre__titre">
                <span aria-hidden className="met-barre__marque">
                  A
                </span>
                {tm('barre.titre')}
              </p>
              {modele ? (
                <ul key={modele.id} className="met-barre__groupes" data-mvt="cascade">
                  {p.barre.map((g) => {
                    const Icone = ICONES_FAMILLE[g.famille] ?? Layers;
                    return (
                      <li key={g.famille} className="met-barre__groupe" data-famille={g.teinte}>
                        <span className="met-barre__famille">
                          <Icone aria-hidden size={11} strokeWidth={1.8} />
                          {g.nom}
                        </span>
                        <ul className="met-barre__modules">
                          {g.modules.map((nom) => (
                            <li key={nom}>{nom}</li>
                          ))}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div aria-hidden className="met-barre__squelette">
                  {[70, 110, 90, 120, 80, 100].map((l, i) => (
                    <Squelette key={i} largeur={l} hauteur={10} rayon="99px" ligne />
                  ))}
                </div>
              )}
            </div>

            <div className="met-apercu">
              <p className="met-apercu__entete">
                <span className="met-apercu__titre">{tm('apercu.titre')}</span>
                {modele && <span className="met-apercu__avec">{tm('apercu.avec', { metier: modele.nom[langue] })}</span>}
              </p>
              {modele ? (
                <>
                  <p className="met-apercu__phrase">{phrase}</p>
                  <ul key={modele.id} className="met-apercu__cartes" title={tm('apercu.exemple.aide')} data-mvt="cascade">
                    {modele.apercu.map((c, i) => (
                      <li key={i} className="met-apercu__carte" data-famille={p.teintesApercu[i]}>
                        <p className="met-apercu__etiquette">
                          <span aria-hidden className="sc-point" data-taille="6" />
                          {c.etiquette[langue]}
                        </p>
                        <p className="met-apercu__carte-titre">{c.titre[langue]}</p>
                        <p className="met-apercu__detail">{c.detail[langue]}</p>
                      </li>
                    ))}
                  </ul>
                  {p.extras.length > 0 && (
                    <ul className="met-extras">
                      {p.extras.map((x) => (
                        <li key={x.icone} className="met-extra">
                          {x.icone === 'automatisations' ? <Zap aria-hidden size={14} strokeWidth={1.8} /> : <File aria-hidden size={14} strokeWidth={1.8} />}
                          <span className="met-extra__textes">
                            <span className="met-extra__titre">{x.titre}</span>
                            <span className="met-extra__detail">{x.detail}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="met-apercu__vide">{tm('apercu.vide')}</p>
              )}
              <p className="met-apercu__mention">
                <Layers aria-hidden size={13} strokeWidth={1.8} />
                {tm('apercu.mention', { n: p.totalModules })}
              </p>
            </div>

            <div className="met-cote">
              <p className="met-cote__titre">{tm('taille.titre')}</p>
              <p className="met-cote__aide">{tm('taille.aide')}</p>
              <div className="met-cote__segmente">
                <Segmente libelle={tm('taille.titre')} options={TAILLES.map((t) => ({ cle: t, libelle: tm(`taille.${t}`) }))} valeur={p.taille} onChange={(cle) => p.onTaille(cle as TailleEquipe)} />
              </div>
              <div className="met-decrire">
                <p className="met-decrire__titre">
                  <IconeEtincelle taille={12} />
                  {tm('decrire.titre')}
                </p>
                {p.decrireOuvert ? (
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
                ) : (
                  <>
                    <p className="met-decrire__texte">{tm('decrire.texte')}</p>
                    <span title={p.horsLigne ? tm('horsLigne') : undefined}>
                      <Bouton variante="secondaire" taille="petit" disabled={p.horsLigne} aria-expanded={p.decrireOuvert} icone={<Pencil aria-hidden />} onClick={p.onDecrire}>
                        {tm('decrire.bouton')}
                      </Bouton>
                    </span>
                  </>
                )}
                {p.composeEnvoye && (
                  <p role="status" className="met-decrire__note">
                    {tm('decrire.envoye')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Carte>
      </div>
    </div>
  );
}
