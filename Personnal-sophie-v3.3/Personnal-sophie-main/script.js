/* PERSONAL OS — Contrôleur principal et délégation d'événements.
   Les données restent dans core.js ; les vues ne contiennent aucune mutation. */
import { Store, Repo, Selectors, Notify, Automation, Weather, Spotify, Bus, Utils, Taxonomy } from './js/core.js';
import { Modal, Toast, icon, badge, progressBar } from './js/ui.js';
import { loadView, Sections, SectionLabels, ViewState } from './js/views.js';
/* Modules fonctionnels chargés isolément : une erreur dans l'un d'eux
   n'empêche plus le démarrage, elle est signalée sans bloquer le reste. */
let Voice, Focus, Sophie, TTS, Reminders, News, Camera;
const FEATURE_MODULES = {
  Voice: ['./js/voice.js', 'Voice'], Focus: ['./js/focus.js', 'Focus'], Sophie: ['./js/sophie.js', 'Sophie'],
  TTS: ['./js/tts.js', 'TTS'], Reminders: ['./js/reminders.js', 'Reminders'], News: ['./js/news.js', 'News'],
  Camera: ['./js/camera.js', 'Camera']
};
async function loadFeatureModules() {
  const failed = [];
  for (const [key, [path, name]] of Object.entries(FEATURE_MODULES)) {
    try {
      const module = await import(path);
      if (key === 'Voice') Voice = module[name];
      else if (key === 'Focus') Focus = module[name];
      else if (key === 'Sophie') Sophie = module[name];
      else if (key === 'TTS') TTS = module[name];
      else if (key === 'Reminders') Reminders = module[name];
      else if (key === 'News') News = module[name];
      else if (key === 'Camera') Camera = module[name];
      else if (key === 'Alarms') Alarms = module[name];
    } catch (error) {
      failed.push(`${path} → ${error.message}`);
    }
  }
  if (failed.length) { window.__PO_FEATURE_ERRORS__ = failed; console.warn('Modules fonctionnels non chargés :', failed); }
  return failed;
}
const App = {
  section: 'dashboard', renderTimer: null, revealObserver: null, deferredInstall: null,
  draggedWidget: null, draggedProject: null, motionFrame: null
};
const main = document.getElementById('main-content');
const $ = selector => document.querySelector(selector);

/* ---------- Navigation, rendu et habillage ---------- */
function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(node => { node.innerHTML = icon(node.dataset.icon, Number(node.dataset.size) || 20); });
  // Petits avatars Sophie (navigation, dock vocal) — chargés une seule fois.
  root.querySelectorAll('[data-sophie-mini]').forEach(node => {
    if (node.dataset.filled) return;
    node.dataset.filled = '1';
    import('./js/sophie-avatar.js').then(module => {
      node.innerHTML = module.SophieAvatar({ size: 24, state: document.body.dataset.sophieState || 'idle' });
    }).catch(() => { node.innerHTML = icon('mic', 16); });
  });
}

function applySettings() {
  const s = Store.settings; const root = document.documentElement;
  root.style.setProperty('--accent', s.accent); root.style.setProperty('--accent-2', s.accent2);
  root.style.setProperty('--accent-rgb', hexToRgb(s.accent)); root.style.setProperty('--accent-2-rgb', hexToRgb(s.accent2));
  document.body.classList.toggle('no-animations', !s.animations);
  document.body.classList.toggle('reduced-glow', s.reducedGlow);
  document.body.dataset.density = s.density;
  document.body.dataset.theme = s.theme || 'nocturne';
  document.body.classList.toggle('focus-mode', Boolean(s.focusMode));
  document.body.classList.toggle('silent-boot', s.silentBoot !== false);
  document.body.dataset.sophieState = Voice?.state || 'idle';
}

function hexToRgb(hex) {
  const value = String(hex).replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return '55, 214, 160';
  return `${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}`;
}

function setupReveals() {
  App.revealObserver?.disconnect();
  const nodes = main.querySelectorAll('.reveal');
  if (!Store.settings.animations || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    nodes.forEach(node => node.classList.add('revealed')); return;
  }
  App.revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('revealed'); App.revealObserver.unobserve(entry.target); }
  }), { rootMargin: '0px 0px -7% 0px', threshold: .06 });
  nodes.forEach((node, index) => { node.style.setProperty('--reveal-delay', `${Math.min(index % 6, 5) * 55}ms`); App.revealObserver.observe(node); });
}

async function renderCurrent({ preserveScroll = true } = {}) {
  if (!Sections.includes(App.section)) App.section = 'dashboard';
  const scroll = window.scrollY;
  try {
    const render = await loadView(App.section);
    Camera?.park?.();                       // le flux caméra survit au re-rendu de la vue
    main.innerHTML = render ? render() : '';
  }
  catch (error) {
    console.error(error);
    main.innerHTML = `<section class="fatal-view"><h1>Cette vue n’a pas pu être affichée</h1><p>${Utils.esc(error.message)}</p><button class="button primary" data-section="dashboard">Revenir au Dashboard</button></section>`;
  }
  Camera?.mount?.(); hydrateIcons(main); renderFocusOverlay(); updateChrome(); setupReveals(); updateHeroMotion();
  if (preserveScroll) requestAnimationFrame(() => window.scrollTo({ top: Math.min(scroll, document.documentElement.scrollHeight - innerHeight), behavior: 'instant' }));
  if (App.section === 'devices') probeDevice();
  if (App.section === 'assistant') requestAnimationFrame(() => { const chat = $('#chat-history'); if (chat) chat.scrollTop = chat.scrollHeight; });
}

/* Mode concentration : tâche courante, trois priorités et chronomètre, sans distraction. */
function renderFocusOverlay() {
  if (!Store.settings.focusMode) return;
  const tasks = Repo.list('tasks').filter(t => t.status !== 'done').sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const current = tasks.find(t => t.status === 'doing') || tasks[0];
  const next = tasks.filter(t => t.id !== current?.id).slice(0, 3);
  const state = Focus.snapshot();
  main.insertAdjacentHTML('afterbegin', `<section class="focus-overlay reveal"><header><span class="eyebrow">MODE CONCENTRATION</span><button class="button ghost small" data-action="focus-mode-toggle">${icon('x', 15)} Quitter (Échap)</button></header><div class="focus-overlay-grid"><div class="focus-current"><span class="micro-label">EN COURS</span><h2>${current ? Utils.esc(current.title) : 'Aucune tâche ouverte'}</h2><p>${current?.notes ? Utils.esc(current.notes) : 'Sélectionnez une tâche depuis Projets pour l’afficher ici.'}</p><div class="focus-actions">${current ? `<button class="button primary" data-action="task-toggle" data-id="${current.id}">${icon('check', 16)} Marquer terminée</button><button class="button ghost" data-action="task-edit" data-id="${current.id}">Modifier</button>` : ''}</div></div><div class="focus-priorities"><span class="micro-label">3 PROCHAINES PRIORITÉS</span>${next.length ? next.map(task => `<button data-action="task-edit" data-id="${task.id}"><strong>${Utils.esc(task.title)}</strong><small>${task.due ? Utils.formatDate(task.due) : 'Sans échéance'} · ${Utils.esc(task.priority)}</small></button>`).join('') : '<p class="muted">Rien d’autre en file.</p>'}</div><div class="focus-clock"><div class="focus-ring" data-focus-ring style="--focus-progress:${state.progress * 3.6}deg"><div><strong data-focus-time>--:--</strong><span data-focus-state>${state.label}</span></div></div><button class="button ${state.running ? 'ghost' : 'primary'}" data-action="focus-toggle">${icon(state.running ? 'pause' : 'play', 15)} ${state.running ? 'Pause' : 'Démarrer'}</button><button class="button ghost tiny" data-action="focus-reset">Réinitialiser</button></div></div></section>`);
}

function scheduleRender() {
  clearTimeout(App.renderTimer);
  App.renderTimer = setTimeout(() => renderCurrent(), 55);
}

