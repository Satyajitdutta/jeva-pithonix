export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });

    const cleanText = text.replace(/[*#_`•]/g, '').slice(0, 500);

    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': process.env.SARVAM_API_KEY
      },
      body: JSON.stringify({
        text: cleanText,
        target_language_code: 'en-IN',
        speaker: 'Ishita',
        model: 'bulbul:v3',
        pace: 0.95,
        temperature: 0.6,
        speech_sample_rate: 24000
      })
    });

    const rawText = await response.text();
    console.log('Sarvam status:', response.status);
    console.log('Sarvam preview:', rawText.slice(0, 300));

    let data;
    try { data = JSON.parse(rawText); }
    catch(e) {
      return res.status(500).json({ error: 'Bad JSON from Sarvam', raw: rawText.slice(0, 200) });
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    const audio = data?.audios?.[0];
    if (!audio) {
      return res.status(500).json({ error: 'No audio in response', keys: Object.keys(data) });
    }

    return res.status(200).json({ audio, format: 'wav' });

  } catch (err) {
    console.error('Sarvam error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
