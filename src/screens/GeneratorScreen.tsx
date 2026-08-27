import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Copy, ImagePlus, Loader2, Sparkles } from 'lucide-react';
import { LOCAL_SESSION_REFUSAL, useOrgContext } from '../state/OrgContextContext';
import { useAuth } from '../auth/AuthContext';
import { bridge } from '../lib/bridge';
import { cleanErrorMessage } from '../lib/errorMessage';
import { resizeImageToDataUrl } from '../lib/imageResize';
import { ACCENTS } from '../lib/accent';
import { CONFIGURABLE_MODULES, TRADE_PROFILES, tradeProfileById } from '../data/tradeProfiles';
import { calcProfileById } from '../state/calcProfiles';
import { RangeControl } from '../components/generator/RangeControl';
import { LivePreview } from '../components/generator/LivePreview';
import { handoverMessage } from '../lib/handoverMessage';
import { OrgAvatar } from '../components/org-rail/OrgAvatar';
import type { DownloadLink, OrgPlan } from '../shared/api';

/**
 * L'ATELIER — la création d'un espace de travail sur mesure (BLOC C)
 * ══════════════════════════════════════════════════════════════════
 *
 * « La création de desktop est très simpliste, je veux la sentir, vraiment
 * configurer. »
 *
 * POURQUOI UN ÉCRAN ET PLUS UNE BOÎTE DE DIALOGUE. Une boîte de dialogue dit
 * « remplis et referme ». On ne referme pas un acte de création : on en sort
 * avec quelque chose. Elle imposait aussi sa taille — et donc, mécaniquement,
 * de ne rien montrer de ce qu'on fabrique. L'atelier prend l'écran, met les
 * réglages à gauche et le produit à droite, et les deux bougent ensemble.
 *
 * LE MÉTIER D'ABORD, LE DÉTAIL ENSUITE. Le premier écran ne demande ni nom ni
 * adresse : il demande DE QUI il s'agit. Une boutique en ligne et un artisan de
 * chantier n'ont pas les mêmes modules, pas le même calculateur, pas le même
 * nombre de sièges — partir d'une page blanche où tout se vaut, c'est laisser
 * ces décisions au hasard ou à la fatigue. Le profil pose des réponses
 * argumentées ; l'écran suivant les discute, une par une.
 *
 * RIEN N'EST VERROUILLÉ PAR LE PROFIL. Chaque valeur qu'il propose est ensuite
 * modifiable — sinon ce serait un moule, et cinq moules ne valent pas mieux
 * qu'un formulaire vide.
 *
 * L'APERÇU EST LA PIÈCE MAÎTRESSE. Voir LivePreview : chaque module coché
 * apparaît immédiatement dans la barre latérale qu'aura la cliente, au bon
 * endroit, dans le bon groupe. C'est ce qui transforme « cocher une case » en
 * « voir l'application prendre forme ».
 *
 * L'ACCENT EST UNE PROPOSITION, JAMAIS UNE DÉCISION. On propose une couleur
 * cohérente avec le métier pour qu'elle n'ouvre pas une application grise le
 * premier jour — et elle en change quand elle veut depuis SES paramètres. Le
 * générateur n'a pas à choisir l'identité visuelle de quelqu'un d'autre, il a à
 * lui éviter le vide.
 */

type Step = 'metier' | 'configuration' | 'remise';
type Handover = 'password' | 'invitation';

/** Icône du rail : petite par destination, donc petite à la source. */
const LOGO_MAX_DIM = 160;
/** Marge sous le plafond d'amn-api (48 Ko), pour ne jamais être refusé de peu. */
const LOGO_MAX_CHARS = 44 * 1024;

/**
 * Le seuil au-delà duquel Business premium se justifie.
 *
 * Quatre sièges, parce que c'est là que la coordination devient le sujet : à
 * trois on se parle, à cinq on a besoin que l'outil se souvienne. Le curseur
 * l'écrit sous lui plutôt que de le décider en silence.
 */
const PREMIUM_FROM_SEATS = 4;

