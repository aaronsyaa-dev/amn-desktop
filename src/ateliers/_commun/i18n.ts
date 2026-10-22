import { textes } from './textes';

const EN = {
  atelier: 'Workshop',
  bacASable: 'Sandbox: every figure on this screen is made up. Nothing is saved or sent.',
  niveau: 'Level',
  'niveau.essentiel': 'Essential',
  'niveau.courant': 'Everyday',
  'niveau.avance': 'Advanced',
} as const;

const FR: Record<keyof typeof EN, string> = {
  atelier: 'Atelier',
  bacASable: 'Bac à sable : tous les chiffres de cet écran sont fictifs. Rien n’est enregistré ni envoyé.',
  niveau: 'Niveau',
  'niveau.essentiel': 'Essentiel',
  'niveau.courant': 'Courant',
  'niveau.avance': 'Avancé',
};

export const { useTextes: useTextesCommuns, dicos: DICOS_COMMUNS } = textes(EN, FR);
