/* SOPHIE — Rappels intelligents : planification, personnalité, historique et actions.
   Le moteur tourne pendant que PERSONAL OS est ouvert ; les notifications système
   Android planifiées (application fermée) passent par Capacitor Local Notifications,
   documenté dans ARCHITECTURE.md. Aucune capacité native n'est simulée ici. */
import { Store, Repo, Selectors, Notify, Utils, Bus } from './core.js';
import { TTS } from './tts.js';

const FREQUENCIES = [
  { value: 'once', label: 'Une seule fois' }, { value: 'hourly', label: 'Toutes les heures' },
  { value: 'daily', label: 'Tous les jours' }, { value: 'weekdays', label: 'Certains jours de la semaine' },
  { value: 'weekly', label: 'Chaque semaine' }, { value: 'monthly', label: 'Chaque mois' }
];
const CATEGORIES = ['Maison', 'Travail', 'Sport', 'Santé', 'Administratif', 'Famille', 'Projet', 'Routine', 'Autre'];

/* Personnalité des annonces : bienveillante dans les quatre styles. */
const STYLES = {
  Professionnel: [
    (c) => `${c.name}, rappel programmé : ${c.title}.`,
    (c) => `${c.name}, il est l’heure de traiter ce point : ${c.title}.`,
    (c) => `Rappel ${c.priority}. ${c.title}.`
  ],
  Amical: [
    (c) => `${c.name}, petit rappel tout doux : ${c.title}.`,
    (c) => `Hé ${c.name}, je pense bien à toi : ${c.title}.`,
    (c) => `${c.name}, ça te dirait de t’occuper de ça ? ${c.title}.`
  ],
  Humoristique: [
    (c) => `${c.name}, pense à ${c.title.toLowerCase()}, parce que ça ne va pas se faire tout seul, promis.`,
    (c) => `${c.name}, alerte importante : ${c.title.toLowerCase()}. Je note tout, tu sais.`,
    (c) => `Bon. ${c.title}. Je t’ai prévenu avec tout le tact dont je suis capable.`,
    (c) => `${c.name}, ${c.title.toLowerCase()}. Et oui, je suis encore là pour ça.`
  ],
  Direct: [
    (c) => `${c.name}. ${c.title}. Maintenant.`,
    (c) => `Priorité ${c.priority}. ${c.title}.`,
    (c) => `${c.name}, action requise : ${c.title}.`
  ]
};

const nextAfter = (date, unit, amount) => {
  const d = new Date(date);
  if (unit === 'hour') d.setHours(d.getHours() + amount);
  else if (unit === 'day') d.setDate(d.getDate() + amount);
  else if (unit === 'month') d.setMonth(d.getMonth() + amount);
  return d;
};

