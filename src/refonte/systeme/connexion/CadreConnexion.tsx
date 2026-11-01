import React, { useEffect, useState } from 'react';
import { Lock, MessageSquare, Sun } from 'lucide-react';
import { LiveDot } from '../../../socle/ui';
import { styleRang } from '../../../socle/couche-mouvement';
import { useMots } from './i18n';

/**
 * LE CADRE DE LA CONNEXION (G06, v3) — tout ce qui n'est pas le formulaire : le fond qui veille, la marque, la date
 * du poste, la carte centrée (marque 56 px, titre, phrase), la ligne sous la carte et le pied.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Purement présentationnel : il ne lit aucune donnée de l'espace (on n'est pas connecté). Ses seules sources sont
 * l'horloge du poste et l'état du réseau du poste ; la pastille ne dit que ce qui est vrai sans serveur
 * (« La Garde veille · connexion chiffrée », ou « Hors connexion »). Le fond est décoratif (`aria-hidden`) : quatre
 * orbites pointillées, huit repères ANONYMES, un balayage d'un tour en 40 s ; tout s'arrête en mouvement réduit.
 */

/** Les huit repères sur l'orbite de 460 px (0° = droite, sens horaire) ; celui à -18° est « en veille ». */
export const ANGLES_REPERES = [-160, -127, -54, -18, 22, 47, 133, 160] as const;
export const REPERE_EN_VEILLE = -18;
export const RAYONS_ORBITES = [236, 340, 460, 600] as const;
const POINTILLES = ['1 6', '2 7', '2 8', '1 9'] as const;
const RAYON_REPERES = 460;

/** La place d'un repère, en px depuis le centre des orbites. Fonction pure. */
export function placeRepere(angle: number, rayon = RAYON_REPERES): { x: number; y: number } {
  const r = (angle * Math.PI) / 180;
  return { x: Math.round(Math.cos(r) * rayon * 10) / 10, y: Math.round(Math.sin(r) * rayon * 10) / 10 };
}

/** « Vendredi 30 octobre » et « 08:57 », d'après l'horloge du poste. Fonction pure. */
export function datePoste(d: Date, langue: 'fr' | 'en'): { jour: string; heure: string } {
  const locale = langue === 'fr' ? 'fr-FR' : 'en-GB';
  const jour = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const heure = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  return { jour: jour.charAt(0).toLocaleUpperCase(locale) + jour.slice(1), heure };
}

function useHorloge(fixe?: Date): Date {
  const [maintenant, setMaintenant] = useState(() => fixe ?? new Date());
  useEffect(() => {
    if (fixe) return undefined;
    const id = window.setInterval(() => setMaintenant(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, [fixe]);
  return fixe ?? maintenant;
}

function FondQuiVeille() {
  return (
    <div aria-hidden className="cx-fond">
      <div className="cx-orbites">
        <span className="cx-balayage" data-mvt="balayage" />
        <svg className="cx-orbites__svg" viewBox="-600 -600 1200 1200" width="1200" height="1200" focusable="false">
          {RAYONS_ORBITES.map((r, i) => (
            <circle key={r} cx="0" cy="0" r={r} fill="none" className="cx-orbite" strokeDasharray={POINTILLES[i]} />
          ))}
        </svg>
        {ANGLES_REPERES.map((a, i) => {
          const { x, y } = placeRepere(a);
          const veille = a === REPERE_EN_VEILLE;
          return (
            <span key={a} className="cx-repere" data-veille={veille || undefined} data-mvt="fondu" style={styleRang(i, { left: `${x}px`, top: `${y}px` })}>
              <span className="cx-repere__point" data-mvt={veille ? 'onde' : undefined} />
            </span>
          );
        })}
      </div>
      <span className="cx-vignette" />
    </div>
  );
}

export interface CadreConnexionProps {
  produit: string;
  titre: string;
  phrase?: string;
  enLigne: boolean;
  langue: 'fr' | 'en';
  /** Le formulaire (connexion, double vérification, mot de passe oublié). */
  children: React.ReactNode;
  /** La ligne sous la carte (« Pas encore de compte ? … »), selon la vue. */
  sousCarte?: React.ReactNode;
  /** Pour l'aperçu : une heure fixe. */
  maintenant?: Date;
}

export function CadreConnexion({ produit, titre, phrase, enLigne, langue, children, sousCarte, maintenant: fixe }: CadreConnexionProps) {
  const { tm } = useMots();
  const maintenant = useHorloge(fixe);
  const { jour, heure } = datePoste(maintenant, langue);
  const [aide, setAide] = useState(false);
  return (
    <>
      <FondQuiVeille />
      <header className="cx-haut">
        <div className="cx-marque">
          <span aria-hidden className="cx-marque__logo">
            A
          </span>
          <span className="cx-marque__textes">
            <span className="cx-marque__nom">{produit}</span>
            <span className="cx-marque__sous">{tm('marque.sous')}</span>
          </span>
        </div>
        <p className="cx-poste" aria-label={`${tm('poste.date')} : ${jour}, ${heure}`}>
          <Sun aria-hidden size={14} className="cx-poste__soleil" />
          <span>{jour}</span>
          <span aria-hidden className="cx-poste__sep">
            ·
          </span>
          <time className="cx-poste__heure">{heure}</time>
        </p>
      </header>

      <div className="cx-centre">
        <section className="cx-carte" data-mvt="entree" aria-labelledby="cx-titre">
          <span aria-hidden className="cx-carte__logo">
            A
          </span>
          <h1 id="cx-titre" className="cx-titre">
            {titre}
          </h1>
          {phrase && <p className="cx-phrase">{phrase}</p>}
          {children}
        </section>
        {sousCarte}
      </div>

      <footer className="cx-bas">
        <p className="cx-bas__edition">{tm('pied.edition')}</p>
        <p className="cx-etat" data-ton={enLigne ? 'ok' : 'attention'} role="status" aria-label={tm('pied.etat')}>
          {enLigne ? (
            <>
              <LiveDot ton="ok" libelle="" taille={6} />
              <span className="cx-etat__fort">{tm('pied.garde')}</span>
              <span aria-hidden className="cx-etat__sep">
                ·
              </span>
              <Lock aria-hidden size={12} />
              <span>{tm('pied.chiffre')}</span>
            </>
          ) : (
            <>
              <LiveDot ton="attention" libelle="" taille={6} onde={false} />
              <span className="cx-etat__fort">{tm('pied.horsLigne')}</span>
              <span aria-hidden className="cx-etat__sep">
                ·
              </span>
              <span>{tm('pied.horsLigne.texte')}</span>
            </>
          )}
        </p>
        <div className="cx-bas__aide">
          {aide && (
            <p className="cx-bas__aide-texte" role="status">
              {tm('pied.aide.texte')}
            </p>
          )}
          <button type="button" onClick={() => setAide((v) => !v)} aria-expanded={aide} className="cx-lien-aide cx-focus">
            <MessageSquare aria-hidden size={13} />
            <span>
              {tm('pied.aide')} {tm('pied.aide.lien')}
            </span>
          </button>
        </div>
      </footer>
    </>
  );
}
