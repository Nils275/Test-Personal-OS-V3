/* Vues : Dashboard, Objectifs, Sport & SPV et Projets. */
import { Store, Repo, Selectors, Utils, Taxonomy, Weather, Spotify } from './core.js';
import { icon, badge, progressBar, emptyState, sectionHeader, Charts } from './ui.js';
import { ViewState } from './view-state.js';
import { Focus } from './focus.js';
import { News } from './news.js';

const actionButton = (action, id, name = 'edit', label = 'Modifier') => `<button class="icon-button subtle" data-action="${action}" data-id="${Utils.esc(id || '')}" aria-label="${Utils.esc(label)}" title="${Utils.esc(label)}">${icon(name, 17)}</button>`;
const priorityTone = priority => ({ Critique: 'critique', Haute: 'haute', Basse: 'basse' }[priority] || 'normale');
const taskStatus = { todo: 'À faire', doing: 'En cours', done: 'Terminée' };

function widgetShell(config, title, iconName, content, footer = '') {
  return `<article class="widget widget-${config.size} reveal" data-widget="${config.id}" draggable="false">
    <header class="widget-header"><div class="widget-title"><span>${icon(iconName, 18)}</span><h3>${Utils.esc(title)}</h3></div><div class="widget-controls"><button class="drag-handle" data-widget-drag="${config.id}" draggable="true" aria-label="Déplacer le widget ${Utils.esc(title)}" title="Glisser pour réorganiser">${icon('grip', 17)}</button><button class="icon-button" data-action="widget-size" data-id="${config.id}" aria-label="Redimensionner ${Utils.esc(title)}" title="Changer la taille">${icon('expand', 15)}</button><button class="icon-button" data-action="widget-hide" data-id="${config.id}" aria-label="Masquer ${Utils.esc(title)}" title="Masquer">${icon('eyeoff', 15)}</button></div></header>
    <div class="widget-body">${content}</div>${footer ? `<footer class="widget-footer">${footer}</footer>` : ''}</article>`;
}

function goalsWidget() {
  const stats = Selectors.goals();
  const focus = [...stats.active].sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999')).slice(0, 2);
  return `<div class="widget-stat-grid"><div><strong>${stats.average}<small>%</small></strong><span>Progression globale</span></div><div><strong>${stats.active.length}</strong><span>Actifs</span></div><div><strong>${stats.done.length}</strong><span>Terminés</span></div><div class="${stats.late.length ? 'warn' : ''}"><strong>${stats.late.length}</strong><span>En retard</span></div></div>
  <div class="widget-focus-list">${focus.length ? focus.map(goal => `<button data-action="goal-detail" data-id="${goal.id}"><span><strong>${Utils.esc(goal.name)}</strong><small>${goal.deadline ? `Échéance ${Utils.formatDate(goal.deadline)}` : 'Sans échéance'}</small></span><b>${Math.round(Selectors.goalProgress(goal))}%</b><i style="--progress:${Selectors.goalProgress(goal)}%"></i></button>`).join('') : '<p class="muted compact">Aucun objectif actif.</p>'}</div>`;
}

function sportWidget() {
  const stats = Selectors.sport();
  return `<div class="sport-widget-main"><div class="radial-stat" style="--value:${Math.min(100, stats.week.length / 4 * 100)}"><div><strong>${stats.week.length}</strong><span>/ 4 séances</span></div></div><div class="sport-widget-copy"><span class="micro-label">CETTE SEMAINE</span><strong>${stats.week.reduce((s, x) => s + Number(x.duration || 0), 0)} min</strong><small>Objectif indicatif : 4 séances</small></div></div>
  <div class="split-details"><div><span>Dernière séance</span><strong>${stats.last ? Utils.esc(stats.last.type) : 'Aucune'}</strong><small>${stats.last ? Utils.relative(stats.last.date) : 'Enregistrez votre première séance'}</small></div><div><span>Prochaine séance</span><strong>${stats.next ? Utils.esc(stats.next.type) : 'Non planifiée'}</strong><small>${stats.next ? `${Utils.formatDate(stats.next.date)} · ${Utils.formatTime(stats.next.date)}` : 'Planifiez depuis Sport & SPV'}</small></div></div>`;
}

function projectsWidget() {
  const stats = Selectors.projects();
  return `<div class="widget-stat-grid three"><div><strong>${stats.active.length}</strong><span>Projets actifs</span></div><div><strong>${stats.doing.length}</strong><span>Tâches en cours</span></div><div class="${stats.late.length ? 'warn' : ''}"><strong>${stats.late.length}</strong><span>En retard</span></div></div><div class="project-mini-list">${stats.updated.slice(0, 3).map(project => `<button data-action="project-detail" data-id="${project.id}"><i style="background:${Utils.esc(project.color || 'var(--accent)')}"></i><span><strong>${Utils.esc(project.name)}</strong><small>${Utils.esc(project.status)} · ${Utils.relative(project.updatedAt)}</small></span><b>${project.progress}%</b></button>`).join('') || '<p class="muted compact">Aucun projet. Créez votre premier espace.</p>'}</div>`;
}

function financeWidget() {
  const stats = Selectors.finance();
  return `<div class="finance-hero-stat"><span>Solde mensuel · ${Utils.monthLabel(Utils.monthKey())}</span><strong class="${stats.balance < 0 ? 'negative' : ''}">${Utils.money(stats.balance)}</strong></div><div class="finance-split"><div><span>Revenus</span><strong>${Utils.money(stats.income)}</strong></div><div><span>Dépenses</span><strong>${Utils.money(stats.expense)}</strong></div></div>${progressBar(stats.budgetRatio, stats.budget ? `Budget restant : ${Utils.money(stats.remaining)}` : 'Budget mensuel non défini', stats.budgetRatio > 100 ? 'danger' : '')}`;
}

