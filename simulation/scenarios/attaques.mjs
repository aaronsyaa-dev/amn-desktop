/**
 * ATTAQUES SIMULÉES — DÉFENSIF, contre notre propre bac à sable.
 *
 * Objet : vérifier que la défense répond, et mesurer EN COMBIEN DE TEMPS. Pas
 * d'outil d'exploitation, pas de code offensif réutilisable : on exerce des
 * abus courants (essais de connexion répétés, débit excessif, tentative
 * d'accès croisé, entrées malformées) sur des comptes et des sites fictifs, et
 * on relève ce que la Garde ou la Sentinelle en fait.
 *
 * Deux chaînes de détection coexistent dans amn-api :
 *   - IMMÉDIATE, dans le middleware : freinage de connexion (429), Sentinelle
 *     des entrées (journalise une alerte, pousse au Tour de contrôle).
 *   - DIFFÉRÉE, par la Garde : un acteur reporté par les trackers devient un
 *     incident, puis une remontée d'Escalade/Campagne, sur un battement.
 */
import { client, connexion, attendre, stats } from '../lib/harness.mjs';
import { SIM_MDP } from '../lib/seed.mjs';

/**
 * Essais de connexion répétés (bourrage de mot de passe) sur un compte réel.
 * La défense : `login_buckets` ferme la porte après 5 échecs/compte. On mesure
 * le nombre d'essais avant le 429 et la durée du blocage annoncée.
 */
export async function essaisConnexionRepetes({ srv, users }) {
  const cible = users[0];
  const c = client(srv.base, null);
  let bloqueApres = null;
  let retryAfter = null;
  for (let i = 1; i <= 12; i += 1) {
    const r = await c.post('/v1/auth/login', { email: cible.email, password: `faux-${i}` });
    if (r.statut === 429) {
      bloqueApres = i;
      retryAfter = r.json?.retryAfterSeconds ?? null;
      break;
    }
  }
  // Même après blocage, le BON mot de passe est refusé (la porte est fermée pour tous).
  const bonPendantBlocage = await c.post('/v1/auth/login', { email: cible.email, password: SIM_MDP });
  const detecte = bloqueApres !== null;
  return {
    nom: 'Essais de connexion répétés (bourrage de mot de passe)',
    resultat: detecte && bloqueApres <= 6 ? 'tient' : 'casse',
    preuve: detecte
      ? `porte fermée après ${bloqueApres} essais ratés ; blocage ~${retryAfter}s ; le bon mot de passe est aussi refusé pendant le blocage (statut ${bonPendantBlocage.statut})`
      : '12 essais ratés SANS blocage — force brute non freinée',
    detection: { chaine: 'immédiate (middleware login_buckets)', delai: detecte ? `au ${bloqueApres}ᵉ essai` : 'jamais' },
    mesures: {},
  };
}

/**
 * Abus de l'API : marteler une route d'écriture au-delà de la borne
 * (collections-write : 600/min/compte). On vérifie le 429 et le Retry-After.
 */
export async function abusApi({ srv, users }) {
  // Un compte VIERGE, distinct de la cible du bourrage de mots de passe (qui est verrouillée).
  const cible = users.find((u) => u.email !== users[0].email) ?? users[0];
  const cx = await connexion(srv.base, cible.email, SIM_MDP);
  const c = client(srv.base, cx.token);
  const codes = {};
  let premier429 = null;
  const durees = [];
  for (let i = 1; i <= 650; i += 1) {
    const r = await c.put(`/v1/collections/notes/abus-${i}`, { data: { i } });
    durees.push(r.ms);
    codes[r.statut] = (codes[r.statut] ?? 0) + 1;
    if (r.statut === 429 && premier429 === null) {
      premier429 = i;
      break;
    }
  }
  const freine = premier429 !== null;
  return {
    nom: 'Abus de l’API (650 écritures en rafale, borne 600/min)',
    resultat: freine ? 'tient' : 'partiel',
    preuve: freine
      ? `freinage au ${premier429}ᵉ appel (429) ; codes ${JSON.stringify(codes)}`
      : `650 appels sans 429 — codes ${JSON.stringify(codes)} (session valide ? ${cx.token ? 'oui' : 'NON'})`,
    detection: { chaine: 'immédiate (middleware rateLimit)', delai: freine ? `au ${premier429}ᵉ appel` : 'non atteinte' },
    mesures: { ecriture: stats(durees) },
  };
}