async function navigate(section, { push = true } = {}) {
  if (!Sections.includes(section)) return;
  if (Voice.listening) Voice.cancel();
  App.section = section;
  document.querySelectorAll('.nav-item').forEach(button => {
    const active = button.dataset.section === section; button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  $('#current-section-label').textContent = SectionLabels[section];
  document.title = `${SectionLabels[section]} · PERSONAL OS`;
  if (push) history.replaceState(null, '', `#${section}`);
  if (Store.settings.lastSection !== section) { Store.settings.lastSection = section; Store.saveSettings(); }
  closeMenu(); window.scrollTo({ top: 0, behavior: Store.settings.animations ? 'smooth' : 'instant' });
  await renderCurrent({ preserveScroll: false });
  main.focus({ preventScroll: true });
}

function updateChrome() {
  const unread = Selectors.unread();
  ['#nav-notif-count', '#top-notif-count'].forEach(selector => { const node = $(selector); if (node) { node.hidden = unread === 0; node.textContent = unread > 99 ? '99+' : unread; } });
  $('#workspace-label').textContent = Store.mode === 'demo' ? 'DÉMONSTRATION' : 'DONNÉES RÉELLES';
  $('#demo-banner').hidden = Store.mode !== 'demo' || !Store.settings.demoBanner;
  $('#last-save').textContent = `DERNIÈRE SAUVEGARDE · ${Utils.formatTime(Store.data.meta.updatedAt)}`;
  renderWeatherSummary();
}

function tickClock() {
  const now = new Date();
  $('#top-clock').textContent = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(now);
  $('#top-seconds').textContent = `:${String(now.getSeconds()).padStart(2, '0')}`;
  $('#top-date').textContent = Utils.formatLongDate(now);
  const progress = Math.round((now.getHours() * 60 + now.getMinutes()) / 1440 * 100);
  $('#day-progress').textContent = `${progress}% DE LA JOURNÉE · ${Utils.iso(now).replaceAll('-', '.')}`;
  const heroTime = $('#hero-time'); if (heroTime) heroTime.textContent = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(now);
  const maisonClock = $('#maison-clock'); if (maisonClock) maisonClock.textContent = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(now);
}

function updateConnection() {
  const online = navigator.onLine;
  $('#connection-chip')?.classList.toggle('offline', !online);
  $('#connection-label').textContent = online ? 'En ligne' : 'Hors ligne';
  const probe = $('#probe-network'); if (probe) probe.textContent = online ? 'Navigateur en ligne (indicateur)' : 'Navigateur hors ligne';
}

function renderWeatherSummary() {
  const node = $('#weather-summary'); if (!node) return;
  const weather = Store.settings.weather;
  if (!weather.data) { node.textContent = weather.lat ? 'Météo à actualiser' : 'Météo non configurée'; return; }
  const current = weather.data;
  node.textContent = `${Math.round(current.temperature_2m)}° · ${Weather.codes[current.weather_code] || 'Relevé météo'}${weather.label ? ` · ${weather.label}` : ''}`;
  node.parentElement.title = `Relevé Open-Meteo du ${Utils.formatDateTime(weather.updatedAt)} · ressenti ${current.apparent_temperature ?? 'N/D'}° · vent ${current.wind_speed_10m ?? 'N/D'} km/h`;
}

/* ---------- Schémas de formulaires ---------- */
const goalFields = [
  { name: 'name', label: 'Nom de l’objectif', required: true, maxlength: 120, full: true, placeholder: 'Ex. Courir 10 km sans interruption' },
  { name: 'category', label: 'Catégorie', type: 'select', options: Taxonomy.GOAL_CATEGORIES, required: true },
  { name: 'priority', label: 'Priorité', type: 'select', options: Taxonomy.priorities, required: true },
  { name: 'start', label: 'Date de début', type: 'date', required: true },
  { name: 'deadline', label: 'Date limite', type: 'date' },
  { name: 'current', label: 'Valeur actuelle', type: 'number', min: 0, step: 'any', required: true },
  { name: 'target', label: 'Valeur cible', type: 'number', min: 0.01, step: 'any', required: true },
  { name: 'unit', label: 'Unité', placeholder: 'km, €, séances, %…', maxlength: 20 },
  { name: 'description', label: 'Description & critère de réussite', type: 'textarea', full: true, rows: 4, maxlength: 1000 }
];
const sessionFields = [
  { name: 'type', label: 'Type d’entraînement', type: 'select', options: Taxonomy.SESSION_TYPES, required: true },
  { name: 'status', label: 'État', type: 'select', options: ['Terminée', 'Planifiée'], required: true },
  { name: 'date', label: 'Date et heure', type: 'datetime-local', required: true },
  { name: 'duration', label: 'Durée (minutes)', type: 'number', min: 0, max: 1440, required: true },
  { name: 'distance', label: 'Distance (km)', type: 'number', min: 0, step: '0.01' },
  { name: 'reps', label: 'Répétitions totales', type: 'number', min: 0, step: 1 },
  { name: 'feeling', label: 'Ressenti sur 10', type: 'number', min: 0, max: 10, step: 1, hint: '0 si non évalué ou séance planifiée.' },
  { name: 'performance', label: 'Performance', placeholder: 'Allure, séries, charge, temps…', full: true, maxlength: 240 },
  { name: 'notes', label: 'Notes de séance', type: 'textarea', full: true, rows: 3, maxlength: 1000 }
];
const projectFields = [
  { name: 'name', label: 'Nom du projet', required: true, maxlength: 120, full: true },
  { name: 'description', label: 'Description', type: 'textarea', required: true, full: true, rows: 4, maxlength: 1500 },
  { name: 'category', label: 'Catégorie', required: true, placeholder: 'Professionnel, Personnel…' },
  { name: 'icon', label: 'Icône', type: 'select', options: [{ value: 'folder', label: 'Dossier' }, { value: 'gauge', label: 'Performance' }, { value: 'flag', label: 'Drapeau' }, { value: 'activity', label: 'Activité' }, { value: 'wrench', label: 'Atelier' }, { value: 'book', label: 'Documentation' }] },
  { name: 'status', label: 'Statut', type: 'select', options: Taxonomy.PROJECT_STATUSES, required: true },
  { name: 'priority', label: 'Priorité', type: 'select', options: Taxonomy.priorities, required: true },
  { name: 'deadline', label: 'Date limite', type: 'date' },
  { name: 'progress', label: 'Progression (%)', type: 'number', min: 0, max: 100, required: true },
  { name: 'budget', label: 'Budget alloué (€)', type: 'number', min: 0, step: '0.01' },
  { name: 'color', label: 'Couleur du projet', type: 'color' }
];
const transactionFields = [
  { name: 'type', label: 'Type', type: 'select', options: [{ value: 'income', label: 'Revenu' }, { value: 'expense', label: 'Dépense' }], required: true },
  { name: 'date', label: 'Date', type: 'date', required: true },
  { name: 'label', label: 'Libellé', required: true, maxlength: 140, full: true },
  { name: 'category', label: 'Catégorie', type: 'select', options: Taxonomy.transactionCategories, required: true },
  { name: 'amount', label: 'Montant (€)', type: 'number', min: 0.01, step: '0.01', required: true },
  { name: 'notes', label: 'Note', type: 'textarea', full: true, maxlength: 500 }
];
const eventFields = () => [
  { name: 'title', label: 'Titre', required: true, maxlength: 140, full: true },
  { name: 'date', label: 'Date', type: 'date', required: true },
  { name: 'category', label: 'Catégorie', type: 'select', options: Taxonomy.eventCategories, required: true },
  { name: 'start', label: 'Heure de début', type: 'time', required: true },
  { name: 'end', label: 'Heure de fin', type: 'time' },
  { name: 'projectId', label: 'Projet associé', type: 'select', placeholder: 'Aucun projet', options: Repo.list('projects').map(p => ({ value: p.id, label: p.name })) },
  { name: 'reminder', label: 'Rappel', type: 'select', options: [{ value: 0, label: 'Désactivé' }, { value: 5, label: '5 minutes avant' }, { value: 15, label: '15 minutes avant' }, { value: 30, label: '30 minutes avant' }, { value: 60, label: '1 heure avant' }, { value: 120, label: '2 heures avant' }, { value: 720, label: '12 heures avant' }, { value: 1440, label: '1 jour avant' }] },
  { name: 'description', label: 'Description', type: 'textarea', full: true, rows: 4, maxlength: 1000 }
];
const deviceFields = [
  { name: 'name', label: 'Nom de l’appareil', required: true, maxlength: 120, full: true },
  { name: 'brand', label: 'Marque', maxlength: 80 }, { name: 'model', label: 'Modèle', maxlength: 100 },
  { name: 'category', label: 'Catégorie', type: 'select', options: Taxonomy.deviceCategories, required: true },
  { name: 'status', label: 'Statut déclaré', type: 'select', options: ['Opérationnel', 'À vérifier', 'En maintenance', 'Hors service', 'Archivé'], required: true },
  { name: 'purchaseDate', label: 'Date d’achat', type: 'date' }, { name: 'warranty', label: 'Fin de garantie', type: 'date' },
  { name: 'lastCheck', label: 'Dernière vérification manuelle', type: 'datetime-local', hint: 'Ne déclenche aucune mesure distante.' },
  { name: 'notes', label: 'Notes', type: 'textarea', full: true, rows: 4, maxlength: 1000 }
];
const journalFields = [
  { name: 'type', label: 'Type d’entrée', type: 'select', options: Taxonomy.journalTypes, required: true },
  { name: 'date', label: 'Date et heure', type: 'datetime-local', required: true },
  { name: 'title', label: 'Titre', required: true, maxlength: 140, full: true },
  { name: 'text', label: 'Contenu', type: 'textarea', required: true, rows: 7, full: true, maxlength: 5000 },
  { name: 'tagsText', label: 'Étiquettes (séparées par des virgules)', full: true, placeholder: 'sport, projet, réflexion', maxlength: 200 }
];

function taskFields(defaults = {}) {
  return [
    { name: 'title', label: 'Titre de la tâche', required: true, full: true, maxlength: 160 },
    { name: 'projectId', label: 'Projet associé', type: 'select', placeholder: 'Boîte d’arrivée / transverse', options: Repo.list('projects').map(p => ({ value: p.id, label: p.name })) },
    { name: 'goalId', label: 'Objectif associé', type: 'select', placeholder: 'Aucun objectif', options: Repo.list('goals').map(g => ({ value: g.id, label: g.name })) },
    { name: 'status', label: 'Statut', type: 'select', options: [{ value: 'todo', label: 'À faire' }, { value: 'doing', label: 'En cours' }, { value: 'done', label: 'Terminée' }] },
    { name: 'priority', label: 'Priorité', type: 'select', options: Taxonomy.priorities },
    { name: 'due', label: 'Échéance', type: 'date' },
    { name: 'notes', label: 'Notes', type: 'textarea', full: true, rows: 4, maxlength: 1000 }
  ].map(field => ({ ...field, value: defaults[field.name] ?? field.value }));
}

function formValues(form, fields) { return Modal.values(form, fields); }
function validateGoal(values) {
  if (values.target <= 0) throw new Error('La valeur cible doit être supérieure à zéro.');
  if (values.deadline && values.start && values.deadline < values.start) throw new Error('La date limite doit suivre la date de début.');
}
function validateEvent(values) {
  if (values.end && values.end <= values.start) throw new Error('L’heure de fin doit être postérieure à l’heure de début.');
}

/* ---------- Spotify, Focus et Habitudes ---------- */
function openSpotifyEditor() {
  const fields = [{ name: 'url', label: 'Lien ou URI Spotify', type: 'text', required: true, full: true, placeholder: 'https://open.spotify.com/playlist/…', hint: 'Piste, album, playlist, artiste, podcast ou épisode public. Aucune clé API demandée.' }];
  const current = Spotify.parse(Store.settings.spotifyUrl);
  const intro = `${current ? `<div class="modal-inline-danger"><button type="button" class="button danger small" data-action="spotify-disconnect">${icon('x', 15)} Retirer le contenu du widget</button></div>` : ''}<div class="integration-note compact-note">${icon('info', 18)}<p>PERSONAL OS intègre uniquement le lecteur officiel. Il ne lit pas votre compte et ne simule aucune lecture en cours.</p></div>`;
  Modal.form({ title: 'Configurer Spotify', subtitle: 'Collez un lien obtenu via « Partager » dans Spotify.', fields, values: { url: Store.settings.spotifyUrl }, intro, onSubmit(form) {
    const { url } = formValues(form, fields); const parsed = Spotify.parse(url);
    if (!parsed) throw new Error('Lien non reconnu. Utilisez open.spotify.com ou une URI Spotify valide.');
    Store.setSetting('spotifyUrl', url.trim()); Toast.show('Lecteur Spotify configuré.'); setTimeout(() => renderCurrent(), 200);
  } });
}

function openHabitEditor(habit = null, returnToManager = false) {
  const fields = [
    { name: 'name', label: 'Nom de l’habitude', required: true, full: true, maxlength: 120, placeholder: 'Ex. Lire 20 minutes' },
    { name: 'targetPerWeek', label: 'Fréquence cible par semaine', type: 'number', min: 1, max: 7, step: 1, required: true, hint: 'De 1 à 7 validations hebdomadaires.' },
    { name: 'color', label: 'Couleur', type: 'color' }
  ];
  const values = habit || { name: '', targetPerWeek: 5, color: '#37D6A0' };
  Modal.form({ title: habit ? 'Modifier l’habitude' : 'Nouvelle habitude', subtitle: 'Une validation correspond à une journée. Les séries restent intactes jusqu’à la fin du jour.', fields, values, onSubmit(form) {
    const data = formValues(form, fields);
    if (data.targetPerWeek < 1 || data.targetPerWeek > 7) throw new Error('La fréquence doit être comprise entre 1 et 7.');
    if (habit) Repo.update('habits', habit.id, data); else Repo.create('habits', { ...data, completions: [] });
    Toast.show(habit ? 'Habitude mise à jour.' : 'Habitude créée.');
    if (returnToManager) setTimeout(openHabitManager, 220);
  } });
}

function openHabitManager() {
  const stats = Selectors.habits();
  const content = `<div class="habit-manager-summary"><div><strong>${stats.items.length}</strong><span>habitudes</span></div><div><strong>${stats.completedToday}</strong><span>validées aujourd’hui</span></div><div><strong>${stats.average}%</strong><span>progression hebdo</span></div></div><div class="habit-manager-list">${stats.items.length ? stats.items.map(habit => `<article><button class="habit-check ${habit.doneToday ? 'done' : ''}" style="--habit-color:${Utils.esc(habit.color || '#37D6A0')}" data-action="habit-toggle" data-id="${habit.id}" data-manage="true" aria-label="Valider ${Utils.esc(habit.name)}">${icon('check', 15)}</button><div><strong>${Utils.esc(habit.name)}</strong><small>${habit.weekCount}/${habit.targetPerWeek} cette semaine · série ${habit.streak} jour${habit.streak > 1 ? 's' : ''}</small>${progressBar(habit.ratio)}</div>${iconButton('habit-edit', habit.id, 'edit', 'Modifier', 'data-manage="true"')}${iconButton('habit-delete', habit.id, 'trash', 'Supprimer', 'data-manage="true"')}</article>`).join('') : '<p class="muted">Aucune habitude. Créez votre premier rituel mesurable.</p>'}</div><button class="button primary" data-action="habit-new" data-manage="true">${icon('plus', 16)} Nouvelle habitude</button>`;
  Modal.open({ title: 'Gérer les habitudes', subtitle: 'Fréquences, séries et validations du jour.', content, size: 'wide' });
}

function toggleHabit(id, fromManager = false) {
  const habit = Repo.get('habits', id); if (!habit) return;
  const today = Utils.iso(); const completions = new Set(Array.isArray(habit.completions) ? habit.completions : []);
  const wasDone = completions.has(today); if (wasDone) completions.delete(today); else completions.add(today);
  Repo.update('habits', id, { completions: [...completions].sort() });
  Toast.show(wasDone ? 'Validation du jour retirée.' : 'Habitude validée pour aujourd’hui.');
  if (fromManager) setTimeout(openHabitManager, 100);
}

async function deleteHabit(id, fromManager = false) {
  const habit = Repo.get('habits', id); if (!habit) return;
  if (await Modal.confirm({ title: 'Supprimer l’habitude', message: `Supprimer « ${habit.name} » et tout son historique de validations ?` })) {
    Repo.remove('habits', id); Toast.show('Habitude supprimée.', 'info');
  }
  if (fromManager) setTimeout(openHabitManager, 200);
}

function openTimerEditor() {
  const fields = [{ name: 'amount', label: 'Durée', type: 'number', min: 1, max: 1440, required: true }, { name: 'unit', label: 'Unité', type: 'select', options: [{ value: 'seconds', label: 'Secondes' }, { value: 'minutes', label: 'Minutes' }, { value: 'hours', label: 'Heures' }] }];
  Modal.form({ title: 'Minuteur personnalisé', subtitle: 'Le minuteur continue après rechargement et envoie une notification à son terme.', fields, values: { amount: 5, unit: 'minutes' }, onSubmit(form) {
    const data = formValues(form, fields); const multiplier = data.unit === 'hours' ? 3600 : data.unit === 'minutes' ? 60 : 1;
    Focus.startCustom(Number(data.amount) * multiplier); Toast.show('Minuteur démarré.'); setTimeout(() => renderCurrent(), 200);
  } });
}

function openAlarmEditor(alarm = null, returnToManager = false) {
  const fields = [
    { name: 'name', label: 'Nom du réveil', required: true, full: true, maxlength: 100 },
    { name: 'time', label: 'Heure', type: 'time', required: true },
    { name: 'date', label: 'Date unique (facultative)', type: 'date', hint: 'Si renseignée, les jours de récurrence sont ignorés.' },
    ...[1, 2, 3, 4, 5, 6, 0].map((day, index) => ({ name: `d${day}`, label: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][index], type: 'checkbox', checkboxLabel: 'Répéter' }))
  ];
  const values = alarm ? { ...alarm, ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(day => [`d${day}`, alarm.days?.includes(day)])) } : { name: 'Réveil travail', time: '07:00', date: '', d1: true, d2: true, d3: true, d4: true, d5: true, d6: false, d0: false };
  Modal.form({ title: alarm ? 'Modifier le réveil' : 'Nouveau réveil', subtitle: 'Le réveil sonne tant que PERSONAL OS est ouvert. Une application Android native sera nécessaire en arrière-plan.', fields, values, size: 'wide', onSubmit(form) {
    const data = formValues(form, fields); data.days = [1, 2, 3, 4, 5, 6, 0].filter(day => data[`d${day}`]);
    [0, 1, 2, 3, 4, 5, 6].forEach(day => delete data[`d${day}`]);
    if (!data.date && !data.days.length) throw new Error('Choisissez une date unique ou au moins un jour de récurrence.');
    data.enabled = alarm ? alarm.enabled : true; data.snoozeUntil = null;
    if (alarm) Repo.update('alarms', alarm.id, data); else Repo.create('alarms', { ...data, lastTriggeredKey: '' });
    Toast.show('Réveil enregistré.'); if (returnToManager) setTimeout(openAlarmManager, 220);
  } });
}

function openAlarmManager() {
  Toast.show('Le module d’alarmes a été retiré : le réveil est géré par le module Rappels.', 'info', 5200);
  navigate('reminders');
  return;
  /* eslint-disable-next-line no-unreachable */
  const alarms = [...Repo.list('alarms')].sort((a, b) => (Alarms.next(a)?.getTime() || Infinity) - (Alarms.next(b)?.getTime() || Infinity));
  const content = `<div class="alarm-manager-note">${icon('info', 17)} Les réveils sont locaux à cet espace et nécessitent que l’application reste ouverte. Testez la sonnerie après une interaction utilisateur si le navigateur bloque l’audio.</div><div class="alarm-manager-list">${alarms.length ? alarms.map(alarm => { const next = Alarms.next(alarm); return `<article><button class="alarm-toggle ${alarm.enabled ? 'active' : ''}" data-action="alarm-toggle" data-id="${alarm.id}" data-manage="true">${icon('bell', 16)}</button><div><strong>${Utils.esc(alarm.name)}</strong><small>${next ? Utils.formatDateTime(next) : 'Désactivé ou terminé'} · ${alarm.date ? 'unique' : alarm.days?.length ? 'récurrent' : 'sans répétition'}</small></div><time>${Utils.esc(alarm.time)}</time>${iconButton('alarm-edit', alarm.id, 'edit', 'Modifier', 'data-manage="true"')}${iconButton('alarm-delete', alarm.id, 'trash', 'Supprimer', 'data-manage="true"')}</article>`; }).join('') : '<p class="muted">Aucun réveil. Créez une alarme unique ou une semaine de travail.</p>'}</div><div class="button-row"><button class="button primary" data-action="alarm-new" data-manage="true">${icon('plus', 16)} Nouveau réveil</button><button class="button ghost" data-action="alarm-work-preset">Activer la semaine travail · 07:00</button><button class="button ghost" data-action="alarm-test">${icon('volume', 16)} Tester la sonnerie</button></div>`;
  Modal.open({ title: 'Réveils', subtitle: 'Programmation, récurrence et vérification audio.', content, size: 'wide' });
}