function calendarWidget() {
  const events = Selectors.upcomingEvents(4); const todayTasks = Repo.list('tasks').filter(t => t.status !== 'done' && t.due === Utils.iso());
  return `<div class="agenda-list">${events.length ? events.map(event => `<button data-action="event-edit" data-id="${event.id}" class="agenda-item category-${Utils.slug(event.category)}"><time><strong>${event.date === Utils.iso() ? Utils.esc(event.start) : Utils.formatDate(event.date).split(' ')[0]}</strong><small>${event.date === Utils.iso() ? 'AUJ.' : Utils.formatDate(event.date).split(' ')[1] || ''}</small></time><span><strong>${Utils.esc(event.title)}</strong><small>${Utils.esc(event.category)} · ${Utils.esc(event.start)}${event.end ? `–${Utils.esc(event.end)}` : ''}</small></span><i></i></button>`).join('') : '<p class="muted compact">Aucun rendez-vous à venir.</p>'}</div>${todayTasks.length ? `<div class="today-tasks"><span class="micro-label">TÂCHES DU JOUR · ${todayTasks.length}</span>${todayTasks.slice(0, 2).map(task => `<button data-action="task-edit" data-id="${task.id}">${icon('check', 14)}<span>${Utils.esc(task.title)}</span></button>`).join('')}</div>` : ''}`;
}

function devicesWidget() {
  const devices = Repo.list('devices');
  return `<div class="device-summary"><strong>${devices.length}</strong><span>appareils inventoriés</span><small>États déclarés manuellement</small></div><div class="device-mini-list">${devices.slice(0, 4).map(device => `<button data-action="device-edit" data-id="${device.id}"><span class="device-state ${Utils.slug(device.status)}"></span><span><strong>${Utils.esc(device.name)}</strong><small>${Utils.esc(device.category)} · ${Utils.esc(device.status)}</small></span><span class="unavailable">Sync N/D · contrôle ${device.lastCheck ? Utils.relative(device.lastCheck) : 'jamais'}</span></button>`).join('') || '<p class="muted compact">Aucun appareil inventorié.</p>'}</div>`;
}

function notificationsWidget() {
  const notifications = [...Repo.list('notifications')].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);
  return `<div class="notification-mini-list">${notifications.length ? notifications.map(notification => `<button data-action="notification-open" data-id="${notification.id}" class="${notification.read ? 'read' : ''}"><i class="priority-line ${priorityTone(notification.priority)}"></i><span><strong>${Utils.esc(notification.title)}</strong><small>${Utils.esc(notification.source)} · ${Utils.relative(notification.date)}</small></span>${badge(notification.type)}</button>`).join('') : '<p class="muted compact">Aucune notification.</p>'}</div>`;
}

function journalWidget() {
  const entries = [...Repo.list('journal')].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 2);
  return `<form class="quick-journal" data-form="quick-journal"><input name="title" required maxlength="100" placeholder="Une pensée, une réussite, une note…" aria-label="Titre de la note rapide"><button class="button primary small" type="submit" aria-label="Ajouter la note">${icon('plus', 16)} Ajouter</button></form><div class="journal-mini-list">${entries.map(entry => `<button data-action="journal-edit" data-id="${entry.id}"><span class="journal-type">${Utils.esc(entry.type)}</span><strong>${Utils.esc(entry.title)}</strong><small>${Utils.relative(entry.date)}</small></button>`).join('') || '<p class="muted compact">Votre journal est prêt pour une première entrée.</p>'}</div>`;
}

function weatherWidget() {
  const weather = Store.settings.weather; const current = weather.data;
  if (!weather.lat || !weather.lon) return `<div class="widget-empty-compact">${icon('cloud', 26)}<h4>Météo non configurée</h4><p>Choisissez une position pour obtenir un relevé Open-Meteo réel.</p><button class="button primary small" data-action="weather-open">Configurer la position</button></div>`;
  if (!current) return `<div class="widget-empty-compact">${icon('cloud', 26)}<h4>${Utils.esc(weather.label || 'Position enregistrée')}</h4><p>Aucun relevé disponible. Une connexion est nécessaire pour l’actualisation.</p><button class="button primary small" data-action="weather-widget-refresh">Charger la météo</button></div>`;
  const daily = weather.daily?.time || [];
  return `<div class="weather-current"><div><span class="weather-big-icon">${icon([0, 1].includes(current.weather_code) ? 'sun' : 'cloud', 34)}</span><span><strong>${Math.round(current.temperature_2m)}°</strong><small>${Utils.esc(Weather.codes[current.weather_code] || `Code météo ${current.weather_code}`)}</small></span></div><div class="weather-place"><strong>${Utils.esc(weather.label || 'Position configurée')}</strong><span>Relevé ${weather.updatedAt ? Utils.relative(weather.updatedAt) : 'local'}</span><button data-action="weather-widget-refresh" aria-label="Actualiser la météo">${icon('refresh', 14)} Actualiser</button></div></div>
  <div class="weather-details"><span>Ressenti <strong>${current.apparent_temperature ?? 'N/D'}°</strong></span><span>Vent <strong>${current.wind_speed_10m ?? 'N/D'} km/h</strong></span><span>Humidité <strong>${current.relative_humidity_2m ?? 'N/D'} %</strong></span></div>
  ${daily.length ? `<div class="weather-forecast">${daily.slice(0, 4).map((date, index) => `<div><span>${index === 0 ? 'Auj.' : new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)).replace('.', '')}</span>${icon([0, 1].includes(weather.daily.weather_code[index]) ? 'sun' : 'cloud', 17)}<strong>${Math.round(weather.daily.temperature_2m_max[index])}°</strong><small>${Math.round(weather.daily.temperature_2m_min[index])}°</small><i title="Probabilité de précipitation">${weather.daily.precipitation_probability_max?.[index] ?? '—'}%</i></div>`).join('')}</div>` : '<p class="muted compact">Prévisions non disponibles dans ce relevé. Actualisez pour les récupérer.</p>'}`;
}

function spotifyWidget() {
  const source = Spotify.parse(Store.settings.spotifyUrl);
  if (!Store.settings.spotifyUrl) return `<div class="spotify-empty"><span class="spotify-logo">${icon('music', 31)}</span><div><h4>Votre ambiance de commande</h4><p>Ajoutez le lien public d’une piste, d’un album ou d’une playlist. Le lecteur officiel Spotify sera intégré ici.</p></div><button class="button primary small" data-action="spotify-configure">Connecter un contenu</button></div><div class="integration-fineprint">Aucun compte n’est connecté par PERSONAL OS. Lecture et disponibilité gérées par Spotify.</div>`;
  if (!source) return `<div class="widget-empty-compact">${icon('alert', 25)}<h4>Lien Spotify non reconnu</h4><p>Utilisez un lien open.spotify.com ou une URI spotify:track, album, playlist, artist, show ou episode.</p><button class="button ghost small" data-action="spotify-configure">Corriger le lien</button></div>`;
  const compact = ['track', 'episode'].includes(source.type);
  return `<div class="spotify-player"><div class="spotify-player-meta"><span>${icon('music', 16)} LECTEUR OFFICIEL SPOTIFY</span><a href="${Utils.esc(source.external)}" target="_blank" rel="noopener noreferrer">Ouvrir dans Spotify ${icon('link', 13)}</a></div><iframe src="${Utils.esc(source.embed)}" title="Lecteur Spotify ${Utils.esc(source.type)}" width="100%" height="${compact ? 152 : 352}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe><small>Connexion Internet requise. Certaines lectures peuvent exiger une connexion à votre compte dans l’iframe.</small></div>`;
}

