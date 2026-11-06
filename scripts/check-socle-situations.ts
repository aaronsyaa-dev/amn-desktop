/**
 * Contrôle des SITUATIONS DU SOCLE — états, chargements, confirmations, toasts (LOT-00, écran H43).
 *
 * Sans navigateur, sans build, sans réseau (modèle : `check-socle.ts`, outils : `lib/essai-socle.ts`).
 * Il prouve ce qui se prouve sans écran :
 *
 *   1. LES TEXTES, mot pour mot, rubriques 4, 6 et 8 de la fiche H43 — espaces insécables comprises, variables
 *      à la place des noms d'exemple, jamais de « ! », jamais de code d'erreur.
 *   2. LES RÔLES ARIA : `status` (chargement, toast), `alert` (erreur), `alertdialog` + `aria-modal` (confirmation).
 *   3. JAMAIS DE ZONE MORTE : chaque état porte au moins un bouton nommé ; le bouton d'action est blanc, jamais rouge.
 *   4. LES COTES, lues dans `situations.css` et additionnées : tuile d'icône 48, boutons 31, squelette (34, 122 × 10,
 *      78 × 8, 42 × 10, pas 50), boîte 276 × 148, toast 276 × 79 + barre de 3 px, tuiles 314 × 330, écarts 22 et 20,
 *      marges 59 — le tout au pixel près, sans dessiner un seul pixel.
 *   5. LES COULEURS : aucun `#hex` ni `rgb()` hors des trois jetons `--sc-…`, chaque `var(--…)` existe, aucune
 *      encre « discret » en texte, aucune couleur en dur dans les composants.
 *   6. LES RÈGLES DU TEMPS, sur de la logique pure (`regles.ts`, sans React) et une fausse horloge : le minuteur du
 *      toast (8 s, pause, reprise, raisons cumulées), la pile de trois, le chargement différé (150 ms, 400 ms, 10 s).
 *   7. LA PLANCHE H43 v3 : neuf mini-fenêtres en situation (440 × 239, écart 16), aucun nom propre en dur ; et les
 *      tailles COMPACTES de la v3 (bloc d'état, confirmation, toast, squelettes) à côté des tailles standard.
 *
 * Ce qu'il ne voit pas — le piège de focus, Échap, le retour du focus — vit dans la pile de `pileCalques.ts`
 * (`check:calques`) ; ici on vérifie que le dialogue y est bien branché et qu'il a ce que la pile attend.
 *
 *   npm run check:socle-situations
 */

import fs from 'node:fs';
import path from 'node:path';
import { assert, attr, chargerRendu, charger, creerEssais, lire, racine, sansCommentaires } from './lib/essai-socle.ts';

const essais = creerEssais('Socle de la refonte — situations (H43)');
const dit = essais.dit;

