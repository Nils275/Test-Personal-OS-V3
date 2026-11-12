/* PERSONAL OS — Noyau : utilitaires, persistance, dépôt CRUD et automatisations.
   Aucune dépendance. Remplacer LocalAdapter par un adaptateur Supabase suffit
   pour conserver l'API Store/Repo côté interface. */

export const APP_VERSION = '1.1.0';
export const BUILD = '3.3.0 · mosaïque + caméra';
export const STORAGE_PREFIX = 'personal-os.v1';

export const Utils = {
  uid(prefix = 'id') {
    if (globalThis.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  },
  esc(value = '') {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  },
  clamp(value, min = 0, max = 100) { return Math.min(max, Math.max(min, Number(value) || 0)); },
  round(value, digits = 0) { const p = 10 ** digits; return Math.round((Number(value) || 0) * p) / p; },
  iso(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  },
  day(offset = 0, base = new Date()) {
    const d = new Date(base); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset);
    return Utils.iso(d);
  },
  localDateTime(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  },
  parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  },
  formatDate(value, options = {}) {
    const d = Utils.parseDate(value);
    if (!d) return '—';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: options.year ? 'numeric' : undefined, ...options }).format(d);
  },
  formatLongDate(value = new Date()) {
    const d = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  },
  formatTime(value) {
    const d = Utils.parseDate(value);
    return d ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d) : '—';
  },
  formatDateTime(value) {
    const d = Utils.parseDate(value);
    return d ? `${Utils.formatDate(d, { year: 'numeric' })} · ${Utils.formatTime(d)}` : '—';
  },
  money(value, compact = false) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', notation: compact ? 'compact' : 'standard', maximumFractionDigits: compact ? 1 : 2 }).format(Number(value) || 0);
  },
  relative(value) {
    const d = Utils.parseDate(value);
    if (!d) return '—';
    const diff = d.getTime() - Date.now();
    const abs = Math.abs(diff);
    const unit = abs >= 86400000 ? 'day' : abs >= 3600000 ? 'hour' : 'minute';
    const divisor = unit === 'day' ? 86400000 : unit === 'hour' ? 3600000 : 60000;
    return new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' }).format(Math.round(diff / divisor), unit);
  },
  startOfWeek(date = new Date()) {
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    const day = d.getDay() || 1; d.setDate(d.getDate() - day + 1); return d;
  },
  monthKey(value = new Date()) {
    const d = value instanceof Date ? value : new Date(value);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },
  monthLabel(key) {
    const d = new Date(`${key}-01T12:00:00`);
    return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(d);
  },
  safeUrl(value) {
    if (!value) return '';
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; }
    catch { return ''; }
  },
  slug(value) { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); },
  download(filename, content, type = 'application/json') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};

export const Bus = {
  events: new Map(),
  on(name, handler) {
    if (!this.events.has(name)) this.events.set(name, new Set());
    this.events.get(name).add(handler);
    return () => this.events.get(name)?.delete(handler);
  },
  emit(name, payload = {}) {
    this.events.get(name)?.forEach(handler => {
      try { handler(payload); } catch (error) { console.error(`[Bus:${name}]`, error); }
    });
  }
};

const GOAL_CATEGORIES = ['Personnel', 'Professionnel', 'Sport', 'Finances', 'Formation', 'Entrepreneuriat'];
const PROJECT_STATUSES = ['Idée', 'À planifier', 'En cours', 'En attente', 'Suspendu', 'Terminé'];
const SESSION_TYPES = ['Course', 'Pompes', 'Gainage', 'Natation', 'Renforcement musculaire', 'Mobilité', 'Autre'];
export const Taxonomy = { GOAL_CATEGORIES, PROJECT_STATUSES, SESSION_TYPES,
  priorities: ['Basse', 'Normale', 'Haute', 'Critique'],
  eventCategories: ['Personnel', 'Travail', 'Sport', 'SPV', 'Projet', 'Finance', 'Santé', 'Autre'],
  deviceCategories: ['Ordinateur', 'Smartphone', 'Tablette', 'Véhicule', 'Domotique', 'Autre'],
  journalTypes: ['Note', 'Événement', 'Réussite', 'Difficulté', 'Commentaire'],
  transactionCategories: ['Logement', 'Alimentation', 'Transport', 'Santé', 'Sport', 'Abonnements', 'Loisirs', 'Épargne', 'Salaire', 'Mission', 'Remboursement', 'Autre']
};

const defaultRules = () => [
  { id: 'task_due', name: 'Échéance de tâche', description: 'Alerte le jour de l’échéance et en cas de retard.', enabled: true },
  { id: 'goal_risk', name: 'Objectif à surveiller', description: 'Signale une échéance proche avec une progression incomplète.', enabled: true },
  { id: 'sport_recorded', name: 'Séance enregistrée', description: 'Recalcule immédiatement les statistiques sportives.', enabled: true },
  { id: 'expense_recorded', name: 'Dépense enregistrée', description: 'Recalcule le budget du mois concerné.', enabled: true },
  { id: 'event_soon', name: 'Rappel d’événement', description: 'Déclenche le rappel défini sur chaque événement.', enabled: true },
  { id: 'subscription_due', name: 'Abonnement à renouveler', description: 'Signale un prélèvement dans les trois prochains jours.', enabled: true },
  { id: 'weekly_sport', name: 'Objectif sportif hebdomadaire', description: 'En fin de semaine, signale si les quatre séances indicatives ne sont pas atteintes.', enabled: true },
  { id: 'habit_target', name: 'Objectif d’habitude atteint', description: 'Confirme lorsqu’une habitude atteint sa fréquence hebdomadaire.', enabled: true }
];

