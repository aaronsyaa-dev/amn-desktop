import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, Download, Phone, Play, RotateCcw } from 'lucide-react';
import { encoderQr } from '../../../lib/qr';
import { Anneau, Bouton, Carte, CaseACocher, Chargement, Raccourci, Squelette } from '../../../socle/ui';
import { IconeEtincelle } from '../../../socle/ui/controles';
import { ORDRE_ETAPES, RACCOURCIS_SAVOIR, type EtapeCalculee, type IdEtape, type RaccourciSavoir, type ResultatEtapes } from './etapes';
import { useMots } from './i18n';
import './demarrage.css';

/**
 * DÉMARRAGE (H42) — la VUE : tout ce qu'elle montre arrive en props, elle ne sait rien du poste.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Elle se rend donc sans navigateur ni fournisseur (`check:systeme-demarrage`). `PageDemarrage.tsx` la branche sur les
 * données, la navigation, la visite guidée et l'assistant.
 *
 * Ce qui se fait tout seul : les étapes 1 à 4 (métier, client, devis, équipe) se cochent d'après les données du poste.
 * Ce qui se marque à la main : les étapes 5 (encaissements) et 6 (application mobile) — le poste n'a aucune donnée
 * de connexion bancaire ni d'appareil mobile à lire, et ne prétendra donc pas le savoir.
 */

export interface VueDemarrageProps {
  etat: 'chargement' | 'erreur' | 'pret';
  calcul: ResultatEtapes;
  prenom: string;
  horsLigne: boolean;
  peutAdministrer: boolean;
  /** ⌘ (macOS) ou Ctrl : ce que la touche de « Bon à savoir » affiche. */
  mac: boolean;
  onPlusTard: () => void;
  onAccueil: () => void;
  onReprendreVisite: () => void;
  onReessayer: () => void;
  /** Le bouton d'une étape à faire. */
  onAgir: (etape: EtapeCalculee) => void;
  /** Le titre d'une étape faite : l'élément concerné, pour le revoir. */
  onOuvrir: (etape: EtapeCalculee) => void;
  /** La case d'une étape qui se marque à la main. */
  onMarquer: (id: IdEtape) => void;
  onRetirer: (id: IdEtape) => void;
  onRemettre: () => void;
  onRaccourci: (raccourci: RaccourciSavoir) => void;
  onAjmani: () => void;
  onAppel: () => void;
  onDonnees: () => void;
}

/* ── Une ligne d'étape : 63 px, la case, le titre, le bouton ──────────────── */

