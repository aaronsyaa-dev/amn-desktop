import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarCheck, Check, Loader2 } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useLangue } from '../i18n';

const API_BASE = (import.meta.env.VITE_AMN_API_URL || '').replace(/\/$/, '');
type Jour = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
const CLES: Jour[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

interface Offre {
  status: 'open';
  orgName: string;
  title: string;
  intro: string;
  durationMin: number;
  availability: Partial<Record<Jour, { from: string; to: string }[]>>;
  location: string;
  days: number;
  taken: { startAt: string; durationMin: number }[];
}
const minutesDe = (hhmm: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * LA PAGE PUBLIQUE DE RENDEZ-VOUS — sans compte, sans session.
 *
 * Ce qu'elle sait : le nom, l'accueil, la durée, les fenêtres, et les heures
 * déjà prises (jamais par qui). Ce qu'elle fait : proposer les jours à venir,
 * les créneaux libres, et prendre un nom et un moyen de joindre. Le serveur
 * revalide tout ; cette page ne fait qu'aider à choisir. Même image que la
 * page de bienvenue : le logo, une carte, une grammaire calme.
 */
export function PublicBookingScreen() {
  const { t, langue } = useLangue();
  const [orgId] = useState(() => {
    const hash = window.location.hash;
    const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : window.location.search.slice(1);
    return (new URLSearchParams(query).get('org') ?? '').trim();
  });
  const [offre, setOffre] = useState<Offre | null | 'fermee' | 'erreur'>(null);
  const [jour, setJour] = useState<string | null>(null);
  const [creneau, setCreneau] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fini, setFini] = useState<{ startAt: string } | null>(null);
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';

  useEffect(() => {
    if (!orgId || !API_BASE) {
      setOffre('fermee');
      return;
    }
    fetch(`${API_BASE}/v1/booking/${encodeURIComponent(orgId)}`)
      .then(async (r) => (r.ok ? ((await r.json()) as Offre) : 'fermee'))
      .then((o) => setOffre(o))
      .catch(() => setOffre('erreur'));
  }, [orgId]);

  const jours = useMemo(() => {
    if (!offre || typeof offre === 'string') return [];
    const out: { iso: string; date: Date; creneaux: Date[] }[] = [];
    const maintenant = Date.now();
    for (let i = 0; i < offre.days; i += 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + i);
      const fenetres = offre.availability[CLES[d.getDay()]] ?? [];
      const creneaux: Date[] = [];
      for (const f of fenetres) {
        const de = minutesDe(f.from);
        const a = minutesDe(f.to);
        if (de === null || a === null) continue;
        for (let m = de; m + offre.durationMin <= a; m += offre.durationMin) {
          const debut = new Date(d);
          debut.setMinutes(m);
          if (debut.getTime() <= maintenant) continue;
          const pris = offre.taken.some((p) => {
            const pd = Date.parse(p.startAt);
            return debut.getTime() < pd + p.durationMin * 60_000 && pd < debut.getTime() + offre.durationMin * 60_000;
          });
          if (!pris) creneaux.push(debut);
        }
      }
      if (creneaux.length > 0) out.push({ iso: d.toISOString().slice(0, 10), date: d, creneaux });
    }
    return out;
  }, [offre]);

  useEffect(() => {
    if (!jour && jours.length > 0) setJour(jours[0].iso);
  }, [jours, jour]);

  const reserver = async () => {
    if (!creneau || envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await fetch(`${API_BASE}/v1/booking/${encodeURIComponent(orgId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, message, startAt: creneau }),
      });
      const corps = (await r.json().catch(() => ({}))) as { error?: string; startAt?: string };
      if (!r.ok) {
        setErreur(corps.error ?? t('rdvPublic.echec'));
        if (r.status === 409) setOffre(null);
        return;
      }
      setFini({ startAt: corps.startAt ?? creneau });
    } catch {
      setErreur(t('rdvPublic.echec'));
    } finally {
      setEnvoi(false);
    }
  };

  const quand = (iso: string) => new Date(iso).toLocaleString(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-xl">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <section className="border border-border bg-surface p-6">
          {offre === null && <p className="flex items-center gap-2 text-sm text-text-muted"><Loader2 size={14} className="animate-spin" /> {t('rdvPublic.lecture')}</p>}
          {offre === 'fermee' && (
            <>
              <h1 className="text-xl font-bold tracking-tight text-text-primary">{t('rdvPublic.fermeeTitre')}</h1>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{t('rdvPublic.fermeeTexte')}</p>
            </>
          )}
          {offre === 'erreur' && <p className="text-sm text-text-secondary">{t('rdvPublic.erreur')}</p>}
          {offre && typeof offre !== 'string' && fini && (
            <>
              <p className="eyebrow flex items-center gap-2 text-success"><Check size={12} /> {t('rdvPublic.confirmeSurtitre')}</p>
              <h1 className="mt-2 text-xl font-bold tracking-tight text-text-primary">{t('rdvPublic.confirmeTitre', { quand: quand(fini.startAt) })}</h1>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{t('rdvPublic.confirmeTexte', { org: offre.orgName })}</p>
              {offre.location && <p className="mt-3 text-sm text-text-primary">{offre.location}</p>}
            </>
          )}
          {offre && typeof offre !== 'string' && !fini && (
            <>
              <p className="eyebrow">{offre.orgName}</p>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-text-primary">{offre.title || t('rdvPublic.titreDefaut')}</h1>
              {offre.intro && <p className="mt-2 text-sm leading-relaxed text-text-secondary">{offre.intro}</p>}
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('rdv.minutes', { n: offre.durationMin })}{offre.location && ` · ${offre.location}`}</p>

              {jours.length === 0 ? (
                <p className="mt-5 text-sm text-text-secondary">{t('rdvPublic.aucunCreneau')}</p>
              ) : (
                <>
                  <p className="eyebrow mt-5 mb-2">{t('rdvPublic.choisirJour')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {jours.map((j) => (
                      <button key={j.iso} type="button" onClick={() => { setJour(j.iso); setCreneau(null); }} aria-pressed={jour === j.iso} className={`min-h-11 border px-3 text-sm md:min-h-0 md:py-1.5 ${jour === j.iso ? 'border-accent text-text-primary' : 'border-border text-text-secondary hover:border-border-strong'}`}>
                        {j.date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
                      </button>
                    ))}
                  </div>
                  <p className="eyebrow mt-4 mb-2">{t('rdvPublic.choisirHeure')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(jours.find((j) => j.iso === jour)?.creneaux ?? []).map((c) => {
                      const iso = c.toISOString();
                      return (
                        <button key={iso} type="button" onClick={() => setCreneau(iso)} aria-pressed={creneau === iso} className={`min-h-11 border px-3 font-mono text-sm md:min-h-0 md:py-1.5 ${creneau === iso ? 'border-accent bg-accent-muted text-text-primary' : 'border-border text-text-secondary hover:border-border-strong'}`}>
                          {c.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                        </button>
                      );
                    })}
                  </div>
                  {creneau && (
                    <form onSubmit={(e) => { e.preventDefault(); void reserver(); }} className="mt-5 flex flex-col gap-3 border-t border-border pt-4">
                      <p className="text-sm text-text-primary">{quand(creneau)}</p>
                      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('rdvPublic.champNom')} aria-label={t('rdvPublic.champNom')} required className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={t('rdvPublic.champEmail')} aria-label={t('rdvPublic.champEmail')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
                        <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder={t('rdvPublic.champTel')} aria-label={t('rdvPublic.champTel')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
                      </div>
                      <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('rdvPublic.champMessage')} aria-label={t('rdvPublic.champMessage')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
                      {erreur && <p role="alert" className="text-xs text-danger">{erreur}</p>}
                      <button type="submit" disabled={envoi || name.trim().length < 2 || (!email.trim() && !phone.trim())} className="flex min-h-11 items-center justify-center gap-2 bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-40">
                        {envoi ? <Loader2 size={14} className="animate-spin" /> : <CalendarCheck size={14} />} {t('rdvPublic.confirmer')}
                      </button>
                    </form>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </motion.div>
    </div>
  );
}
