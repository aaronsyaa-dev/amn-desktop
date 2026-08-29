import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudOff } from 'lucide-react';
import { useSync } from '../state/SyncContext';
import { useToast } from '../state/ToastContext';
import { motsAbandon } from '../lib/fileEnvoi';

/**
 * CE QUI N'EST PAS ENCORE PARTI — ET CE QUI NE PARTIRA JAMAIS
 * ══════════════════════════════════════════════════════════
 *
 * ## Le défaut réparé
 *
 * MESURÉ AU NAVIGATEUR, l'API répondant 503 à toute écriture : cinq
 * soumissions sur cinq — rendez-vous, tâche, client, facture, rapport — sans
 * le moindre mot. Deux fois, la fenêtre s'est même refermée, ce que tout le
 * monde lit comme « c'est enregistré ».
 *
 * `src/lib/fileEnvoi.ts` fait maintenant repartir ces écritures. Mais une file
 * qui répare l'envoi sans jamais le dire ne répare que la moitié du problème :
 * pendant une longue coupure, on doit pouvoir savoir que le travail n'est pas
 * encore parti AVANT de fermer l'application.
 *
 * ## Deux niveaux, parce que ce ne sont pas les mêmes nouvelles
 *
 * **En attente** — discret, en bas, et seulement quand il y a quelque chose.
 * Ça va repartir tout seul ; l'afficher en permanence en ferait un décor qu'on
 * apprend à ne plus voir, et le rendre alarmant ferait peur pour une coupure
 * de trente secondes.
 *
 * **Abandonné** — un toast, une fois, par entrée. C'est le seul cas où
 * quelqu'un DOIT être dérangé : la donnée est sur cet appareil et n'ira nulle
 * part. Le message le dit dans ces termes-là, et pas « erreur de
 * synchronisation ».
 *
 * ## Pourquoi ce composant, et pas une notification depuis SyncContext
 *
 * `ToastProvider` vit SOUS `SyncProvider` (voir `AppLayout` et
 * `SpaceProviders`) : le contexte de synchronisation ne peut pas appeler les
 * toasts. Il expose donc les abandons, et ce composant — monté plus bas — les
 * annonce puis les oublie.
 */
export function EnvoiEnAttente() {
  const { enAttenteEnvoi, resumeEnvoi, abandonsEnvoi, oublierAbandons } = useSync();
  const { notify } = useToast();

  /*
    `notify` et `oublierAbandons` passent par une référence : les inclure dans
    les dépendances rejouerait l'effet à chaque rendu du fournisseur de toasts,
    et la même perte serait annoncée plusieurs fois — un défaut de plus, sur un
    écran où l'on vient déjà d'apprendre une mauvaise nouvelle.
  */
  const dernier = useRef({ notify, oublierAbandons });
  dernier.current = { notify, oublierAbandons };

  useEffect(() => {
    if (abandonsEnvoi.length === 0) return;
    for (const a of abandonsEnvoi) {
      dernier.current.notify({
        title: 'Modification non enregistrée',
        body: motsAbandon(a),
        // Douze secondes : deux phrases à lire, et une mauvaise nouvelle qu'on
        // ne doit pas manquer en regardant ailleurs.
        durationMs: 12000,
      });
    }
    dernier.current.oublierAbandons();
  }, [abandonsEnvoi]);

  return (
    <AnimatePresence>
      {enAttenteEnvoi > 0 && resumeEnvoi ? (
        <motion.div
          // `polite` et non `assertive` : ça repart tout seul, ça n'a pas à
          // couper la parole à ce qu'un lecteur d'écran est en train de dire.
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none fixed bottom-4 left-1/2 z-40 -translate-x-1/2"
        >
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface/95 px-3.5 py-2 text-xs text-text-secondary shadow-lg backdrop-blur">
            <CloudOff size={14} strokeWidth={1.75} className="shrink-0 text-text-muted" />
            <span>{resumeEnvoi}</span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
