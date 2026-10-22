import { useEffect, useMemo, useState } from 'react';
import { garde, EQUIPES_ORDRE, SILENCE_DEFAUT } from '../../lib/garde';
import type { GardeJournalEntree } from '../../shared/garde';
import { useSourceBureaux } from '../../bureaux/donnees/source';
import { subscribe } from '../../socle/moments';
import { useGardeLangue } from './i18n';
import { fenetreDeNuit, resumerNuit, type Resume } from './resume';
import { filParEquipe, type LigneFil } from './fil';

/**
 * LES DONNÉES DE LA GARDE VISIBLE (S3) — tout vient du serveur.
 *
 * La salle, le pouls et la pile sont déjà lus par la source des bureaux
 * (`bureaux/donnees/source.tsx`, montée par `AppLayout`) : on ne les
 * redemande pas. Seuls le journal et les rondes sur la période sont lus ici,
 * et relus quand la Garde annonce une nouvelle ligne (`garde.onGarde`).
 *
 * Une panne ne casse rien : le dernier état connu reste, et `erreur` le dit.
 */

/** Relit après la trame, sans relire vingt fois pour une rafale. */
function useRelecture(types: string[], delaiMs = 1500): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let attente: ReturnType<typeof setTimeout> | null = null;
    const off = garde.onGarde((trame) => {
      if (!types.includes(trame.type)) return;
      if (attente) clearTimeout(attente);
      attente = setTimeout(() => setN((x) => x + 1), delaiMs);
    });
    return () => {
      if (attente) clearTimeout(attente);
      off();
    };
    // Les types sont une liste littérale de l'appelant : stable en pratique.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delaiMs]);
  return n;
}

export function useJournalGarde(depuis: Date | null, limit = 200): { journal: GardeJournalEntree[]; erreur: boolean; pret: boolean } {
  const [etat, setEtat] = useState<{ journal: GardeJournalEntree[]; erreur: boolean; pret: boolean }>({ journal: [], erreur: false, pret: false });
  const relu = useRelecture(['garde:journal', 'garde:correction']);
  const since = depuis ? depuis.toISOString() : undefined;
  useEffect(() => {
    let vivant = true;
    garde
      .journal({ since, limit })
      .then((journal) => vivant && setEtat({ journal, erreur: false, pret: true }))
      .catch(() => vivant && setEtat((e) => ({ ...e, erreur: true, pret: true })));
    return () => {
      vivant = false;
    };
  }, [since, limit, relu]);
  return etat;
}

/** Le résumé de la nuit, depuis `depuis` (par défaut : le début du silence de nuit de la Garde). */
export function useResumeDeNuit(depuis?: Date | null): { resume: Resume | null; erreur: boolean } {
  const { langue } = useGardeLangue();
  const src = useSourceBureaux();
  const silence = src.salle?.reglages?.silence ?? SILENCE_DEFAUT;
  const { de, a } = silence;
  // Par sa valeur, pas par l'objet : un appelant qui écrit `new Date(x)` à chaque rendu ne relance rien.
  const depuisMs = depuis ? depuis.getTime() : null;
  const debut = useMemo(() => (depuisMs !== null ? new Date(depuisMs) : fenetreDeNuit({ de, a }).debut), [depuisMs, de, a]);
  const { journal, erreur, pret } = useJournalGarde(debut, 1000);
  const [rondes, setRondes] = useState<number | null>(null);
  const relu = useRelecture(['garde:ronde']);
  useEffect(() => {
    let vivant = true;
    garde
      .rondes({ since: debut.toISOString(), limit: 5000 })
      .then((r) => vivant && setRondes(r.filter((x) => x.fin !== null).length))
      .catch(() => vivant && setRondes(null));
    return () => {
      vivant = false;
    };
  }, [debut, relu]);

  const resume = useMemo(() => {
    if (!pret || (!src.pret && !src.salle)) return null;
    const compte = src.accueil?.pile.compte;
    return resumerNuit(
      {
        rondes,
        regles: journal.filter((j) => j.resultat === 'regle').length,
        remontes: journal.filter((j) => j.resultat === 'remonte').length,
        ratees: journal.filter((j) => j.resultat === 'echec').length,
        critiquesOuverts: compte?.critiques ?? src.salle?.pouls.compte.critiques ?? 0,
        dossiersOuverts: compte?.dossiers ?? src.salle?.pouls.compte.ouvertes ?? 0,
        gardesEnEchec: src.salle?.pouls.enEchec.length ?? 0,
      },
      langue,
    );
  }, [pret, src.pret, src.salle, src.accueil, journal, rondes, langue]);

  return { resume, erreur: erreur && !resume };
}

/** Une ligne par équipe : ce qu'elle fait maintenant. */
export function useFilDActivite(): { lignes: LigneFil[]; pret: boolean } {
  const { langue } = useGardeLangue();
  const src = useSourceBureaux();
  // Le dernier jour suffit à dire « la dernière chose faite » par une équipe calme.
  const [depuis] = useState(() => new Date(Date.now() - 24 * 3_600_000));
  const { journal } = useJournalGarde(depuis, 200);
  const [suspecteAt, setSuspecteAt] = useState<string | null>(null);
  // Le bus de moments : le poste signale lui-même une tentative suspecte, avant que la Garde la voie.
  useEffect(() => subscribe('tentative.suspecte', (m) => setSuspecteAt(new Date(m.quand).toISOString())), []);

  const lignes = useMemo(
    () =>
      filParEquipe(
        { ordre: EQUIPES_ORDRE, equipes: src.salle?.equipes ?? [], agents: src.salle?.agents ?? [], journal, suspecteAt },
        langue,
      ),
    [src.salle, journal, suspecteAt, langue],
  );
  return { lignes, pret: Boolean(src.salle) };
}