function LigneEtape({ e, p }: { e: EtapeCalculee; p: VueDemarrageProps }) {
  const { tm, langue } = useMots();
  const [menu, setMenu] = useState(false);
  const ligne = useRef<HTMLLIElement>(null);

  /* Le menu discret se ferme à Échap ou à un clic ailleurs. */
  useEffect(() => {
    if (!menu) return undefined;
    const fermer = (ev: Event) => {
      if (ev instanceof KeyboardEvent && ev.key !== 'Escape') return;
      if (ev instanceof PointerEvent && ligne.current?.contains(ev.target as Node)) return;
      setMenu(false);
    };
    window.addEventListener('keydown', fermer);
    window.addEventListener('pointerdown', fermer);
    return () => {
      window.removeEventListener('keydown', fermer);
      window.removeEventListener('pointerdown', fermer);
    };
  }, [menu]);

  const titre = e.libelle ? e.libelle.titre[langue] : tm(`etape.${e.id as 'metier' | 'equipe' | 'mobile'}.titre`);
  const sous = e.id === 'metier' && e.passee ? tm('etape.metier.sous.passee') : e.libelle ? e.libelle.sous[langue] : tm(`etape.${e.id as 'metier' | 'equipe' | 'mobile'}.sous`);
  const action = e.libelle ? e.libelle.action[langue] : tm(`etape.${e.id as 'metier' | 'equipe' | 'mobile'}.action`);
  const marquable = e.manuelle && !e.faite;

  const textes = (
    <>
      <span className="dem-etape__titre">{titre}</span>
      <span className="dem-etape__sous">{sous}</span>
    </>
  );

  const reserve = !p.peutAdministrer && (e.id === 'equipe' || e.id === 'paiement');
  const horsLigne = p.horsLigne && (e.id === 'paiement' || e.id === 'mobile');

  return (
    <li
      ref={ligne}
      className="dem-etape"
      data-etape={e.id}
      data-faite={e.faite || undefined}
      data-conseillee={e.conseillee || undefined}
      aria-keyshortcuts="S"
      title={tm('etape.pasPourMoi.aide')}
      onKeyDown={(ev) => {
        if ((ev.key === 's' || ev.key === 'S') && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
          ev.preventDefault();
          p.onRetirer(e.id);
        }
      }}
      onContextMenu={(ev) => {
        ev.preventDefault();
        setMenu(true);
      }}
    >
      <CaseACocher
        taille="serie"
        coche={e.faite}
        lecture={!marquable}
        libelle={marquable ? tm('etape.case.manuel', { etape: titre }) : tm('etape.case.auto', { etape: titre })}
        onChange={() => p.onMarquer(e.id)}
      />
      {e.faite ? (
        <button type="button" className="dem-etape__ouvrir sc-focus" aria-label={tm('etape.ouvrir', { etape: titre })} onClick={() => p.onOuvrir(e)}>
          {textes}
        </button>
      ) : (
        <span className="dem-etape__textes">{textes}</span>
      )}
      {!e.faite &&
        (reserve ? (
          <span className="dem-etape__reserve">{tm('etape.admin')}</span>
        ) : (
          <span className="dem-etape__bouton" title={horsLigne ? tm('horsLigne') : undefined}>
            <Bouton variante={e.conseillee ? 'primaire' : 'secondaire'} taille="petit" disabled={horsLigne} onClick={() => p.onAgir(e)}>
              {action}
            </Bouton>
          </span>
        ))}
      {menu && (
        <div className="dem-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="dem-menu__item sc-focus"
            autoFocus
            onClick={() => {
              setMenu(false);
              p.onRetirer(e.id);
            }}
          >
            {tm('etape.pasPourMoi')}
          </button>
        </div>
      )}
    </li>
  );
}

/* ── Le squelette : la même forme que la page chargée, rien ne saute ──────── */

export function SqueletteDemarrage() {
  const { tm } = useMots();
  return (
    <Chargement libelle={tm('chargement')} className="dem-grille">
      <Carte sansMarge className="dem-principale">
        <div aria-hidden className="dem-accueil">
          <Squelette largeur={80} hauteur={80} rayon="99px" />
          <div className="dem-squelette-textes" style={{ flex: 1 }}>
            <Squelette largeur={210} hauteur={20} rayon="6px" ligne />
            <Squelette largeur="90%" hauteur={12} rayon="99px" ligne />
          </div>
        </div>
        {ORDRE_ETAPES.map((id) => (
          <div key={id} aria-hidden className="dem-squelette-ligne">
            <Squelette largeur={24} hauteur={24} rayon="99px" />
            <div className="dem-squelette-textes">
              <Squelette largeur={190} hauteur={12} rayon="99px" ligne />
              <Squelette largeur={130} hauteur={10} rayon="99px" ligne />
            </div>
            <Squelette largeur={90} hauteur={31} rayon="9px" />
          </div>
        ))}
      </Carte>
      <div aria-hidden className="dem-droite">
        <Carte sansMarge className="dem-visite">
          <Squelette largeur="100%" hauteur={152} rayon="14px" />
          <div className="dem-squelette-textes" style={{ marginTop: 13 }}>
            <Squelette largeur={170} hauteur={12} rayon="99px" ligne />
            <Squelette largeur={230} hauteur={10} rayon="99px" ligne />
          </div>
        </Carte>
        <Carte sansMarge className="dem-savoir">
          <Squelette largeur={110} hauteur={14} rayon="99px" ligne />
          <div className="dem-squelette-textes" style={{ marginTop: 22, gap: 31 }}>
            <Squelette largeur="70%" hauteur={11} rayon="99px" ligne />
            <Squelette largeur="55%" hauteur={11} rayon="99px" ligne />
            <Squelette largeur="65%" hauteur={11} rayon="99px" ligne />
          </div>
        </Carte>
      </div>
    </Chargement>
  );
}

/* ── La vue ───────────────────────────────────────────────────────────────── */

