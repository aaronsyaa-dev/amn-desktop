import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, MessageSquareText, Send } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { bridge } from '../lib/bridge';
import { cleanErrorMessage } from '../lib/errorMessage';
import { relativeTime } from '../lib/time';
import { useAuth } from '../auth/AuthContext';
import { useSync } from '../state/SyncContext';
import { useVault } from '../state/useVault';
import { useMembers } from '../state/useMembers';
import type { OrgMember, SupportRequest } from '../shared/api';

/*
  ══════════════════════════════════════════════════════════════════════
  LE BLOC DE DIAGNOSTIC — et la règle qui lui interdit de mentir
  ══════════════════════════════════════════════════════════════════════

  Un formulaire de contact demande à quelqu'un de DÉCRIRE une panne qu'il ne
  comprend pas, dans les mots qu'il a. La réponse arrive alors en deux temps :
  d'abord « pouvez-vous préciser ? ». L'écran fait donc le travail à sa place :
  il s'auto-examine, six points, et le client envoie le résultat.

  LES SIX POINTS SONT MESURÉS, PAS DÉCLARÉS. Chacun est une lecture de l'état
  réel du poste au moment où l'écran s'ouvre — la liaison au serveur, ce qui
  attend d'être envoyé, les places de la formule, le coffre-fort, la dernière
  sortie de données, les notifications du navigateur. Aucun voyant n'est une
  constante, aucun n'est « vert par défaut » : un point qu'on ne sait pas
  mesurer n'apparaîtrait pas du tout plutôt que d'apparaître au vert.

  CE QUI N'Y ENTRE JAMAIS. Le Journal perso et le Carnet de santé ne sont pas
  examinés, et l'écran le dit à voix haute. Ce sont les deux seuls modules
  dont le CONTENU est intime ; un diagnostic qui les compterait — ne serait-ce
  qu'en nombre d'entrées — sortirait de la machine avec le message, et le
  module aurait menti sur « ça ne quitte pas ce poste ».

  LE SEUL VOYANT QUI COMPTE EST CELUI QUI N'EST PAS AU VERT. C'est pourquoi
  il pulse, qu'il porte l'unique ambre de l'écran, et qu'il remonte en tête
  de la liste.
*/
const VOYANT = 14;

type Verdict = 'ok' | 'verifier';
interface Point {
  cle: string;
  titre: string;
  /** Ce qui a été MESURÉ, en toutes lettres — jamais une reformulation du verdict. */
  detail: string;
  verdict: Verdict;
}

const ETAT: Record<SupportRequest['status'], string> = {
  pending: 'À traiter',
  answered: 'Répondu',
  closed: 'Clos',
};
const NATURE: Record<SupportRequest['kind'], string> = {
  message: 'Message',
  seat: 'Place de plus',
  password_reset: 'Mot de passe oublié',
};

const SUBJECT_MAX = 120;
const BODY_MAX = 2000;
const CLE_EXPORTS = 'amn.exports.recents';
/** Au-delà, une sauvegarde n'est plus une sauvegarde. */
const EXPORT_VIEUX_JOURS = 90;

function occupeUnePlace(m: OrgMember): boolean {
  return m.role !== 'guest' && (m.status === 'active' || m.status === 'invited');
}

/**
 * ASSISTANCE — l'auto-examen du produit, puis le message (`26a`)
 *
 * Pour qui : quelqu'un chez qui « ça ne marche pas », et qui n'a pas les mots
 * pour dire quoi. amn-api n'a aucun transport mail : la demande arrive dans
 * la file de la Tour de contrôle, un humain la lit, sa réponse s'affiche ici.
 *
 * ## L'ambre : le voyant non conforme
 *
 * Son voyant, son titre, son détail et son verdict « À VÉRIFIER » — quatre
 * nœuds sur une ligne. Quand les six points sont au vert, l'écran n'a AUCUN
 * ambre : il ne reste rien à décider, et la seule chose à faire est d'écrire.
 */