const emptyData = mode => ({
  meta: { schema: 2, mode, demo: mode === 'demo', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  goals: [], sessions: [], projects: [], tasks: [], transactions: [], habits: [], alarms: [], reminders: [], sophieMemory: [],
  shoppingLists: [], recipes: [], mealPlans: [], homeTasks: [], homeAssets: [], homeBills: [], homeDocs: [], newsFavs: [], customCommands: [],
  finance: { monthlyBudget: 0, savingsTarget: 0 },
  events: [], devices: [], notifications: [], journal: [], assistant: [],
  automations: [], rules: defaultRules()
});

/* Jeu fictif dynamique : toutes les dates restent utiles, quelle que soit la date d'installation. */
function seedDemo() {
  const data = emptyData('demo');
  const now = new Date().toISOString();
  const goal = (name, category, priority, current, target, unit, deadline, offset, steps = []) => ({
    id: Utils.uid('goal'), name, category, priority, start: Utils.day(offset), deadline: Utils.day(deadline),
    current, target, unit, description: '', steps: steps.map((title, i) => ({ id: Utils.uid('step'), title, done: i === 0 })),
    comments: [{ id: Utils.uid('comment'), text: 'Point de situation ajouté au suivi.', date: now }],
    history: [{ id: Utils.uid('hist'), text: 'Objectif créé dans l’espace de démonstration.', date: now }], createdAt: now, updatedAt: now
  });
  data.goals = [
    goal('Tenir 40 minutes en gainage cumulé', 'Sport', 'Haute', 26, 40, 'min', 24, -32, ['Reprendre une routine régulière', 'Atteindre 30 minutes', 'Valider la cible']),
    goal('Finaliser le prototype PitLane', 'Entrepreneuriat', 'Critique', 68, 100, '%', 12, -48, ['Cadrer les parcours', 'Tester le prototype', 'Préparer la démonstration']),
    goal('Constituer une réserve de sécurité', 'Finances', 'Haute', 1850, 3000, '€', 120, -90, ['Ouvrir une enveloppe dédiée', 'Automatiser le suivi', 'Atteindre 3 000 €']),
    goal('Obtenir une certification mécanique', 'Formation', 'Normale', 7, 12, 'modules', 55, -20, ['Choisir le parcours', 'Terminer les modules', 'Passer l’évaluation']),
    goal('Préparer le dossier ALP Racing', 'Professionnel', 'Haute', 4, 10, 'livrables', 18, -15, ['Lister les pièces', 'Rédiger le dossier technique'])
  ];
  const project = (name, description, icon, category, status, priority, progress, budget, deadline, color) => ({
    id: Utils.uid('project'), name, description, icon, category, status, priority, progress, budget, deadline: Utils.day(deadline), color,
    notes: [{ id: Utils.uid('note'), text: `Note de cadrage : ${description}`, date: now }], documents: [], createdAt: Utils.day(-30), updatedAt: now
  });
  data.projects = [
    project('ALP Racing Suspension', 'Développement et validation d’un train roulant adapté aux contraintes compétition.', 'gauge', 'Professionnel', 'En cours', 'Haute', 62, 4800, 21, '#35BDE0'),
    project('PitLane', 'Outil de pilotage des opérations piste, des relais et de la télémétrie essentielle.', 'flag', 'Entrepreneuriat', 'En cours', 'Critique', 74, 2200, 10, '#37D6A0'),
    project('Préparation SPV', 'Plan de condition physique et suivi des habilitations de sapeur-pompier volontaire.', 'activity', 'Sport', 'En cours', 'Haute', 45, 350, 35, '#FF9A5A'),
    project('Atelier personnel', 'Réorganisation de l’espace de travail, rangement outillage et éclairage.', 'wrench', 'Personnel', 'À planifier', 'Normale', 18, 900, 60, '#A78BFA'),
    project('Veille suspensions', 'Capitalisation des essais, réglages et retours terrain dans une base documentaire.', 'book', 'Formation', 'Idée', 'Basse', 5, 0, 90, '#6E8795')
  ];
  const task = (title, projectIndex, due, status, priority = 'Normale') => ({
    id: Utils.uid('task'), title, projectId: data.projects[projectIndex]?.id || '', goalId: '', due: Utils.day(due), status, priority,
    notes: '', createdAt: now, updatedAt: now
  });
  data.tasks = [
    task('Comparer les mesures de détente', 0, 0, 'doing', 'Haute'),
    task('Commander les joints du kit', 0, -2, 'todo', 'Haute'),
    task('Tester le chronométrage hors ligne', 1, 1, 'doing', 'Critique'),
    task('Relire le parcours chef d’équipe', 1, 4, 'todo'),
    task('Planifier la séance fractionné', 2, 2, 'todo', 'Haute'),
    task('Mesurer les passages de câbles', 3, 8, 'todo'),
    task('Archiver le compte rendu d’essai', 0, -4, 'done')
  ];
  data.goals[1].history.push({ id: Utils.uid('hist'), text: 'Prototype revu après le dernier essai.', date: now });
  const session = (type, offset, duration, distance, reps, feeling, performance, status = 'Terminée') => ({
    id: Utils.uid('session'), type, date: Utils.localDateTime(new Date(`${Utils.day(offset)}T18:30:00`)), duration, distance, reps, feeling,
    performance, notes: '', status, createdAt: now, updatedAt: now
  });
  data.sessions = [
    session('Course', -1, 42, 7.2, 0, 8, '5:50 / km'),
    session('Renforcement musculaire', -3, 55, 0, 96, 7, '4 séries · charges stables'),
    session('Gainage', -5, 24, 0, 12, 6, '12 × 1 min'),
    session('Natation', -8, 38, 1.4, 0, 8, 'Crawl · rythme régulier'),
    session('Course', -10, 36, 6.1, 0, 7, '5:54 / km'),
    session('Pompes', -12, 18, 0, 140, 7, '5 séries · 28 répétitions'),
    session('Mobilité', -14, 25, 0, 0, 9, 'Hanches et épaules'),
    session('Course', -17, 34, 5.7, 0, 6, '5:58 / km'),
    session('Course', 2, 45, 8, 0, 0, 'Endurance fondamentale', 'Planifiée')
  ];
  const tx = (type, label, category, amount, offset) => ({ id: Utils.uid('tx'), type, label, category, amount, date: Utils.day(offset), notes: '', createdAt: now, updatedAt: now });
  data.transactions = [
    tx('income', 'Salaire — exemple fictif', 'Salaire', 2480, -3),
    tx('income', 'Mission technique — exemple fictif', 'Mission', 320, -8),
    tx('expense', 'Courses alimentaires — exemple fictif', 'Alimentation', 126.4, -2),
    tx('expense', 'Carburant — exemple fictif', 'Transport', 74.2, -4),
    tx('expense', 'Cotisation club — exemple fictif', 'Sport', 45, -6),
    tx('expense', 'Abonnement logiciel — exemple fictif', 'Abonnements', 19.99, -7),
    tx('expense', 'Outillage atelier — exemple fictif', 'Loisirs', 139.9, -10),
    tx('expense', 'Restaurant — exemple fictif', 'Loisirs', 48, -1),
    tx('income', 'Salaire du mois précédent — fictif', 'Salaire', 2480, -34),
    tx('expense', 'Charges du mois précédent — fictif', 'Logement', 820, -31)
  ];
  data.finance = {
    monthlyBudget: 900, savingsTarget: 300,
    subscriptions: [
      { id: Utils.uid('sub'), name: 'Suite logicielle — fictive', amount: 19.99, cycle: 'Mensuel', nextDate: Utils.day(3), active: true, notes: '' },
      { id: Utils.uid('sub'), name: 'Salle de sport — fictive', amount: 34.9, cycle: 'Mensuel', nextDate: Utils.day(8), active: true, notes: '' }
    ],
    debts: [{ id: Utils.uid('debt'), name: 'Prêt matériel — fictif', creditor: 'Organisme exemple', amount: 1200, paid: 300, rate: 1.8, due: Utils.day(160), notes: '' }]
  };
  const event = (title, offset, start, end, category, description, reminder = 30, projectIndex = null) => ({
    id: Utils.uid('event'), title, date: Utils.day(offset), start, end, category, description, reminder,
    projectId: projectIndex === null ? '' : data.projects[projectIndex]?.id || '', createdAt: now, updatedAt: now
  });
  data.events = [
    event('Revue hebdomadaire', 0, '18:00', '18:45', 'Travail', 'Priorités, blocages et prochaine étape.', 60),
    event('Endurance fondamentale', 0, '19:00', '19:45', 'Sport', 'Séance facile, contrôle du souffle.', 45, 2),
    event('Point prototype PitLane', 1, '09:30', '10:15', 'Projet', 'Vérifier le parcours et préparer les retours.', 60, 1),
    event('Entraînement SPV', 2, '18:30', '20:00', 'SPV', 'Tenue sportive et bouteille d’eau.', 120, 2),
    event('Échéance abonnement', 3, '08:00', '08:15', 'Finance', 'Vérifier le renouvellement fictif.', 720),
    event('Bilan du mois', 7, '17:30', '18:15', 'Personnel', 'Objectifs, finances et journal.', 60)
  ];
  const device = (name, brand, model, category, status, offset, warranty, notes) => ({
    id: Utils.uid('device'), name, brand, model, category, status, purchaseDate: Utils.day(offset), warranty,
    notes, lastCheck: Utils.localDateTime(new Date(`${Utils.day(-1)}T09:00:00`)), createdAt: now, updatedAt: now
  });
  data.devices = [
    device('Tablette command center', 'Marque exemple', 'Modèle fictif', 'Tablette', 'Opérationnel', -210, Utils.day(155), 'Support mural du bureau.'),
    device('Station de travail', 'Marque exemple', 'Configuration fictive', 'Ordinateur', 'Opérationnel', -420, Utils.day(310), 'Poste de conception et développement.'),
    device('Téléphone personnel', 'Marque exemple', 'Modèle fictif', 'Smartphone', 'À vérifier', -380, Utils.day(-15), 'Contrôle physique à effectuer.'),
    device('Capteur atelier', 'Marque exemple', 'Modèle fictif', 'Domotique', 'Hors service', -600, '', 'Diagnostic manuel requis.')
  ];
  data.journal = [
    { id: Utils.uid('journal'), type: 'Réussite', title: 'Prototype utilisable en conditions réelles', text: 'Le dernier essai a permis de valider le parcours principal et de réduire les saisies inutiles.', date: Utils.localDateTime(new Date(`${Utils.day(-1)}T21:10:00`)), tags: ['PitLane', 'essai'], createdAt: now, updatedAt: now },
    { id: Utils.uid('journal'), type: 'Difficulté', title: 'Récupération à améliorer', text: 'Deux séances rapprochées ont laissé une fatigue marquée. Prévoir une journée de mobilité.', date: Utils.localDateTime(new Date(`${Utils.day(-3)}T20:40:00`)), tags: ['sport', 'récupération'], createdAt: now, updatedAt: now },
    { id: Utils.uid('journal'), type: 'Note', title: 'Idée pour le prochain point', text: 'Commencer par les décisions à prendre plutôt que par la liste des sujets.', date: Utils.localDateTime(new Date(`${Utils.day(-5)}T08:20:00`)), tags: ['organisation'], createdAt: now, updatedAt: now }
  ];
  data.habits = [
    { id: Utils.uid('habit'), name: 'Boire 1,5 L d’eau', targetPerWeek: 7, color: '#35BDE0', completions: [Utils.day(0), Utils.day(-1), Utils.day(-2), Utils.day(-4), Utils.day(-5)], createdAt: now, updatedAt: now },
    { id: Utils.uid('habit'), name: 'Lire 20 minutes', targetPerWeek: 5, color: '#A78BFA', completions: [Utils.day(-1), Utils.day(-2), Utils.day(-3), Utils.day(-6)], createdAt: now, updatedAt: now },
    { id: Utils.uid('habit'), name: 'Mobilité du soir', targetPerWeek: 4, color: '#37D6A0', completions: [Utils.day(0), Utils.day(-2), Utils.day(-3)], createdAt: now, updatedAt: now }
  ];
  data.alarms = [
    { id: Utils.uid('alarm'), name: 'Réveil travail — exemple désactivé', time: '06:45', days: [1, 2, 3, 4, 5], date: '', enabled: false, lastTriggeredKey: '', snoozeUntil: null, createdAt: now, updatedAt: now }
  ];
  data.customCommands = [
    { id: Utils.uid('cmd'), name: 'Mot du soir — exemple fictif', triggers: ['bonne nuit', 'bonne nuit sophie'], response: 'Bonne nuit {nom}. Je garde la maison sous surveillance et je te réveille demain à 7 heures.', voice: true, action: '', createdAt: now, updatedAt: now },
    { id: Utils.uid('cmd'), name: 'Encouragement — exemple fictif', triggers: ['donne moi de la force', 'motivation'], response: '{nom}, tu tiens bon. Un pas après l’autre, c’est comme ça que les objectifs tombent.', voice: true, action: '', createdAt: now, updatedAt: now }
  ];
  data.assistant = [{ id: Utils.uid('chat'), role: 'assistant', text: 'Assistant local prêt. Mes réponses utilisent uniquement les données de cet espace.', date: now }];
  data.notifications = [
    { id: Utils.uid('notif'), title: 'Bienvenue dans PERSONAL OS', body: 'Cet espace contient exclusivement des données fictives de démonstration.', type: 'Information', priority: 'Normale', source: 'Système', read: false, date: now, dedupeKey: 'welcome-demo' },
    { id: Utils.uid('notif'), title: 'Prototype à consolider', body: 'PitLane approche de sa prochaine échéance.', type: 'Rappel', priority: 'Haute', source: 'Projets', read: false, date: new Date(Date.now() - 3600000).toISOString(), dedupeKey: 'demo-pitlane' }
  ];
  return data;
}

const DEFAULT_WIDGETS = [
  { id: 'goals', hidden: false, size: 'medium' }, { id: 'sport', hidden: false, size: 'medium' },
  { id: 'projects', hidden: false, size: 'medium' }, { id: 'finance', hidden: false, size: 'medium' },
  { id: 'weather', hidden: false, size: 'medium' }, { id: 'news', hidden: false, size: 'medium' }, { id: 'calendar', hidden: false, size: 'large' },
  { id: 'focus', hidden: false, size: 'medium' }, { id: 'reminders', hidden: false, size: 'medium' }, { id: 'habits', hidden: false, size: 'medium' },
  { id: 'spotify', hidden: false, size: 'large' }, { id: 'devices', hidden: false, size: 'medium' },
  { id: 'notifications', hidden: false, size: 'medium' }, { id: 'journal', hidden: false, size: 'large' }
];

const defaultSettings = () => ({
  accent: '#37D6A0', accent2: '#35BDE0', theme: 'nocturne', density: 'confortable', animations: true, reducedGlow: false,
  widgets: structuredClone(DEFAULT_WIDGETS), compactDashboard: true, voiceEnabled: true, voiceRate: 1, voicePitch: 1,
  autoAnnounce: true, announcementFrequency: 'important', announcementInterval: 5, quietEnabled: true, quietStart: '22:00', quietEnd: '07:00',
  browserNotifications: false, demoBanner: true, weather: { lat: '', lon: '', label: '', updatedAt: '', data: null, daily: null },
  spotifyUrl: '', focus: { mode: 'work', durations: { work: 25, break: 5 }, remaining: 1500, running: false, endAt: null, cycles: 0 },
  voiceProvider: 'auto', elevenlabsEndpoint: '', elevenlabsVoiceId: 'Kuy2kDCiyKmA79V9BbDr', llmEndpoint: '', assistantName: 'Sophie',
  userName: 'Nils', reminderStyle: 'Amical', reminderVoice: true, reminderRepeat: false, reminderRepeatDelay: 5, sophiePortrait: '',
  wakeWordEnabled: false, sophieConfirmSensitive: true, focusMode: false,
  startupSection: 'last', silentBoot: true, lastSection: 'dashboard', wakeLock: false,
  morningBriefing: { enabled: true, time: '07:15', lastDate: '' }, weeklyReport: { enabled: true, day: 0, time: '19:00', lastDate: '' },
  installDismissed: false,
  maisonLayout: 'mosaic', cameraArmed: false, cameraLabel: 'CAM 01 · SALON'
});

/* Conserve l'ordre utilisateur, supprime les doublons et ajoute les nouveaux widgets. */
const mergeWidgets = saved => {
  const source = Array.isArray(saved) ? saved : []; const seen = new Set(); const result = [];
  source.forEach(item => {
    const base = DEFAULT_WIDGETS.find(widget => widget.id === item?.id);
    if (base && !seen.has(base.id)) { result.push({ ...base, ...item }); seen.add(base.id); }
  });
  DEFAULT_WIDGETS.forEach(base => { if (!seen.has(base.id)) result.push({ ...base }); });
  return result;
};

class LocalAdapter {
  read(key, fallback = null) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (error) { console.error('Lecture locale impossible', error); return fallback; }
  }
  write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (error) { console.error('Écriture locale impossible', error); Bus.emit('storage:error', { error }); return false; }
  }
  remove(key) { try { localStorage.removeItem(key); } catch (error) { console.error(error); } }
}

