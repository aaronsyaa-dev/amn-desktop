import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Mail, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useClients } from '../state/useClients';
import { useAuth } from '../auth/AuthContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface NewsletterData {
  subject: string;
  body: string;
  sentAt: string | null;
  recipients: number;
  byEmail: string;
  createdAt: string;
}

/**
 * LA LETTRE D'INFORMATION — un mot à tous vos clients, depuis votre messagerie.
 *
 * Pour qui : une boutique qui a une nouveauté, une fermeture, une offre, et
 * des clients qui ne le sauront que si on leur dit. Ce que ça règle : un
 * objet, un texte, et la messagerie de la personne fait l'envoi, en copie
 * cachée, aux clients qui ont une adresse dans Clients. Aucun service
 * d'emailing, aucune liste exportée ailleurs : les adresses restent là où
 * elles sont, et l'envoi part du compte de la boutique — c'est aussi ce que
 * la loi attend d'une relation commerciale existante.
 */
/**
 * LA PORTÉE DES ENVOIS — l'objet dominant de la Lettre (`22b`)
 * ═══════════════════════════════════════════════════════════
 *
 * L'ARBITRAGE, ET IL EST DÉFINITIF POUR CE MODULE. Le paquet donne pour objet
 * dominant trois ONDES D'OUVERTURE superposées sur 72 h, et en tire une thèse :
 * « l'heure d'envoi décide de la hauteur de la vague, pas le contenu ». Les
 * ouvertures ne peuvent pas être mesurées ici, et ce n'est pas un manque à
 * combler : ce module n'envoie rien lui-même. Il compose le message et ouvre
 * LA MESSAGERIE de la personne, qui envoie depuis sa propre adresse. Mesurer
 * les ouvertures demanderait un pixel espion dans un courriel parti d'un compte
 * personnel — c'est-à-dire tracer ses propres clients à leur insu depuis sa
 * propre adresse. Le module a été écrit pour ne pas le faire.
 *
 * Ce qui se mesure, et qui est la vraie question du module : À COMBIEN DE GENS
 * CETTE LETTRE POUVAIT-ELLE ARRIVER. Les envois sont donc des barres
 * imbriquées sur un axe commun — le carnet d'adresses entier derrière, la
 * portée de l'envoi devant — et l'axe partagé fait que trois envois se
 * comparent d'un regard. C'est la carte « autour » du paquet promue en objet
 * dominant, faute de pouvoir dessiner celle qu'il voulait ; le reste aurait
 * été un instrument qui affiche des chiffres qu'il n'a pas.
 *
 * L'AMBRE : le dernier envoi — sa barre, son heure et sa portée. C'est le seul
 * sur lequel il reste quelque chose à décider (relancer, corriger, refaire).
 */