function openTriggeredAlarm(alarm) {
  if (!alarm) return;
  Modal.open({ title: alarm.name, eyebrow: 'RÉVEIL · MAINTENANT', content: `<div class="triggered-alarm"><span>${icon('bell', 34)}</span><strong>${new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date())}</strong><p>La sonnerie et l’annonce vocale ont été déclenchées. Vous pouvez arrêter ce réveil ou le reporter.</p><div><button class="button ghost" data-action="alarm-snooze" data-id="${alarm.id}" data-minutes="5">Reporter 5 min</button><button class="button ghost" data-action="alarm-snooze" data-id="${alarm.id}" data-minutes="10">Reporter 10 min</button><button class="button primary" data-action="alarm-dismiss" data-id="${alarm.id}">Arrêter</button></div></div>`, size: 'small' });
}

async function deleteAlarm(id, fromManager = false) {
  const alarm = Repo.get('alarms', id); if (!alarm) return;
  if (await Modal.confirm({ title: 'Supprimer le réveil', message: `Supprimer « ${alarm.name} » ?` })) { Repo.remove('alarms', id); Toast.show('Réveil supprimé.', 'info'); }
  if (fromManager) setTimeout(openAlarmManager, 200);
}

function openNewsConfig() {
  const config = News.config();
  const content = `<div class="news-briefing-settings"><div><strong>Briefing vocal du matin</strong><p>À l’heure choisie, si l’application est ouverte et hors plage silencieuse.</p></div><label class="switch-only"><input type="checkbox" data-news-setting="briefingEnabled" ${config.briefingEnabled ? 'checked' : ''}><span class="switch"><span></span></span></label><label>Heure<input type="time" value="${Utils.esc(config.briefingTime)}" data-news-setting="briefingTime"></label></div><div class="news-feed-list">${config.feeds.map(feed => `<article><label class="switch-only"><input type="checkbox" data-news-feed="${feed.id}" ${feed.enabled ? 'checked' : ''}><span class="switch"><span></span></span></label><div><strong>${Utils.esc(feed.name)}</strong><small>${Utils.esc(feed.url)}</small></div>${iconButton('news-feed-remove', feed.id, 'trash', 'Retirer la source')}</article>`).join('')}</div><div class="button-row"><button class="button primary" data-action="news-feed-add">${icon('plus', 16)} Ajouter un flux RSS</button><button class="button ghost" data-action="news-refresh">${icon('refresh', 16)} Actualiser maintenant</button></div><p class="settings-hint">Le résumé est extractif : titres et descriptions RSS, sans IA générative. Si le flux bloque CORS, le convertisseur public rss2json est utilisé avec l’URL publique du flux.</p>`;
  Modal.open({ title: 'Actualités & briefing', subtitle: 'Sources, fréquence et annonce matinale.', content, size: 'wide' });
}

function openNewsFeedEditor() {
  const fields = [{ name: 'name', label: 'Nom de la source', required: true, full: true }, { name: 'url', label: 'URL du flux RSS / Atom', type: 'url', required: true, full: true, placeholder: 'https://exemple.fr/rss.xml' }];
  Modal.form({ title: 'Ajouter une source RSS', fields, onSubmit(form) { const data = formValues(form, fields); News.addFeed(data.name, data.url); Toast.show('Source ajoutée. Actualisez pour vérifier sa disponibilité.'); setTimeout(openNewsConfig, 220); } });
}

async function openNewsBriefing(button = null) {
  if (button) button.disabled = true;
  try {
    if (!News.config().items.length && navigator.onLine) await News.refresh();
    const items = News.config().items.slice(0, 3);
    Modal.open({ title: 'Point actualité en résumé', subtitle: 'Titres et descriptions des sources RSS · sans résumé génératif.', content: `<div class="news-briefing-list">${items.length ? items.map(item => `<article><span>${Utils.esc(item.source)} · ${Utils.relative(item.pubDate)}</span><h3>${Utils.esc(item.title)}</h3><p>${Utils.esc(item.summary || 'Aucune description fournie par la source.')}</p>${item.link ? `<a href="${Utils.esc(item.link)}" target="_blank" rel="noopener noreferrer">Lire l’article source ${icon('link', 13)}</a>` : ''}</article>`).join('') : '<p class="muted">Aucun titre disponible. Vérifiez la connexion et les sources.</p>'}</div><button class="button primary" data-action="news-speak-now">${icon('volume', 16)} Écouter le résumé</button>` });
    const spoken = await News.deliver(true); if (!spoken) Toast.show('Activez la voix et autorisez SpeechSynthesis pour écouter le briefing.', 'info');
  } catch (error) { Toast.show(error.message, 'error', 6000); }
  finally { if (button) button.disabled = false; }
}

/* ---------- Commandes personnalisées de Sophie ---------- */
function openCommandEditor(command = null) {
  const fields = [
    { name: 'name', label: 'Nom de la commande', required: true, full: true, maxlength: 80, placeholder: 'Ex. Rituel du soir' },
    { name: 'triggersText', label: 'Déclencheurs (séparés par des virgules)', required: true, full: true, hint: 'Ex. bonne nuit, bonne nuit sophie, à demain', value: '' },
    { name: 'response', label: 'Réponse exacte de Sophie', type: 'textarea', required: true, full: true, rows: 5, hint: 'Variables : {nom} {assistante} {date} {heure} {jour} {meteo}' },
    { name: 'voice', label: 'Voix', type: 'checkbox', checkboxLabel: 'Lire la réponse à voix haute' },
    { name: 'action', label: 'Ouvrir en même temps (facultatif)', type: 'select', options: [{ value: '', label: 'Rien' }, { value: 'maison', label: 'Maison' }, { value: 'calendar', label: 'Calendrier' }, { value: 'reminders', label: 'Rappels' }, { value: 'maison-courses', label: 'Courses' }, { value: 'maison-cuisine', label: 'Cuisine' }, { value: 'maison-budget', label: 'Budget maison' }] }
  ];
  const values = command ? { ...command, triggersText: (command.triggers || []).join(', ') } : { name: '', triggersText: '', response: '', voice: true, action: '' };
  Modal.form({
    title: command ? 'Modifier la commande' : 'Nouvelle commande personnalisée',
    subtitle: 'Dites « Hey Sophie » suivi du déclencheur : elle répondra exactement avec votre texte.',
    fields, values, size: 'wide', submitLabel: 'Enregistrer la commande',
    onSubmit(form) {
      const data = Modal.values(form, fields);
      const triggers = (data.triggersText || '').split(',').map(t => t.trim()).filter(Boolean);
      if (!triggers.length) throw new Error('Indiquez au moins un déclencheur.');
      const payload = { name: data.name, triggers, response: data.response, voice: data.voice !== false, action: data.action || '' };
      if (command) Repo.update('customCommands', command.id, payload); else Repo.create('customCommands', payload);
      Toast.show('Commande enregistrée. Essayez : « Hey Sophie, ' + triggers[0] + ' ».');
      setTimeout(() => renderCurrent(), 200);
    }
  });
}

/* ---------- Rappels intelligents ---------- */
function openReminderEditor(reminder = null, defaults = {}) {
  const fields = [
    { name: 'title', label: 'Titre du rappel', required: true, full: true, maxlength: 120, value: defaults.title || '' },
    { name: 'description', label: 'Description', type: 'textarea', full: true, rows: 2, maxlength: 400, value: defaults.description || '' },
    { name: 'voiceMessage', label: 'Message vocal personnalisé (facultatif)', type: 'textarea', full: true, rows: 2, maxlength: 300, hint: 'Sans message, Sophie en compose un selon le style choisi.', value: defaults.voiceMessage || '' },
    { name: 'category', label: 'Catégorie', type: 'select', options: Reminders.categories },
    { name: 'priority', label: 'Priorité', type: 'select', options: Taxonomy.priorities },
    { name: 'style', label: 'Style d’annonce', type: 'select', options: Reminders.styles, hint: 'Professionnel · Amical · Humoristique · Direct.' },
    { name: 'time', label: 'Heure', type: 'time', required: true },
    { name: 'date', label: 'Date (une fois, ancre hebdo/mensuelle)', type: 'date' },
    { name: 'freq', label: 'Récurrence', type: 'select', options: Reminders.frequencies.map(f => ({ value: f.value, label: f.label })) },
    { name: 'dayOfMonth', label: 'Jour du mois (récurrence mensuelle)', type: 'number', min: 1, max: 31 },
    ...[1, 2, 3, 4, 5, 6, 0].map((day, index) => ({ name: `d${day}`, label: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][index], type: 'checkbox', checkboxLabel: 'Actif' })),
    { name: 'vocal', label: 'Annonce vocale', type: 'checkbox', checkboxLabel: 'Lire le message à voix haute' }
  ];
  const values = reminder ? {
    ...reminder, freq: reminder.repeat?.freq || 'once', dayOfMonth: reminder.repeat?.dayOfMonth || 1,
    vocal: reminder.channels?.vocal !== false,
    ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(day => [`d${day}`, reminder.repeat?.days?.includes(day)]))
  } : { category: 'Maison', priority: 'Normale', style: Store.settings.reminderStyle || 'Amical', time: '08:00', date: Utils.iso(), freq: 'once', vocal: true, d1: false, d2: false, d3: false, d4: false, d5: false, d6: false, d0: false, ...defaults };

  Modal.form({
    title: reminder ? 'Modifier le rappel' : 'Nouveau rappel', subtitle: 'La récurrence, le message vocal et les canaux sont modifiables à tout moment.',
    fields, values, size: 'wide', submitLabel: reminder ? 'Enregistrer' : 'Créer le rappel',
    onSubmit(form) {
      const data = Modal.values(form, fields);
      const days = [1, 2, 3, 4, 5, 6, 0].filter(day => data[`d${day}`]);
      if (data.freq === 'weekdays' && !days.length) throw new Error('Sélectionnez au moins un jour pour la récurrence hebdomadaire.');
      if (data.freq === 'once' && !data.date) throw new Error('Indiquez une date pour un rappel ponctuel.');
      const payload = {
        title: data.title, description: data.description, voiceMessage: data.voiceMessage,
        category: data.category, priority: data.priority, style: data.style, time: data.time,
        date: data.date || Utils.iso(),
        repeat: { freq: data.freq, days, dayOfMonth: Number(data.dayOfMonth) || undefined, anchor: data.date || Utils.iso() },
        channels: { inApp: true, vocal: data.vocal !== false, system: true },
        enabled: reminder ? reminder.enabled : true,
        source: reminder?.source || defaults.source || 'Manuel',
        linkType: reminder?.linkType || defaults.linkType || '', linkId: reminder?.linkId || defaults.linkId || ''
      };
      if (reminder) { Repo.update('reminders', reminder.id, payload); Toast.show('Rappel mis à jour.'); }
      else { Repo.create('reminders', { ...payload, status: 'active', history: [], fired: {}, snoozeUntil: null }, defaults.source ? 'assistant' : 'interface'); Toast.show('Rappel créé.'); }
      setTimeout(() => renderCurrent(), 220);
    }
  });
}

function openTriggeredReminder(reminder) {
  if (!reminder) return;
  Modal.open({
    title: reminder.title, eyebrow: 'RAPPEL · SOPHIE',
    content: `<div class="triggered-alarm"><span>${icon('bell', 32)}</span><p class="sophie-report">« ${Utils.esc(Reminders.message(reminder))} »</p><div><button class="button ghost" data-action="reminder-snooze" data-id="${reminder.id}">Rappelle-moi dans 15 min</button><button class="button ghost" data-action="reminder-postpone" data-id="${reminder.id}">Décale à demain</button><button class="button ghost danger" data-action="reminder-cancel" data-id="${reminder.id}">Annuler</button><button class="button primary" data-action="reminder-done" data-id="${reminder.id}">C’est fait</button></div></div>`,
    size: 'small'
  });
}

function openReminderHistory() {
  const history = Repo.list('reminders').flatMap(r => (r.history || []).map(h => ({ ...h, title: r.title }))).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 40);
  Modal.open({ title: 'Historique des rappels', eyebrow: 'SOPHIE · TRACE', content: history.length ? `<div class="history-list">${history.map(h => `<div><i></i><span>${Utils.esc(h.detail)}<small>${Utils.esc(h.title)} · ${Utils.formatDateTime(h.date)}</small></span></div>`).join('')}</div>` : '<p class="muted">Aucun événement de rappel pour le moment.</p>', size: 'wide' });
}

/* ---------- Éditeurs génériques ---------- */
function openGoalEditor(goal = null, preset = {}) {
  const values = goal || { name: '', category: 'Personnel', priority: 'Normale', start: Utils.iso(), deadline: Utils.day(30), current: 0, target: 100, unit: '%', description: '', ...preset };
  Modal.form({ title: goal ? 'Modifier l’objectif' : 'Nouvel objectif', subtitle: 'La progression est calculée automatiquement à partir de la valeur actuelle et de la cible.', fields: goalFields, values, submitLabel: goal ? 'Enregistrer les modifications' : 'Créer l’objectif', size: 'wide', onSubmit(form) {
    const data = formValues(form, goalFields); validateGoal(data);
    if (goal) {
      const previous = Repo.get('goals', goal.id); data.history = [...(previous.history || []), { id: Utils.uid('hist'), text: 'Paramètres de l’objectif modifiés.', date: new Date().toISOString() }]; Repo.update('goals', goal.id, data);
    } else Repo.create('goals', { ...data, steps: [], comments: [], history: [{ id: Utils.uid('hist'), text: 'Objectif créé.', date: new Date().toISOString() }] });
    Toast.show(goal ? 'Objectif mis à jour.' : 'Objectif créé.');
  } });
}