const NBSP = '\u00A0';
/** Les apostrophes de la fiche sont droites ; le socle emploie l'apostrophe typographique (cf. `check:langue`). */
const typo = (s: string) => s.replace(/'/g, '’');
/** Le texte d'un rendu : sans balises, entités décodées, espaces insécables conservés. */
const texte = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/* ── Le rendu des briques ─────────────────────────────────────────────────── */

type H = (type: unknown, props?: Record<string, unknown> | null, ...enfants: unknown[]) => unknown;
const S = await chargerRendu<Record<string, unknown>>(
  [
    "import { EtatVideInvitation, EtatHorsConnexion, EtatAccesRefuse, EtatAucunResultat, EtatErreurChargement, EtatChargement, SqueletteLignes, Toast, AvisCollaboration, SANS_ACTION } from '../src/socle/ui';",
    "import { DialogueConfirmationEnPlace } from '../src/socle/ui/situations/DialogueConfirmation';",
  ].join('\n'),
  ['EtatVideInvitation', 'EtatHorsConnexion', 'EtatAccesRefuse', 'EtatAucunResultat', 'EtatErreurChargement', 'EtatChargement', 'SqueletteLignes', 'Toast', 'AvisCollaboration', 'SANS_ACTION', 'DialogueConfirmationEnPlace'],
);
const h = S.h as H;
const rendre = S.rendre;
const sansAction = S.SANS_ACTION;

/* Des valeurs d'exemple INVENTÉES pour l'essai : elles prouvent que ce sont des variables. */
const V = { objet: 'dossier', objets: 'dossiers', terme: 'zzq', proche: 'Cabinet Essai', prenom: 'Yanis', nom: 'Fiche Essai' };

const rendus = {
  vide: rendre(h(S.EtatVideInvitation, { objet: V.objet, famille: 'contacts', onAjouter: sansAction, onImporter: sansAction })),
  videSeul: rendre(h(S.EtatVideInvitation, { objet: V.objet, onAjouter: sansAction })),
  videLecture: rendre(h(S.EtatVideInvitation, { objet: V.objet, lectureSeule: true, onAide: sansAction })),
  hors: rendre(h(S.EtatHorsConnexion, { onReessayer: sansAction })),
  acces: rendre(h(S.EtatAccesRefuse, { prenom: V.prenom, onDemander: sansAction })),
  accesEnvoye: rendre(h(S.EtatAccesRefuse, { prenom: V.prenom, onDemander: sansAction, demandeEnvoyee: true })),
  aucunProche: rendre(h(S.EtatAucunResultat, { terme: V.terme, proche: V.proche, onVoirProche: sansAction })),
  aucunSans: rendre(h(S.EtatAucunResultat, { terme: V.terme, onEffacer: sansAction })),
  erreur: rendre(h(S.EtatErreurChargement, { objets: V.objets, onReessayer: sansAction })),
  chargement: rendre(h(S.EtatChargement, { objets: V.objets, statique: true })),
};
const dialogue = (extra: Record<string, unknown> = {}) =>
  rendre(
    h(S.DialogueConfirmationEnPlace, {
      ouvert: true,
      onAnnuler: sansAction,
      onConfirmer: sansAction,
      titre: `Supprimer «${NBSP}${V.nom}${NBSP}»${NBSP}?`,
      texte: `Le ${V.objet} ira dans la corbeille pendant 30 jours. Vous pourrez le restaurer.`,
      libelleAction: 'À la corbeille',
      ...extra,
    }),
  );
const toast = (extra: Record<string, unknown> = {}) =>
  rendre(h(S.Toast, { type: 'succes', titre: `Facture envoyée à ${V.nom}`, detail: 'Disparaît dans 8 s', onAnnuler: sansAction, ...extra }));
const avis = rendre(h(S.AvisCollaboration, { noms: ['Robin', V.prenom], prenom: V.prenom, onDifferences: sansAction, onGarderLesDeux: sansAction }));

const boutons = (html: string) => [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => texte(m[1]).trim());

/* ── 1. Les textes ────────────────────────────────────────────────────────── */

await dit('modèle 1 : « Aucun {objet} pour l’instant », texte, « Ajouter » + « Importer » — l’objet est une variable', () => {
  const t = texte(rendus.vide);
  assert.ok(t.includes(typo(`Aucun ${V.objet} pour l'instant`)), t);
  assert.ok(t.includes(`Ajoutez votre premier ${V.objet} ou importez un fichier.`), t);
  assert.deepEqual(boutons(rendus.vide), ['Ajouter', 'Importer']);
  assert.match(rendus.vide, /data-ton="famille"[^>]*data-famille="contacts"/);
  // Sans import possible : un seul bouton primaire, et le texte ne parle plus d'importer.
  assert.deepEqual(boutons(rendus.videSeul), ['Ajouter']);
  assert.ok(!/importez/.test(texte(rendus.videSeul)));
  assert.ok(texte(rendus.videSeul).includes(`Ajoutez votre premier ${V.objet}.`));
  // Un module en lecture seule garde une action.
  assert.deepEqual(boutons(rendus.videLecture), [typo("Voir l'aide")]);
});

await dit('modèle 3 : hors connexion — titre, texte sur 3 lignes, « Réessayer »', () => {
  const t = texte(rendus.hors);
  assert.ok(t.includes('Vous êtes hors connexion'));
  assert.ok(t.includes('Vos modifications sont gardées sur cet appareil et partiront dès le retour du réseau.'));
  assert.deepEqual(boutons(rendus.hors), ['Réessayer']);
  assert.match(rendus.hors, /data-ton="attention"/);
});

await dit('modèle 4 : accès non autorisé — {prénom} en variable, rien du contenu de la page, « Demande envoyée » ensuite', () => {
  const t = texte(rendus.acces);
  assert.ok(t.includes('Cette page est réservée'));
  assert.ok(t.includes(typo(`Demandez l'accès à ${V.prenom}, il reçoit votre demande tout de suite.`)), t);
  assert.deepEqual(boutons(rendus.acces), [typo("Demander l'accès")]);
  const e = texte(rendus.accesEnvoye);
  assert.ok(e.includes(`${V.prenom} a été prévenu.`), e);
  assert.deepEqual(boutons(rendus.accesEnvoye), ['Demande envoyée']);
  assert.match(rendus.accesEnvoye, /<button[^>]*\sdisabled=""/, 'le bouton est inactif une fois la demande partie');
});

await dit('modèle 5 : aucun résultat — guillemets français et espaces insécables, proposition proche ou « Effacer la recherche »', () => {
  const t = texte(rendus.aucunProche);
  assert.ok(t.includes(`Rien pour «${NBSP}${V.terme}${NBSP}»`), t);
  assert.ok(t.includes(`Vouliez-vous dire ${V.proche}${NBSP}? Sinon, essayez un autre mot.`), t);
  assert.deepEqual(boutons(rendus.aucunProche), [`Voir ${V.proche}`]);
  const s = texte(rendus.aucunSans);
  assert.ok(s.includes('Essayez un autre mot ou effacez la recherche.'), s);
  assert.deepEqual(boutons(rendus.aucunSans), ['Effacer la recherche']);
});

await dit('erreur de chargement (rubrique 8, modèle 9) : ton critique, titre sans point, accord au féminin, « Réessayer », annoncée en alerte', () => {
  const t = texte(rendus.erreur);
  assert.ok(t.includes(typo(`Les ${V.objets} n'ont pas pu être chargés`)), t);
  assert.ok(!t.includes('chargés.'), 'un titre de modèle ne finit pas par un point (v3)');
  assert.ok(t.includes(typo("Rien n'est perdu. Réessayez dans un instant.")), t);
  assert.deepEqual(boutons(rendus.erreur), ['Réessayer']);
  assert.match(rendus.erreur, /role="alert"[^>]*data-ton="critique"/);
  const f = texte(rendre(h(S.EtatErreurChargement, { objets: 'prévisions', genre: 'feminin', onReessayer: sansAction, apres: 'nouvel essai dans 20 s', taille: 'compact' })));
  assert.ok(f.includes(typo("Les prévisions n'ont pas pu être chargées")), f);
  assert.ok(f.includes('nouvel essai dans 20 s'), 'ce qui suit « Réessayer » sur la même ligne');
});

await dit('modèle 2 : « Chargement de vos {objets} » ; modèle 6 et 7 : boutons et détail de la fiche', () => {
  assert.ok(texte(rendus.chargement).includes(`Chargement de vos ${V.objets}`));
  const d = dialogue();
  assert.deepEqual(boutons(d), ['Annuler', 'À la corbeille']);
  assert.ok(texte(d).includes(`Supprimer «${NBSP}${V.nom}${NBSP}»${NBSP}?`));
  assert.deepEqual(boutons(toast()), ['Annuler']);
  assert.ok(texte(toast()).includes('Disparaît dans 8 s'));
});

await dit('modèle 8 : « {prénom} modifie aussi cette page », « fusionnés » en gras, « Différences » + « Garder les deux »', () => {
  const t = texte(avis);
  assert.ok(t.includes(`${V.prenom} modifie aussi cette page`), t);
  assert.ok(t.includes(typo("Vos changements et les siens sont fusionnés. Rien n'est écrasé, une copie est gardée.")), t);
  assert.match(avis, /<b>fusionnés<\/b>/);
  assert.deepEqual(boutons(avis), ['Différences', 'Garder les deux']);
  assert.equal(attr(avis, 'aria-label'), 'Personnes sur cette page', 'la pile d’avatars est nommée, pas épelée');
});

await dit('les mots : mêmes clés en fr et en, mêmes variables, aucun « ! », aucun code d’erreur, aucune formule « Oups »', async () => {
  const { EN_SITUATIONS, FR_SITUATIONS } = await charger<{ EN_SITUATIONS: Record<string, string>; FR_SITUATIONS: Record<string, string> }>('src/socle/mots/situations.ts');
  const page = await charger<{ EN_H43: Record<string, string>; FR_H43: Record<string, string> }>('src/refonte/systeme/h43-etats/i18n.ts');
  const lots: Array<[string, Record<string, string>, Record<string, string>]> = [
    ['socle', EN_SITUATIONS, FR_SITUATIONS],
    ['page', page.EN_H43, page.FR_H43],
  ];
  const vars = (v: string) => [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const [nom, en, fr] of lots) {
    assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort(), `${nom} : clés`);
    for (const cle of Object.keys(en)) {
      assert.equal(vars(fr[cle]), vars(en[cle]), `${nom} ${cle} : variables`);
      for (const [langue, v] of [['en', en[cle]], ['fr', fr[cle]]]) {
        assert.ok(v.trim(), `${nom} ${langue} ${cle} vide`);
        assert.ok(!v.includes('!'), `${nom} ${langue} ${cle} : point d’exclamation`);
        assert.ok(!/\b(oups|oops|whoops|uh[- ]oh)\b/i.test(v), `${nom} ${langue} ${cle} : formule familière`);
        assert.ok(!/\b(erreur|error)\s*(n°|no\.?|code)?\s*\d|\b[1-5]\d\d\b|\bhttp|ERR_|exception|stack|undefined|\bnull\b/i.test(v.replace(/\b30 jours\b/, '')), `${nom} ${langue} ${cle} : code ou trace technique`);
        if (langue === 'fr') {
          assert.ok(!/[a-zà-ÿ]'[a-zà-ÿ]/i.test(v), `${nom} fr ${cle} : apostrophe droite`);
          // Typographie : l'espace insécable avant « ? » et « : » ; aucune espace simple devant.
          assert.ok(!/ [?:;!]/.test(v), `${nom} fr ${cle} : espace simple avant la ponctuation haute`);
          assert.ok(!/«(?!\u00A0)|(?<!\u00A0)»/.test(v), `${nom} fr ${cle} : guillemet sans espace insécable`);
        } else {
          assert.ok(!/[«»’\u00A0]/.test(v), `${nom} en ${cle} : typographie française`);
        }
      }
    }
  }
});

/* ── 2. Les rôles ARIA ────────────────────────────────────────────────────── */

await dit('role="status" pour le chargement (aria-busy) et le toast ; role="alert" pour l’erreur ; la barre est masquée aux lecteurs d’écran', () => {
  assert.match(rendus.chargement, /role="status"[^>]*aria-busy="true"|aria-busy="true"[^>]*role="status"/);
  assert.match(toast(), /^<div role="status" data-type="succes"/);
  const erreur = toast({ type: 'erreur', titre: typo("Votre modification n'a pas pu être enregistrée."), detail: undefined, onAnnuler: undefined, onReessayer: sansAction, onFermer: sansAction });
  assert.match(erreur, /^<div role="alert" data-type="erreur"/);
  assert.deepEqual(boutons(erreur).filter(Boolean), ['Réessayer'], 'Réessayer, plus la croix (sans texte)');
  assert.match(erreur, /aria-label="Fermer la notification"/);
  assert.ok(!/sc-toast__barre/.test(erreur), 'une erreur n’a pas de barre');
  const avecBarre = toast({ fraction: 0.62 });
  assert.match(avecBarre, /<span aria-hidden="true" class="sc-toast__barre">/);
  assert.match(avecBarre, /scaleX\(0\.62\)/);
  assert.ok(!/sc-toast__barre/.test(toast({ onAnnuler: undefined, detail: undefined })), 'un succès sans retour n’a ni barre ni bouton');
  assert.deepEqual(boutons(toast({ onAnnuler: undefined })), []);
  assert.match(toast({ detailDecoratif: true }), /<p class="sc-toast__detail" aria-hidden="true">/, 'le compte à rebours n’est pas annoncé chaque seconde');
});

await dit('role="alertdialog", aria-modal, titre et texte reliés ; l’aperçu sans voile ne se dit plus modal', () => {
  const d = dialogue();
  assert.match(d, /role="alertdialog"/);
  assert.match(d, /aria-modal="true"/);
  const [lie, decrit] = [attr(d, 'aria-labelledby'), attr(d, 'aria-describedby')];
  assert.ok(lie && new RegExp(`<h2 id="${lie}"`).test(d), 'aria-labelledby → le titre');
  assert.ok(decrit && new RegExp(`<p id="${decrit}"`).test(d), 'aria-describedby → le texte');
  assert.match(d, /class="sc-dialogue-voile"/);
  const nu = dialogue({ sansVoile: true });
  assert.ok(!/alertdialog|aria-modal|sc-dialogue-voile/.test(nu), 'sans voile : ni alertdialog, ni aria-modal');
  assert.match(nu, /role="group"/);
});

await dit('le dialogue : Échap = Annuler (pile des calques), focus initial récupérable/non, focus rendu, portail, voile sans clic', () => {
  const src = sansCommentaires(lire('src/socle/ui/situations/DialogueConfirmation.tsx'));
  assert.match(src, /useFermetureEchap\(ouvert, onAnnuler\)/);
  assert.match(src, /\(recuperable \? refAction : refAnnuler\)\.current\?\.focus\(\)/);
  assert.match(src, /recuperable = true/);
  assert.match(src, /document\.activeElement/);
  assert.match(src, /cible\?\.isConnected\) cible\.focus\(\)/);
  assert.match(src, /createPortal\([\s\S]*document\.body\)/);
  assert.ok(!/onClick=/.test(src.slice(src.indexOf('className="sc-dialogue-voile"') - 200, src.indexOf('className="sc-dialogue-voile"') + 400)), 'le clic sur le voile ne ferme pas');
  // La pile des calques reconnaît un calque à `position: fixed` et `z-index >= 50`.
  const css = sansCommentaires(lire('src/socle/ui/situations/situations.css'));
  const voile = /\.sc-dialogue-voile \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(voile, /position:\s*fixed/);
  assert.ok(Number(/z-index:\s*(\d+)/.exec(voile)?.[1]) >= 50, 'z-index du voile ≥ 50');
});

