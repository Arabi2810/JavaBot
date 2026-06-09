require('dotenv').config();

const http = require('http');
const API_KEY = process.env.GROQ_API_KEY || '';
const PORT = 3000;

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Length': Buffer.byteLength(body),
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none'
    });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  // Serve static files
  if (req.method === 'GET' && req.url !== '/api/chat') {
    const fs = require('fs');
    const path = require('path');

    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';

    const ext = path.extname(filePath);
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not found');
      }
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'text/plain',
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Cross-Origin-Embedder-Policy': 'unsafe-none'
      });
      res.end(data);
    });
    return;
  }

  // API endpoint
  if (req.method === 'POST' && req.url === '/api/chat') {
    if (!API_KEY || API_KEY === 'YOUR_GROQ_API_KEY_HERE') {
      console.error('[ERROR] Groq API key not set!');
      return sendJSON(res, 500, { error: { message: '⚠️ API key not set. Open server.js and add your Groq key.' } });
    }

    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(body); }
      catch { return sendJSON(res, 400, { error: { message: 'Invalid JSON' } }); }

      const { messages, system, model } = parsed;
      const hasImages = messages.some(m =>
        Array.isArray(m.content) && m.content.some(p => p.type === 'image_url')
      );

      const groqModel = model || (hasImages
        ? 'meta-llama/llama-4-scout-17b-16e-instruct'
        : 'llama-3.3-70b-versatile');

      console.log(`[REQUEST] model: ${groqModel}, messages: ${messages.length}, hasImages: ${hasImages}`);

      const requestBody = JSON.stringify({
        model: groqModel,
        messages: [
          { role: 'system', content: system || 'You are a helpful Java assistant.' },
          ...messages
        ],
        max_tokens: 2048,
        temperature: 0.7
      });

      const options = {
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Length': Buffer.byteLength(requestBody)
        }
      };

      const groqReq = https.request(options, groqRes => {
        let data = '';
        groqRes.on('data', chunk => { data += chunk; });
        groqRes.on('end', () => {
          console.log(`[GROQ] Status: ${groqRes.statusCode}`);
          if (groqRes.statusCode !== 200) {
            console.error('[GROQ] Error body:', data);
            try {
              const err = JSON.parse(data);
              return sendJSON(res, groqRes.statusCode, { error: err.error || { message: data } });
            } catch {
              return sendJSON(res, groqRes.statusCode, { error: { message: data } });
            }
          }
          try {
            const json = JSON.parse(data);
            const reply = json.choices?.[0]?.message?.content || '';
            console.log(`[GROQ] Got reply, length: ${reply.length}`);
            sendJSON(res, 200, { reply });
          } catch (e) {
            sendJSON(res, 500, { error: { message: 'Failed to parse Groq response: ' + e.message } });
          }
        });
      });

      groqReq.on('error', err => {
        console.error('[GROQ] Network error:', err.message);
        sendJSON(res, 500, { error: { message: 'Network error: ' + err.message } });
      });

      groqReq.write(requestBody);
      groqReq.end();
    });
    return;
  }

  // Catch-all
  sendJSON(res, 405, { error: { message: 'Method not allowed' } });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ☕  JavaBot Server');
  console.log(`  🚀  Running at http://localhost:${PORT}`);
  if (API_KEY === 'YOUR_GROQ_API_KEY_HERE') {
    console.log('  ⚠️   API KEY NOT SET — open server.js and add your Groq key!');
  } else {
    console.log('  ✅  API key is set. Ready!');
  }
  console.log('');
});