function openGoalDetail(id) {
  const goal = Repo.get('goals', id); if (!goal) return Toast.show('Objectif introuvable.', 'error');
  const progress = Selectors.goalProgress(goal); const tasks = Repo.list('tasks').filter(task => task.goalId === id);
  const content = `<div class="detail-hero"><div><span class="micro-label">${Utils.esc(goal.category)} · ${Utils.esc(goal.priority)}</span><h3>${Utils.esc(goal.current)} / ${Utils.esc(goal.target)} ${Utils.esc(goal.unit)}</h3><p>${Utils.esc(goal.description || 'Aucune description renseignée.')}</p></div><strong>${Math.round(progress)}%</strong></div>${progressBar(progress)}
    <form id="modal-form" class="inline-progress-form"><label>Valeur actuelle<input type="number" name="current" min="0" step="any" value="${Utils.esc(goal.current)}" required></label><label>Valeur cible<input type="number" name="target" min="0.01" step="any" value="${Utils.esc(goal.target)}" required></label><span>Début : ${Utils.formatDate(goal.start, { year: 'numeric' })}<br>Échéance : ${goal.deadline ? Utils.formatDate(goal.deadline, { year: 'numeric' }) : 'non définie'}</span></form>
    <div class="detail-grid"><section class="detail-section"><header><h3>Étapes intermédiaires</h3><button class="button ghost tiny" data-action="goal-step-new" data-id="${id}">${icon('plus', 14)} Étape</button></header><div class="detail-list">${goal.steps?.length ? goal.steps.map(step => `<div class="detail-item"><button class="task-check ${step.done ? 'done' : ''}" data-action="goal-step-toggle" data-id="${id}" data-step="${step.id}" aria-label="Changer l’état de ${Utils.esc(step.title)}">${icon('check', 13)}</button><span class="${step.done ? 'done' : ''}">${Utils.esc(step.title)}</span>${iconButton('goal-step-delete', id, 'trash', 'Supprimer l’étape', `data-step="${step.id}"`)}</div>`).join('') : '<p class="muted">Aucune étape. Divisez l’objectif pour faciliter son exécution.</p>'}</div></section>
    <section class="detail-section"><header><h3>Tâches associées</h3><button class="button ghost tiny" data-action="goal-task-new" data-id="${id}">${icon('plus', 14)} Tâche</button></header><div class="detail-list">${tasks.length ? tasks.map(task => `<div class="detail-item"><button class="task-check ${task.status === 'done' ? 'done' : ''}" data-action="task-toggle" data-id="${task.id}" data-goal-detail="${id}">${icon('check', 13)}</button><button class="detail-link" data-action="task-edit" data-id="${task.id}" data-goal-detail="${id}">${Utils.esc(task.title)}</button><small>${task.due ? Utils.formatDate(task.due) : 'Sans date'}</small></div>`).join('') : '<p class="muted">Aucune tâche associée.</p>'}</div></section>
    <section class="detail-section"><header><h3>Commentaires</h3><button class="button ghost tiny" data-action="goal-comment-new" data-id="${id}">${icon('plus', 14)} Commentaire</button></header><div class="detail-list">${goal.comments?.length ? [...goal.comments].reverse().map(comment => `<div class="comment-item"><p>${Utils.esc(comment.text)}</p><small>${Utils.formatDateTime(comment.date)}</small></div>`).join('') : '<p class="muted">Aucun commentaire.</p>'}</div></section>
    <section class="detail-section history-section"><header><h3>Historique</h3><span class="badge">${goal.history?.length || 0}</span></header><div class="history-list">${goal.history?.length ? [...goal.history].reverse().map(entry => `<div><i></i><span>${Utils.esc(entry.text)}<small>${Utils.formatDateTime(entry.date)}</small></span></div>`).join('') : '<p class="muted">Aucun événement historique.</p>'}</div></section></div>`;
  Modal.open({ title: goal.name, subtitle: 'Fiche de pilotage · progression, étapes, tâches et mémoire', content, size: 'large', submitLabel: 'Mettre à jour la progression', onSubmit(form) {
    const current = Number(form.elements.current.value), target = Number(form.elements.target.value);
    if (target <= 0 || current < 0) throw new Error('Saisissez une valeur actuelle positive et une cible supérieure à zéro.');
    Repo.update('goals', id, { current, target }); Toast.show('Progression enregistrée.');
    if (current >= target && Selectors.goalProgress({ ...goal, current, target }) >= 100) Notify.push({ title: 'Objectif atteint', body: goal.name, type: 'Information', priority: 'Haute', source: 'Objectifs', dedupeKey: `goal-done-${id}-${target}` });
  } });
}

function iconButton(action, id, name, label, extra = '') { return `<button class="icon-button subtle" data-action="${action}" data-id="${Utils.esc(id)}" ${extra} aria-label="${Utils.esc(label)}">${icon(name, 15)}</button>`; }

function openSessionEditor(session = null, planned = false) {
  const values = session || { type: 'Course', status: planned ? 'Planifiée' : 'Terminée', date: Utils.localDateTime(), duration: planned ? 45 : 30, distance: 0, reps: 0, feeling: 0, performance: '', notes: '' };
  Modal.form({ title: session ? 'Modifier la séance' : planned ? 'Planifier une séance' : 'Enregistrer une séance', subtitle: 'Les mesures non pertinentes peuvent rester à zéro.', fields: sessionFields, values, submitLabel: session ? 'Enregistrer' : planned ? 'Planifier' : 'Enregistrer la séance', size: 'wide', onSubmit(form) {
    const data = formValues(form, sessionFields); if (data.date && new Date(data.date).toString() === 'Invalid Date') throw new Error('La date de séance est invalide.');
    if (session) Repo.update('sessions', session.id, data); else Repo.create('sessions', data);
    Toast.show(planned && !session ? 'Séance planifiée.' : 'Séance enregistrée. Statistiques actualisées.');
  } });
}

function openProjectEditor(project = null, preset = {}) {
  const values = project || { name: '', description: '', category: 'Personnel', icon: 'folder', status: 'Idée', priority: 'Normale', deadline: Utils.day(30), progress: 0, budget: 0, color: '#37D6A0', ...preset };
  Modal.form({ title: project ? 'Modifier le projet' : 'Nouveau projet', subtitle: 'La date de création est enregistrée automatiquement.', fields: projectFields, values, size: 'wide', submitLabel: project ? 'Enregistrer les modifications' : 'Créer le projet', onSubmit(form) {
    const data = formValues(form, projectFields); if (data.progress < 0 || data.progress > 100) throw new Error('La progression doit être comprise entre 0 et 100 %.');
    if (project) Repo.update('projects', project.id, data); else Repo.create('projects', { ...data, notes: [], documents: [] }); Toast.show(project ? 'Projet mis à jour.' : 'Projet créé.');
  } });
}

