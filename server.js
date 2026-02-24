const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/chat', async (req, res) => {
  const { prompt, code } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt é obrigatório' });

  const isReact = code && (
    code.includes('import React') ||
    code.includes('from "react"') ||
    code.includes("from 'react'") ||
    code.includes('tsx') ||
    code.includes('jsx') ||
    code.includes('"use client"')
  );

  const systemPrompt = isReact
    ? `Você é um especialista sênior em HTML, CSS, JavaScript e Three.js.
O usuário colou um componente React/TSX. Você deve convertê-lo para um único arquivo HTML puro que funcione no navegador sem build.
Regras:
- Use Three.js via CDN: <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
- Todo o código JS inline no HTML
- Sem imports, sem require, sem JSX
- Mantenha toda a lógica e visual idênticos ao original
- Retorne APENAS o HTML completo, sem explicações, sem markdown`
    : `Você é um especialista sênior em HTML, CSS e JavaScript.
Quando pedido para criar efeitos visuais, animações ou transições,
você SEMPRE implementa usando CSS puro com técnicas avançadas como
::before, ::after, transitions, transforms, keyframes e gradients.
Retorne APENAS o código HTML completo, sem explicações, sem markdown, sem blocos de código.`;

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
    console.error('Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
