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

// Remove markdown fences from Claude response
function sanitizeCode(code) {
  code = code.trim();
  // Remove opening fence like ```typescript, ```tsx, ```jsx, ```js
  code = code.replace(/^```[a-zA-Z]*\n/, '');
  // Remove closing fence
  code = code.replace(/\n```$/, '');
  code = code.trim();
  // Fix curly quotes
  code = code.replace(/\u201C/g, '"').replace(/\u201D/g, '"');
  code = code.replace(/\u2018/g, "'").replace(/\u2019/g, "'");
  code = code.replace(/\u2013/g, '-').replace(/\u2014/g, '-');
  code = code.replace(/\u00A0/g, ' ');
  return code;
}

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
    'vite.config.ts': "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({ plugins: [react()] })",
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
    'postcss.config.js': "export default { plugins: { tailwindcss: {}, autoprefixer: {} } }",
    'tailwind.config.js': "export default { content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'], theme: { extend: {} }, plugins: [] }",
    'index.html': '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>CodeAI App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>',
    'src/main.tsx': "import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)",
    'src/index.css': '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n* { box-sizing: border-box; }\nbody { margin: 0; }',
    'src/App.tsx': appCode
  };
}

function buildPrompt(userRequest, currentAppCode, chatHistory) {
  const isModify = !!currentAppCode;

  const rules = [
    'Return ONLY raw TSX code with NO markdown fences, no backticks, no explanations',
    'Start directly with: import React from "react"',
    'Export: export default function App()',
    'Use Tailwind CSS only for all styles',
    'Use lucide-react for icons if needed (already installed)',
    'No external imports besides react and lucide-react',
    'Use only standard ASCII characters in strings and JSX text',
    'Make sure ALL strings are properly closed',
    'Make sure ALL JSX tags are properly closed'
  ].join('\n- ');

  if (isModify) {
    return [
      'You are a senior React + TypeScript + Tailwind CSS expert.',
      '',
      '!!! IMPORTANT: You are EDITING an existing project. DO NOT create a new project from scratch.',
      'The user has an existing React app and wants a SPECIFIC CHANGE. Make ONLY that change.',
      'Keep the entire structure, content, purpose and style of the app. Only modify what was explicitly asked.',
      '',
      'RULES:',
      '- ' + rules,
      '',
      '=== CURRENT App.tsx (DO NOT rewrite from scratch, only edit) ===',
      currentAppCode,
      '=== END OF CURRENT CODE ===',
      '',
      'USER CHANGE REQUEST: ' + userRequest,
      '',
      'Apply ONLY this change to the existing code above. Return the complete modified App.tsx:'
    ].join('\n');
  }

  return [
    'You are a world-class UI/UX designer and React developer creating agency-quality websites.',
    '',
    'DESIGN REQUIREMENTS:',
    '- Hero: large bold typography (text-7xl+), gradient background, NOT just centered text on black',
    '- Sections: alternate bg colors (zinc-950 / zinc-900 / zinc-800), generous spacing (py-24)',
    '- Cards: hover:scale-105 hover:shadow-xl hover:-translate-y-1 transition-all duration-300',
    '- Stats: text-5xl font-black, impactful and large',
    '- Avatars: always colored circles with initials, never empty boxes',
    '- Typography: inject Google Font via useEffect (e.g. Playfair Display or Bebas Neue for headings)',
    '- Buttons: one solid + one outlined variant, both with hover states',
    '- Details: gradient text on headings, decorative dividers, badge elements',
    '',
    'RULES:',
    '- ' + rules,
    '',
    'Create a stunning React app for: ' + userRequest,
    'Return only App.tsx code:'
  ].join('\n');
}

async function callOpenRouter(prompt) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + OPENROUTER_API_KEY
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-5',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error && err.error.message ? err.error.message : 'OpenRouter error ' + response.status);
  }

  const data = await response.json();
  return sanitizeCode(data.choices[0].message.content);
}

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
    throw new Error(err.error && err.error.message ? err.error.message : 'Anthropic error ' + response.status);
  }

  const data = await response.json();
  return sanitizeCode(data.content[0].text);
}

app.post('/api/generate', async (req, res) => {
  const { prompt, currentAppCode, chatHistory } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });

  try {
    const appCode = await callOpenRouter(buildPrompt(prompt, currentAppCode, chatHistory));
    const files = getBaseFiles(appCode);
    res.json({ files, appCode });
  } catch (err) {
    console.error('/api/generate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/image', async (req, res) => {
  const { image, mediaType, prompt } = req.body;
  if (!image) return res.status(400).json({ error: 'Image required' });

  const visionPrompt = 'You are a senior React + TypeScript + Tailwind CSS expert.\n\nAnalyze this design and recreate it as a React component.\n' + (prompt ? 'Additional instructions: ' + prompt + '\n' : '') + '\nRULES:\n- Return ONLY raw TSX code, no markdown fences, no backticks\n- Start with: import React from "react"\n- Export: export default function App()\n- Use Tailwind CSS only\n- Use lucide-react for icons if needed\n- ASCII characters only in strings\n- Be faithful to the colors and layout of the image';

  try {
    const appCode = await callAnthropicVision(image, mediaType || 'image/png', visionPrompt);
    const files = getBaseFiles(appCode);
    res.json({ files, appCode });
  } catch (err) {
    console.error('/api/image error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  const { prompt, code } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });

  const fullPrompt = 'You are an HTML/CSS/JS expert. Return ONLY complete HTML, no markdown.\n\n' + (code ? 'Current code:\n' + code + '\n\nRequest: ' + prompt : prompt);

  try {
    const result = await callOpenRouter(fullPrompt);
    res.json({ result: result.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim() });
  } catch (err) {
    console.error('/api/chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, function() {
  console.log('CodeAI running on port ' + PORT);
});