/* ── 3. Jamais de zone morte ──────────────────────────────────────────────── */

await dit('aucun état sans bouton nommé ; l’action est blanche (primaire), jamais rouge plein, et le verbe est précis', () => {
  for (const [nom, html] of Object.entries(rendus)) {
    if (nom === 'chargement') continue;
    const bs = boutons(html);
    assert.ok(bs.length >= 1 && bs.every((b) => b.length > 0), `${nom} : au moins un bouton nommé`);
  }
  for (const html of [rendus.vide, rendus.acces, rendus.aucunProche, dialogue(), avis]) {
    assert.ok(!/data-variante="danger"/.test(html), 'jamais de rouge plein');
    assert.match(html, /data-variante="primaire"/);
  }
  assert.ok(!/>(OK|Oui|Non)</.test(dialogue()), 'jamais « OK » ni « Oui »');
  // L'ordre : « Annuler » (secondaire) puis l'action (primaire), à droite.
  const d = dialogue();
  assert.ok(d.indexOf('data-variante="secondaire"') < d.indexOf('data-variante="primaire"'));
  // Le type interdit un BlocEtat sans actions.
  assert.match(sansCommentaires(lire('src/socle/ui/situations/BlocEtat.tsx')), /actions: React\.ReactNode;/);
  // Les aperçus statiques : atteignables au clavier (aria-disabled, pas disabled).
  assert.match(rendre(h(S.EtatVideInvitation, { objet: 'x', statique: true, onAjouter: sansAction })), /<button[^>]*aria-disabled="true"/);
  assert.ok(!/<button[^>]*\sdisabled=""/.test(rendre(h(S.EtatVideInvitation, { objet: 'x', statique: true, onAjouter: sansAction }))));
});

/* ── 4. Les cotes, lues dans le CSS ───────────────────────────────────────── */