export function AssistanceScreen() {
  const { org } = useAuth();
  const { connectionStatus, pullFailed, enAttenteEnvoi, abandonsEnvoi, configured } = useSync();
  const { entries: secrets, encrypted, loading: coffreEnLecture } = useVault();
  const { membres, prets: membresPrets } = useMembers();

  const [demandes, setDemandes] = useState<SupportRequest[] | null>(null);
  const [objet, setObjet] = useState('');
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      setDemandes(await bridge().remote.assistance.list());
    } catch (err) {
      setErreur(cleanErrorMessage(err, 'Vos demandes n’ont pas pu être lues.'));
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);
  useEffect(() => bridge().remote.onSupportAnswered?.(() => void charger()) ?? undefined, [charger]);

  /*
    L'AUTO-EXAMEN. Six lectures, dans l'ordre où elles font mal : ce qui
    empêche de travailler d'abord, ce qui coûte ensuite, ce qui protège
    enfin. Chaque détail dit LA MESURE, pas son verdict — « 2 écritures
    attendent » et non « quelque chose ne va pas ».
  */
  const points = useMemo<Point[]>(() => {
    const liste: Point[] = [];

    liste.push(
      configured
        ? {
            cle: 'liaison',
            titre: 'Liaison au serveur',
            detail:
              connectionStatus === 'online' && !pullFailed
                ? 'Le poste parle au serveur, et la dernière relecture complète a abouti.'
                : pullFailed
                  ? 'La dernière relecture complète a échoué : ce que vous voyez peut dater.'
                  : 'Le poste ne parle pas au serveur en ce moment.',
            verdict: connectionStatus === 'online' && !pullFailed ? 'ok' : 'verifier',
          }
        : {
            cle: 'liaison',
            titre: 'Liaison au serveur',
            detail: 'Ce poste travaille sans serveur : rien ne se synchronise, tout reste ici.',
            verdict: 'verifier',
          },
    );

    liste.push({
      cle: 'envoi',
      titre: 'Travail en attente d’envoi',
      detail:
        abandonsEnvoi.length > 0
          ? `${abandonsEnvoi.length} écriture(s) ne partiront pas : elles sont sur cet appareil et nulle part ailleurs.`
          : enAttenteEnvoi > 0
            ? `${enAttenteEnvoi} écriture(s) attendent d’atteindre le serveur.`
            : 'Tout ce qui a été saisi est arrivé au serveur.',
      verdict: abandonsEnvoi.length > 0 ? 'verifier' : 'ok',
    });

    if (membresPrets && org?.seats != null) {
      const prises = membres.filter(occupeUnePlace).length;
      liste.push({
        cle: 'places',
        titre: 'Places de la formule',
        detail: `${prises} place(s) prise(s) sur ${org.seats}.`,
        verdict: prises <= org.seats ? 'ok' : 'verifier',
      });
    }

    if (!coffreEnLecture) {
      liste.push({
        cle: 'coffre',
        titre: 'Coffre-fort',
        detail:
          secrets.length === 0
            ? 'Aucun secret rangé pour l’instant.'
            : encrypted
              ? `${secrets.length} secret(s), chiffrés par le trousseau de cette machine.`
              : `${secrets.length} secret(s), NON chiffrés : le trousseau du système n’est pas disponible ici.`,
        verdict: secrets.length > 0 && !encrypted ? 'verifier' : 'ok',
      });
    }

    /* LA DERNIÈRE SORTIE DE DONNÉES. Le journal des exports est local au
       poste (voir Import / export) : c'est donc « depuis CE poste », et
       l'écran l'écrit ainsi plutôt que de laisser croire à un état global. */
    let dernierExport: string | null = null;
    try {
      const faits = JSON.parse(window.localStorage.getItem(CLE_EXPORTS) ?? '[]') as { quand: string }[];
      dernierExport = faits[0]?.quand ?? null;
    } catch {
      dernierExport = null;
    }
    const joursDepuis = dernierExport ? Math.floor((Date.now() - Date.parse(dernierExport)) / 86_400_000) : null;
    liste.push({
      cle: 'export',
      titre: 'Dernière sortie de données',
      detail:
        joursDepuis === null
          ? 'Aucun export depuis ce poste. Vos données ne sont sorties nulle part.'
          : `Dernier export depuis ce poste il y a ${joursDepuis} jour(s).`,
      verdict: joursDepuis !== null && joursDepuis <= EXPORT_VIEUX_JOURS ? 'ok' : 'verifier',
    });

    const permission =
      typeof window !== 'undefined' && 'Notification' in window ? window.Notification.permission : 'unsupported';
    liste.push({
      cle: 'notifications',
      titre: 'Notifications du navigateur',
      detail:
        permission === 'granted'
          ? 'Ce navigateur accepte les notifications du produit.'
          : permission === 'denied'
            ? 'Ce navigateur les refuse : vous ne serez pas prévenue ici.'
            : permission === 'unsupported'
              ? 'Ce navigateur ne sait pas notifier.'
              : 'La permission n’a jamais été demandée sur ce navigateur.',
      verdict: permission === 'granted' ? 'ok' : 'verifier',
    });

    // Le point non conforme passe en tête : c'est le seul qui compte.
    return [...liste].sort((a, b) => (a.verdict === b.verdict ? 0 : a.verdict === 'verifier' ? -1 : 1));
  }, [
    configured,
    connectionStatus,
    pullFailed,
    enAttenteEnvoi,
    abandonsEnvoi.length,
    membresPrets,
    membres,
    org?.seats,
    coffreEnLecture,
    secrets.length,
    encrypted,
  ]);

  /* UN SEUL AMBRE. Plusieurs points peuvent être non conformes ; un seul est
     signalé — le premier, celui qui empêche le plus de travailler. Poser
     l'ambre sur trois lignes le rendrait décoratif. */
  const aVerifier = points.find((p) => p.verdict === 'verifier') ?? null;

  const pret = objet.trim().length > 0 && texte.trim().length > 0 && !envoi;

  const envoyer = async () => {
    if (!pret) return;
    setEnvoi(true);
    setErreur(null);
    try {
      /* LE BLOC PART AVEC LE MESSAGE — c'est tout l'intérêt de l'écran.
         Ce sont les six lignes affichées, mot pour mot : rien n'est ajouté
         hors de ce que la personne a sous les yeux. */
      const bloc = points.map((p) => `- ${p.titre} : ${p.detail} [${p.verdict === 'ok' ? 'OK' : 'À VÉRIFIER'}]`).join('\n');
      await bridge().remote.assistance.send({
        kind: 'message',
        subject: objet.trim(),
        body: `${texte.trim()}\n\n---\nDiagnostic du poste :\n${bloc}`,
      });
      setObjet('');
      setTexte('');
      setEnvoye(true);
      window.setTimeout(() => setEnvoye(false), 4000);
      await charger();
    } catch (err) {
      setErreur(cleanErrorMessage(err, 'Le message n’a pas pu partir.'));
    } finally {
      setEnvoi(false);
    }
  };

  const toutes = demandes ?? [];
  const parDate = [...toutes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const passes = parDate.slice(0, 3);

  /** Le délai de réponse d'un échange, quand il a été répondu. */
  const delai = (d: SupportRequest) => {
    if (!d.handledAt) return null;
    const h = Math.round((Date.parse(d.handledAt) - Date.parse(d.createdAt)) / 3_600_000);
    return h < 24 ? `${Math.max(1, h)} h` : `${Math.round(h / 24)} j`;
  };

  return (
    <section className="flex flex-col">
      <ScreenHeader
        eyebrow="Système · Assistance"
        title="Assistance"
        description="Le poste s’examine, vous envoyez le résultat — vous n’avez rien à décrire."
        stats={[
          { label: 'Points vérifiés', value: points.length },
          { label: 'À vérifier', value: points.filter((p) => p.verdict === 'verifier').length },
          { label: 'Demandes', value: demandes === null ? '…' : toutes.length },
        ]}
      />

      <StaggerGroup className="mt-6 flex flex-col gap-4">
        {/* ═══ L'OBJET DOMINANT : le bloc de diagnostic ═══ */}
        <StaggerItem>
          <section className="panel-raised p-5 sm:p-6">
            <p className="eyebrow mb-4">Ce que le poste mesure, maintenant</p>
            <ul className="flex flex-col gap-px bg-border">
              {points.map((p) => {
                const ambre = aVerifier?.cle === p.cle;
                return (
                  <li
                    key={p.cle}
                    data-signal-groupe={ambre ? 'voyant' : undefined}
                    className="flex items-start gap-3 bg-surface px-4 py-3"
                  >
                    <span
                      data-signal-groupe={ambre ? 'voyant' : undefined}
                      aria-hidden
                      className={`mt-1 flex-shrink-0 rounded-full ${ambre ? 'bg-signal halo-signal' : ''}`}
                      style={{
                        width: VOYANT,
                        height: VOYANT,
                        backgroundColor: ambre ? undefined : p.verdict === 'ok' ? 'var(--color-text-body)' : 'var(--color-border-strong)',
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        data-signal-groupe={ambre ? 'voyant' : undefined}
                        className={`text-sm font-semibold leading-tight ${ambre ? 'text-signal' : 'text-text-primary'}`}
                      >
                        {p.titre}
                      </p>
                      <p
                        data-signal-groupe={ambre ? 'voyant' : undefined}
                        className={`mt-1 max-w-prose text-[13px] leading-relaxed ${ambre ? 'text-text-primary' : 'text-text-secondary'}`}
                      >
                        {p.detail}
                      </p>
                    </div>
                    <span
                      data-signal-groupe={ambre ? 'voyant' : undefined}
                      className={`flex-shrink-0 self-center font-mono text-[10px] uppercase tracking-[0.18em] ${
                        ambre ? 'text-signal' : 'text-text-muted'
                      }`}
                    >
                      {p.verdict === 'ok' ? 'Conforme' : 'À vérifier'}
                    </span>
                  </li>
                );
              })}
            </ul>

            {/* SOUS LES VOYANTS — la phrase qui évite un message inutile. */}
            <p className="mt-4 max-w-prose border-t border-border-strong pt-3 text-sm leading-relaxed text-text-body">
              {aVerifier
                ? `Si votre question porte sur « ${aVerifier.titre.toLowerCase()} », il est inutile d’écrire : c’est déjà vu, et la ligne ci-dessus dit ce qui a été mesuré.`
                : `Les ${points.length} points mesurés sont conformes. Si quelque chose ne va pas malgré tout, écrivez — le bloc part avec votre message.`}
            </p>
          </section>
        </StaggerItem>

        <StaggerItem>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* À GAUCHE — les trois échanges passés et leur délai de réponse. */}
            <section className="panel">
              <p className="eyebrow flex items-center gap-2 border-b border-border px-4 py-2.5">
                <MessageSquareText size={13} strokeWidth={1.9} /> Les échanges passés
              </p>
              {demandes === null ? (
                <p className="flex items-center gap-2 px-4 py-4 text-xs text-text-muted">
                  <Loader2 size={13} className="animate-spin" /> Lecture…
                </p>
              ) : passes.length === 0 ? (
                <p className="px-4 py-5 text-sm text-text-secondary">
                  Aucun échange pour l’instant. Le formulaire ci-dessous part chez votre prestataire.
                </p>
              ) : (
                <ul className="flex flex-col gap-px bg-border">
                  {passes.map((d) => (
                    <li key={d.id} className="bg-surface px-4 py-2.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="min-w-0 flex-1">
                          <span className="mr-2 font-mono text-[9px] uppercase tracking-wider text-text-muted">
                            {NATURE[d.kind]}
                          </span>
                          <span className="text-sm text-text-primary">{d.subject}</span>
                        </p>
                        <span className="font-mono text-[10px] uppercase tracking-wider tabular-nums text-text-muted">
                          {delai(d) ? `Répondu en ${delai(d)}` : `${ETAT[d.status]} · ${relativeTime(d.createdAt)}`}
                        </span>
                      </div>
                      {d.reply && (
                        <p className="mt-1 max-w-prose border-l-2 border-border pl-3 text-xs leading-relaxed text-text-secondary">
                          {d.reply}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* À DROITE — ce qui part, et ce qui ne part pas. */}
            <aside className="panel p-4">
              <p className="eyebrow mb-3">Ce qui part avec votre message</p>
              <ul className="flex flex-col gap-2">
                {[
                  'Les six lignes ci-dessus, mot pour mot.',
                  'Votre objet et votre texte.',
                  'Le compte qui écrit, et son organisation.',
                ].map((phrase) => (
                  <li key={phrase} className="flex items-baseline gap-2 text-[13px] leading-relaxed text-text-secondary">
                    <span aria-hidden className="text-text-muted">
                      —
                    </span>
                    <span>{phrase}</span>
                  </li>
                ))}
              </ul>
              <p className="eyebrow mb-2 mt-4">Ce qui n’en part pas</p>
              <ul className="flex flex-col gap-2">
                {[
                  'Le Journal perso : ni son contenu, ni son nombre d’entrées.',
                  'Le Carnet de santé : aucune date, aucune mention.',
                  'La valeur d’aucun secret du coffre-fort.',
                ].map((phrase) => (
                  <li key={phrase} className="flex items-baseline gap-2 text-[13px] leading-relaxed text-text-secondary">
                    <span aria-hidden className="text-text-muted">
                      —
                    </span>
                    <span className="line-through decoration-border-strong">{phrase}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-text-muted">
                Ces deux modules-là sont les seuls dont le contenu est intime. Ils ne sont pas examinés — pas
                même comptés.
              </p>
            </aside>
          </div>
        </StaggerItem>

        {/* LE FORMULAIRE — en bas : on écrit une fois, on revient lire dix fois. */}
        <StaggerItem>
          <section className="panel p-4 sm:p-5">
            <p className="eyebrow mb-3">Nouveau message</p>
            <div className="grid gap-3 lg:grid-cols-2">
              <label className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">Objet</span>
                <input
                  value={objet}
                  maxLength={SUBJECT_MAX}
                  onChange={(e) => setObjet(e.target.value)}
                  placeholder="Par exemple : changer mon logo"
                  className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none placeholder:text-text-muted md:min-h-0 md:py-2"
                />
                <span className="mt-3 block text-[11px] leading-relaxed text-text-muted">
                  Votre demande arrive chez votre prestataire, qui la lit et vous répond ici. Rien ne part par
                  courriel.
                </span>
              </label>
              <label className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  Message
                </span>
                <textarea
                  value={texte}
                  maxLength={BODY_MAX}
                  onChange={(e) => setTexte(e.target.value)}
                  rows={5}
                  placeholder="Dites ce qu’il vous faut, en quelques lignes."
                  className="input-focus w-full resize-y border border-border bg-bg px-3 py-2 text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
                />
                <span className="mt-1 block text-right font-mono text-[10px] tabular-nums text-text-muted">
                  {texte.length} / {BODY_MAX}
                </span>
              </label>
            </div>
            {erreur && (
              <p className="mt-3 border border-warning/40 bg-warning-muted px-3 py-2 text-xs leading-relaxed text-text-primary">
                {erreur}
              </p>
            )}
            <button
              type="button"
              disabled={!pret}
              onClick={() => void envoyer()}
              className="mt-4 flex min-h-11 items-center justify-center gap-2 bg-accent px-5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40 sm:w-auto"
            >
              {envoi ? <Loader2 size={15} className="animate-spin" /> : envoye ? <Check size={15} /> : <Send size={15} />}
              {envoye ? 'Envoyé — votre prestataire est prévenu' : 'Envoyer avec le diagnostic'}
            </button>
          </section>
        </StaggerItem>
      </StaggerGroup>
    </section>
  );
}