const adapter = new LocalAdapter();
const modeKey = mode => `${STORAGE_PREFIX}.workspace.${mode}`;
const normalizeData = (data, mode) => {
  const base = emptyData(mode);
  const merged = { ...base, ...(data || {}) };
  ['goals', 'sessions', 'projects', 'tasks', 'transactions', 'habits', 'alarms', 'reminders', 'sophieMemory', 'shoppingLists', 'recipes', 'mealPlans', 'homeTasks',
    'homeAssets', 'homeBills', 'homeDocs', 'newsFavs', 'customCommands', 'events', 'devices', 'notifications', 'journal', 'assistant', 'automations', 'rules'].forEach(key => {
    if (!Array.isArray(merged[key])) merged[key] = [];
  });
  // Fusion des règles : les nouvelles règles applicatives sont ajoutées sans
  // réinitialiser les choix d'activation d'une sauvegarde existante.
  merged.rules = base.rules.map(rule => ({ ...rule, ...(merged.rules.find(saved => saved.id === rule.id) || {}) }));
  merged.finance = { ...base.finance, ...(data?.finance || {}) };
  if (!Array.isArray(merged.finance.subscriptions)) merged.finance.subscriptions = [];
  if (!Array.isArray(merged.finance.debts)) merged.finance.debts = [];
  merged.meta = { ...base.meta, ...(data?.meta || {}), mode, demo: mode === 'demo' };
  return merged;
};

