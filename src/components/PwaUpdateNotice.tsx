import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';

/**
 * « UNE NOUVELLE VERSION EST PRÊTE » — sur la PWA (BLOC 4)
 * ═══════════════════════════════════════════════════════
 *
 * Le poste de bureau avait `UpdateReady`, branché sur l'auto-updater
 * d'Electron. La PWA n'avait RIEN : le service worker se mettait à jour en
 * silence et la page continuait de faire tourner l'ancien JavaScript. Une
 * cliente sur téléphone gardait donc l'ancienne version des jours durant —
 * sans message, et sans geste possible autre que fermer complètement
 * l'application, ce que personne ne fait.
 *
 * ## Le motif, et pourquoi cet ordre
 *
 * Le worker s'installe et ATTEND (v5 de `public/sw.js` : plus de
 * `skipWaiting()` à l'installation). Cette bannière le voit attendre, propose,
 * et sur acceptation lui envoie `SKIP_WAITING`. Il prend alors la main,
 * `controllerchange` se déclenche, et c'est SEULEMENT là qu'on recharge.
 *
 * Recharger après la prise de contrôle garantit que le JavaScript rechargé et
 * le worker qui le sert viennent du même build. L'inverse — recharger tout de
 * suite — laisse une fenêtre où l'ancien worker sert encore les anciens
 * fichiers, et la page « neuve » repart sur l'ancienne version.
 *
 * ## Trois refus délibérés
 *
 * **On ne recharge jamais tout seul.** Quelqu'un est peut-être en train
 * d'écrire une note ou de remplir une facture : lui reprendre l'écran sans
 * prévenir est le genre de geste qu'on ne pardonne pas à un outil de travail.
 *
 * **On ne propose pas à la PREMIÈRE installation.** Sans
 * `navigator.serviceWorker.controller`, aucun worker ne contrôlait la page
 * auparavant : il n'y a pas d'« ancienne version » à remplacer, et annoncer
 * une mise à jour à quelqu'un qui vient d'arriver n'aurait aucun sens.
 *
 * **On ne recharge qu'UNE fois.** `controllerchange` peut se déclencher plus
 * d'une fois ; sans ce garde, la page entrerait dans une boucle de
 * rechargement — le pire défaut possible pour un correctif de mise à jour.
 */
export function PwaUpdateNotice() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [installing, setInstalling] = useState(false);
  const [ecarte, setEcarte] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let annule = false;
    let rechargeEnCours = false;
    /*
      La minuterie est déclarée ICI et non dans le `.then()`.

      Premier jet : `const minuterie = …; return () => clearInterval(minuterie)`
      à l'intérieur du `.then()`. Ce `return` alimente la promesse, pas React —
      l'intervalle survivait donc au démontage, et chaque montage en ajoutait
      un. Invisible en usage normal, franchement visible sur une PWA laissée
      ouverte une semaine.
    */
    let minuterie = 0;

    /*
      Un worker en attente ne compte que s'il en REMPLACE un autre. À la
      toute première visite, `controller` est nul : le worker qui s'installe
      est le premier, il n'y a rien à annoncer.
    */
    const proposer = (sw: ServiceWorker | null) => {
      if (annule || !sw) return;
      if (!navigator.serviceWorker.controller) return;
      setWaiting(sw);
    };

    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (!reg || annule) return;

        // Déjà en attente au chargement de la page : le cas le plus courant,
        // quand la mise à jour a été téléchargée pendant une session passée.
        proposer(reg.waiting);

        // Et celui qui arrive pendant qu'on travaille.
        reg.addEventListener('updatefound', () => {
          const nouveau = reg.installing;
          if (!nouveau) return;
          nouveau.addEventListener('statechange', () => {
            if (nouveau.state === 'installed') proposer(reg.waiting ?? nouveau);
          });
        });

        /*
          Une vérification à l'ouverture, puis toutes les heures.

          Le navigateur en fait déjà à sa façon, mais rien ne garantit qu'il le
          fasse sur une PWA restée ouverte plusieurs jours — et c'est
          exactement le cas qu'on veut couvrir.
        */
        void reg.update().catch(() => undefined);
        minuterie = window.setInterval(
          () => {
            if (!document.hidden) void reg.update().catch(() => undefined);
          },
          60 * 60 * 1000,
        );
      })
      .catch(() => undefined);

    const surChangement = () => {
      if (rechargeEnCours) return;
      rechargeEnCours = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', surChangement);

    return () => {
      annule = true;
      if (minuterie) window.clearInterval(minuterie);
      navigator.serviceWorker.removeEventListener('controllerchange', surChangement);
    };
  }, []);

  const installer = () => {
    if (!waiting) return;
    setInstalling(true);
    waiting.postMessage({ type: 'SKIP_WAITING' });
    // Le rechargement viendra de `controllerchange`, pas d'ici : c'est la
    // prise de contrôle qui autorise le rechargement, pas le clic.
  };

  return (
    <AnimatePresence>
      {waiting && !ecarte && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2 }}
          role="status"
          className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-border-strong bg-surface p-3 elev-2 sm:inset-x-auto sm:right-4 sm:bottom-4"
        >
          <RefreshCw
            size={16}
            strokeWidth={1.75}
            className={`flex-shrink-0 text-text-secondary ${installing ? 'animate-spin' : ''}`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-text-primary">Une nouvelle version est prête.</p>
            <p className="text-[12px] leading-relaxed text-text-secondary">
              {installing
                ? 'Installation…'
                : 'Le rechargement prend une seconde et ne perd rien de ce qui est enregistré.'}
            </p>
          </div>
          <button
            type="button"
            onClick={installer}
            disabled={installing}
            className="flex-shrink-0 rounded-lg bg-accent px-3 py-2 text-[12px] font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            Recharger
          </button>
          {/*
            « Plus tard » est possible, et il n'est pas définitif : la bannière
            revient au prochain chargement tant que la version attend. Une mise
            à jour qu'on peut refuser POUR TOUJOURS est une version qu'on ne
            corrigera jamais.
          */}
          <button
            type="button"
            onClick={() => setEcarte(true)}
            aria-label="Plus tard"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
