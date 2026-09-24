import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useLangue } from '../../i18n';
import { useFermetureEchap } from '../../lib/useFermetureEchap';

/**
 * LE LEXIQUE DE LA SUPERVISION — édition interne seulement.
 *
 * Mohamed et Riyad n'ont pas compris la supervision. Pas parce qu'elle est
 * compliquée : parce qu'elle parle une langue (la Garde, la ronde, la pile,
 * la Relève, le mandat) que personne ne leur a traduite. Ce lexique la
 * traduit, mot par mot, et chaque mot mène à l'écran où l'on agit dessus —
 * l'engagement du paquet : « rien ne doit être une boîte noire qu'on ne peut
 * qu'observer ».
 *
 * Ce fichier vit sous `components/garde/` et n'est importé que par la barre
 * interne : il ne doit jamais entrer dans le paquet livré aux clientes (le
 * contrôle de pureté du bundle Business le refuserait, à raison).
 */
interface Terme {
  mot: string;
  sens: string;
  /** L'écran où l'on agit ; absent quand le mot n'a pas d'écran à lui. */
  ecran?: { label: string; to: string };
}

const FAMILLES: { titre: string; termes: Terme[] }[] = [
  {
    titre: 'La Garde — déléguer',
    termes: [
      { mot: 'La Garde', sens: 'Les équipes qui veillent côté serveur, jour et nuit, sur ce que les clientes ont confié. Elles proposent ; vous décidez.', ecran: { label: 'La Salle', to: '/garde' } },
      { mot: 'Une garde', sens: 'Une équipe de la Garde avec un chef et un périmètre (une cliente, un produit, une plage horaire).', ecran: { label: 'Les bureaux', to: '/garde/bureaux' } },
      { mot: 'La ronde', sens: 'Le passage régulier d’une garde chez une cliente : elle relit le pouls de chaque collection et remonte ce qui a changé.', ecran: { label: 'La Salle', to: '/garde' } },
      { mot: 'Une remontée', sens: 'Ce qu’une ronde a trouvé et met sous vos yeux. Une remontée n’agit pas seule : elle attend.', ecran: { label: 'À votre avis', to: '/garde/pile' } },
      { mot: 'La pile « À votre avis »', sens: 'Tout ce qui attend une décision humaine, dans l’ordre d’arrivée. Rien n’en sort sans un oui, un non ou un « plus tard ».', ecran: { label: 'À votre avis', to: '/garde/pile' } },
      { mot: 'Le mandat', sens: 'Ce que le standard (Ajmani au téléphone) a le droit de promettre. Un engagement hors mandat n’est jamais annulé en silence : la personne est rappelée.', ecran: { label: 'Ajmani', to: '/garde/ajmani' } },
      { mot: 'La Relève', sens: 'Le point du jour en Salle commune : ce que la Garde a fait, ce qu’elle fera, ce qui coince.', ecran: { label: 'Salle commune', to: '/garde/commune' } },
      { mot: 'Ajmani', sens: 'Le chef d’état-major : il parle en premier, d’une seule proposition, et répond au standard pour les clientes qui l’ont voulu.', ecran: { label: 'Ajmani', to: '/garde/ajmani' } },
      { mot: 'Le silence de nuit', sens: 'La plage où Ajmani n’appelle personne et où les remontées s’empilent pour le matin.', ecran: { label: 'Ajmani', to: '/garde/ajmani' } },
      { mot: 'Le calendrier de la Garde', sens: 'Ce que la Garde fera cette semaine, garde par garde. Vous pouvez déplacer, annuler, ajouter.', ecran: { label: 'Calendrier', to: '/garde/calendrier' } },
    ],
  },
  {
    titre: 'La Tour — décider',
    termes: [
      { mot: 'La Tour de contrôle', sens: 'Le mur d’AMN Business : toutes les clientes, ce qui attend, les demandes. C’est ici qu’on pilote à la main.', ecran: { label: 'Vue d’ensemble', to: '/tour' } },
      { mot: 'Une organisation', sens: 'Une cliente (ou AMN elle-même) : ses membres, ses modules, ses places, sa formule, ses données — étanches à toute autre.', ecran: { label: 'Organisations', to: '/tour/organisations' } },
      { mot: 'Le dossier', sens: 'Tout ce qu’on sait d’une organisation, et tout ce qu’on peut y faire : suspendre, changer de formule, ouvrir ou fermer un module, ajouter des places.', ecran: { label: 'Organisations', to: '/tour/organisations' } },
      { mot: 'Le journal d’accès', sens: 'Qui est entré chez qui, quand, et par quel chemin (mode support compris). Rien ne s’y efface.', ecran: { label: 'Journal d’accès', to: '/tour/journal' } },
      { mot: 'L’Atelier', sens: 'Créer un espace de travail sur mesure pour une nouvelle cliente : modules, Accueil, places.', ecran: { label: 'Atelier', to: '/tour/generateur' } },
    ],
  },
  {
    titre: 'Le Parc — surveiller',
    termes: [
      { mot: 'Le Parc', sens: 'Tous les sites et services des clientes que la Garde surveille : incidents, trackers, maturité, alertes à vos seuils.', ecran: { label: 'Supervision', to: '/supervision' } },
      { mot: 'Un incident', sens: 'Quelque chose qui ne va pas chez une cliente et qu’il faut traiter. Il a un état, une personne, une trace.', ecran: { label: 'Supervision', to: '/supervision' } },
      { mot: 'L’escalade', sens: 'Faire monter un incident d’une garde vers un chef, ou d’un chef vers vous. Jamais automatique sans trace.', ecran: { label: 'Salle commune', to: '/garde/commune' } },
      { mot: 'La maturité SOC', sens: 'Où en est chaque cliente, sur des signaux réels et non sur un questionnaire.', ecran: { label: 'Maturité SOC', to: '/maturite-soc' } },
    ],
  },
  {
    titre: 'Les Produits — vendre',
    termes: [
      { mot: 'Scanner', sens: 'L’analyse de vulnérabilités des sites clients.', ecran: { label: 'Scanner', to: '/scanner' } },
      { mot: 'Comply', sens: 'La conformité RGPD, cliente par cliente.', ecran: { label: 'Comply', to: '/comply' } },
      { mot: 'SSL Monitor', sens: 'Les certificats TLS et leur date de fin.', ecran: { label: 'SSL Monitor', to: '/ssl' } },
    ],
  },
];