export const Store = {
  mode: 'demo', data: null, settings: defaultSettings(), ready: false,
  init() {
    const savedMode = adapter.read(`${STORAGE_PREFIX}.mode`, 'demo');
    this.mode = ['demo', 'real'].includes(savedMode) ? savedMode : 'demo';
    this.settings = { ...defaultSettings(), ...adapter.read(`${STORAGE_PREFIX}.settings`, {}) };
    this.settings.weather = { ...defaultSettings().weather, ...(this.settings.weather || {}) };
    this.settings.focus = { ...defaultSettings().focus, ...(this.settings.focus || {}) };
    this.settings.focus.durations = { ...defaultSettings().focus.durations, ...(this.settings.focus.durations || {}) };
    this.settings.widgets = mergeWidgets(this.settings.widgets);
    this.data = this.readWorkspace(this.mode);
    this.ready = true;
    return this;
  },
  readWorkspace(mode) {
    const saved = adapter.read(modeKey(mode));
    if (saved) return normalizeData(saved, mode);
    const fresh = mode === 'demo' ? seedDemo() : emptyData(mode);
    adapter.write(modeKey(mode), fresh); return fresh;
  },
  saveSettings() { adapter.write(`${STORAGE_PREFIX}.settings`, this.settings); Bus.emit('settings:changed', this.settings); },
  setSetting(key, value) { this.settings[key] = value; this.saveSettings(); },
  switchMode(mode) {
    if (!['demo', 'real'].includes(mode)) return;
    this.mode = mode; adapter.write(`${STORAGE_PREFIX}.mode`, mode);
    this.data = this.readWorkspace(mode); Bus.emit('workspace:changed', { mode }); Bus.emit('data:changed', { reason: 'workspace' });
  },
  commit(mutator, meta = {}) {
    const draft = this.data;
    try {
      mutator(draft); draft.meta.updatedAt = new Date().toISOString();
      if (!adapter.write(modeKey(this.mode), draft)) throw new Error('Stockage local indisponible ou saturé.');
      Bus.emit('data:changed', meta); return true;
    } catch (error) { Bus.emit('app:error', { message: error.message }); return false; }
  },
  resetDemo() {
    const fresh = seedDemo(); adapter.write(modeKey('demo'), fresh);
    if (this.mode === 'demo') this.data = fresh;
    Bus.emit('data:changed', { reason: 'reset' });
  },
  clearReal() {
    const fresh = emptyData('real'); adapter.write(modeKey('real'), fresh);
    if (this.mode === 'real') this.data = fresh;
    Bus.emit('data:changed', { reason: 'reset' });
  },
  exportAll() {
    return JSON.stringify({ app: 'PERSONAL OS', version: APP_VERSION, exportedAt: new Date().toISOString(), settings: this.settings,
      workspaces: { demo: this.readWorkspace('demo'), real: this.readWorkspace('real') } }, null, 2);
  },
  importAll(payload) {
    if (!payload || payload.app !== 'PERSONAL OS' || !payload.workspaces) throw new Error('Ce fichier n’est pas une sauvegarde PERSONAL OS valide.');
    ['demo', 'real'].forEach(mode => adapter.write(modeKey(mode), normalizeData(payload.workspaces[mode], mode)));
    if (payload.settings) {
      const defaults = defaultSettings();
      this.settings = { ...defaults, ...payload.settings, weather: { ...defaults.weather, ...(payload.settings.weather || {}) } };
      this.settings.focus = { ...defaults.focus, ...(payload.settings.focus || {}) };
      this.settings.focus.durations = { ...defaults.focus.durations, ...(payload.settings.focus?.durations || {}) };
      this.settings.widgets = mergeWidgets(payload.settings.widgets);
      this.saveSettings();
    }
    this.data = this.readWorkspace(this.mode); Bus.emit('data:changed', { reason: 'import' });
  }
};

