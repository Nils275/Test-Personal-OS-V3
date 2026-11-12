/* PERSONAL OS — Caméra de surveillance (mise en scène fictive).
   La caméra FRONTALE de la tablette est utilisée en direct, avec un habillage « vidéosurveillance ».
   ► « Sophie, active l'alarme »     → la caméra démarre.
   ► « Sophie, désactive l'alarme »  → la caméra est coupée.

   Ce que ce module fait réellement : afficher le flux en direct et repérer un mouvement
   (comparaison d'images sur une miniature, dans le navigateur).
   Ce qu'il ne fait PAS : aucune image n'est enregistrée, stockée ni envoyée ; aucune sirène,
   aucun appel, aucune alerte vers l'extérieur. C'est un décor, pas un système de sécurité.

   Le flux vit dans un élément persistant : il survit aux re-rendus de la vue (voir park/mount). */
import { Store, Bus } from './core.js';
import { Toast } from './ui.js';

const SAMPLE_MS = 450;           // fréquence d'analyse du mouvement
const GRID_W = 64, GRID_H = 48;  // miniature d'analyse
const PIXEL_DELTA = 28;          // écart de luminance qui compte comme « changement »
const MOTION_RATIO = 0.025;      // part de pixels changés = mouvement
const LIGHT_JUMP_RATIO = 0.6;    // au-delà : changement d'exposition/lumière, ignoré
const LOG_COOLDOWN_MS = 6000;
const LOG_MAX = 5;

const pad = n => String(n).padStart(2, '0');
const stamp = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const ICON_SHIELD = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.6-3 8.2-7 10-4-1.8-7-5.4-7-10V6z"/><path d="M9.5 12l2 2 3.5-4"/></svg>';

