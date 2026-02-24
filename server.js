const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

async function callClaude(messages, maxTokens = 8192) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Erro na API do Claude');
  }

  const data = await response.json();
  let result = data.content[0].text.trim();
  result = result.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
  return result;
}

app.post('/api/chat', async (req, res) => {
  const { prompt, code } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt é obrigatório' });

  const isReact = code && (
    code.includes('import React') ||
    code.includes('from "react"') ||
    code.includes("from 'react'") ||
    code.includes('"use client"') ||
    code.includes("'use client'")
  );

  const systemPrompt = isReact
    ? `Você é um especialista sênior em HTML, CSS, JavaScript e Three.js.
O usuário colou um componente React/TSX. Converta para um único arquivo HTML puro que funcione no navegador sem build.
Regras:
- Use Three.js via CDN se necessário (tag script com URL do cdnjs)
- Todo CSS e JS inline no HTML
- Sem imports, sem require, sem JSX
- Mantenha shaders GLSL exatamente iguais
- Mantenha o visual e comportamento idênticos ao original
- Retorne APENAS o HTML completo, sem explicações, sem markdown`
    : `Você é um especialista sênior em HTML, CSS e JavaScript com foco em UI de alta qualidade.
Quando modificar código, mantenha o estilo visual e melhore com CSS avançado.
Retorne APENAS o código HTML completo, sem explicações, sem markdown.`;

  try {
    const result = await callClaude([{ role: 'user', content: `${systemPrompt}\n\n${prompt}` }]);
    res.json({ result });
  } catch (err) {
    console.error('Erro chat:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/image', async (req, res) => {
  const { image, mediaType, prompt } = req.body;
  if (!image) return res.status(400).json({ error: 'Imagem é obrigatória' });
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada' });

  const userPrompt = prompt || 'Analise este componente/design com atenção a cada detalhe e gere um arquivo HTML completo e funcional que replique exatamente o que você vê. Use CSS moderno, animações se houver, e JavaScript se necessário. Seja fiel às cores, espaçamentos, tipografia e efeitos visuais. Retorne APENAS o código HTML completo, sem explicações, sem markdown.';

  try {
    const result = await callClaude([{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/png', data: image } },
        { type: 'text', text: userPrompt }
      ]
    }]);
    res.json({ result });
  } catch (err) {
    console.error('Erro imagem:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
