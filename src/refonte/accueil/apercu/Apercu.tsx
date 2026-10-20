import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import { configMotion, type NiveauMouvement } from '../../../socle/mouvement';
import { Ajmani, AjmaniPetit, type Geste } from '../ajmani/Ajmani';
import { EMOTIONS, type Emotion } from '../ajmani/expressions';
import { BIBLIOTHEQUE, SITUATIONS, remplir, type Situation } from '../ajmani/phrases';
import { TEINTES_AJMANI, type Teintes } from '../ajmani/briques/commun';
import type { Registre } from '../ajmani/registre';

/**
 * LA PAGE D'APERÇU D'AJMANI — pour juger le rendu sans lancer l'app.
 *
 * Compilée en UN fichier HTML autonome (`npm run apercu:ajmani` →
 * `docs/refonte/apercu-ajmani.html`) : le vrai composant, pas une copie. Hors
 * de l'app, donc des styles écrits ici, sans Tailwind. Jamais importée par
 * l'application.
 */

const C = {
  fond: '#161513',
  surface: '#1F1E1B',
  bord: '#34322D',
  texte: '#F2EFE9',
  doux: '#B7B1A6',
  ambre: '#d09a4a',
};

const NOMS: Record<Emotion, string> = {
  neutre: 'Neutre',
  curieux: 'Curieux',
  content: 'Content',
  'tres-content': 'Très content',
  concentre: 'Concentré',
  surpris: 'Surpris',
  inquiet: 'Inquiet',
  taquin: 'Taquin',
  fatigue: 'Fatigué',
  alerte: 'Alerte',
};

const GESTES: { g: Geste; nom: string }[] = [
  { g: 'saluer', nom: 'Saluer' },
  { g: 'pointer', nom: 'Pointer' },
  { g: 'hausser', nom: 'Hausser les épaules' },
  { g: 'hocher', nom: 'Hocher la tête' },
  { g: 'sautiller', nom: 'Sautiller' },
];

const OMBRE: Teintes = { ...TEINTES_AJMANI, coque: '#111', coqueOmbre: '#111', coqueReflet: '#111', ecran: '#111', ecranBord: '#111', visage: '#111', visageAlerte: '#111', cable: '#111' };

const puce = (actif: boolean): React.CSSProperties => ({
  padding: '7px 12px',
  borderRadius: 10,
  border: `1px solid ${actif ? C.texte : C.bord}`,
  background: actif ? C.texte : 'transparent',
  color: actif ? C.fond : C.texte,
  font: '600 13px/1.2 system-ui, sans-serif',
  cursor: 'pointer',
});

const carte: React.CSSProperties = { background: C.surface, border: `1px solid ${C.bord}`, borderRadius: 16, padding: 20 };
const surtitre: React.CSSProperties = { font: '600 11px/1 ui-monospace, monospace', letterSpacing: '0.14em', textTransform: 'uppercase', color: C.doux, margin: '0 0 12px' };

