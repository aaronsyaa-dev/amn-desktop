/**
 * Contrôle des CONTRÔLES du socle (LOT-00) — jetons des maquettes, cotes des boutons, composants de formulaire,
 * onglets, suggestion d'Ajmani, cartes ludiques. Sans navigateur, sans build, sans réseau.
 *
 *   npm run check:socle-controles
 */
import { assert, attr, chargerRendu, creerEssais, jetons, lire, rapportContraste, sansCommentaires } from './lib/essai-socle.ts';

const { dit, fin } = creerEssais('Socle — contrôles (LOT-00)');

const noir = lire('src/socle/noir.css');
const j = jetons(noir);
const val = (nom: string): string => j.get(nom) as string;

await dit('noir.css : les jetons de 01-SOCLE-DESIGN §1 et §4, valeur pour valeur', () => {
  const attendu: Record<string, string> = {
    '--socle-fond-page': '#0c0c0d', '--socle-fond-lateral': '#101011', '--socle-bord-lateral': '#222224',
    '--socle-texte-1': '#ededed', '--socle-texte-courant': '#c4c4c8', '--socle-texte-2': '#a0a0a5', '--socle-texte-3': '#8a8a8e',
    '--socle-etat-succes': '#8fbf7a', '--socle-etat-attention': '#e0b35a', '--socle-etat-critique': '#e08a80', '--socle-etat-info': '#8aa4d6',
    '--socle-sous-carte': '#111112', '--socle-bord-sous-carte': '#212123', '--socle-bord-bouton': '#2e2e31', '--socle-bord-champ': '#5a5a60',
    '--socle-bord-controle': '#28282b', '--socle-bord-entete': '#1d1d1f', '--socle-bord-ligne': '#19191b', '--socle-pointille': '#2e2e33',
    '--socle-ticket': '#171718', '--socle-bord-ticket': '#262628', '--socle-bord-kanban': '#1e1e20',
    '--socle-suggestion-haut': '#17181a', '--socle-suggestion-bas': '#141415', '--socle-bord-suggestion': '#2c2e32',
    '--socle-tag': '#1a1a1c', '--socle-pilule': '#171718', '--socle-bord-pilule': '#2a2a2d', '--socle-bord-kbd': '#333336', '--socle-kbd': '#111112',
    '--socle-case-vide': '#3a3a3e', '--socle-toggle-actif': '#2e4327', '--socle-toggle-inactif': '#242427', '--socle-onglet-compteur': '#1c1c1e',
    '--socle-segment-actif': '#242427', '--socle-segment-fond': '#141415', '--socle-anneau-fond': '#1e1e20',
    '--socle-avatar-a': '#4b4b55', '--socle-avatar-m': '#5a524a', '--socle-avatar-r': '#46544f', '--socle-avatar-c': '#3f4a5c', '--socle-avatar-t': '#54485c', '--socle-avatar-l': '#5c4a4a',
    '--socle-squelette': '#1e1e21', '--socle-squelette-ligne': '#222225', '--socle-squelette-reflet': '#26262a',
    '--socle-dialogue': '#1a1a1c', '--socle-bord-dialogue': '#34343a', '--socle-bord-toast': '#2c3327',
    '--socle-palette-fond': '#141416', '--socle-bord-palette': '#34343a', '--socle-panneau': '#111112', '--socle-bord-panneau': '#29292c',
  };
  for (const [nom, valeur] of Object.entries(attendu)) assert.equal(j.get(nom), valeur, nom);
});

