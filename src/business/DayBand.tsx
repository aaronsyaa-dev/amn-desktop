import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, CloudOff, RefreshCw, ShieldCheck } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { useAppointments } from '../state/useAppointments';
import { useActivity } from '../state/ActivityContext';
import { useSync } from '../state/SyncContext';
import { relativeToNow } from '../lib/calendar';
import { relativeTime } from '../lib/time';
import type { OrgAccessRecord } from '../shared/api';

/**
 * La bande d'information d'une cliente (BLOC L).
 *
 * ## Ce qu'elle n'est PAS, et la décision derrière
 *
 * Côté interne, une bande fait défiler la veille technologique — des
 * actualités extérieures. La transposer ici serait un contresens : une cliente
 * n'a pas à lire les CVE du jour dans son logiciel de facturation. Elle n'y
 * ferait pas attention deux jours, et la bande deviendrait un bandeau qu'on
 * apprend à ne plus voir.
 *
 * Cette bande-ci ne parle donc que d'ELLE, et uniquement de faits qui sont
 * vrais à l'instant où on les lit.
 *
 * ## Ce qu'elle dit, et ce qu'elle ne dit pas
 *
 * Quatre faits au maximum, dans cet ordre de priorité — et **aucun n'est
 * affiché s'il n'est pas vrai** : une bande qui remplit ses cases avec du vide
 * (« Aucun rendez-vous », « Rien à signaler ») n'informe de rien et occupe
 * tous les jours la place de quelque chose d'utile.
 *
 *   1. le prochain rendez-vous, avec le temps qui reste ;
 *   2. ce qui vient d'arriver dans son espace — la note prise sur le téléphone
 *      qui apparaît sur l'ordinateur. C'est le seul endroit de l'application
 *      où la synchronisation se VOIT ;
 *   3. l'état de la liaison, quand elle est rompue. Silencieux quand tout va
 *      bien : annoncer « connectée » en permanence, c'est du bruit ;
 *   4. la dernière ouverture de son espace par son prestataire, quand il y en
 *      a eu une. C'est le fait de sécurité qui la concerne vraiment — pas un
 *      indicateur inventé. Le mot est celui de ses Paramètres, pas notre
 *      raison sociale : `check:business` interdit notre nom dans le bundle
 *      qu'elle reçoit, et il a fait échouer ce fichier à sa première écriture.
 *
 * Ce qui n'y figure pas est déjà ailleurs, et mieux : les factures en retard,
 * les tâches enlisées et les clients sans nouvelles sont l'affaire du panneau
 * des points d'attention, juste en dessous. Les répéter ici les banaliserait.
 *
 * ## Pourquoi ça tourne
 *
 * Un seul fait à la fois, remplacé toutes les huit secondes. Le mouvement dit
 * qu'il y a autre chose à lire ; la lenteur dit qu'il n'y a pas urgence. La
 * rotation s'arrête au survol — on ne fait pas disparaître une ligne sous les
 * yeux de quelqu'un qui est en train de la lire.
 */

const ROTATION_MS = 8000;

interface Fait {
  cle: string;
  icone: typeof CalendarClock;
  texte: string;
  to?: string;
  /** Vrai pour l'état « liaison rompue », qui se lit autrement qu'une info. */
  alerte?: boolean;
}

