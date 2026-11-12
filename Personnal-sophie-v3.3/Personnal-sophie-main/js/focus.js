/* PERSONAL OS — Focus et minuteur persistant, sans dépendance.
   L'heure de fin absolue évite la dérive et survit aux rechargements. */
import { Store, Notify, Utils, Bus } from './core.js';

const fallback = () => ({ mode: 'work', durations: { work: 25, break: 5 }, remaining: 1500, running: false, endAt: null, cycles: 0, custom: false, timerDuration: 0, label: '' });

export const Focus = {
  timer: null,
  config() {
    if (!Store.settings.focus) Store.settings.focus = fallback();
    const focus = Store.settings.focus;
    focus.durations = { work: 25, break: 5, ...(focus.durations || {}) };
    if (!['work', 'break'].includes(focus.mode)) focus.mode = 'work';
    if (!Number.isFinite(Number(focus.remaining))) focus.remaining = Number(focus.durations[focus.mode]) * 60;
    return focus;
  },
  duration(mode = this.config().mode) {
    const focus = this.config();
    if (focus.custom && Number(focus.timerDuration) > 0) return Number(focus.timerDuration);
    return Math.max(60, Number(focus.durations[mode] || (mode === 'work' ? 25 : 5)) * 60);
  },
  snapshot() {
    const focus = this.config();
    const remaining = focus.running && focus.endAt ? Math.max(0, Math.ceil((Number(focus.endAt) - Date.now()) / 1000)) : Math.max(0, Number(focus.remaining) || 0);
    const duration = this.duration(focus.mode);
    return { mode: focus.mode, running: Boolean(focus.running), remaining, duration, cycles: Number(focus.cycles) || 0, custom: Boolean(focus.custom),
      progress: Utils.clamp((1 - remaining / duration) * 100, 0, 100), label: focus.custom ? (focus.label || 'Minuteur') : focus.mode === 'work' ? 'Concentration' : 'Récupération' };
  },
  init() {
    this.tick(); this.timer = setInterval(() => this.tick(), 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.tick(); });
  },
  toggle() {
    const focus = this.config();
    if (focus.running) {
      focus.remaining = Math.max(0, Math.ceil((Number(focus.endAt) - Date.now()) / 1000)); focus.running = false; focus.endAt = null;
    } else {
      if (focus.remaining <= 0) focus.remaining = this.duration(focus.mode);
      focus.endAt = Date.now() + Number(focus.remaining) * 1000; focus.running = true;
    }
    Store.saveSettings(); this.tick(); return focus.running;
  },
  startCustom(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 1 || value > 86400) throw new Error('Le minuteur doit durer entre 1 seconde et 24 heures.');
    const focus = this.config(); focus.custom = true; focus.label = 'Minuteur'; focus.timerDuration = Math.round(value);
    focus.remaining = Math.round(value); focus.endAt = Date.now() + Math.round(value) * 1000; focus.running = true;
    Store.saveSettings(); this.tick(); return this.snapshot();
  },
  reset() {
    const focus = this.config(); focus.running = false; focus.endAt = null; focus.custom = false; focus.label = ''; focus.timerDuration = 0; focus.remaining = this.duration(focus.mode);
    Store.saveSettings(); this.tick();
  },
  setMode(mode) {
    if (!['work', 'break'].includes(mode)) return;
    const focus = this.config(); focus.mode = mode; focus.running = false; focus.endAt = null; focus.custom = false; focus.label = ''; focus.timerDuration = 0; focus.remaining = this.duration(mode);
    Store.saveSettings(); this.tick();
  },
  setDuration(minutes) {
    const value = Number(minutes);
    if (!Number.isFinite(value) || value < 1 || value > 180) throw new Error('Choisissez une durée entre 1 et 180 minutes.');
    const focus = this.config(); focus.durations[focus.mode] = value; focus.running = false; focus.endAt = null; focus.custom = false; focus.label = ''; focus.timerDuration = 0; focus.remaining = value * 60;
    Store.saveSettings(); this.tick();
  },
  complete() {
    const focus = this.config(); const finishedMode = focus.mode; const completedAt = focus.endAt; const wasCustom = focus.custom; const customDuration = focus.timerDuration;
    if (finishedMode === 'work' && !wasCustom) focus.cycles = (Number(focus.cycles) || 0) + 1;
    if (!wasCustom) focus.mode = finishedMode === 'work' ? 'break' : 'work';
    focus.running = false; focus.endAt = null; focus.custom = false; focus.label = ''; focus.timerDuration = 0; focus.remaining = this.duration(focus.mode);
    Store.saveSettings();
    Notify.push({
      title: wasCustom ? 'Minuteur terminé' : finishedMode === 'work' ? 'Session Focus terminée' : 'Pause terminée',
      body: wasCustom ? `Le minuteur de ${Math.floor(customDuration / 60)} min ${customDuration % 60} s est terminé.` : finishedMode === 'work' ? `Cycle ${focus.cycles} validé. Une récupération de ${focus.durations.break} minutes est prête.` : 'La récupération est terminée. Le prochain cycle de concentration est prêt.',
      type: 'Rappel', priority: 'Haute', source: wasCustom ? 'Minuteur' : 'Focus', dedupeKey: `focus-complete-${completedAt}`
    });
    Bus.emit('focus:completed', { finishedMode, cycles: focus.cycles, custom: wasCustom });
  },
  tick() {
    const focus = this.config();
    if (focus.running && focus.endAt && Number(focus.endAt) <= Date.now()) this.complete();
    const state = this.snapshot();
    const time = `${String(Math.floor(state.remaining / 60)).padStart(2, '0')}:${String(state.remaining % 60).padStart(2, '0')}`;
    document.querySelectorAll('[data-focus-time]').forEach(node => { node.textContent = time; });
    document.querySelectorAll('[data-focus-ring]').forEach(node => node.style.setProperty('--focus-progress', `${state.progress * 3.6}deg`));
    document.querySelectorAll('[data-focus-state]').forEach(node => { node.textContent = state.running ? `${state.label} en cours` : `${state.label} · prêt`; });
    document.querySelectorAll('[data-focus-widget]').forEach(node => node.classList.toggle('is-running', state.running));
  }
};