await dit('les encres de texte tiennent 4,5:1 sur toutes les surfaces (le plancher T4 #8a8a8e)', () => {
  const fonds = ['--socle-fond-page', '--socle-fond-lateral', '--socle-carte-haut', '--socle-carte-bas', '--socle-sous-carte', '--socle-champ', '--socle-ticket', '--socle-tag', '--socle-suggestion-haut', '--socle-suggestion-bas', '--socle-dialogue', '--socle-palette-fond', '--socle-panneau'];
  for (const encre of ['--socle-texte-1', '--socle-texte-courant', '--socle-texte-2', '--socle-texte-3'])
    for (const fond of fonds) assert.ok(rapportContraste(val(encre), val(fond)) >= 4.5, `${encre} sur ${fond}`);
  // Le compteur de la pastille de filtre active (gris sur #ededed) : AA.
  const css = lire('src/socle/ui/controles/controles.css');
  const compteur = /--sc-compteur-actif:\s*(#[0-9a-f]{6})/i.exec(css)?.[1];
  assert.ok(compteur, 'compteur de la pastille active introuvable');
  assert.ok(rapportContraste(compteur as string, val('--socle-primaire')) >= 4.5, 'compteur sur la pastille active');
  // Les états, en texte, sur les fonds teintés des pastilles (.12 sur la carte).
  for (const etat of ['succes', 'attention', 'critique', 'info']) assert.ok(rapportContraste(val(`--socle-etat-${etat}`), val('--socle-carte-bas')) >= 4.5, etat);
});

await dit('les feuilles du socle ne posent aucune couleur hex en dur (jetons seulement)', () => {
  for (const f of ['src/socle/ui/controles/controles.css']) {
    const css = sansCommentaires(lire(f));
    for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      const ligne = css.slice(0, m.index).split('\n').pop() ?? '';
      const reste = css.slice(m.index).split('\n')[0];
      assert.ok(/^\s*--sc-[\w-]+:/.test(ligne + reste.slice(0, 0)) || /--sc-[\w-]+:\s*#/.test(`${ligne}${reste}`), `${f} : couleur en dur « ${m[0]} » (${ligne.trim()}…)`);
    }
  }
});

await dit('les boutons : primaire 8 × 15, secondaire 7 × 13 + bordure, 12,5 px, 31 px de haut, rayon 9', () => {
  const css = sansCommentaires(lire('src/socle/ui/briques.css'));
  const bloc = (re: RegExp) => re.exec(css)?.[0] ?? '';
  const base = bloc(/:root\[data-ambiance='noir'\] \[data-socle='bouton'\] \{[^}]*\}/);
  assert.match(base, /font-size:\s*12\.5px/);
  assert.match(base, /min-height:\s*31px/);
  assert.match(base, /padding:\s*8px 15px/);
  assert.match(base, /border-radius:\s*var\(--socle-rayon-controle\)/);
  assert.match(bloc(/\[data-variante='secondaire'\] \{[^}]*\}/), /padding:\s*7px 13px/);
  assert.equal(j.get('--socle-bord-bouton'), '#2e2e31');
});

const K = await chargerRendu<Record<string, any>>( // eslint-disable-line @typescript-eslint/no-explicit-any
  [
    "import { Bouton, Carte, Saisie, Avatar, PileAvatars, PastilleEtat, BarreProgression, TuileKpi, CaseACocher, EtatVide, tonDeSante, teinteDe } from '../src/socle/ui';",
    "import { SousCarte, Tag, DrapeauUrgent, PastilleFiltre, Interrupteur, BoutonIcone, Selecteur, BoiteRecherche, Onglets, PanneauOnglet, Segmente, cleSuivante, IconeEtincelle, SuggestionAjmani, CarteCases, CarteAnneau, CarteSerie, CarteJalon } from '../src/socle/ui/controles';",
  ].join('\n'),
  ['Bouton', 'Carte', 'Saisie', 'Avatar', 'PileAvatars', 'PastilleEtat', 'BarreProgression', 'TuileKpi', 'CaseACocher', 'EtatVide', 'tonDeSante', 'teinteDe', 'SousCarte', 'Tag', 'DrapeauUrgent', 'PastilleFiltre', 'Interrupteur', 'BoutonIcone', 'Selecteur', 'BoiteRecherche', 'Onglets', 'PanneauOnglet', 'Segmente', 'cleSuivante', 'IconeEtincelle', 'SuggestionAjmani', 'CarteCases', 'CarteAnneau', 'CarteSerie', 'CarteJalon'],
);
const { h, rendre } = K;

await dit('Bouton : le raccourci s’affiche à côté du libellé, sans être lu deux fois', () => {
  const r = rendre(h(K.Bouton, { variante: 'primaire', raccourci: '⌘N' }, 'Nouveau projet'));
  assert.match(r, /Nouveau projet/);
  assert.match(r, /<kbd[^>]*aria-hidden="true"[^>]*>⌘N<\/kbd>/);
});

await dit('Carte : compacte, active et sans marge se disent en attributs', () => {
  const r = rendre(h(K.Carte, { compacte: true, active: true, sansMarge: true, titre: 'T' }, 'x'));
  assert.match(r, /data-compacte="true"/);
  assert.match(r, /data-active="true"/);
  assert.match(r, /data-sans-marge="true"/);
});

await dit('Sous-carte, tag, drapeau urgent', () => {
  assert.match(rendre(h(K.SousCarte, null, 'x')), /^<div[^>]*data-socle="sous-carte"/);
  const t = rendre(h(K.Tag, { famille: 'argent' }, 'Devis'));
  assert.match(t, /data-famille="argent"/);
  assert.match(t, /sc-point/);
  assert.doesNotMatch(rendre(h(K.Tag, null, 'Devis')), /sc-point/);
  const u = rendre(h(K.DrapeauUrgent));
  assert.match(u, /Urgent/);
  assert.match(u, /<svg[^>]*aria-hidden="true"/);
});

