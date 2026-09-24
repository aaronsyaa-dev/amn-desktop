import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flag, Send } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../auth/AuthContext';
import { isAdminRole } from '../auth/roles';
import { useLangue } from '../i18n';
import { relativeTime } from '../lib/time';
import { cleanErrorMessage } from '../lib/errorMessage';
import { useHall } from './useHall';

/**
 * LE HALL — l'écran. Un objet dominant selon l'état :
 *
 *   · pas encore rejoint : LA PORTE — ce qui se partage, ce qui ne se
 *     partage jamais, le nom sous lequel on apparaît, et le geste (réservé
 *     à qui peut engager l'organisation ; le serveur tranche aussi) ;
 *   · rejoint : LA CONVERSATION — les messages des organisations qui
 *     participent, rendus comme TEXTE (React échappe ; aucun HTML n'est
 *     interprété, ni lien cliquable, ni image), et le composeur.
 *
 * Aucun ambre : rien ici n'attend une action de la personne.
 */
const BODY_MAX = 600;

export function HallScreen() {
  const { t } = useLangue();
  const { user, org, role } = useAuth();
  const { etat, messages, erreur, chargement, participer, envoyer, signaler } = useHall();
  const peutEngager = isAdminRole(role);
  const peutEcrire = isAdminRole(role) || role === 'member';
  const [nom, setNom] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [texte, setTexte] = useState('');
  const [signature, setSignature] = useState(() => user?.name?.split(' ')[0] ?? '');
  const [signales, setSignales] = useState<Set<string>>(new Set());
  const bas = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!nom && org?.name) setNom(org.name);
  }, [org?.name, nom]);

  useEffect(() => {
    bas.current?.scrollIntoView({ block: 'end' });
  }, [messages?.length]);

  const participants = etat?.participants ?? 0;
  const ligneParticipants =
    participants === 0 ? t('hall.participants.aucun') : participants === 1 ? t('hall.participants.une') : t('hall.participants.n', { n: String(participants) });
  const dedans = Boolean(etat?.participation?.participe);

  const geste = async (participe: boolean) => {
    setOccupe(true);
    setRefus(null);
    try {
      await participer({ participe, displayName: nom.trim() || undefined });
    } catch (err) {
      setRefus(cleanErrorMessage(err));
    } finally {
      setOccupe(false);
    }
  };

  const poster = async () => {
    const body = texte.trim();
    if (!body || body.length > BODY_MAX) return;
    setOccupe(true);
    setRefus(null);
    try {
      await envoyer({ body, signature: signature.trim() || undefined });
      setTexte('');
    } catch (err) {
      setRefus(cleanErrorMessage(err));
    } finally {
      setOccupe(false);
    }
  };

  const stats = useMemo(
    () => [
      { label: 'Organisations', value: chargement ? '…' : participants },
      { label: 'Messages', value: messages ? messages.length : '—' },
    ],
    [chargement, participants, messages],
  );

  return (
    <section className="flex flex-col">
      <ScreenHeader eyebrow={t('hall.eyebrow')} title={t('hall.titre')} description={t('hall.description')} stats={stats} />

      {erreur && !etat && (
        <p className="panel mt-6 p-4 text-[13px] text-text-secondary">{t('hall.sansLien')}</p>
      )}

      {etat && !dedans && (
        <div className="panel-raised mt-6 p-5 sm:p-6" data-guide="dominante">
          <p className="text-[14.5px] text-text-body">{ligneParticipants}</p>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <p className="eyebrow mb-2">{t('hall.partage.titre')}</p>
              <p className="text-[13px] leading-relaxed text-text-secondary">{t('hall.partage.texte')}</p>
            </div>
            <div>
              <p className="eyebrow mb-2">{t('hall.jamais.titre')}</p>
              <p className="text-[13px] leading-relaxed text-text-secondary">{t('hall.jamais.texte')}</p>
            </div>
          </div>
          {peutEngager ? (
            <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 md:flex-row md:items-end">
              <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="eyebrow">{t('hall.nom.label')}</span>
                <input
                  value={nom}
                  onChange={(e) => setNom(e.target.value.slice(0, 60))}
                  maxLength={60}
                  className="h-11 border border-border-strong bg-sunken px-3 text-[14px] text-text-primary outline-none focus:border-text-secondary md:h-10"
                />
                <span className="text-[12px] text-text-muted">{t('hall.nom.aide')}</span>
              </label>
              <button
                type="button"
                disabled={occupe || !nom.trim()}
                onClick={() => geste(true)}
                className="inline-flex h-11 flex-none items-center justify-center bg-accent px-4 text-[13px] font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-50 md:h-10"
              >
                {t('hall.rejoindre')}
              </button>
            </div>
          ) : (
            <p className="mt-6 border-t border-border pt-5 text-[13px] text-text-secondary">{t('hall.reserve', { qui: t('hall.reserve.qui') })}</p>
          )}
          {refus && <p className="mt-3 text-[13px] text-danger-ink">{t('hall.refuse', { raison: refus })}</p>}
        </div>
      )}

      {etat && dedans && (
        <div className="panel-raised mt-6 flex flex-col" data-guide="dominante">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <p className="eyebrow">{etat.participation?.displayName}</p>
            <p className="text-[12px] text-text-muted">{ligneParticipants}</p>
          </div>

          <ol className="flex max-h-[56vh] min-h-[220px] flex-col gap-3 overflow-y-auto px-4 py-4">
            {messages && messages.length === 0 && <li className="text-[13px] text-text-muted">{t('hall.vide')}</li>}
            {(messages ?? []).map((m) => (
              <li key={m.id} className={`flex flex-col gap-1 ${m.mienne ? 'items-end' : 'items-start'}`}>
                <span className="flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                  <span className="text-text-secondary">{m.org}</span>
                  {m.signature && <span>· {m.signature}</span>}
                  {m.mienne && <span>· {t('hall.vous')}</span>}
                  <span>· {relativeTime(m.createdAt)}</span>
                </span>
                {/* Le texte, et rien que le texte : aucun HTML, aucun lien interprété. */}
                <p className={`max-w-[68ch] whitespace-pre-wrap break-words border px-3 py-2 text-[13.5px] leading-relaxed ${m.mienne ? 'border-border-raised bg-elevated text-text-primary' : 'border-border bg-sunken text-text-body'}`}>
                  {m.body}
                </p>
                {!m.mienne && (
                  <button
                    type="button"
                    disabled={signales.has(m.id)}
                    onClick={async () => {
                      try {
                        await signaler(m.id);
                        setSignales((s) => new Set(s).add(m.id));
                      } catch (err) {
                        setRefus(cleanErrorMessage(err));
                      }
                    }}
                    className="inline-flex min-h-8 items-center gap-1 text-[11.5px] text-text-muted hover:text-text-primary disabled:opacity-60"
                  >
                    <Flag size={11} strokeWidth={2} aria-hidden />
                    {signales.has(m.id) ? t('hall.signale') : t('hall.signaler')}
                  </button>
                )}
              </li>
            ))}
            <div ref={bas} />
          </ol>

          {peutEcrire && (
            <div className="flex flex-col gap-2 border-t border-border p-3">
              <textarea
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void poster();
                }}
                rows={3}
                maxLength={BODY_MAX + 50}
                placeholder={t('hall.composer.placeholder')}
                className="w-full resize-y border border-border-strong bg-sunken px-3 py-2 text-[13.5px] text-text-primary outline-none focus:border-text-secondary"
              />
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-[12px] text-text-muted">
                  {t('hall.composer.signature')}
                  <input
                    value={signature}
                    onChange={(e) => setSignature(e.target.value.slice(0, 30))}
                    maxLength={30}
                    className="h-9 w-40 border border-border-strong bg-sunken px-2 text-[13px] text-text-primary outline-none focus:border-text-secondary"
                  />
                </label>
                <span className={`ml-auto font-mono text-[11px] ${texte.length > BODY_MAX ? 'text-danger-ink' : 'text-text-muted'}`}>
                  {texte.length} / {BODY_MAX}
                </span>
                <button
                  type="button"
                  disabled={occupe || !texte.trim() || texte.length > BODY_MAX}
                  onClick={poster}
                  className="inline-flex h-11 items-center gap-2 bg-accent px-4 text-[13px] font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-50 md:h-9"
                >
                  <Send size={14} strokeWidth={2} aria-hidden />
                  {t('hall.composer.envoyer')}
                </button>
              </div>
              {texte.length > BODY_MAX && <p className="text-[12px] text-danger-ink">{t('hall.composer.tropLong')}</p>}
              {refus && <p className="text-[12.5px] text-danger-ink">{t('hall.refuse', { raison: refus })}</p>}
            </div>
          )}

          {peutEngager && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5">
              <span className="text-[12px] text-text-muted">{t('hall.quitter.aide')}</span>
              <button type="button" disabled={occupe} onClick={() => geste(false)} className="min-h-9 text-[12.5px] text-text-secondary underline underline-offset-2 hover:text-text-primary">
                {t('hall.quitter')}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
