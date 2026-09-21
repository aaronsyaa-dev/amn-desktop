import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { EcranVide, useHaloSignal } from '../components/EtatEcran';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../auth/AuthContext';
import { isAdminRole } from '../auth/roles';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useProfiles } from '../state/ProfilesContext';
import { useMembers } from '../state/useMembers';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface GroupData {
  name: string;
  members: string[];
  createdBy: string;
  createdAt: string;
}
interface GroupMessageData {
  groupId: string;
  authorEmail: string;
  body: string;
  createdAt: string;
}

/*
  ═══════════════════════════════════════════════════════════════════════
  LE DIAGRAMME — trois cercles de MÊME RAYON qui se recouvrent à trois
  ═══════════════════════════════════════════════════════════════════════

  `RAYON` et `ECART` sont liés par une inégalité qui décide de tout :

    · `ECART * √3 < 2 * RAYON`  →  deux cercles quelconques se coupent ;
    · `ECART < RAYON`           →  les TROIS se coupent, donc la zone
                                    centrale existe.

  Avec 78 et 45 : 77,9 < 156 et 45 < 78. Les deux tiennent. Changer l'un des
  deux nombres sans vérifier ces inégalités ferait disparaître la zone
  centrale — c'est-à-dire l'objet même de l'écran.

  Le même rayon pour les trois est une règle du système de design, et une
  règle de lecture : un cercle plus gros se lirait comme un groupe plus
  important, alors que la taille d'un groupe se lit à ses JETONS, pas à son
  contour.
*/
const TOILE_L = 420;
const TOILE_H = 340;
const CENTRE_X = 210;
const CENTRE_Y = 160;
const RAYON = 78;
const ECART = 45;
const JETON_R = 13;
/** La rangée des sans-groupe, sous les cercles — dehors, jamais absents. */
const DEHORS_Y = 300;
/** Les trois directions, en degrés trigonométriques : haut, bas-gauche, bas-droite. */
const DIRECTIONS = [90, 210, 330];

interface Cercle {
  groupe: GroupData & { id: string };
  cx: number;
  cy: number;
  /** Le point où poser le nom du groupe, hors du cercle. */
  nx: number;
  ny: number;
}

function cerclesDe(trois: (GroupData & { id: string })[]): Cercle[] {
  /* À un seul groupe il n'y a pas de recouvrement à montrer : le cercle se
     pose au centre. À deux, ils s'opposent. À trois, le triangle. */
  const angles = trois.length === 1 ? [0] : trois.length === 2 ? [150, 30] : DIRECTIONS;
  const ecart = trois.length === 1 ? 0 : ECART;
  return trois.map((groupe, i) => {
    const rad = (angles[i] * Math.PI) / 180;
    const ux = Math.cos(rad);
    const uy = -Math.sin(rad);
    return {
      groupe,
      cx: CENTRE_X + ux * ecart,
      cy: CENTRE_Y + uy * ecart,
      nx: CENTRE_X + ux * (ecart + RAYON + 18),
      ny: CENTRE_Y + uy * (ecart + RAYON + 18),
    };
  });
}

/**
 * LE CENTRE D'UNE RÉGION, CALCULÉ ET NON DEVINÉ.
 *
 * Une région du diagramme (« dans A et C, mais pas dans B ») n'a pas de
 * formule courte : c'est une lunule bornée par trois arcs. Plutôt que de
 * poser des coordonnées à la main — qui seraient fausses dès qu'on touche au
 * rayon ou à l'écart — on ÉCHANTILLONNE la toile et on prend le barycentre
 * des points qui appartiennent exactement à cette région.
 *
 * Le pas de 3 px donne environ 15 000 points testés : imperceptible au rendu,
 * et exact à moins d'un pixel. `null` quand la région n'existe pas — auquel
 * cas personne ne peut s'y trouver, et rien n'est dessiné.
 */
function barycentreDeLaRegion(appartenance: boolean[], cercles: Cercle[]): { x: number; y: number } | null {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let x = 0; x <= TOILE_L; x += 3) {
    for (let y = 0; y <= CENTRE_Y + ECART + RAYON + 6; y += 3) {
      let bon = true;
      for (let i = 0; i < cercles.length && bon; i += 1) {
        const dx = x - cercles[i].cx;
        const dy = y - cercles[i].cy;
        if ((dx * dx + dy * dy <= RAYON * RAYON) !== appartenance[i]) bon = false;
      }
      if (!bon) continue;
      sx += x;
      sy += y;
      n += 1;
    }
  }
  return n === 0 ? null : { x: sx / n, y: sy / n };
}