await dit('Pastille de filtre : aria-pressed dit l’état, le compteur reste le total', () => {
  const a = rendre(h(K.PastilleFiltre, { actif: true, onClick: () => undefined, compteur: 101 }, 'Tous'));
  assert.match(a, /aria-pressed="true"/);
  assert.match(a, />101</);
  assert.match(rendre(h(K.PastilleFiltre, { actif: false, onClick: () => undefined }, 'Essentiels')), /aria-pressed="false"/);
});

await dit('Interrupteur : un vrai role="switch" nommé, désactivable', () => {
  const r = rendre(h(K.Interrupteur, { actif: true, libelle: 'Rappels par courriel', onChange: () => undefined }));
  assert.match(r, /role="switch"/);
  assert.match(r, /aria-checked="true"/);
  assert.match(r, /aria-label="Rappels par courriel"/);
  assert.match(rendre(h(K.Interrupteur, { actif: false, libelle: 'x', disabled: true })), /disabled=""/);
});

await dit('Bouton-icône : le nom accessible est obligatoire et l’icône est décorative', () => {
  const r = rendre(h(K.BoutonIcone, { libelle: 'Filtrer', icone: h('svg', null) }));
  assert.match(r, /aria-label="Filtrer"/);
  assert.match(r, /type="button"/);
  assert.match(r, /<span aria-hidden="true"/);
});

await dit('Champ et liste : étiquette reliée, aide et erreur décrites, 40 px de haut', () => {
  const s = rendre(h(K.Saisie, { id: 'nom', etiquette: 'Nom', aide: 'Comme sur la facture', erreur: 'Nom manquant', suffixe: '€' }));
  assert.match(s, /<label[^>]*for="nom"/);
  assert.equal(attr(s, 'aria-describedby'), 'nom-aide nom-erreur');
  assert.match(s, /aria-invalid="true"/);
  const l = rendre(h(K.Selecteur, { id: 'cat', etiquette: 'Catégorie', aide: 'Une seule' }, h('option', { value: 'a' }, 'A')));
  assert.match(l, /<label[^>]*for="cat"/);
  assert.equal(attr(l, 'aria-describedby'), 'cat-aide');
  const css = sansCommentaires(lire('src/socle/ui/controles/controles.css'));
  assert.match(/\.sc-champ__controle,\s*\.sc-selecteur \{[^}]*\}/.exec(css)?.[0] ?? '', /height:\s*40px[\s\S]*border-radius:\s*var\(--socle-rayon-champ\)/);
});

await dit('Recherche : role="search", champ nommé, effacement seulement s’il y a un texte', () => {
  const vide = rendre(h(K.BoiteRecherche, { valeur: '', onChange: () => undefined, libelle: 'Rechercher un client', raccourci: '⌘K' }));
  assert.match(vide, /role="search"/);
  assert.match(vide, /aria-label="Rechercher un client"/);
  assert.match(vide, /⌘K/);
  assert.doesNotMatch(vide, /Effacer la recherche/);
  const plein = rendre(h(K.BoiteRecherche, { valeur: 'menn', onChange: () => undefined, libelle: 'Rechercher', grande: true }));
  assert.match(plein, /aria-label="Effacer la recherche"/);
  assert.match(plein, /data-grande="true"/);
});

await dit('Onglets : tablist, un seul onglet dans la tabulation, compteur, panneau lié', () => {
  const r = rendre(h(K.Onglets, { libelle: 'Notifications', idBase: 'n', actif: 'non-lues', onChange: () => undefined, onglets: [{ cle: 'tout', libelle: 'Tout', compteur: 12 }, { cle: 'non-lues', libelle: 'Non lues', compteur: 4 }] }));
  assert.match(r, /role="tablist"/);
  assert.equal((r.match(/role="tab"/g) ?? []).length, 2);
  assert.equal((r.match(/tabindex="0"/g) ?? []).length, 1);
  assert.match(r, /aria-selected="true"[^>]*>Non lues/);
  assert.match(r, /aria-controls="n-panneau-tout"/);
  const p = rendre(h(K.PanneauOnglet, { idBase: 'n', cle: 'tout', actif: false }, 'x'));
  assert.match(p, /role="tabpanel"/);
  assert.match(p, /hidden=""/);
  assert.doesNotMatch(p, />x</);
});

await dit('Navigation au clavier : suivant, précédent, début, fin, en boucle', () => {
  const cles = ['a', 'b', 'c'];
  assert.equal(K.cleSuivante(cles, 'a', 'ArrowRight'), 'b');
  assert.equal(K.cleSuivante(cles, 'c', 'ArrowRight'), 'a');
  assert.equal(K.cleSuivante(cles, 'a', 'ArrowLeft'), 'c');
  assert.equal(K.cleSuivante(cles, 'b', 'Home'), 'a');
  assert.equal(K.cleSuivante(cles, 'b', 'End'), 'c');
  assert.equal(K.cleSuivante(cles, 'b', 'x'), null);
  assert.equal(K.cleSuivante(cles, 'z', 'ArrowRight'), null);
});