/* Dépôt CRUD unique : toutes les vues et l'assistant utilisent ces mêmes fonctions. */
export const Repo = {
  list(collection) { return Store.data[collection] || []; },
  get(collection, id) { return this.list(collection).find(item => item.id === id); },
  create(collection, payload, origin = 'interface') {
    const now = new Date().toISOString();
    const item = { ...payload, id: payload.id || Utils.uid(collection.slice(0, -1)), createdAt: now, updatedAt: now };
    const ok = Store.commit(data => { data[collection].unshift(item); }, { reason: 'create', collection });
    if (ok) Bus.emit('entity:created', { collection, item, origin });
    return ok ? item : null;
  },
  update(collection, id, patch, origin = 'interface') {
    let updated = null;
    const ok = Store.commit(data => {
      const index = data[collection].findIndex(item => item.id === id);
      if (index < 0) throw new Error('Élément introuvable. Actualisez la vue puis réessayez.');
      const previous = data[collection][index];
      updated = { ...previous, ...patch, id, updatedAt: new Date().toISOString() };
      data[collection][index] = updated;
      if (collection === 'goals') {
        const history = Array.isArray(previous.history) ? previous.history : [];
        const changes = [];
        if (patch.current !== undefined && Number(patch.current) !== Number(previous.current)) changes.push(`Valeur actuelle : ${previous.current || 0} → ${patch.current}`);
        if (patch.target !== undefined && Number(patch.target) !== Number(previous.target)) changes.push(`Cible : ${previous.target} → ${patch.target}`);
        if (changes.length) updated.history = [...history, { id: Utils.uid('hist'), text: changes.join(' · '), date: new Date().toISOString() }];
      }
    }, { reason: 'update', collection });
    if (ok) Bus.emit('entity:updated', { collection, item: updated, origin });
    return ok ? updated : null;
  },
  remove(collection, id) {
    const item = this.get(collection, id); if (!item) return false;
    const ok = Store.commit(data => { data[collection] = data[collection].filter(entry => entry.id !== id); }, { reason: 'remove', collection });
    if (ok) Bus.emit('entity:removed', { collection, item }); return ok;
  },
  addFinanceItem(kind, payload) {
    const collection = kind === 'debts' ? 'debts' : 'subscriptions';
    const item = { ...payload, id: Utils.uid(kind.slice(0, -1)), createdAt: new Date().toISOString() };
    return Store.commit(data => { data.finance[collection].unshift(item); }, { reason: 'finance-item', collection: kind }) ? item : null;
  },
  updateFinanceItem(kind, id, patch) {
    return Store.commit(data => {
      const item = data.finance[kind].find(entry => entry.id === id); if (!item) throw new Error('Élément financier introuvable.');
      Object.assign(item, patch, { updatedAt: new Date().toISOString() });
    }, { reason: 'finance-item', collection: kind });
  },
  removeFinanceItem(kind, id) {
    return Store.commit(data => { data.finance[kind] = data.finance[kind].filter(entry => entry.id !== id); }, { reason: 'finance-item', collection: kind });
  }
};