function Apercu() {
  const [emotion, setEmotion] = useState<Emotion>('content');
  const [geste, setGeste] = useState<Geste | null>(null);
  const [cle, setCle] = useState(0);
  const [niveau, setNiveau] = useState<NiveauMouvement>('complet');
  const [registre, setRegistre] = useState<Registre>('chill');
  const [langue, setLangue] = useState<'fr' | 'en'>('fr');
  const [allume, setAllume] = useState(true);
  const [cleEntree, setCleEntree] = useState(0);

  const jouer = (g: Geste) => {
    setGeste(g);
    setCle((n) => n + 1);
    if (g !== 'pointer') setTimeout(() => setGeste((x) => (x === g ? null : x)), 1500);
  };
  const lancement = () => {
    setAllume(false);
    setTimeout(() => setAllume(true), 380);
    setEmotion('neutre');
    setTimeout(() => setEmotion('content'), 1050);
  };

  const exemple: Record<string, string | number> = { n: 2, nom: 'Claire', jours: 12, module: langue === 'fr' ? 'la revue hebdo' : 'Weekly review', faits: 5, restants: 2 };

  return (
    <MotionConfig {...configMotion(niveau)}>
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 16px 64px', color: C.texte, font: '15px/1.5 system-ui, sans-serif' }}>
        <h1 style={{ font: '700 28px/1.2 system-ui, sans-serif', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Ajmani — aperçu</h1>
        <p style={{ color: C.doux, margin: '0 0 24px' }}>
          Le vrai composant de l’app, compilé dans cette page. Bouge la souris : il te suit des yeux. Il cligne toutes les 3 à 6 s.
        </p>

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <section style={{ ...carte, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360 }}>
            <Ajmani key={cleEntree} emotion={emotion} geste={geste} cleGeste={cle} taille={260} entree mouvement={niveau} allume={allume} titre="Ajmani" />
          </section>

          <section style={{ ...carte, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <p style={surtitre}>Émotion</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {EMOTIONS.map((e) => (
                  <button key={e} type="button" style={puce(emotion === e)} onClick={() => setEmotion(e)}>
                    {NOMS[e]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p style={surtitre}>Geste</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {GESTES.map(({ g, nom }) => (
                  <button key={g} type="button" style={puce(geste === g)} onClick={() => (geste === 'pointer' && g === 'pointer' ? setGeste(null) : jouer(g))}>
                    {nom}
                  </button>
                ))}
                <button type="button" style={puce(false)} onClick={() => setCleEntree((n) => n + 1)}>
                  Arrivée
                </button>
                <button type="button" style={puce(false)} onClick={lancement}>
                  Allumage (lancement)
                </button>
              </div>
            </div>
            <div>
              <p style={surtitre}>Réglage Mouvement</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(['complet', 'reduit', 'aucun'] as const).map((n) => (
                  <button key={n} type="button" style={puce(niveau === n)} onClick={() => setNiveau(n)}>
                    {n === 'complet' ? 'Complet' : n === 'reduit' ? 'Réduit (pose et expression)' : 'Aucun (image fixe)'}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', marginTop: 16 }}>
          <section style={carte}>
            <p style={surtitre}>Petite version (appels, réactions)</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {(['content', 'tres-content', 'surpris', 'alerte'] as const).map((e) => (
                <AjmaniPetit key={e} emotion={e} taille={64} mouvement={niveau} />
              ))}
            </div>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, background: '#2A2925', border: `1px solid ${C.bord}`, borderRadius: 16, padding: '8px 12px 8px 8px', maxWidth: 360 }}>
              <AjmaniPetit emotion="tres-content" taille={52} mouvement={niveau} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>{langue === 'fr' ? 'Facture encaissée. Belle journée.' : 'Invoice paid. Nice day.'}</span>
            </div>
          </section>
          <section style={{ ...carte, background: '#EDEAE4' }}>
            <p style={{ ...surtitre, color: '#55514A' }}>Ombre chinoise : reconnaissable ?</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Ajmani emotion="neutre" taille={170} teintes={OMBRE} qualite="legere" mouvement="aucun" />
            </div>
          </section>
        </div>

        <section style={{ ...carte, marginTop: 16 }}>
          <p style={surtitre}>Ce qu’il dit — par situation, registre {registre}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {(['serieux', 'chill', 'taquin'] as const).map((r) => (
              <button key={r} type="button" style={puce(registre === r)} onClick={() => setRegistre(r)}>
                {r === 'serieux' ? 'Sérieux' : r === 'chill' ? 'Chill' : 'Taquin'}
              </button>
            ))}
            <span style={{ width: 12 }} />
            {(['fr', 'en'] as const).map((l) => (
              <button key={l} type="button" style={puce(langue === l)} onClick={() => setLangue(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 180px) 1fr', gap: '10px 16px', margin: 0 }}>
            {SITUATIONS.map((s: Situation) => {
              const v = BIBLIOTHEQUE[langue][s];
              const liste = v[registre] ?? v.chill ?? v.serieux;
              const force = !v[registre];
              return (
                <React.Fragment key={s}>
                  <dt style={{ font: '12px/1.6 ui-monospace, monospace', color: C.doux }}>{s}</dt>
                  <dd style={{ margin: 0 }}>
                    {liste.map((p) => (
                      <div key={p}>
                        {remplir(p, exemple)}
                        {force && <span style={{ color: C.doux, fontSize: 12 }}> · {s.startsWith('alerte') ? 'toujours sérieux' : 'repli'}</span>}
                      </div>
                    ))}
                  </dd>
                </React.Fragment>
              );
            })}
          </dl>
        </section>
      </main>
    </MotionConfig>
  );
}

const racine = document.getElementById('racine');
if (racine) createRoot(racine).render(<Apercu />);
