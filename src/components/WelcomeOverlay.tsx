import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from './Logo';
import { useAuth } from '../auth/AuthContext';
import { EDITION_PRODUCT_NAME } from '../edition/edition';
import { langueActive, t } from '../i18n';

const LAST_SHOWN_KEY = 'amn.welcome.lastShown';
const DURATION_MS = 5200;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/** True the first time the app is opened on a given calendar day. */
export function shouldShowWelcome(): boolean {
  try {
    return window.localStorage.getItem(LAST_SHOWN_KEY) !== todayKey();
  } catch {
    return false;
  }
}

function markWelcomeShown(): void {
  try {
    window.localStorage.setItem(LAST_SHOWN_KEY, todayKey());
  } catch {
    /* ignore */
  }
}

/**
 * Picks the most natural voice the machine offers FOR THE ACTIVE LANGUAGE.
 * Modern Windows (10/11) and macOS ship higher-quality "Natural"/"Neural"/
 * "Enhanced" voices alongside the basic default — we score for those and for
 * known-good names, falling back to any voice of the language, then the
 * system default. A French voice reading English (or the reverse) is the
 * spoken version of the bilingual splash this file used to be.
 */
function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const prefixe = langueActive() === 'en' ? 'en' : 'fr';
  const dans = voices.filter((v) => v.lang?.toLowerCase().startsWith(prefixe));
  if (dans.length === 0) return null;

  const NATURAL = /natural|neural|enhanced|premium|online/i;
  const GOOD_NAMES =
    /(google|denise|henri|julie|paul|amélie|amelie|thomas|audrey|aurélie|aurelie|charlotte|léa|lea|daniel|libby|sonia|ryan|aria|jenny|guy)/i;

  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    if (NATURAL.test(v.name)) s += 5;
    if (GOOD_NAMES.test(v.name)) s += 3;
    const lang = v.lang?.toLowerCase();
    if (lang === 'fr-fr' || lang === 'en-gb' || lang === 'en-us') s += 1;
    return s;
  };

  return [...dans].sort((a, b) => score(b) - score(a))[0];
}

/** Speaks the welcome via the free native Web Speech API, best voice available. */
function speakWelcome(name: string): void {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;

    const doSpeak = () => {
      const voice = pickBestVoice(synth.getVoices());
      const utter = new SpeechSynthesisUtterance(
        t('bienvenue.voix', { produit: EDITION_PRODUCT_NAME, nom: name }),
      );
      if (voice) utter.voice = voice;
      utter.lang = voice?.lang || (langueActive() === 'en' ? 'en-GB' : 'fr-FR');
      utter.rate = 0.93; // slightly slower — calmer, more posed
      utter.pitch = 1.02;
      synth.cancel();
      synth.speak(utter);
    };

    // Voices load asynchronously the first time — wait for them if needed.
    if (synth.getVoices().length > 0) {
      doSpeak();
    } else {
      synth.addEventListener('voiceschanged', doSpeak, { once: true });
    }
  } catch {
    /* speech unavailable — the visual welcome still plays */
  }
}

/**
 * Rideau plein écran « Welcome to <produit> », une fois par jour au lancement,
 * with a spoken greeting and a soft reveal, in the app's monochrome identity.
 * Auto-dismisses after ~5s; click anywhere to skip.
 */
export function WelcomeOverlay({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const name = user?.name ?? 'opérateur';
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    if (!visible) return;
    setVisible(false);
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    markWelcomeShown();
    speakWelcome(name);
    timer.current = setTimeout(dismiss, DURATION_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.div
          role="button"
          tabIndex={0}
          onClick={dismiss}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') && dismiss()}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[200] flex cursor-pointer flex-col items-center justify-center bg-bg"
        >
          {/* Slow sweeping highlight for a bit of life */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            initial={{ backgroundPosition: '0% 50%' }}
            animate={{ backgroundPosition: '100% 50%' }}
            transition={{ duration: 5, ease: 'linear' }}
            style={{
              background:
                'radial-gradient(60% 40% at 50% 45%, rgba(255,255,255,0.05), transparent 70%)',
              backgroundSize: '200% 200%',
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex flex-col items-center gap-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <Logo height={52} showTagline showAppName />
            </motion.div>

            <div className="flex flex-col items-center gap-2 text-center">
              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl"
              >
                {/* LE SPLASH NE MÉLANGE PLUS : « Welcome to AMN Business »
                    au-dessus de « BONJOUR » était l'écran bilingue type.
                    Titre, salut et voix sortent du MÊME dictionnaire. */}
                {t('bienvenue.titre', { produit: EDITION_PRODUCT_NAME })}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.8 }}
                className="font-mono text-sm uppercase tracking-[0.3em] text-text-secondary"
              >
                {t('bienvenue.salut', { nom: name })}
              </motion.p>
            </div>

            {/* thin progress bar that drains over the display duration */}
            <motion.div className="mt-2 h-px w-40 overflow-hidden bg-white/10">
              <motion.div
                className="h-full bg-text-secondary"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: DURATION_MS / 1000, ease: 'linear' }}
              />
            </motion.div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6, duration: 0.8 }}
            className="absolute bottom-10 font-mono text-[10px] uppercase tracking-widest text-text-muted"
          >
            Cliquez pour passer
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
