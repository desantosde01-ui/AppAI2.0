const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Coloque sua chave aqui ou use variável de ambiente (recomendado)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'SUA_CHAVE_AQUI';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rota que chama o Gemini
app.post('/api/chat', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt é obrigatório' });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4096, temperature: 0.7 }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Erro na API do Gemini');
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text.trim();

    res.json({ result: text });

  } catch (err) {
    console.error('Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