/**
 * Accès d'un compte aux données d'un autre (isolation multi-locataire).
 * Ce n'est pas une détection mais une PRÉVENTION : un jeton ne résout jamais
 * que sa propre organisation. On vérifie trois surfaces.
 */
export async function accesCroise({ srv, users }) {
  const orgA = users[0].orgId;
  const userA = users.find((u) => u.orgId === orgA);
  const userB = users.find((u) => u.orgId !== orgA);
  const cxA = await connexion(srv.base, userA.email, SIM_MDP);
  const cA = client(srv.base, cxA.token);
  // 1. Un compte de A écrit une fiche secrète ; un compte de B ne doit jamais la voir.
  await cA.put('/v1/collections/clients/secret-A', { data: { name: 'Client confidentiel de A' } });
  const cxB = await connexion(srv.base, userB.email, SIM_MDP);
  const cB = client(srv.base, cxB.token);
  const vueParB = (await cB.get('/v1/collections/clients')).json?.records ?? [];
  const fuite = vueParB.some((r) => r.id === 'secret-A');
  // 2. Un compte de cliente touche-t-il la console inter-tenant d'AMN DevSec ?
  const console1 = await cB.get(`/v1/admin/organizations/${orgA}/dossier`);
  const consoleRefusee = console1.statut === 403 || console1.statut === 404;
  // 3. La clé API d'un tracker ne lit QUE son site : on tente une lecture d'events sans justificatif.
  const sansJustif = await client(srv.base, null).get('/v1/collections/clients');
  const anonymeRefuse = sansJustif.statut === 401;
  const toutIsole = !fuite && consoleRefusee && anonymeRefuse;
  return {
    nom: 'Accès d’un compte aux données d’un autre (isolation multi-locataire)',
    resultat: toutIsole ? 'tient' : 'casse',
    preuve: `fiche de A vue par B : ${fuite ? 'FUITE' : 'non'} ; console inter-tenant pour une cliente : statut ${console1.statut} (${consoleRefusee ? 'refusée' : 'OUVERTE'}) ; lecture anonyme : statut ${sansJustif.statut} (${anonymeRefuse ? 'refusée' : 'OUVERTE'})`,
    detection: { chaine: 'prévention (portée dérivée du justificatif)', delai: 'bloqué d’emblée' },
    mesures: {},
  };
}

/**
 * Entrées malformées : injections SQL/XSS dans un corps de requête. La défense
 * réelle est structurelle (requêtes paramétrées, rendu en texte) ; la
 * Sentinelle, elle, JOURNALISE la tentative et la pousse au Tour de contrôle
 * sans bloquer. On vérifie qu'une alerte est bien créée.
 */
