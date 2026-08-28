import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, ExternalLink, Globe } from 'lucide-react';
import { bridge } from '../../lib/bridge';
import { cleanErrorMessage } from '../../lib/errorMessage';
import { useOrgSites } from './useOrgSites';
import type { OrgOverview, SiteStatusPage } from '../../shared/api';

/**
 * LA PAGE DE STATUT PUBLIQUE D'UN SITE (BLOC 30)
 * ══════════════════════════════════════════════
 *
 * Le badge dit « ce site est supervisé ». Cette page-ci répond à une question
 * que la cliente reçoit vraiment, et à laquelle elle n'avait rien à répondre :
 * « votre site est en panne ? ». Elle donne un lien, et la question s'arrête
 * là — c'est aussi la seule chose que nous produisons qui soit lue par des
 * gens qui ne sont pas nos clients.
 *
 * ## Publier est une décision, pas une lecture
 *
 * Le badge naît d'un GET : il ne rend qu'un nom et un score, on peut se
 * permettre de le générer en le regardant. Celle-ci ouvre une adresse
 * publique sur l'historique d'un site. Elle demande donc un geste explicite,
 * elle se retire, et les deux gestes laissent une trace au journal d'accès.
 *
 * ## Ce que l'écran DIT de ce qui est publié
 *
 * Le paragraphe sous le titre n'est pas un ornement. C'est l'opératrice qui
 * envoie le lien à la cliente, et elle doit pouvoir répondre sans nous
 * demander à quoi ce lien donne accès. Le dire ici, c'est éviter qu'elle le
 * devine — et une supposition prudente vaut souvent « je préfère ne pas
 * l'envoyer ».
 */
/** Rendu par la Tour de contrôle, qui ne lui passe rien : il lit les sites lui-même. */
export function SiteStatusPageExport() {
  return <StatusPageExport sites={useOrgSites()} />;
}

export function StatusPageExport({ sites }: { sites: OrgOverview['sites'] }) {
  const [siteId, setSiteId] = useState('');
  const [etat, setEtat] = useState<SiteStatusPage | null>(null);
  const [chargement, setChargement] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const [confirmeRetrait, setConfirmeRetrait] = useState(false);

  useEffect(() => {
    if (!siteId) {
      setEtat(null);
      return;
    }
    let actif = true;
    setChargement(true);
    setEtat(null);
    setErreur(null);
    setConfirmeRetrait(false);
    bridge()
      .remote.getSiteStatusPage(siteId)
      .then((r) => {
        if (actif) setEtat(r);
      })
      .catch((err) => {
        if (actif) setErreur(cleanErrorMessage(err));
      })
      .finally(() => {
        if (actif) setChargement(false);
      });
    return () => {
      actif = false;
    };
  }, [siteId]);

  const agir = useCallback(
    async (quoi: 'publier' | 'retirer') => {
      if (!siteId) return;
      setEnCours(true);
      setErreur(null);
      try {
        const r =
          quoi === 'publier'
            ? await bridge().remote.publishSiteStatusPage(siteId)
            : await bridge().remote.revokeSiteStatusPage(siteId);
        setEtat(r);
        setConfirmeRetrait(false);
      } catch (err) {
        setErreur(cleanErrorMessage(err));
      } finally {
        setEnCours(false);
      }
    },
    [siteId],
  );

  const copier = async () => {
    if (!etat?.url) return;
    // On efface d'abord : un échec précédent ne doit pas cohabiter avec un
    // « Copié » et dire deux choses opposées à l'opératrice.
    setErreur(null);
    try {
      await navigator.clipboard.writeText(etat.url);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      setErreur('Copie impossible — sélectionnez l’adresse et copiez-la manuellement.');
    }
  };

  return (
    <section className="elev-1 rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Globe size={15} strokeWidth={1.75} className="text-text-secondary" />
        <h3 className="mr-auto text-sm font-semibold text-text-primary">Page de statut publique</h3>
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          aria-label="Site de la page de statut"
          className="input-focus rounded-lg border border-border bg-bg px-2 py-1.5 text-xs text-text-secondary"
        >
          <option value="">Choisir un site…</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-text-secondary">
        L’adresse à donner aux clients de la cliente quand ils demandent si le site est en panne.
        Elle ne montre que la joignabilité — l’état du moment, les quatre-vingt-dix derniers jours,
        et les journées interrompues. <strong className="font-medium text-text-primary">Aucune
        alerte de sécurité n’y figure</strong> : ni adresse IP, ni nature d’attaque, ni score.
      </p>

      {chargement && <p className="mt-3 text-sm text-text-muted">Lecture…</p>}
      {erreur && <p className="mt-3 text-sm text-danger">{erreur}</p>}

      <AnimatePresence mode="wait">
        {etat && !etat.published && (
          <motion.div
            key="a-publier"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-4"
          >
            <button
              type="button"
              onClick={() => void agir('publier')}
              disabled={enCours}
              className="rounded-lg bg-accent px-3 py-2 text-[12px] font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {enCours ? 'Publication…' : 'Publier la page'}
            </button>
            <p className="mt-2 text-[11px] text-text-muted">
              L’adresse sera lisible par quiconque la possède, sans mot de passe. Elle se retire à
              tout moment.
            </p>
          </motion.div>
        )}

        {etat?.published && etat.url && (
          <motion.div
            key="publiee"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-4 flex flex-col gap-3"
          >
            <div className="flex items-center gap-2 rounded-xl border border-border bg-bg p-2.5">
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[11px] text-text-secondary">
                {etat.url}
              </code>
              <button
                type="button"
                onClick={() => void copier()}
                aria-label="Copier l’adresse"
                className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-[10px] uppercase tracking-widest text-text-secondary transition-colors hover:text-text-primary"
              >
                {copie ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={2} />}
                {copie ? 'Copié' : 'Copier'}
              </button>
              <a
                href={etat.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ouvrir la page"
                className="flex-shrink-0 rounded-lg border border-border p-1.5 text-text-secondary transition-colors hover:text-text-primary"
              >
                <ExternalLink size={12} strokeWidth={2} />
              </a>
            </div>

            {/*
              Le retrait DEMANDE une confirmation, contrairement aux gestes du
              bureau de supervision qui n'en demandent aucune.

              Acquitter un incident se refait d'un clic ; retirer cette page
              casse un lien que des clients ont peut-être déjà en favori, et
              republier n'en rend pas la même adresse. C'est le genre de geste
              qu'on ne veut pas avoir fait en visant le bouton d'à côté.
            */}
            {confirmeRetrait ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-text-secondary">
                  L’adresse cessera de répondre. Un lien déjà envoyé ne fonctionnera plus, et
                  republier en donnera une autre.
                </span>
                <button
                  type="button"
                  onClick={() => void agir('retirer')}
                  disabled={enCours}
                  className="rounded-lg border border-danger/50 px-2.5 py-1.5 text-[11px] font-semibold text-danger transition-colors hover:bg-danger-muted disabled:opacity-50"
                >
                  {enCours ? 'Retrait…' : 'Retirer quand même'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmeRetrait(false)}
                  className="rounded-lg px-2.5 py-1.5 text-[11px] text-text-muted transition-colors hover:text-text-primary"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmeRetrait(true)}
                className="self-start text-[11px] text-text-muted underline-offset-4 transition-colors hover:text-text-secondary hover:underline"
              >
                Retirer la page
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