function PorteeDesEnvois({
  envois,
  carnet,
  sansAdresse,
}: {
  envois: (NewsletterData & { id: string })[];
  carnet: number;
  sansAdresse: number;
}) {
  const trois = envois.slice(0, 3);
  const plafond = Math.max(carnet, ...trois.map((e) => e.recipients), 1);
  return (
    <section className="panel-raised panel-raised-wide px-[30px] pb-[26px] pt-[30px]">
      <div className="mb-[26px] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <span className="eyebrow text-text-secondary">Les trois derniers envois</span>
        <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
          CARNET DE {carnet} ADRESSE{carnet > 1 ? 'S' : ''}
        </span>
      </div>

      <div className="flex flex-col gap-5">
        {trois.map((e, i) => {
          const ambre = i === 0;
          const quand = e.sentAt ? new Date(e.sentAt) : null;
          return (
            <div key={e.id} className="grid grid-cols-[1fr_96px] items-center gap-5">
              <div className="min-w-0">
                <span className="flex items-baseline justify-between gap-4">
                  <span
                    data-signal-groupe={ambre ? 'dernier-envoi' : undefined}
                    className={`min-w-0 truncate text-[14px] font-semibold ${
                      ambre ? 'text-signal' : 'text-text-primary'
                    }`}
                  >
                    {e.subject}
                  </span>
                  <span
                    data-signal-groupe={ambre ? 'dernier-envoi' : undefined}
                    className={`tnum flex-none font-mono text-[10px] tracking-[0.12em] ${
                      ambre ? 'text-signal' : 'text-text-muted'
                    }`}
                  >
                    {quand
                      ? `${quand.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} · ${quand.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                      : 'BROUILLON'}
                  </span>
                </span>
                {/* Les barres imbriquées : le carnet derrière, la portée
                    devant, sur le MÊME axe pour les trois envois. Une barre
                    remise à l'échelle de son propre envoi ne se comparerait
                    plus à celle du dessus. */}
                <span className="mt-2.5 block h-[22px] border border-border bg-sunken">
                  <span
                    className="block h-full bg-border"
                    style={{ width: `${(carnet / plafond) * 100}%` }}
                  >
                    <span
                      data-signal-groupe={ambre ? 'dernier-envoi' : undefined}
                      className={`block h-full ${ambre ? 'bg-signal' : 'bg-border-strong'}`}
                      style={{ width: carnet === 0 ? '0%' : `${(e.recipients / carnet) * 100}%` }}
                    />
                  </span>
                </span>
              </div>
              <span
                data-signal-groupe={ambre ? 'dernier-envoi' : undefined}
                className={`tnum text-right font-mono text-[17px] font-semibold tracking-[-0.03em] ${
                  ambre ? 'text-signal' : 'text-text-primary'
                }`}
              >
                {e.recipients}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border-raised pt-[22px]">
        <span>
          <span className="eyebrow block text-text-muted">Joignables</span>
          <span className="tnum mt-1.5 block font-mono text-[23px] font-semibold text-text-secondary">{carnet}</span>
        </span>
        <span className="border-l border-border-section pl-8">
          <span className="eyebrow block text-text-muted">Sans adresse</span>
          <span className="tnum mt-1.5 block font-mono text-[23px] font-semibold text-text-secondary">
            {sansAdresse}
          </span>
        </span>
      </div>

      <p className="mt-5 text-[13px] leading-[1.6] text-text-muted [text-wrap:pretty]">
        Cet écran ne compte pas les ouvertures. La lettre part de votre messagerie, sous votre
        adresse : il n’y a pas de pixel espion dedans, et il n’y en aura pas.
      </p>
    </section>
  );
}

export function NewsletterScreen() {
  const { t } = useLangue();
  const { user } = useAuth();
  const { upsert, remove } = useSync();
  const { clients } = useClients();
  const brutes = useCollection<NewsletterData>('newsletters');
  const [ouvert, setOuvert] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copie, setCopie] = useState(false);

  const adresses = useMemo(() => [...new Set(clients.map((c) => c.email.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))], [clients]);
  const lettres = useMemo(() => [...brutes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [brutes]);
  const envoyees = lettres.filter((l) => l.sentAt);

  const creer = async () => {
    if (!subject.trim()) return;
    await upsert('newsletters', uid('nws'), { subject: subject.trim(), body: body.trim(), sentAt: null, recipients: 0, byEmail: user?.email ?? '', createdAt: new Date().toISOString() });
    setSubject(''); setBody(''); setOuvert(false);
  };
  const lienMessagerie = (l: NewsletterData) => `mailto:?bcc=${encodeURIComponent(adresses.join(','))}&subject=${encodeURIComponent(l.subject)}&body=${encodeURIComponent(l.body)}`;
  const marquer = (l: NewsletterData & { id: string }) => upsert('newsletters', l.id, { ...l, sentAt: new Date().toISOString(), recipients: adresses.length });
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(adresses.join(', '));
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      /* presse-papiers refusé : les adresses restent dans Clients */
    }
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('pilotage.surtitre', { module: t('lettre.titre') })}
          title={t('lettre.titre')}
          description={t('lettre.description')}
          stats={[
            { label: t('lettre.stat.destinataires'), value: adresses.length },
            { label: t('lettre.stat.envoyees'), value: envoyees.length },
            { label: t('lettre.stat.derniere'), value: envoyees[0]?.sentAt ? relativeTime(envoyees[0].sentAt) : '—' },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('lettre.nouvelle')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void creer(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('lettre.champObjet')} aria-label={t('lettre.champObjet')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder={t('lettre.champTexte')} aria-label={t('lettre.champTexte')} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none" />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!subject.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('lettre.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {/* ── L'OBJET DOMINANT : la portée des envois ────────────────────── */}
      {envoyees.length > 0 && (
        <motion.div variants={staggerItem}>
          <PorteeDesEnvois
            envois={envoyees}
            carnet={adresses.length}
            sansAdresse={Math.max(0, clients.length - adresses.length)}
          />
        </motion.div>
      )}

      {adresses.length === 0 && <motion.p variants={staggerItem} className="rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm text-text-secondary">{t('lettre.sansDestinataire')}</motion.p>}

      {lettres.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('lettre.vide.titre')} action={{ label: t('lettre.vide.action'), onClick: () => setOuvert(true) }}>{t('lettre.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.ul variants={staggerItem} className="flex flex-col gap-3">
          {lettres.map((l) => (
            <li key={l.id} className={`group rounded-xl border bg-surface p-4 ${l.sentAt ? 'border-success/30' : 'border-border'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{l.subject}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{l.sentAt ? t('lettre.envoyee', { quand: relativeTime(l.sentAt), n: l.recipients }) : t('lettre.brouillon')}</p>
                </div>
                <button type="button" onClick={() => void remove('newsletters', l.id)} aria-label={t('lettre.supprimer')} title={t('lettre.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
              </div>
              {l.body && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">{l.body}</p>}
              {!l.sentAt && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={adresses.length ? lienMessagerie(l) : undefined} aria-disabled={adresses.length === 0} className={`flex min-h-11 items-center gap-2 bg-accent px-3 text-xs font-semibold text-bg md:min-h-0 md:py-1.5 ${adresses.length === 0 ? 'pointer-events-none opacity-40' : ''}`}><Mail size={13} /> {t('lettre.ouvrirMessagerie')}</a>
                  <button type="button" onClick={() => void copier()} disabled={adresses.length === 0} className="flex min-h-11 items-center gap-2 border border-border px-3 text-xs text-text-secondary hover:text-text-primary disabled:opacity-40 md:min-h-0 md:py-1.5">{copie ? <Check size={13} /> : <Copy size={13} />} {copie ? t('lettre.copiees') : t('lettre.copierAdresses')}</button>
                  <button type="button" onClick={() => void marquer(l)} disabled={adresses.length === 0} className="flex min-h-11 items-center gap-2 border border-border-strong px-3 text-xs text-text-primary hover:bg-surface-hover disabled:opacity-40 md:min-h-0 md:py-1.5"><Check size={13} /> {t('lettre.marquerEnvoyee')}</button>
                </div>
              )}
            </li>
          ))}
        </motion.ul>
      )}
    </motion.section>
  );
}