export const Selectors = {
  goalProgress(goal) { return Utils.clamp(Number(goal.target) > 0 ? (Number(goal.current) / Number(goal.target)) * 100 : 0); },
  goals() {
    const goals = Repo.list('goals');
    const active = goals.filter(g => this.goalProgress(g) < 100);
    return { all: goals, active, done: goals.filter(g => this.goalProgress(g) >= 100),
      late: active.filter(g => g.deadline && g.deadline < Utils.iso()),
      average: goals.length ? Utils.round(goals.reduce((sum, g) => sum + this.goalProgress(g), 0) / goals.length) : 0 };
  },
  sport() {
    const sessions = [...Repo.list('sessions')].sort((a, b) => new Date(b.date) - new Date(a.date));
    const weekStart = Utils.startOfWeek();
    const done = sessions.filter(s => s.status !== 'Planifiée');
    return { sessions, done, week: done.filter(s => new Date(s.date) >= weekStart), last: done[0], next: sessions.filter(s => s.status === 'Planifiée' && new Date(s.date) >= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date))[0],
      minutes: done.reduce((sum, s) => sum + Number(s.duration || 0), 0),
      distance: done.reduce((sum, s) => sum + Number(s.distance || 0), 0),
      averageFeeling: done.length ? Utils.round(done.reduce((sum, s) => sum + Number(s.feeling || 0), 0) / done.filter(s => s.feeling).length || 0, 1) : 0 };
  },
  projects() {
    const projects = Repo.list('projects'); const tasks = Repo.list('tasks');
    const active = projects.filter(p => !['Terminé', 'Suspendu'].includes(p.status));
    return { projects, active, tasks, doing: tasks.filter(t => t.status === 'doing'),
      late: tasks.filter(t => t.status !== 'done' && t.due && t.due < Utils.iso()),
      updated: [...projects].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)) };
  },
  finance(month = Utils.monthKey()) {
    const transactions = Repo.list('transactions');
    const monthly = transactions.filter(t => t.date?.startsWith(month));
    const income = monthly.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const expense = monthly.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
    const budget = Number(Store.data.finance.monthlyBudget || 0);
    const savingsRate = income > 0 ? Math.max(0, ((income - expense) / income) * 100) : 0;
    return { transactions, monthly, income, expense, balance: income - expense, budget, remaining: budget - expense,
      budgetRatio: budget > 0 ? (expense / budget) * 100 : 0, savingsRate };
  },
  todayEvents() {
    const today = Utils.iso();
    return Repo.list('events').filter(e => e.date === today).sort((a, b) => a.start.localeCompare(b.start));
  },
  upcomingEvents(limit = 6) {
    const now = new Date();
    return Repo.list('events').filter(e => new Date(`${e.date}T${e.end || e.start || '23:59'}`) >= now)
      .sort((a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`)).slice(0, limit);
  },
  habits() {
    const today = Utils.iso(); const weekStart = Utils.iso(Utils.startOfWeek());
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = Utils.day(index - 6);
      return { date, label: new Intl.DateTimeFormat('fr-FR', { weekday: 'narrow' }).format(new Date(`${date}T12:00:00`)), today: date === today };
    });
    const items = Repo.list('habits').map(habit => {
      const completions = new Set(Array.isArray(habit.completions) ? habit.completions : []);
      let streak = 0; let cursor = completions.has(today) ? 0 : -1;
      while (streak < 3660 && completions.has(Utils.day(cursor - streak))) streak++;
      const weekCount = [...completions].filter(date => date >= weekStart && date <= today).length;
      return { ...habit, doneToday: completions.has(today), streak, weekCount,
        ratio: Utils.clamp(weekCount / Math.max(1, Number(habit.targetPerWeek) || 1) * 100),
        days: days.map(day => ({ ...day, done: completions.has(day.date) })) };
    });
    return { items, completedToday: items.filter(item => item.doneToday).length,
      average: items.length ? Utils.round(items.reduce((sum, item) => sum + item.ratio, 0) / items.length) : 0 };
  },
  unread() { return Repo.list('notifications').filter(n => !n.read).length; }
};

export const Notify = {
  push({ title, body = '', type = 'Information', priority = 'Normale', source = 'Système', dedupeKey = '', announce = true }) {
    if (!title) return null;
    if (dedupeKey && Repo.list('notifications').some(n => n.dedupeKey === dedupeKey)) return null;
    const item = { id: Utils.uid('notif'), title, body, type, priority, source, read: false, date: new Date().toISOString(), dedupeKey };
    const ok = Store.commit(data => { data.notifications.unshift(item); data.notifications = data.notifications.slice(0, 250); }, { reason: 'notification' });
    if (ok && announce) Bus.emit('notification:created', item);
    return ok ? item : null;
  },
  markRead(id, read = true) {
    if (id === 'all') return Store.commit(data => data.notifications.forEach(n => { n.read = read; }), { reason: 'notifications' });
    return Store.commit(data => { const item = data.notifications.find(n => n.id === id); if (item) item.read = read; }, { reason: 'notifications' });
  },
  remove(id) { return Repo.remove('notifications', id); },
  clearRead() { return Store.commit(data => { data.notifications = data.notifications.filter(n => !n.read); }, { reason: 'notifications' }); }
};

/* Moteur de règles : déclencheurs temps réel + contrôles planifiés avec clés anti-doublon. */
export const Automation = {
  timer: null,
  init() {
    Bus.on('entity:created', event => this.onEntity(event));
    Bus.on('entity:updated', event => this.onEntity(event));
    this.scan(); this.timer = setInterval(() => this.scan(), 60000);
  },
  enabled(ruleId) { return Repo.list('rules').find(rule => rule.id === ruleId)?.enabled !== false; },
  log(ruleId, detail) {
    const rule = Repo.list('rules').find(r => r.id === ruleId);
    if (!rule) return;
    Store.commit(data => { data.automations.unshift({ id: Utils.uid('auto'), ruleId, name: rule.name, detail, date: new Date().toISOString() }); data.automations = data.automations.slice(0, 150); }, { reason: 'automation', silent: true });
  },
  onEntity({ collection, item, origin }) {
    if (collection === 'sessions' && this.enabled('sport_recorded') && item.status !== 'Planifiée') {
      this.log('sport_recorded', `${item.type} · ${item.duration || 0} min : statistiques actualisées.`);
    }
    if (collection === 'transactions' && item.type === 'expense' && this.enabled('expense_recorded')) {
      const stats = Selectors.finance(Utils.monthKey(item.date));
      this.log('expense_recorded', stats.budget > 0 ? `${item.label} : budget restant ${Utils.money(stats.remaining)}.` : `${item.label} : dépenses du mois ${Utils.money(stats.expense)} · aucun seuil de budget défini.`);
    }
    if (collection === 'habits' && this.enabled('habit_target')) {
      const stats = Selectors.habits().items.find(habit => habit.id === item.id);
      if (stats && stats.weekCount >= Number(stats.targetPerWeek || 1)) {
        const week = Utils.iso(Utils.startOfWeek());
        if (Notify.push({ title: 'Objectif d’habitude atteint', body: `${stats.name} · ${stats.weekCount}/${stats.targetPerWeek} cette semaine.`, type: 'Information', priority: 'Normale', source: 'Habitudes', dedupeKey: `habit-target-${stats.id}-${week}` })) this.log('habit_target', `${stats.name} · objectif hebdomadaire validé.`);
      }
    }
    if (collection === 'goals' && origin === 'assistant') this.log('goal_risk', `Objectif ${item.name} créé par l’assistant local.`);
  },
  scan() {
    if (!Store.ready) return;
    const today = Utils.iso(); const now = Date.now();
    if (this.enabled('task_due')) {
      Repo.list('tasks').filter(t => t.status !== 'done' && t.due).forEach(task => {
        if (task.due < today) {
          const key = `task-late-${task.id}-${today}`;
          if (Notify.push({ title: 'Tâche en retard', body: task.title, type: 'Alerte', priority: task.priority === 'Critique' ? 'Critique' : 'Haute', source: 'Tâches', dedupeKey: key })) this.log('task_due', task.title);
        } else if (task.due === today) {
          const key = `task-today-${task.id}-${today}`;
          if (Notify.push({ title: 'Tâche à traiter aujourd’hui', body: task.title, type: 'Rappel', priority: 'Normale', source: 'Tâches', dedupeKey: key })) this.log('task_due', task.title);
        }
      });
    }
    if (this.enabled('goal_risk')) {
      Repo.list('goals').forEach(goal => {
        const days = goal.deadline ? Math.ceil((new Date(`${goal.deadline}T23:59:00`) - now) / 86400000) : 999;
        if (days >= 0 && days <= 3 && Selectors.goalProgress(goal) < 100) {
          const key = `goal-risk-${goal.id}-${today}`;
          if (Notify.push({ title: 'Échéance d’objectif proche', body: `${goal.name} · ${Math.round(Selectors.goalProgress(goal))} %`, type: 'Alerte', priority: 'Haute', source: 'Objectifs', dedupeKey: key })) this.log('goal_risk', goal.name);
        }
      });
    }
    if (this.enabled('event_soon')) {
      Repo.list('events').forEach(event => {
        const start = new Date(`${event.date}T${event.start || '09:00'}:00`).getTime();
        const reminderMinutes = Number(event.reminder || 0);
        if (reminderMinutes <= 0) return; // Zéro signifie explicitement « rappel désactivé ».
        const reminder = reminderMinutes * 60000;
        if (start - now <= reminder && start >= now - 15 * 60000) {
          const key = `event-${event.id}-${event.date}-${event.start}`;
          if (Notify.push({ title: 'Rendez-vous prochainement', body: `${event.title} · ${Utils.formatDate(event.date)} à ${event.start}`, type: 'Rappel', priority: 'Haute', source: 'Calendrier', dedupeKey: key })) this.log('event_soon', event.title);
        }
      });
    }
    if (this.enabled('subscription_due')) {
      (Store.data.finance.subscriptions || []).filter(s => s.active).forEach(sub => {
        const days = Math.ceil((new Date(`${sub.nextDate}T12:00:00`) - now) / 86400000);
        if (days >= 0 && days <= 3) {
          const key = `sub-${sub.id}-${sub.nextDate}`;
          if (Notify.push({ title: 'Renouvellement d’abonnement', body: `${sub.name} · ${Utils.money(sub.amount)}`, type: 'Information', priority: 'Normale', source: 'Finances', dedupeKey: key })) this.log('subscription_due', sub.name);
        }
      });
    }
    if (this.enabled('weekly_sport')) {
      const date = new Date();
      // Une seule alerte par semaine, à partir de vendredi 17 h.
      if ((date.getDay() === 5 && date.getHours() >= 17) || date.getDay() === 6 || date.getDay() === 0) {
        const weekKey = Utils.iso(Utils.startOfWeek(date)); const count = Selectors.sport().week.length;
        if (count < 4) {
          const key = `weekly-sport-${weekKey}`;
          if (Notify.push({ title: 'Objectif hebdomadaire sportif non atteint', body: `${count} séance${count > 1 ? 's' : ''} sur les 4 indicatives cette semaine. Adapte la suite à ta récupération.`, type: 'Rappel', priority: 'Haute', source: 'Sport & SPV', dedupeKey: key })) this.log('weekly_sport', `${count}/4 séances · semaine du ${weekKey}.`);
        }
      }
    }
  }
};

/* Météo réelle Open-Meteo, sans clé. Aucun résultat de substitution n'est inventé. */
export const Weather = {
  codes: { 0: 'Ciel dégagé', 1: 'Plutôt dégagé', 2: 'Partiellement nuageux', 3: 'Couvert', 45: 'Brouillard', 48: 'Brouillard givrant', 51: 'Bruine légère', 53: 'Bruine', 55: 'Bruine dense', 61: 'Pluie faible', 63: 'Pluie', 65: 'Pluie forte', 71: 'Neige faible', 73: 'Neige', 75: 'Neige forte', 80: 'Averses', 81: 'Averses', 82: 'Averses fortes', 95: 'Orage' },
  async refresh() {
    const { lat, lon } = Store.settings.weather;
    if (!lat || !lon) throw new Error('Configurez une position ou utilisez la géolocalisation.');
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,uv_index,precipitation&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max&forecast_days=7&timezone=auto`);
    if (!response.ok) throw new Error(`Service météo indisponible (${response.status}).`);
    const json = await response.json();
    if (!json.current) throw new Error('Réponse météo incomplète.');
    Store.settings.weather.data = json.current; Store.settings.weather.daily = json.daily || null; Store.settings.weather.updatedAt = new Date().toISOString(); Store.saveSettings();
    Bus.emit('weather:changed', Store.settings.weather); return json.current;
  },
  locate() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Géolocalisation non disponible dans ce navigateur.'));
      navigator.geolocation.getCurrentPosition(position => {
        Store.settings.weather.lat = position.coords.latitude.toFixed(4);
        Store.settings.weather.lon = position.coords.longitude.toFixed(4);
        Store.settings.weather.label = 'Position de cet appareil'; Store.saveSettings(); resolve(position.coords);
      }, error => reject(new Error(error.message || 'Autorisation de localisation refusée.')), { enableHighAccuracy: false, timeout: 10000, maximumAge: 1800000 });
    });
  }
};

/* Conversion restrictive des liens vers le lecteur officiel Spotify.
   Aucun état de lecture n'est fabriqué : Spotify gère lui-même son iframe. */
export const Spotify = {
  parse(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    let type = '', id = '';
    const uri = raw.match(/^spotify:(track|album|playlist|artist|show|episode):([A-Za-z0-9]+)$/);
    if (uri) { type = uri[1]; id = uri[2]; }
    else {
      try {
        const url = new URL(raw);
        if (url.hostname !== 'open.spotify.com') return null;
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts[0]?.startsWith('intl-')) parts.shift();
        if (!['track', 'album', 'playlist', 'artist', 'show', 'episode'].includes(parts[0]) || !/^[A-Za-z0-9]+$/.test(parts[1] || '')) return null;
        type = parts[0]; id = parts[1];
      } catch { return null; }
    }
    return { type, id, embed: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`, external: `https://open.spotify.com/${type}/${id}` };
  }
};
