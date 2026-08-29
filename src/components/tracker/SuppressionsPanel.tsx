import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellOff, ChevronDown, ChevronRight, RotateCcw, X } from 'lucide-react';
import { bridge } from '../../lib/bridge';
import { cleanErrorMessage } from '../../lib/errorMessage';
import { futureTime, relativeTime } from '../../lib/time';
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
 *
 * ## Ce qui a été LEVÉ compte autant que ce qui est tu
 *
 * Le serveur enregistre depuis le premier jour qui a rendu la parole et quand
 * (`revoked_by`, `revoked_at`) ; rien ne le lisait. Une supervision où l'on
 * sait qui a fait taire une détection mais pas qui l'a réveillée n'a qu'une
 * moitié de piste — et c'est justement la levée qui explique pourquoi une
 * alerte réapparaît un matin sans que rien n'ait changé chez la cliente.
 *
 * L'historique est REPLIÉ, pas absent : il grossit sans fin, et ce qui presse
 * est ce qui est tu MAINTENANT. Mais il reste à un clic, et le panneau ne
 * disparaît plus dès que la dernière règle active est levée — sans quoi le
 * geste de lever effacerait l'accès à sa propre trace.
 */
export function SuppressionsPanel() {
  const [regles, setRegles] = useState<AlertSuppression[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [historique, setHistorique] = useState(false);

  /*
    UN SEUL APPEL, avec l'historique : le serveur marque déjà chaque règle
    `actif` ou non. Deux appels — un pour les actives, un pour tout — feraient
    deux vérités à tenir d'accord et un décompte qui clignote pendant que la
    seconde réponse arrive.
  */
  const charger = useCallback(async () => {
    try {
      setRegles(await bridge().remote.listSuppressions(true));
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

  const actives = (regles ?? []).filter((r) => r.actif);
  const revolues = (regles ?? []).filter((r) => !r.actif);

  /*
    Rien de tu, JAMAIS ? Le panneau DISPARAÎT.

    Une section « aucune règle » permanente sur le bureau de supervision
    occuperait de la place pour ne rien dire, tous les jours, pour l'exception.
    Il réapparaît dès qu'il y a quelque chose à montrer.

    « Jamais » et non « en ce moment », depuis que l'historique existe : lever
    la dernière règle active faisait disparaître le panneau, donc l'accès à la
    trace de ce qu'on venait de lever. Le geste effaçait sa propre preuve.
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
        {actives.length === 0
          ? 'Plus rien n’est en sourdine : toutes les détections remontent. L’historique ci-dessous dit ce qui l’a été, et qui a rendu la parole.'
          : 'Ces détections ne remontent plus dans la file et ne réveillent personne. Tout reste enregistré : le décompte dit ce que chaque règle a réellement absorbé.'}
      </p>

      {erreur && <p className="mt-3 text-sm text-danger">{erreur}</p>}
      {regles === null && <p className="mt-3 text-sm text-text-muted">Lecture…</p>}

      <ul className="mt-3 flex flex-col">
        <AnimatePresence initial={false}>
          {actives.map((r) => (
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

      {revolues.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setHistorique((v) => !v)}
            aria-expanded={historique}
            className="-my-2 flex w-full items-center gap-2 py-2 text-left text-[11px] font-medium text-text-muted transition-colors hover:text-text-secondary"
          >
            {historique ? (
              <ChevronDown size={13} strokeWidth={1.75} />
            ) : (
              <ChevronRight size={13} strokeWidth={1.75} />
            )}
            {revolues.length} règle{revolues.length > 1 ? 's' : ''} levée
            {revolues.length > 1 ? 's' : ''} ou expirée{revolues.length > 1 ? 's' : ''}
          </button>

          <AnimatePresence initial={false}>
            {historique && (
              <motion.ul
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                {revolues.map((r) => (
                  <li key={r.id} className="border-b border-border/60 py-2.5 last:border-b-0">
                    <p className="text-[12px] text-text-secondary">
                      <span className="font-medium">{r.libelle}</span>
                      <span className="text-text-muted"> depuis </span>
                      <span className="font-mono text-[11px]">{r.actor}</span>
                      {r.siteName && <span className="text-text-muted"> · {r.siteName}</span>}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted">{r.note}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {/*
                        LEVÉE ou EXPIRÉE : les deux fins ne se valent pas.

                        Une règle levée l'a été par quelqu'un, qui a jugé qu'on
                        pouvait réécouter — c'est une décision, et elle porte un
                        nom. Une règle expirée s'est éteinte toute seule au bout
                        de trente jours, et personne n'a rien décidé. Les
                        confondre ferait croire à un arbitrage là où il n'y a eu
                        que le calendrier.
                      */}
                      {r.revokedAt
                        ? `levée ${relativeTime(r.revokedAt)}${r.revokedBy ? ` par ${r.revokedBy}` : ''}`
                        : `expirée ${relativeTime(r.expiresAt)}`}
                      {' · '}
                      {r.absorbe.alertes === 0
                        ? 'rien absorbé'
                        : `${r.absorbe.alertes} alerte${r.absorbe.alertes > 1 ? 's' : ''} absorbée${r.absorbe.alertes > 1 ? 's' : ''}`}
                      {r.createdBy ? ` · posée par ${r.createdBy}` : ''}
                    </p>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