export const Reminders = {
  timer: null, pending: null,
  init() {
    this.tick(); this.scanMissed();
    this.timer = setInterval(() => this.tick(), 30000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.scanMissed(); });
    window.addEventListener('focus', () => this.scanMissed());
  },

  frequencies: FREQUENCIES, categories: CATEGORIES, styles: Object.keys(STYLES),

  /* ---------------- Calcul des occurrences ---------------- */
  occurrenceAt(reminder, fromDate = new Date()) {
    const [hour, minute] = String(reminder.time || '07:00').split(':').map(Number);
    const build = date => { const d = new Date(date); d.setHours(hour, minute, 0, 0); return d; };
    const freq = reminder.repeat?.freq || 'once';
    if (freq === 'hourly') {
      const d = new Date(fromDate); d.setMinutes(minute, 0, 0);
      return d <= fromDate ? nextAfter(d, 'hour', 1) : d;
    }
    if (freq === 'daily') { const d = build(fromDate); return d <= fromDate ? nextAfter(d, 'day', 1) : d; }
    if (freq === 'weekdays') {
      const days = reminder.repeat?.days || [1, 2, 3, 4, 5];
      for (let i = 0; i <= 8; i++) {
        const d = build(nextAfter(fromDate, 'day', i));
        if (days.includes(d.getDay()) && d > fromDate) return d;
      }
      return null;
    }
    if (freq === 'weekly') {
      const base = build(reminder.repeat?.anchor || reminder.date || Utils.iso(fromDate));
      let d = base;
      while (d <= fromDate) d = nextAfter(d, 'day', 7);
      return d;
    }
    if (freq === 'monthly') {
      const day = Number(reminder.repeat?.dayOfMonth || new Date(`${reminder.date || Utils.iso()}T12:00:00`).getDate());
      for (let i = 0; i <= 13; i++) {
        const d = build(nextAfter(fromDate, 'month', i)); d.setDate(day);
        if (d > fromDate) return d;
      }
      return null;
    }
    // Une seule fois : date explicite.
    const d = build(reminder.date || Utils.iso());
    return d > fromDate ? d : null;
  },

  next(reminder, from = new Date()) {
    if (!reminder?.enabled) return null;
    if (reminder.snoozeUntil && Number(reminder.snoozeUntil) > from.getTime()) return new Date(Number(reminder.snoozeUntil));
    return this.occurrenceAt(reminder, from);
  },

  /* Enumère les occurrences passées sur une fenêtre (détection des manqués). */
  occurrencesBetween(reminder, since, until = new Date()) {
    const out = []; let cursor = new Date(since);
    for (let i = 0; i < 12; i++) {
      const occ = this.occurrenceAt(reminder, cursor);
      if (!occ || occ > until) break;
      out.push(occ); cursor = new Date(occ.getTime() + 60000);
    }
    return out;
  },

  /* ---------------- Personnalité ---------------- */
  message(reminder) {
    if (reminder.voiceMessage?.trim()) return reminder.voiceMessage.trim();
    const style = STYLES[reminder.style] ? reminder.style : 'Amical';
    const pool = STYLES[style];
    const seed = String(reminder.id || reminder.title).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return pool[seed % pool.length]({
      name: Store.settings.userName || 'Nils',
      title: reminder.title,
      priority: (reminder.priority || 'Normale').toLowerCase(),
      category: reminder.category || 'rappel'
    });
  },

  /* ---------------- Actions ---------------- */
  log(reminderId, action, detail) {
    Store.commit(data => {
      const reminder = data.reminders.find(r => r.id === reminderId); if (!reminder) return;
      reminder.history = [{ id: Utils.uid('rhist'), action, detail, date: new Date().toISOString() }, ...(reminder.history || [])].slice(0, 40);
    }, { reason: 'reminder-history', silent: true });
  },
  complete(id) {
    const reminder = Repo.get('reminders', id); if (!reminder) return;
    const patch = { snoozeUntil: null };
    if ((reminder.repeat?.freq || 'once') === 'once') { patch.status = 'done'; patch.enabled = false; }
    Repo.update('reminders', id, patch); this.log(id, 'done', 'Rappel marqué comme effectué.');
    Bus.emit('reminder:resolved', { id });
  },
  snooze(id, minutes = 15) {
    const until = Date.now() + Math.max(1, Number(minutes) || 15) * 60000;
    Repo.update('reminders', id, { snoozeUntil: until }); this.log(id, 'snooze', `Reporté de ${minutes} minutes.`);
    return until;
  },
  postpone(id, days = 1) {
    const reminder = Repo.get('reminders', id); if (!reminder) return null;
    const base = reminder.date ? new Date(`${reminder.date}T12:00:00`) : new Date();
    const date = Utils.iso(nextAfter(base, 'day', days));
    Repo.update('reminders', id, { date, snoozeUntil: null }); this.log(id, 'postpone', `Décalé au ${Utils.formatDate(date)}.`);
    return date;
  },
  cancel(id) {
    const reminder = Repo.get('reminders', id); if (!reminder) return;
    Repo.update('reminders', id, { enabled: false, status: 'cancelled', snoozeUntil: null });
    this.log(id, 'cancelled', 'Rappel annulé.');
    Bus.emit('reminder:resolved', { id });
  },

  /* ---------------- Déclenchement ---------------- */
  trigger(reminder, occurrence) {
    const key = occurrence.toISOString();
    const fired = { ...(reminder.fired || {}) }; fired[key] = true;
    Store.commit(data => {
      const item = data.reminders.find(r => r.id === reminder.id); if (!item) return;
      item.fired = Object.fromEntries(Object.entries(fired).slice(-20));
      item.lastTriggeredAt = new Date().toISOString(); item.snoozeUntil = null;
      item.history = [{ id: Utils.uid('rhist'), action: 'triggered', detail: `Déclenché · ${Utils.formatDateTime(occurrence)}`, date: new Date().toISOString() }, ...(item.history || [])].slice(0, 40);
    }, { reason: 'reminder-trigger', silent: true });

    const text = this.message(reminder);
    Notify.push({
      title: reminder.title, body: text, type: reminder.priority === 'Critique' ? 'Alerte' : 'Rappel',
      priority: reminder.priority || 'Normale', source: `Rappel · ${reminder.category || 'Personnel'}`,
      dedupeKey: `reminder-${reminder.id}-${key}`, reminderId: reminder.id, announce: false
    });
    if (reminder.channels?.vocal !== false && Store.settings.voiceEnabled) {
      TTS.speak(text, { automatic: true });
    }
    this.pending = reminder.id;
    Bus.emit('reminder:triggered', { reminder: Repo.get('reminders', reminder.id) });
    return text;
  },

  tick() {
    if (!Store.ready || !Array.isArray(Store.data.reminders)) return;
    const now = new Date();
    Repo.list('reminders').filter(r => r.enabled).forEach(reminder => {
      const fired = reminder.fired || {};
      if (reminder.snoozeUntil) {
        if (now.getTime() >= Number(reminder.snoozeUntil) && now.getTime() - Number(reminder.snoozeUntil) < 120000) {
          this.trigger({ ...reminder, fired }, new Date(Number(reminder.snoozeUntil)));
        }
        return;
      }
      const occ = this.occurrenceAt(reminder, now);
      if (!occ) return;
      // Déclenchement si l'occurrence est passée de moins de 2 minutes et non jouée.
      const diff = now.getTime() - occ.getTime();
      if (diff >= -30000 && diff < 120000 && !fired[occ.toISOString()]) this.trigger(reminder, occ);
    });
  },

  /* Rappels manqués pendant l'absence : signalés une seule fois, jamais répétés. */
  scanMissed() {
    if (!Store.ready || !Array.isArray(Store.data.reminders)) return;
    const since = new Date(Date.now() - 2 * 3600000); const now = new Date();
    Repo.list('reminders').filter(r => r.enabled).forEach(reminder => {
      const fired = reminder.fired || {};
      this.occurrencesBetween(reminder, since, now).forEach(occ => {
        const key = occ.toISOString();
        if (fired[key]) return;
        const age = now.getTime() - occ.getTime();
        if (age < 90000) { this.trigger(reminder, occ); return; }
        Store.commit(data => {
          const item = data.reminders.find(r => r.id === reminder.id); if (!item) return;
          const firedNow = { ...(item.fired || {}) }; firedNow[key] = true;
          item.fired = Object.fromEntries(Object.entries(firedNow).slice(-20));
          item.status = 'missed';
          item.history = [{ id: Utils.uid('rhist'), action: 'missed', detail: `Manqué · ${Utils.formatDateTime(occ)}`, date: new Date().toISOString() }, ...(item.history || [])].slice(0, 40);
        }, { reason: 'reminder-missed', silent: true });
        Notify.push({ title: 'Rappel manqué', body: `${reminder.title} · prévu à ${Utils.formatDateTime(occ)}`, type: 'Information', priority: 'Normale', source: 'Rappels', dedupeKey: `reminder-missed-${reminder.id}-${key}`, announce: false });
      });
    });
  },

  /* ---------------- Suggestions anti-répétition ---------------- */
  suggestions() {
    const today = Utils.iso(); const proposals = [];
    const existingTitles = new Set(Repo.list('reminders').map(r => normalize(r.title)));
    const push = (title, detail, linkType, linkId) => {
      if (existingTitles.has(normalize(title))) return;
      proposals.push({ title, detail, linkType, linkId });
    };
    Repo.list('tasks').filter(t => t.status !== 'done' && t.due && t.due <= Utils.day(2) && t.due >= Utils.day(-2)).slice(0, 3)
      .forEach(task => push(`Traitée : ${task.title}`, `Tâche ${task.due < today ? 'en retard' : 'à échéance proche'} · ${task.priority}`, 'task', task.id));
    Selectors.goals().late.slice(0, 2).forEach(goal => push(`Objectif en retard : ${goal.name}`, `Échéance ${Utils.formatDate(goal.deadline)}`, 'goal', goal.id));
    Selectors.habits().items.filter(h => !h.doneToday && h.targetPerWeek > 2).slice(0, 2)
      .forEach(habit => push(`${habit.name} aujourd’hui`, `Habitude · ${habit.weekCount}/${habit.targetPerWeek} cette semaine`, 'habit', habit.id));
    Selectors.todayEvents().slice(0, 2).forEach(event => push(`Préparer : ${event.title}`, `Événement à ${event.start}`, 'event', event.id));
    return proposals.slice(0, 6);
  },

  stats() {
    const list = Array.isArray(Store.data.reminders) ? Store.data.reminders : [];
    const today = Utils.iso();
    return {
      all: list,
      today: list.filter(r => r.enabled && this.next(r) && Utils.iso(this.next(r)) === today),
      upcoming: list.filter(r => r.enabled && this.next(r) && Utils.iso(this.next(r)) !== today),
      recurring: list.filter(r => r.enabled && (r.repeat?.freq || 'once') !== 'once'),
      done: list.filter(r => r.status === 'done'),
      missed: list.filter(r => r.status === 'missed'),
      disabled: list.filter(r => !r.enabled)
    };
  }
};

const normalize = text => String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