export const Camera = {
  status: 'off',            // off | starting | live | error
  error: '',
  stream: null, video: null, stage: null, host: null,
  events: [], expanded: false,
  _canvas: null, _ctx: null, _prev: null, _sampleTimer: null, _clockTimer: null,
  _motionOff: null, _lastLog: 0, _starting: null, _ready: false,

  get armed() { return this.status === 'live' || this.status === 'starting'; },
  get label() { return Store.settings.cameraLabel || 'CAM 01 · SALON'; },

  /* ───────── Initialisation ───────── */
  init() {
    if (this._ready) return;
    this._ready = true;
    this.host = document.createElement('div');
    this.host.id = 'camera-host';
    this.host.className = 'cam-host';
    document.body.appendChild(this.host);

    this.stage = document.createElement('div');
    this.stage.className = 'cam-stage';
    this.stage.dataset.state = 'off';
    this.stage.innerHTML = `
      <video class="cam-video" autoplay muted playsinline></video>
      <div class="cam-scan" aria-hidden="true"></div>
      <div class="cam-osd" aria-hidden="true">
        <span class="cam-tag" data-cam-label></span>
        <span class="cam-live"><i></i>LIVE</span>
        <span class="cam-time" data-cam-time></span>
        <span class="cam-motion">MOUVEMENT DÉTECTÉ</span>
        <i class="cam-corner tl"></i><i class="cam-corner tr"></i><i class="cam-corner bl"></i><i class="cam-corner br"></i>
      </div>
      <div class="cam-off">
        <span class="cam-off-icon">${ICON_SHIELD}</span>
        <strong data-cam-off-title>Alarme désactivée</strong>
        <small data-cam-off-sub>Caméra coupée</small>
      </div>
      <button type="button" class="cam-close" data-action="camera-expand" aria-label="Réduire la caméra">✕</button>`;
    this.video = this.stage.querySelector('video');
    this.host.appendChild(this.stage);

    document.addEventListener('keydown', event => { if (event.key === 'Escape' && this.expanded) this.setExpanded(false); });
    window.addEventListener('pagehide', () => this.stopStream());
    this.sync();
    this.restore();
  },

  /* Reprise au démarrage : uniquement si l'autorisation caméra est DÉJÀ accordée.
     Aucune demande d'autorisation surprise au lancement de l'application. */
  async restore() {
    if (!Store.settings.cameraArmed) return;
    let granted = false;
    try { granted = (await navigator.permissions.query({ name: 'camera' })).state === 'granted'; } catch { granted = false; }
    if (granted) { await this.arm({ quiet: true }); return; }
    Store.settings.cameraArmed = false; // pas de permission : on revient à « désarmée » sans bruit
  },

  /* ───────── Placement du flux dans la vue ───────── */
  park() {
    if (!this.stage || this.expanded) return;
    if (this.stage.parentElement !== this.host) this.host.appendChild(this.stage);
  },
  mount() {
    if (!this.stage) return;
    if (!this.expanded) {
      const slot = document.querySelector('[data-camera-slot]');
      const target = slot || this.host;
      if (this.stage.parentElement !== target) target.appendChild(this.stage);
    }
    this.sync();
    if (this.video.srcObject && this.video.paused) this.video.play().catch(() => {});
  },
  setExpanded(value) {
    this.expanded = Boolean(value);
    this.stage.classList.toggle('expanded', this.expanded);
    document.body.classList.toggle('cam-expanded', this.expanded);
    if (this.expanded) this.host.appendChild(this.stage); else this.mount();
    this.sync();
  },
  toggleExpanded() { this.setExpanded(!this.expanded); },

  /* ───────── Armer / désarmer ───────── */
  async arm({ quiet = false } = {}) {
    if (this.status === 'live') return { ok: true, already: true };
    if (this._starting) return this._starting;
    this._starting = this._start(quiet).finally(() => { this._starting = null; });
    return this._starting;
  },

  async _start(quiet) {
    if (!window.isSecureContext) return this._fail('La caméra exige une connexion sécurisée (HTTPS ou localhost).', quiet);
    if (!navigator.mediaDevices?.getUserMedia) return this._fail('Ce navigateur ne permet pas l’accès à la caméra.', quiet);
    this.error = '';
    this.setStatus('starting');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false
      });
    } catch (error) {
      const reasons = {
        NotAllowedError: 'Autorisation refusée : autorisez la caméra pour ce site dans le navigateur.',
        SecurityError: 'Autorisation refusée : autorisez la caméra pour ce site dans le navigateur.',
        NotFoundError: 'Aucune caméra détectée sur cet appareil.',
        NotReadableError: 'La caméra est déjà utilisée par une autre application.',
        OverconstrainedError: 'Aucune caméra compatible sur cet appareil.'
      };
      return this._fail(reasons[error.name] || `Caméra indisponible (${error.message || error.name}).`, quiet);
    }
    // Désarmée pendant la demande d'autorisation : on libère aussitôt la caméra.
    if (this.status !== 'starting') { stream.getTracks().forEach(track => track.stop()); return { ok: false, cancelled: true }; }

    this.stream = stream;
    this.video.srcObject = stream;
    try { await this.video.play(); } catch { /* lecture auto bloquée : le flux reste attaché */ }
    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      if (this.stream !== stream) return;
      this.stopStream(); this.error = 'La caméra a été interrompue.'; this.setStatus('error'); this.persist(false);
    });
    this.startMotion();
    this.setStatus('live');
    this.persist(true);
    return { ok: true };
  },

  _fail(message, quiet) {
    this.stopStream();
    this.error = message;
    this.setStatus('error');
    this.persist(false);
    if (!quiet) Toast.show(message, 'error', 7000);
    return { ok: false, error: message };
  },

  disarm() {
    const was = this.status;
    this.stopStream();
    this.error = '';
    this.setStatus('off');
    this.persist(false);
    return { ok: true, already: was === 'off' };
  },

  async toggle() { return this.armed ? this.disarm() : this.arm(); },

  stopStream() {
    this.stopMotion();
    try { this.stream?.getTracks().forEach(track => track.stop()); } catch { /* déjà arrêté */ }
    this.stream = null;
    if (this.video) { this.video.srcObject = null; try { this.video.load(); } catch { /* sans objet */ } }
  },

  persist(armed) {
    if (Store.settings.cameraArmed === armed) return;
    Store.settings.cameraArmed = armed;
    try { Store.saveSettings(); } catch { /* stockage indisponible : l'état reste valable pour la session */ }
  },

  /* ───────── Détection de mouvement (locale, sans enregistrement) ───────── */
  startMotion() {
    this.stopMotion();
    this._canvas = document.createElement('canvas');
    this._canvas.width = GRID_W; this._canvas.height = GRID_H;
    this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });
    this._prev = null;
    this._sampleTimer = setInterval(() => this.sample(), SAMPLE_MS);
    this._clockTimer = setInterval(() => this.tickClock(), 1000);
    this.tickClock();
  },
  stopMotion() {
    clearInterval(this._sampleTimer); clearInterval(this._clockTimer); clearTimeout(this._motionOff);
    this._sampleTimer = this._clockTimer = this._motionOff = null;
    this._prev = null;
    this.stage?.classList.remove('motion');
  },
  tickClock() {
    const node = this.stage?.querySelector('[data-cam-time]');
    if (node) node.textContent = stamp(new Date());
  },
  sample() {
    const video = this.video;
    if (!video || video.readyState < 2 || !video.videoWidth) return;
    let data;
    try { this._ctx.drawImage(video, 0, 0, GRID_W, GRID_H); data = this._ctx.getImageData(0, 0, GRID_W, GRID_H).data; }
    catch { return; }
    const size = GRID_W * GRID_H;
    const lum = new Uint8Array(size);
    for (let i = 0; i < size; i += 1) lum[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) | 0;
    const prev = this._prev; this._prev = lum;
    if (!prev) return;
    let changed = 0;
    for (let i = 0; i < size; i += 1) if (Math.abs(lum[i] - prev[i]) > PIXEL_DELTA) changed += 1;
    const ratio = changed / size;
    if (ratio < MOTION_RATIO || ratio > LIGHT_JUMP_RATIO) return;
    this.stage.classList.add('motion');
    clearTimeout(this._motionOff);
    this._motionOff = setTimeout(() => this.stage.classList.remove('motion'), 1600);
    const now = Date.now();
    if (now - this._lastLog > LOG_COOLDOWN_MS) {
      this._lastLog = now;
      this.events.unshift(new Date(now));
      this.events.length = Math.min(this.events.length, LOG_MAX);
      this.sync();
    }
  },

  /* ───────── État affiché ───────── */
  setStatus(status) {
    this.status = status;
    this.stage.dataset.state = status;
    this.sync();
    Bus.emit('camera:changed', { status, armed: this.armed });
  },

  statusText() {
    return { off: 'Alarme désactivée', starting: 'Démarrage de la caméra…', live: 'Alarme activée', error: 'Caméra indisponible' }[this.status];
  },

  /* Met à jour, sans re-rendu, tous les éléments liés à la caméra. */
  sync() {
    if (!this.stage) return;
    const state = this.status;
    document.body.dataset.alarm = state;
    this.stage.querySelector('[data-cam-label]').textContent = this.label;
    const title = this.stage.querySelector('[data-cam-off-title]'); const sub = this.stage.querySelector('[data-cam-off-sub]');
    if (state === 'error') { title.textContent = 'Caméra indisponible'; sub.textContent = this.error; }
    else if (state === 'starting') { title.textContent = 'Démarrage…'; sub.textContent = 'Autorisez la caméra si le navigateur le demande'; }
    else { title.textContent = 'Alarme désactivée'; sub.textContent = 'Dites « Sophie, active l’alarme »'; }
    document.querySelectorAll('[data-cam-status]').forEach(node => { node.textContent = this.statusText(); });
    document.querySelectorAll('[data-cam-toggle]').forEach(node => {
      node.setAttribute('aria-pressed', String(this.armed));
      const text = node.querySelector('[data-cam-toggle-label]');
      if (text) text.textContent = this.armed ? 'Désactiver l’alarme' : 'Activer l’alarme';
    });
    document.querySelectorAll('[data-cam-chip]').forEach(node => {
      node.textContent = { off: 'ALARME OFF', starting: 'DÉMARRAGE…', live: 'ALARME ON', error: 'CAMÉRA HS' }[state];
    });
    document.querySelectorAll('[data-cam-expand-label]').forEach(node => { node.textContent = this.expanded ? 'Réduire' : 'Agrandir'; });
    document.querySelectorAll('[data-cam-log]').forEach(node => {
      node.innerHTML = this.events.length
        ? this.events.map(date => `<li><i></i><span>Mouvement détecté</span><time>${esc(`${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`)}</time></li>`).join('')
        : `<li class="empty">${this.armed ? 'Rien à signaler pour le moment.' : 'Alarme désactivée : aucune surveillance.'}</li>`;
    });
  },

  /* ───────── Commandes vocales / texte de Sophie ─────────
     `text` est déjà normalisé par Sophie (minuscules, sans accents, apostrophes → espaces).
     Retourne null si la phrase ne concerne pas l'alarme, sinon une promesse de réponse. */
  interpret(text) {
    const t = String(text || '');
    if (!/\b(alarme|a larme|la larme|l larme|camera|surveillance)\b/.test(t)) return null;
    if (/\breveil/.test(t)) return null; // les réveils relèvent du module Rappels
    const off = /\b(desactive|desactiver|desactives|desarme|desarmer|coupe|couper|eteins|eteindre|arrete|arreter|stoppe|stopper|ferme|fermer)\b/.test(t);
    const on = /\b(active|activer|arme|armer|allume|allumer|enclenche|enclencher|lance|lancer|demarre|demarrer|mets|met|remets|remet)\b/.test(t);
    const ask = /\b(etat|statut|est ce que|est elle|elle est|quel est)\b|\?/.test(t);
    if (off) return this.say(this.disarm());
    if (on) return this.arm().then(result => this.say(result, true));
    if (ask) return Promise.resolve(this.describe());
    return null;
  },

  say(result, arming = false) {
    if (arming) {
      if (result.ok) return result.already ? 'L’alarme est déjà activée. La caméra est en marche.' : 'Alarme activée. La caméra de surveillance est en marche.';
      return `Je n’ai pas pu activer l’alarme. ${result.error || ''}`.trim();
    }
    return result.already ? 'L’alarme est déjà désactivée.' : 'Alarme désactivée. La caméra est coupée.';
  },

  describe() {
    if (this.status === 'live') return `L’alarme est activée. ${this.label} filme en direct${this.events.length ? `, dernier mouvement à ${pad(this.events[0].getHours())} heures ${pad(this.events[0].getMinutes())}` : ', rien à signaler'}.`;
    if (this.status === 'starting') return 'La caméra est en train de démarrer.';
    if (this.status === 'error') return `L’alarme n’est pas active : ${this.error}`;
    return 'L’alarme est désactivée, la caméra est coupée.';
  }
};
