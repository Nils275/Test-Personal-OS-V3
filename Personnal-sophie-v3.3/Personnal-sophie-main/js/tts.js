/* ═══════════════════════════════════════════════════════════════════════
   ★  VOTRE VOIX ELEVENLABS — C'EST ICI QU'ELLE SE CONFIGURE  ★
   ═══════════════════════════════════════════════════════════════════════

   1) L'IDENTIFIANT DE VOIX (voice ID) se met juste en dessous.
      Il n'est pas secret : vous pouvez le laisser dans ce fichier.
      Format : 26 caractères, fourni par ElevenLabs dans « My Voices ».

   2) LA CLÉ API (sk_...) ne se met JAMAIS ici ni dans aucun fichier
      du navigateur. Elle va dans le fichier  .env  à côté de server.js :

          ELEVENLABS_API_KEY=votre_clé_ici
          ELEVENLABS_VOICE_ID=Kuy2kDCiyKmA79V9BbDr

      Puis :  node server.js  →  http://localhost:8080

   3) Dans l'application : Sophie → Réglages rapides → Endpoint du proxy :
          http://localhost:8080/api/tts
   ═══════════════════════════════════════════════════════════════════════ */
export const ELEVENLABS_VOICE_ID = 'Kuy2kDCiyKmA79V9BbDr'; // ← VOTRE VOIX ICI

/* SOPHIE — Couche vocale : ElevenLabs via proxy sécurisé + repli voix native. */
import { Store, Bus } from './core.js';

export const TTS = {
  active: 'native', lastError: '', circuitUntil: 0, audio: null, lastProvider: '',
  providers: () => ({ elevenlabs: 'ElevenLabs · Sophie', native: 'Voix native de l’appareil' }),

  /* Plage silencieuse partagée avec les annonces. */
  isQuiet(date = new Date()) {
    const s = Store.settings; if (!s.quietEnabled) return false;
    const minutes = date.getHours() * 60 + date.getMinutes();
    const [sh, sm] = s.quietStart.split(':').map(Number), [eh, em] = s.quietEnd.split(':').map(Number);
    const start = sh * 60 + sm, end = eh * 60 + em;
    return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
  },
  /* Voix féminine française disponible, sinon voix française, sinon voix système. */
  nativeVoice() {
    if (!('speechSynthesis' in globalThis)) return null;
    const voices = speechSynthesis.getVoices();
    const french = voices.filter(v => /^fr/i.test(v.lang));
    return french.find(v => /amelie|audrey|marie|virginie|celine|julie|lea|female|femme|google fran/i.test(v.name))
      || french.find(v => /natural|premium|enhanced/i.test(v.name))
      || french[0] || null;
  },
  endpoint() {
  const configured = Store.settings.elevenlabsEndpoint || '';
  const isLocal = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(configured);

  return !configured || isLocal
    ? 'https://personnalsoph1e-5p9qvusmk-pitlane5.vercel.app/api/tts'
    : configured;
},

canUseElevenLabs() {
  return Boolean(this.endpoint()) && Date.now() > this.circuitUntil;
},
  /* Distingue clairement quota, clé invalide et panne réseau. */
  classify(error, status = 0) {
    if (status === 401 || status === 403) return { kind: 'auth', minutes: 30, message: 'Clé ElevenLabs refusée par le proxy (authentification).' };
    if (status === 402 || status === 429 || status === 503) return { kind: 'quota', minutes: 15, message: 'Quota ou crédits ElevenLabs épuisés.' };
    if (status) return { kind: 'server', minutes: 5, message: `Service ElevenLabs indisponible (HTTP ${status}).` };
    return { kind: 'network', minutes: 2, message: 'Réseau indisponible vers le proxy vocal.' };
  },
  async speakElevenLabs(text) {
const endpoint = this.endpoint();    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId: Store.settings.elevenlabsVoiceId || ELEVENLABS_VOICE_ID, model: 'eleven_multilingual_v2' })
    });
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
    const blob = await response.blob();
    if (!blob.size) throw Object.assign(new Error('Audio vide'), { status: 502 });
    const url = URL.createObjectURL(blob);
    this.audio = this.audio || new Audio(); this.audio.src = url;
    await this.audio.play();
    return true;
  },
  speakNative(text, { automatic = false } = {}) {
    if (!('speechSynthesis' in globalThis)) return false;
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = this.nativeVoice(); if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || 'fr-FR';
    utterance.rate = Number(Store.settings.voiceRate) || 1; utterance.pitch = Number(Store.settings.voicePitch) || 1;
    if (!automatic) speechSynthesis.cancel();
    speechSynthesis.speak(utterance); return true;
  },
  /* Retourne true si un fournisseur a effectivement parlé. */
  async speak(text, { automatic = false, force = false } = {}) {
    if (!text) return false;
    if (automatic && (this.isQuiet() || (automatic !== 'briefing' && !Store.settings.autoAnnounce))) return false;
    if (!Store.settings.voiceEnabled && !force) return false;
    const mode = Store.settings.voiceProvider || 'auto';
    const wantsElevenLabs = (mode === 'auto' || mode === 'elevenlabs') && this.canUseElevenLabs();
    if (wantsElevenLabs) {
      try {
        await this.speakElevenLabs(text); this.active = 'elevenlabs'; this.lastError = '';
        Bus.emit('tts:provider', { provider: 'elevenlabs' }); return true;
      } catch (error) {
        const info = this.classify(error, error.status || 0);
        this.lastError = info.message; this.circuitUntil = Date.now() + info.minutes * 60000;
        Bus.emit('tts:fallback', info);
        if (mode === 'elevenlabs') return false; // Mode exclusif : pas de repli silencieux.
      }
    }
    const spoken = this.speakNative(text, { automatic });
    this.active = 'native'; Bus.emit('tts:provider', { provider: 'native' }); return spoken;
  },
  cancel() { try { this.audio?.pause(); } catch { /* audio déjà interrompu */ } globalThis.speechSynthesis?.cancel(); },
  status() {
    return { mode: Store.settings.voiceProvider || 'auto', active: this.active, lastError: this.lastError,
      endpoint: Boolean(Store.settings.elevenlabsEndpoint), voiceId: Store.settings.elevenlabsVoiceId,
      circuit: Date.now() < this.circuitUntil ? Math.ceil((this.circuitUntil - Date.now()) / 60000) : 0 };
  }
};
