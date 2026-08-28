import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellOff, RotateCcw, X } from 'lucide-react';
import { bridge } from '../../lib/bridge';
import { cleanErrorMessage } from '../../lib/errorMessage';
import { futureTime } from '../../lib/time';
import type { AlertSuppression } from '../../shared/api';

/**
 * CE QUI EST ACTUELLEMENT TU
 * ══════════════════════════
 *
 * Le pendant obligatoire de l'étouffoir. Pouvoir faire taire une détection
 * sans pouvoir consulter ce qu'on a fait taire est le meilleur moyen de se
 * retrouver, dans six mois, avec une supervision silencieuse dont personne ne
 * sait plus pourquoi.
 *
 * ## Le chiffre qui compte n'est pas la règle, c'est ce qu'elle a mangé
 *
 * Chaque ligne dit combien d'alertes elle a réellement absorbées. C'est la
 * seule mesure qui permette de juger un étouffoir autrement que sur
 * l'intention de qui l'a posé :
 *
 *   - **zéro en trente jours** : la règle n'avait pas lieu d'être, et son
 *     auteur s'est probablement trompé de diagnostic ;
 *   - **deux mille** : elle cachait peut-être autre chose que ce qu'on croyait,
 *     et il vaut mieux aller regarder.
 *
 * ## La note est affichée, pas rangée
 *
 * Elle est obligatoire à la création — c'est le seul moment où l'on sait
 * pourquoi. La ranger derrière un clic reviendrait à ne pas l'avoir demandée :
 * personne ne déplie douze règles pour retrouver celle qui pose problème.
 */
export function SuppressionsPanel() {
  const [regles, setRegles] = useState<AlertSuppression[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      setRegles(await bridge().remote.listSuppressions());
      setErreur(null);
    } catch (err) {
      setRegles([]);
      setErreur(cleanErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const rendreLaParole = async (id: string) => {
    setEnCours(id);
    setErreur(null);
    try {
      await bridge().remote.revokeSuppression(id);
      // On relit plutôt que de retirer la ligne localement : la liste porte
      // des décomptes que seul le serveur sait tenir à jour.
      await charger();
    } catch (err) {
      setErreur(cleanErrorMessage(err));
    } finally {
      setEnCours(null);
    }
  };

  /*
    Rien de tu ? Le panneau DISPARAÎT.

    Une section « aucune règle » permanente sur le bureau de supervision
    occuperait de la place pour ne rien dire, tous les jours, pour l'exception.
    Il réapparaît dès qu'il y a quelque chose à montrer.
  */
  if (regles !== null && regles.length === 0 && !erreur) return null;

  return (
    <section className="elev-1 rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <BellOff size={15} strokeWidth={1.75} className="text-text-secondary" />
        <h3 className="mr-auto text-sm font-semibold text-text-primary">Mis en sourdine</h3>
        <button
          type="button"
          onClick={() => void charger()}
          aria-label="Relire"
          className="rounded-lg p-1.5 text-text-muted transition-colors hover:text-text-primary"
        >
          <RotateCcw size={13} strokeWidth={1.75} />
        </button>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-text-secondary">
        Ces détections ne remontent plus dans la file et ne réveillent personne. Tout reste
        enregistré : le décompte dit ce que chaque règle a réellement absorbé.
      </p>

      {erreur && <p className="mt-3 text-sm text-danger">{erreur}</p>}
      {regles === null && <p className="mt-3 text-sm text-text-muted">Lecture…</p>}

      <ul className="mt-3 flex flex-col">
        <AnimatePresence initial={false}>
          {(regles ?? []).map((r) => (
            <motion.li
              key={r.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-b border-border last:border-b-0"
            >
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-text-primary">
                    <span className="font-medium">{r.libelle}</span>
                    <span className="text-text-muted"> depuis </span>
                    <span className="font-mono text-[12px]">{r.actor}</span>
                    {r.siteName && <span className="text-text-muted"> · {r.siteName}</span>}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary">{r.note}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    {/*
                      « rien absorbé » se dit franchement. Une règle qui n'a rien
                      mangé n'avait pas lieu d'être, et c'est utile à savoir
                      avant de la reconduire.
                    */}
                    {r.absorbe.alertes === 0
                      ? 'rien absorbé'
                      : `${r.absorbe.alertes} alerte${r.absorbe.alertes > 1 ? 's' : ''} absorbée${r.absorbe.alertes > 1 ? 's' : ''}`}
                    {/*
                      `futureTime`, PAS `relativeTime` : la seconde ne sait
                      parler que du passé, et rendait « expire à l'instant »
                      pour une règle qui avait trente jours devant elle. On
                      relance alors une règle qu'on croyait sur le point de
                      lapser — l'inverse de ce que la ligne devait dire.
                    */}
                    {' · expire '}
                    {futureTime(r.expiresAt)}
                    {r.createdBy ? ` · posé par ${r.createdBy}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void rendreLaParole(r.id)}
                  disabled={enCours === r.id}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
                >
                  <X size={12} strokeWidth={2} />
                  {enCours === r.id ? 'Levée…' : 'Rendre la parole'}
                </button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
