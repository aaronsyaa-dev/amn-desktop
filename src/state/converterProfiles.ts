import type { CalcProfile } from './calcEngine';

/**
 * LES CONVERTISSEURS — des profils du moteur de calcul, rien d'autre.
 *
 * Même moteur que les Calculateurs et que le budget avant la paie : des
 * entrées, des étapes en formules, des sorties. Les facteurs sont physiques
 * et fixes (un pouce fait 2,54 cm) ; là où le monde bouge — les devises — le
 * taux est une ENTRÉE que la personne saisit, jamais un chiffre embarqué qui
 * finirait par mentir.
 */
export const CONVERTER_PROFILES: CalcProfile[] = [
  {
    id: 'convert-longueur',
    label: 'Longueurs',
    description: 'Mètres, centimètres, pouces et pieds, depuis une même valeur en mètres.',
    inputs: [{ key: 'm', label: 'Mètres', kind: 'number', defaultValue: 1 }],
    steps: [
      { key: 'cm', label: 'Centimètres', formula: 'm * 100', kind: 'number', output: true, headline: true },
      { key: 'km', label: 'Kilomètres', formula: 'm / 1000', kind: 'number', output: true },
      { key: 'in', label: 'Pouces', formula: 'm / 0.0254', kind: 'number', output: true },
      { key: 'ft', label: 'Pieds', formula: 'm / 0.3048', kind: 'number', output: true },
    ],
  },
  {
    id: 'convert-poids',
    label: 'Poids',
    description: 'Kilogrammes vers grammes, livres et onces.',
    inputs: [{ key: 'kg', label: 'Kilogrammes', kind: 'number', defaultValue: 1 }],
    steps: [
      { key: 'g', label: 'Grammes', formula: 'kg * 1000', kind: 'number', output: true, headline: true },
      { key: 'lb', label: 'Livres', formula: 'kg / 0.45359237', kind: 'number', output: true },
      { key: 'oz', label: 'Onces', formula: 'kg / 0.028349523125', kind: 'number', output: true },
    ],
  },
  {
    id: 'convert-volume',
    label: 'Volumes',
    description: 'Litres vers millilitres, centilitres et gallons américains.',
    inputs: [{ key: 'l', label: 'Litres', kind: 'number', defaultValue: 1 }],
    steps: [
      { key: 'ml', label: 'Millilitres', formula: 'l * 1000', kind: 'number', output: true, headline: true },
      { key: 'cl', label: 'Centilitres', formula: 'l * 100', kind: 'number', output: true },
      { key: 'gal', label: 'Gallons (US)', formula: 'l / 3.785411784', kind: 'number', output: true },
    ],
  },
  {
    id: 'convert-temperature',
    label: 'Températures',
    description: 'Degrés Celsius vers Fahrenheit et Kelvin.',
    inputs: [{ key: 'c', label: 'Degrés Celsius', kind: 'number', defaultValue: 20 }],
    steps: [
      { key: 'f', label: 'Fahrenheit', formula: 'c * 9 / 5 + 32', kind: 'number', output: true, headline: true },
      { key: 'k', label: 'Kelvin', formula: 'c + 273.15', kind: 'number', output: true },
    ],
  },
  {
    id: 'convert-surface',
    label: 'Surfaces',
    description: 'Mètres carrés vers hectares, pieds carrés et ares.',
    inputs: [{ key: 'm2', label: 'Mètres carrés', kind: 'number', defaultValue: 50 }],
    steps: [
      { key: 'ft2', label: 'Pieds carrés', formula: 'm2 / 0.09290304', kind: 'number', output: true, headline: true },
      { key: 'a', label: 'Ares', formula: 'm2 / 100', kind: 'number', output: true },
      { key: 'ha', label: 'Hectares', formula: 'm2 / 10000', kind: 'number', output: true },
    ],
  },
  {
    id: 'convert-ttc',
    label: 'HT et TTC',
    description: 'D’un montant hors taxes au toutes taxes comprises, et la TVA entre les deux.',
    inputs: [
      { key: 'ht', label: 'Montant hors taxes', kind: 'money', defaultValue: 10000 },
      { key: 'tva', label: 'Taux de TVA', kind: 'percent', defaultValue: 20, help: '20, 10, 5,5 ou 2,1' },
    ],
    steps: [
      { key: 'montantTva', label: 'TVA', formula: 'ht * tva / 100', kind: 'money', output: true },
      { key: 'ttc', label: 'Toutes taxes comprises', formula: 'ht + ht * tva / 100', kind: 'money', output: true, headline: true },
    ],
  },
  {
    id: 'convert-ht',
    label: 'TTC vers HT',
    description: 'Retrouver le hors taxes depuis un prix affiché toutes taxes comprises.',
    inputs: [
      { key: 'ttc', label: 'Montant toutes taxes comprises', kind: 'money', defaultValue: 12000 },
      { key: 'tva', label: 'Taux de TVA', kind: 'percent', defaultValue: 20 },
    ],
    steps: [
      { key: 'ht', label: 'Hors taxes', formula: 'ttc / (1 + tva / 100)', kind: 'money', output: true, headline: true },
      { key: 'montantTva', label: 'TVA', formula: 'ttc - ttc / (1 + tva / 100)', kind: 'money', output: true },
    ],
  },
  {
    id: 'convert-devise',
    label: 'Devises',
    description: 'Un montant et le taux du jour, que vous saisissez : aucun taux n’est embarqué, il serait faux demain.',
    inputs: [
      { key: 'montant', label: 'Montant', kind: 'number', defaultValue: 100 },
      { key: 'taux', label: 'Taux (1 unité de départ = … unités d’arrivée)', kind: 'number', defaultValue: 1, help: 'Par exemple 1,08 pour passer d’euros en dollars ce jour-là' },
    ],
    steps: [{ key: 'converti', label: 'Converti', formula: 'montant * taux', kind: 'number', output: true, headline: true }],
  },
];