interface Jeton {
  email: string;
  nom: string;
  initiales: string;
  x: number;
  y: number;
  /** Vrai pour la seule personne de la zone centrale. */
  ambre: boolean;
}

const initialesDe = (nom: string) =>
  nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0]?.toUpperCase() ?? '')
    .join('');

/**
 * LES GROUPES — des fils à plusieurs, par sujet ou par équipe.
 *
 * Pour qui : une organisation où « la boutique », « les livraisons » et « le
 * bureau » n'ont pas les mêmes conversations. Ce que ça règle : le fil unique
 * qui mélange tout. Un groupe est une liste de personnes et un nom ; son fil
 * ne s'affiche qu'à ses membres.
 *
 * ## Ce qui domine : les recouvrements, pas la liste
 *
 * L'écran montrait une bande de salles avec leur dernier mot. C'était utile
 * pour choisir où entrer, et ça reste — en pied. Mais une liste de groupes ne
 * peut pas dire la seule chose que cette famille a d'intéressant à cinq
 * personnes : QUI APPARTIENT À PLUSIEURS. Il faut lire trois listes et faire
 * l'intersection de tête, et personne ne le fait.
 *
 * Trois cercles de même rayon qui se recouvrent le disent sans un mot. On voit
 * du premier coup d'œil qui tient deux groupes, qui n'en tient qu'un, et qui
 * n'est dans aucun — celui-là est dessiné DEHORS, sous les cercles, parce que
 * ne pas être dans un groupe est un fait, pas une absence de fait.
 *
 * La géométrie, et pourquoi elle n'est pas négociable, sont dans l'en-tête des
 * constantes. Les positions des jetons ne sont pas écrites à la main : elles
 * sont le barycentre échantillonné de chaque région, donc elles suivent le
 * rayon et l'écart si on les change un jour.
 *
 * ## L'ambre : la personne qui fait le pont
 *
 * La zone centrale et la seule personne qui s'y trouve. Elle n'apparaît QUE
 * s'il y a exactement une personne au centre — à zéro il n'y a pas de pont, à
 * deux il n'y a pas de dépendance. C'est ce qui fait de cet ambre une
 * décision (« que se passe-t-il quand elle est absente ») et non une
 * décoration.
 */
