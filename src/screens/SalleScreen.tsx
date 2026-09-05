import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MurDeControle } from '../components/MurDeControle';
import { sortirDuPleinEcran } from '../lib/memoireOnglet';

/**
 * LA SALLE DE CONTRÔLE, EN ROUTE PLEIN ÉCRAN — `#/salle`.
 *
 * Le même mur que l'écran de veille, mais qu'on OUVRE exprès : un onglet posé
 * sur un deuxième écran, la version PWA sur une tablette au mur. À la
 * différence de la veille, il ne se réveille pas au moindre geste — on est
 * venu pour le regarder — et on en sort à Échap ou d'un clic.
 *
 * C'est la déclinaison web-d'abord de la « fenêtre Electron séparée » du
 * brief : elle en livre l'essentiel (un mur autonome sur un autre écran) sans
 * attendre le travail de fenêtrage côté main process, qui reste au backlog.
 *
 * LA SORTIE NE SUPPOSE RIEN. Reculer d'une page (`navigate(-1)`) ne mène nulle
 * part quand la Salle est la première page de la fenêtre — c'est exactement ce
 * qui arrivait quand l'app se rouvrait dessus : Échap et « Quitter » ne
 * faisaient rien, et l'on restait en veille pour de bon. `sortirDuPleinEcran`
 * recule s'il y a une page derrière, et ramène au poste sinon.
 */
export function SalleScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') sortirDuPleinEcran(navigate);
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-[150]">
      <MurDeControle />
      {/*
        La sortie est VISIBLE — un bouton invisible plein écran aurait un
        anneau de focus grand comme la fenêtre, et un mur qu'on quitte au
        premier clic perdu n'est pas un mur qu'on pose sur un deuxième écran.
        Échap reste le geste rapide.
      */}
      <button
        type="button"
        onClick={() => sortirDuPleinEcran(navigate)}
        className="absolute bottom-5 right-5 border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
      >
        Quitter · Échap
      </button>
    </div>
  );
}