function openProjectDetail(id) {
  const project = Repo.get('projects', id); if (!project) return Toast.show('Projet introuvable.', 'error');
  const tasks = Repo.list('tasks').filter(task => task.projectId === id);
  const content = `<div class="project-detail-banner" style="--project-color:${Utils.esc(project.color)}"><span class="project-icon">${icon(project.icon || 'folder', 28)}</span><div><span class="micro-label">${Utils.esc(project.category)} · créé le ${Utils.formatDate(project.createdAt, { year: 'numeric' })}</span><p>${Utils.esc(project.description)}</p><div class="card-labels">${badge(project.status)}${badge(project.priority)}</div></div><div><strong>${project.progress}%</strong><span>${project.deadline ? `Échéance ${Utils.formatDate(project.deadline, { year: 'numeric' })}` : 'Sans échéance'}</span></div></div>
    <form id="modal-form" class="inline-progress-form"><label>Progression (%)<input type="number" name="progress" min="0" max="100" value="${project.progress}" required></label><label>Statut<select name="status">${Taxonomy.PROJECT_STATUSES.map(status => `<option ${project.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></label><span>Budget : ${Utils.money(project.budget)}<br>${tasks.filter(t => t.status !== 'done').length} tâches ouvertes</span></form>
    <div class="detail-grid"><section class="detail-section full"><header><h3>Tâches du projet</h3><button class="button ghost tiny" data-action="project-task-new" data-id="${id}">${icon('plus', 14)} Tâche</button></header><div class="detail-list">${tasks.length ? tasks.map(task => `<div class="detail-item"><button class="task-check ${task.status === 'done' ? 'done' : ''}" data-action="task-toggle" data-id="${task.id}" data-project-detail="${id}">${icon('check', 13)}</button><button class="detail-link ${task.status === 'done' ? 'done' : ''}" data-action="task-edit" data-id="${task.id}" data-project-detail="${id}">${Utils.esc(task.title)}</button>${badge(task.priority)}<small>${task.due ? Utils.formatDate(task.due) : 'Sans date'}</small></div>`).join('') : '<p class="muted">Aucune tâche. Ajoutez la première action concrète.</p>'}</div></section>
    <section class="detail-section"><header><h3>Notes</h3><button class="button ghost tiny" data-action="project-note-new" data-id="${id}">${icon('plus', 14)} Note</button></header><div class="detail-list">${project.notes?.length ? [...project.notes].reverse().map(note => `<div class="comment-item"><p>${Utils.esc(note.text)}</p><small>${Utils.formatDateTime(note.date)}</small>${iconButton('project-note-delete', id, 'trash', 'Supprimer la note', `data-note="${note.id}"`)}</div>`).join('') : '<p class="muted">Aucune note.</p>'}</div></section>
    <section class="detail-section"><header><h3>Documents & liens</h3><button class="button ghost tiny" data-action="project-document-new" data-id="${id}">${icon('plus', 14)} Document</button></header><div class="detail-list">${project.documents?.length ? project.documents.map(doc => `<div class="document-item"><span>${icon('link', 16)}</span>${Utils.safeUrl(doc.url) ? `<a href="${Utils.esc(Utils.safeUrl(doc.url))}" target="_blank" rel="noopener noreferrer">${Utils.esc(doc.name)}</a>` : `<span class="document-reference">${Utils.esc(doc.name)}</span>`}<small>${doc.url ? 'Lien externe' : 'Référence locale'}</small>${iconButton('project-document-delete', id, 'trash', 'Supprimer le document', `data-document="${doc.id}"`)}</div>`).join('') : '<p class="muted">Aucun document. Ajoutez un lien http(s) ou une référence locale.</p>'}</div></section></div>`;
  Modal.open({ title: project.name, subtitle: 'Pilotage opérationnel du projet', content, size: 'large', submitLabel: 'Actualiser le projet', onSubmit(form) {
    const progress = Number(form.elements.progress.value); if (progress < 0 || progress > 100) throw new Error('Progression invalide.');
    Repo.update('projects', id, { progress, status: form.elements.status.value }); Toast.show('Projet actualisé.');
  } });
}

function openTaskEditor(task = null, defaults = {}, returnDetail = null) {
  const fields = taskFields({ projectId: '', goalId: '', status: 'todo', priority: 'Normale', due: Utils.iso(), notes: '', ...defaults });
  const values = task || { title: '', projectId: '', goalId: '', status: 'todo', priority: 'Normale', due: Utils.iso(), notes: '', ...defaults };
  Modal.form({ title: task ? 'Modifier la tâche' : 'Nouvelle tâche', fields, values, size: 'wide', submitLabel: task ? 'Enregistrer' : 'Créer la tâche', onSubmit(form) {
    const data = formValues(form, fields); if (task) Repo.update('tasks', task.id, data); else Repo.create('tasks', data); Toast.show(task ? 'Tâche mise à jour.' : 'Tâche créée.');
    if (returnDetail) setTimeout(() => returnDetail.type === 'goal' ? openGoalDetail(returnDetail.id) : openProjectDetail(returnDetail.id), 220);
  } });
}

function openTransactionEditor(tx = null, type = 'expense') {
  const values = tx || { type, date: Utils.iso(), label: '', category: type === 'income' ? 'Salaire' : 'Alimentation', amount: null, notes: '' };
  Modal.form({ title: tx ? 'Modifier l’opération' : type === 'income' ? 'Ajouter un revenu' : 'Ajouter une dépense', subtitle: 'Saisie manuelle. Aucune connexion bancaire n’est active.', fields: transactionFields, values, submitLabel: tx ? 'Enregistrer' : 'Ajouter l’opération', onSubmit(form) {
    const data = formValues(form, transactionFields); if (!(data.amount > 0)) throw new Error('Le montant doit être supérieur à zéro.');
    if (tx) Repo.update('transactions', tx.id, data); else Repo.create('transactions', data); Toast.show('Opération enregistrée. Budget actualisé.');
  } });
}

function openBudgetEditor() {
  const fields = [{ name: 'monthlyBudget', label: 'Budget mensuel de dépenses (€)', type: 'number', min: 0, step: '0.01', required: true, hint: '0 signifie aucun seuil.' }, { name: 'savingsTarget', label: 'Cap d’épargne mensuel (€)', type: 'number', min: 0, step: '0.01', required: true }];
  Modal.form({ title: 'Budget & cap d’épargne', fields, values: Store.data.finance, onSubmit(form) { const values = formValues(form, fields); Store.commit(data => { data.finance.monthlyBudget = values.monthlyBudget; data.finance.savingsTarget = values.savingsTarget; }); Toast.show('Seuils financiers enregistrés.'); } });
}

function openSubscriptionEditor(sub = null) {
  const fields = [{ name: 'name', label: 'Nom', required: true, full: true }, { name: 'amount', label: 'Montant (€)', type: 'number', min: 0.01, step: '0.01', required: true }, { name: 'cycle', label: 'Cycle', type: 'select', options: ['Mensuel', 'Trimestriel', 'Annuel'] }, { name: 'nextDate', label: 'Prochain renouvellement', type: 'date', required: true }, { name: 'active', label: 'État', type: 'checkbox', checkboxLabel: 'Abonnement actif' }, { name: 'notes', label: 'Notes', type: 'textarea', full: true }];
  const values = sub || { name: '', amount: null, cycle: 'Mensuel', nextDate: Utils.day(30), active: true, notes: '' };
  Modal.form({ title: sub ? 'Modifier l’abonnement' : 'Nouvel abonnement', fields, values, onSubmit(form) { const data = formValues(form, fields); if (sub) Repo.updateFinanceItem('subscriptions', sub.id, data); else Repo.addFinanceItem('subscriptions', data); Toast.show('Abonnement enregistré.'); } });
}

function openDebtEditor(debt = null) {
  const fields = [{ name: 'name', label: 'Nom de la dette', required: true, full: true }, { name: 'creditor', label: 'Créancier', required: true }, { name: 'amount', label: 'Montant initial (€)', type: 'number', min: 0.01, step: '0.01', required: true }, { name: 'paid', label: 'Déjà remboursé (€)', type: 'number', min: 0, step: '0.01', required: true }, { name: 'rate', label: 'Taux (%)', type: 'number', min: 0, step: '0.01' }, { name: 'due', label: 'Échéance finale', type: 'date' }, { name: 'notes', label: 'Notes', type: 'textarea', full: true }];
  const values = debt || { name: '', creditor: '', amount: null, paid: 0, rate: 0, due: '', notes: '' };
  Modal.form({ title: debt ? 'Modifier la dette' : 'Nouvelle dette', fields, values, onSubmit(form) { const data = formValues(form, fields); if (data.paid > data.amount) throw new Error('Le montant remboursé ne peut pas dépasser le montant initial.'); if (debt) Repo.updateFinanceItem('debts', debt.id, data); else Repo.addFinanceItem('debts', data); Toast.show('Dette enregistrée.'); } });
}

function openEventEditor(event = null, preset = {}) {
  const fields = eventFields(); const values = event || { title: '', date: Utils.iso(), start: '09:00', end: '10:00', category: 'Personnel', description: '', projectId: '', reminder: 30, ...preset };
  const intro = event ? `<div class="modal-inline-danger"><button type="button" class="button danger small" data-action="event-delete" data-id="${event.id}">${icon('trash', 15)} Supprimer cet événement</button></div>` : '';
  Modal.form({ title: event ? 'Modifier l’événement' : 'Nouvel événement', fields, values, intro, size: 'wide', submitLabel: event ? 'Enregistrer les modifications' : 'Créer l’événement', onSubmit(form) {
    const data = formValues(form, fields); data.reminder = Number(data.reminder || 0); validateEvent(data);
    if (event) Repo.update('events', event.id, data); else Repo.create('events', data); Toast.show('Événement enregistré.');
  } });
}

function openDeviceEditor(device = null) {
  const values = device || { name: '', brand: '', model: '', category: 'Ordinateur', status: 'Opérationnel', purchaseDate: '', warranty: '', lastCheck: '', notes: '' };
  Modal.form({ title: device ? 'Modifier l’appareil' : 'Ajouter un appareil', subtitle: 'Aucun champ de batterie ou de stockage fictif n’est enregistré.', fields: deviceFields, values, size: 'wide', onSubmit(form) { const data = formValues(form, deviceFields); if (device) Repo.update('devices', device.id, data); else Repo.create('devices', data); Toast.show('Inventaire enregistré.'); } });
}

function openNotificationEditor() {
  const fields = [{ name: 'title', label: 'Titre', required: true, full: true }, { name: 'body', label: 'Message', type: 'textarea', required: true, full: true }, { name: 'type', label: 'Type', type: 'select', options: ['Information', 'Rappel', 'Alerte', 'Critique'] }, { name: 'priority', label: 'Priorité', type: 'select', options: Taxonomy.priorities }, { name: 'source', label: 'Source', required: true, value: 'Manuel' }];
  Modal.form({ title: 'Nouvelle notification', fields, values: { type: 'Information', priority: 'Normale', source: 'Manuel' }, onSubmit(form) { const data = formValues(form, fields); Notify.push(data); Toast.show('Notification créée.'); } });
}

function openJournalEditor(entry = null, quickTitle = '') {
  const values = entry ? { ...entry, tagsText: (entry.tags || []).join(', ') } : { type: 'Note', date: Utils.localDateTime(), title: quickTitle, text: quickTitle, tagsText: '' };
  Modal.form({ title: entry ? 'Modifier l’entrée' : 'Nouvelle entrée de journal', fields: journalFields, values, size: 'wide', onSubmit(form) {
    const data = formValues(form, journalFields); data.tags = data.tagsText.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 10); delete data.tagsText;
    if (entry) Repo.update('journal', entry.id, data); else Repo.create('journal', data); Toast.show('Journal enregistré.');
  } });
}

/* ---------- Confirmations et suppressions ---------- */
async function removeEntity(collection, id, label, after = null) {
  const item = Repo.get(collection, id); if (!item) return;
  const confirmed = await Modal.confirm({ title: 'Confirmer la suppression', message: `Supprimer définitivement « ${item.name || item.title || item.label || item.type || label} » ? Cette action est irréversible.` });
  if (!confirmed) { if (after) setTimeout(after, 200); return; }
  if (collection === 'tasks') {
    Store.commit(data => { data.goals.forEach(goal => { if (goal.goalId === id) goal.goalId = ''; }); });
  }
  Repo.remove(collection, id); Toast.show('Élément supprimé.', 'info');
}

/* ---------- Actions déléguées ---------- */
async function handleAction(button, event) {
  const action = button.dataset.action, id = button.dataset.id;
  switch (action) {
    case 'menu-toggle': toggleMenu(); break;
    case 'workspace-toggle': Store.switchMode(Store.mode === 'demo' ? 'real' : 'demo'); navigate(App.section); Toast.show(`Espace ${Store.mode === 'demo' ? 'de démonstration fictive' : 'de données réelles'} activé.`, 'info'); break;
    case 'workspace-real': Store.switchMode('real'); navigate(App.section); Toast.show('Espace réel activé. Aucune donnée fictive n’a été copiée.', 'info'); break;
    case 'workspace-demo': Store.switchMode('demo'); navigate(App.section); break;
    case 'dismiss-demo': Store.setSetting('demoBanner', false); updateChrome(); break;
    case 'fullscreen': toggleFullscreen(); break;
    case 'weather-open': ViewState.settingsTab = 'general'; navigate('settings'); setTimeout(() => $('#weather-label')?.focus(), 250); break;
    case 'weather-widget-refresh': button.disabled = true; try { await Weather.refresh(); renderCurrent(); Toast.show('Relevé et prévisions Open-Meteo actualisés.'); } catch (error) { Toast.show(error.message, 'error', 5500); } finally { button.disabled = false; } break;
    case 'dashboard-density-toggle': Store.setSetting('compactDashboard', !Store.settings.compactDashboard); window.scrollTo({ top: 0, behavior: 'instant' }); renderCurrent({ preserveScroll: false }); break;
    case 'timer-new': openTimerEditor(); break;
    case 'alarm-new': openAlarmEditor(null, Boolean(button.dataset.manage)); break;
    case 'alarm-manage': openAlarmManager(); break;
    case 'alarm-edit': openAlarmEditor(Repo.get('alarms', id), Boolean(button.dataset.manage)); break;
    case 'alarm-toggle': { const alarm = Repo.get('alarms', id); if (alarm) { Repo.update('alarms', id, { enabled: !alarm.enabled, snoozeUntil: null }); Toast.show(!alarm.enabled ? 'Réveil activé.' : 'Réveil désactivé.', 'info'); if (button.dataset.manage) setTimeout(openAlarmManager, 100); } break; }
    case 'alarm-delete': await deleteAlarm(id, Boolean(button.dataset.manage)); break;
    case 'alarm-dismiss': case 'alarm-snooze': case 'alarm-test': case 'alarm-work-preset':
      Toast.show('Le module d’alarmes a été retiré : le réveil est géré par le module Rappels.', 'info', 5200); break;
    case 'alarm-removed': break;
    case 'alarm-snooze': { const until = Alarms.snooze(id, Number(button.dataset.minutes)); globalThis.speechSynthesis?.cancel(); Modal.close(); renderCurrent(); Toast.show(`Réveil reporté jusqu’à ${Utils.formatTime(until)}.`); break; }
    case 'alarm-test': { const audio = Alarms.chime(); Voice.speak('Test de réveil PERSONAL OS.', { force: true }); Toast.show(audio ? 'Sonnerie et annonce de test déclenchées.' : 'Annonce envoyée, mais le navigateur a bloqué la sonnerie audio.', audio ? 'success' : 'info'); break; }
    case 'alarm-work-preset': { const result = Alarms.enableWork('07:00'); Toast.show(`Réveils travail activés. Prochain : ${Utils.formatDateTime(result.next)}.`); setTimeout(openAlarmManager, 100); break; }
    case 'news-refresh': button.disabled = true; try { await News.refresh(); Toast.show('Actualités RSS actualisées.'); if ($('#app-modal').open && $('.news-feed-list')) openNewsConfig(); else renderCurrent(); } catch (error) { Toast.show(error.message, 'error', 6500); renderCurrent(); } finally { button.disabled = false; } break;
    case 'news-configure': openNewsConfig(); break;
    case 'news-feed-add': openNewsFeedEditor(); break;
    case 'news-feed-remove': if (await Modal.confirm({ title: 'Retirer cette source', message: 'Retirer ce flux et ses titres mis en cache ?', confirmLabel: 'Retirer' })) { News.removeFeed(id); setTimeout(openNewsConfig, 200); } break;
    case 'news-briefing': await openNewsBriefing(button); break;
    case 'news-speak-now': { const spoken = await News.deliver(true); if (!spoken) Toast.show('La synthèse vocale est désactivée ou indisponible.', 'info'); break; }
    case 'spotify-configure': openSpotifyEditor(); break;
    case 'spotify-disconnect': Store.setSetting('spotifyUrl', ''); Modal.close(); setTimeout(() => renderCurrent(), 200); Toast.show('Contenu Spotify retiré du widget.', 'info'); break;
    case 'focus-toggle': { const running = Focus.toggle(); renderCurrent(); Toast.show(running ? 'Minuteur démarré. Il continuera après rechargement.' : 'Minuteur mis en pause.', 'info'); break; }
    case 'focus-mode': Focus.setMode(button.dataset.mode); renderCurrent(); break;
    case 'focus-reset': Focus.reset(); renderCurrent(); Toast.show('Cycle réinitialisé.', 'info'); break;
    case 'habit-new': openHabitEditor(null, Boolean(button.dataset.manage)); break;
    case 'habit-manage': openHabitManager(); break;
    case 'habit-edit': openHabitEditor(Repo.get('habits', id), Boolean(button.dataset.manage)); break;
    case 'habit-toggle': toggleHabit(id, Boolean(button.dataset.manage)); break;
    case 'habit-delete': await deleteHabit(id, Boolean(button.dataset.manage)); break;
    case 'weather-locate': button.disabled = true; try { await Weather.locate(); await Weather.refresh(); renderCurrent(); Toast.show('Position et météo réelle enregistrées.'); } catch (error) { Toast.show(error.message, 'error', 5500); } finally { button.disabled = false; } break;
    case 'weather-refresh': button.disabled = true; try { await Weather.refresh(); renderWeatherSummary(); renderCurrent(); Toast.show('Météo actualisée depuis Open-Meteo.'); } catch (error) { Toast.show(error.message, 'error', 5500); } finally { button.disabled = false; } break;
    case 'quick-add': openQuickAdd(); break;
    case 'search-open': openSearch(); break;
    case 'reminder-new': openReminderEditor(null, { title: button.dataset.title || '', description: button.dataset.detail || '', source: button.dataset.title ? 'Suggestion de Sophie' : 'Manuel', linkType: button.dataset.linkType || '', linkId: button.dataset.linkId || '' }); break;
    case 'reminder-accept': openReminderEditor(null, { title: button.dataset.title || '', description: button.dataset.detail || '', source: 'Suggestion de Sophie', linkType: button.dataset.linkType || '', linkId: button.dataset.linkId || '' }); break;
    case 'reminder-edit': openReminderEditor(Repo.get('reminders', id)); break;
    case 'reminder-delete': if (await Modal.confirm({ title: 'Supprimer le rappel', message: 'Supprimer définitivement ce rappel et son historique ?', confirmLabel: 'Supprimer' })) { Repo.remove('reminders', id); Toast.show('Rappel supprimé.', 'info'); renderCurrent(); } break;
    case 'reminder-done': Reminders.complete(id); Modal.close(); Toast.show('Rappel terminé. Bien joué.'); renderCurrent(); break;
    case 'reminder-snooze': { const until = Reminders.snooze(id, 15); Modal.close(); Toast.show(`D’accord, je te rappelle à ${Utils.formatTime(until)}.`); renderCurrent(); break; }
    case 'reminder-postpone': { const date = Reminders.postpone(id, 1); Modal.close(); Toast.show(`Rappel décalé au ${Utils.formatDate(date)}.`); renderCurrent(); break; }
    case 'reminder-cancel': Reminders.cancel(id); Modal.close(); Toast.show('Rappel annulé.', 'info'); renderCurrent(); break;
    case 'reminder-tab': ViewState.reminderTab = button.dataset.tab; renderCurrent(); break;
    case 'reminder-history-open': openReminderHistory(); break;
    case 'reminder-test': { const text = Reminders.message({ id: 'apercu', title: 'faire ta machine', priority: 'Haute', category: 'Maison' }); Modal.open({ title: `Aperçu du style ${Store.settings.reminderStyle}`, eyebrow: 'SOPHIE · PERSONNALITÉ', content: `<p class="sophie-report">« ${Utils.esc(text)} »</p><p class="settings-hint">Le style s’applique à tous les rappels sans message vocal personnalisé.</p>`, size: 'small' }); Voice.speak(text, { force: true }); break; }
    case 'reminder-suggestions': { const suggestions = Reminders.suggestions(); Modal.open({ title: 'Suggestions de rappels', eyebrow: 'SOPHIE · PROPOSITIONS', content: suggestions.length ? `<div class="suggestion-grid">${suggestions.map(item => `<article><strong>${Utils.esc(item.title)}</strong><small>${Utils.esc(item.detail)}</small><button class="button ghost tiny" data-action="reminder-accept" data-title="${Utils.esc(item.title)}" data-detail="${Utils.esc(item.detail)}" data-link-type="${Utils.esc(item.linkType)}" data-link-id="${Utils.esc(item.linkId)}">${icon('plus', 14)} Créer ce rappel</button></article>`).join('')}</div>` : '<p class="muted">Aucune suggestion : vos tâches, habitudes et échéances sont à jour.</p>', size: 'wide' }); break; }
    case 'search-goto': Modal.close(); navigate(button.dataset.sectionTarget || 'dashboard'); break;
    case 'focus-mode-toggle': toggleFocusMode(); break;
    case 'sophie-wake-toggle': Store.setSetting('wakeWordEnabled', !Store.settings.wakeWordEnabled); if (Store.settings.wakeWordEnabled) Voice.startWakeLoop(); else Voice.stopWakeLoop(); renderCurrent(); break;
    case 'sophie-memory-add': {
      const fields = [{ name: 'text', label: 'À mémoriser', type: 'textarea', required: true, full: true, rows: 4, maxlength: 400 }, { name: 'kind', label: 'Type', type: 'select', options: ['Permanente', 'Temporaire', 'Préférence'] }];
      Modal.form({ title: 'Ajouter à la mémoire de Sophie', subtitle: 'Vous contrôlez chaque information conservée et pouvez la supprimer.', fields, onSubmit(form) { const values = Modal.values(form, fields); if (Sophie.memory.add(values.text, values.kind)) { Toast.show('Information mémorisée.'); setTimeout(() => renderCurrent(), 220); } } });
      break;
    }
    case 'sophie-memory-delete': if (await Modal.confirm({ title: 'Oublier cette information', message: 'Supprimer définitivement ce souvenir de Sophie ?', confirmLabel: 'Oublier' })) { Sophie.memory.remove(id); Toast.show('Information oubliée.', 'info'); renderCurrent(); } break;
    case 'briefing-now': { const text = Sophie.briefing(); Modal.open({ title: 'Briefing du jour', eyebrow: 'SOPHIE', content: `<p class="sophie-report">${Utils.esc(text)}</p>`, size: 'normal' }); Voice.speak(text); break; }
    case 'daily-report': { const text = Sophie.dailyReport(); Modal.open({ title: 'Bilan de la journée', eyebrow: 'SOPHIE', content: `<p class="sophie-report">${Utils.esc(text)}</p>`, size: 'normal' }); Voice.speak(text); break; }
    case 'weekly-report': { const text = Sophie.weeklyReport(); Modal.open({ title: 'Bilan hebdomadaire', eyebrow: 'SOPHIE', content: `<p class="sophie-report">${Utils.esc(text)}</p>`, size: 'wide' }); Voice.speak(text); break; }
    case 'tts-test': {
      const endpoint = (Store.settings.elevenlabsEndpoint || '').trim();
      if (!endpoint) { Toast.show('Renseignez d’abord l’endpoint du proxy ElevenLabs ci-dessus.', 'info', 5200); break; }
      button.disabled = true;
      const probe = await fetch(`${endpoint.replace(/\/$/, '')}/status`).catch(() => null);
      const configured = probe?.ok ? (await probe.json().catch(() => ({}))).configured !== false : null;
      const spoken = await Voice.speak(`Bonjour, je suis ${Store.settings.assistantName || 'Sophie'}. Voici ma voix sur PERSONAL OS.`, { force: true });
      const status = TTS.status();
      if (status.active === 'elevenlabs') Toast.show(`Voix ElevenLabs active${configured === false ? ' (attention : la clé semble absente côté serveur)' : ''}.`);
      else Toast.show(status.lastError ? `Repli voix native : ${status.lastError}` : 'Voix native utilisée. Vérifiez l’endpoint et la clé côté serveur.', status.lastError ? 'info' : 'info', 6500);
      button.disabled = false;
      break;
    }
    case 'command-new': case 'command-edit': openCommandEditor(action === 'command-edit' ? Repo.get('customCommands', id) : null); break;
    case 'command-test': {
      const command = Repo.get('customCommands', id); if (!command) break;
      const text = Sophie.renderResponse(command.response);
      Modal.open({ title: 'Aperçu de la réponse', eyebrow: 'SOPHIE · COMMANDE', size: 'small', content: `<p class="sophie-report">« ${Utils.esc(text)} »</p><p class="settings-hint">Déclencheur testé : « ${Utils.esc((command.triggers || [])[0] || '')} »</p>` });
      if (command.voice !== false) Voice.speak(text, { force: true });
      break;
    }
    case 'command-delete': if (await Modal.confirm({ title: 'Supprimer la commande', message: 'Cette commande personnalisée sera définitivement supprimée.', confirmLabel: 'Supprimer' })) { Repo.remove('customCommands', id); Toast.show('Commande supprimée.', 'info'); renderCurrent(); } break;
    case 'voice-mode-info': Modal.open({ title: 'Fournisseurs vocaux', eyebrow: 'SOPHIE · VOIX', content: `<div class="voice-provider-info"><p><strong>ElevenLabs</strong> (voix Sophie · ID configuré côté serveur) est utilisé en priorité via un proxy sécurisé. La clé API reste exclusivement côté serveur.</p><p><strong>Voix native</strong> : Web Speech API ou synthèse Android. En cas de quota épuisé, clé invalide ou panne réseau, Sophie bascule automatiquement sans perdre le texte de sa réponse.</p><p>État actuel : ${Utils.esc(TTS.providers()[TTS.status().active])}${TTS.status().circuit ? ` · nouveau test ElevenLabs dans ${TTS.status().circuit} min` : ''}${TTS.status().lastError ? ` · ${Utils.esc(TTS.status().lastError)}` : ''}</p></div>`, size: 'normal' }); break;
    case 'scroll-widgets': $('#widget-deck')?.scrollIntoView({ behavior: Store.settings.animations ? 'smooth' : 'instant' }); break;
    case 'widget-size': cycleWidget(id); break;
    case 'widget-hide': updateWidget(id, { hidden: true }); Toast.show('Widget masqué. Réactivez-le dans les paramètres.', 'info'); break;
    case 'widgets-show-all': Store.settings.widgets.forEach(w => { w.hidden = false; }); Store.saveSettings(); renderCurrent(); break;
    case 'widgets-reset': Store.setSetting('widgets', defaultWidgetLayout()); renderCurrent(); Toast.show('Disposition restaurée.'); break;
    case 'widget-up': case 'widget-down': moveWidget(id, action === 'widget-up' ? -1 : 1); break;
    case 'goal-new': openGoalEditor(); break;
    case 'sport-goal-new': openGoalEditor(null, { category: 'Sport', unit: 'séances', target: 4 }); break;
    case 'goal-edit': openGoalEditor(Repo.get('goals', id)); break;
    case 'goal-detail': openGoalDetail(id); break;
    case 'goal-delete': removeEntity('goals', id, 'objectif'); break;
    case 'goal-filters-reset': ViewState.goalCategory = 'Toutes'; ViewState.goalStatus = 'Tous'; renderCurrent(); break;
    case 'goal-step-new': openStepEditor(id); break;
    case 'goal-step-toggle': toggleStep(id, button.dataset.step); break;
    case 'goal-step-delete': deleteStep(id, button.dataset.step); break;
    case 'goal-task-new': openTaskEditor(null, { goalId: id, projectId: '' }, { type: 'goal', id }); break;
    case 'goal-comment-new': openCommentEditor(id); break;
    case 'session-new': openSessionEditor(); break;
    case 'session-plan': openSessionEditor(null, true); break;
    case 'session-edit': openSessionEditor(Repo.get('sessions', id)); break;
    case 'session-delete': removeEntity('sessions', id, 'séance'); break;
    case 'project-view': ViewState.projectView = button.dataset.view; renderCurrent(); break;
    case 'project-new': openProjectEditor(); break;
    case 'project-new-status': openProjectEditor(null, { status: button.dataset.status }); break;
    case 'project-edit': openProjectEditor(Repo.get('projects', id)); break;
    case 'project-detail': openProjectDetail(id); break;
    case 'project-delete': deleteProject(id); break;
    case 'project-task-new': openTaskEditor(null, { projectId: id }, { type: 'project', id }); break;
    case 'project-note-new': openProjectNote(id); break;
    case 'project-note-delete': deleteProjectNote(id, button.dataset.note); break;
    case 'project-document-new': openProjectDocument(id); break;
    case 'project-document-delete': deleteProjectDocument(id, button.dataset.document); break;
    case 'task-new': openTaskEditor(); break;
    case 'task-edit': openTaskEditor(Repo.get('tasks', id), {}, button.dataset.goalDetail ? { type: 'goal', id: button.dataset.goalDetail } : button.dataset.projectDetail ? { type: 'project', id: button.dataset.projectDetail } : null); break;
    case 'task-toggle': toggleTask(id, button); break;
    case 'task-delete': removeEntity('tasks', id, 'tâche'); break;
    case 'transaction-new': openTransactionEditor(null, button.dataset.type || 'expense'); break;
    case 'transaction-edit': openTransactionEditor(Repo.get('transactions', id)); break;
    case 'transaction-delete': removeEntity('transactions', id, 'opération'); break;
    case 'budget-edit': openBudgetEditor(); break;
    case 'subscription-new': openSubscriptionEditor(); break;
    case 'subscription-edit': openSubscriptionEditor(Store.data.finance.subscriptions.find(s => s.id === id)); break;
    case 'subscription-toggle': { const sub = Store.data.finance.subscriptions.find(s => s.id === id); if (sub) Repo.updateFinanceItem('subscriptions', id, { active: !sub.active }); break; }
    case 'subscription-delete': deleteFinanceItem('subscriptions', id, 'abonnement'); break;
    case 'debt-new': openDebtEditor(); break;
    case 'debt-edit': openDebtEditor(Store.data.finance.debts.find(d => d.id === id)); break;
    case 'debt-payment': openDebtPayment(id); break;
    case 'debt-delete': deleteFinanceItem('debts', id, 'dette'); break;
    case 'calendar-prev': shiftCalendar(-1); break;
    case 'calendar-next': shiftCalendar(1); break;
    case 'calendar-today': ViewState.calendarCursor = new Date(); renderCurrent(); break;
    case 'calendar-view': ViewState.calendarView = button.dataset.view; renderCurrent(); break;
    case 'calendar-day': ViewState.calendarCursor = new Date(`${button.dataset.date}T12:00:00`); ViewState.calendarView = 'day'; renderCurrent(); break;
    case 'event-new': openEventEditor(null, { date: button.dataset.date || Utils.iso(), start: button.dataset.time || '09:00', end: addHour(button.dataset.time || '09:00') }); break;
    case 'event-edit': openEventEditor(Repo.get('events', id)); break;
    case 'event-delete': removeEntity('events', id, 'événement'); break;
    case 'device-new': openDeviceEditor(); break;
    case 'device-edit': openDeviceEditor(Repo.get('devices', id)); break;
    case 'device-delete': removeEntity('devices', id, 'appareil'); break;
    case 'device-check': Repo.update('devices', id, { lastCheck: Utils.localDateTime() }); Toast.show('Horodatage de vérification manuelle enregistré.'); break;
    case 'device-probe': button.classList.add('loading'); await probeDevice(); button.classList.remove('loading'); Toast.show('API du navigateur relues. Les valeurs non autorisées restent indisponibles.', 'info'); break;
    case 'notification-new': openNotificationEditor(); break;
    case 'notification-open': ViewState.notificationTab = 'all'; navigate('notifications'); setTimeout(() => { const n = Repo.get('notifications', id); if (n && !n.read) Notify.markRead(id); }, 150); break;
    case 'notification-read': { const n = Repo.get('notifications', id); if (n) Notify.markRead(id, !n.read); break; }
    case 'notification-delete': removeEntity('notifications', id, 'notification'); break;
    case 'notifications-read-all': Notify.markRead('all'); Toast.show('Toutes les notifications sont marquées comme lues.'); break;
    case 'notifications-clear-read': if (await Modal.confirm({ title: 'Supprimer les notifications lues', message: 'Supprimer toutes les notifications déjà lues de cet espace ?', confirmLabel: 'Supprimer les lues' })) { Notify.clearRead(); Toast.show('Notifications lues supprimées.', 'info'); } break;
    case 'notification-tab': ViewState.notificationTab = button.dataset.tab; renderCurrent(); break;
    case 'automation-scan': Automation.scan(); renderCurrent(); Toast.show('Contrôle des règles terminé. Les clés anti-doublon ont été respectées.'); break;
    case 'settings-voice': ViewState.settingsTab = 'voice'; navigate('settings'); break;
    case 'voice-toggle': Voice.toggle(); break;
    case 'voice-cancel': Voice.cancel(); break;
    case 'voice-test': Voice.speak('Bonjour, voici ton programme. Personal Voice utilise une voix française disponible sur cet appareil.', { force: true }); Toast.show('Annonce envoyée à SpeechSynthesis.'); break;
    case 'voice-enabled-toggle': Store.setSetting('voiceEnabled', !Store.settings.voiceEnabled); if (!Store.settings.voiceEnabled) globalThis.speechSynthesis?.cancel(); renderCurrent(); break;
    case 'voice-command': Voice.execute(button.dataset.command, 'text'); break;
    case 'voice-history-clear': if (await Modal.confirm({ title: 'Effacer l’historique', message: 'Effacer tous les échanges de Personal Voice dans cet espace ?', confirmLabel: 'Effacer' })) { Store.commit(data => { data.assistant = []; }); Toast.show('Historique effacé.', 'info'); } break;
    case 'journal-new': openJournalEditor(); break;
    case 'journal-edit': openJournalEditor(Repo.get('journal', id)); break;
    case 'journal-delete': removeEntity('journal', id, 'entrée'); break;
    case 'settings-tab': ViewState.settingsTab = button.dataset.tab; renderCurrent(); break;
    case 'accent-preset': Store.settings.accent = button.dataset.accent; Store.settings.accent2 = button.dataset.accent2; Store.saveSettings(); applySettings(); renderCurrent(); break;
    case 'browser-notification-permission': requestBrowserNotifications(); break;
    case 'reset-demo': resetDemo(); break;
    case 'clear-real': clearReal(); break;
    case 'data-export': exportData(); break;
    case 'data-import': $('#import-file').click(); break;
    case 'pwa-install': installPWA(); break;
    default: {
      // Les actions du menu Maison sont gérées par leur module, chargé à la demande.
      const maison = await import('./js/views-maison.js').then(m => m.MaisonActions).catch(() => null);
      if (maison && typeof maison[action] === 'function') { await maison[action](button); break; }
      console.warn('Action non enregistrée :', action);
    }
  }
}

/* ---------- Sous-actions détaillées ---------- */
/* Recherche universelle transversale, aussi pilotée par Sophie. */
function openSearch(query = '') {
  const runSearch = value => {
    const results = Sophie.search(value);
    return results.length ? `<div class="search-results">${results.map(result => `<button data-action="search-goto" data-section-target="${result.section}"><span class="search-module">${Utils.esc(result.module)}</span><strong>${Utils.esc(result.title)}</strong><small>${Utils.esc((result.detail || '').slice(0, 110))}</small></button>`).join('')}</div>`
      : `<div class="search-empty"><p>${value ? `Aucun résultat pour « ${Utils.esc(value)} ».` : 'Tapez au moins deux caractères : projets, tâches, notes, finances, sport, appareils et mémoire de Sophie sont interrogés.'}</p></div>`;
  };
  Modal.open({ title: 'Recherche universelle', eyebrow: 'SOPHIE · INDEX LOCAL', subtitle: 'Projets, tâches, notes, calendrier, finances, sport, appareils et mémoire.', size: 'wide',
    content: `<div class="search-box">${icon('search', 18)}<input id="global-search-input" value="${Utils.esc(query)}" placeholder="Ex. PitLane, budget, gainage…" autocomplete="off"></div><div id="global-search-results">${runSearch(query)}</div>`,
  });
  const input = document.getElementById('global-search-input');
  input?.addEventListener('input', () => { document.getElementById('global-search-results').innerHTML = runSearch(input.value); });
  setTimeout(() => input?.focus(), 120);
}

function toggleFocusMode(force = null) {
  const enable = force === null ? !Store.settings.focusMode : Boolean(force);
  Store.setSetting('focusMode', enable);
  document.body.classList.toggle('focus-mode', enable);
  renderCurrent({ preserveScroll: false });
  Toast.show(enable ? 'Mode concentration activé.' : 'Mode concentration désactivé.', 'info');
}

function openQuickAdd() {
  const items = [['goal-new', 'target', 'Objectif', 'Cible et étapes'], ['task-new', 'check', 'Tâche', 'Action datée'], ['session-new', 'activity', 'Séance sport', 'Performance et ressenti'], ['transaction-new', 'wallet', 'Dépense', 'Opération manuelle'], ['event-new', 'calendar', 'Événement', 'Rendez-vous et rappel'], ['journal-new', 'book', 'Journal', 'Note ou réussite']];
  Modal.open({ title: 'Nouvelle entrée', subtitle: 'Choisissez le module à alimenter.', size: 'normal', content: `<div class="quick-add-grid">${items.map(([action, iconName, title, sub]) => `<button data-action="${action}"><span>${icon(iconName, 22)}</span><strong>${title}</strong><small>${sub}</small>${icon('arrow', 15)}</button>`).join('')}</div>` });
}
function openStepEditor(goalId) {
  const fields = [{ name: 'title', label: 'Nom de l’étape', required: true, full: true, maxlength: 180 }];
  Modal.form({ title: 'Nouvelle étape intermédiaire', fields, onSubmit(form) { const goal = Repo.get('goals', goalId); const values = formValues(form, fields); Repo.update('goals', goalId, { steps: [...(goal.steps || []), { id: Utils.uid('step'), title: values.title, done: false }] }); Toast.show('Étape ajoutée.'); setTimeout(() => openGoalDetail(goalId), 220); } });
}
function toggleStep(goalId, stepId) { const goal = Repo.get('goals', goalId); if (!goal) return; Repo.update('goals', goalId, { steps: goal.steps.map(step => step.id === stepId ? { ...step, done: !step.done } : step) }); openGoalDetail(goalId); }
async function deleteStep(goalId, stepId) {
  const goal = Repo.get('goals', goalId); if (!goal) return;
  const step = goal.steps.find(item => item.id === stepId);
  const confirmed = await Modal.confirm({ title: 'Supprimer l’étape', message: `Supprimer l’étape « ${step?.title || 'sans titre'} » de cet objectif ?` });
  if (confirmed) { Repo.update('goals', goalId, { steps: goal.steps.filter(item => item.id !== stepId) }); Toast.show('Étape supprimée.', 'info'); }
  setTimeout(() => openGoalDetail(goalId), 200);
}
function openCommentEditor(goalId) {
  const fields = [{ name: 'text', label: 'Commentaire', type: 'textarea', required: true, full: true, rows: 5, maxlength: 1500 }];
  Modal.form({ title: 'Ajouter un commentaire', fields, onSubmit(form) { const goal = Repo.get('goals', goalId); const values = formValues(form, fields); Repo.update('goals', goalId, { comments: [...(goal.comments || []), { id: Utils.uid('comment'), text: values.text, date: new Date().toISOString() }] }); setTimeout(() => openGoalDetail(goalId), 220); } });
}
async function deleteProject(id) {
  const project = Repo.get('projects', id); if (!project) return;
  const count = Repo.list('tasks').filter(t => t.projectId === id).length;
  if (!await Modal.confirm({ title: 'Supprimer le projet', message: `Supprimer « ${project.name} » ? ${count ? `Ses ${count} tâches seront conservées dans la boîte d’arrivée.` : 'Aucune tâche n’est associée.'}` })) return;
  Store.commit(data => { data.tasks.forEach(task => { if (task.projectId === id) task.projectId = ''; }); data.events.forEach(event => { if (event.projectId === id) event.projectId = ''; }); }); Repo.remove('projects', id); Toast.show('Projet supprimé. Les tâches ont été conservées.', 'info');
}
function openProjectNote(projectId) {
  const fields = [{ name: 'text', label: 'Note de projet', type: 'textarea', required: true, full: true, rows: 6, maxlength: 3000 }];
  Modal.form({ title: 'Nouvelle note de projet', fields, onSubmit(form) { const project = Repo.get('projects', projectId); const values = formValues(form, fields); Repo.update('projects', projectId, { notes: [...(project.notes || []), { id: Utils.uid('note'), text: values.text, date: new Date().toISOString() }] }); setTimeout(() => openProjectDetail(projectId), 220); } });
}
async function deleteProjectNote(projectId, noteId) {
  const project = Repo.get('projects', projectId); if (!project) return;
  if (await Modal.confirm({ title: 'Supprimer la note', message: 'Supprimer définitivement cette note de projet ?' })) { Repo.update('projects', projectId, { notes: project.notes.filter(note => note.id !== noteId) }); Toast.show('Note supprimée.', 'info'); }
  setTimeout(() => openProjectDetail(projectId), 200);
}
function openProjectDocument(projectId) {
  const fields = [{ name: 'name', label: 'Nom du document ou lien', required: true, full: true }, { name: 'url', label: 'URL http(s) (facultative)', type: 'url', full: true, placeholder: 'https://…', hint: 'Sans URL, l’entrée sert de référence locale. Aucun fichier n’est téléversé.' }];
  Modal.form({ title: 'Ajouter un document', fields, onSubmit(form) { const project = Repo.get('projects', projectId); const values = formValues(form, fields); if (values.url && !Utils.safeUrl(values.url)) throw new Error('Utilisez une URL commençant par http:// ou https://.'); Repo.update('projects', projectId, { documents: [...(project.documents || []), { id: Utils.uid('doc'), name: values.name, url: values.url, date: new Date().toISOString() }] }); setTimeout(() => openProjectDetail(projectId), 220); } });
}
async function deleteProjectDocument(projectId, docId) {
  const project = Repo.get('projects', projectId); if (!project) return;
  if (await Modal.confirm({ title: 'Supprimer le document', message: 'Supprimer cette référence ou ce lien du projet ? Le document externe lui-même ne sera pas modifié.' })) { Repo.update('projects', projectId, { documents: project.documents.filter(doc => doc.id !== docId) }); Toast.show('Document retiré du projet.', 'info'); }
  setTimeout(() => openProjectDetail(projectId), 200);
}
function toggleTask(id, button) { const task = Repo.get('tasks', id); if (!task) return; const done = task.status === 'done'; Repo.update('tasks', id, { status: done ? 'todo' : 'done' }); Toast.show(done ? 'Tâche rouverte.' : 'Tâche terminée.'); if (button.dataset.goalDetail) setTimeout(() => openGoalDetail(button.dataset.goalDetail), 100); if (button.dataset.projectDetail) setTimeout(() => openProjectDetail(button.dataset.projectDetail), 100); }
async function deleteFinanceItem(kind, id, label) { const item = Store.data.finance[kind].find(entry => entry.id === id); if (!item) return; if (await Modal.confirm({ title: `Supprimer ${label}`, message: `Supprimer définitivement « ${item.name} » ?` })) { Repo.removeFinanceItem(kind, id); Toast.show('Élément supprimé.', 'info'); } }
function openDebtPayment(id) {
  const debt = Store.data.finance.debts.find(d => d.id === id); if (!debt) return;
  const remaining = Math.max(0, debt.amount - debt.paid); const fields = [{ name: 'amount', label: 'Versement (€)', type: 'number', min: 0.01, max: remaining, step: '0.01', required: true, hint: `Reste dû : ${Utils.money(remaining)}` }];
  Modal.form({ title: `Versement · ${debt.name}`, fields, values: { amount: remaining }, onSubmit(form) { const { amount } = formValues(form, fields); if (amount > remaining) throw new Error('Le versement dépasse le reste dû.'); Repo.updateFinanceItem('debts', id, { paid: Utils.round(debt.paid + amount, 2) }); Toast.show('Remboursement enregistré.'); } });
}
function addHour(time) { const [h, m] = time.split(':').map(Number); if (h === 23) return '23:59'; return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
function shiftCalendar(direction) { const date = ViewState.calendarCursor; if (ViewState.calendarView === 'month') { date.setDate(1); date.setMonth(date.getMonth() + direction); } else if (ViewState.calendarView === 'week') date.setDate(date.getDate() + direction * 7); else date.setDate(date.getDate() + direction); renderCurrent(); }
function defaultWidgetLayout() { return [
  ['goals', 'medium'], ['sport', 'medium'], ['projects', 'medium'], ['finance', 'medium'],
  ['weather', 'medium'], ['news', 'medium'], ['calendar', 'large'], ['focus', 'medium'],
  ['reminders', 'medium'], ['habits', 'medium'], ['spotify', 'large'], ['devices', 'medium'],
  ['notifications', 'medium'], ['journal', 'large']
].map(([id, size]) => ({ id, hidden: false, size })); }
function updateWidget(id, patch) { const widget = Store.settings.widgets.find(w => w.id === id); if (!widget) return; Object.assign(widget, patch); Store.saveSettings(); renderCurrent(); }
function cycleWidget(id) { const widget = Store.settings.widgets.find(w => w.id === id); if (!widget) return; const sizes = ['small', 'medium', 'large']; updateWidget(id, { size: sizes[(sizes.indexOf(widget.size) + 1) % sizes.length] }); }
function moveWidget(id, direction) { const list = Store.settings.widgets; const index = list.findIndex(w => w.id === id); const target = index + direction; if (index < 0 || target < 0 || target >= list.length) return; [list[index], list[target]] = [list[target], list[index]]; Store.saveSettings(); renderCurrent(); }

/* ---------- Navigateur, PWA et données ---------- */
async function toggleFullscreen() {
  try { if (!document.fullscreenElement) { if (!document.documentElement.requestFullscreen) throw new Error('Plein écran non proposé par ce navigateur. Sur Android, utilisez « Ajouter à l’écran d’accueil ».'); await document.documentElement.requestFullscreen(); } else await document.exitFullscreen(); }
  catch (error) { Toast.show(error.message, 'error', 5000); }
}
/* Affichage permanent (mode veille / tablette murale) via Screen Wake Lock API. */
let wakeSentinel = null;
async function requestWakeLock() {
  if (!Store.settings.wakeLock) { try { await wakeSentinel?.release(); } catch { /* déjà libéré */ } wakeSentinel = null; return; }
  if (!('wakeLock' in navigator)) { Toast.show('Verrouillage d’écran indisponible sur ce navigateur. Utilisez le plein écran ou les réglages système.', 'info', 5200); return; }
  try {
    wakeSentinel = await navigator.wakeLock.request('screen');
    wakeSentinel.addEventListener('release', () => { wakeSentinel = null; });
    Toast.show('Affichage permanent activé.');
  } catch (error) { Toast.show(`Affichage permanent refusé : ${error.message}`, 'error', 5200); }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Store.settings.wakeLock && !wakeSentinel) requestWakeLock();
});

function toggleMenu() { const open = document.body.classList.toggle('menu-open'); $('#sidebar-scrim').hidden = !open; $('[data-action="menu-toggle"]')?.setAttribute('aria-expanded', String(open)); }
function closeMenu() { document.body.classList.remove('menu-open'); $('#sidebar-scrim').hidden = true; $('[data-action="menu-toggle"]')?.setAttribute('aria-expanded', 'false'); }
async function probeDevice() {
  const network = $('#probe-network'); if (network) network.textContent = navigator.onLine ? 'Navigateur en ligne (indicateur)' : 'Navigateur hors ligne';
  const batteryNode = $('#probe-battery'); if (batteryNode) batteryNode.textContent = 'Lecture…';
  if (batteryNode) {
    if (navigator.getBattery) {
      try { const battery = await navigator.getBattery(); if ($('#probe-battery')) $('#probe-battery').textContent = `${Math.round(battery.level * 100)} %${battery.charging ? ' · en charge' : ''}`; }
      catch { batteryNode.textContent = 'Accès refusé / indisponible'; }
    } else batteryNode.textContent = 'API Battery non disponible';
  }
  const storage = $('#probe-storage');
  if (storage) {
    if (navigator.storage?.estimate) {
      try { const estimate = await navigator.storage.estimate(); storage.textContent = estimate.usage !== undefined ? `${formatBytes(estimate.usage)} utilisés par ce site${estimate.quota ? ` / quota ${formatBytes(estimate.quota)}` : ''}` : 'Estimation indisponible'; }
      catch { storage.textContent = 'Estimation refusée'; }
    } else storage.textContent = 'API Storage non disponible';
  }
}
function formatBytes(bytes) { if (!Number.isFinite(bytes)) return 'N/D'; const units = ['o', 'Ko', 'Mo', 'Go']; const index = Math.min(units.length - 1, Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024))); return `${Utils.round(bytes / 1024 ** index, 1)} ${units[index]}`; }
async function requestBrowserNotifications() {
  if (!('Notification' in window)) return Toast.show('API Notification indisponible dans ce navigateur.', 'error');
  try { const permission = await Notification.requestPermission(); Store.setSetting('browserNotifications', permission === 'granted'); const node = $('#notification-permission-state'); if (node) node.textContent = `État actuel : ${permission}`; Toast.show(permission === 'granted' ? 'Notifications système autorisées pour les nouveaux signaux.' : 'Autorisation non accordée. Les notifications internes restent fonctionnelles.', permission === 'granted' ? 'success' : 'info'); }
  catch (error) { Toast.show(error.message, 'error'); }
}
async function resetDemo() {
  if (!await Modal.confirm({ title: 'Réinitialiser la démonstration', message: 'Restaurer le jeu fictif initial ? Vos modifications dans la démo seront perdues. Vos données réelles ne seront pas touchées.' })) return;
  Store.resetDemo(); applySettings(); navigate(App.section); Toast.show('Données fictives de démonstration restaurées.', 'info');
}
async function clearReal() {
  if (!await Modal.confirm({ title: 'Effacer les données réelles', message: 'Effacer définitivement TOUTES les données réelles de ce navigateur ? Exportez une sauvegarde avant de continuer. La démonstration restera intacte.', confirmLabel: 'Tout effacer' })) return;
  Store.clearReal(); navigate(App.section); Toast.show('Espace de données réelles réinitialisé.', 'info');
}
function exportData() {
  try { Utils.download(`personal-os-sauvegarde-${Utils.iso()}.json`, Store.exportAll()); Toast.show('Sauvegarde JSON générée. Choisissez son emplacement de conservation.'); }
  catch (error) { Toast.show(`Export impossible : ${error.message}`, 'error'); }
}
async function importData(file) {
  if (!file) return; if (file.size > 15 * 1024 * 1024) return Toast.show('Fichier trop volumineux (15 Mo maximum).', 'error');
  try {
    const payload = JSON.parse(await file.text());
    if (!await Modal.confirm({ title: 'Restaurer la sauvegarde', message: 'Cette importation remplacera les deux espaces et les réglages actuels par ceux du fichier. Continuer ?', confirmLabel: 'Importer et remplacer', danger: false })) return;
    Store.importAll(payload); applySettings(); navigate('dashboard'); Toast.show('Sauvegarde restaurée avec succès.');
  } catch (error) { Toast.show(`Import impossible : ${error.message}`, 'error', 6500); }
  finally { $('#import-file').value = ''; }
}
async function installPWA() {
  if (App.deferredInstall) {
    try { App.deferredInstall.prompt(); const choice = await App.deferredInstall.userChoice; Toast.show(choice.outcome === 'accepted' ? 'Installation acceptée par le navigateur.' : 'Installation annulée.', 'info'); App.deferredInstall = null; } catch (error) { Toast.show(error.message, 'error'); }
  } else if (matchMedia('(display-mode: standalone)').matches) Toast.show('PERSONAL OS est déjà ouvert en mode application.', 'info');
  else Toast.show('Si le navigateur ne propose pas d’installation automatique : menu ⋮ → Installer l’application / Ajouter à l’écran d’accueil.', 'info', 7500);
}

/* ---------- Paramètres et filtres ---------- */
function handleChange(input) {
  if (input.dataset.newsSetting) { const config = News.config(); config[input.dataset.newsSetting] = input.type === 'checkbox' ? input.checked : input.value; Store.saveSettings(); Toast.show('Préférence du briefing enregistrée.'); return; }
  if (input.dataset.newsFeed) { const config = News.config(); const feed = config.feeds.find(item => item.id === input.dataset.newsFeed); if (feed) { feed.enabled = input.checked; Store.saveSettings(); } return; }
  if (input.dataset.reminderToggle) {
    const reminder = Repo.get('reminders', input.dataset.reminderToggle);
    if (reminder) { Repo.update('reminders', reminder.id, { enabled: input.checked, snoozeUntil: null }); Toast.show(input.checked ? 'Rappel activé.' : 'Rappel désactivé.', 'info'); }
    return;
  }
  if (input.dataset.focusDuration) { Focus.setDuration(input.dataset.focusDuration); renderCurrent(); Toast.show('Durée du prochain cycle enregistrée.'); return; }
  if (input.dataset.viewFilter) {
    const map = { 'goal-category': ['goalCategory', input.value], 'goal-status': ['goalStatus', input.value], 'sport-type': ['sportType', input.value], 'sport-metric': ['sportMetric', input.value], 'project-status': ['projectStatus', input.value], 'finance-month': ['financeMonth', input.value], 'notification-type': ['notificationType', input.value], 'journal-type': ['journalType', input.value] };
    const setting = map[input.dataset.viewFilter]; if (setting) { ViewState[setting[0]] = setting[1]; renderCurrent(); } return;
  }
  if (input.dataset.setting?.includes('.')) {
    const [group, prop] = input.dataset.setting.split('.');
    const current = { ...(Store.settings[group] || {}) }; current[prop] = input.type === 'checkbox' ? input.checked : input.value;
    Store.setSetting(group, current); Toast.show('Préférence enregistrée.'); return;
  }
  if (input.dataset.setting === 'wakeLock') { Store.setSetting('wakeLock', input.checked); requestWakeLock(); return; }
  if (input.dataset.setting) {
    const key = input.dataset.setting; let value = input.type === 'checkbox' ? input.checked : input.value;
    if (['voiceRate', 'voicePitch'].includes(key)) value = Number(value);
    Store.setSetting(key, value); applySettings();
    if (key === 'wakeWordEnabled') {
      if (value) Voice.startWakeLoop(); else Voice.stopWakeLoop();
      Toast.show(value ? 'Sophie est en veille. Dites son prénom pour l’activer.' : 'Activation vocale désactivée.', 'info');
    }
    if (['density', 'reducedGlow', 'animations'].includes(key)) renderCurrent(); else updateSettingOutputs(); return;
  }
  if (input.dataset.weatherSetting) { Store.settings.weather[input.dataset.weatherSetting] = input.value.trim(); Store.saveSettings(); return; }
  if (input.dataset.ruleToggle) { Store.commit(data => { const rule = data.rules.find(r => r.id === input.dataset.ruleToggle); if (rule) rule.enabled = input.checked; }); Toast.show(`Règle ${input.checked ? 'activée' : 'désactivée'}.`, 'info'); return; }
  if (input.dataset.widgetSize) { updateWidget(input.dataset.widgetSize, { size: input.value }); return; }
  if (input.dataset.widgetVisible) { updateWidget(input.dataset.widgetVisible, { hidden: !input.checked }); }
}
function updateSettingOutputs() { if ($('#voice-rate-output')) $('#voice-rate-output').textContent = `${Store.settings.voiceRate}×`; if ($('#voice-pitch-output')) $('#voice-pitch-output').textContent = Store.settings.voicePitch; document.querySelectorAll('.color-setting').forEach(group => { const input = group.querySelector('input'), code = group.querySelector('code'); if (input && code) code.textContent = input.value; }); }

/* ---------- Glisser-déposer et scène de scroll ---------- */
function handleDragStart(event) {
  const widget = event.target.closest('[data-widget-drag]');
  if (widget) { App.draggedWidget = widget.dataset.widgetDrag; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', `widget:${App.draggedWidget}`); widget.closest('.widget')?.classList.add('dragging'); return; }
  const project = event.target.closest('[data-project-drag]');
  if (project) { App.draggedProject = project.dataset.projectDrag; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', `project:${App.draggedProject}`); project.classList.add('dragging'); }
}
function handleDragOver(event) { if (event.target.closest('[data-widget], .kanban-dropzone')) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; event.target.closest('.kanban-dropzone')?.classList.add('drag-over'); } }
function handleDrop(event) {
  const zone = event.target.closest('.kanban-dropzone');
  if (zone && App.draggedProject) { event.preventDefault(); const project = Repo.get('projects', App.draggedProject); const status = zone.dataset.status; if (project && project.status !== status) { Repo.update('projects', project.id, { status }); Toast.show(`Projet déplacé vers « ${status} ».`); } App.draggedProject = null; return; }
  const target = event.target.closest('[data-widget]');
  if (target && App.draggedWidget) {
    event.preventDefault(); const list = Store.settings.widgets; const from = list.findIndex(w => w.id === App.draggedWidget), to = list.findIndex(w => w.id === target.dataset.widget);
    if (from >= 0 && to >= 0 && from !== to) { const [moved] = list.splice(from, 1); list.splice(to, 0, moved); Store.saveSettings(); renderCurrent(); Toast.show('Disposition du cockpit enregistrée.'); } App.draggedWidget = null;
  }
}
function handleDragEnd() { document.querySelectorAll('.dragging, .drag-over').forEach(node => node.classList.remove('dragging', 'drag-over')); App.draggedProject = null; App.draggedWidget = null; }
function updateHeroMotion() {
  if (App.motionFrame) return;
  App.motionFrame = requestAnimationFrame(() => {
    App.motionFrame = null; const hero = $('#command-hero'); if (!hero) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || !Store.settings.animations;
    const rect = hero.getBoundingClientRect(); const progress = reduce ? 0 : Utils.clamp(-rect.top / Math.max(1, rect.height * .82), 0, 1);
    hero.style.setProperty('--hero-opacity', String(1 - progress * .8)); hero.style.setProperty('--hero-shift', `${progress * -90}px`); hero.style.setProperty('--hero-scale', String(1 - progress * .09)); hero.style.setProperty('--radar-scale', String(1 + progress * .7)); hero.style.setProperty('--grid-shift', `${progress * 130}px`);
    const copy = hero.querySelector('.hero-copy'); if (copy) { copy.style.transform = `translate3d(0,${progress * -75}px,0) scale(${1 - progress * .07})`; copy.style.opacity = String(1 - progress * 1.15); }
    const today = hero.querySelector('.hero-today'); if (today) { today.style.transform = `translate3d(0,${progress * 90}px,0)`; today.style.opacity = String(1 - progress * .8); }
    const metrics = hero.querySelector('.hero-metrics'); if (metrics) { metrics.style.transform = `translate3d(0,${progress * 130}px,0)`; metrics.style.opacity = String(1 - progress); }
    hero.querySelectorAll('[data-converge]').forEach(signal => {
      if (reduce || innerWidth < 900) { signal.style.transform = ''; return; }
      const targetX = hero.clientWidth * .53 - (signal.offsetLeft + signal.offsetWidth / 2); const targetY = hero.clientHeight * .48 - (signal.offsetTop + signal.offsetHeight / 2);
      const eased = progress * progress * (3 - 2 * progress); signal.style.transform = `translate3d(${targetX * eased}px,${targetY * eased}px,0) rotate(${(signal.dataset.converge === 'left' ? -8 : 8) * eased}deg) scale(${1 - eased * .55})`; signal.style.opacity = String(1 - eased * .9);
    });
  });
}

/* ---------- Initialisation ---------- */
function bindEvents() {
  document.addEventListener('click', event => {
    const groupButton = event.target.closest('[data-group]');
    if (groupButton) { event.preventDefault(); groupButton.closest('.nav-group')?.classList.toggle('collapsed'); return; }
    const sectionButton = event.target.closest('[data-section]');
    if (sectionButton) { event.preventDefault(); navigate(sectionButton.dataset.section); return; }
    const actionButton = event.target.closest('[data-action]');
    if (actionButton && !actionButton.disabled) { event.preventDefault(); handleAction(actionButton, event).catch(error => { console.error(error); Toast.show(error.message || 'Action impossible.', 'error'); }); }
  });
  document.addEventListener('change', event => handleChange(event.target));
  document.addEventListener('input', event => {
    const input = event.target;
    if (input.matches('input[type="range"][data-setting], input[type="color"][data-setting]')) handleChange(input);
  });
  document.addEventListener('submit', event => {
    const form = event.target;
    if (form.dataset.form === 'quick-journal') { event.preventDefault(); const title = new FormData(form).get('title').trim(); if (title) { openJournalEditor(null, title); form.reset(); } }
    if (form.dataset.form === 'voice-command') { event.preventDefault(); const command = new FormData(form).get('command').trim(); if (command) { Voice.execute(command, 'text'); form.reset(); } }
  });
  document.addEventListener('dragstart', handleDragStart); document.addEventListener('dragover', handleDragOver); document.addEventListener('drop', handleDrop); document.addEventListener('dragend', handleDragEnd);
  document.addEventListener('dragleave', event => event.target.closest('.kanban-dropzone')?.classList.remove('drag-over'));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
    if (event.key === 'Escape' && Store.settings.focusMode && !document.getElementById('app-modal').open) toggleFocusMode(false); });
  window.addEventListener('scroll', updateHeroMotion, { passive: true }); window.addEventListener('resize', updateHeroMotion, { passive: true });
  window.addEventListener('online', () => { updateConnection(); renderWeatherSummary(); }); window.addEventListener('offline', updateConnection);
  window.addEventListener('hashchange', () => { const section = location.hash.slice(1); if (Sections.includes(section) && section !== App.section) navigate(section, { push: false }); });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); App.deferredInstall = event; $('#pwa-install-button')?.classList.add('available'); });
  window.addEventListener('appinstalled', () => { App.deferredInstall = null; Toast.show('PERSONAL OS est installé sur cet appareil.'); });
  $('#sidebar-scrim').addEventListener('click', closeMenu);
  $('#import-file').addEventListener('change', event => importData(event.target.files[0]));
  Bus.on('data:changed', meta => { updateChrome(); if (!meta.silent) scheduleRender(); });
  Bus.on('workspace:changed', () => { ViewState.financeMonth = Utils.monthKey(); ViewState.calendarCursor = new Date(); });
  Bus.on('settings:changed', applySettings);
  Bus.on('weather:changed', () => { renderWeatherSummary(); if (App.section === 'dashboard') scheduleRender(); });
  Bus.on('news:changed', () => { if (App.section === 'dashboard' || App.section.startsWith('maison')) scheduleRender(); });
  window.addEventListener('maison:refresh', () => renderCurrent());
  Bus.on('alarm:triggered', ({ alarm }) => openTriggeredAlarm(alarm));
  Bus.on('reminder:triggered', ({ reminder }) => {
    if (['Haute', 'Critique'].includes(reminder?.priority)) openTriggeredReminder(reminder);
    else Toast.show(`Rappel : ${reminder?.title}`, 'info', 6000);
  });
  Bus.on('app:error', ({ message }) => Toast.show(message, 'error'));
  Bus.on('storage:error', () => Toast.show('Le stockage local est saturé ou bloqué. Exportez vos données puis libérez de l’espace.', 'error', 8000));
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) { const status = $('#pwa-status'); if (status) status.textContent = 'Service worker non disponible : l’application fonctionne en ligne, sans cache PWA.'; return; }
  if (!location.protocol.startsWith('http')) return;
  try { await navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' }); }
  catch (error) { console.warn('PWA non enregistrée', error); const status = $('#pwa-status'); if (status) status.textContent = `Cache PWA non activé : ${error.message}. Les autres fonctions restent disponibles.`; }
}

function bootError(error, step) {
  console.error(`Échec de l'initialisation (${step})`, error);
  const box = document.querySelector('.boot-fallback > div');
  if (box) {
    box.innerHTML = `<strong>PERSONAL OS n’a pas pu démarrer</strong><p>Étape en échec : <b>${Utils.esc(step)}</b></p><div class="boot-diagnostic">${Utils.esc(error?.message || String(error))}</div><button class="button primary" onclick="location.reload()">Recharger l’application</button>`;
    document.body.classList.remove('app-ready', 'silent-boot');
  }
}

async function init() {
  try {
    await loadFeatureModules();
    Store.init(); applySettings(); Modal.init(); hydrateIcons(); bindEvents();
  } catch (error) { return bootError(error, 'socle local'); }
  try {
  Voice?.init?.({ navigate, refresh: () => renderCurrent(), openEditor(collection, id) { if (collection === 'tasks') openTaskEditor(Repo.get('tasks', id)); if (collection === 'sessions') openSessionEditor(Repo.get('sessions', id)); } });
  News?.init?.({ speak: (text, options) => Voice?.speak?.(text, options) });
  Camera?.init?.();
  // Démarrage direct : pas d'écran d'ouverture, la vue configurée est montée immédiatement.
  const requested = location.hash.slice(1);
  const startup = Store.settings.startupSection || 'last';
  const home = startup === 'last' && Sections.includes(Store.settings.lastSection) ? Store.settings.lastSection : 'maison';
  App.section = Sections.includes(requested) ? requested : (Sections.includes(home) ? home : 'maison');
  await navigate(App.section, { push: false }); tickClock(); setInterval(tickClock, 1000); updateConnection(); Focus?.init?.();
  if (Store.settings.wakeLock) requestWakeLock();
  Automation.init(); Reminders?.init?.(); registerServiceWorker();
  if (Store.settings.weather.lat && (!Store.settings.weather.updatedAt || Date.now() - new Date(Store.settings.weather.updatedAt) > 30 * 60000) && navigator.onLine) Weather.refresh().catch(error => console.info('Météo non actualisée :', error.message));
  if (News && navigator.onLine && (!News.config().updatedAt || Date.now() - new Date(News.config().updatedAt).getTime() > 30 * 60000)) News.refresh().catch(error => console.info('Actualités non actualisées :', error.message));
  document.body.classList.add('app-ready');
  } catch (error) { return bootError(error, 'chargement des modules et premier rendu'); }
}

init();
