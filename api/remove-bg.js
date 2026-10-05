// Vercel serverless function — removes background using remove.bg
// API key stays in Vercel env var (REMOVE_BG_KEY) — never exposed to browser.

export default async function handler(req, res) {
  // CORS — allow your app to call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const key = process.env.REMOVE_BG_KEY;
  if (!key) {
    res.status(500).json({ error: 'Server not configured — REMOVE_BG_KEY missing.' });
    return;
  }

  try {
    const { image } = req.body;   // base64 data URL
    if (!image || typeof image !== 'string') {
      res.status(400).json({ error: 'Missing image data.' });
      return;
    }

    // Strip data URL prefix if present
    const base64 = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');

    // Build multipart form for remove.bg
    const boundary = '----MXStudio' + Date.now();
    const CRLF = '\r\n';
    const head =
      '--' + boundary + CRLF +
      'Content-Disposition: form-data; name="image_file"; filename="photo.jpg"' + CRLF +
      'Content-Type: image/jpeg' + CRLF + CRLF;
    const tail = CRLF + '--' + boundary + '--' + CRLF;

    const bodyParts = [Buffer.from(head, 'utf-8'), buffer, Buffer.from(tail, 'utf-8')];
    const body = Buffer.concat(bodyParts);

    const r = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': key,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': String(body.length)
      },
      body
    });

    if (!r.ok) {
      const text = await r.text();
      res.status(r.status).json({ error: 'remove.bg error', detail: text });
      return;
    }

    const arrayBuffer = await r.arrayBuffer();
    const resultBuffer = Buffer.from(arrayBuffer);
    const dataUrl = 'data:image/png;base64,' + resultBuffer.toString('base64');

    res.status(200).json({ image: dataUrl });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: String(err) });
  }
        }
