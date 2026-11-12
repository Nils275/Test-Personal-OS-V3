/* Registre des espaces — chargement isolé par import dynamique.
   Une erreur de syntaxe dans une vue ne bloque plus le démarrage : elle est
   attribuée à son module et les autres espaces restent utilisables. */
export const SectionLabels = {
  maison: 'MAISON', 'maison-meteo': 'MÉTÉO', 'maison-actualites': 'ACTUALITÉS',
  'maison-calendrier': 'CALENDRIER MAISON', 'maison-courses': 'COURSES', 'maison-cuisine': 'CUISINE',
  'maison-quotidien': 'QUOTIDIEN', 'maison-entretien': 'ENTRETIEN', 'maison-budget': 'BUDGET MAISON',
  'maison-documents': 'DOCUMENTS', 'maison-sophie': 'SOPHIE MAISON',
  goals: 'OBJECTIFS', sport: 'SPORT & SPV', projects: 'PROJETS',
  finances: 'FINANCES', calendar: 'CALENDRIER', devices: 'APPAREILS', reminders: 'RAPPELS',
  notifications: 'NOTIFICATIONS', assistant: 'PERSONAL VOICE', journal: 'JOURNAL PERSONNEL', settings: 'PARAMÈTRES'
};
export const Sections = Object.keys(SectionLabels);
export { ViewState } from './view-state.js';

const MAISON = ['maison', 'maison-meteo', 'maison-actualites', 'maison-calendrier', 'maison-courses',
  'maison-cuisine', 'maison-quotidien', 'maison-entretien', 'maison-budget', 'maison-documents', 'maison-sophie'];

const LOADERS = {
  // L'ancien cockpit a été retiré : ses anciens liens ouvrent Maison.
  dashboard: () => import('./views-maison.js').then(m => m.MaisonViews.maison),
  goals: () => import('./views-primary.js').then(m => m.Goals),
  sport: () => import('./views-primary.js').then(m => m.Sport),
  projects: () => import('./views-primary.js').then(m => m.Projects),
  finances: () => import('./views-operations.js').then(m => m.Finances),
  calendar: () => import('./views-operations.js').then(m => m.Calendar),
  devices: () => import('./views-operations.js').then(m => m.Devices),
  reminders: () => import('./views-reminders.js').then(m => m.RemindersView),
  notifications: () => import('./views-operations.js').then(m => m.Notifications),
  assistant: () => import('./views-operations.js').then(m => m.Assistant),
  journal: () => import('./views-operations.js').then(m => m.Journal),
  settings: () => import('./views-operations.js').then(m => m.Settings)
};
MAISON.forEach(key => { LOADERS[key] = () => import('./views-maison.js').then(m => m.MaisonViews[key]); });

const cache = new Map();

/* Retourne la fonction de rendu, ou une vue d'erreur explicite si le module échoue. */
export async function loadView(section) {
  if (cache.has(section)) return cache.get(section);
  const loader = LOADERS[section];
  if (!loader) return null;
  try {
    const render = await loader();
    if (typeof render !== 'function') throw new Error(`Le module de « ${section} » n’expose pas de fonction de rendu.`);
    cache.set(section, render);
    return render;
  } catch (error) {
    console.error(`Module de la vue « ${section} » indisponible`, error);
    return () => `<section class="fatal-view"><span class="eyebrow">MODULE INDISPONIBLE</span><h1>Espace « ${SectionLabels[section] || section} » non chargé</h1>
      <p>Le module correspondant contient une erreur et n’a pas pu être analysé.<br>Les autres espaces de PERSONAL OS restent pleinement utilisables.</p>
      <div class="boot-diagnostic">${String(error.stack || error.message || error).slice(0, 1200)}</div>
      <button class="button primary" onclick="location.reload()">Recharger après correction</button></section>`;
  }
}