export function LexiqueSupervision({ onFerme }: { onFerme: () => void }) {
  const { t } = useLangue();
  useFermetureEchap(true, onFerme);
  return createPortal(
    <div className="fixed inset-0 z-[280] flex items-end justify-center bg-bg/80 p-0 md:items-center md:p-6" onClick={onFerme}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lexique-titre"
        onClick={(e) => e.stopPropagation()}
        className="panel-raised flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <p className="eyebrow">{t('guide.lexique')}</p>
            <h2 id="lexique-titre" className="mt-1 text-[17px] font-semibold text-text-primary">{t('guide.lexique.titre')}</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-text-secondary">{t('guide.lexique.texte')}</p>
          </div>
          <button type="button" onClick={onFerme} aria-label={t('guide.lexique.fermer')} className="flex h-11 w-11 flex-none items-center justify-center text-text-muted hover:text-text-primary md:h-9 md:w-9">
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          {FAMILLES.map((f) => (
            <section key={f.titre} className="mb-5 last:mb-0">
              <p className="eyebrow mb-2 text-text-secondary">{f.titre}</p>
              <dl className="flex flex-col gap-2.5">
                {f.termes.map((terme) => (
                  <div key={terme.mot} className="grid gap-1 md:grid-cols-[168px_1fr] md:gap-3">
                    <dt className="text-[13px] font-semibold text-text-primary">{terme.mot}</dt>
                    <dd className="text-[12.5px] leading-relaxed text-text-body">
                      {terme.sens}
                      {terme.ecran && (
                        <>
                          {' '}
                          <Link to={terme.ecran.to} onClick={onFerme} className="whitespace-nowrap text-text-secondary underline decoration-border-strong underline-offset-2 hover:text-text-primary">
                            → {terme.ecran.label}
                          </Link>
                        </>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const EVENEMENT_LEXIQUE = 'amn:lexique';

/** L'entrée du menu « ? » : elle signale, et c'est `LexiqueHote` (monté hors du menu) qui montre. */
export function EntreeLexique() {
  const { t } = useLangue();
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => window.dispatchEvent(new Event(EVENEMENT_LEXIQUE))}
      className="flex min-h-11 w-full items-center px-3 text-left text-[13px] text-text-body hover:bg-surface-hover md:min-h-9"
    >
      {t('guide.lexique')}
    </button>
  );
}

export function LexiqueHote() {
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => {
    const ouvrir = () => setOuvert(true);
    window.addEventListener(EVENEMENT_LEXIQUE, ouvrir);
    return () => window.removeEventListener(EVENEMENT_LEXIQUE, ouvrir);
  }, []);
  return ouvert ? <LexiqueSupervision onFerme={() => setOuvert(false)} /> : null;
}
