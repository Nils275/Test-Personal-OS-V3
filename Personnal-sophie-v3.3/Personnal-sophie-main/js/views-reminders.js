/* Vue : centre de gestion des rappels intelligents de Sophie. */
import { Store, Repo, Selectors, Utils } from './core.js';
import { icon, badge, progressBar, emptyState, sectionHeader } from './ui.js';
import { ViewState } from './view-state.js';
import { Reminders } from './reminders.js';

const actionButton = (action, id, name = 'edit', label = 'Modifier', extra = '') => `<button class="icon-button subtle" data-action="${action}" data-id="${Utils.esc(id || '')}" ${extra} aria-label="${Utils.esc(label)}" title="${Utils.esc(label)}">${icon(name, 17)}</button>`;
const priorityTone = priority => ({ Critique: 'critique', Haute: 'haute', Basse: 'basse' }[priority] || 'normale');

function repeatLabel(reminder) {
  const freq = reminder.repeat?.freq || 'once';
  const days = (reminder.repeat?.days || []).map(d => ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][d]).join(' ');
  return {
    once: reminder.date ? Utils.formatDate(reminder.date, { year: 'numeric' }) : 'Date unique',
    hourly: `Toutes les heures à ${String(reminder.time || '').split(':')[1] || '00'} min`,
    daily: `Chaque jour à ${reminder.time}`,
    weekdays: `Certains jours · ${days}`,
    weekly: `Chaque semaine à ${reminder.time}`,
    monthly: `Chaque mois le ${reminder.repeat?.dayOfMonth || new Date(`${reminder.date || Utils.iso()}T12:00:00`).getDate()} à ${reminder.time}`
  }[freq];
}

function reminderCard(reminder) {
  const next = Reminders.next(reminder); const style = reminder.style || Store.settings.reminderStyle;
  return `<article class="reminder-card card reveal ${reminder.enabled ? '' : 'disabled'}">
    <header><div class="card-labels">${badge(reminder.category || 'Autre')}${badge(reminder.priority || 'Normale', priorityTone(reminder.priority))}${badge(style, 'style')}${reminder.status === 'missed' ? badge('Manqué', 'alerte') : reminder.status === 'done' ? badge('Terminé', 'terme') : ''}</div>
      <div class="row-actions">${reminder.enabled ? actionButton('reminder-done', reminder.id, 'check', 'Marquer comme fait') : ''}${actionButton('reminder-snooze', reminder.id, 'clock', 'Reporter de 15 minutes')}${actionButton('reminder-edit', reminder.id)}${actionButton('reminder-delete', reminder.id, 'trash', 'Supprimer le rappel')}</div></header>
    <button class="card-main-link" data-action="reminder-edit" data-id="${reminder.id}"><h3>${Utils.esc(reminder.title)}</h3><p class="reminder-voice">« ${Utils.esc(Reminders.message(reminder))} »</p></button>
    <div class="reminder-meta"><span>${icon('calendar', 13)} ${repeatLabel(reminder)}</span><span>${icon('bell', 13)} ${next ? `Prochain : ${Utils.formatDateTime(next)}` : 'Aucune occurrence à venir'}</span><span>${icon('link', 13)} Source : ${Utils.esc(reminder.source || 'Manuel')}</span></div>
    <footer><span>${reminder.history?.length ? `${reminder.history.length} événement(s) d’historique` : 'Aucun déclenchement'}</span><div><button class="button ghost tiny" data-action="reminder-postpone" data-id="${reminder.id}">Décaler à demain</button><label class="switch-only compact"><input type="checkbox" data-reminder-toggle="${reminder.id}" ${reminder.enabled ? 'checked' : ''}><span class="switch"><span></span></span></label></div></footer>
  </article>`;
}