await dit('Segmenté : radiogroup, choix unique annoncé', () => {
  const r = rendre(h(K.Segmente, { libelle: 'Taille', valeur: 'b', onChange: () => undefined, options: [{ cle: 'a', libelle: 'Seul·e' }, { cle: 'b', libelle: '2 à 5' }] }));
  assert.match(r, /role="radiogroup"/);
  assert.equal((r.match(/role="radio"/g) ?? []).length, 2);
  assert.match(r, /aria-checked="true"[^>]*>2 à 5/);
});

await dit('Suggestion d’Ajmani : étincelle décorative, titre, deux boutons, jamais d’avatar', () => {
  const r = rendre(h(K.SuggestionAjmani, { titre: 'Regrouper deux projets', texte: 'Texte', primaire: { libelle: 'Les relier', onClick: () => undefined }, secondaire: { libelle: 'Plus tard', onClick: () => undefined } }));
  assert.match(r, /Suggestion d’Ajmani/);
  assert.match(r, /<h3[^>]*>Regrouper deux projets<\/h3>/);
  assert.equal((r.match(/<button/g) ?? []).length, 2);
  assert.match(r, /data-variante="primaire"[\s\S]*data-variante="secondaire"/);
  assert.match(r, /<svg[^>]*aria-hidden="true"/);
  assert.doesNotMatch(r, /sc-avatar|<img/);
  assert.doesNotMatch(rendre(h(K.IconeEtincelle)), /<text|<image/);
});

await dit('Cartes ludiques : « n sur total fait », titre de fin, anneau, série, jalon avec repères', () => {
  const lignes = [{ id: '1', libelle: 'Valider', fait: true }, { id: '2', libelle: 'Brancher', fait: false }, { id: '3', libelle: 'Envoyer', fait: false }];
  const c = rendre(h(K.CarteCases, { titre: 'Pour finir la semaine', titreComplet: 'Semaine bouclée', lignes }));
  assert.match(c, /1 sur 3 fait/);
  assert.match(c, /Pour finir la semaine/);
  assert.match(c, /aria-valuenow="33"/);
  assert.equal((c.match(/role="checkbox"/g) ?? []).length, 3);
  const fini = rendre(h(K.CarteCases, { titre: 'Pour finir la semaine', titreComplet: 'Semaine bouclée', lignes: lignes.map((l) => ({ ...l, fait: true })) }));
  assert.match(fini, /Semaine bouclée/);
  assert.match(fini, /data-ton="succes"/);
  const a = rendre(h(K.CarteAnneau, { titre: 'Objectif', texte: 'Plus que 3', valeur: 0.75, centre: '75 %' }));
  assert.match(a, /role="progressbar"/);
  const s = rendre(h(K.CarteSerie, { titre: 'Série', texte: '5 jours de suite', jours: Array.from({ length: 7 }, (_, i) => ({ initiale: 'LMMJVSD'[i], nom: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][i], fait: i < 5 })) }));
  assert.equal((s.match(/<li/g) ?? []).length, 7);
  assert.match(s, /aria-label="lundi : fait"/);
  assert.match(s, /aria-label="dimanche : pas fait"/);
  const m = rendre(h(K.CarteJalon, { titre: 'Objectif du trimestre', fait: 12, total: 15, texte: 'Encore 3' }));
  assert.match(m, /12 sur 15/);
  assert.match(m, /data-hauteur="8"/);
  assert.equal((m.match(/<i /g) ?? []).length, 3);
});

await dit('Avatar : couleur stable par nom, carré arrondi pour une organisation, pastille en ligne', () => {
  assert.equal(K.teinteDe('Camille'), K.teinteDe('  camille '));
  const teintes = new Set(['Camille', 'Hugo', 'Inès', 'Zoé', 'Léa', 'Paul', 'Nina', 'Omar'].map(K.teinteDe));
  assert.ok(teintes.size >= 3, 'les couleurs ne se répartissent pas');
  const r = rendre(h(K.Avatar, { nom: 'Atelier Nord', forme: 'carre', enLigne: true, taille: 34 }));
  assert.match(r, /data-forme="carre"/);
  assert.match(r, /data-en-ligne="true"/);
  assert.match(r, /aria-hidden="true"/);
  assert.match(r, />AN</);
});

await dit('Progression : couleur de santé (≥ 70 vert, 45 à 69 orange, < 45 rouge), hauteurs 4, 5 et 8', () => {
  assert.equal(K.tonDeSante(0.7), 'succes');
  assert.equal(K.tonDeSante(0.69), 'attention');
  assert.equal(K.tonDeSante(0.45), 'attention');
  assert.equal(K.tonDeSante(0.44), 'critique');
  const r = rendre(h(K.BarreProgression, { valeur: 0.3, ton: 'critique', hauteur: 4, libelle: 'Santé' }));
  assert.match(r, /data-ton="critique"/);
  assert.match(r, /data-hauteur="4"/);
  assert.doesNotMatch(rendre(h(K.BarreProgression, { valeur: 0.3, libelle: 'x' })), /data-hauteur/);
});

