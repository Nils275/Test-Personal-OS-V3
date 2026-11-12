/* PERSONAL OS — Function serverless (Vercel / Netlify) : proxy vocal ElevenLabs.
   La clé API est lue dans les variables d'environnement du serveur, jamais côté client. */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ELEVENLABS_API_KEY non configurée sur le serveur.' });

  const text = String(req.body?.text || '').slice(0, 4000);
  const voiceId = /^[A-Za-z0-9]+$/.test(req.body?.voiceId || '') ? req.body.voiceId : (process.env.ELEVENLABS_VOICE_ID || 'Kuy2kDCiyKmA79V9BbDr');
  if (!text.trim()) return res.status(400).json({ error: 'Texte vide.' });

  try {
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: req.body?.model || 'eleven_multilingual_v2', voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25 } })
    });
    if (!upstream.ok) {
      // 401/403 : clé invalide · 402/429/503 : quota ou crédits. Le client applique son repli.
      return res.status(upstream.status).json({ error: `ElevenLabs HTTP ${upstream.status}` });
    }
    const audio = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(audio);
  } catch (error) {
    return res.status(502).json({ error: `Appel ElevenLabs impossible : ${error.message}` });
  }
}
