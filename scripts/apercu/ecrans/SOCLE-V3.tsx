/**
 * APERÇU « SOCLE-V3 » — les composants v3 du socle (§0.4) et la couche de mouvement (§0.2), sur des données
 * FICTIVES de bac à sable. Pas d'image de référence : la capture (mouvement réduit) sert de contrôle visuel de
 * l'état final de chaque animation.
 *
 *   npm run apercu -- SOCLE-V3
 *   node scripts/qualite/fidelite/capturer.mjs --page /tmp/apercu/SOCLE-V3/index.html --sortie /tmp/apercu/SOCLE-V3.png
 */
import React, { useState } from 'react';
import '../../../src/refonte/accueil/Ambiance';
import {
  Anneau,
  BarreProgression,
  Barres,
  Carte,
  Caret,
  Courbe,
  FilterChips,
  FlowLine,
  Gauge,
  HeatCell,
  InlineSuggestion,
  LiveDot,
  MiniCourbe,
  Raccourci,
  Severity,
  type NiveauSeverite,
} from '../../../src/socle/ui';
import { arriveeLigne } from '../../../src/socle/couche-mouvement';

const JOURNAL: { heure: string; niveau: NiveauSeverite; texte: string }[] = [
  { heure: '10:42:07', niveau: 'critique', texte: 'Tentatives répétées sur le poste 4' },
  { heure: '10:39:51', niveau: 'moyen', texte: 'Certificat du serveur B à renouveler' },
  { heure: '10:31:40', niveau: 'faible', texte: 'Mise à jour en attente, poste 2' },
  { heure: '10:30:02', niveau: 'info', texte: 'Sauvegarde du soir planifiée' },
  { heure: '10:28:03', niveau: 'ok', texte: 'Connexion acceptée, poste 3' },
];
const JOURS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];
const HEURES = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
/** Une intensité fictive par jour et par heure, de 0 à 1 (un pic le mercredi après-midi). */
const intensite = (j: number, h: number): number => {
  const pic = Math.exp(-((j - 2) ** 2) / 3 - ((h - 6) ** 2) / 10);
  return j >= 5 ? pic * 0.15 : Math.round(pic * 100) / 100;
};
const COURBE = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.'].map((etiquette, i) => ({ etiquette, valeur: [3200, 3900, 3600, 4400, 4100, 5200, 4800, 5600, 6100, 6400][i] }));
const BARRES = JOURS.map((etiquette, i) => ({ etiquette, valeur: [12, 18, 9, 21, 15, 4, 2][i] }));
const PUCES = [
  { cle: 'tout', libelle: 'Tout', compteur: 18 },
  { cle: 'critique', libelle: 'Critiques', compteur: 2 },
  { cle: 'moyen', libelle: 'Moyens', compteur: 5 },
  { cle: 'faible', libelle: 'Faibles', compteur: 11 },
];

const page: React.CSSProperties = {
  boxSizing: 'border-box',
  width: 1440,
  height: 900,
  overflow: 'hidden',
  padding: '24px 40px',
  backgroundColor: 'var(--socle-fond-page)',
  backgroundImage: 'var(--socle-halo)',
  color: 'var(--socle-texte-1)',
};
const grille: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gridTemplateRows: 'repeat(3, 246px)', gap: 14, marginTop: 20 };
const ligne: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' };
const secondaire: React.CSSProperties = { color: 'var(--socle-texte-3)', fontSize: 12 };

