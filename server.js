const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rota para modificar código (OpenRouter/Gemini)
app.post('/api/chat', async (req, res) => {
  const { prompt, code } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt é obrigatório' });

  const isReact = code && (
    code.includes('import React') ||
    code.includes('from "react"') ||
    code.includes("from 'react'") ||
    code.includes('"use client"')
  );

  const systemPrompt = isReact
    ? `Você é um especialista sênior em HTML, CSS, JavaScript e Three.js.
O usuário colou um componente React/TSX. Converta para um único arquivo HTML puro que funcione no navegador sem build.
Regras:
- Use Three.js via CDN se necessário: <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
- Todo CSS e JS inline no HTML
- Sem imports, sem require, sem JSX
- Mantenha o visual idêntico ao original
- Retorne APENAS o HTML completo, sem explicações, sem markdown`
    : `Você é um especialista sênior em HTML, CSS e JavaScript.
Implemente efeitos visuais usando CSS avançado: ::before, ::after, transitions, transforms, keyframes, gradients.
Retorne APENAS o código HTML completo, sem explicações, sem markdown.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Erro na API');
    }

    const data = await response.json();
    const text = data.choices[0].message.content.trim();
    const cleaned = text.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
    res.json({ result: cleaned });

  } catch (err) {
    console.error('Erro chat:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Rota para analisar imagem com Claude
app.post('/api/image', async (req, res) => {
  const { image, mediaType, prompt } = req.body;

  if (!image) return res.status(400).json({ error: 'Imagem é obrigatória' });
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada' });

  const userPrompt = prompt ||
    'Analise este componente/design e gere um arquivo HTML completo e funcional que replique exatamente o que você vê. Use CSS moderno, animações se houver, e JavaScript se necessário. Retorne APENAS o código HTML completo, sem explicações, sem markdown.';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType || 'image/png',
                  data: image
                }
              },
              {
                type: 'text',
                text: userPrompt
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Erro na API do Claude');
    }

    const data = await response.json();
    let result = data.content[0].text.trim();
    result = result.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
    res.json({ result });

  } catch (err) {
    console.error('Erro imagem:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