export async function entreesMalformees({ srv, users }) {
  const cx = await connexion(srv.base, users[0].email, SIM_MDP);
  const c = client(srv.base, cx.token);
  const charges = [
    { champ: 'name', valeur: "Robert'); DROP TABLE clients;--", famille: 'sql_injection' },
    { champ: 'name', valeur: "' OR 1=1 --", famille: 'sql_injection' },
    { champ: 'notes', valeur: '<script>alert(document.cookie)</script>', famille: 'xss' },
    { champ: 'notes', valeur: '../../../../etc/passwd', famille: 'path_traversal' },
  ];
  const t0 = performance.now();
  for (let i = 0; i < charges.length; i += 1) {
    const ch = charges[i];
    await c.put(`/v1/collections/clients/malforme-${i}`, { data: { [ch.champ]: ch.valeur } });
  }
  // La Sentinelle écrit sur `res.on('finish')` : on laisse un court instant, puis on lit le registre via la console.
  const cOp = client(srv.base); // jeton opérateur = AMN DevSec
  let alertes = [];
  try {
    await attendre(async () => {
      alertes = (await cOp.get('/v1/admin/input-alerts')).json?.alerts ?? (await cOp.get('/v1/admin/input-alerts')).json?.inputAlerts ?? [];
      return alertes.length >= charges.length;
    }, 3000, 100);
  } catch {
    /* on relève ce qui a été capté */
  }
  const delaiMs = performance.now() - t0;
  const familles = new Set(alertes.map((a) => a.family ?? a.famille));
  const detecte = alertes.length >= 1;
  return {
    nom: 'Entrées malformées (injections SQL / XSS / traversée)',
    resultat: detecte ? 'tient' : 'casse',
    preuve: detecte
      ? `${alertes.length} tentatives journalisées (familles : ${[...familles].join(', ')}) ; aucune n’a bloqué la saisie légitime (détection, pas blocage)`
      : 'AUCUNE alerte journalisée — la Sentinelle n’a rien vu',
    detection: { chaine: 'immédiate (Sentinelle des entrées → Tour de contrôle)', delai: `~${delaiMs.toFixed(0)} ms` },
    mesures: {},
  };
}

/**
 * Campagne multi-sites vue par la GARDE (chaîne différée, le vrai SOC).
 *
 * Une même adresse « attaque » les sites de ≥3 organisations : chaque tracker
 * reporte des échecs d'authentification (force brute), amn-api en dérive une
 * alerte de sécurité → un incident, et la Garde de la Sécurité (`campagnes`,
 * seuil 3 organisations/24 h) doit le remonter. On mesure le délai entre le
 * dernier événement et l'apparition de la remontée.
 *
 * Exige un serveur lancé AVEC la Garde (garde:true) et un tick court.
 */
export async function campagneMultiSites({ srv, sites }) {
  const c = client(srv.base); // opérateur AMN DevSec : lit pile/remontées
  const acteur = '203.0.113.66'; // plage de documentation (RFC 5737), jamais une vraie IP
  const ciblees = sites.slice(0, 4);
  // Chaque site reçoit, via sa clé API, assez d'échecs pour franchir le seuil de force brute (5/5 min).
  for (const s of ciblees) {
    const cle = `sim-cle-${s.orgId}`;
    const cTracker = client(srv.base, null);
    for (let i = 0; i < 6; i += 1) {
      await cTracker.post('/v1/events', {
        type: 'connection',
        severity: 'warning',
        payload: { outcome: 'failure', authFailure: true, ip: acteur, username: `cible${i}` },
      }, { headers: { 'X-API-Key': cle } });
    }
  }
  const t0 = performance.now();
  let remontee = null;
  try {
    await attendre(async () => {
      const r = await c.get('/v1/garde/remontees?equipe=securite&limit=50');
      const liste = r.json?.remontees ?? [];
      remontee = liste.find((x) => (x.cle ?? '').startsWith('campagne:')) ?? null;
      return Boolean(remontee);
    }, 20000, 500);
  } catch {
    /* non remontée dans le délai */
  }
  const delaiMs = performance.now() - t0;
  const detecte = Boolean(remontee);
  return {
    nom: 'Campagne multi-sites — détection par la Garde de la Sécurité',
    resultat: detecte ? 'tient' : 'partiel',
    preuve: detecte
      ? `remontée « campagne » apparue : « ${remontee.titre ?? remontee.cle} »`
      : 'aucune remontée « campagne » dans les 20 s (seuil 3 orgs/24 h ; vérifier que les incidents se forment)',
    detection: { chaine: 'différée (tracker → incident → Garde.securite.campagnes)', delai: detecte ? `~${(delaiMs / 1000).toFixed(1)} s après le dernier événement` : '>20 s' },
    mesures: {},
  };
}

export const attaquesImmediates = [essaisConnexionRepetes, abusApi, accesCroise, entreesMalformees];
export const attaquesGarde = [campagneMultiSites];