const css = sansCommentaires(lire('src/socle/ui/situations/situations.css'));
const noir = sansCommentaires(lire('src/socle/noir.css'));
/** Le corps du premier bloc dont le sélecteur est exactement `selecteur`. */
function bloc(selecteur: string): string {
  const m = new RegExp(`(?:^|\\})\\s*${selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm').exec(css);
  assert.ok(m, `bloc « ${selecteur} » introuvable dans situations.css`);
  return m[1];
}
const px = (corps: string, propriete: string): number => {
  const m = new RegExp(`(?:^|[;\\s])${propriete}:\\s*(-?[\\d.]+)px`).exec(corps);
  assert.ok(m, `${propriete} (px) absent de « ${corps.trim().slice(0, 60)}… »`);
  return Number(m[1]);
};
const jetonNoir = (nom: string) => new RegExp(`${nom}:\\s*([^;]+);`).exec(noir)?.[1].trim();
/** La valeur d'une ou deux cotes `margin: 10px 0 0` → [haut, droite, bas, gauche]. */
const marge = (corps: string, propriete: string): number[] => {
  const m = new RegExp(`(?:^|[;\\s])${propriete}:\\s*([^;]+);`).exec(corps);
  assert.ok(m, `${propriete} absent`);
  const v = m[1].trim().split(/\s+/).map((x) => Number.parseFloat(x));
  return [v[0], v[1] ?? v[0], v[2] ?? v[0], v[3] ?? v[1] ?? v[0]];
};

await dit('tuile d’icône 48 × 48 (rayon 14, fond = la couleur du ton à 13 %) : l’IconTile du socle, teintée par --sc-ton ; colonne centrée, texte ≤ 240 px, boutons à 8 px', () => {
  // La tuile est la brique partagée : situations.css ne lui donne que sa teinte, ses cotes et son fond viennent de briques-partagees.css.
  const icone = bloc('.sc-bloc-etat__icone');
  assert.match(icone, /--sc-tuile-teinte:\s*var\(--sc-ton\)/, 'la tuile prend la teinte du bloc par la variable de la brique');
  assert.doesNotMatch(icone, /width|height|border-radius|background|color:/, 'ses cotes et son fond sont ceux de l’IconTile du socle');
  const briques = sansCommentaires(lire('src/socle/ui/briques-partagees/briques-partagees.css'));
  assert.match(briques, /\.sc-icon-tile\[data-taille='48'\] \{ --sc-tuile: 48px; --sc-tuile-rayon: 14px; --sc-tuile-glyphe: 20px; \}/, '48 × 48, rayon 14, glyphe 20');
  assert.match(briques, /\.sc-icon-tile \{[^}]*--sc-tuile-part: 13%;[^}]*background: color-mix\(in srgb, var\(--sc-tuile-teinte\) var\(--sc-tuile-part\), transparent\);\s*color: var\(--sc-tuile-teinte\);/, 'fond = la teinte à 13 %, glyphe de la teinte');
  assert.match(rendre(h(S.EtatHorsConnexion, { onReessayer: sansAction })), /data-taille="48" data-ton="attention" class="sc-icon-tile sc-bloc-etat__icone"/, 'un ton d’état est passé à la brique');
  assert.match(rendre(h(S.EtatAucunResultat, { terme: V.terme, onEffacer: sansAction })), /data-taille="48" class="sc-icon-tile sc-bloc-etat__icone"/, 'le neutre standard reste le gris T3 teinté à 13 %, par --sc-ton');
  const racine = bloc('.sc-bloc-etat');
  assert.match(racine, /flex-direction:\s*column/);
  assert.match(racine, /align-items:\s*center/);
  assert.equal(px(bloc('.sc-bloc-etat__texte'), 'max-width'), 240);
  assert.equal(px(bloc('.sc-bloc-etat__actions'), 'gap'), 8);
  assert.equal(px(bloc('.sc-bloc-etat__titre'), 'font-size'), 15);
  assert.match(bloc('.sc-bloc-etat__titre'), /font-weight:\s*600/);
  assert.equal(px(bloc('.sc-bloc-etat__texte'), 'font-size'), 12.5);
  // Les quatre tons : famille, attention, neutre, critique — chacun sur un jeton.
  for (const [ton, jeton] of [['famille', '--fam'], ['attention', '--socle-etat-attention'], ['neutre', '--socle-texte-2'], ['critique', '--socle-etat-critique']]) {
    assert.match(bloc(`.sc-bloc-etat[data-ton='${ton}']`), new RegExp(`--sc-ton:\\s*var\\(${jeton}`));
  }
});

await dit('boutons de 31 px, texte de 12,5 px, écart de 8 px, dans chaque situation', () => {
  const sel = ":root[data-ambiance='noir'] :is(.sc-bloc-etat__actions, .sc-dialogue__actions, .sc-avis__actions, .sc-toast-bloc, .sc-chargement) [data-socle='bouton'][data-taille][data-variante]";
  const corps = bloc(sel);
  assert.equal(px(corps, 'height'), 31);
  assert.equal(px(corps, 'font-size'), 12.5);
  for (const b of ['.sc-dialogue__actions', '.sc-avis__actions']) assert.equal(px(bloc(b), 'gap'), 8, b);
  for (const zone of ['.sc-bloc-etat__actions', '.sc-dialogue__actions', '.sc-avis__actions', '.sc-toast-bloc', '.sc-chargement']) assert.ok(sel.includes(zone), `${zone} reçoit les boutons de 31 px`);
});

await dit('squelette : carré 34 (rayon 10), barres 122 × 10 et 78 × 8, pastille 42 × 10, pas de 50 ; fond, lignes et reflet en jetons, 1,4 s', () => {
  const v = bloc('.sc-squelette-lignes');
  const n = (nom: string) => px(v, nom);
  assert.deepEqual(
    [n('--sc-squelette-carre'), n('--sc-squelette-rayon'), n('--sc-squelette-barre-longue'), n('--sc-squelette-barre-haut'), n('--sc-squelette-barre-courte'), n('--sc-squelette-barre-fine'), n('--sc-squelette-pastille'), n('--sc-squelette-pas')],
    [34, 10, 122, 10, 78, 8, 42, 50],
  );
  // Une ligne fait 34 px de haut ; le pas de 50 px laisse donc 16 px entre deux lignes.
  assert.match(v, /row-gap:\s*calc\(var\(--sc-squelette-pas\) - var\(--sc-squelette-carre\)\)/);
  assert.match(bloc('.sc-squelette-lignes__ligne'), /height:\s*var\(--sc-squelette-carre\)/);
  // Les deux barres (10 + 7 + 8 = 25 px) se centrent dans la ligne de 34 px : la première à 4,5 px, comme sur la maquette (y + 4).
  assert.equal(px(bloc('.sc-squelette-lignes__textes'), 'gap'), 7);
  assert.ok(Math.abs((34 - (10 + 7 + 8)) / 2 - 4) <= 1);
  const fond = bloc(":root[data-ambiance='noir'] .sc-squelette");
  for (const j of ['--socle-squelette', '--socle-squelette-reflet']) assert.ok(fond.includes(`var(${j})`), j);
  assert.ok(bloc(":root[data-ambiance='noir'] .sc-squelette[data-ligne='true']").includes('var(--socle-squelette-ligne)'));
  assert.match(fond, /animation-duration:\s*1\.4s/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*:root\[data-ambiance='noir'\] \.sc-squelette \{ animation: none; \}/);
  const html = rendre(h(S.SqueletteLignes, {}));
  assert.equal([...html.matchAll(/sc-squelette-lignes__ligne/g)].length, 4, 'quatre lignes par défaut');
  assert.match(html, /^<div aria-hidden="true"/, 'le squelette se tait : la légende parle');
  assert.equal([...rendre(h(S.SqueletteLignes, { lignes: 6 })).matchAll(/sc-squelette-lignes__ligne/g)].length, 6);
});

await dit('boîte de confirmation 276 × 148 (19 px de marge, rayon 14, 400 px en page) ; toast 276 × 79 + barre de 3 px à 14 px', () => {
  const boite = bloc('.sc-dialogue');
  const [pad] = marge(boite, 'padding');
  const bord = 1;
  assert.equal(pad, 19);
  assert.equal(jetonNoir('--socle-rayon-carte'), '14px');
  assert.match(boite, /border-radius:\s*var\(--socle-rayon-carte\)/);
  assert.match(boite, /width:\s*min\(var\(--sc-dialogue-largeur, 400px\), 100%\)/);
  const titre = px(bloc('.sc-dialogue__titre'), 'line-height');
  const [texteHaut] = marge(bloc('.sc-dialogue__texte'), 'margin');
  const lignesTexte = 2;
  const haut = 2 * bord + 2 * pad + titre + texteHaut + lignesTexte * px(bloc('.sc-dialogue__texte'), 'line-height') + px(bloc('.sc-dialogue__actions'), 'margin-top') + 31;
  assert.equal(haut, 148, 'hauteur de la boîte');
  // Le titre est à 29 px du haut de la boîte : bord + marge + la moitié de sa ligne.
  assert.equal(bord + pad + titre / 2, 29);

  const carte = bloc('.sc-toast');
  const [padHaut, , padBas] = marge(carte, 'padding');
  const contenu = 2 * px(bloc('.sc-toast__titre'), 'line-height') + marge(bloc('.sc-toast__detail'), 'margin')[0] + px(bloc('.sc-toast__detail'), 'line-height');
  assert.equal(2 * bord + padHaut + padBas + contenu, 79, 'hauteur du toast (titre sur 2 lignes + détail)');
  assert.match(carte, /border:\s*1px solid var\(--socle-bord-toast\)/);
  assert.match(carte, /background:\s*var\(--socle-dialogue\)/);
  const barre = bloc('.sc-toast__barre');
  assert.equal(px(barre, 'height'), 3);
  assert.equal(px(barre, 'margin-top'), 14);
  assert.match(barre, /background:\s*var\(--socle-bord-carte\)/);
  assert.equal(jetonNoir('--socle-bord-carte'), '#232325', 'la piste de la barre');
  assert.match(bloc('.sc-toast__remplissage'), /background:\s*var\(--socle-etat-succes\)/);
  assert.match(bloc('.sc-toast__remplissage'), /transform-origin:\s*left/, 'la barre se vide de droite à gauche');
  assert.match(bloc('.sc-toast-bloc'), /width:\s*min\(var\(--sc-toast-largeur, 340px\)/);
});

await dit('tailles compactes v3 : bloc d’état (tuile 36, titre 13,5, texte 12), confirmation 300 px, toast 318 px à barre dans le pied, lignes de 31 px', () => {
  const c = "[data-taille='compact']";
  // La tuile compacte est l'IconTile de 36 px (rayon 10, glyphe 16) ; son neutre est l'aplat --socle-tag : le `ton="neutre"` de la brique, passé par BlocEtat.
  const briques = sansCommentaires(lire('src/socle/ui/briques-partagees/briques-partagees.css'));
  assert.match(briques, /\.sc-icon-tile\[data-taille='36'\] \{ --sc-tuile: 36px; --sc-tuile-rayon: 10px; --sc-tuile-glyphe: 16px; \}/, '36 × 36, rayon 10, glyphe 16');
  assert.match(briques, /\.sc-icon-tile\[data-ton='neutre'\] \{ background: var\(--socle-tag\); color: var\(--socle-texte-2\); \}/, 'la tuile neutre est un aplat #1a1a1c (écart T1 H43.2)');
  assert.match(rendre(h(S.EtatAucunResultat, { terme: V.terme, onEffacer: sansAction, taille: 'compact' })), /data-taille="36" data-ton="neutre" class="sc-icon-tile sc-bloc-etat__icone"/, 'en compact, le neutre passe l’aplat à la brique');
  assert.doesNotMatch(css, /\.sc-bloc-etat\[data-taille='compact'\][^{]*\.sc-bloc-etat__icone(\s+svg)?\s*\{/, 'plus de cote locale pour la tuile compacte');
  assert.equal(px(bloc(`.sc-bloc-etat${c} .sc-bloc-etat__titre`), 'font-size'), 13.5);
  assert.equal(px(bloc(`.sc-bloc-etat${c} .sc-bloc-etat__texte`), 'font-size'), 12);
  assert.equal(px(bloc(`.sc-bloc-etat${c} .sc-bloc-etat__texte`), 'max-width'), 300);
  assert.match(css, /:root\[data-ambiance='noir'\] :is\(\.sc-bloc-etat\[data-taille='compact'\] \.sc-bloc-etat__actions, \.sc-dialogue\[data-compact='true'\] \.sc-dialogue__actions, \.sc-toast-bloc\[data-compact='true'\][^)]*\) \[data-socle='bouton'\]\[data-taille\]\[data-variante\] \{[^}]*height:\s*25px/, 'boutons compacts de 25 px');
  const vide = rendre(h(S.EtatVideInvitation, { objet: V.objet, famille: 'contacts', onAjouter: sansAction, onImporter: sansAction, taille: 'compact' }));
  assert.match(vide, /class="sc-bloc-etat"|data-taille="compact"/);
  assert.match(vide, /data-taille="compact"/);
  assert.match(vide, /lucide-download/, '« Importer » porte sa flèche en compact');
  assert.doesNotMatch(rendus.vide, /data-taille="compact"|lucide-download/, 'la taille standard ne change pas');
  assert.doesNotMatch(rendre(h(S.EtatAucunResultat, { terme: V.terme, proche: V.proche, onVoirProche: sansAction, icone: null })), /sc-bloc-etat__icone/, 'la tuile est facultative');
  // Confirmation compacte.
  assert.match(dialogue({ compact: true, largeur: 300, sansVoile: true }), /data-compact="true"[^>]*class="sc-dialogue"[^>]*style="--sc-dialogue-largeur:300px"/);
  assert.deepEqual(marge(bloc(".sc-dialogue[data-compact='true']"), 'padding').slice(0, 3), [13, 16, 14]);
  assert.equal(px(bloc(".sc-dialogue[data-compact='true'] .sc-dialogue__titre"), 'font-size'), 13.5);
  // Toast compact : la barre dans le pied, « Annuler » avec sa flèche.
  const t = toast({ compact: true, largeur: 318, fraction: 0.75 });
  assert.match(t, /data-compact="true"/);
  assert.match(t, /lucide-undo-2/);
  assert.match(bloc(".sc-toast-bloc[data-compact='true'] .sc-toast__barre"), /position:\s*absolute[^}]*bottom:\s*0/);
  assert.match(bloc(".sc-toast-bloc[data-compact='true']"), /border-radius:\s*var\(--socle-rayon-ticket\)/);
  assert.doesNotMatch(toast(), /data-compact|lucide-undo-2/);
  // Lignes de squelette compactes : 31 px + filet, carré 22, pastille 54 × 9.
  const lignes = rendre(h(S.SqueletteLignes, { compact: true, lignes: 3 }));
  assert.equal((lignes.match(/class="sc-squelette-lignes__ligne"/g) ?? []).length, 3);
  assert.match(lignes, /width:22px;height:22px/);
  assert.match(lignes, /width:54px;height:9px/);
  assert.equal(px(bloc(".sc-squelette-lignes[data-compact='true'] .sc-squelette-lignes__ligne"), 'height'), 32);
});

await dit('pile des toasts : en bas à droite, 20 px au-dessus de la barre Ajmani (--sc-toast-bas réglable), sous les calques (z-index < 50)', () => {
  const pile = bloc('.sc-toasts');
  assert.match(pile, /position:\s*fixed/);
  assert.match(pile, /bottom:\s*var\(--sc-toast-bas, calc\(var\(--socle-hauteur-ajmani\) \+ 20px\)\)/);
  assert.match(pile, /right:\s*var\(--sc-toast-droite, 20px\)/);
  assert.equal(jetonNoir('--socle-hauteur-ajmani'), '46px');
  const z = Number(/z-index:\s*(\d+)/.exec(pile)?.[1]);
  assert.ok(z < 50 && z > 45, `z-index ${z} : au-dessus du tiroir (45), sous les calques (50), pour ne pas piéger la tabulation`);
});

await dit('planche v3 : 3 × 3 mini-fenêtres de 440 × 239 à x = 44 / 500 / 956 et y = 120 / 375 / 631, écart 16, bas à 870 ; lueur d’ambiance', () => {
  const page = bloc('.sc-h43');
  const [padHaut, padDroit] = marge(page, 'padding');
  assert.equal(padDroit, 44);
  assert.match(page, /background:\s*var\(--socle-halo\), var\(--socle-fond-page\)/, 'la lueur d’ambiance de page (§1, écart T1 H43.1)');
  assert.equal(jetonNoir('--socle-halo'), 'radial-gradient(1000px 520px at 85% -10%, rgba(255, 255, 255, 0.045), transparent 70%)');
  const v = (nom: string) => Number(new RegExp(`${nom}:\\s*(\\d+)px`).exec(css)?.[1]);
  const [l, hFen, ecart, barre] = [v('--sc-h43-fenetre-l'), v('--sc-h43-fenetre-h'), v('--sc-h43-ecart'), v('--sc-h43-barre')];
  assert.deepEqual([l, hFen, ecart, barre], [440, 239, 16, 36]);
  assert.match(bloc('.sc-h43__grille'), /grid-template-columns:\s*repeat\(3, var\(--sc-h43-fenetre-l\)\)/);
  assert.deepEqual([0, 1, 2].map((i) => padDroit + i * (l + ecart)), [44, 500, 956]);
  assert.equal(padDroit + 3 * l + 2 * ecart + padDroit, 1440);
  // En-tête : étiquette 13 + (5 + 30,8) + (6 + 19) + 17 → la grille commence à y = 120 (à un demi-pixel près).
  const debut = padHaut + px(bloc('.sc-h43__etiquette'), 'line-height') + marge(bloc('.sc-h43__titre'), 'margin')[0] + 28 * 1.1 + marge(bloc('.sc-h43__sous'), 'margin')[0] + px(bloc('.sc-h43__sous'), 'line-height') + px(bloc('.sc-h43__grille'), 'margin-top');
  assert.ok(Math.abs(debut - 120) <= 0.5, `la grille commence à ${debut}`);
  [120, 375, 631].forEach((y, i) => assert.ok(Math.abs(debut + i * (hFen + ecart) - y) <= 1.5, `rangée ${i + 1} à ${debut + i * (hFen + ecart)} (image : ${y})`));
  assert.ok(Math.abs(debut + 3 * hFen + 2 * ecart - 870) <= 1.5, 'bas de la grille à y = 870');
  assert.equal(px(bloc('.sc-h43__titre'), 'font-size'), 28);
  assert.equal(px(bloc('.sc-h43__sous'), 'font-size'), 13.5);
  assert.match(bloc('.sc-h43__etiquette'), /letter-spacing:\s*0\.1em/);
  assert.match(bloc('.sc-h43__fenetre'), /height:\s*var\(--sc-h43-fenetre-h\)[\s\S]*overflow:\s*hidden/);
  assert.match(bloc('.sc-h43__barre'), /border-bottom:\s*1px solid var\(--socle-bord-entete\)/);
  assert.match(bloc('.sc-h43__situation'), /overflow:\s*hidden/);
  assert.match(css, /@media \(max-width: 1279\.98px\) \{\s*\.sc-h43__grille \{ grid-template-columns: repeat\(2, var\(--sc-h43-fenetre-l\)\)/);
  assert.match(css, /@media \(max-width: 719\.98px\) \{[^}]*\}\s*\.sc-h43__grille \{ grid-template-columns: minmax\(0, var\(--sc-h43-fenetre-l\)\)/);
});

await dit('planche v3 : chaque situation est posée comme sur l’image (cadre vide à 44, boîte et toast en bas à droite, état d’erreur à 40)', () => {
  assert.match(bloc('.sc-h43__cadre-vide'), /inset:\s*44px 15px 14px/);
  assert.match(bloc('.sc-h43__cadre-vide'), /border:\s*1px dashed var\(--socle-pointille\)/);
  assert.match(bloc('.sc-h43__boite'), /right:\s*15px;\s*bottom:\s*14px;\s*width:\s*300px/);
  assert.match(bloc('.sc-h43__toast'), /right:\s*15px;\s*bottom:\s*14px/);
  assert.match(bloc('.sc-h43__voile'), /background:\s*var\(--sc-voile-situation\)/);
  assert.match(bloc('.sc-h43__erreur'), /padding-top:\s*40px/);
  assert.match(bloc('.sc-h43__acces'), /padding-top:\s*32px/);
  assert.match(bloc('.sc-h43__ligne'), /height:\s*var\(--sc-h43-ligne\)/);
  assert.match(css, /--sc-h43-ligne:\s*35px/, 'lignes de 35 px (modèles 6 et 7)');
  assert.match(bloc('.sc-h43__courbe polyline'), /stroke:\s*var\(--sc-courbe-perimee\)[^}]*stroke-dasharray/);
  // Le modèle 1 : cadre de 239 − 37 − 44 − 14 = 144 px ; le bloc compact (36 + 10 + 17 + 6 + 16 + 12 + 25 = 122) y est centré.
  const bloc1 = 36 + 10 + 17 + 6 + 16 + 12 + 25;
  assert.equal(bloc1, 122);
  assert.ok((239 - 37 - 44 - 14 - 2 - bloc1) / 2 >= 9, 'le bloc tient dans le cadre pointillé');
});

/* ── 5. Les couleurs ──────────────────────────────────────────────────────── */

await dit('situations.css : aucune couleur en dur hors des jetons --sc-…, chaque var(--…) existe, aucune encre « discret » en texte', () => {
  const sansJetons = css.replace(/--sc-[\w-]+:[^;]+;/g, '');
  assert.deepEqual(sansJetons.match(/#[0-9a-fA-F]{3,8}\b/g), null, 'un #hex en dur');
  assert.deepEqual(sansJetons.match(/\b(?:rgba?|hsla?|oklch|lab)\(/g), null, 'une couleur fonctionnelle en dur');
  assert.deepEqual([...css.matchAll(/--sc-[\w-]+:\s*#[0-9a-fA-F]{6}/g)].map((m) => m[0].split(':')[0]), ['--sc-curseur-pair', '--sc-courbe-perimee'], 'deux jetons hex de la fiche : le curseur de l’autre personne, la courbe périmée');
  const connus = new Set([
    ...[...noir.matchAll(/(--[\w-]+):/g)].map((m) => m[1]),
    ...[...css.matchAll(/(--[\w-]+):/g)].map((m) => m[1]),
    '--fam', // posé par [data-famille] dans src/index.css
  ]);
  // Une variable lue avec un repli (`var(--sc-toast-bas, …)`) peut être posée plus tard, par la coquille ou en ligne.
  for (const [, nom] of css.matchAll(/var\((--[\w-]+)\s*\)/g)) assert.ok(connus.has(nom), `${nom} : jeton inconnu`);
  for (const [, valeur] of css.matchAll(/(?:^|[;{\s])color\s*:\s*([^;}]+)/g)) assert.ok(!/trait-discret|trait-tres-discret|#77777c|#5f5f64/i.test(valeur), `color: ${valeur}`);
  assert.ok(!/!important/.test(css), 'pas de !important');
  // Les encres de texte lues : au plus bas T4 (--socle-texte-3, #8a8a8e), jamais en dessous.
  for (const [, valeur] of css.matchAll(/(?:^|[;{\s])color\s*:\s*([^;}]+)/g)) {
    assert.match(valeur.trim(), /^var\(--(socle-texte-[123]|socle-texte-courant|sc-ton|socle-etat-[a-z]+|socle-primaire-encre|sc-notif-teinte)\)$|^var\(--sc-ton\)$/, `color: ${valeur}`);
  }
  assert.ok(Math.min(...[...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]))) >= 10.5, 'plus petit texte : 10,5 px');
});

await dit('les composants : aucune couleur en dur, aucune classe de taille ou de couleur Tailwind arbitraire, aucun personnage ni émoji', () => {
  for (const f of ['BlocEtat.tsx', 'Squelettes.tsx', 'DialogueConfirmation.tsx', 'Toasts.tsx', 'AvisCollaboration.tsx', 'EnSituation.tsx', 'statique.ts', 'regles.ts', 'index.ts']) {
    const src = sansCommentaires(lire(`src/socle/ui/situations/${f}`));
    assert.deepEqual(src.match(/#[0-9a-fA-F]{3,8}\b/g), null, `${f} : #hex`);
    assert.ok(!/\brgba?\(|\btext-\[|\bbg-\[|\bborder-\[/.test(src), `${f} : couleur ou taille arbitraire`);
    assert.ok(!/\p{Extended_Pictographic}/u.test(src), `${f} : émoji`);
    assert.ok(!/robot|mascotte|confetti|new Audio|\.play\(\)/i.test(src), `${f} : robot, mascotte, confettis ou son`);
  }
});

await dit('focus visible : anneau 2 px, décalage 2 px (classe sc-focus et [data-socle]) ; la croix du toast porte sc-focus', () => {
  assert.match(sansCommentaires(lire('src/socle/ui/briques.css')), /\.sc-focus:focus-visible[\s\S]*?outline:\s*2px solid var\(--color-socle-focus\);\s*outline-offset:\s*2px/);
  assert.match(toast({ type: 'erreur', onAnnuler: undefined, onFermer: sansAction }), /<button type="button" class="sc-toast__fermer sc-focus"/);
});

/* ── 6. Les règles du temps, sur de la logique pure et une fausse horloge ──── */

type Horloge = { maintenant(): number; armer(fn: () => void, ms: number): unknown; annuler(p: unknown): void };
interface Regles {
  creerMinuteur: (duree: number, fin: () => void, horloge: Horloge) => { demarrer(): void; pauser(r: string): void; reprendre(r: string): void; arreter(): void; restantMs(): number; enPause(): boolean; termine(): boolean };
  creerChargementDiffere: (surChangement: (e: { visible: boolean; long: boolean }) => void, horloge: Horloge) => { definir(b: boolean): void; lire(): { visible: boolean; long: boolean }; liberer(): void };
  dureeDuToast: (type: string, aRetour: boolean, demandee?: number) => number | null;
  afficheBarre: (type: string, aRetour: boolean) => boolean;
  empiler: <T extends { type: string }>(pile: readonly T[], nouveau: T, max?: number) => T[];
  fractionRestante: (restant: number, duree: number) => number;
  secondesAffichees: (restant: number) => number;
  enchainer: (rappel: () => void, fermer: () => void) => () => void;
  echapFermeLeToast: (t: { touche: string; dejaPris: boolean; composition: boolean; calquesOuverts: number; dansUneSaisie: boolean }) => boolean;
  DELAI_AFFICHAGE_MS: number;
  DUREE_MINIMALE_MS: number;
  DELAI_LONG_MS: number;
  DUREE_TOAST_RETOUR_MS: number;
  DUREE_TOAST_SIMPLE_MS: number;
  PILE_TOASTS_MAX: number;
}
const R = await charger<Regles>('src/socle/ui/situations/regles.ts');

/** Une horloge qu'on avance à la main : les minuteries partent dans l'ordre de leur échéance. */
function fausseHorloge() {
  let t = 0;
  let suivant = 0;
  const armees = new Map<number, { quand: number; fn: () => void }>();
  const horloge: Horloge = {
    maintenant: () => t,
    armer: (fn, ms) => {
      suivant += 1;
      armees.set(suivant, { quand: t + ms, fn });
      return suivant;
    },
    annuler: (p) => void armees.delete(p as number),
  };
  const avancer = (ms: number) => {
    const but = t + ms;
    for (;;) {
      const prochaine = [...armees.entries()].filter(([, a]) => a.quand <= but).sort((a, b) => a[1].quand - b[1].quand || a[0] - b[0])[0];
      if (!prochaine) break;
      armees.delete(prochaine[0]);
      t = prochaine[1].quand;
      prochaine[1].fn();
    }
    t = but;
  };
  return { horloge, avancer, maintenant: () => t, armees: () => armees.size };
}

await dit('les durées : 8 s avec « Annuler », 4 s sans retour, jamais pour une erreur ; barre seulement quand on peut annuler', () => {
  assert.deepEqual([R.DUREE_TOAST_RETOUR_MS, R.DUREE_TOAST_SIMPLE_MS, R.PILE_TOASTS_MAX], [8000, 4000, 3]);
  assert.equal(R.dureeDuToast('succes', true), 8000);
  assert.equal(R.dureeDuToast('succes', false), 4000);
  assert.equal(R.dureeDuToast('succes', true, 12_000), 12_000);
  assert.equal(R.dureeDuToast('erreur', false), null);
  assert.equal(R.dureeDuToast('erreur', true, 5000), null, 'une erreur ne part jamais toute seule, quoi qu’on demande');
  assert.equal(R.afficheBarre('succes', true), true);
  assert.equal(R.afficheBarre('succes', false), false);
  assert.equal(R.afficheBarre('erreur', true), false);
  // Le compte à rebours arrondit vers le haut ; la barre part de 1 et finit à 0.
  assert.deepEqual([8000, 7001, 7000, 1, 0].map(R.secondesAffichees), [8, 8, 7, 1, 0]);
  assert.equal(R.fractionRestante(8000, 8000), 1);
  assert.equal(R.fractionRestante(0, 8000), 0);
  assert.equal(R.fractionRestante(4960, 8000), 0.62);
  assert.equal(R.fractionRestante(99_999, 8000), 1);
});

await dit('minuteur du toast : se ferme à 8 s, ni avant ni deux fois', () => {
  const { horloge, avancer } = fausseHorloge();
  let fermetures = 0;
  const m = R.creerMinuteur(8000, () => (fermetures += 1), horloge);
  m.demarrer();
  avancer(7999);
  assert.equal(fermetures, 0);
  assert.equal(m.restantMs(), 1);
  avancer(1);
  assert.equal(fermetures, 1);
  assert.equal(m.termine(), true);
  avancer(60_000);
  assert.equal(fermetures, 1);
});

await dit('minuteur du toast : la pause GARDE le temps restant, la reprise le rend — au survol comme au focus', () => {
  const { horloge, avancer } = fausseHorloge();
  let fermetures = 0;
  const m = R.creerMinuteur(8000, () => (fermetures += 1), horloge);
  m.demarrer();
  avancer(3000);
  m.pauser('survol');
  assert.equal(m.enPause(), true);
  avancer(120_000);
  assert.equal(fermetures, 0, 'rien ne part pendant la pause');
  assert.equal(m.restantMs(), 5000, 'le temps restant est gardé');
  m.reprendre('survol');
  avancer(4999);
  assert.equal(fermetures, 0);
  avancer(1);
  assert.equal(fermetures, 1, 'les 5 s restantes s’écoulent, pas 8 de plus');
});

await dit('minuteur du toast : survol ET focus se cumulent — la reprise attend la dernière raison ; pauser deux fois ne fige rien de plus', () => {
  const { horloge, avancer } = fausseHorloge();
  let fermetures = 0;
  const m = R.creerMinuteur(8000, () => (fermetures += 1), horloge);
  m.demarrer();
  avancer(2000);
  m.pauser('survol');
  avancer(1000);
  m.pauser('focus');
  m.pauser('focus');
  avancer(10_000);
  m.reprendre('survol');
  assert.equal(m.enPause(), true, 'le focus retient encore');
  avancer(10_000);
  assert.equal(fermetures, 0);
  assert.equal(m.restantMs(), 6000);
  m.reprendre('focus');
  assert.equal(m.enPause(), false);
  avancer(6000);
  assert.equal(fermetures, 1);
});

await dit('minuteur du toast : arrêté, il ne rappelle jamais ; en pause avant le départ, il attend la reprise ; rien ne reste armé', () => {
  const a = fausseHorloge();
  let fermetures = 0;
  const m = R.creerMinuteur(8000, () => (fermetures += 1), a.horloge);
  m.demarrer();
  a.avancer(3000);
  m.arreter();
  a.avancer(60_000);
  assert.equal(fermetures, 0);
  assert.equal(a.armees(), 0, 'plus aucune minuterie armée');
  const b = fausseHorloge();
  const m2 = R.creerMinuteur(8000, () => (fermetures += 1), b.horloge);
  m2.pauser('focus');
  m2.demarrer();
  b.avancer(60_000);
  assert.equal(fermetures, 0);
  m2.reprendre('focus');
  b.avancer(8000);
  assert.equal(fermetures, 1);
});

await dit('« Annuler » appelle réellement le rappel, puis ferme ; si le rappel échoue, le toast reste', () => {
  const journal: string[] = [];
  R.enchainer(() => journal.push('défait'), () => journal.push('fermé'))();
  assert.deepEqual(journal, ['défait', 'fermé']);
  const reste: string[] = [];
  assert.throws(() => R.enchainer(() => { throw new Error('échec'); }, () => reste.push('fermé'))());
  assert.deepEqual(reste, []);
  const src = sansCommentaires(lire('src/socle/ui/situations/Toasts.tsx'));
  assert.match(src, /onAnnuler=\{annuler \? enchainer\(annuler, onFermer\) : undefined\}/);
  assert.match(src, /onReessayer=\{reessayer \? enchainer\(reessayer, onFermer\) : undefined\}/);
});

await dit('Échap ferme le toast le plus récent, mais jamais l’appui d’un calque, d’une saisie ou d’une composition', () => {
  const base = { touche: 'Escape', dejaPris: false, composition: false, calquesOuverts: 0, dansUneSaisie: false };
  assert.equal(R.echapFermeLeToast(base), true);
  for (const contre of [{ touche: 'Enter' }, { dejaPris: true }, { composition: true }, { calquesOuverts: 1 }, { dansUneSaisie: true }]) {
    assert.equal(R.echapFermeLeToast({ ...base, ...contre }), false, JSON.stringify(contre));
  }
  const src = sansCommentaires(lire('src/socle/ui/situations/Toasts.tsx'));
  assert.match(src, /calquesOuverts\(\)/);
  assert.match(src, /survol/);
  assert.match(src, /'focus'/);
  assert.match(src, /role=\{erreur \? 'alert' : 'status'\}/);
});

await dit('pile des toasts : trois au plus, le plus récent en bas, une erreur survit tant qu’un succès peut partir', () => {
  const t = (id: string, type = 'succes') => ({ id, type });
  let pile: Array<{ id: string; type: string }> = [];
  for (const id of ['a', 'b', 'c']) pile = R.empiler(pile, t(id));
  assert.deepEqual(pile.map((x) => x.id), ['a', 'b', 'c']);
  pile = R.empiler(pile, t('d'));
  assert.deepEqual(pile.map((x) => x.id), ['b', 'c', 'd'], 'le plus ancien part, le plus récent est en bas');
  let avecErreur = R.empiler(R.empiler(R.empiler([], t('e', 'erreur')), t('f')), t('g'));
  avecErreur = R.empiler(avecErreur, t('h'));
  assert.deepEqual(avecErreur.map((x) => x.id), ['e', 'g', 'h'], 'l’erreur reste, le succès le plus ancien part');
  const toutesErreurs = ['1', '2', '3', '4'].reduce((p, id) => R.empiler(p, t(id, 'erreur')), [] as Array<{ id: string; type: string }>);
  assert.deepEqual(toutesErreurs.map((x) => x.id), ['2', '3', '4']);
  assert.equal(R.empiler(pile, t('z'), 2).length, 2);
});

await dit('chargement différé : rien avant 150 ms — une attente de 100 ms ne montre jamais le squelette', () => {
  const { horloge, avancer, armees } = fausseHorloge();
  const vus: Array<{ visible: boolean; long: boolean }> = [];
  const c = R.creerChargementDiffere((e) => vus.push({ ...e }), horloge);
  c.definir(true);
  avancer(100);
  assert.equal(c.lire().visible, false);
  c.definir(false);
  avancer(10_000);
  assert.deepEqual(vus, [], 'aucun changement émis : pas de clignotement');
  assert.equal(armees(), 0);
  c.definir(true);
  avancer(149);
  assert.equal(c.lire().visible, false);
  avancer(1);
  assert.equal(c.lire().visible, true, 'visible à 150 ms');
  c.liberer();
});

await dit('chargement différé : une fois affiché, visible 400 ms au moins ; au-delà, il part tout de suite', () => {
  const a = fausseHorloge();
  const c = R.creerChargementDiffere(() => undefined, a.horloge);
  c.definir(true);
  a.avancer(150); // affiché à 150
  a.avancer(50);
  c.definir(false); // fini à 200 : il reste 350 ms à courir
  a.avancer(349);
  assert.equal(c.lire().visible, true, 'encore là à 549 ms');
  a.avancer(1);
  assert.equal(c.lire().visible, false, 'parti à 550 ms = 150 + 400');
  c.liberer();
  const b = fausseHorloge();
  const d = R.creerChargementDiffere(() => undefined, b.horloge);
  d.definir(true);
  b.avancer(150 + 400 + 1000);
  d.definir(false);
  assert.equal(d.lire().visible, false, 'déjà affiché depuis plus de 400 ms : il part sans attendre');
  d.liberer();
  assert.deepEqual([R.DELAI_AFFICHAGE_MS, R.DUREE_MINIMALE_MS, R.DELAI_LONG_MS], [150, 400, 10_000]);
});

await dit('chargement différé : une attente qui reprend pendant le sursis garde le squelette (pas de clignotement), puis dépasse 10 s', () => {
  const a = fausseHorloge();
  const vus: boolean[] = [];
  const c = R.creerChargementDiffere((e) => vus.push(e.visible), a.horloge);
  c.definir(true);
  a.avancer(150);
  a.avancer(50);
  c.definir(false);
  a.avancer(100);
  c.definir(true); // la requête repart avant la fin du sursis
  a.avancer(5000);
  assert.deepEqual(vus, [true], 'visible une fois, jamais retiré entre-temps');
  // Les 10 s se comptent depuis le début de l'attente en cours : la reprise, à 300 ms, les a réarmés pour 10 300 ms.
  a.avancer(4999);
  assert.equal(c.lire().long, false, 'pas encore 10 s d’attente');
  a.avancer(1);
  assert.equal(c.lire().long, true, 'plus de 10 s : « C’est plus long que d’habitude »');
  c.definir(false);
  assert.deepEqual(c.lire(), { visible: false, long: false }, 'l’attente finie, tout est remis à zéro');
  c.liberer();
  assert.equal(a.armees(), 0);
});

await dit('chargement différé : libérée, plus aucune minuterie ; le crochet useChargementDiffere branche cette règle ; le premier rendu est vide', () => {
  const a = fausseHorloge();
  const c = R.creerChargementDiffere(() => undefined, a.horloge);
  c.definir(true);
  c.liberer();
  assert.equal(a.armees(), 0);
  const src = sansCommentaires(lire('src/socle/ui/situations/Squelettes.tsx'));
  assert.match(src, /export function useChargementDiffere\(enCours: boolean\): EtatChargementDiffere/);
  assert.match(src, /creerChargementDiffere\(setEtat\)/);
  assert.match(src, /regle\.current\?\.definir\(enCours\)/);
  assert.match(src, /useChargementDiffere\(enCours && !statique\)/);
  assert.equal(rendre(h(S.EtatChargement, { objets: 'x' })), '', 'avant 150 ms, rien');
  assert.ok(rendre(h(S.EtatChargement, { objets: 'x', statique: true })).includes('sc-chargement'));
  assert.equal(rendre(h(S.EtatChargement, { objets: 'x', statique: true, enCours: false })), '');
  // La légende « plus long » et « Réessayer » : dans les mots, et rendus quand `long` (src).
  assert.match(src, /long && onReessayer/);
  assert.match(src, /ts\('chargement\.long'\)/);
});

/* ── 7. La page de démonstration ──────────────────────────────────────────── */

await dit('planche v3 : neuf mini-fenêtres en situation (numéros 1 à 8 inchangés, 9 = Erreur), en-tête, règles, sans coquille', async () => {
  const P = await chargerRendu<{ PageEtatsMessages: unknown }>("import { PageEtatsMessages } from '../src/refonte/systeme/h43-etats/PageEtatsMessages';", ['PageEtatsMessages']);
  const html = P.rendre((P.h as H)(P.PageEtatsMessages, {}));
  assert.equal([...html.matchAll(/class="sc-h43__fenetre"/g)].length, 9);
  const barres = [...html.matchAll(/<h2 id="[^"]+" class="sc-h43__nom"><span class="sc-h43__numero sc-mono">(\d\d)<\/span>([^<]*)<\/h2><span class="sc-h43__fil">([^<]*)</g)].map((m) => `${m[1]} ${m[2]} · ${m[3]}`);
  assert.deepEqual(barres, [
    '01 Vide · Contacts / Clients',
    '02 Chargement · L’argent / Facturation',
    '03 Hors ligne · Échanger / Messagerie',
    '04 Droits manquants · Outils / Coffre-fort',
    '05 Aucun résultat · Écrire / Documents',
    '06 Confirmation · Contacts / Clients',
    '07 Succès discret · L’argent / Facturation',
    '08 Deux personnes · Écrire / Notes et pages',
    '09 Erreur · L’argent / Prévisions',
  ]);
  assert.deepEqual([...html.matchAll(/data-modele="(\d)"/g)].map((m) => m[1]), ['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  const t = texte(html);
  assert.ok(t.startsWith('SYSTÈME · RÉFÉRENCEÉtats et messages'), t.slice(0, 60));
  assert.ok(t.includes(typo(`Même quand il n'y a rien, quand ça charge ou quand ça casse${NBSP}: une explication simple et une action possible.`)));
  for (const r of ['Une cause, une action', "Jamais de code d'erreur", "Le nom de l'objet change, la forme reste"]) assert.ok(t.includes(typo(r)), r);
  for (const c of ['Client', 'Contact', 'Dernier échange']) assert.ok(t.includes(c), c);
  assert.equal([...html.matchAll(/<h1[ >]/g)].length, 1);
  assert.ok(!/<nav|role="navigation"|sc-coquille|sc-lateral/.test(html), 'page sans coquille');
  assert.match(html, /<main class="sc-h43" data-refonte-police="inter">/);
  // Les situations : chacune avec ses pièces v3.
  for (const marque of ['data-taille="compact"', 'sc-squelette-chiffres', 'data-compact="true"', 'sc-hors-bandeau', 'sc-en-attente', 'sc-h43__fantome', 'sc-porte-ajmani', 'sc-h43__voile', 'sc-collab-bandeau', 'sc-curseur-pair', 'sc-fusion-pied', 'sc-perime__mention', 'sc-h43__courbe']) assert.ok(html.includes(marque), `« ${marque} » absent`);
  assert.equal([...html.matchAll(/data-taille="compact"/g)].length >= 4, true, 'quatre blocs d’état compacts (1, 4, 5, 9)');
  assert.match(html, /role="status"[^>]*aria-busy="true"[^>]*aria-label="Chargement de vos factures"/);
  assert.ok(t.includes(typo("Connecté en tant que Robin · rien de la page n'est montré")));
  assert.ok(t.includes(typo("Demander à Ajmani : « exmple »")));
  assert.ok(t.includes(typo("Fusionnés, rien n'est écrasé · copie gardée")));
  assert.ok(t.includes('dernière valeur connue · 10:12'));
  assert.ok(t.includes(typo("Les prévisions n'ont pas pu être chargées")));
  assert.ok(t.includes('nouvel essai dans 20 s'));
  assert.ok(t.includes('Disparaît dans 6 s'));
  assert.ok(t.includes(typo("Hors ligne · 2 messages en attente d'envoi")));
  assert.ok(t.includes(typo('en attente, partira au retour du réseau')));
  // Tous les boutons de la page sont des aperçus : atteignables, sans effet.
  const tousBoutons = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
  assert.ok(tousBoutons.length === 13 && tousBoutons.every((b) => /aria-disabled="true"/.test(b) && !/\sdisabled=""/.test(b)), 'boutons aria-disabled');
  // Cinq boutons primaires (Ajouter, Demander l'accès, Voir…, À la corbeille, Garder les deux) : normal pour un catalogue.
  assert.equal([...html.matchAll(/data-variante="primaire"/g)].length, 5);
  assert.ok(!/data-variante="danger"/.test(html));
  // Les variables d'exemple viennent des props : d'autres valeurs, d'autres textes.
  const autre = P.rendre((P.h as H)(P.PageEtatsMessages, { exemple: {
    objet: 'projet', objets: 'projets', enAttente: 1, correspondant: 'Noa', messageRecu: 'Message reçu', messageEnvoye: 'Message envoyé', prenomAdmin: 'Noa', prenomConnecte: 'Eli',
    terme: 'qqq', proche: 'Atelier Essai', liste: [{ nom: 'Fiche Une' }, { nom: 'Fiche Essai', detail: 'essai' }], rangSupprime: 1,
    factures: [{ numero: 'F-1', client: 'Essai SA', montant: 10, statut: 'payee' }], nomClientFacture: 'Essai SA', secondesRestantes: 8,
    prenomCollaborateur: 'Eli', noms: ['Zoé', 'Eli'], titrePage: 'Page Essai', paragraphe: 'Texte.', debutModifie: 'Mot : ', passageModifie: 'passage', objetsErreur: 'rapports', genreErreur: 'masculin', heureDerniere: '09:00', courbe: [0, 1], prochainEssai: 60,
  } }));
  const u = texte(autre);
  for (const attendu of [`Aucun projet pour l'instant`, 'Chargement de vos projets', `Rien pour «${NBSP}qqq${NBSP}»`, 'Atelier Essai', 'Noa', `Supprimer «${NBSP}Fiche Essai${NBSP}»${NBSP}?`, 'Facture envoyée à Essai SA', 'Eli modifie aussi cette page', "Hors ligne · 1 message en attente d'envoi", "Les rapports n'ont pas pu être chargés", 'nouvel essai dans 60 s', 'dernière valeur connue · 09:00']) {
    assert.ok(u.includes(typo(attendu)), `« ${attendu} » absent`);
  }
  assert.match(html, /scaleX\(0\.75\)/, 'la barre du toast dit le temps restant (6 s sur 8)');
});

await dit('aucun nom propre en dur : ni dans la page, ni dans ses mots, ni dans les composants, ni dans leurs mots, ni dans la feuille', () => {
  const NOMS = ['Menna', 'Dupuis', 'Aaron', 'Mohamed', 'Test Dupuis'];
  const fichiers = [
    'src/refonte/systeme/h43-etats/PageEtatsMessages.tsx',
    'src/refonte/systeme/h43-etats/i18n.ts',
    'src/refonte/systeme/h43-etats/exemples.ts',
    'src/socle/mots/situations.ts',
    'src/socle/ui/situations/situations.css',
    ...['BlocEtat.tsx', 'Squelettes.tsx', 'DialogueConfirmation.tsx', 'Toasts.tsx', 'AvisCollaboration.tsx', 'EnSituation.tsx', 'statique.ts', 'regles.ts', 'index.ts'].map((f) => `src/socle/ui/situations/${f}`),
  ];
  for (const f of fichiers) {
    const src = lire(f);
    for (const nom of NOMS) assert.ok(!src.toLowerCase().includes(nom.toLowerCase()), `${f} contient « ${nom} »`);
  }
  // Ni dans les dictionnaires chargés (les valeurs, pas seulement les sources).
  const page = lire('src/refonte/systeme/h43-etats/PageEtatsMessages.tsx');
  assert.match(page, /exemple = EXEMPLE_H43/, 'les valeurs d’exemple arrivent en props, à défaut de exemples.ts');
});

await dit('édition cliente : rien de ces fichiers n’est importé par un fichier partagé', async () => {
  const fautes: string[] = [];
  const parcourir = (dir: string) => {
    for (const e of fs.readdirSync(path.join(racine, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) parcourir(rel);
      else if (/\.(tsx?|css)$/.test(e.name) && !rel.startsWith('src/socle/') && !rel.startsWith('src/refonte/') && !/\.internal\.tsx?$/.test(rel)) {
        if (/(?:from|import)\s+['"][^'"]*(?:socle\/ui\/situations|socle\/mots\/situations|refonte\/systeme)/.test(fs.readFileSync(path.join(racine, rel), 'utf8'))) fautes.push(rel);
      }
    }
  };
  parcourir('src');
  assert.deepEqual(fautes, []);
  for (const f of ['BlocEtat.tsx', 'Squelettes.tsx', 'DialogueConfirmation.tsx', 'Toasts.tsx', 'AvisCollaboration.tsx', 'EnSituation.tsx', 'statique.ts', 'regles.ts']) {
    const imports = [...lire(`src/socle/ui/situations/${f}`).matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const i of imports) assert.ok(/^(react|react-dom|framer-motion|lucide-react)$|^\.\.?\//.test(i), `${f} importe « ${i} »`);
    for (const i of imports.filter((x) => x.startsWith('.'))) assert.ok(!/\/(state|components|screens|auth|hall)\b/.test(i), `${f} importe « ${i} »`);
  }
});

essais.fin();