export function RemindersView() {
  const stats = Reminders.stats(); const tab = ViewState.reminderTab || 'today';
  const counts = { today: stats.today, upcoming: stats.upcoming, recurring: stats.recurring, missed: stats.missed, done: stats.done, all: stats.all };
  const filtered = counts[tab] || stats.all;
  const suggestions = Reminders.suggestions();
  return `<div class="page-view reminders-view">${sectionHeader('SOPHIE / MÉMOIRE ACTIVE', 'Rappels intelligents', 'Planification, personnalité des annonces et historique. Chaque rappel est modifiable, supprimable et testable.', `<button class="button ghost" data-action="reminder-suggestions">${icon('activity', 16)} Suggestions</button><button class="button primary" data-action="reminder-new">${icon('plus', 17)} Nouveau rappel</button>`)}
    <section class="kpi-grid four reveal"><div class="kpi-card"><span>Rappels du jour</span><strong>${stats.today.length}</strong><small>Occurrences prévues aujourd’hui</small></div><div class="kpi-card"><span>À venir</span><strong>${stats.upcoming.length}</strong><small>Planifiés plus tard</small></div><div class="kpi-card"><span>Récurrents</span><strong>${stats.recurring.length}</strong><small>Routines actives</small></div><div class="kpi-card ${stats.missed.length ? 'warning' : ''}"><span>Manqués</span><strong>${stats.missed.length}</strong><small>Signalés sans répétition</small></div></section>
    <div class="view-toolbar reveal"><div class="segmented">${[['today', 'Aujourd’hui'], ['upcoming', 'À venir'], ['recurring', 'Récurrents'], ['missed', 'Manqués'], ['done', 'Terminés'], ['all', 'Tous']].map(([id, label]) => `<button class="${tab === id ? 'active' : ''}" data-action="reminder-tab" data-tab="${id}">${label} <b>${counts[id].length}</b></button>`).join('')}</div>
      <div class="toolbar-right"><label class="compact-label">Style d’annonce<select data-setting="reminderStyle">${Reminders.styles.map(style => `<option ${Store.settings.reminderStyle === style ? 'selected' : ''}>${style}</option>`).join('')}</select></label><button class="button ghost small" data-action="reminder-test">${icon('volume', 15)} Tester le style</button></div></div>
    ${suggestions.length ? `<section class="reminder-suggestions reveal"><header><span class="micro-label">SUGGESTIONS DE SOPHIE</span><p>Rappels proposés d’après vos tâches, habitudes et échéances. Les doublons ne sont jamais proposés deux fois.</p></header><div class="suggestion-grid">${suggestions.map(item => `<article><strong>${Utils.esc(item.title)}</strong><small>${Utils.esc(item.detail)}</small><button class="button ghost tiny" data-action="reminder-accept" data-title="${Utils.esc(item.title)}" data-detail="${Utils.esc(item.detail)}" data-link-type="${Utils.esc(item.linkType)}" data-link-id="${Utils.esc(item.linkId)}">${icon('plus', 14)} Créer ce rappel</button></article>`).join('')}</div></section>` : ''}
    ${filtered.length ? `<section class="reminder-list">${filtered.map(reminderCard).join('')}</section>` : emptyState(tab === 'missed' ? 'Aucun rappel manqué' : 'Aucun rappel dans cette vue', 'Créez un rappel manuellement, par commande vocale ou depuis une tâche ou un événement.', '<button class="button primary" data-action="reminder-new">Créer un rappel</button>', 'bell')}
    <section class="panel reminder-settings reveal"><header class="panel-header"><div><span class="micro-label">PARAMÈTRES DE NOTIFICATION</span><h2>Annonces vocales & discrétion</h2></div><button class="button ghost small" data-action="reminder-history-open">${icon('clock', 15)} Historique complet</button></header>
      <div class="settings-grid"><div class="setting-row"><div><strong>Messages vocaux</strong><p>Sophie lit le message du rappel selon le style choisi.</p></div><label class="switch-only"><input type="checkbox" data-setting="reminderVoice" ${Store.settings.reminderVoice ? 'checked' : ''}><span class="switch"><span></span></span></label></div>
      <div class="setting-row"><div><strong>Répéter le message</strong><p>Relit l’annonce jusqu’à une action de votre part.</p></div><label class="switch-only"><input type="checkbox" data-setting="reminderRepeat" ${Store.settings.reminderRepeat ? 'checked' : ''}><span class="switch"><span></span></span></label></div>
      <div class="setting-row"><div><strong>Délai entre les répétitions</strong><p>Minutes entre deux lectures du même rappel.</p></div><select data-setting="reminderRepeatDelay">${[2, 5, 10, 15].map(v => `<option value="${v}" ${Number(Store.settings.reminderRepeatDelay) === v ? 'selected' : ''}>${v} min</option>`).join('')}</select></div>
      <div class="setting-row"><div><strong>Prénom utilisé dans les annonces</strong><p>Personnalise tous les messages de Sophie.</p></div><input type="text" value="${Utils.esc(Store.settings.userName || '')}" data-setting="userName" maxlength="24"></div>
      <div class="setting-row"><div><strong>Plages silencieuses</strong><p>Aucune lecture vocale de ${Utils.esc(Store.settings.quietStart)} à ${Utils.esc(Store.settings.quietEnd)}. Les notifications restent visibles.</p></div><button class="button ghost small" data-section="settings">Configurer</button></div></div>
      <p class="settings-hint">${icon('info', 14)} Programmation active pendant que PERSONAL OS est ouvert. Les notifications Android planifiées en application fermée passent par Capacitor Local Notifications (voir ARCHITECTURE.md) et ne sont jamais simulées.</p>
    </section>
  </div>`;
}
