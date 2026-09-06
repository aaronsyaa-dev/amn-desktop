/**
 * LÀ OÙ OLLAMA TOURNE, IL ENRICHIT LA FORMULATION — PARTOUT AILLEURS LE LEXIQUE SEUL (Bloc 3 de l'Automatique).
 *
 * Le modèle local reformule la réponse du Capitaine en français naturel. Il
 * ne peut pas inventer : chaque nombre, chaque nom entre guillemets, chaque
 * heure de la réponse d'origine doit se retrouver dans la sienne, sans
 * nombre nouveau, sans point d'exclamation, sans allongement excessif —
 * sinon la phrase du Lexique est gardée telle quelle. Le repli est
 * silencieux : ça ne se sent pas.
 */
export async function reformulerSansInventer(original: string, generate: (system: string, prompt: string) => Promise<string>): Promise<string> {
  if (original.length < 40 || original.length > 700) return original;
  const faits = (texte: string) => new Set([...texte.matchAll(/\d+(?:[ ,.]\d+)*(?:\s?(?:h|min|%|€))?/g)].map((m) => m[0].replace(/\s/g, '')));
  const noms = (texte: string) => new Set([...texte.matchAll(/«\s*([^»]+?)\s*»/g)].map((m) => m[1].trim()));
  let sortie: string;
  try {
    sortie = await Promise.race([
      generate(
        'Tu reformules en français naturel, au ton d’un collègue posé, une phrase écrite par un système déterministe. Règles absolues : ne change aucun nombre, aucune heure, aucun nom ; n’ajoute aucun fait ; pas de point d’exclamation ; pas de flatterie ; une seule phrase ou deux, pas plus longues que l’original. Réponds uniquement par la reformulation.',
        original,
      ),
      new Promise<string>((_, rej) => setTimeout(() => rej(new Error('délai')), 6000)),
    ]);
  } catch { return original; }
  const s = String(sortie ?? '').trim().replace(/^["«]\s*|\s*["»]$/g, '');
  if (!s || s.length > original.length * 1.5 || /!/.test(s)) return original;
  const fo = faits(original); const fs = faits(s);
  for (const f of fo) if (!fs.has(f)) return original;
  for (const f of fs) if (!fo.has(f)) return original;
  for (const n of noms(original)) if (!s.includes(n)) return original;
  return s;
}