function Journal() {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
      {JOURNAL.map((l, i) => (
        <li
          key={l.heure}
          {...(i === 0 ? arriveeLigne() : {})}
          data-mvt-survol="ligne"
          className="sc-mono"
          style={{ display: 'grid', gridTemplateColumns: '64px 70px minmax(0, 1fr)', alignItems: 'baseline', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--socle-bord-ligne)', fontSize: 12 }}
        >
          <span style={{ color: 'var(--socle-texte-3)' }}>{l.heure}</span>
          <Severity niveau={l.niveau} />
          <span style={{ color: 'var(--socle-texte-courant)', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.texte}</span>
        </li>
      ))}
    </ul>
  );
}

function Chaleur() {
  return (
    <div role="group" aria-label="Alertes par jour et par heure" style={{ display: 'grid', gridTemplateColumns: `34px repeat(${HEURES.length}, 22px)`, gap: 4, alignItems: 'center', justifyContent: 'center' }}>
      <span aria-hidden />
      {HEURES.map((h) => (
        <span key={h} aria-hidden style={{ color: 'var(--socle-texte-3)', fontSize: 10.5, textAlign: 'center' }}>
          {h}
        </span>
      ))}
      {JOURS.map((jour, j) => (
        <React.Fragment key={jour}>
          <span aria-hidden style={{ color: 'var(--socle-texte-3)', fontSize: 10.5 }}>
            {jour}
          </span>
          {HEURES.map((h, i) => {
            const v = intensite(j, i);
            return <HeatCell key={h} intensite={v} taille={18} libelle={`${jour} ${h} h : ${Math.round(v * 10)} alertes`} />;
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

function Flux() {
  const noeuds = [
    { x: 6, y: 4, l: 'Facture' },
    { x: 6, y: 80, l: 'Devis' },
    { x: 170, y: 42, l: 'Paiement' },
    { x: 300, y: 42, l: 'Banque' },
  ];
  return (
    <svg viewBox="0 0 396 112" width="396" height="112" role="group" aria-label="Flux de paiement" style={{ display: 'block', overflow: 'visible' }}>
      <FlowLine de={[96, 18]} a={[170, 56]} ton="info" libelle="Facture vers paiement, en cours" />
      <FlowLine de={[96, 94]} a={[170, 56]} duree={2200} />
      <FlowLine de={[260, 56]} a={[300, 56]} actif={false} ton="attention" libelle="En attente de la banque" />
      {noeuds.map((n) => (
        <g key={n.l} data-mvt-survol="noeud">
          <rect x={n.x} y={n.y} width={90} height={28} rx={8} style={{ fill: 'var(--socle-sous-carte)', stroke: 'var(--socle-bord-carte)' }} />
          <text x={n.x + 45} y={n.y + 18} textAnchor="middle" style={{ fill: 'var(--socle-texte-courant)', fontSize: 12 }}>
            {n.l}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function SocleV3() {
  const [filtre, setFiltre] = useState('tout');
  return (
    <main style={page} data-refonte-police="inter">
      <header>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Socle v3 — vivant et mouvement</h1>
        <p style={{ margin: '7px 0 0', color: 'var(--socle-texte-3)', fontSize: 13.5 }}>Composants du §0.4 et couche de mouvement du §0.2, sur des données fictives. État final, en mouvement réduit.</p>
      </header>
      <div style={grille}>
        <Carte rang={0} titre="Voyants vivants" compacte>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
            <LiveDot libelle="En direct" afficherLibelle />
            <LiveDot ton="info" libelle="Prochain rendez-vous · 11:00" afficherLibelle />
            <LiveDot ton="attention" libelle="Synchronisation lente" afficherLibelle />
            <LiveDot ton="critique" libelle="Alerte en cours" afficherLibelle />
            <LiveDot libelle="Personne 1 en ligne" afficherLibelle taille={6} halo={false} onde={false} />
            <LiveDot ton="info" libelle="Veille, sans onde" afficherLibelle onde={false} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 46, marginTop: 14, padding: '0 14px', border: '1px solid var(--socle-bord-controle)', borderRadius: 14, background: 'var(--socle-champ)' }}>
            <Caret />
            <span style={{ flex: 1, color: 'var(--socle-texte-3)', fontSize: 13 }}>Demandez à Ajmani</span>
            <span style={{ color: 'var(--socle-texte-3)', fontSize: 11.5 }}>Entrée pour envoyer</span>
            <Raccourci>⌘J</Raccourci>
          </div>
        </Carte>

        <Carte rang={1} titre="Journal et niveaux" compacte>
          <div style={ligne}>
            <FilterChips libelle="Filtrer par niveau" puces={PUCES} valeur={filtre} onChange={setFiltre} />
          </div>
          <Journal />
        </Carte>

        <Carte rang={2} titre="Jauges et anneau" compacte>
          <div style={{ ...ligne, justifyContent: 'space-between' }}>
            <Gauge valeur={86} ton="ok" libelle="Score de conformité" />
            <Gauge valeur={64} ton="attention" libelle="Couverture des sauvegardes" />
            <Anneau valeur={0.42} ton="critique" libelle="Correctifs appliqués" />
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            <span style={secondaire}>12 sur 15 jalons</span>
            <BarreProgression valeur={12 / 15} libelle="Jalons" texte="12 sur 15" hauteur={8} reperes />
            <span style={secondaire}>5 sur 8 faites</span>
            <BarreProgression valeur={5 / 8} libelle="Tâches du jour" texte="5 sur 8" />
          </div>
        </Carte>

        <Carte rang={3} titre="Carte de chaleur" compacte>
          <Chaleur />
        </Carte>

        <Carte rang={4} titre="Liens qui avancent" compacte>
          <Flux />
          <div style={{ marginTop: 12 }}>
            <InlineSuggestion texte="Relier la facture 0142 au paiement reçu hier ?" onOui={() => undefined} onNon={() => undefined} />
          </div>
        </Carte>

        <Carte rang={5} titre="Balayage" compacte>
          <div style={{ ...ligne, justifyContent: 'space-between' }}>
            <span style={{ position: 'relative', display: 'block', width: 132, height: 132, overflow: 'hidden', border: '1px solid var(--socle-bord-carte)', borderRadius: '50%', background: 'var(--socle-sous-carte)' }}>
              <span data-mvt="balayage" style={{ position: 'absolute', inset: 0 }} />
              <span style={{ position: 'absolute', inset: 32, border: '1px solid var(--socle-bord-carte)', borderRadius: '50%' }} />
              <span style={{ position: 'absolute', left: 84, top: 40 }}>
                <LiveDot ton="critique" libelle="Exposition repérée" />
              </span>
            </span>
            <div style={{ display: 'grid', gap: 10 }}>
              <span className="sc-mono" style={{ color: 'var(--socle-texte-1)', fontSize: 18 }}>3 840,00 €</span>
              <span className="sc-mono" style={{ color: 'var(--socle-texte-courant)', fontSize: 12 }}>FAC-2026-0142</span>
              <MiniCourbe valeurs={[12, 14, 13, 17, 16, 19, 18, 22]} libelle="Tendance" ton="argent" />
            </div>
          </div>
        </Carte>

        <Carte rang={6} titre="Encaissements" compacte>
          <Courbe donnees={COURBE} libelle="Encaissements" hauteur={150} ton="argent" interactif={false} formater={(v) => `${Math.round(v / 100) / 10} k`} />
        </Carte>

        <Carte rang={7} titre="Appels de la semaine" compacte>
          <Barres donnees={BARRES} libelle="Appels" hauteur={150} interactif={false} />
        </Carte>

        <Carte rang={8} titre="Survols" compacte>
          <div style={{ display: 'grid', gap: 10 }}>
            <div data-mvt-survol="carte" style={{ padding: '10px 12px', border: '1px solid var(--socle-bord-survol)', borderRadius: 11, color: 'var(--socle-texte-courant)', fontSize: 12.5 }}>
              Carte survolée : bordure #303033
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--socle-survol)', color: 'var(--socle-texte-courant)', fontSize: 12.5 }}>Bouton secondaire survolé : fond #1c1c1e</div>
            <div style={{ padding: '10px 12px', background: 'var(--socle-ligne-survol)', borderBottom: '1px solid var(--socle-bord-ligne)', color: 'var(--socle-texte-courant)', fontSize: 12.5 }}>
              Ligne survolée : fond blanc à 3 %
            </div>
          </div>
        </Carte>
      </div>
    </main>
  );
}
