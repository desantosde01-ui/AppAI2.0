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

// ─── Sanitize code from Claude ───────────────────────────────────────────────
function sanitizeCode(code) {
  // Remove ANY markdown code fence (typescript, tsx, jsx, js, etc)
  code = code.replace(/^```[a-zA-Z]*
?/, '').replace(/
?```$/, '').trim();
  code = code.replace(/[“”]/g, '"');
  code = code.replace(/[‘’]/g, "'");
  code = code.replace(/[–—]/g, '-');
  code = code.replace(/[ ]/g, ' ');
  if (!code.endsWith('
')) code += '
';
  return code;
}

// ─── Base files ───────────────────────────────────────────────────────────────
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
        isolatedModules: true, noEmit: true, jsx: 'react-jsx', strict: false
      },
      include: ['src']
    }, null, 2),
    'tsconfig.node.json': JSON.stringify({
      compilerOptions: { composite: true, skipLibCheck: true, module: 'ESNext', moduleResolution: 'bundler', allowSyntheticDefaultImports: true },
      include: ['vite.config.ts']
    }, null, 2),
    'postcss.config.js': `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }`,
    'tailwind.config.js': `/** @type {import('tailwindcss').Config} */\nexport default {\n  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],\n  theme: { extend: {} },\n  plugins: [],\n}`,
    'index.html': `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>CodeAI App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>`,
    'src/main.tsx': `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)`,
    'src/index.css': `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n* { box-sizing: border-box; }\nbody { margin: 0; }`,
    'src/App.tsx': appCode
  };
}

// ─── Build prompt ─────────────────────────────────────────────────────────────
function buildPrompt(userRequest, currentAppCode) {
  const isModify = !!currentAppCode;
  const base = `You are a senior React + TypeScript + Tailwind CSS expert. Create stunning, professional UI.

STRICT RULES:
- Return ONLY raw TSX code, no markdown, no code fences, no explanations
- Start directly with: import React from 'react'
- Export: export default function App()
- Use Tailwind CSS only, no inline styles
- Use lucide-react for icons (already installed)
- NO external imports besides react and lucide-react
- Use only standard ASCII characters in all strings and JSX content
- Every string must be properly terminated with matching quotes
- Every JSX tag must be properly closed`;

  if (isModify) {
    return `${base}\n\nCurrent code to modify:\n${currentAppCode}\n\nModification requested: ${userRequest}\n\nReturn the complete modified App.tsx:`;
  }
  return `${base}\n\nCreate a complete, visually impressive React app for: ${userRequest}\n\nReturn only the App.tsx code:`;
}

// ─── OpenRouter call ──────────────────────────────────────────────────────────
async function callOpenRouter(prompt) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-5',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `OpenRouter error ${response.status}`);
  }

  const data = await response.json();
  return sanitizeCode(data.choices[0].message.content);
}

// ─── Anthropic Vision call ────────────────────────────────────────────────────
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
      max_tokens: 16000,
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
  return sanitizeCode(data.content[0].text);
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// Generate / modify React project
app.post('/api/generate', async (req, res) => {
  const { prompt, currentAppCode } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });

  try {
    const appCode = await callOpenRouter(buildPrompt(prompt, currentAppCode));
    const files = getBaseFiles(appCode);
    res.json({ files, appCode });
  } catch (err) {
    console.error('/api/generate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Image -> React project
app.post('/api/image', async (req, res) => {
  const { image, mediaType, prompt } = req.body;
  if (!image) return res.status(400).json({ error: 'Image required' });

  const visionPrompt = `You are a senior React + TypeScript + Tailwind CSS expert.

Analyze this design/screenshot and recreate it as a React component.
${prompt ? `Additional instructions: ${prompt}` : ''}

STRICT RULES:
- Return ONLY raw TSX code, no markdown, no explanations
- Start with: import React from 'react'
- Export: export default function App()
- Use Tailwind CSS only
- Use lucide-react for icons if needed
- Use only ASCII characters in strings
- Be faithful to the colors, layout and visual style of the image`;

  try {
    const appCode = await callAnthropicVision(image, mediaType || 'image/png', visionPrompt);
    const files = getBaseFiles(appCode);
    res.json({ files, appCode });
  } catch (err) {
    console.error('/api/image error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Simple HTML chat (legacy)
app.post('/api/chat', async (req, res) => {
  const { prompt, code } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });

  const fullPrompt = `You are an HTML/CSS/JS expert. Return ONLY complete HTML, no markdown.\n\n${code ? `Current code:\n${code}\n\nRequest: ${prompt}` : prompt}`;

  try {
    const raw = await callOpenRouter(fullPrompt);
    res.json({ result: raw.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim() });
  } catch (err) {
    console.error('/api/chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`CodeAI running on port ${PORT}`));
