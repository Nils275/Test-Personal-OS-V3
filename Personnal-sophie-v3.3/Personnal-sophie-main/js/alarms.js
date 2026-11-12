/* PERSONAL OS — Réveils locaux : récurrence, sonnerie et report.
   Ils nécessitent que l'application reste ouverte. Aucun arrière-plan Android simulé. */
import { Store, Repo, Notify, Utils, Bus } from './core.js';

export const Alarms = {
  speak: null, timer: null, audio: null,
  init({ speak }) { this.speak = speak; this.tick(); this.timer = setInterval(() => this.tick(), 1000); },
  next(alarm, from = new Date()) {
    if (!alarm?.enabled) return null;
    if (alarm.snoozeUntil && Number(alarm.snoozeUntil) > from.getTime()) return new Date(Number(alarm.snoozeUntil));
    for (let offset = 0; offset <= 8; offset++) {
      const date = Utils.day(offset, from); const jsDay = new Date(`${date}T12:00:00`).getDay();
      if (alarm.date && alarm.date !== date) { if (alarm.date < date) return null; continue; }
      if (!alarm.date && Array.isArray(alarm.days) && alarm.days.length && !alarm.days.includes(jsDay)) continue;
      if (!alarm.date && (!alarm.days || !alarm.days.length) && offset > 1) return null;
      const candidate = new Date(`${date}T${alarm.time || '07:00'}:00`);
      if (candidate > from) return candidate;
      if (alarm.date) return null;
    }
    return null;
  },
  enableWork(time = '07:00') {
    const existing = Repo.list('alarms').find(alarm => /travail/i.test(alarm.name));
    const patch = { name: 'Réveil travail', time, days: [1, 2, 3, 4, 5], date: '', enabled: true, snoozeUntil: null };
    const alarm = existing ? Repo.update('alarms', existing.id, patch, 'assistant') : Repo.create('alarms', { ...patch, lastTriggeredKey: '' }, 'assistant');
    return { alarm, next: this.next(alarm) };
  },
  setOneTime(time, name = 'Réveil') {
    let date = Utils.iso(); if (new Date(`${date}T${time}:00`) <= new Date()) date = Utils.day(1);
    const alarm = Repo.create('alarms', { name, time, days: [], date, enabled: true, lastTriggeredKey: '', snoozeUntil: null }, 'assistant');
    return { alarm, next: this.next(alarm) };
  },
  chime() {
    try {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext; if (!Audio) return false;
      this.audio = this.audio || new Audio(); this.audio.resume?.();
      const start = this.audio.currentTime + .03;
      [0, .38, .76, 1.35, 1.73, 2.11].forEach((offset, index) => {
        const oscillator = this.audio.createOscillator(); const gain = this.audio.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = index % 3 === 2 ? 880 : 660;
        gain.gain.setValueAtTime(0, start + offset); gain.gain.linearRampToValueAtTime(.18, start + offset + .025); gain.gain.exponentialRampToValueAtTime(.001, start + offset + .28);
        oscillator.connect(gain).connect(this.audio.destination); oscillator.start(start + offset); oscillator.stop(start + offset + .3);
      });
      return true;
    } catch (error) { console.info('Sonnerie audio non autorisée par le navigateur', error.message); return false; }
  },
  trigger(alarm, key) {
    if (alarm.lastTriggeredKey === key) return;
    Repo.update('alarms', alarm.id, { lastTriggeredKey: key, snoozeUntil: null });
    this.chime();
    this.speak?.(`Réveil ${alarm.name}. Il est ${new Date().getHours()} heures ${String(new Date().getMinutes()).padStart(2, '0')}.`, { force: true });
    Notify.push({ title: `Réveil · ${alarm.name}`, body: `Il est ${Utils.formatTime(new Date())}. Ouvrez PERSONAL OS pour arrêter ou reporter.`, type: 'Alerte', priority: 'Critique', source: 'Réveils', dedupeKey: `alarm-${alarm.id}-${key}`, announce: false });
    Bus.emit('alarm:triggered', { alarm: Repo.get('alarms', alarm.id) });
  },
  tick() {
    if (!Store.ready || !Array.isArray(Store.data.alarms)) return;
    const now = new Date(); const today = Utils.iso(now); const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    Repo.list('alarms').filter(alarm => alarm.enabled).forEach(alarm => {
      if (alarm.snoozeUntil) {
        if (now.getTime() >= Number(alarm.snoozeUntil) && now.getTime() - Number(alarm.snoozeUntil) < 60000) this.trigger(alarm, `snooze-${alarm.snoozeUntil}`);
        return;
      }
      if (alarm.date && alarm.date !== today) return;
      if (!alarm.date && alarm.days?.length && !alarm.days.includes(now.getDay())) return;
      if (alarm.time === currentTime) this.trigger(alarm, `${today}-${currentTime}`);
    });
  },
  snooze(id, minutes = 5) {
    const until = Date.now() + Math.max(1, Number(minutes) || 5) * 60000;
    Repo.update('alarms', id, { snoozeUntil: until }); return until;
  },
  dismiss(id) {
    const alarm = Repo.get('alarms', id); if (!alarm) return;
    Repo.update('alarms', id, { snoozeUntil: null, enabled: alarm.date ? false : alarm.enabled });
  }
};
