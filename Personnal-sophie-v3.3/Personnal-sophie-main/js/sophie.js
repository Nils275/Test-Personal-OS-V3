/* SOPHIE — Copilote personnel : intentions, outils, mémoire, briefings et recherche.
   Moteur local vérifiable. Un connecteur LLM peut être branché via llmEndpoint,
   mais aucune requête n'est envoyée tant qu'il n'est pas configuré. */
import { Store, Repo, Selectors, Notify, Utils, Bus, Taxonomy, Weather, Spotify } from './core.js';
import { Toast } from './ui.js';
import { News } from './news.js';

import { Focus } from './focus.js';
import { Reminders } from './reminders.js';
import { Camera } from './camera.js';

const normalize = text => String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();
const cap = text => text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
const money = value => `${String(value).replace('.', ',')} euros`;

export const Sophie = {
  navigate: null, refresh: null, pending: null, wakeListening: false,

  init({ navigate, refresh, openEditor }) {
    this.navigate = navigate; this.refresh = refresh; this.openEditor = openEditor;
    if (!Array.isArray(Store.data.sophieMemory)) Store.data.sophieMemory = [];
    setInterval(() => this.schedule(), 60000); this.schedule();
    Bus.on('tts:fallback', info => Toast.show(`Voix ElevenLabs indisponible (${info.message}). Repli sur la voix native.`, 'info', 5000));
  },

  /* ---------------- Mémoire personnelle contrôlée ---------------- */
  memory: {
    list(kind = null) {
      const items = [...(Store.data.sophieMemory || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
      return kind ? items.filter(item => item.kind === kind) : items;
    },
    add(text, kind = 'Permanente', tags = []) {
      const item = { id: Utils.uid('memory'), text: String(text).trim().slice(0, 400), kind, tags, date: new Date().toISOString() };
      if (!item.text) return null;
      const ok = Store.commit(data => { data.sophieMemory.unshift(item); data.sophieMemory = data.sophieMemory.slice(0, 120); }, { reason: 'memory', silent: true });
      return ok ? item : null;
    },
    remove(id) { return Store.commit(data => { data.sophieMemory = (data.sophieMemory || []).filter(item => item.id !== id); }, { reason: 'memory', silent: true }); },
    context(limit = 6) { return this.list('Permanente').slice(0, limit).map(item => `• ${item.text}`).join('\n'); }
  },

  /* ---------------- Registre d'outils (function calling local) ---------------- */
  tools: [
    { name: 'create_task', label: 'Créer une tâche', module: 'Projets', sensitive: false },
    { name: 'create_event', label: 'Créer un événement', module: 'Calendrier', sensitive: false },
    { name: 'create_sport_session', label: 'Enregistrer une séance', module: 'Sport', sensitive: false },
    { name: 'add_sport_performance', label: 'Ajouter des performances', module: 'Sport', sensitive: false },
    { name: 'create_expense', label: 'Enregistrer une dépense', module: 'Finances', sensitive: true },
    { name: 'create_note', label: 'Créer une note', module: 'Journal', sensitive: false },
    { name: 'create_goal', label: 'Créer un objectif', module: 'Objectifs', sensitive: false },
    { name: 'get_daily_schedule', label: 'Lire le programme du jour', module: 'Calendrier', sensitive: false },
    { name: 'get_project_details', label: 'Lire un projet', module: 'Projets', sensitive: false },
    { name: 'get_weekly_report', label: 'Produire le bilan hebdomadaire', module: 'Tous', sensitive: false },
    { name: 'get_notifications', label: 'Lire les notifications', module: 'Notifications', sensitive: false }
  ],
  runTool(name, args = {}, { confirmed = true } = {}) {
    const now = new Date().toISOString();
    switch (name) {
      case 'create_task': {
        const item = Repo.create('tasks', { title: args.title, projectId: args.projectId || '', goalId: '', due: args.due || Utils.iso(), status: 'todo', priority: args.priority || 'Normale', notes: `Créée par SOPHIE · ${args.notes || ''}` }, 'assistant');
        return item ? `Tâche « ${item.title} » créée.` : 'La tâche n’a pas pu être créée.';
      }
      case 'create_event': {
        const item = Repo.create('events', { title: args.title, date: args.date || Utils.iso(), start: args.start || '09:00', end: args.end || '', category: args.category || 'Personnel', description: args.description || 'Créé par SOPHIE', projectId: args.projectId || '', reminder: Number(args.reminder ?? 30) }, 'assistant');
        return item ? `Événement « ${item.title} » programmé le ${Utils.formatDate(item.date)} à ${item.start}.` : 'Événement non enregistré.';
      }
      case 'create_sport_session': {
        const item = Repo.create('sessions', { type: args.type || 'Autre', date: args.date || Utils.localDateTime(), duration: Number(args.duration || 0), distance: Number(args.distance || 0), reps: Number(args.reps || 0), feeling: 0, performance: args.performance || '', notes: 'Créée par SOPHIE.', status: 'Terminée' }, 'assistant');
        return item ? `Séance ${item.type} enregistrée : ${item.duration || 0} min${item.distance ? ` · ${item.distance} km` : ''}${item.reps ? ` · ${item.reps} répétitions` : ''}.` : 'Séance non enregistrée.';
      }
      case 'add_sport_performance': {
        const today = Utils.iso(); const session = Repo.list('sessions').find(s => s.status !== 'Planifiée' && s.date?.startsWith(today)) ||
          Repo.create('sessions', { type: args.type || 'Autre', date: Utils.localDateTime(), duration: 0, distance: 0, reps: 0, feeling: 0, performance: '', notes: 'Séance créée par SOPHIE.', status: 'Terminée' }, 'assistant');
        const patch = { type: args.type && (!session.performance || session.type === 'Autre') ? args.type : session.type };
        patch.reps = Number(session.reps || 0) + Number(args.reps || 0);
        patch.duration = Number(session.duration || 0) + Number(args.duration || 0);
        if (args.distance) patch.distance = Number(session.distance || 0) + Number(args.distance);
        patch.performance = [session.performance, args.performance].filter(Boolean).join(' · ').slice(0, 240);
        const updated = Repo.update('sessions', session.id, patch);
        return updated ? `Performance ajoutée à la séance de ${updated.type} : ${patch.reps} répétitions cumulées, ${patch.duration} minutes.` : 'Performance non enregistrée.';
      }
      case 'create_expense': {
        if (!confirmed) return '__CONFIRM__';
        const item = Repo.create('transactions', { type: 'expense', label: args.label, category: args.category || 'Autre', amount: Number(args.amount), date: args.date || Utils.iso(), notes: 'Dépense dictée à SOPHIE.' }, 'assistant');
        const stats = Selectors.finance(Utils.monthKey(item.date));
        return `Dépense de ${money(item.amount)} enregistrée dans ${item.category}. Budget restant : ${money(Math.round(stats.remaining * 100) / 100)}.`;
      }
      case 'create_note': {
        const item = Repo.create('journal', { type: args.type || 'Note', title: args.title, text: args.text || args.title, date: Utils.localDateTime(), tags: args.tags || [] }, 'assistant');
        return item ? `Note enregistrée dans le journal : « ${item.title} ».` : 'Note non enregistrée.';
      }
      case 'create_goal': {
        const item = Repo.create('goals', { name: args.name, category: args.category || 'Personnel', priority: args.priority || 'Normale', start: Utils.iso(), deadline: args.deadline || Utils.day(30), current: 0, target: args.target || 100, unit: args.unit || '%', description: args.description || 'Créé par SOPHIE.', steps: [], comments: [], history: [{ id: Utils.uid('hist'), text: 'Objectif créé par SOPHIE.', date: now }] }, 'assistant');
        return item ? `Objectif « ${item.name} » créé avec une cible de ${item.target} ${item.unit}.` : 'Objectif non créé.';
      }
      case 'get_daily_schedule': return this.dailyReport();
      case 'get_project_details': {
        const project = args.projectId ? Repo.get('projects', args.projectId) : Repo.list('projects').find(p => normalize(p.name).includes(normalize(args.query || '')));
        if (!project) return 'Aucun projet correspondant.';
        const tasks = Repo.list('tasks').filter(t => t.projectId === project.id && t.status !== 'done');
        return `${project.name} : ${project.progress}% réalisé, statut ${project.status}. ${tasks.length} tâche(s) ouverte(s)${tasks[0] ? `, prochaine : ${tasks[0].title}` : ''}. Échéance : ${project.deadline ? Utils.formatDate(project.deadline, { year: 'numeric' }) : 'non définie'}.`;
      }
      case 'get_weekly_report': return this.weeklyReport();
      case 'get_notifications': return `${Selectors.unread()} notification(s) non lue(s). ${Repo.list('notifications').slice(0, 3).map(n => n.title).join(' · ') || 'Aucune notification.'}`;
      default: return `Outil ${name} inconnu.`;
    }
  },

  /* ---------------- Recherche universelle ---------------- */
  search(query) {
    const q = normalize(query); if (q.length < 2) return [];
    const matches = [];
    const push = (module, title, detail, section, id = '') => { if (normalize(`${title} ${detail}`).includes(q)) matches.push({ module, title, detail, section, id }); };
    Repo.list('projects').forEach(p => push('Projets', p.name, `${p.description || ''} ${p.category}`, 'projects', p.id));
    Repo.list('tasks').forEach(t => push('Tâches', t.title, t.notes || '', 'projects', t.id));
    Repo.list('journal').forEach(n => push('Journal', n.title, `${n.text || ''} ${(n.tags || []).join(' ')}`, 'journal', n.id));
    Repo.list('events').forEach(e => push('Calendrier', e.title, e.description || '', 'calendar', e.id));
    Repo.list('goals').forEach(g => push('Objectifs', g.name, `${g.description || ''} ${g.category}`, 'goals', g.id));
    Repo.list('transactions').forEach(t => push('Finances', t.label, `${t.category} ${t.notes || ''}`, 'finances', t.id));
    Repo.list('sessions').forEach(s => push('Sport', `${s.type} · ${s.performance || ''}`, s.notes || '', 'sport', s.id));
    Repo.list('devices').forEach(d => push('Appareils', d.name, `${d.brand} ${d.model} ${d.notes || ''}`, 'devices', d.id));
    (Store.data.sophieMemory || []).forEach(m => push('Mémoire de Sophie', m.text, m.kind, 'assistant', m.id));
    return matches.slice(0, 24);
  },

  /* ---------------- Rapports ---------------- */
  dailyReport() {
    const events = Selectors.todayEvents(); const tasks = Repo.list('tasks').filter(t => t.due === Utils.iso() && t.status !== 'done');
    const goals = Selectors.goals(); const finance = Selectors.finance(); const sessions = Selectors.sport().week;
    return `Programme du jour : ${events.length ? events.map(e => `${e.title} à ${e.start}`).join(', ') : 'aucun rendez-vous'}. ` +
      `${tasks.length} tâche(s) à traiter${tasks[0] ? ` dont « ${tasks[0].title} »` : ''}. ` +
      `Objectifs : ${goals.active.length} actif(s), ${goals.late.length} en retard. ` +
      `Finances du mois : solde de ${money(Math.round(finance.balance))}, ${finance.budget ? `${money(Math.round(finance.remaining))} de budget restant` : 'aucun budget défini'}. ` +
      `Sport : ${sessions.length} séance(s) cette semaine.`;
  },
  weeklyReport() {
    const goals = Selectors.goals(); const finance = Selectors.finance(); const sport = Selectors.sport();
    const tasks = Repo.list('tasks'); const done = tasks.filter(t => t.status === 'done').length; const late = tasks.filter(t => t.status !== 'done' && t.due && t.due < Utils.iso());
    const projects = Selectors.projects();
    return `Bilan de la semaine : ${done} tâche(s) terminée(s), ${late.length} en retard. ` +
      `Sport : ${sport.week.length} séance(s), ${sport.week.reduce((s, x) => s + Number(x.duration || 0), 0)} minutes, ${Utils.round(sport.distance, 1)} km au total. ` +
      `Objectifs : progression moyenne de ${goals.average}%, ${goals.late.length} échéance(s) dépassée(s). ` +
      `Finances : dépenses du mois de ${money(Math.round(finance.expense))}${finance.budget ? ` sur un budget de ${money(Math.round(finance.budget))}` : ''}. ` +
      `Projets à surveiller : ${projects.active.slice(0, 2).map(p => `${p.name} à ${p.progress}%`).join(', ') || 'aucun'}. ` +
      `Pour la semaine prochaine, je recommande de traiter ${late[0] ? `en priorité « ${late[0].title} »` : 'les échéances les plus proches'}.`;
  },
  briefing() {
    const weather = Store.settings.weather.data;
    const meteo = weather ? `Il fait ${Math.round(weather.temperature_2m)} degrés, ${Weather.codes[weather.weather_code] || 'conditions variables'}.` : 'Aucun relevé météo configuré.';
    return `Bonjour. ${meteo} ${this.dailyReport()}`;
  },

  /* ---------------- Planificateur (briefing matinal, bilan hebdomadaire) ---------------- */
  schedule() {
    if (!Store.ready) return;
    const now = new Date(); const today = Utils.iso(now); const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const morning = Store.settings.morningBriefing || {};
    if (morning.enabled && morning.lastDate !== today && time === (morning.time || '07:15')) {
      Store.setSetting('morningBriefing', { ...morning, lastDate: today });
      Notify.push({ title: 'Briefing du matin', body: this.briefing().slice(0, 240), type: 'Information', priority: 'Haute', source: 'SOPHIE', dedupeKey: `morning-${today}`, announce: false });
      Bus.emit('sophie:briefing', { text: this.briefing() });
    }
    const weekly = Store.settings.weeklyReport || {};
    if (weekly.enabled && weekly.lastDate !== Utils.iso(Utils.startOfWeek(now)) && now.getDay() === (Number(weekly.day ?? 0)) && time === (weekly.time || '19:00')) {
      Store.setSetting('weeklyReport', { ...weekly, lastDate: Utils.iso(Utils.startOfWeek(now)) });
      Notify.push({ title: 'Bilan hebdomadaire', body: this.weeklyReport().slice(0, 240), type: 'Information', priority: 'Normale', source: 'SOPHIE', dedupeKey: `weekly-${Utils.iso(Utils.startOfWeek(now))}`, announce: false });
      Bus.emit('sophie:weekly', { text: this.weeklyReport() });
    }
  },

  log(command, response) {
    Store.commit(data => {
      const date = new Date().toISOString();
      data.assistant.push({ id: Utils.uid('chat'), role: 'user', text: command, date });
      data.assistant.push({ id: Utils.uid('chat'), role: 'assistant', text: response, date: new Date().toISOString() });
      data.assistant = data.assistant.slice(-140);
    }, { reason: 'assistant', silent: true });
  },

  /* ---------------- Confirmation d'action sensible ---------------- */
  confirmPending(text) {
    if (!this.pending) return null;
    if (/^(confirme|confirmer|oui|vas y|valide|c est bon)/.test(text)) {
      const { tool, args, label } = this.pending; this.pending = null;
      return this.runTool(tool, args, { confirmed: true }) + (label ? '' : '');
    }
    if (/^(annule|annuler|non|non merci|oublie)/.test(text)) { this.pending = null; return 'Action annulée. Je n’ai rien enregistré.'; }
    return null;
  },

  /* ---------------- Commandes personnalisées : « Hey Sophie … » → votre réponse ---------------- */
  matchCustom(text) {
    const said = normalize(text);
    return (Store.data.customCommands || []).find(command => (command.triggers || []).some(trigger => {
      const wanted = normalize(trigger);
      if (!wanted) return false;
      if (said.includes(wanted)) return true;
      const words = wanted.split(' ').filter(word => word.length > 2);
      return words.length > 1 && words.every(word => said.includes(word));
    })) || null;
  },
  /* Variables disponibles dans une réponse personnalisée. */
  renderResponse(template) {
    const now = new Date();
    const weather = Store.settings.weather.data;
    return String(template || '')
      .replace(/\{nom\}/gi, Store.settings.userName || 'Nils')
      .replace(/\{assistante\}/gi, Store.settings.assistantName || 'Sophie')
      .replace(/\{date\}/gi, Utils.formatLongDate(now))
      .replace(/\{heure\}/gi, new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(now))
      .replace(/\{meteo\}/gi, weather ? `${Math.round(weather.temperature_2m)} degrés` : 'non disponible')
      .replace(/\{jour\}/gi, new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(now));
  },

  /* ---------------- Moteur d'intentions ---------------- */
  async execute(rawCommand, source = 'text') {
    const raw = String(rawCommand || '').trim().replace(/^(?:h[ée] sophie|dis sophie|ok sophie|sophie|hey sophie)[,;\s-]*/i, '').trim();
    if (!raw) return 'Je t’écoute. Formule ta demande, par exemple : qu’est-ce que j’ai aujourd’hui ?';
    const text = normalize(raw);
    const answered = this.confirmPending(text);
    if (answered) { this.log(raw, answered); return answered; }

    let response = '';
    let section = null;
    try {
      // Les commandes personnalisées de l'utilisateur ont la priorité sur le moteur intégré.
      const custom = this.matchCustom(text);
      if (custom) {
        response = this.renderResponse(custom.response);
        section = custom.action || null;
        this.log(raw, response);
        if (section && section !== 'assistant' && this.navigate) this.navigate(section); else this.refresh?.();
        return response;
      }
      // « Active l'alarme » / « Désactive l'alarme » : la caméra de surveillance (fictive) suit.
      const cameraIntent = Camera.interpret(text);
      if (cameraIntent) { response = await cameraIntent; this.log(raw, response); return response; }
      if (/qui es tu|tu es qui|presente toi/.test(text)) {
        response = `Je suis ${Store.settings.assistantName || 'Sophie'}, ton copilote personnel dans PERSONAL OS. Je consulte tes modules, je mémorise ce que tu me confies et j’exécute les actions autorisées.`;
      } else if (/rappel/.test(text) && /(mes rappels|liste des rappels|quels rappels)/.test(text)) {
        const stats = Reminders.stats();
        response = `Tu as ${stats.today.length} rappel(s) aujourd’hui, ${stats.upcoming.length} à venir et ${stats.recurring.length} récurrent(s).${stats.missed.length ? ` ${stats.missed.length} rappel(s) manqué(s).` : ''}`;
        section = 'reminders';
      } else if (/rappel/.test(text) && /(c est fait|c est bon|j ai fini|termine|fini|c est regle)/.test(text)) {
        const target = Repo.get('reminders', Reminders.pending) || Reminders.stats().all.find(r => r.enabled);
        if (!target) response = 'Aucun rappel en attente. Tout est à jour.';
        else { Reminders.complete(target.id); Reminders.pending = null; response = `C’est noté : « ${target.title} » est terminé.`; section = 'reminders'; }
      } else if (/rappel/.test(text) && /(demain|decale|repousse|plus tard|reporte)/.test(text)) {
        const target = Repo.get('reminders', Reminders.pending) || Reminders.stats().all.find(r => r.enabled);
        if (!target) response = 'Aucun rappel à décaler.';
        else if (/demain/.test(text)) { const date = Reminders.postpone(target.id, 1); Reminders.pending = null; response = `D’accord, c’est décalé au ${Utils.formatDate(date)}.`; section = 'reminders'; }
        else { const until = Reminders.snooze(target.id, 15); response = `Je te le rappelle à ${Utils.formatTime(until)}.`; section = 'reminders'; }
      } else if (/rappel/.test(text) && /(annule|annuler|supprime|oublie)/.test(text)) {
        const target = Repo.get('reminders', Reminders.pending) || Reminders.stats().all.find(r => r.enabled);
        if (!target) response = 'Aucun rappel à annuler.';
        else { Reminders.cancel(target.id); Reminders.pending = null; response = `Rappel « ${target.title} » annulé.`; section = 'reminders'; }
      } else if (/(rappelle moi|rappelle moi de|ajoute un rappel|creer un rappel|un rappel)/.test(text)) {
        const inMatch = text.match(/dans\s+(\d+)\s*(minute|minutes|min|heure|heures|h)\b/);
        const atMatch = text.match(/(?:a|a)\s+(\d{1,2})(?:h|:)(\d{2})?/);
        let title = raw.replace(/.*?(rappelle moi(?: de)?|ajoute un rappel|creer un rappel|un rappel)\s*(de|d |pour|:)?\s*/i, '')
          .replace(/\s*\ba\s+\d{1,2}(?:h|:)\d{0,2}.*$/i, '').replace(/\s*dans\s+\d+\s*(minute|minutes|min|heure|heures|h).*$/i, '')
          .replace(/\s*demain.*$/i, '').replace(/[.!?]+$/, '').trim();
        if (!title) title = 'Rappel dicté';
        let date = Utils.iso(); let time = '08:00';
        if (inMatch) {
          const value = Number(inMatch[1]); const isHour = ['heure', 'heures', 'h'].includes(inMatch[2]);
          const target = new Date(Date.now() + value * (isHour ? 3600000 : 60000));
          date = Utils.iso(target); time = `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`;
        } else if (atMatch) {
          time = `${String(Math.min(23, Number(atMatch[1]))).padStart(2, '0')}:${String(Math.min(59, Number(atMatch[2] || 0))).padStart(2, '0')}`;
          if (new Date(`${date}T${time}:00`) <= new Date()) date = Utils.day(1);
        }
        if (/demain/.test(text)) date = Utils.day(1);
        const item = Repo.create('reminders', {
          title: cap(title), description: 'Rappel créé par commande vocale.', voiceMessage: '', category: 'Autre',
          priority: 'Normale', style: Store.settings.reminderStyle || 'Amical', time, date,
          repeat: { freq: 'once', days: [], anchor: date }, channels: { inApp: true, vocal: true, system: true },
          enabled: true, status: 'active', source: 'Voix', history: [], fired: {}, snoozeUntil: null
        }, 'assistant');
        if (!item) throw new Error('Le rappel n’a pas pu être créé.');
        response = `D’accord, je te rappelle « ${item.title} » ${inMatch ? `dans ${inMatch[1]} ${inMatch[2]}` : `le ${Utils.formatDate(date)} à ${time.replace(':', ' heures ')}`}.`;
        section = 'reminders';
      } else if (/(minuteur|minuterie)/.test(text) && /(arrete|stop|annule)/.test(text)) {
        Focus.reset(); response = 'Minuteur arrêté et réinitialisé.'; section = 'dashboard';
      } else if (/(minuteur|minuterie)/.test(text)) {
        const match = text.match(/(\d+(?:[.,]\d+)?)\s*(seconde|secondes|minute|minutes|min|heure|heures|h)\b/);
        if (!match) response = 'Quelle durée pour le minuteur ? Par exemple : mets un minuteur de 5 minutes.';
        else {
          const value = Number(match[1].replace(',', '.')); const unit = match[2];
          Focus.startCustom(value * (['heure', 'heures', 'h'].includes(unit) ? 3600 : ['seconde', 'secondes'].includes(unit) ? 1 : 60));
          response = `Minuteur de ${value} ${unit} lancé. Je te préviens à la fin.`; section = 'dashboard';
        }
      } else if (/reveil/.test(text) && /travail/.test(text)) {
        const match = text.match(/(\d{1,2})(?:h|:)(\d{2})?/);
        const time = match ? `${String(Math.min(23, Number(match[1]))).padStart(2, '0')}:${String(Math.min(59, Number(match[2] || 0))).padStart(2, '0')}` : '07:00';
        const payload = {
          title: 'Réveil travail', description: 'Réveil de semaine créé par commande vocale.', voiceMessage: '',
          category: 'Routine', priority: 'Haute', style: Store.settings.reminderStyle || 'Amical', time, date: Utils.iso(),
          repeat: { freq: 'weekdays', days: [1, 2, 3, 4, 5], anchor: Utils.iso() },
          channels: { inApp: true, vocal: true, system: true }, enabled: true, status: 'active', source: 'Voix',
          history: [], fired: {}, snoozeUntil: null
        };
        const existing = Repo.list('reminders').find(r => /travail/i.test(r.title));
        if (existing) Repo.update('reminders', existing.id, payload); else Repo.create('reminders', payload, 'assistant');
        response = `D’accord, je mets ton réveil travail à ${time.replace(':', ' heures ')}, du lundi au vendredi. Bonne nuit.`; section = 'reminders';
      } else if (/reveil/.test(text) && /(met|mets|programme|ajoute|ajouter)/.test(text)) {
        const match = text.match(/(\d{1,2})(?:h|:)(\d{2})?/);
        if (!match) response = 'À quelle heure veux-tu être réveillé ?';
        else {
          const time = `${String(Math.min(23, Number(match[1]))).padStart(2, '0')}:${String(Math.min(59, Number(match[2] || 0))).padStart(2, '0')}`;
          let date = Utils.iso(); if (new Date(`${date}T${time}:00`) <= new Date()) date = Utils.day(1);
          Repo.create('reminders', {
            title: 'Réveil', description: 'Réveil dicté à Sophie.', voiceMessage: '', category: 'Routine', priority: 'Haute',
            style: Store.settings.reminderStyle || 'Amical', time, date, repeat: { freq: 'once', days: [], anchor: date },
            channels: { inApp: true, vocal: true, system: true }, enabled: true, status: 'active', source: 'Voix',
            history: [], fired: {}, snoozeUntil: null
          }, 'assistant');
          response = `Réveil programmé pour ${date === Utils.iso() ? 'aujourd’hui' : 'demain'} à ${time.replace(':', ' heures ')}.`; section = 'reminders';
        }
      } else if (/(actualite|nouvelles|revue de presse)/.test(text)) {
        if (navigator.onLine) { try { await News.refresh(); } catch { /* le cache est utilisé */ } }
        response = News.spokenSummary(3); section = 'dashboard';
      } else if (/briefing|programme du jour|qu est ce que j ai aujourd hui|ma journee/.test(text)) {
        response = this.briefing(); section = 'calendar';
      } else if (/bilan/.test(text) && /semaine/.test(text)) {
        response = this.weeklyReport(); section = 'dashboard';
      } else if (/bilan/.test(text)) {
        response = this.dailyReport(); section = 'dashboard';
      } else if (/mode concentration|concentration/.test(text)) {
        const enable = !/(desactive|arrete|quitte|stop|sortie)/.test(text);
        Store.setSetting('focusMode', enable); response = enable ? 'Mode concentration activé. Je masque le superflu et je garde l’essentiel.' : 'Mode concentration désactivé.'; section = 'dashboard';
      } else if (/(retrouve|cherche|trouve)/.test(text)) {
        const query = raw.replace(/.*?(retrouve|cherche|trouve)(?:\s+moi)?\s*(?:la|le|les|un|une|des)?\s*/i, '').replace(/[.!?]+$/, '').trim();
        const results = this.search(query);
        response = results.length ? `${results.length} résultat(s). Le plus pertinent : « ${results[0].title} » dans ${results[0].module}. Ouvre la recherche pour voir la liste.` : `Aucun élément trouvé pour « ${query} » dans les modules et la mémoire.`;
        section = 'dashboard';
      } else if (/(memorise|retiens|note bien|souviens toi)/.test(text)) {
        const content = raw.replace(/.*?(memorise|retiens|note bien|souviens toi)(?:\s+que|:|\s+moi)?\s*/i, '').trim();
        if (!content) response = 'Que dois-je mémoriser ?';
        else { Sophie.memory.add(content, 'Permanente'); response = `C’est noté et mémorisé : « ${content} ».`; }
      } else if (/(oublie|supprime la memoire)/.test(text)) {
        response = 'Tu peux gérer chaque souvenir dans le panneau Mémoire de mon espace. Je ne supprime rien sans action de ta part.';
      } else if (/depens|depense/.test(text)) {
        const match = text.match(/(\d+(?:[.,]\d+)?)\s*(euro|euros|€)/);
        const label = raw.replace(/.*?(depense|j ai depense|paye)\s*/i, '').replace(/(\d+(?:[.,]\d+)?)\s*(euro|euros|€).*/i, '').trim() || 'Dépense dictée';
        if (!match) response = 'Quel montant veux-tu enregistrer ?';
        else {
          const amount = Number(match[1].replace(',', '.'));
          const args = { amount, label: cap(label), category: /course|alimentation|restaurant/.test(text) ? 'Alimentation' : /essence|carburant|train|bus/.test(text) ? 'Transport' : 'Autre', date: Utils.iso() };
          if (!Store.settings.sophieConfirmSensitive) { response = this.runTool('create_expense', args, { confirmed: true }); section = 'finances'; }
          else { this.pending = { tool: 'create_expense', args }; response = `Je peux enregistrer une dépense de ${money(amount)} dans ${args.category}. Confirme pour valider, ou annule.`; }
        }
      } else if (/(pompe|gainage|traction|natation|course|sport|seance)/.test(text) && /(fait|fais|termine|enregistre|ajoute)/.test(text)) {
        const performances = [];
        const numberWords = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, vingt: 20, trente: 30, quarante: 40, cinquante: 50 };
        const regex = /(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|vingt|trente|quarante|cinquante)\s*(pompe[sx]?|gainage|traction[s]?|minute[s]?|min|seconde[s]?|s|km|kilometre[s]?)?/g;
        let match; while ((match = regex.exec(text)) !== null) {
          const value = Number(match[1]) || numberWords[match[1]] || 0; const unit = match[2] || 'pompes';
          if (!value) continue;
          if (/pompe/.test(unit)) performances.push({ type: 'Pompes', reps: value, label: `${value} pompes` });
          else if (/traction/.test(unit)) performances.push({ type: 'Renforcement musculaire', reps: value, label: `${value} tractions` });
          else if (/gainage/.test(unit) || /seconde|^s$/.test(unit)) performances.push({ type: 'Gainage', duration: /minute|min/.test(unit) ? value : Math.round(value / 60) || (unit === 'seconde' || unit === 's' ? 0 : value), reps: 0, label: unit === 'seconde' || unit === 's' || unit === 'gainage' ? `${value} secondes de gainage` : `${value} minutes de gainage`, seconds: unit === 'seconde' || unit === 's' ? value : 0 });
          else if (/km|kilometre/.test(unit)) performances.push({ type: 'Course', distance: value, label: `${value} km` });
          else if (/minute|min/.test(unit)) performances.push({ type: 'Course', duration: value, label: `${value} minutes` });
        }
        if (!performances.length) response = 'Quelles performances veux-tu enregistrer ?';
        else {
          const results = performances.map(p => {
            const args = { type: p.type, reps: p.reps || 0, duration: p.duration || (p.seconds ? Math.round(p.seconds / 60) : 0), distance: p.distance || 0, performance: p.label };
            return this.runTool(performances.length > 1 ? 'add_sport_performance' : 'create_sport_session', args);
          });
          response = `C’est enregistré : ${results.join(' ')}`; section = 'sport';
        }
      } else if (/ajoute une idee|idee pour|nouvelle idee/.test(text)) {
        const parts = raw.split(':'); const context = parts[0] || raw; const idea = (parts[1] || '').trim() || raw.replace(/.*?(idee|ajoute une idee)\s*(pour|a|sur)?\s*/i, '').trim();
        const project = Repo.list('projects').find(p => normalize(context).includes(normalize(p.name).split(' ')[0]));
        const result = this.runTool('create_task', { title: cap(idea), projectId: project?.id || '', priority: 'Normale', notes: `Idée capturée : ${idea}` });
        response = project ? `${result} Je l’ai rattachée au projet ${project.name}.` : `${result} Précise le projet si tu veux la rattacher.`; section = 'projects';
      } else if (/objectif|progression/.test(text) && /(ou j|ou en|resume|montre|affiche|etat|avancement)/.test(text)) {
        const stats = Selectors.goals(); const focus = [...stats.active].sort((a, b) => Selectors.goalProgress(b) - Selectors.goalProgress(a))[0];
        response = `Progression moyenne : ${stats.average}%. ${stats.active.length} objectif(s) actif(s), ${stats.done.length} terminé(s), ${stats.late.length} en retard.${focus ? ` ${focus.name} est à ${Math.round(Selectors.goalProgress(focus))}%.` : ''}`; section = 'goals';
      } else if (/projet/.test(text) && /(affiche|montre|ouvre|ou en suis|ou j en suis|etat|avancement)/.test(text)) {
        response = this.runTool('get_project_details', { query: raw.replace(/.*?(projet|sur)\s*/i, '').replace(/[.!?]/g, '') }) === 'Aucun projet correspondant.'
          ? `Tes projets actifs : ${Selectors.projects().active.map(p => `${p.name} à ${p.progress}%`).join(', ') || 'aucun'}.` : this.runTool('get_project_details', { query: raw.replace(/.*?(projet|sur)\s*/i, '').replace(/[.!?]/g, '') });
        section = 'projects';
      } else if (/budget|solde|finance/.test(text)) {
        const stats = Selectors.finance();
        response = stats.budget ? `Budget restant : ${money(Math.round(stats.remaining))} sur ${money(Math.round(stats.budget))}, avec ${money(Math.round(stats.expense))} de dépenses ce mois-ci.` : `Aucun budget défini. Solde du mois : ${money(Math.round(stats.balance))}.`; section = 'finances';
      } else if (/notification|alerte/.test(text)) {
        response = this.runTool('get_notifications'); section = 'notifications';
      } else if (/note|journal/.test(text) && /(note|ecris|ajoute)/.test(text)) {
        const content = raw.replace(/.*?(note|ecris|ajoute)\s*(que|:|cette idee)?\s*/i, '').trim();
        if (!content) response = 'Que dois-je noter ?';
        else { this.runTool('create_note', { title: cap(content.slice(0, 80)), text: content }); response = 'Note ajoutée à ton journal.'; section = 'journal'; }
      } else if (/tache/.test(text) && /(ajoute|cree|creer)/.test(text)) {
        const title = raw.replace(/.*?(tache)\s*(intitulee|nommee|pour|:)?\s*/i, '').replace(/[.!?]+$/, '').trim();
        if (!title) response = 'Quel est le titre de la tâche ?';
        else { this.runTool('create_task', { title: cap(title) }); response = `Tâche « ${cap(title)} » créée pour aujourd’hui.`; section = 'projects'; }
      } else if (/merci/.test(text)) {
        response = 'Avec plaisir. Je reste disponible.';
      } else {
        response = 'Je n’ai pas identifié de demande fiable dans mon moteur local. Tu peux me demander : programme du jour, bilan de la semaine, état d’un projet, budget restant, enregistrer des performances sportives, une dépense, une tâche, une note, ou me demander de mémoriser une information.';
        section = 'assistant';
      }
      this.log(raw, response);
      if (section && section !== 'assistant' && this.navigate) this.navigate(section); else this.refresh?.();
      return response;
    } catch (error) {
      response = `L’action n’a pas abouti : ${error.message}`; this.log(raw, response); Toast.show(response, 'error'); this.refresh?.(); return response;
    }
  }
};