export function GroupsScreen() {
  const { t } = useLangue();
  const { user, role } = useAuth();
  const { upsert, remove } = useSync();
  const { profileFor } = useProfiles();
  const { membres } = useMembers();
  const groupes = useCollection<GroupData>('groups');
  const messages = useCollection<GroupMessageData>('groupMessages');
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);
  const [nom, setNom] = useState('');
  const [choisis, setChoisis] = useState<string[]>([]);
  const [texte, setTexte] = useState('');
  const fin = useRef<HTMLDivElement | null>(null);
  const moi = user?.email ?? '';
  const admin = isAdminRole(role);

  const dernierMotDe = useCallback(
    (groupeId: string) => {
      const duGroupe = messages.filter((m) => m.groupId === groupeId);
      if (duGroupe.length === 0) return null;
      return duGroupe.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
    },
    [messages],
  );
  const miens = useMemo(
    () =>
      groupes
        .filter((g) => admin || (g.members ?? []).includes(moi))
        .sort((a, b) => {
          const da = dernierMotDe(a.id)?.createdAt ?? '';
          const db = dernierMotDe(b.id)?.createdAt ?? '';
          if (da === db) return a.name.localeCompare(b.name, 'fr');
          return db.localeCompare(da);
        }),
    [groupes, dernierMotDe, moi, admin],
  );

  /*
    TROIS CERCLES, ET PAS QUATRE.

    ARBITRAGE, dit à l'écran et pas seulement ici : au-delà de trois groupes,
    un diagramme cesse d'être lisible — quatre cercles de même rayon ne
    peuvent même pas produire les seize régions qu'il faudrait. Le diagramme
    porte donc les TROIS PLUS PEUPLÉS, et le pied de page porte tous les
    autres. La bande sous le diagramme le dit quand le cas se présente ; elle
    se tait quand il ne se présente pas.
  */
  const trois = useMemo(
    () => [...miens].sort((a, b) => (b.members ?? []).length - (a.members ?? []).length || a.name.localeCompare(b.name, 'fr')).slice(0, 3),
    [miens],
  );
  const cercles = useMemo(() => cerclesDe(trois), [trois]);

  /*
    LES JETONS — une personne, une région, une position calculée.

    Les gens d'une même région se répartissent sur un petit cercle autour du
    barycentre, jamais empilés : deux jetons confondus diraient « une seule
    personne ici », et c'est justement le nombre qui compte au centre.
  */
  const { jetons, auCentre } = useMemo(() => {
    const parRegion = new Map<string, { email: string; appartenance: boolean[] }[]>();
    for (const membre of membres) {
      const appartenance = cercles.map((c) => (c.groupe.members ?? []).includes(membre.email));
      const cle = appartenance.map((v) => (v ? '1' : '0')).join('');
      const liste = parRegion.get(cle);
      if (liste) liste.push({ email: membre.email, appartenance });
      else parRegion.set(cle, [{ email: membre.email, appartenance }]);
    }
    const toutes = cercles.length > 0 ? cercles.map(() => '1').join('') : '';
    const centre = parRegion.get(toutes) ?? [];
    const seulAuCentre = cercles.length >= 2 && centre.length === 1 ? centre[0].email : null;

    const poses: Jeton[] = [];
    let dehorsRang = 0;
    const dehorsTotal = (parRegion.get(cercles.map(() => '0').join('')) ?? []).length;
    for (const [cle, gens] of parRegion) {
      const dedans = cle.includes('1');
      const brut = dedans ? barycentreDeLaRegion(gens[0].appartenance, cercles) : null;
      /*
        LA POUSSÉE VERS L'EXTÉRIEUR — 14 px, et pourquoi elle existe.

        Le barycentre d'une lunule « dans A et B, pas dans C » se trouve juste
        au bord de la zone centrale : le jeton s'y pose correctement, mais son
        NOM, écrit dessous et centré, déborde sur l'ambre et devient du texte
        clair sur fond ambre — la seule chose que le système de design
        interdit sans exception. On éloigne donc ces jetons du centre de
        quelques pixels. Les régions à une seule appartenance sont déjà loin,
        et la zone centrale ne bouge pas : c'est elle le point de fuite.
      */
      const appartenances = gens[0].appartenance.filter(Boolean).length;
      const pousse = appartenances >= 2 && appartenances < cercles.length ? 14 : 0;
      let ancre = brut;
      if (brut && pousse > 0) {
        const dx = brut.x - CENTRE_X;
        const dy = brut.y - CENTRE_Y;
        const norme = Math.hypot(dx, dy) || 1;
        ancre = { x: brut.x + (dx / norme) * pousse, y: brut.y + (dy / norme) * pousse };
      }
      gens.forEach((gars, i) => {
        const nomComplet = profileFor(gars.email).name;
        let x: number;
        let y: number;
        if (!dedans) {
          /* Dehors : une rangée sous les cercles, centrée. */
          x = CENTRE_X + (dehorsRang - (dehorsTotal - 1) / 2) * 96;
          y = DEHORS_Y;
          dehorsRang += 1;
        } else if (!ancre) {
          /* Région géométriquement vide alors que quelqu'un s'y trouve : ne
             peut pas arriver avec des cercles qui se coupent, mais on ne
             perd personne pour autant — le jeton part au centre. */
          x = CENTRE_X;
          y = CENTRE_Y;
        } else if (gens.length === 1) {
          x = ancre.x;
          y = ancre.y;
        } else {
          const angle = (i / gens.length) * Math.PI * 2 - Math.PI / 2;
          x = ancre.x + Math.cos(angle) * (JETON_R + 6);
          y = ancre.y + Math.sin(angle) * (JETON_R + 6);
        }
        poses.push({
          email: gars.email,
          nom: nomComplet,
          initiales: initialesDe(nomComplet),
          x,
          y,
          ambre: gars.email === seulAuCentre,
        });
      });
    }
    return { jetons: poses, auCentre: seulAuCentre };
  }, [membres, cercles, profileFor]);

  const halo = useHaloSignal(Boolean(auCentre));

  /* L'ACTIVITÉ DU MOIS — trente jours glissants, par groupe. */
  const ilYaUnMois = useMemo(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), []);
  const activiteDe = useCallback(
    (groupeId: string) => messages.filter((m) => m.groupId === groupeId && m.createdAt >= ilYaUnMois).length,
    [messages, ilYaUnMois],
  );
  const muet = useMemo(() => miens.find((g) => activiteDe(g.id) === 0) ?? null, [miens, activiteDe]);

  const groupe = miens.find((g) => g.id === ouvert) ?? null;
  const fil = useMemo(
    () => (groupe ? messages.filter((m) => m.groupId === groupe.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : []),
    [messages, groupe],
  );
  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'end' });
  }, [fil.length, ouvert]);

  const creer = async () => {
    if (!nom.trim() || !moi) return;
    const id = uid('grp');
    await upsert('groups', id, { name: nom.trim(), members: [...new Set([moi, ...choisis])], createdBy: moi, createdAt: new Date().toISOString() });
    setNom('');
    setChoisis([]);
    setCreation(false);
    setOuvert(id);
  };
  const envoyer = async () => {
    const corps = texte.trim();
    if (!corps || !groupe || !moi) return;
    setTexte('');
    await upsert('groupMessages', uid('gm'), { groupId: groupe.id, authorEmail: moi, body: corps, createdAt: new Date().toISOString() });
  };
  const dissoudre = async (g: GroupData & { id: string }) => {
    for (const m of messages.filter((x) => x.groupId === g.id)) await remove('groupMessages', m.id);
    await remove('groups', g.id);
    setOuvert(null);
  };

  const vide = miens.length === 0;

  return (
    <EcranVide quand={vide && !creation} premierJour={vide && !creation}>
      <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={staggerItem}>
          <ScreenHeader
            eyebrow={t('collectif.surtitre', { module: t('groupes.titre') })}
            title={t('groupes.titre')}
            description={t('groupes.description')}
            phraseVide={t('groupes.vide.phrase')}
            stats={[
              { label: t('groupes.stat.groupes'), value: miens.length },
              { label: t('groupes.stat.messages'), value: messages.filter((m) => miens.some((g) => g.id === m.groupId)).length },
            ]}
            actions={
              <button type="button" onClick={() => setCreation((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
                <Plus size={16} strokeWidth={2} /> {t('groupes.nouveau')}
              </button>
            }
          />
        </motion.div>

        {creation && (
          <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void creer(); }} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder={t('groupes.champNom')} aria-label={t('groupes.champNom')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
            <p className="eyebrow">{t('groupes.membres')}</p>
            <div className="flex flex-wrap gap-2">
              {membres.filter((m) => m.email !== moi).map((m) => {
                const on = choisis.includes(m.email);
                return (
                  <button key={m.id} type="button" aria-pressed={on} onClick={() => setChoisis((prev) => (on ? prev.filter((e) => e !== m.email) : [...prev, m.email]))} className={`flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm md:min-h-0 md:py-1.5 ${on ? 'border-accent text-text-primary' : 'border-border text-text-secondary'}`}>
                    <UserAvatar email={m.email} size={20} /> {profileFor(m.email).name}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={!nom.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('groupes.creer')}</button>
              <button type="button" onClick={() => setCreation(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
            </div>
          </motion.form>
        )}

        {vide ? (
          !creation && (
            <motion.div variants={staggerItem}>
              <FirstRun title={t('groupes.vide.titre')} action={{ label: t('groupes.vide.action'), onClick: () => setCreation(true) }}>{t('groupes.vide.texte')}</FirstRun>
            </motion.div>
          )
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* ═══ L'OBJET DOMINANT : les recouvrements ═══ */}
              <motion.section variants={staggerItem} className="panel-raised p-5 sm:p-6">
                <p className="eyebrow mb-4">{t('groupes.quiAppartientAQuoi')}</p>
                <svg viewBox={`0 0 ${TOILE_L} ${TOILE_H}`} className={`w-full ${halo}`} role="img" aria-label={t('groupes.diagrammeAria')}>
                  <defs>
                    {/*
                      LA ZONE CENTRALE, EXACTE.

                      Un `clipPath` qui porte lui-même un `clip-path` INTERSECTE
                      les deux formes. Trois cercles emboîtés de cette façon
                      donnent donc l'intersection exacte des trois — le vrai
                      triangle curviligne, pas une approximation posée à la
                      main qui se décalerait au premier changement de rayon.
                    */}
                    {cercles.map((c, i) => (
                      <clipPath key={c.groupe.id} id={`zone-${i}`} clipPathUnits="userSpaceOnUse">
                        <circle cx={c.cx} cy={c.cy} r={RAYON} clipPath={i > 0 ? `url(#zone-${i - 1})` : undefined} />
                      </clipPath>
                    ))}
                  </defs>

                  {auCentre && cercles.length >= 2 && (
                    <rect
                      x={0}
                      y={0}
                      width={TOILE_L}
                      height={TOILE_H}
                      fill="var(--color-signal)"
                      clipPath={`url(#zone-${cercles.length - 1})`}
                      data-signal-groupe="le-pont"
                    />
                  )}

                  {cercles.map((c) => (
                    <circle key={c.groupe.id} cx={c.cx} cy={c.cy} r={RAYON} fill="none" stroke="var(--color-border-strong)" strokeWidth={1.5} />
                  ))}

                  {/* Les noms des groupes, hors des cercles. */}
                  {cercles.map((c) => (
                    <text
                      key={c.groupe.id}
                      x={c.nx}
                      y={c.ny}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="font-mono"
                      fontSize={10.5}
                      letterSpacing="0.14em"
                      fill="var(--color-text-secondary)"
                    >
                      {c.groupe.name.toUpperCase()}
                    </text>
                  ))}

                  {jetons.map((j) => (
                    <g key={j.email} data-signal-groupe={j.ambre ? 'le-pont' : undefined}>
                      <circle
                        cx={j.x}
                        cy={j.y}
                        r={JETON_R}
                        fill={j.ambre ? 'var(--color-signal)' : 'var(--color-elevated)'}
                        stroke={j.ambre ? 'var(--color-signal)' : 'var(--color-border-strong)'}
                        strokeWidth={1.5}
                      />
                      <text
                        x={j.x}
                        y={j.y + 0.5}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={10}
                        fontWeight={600}
                        fill={j.ambre ? 'var(--color-signal-ink)' : 'var(--color-text-body)'}
                      >
                        {j.initiales}
                      </text>
                      {/* Le nom : sur plaque ambre à encre sombre pour la
                          personne du centre, en gris pour les autres. */}
                      {j.ambre && <rect x={j.x - 34} y={j.y + JETON_R + 3} width={68} height={14} fill="var(--color-signal)" />}
                      <text
                        x={j.x}
                        y={j.y + JETON_R + 10.5}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={9.5}
                        fontWeight={j.ambre ? 700 : 400}
                        fill={j.ambre ? 'var(--color-signal-ink)' : 'var(--color-text-muted)'}
                      >
                        {j.nom}
                      </text>
                    </g>
                  ))}

                  {/* La ligne de sol : ce qui est sous elle est hors des groupes. */}
                  {jetons.some((j) => j.y === DEHORS_Y) && (
                    <>
                      <line x1={24} y1={DEHORS_Y - 34} x2={TOILE_L - 24} y2={DEHORS_Y - 34} stroke="var(--color-border)" strokeWidth={1} strokeDasharray="3 4" />
                      {/* SOUS le trait, et à gauche : au-dessus, l'intitulé se
                          posait sur le nom d'un des groupes du bas ; à droite,
                          sur l'autre. L'espace sous le trait, lui, n'appartient
                          qu'aux sans-groupe. */}
                      <text x={24} y={DEHORS_Y - 22} className="font-mono" fontSize={9.5} letterSpacing="0.14em" fill="var(--color-text-muted)">
                        {t('groupes.dansAucunGroupe').toUpperCase()}
                      </text>
                    </>
                  )}
                </svg>
                {miens.length > 3 && (
                  <p className="mt-4 border-t border-border-strong pt-3 text-xs leading-relaxed text-text-muted">
                    {t('groupes.troisPlusPeuples', { n: miens.length })}
                  </p>
                )}
              </motion.section>

              {/* À DROITE — ce que veut dire être au centre. */}
              <motion.aside variants={staggerItem} className="panel p-4">
                <p className="eyebrow mb-3">{t('groupes.etreAuCentre')}</p>
                {auCentre ? (
                  <>
                    <p className="text-[19px] font-semibold leading-tight text-text-primary">{profileFor(auCentre).name}</p>
                    <p className="mt-2 text-sm leading-relaxed text-text-body">{t('groupes.lePont', { nom: profileFor(auCentre).name })}</p>
                    <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-text-secondary">
                      {t('groupes.sansElle', { nom: profileFor(auCentre).name })}
                    </p>
                  </>
                ) : (
                  <p className="text-sm leading-relaxed text-text-secondary">{t('groupes.personneAuCentre')}</p>
                )}
              </motion.aside>
            </div>

            {/* EN PIED — les groupes, leurs membres, leur activité du mois. */}
            <motion.section variants={staggerItem} className="panel">
              <p className="eyebrow border-b border-border px-4 py-2.5">{t('groupes.lesSalles')}</p>
              <ul className="flex flex-col gap-px bg-border">
                {miens.map((g) => {
                  const dernier = dernierMotDe(g.id);
                  const actives = activiteDe(g.id);
                  const actif = ouvert === g.id;
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => setOuvert(actif ? null : g.id)}
                        aria-current={actif ? 'true' : undefined}
                        className={`input-focus flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition-colors ${actif ? 'bg-elevated' : 'bg-surface hover:bg-surface-hover'}`}
                      >
                        <span className="flex flex-shrink-0 -space-x-1.5">
                          {(g.members ?? []).slice(0, 5).map((e) => (
                            <UserAvatar key={e} email={e} size={22} />
                          ))}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] text-text-primary">{g.name}</span>
                          <span className="block truncate text-xs text-text-muted">
                            {dernier ? `${profileFor(dernier.authorEmail).name} · ${dernier.body}` : t('groupes.premier')}
                          </span>
                        </span>
                        <span className="flex-shrink-0 text-right">
                          <span className="block font-mono text-[11px] tabular-nums text-text-secondary">
                            {actives === 0 ? t('groupes.rienCeMois') : t('groupes.nCeMois', { n: actives })}
                          </span>
                          {dernier && (
                            <span className="block font-mono text-[9px] uppercase tracking-wider text-text-muted">{relativeTime(dernier.createdAt)}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {/* Le constat qu'un groupe existe mais ne vit pas — dit une fois,
                  sous la liste, et seulement quand c'est vrai. */}
              {muet && (
                <p className="border-t border-border px-4 py-3 text-sm leading-relaxed text-text-secondary">
                  {t('groupes.existeMaisNeVitPas', { nom: muet.name })}
                </p>
              )}
            </motion.section>

            {groupe && (
              <motion.div variants={staggerItem} className="flex min-h-0 flex-col border border-border bg-surface">
                <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <button type="button" onClick={() => setOuvert(null)} aria-label={t('dm.retour')} className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover"><ArrowLeft size={16} /></button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{groupe.name}</p>
                    <p className="truncate text-xs text-text-muted">{(groupe.members ?? []).map((e) => profileFor(e).name).join(', ')}</p>
                  </div>
                  {(groupe.createdBy === moi || admin) && (
                    <button type="button" onClick={() => void dissoudre(groupe)} aria-label={t('groupes.dissoudre')} title={t('groupes.dissoudre')} className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:text-danger"><Trash2 size={14} /></button>
                  )}
                </header>
                <div className="flex min-h-[32vh] flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
                  {fil.length === 0 && <p className="m-auto text-sm text-text-muted">{t('groupes.premier')}</p>}
                  {fil.map((m) => {
                    const mien = m.authorEmail === moi;
                    return (
                      <div key={m.id} className={`group flex max-w-[80%] gap-2 ${mien ? 'self-end flex-row-reverse' : 'self-start'}`}>
                        {!mien && <UserAvatar email={m.authorEmail} size={24} />}
                        <div className={`flex flex-col ${mien ? 'items-end' : 'items-start'}`}>
                          {!mien && <span className="text-[11px] text-text-muted">{profileFor(m.authorEmail).name}</span>}
                          <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed [overflow-wrap:anywhere] ${mien ? 'bg-accent-muted' : 'bg-bg'} text-text-primary`}>{m.body}</div>
                          <span className="mt-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                            {relativeTime(m.createdAt)}
                            {(mien || admin) && (
                              <button type="button" onClick={() => void remove('groupMessages', m.id)} aria-label={t('dm.supprimer')} title={t('dm.supprimer')} className="opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100"><Trash2 size={11} /></button>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={fin} />
                </div>
                <form onSubmit={(e) => { e.preventDefault(); void envoyer(); }} className="flex items-center gap-2 border-t border-border p-2">
                  <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={t('groupes.ecrire', { nom: groupe.name })} aria-label={t('groupes.ecrire', { nom: groupe.name })} className="input-focus min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
                  <button type="submit" disabled={!texte.trim()} aria-label={t('dm.envoyer')} className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-bg disabled:opacity-40"><ArrowUp size={16} strokeWidth={2.5} /></button>
                </form>
              </motion.div>
            )}
          </>
        )}
      </motion.section>
    </EcranVide>
  );
}