export function DayBand() {
  const { appointments } = useAppointments();
  const { events } = useActivity();
  const { connectionStatus } = useSync();
  const [ouvertures, setOuvertures] = useState<OrgAccessRecord[]>([]);
  const [index, setIndex] = useState(0);
  const [enPause, setEnPause] = useState(false);

  // L'horloge de la bande : ce qui s'y affiche est du temps relatif, donc faux
  // une minute après si personne ne le rafraîchit.
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Les ouvertures de son espace par AMN DevSec. Lues une fois : ce n'est pas
  // une donnée qui change pendant qu'on regarde son accueil, et la
  // consultation complète vit dans ses Paramètres.
  useEffect(() => {
    let vivant = true;
    void bridge()
      .remote.accessLog()
      .then((liste) => {
        if (vivant) setOuvertures(liste);
      })
      .catch(() => {
        /* pas d'accès au journal : la bande se tait sur ce point */
      });
    return () => {
      vivant = false;
    };
  }, []);

  const faits = useMemo<Fait[]>(() => {
    const out: Fait[] = [];

    const prochain = appointments.find(
      (a) => a.status === 'scheduled' && new Date(a.startAt).getTime() > maintenant,
    );
    if (prochain) {
      out.push({
        cle: 'rdv',
        icone: CalendarClock,
        texte: `Prochain rendez-vous ${relativeToNow(prochain.startAt)} — ${
          prochain.title || 'sans titre'
        }`,
        to: '/agenda',
      });
    }

    const dernier = events[0];
    if (dernier) {
      out.push({
        cle: 'activite',
        icone: RefreshCw,
        texte: `${dernier.noun} · ${dernier.text} — ${relativeTime(dernier.at)}`,
        to: dernier.routeKey,
      });
    }

    if (connectionStatus === 'offline') {
      out.push({
        cle: 'liaison',
        icone: CloudOff,
        texte: 'Hors ligne — vos saisies sont gardées ici et partiront à la reconnexion.',
        alerte: true,
      });
    }

    /*
      La dernière ouverture de son espace par AMN DevSec.

      Le journal est rendu du plus récent au plus ancien par amn-api, mais on
      ne s'y fie pas : on prend le maximum. Une bande qui annonce « ouvert il y
      a trois mois » alors qu'on est entré ce matin ne rassure pas, elle trompe.
    */
    const ouverture = ouvertures.reduce<OrgAccessRecord | null>(
      (recent, ligne) =>
        !recent || Date.parse(ligne.createdAt) > Date.parse(recent.createdAt) ? ligne : recent,
      null,
    );
    if (ouverture) {
      out.push({
        cle: 'securite',
        icone: ShieldCheck,
        // « votre prestataire », et non notre raison sociale : c'est le mot
        // que ses Paramètres emploient déjà (AccountSecuritySection), et
        // `check:business` refuse de toute façon notre nom dans le bundle
        // livré — il a fait échouer ce build à la première tentative.
        texte: `Votre espace a été ouvert par votre prestataire ${relativeTime(ouverture.createdAt)}.`,
        to: '/settings',
      });
    }

    return out;
  }, [appointments, events, connectionStatus, ouvertures, maintenant]);

  // L'index reste dans les clous quand le nombre de faits change sous lui.
  useEffect(() => {
    if (index >= faits.length) setIndex(0);
  }, [faits.length, index]);

  useEffect(() => {
    if (faits.length < 2 || enPause) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % faits.length), ROTATION_MS);
    return () => clearInterval(t);
  }, [faits.length, enPause]);

  if (faits.length === 0) return null;

  const fait = faits[Math.min(index, faits.length - 1)];
  const Icone = fait.icone;

  const contenu = (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className={fait.alerte ? 'text-warning' : 'text-text-muted'}>
        <Icone size={14} strokeWidth={1.75} />
      </span>
      <span className="truncate text-xs text-text-secondary">{fait.texte}</span>
    </span>
  );

  return (
    <div
      onMouseEnter={() => setEnPause(true)}
      onMouseLeave={() => setEnPause(false)}
      className={`flex items-center gap-3 border px-3 py-2 ${
        fait.alerte ? 'border-warning/40 bg-warning-muted' : 'border-border bg-surface'
      }`}
      role="status"
      aria-live="polite"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={fait.cle}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="min-w-0 flex-1"
        >
          {fait.to ? (
            // `-my-1.5 py-1.5` : la cible passe de 16 à 28 px en empruntant au
            // rembourrage du conteneur, donc sans rien déplacer.
            <Link to={fait.to} className="-my-1.5 block min-w-0 py-1.5 hover:text-text-primary">
              {contenu}
            </Link>
          ) : (
            contenu
          )}
        </motion.div>
      </AnimatePresence>

      {/* Combien de faits, et lequel on regarde. Trois points valent mieux
          qu'un compteur : on lit d'un coup d'œil qu'il y a autre chose. */}
      {faits.length > 1 && (
        <span className="flex flex-shrink-0 items-center gap-1" aria-hidden>
          {faits.map((f, i) => (
            <span
              key={f.cle}
              className={`h-1 w-1 rounded-full transition-colors duration-300 ${
                i === index ? 'bg-text-secondary' : 'bg-border-strong'
              }`}
            />
          ))}
        </span>
      )}
    </div>
  );
}
