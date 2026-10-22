import { declarerFamille, vue } from '../declarer';

/**
 * MA JOURNÉE — ce qu’on organise et suit chaque jour, et ce qui est « pour moi ».
 *
 * Regroupés (une entrée, plusieurs vues, aucune route supprimée) : Accueil et
 * tableau de bord ; Calendrier et RDV en ligne ; Tâches et priorités du jour ;
 * Projets et tableau ; Planning et absences ; Habitudes et routines.
 */

export default declarerFamille({
  id: 'jour',
  ordre: 1,
  teinte: 'jour',
  nom: { fr: 'Ma journée', en: 'My day' },
  actions: {
    organiser: { fr: 'Organiser ma journée', en: 'Plan my day' },
    suivre: { fr: 'Suivre l’avancement', en: 'Track progress' },
    equipe: { fr: 'Gérer l’équipe', en: 'Run the team' },
    perso: { fr: 'Pour moi', en: 'Just for me' },
  },
  modules: [
    {
      nom: { fr: 'Accueil et tableau de bord', en: 'Home and dashboard' },
      action: 'organiser',
      niveau: 'essentiel',
      vues: [
        vue('home', '/', ['voir ma journée', 'commencer la journée', 'revenir à l’accueil'], ['accueil', 'qg', 'aujourd’hui', 'début']),
        vue('dashboard', '/tableau-de-bord', ['voir mes chiffres', 'choisir un cadran'], ['tableau de bord', 'indicateurs', 'kpi', 'chiffres']),
      ],
    },
    {
      nom: { fr: 'Calendrier et RDV en ligne', en: 'Calendar and online booking' },
      action: 'organiser',
      niveau: 'essentiel',
      vues: [
        vue('agenda', '/agenda', ['prendre un rendez-vous', 'voir mon agenda', 'bloquer un créneau', 'planifier un rendez-vous'], ['calendrier', 'rdv', 'rendez-vous', 'disponibilités', 'date']),
        vue('booking', '/rdv-en-ligne', ['laisser mes clients réserver', 'ouvrir des créneaux en ligne'], ['réservation', 'rdv en ligne', 'prise de rendez-vous']),
      ],
    },
    {
      nom: { fr: 'Tâches et priorités du jour', en: 'Tasks and today’s priorities' },
      action: 'organiser',
      niveau: 'essentiel',
      vues: [
        vue('tasks', '/tasks', ['ajouter une tâche', 'assigner une tâche', 'cocher une tâche'], ['tâche', 'todo', 'à faire', 'liste']),
        vue('priorities', '/priorites', ['choisir mes priorités', 'décider quoi faire aujourd’hui'], ['priorité', 'focus', 'urgent']),
      ],
    },
    {
      nom: { fr: 'Projets et tableau', en: 'Projects and board' },
      action: 'suivre',
      niveau: 'essentiel',
      vues: [
        vue('projects', '/projets', ['créer un projet', 'suivre un projet', 'voir ce qui bloque'], ['projet', 'chantier', 'dossier', 'avancement']),
        vue('board', '/tableau-projets', ['voir les projets en colonnes', 'déplacer un projet'], ['kanban', 'tableau', 'colonnes', 'projet']),
      ],
    },
    { action: 'suivre', niveau: 'courant', vues: [vue('okr', '/objectifs-resultats', ['fixer un objectif', 'mesurer un résultat'], ['okr', 'objectif', 'saison', 'kpi'])] },
    { action: 'suivre', niveau: 'courant', vues: [vue('weekly', '/revue-hebdo', ['faire le bilan de la semaine', 'préparer la semaine prochaine'], ['revue', 'hebdo', 'vendredi', 'bilan', 'rétrospective'])] },
    { action: 'suivre', niveau: 'courant', vues: [vue('time', '/temps', ['noter le temps passé', 'lancer le chronomètre'], ['temps', 'chrono', 'chronomètre', 'heures'])] },
    {
      nom: { fr: 'Planning et absences', en: 'Schedule and time off' },
      action: 'equipe',
      niveau: 'courant',
      vues: [
        vue('shifts', '/planning', ['faire le planning', 'voir qui travaille cette semaine'], ['planning', 'horaires', 'roulement', 'équipe']),
        vue('leaves', '/absences', ['poser un congé', 'déclarer une absence', 'voir qui est absent'], ['absence', 'congé', 'vacances', 'maladie', 'télétravail']),
      ],
    },
    {
      nom: { fr: 'Habitudes et routines', en: 'Habits and routines' },
      action: 'perso',
      niveau: 'courant',
      vues: [
        vue('habits', '/personnel/habitudes', ['cocher une habitude', 'suivre mes habitudes'], ['habitude', 'série', 'perso']),
        vue('routines', '/routines', ['cocher une routine', 'créer une routine'], ['routine', 'habitude', 'quotidien', 'récurrent']),
      ],
    },
    { action: 'perso', niveau: 'courant', vues: [vue('budget', '/personnel/budget', ['savoir ce qu’il me reste à dépenser'], ['budget', 'paie', 'perso', 'reste à vivre'])] },
    { action: 'perso', niveau: 'courant', vues: [vue('courses', '/personnel/courses', ['faire ma liste de courses'], ['courses', 'liste', 'supermarché'])] },
    { action: 'perso', niveau: 'avance', vues: [vue('personalGoals', '/personnel/objectifs', ['fixer un objectif personnel'], ['objectif', 'perso', 'but'])] },
    { action: 'perso', niveau: 'avance', vues: [vue('pomodoro', '/personnel/pomodoro', ['me concentrer 25 minutes', 'lancer un pomodoro'], ['pomodoro', 'concentration', 'minuteur'])] },
    { action: 'perso', niveau: 'avance', vues: [vue('health', '/personnel/sante', ['noter un rendez-vous médical', 'suivre mes échéances de santé'], ['santé', 'médecin', 'vaccin'])] },
  ],
});