await dit('Tuile KPI : 84 px par défaut, 92 sur demande, mini-courbe à droite décorative', () => {
  const d = rendre(h(K.TuileKpi, { libelle: 'Projets actifs', valeur: 7 }));
  assert.doesNotMatch(d, /data-hauteur/);
  const g = rendre(h(K.TuileKpi, { libelle: 'Projets actifs', valeur: 7, hauteur: 92, droite: h('svg', null) }));
  assert.match(g, /data-hauteur="92"/);
  assert.match(g, /sc-kpi__droite/);
  const css = sansCommentaires(lire('src/socle/ui/briques.css'));
  assert.match(/\.sc-kpi \{[^}]*\}/.exec(css)?.[0] ?? '', /min-height:\s*84px/);
});

await dit('Case à cocher : ronde de 18 px, 24 px dans une série', () => {
  const css = sansCommentaires(lire('src/socle/ui/briques.css'));
  assert.match(/\.sc-case \{[^}]*\}/.exec(css)?.[0] ?? '', /width:\s*18px[\s\S]*height:\s*18px[\s\S]*border-radius:\s*99px/);
  assert.match(css, /\.sc-case\[data-taille='serie'\] \{ width: 24px; height: 24px; \}/);
  assert.match(rendre(h(K.CaseACocher, { coche: true, libelle: 'x', taille: 'serie' })), /data-taille="serie"/);
});

/* ── §4, brique par brique : les valeurs mesurées dans le CSS calculé de /dev/socle (aperçu SOCLE-DEMO, chantier s1b).
      Une assertion par valeur ; celles qui ont été corrigées le disent. ── */
const briques = sansCommentaires(lire('src/socle/ui/briques.css'));
const controles = sansCommentaires(lire('src/socle/ui/controles/controles.css'));
const regle = (css: string, selecteur: string): string => {
  const i = css.indexOf(`\n${selecteur} {`) + 1;
  assert.ok(i > 0, `règle ${selecteur} introuvable`);
  return css.slice(i, css.indexOf('}', i) + 1);
};

await dit('§4 Card, Subcard, IconButton, Kpi : rayons, rembourrages et cotes', () => {
  assert.match(regle(briques, ":root[data-ambiance='noir'] [data-socle='carte']"), /border-radius:\s*var\(--socle-rayon-carte\)[\s\S]*box-shadow:\s*inset 0 1px 0 rgba\(255, 255, 255, 0\.035\)/);
  assert.match(briques, /\[data-socle='carte'\]:not\(\[data-sans-marge='true'\]\) \{ padding: 16px 18px; \}/);
  assert.match(briques, /\[data-socle='carte'\]\[data-compacte='true'\]:not\(\[data-sans-marge='true'\]\) \{ padding: 14px 16px; \}/);
  assert.equal(j.get('--socle-rayon-carte'), undefined, 'le rayon est une cote, pas une couleur');
  assert.match(noir, /--socle-rayon-carte:\s*14px/);
  assert.match(noir, /--socle-rayon-sous-carte:\s*11px/);
  assert.match(regle(controles, '.sc-sous-carte'), /padding:\s*12px 14px[\s\S]*border-radius:\s*var\(--socle-rayon-sous-carte\)[\s\S]*background:\s*var\(--socle-sous-carte\)/);
  assert.match(regle(controles, '.sc-bouton-icone'), /width:\s*34px[\s\S]*height:\s*34px[\s\S]*border:\s*1px solid var\(--socle-bord-bouton\)[\s\S]*border-radius:\s*var\(--socle-rayon-controle\)/);
  assert.match(controles, /\.sc-bouton-icone svg \{ width: 15px; height: 15px; \}/);
  assert.match(regle(briques, '.sc-kpi'), /min-height:\s*84px[\s\S]*padding:\s*14px 16px/);
  assert.match(briques, /\.sc-kpi\[data-hauteur='92'\] \{ min-height: 92px; \}/);
  assert.match(regle(briques, '.sc-kpi__label'), /color:\s*var\(--socle-texte-3\)[\s\S]*font-size:\s*12px/);
  assert.match(regle(briques, '.sc-kpi__valeur'), /font-size:\s*24px[\s\S]*font-weight:\s*600[\s\S]*letter-spacing:\s*-0\.02em/);
  assert.match(regle(briques, '.sc-kpi__variation'), /font-size:\s*12px/);
});

