/* ═══════════════════════════════════════════════════════════════════════
   ★  VOTRE VOIX ELEVENLABS — CONFIGURATION CÔTÉ SERVEUR  ★
   ═══════════════════════════════════════════════════════════════════════
   ► C'est ICI, et uniquement ici, que va votre CLÉ API ElevenLabs.
     Créez un fichier nommé  .env  à côté de ce fichier, contenant :

         ELEVENLABS_API_KEY=sk_........................
         ELEVENLABS_VOICE_ID=Kuy2kDCiyKmA79V9BbDr

   ► Puis lancez :  node server.js   et ouvrez http://localhost:8080
   ► Dans l'application : Sophie → Réglages rapides →
         Endpoint du proxy : http://localhost:8080/api/tts
   ► La clé ne doit jamais figurer dans un fichier JavaScript du navigateur.
   ═══════════════════════════════════════════════════════════════════════

   PERSONAL OS — Serveur local + proxy vocal ElevenLabs.
   Aucune dépendance npm : `node server.js` suffit. */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

/* ---------- Chargement minimal de .env (sans dépendance) ---------- */
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  });
}

const API_KEY = process.env.ELEVENLABS_API_KEY || '';
const DEFAULT_VOICE = process.env.ELEVENLABS_VOICE_ID || 'Kuy2kDCiyKmA79V9BbDr';
const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json', '.md': 'text/plain; charset=utf-8', '.woff2': 'font/woff2'
};

/* ---------- Proxy TTS : seul composant qui connaît la clé ---------- */
function handleTts(req, res) {
  if (!API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'ELEVENLABS_API_KEY absente. Ajoutez-la dans .env puis relancez node server.js.' }));
  }
  let raw = '';
  req.on('data', chunk => { raw += chunk; if (raw.length > 20000) req.destroy(); });
  req.on('end', () => {
    let payload;
    try { payload = JSON.parse(raw || '{}'); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Corps JSON invalide.' }));
    }
    const text = String(payload.text || '').slice(0, 4000);
    const voiceId = /^[A-Za-z0-9]+$/.test(payload.voiceId || '') ? payload.voiceId : DEFAULT_VOICE;
    if (!text.trim()) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Texte vide.' })); }

    const body = JSON.stringify({
      text,
      model_id: payload.model || 'eleven_multilingual_v2',
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25 }
    });
    const upstream = https.request({
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
        'Content-Length': Buffer.byteLength(body)
      }
    }, upstreamRes => {
      if (upstreamRes.statusCode !== 200) {
        // Le frontend distingue quota (402/429) et clé invalide (401/403).
        res.writeHead(upstreamRes.statusCode, { 'Content-Type': 'application/json' });
        upstreamRes.pipe(res); return;
      }
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' });
      upstreamRes.pipe(res);
    });
    upstream.on('error', error => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Appel ElevenLabs impossible : ${error.message}` }));
    });
    upstream.end(body);
  });
}


/* ---------- Proxy STT ElevenLabs Scribe : clé conservée côté serveur ---------- */
function handleStt(req, res) {
  if (!API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'ELEVENLABS_API_KEY absente du fichier .env.' }));
  }
  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Envoyez un formulaire multipart/form-data contenant le fichier audio.' }));
  }
  const upstream = https.request({
    hostname: 'api.elevenlabs.io', path: '/v1/speech-to-text', method: 'POST',
    headers: { 'xi-api-key': API_KEY, 'Content-Type': contentType, 'Accept': 'application/json' }
  }, upstreamRes => {
    res.writeHead(upstreamRes.statusCode || 502, {
      'Content-Type': upstreamRes.headers['content-type'] || 'application/json',
      'Cache-Control': 'no-store'
    });
    upstreamRes.pipe(res);
  });
  upstream.on('error', error => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Appel ElevenLabs Scribe impossible : ${error.message}` }));
  });
  req.pipe(upstream);
}

/* ---------- Serveur statique + route API ---------- */
http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/tts' && req.method === 'POST') return handleTts(req, res);
  if (url.pathname === '/api/stt' && req.method === 'POST') return handleStt(req, res);
  if (url.pathname === '/api/stt/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ configured: Boolean(API_KEY), provider: 'ElevenLabs Scribe', model: 'scribe_v2' }));
  }
  if (url.pathname === '/api/tts/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ configured: Boolean(API_KEY), voiceId: DEFAULT_VOICE }));
  }

  const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(ROOT, requested));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Accès refusé'); }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      // Navigation SPA : toute route inconnue renvoie l'application.
      return fs.readFile(path.join(ROOT, 'index.html'), (fallbackError, fallback) => {
        if (fallbackError) { res.writeHead(404); return res.end('Introuvable'); }
        res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(fallback);
      });
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`PERSONAL OS : http://localhost:${PORT}`);
  console.log(API_KEY
    ? `Proxy ElevenLabs actif : POST /api/tts (voix ${DEFAULT_VOICE}) et POST /api/stt (Scribe).`
    : 'ATTENTION : ELEVENLABS_API_KEY absente. La voix native sera utilisée en secours.');
});
