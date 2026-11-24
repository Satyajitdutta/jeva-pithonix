// Voice input for the JEVA demo: a short WAV clip in any Indian language
// comes in as base64, Sarvam Saaras returns English text plus the detected
// language. Same Sarvam call Ansh uses. Light per-IP cap to protect credit.
const hits = new Map();
const LIMIT = 30, WINDOW_MS = 60 * 60 * 1000;

export const config = { api: { bodyParser: { sizeLimit: '3mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const rec = hits.get(ip) || { count: 0, start: now };
  if (now - rec.start > WINDOW_MS) { rec.count = 0; rec.start = now; }
  if (++rec.count > LIMIT) return res.status(429).json({ error: 'rate_limited' });
  hits.set(ip, rec);

  try {
    const b64 = req.body?.audio;
    if (!b64 || typeof b64 !== 'string') return res.status(400).json({ error: 'No audio' });
    const buf = Buffer.from(b64, 'base64');
    if (buf.length < 1000) return res.json({ transcript: '', language: '' });
    if (buf.length > 2.5 * 1024 * 1024) return res.status(413).json({ error: 'Clip too long' });

    const form = new FormData();
    form.append('file', new Blob([buf], { type: 'audio/wav' }), 'audio.wav');
    form.append('model', 'saaras:v2.5');
    const r = await fetch('https://api.sarvam.ai/speech-to-text-translate', {
      method: 'POST',
      headers: { 'api-subscription-key': process.env.SARVAM_API_KEY },
      body: form,
    });
    const d = await r.json();
    if (!r.ok) return res.status(502).json({ error: 'Speech service error' });
    return res.json({ transcript: d.transcript || '', language: d.language_code || '' });
  } catch (e) {
    console.error('[transcribe]', e.message);
    return res.status(500).json({ error: 'Transcription failed' });
  }
}
