import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLangue } from '../i18n';
import { Logo } from '../components/Logo';
import { EDITION_PRODUCT_NAME } from '../edition/edition';
import { IllustrationCeQuiCompte, IllustrationFamilles, IllustrationVosDonnees } from './illustrations/Illustrations';

/**
 * LA PRÉSENTATION DE PREMIÈRE CONNEXION — édition cliente, cahier 43f.
 *
 * Trois pages, puis la porte « Qui êtes-vous ? » dans la même feuille. La
 * visite guidée montre déjà où sont les choses ; la présentation dit ce
 * qu'est le produit, en trois idées, et apprend la seule convention à
 * connaître avant d'entrer : l'ambre.
 *
 * Une fois par compte et par poste, avant la porte (PremierLancement). La
 * feuille est celle de `QuiEtesVous` : 720 px, posée sur le fond assombri.
 * L'ambre de chaque page est dans son illustration ; la progression et les
 * boutons restent à l'encre.
 *
 * Commandes : « Suivant » avance, « Passer » ouvre la porte ; → avance,
 * ← revient, Échap passe ; un clic dans la moitié droite de la feuille avance.
 */
const PAGES = [
  { cle: '1', Illustration: IllustrationFamilles },
  { cle: '2', Illustration: IllustrationCeQuiCompte },
  { cle: '3', Illustration: IllustrationVosDonnees },
] as const;

export function EnTeteFeuille() {
  return (
    <div className="flex items-center gap-2">
      <Logo height={14} />
      <span className="text-[13px] text-text-muted">{EDITION_PRODUCT_NAME.replace(/^AMN\s+/, '')}</span>
    </div>
  );
}

export function CadreIllustration({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 border border-border bg-sunken">{children}</div>;
}

/*
  Le serveur ne garde pas de nom : le prénom vient de l'adresse
  (`nameFromEmail`). Une adresse de boîte partagée — contact@, bonjour@ — ou
  avec des chiffres ne dit pas un prénom ; on salue alors sans prénom plutôt
  que « Bienvenue, Contact ».
*/
const PAS_UN_PRENOM = /^(contact|bonjour|hello|hi|info|infos|admin|accueil|compta|comptabilite|facturation|direction|gestion|equipe|team|office|secretariat|support|mail|noreply|no)$/i;

function prenomAffichable(prenom: string): string {
  const p = prenom.trim();
  return !p || /\d/.test(p) || PAS_UN_PRENOM.test(p) ? '' : p;
}

export function PresentationArrivee({ prenom: prenomBrut, onFin }: { prenom: string; onFin: () => void }) {
  const prenom = prenomAffichable(prenomBrut);
  const { t } = useLangue();
  const [page, setPage] = useState(0);
  const derniere = page === PAGES.length - 1;
  const suivant = useCallback(() => (derniere ? onFin() : setPage((p) => p + 1)), [derniere, onFin]);
  const precedent = useCallback(() => setPage((p) => Math.max(0, p - 1)), []);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); suivant(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); precedent(); }
      else if (e.key === 'Escape') { e.preventDefault(); onFin(); }
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [suivant, precedent, onFin]);

  const { cle, Illustration } = PAGES[page];
  const numero = `${page + 1} / ${PAGES.length}`;
  const surtitre = page === 0 && prenom ? `${t('guide.presentation.bienvenue', { prenom })} · ${numero}` : numero;

  return createPortal(
    <div className="fixed inset-0 z-[290] flex items-center justify-center overflow-y-auto bg-bg/90 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t(`guide.presentation.${cle}.titre`)} data-presentation-arrivee={cle}>
      <div
        className="w-full max-w-[720px] border border-border-sheet bg-elevated px-6 pb-6 pt-[30px] shadow-[0_34px_62px_-28px_rgba(0,0,0,1)] sm:px-9"
        onClick={(e) => {
          // Un clic dans la moitié droite avance — jamais sur un bouton, qui a son propre geste.
          if ((e.target as HTMLElement).closest('button')) return;
          const r = e.currentTarget.getBoundingClientRect();
          if (e.clientX > r.left + r.width / 2) suivant();
        }}
      >
        <EnTeteFeuille />
        <CadreIllustration>
          <Illustration key={cle} />
        </CadreIllustration>
        <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">{surtitre}</p>
        <h1 className="mt-2.5 text-[26px] font-bold leading-[1.1] tracking-[-0.03em] text-text-primary sm:text-[30px]">{t(`guide.presentation.${cle}.titre`)}</h1>
        <p className="mt-3 max-w-[60ch] text-[14.5px] leading-[1.65] text-text-secondary [text-wrap:pretty]">{t(`guide.presentation.${cle}.texte`)}</p>
        <div className="mt-7 flex items-center gap-4 border-t border-border pt-5">
          <div className="flex gap-1.5" aria-label={numero} role="img">
            {PAGES.map((p, i) => (
              <span key={p.cle} className={`h-[3px] w-7 ${i < page ? 'bg-border-strong' : i === page ? 'bg-text-primary' : 'bg-border-section'}`} />
            ))}
          </div>
          <button type="button" onClick={onFin} className="ml-auto min-h-11 px-2 text-[13px] text-text-muted hover:text-text-primary md:min-h-9">
            {t('guide.presentation.passer')}
          </button>
          <button type="button" onClick={suivant} autoFocus className="min-h-11 bg-text-primary px-4 text-[13.5px] font-semibold text-[#0a0a0a] hover:bg-white md:min-h-10" data-presentation-suivant>
            {derniere ? t('guide.presentation.derniereQuestion') : t('guide.presentation.suivant')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