export function GeneratorScreen() {
  const navigate = useNavigate();
  const { refreshOrganizations, enterOrganization } = useOrgContext();
  const { sessionKind } = useAuth();

  const [step, setStep] = React.useState<Step>('metier');
  const [profileId, setProfileId] = React.useState<string | null>(null);

  // La configuration fine. Initialisée par le profil, libre ensuite.
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [logo, setLogo] = React.useState('');
  const [logoError, setLogoError] = React.useState<string | null>(null);
  const [modules, setModules] = React.useState<string[]>([]);
  const [accentId, setAccentId] = React.useState('blanc');
  const [seats, setSeats] = React.useState(2);
  const [guestMinutes, setGuestMinutes] = React.useState(60);
  const [handover, setHandover] = React.useState<Handover>('password');

  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    orgId: string;
    orgName: string;
    email: string;
    secret: string;
    kind: Handover;
    expiresAt?: string;
    partial: string | null;
    /** Le lien d'installeur, ou la raison pour laquelle il n'y en a pas. */
    download: DownloadLink | null;
    downloadProblem: string | null;
    /**
     * L'adresse de l'application web, dite par le serveur (`appUrl`).
     *
     * `null` quand APP_BUSINESS_PUBLIC_URL n'est pas configurée sur amn-api. Ce cas est
     * AFFICHÉ, pas absorbé : sans cette adresse, le message de remise n'a rien
     * à donner à une cliente qui le lit sur son téléphone, et Aaron doit le
     * savoir avant d'appuyer sur « envoyer », pas après.
     */
    webUrl: string | null;
  } | null>(null);

  const profile = profileId ? tradeProfileById(profileId) : undefined;
  const plan: OrgPlan = seats >= PREMIUM_FROM_SEATS ? 'business_premium' : 'business_standard';

  /** Choisir un métier POSE les valeurs de départ, et fait entrer dans l'atelier. */
  const chooseProfile = (id: string) => {
    const chosen = tradeProfileById(id);
    if (!chosen) return;
    setProfileId(id);
    setModules(chosen.modules);
    setAccentId(chosen.suggestedAccent);
    setSeats(chosen.seats);
    setStep('configuration');
  };

  const toggleModule = (key: string) =>
    setModules((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );

  const onLogo = async (file: File | null) => {
    setLogoError(null);
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, LOGO_MAX_DIM);
      if (dataUrl.length > LOGO_MAX_CHARS) {
        setLogoError('Image trop lourde même après réduction. Essayez un fichier plus simple.');
        return;
      }
      setLogo(dataUrl);
    } catch {
      setLogoError('Ce fichier n’a pas pu être lu comme une image.');
    }
  };

  /**
   * La création, en trois temps — et l'ordre compte.
   *
   * 1. L'organisation et son compte propriétaire. Sans eux, il n'y a rien à
   *    configurer.
   * 2. La configuration fine (modules, accent proposé, quota invité). Si CETTE
   *    étape échoue, l'organisation existe quand même : on le DIT plutôt que
   *    de faire échouer l'ensemble, parce qu'annuler une organisation déjà
   *    créée est un geste plus risqué que de signaler un réglage à refaire.
   * 3. La remise de l'accès, qui est la seule chose qu'on ne peut pas rejouer :
   *    ni le mot de passe temporaire ni le jeton d'activation ne sont
   *    réaffichables. D'où sa place en dernier, et son écran dédié.
   */
  const create = async () => {
    if (busy) return;
    setError(null);

    if (sessionKind !== 'api') return setError(LOCAL_SESSION_REFUSAL);
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) return setError('La raison sociale est obligatoire.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      return setError('Adresse email du compte propriétaire invalide.');
    }

    setBusy(true);
    try {
      const created = await bridge().remote.admin.createOrganization({
        name: trimmedName,
        ownerEmail: trimmedEmail,
        plan,
        logoDataUrl: logo || undefined,
        /*
          LE MÉTIER EST CONSERVÉ (BLOC 6).

          Jusqu'ici le profil métier disparaissait à la création : il proposait
          des modules, un calculateur et une couleur, puis plus rien ne savait
          qu'AllStore est une boutique. C'est ce qui manquait pour parler la
          langue de la cliente — « Gérante » plutôt que « Propriétaire ».
        */
        // `profile?.id` : l'atelier laisse créer sans avoir choisi de métier
        // (on part d'une page blanche et on coche soi-même). Le serveur
        // accepte l'absence, et l'organisation affichera les libellés
        // génériques plutôt qu'un métier deviné.
        trade: profile?.id,
      });
      if (!created.owner) throw new Error('Organisation créée sans compte propriétaire.');

      let partial: string | null = null;
      try {
        await bridge().remote.admin.updateOrganization(created.organization.id, {
          modules,
          accent: accentId,
          guestDailyMinutes: guestMinutes,
        });
      } catch (err) {
        partial = cleanErrorMessage(
          err,
          'La configuration fine n’a pas pu être appliquée. L’organisation existe : reprenez ses modules depuis son dossier.',
        );
      }

      /*
        LE LIEN D'INSTALLEUR, DANS LE MÊME GESTE (BLOC C).

        C'est le point qui manquait : Aaron validait, l'organisation existait, et
        il n'avait toujours rien à envoyer pour installer l'application. Le lien
        est émis ICI, pas sur un écran séparé, parce que « créer une cliente » et
        « lui donner de quoi démarrer » sont un seul geste dans sa tête.

        Un échec n'annule RIEN : l'organisation et l'accès existent déjà et
        valent d'être remis. Le cas le plus courant — aucune version publiée —
        n'est même pas une panne, c'est un état normal tant qu'aucun `.exe` n'a
        été construit. On le dit, on ne le cache pas derrière un lien mort.
      */
      let download: DownloadLink | null = null;
      let downloadProblem: string | null = null;
      try {
        download = await bridge().remote.admin.downloadLink(created.organization.id);
      } catch (err) {
        downloadProblem = cleanErrorMessage(
          err,
          'Le lien de téléchargement n’a pas pu être émis.',
        );
      }

      if (handover === 'password') {
        const reset = await bridge().remote.admin.resetPassword(
          created.organization.id,
          created.owner.id,
        );
        setResult({
          orgId: created.organization.id,
          orgName: created.organization.name,
          email: trimmedEmail,
          secret: reset.password,
          kind: 'password',
          partial,
          download,
          downloadProblem,
          webUrl: reset.appUrl ?? created.appUrl ?? null,
        });
      } else {
        if (!created.invitation) throw new Error('Aucun lien d’activation n’a été émis.');
        setResult({
          orgId: created.organization.id,
          orgName: created.organization.name,
          email: trimmedEmail,
          // Le LIEN quand le serveur en connaît un, le jeton sinon. Un jeton nu
          // ne se colle nulle part : la cliente ne sait pas de quelle page il
          // s'agit, et c'est le même défaut que le lien d'appel en `file://`.
          secret: created.invitation.url ?? created.invitation.token,
          kind: 'invitation',
          expiresAt: created.invitation.expiresAt,
          partial,
          download,
          downloadProblem,
          webUrl: created.appUrl ?? null,
        });
      }
      setStep('remise');
      await refreshOrganizations();
    } catch (err) {
      setError(cleanErrorMessage(err, 'Création refusée.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="forge-ground -mx-4 -my-5 min-h-full px-4 py-6 sm:-mx-6 sm:-my-6 sm:px-8 sm:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => (step === 'metier' ? navigate('/tour') : setStep('metier'))}
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary"
            >
              <ArrowLeft size={12} strokeWidth={2} />
              {step === 'metier' ? 'Tour de contrôle' : 'Changer de métier'}
            </button>
          </div>
          <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-text-primary">
            {step === 'metier'
              ? 'De quel métier s’agit-il ?'
              : step === 'configuration'
                ? `L’espace de travail de ${name.trim() || 'votre cliente'}`
                : 'L’espace est prêt'}
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-text-secondary">
            {step === 'metier'
              ? 'Le métier décide du point de départ : les modules ouverts, le calculateur du quotidien, la couleur proposée. Tout reste modifiable à l’écran suivant.'
              : step === 'configuration'
                ? 'Chaque réglage se voit à droite, à l’instant où vous le bougez.'
                : 'Ce qui suit ne sera plus jamais affiché. Transmettez-le maintenant.'}
          </p>
          <div className="rule-fade mt-5" />
        </header>

        <AnimatePresence mode="wait">
          {step === 'metier' && (
            <motion.div
              key="metier"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {TRADE_PROFILES.map((trade) => {
                const Icon = trade.icon;
                const calc = calcProfileById(trade.calcProfileId);
                return (
                  <button
                    key={trade.id}
                    type="button"
                    onClick={() => chooseProfile(trade.id)}
                    className="panel elev-hover group flex flex-col gap-3 p-4 text-left transition-colors hover:border-border-strong"
                  >
                    <span className="flex items-center gap-2.5 text-text-primary">
                      <Icon size={19} strokeWidth={1.5} />
                      <span className="text-[15px] font-medium">{trade.label}</span>
                    </span>
                    <span className="text-[12px] leading-relaxed text-text-secondary">
                      {trade.pitch}
                    </span>
                    <span className="mt-auto flex flex-wrap gap-1.5">
                      {trade.highlights.map((h) => (
                        <span
                          key={h}
                          className="border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-muted"
                        >
                          {h}
                        </span>
                      ))}
                    </span>
                    {calc && (
                      /*
                        Le lien avec le moteur de calcul déjà construit : le
                        profil métier ne se contente pas d'ouvrir le module
                        Calculateurs, il désigne LE calcul que ce métier fait
                        tous les jours.
                      */
                      <span className="eyebrow">Calculateur : {calc.label}</span>
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}

          {step === 'configuration' && profile && (
            <motion.div
              key="configuration"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]"
            >
              {/* ────────────── La colonne des réglages ────────────── */}
              <div className="flex flex-col gap-6">
                <section className="panel p-4">
                  <p className="eyebrow mb-4">Identité</p>
                  <div className="flex flex-col gap-4">
                    <Field
                      label="Raison sociale"
                      hint="C’est ce nom qui apparaîtra sur ses devis et ses factures."
                    >
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="AllStore"
                        className="input-focus w-full border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
                      />
                    </Field>

                    <Field
                      label="Compte propriétaire"
                      hint="La personne qui ouvrira l’application en premier, et qui invitera les autres."
                    >
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        inputMode="email"
                        placeholder="riyad@allstore.fr"
                        className="input-focus w-full border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
                      />
                    </Field>

                    <div className="flex items-center gap-3">
                      <OrgAvatar name={name || 'A'} logoDataUrl={logo} size={40} rounded="rounded-lg" />
                      <label className="flex cursor-pointer items-center gap-2 border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary">
                        <ImagePlus size={13} strokeWidth={1.75} />
                        {logo ? 'Changer le logo' : 'Ajouter un logo'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => void onLogo(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      {logo && (
                        <button
                          type="button"
                          onClick={() => setLogo('')}
                          className="font-mono text-[10px] uppercase tracking-wider text-text-muted hover:text-text-primary"
                        >
                          Retirer
                        </button>
                      )}
                    </div>
                    {logoError && <p className="text-[11px] text-danger">{logoError}</p>}
                  </div>
                </section>

                <section className="panel p-4">
                  <p className="eyebrow mb-4">Dimensionnement</p>
                  <div className="flex flex-col gap-6">
                    <RangeControl
                      label="Sièges"
                      value={seats}
                      min={1}
                      max={25}
                      onChange={setSeats}
                      format={(v) => `${v} personne${v > 1 ? 's' : ''}`}
                      consequence={
                        seats >= PREMIUM_FROM_SEATS
                          ? 'Business premium — à partir de quatre, la coordination devient le sujet et l’outil doit s’en souvenir.'
                          : 'Business standard — à trois on se parle, l’outil n’a pas à arbitrer.'
                      }
                    />

                    <RangeControl
                      label="Quota d’un compte invité"
                      value={guestMinutes}
                      min={15}
                      max={480}
                      step={15}
                      onChange={setGuestMinutes}
                      format={(v) => (v >= 60 ? `${Math.round((v / 60) * 10) / 10} h / jour` : `${v} min / jour`)}
                      consequence={`Un invité travaille ${guestMinutes} minutes par jour, décomptées par le serveur — pas par l’application.`}
                      hint="Un invité n’est pas un siège : c’est un accès borné, pour un stagiaire ou un prestataire de passage."
                    />
                  </div>
                </section>

                <section className="panel p-4">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <p className="eyebrow">Modules ouverts</p>
                    <span className="eyebrow">{modules.length} sur {CONFIGURABLE_MODULES.length}</span>
                  </div>
                  <p className="mb-4 text-[11px] leading-snug text-text-muted">
                    Accueil et Paramètres sont toujours ouverts : une organisation sans eux n’est pas
                    allégée, elle est cassée. Ce que vous fermez ici disparaît de sa barre — sans
                    laisser d’écran vide qui dirait « il y a autre chose, mais pas pour vous ».
                  </p>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {CONFIGURABLE_MODULES.map((mod) => {
                      const on = modules.includes(mod.key);
                      const suggested = profile.modules.includes(mod.key);
                      return (
                        <button
                          key={mod.key}
                          type="button"
                          onClick={() => toggleModule(mod.key)}
                          className={`flex items-start gap-2.5 border px-2.5 py-2 text-left transition-colors ${
                            on
                              ? 'border-border-strong bg-surface-hover'
                              : 'border-border bg-bg hover:border-border-strong'
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center border ${
                              on ? 'border-text-primary bg-text-primary' : 'border-border-strong'
                            }`}
                          >
                            {on && <Check size={9} strokeWidth={3} className="text-bg" />}
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span
                                className={`text-[12px] ${on ? 'text-text-primary' : 'text-text-secondary'}`}
                              >
                                {mod.label}
                              </span>
                              {suggested && (
                                /* Ce que le métier recommandait : visible même
                                   quand on l'a décoché, pour qu'un écart soit un
                                   choix et pas un oubli. */
                                <span className="font-mono text-[8px] uppercase tracking-wider text-text-muted">
                                  conseillé
                                </span>
                              )}
                            </span>
                            <span className="block text-[10px] leading-snug text-text-muted">
                              {mod.hint}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="panel p-4">
                  <p className="eyebrow mb-2">Couleur proposée</p>
                  <p className="mb-4 text-[11px] leading-snug text-text-muted">
                    Une proposition, pas une décision. Elle évite à la cliente d’ouvrir une
                    application grise le premier jour, et elle en change quand elle veut depuis ses
                    propres paramètres — le générateur ne fixe l’identité visuelle de personne.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ACCENTS.map((accent) => (
                      <button
                        key={accent.id}
                        type="button"
                        onClick={() => setAccentId(accent.id)}
                        title={accent.label}
                        aria-label={accent.label}
                        aria-pressed={accentId === accent.id}
                        className={`flex h-8 w-8 items-center justify-center border transition-transform ${
                          accentId === accent.id
                            ? 'border-text-primary scale-105'
                            : 'border-border hover:border-border-strong'
                        }`}
                      >
                        <span className="h-4 w-4" style={{ background: accent.value }} />
                      </button>
                    ))}
                  </div>
                </section>

                <section className="panel p-4">
                  <p className="eyebrow mb-3">Remise de l’accès</p>
                  <div className="flex flex-col gap-2">
                    <Choice
                      selected={handover === 'password'}
                      onSelect={() => setHandover('password')}
                      title="Mot de passe temporaire"
                      body="Se dicte au téléphone et ne périme pas. La cliente le change dans ses paramètres."
                    />
                    <Choice
                      selected={handover === 'invitation'}
                      onSelect={() => setHandover('invitation')}
                      title="Lien d’activation"
                      body="Elle choisit son mot de passe elle-même. Valable 7 jours, à usage unique."
                    />
                  </div>
                </section>

                {error && (
                  <p className="border border-danger/40 bg-danger-muted px-3 py-2 text-[12px] text-text-secondary">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void create()}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 bg-accent px-4 py-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {busy ? 'Création en cours…' : 'Créer cet espace de travail'}
                </button>
              </div>

              {/* ────────────── L'aperçu, collé pendant qu'on règle ────────────── */}
              <div className="lg:sticky lg:top-4 lg:self-start">
                <LivePreview
                  orgName={name}
                  logoDataUrl={logo}
                  modules={modules}
                  accentId={accentId}
                  seats={seats}
                />
                <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
                  Maquette fidèle de ce qui sera créé : les modules, leur rangement, le nom, le logo
                  et la couleur proposée. Le contenu reste muet — cette organisation n’a encore rien,
                  et inventer des chiffres ici ferait croire à des données.
                </p>
              </div>
            </motion.div>
          )}

          {step === 'remise' && result && (
            <motion.div
              key="remise"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto flex w-full max-w-xl flex-col gap-4"
            >
              {result.partial && (
                <p className="border border-warning/40 bg-warning-muted px-3 py-2 text-[12px] text-text-secondary">
                  {result.partial}
                </p>
              )}

              <section className="panel panel-ticks p-5">
                <p className="eyebrow mb-3">
                  {result.kind === 'password' ? 'Mot de passe temporaire' : 'Lien d’activation'}
                </p>
                <p className="mb-4 text-[13px] text-text-secondary">
                  Pour <span className="text-text-primary">{result.email}</span>, chez{' '}
                  <span className="text-text-primary">{result.orgName}</span>.
                  {result.expiresAt &&
                    ` Valable jusqu’au ${new Date(result.expiresAt).toLocaleDateString('fr-FR')}, une seule fois.`}
                </p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto border border-border bg-bg px-3 py-2.5 font-mono text-[12px] text-text-primary">
                    {result.secret}
                  </code>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard?.writeText(result.secret)}
                    className="flex flex-shrink-0 items-center gap-1.5 border border-border-strong px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors hover:bg-surface-hover"
                  >
                    <Copy size={12} strokeWidth={2} />
                    Copier
                  </button>
                </div>
                <p className="mt-3 text-[11px] leading-snug text-text-muted">
                  amn-api n’en garde que l’empreinte : quitter cet écran le perd définitivement.
                  Si c’est perdu, il faudra en réémettre un depuis le dossier de l’organisation.
                </p>
              </section>

              {/*
                LE GESTE SUIVANT, ÉCRIT (BLOC F).

                Deux liens à l'écran ne disent pas quoi en faire. Le retour était
                sans ambiguïté : « je ne comprends toujours pas concrètement
                comment envoyer un desktop à un client ». Cet écran commence donc
                par nommer l'action attendue, et donne le message tout fait —
                exactement ce qui avait résolu le même problème pour le lien
                d'appel.
              */}
              <section className="panel panel-ticks p-5">
                <p className="eyebrow mb-2">Ce qu’il reste à faire</p>
                <p className="mb-4 max-w-xl text-[13px] leading-relaxed text-text-secondary">
                  Copiez le message ci-dessous et envoyez-le à votre cliente, par courriel ou par
                  message. Il contient l’installateur, son identifiant et son accès, dans l’ordre
                  où elle doit s’en servir. Vous n’avez rien d’autre à préparer.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(
                        handoverMessage({
                          orgName: result.orgName,
                          email: result.email,
                          secret: result.secret,
                          kind: result.kind,
                          expiresAt: result.expiresAt,
                          download: result.download
                            ? {
                                url: result.download.url,
                                version: result.download.release.version,
                                byteSize: result.download.release.byteSize,
                              }
                            : null,
                          webUrl: result.webUrl,
                        }),
                      )
                      .then(() => {
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 2400);
                      });
                  }}
                  className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
                >
                  {copied ? <Check size={15} strokeWidth={2.5} /> : <Copy size={15} strokeWidth={2} />}
                  {copied ? 'Message copié' : 'Copier le message pour la cliente'}
                </button>
                {!result.download && (
                  <p className="mt-3 max-w-xl text-[11px] leading-relaxed text-text-muted">
                    Aucune version n’étant publiée, le message contiendra l’adresse web et l’accès
                    au compte — la cliente peut travailler depuis son navigateur en attendant.
                  </p>
                )}
                {/*
                  L'ABSENCE D'ADRESSE WEB SE DIT, ELLE NE SE DEVINE PAS.

                  Sans APP_BUSINESS_PUBLIC_URL côté amn-api, le message part
                  sans aucune adresse : la cliente qui le lit sur son téléphone
                  n'a strictement rien à ouvrir. C'est le genre de manque qu'on
                  ne découvre que par son message à elle — « je n'arrive pas à
                  l'ouvrir » —, donc il se dit ICI, avant l'envoi, à l'endroit
                  exact où on appuie sur le bouton.

                  La variable est bien celle du BUSINESS, pas APP_PUBLIC_URL qui
                  est l'adresse de notre application à nous : les deux étaient
                  confondues, et une cliente recevait donc l'adresse interne.
                  Nommer la mauvaise ici enverrait Aaron régler la mauvaise.
                */}
                {!result.webUrl && (
                  <p className="mt-3 max-w-xl border border-warning/40 bg-warning-muted px-3 py-2 text-[11px] leading-relaxed text-text-secondary">
                    <span className="text-text-primary">
                      Le message ne contiendra pas d’adresse web.
                    </span>{' '}
                    amn-api ne connaît pas l’adresse publique de l’application Business
                    (variable <span className="font-mono">APP_BUSINESS_PUBLIC_URL</span>, à ne pas
                    confondre avec <span className="font-mono">APP_PUBLIC_URL</span> qui est
                    l’adresse de la nôtre). Tant qu’elle n’est pas réglée, votre cliente ne pourra
                    ouvrir l’application ni depuis son téléphone, ni depuis un navigateur.
                  </p>
                )}
              </section>

              {/* ─────────── L'adresse web, pour qui veut la relire ─────────── */}
              {result.webUrl && (
                <section className="panel p-5">
                  <p className="eyebrow mb-3">Application web et téléphone</p>
                  <p className="mb-4 text-[13px] leading-relaxed text-text-secondary">
                    La même adresse pour tout le monde : l’application y apprend son organisation à
                    la connexion. Sur téléphone, « Ajouter à l’écran d’accueil » lui donne une
                    icône — c’est ce qui en fait une application plutôt qu’un onglet.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 overflow-x-auto border border-border bg-bg px-3 py-2.5 font-mono text-[12px] text-text-primary">
                      {result.webUrl}
                    </code>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(result.webUrl ?? '')}
                      className="flex flex-shrink-0 items-center gap-1.5 border border-border-strong px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors hover:bg-surface-hover"
                    >
                      <Copy size={12} strokeWidth={2} />
                      Copier
                    </button>
                  </div>
                </section>
              )}

              {/* ─────────── Le détail des deux liens, pour qui veut les relire ─────────── */}
              <section className="panel p-5">
                <p className="eyebrow mb-3">Installeur Windows</p>
                {result.download ? (
                  <>
                    <p className="mb-4 text-[13px] text-text-secondary">
                      Version{' '}
                      <span className="text-text-primary">{result.download.release.version}</span> ·{' '}
                      {(result.download.release.byteSize / 1024 / 1024).toFixed(1)} Mo · lien valable
                      jusqu’au{' '}
                      {new Date(result.download.expiresAt).toLocaleDateString('fr-FR')}.
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 overflow-x-auto border border-border bg-bg px-3 py-2.5 font-mono text-[12px] text-text-primary">
                        {result.download.url}
                      </code>
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard?.writeText(result.download?.url ?? '')}
                        className="flex flex-shrink-0 items-center gap-1.5 border border-border-strong px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors hover:bg-surface-hover"
                      >
                        <Copy size={12} strokeWidth={2} />
                        Copier
                      </button>
                    </div>
                    {/* L'empreinte n'est pas un ornement : elle permet à la
                        cliente de vérifier que l'octet reçu est bien le nôtre,
                        sans avoir à nous redemander quoi que ce soit. */}
                    <p className="mt-3 break-all font-mono text-[10px] leading-relaxed text-text-muted">
                      SHA-256 · {result.download.release.sha256}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mb-3 text-[13px] leading-relaxed text-text-secondary">
                      {result.downloadProblem ?? 'Aucun lien n’a pu être émis.'}
                    </p>
                    {/*
                      L'application Business est la MÊME pour toutes les
                      clientes : elle apprend son organisation, ses modules et sa
                      couleur à la connexion. Il n'y a donc pas d'installeur à
                      produire par cliente — un seul par version, et autant de
                      liens qu'on a de clientes. Le dire ici évite de chercher
                      un bouton « générer » qui n'a pas lieu d'exister.
                    */}
                    <p className="text-[11px] leading-relaxed text-text-muted">
                      L’application Business est la même pour toutes vos clientes : elle apprend son
                      organisation à la connexion. Il n’y a donc rien à générer par cliente — une
                      version publiée suffit, et chaque cliente en reçoit un lien.
                      <br />
                      Sur une machine Windows : <span className="text-text-secondary">npm run make:business</span>,
                      puis <span className="text-text-secondary">npm run publish:release</span>.
                    </p>
                  </>
                )}
              </section>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void enterOrganization(result.orgId)}
                  className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
                >
                  Ouvrir son espace
                  <ArrowRight size={14} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/tour/organisations')}
                  className="border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                >
                  Retour au registre
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="eyebrow">{label}</span>
      {children}
      <span className="text-[11px] leading-snug text-text-muted">{hint}</span>
    </label>
  );
}

function Choice({
  selected,
  onSelect,
  title,
  body,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-start gap-2.5 border px-3 py-2.5 text-left transition-colors ${
        selected ? 'border-border-strong bg-surface-hover' : 'border-border hover:border-border-strong'
      }`}
    >
      <span
        className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded-full border ${
          selected ? 'border-text-primary bg-text-primary' : 'border-border-strong'
        }`}
      />
      <span className="min-w-0">
        <span className="block text-[13px] text-text-primary">{title}</span>
        <span className="block text-[11px] leading-snug text-text-muted">{body}</span>
      </span>
    </button>
  );
}
