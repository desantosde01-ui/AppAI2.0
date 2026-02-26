const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Template base do projeto React + Vite + Tailwind ───────────────────────
function getBaseFiles() {
  return {
    'package.json': JSON.stringify({
      name: 'codeai-project',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: { dev: 'vite', build: 'tsc && vite build', preview: 'vite preview' },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
        'lucide-react': '^0.263.1'
      },
      devDependencies: {
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        '@vitejs/plugin-react': '^4.0.0',
        autoprefixer: '^10.4.14',
        postcss: '^8.4.27',
        tailwindcss: '^3.3.3',
        typescript: '^5.0.2',
        vite: '^4.4.5'
      }
    }, null, 2),

    'vite.config.ts': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()] })`,

    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: 'ES2020', useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'], module: 'ESNext',
        skipLibCheck: true, moduleResolution: 'bundler',
        allowImportingTsExtensions: true, resolveJsonModule: true,
        isolatedModules: true, noEmit: true, jsx: 'react-jsx',
        strict: true, noUnusedLocals: true, noUnusedParameters: true,
        noFallthroughCasesInSwitch: true
      },
      include: ['src'], references: [{ path: './tsconfig.node.json' }]
    }, null, 2),

    'tsconfig.node.json': JSON.stringify({
      compilerOptions: { composite: true, skipLibCheck: true, module: 'ESNext', moduleResolution: 'bundler', allowSyntheticDefaultImports: true },
      include: ['vite.config.ts']
    }, null, 2),

    'postcss.config.js': `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }`,

    'tailwind.config.js': `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}`,

    'index.html': `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CodeAI App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,

    'src/main.tsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,

    'src/index.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; }
body { margin: 0; }`,
  };
}

// ─── Prompt de sistema para geração React ───────────────────────────────────
function getReactSystemPrompt(isModification) {
  return `Você é um especialista sênior em React, TypeScript e Tailwind CSS que cria interfaces de altíssima qualidade visual.

${isModification ? 'O usuário quer MODIFICAR o projeto existente.' : 'Crie um projeto React NOVO e COMPLETO.'}

REGRAS:
- Use React + TypeScript + Tailwind CSS
- Crie componentes bem organizados em src/components/
- Use lucide-react para ícones (já instalado)
- Design moderno, profissional e visualmente impressionante
- Cores coesas, tipografia elegante, animações suaves com Tailwind
- Responsivo por padrão
- Sem dependências externas além das já instaladas

RESPONDA APENAS com um JSON válido neste formato exato:
{
  "files": {
    "src/App.tsx": "conteúdo do arquivo",
    "src/components/Hero.tsx": "conteúdo do arquivo",
    "src/components/Navbar.tsx": "conteúdo do arquivo"
  }
}

Inclua apenas os arquivos src/ que criar/modificar. Não inclua package.json, vite.config.ts, etc.`;
}

// ─── Chamar Claude via OpenRouter ───────────────────────────────────────────
async function callOpenRouter(messages, maxTokens = 8192) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-5',
      max_tokens: maxTokens,
      messages
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Erro OpenRouter');
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// ─── Chamar Claude Vision via Anthropic ─────────────────────────────────────
async function callAnthropicVision(image, mediaType, prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: prompt }
        ]
      }]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Erro Anthropic');
  }

  const data = await response.json();
  return data.content[0].text.trim();
}

// ─── Parsear JSON da resposta do Claude ─────────────────────────────────────
function parseFilesFromResponse(raw) {
  try {
    // Remove markdown code blocks if present
    const clean = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(clean);
    return parsed.files || parsed;
  } catch (e) {
    // Try to extract JSON from inside the text
    const match = raw.match(/\{[\s\S]*"files"[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return parsed.files || parsed;
    }
    throw new Error('Não foi possível parsear os arquivos gerados');
  }
}

// ─── ROTA: Gerar projeto do zero ou modificar ───────────────────────────────
app.post('/api/generate', async (req, res) => {
  const { prompt, currentFiles } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt obrigatório' });

  const isModification = currentFiles && Object.keys(currentFiles).length > 0;
  const systemPrompt = getReactSystemPrompt(isModification);

  let userContent = prompt;
  if (isModification) {
    const srcFiles = Object.entries(currentFiles)
      .filter(([k]) => k.startsWith('src/'))
      .map(([k, v]) => `// ${k}\n${v}`)
      .join('\n\n---\n\n');
    userContent = `Arquivos atuais:\n${srcFiles}\n\nPedido: ${prompt}`;
  }

  try {
    const raw = await callOpenRouter([
      { role: 'user', content: `${systemPrompt}\n\n${userContent}` }
    ]);

    const srcFiles = parseFilesFromResponse(raw);
    const baseFiles = getBaseFiles();
    const allFiles = { ...baseFiles, ...srcFiles };

    res.json({ files: allFiles });
  } catch (err) {
    console.error('Erro generate:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── ROTA: Imagem → projeto React ───────────────────────────────────────────
app.post('/api/image', async (req, res) => {
  const { image, mediaType, prompt, mode } = req.body;
  if (!image) return res.status(400).json({ error: 'Imagem obrigatória' });

  const isReactMode = mode === 'react';
  const systemPrompt = isReactMode ? getReactSystemPrompt(false) : '';

  const userPrompt = isReactMode
    ? `${systemPrompt}\n\nAnalise este design e recrie como projeto React com Tailwind. ${prompt || ''}`
    : `Analise este design e gere um HTML completo e funcional que replique exatamente o que você vê. Use CSS moderno. Retorne APENAS o HTML, sem explicações. ${prompt || ''}`;

  try {
    const raw = await callAnthropicVision(image, mediaType || 'image/png', userPrompt);

    if (isReactMode) {
      const srcFiles = parseFilesFromResponse(raw);
      const baseFiles = getBaseFiles();
      res.json({ files: { ...baseFiles, ...srcFiles } });
    } else {
      let result = raw.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
      res.json({ result });
    }
  } catch (err) {
    console.error('Erro image:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── ROTA: Chat simples (modificar HTML) ────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { prompt, code } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt obrigatório' });

  const system = `Você é especialista em HTML, CSS e JavaScript. Retorne APENAS o código HTML completo, sem explicações, sem markdown.`;

  try {
    const raw = await callOpenRouter([
      { role: 'user', content: `${system}\n\n${prompt}` }
    ]);
    const result = raw.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
    res.json({ result });
  } catch (err) {
    console.error('Erro chat:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ CodeAI rodando em http://localhost:${PORT}`));