function focusWidget() {
  const state = Focus.snapshot(); const minutes = Math.floor(state.remaining / 60), seconds = state.remaining % 60;
  const durations = state.mode === 'work' ? [15, 25, 45, 50, 60] : [5, 10, 15, 20, 30];
  const configured = Focus.config().durations[state.mode];
  return `<div class="focus-widget ${state.running ? 'is-running' : ''}" data-focus-widget><div class="focus-ring" data-focus-ring style="--focus-progress:${state.progress * 3.6}deg"><div><strong data-focus-time>${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}</strong><span data-focus-state>${state.running ? `${state.label} en cours` : `${state.label} · prêt`}</span></div></div><div class="focus-panel"><div class="segmented focus-modes"><button class="${state.mode === 'work' ? 'active' : ''}" data-action="focus-mode" data-mode="work">Focus</button><button class="${state.mode === 'break' ? 'active' : ''}" data-action="focus-mode" data-mode="break">Pause</button></div><label>Durée<select data-focus-duration>${durations.map(value => `<option value="${value}" ${Number(configured) === value ? 'selected' : ''}>${value} min</option>`).join('')}${!durations.includes(Number(configured)) ? `<option selected>${configured} min</option>` : ''}</select></label><button class="button ${state.running ? 'ghost' : 'primary'}" data-action="focus-toggle">${icon(state.running ? 'pause' : 'play', 16)} ${state.running ? 'Mettre en pause' : state.remaining < state.duration ? 'Reprendre' : 'Démarrer'}</button><small>${state.cycles} cycle${state.cycles > 1 ? 's' : ''} de concentration terminé${state.cycles > 1 ? 's' : ''}</small></div></div>`;
}

function habitsWidget() {
  const stats = Selectors.habits();
  if (!stats.items.length) return `<div class="widget-empty-compact">${icon('flame', 26)}<h4>Aucune habitude suivie</h4><p>Créez un rituel et choisissez sa fréquence hebdomadaire.</p><button class="button primary small" data-action="habit-new">Créer une habitude</button></div>`;
  return `<div class="habits-summary"><div><strong>${stats.completedToday}<small> / ${stats.items.length}</small></strong><span>validées aujourd’hui</span></div><div><strong>${stats.average}<small>%</small></strong><span>des cibles hebdomadaires</span></div><button class="icon-button" data-action="habit-new" aria-label="Ajouter une habitude">${icon('plus', 17)}</button></div><div class="habit-list">${stats.items.slice(0, 4).map(habit => `<article class="habit-row"><button class="habit-check ${habit.doneToday ? 'done' : ''}" style="--habit-color:${Utils.esc(habit.color || '#37D6A0')}" data-action="habit-toggle" data-id="${habit.id}" aria-label="${habit.doneToday ? 'Invalider' : 'Valider'} ${Utils.esc(habit.name)} aujourd’hui">${icon('check', 15)}</button><button class="habit-info" data-action="habit-edit" data-id="${habit.id}"><strong>${Utils.esc(habit.name)}</strong><small>${habit.weekCount}/${habit.targetPerWeek} cette semaine · ${habit.streak} jour${habit.streak > 1 ? 's' : ''} de série</small></button><div class="habit-days">${habit.days.map(day => `<span class="${day.done ? 'done' : ''} ${day.today ? 'today' : ''}" title="${Utils.formatDate(day.date)} : ${day.done ? 'validé' : 'non validé'}">${day.label}</span>`).join('')}</div></article>`).join('')}</div>`;
}

function newsWidget() {
  const config = News.config(); const items = config.items.slice(0, 4);
  return `<div class="news-widget-head"><span><i class="live-pulse"></i> ${config.updatedAt ? `Actualisé ${Utils.relative(config.updatedAt)}` : 'Flux non actualisés'}</span><button data-action="news-refresh" aria-label="Actualiser les actualités">${icon('refresh', 14)}</button></div>${items.length ? `<div class="news-list">${items.map(item => `<article><span class="news-source">${Utils.esc(item.source)} · ${Utils.relative(item.pubDate)}</span>${item.link ? `<a href="${Utils.esc(item.link)}" target="_blank" rel="noopener noreferrer"><strong>${Utils.esc(item.title)}</strong></a>` : `<strong>${Utils.esc(item.title)}</strong>`}<p>${Utils.esc((item.summary || '').slice(0, 145))}${item.summary?.length > 145 ? '…' : ''}</p></article>`).join('')}</div>` : `<div class="widget-empty-compact news-empty">${icon('note', 24)}<h4>Aucun titre en mémoire</h4><p>Actualisez les sources avec une connexion. Aucun contenu de remplacement n’est inventé.</p><button class="button ghost small" data-action="news-refresh">Charger les actualités</button></div>`}${config.lastError ? `<small class="news-error">${Utils.esc(config.lastError)}</small>` : ''}`;
}

function remindersWidget() {
  const reminders = Repo.list('reminders').filter(r => r.enabled);
  const today = reminders.filter(r => r.date === Utils.iso() || (r.repeat?.freq || 'once') !== 'once').slice(0, 4);
  return `<div class="alarm-next"><span class="micro-label">RAPPELS ACTIFS</span><strong>${reminders.length} programmé${reminders.length > 1 ? 's' : ''}</strong><small>Le module Rappels gère aussi votre réveil.</small></div><div class="alarm-list">${today.map(reminder => `<article><button class="alarm-info" data-action="reminder-edit" data-id="${reminder.id}"><strong>${Utils.esc(reminder.title)}</strong><small>${Utils.esc(reminder.category || 'Rappel')} · ${Utils.esc(reminder.time || '')}</small></button></article>`).join('') || '<p class="muted compact">Aucun rappel actif.</p>'}</div>`;
}

