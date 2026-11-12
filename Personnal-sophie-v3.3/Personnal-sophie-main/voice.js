/* SOPHIE — Reconnaissance vocale locale avec Vosk-Browser (WASM).
   Le microphone et la transcription restent dans Chrome ; aucun audio n'est envoyé à ElevenLabs.
   ElevenLabs reste utilisé uniquement par js/tts.js pour la synthèse vocale. */
import { Store, Repo, Notify, Utils, Bus } from './core.js';
import { Toast } from './ui.js';
import { TTS } from './tts.js';
import { Sophie } from './sophie.js';
import { setSophieState } from './sophie-avatar.js';

const VOSK_SCRIPT = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js';
const VOSK_MODEL = 'https://huggingface.co/Andesprit/vosk-small/resolve/main/vosk-model-small-fr-0.22.tar.gz';
export const Voice = {
  recognition: null, listening: false, processing: false, speaking: false, state: 'idle',
  navigate: null, refresh: null, openEditor: null, announcedKeys: new Set(),
  supported: Boolean(navigator.mediaDevices?.getUserMedia && globalThis.AudioContext),
  voskModel: null, voskRecognizer: null, mediaStream: null, audioContext: null,
  audioSource: null, processor: null, voskLoading: null, wakeMode: false,
  commandTimer: null, wakeArmed: false, commandParts: [], lastTranscript: '',

  init({ navigate, refresh, openEditor }) {
    this.navigate = navigate; this.refresh = refresh; this.openEditor = openEditor;
    Sophie.init({ navigate, refresh, openEditor });
    Bus.on('notification:created', notification => this.onNotification(notification));
    Bus.on('sophie:briefing', ({ text }) => this.deliverBriefing(text));
    Bus.on('sophie:weekly', ({ text }) => this.deliverBriefing(text));
    setInterval(() => this.announcePending(), 60000);
    if (Store.settings.wakeWordEnabled) this.startWakeLoop();
  },

  setState(state, text = '') {
    this.state = state;
    this.listening = state === 'listening'; this.processing = state === 'thinking'; this.speaking = state === 'speaking';
    document.body.dataset.sophieState = state;
    setSophieState(state);
    const dock = document.getElementById('voice-dock');
    if (dock) {
      dock.hidden = state === 'idle'; dock.className = `voice-dock state-${state}`;
      const label = { listening: 'Sophie écoute', thinking: 'Sophie analyse', speaking: 'Sophie répond', idle: 'Sophie' }[state];
      const stateNode = document.getElementById('voice-dock-state'); if (stateNode) stateNode.textContent = label;
      const textNode = document.getElementById('voice-dock-text'); if (textNode && text) textNode.textContent = text;
    }
    const status = document.getElementById('assistant-status');
    if (status) status.textContent = { idle: 'VEILLE · DITES « SOPHIE »', listening: 'ÉCOUTE · PARLEZ NATURELLEMENT', thinking: 'RÉFLEXION · ANALYSE LOCALE', speaking: 'RÉPONSE · SOPHIE PARLE' }[state];
    const transcript = document.getElementById('voice-transcript'); if (transcript && text) transcript.textContent = text;
    document.querySelectorAll('.voice-orb, .voice-orb-mini, .voice-top').forEach(node => {
      node.classList.toggle('listening', this.listening); node.classList.toggle('thinking', this.processing); node.classList.toggle('speaking', this.speaking);
    });
    document.getElementById('sound-wave')?.classList.toggle('active', this.listening || this.speaking || this.processing);
    Bus.emit('voice:state', { state, text });
  },

  async loadVosk() {
    if (this.voskModel) return this.voskModel;
    if (this.voskLoading) return this.voskLoading;
    this.voskLoading = (async () => {
      if (!globalThis.Vosk) {
        await new Promise((resolve, reject) => {
          const existing = document.querySelector(`script[src="${VOSK_SCRIPT}"]`);
          if (existing) { existing.addEventListener('load', resolve, { once: true }); existing.addEventListener('error', reject, { once: true }); return; }
          const script = document.createElement('script'); script.src = VOSK_SCRIPT; script.async = true;
          script.onload = resolve; script.onerror = () => reject(new Error('Impossible de charger Vosk-Browser depuis jsDelivr. Vérifiez Internet.'));
          document.head.appendChild(script);
        });
      }
      if (!globalThis.Vosk?.createModel) throw new Error('La bibliothèque Vosk ne s’est pas initialisée.');
      this.setState('thinking', 'Chargement du moteur vocal français (première utilisation)…');
      const model = await globalThis.Vosk.createModel(VOSK_MODEL);
      model.setLogLevel?.(-1);
      this.voskModel = model;
      return model;
    })();
    try { return await this.voskLoading; } finally { this.voskLoading = null; }
  },

  async startRecognition({ once = true } = {}) {
    if (!this.supported) throw new Error('Ce navigateur ne permet pas l’accès au microphone.');
    if (this.mediaStream) this.stopCapture();
    this.wakeMode = !once; this.wakeArmed = false; this.commandParts = []; this.lastTranscript = '';
    const model = await this.loadVosk();
    this.voskRecognizer?.remove?.();
    const recognizer = new model.KaldiRecognizer();
    recognizer.on('partialresult', message => {
      const partial = (message?.result?.partial || '').trim();
      if (partial) this.handleTranscript(partial, false, once);
    });
    recognizer.on('result', message => {
      const text = (message?.result?.text || '').trim();
      if (text) this.handleTranscript(text, true, once);
    });
    this.voskRecognizer = recognizer;
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, video: false
    });
    this.audioContext = new AudioContext();
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();
    this.audioSource = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = event => {
      try { if (this.voskRecognizer && this.audioContext?.state === 'running') this.voskRecognizer.acceptWaveform(event.inputBuffer); }
      catch (error) { console.error('[Sophie/Vosk] Audio processing:', error); }
    };
    const silent = this.audioContext.createGain(); silent.gain.value = 0;
    this.audioSource.connect(this.processor); this.processor.connect(silent); silent.connect(this.audioContext.destination);
    this.setState(once ? 'listening' : 'idle', once ? 'Je vous écoute…' : 'Dites « Sophie » pour me réveiller…');
  },

  normalize(text) { return String(text || '').toLocaleLowerCase('fr-FR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim(); },

  handleTranscript(text, isFinal, once) {
    const normalized = this.normalize(text);
    if (!normalized || normalized === this.lastTranscript && isFinal) return;
    if (!once && !this.wakeArmed) {
      const match = normalized.match(/\b(?:hey |he |salut |bonjour |coucou |ok )?sophie\b/);
      if (!match) return;
      this.wakeArmed = true;
      const command = normalized.slice(match.index + match[0].length).trim();
      this.setState('listening', command ? `J’ai entendu : ${command}` : 'Oui, je t’écoute…');
      // N’enregistrer la commande qu’au résultat final pour éviter de doubler
      // le texte entre les événements partiels et finaux de Vosk.
      if (isFinal && command) { this.commandParts = [command]; this.scheduleCommand(); }
      else this.scheduleCommand(6500);
      return;
    }
    if (once) {
      if (isFinal) this.commandParts.push(text);
      this.setState('listening', text);
      if (isFinal) this.scheduleCommand(900);
      return;
    }
    if (this.wakeArmed) {
      if (isFinal) {
        const wakePrefix = normalized.match(/\b(?:hey |he |salut |bonjour |coucou |ok )?sophie\b/);
        const command = wakePrefix ? normalized.slice(wakePrefix.index + wakePrefix[0].length).trim() : text.trim();
        if (command && this.normalize(command) !== this.lastTranscript) {
          this.commandParts = [command]; this.lastTranscript = this.normalize(command); this.scheduleCommand(1100);
        }
      } else this.setState('listening', text);
    }
  },

  scheduleCommand(delay = 1100) {
    clearTimeout(this.commandTimer);
    this.commandTimer = setTimeout(async () => {
      const command = this.commandParts.join(' ').trim();
      if (!command) { this.setState('listening', 'Oui, je t’écoute…'); return; }
      this.commandParts = []; this.wakeArmed = false;
      this.stopCapture();
      this.setState('thinking', command);
      await this.execute(command, 'voice');
      if (this.wakeMode && Store.settings.wakeWordEnabled) {
        try { await this.startRecognition({ once: false }); }
        catch (error) { Toast.show(`Sophie ne peut pas reprendre l’écoute : ${error.message}`, 'error', 6500); }
      }
    }, delay);
  },

  stopCapture() {
    clearTimeout(this.commandTimer);
    try { if (this.processor) this.processor.disconnect(); } catch {}
    try { if (this.audioSource) this.audioSource.disconnect(); } catch {}
    try { this.mediaStream?.getTracks().forEach(track => track.stop()); } catch {}
    try { this.audioContext?.close(); } catch {}
    this.processor = this.audioSource = this.mediaStream = this.audioContext = null;
  },

  async toggle() {
    if (this.mediaStream) { this.stopCapture(); this.setState('idle'); return; }
    try {
      this.wakeMode = false;
      await this.startRecognition({ once: true });
    } catch (error) {
      console.error('[Sophie/Vosk] Activation impossible:', error);
      Toast.show(`Microphone / Vosk : ${error.message}`, 'error', 7000);
      this.setState('idle');
    }
  },
  async startWakeLoop() {
    if (this.mediaStream) return;
    try {
      await this.startRecognition({ once: false });
      Toast.show('Sophie est en veille. Dites « Sophie » pour la réveiller.', 'success', 5000);
    } catch (error) {
      console.error('[Sophie/Vosk] Wake loop:', error);
      Toast.show(`Impossible d’activer le réveil vocal : ${error.message}`, 'error', 7000);
      this.setState('idle');
    }
  },
  stopWakeLoop() { this.wakeMode = false; this.stopCapture(); this.setState('idle'); },

  cancel() {
    this.stopCapture(); TTS.cancel(); Sophie.pending = null; this.setState('idle');
    if (Store.settings.wakeWordEnabled) setTimeout(() => this.startWakeLoop(), 400);
  },

  async speak(text, options = {}) {
    this.stopCapture();
    this.setState('speaking', text);
    const spoken = await TTS.speak(text, options);
    return spoken;
  },
  async execute(command, source = 'text') {
    this.setState('thinking', command);
    const response = await Sophie.execute(command, source);
    await this.speak(response);
    this.setState('idle', response);
    if (source === 'voice') setTimeout(() => this.openEditorIfRequested(), 250);
    return response;
  },
  openEditorIfRequested() {},

  onNotification(notification) {
    if (Store.settings.browserNotifications && 'Notification' in globalThis && Notification.permission === 'granted') {
      try { new Notification(notification.title, { body: notification.body, icon: 'icon.svg', tag: notification.id }); } catch {}
    }
    if (notification.announce !== false && !notification.announcedAt) this.announce(notification);
  },
  async announce(notification) {
    const level = Store.settings.announcementFrequency;
    const allowed = level === 'all' || (level === 'important' && ['Haute', 'Critique'].includes(notification.priority)) || (level === 'critical' && notification.priority === 'Critique');
    if (!allowed || TTS.isQuiet() || !Store.settings.autoAnnounce || !Store.settings.voiceEnabled) return false;
    const interval = Math.max(1, Number(Store.settings.announcementInterval) || 5) * 60000;
    const last = Number(Store.settings.lastAnnounceAt || 0); if (Date.now() - last < interval) return false;
    const prefix = notification.priority === 'Critique' ? 'Alerte critique. ' : notification.type === 'Rappel' ? 'Rappel. ' : 'Nouvelle notification. ';
    const spoken = await this.speak(`${prefix}${notification.title}. ${notification.body}`, { automatic: true });
    if (!spoken) return false;
    Store.setSetting('lastAnnounceAt', Date.now());
    Store.commit(data => { const item = data.notifications.find(n => n.id === notification.id); if (item) item.announcedAt = new Date().toISOString(); }, { reason: 'announcement', silent: true });
    if (Store.settings.wakeWordEnabled) setTimeout(() => this.startWakeLoop(), 700);
    return true;
  },
  announcePending() {
    if (!Store.ready || TTS.isQuiet() || this.mediaStream) return;
    const pending = Repo.list('notifications').filter(n => !n.read && !n.announcedAt && n.announce !== false).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
    if (pending) this.announce(pending);
  },
  async deliverBriefing(text) {
    if (TTS.isQuiet()) { Notify.push({ title: 'Briefing en attente', body: 'Le briefing est prêt mais la plage silencieuse est active.', type: 'Information', priority: 'Normale', source: 'SOPHIE' }); return; }
    this.setState('thinking', 'Briefing');
    await this.speak(text, { automatic: 'briefing' });
    this.setState('idle', text);
    if (Store.settings.wakeWordEnabled) setTimeout(() => this.startWakeLoop(), 700);
  }
};
