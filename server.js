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

// ─── Base files do projeto React + Vite + Tailwind ───────────────────────────
function getBaseFiles(appCode) {
  return {
    'package.json': JSON.stringify({
      name: 'codeai-project', private: true, version: '0.0.0', type: 'module',
      scripts: { dev: 'vite', build: 'tsc && vite build', preview: 'vite preview' },
      dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0', 'lucide-react': '^0.263.1' },
      devDependencies: {
        '@types/react': '^18.2.0', '@types/react-dom': '^18.2.0',
        '@vitejs/plugin-react': '^4.0.0', autoprefixer: '^10.4.14',
        postcss: '^8.4.27', tailwindcss: '^3.3.3', typescript: '^5.0.2', vite: '^4.4.5'
      }
    }, null, 2),
    'vite.config.ts': `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({ plugins: [react()] })`,
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: 'ES2020', useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'], module: 'ESNext',
        skipLibCheck: true, moduleResolution: 'bundler',
        allowImportingTsExtensions: true, resolveJsonModule: true,
        isolatedModules: true, noEmit: true, jsx: 'react-jsx',
        strict: false
      },
      include: ['src']
    }, null, 2),
    'tsconfig.node.json': JSON.stringify({
      compilerOptions: { composite: true, skipLibCheck: true, module: 'ESNext', moduleResolution: 'bundler', allowSyntheticDefaultImports: true },
      include: ['vite.config.ts']
    }, null, 2),
    'postcss.config.js': `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }`,
    'tailwind.config.js': `/** @type {import('tailwindcss').Config} */\nexport default {\n  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],\n  theme: { extend: {} },\n  plugins: [],\n}`,
    'index.html': `<!DOCTYPE html>\n<html lang="pt-BR">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>CodeAI App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>`,
    'src/main.tsx': `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)`,
    'src/index.css': `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n* { box-sizing: border-box; }\nbody { margin: 0; }`,
    'src/App.tsx': appCode
  };
}

// ─── Prompt para gerar apenas App.tsx ────────────────────────────────────────
function getPrompt(userRequest, currentAppCode) {
  const isModify = !!currentAppCode;
  return `Você é um especialista em React, TypeScript e Tailwind CSS que cria interfaces de altíssima qualidade visual.

${isModify ? `MODIFIQUE o componente abaixo conforme o pedido:\n\`\`\`tsx\n${currentAppCode}\n\`\`\`\n\nPedido: ${userRequest}` : `Crie um componente React para: ${userRequest}`}

REGRAS OBRIGATÓRIAS:
- Retorne APENAS o código TSX do App.tsx, sem explicações, sem markdown, sem blocos de código
- Use Tailwind CSS para todos os estilos
- Use lucide-react para ícones se necessário (já instalado)
- O componente deve ser export default function App()
- Design moderno, profissional e visualmente impressionante
- Responsivo por padrão
- Sem imports externos além de react e lucide-react
- Comece direto com: import React from 'react'`;
}

// ─── Chamar Claude via OpenRouter ────────────────────────────────────────────
async function callOpenRouter(prompt, maxTokens = 16000) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-5',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `OpenRouter error ${response.status}`);
  }

  const data = await response.json();
  let result = data.choices[0].message.content.trim();
  // Remove any markdown code blocks if present
  result = result.replace(/^```tsx?\n?/i, '').replace(/\n?```$/i, '').trim();
  return result;
}

// ─── Chamar Claude Vision via Anthropic ──────────────────────────────────────
async function callAnthropicVision(image, mediaType, prompt, maxTokens = 16000) {
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
    throw new Error(err.error?.message || `Anthropic error ${response.status}`);
  }

  const data = await response.json();
  let result = data.content[0].text.trim();
  result = result.replace(/^```tsx?\n?/i, '').replace(/\n?```$/i, '').trim();
  return result;
}

// ─── ROTA: Gerar/modificar projeto React ─────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  const { prompt, currentAppCode } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt obrigatório' });

  try {
    const fullPrompt = getPrompt(prompt, currentAppCode);
    const appCode = await callOpenRouter(fullPrompt);
    const files = getBaseFiles(appCode);
    res.json({ files, appCode });
  } catch (err) {
    console.error('Erro /api/generate:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── ROTA: Imagem → projeto React ────────────────────────────────────────────
app.post('/api/image', async (req, res) => {
  const { image, mediaType, prompt } = req.body;
  if (!image) return res.status(400).json({ error: 'Imagem obrigatória' });

  const visionPrompt = `Você é um especialista em React, TypeScript e Tailwind CSS.

Analise este design/screenshot e recrie como um componente React.

${prompt ? `Instruções adicionais: ${prompt}` : ''}

REGRAS OBRIGATÓRIAS:
- Retorne APENAS o código TSX, sem explicações, sem markdown
- Use Tailwind CSS para todos os estilos
- Use lucide-react para ícones se necessário
- Export default function App()
- Seja fiel às cores, layout e estilo visual da imagem
- Comece direto com: import React from 'react'`;

  try {
    const appCode = await callAnthropicVision(image, mediaType || 'image/png', visionPrompt);
    const files = getBaseFiles(appCode);
    res.json({ files, appCode });
  } catch (err) {
    console.error('Erro /api/image:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── ROTA: Chat HTML simples ──────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { prompt, code } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt obrigatório' });

  const fullPrompt = `Você é especialista em HTML, CSS e JavaScript. Retorne APENAS o HTML completo, sem explicações, sem markdown.\n\n${code ? `Código atual:\n${code}\n\nPedido: ${prompt}` : prompt}`;

  try {
    const result = await callOpenRouter(fullPrompt);
    res.json({ result: result.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim() });
  } catch (err) {
    console.error('Erro /api/chat:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ CodeAI rodando na porta ${PORT}`));