const widgetDefinitions = {
  goals: { title: 'Objectifs', icon: 'target', render: goalsWidget, link: 'goals' },
  sport: { title: 'Sport & SPV', icon: 'activity', render: sportWidget, link: 'sport' },
  projects: { title: 'Projets', icon: 'folder', render: projectsWidget, link: 'projects' },
  finance: { title: 'Finances', icon: 'wallet', render: financeWidget, link: 'finances' },
  weather: { title: 'Météo', icon: 'cloud', render: weatherWidget, footer: '<button data-action="weather-open">Position et réglages</button>' },
  news: { title: 'Point actualité', icon: 'note', render: newsWidget, footer: '<button data-action="news-briefing">Écouter le résumé</button><button data-action="news-configure">Sources</button>' },
  calendar: { title: 'Calendrier', icon: 'calendar', render: calendarWidget, link: 'calendar' },
  focus: { title: 'Focus & minuteur', icon: 'clock', render: focusWidget, footer: '<button data-action="timer-new">Minuteur personnalisé</button><button data-action="focus-reset">Réinitialiser</button>' },
  reminders: { title: 'Rappels', icon: 'clock', render: remindersWidget, footer: '<button data-action="reminder-new">Nouveau rappel</button><button data-section="reminders">Gérer</button>' },
  habits: { title: 'Habitudes', icon: 'flame', render: habitsWidget, footer: '<button data-action="habit-manage">Gérer les habitudes</button>' },
  spotify: { title: 'Spotify', icon: 'music', render: spotifyWidget, footer: '<button data-action="spotify-configure">Choisir le contenu Spotify</button>' },
  devices: { title: 'Appareils', icon: 'cpu', render: devicesWidget, link: 'devices' },
  notifications: { title: 'Notifications', icon: 'bell', render: notificationsWidget, link: 'notifications' },
  journal: { title: 'Journal', icon: 'book', render: journalWidget, link: 'journal' }
};