await dit('§4 StatusPill, Pill, Tag, FlagUrgent, Kbd : fonds, bordures, tailles et rayons', () => {
  assert.match(regle(briques, '.sc-etat'), /padding:\s*3px 9px[\s\S]*border-radius:\s*var\(--socle-rayon-pastille\)[\s\S]*font-size:\s*11\.5px/);
  assert.match(briques, /\.sc-etat::before \{ content: ''; width: 6px; height: 6px;/);
  assert.match(regle(briques, '.sc-etiquette'), /padding:\s*4px 10px[\s\S]*border:\s*1px solid var\(--socle-bord-pilule\)[\s\S]*border-radius:\s*var\(--socle-rayon-pastille\)[\s\S]*background:\s*var\(--socle-pilule\)[\s\S]*font-size:\s*11\.5px/);
  assert.match(regle(controles, '.sc-tag'), /padding:\s*2px 8px[\s\S]*border-radius:\s*var\(--socle-rayon-tag\)[\s\S]*background:\s*var\(--socle-tag\)[\s\S]*color:\s*var\(--socle-texte-2\)[\s\S]*font-size:\s*11px/);
  assert.match(noir, /--socle-rayon-tag:\s*6px/);
  assert.match(regle(controles, '.sc-urgent'), /border-radius:\s*var\(--socle-rayon-tag\)[\s\S]*background:\s*color-mix\(in srgb, var\(--socle-etat-critique\) 13%, transparent\)[\s\S]*color:\s*var\(--socle-etat-critique\)[\s\S]*font-size:\s*11px[\s\S]*font-weight:\s*600/);
  assert.match(regle(briques, '.sc-kbd'), /border:\s*1px solid var\(--socle-bord-kbd\)[\s\S]*border-radius:\s*5px[\s\S]*background:\s*var\(--socle-kbd\)[\s\S]*color:\s*var\(--socle-texte-3\)[\s\S]*font-size:\s*11px/);
  assert.match(briques, /\[data-socle='bouton'\] \.sc-kbd \{[^}]*opacity: 0\.6/);
});

await dit('§4 Avatar, AvatarStack, Sq, Progress, Check, Toggle : cotes et couleurs', () => {
  assert.match(briques, /\.sc-avatar\[data-forme='carre'\] \{ border-radius: 9px; \}/);
  assert.match(regle(briques, ".sc-avatar[data-en-ligne='true']::after"), /width:\s*8px[\s\S]*height:\s*8px[\s\S]*background:\s*var\(--socle-etat-succes\)[\s\S]*box-shadow:\s*0 0 0 2px/);
  assert.match(briques, /\.sc-pile \.sc-avatar \+ \.sc-avatar \{ margin-left: -7px; \}/);
  assert.match(briques, /\.sc-pile \.sc-avatar \{ box-shadow: 0 0 0 2px/);
  assert.match(regle(briques, '.sc-barre'), /height:\s*5px[\s\S]*border-radius:\s*99px[\s\S]*background:\s*var\(--socle-piste\)/);
  assert.match(briques, /\.sc-barre\[data-hauteur='4'\] \{ height: 4px; \}/);
  assert.match(briques, /\.sc-barre\[data-hauteur='8'\] \{ height: 8px; \}/);
  assert.match(regle(briques, '.sc-barre > span'), /background:\s*linear-gradient\(90deg, var\(--socle-fam-outils\), var\(--socle-texte-1\)\)/);
  assert.equal(j.get('--socle-piste'), '#252528');
  assert.equal(j.get('--socle-fam-outils'), '#9a9aa0');
  for (const t of ['succes', 'attention', 'critique']) assert.match(briques, new RegExp(`\\.sc-barre\\[data-ton='${t}'\\] > span \\{ background: var\\(--socle-etat-${t}\\); \\}`));
  assert.match(regle(briques, '.sc-case'), /width:\s*18px[\s\S]*height:\s*18px[\s\S]*border:\s*1\.5px solid var\(--socle-case-vide\)[\s\S]*border-radius:\s*99px/);
  assert.match(briques, /\.sc-case\[aria-checked='true'\] \{ border-color: var\(--socle-primaire\); background: var\(--socle-primaire\); \}/);
  // Corrigé (s1b, LOT-06) : 16 px, coche de 11 px.
  assert.match(briques, /\.sc-case\[data-taille='16'\] \{ width: 16px; height: 16px; \}/);
  assert.match(briques, /\.sc-case\[data-taille='16'\] svg \{ width: 11px; height: 11px; \}/);
  const petite = rendre(h(K.CaseACocher, { coche: true, libelle: 'x', taille: 16 }));
  assert.match(petite, /data-taille="16"/);
  assert.match(petite, /<svg[^>]*width="11"/);
  assert.match(rendre(h(K.CaseACocher, { coche: false, libelle: 'x', taille: 24 })), /data-taille="serie"/);
  assert.doesNotMatch(rendre(h(K.CaseACocher, { coche: false, libelle: 'x', taille: 18 })), /data-taille/);
  assert.match(regle(controles, '.sc-interrupteur'), /width:\s*34px[\s\S]*height:\s*20px[\s\S]*background:\s*var\(--socle-toggle-inactif\)/);
  assert.match(regle(controles, '.sc-interrupteur > span'), /width:\s*14px[\s\S]*height:\s*14px[\s\S]*background:\s*var\(--socle-texte-3\)/);
  assert.match(controles, /\.sc-interrupteur\[aria-checked='true'\] \{ background: var\(--socle-toggle-actif\); \}/);
  assert.match(controles, /\.sc-interrupteur\[aria-checked='true'\] > span \{ background: var\(--socle-texte-1\);/);
});

await dit('§4 Field, Tabs, Segmented (et compact), SearchBox (34 et 38) : cotes', () => {
  assert.match(controles, /\.sc-champ \{ display: flex; flex-direction: column; gap: 6px; \}/);
  assert.match(regle(controles, '.sc-champ__etiquette'), /color:\s*var\(--socle-texte-3\)[\s\S]*font-size:\s*12px/);
  assert.match(regle(controles, '.sc-champ__aide'), /color:\s*var\(--socle-texte-3\)[\s\S]*font-size:\s*11\.5px/);
  const champ = /\.sc-champ__controle,\s*\.sc-selecteur \{[^}]*\}/.exec(controles)?.[0] ?? '';
  assert.match(champ, /height:\s*40px[\s\S]*border:\s*1px solid var\(--socle-bord-champ\)[\s\S]*border-radius:\s*var\(--socle-rayon-champ\)[\s\S]*font-size:\s*13\.5px/);
  assert.match(noir, /--socle-rayon-champ:\s*10px/);
  assert.match(regle(controles, '.sc-onglets'), /gap:\s*26px/);
  assert.match(regle(controles, '.sc-onglet'), /color:\s*var\(--socle-texte-3\)[\s\S]*font-size:\s*13px/);
  assert.match(controles, /\.sc-onglet\[aria-selected='true'\] \{ color: var\(--socle-texte-1\); font-weight: 600; \}/);
  assert.match(controles, /\.sc-onglet\[aria-selected='true'\]::after \{[^}]*height: 2px; background: var\(--socle-primaire\); \}/);
  assert.match(regle(controles, '.sc-onglet__compteur'), /background:\s*var\(--socle-onglet-compteur\)/);
  assert.match(regle(controles, '.sc-segmente'), /padding:\s*3px[\s\S]*border:\s*1px solid var\(--socle-bord-controle\)[\s\S]*border-radius:\s*var\(--socle-rayon-champ\)[\s\S]*background:\s*var\(--socle-segment-fond\)/);
  assert.match(controles, /\.sc-segment\[aria-checked='true'\] \{ background: var\(--socle-segment-actif\); color: var\(--socle-texte-1\); \}/);
  assert.match(regle(controles, '.sc-segment'), /font-weight:\s*500/);
  // Ajouté (s1b, LOT-06) : le segmenté compact, 26 px.
  assert.match(controles, /\.sc-segmente\[data-taille='compact'\] \{ padding: 2px; border-radius: var\(--socle-rayon-controle\); \}/);
  assert.match(controles, /\.sc-segmente\[data-taille='compact'\] \.sc-segment \{ padding: 3px 9px; border-radius: 6px; font-size: 12px; line-height: 14px; \}/);
  const compact = rendre(h(K.Segmente, { libelle: 'Niveau', valeur: 'a', onChange: () => undefined, taille: 'compact', options: [{ cle: 'a', libelle: 'A' }, { cle: 'b', libelle: 'B' }] }));
  assert.match(compact, /role="radiogroup"[^>]*data-taille="compact"/);
  assert.doesNotMatch(rendre(h(K.Segmente, { libelle: 'Niveau', valeur: 'a', onChange: () => undefined, options: [{ cle: 'a', libelle: 'A' }] })), /data-taille/);
  assert.match(regle(controles, '.sc-boite-recherche'), /height:\s*34px[\s\S]*border:\s*1px solid var\(--socle-bord-controle\)[\s\S]*border-radius:\s*var\(--socle-rayon-champ\)[\s\S]*background:\s*var\(--socle-champ\)/);
  assert.match(rendre(h(K.BoiteRecherche, { valeur: '', onChange: () => undefined, libelle: 'x' })), /<svg[^>]*width="14"/, 'loupe de 14 px');
  // Ajouté (s1b, D02) : la variante de 38 px.
  assert.match(controles, /\.sc-boite-recherche\[data-hauteur='38'\] \{ height: 38px; padding: 0 12px; \}/);
  assert.match(rendre(h(K.BoiteRecherche, { valeur: '', onChange: () => undefined, libelle: 'x', hauteur: 38 })), /data-hauteur="38"/);
  assert.doesNotMatch(rendre(h(K.BoiteRecherche, { valeur: '', onChange: () => undefined, libelle: 'x', hauteur: 38, grande: true })), /data-hauteur/, 'grande l’emporte');
  assert.doesNotMatch(rendre(h(K.BoiteRecherche, { valeur: '', onChange: () => undefined, libelle: 'x' })), /data-hauteur/);
});

await dit('§4 Empty (EtatVide) : pointillé #2e2e33, rayon 14, icône 44 px, titre 14 / 600, texte 12,5 T4 de 300 px au plus, toujours une action (corrigé s1b)', () => {
  assert.match(regle(briques, '.sc-vide'), /border:\s*1px dashed var\(--socle-pointille\)[\s\S]*border-radius:\s*var\(--socle-rayon-carte\)/);
  assert.equal(j.get('--socle-pointille'), '#2e2e33');
  assert.match(regle(briques, '.sc-vide__icone'), /width:\s*44px[\s\S]*height:\s*44px[\s\S]*border-radius:\s*12px/);
  assert.match(regle(briques, '.sc-vide__titre'), /color:\s*var\(--socle-texte-1\)[\s\S]*font-size:\s*14px[\s\S]*font-weight:\s*600/);
  assert.match(regle(briques, '.sc-vide__texte'), /max-width:\s*300px[\s\S]*color:\s*var\(--socle-texte-3\)[\s\S]*font-size:\s*12\.5px/);
  assert.doesNotMatch(sansCommentaires(lire('src/socle/ui/situations/situations.css')), /\.sc-vide__(titre|texte) \{/, 'plus de surcharge de l’état vide dans situations.css');
  const r = rendre(h(K.EtatVide, { titre: 'Rien ici', texte: 'Ajoutez un premier élément.', icone: h('svg', null), action: h('button', { type: 'button' }, 'Ajouter') }));
  assert.match(r, /<span aria-hidden="true" class="sc-vide__icone"><svg><\/svg><\/span>/);
  assert.match(r, /<p class="sc-vide__titre">Rien ici<\/p>/);
  assert.match(r, /<button type="button">Ajouter<\/button>/);
  assert.doesNotMatch(rendre(h(K.EtatVide, { texte: 'x', action: null })), /sc-vide__icone|sc-vide__titre/);
  assert.match(sansCommentaires(lire('src/socle/ui/Etats.tsx')), /action: React\.ReactNode;/, 'l’action est demandée (jamais oubliée)');
});

await dit('§4 Suggestion et cartes ludiques : cotes', () => {
  assert.match(regle(controles, '.sc-suggestion'), /padding:\s*16px 18px[\s\S]*border:\s*1px solid var\(--socle-bord-suggestion\)[\s\S]*border-radius:\s*var\(--socle-rayon-carte\)[\s\S]*linear-gradient\(180deg, var\(--socle-suggestion-haut\), var\(--socle-suggestion-bas\)\)/);
  assert.match(regle(controles, '.sc-suggestion__entete'), /font-size:\s*12px[\s\S]*font-weight:\s*600/);
  assert.match(regle(controles, '.sc-etincelle'), /color:\s*var\(--socle-etat-succes\)/);
  assert.match(regle(controles, '.sc-suggestion__titre'), /color:\s*var\(--socle-texte-1\)[\s\S]*font-size:\s*13px[\s\S]*font-weight:\s*600/);
  assert.match(regle(controles, '.sc-suggestion__texte'), /color:\s*var\(--socle-texte-2\)[\s\S]*font-size:\s*12\.5px/);
  assert.match(rendre(h(K.SuggestionAjmani, { titre: 'T', texte: 'x', primaire: { libelle: 'Oui', onClick: () => undefined } })), /<svg[^>]*width="12" height="12"/, 'étincelle de 12 px');
  assert.match(controles, /\.sc-ludique__lignes li \{ display: flex; min-height: 33px;/);
  assert.match(controles, /\.sc-ludique__serie li \{/);
  assert.match(rendre(h(K.CarteAnneau, { titre: 'T', texte: 'x', valeur: 0.5, centre: '50 %' })), /<svg width="72" height="72"/);
  assert.equal((rendre(h(K.CarteAnneau, { titre: 'T', texte: 'x', valeur: 0.5, centre: '50 %' })).match(/stroke-width="8"/g) ?? []).length, 2);
});

await dit('aucun avatar, personnage ni image dans les composants du groupe', () => {
  for (const f of ['Surfaces', 'Formulaire', 'Navigation', 'Suggestion', 'Ludiques']) {
    const src = sansCommentaires(lire(`src/socle/ui/controles/${f}.tsx`));
    assert.doesNotMatch(src, /<img|<Avatar|mascotte|robot/i, f);
  }
});

fin();