export function VueDemarrage(p: VueDemarrageProps) {
  const { tm } = useMots();
  const { calcul } = p;
  const aide = useRef<HTMLButtonElement>(null);
  const prenom = p.prenom;
  const titreAccueil = calcul.tout ? (prenom ? tm('pret', { prenom }) : tm('pret.sans')) : prenom ? tm('bienvenue', { prenom }) : tm('bienvenue.sans');

  return (
    <div className="dem-page" data-refonte-police="inter">
      <header className="dem-entete">
        <div className="dem-entete__titres">
          <h1 className="dem-titre" data-guide="titre">
            {tm('titre')}
          </h1>
          <p className="dem-sous">{tm('sous')}</p>
        </div>
        <div className="dem-actions">
          {!calcul.tout && (
            <Bouton variante="secondaire" taille="petit" onClick={p.onPlusTard}>
              {tm('plusTard')}
            </Bouton>
          )}
          <Bouton variante="secondaire" taille="petit" icone={<Play size={13} strokeWidth={2} aria-hidden />} onClick={p.onReprendreVisite}>
            {tm('reprendreVisite')}
          </Bouton>
          {calcul.tout && (
            <Bouton variante="primaire" taille="petit" onClick={p.onAccueil}>
              {tm('allerAccueil')}
            </Bouton>
          )}
        </div>
      </header>

      {p.etat === 'erreur' && (
        <div role="alert" className="dem-bandeau">
          <p className="dem-bandeau__texte">
            <CircleAlert aria-hidden size={16} strokeWidth={1.8} />
            {tm('erreur')}
          </p>
          <Bouton variante="secondaire" taille="petit" icone={<RotateCcw size={14} strokeWidth={1.9} aria-hidden />} onClick={p.onReessayer}>
            {tm('erreur.reessayer')}
          </Bouton>
        </div>
      )}

      {p.etat === 'chargement' ? (
        <SqueletteDemarrage />
      ) : (
        <div className="dem-grille">
          <Carte sansMarge className="dem-principale" aria-label={tm('etapes.liste')}>
            <div className="dem-accueil">
              <span className="dem-anneau">
                <Anneau valeur={calcul.ratio} taille={80} ton="succes" libelle={tm('anneau.libelle')} texte={tm('anneau.texte', { n: calcul.n, total: calcul.total })}>
                  {`${calcul.n}/${calcul.total}`}
                </Anneau>
              </span>
              <div className="dem-accueil__textes">
                <h2 className="dem-bienvenue">{titreAccueil}</h2>
                <p className="dem-accueil__texte" aria-live="polite">
                  {tm(`texte.${calcul.texte}`, { n: calcul.restantes })}
                </p>
              </div>
            </div>
            <ul className="dem-etapes" aria-label={tm('etapes.liste')}>
              {calcul.etapes.map((e) => (
                <LigneEtape key={e.id} e={e} p={p} />
              ))}
            </ul>
            {calcul.retirees.length > 0 && (
              <p className="dem-retirees">
                <span>{calcul.retirees.length === 1 ? tm('etape.retirees.une') : tm('etape.retirees.plusieurs', { n: calcul.retirees.length })}</span>
                <button type="button" className="dem-lien sc-focus" onClick={p.onRemettre}>
                  {tm('etape.remettre')}
                </button>
              </p>
            )}
            {calcul.total < ORDRE_ETAPES.length && (
              <p className="dem-libre">
                {tm('etape.libre')}
                <button
                  type="button"
                  className="dem-lien sc-focus"
                  onClick={() => {
                    aide.current?.scrollIntoView({ block: 'nearest' });
                    aide.current?.focus();
                  }}
                >
                  {tm('etape.libre.lien')}
                </button>
              </p>
            )}
          </Carte>

          <div className="dem-droite">
            <Carte sansMarge className="dem-visite" aria-label={tm('visite.titre')}>
              <div className="dem-poster">
                <button type="button" className="dem-poster__lire sc-focus" aria-label={tm('visite.lire')} onClick={p.onReprendreVisite}>
                  <Play aria-hidden size={20} strokeWidth={0} fill="currentColor" />
                </button>
              </div>
              <h2 className="dem-visite__titre">{tm('visite.titre')}</h2>
              <p className="dem-visite__texte">{tm('visite.texte')}</p>
            </Carte>
            <Carte sansMarge className="dem-savoir" aria-label={tm('savoir.titre')}>
              <h2 className="dem-savoir__titre">{tm('savoir.titre')}</h2>
              <ul className="dem-savoir__liste" aria-label={tm('savoir.liste')}>
                {RACCOURCIS_SAVOIR.map((r) => {
                  const touche = r.avecModificateur ? `${p.mac ? '⌘' : 'Ctrl '}${r.touche.toUpperCase()}` : r.touche;
                  const libelle = tm(`savoir.${r.id === 'chercher' ? 'chercher' : r.id === 'ajmani' ? 'ajmani' : 'raccourcis'}`);
                  return (
                    <li key={r.id}>
                      <button type="button" className="dem-savoir__ligne sc-focus" aria-label={`${libelle} (${touche})`} onClick={() => p.onRaccourci(r)}>
                        <span className="dem-touche" data-large={(r.avecModificateur && !p.mac) || undefined}>
                          <Raccourci>{touche}</Raccourci>
                        </span>
                        <span>{libelle}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Carte>
          </div>
        </div>
      )}

      <Carte sansMarge className="dem-aide" aria-label={tm('aide.groupe')}>
        <div className="dem-aide__grille">
          <button ref={aide} type="button" className="dem-tuile sc-focus" onClick={p.onAjmani}>
            <span aria-hidden className="dem-tuile__icone">
              <IconeEtincelle taille={16} />
            </span>
            <span className="dem-tuile__textes">
              <span className="dem-tuile__titre">{tm('aide.ajmani.titre')}</span>
              <span className="dem-tuile__texte">{tm('aide.ajmani.texte')}</span>
            </span>
          </button>
          <button type="button" className="dem-tuile sc-focus" disabled={p.horsLigne} title={p.horsLigne ? tm('horsLigne') : undefined} onClick={p.onAppel}>
            <span aria-hidden className="dem-tuile__icone">
              <Phone size={16} strokeWidth={1.8} />
            </span>
            <span className="dem-tuile__textes">
              <span className="dem-tuile__titre">{tm('aide.appel.titre')}</span>
              <span className="dem-tuile__texte">{tm('aide.appel.texte')}</span>
            </span>
          </button>
          <button type="button" className="dem-tuile sc-focus" onClick={p.onDonnees}>
            <span aria-hidden className="dem-tuile__icone">
              <Download size={16} strokeWidth={1.8} />
            </span>
            <span className="dem-tuile__textes">
              <span className="dem-tuile__titre">{tm('aide.donnees.titre')}</span>
              <span className="dem-tuile__texte">{tm('aide.donnees.texte')}</span>
            </span>
          </button>
        </div>
      </Carte>
    </div>
  );
}

/* ── Le lien de l'application mobile : générique, sans jeton, sans donnée personnelle ── */

function CodeQr({ texte, libelle }: { texte: string; libelle: string }) {
  const code = useMemo(() => encoderQr(texte, { niveau: 'M' }), [texte]);
  if (!code) return null;
  const marge = 4;
  const total = code.taille + marge * 2;
  const chemin: string[] = [];
  for (let y = 0; y < code.taille; y += 1) for (let x = 0; x < code.taille; x += 1) if (code.modules[y][x]) chemin.push(`M${x + marge} ${y + marge}h1v1h-1z`);
  return (
    <svg role="img" aria-label={libelle} viewBox={`0 0 ${total} ${total}`} shapeRendering="crispEdges">
      <path d={chemin.join('')} style={{ fill: 'var(--socle-primaire-encre)' }} />
    </svg>
  );
}

/** Le contenu de la fenêtre : le code et le lien. Sans adresse publique, une explication — jamais un faux lien. */
export function LienMobile({ lien }: { lien: string | null }) {
  const { tm } = useMots();
  if (!lien) return <p className="dem-note">{tm('lien.indisponible')}</p>;
  return (
    <div className="dem-lien-mobile">
      <span className="dem-qr">
        <CodeQr texte={lien} libelle={tm('lien.qr')} />
      </span>
      <p className="dem-adresse" aria-label={tm('lien.champ')}>
        {lien}
      </p>
    </div>
  );
}