function CompactDashboard() {
  const goals = Selectors.goals(), projects = Selectors.projects(), finance = Selectors.finance();
  const visible = Store.settings.widgets.filter(widget => !widget.hidden); const events = Selectors.todayEvents();
  const activeReminders = Repo.list('reminders').filter(r => r.enabled).length;
  return `<div class="compact-dashboard"><header class="compact-command"><div><span class="eyebrow">PERSONAL OS / ACCUEIL</span><h1>Maison</h1><p>${Utils.formatLongDate()} · ${visible.length} modules actifs</p></div><div class="compact-command-actions"><button class="button ghost small" data-action="news-briefing">${icon('volume', 15)} Point actualité</button><button class="button primary small" data-action="quick-add">${icon('plus', 15)} Nouvelle entrée</button><button class="icon-button" data-action="dashboard-density-toggle" title="Passer à la vue détaillée" aria-label="Passer à la vue détaillée">${icon('expand', 17)}</button></div></header>${(() => {
  const g = Selectors.goals(), p = Selectors.projects(), f = Selectors.finance(), sp = Selectors.sport();
  const score = Math.round((g.average + Math.min(100, sp.week.length / 4 * 100) + Math.max(0, 100 - p.late.length * 15) + (f.balance >= 0 ? 100 : Math.max(0, 60 + f.balance / 30))) / 4);
  const tone = score >= 75 ? 'OPTIMAL' : score >= 50 ? 'STABLE' : 'À SURVEILLER';
  return `<section class="ops-score"><header class="ops-card-head"><h2>PERSONAL OS SCORE</h2><span class="ops-live">LIVE</span></header><div class="gauge-wrap"><svg viewBox="0 0 240 136" class="score-gauge" role="img" aria-label="Score global ${score} sur 100"><defs><linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FF4D00"/><stop offset=".55" stop-color="#FF8A2B"/><stop offset="1" stop-color="#FFC24D"/></linearGradient></defs><path class="gauge-track" d="M22 118 A98 98 0 0 1 218 118"/><path class="gauge-value" d="M22 118 A98 98 0 0 1 218 118" stroke="url(#gauge-grad)" stroke-dasharray="308" stroke-dashoffset="${308 - 308 * score / 100}"/>${Array.from({ length: 9 }, (_, i) => { const a = Math.PI - i * Math.PI / 8; return `<circle cx="${120 + Math.cos(a) * 82}" cy="${118 - Math.sin(a) * 82}" r="1.8"/>`; }).join('')}</svg><div class="gauge-center"><strong>${score}</strong><span>${tone}</span></div></div><div class="gauge-legend"><div><i class="dot dot-orange"></i><span>Objectifs</span><b>${g.average}%</b></div><div><i class="dot dot-green"></i><span>Sport</span><b>${sp.week.length}/4</b></div><div><i class="dot dot-red"></i><span>Retards</span><b>${p.late.length + g.late.length}</b></div><div><i class="dot dot-cyan"></i><span>Budget</span><b>${f.budget ? Math.round(f.budgetRatio) : '—'}%</b></div></div></section>`;
})()}
<section class="compact-kpis"><button data-section="goals"><span>Objectifs</span><strong>${goals.average}%</strong><small>${goals.active.length} actifs · ${goals.late.length} en retard</small></button><button data-section="finances"><span>Solde du mois</span><strong>${Utils.money(finance.balance, true)}</strong><small>${Utils.money(finance.remaining)} de budget restant</small></button><button data-section="calendar"><span>Aujourd’hui</span><strong>${events.length}</strong><small>événement${events.length > 1 ? 's' : ''} · ${projects.tasks.filter(t => t.status !== 'done' && t.due === Utils.iso()).length} tâches</small></button><button data-section="reminders"><span>Rappels</span><strong>${activeReminders}</strong><small>actifs · réveil inclus</small></button></section>${(() => {
  const tasks = Repo.list('tasks'); const notifications = [...Repo.list('notifications')].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const priorities = Taxonomy.priorities.map(p => ({ label: p, value: tasks.filter(t => t.priority === p && t.status !== 'done').length }));
  const days = Array.from({ length: 12 }, (_, i) => Utils.day(i - 11));
  const activity = days.map(date => ({ label: new Intl.DateTimeFormat('fr-FR', { weekday: 'narrow' }).format(new Date(`${date}T12:00:00`)),
    value: Repo.list('sessions').filter(s => s.date?.startsWith(date) && s.status !== 'Planifiée').reduce((sum, s) => sum + Number(s.duration || 0), 0) }));
  const tone = p => ({ Critique: 'critique', Haute: 'haute', Basse: 'basse' }[p] || 'normale');
  return `<section class="ops-strip"><article class="ops-panel"><header class="ops-card-head"><h2>ACTIVITÉ PHYSIQUE</h2><span>12 JOURS · MINUTES</span></header>${Charts.line(activity.map(a => a.value), { labels: activity.map(a => a.label), color: '#FF8A2B', height: 190, unit: ' min' })}</article><article class="ops-panel"><header class="ops-card-head"><h2>RÉPARTITION DES PRIORITÉS</h2><span>${tasks.filter(t => t.status !== 'done').length} TÂCHES</span></header><div class="risk-rows">${priorities.map((item, index) => `<div><span class="risk-label">${item.label.toUpperCase()}</span><div class="risk-bar"><i style="width:${Math.min(100, item.value * 12 + (item.value ? 6 : 0))}%;background:${['#2FA9E8', '#2FD08B', '#FFA23A', '#F0564A'][index]}"></i></div><b>${item.value}</b><em>${['LOW', 'LOW', 'MED', 'HIGH'][index]}</em></div>`).join('')}</div></article><article class="ops-panel"><header class="ops-card-head"><h2>ALERTES RÉCENTES</h2><button data-section="notifications">TOUT VOIR</button></header><div class="alert-rows">${notifications.length ? notifications.map(n => `<button data-action="notification-open" data-id="${n.id}" class="${n.read ? 'read' : ''}"><span class="level level-${tone(n.priority)}">${(n.priority || 'Normale').slice(0, 3).toUpperCase()}</span><span class="alert-type">${Utils.esc(n.type)}</span><strong>${Utils.esc(n.title)}</strong><em>${Utils.relative(n.date)}</em></button>`).join('') : '<p class="muted compact">Aucune alerte.</p>'}</div></article></section>`;
})()}
<div class="compact-widget-grid">${visible.map(config => { const definition = widgetDefinitions[config.id]; return widgetShell({ ...config, size: 'compact' }, definition.title, definition.icon, definition.render(), definition.footer || `<button data-section="${definition.link}">Ouvrir ${icon('arrow', 13)}</button>`); }).join('')}</div></div>`;
}

export function Dashboard() {
  if (Store.settings.compactDashboard) return CompactDashboard();
  const goals = Selectors.goals(), sport = Selectors.sport(), projects = Selectors.projects(), finance = Selectors.finance();
  const todayEvents = Selectors.todayEvents(); const name = Store.mode === 'demo' ? 'Opérateur démo' : 'Bienvenue';
  const visible = Store.settings.widgets.filter(widget => !widget.hidden);
  return `<div class="dashboard-view">
    <section class="command-hero" id="command-hero" aria-labelledby="hero-title">
      <div class="hero-grid" aria-hidden="true"></div><div class="hero-glow" aria-hidden="true"></div>
      <div class="hero-radar" aria-hidden="true"><i></i><i></i><i></i><span></span><b></b></div>
      <div class="hero-signals" aria-hidden="true"><div class="hero-signal" data-converge="left"><span>${icon('target')}</span><small>OBJECTIFS</small><strong>${goals.average}%</strong></div><div class="hero-signal" data-converge="top"><span>${icon('activity')}</span><small>SPORT</small><strong>${sport.week.length} SÉANCES</strong></div><div class="hero-signal" data-converge="right"><span>${icon('folder')}</span><small>PROJETS</small><strong>${projects.active.length} ACTIFS</strong></div></div>
      <div class="hero-copy">
        <div class="hero-kicker"><span class="live-pulse"></span> SYSTÈME PERSONNEL · ${Store.mode === 'demo' ? 'SIMULATION DE DONNÉES' : 'DONNÉES LOCALES'}</div>
        <h1 id="hero-title"><span class="hero-line-mask"><span>VOTRE QUOTIDIEN.</span></span><span class="hero-line-mask accent-text"><span>SOUS CONTRÔLE.</span></span></h1>
        <p>Un seul poste de commande pour transformer vos intentions en actions mesurables, sans envoyer vos données vers un serveur.</p>
        <div class="hero-actions"><button class="button primary" data-action="quick-add">${icon('plus', 18)} Nouvelle entrée</button><button class="button glass" data-action="scroll-widgets">Explorer le cockpit ${icon('arrow', 17)}</button></div>
      </div>
      <aside class="hero-today"><header><div><span class="micro-label">BRIEFING · ${Utils.formatLongDate().toUpperCase()}</span><h2>${name}, voici votre trajectoire.</h2></div><span class="hero-time" id="hero-time">--:--</span></header><div class="hero-agenda">${todayEvents.length ? todayEvents.slice(0, 3).map((event, index) => `<div><time>${Utils.esc(event.start)}</time><i class="${index === 0 ? 'active' : ''}"></i><span><strong>${Utils.esc(event.title)}</strong><small>${Utils.esc(event.category)}${event.end ? ` · jusqu’à ${Utils.esc(event.end)}` : ''}</small></span></div>`).join('') : `<div class="hero-clear">${icon('check', 20)}<span><strong>Aucun événement aujourd’hui</strong><small>Votre journée est ouverte. Planifiez ce qui compte.</small></span></div>`}</div><button data-section="calendar">Ouvrir l’agenda complet ${icon('chevron', 15)}</button></aside>
      <div class="hero-metrics"><div><span>OBJECTIFS</span><strong>${goals.average}<small>%</small></strong><i style="--bar:${goals.average}%"></i></div><div><span>SOLDE DU MOIS</span><strong>${Utils.money(finance.balance, true)}</strong><small>${finance.remaining >= 0 ? `${Utils.money(finance.remaining)} disponibles` : 'Budget dépassé'}</small></div><div><span>À TRAITER</span><strong>${projects.tasks.filter(t => t.status !== 'done').length}</strong><small>${projects.late.length} en retard</small></div></div>
      <button class="scroll-cue" data-action="scroll-widgets" aria-label="Faire défiler vers les widgets"><span></span><small>DÉFILER POUR LE COCKPIT</small></button>
    </section>
    <section class="widget-deck" id="widget-deck">
      <header class="deck-heading reveal"><div><span class="eyebrow">VUE D’ENSEMBLE / TEMPS RÉEL LOCAL</span><h2>Centre de pilotage</h2><p>Réorganisez les modules par glisser-déposer. Chaque chiffre provient de vos données.</p></div><div><span class="layout-label">${visible.length} / ${Store.settings.widgets.length} MODULES ACTIFS</span><button class="button ghost small" data-action="dashboard-density-toggle">Vue compacte</button><button class="button ghost small" data-section="settings">${icon('settings', 16)} Configurer</button></div></header>
      ${visible.length ? `<div class="widget-grid">${visible.map(config => { const definition = widgetDefinitions[config.id]; return widgetShell(config, definition.title, definition.icon, definition.render(), definition.footer || `<button data-section="${definition.link}">Ouvrir le module ${icon('arrow', 14)}</button>`); }).join('')}</div>` : emptyState('Cockpit masqué', 'Tous les widgets sont masqués. Réactivez-les depuis les paramètres.', '<button class="button primary" data-action="widgets-show-all">Tout afficher</button>', 'dashboard')}
    </section>
  </div>`;
}

function goalCard(goal) {
  const progress = Selectors.goalProgress(goal); const late = goal.deadline && goal.deadline < Utils.iso() && progress < 100;
  const steps = goal.steps || []; const doneSteps = steps.filter(step => step.done).length;
  return `<article class="goal-card card reveal ${late ? 'is-late' : ''}">
    <header><div class="card-labels">${badge(goal.category)}${badge(goal.priority, priorityTone(goal.priority))}${late ? badge('En retard', 'alerte') : ''}</div><div class="row-actions">${actionButton('goal-detail', goal.id, 'eye', 'Voir le détail')}${actionButton('goal-edit', goal.id)}${actionButton('goal-delete', goal.id, 'trash', 'Supprimer')}</div></header>
    <button class="card-main-link" data-action="goal-detail" data-id="${goal.id}"><h3>${Utils.esc(goal.name)}</h3><p>${Utils.esc(goal.description || 'Aucune description. Ouvrez la fiche pour documenter cet objectif.')}</p></button>
    <div class="goal-value"><div><strong>${Utils.esc(goal.current ?? 0)} <small>/ ${Utils.esc(goal.target ?? 0)} ${Utils.esc(goal.unit || '')}</small></strong><span>Valeur actuelle</span></div><b>${Math.round(progress)}%</b></div>
    ${progressBar(progress)}
    <footer><div><span>${icon('calendar', 14)} ${goal.deadline ? Utils.formatDate(goal.deadline, { year: 'numeric' }) : 'Sans échéance'}</span><span>${icon('check', 14)} ${doneSteps}/${steps.length} étapes</span></div><button class="text-button" data-action="goal-detail" data-id="${goal.id}">Mettre à jour ${icon('arrow', 14)}</button></footer>
  </article>`;
}

export function Goals() {
  const stats = Selectors.goals();
  let goals = [...stats.all].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  if (ViewState.goalCategory !== 'Toutes') goals = goals.filter(goal => goal.category === ViewState.goalCategory);
  if (ViewState.goalStatus === 'Actifs') goals = goals.filter(goal => Selectors.goalProgress(goal) < 100);
  if (ViewState.goalStatus === 'Terminés') goals = goals.filter(goal => Selectors.goalProgress(goal) >= 100);
  if (ViewState.goalStatus === 'En retard') goals = goals.filter(goal => goal.deadline < Utils.iso() && Selectors.goalProgress(goal) < 100);
  const add = `<button class="button primary" data-action="goal-new">${icon('plus', 17)} Nouvel objectif</button>`;
  return `<div class="page-view goals-view">${sectionHeader('TRAJECTOIRE / LONG TERME', 'Objectifs', 'Des cibles chiffrées, des étapes concrètes et un historique de chaque décision.', add)}
    <section class="kpi-grid four reveal"><div class="kpi-card"><span>Progression moyenne</span><strong>${stats.average}<small>%</small></strong><i class="kpi-accent"></i></div><div class="kpi-card"><span>Objectifs actifs</span><strong>${stats.active.length}</strong><small>${stats.all.length} au total</small></div><div class="kpi-card"><span>Terminés</span><strong>${stats.done.length}</strong><small>Cibles atteintes</small></div><div class="kpi-card ${stats.late.length ? 'warning' : ''}"><span>En retard</span><strong>${stats.late.length}</strong><small>Action recommandée</small></div></section>
    <div class="filter-bar reveal"><div class="filter-group"><label>Catégorie<select data-view-filter="goal-category"><option>Toutes</option>${Taxonomy.GOAL_CATEGORIES.map(c => `<option ${ViewState.goalCategory === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label><label>État<select data-view-filter="goal-status">${['Tous', 'Actifs', 'Terminés', 'En retard'].map(s => `<option ${ViewState.goalStatus === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div><span class="result-count">${goals.length} résultat${goals.length > 1 ? 's' : ''}</span></div>
    ${goals.length ? `<section class="card-grid goals-grid">${goals.map(goalCard).join('')}</section>` : emptyState(stats.all.length ? 'Aucun objectif dans ce filtre' : 'Définissez votre première trajectoire', stats.all.length ? 'Modifiez les filtres pour retrouver vos objectifs.' : 'Une cible mesurable et une échéance suffisent pour commencer.', stats.all.length ? '<button class="button ghost" data-action="goal-filters-reset">Réinitialiser les filtres</button>' : add, 'target')}
  </div>`;
}

function sessionRow(session) {
  return `<article class="session-row reveal"><div class="session-icon">${icon(session.type === 'Course' ? 'activity' : session.type === 'Mobilité' ? 'refresh' : 'gauge', 20)}</div><div class="session-main"><div><strong>${Utils.esc(session.type)}</strong>${badge(session.status, session.status === 'Planifiée' ? 'normale' : 'terme')}</div><span>${Utils.formatDateTime(session.date)}</span>${session.performance ? `<p>${Utils.esc(session.performance)}</p>` : ''}</div><div class="session-metrics"><span><strong>${session.duration || 0}</strong> min</span>${session.distance ? `<span><strong>${session.distance}</strong> km</span>` : ''}${session.reps ? `<span><strong>${session.reps}</strong> rép.</span>` : ''}${session.feeling ? `<span class="feeling"><strong>${session.feeling}</strong>/10 ressenti</span>` : ''}</div><div class="row-actions">${actionButton('session-edit', session.id)}${actionButton('session-delete', session.id, 'trash', 'Supprimer la séance')}</div></article>`;
}

export function Sport() {
  const stats = Selectors.sport();
  const done = [...stats.done].slice(0, 10).reverse();
  const chartValues = done.map(s => Number(s[ViewState.sportMetric] || 0));
  const chartLabels = done.map(s => Utils.formatDate(s.date).split(' ').slice(0, 2).join(' '));
  const filtered = ViewState.sportType === 'Tous' ? stats.sessions : stats.sessions.filter(s => s.type === ViewState.sportType);
  const week = Array.from({ length: 7 }, (_, i) => { const date = new Date(Utils.startOfWeek()); date.setDate(date.getDate() + i); const key = Utils.iso(date); return { label: ['L', 'M', 'M', 'J', 'V', 'S', 'D'][i], value: stats.done.filter(s => s.date?.startsWith(key)).reduce((sum, s) => sum + Number(s.duration || 0), 0) }; });
  const sportGoals = Repo.list('goals').filter(goal => goal.category === 'Sport');
  const add = `<button class="button ghost" data-action="session-plan">${icon('calendar', 17)} Planifier</button><button class="button primary" data-action="session-new">${icon('plus', 17)} Enregistrer une séance</button>`;
  return `<div class="page-view sport-view">${sectionHeader('PERFORMANCE / PRÉPARATION OPÉRATIONNELLE', 'Sport & SPV', 'Suivez la charge, les performances et le ressenti pour préparer durablement vos capacités physiques.', add)}
    <section class="kpi-grid four reveal"><div class="kpi-card hero-kpi"><span>Séances cette semaine</span><strong>${stats.week.length}</strong><small>${week.reduce((s, x) => s + x.value, 0)} minutes cumulées</small></div><div class="kpi-card"><span>Distance totale</span><strong>${Utils.round(stats.distance, 1)}<small> km</small></strong><small>Toutes séances terminées</small></div><div class="kpi-card"><span>Temps d’activité</span><strong>${Math.round(stats.minutes / 60)}<small> h</small></strong><small>${stats.minutes} minutes enregistrées</small></div><div class="kpi-card"><span>Ressenti moyen</span><strong>${stats.averageFeeling || '—'}<small>${stats.averageFeeling ? '/10' : ''}</small></strong><small>Indicateur subjectif</small></div></section>
    <section class="sport-analytics"><article class="panel chart-panel reveal"><header class="panel-header"><div><span class="micro-label">PROGRESSION PHYSIQUE</span><h2>Évolution des séances</h2></div><select data-view-filter="sport-metric" aria-label="Métrique du graphique"><option value="duration" ${ViewState.sportMetric === 'duration' ? 'selected' : ''}>Durée (min)</option><option value="distance" ${ViewState.sportMetric === 'distance' ? 'selected' : ''}>Distance (km)</option><option value="reps" ${ViewState.sportMetric === 'reps' ? 'selected' : ''}>Répétitions</option><option value="feeling" ${ViewState.sportMetric === 'feeling' ? 'selected' : ''}>Ressenti (/10)</option></select></header>${Charts.line(chartValues, { labels: chartLabels, unit: ViewState.sportMetric === 'duration' ? ' min' : ViewState.sportMetric === 'distance' ? ' km' : '' })}</article><article class="panel reveal"><header class="panel-header"><div><span class="micro-label">CHARGE HEBDOMADAIRE</span><h2>Minutes par jour</h2></div></header>${Charts.bars(week, { unit: ' min' })}<p class="chart-note">La charge affichée ne constitue pas un avis médical. Adaptez l’effort à votre condition.</p></article></section>
    <section class="sport-goals panel reveal"><header class="panel-header"><div><span class="micro-label">CIBLES PERSONNALISÉES</span><h2>Objectifs sportifs</h2></div><button class="button ghost small" data-action="sport-goal-new">${icon('plus', 15)} Nouvel objectif sportif</button></header>${sportGoals.length ? `<div class="sport-goal-list">${sportGoals.map(goal => `<button data-action="goal-detail" data-id="${goal.id}"><span><strong>${Utils.esc(goal.name)}</strong><small>${goal.current} / ${goal.target} ${Utils.esc(goal.unit)}</small></span><b>${Math.round(Selectors.goalProgress(goal))}%</b><i style="width:${Selectors.goalProgress(goal)}%"></i></button>`).join('')}</div>` : '<p class="muted">Créez un objectif de distance, de durée, de répétitions ou toute autre cible mesurable.</p>'}</section>
    <div class="filter-bar reveal"><div class="filter-group"><label>Type d’entraînement<select data-view-filter="sport-type"><option>Tous</option>${Taxonomy.SESSION_TYPES.map(type => `<option ${ViewState.sportType === type ? 'selected' : ''}>${type}</option>`).join('')}</select></label></div><span class="result-count">${filtered.length} séance${filtered.length > 1 ? 's' : ''}</span></div>
    <section class="session-list">${filtered.length ? filtered.map(sessionRow).join('') : emptyState('Aucune séance dans cette vue', 'Enregistrez une séance ou changez le filtre d’entraînement.', '<button class="button primary" data-action="session-new">Enregistrer une séance</button>', 'activity')}</section>
  </div>`;
}

function projectCard(project) {
  const tasks = Repo.list('tasks').filter(task => task.projectId === project.id); const open = tasks.filter(task => task.status !== 'done');
  return `<article class="project-card card reveal" style="--project-color:${Utils.esc(project.color || '#37D6A0')}"><header><span class="project-icon">${icon(project.icon || 'folder', 22)}</span><div class="card-labels">${badge(project.status)}${badge(project.priority, priorityTone(project.priority))}</div><div class="row-actions">${actionButton('project-edit', project.id)}${actionButton('project-delete', project.id, 'trash', 'Supprimer le projet')}</div></header><button class="card-main-link" data-action="project-detail" data-id="${project.id}"><span class="micro-label">${Utils.esc(project.category || 'Sans catégorie')}</span><h3>${Utils.esc(project.name)}</h3><p>${Utils.esc(project.description || 'Aucune description.')}</p></button>${progressBar(project.progress, 'Progression')}<div class="project-card-stats"><span><strong>${open.length}</strong> tâches ouvertes</span><span><strong>${Utils.money(project.budget, true)}</strong> budget</span><span><strong>${project.deadline ? Utils.formatDate(project.deadline) : '—'}</strong> échéance</span></div><footer><span>Mis à jour ${Utils.relative(project.updatedAt)}</span><button class="text-button" data-action="project-detail" data-id="${project.id}">Piloter ${icon('arrow', 14)}</button></footer></article>`;
}

function projectTimeline(projects) {
  return `<div class="timeline-view panel reveal">${projects.length ? [...projects].sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999')).map(project => `<article class="timeline-project"><time>${project.deadline ? Utils.formatDate(project.deadline, { year: 'numeric' }) : 'À dater'}</time><div class="timeline-node" style="--project-color:${Utils.esc(project.color || '#37D6A0')}"><i></i><span></span></div><div><header><button data-action="project-detail" data-id="${project.id}"><h3>${Utils.esc(project.name)}</h3></button>${badge(project.status)}</header><p>${Utils.esc(project.description)}</p>${progressBar(project.progress)}<small>${project.createdAt ? `Créé le ${Utils.formatDate(project.createdAt, { year: 'numeric' })}` : ''} · ${Utils.esc(project.category)}</small></div></article>`).join('') : emptyState('Aucun projet à chronologer', 'Créez un projet et définissez une échéance pour alimenter cette vue.', '', 'timeline')}</div>`;
}

function projectKanban(projects) {
  return `<div class="kanban-board reveal">${Taxonomy.PROJECT_STATUSES.map(status => { const items = projects.filter(project => project.status === status); return `<section class="kanban-column" data-project-status="${Utils.esc(status)}"><header><span>${Utils.esc(status)}</span><b>${items.length}</b></header><div class="kanban-dropzone" data-status="${Utils.esc(status)}">${items.map(project => `<article class="kanban-card" draggable="true" data-project-drag="${project.id}" style="--project-color:${Utils.esc(project.color || '#37D6A0')}"><button data-action="project-detail" data-id="${project.id}"><span class="micro-label">${Utils.esc(project.category)}</span><h3>${Utils.esc(project.name)}</h3></button><p>${Utils.esc(project.description)}</p>${progressBar(project.progress)}<footer>${badge(project.priority, priorityTone(project.priority))}<span>${project.deadline ? Utils.formatDate(project.deadline) : 'Sans date'}</span></footer></article>`).join('')}<button class="kanban-add" data-action="project-new-status" data-status="${Utils.esc(status)}">${icon('plus', 14)} Ajouter</button></div></section>`; }).join('')}</div>`;
}

export function Projects() {
  let projects = [...Repo.list('projects')].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  if (ViewState.projectStatus !== 'Tous') projects = projects.filter(project => project.status === ViewState.projectStatus);
  const tasks = Repo.list('tasks'); const late = tasks.filter(task => task.status !== 'done' && task.due && task.due < Utils.iso());
  const unassigned = tasks.filter(task => !task.projectId);
  const add = `<button class="button primary" data-action="project-new">${icon('plus', 17)} Nouveau projet</button>`;
  return `<div class="page-view projects-view">${sectionHeader('PORTEFEUILLE / EXÉCUTION', 'Projets', 'Une structure universelle pour vos initiatives professionnelles, personnelles et futures.', add)}
    <section class="project-overview reveal"><div><span>Projets actifs</span><strong>${projects.filter(p => !['Terminé', 'Suspendu'].includes(p.status)).length}</strong></div><div><span>Tâches ouvertes</span><strong>${tasks.filter(t => t.status !== 'done').length}</strong></div><div class="${late.length ? 'warning' : ''}"><span>Tâches en retard</span><strong>${late.length}</strong></div><div><span>Budgets cumulés</span><strong>${Utils.money(projects.reduce((s, p) => s + Number(p.budget || 0), 0), true)}</strong></div></section>
    <div class="view-toolbar reveal"><div class="segmented" aria-label="Mode d’affichage"><button class="${ViewState.projectView === 'cards' ? 'active' : ''}" data-action="project-view" data-view="cards">${icon('dashboard', 16)} Cartes</button><button class="${ViewState.projectView === 'kanban' ? 'active' : ''}" data-action="project-view" data-view="kanban">${icon('kanban', 16)} Kanban</button><button class="${ViewState.projectView === 'timeline' ? 'active' : ''}" data-action="project-view" data-view="timeline">${icon('timeline', 16)} Chronologique</button></div><div class="toolbar-right"><label class="compact-label">Statut<select data-view-filter="project-status"><option>Tous</option>${Taxonomy.PROJECT_STATUSES.map(s => `<option ${ViewState.projectStatus === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label><button class="button ghost small" data-action="task-new">${icon('plus', 15)} Tâche transverse</button></div></div>
    ${projects.length ? (ViewState.projectView === 'kanban' ? projectKanban(projects) : ViewState.projectView === 'timeline' ? projectTimeline(projects) : `<section class="card-grid project-grid">${projects.map(projectCard).join('')}</section>`) : emptyState(Repo.list('projects').length ? 'Aucun projet dans ce filtre' : 'Votre portefeuille est vide', Repo.list('projects').length ? 'Sélectionnez un autre statut.' : 'Créez un projet puis associez tâches, notes, documents et budget.', add, 'folder')}
    ${unassigned.length ? `<section class="panel unassigned-tasks reveal"><header class="panel-header"><div><span class="micro-label">BOÎTE D’ARRIVÉE</span><h2>Tâches transverses</h2></div><span class="result-count">${unassigned.length} tâche${unassigned.length > 1 ? 's' : ''}</span></header>${unassigned.map(task => `<div class="task-row"><button class="task-check ${task.status === 'done' ? 'done' : ''}" data-action="task-toggle" data-id="${task.id}" aria-label="${task.status === 'done' ? 'Rouvrir' : 'Terminer'} ${Utils.esc(task.title)}">${icon('check', 14)}</button><button class="task-title" data-action="task-edit" data-id="${task.id}"><strong class="${task.status === 'done' ? 'done' : ''}">${Utils.esc(task.title)}</strong><small>${taskStatus[task.status] || task.status}${task.due ? ` · ${Utils.formatDate(task.due)}` : ''}</small></button>${badge(task.priority, priorityTone(task.priority))}${actionButton('task-edit', task.id)}${actionButton('task-delete', task.id, 'trash', 'Supprimer la tâche')}</div>`).join('')}</section>` : ''}
  </div>`;
}
