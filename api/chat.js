/**
 * Vercel Serverless API Route: /api/chat
 * Proxy AI request tu browser -> Vercel server -> pollinations.ai
 * Muc dich: Tranh van de mang Viet Nam cham ket noi toi server nuoc ngoai.
 * Vercel server (My/chau Au) ket noi pollinations.ai rat nhanh (~100-300ms).
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Thieu truong prompt' });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const url = 'https://text.pollinations.ai/' + encodeURIComponent(prompt.slice(0, 2000));
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return res.status(200).json({
        error: true,
        message: `AI server loi (${response.status}): ${errText.slice(0, 200)}`
      });
    }

    const text = await response.text();
    return res.status(200).json({ text: text.trim() });

  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(200).json({
        error: true,
        message: 'May chu AI phan hoi qua lau (20s). Vui long thu lai sau.'
      });
    }
    return res.status(200).json({
      error: true,
      message: `Loi ket noi AI: ${err.message || err}`
    });
  }
}
