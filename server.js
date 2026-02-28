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

// ─── FONT PAIRS BY NICHE ─────────────────────────────────────────────────────
const FONT_PAIRS = {
  barbershop:   { heading: 'Bebas Neue',        body: 'Inter',          url: 'Bebas+Neue|Inter:wght@400;500;600' },
  restaurant:   { heading: 'Cormorant Garamond', body: 'Nunito',        url: 'Cormorant+Garamond:wght@600;700|Nunito:wght@400;600' },
  law:          { heading: 'Playfair Display',   body: 'Lato',          url: 'Playfair+Display:wght@600;700;800|Lato:wght@400;700' },
  tech:         { heading: 'Space Grotesk',      body: 'DM Sans',       url: 'Space+Grotesk:wght@600;700|DM+Sans:wght@400;500' },
  beauty:       { heading: 'Bodoni Moda',        body: 'Jost',          url: 'Bodoni+Moda:wght@600;700|Jost:wght@400;500' },
  fitness:      { heading: 'Barlow Condensed',   body: 'Barlow',        url: 'Barlow+Condensed:wght@700;800|Barlow:wght@400;500' },
  medical:      { heading: 'Merriweather',       body: 'Source Sans 3', url: 'Merriweather:wght@700|Source+Sans+3:wght@400;600' },
  realestate:   { heading: 'Cormorant',          body: 'Raleway',       url: 'Cormorant:wght@600;700|Raleway:wght@400;500;600' },
  education:    { heading: 'Nunito',             body: 'Open Sans',     url: 'Nunito:wght@700;800|Open+Sans:wght@400;600' },
  creative:     { heading: 'Syne',               body: 'Manrope',       url: 'Syne:wght@700;800|Manrope:wght@400;500' },
  hotel:        { heading: 'Libre Baskerville',  body: 'Mulish',        url: 'Libre+Baskerville:wght@700|Mulish:wght@400;500' },
  default:      { heading: 'Plus Jakarta Sans',  body: 'Inter',         url: 'Plus+Jakarta+Sans:wght@600;700;800|Inter:wght@400;500;600' },
};

// ─── UNSPLASH IMAGES BY NICHE ─────────────────────────────────────────────────
const UNSPLASH_IMAGES = {
  barbershop: [
    'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1200&q=80',
    'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80',
    'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80',
    'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800&q=80',
  ],
  restaurant: [
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
  ],
  law: [
    'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&q=80',
    'https://images.unsplash.com/photo-1436450412740-6b988f486c6b?w=800&q=80',
    'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80',
  ],
  tech: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80',
    'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80',
  ],
  beauty: [
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80',
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80',
    'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=80',
  ],
  fitness: [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80',
    'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&q=80',
  ],
  medical: [
    'https://images.unsplash.com/photo-1551076805-e1869033e561?w=1200&q=80',
    'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80',
  ],
  realestate: [
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80',
    'https://images.unsplash.com/photo-1560184897-ae75f418493e?w=800&q=80',
    'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80',
  ],
  hotel: [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80',
  ],
  default: [
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80',
    'https://images.unsplash.com/photo-1497366754035-f200968a7db3?w=800&q=80',
  ],
};

// ─── DETECT NICHE FROM PROMPT ─────────────────────────────────────────────────
function detectNiche(prompt) {
  const p = prompt.toLowerCase();
  if (/barber|barbearia|cabeleir|haircut|salao de corte/.test(p)) return 'barbershop';
  if (/restauran|food|comida|cafe|cafeteria|pizza|burger|hamburguer|bistro/.test(p)) return 'restaurant';
  if (/law|advogad|juridic|advocacia|lawyer|legal/.test(p)) return 'law';
  if (/tech|software|startup|saas|app|sistema|digital agency/.test(p)) return 'tech';
  if (/beauty|beleza|estetica|spa|nail|unhas|makeup|maquiagem/.test(p)) return 'beauty';
  if (/fitness|academia|gym|personal trainer|crossfit|treino/.test(p)) return 'fitness';
  if (/medic|clinic|saude|health|doctor|doutor|hospital|dental/.test(p)) return 'medical';
  if (/imovel|imobiliaria|real estate|apartamento|casa|aluguel/.test(p)) return 'realestate';
  if (/hotel|pousada|resort|hospedagem/.test(p)) return 'hotel';
  if (/escola|educacao|curso|ensino|colegio|universidade/.test(p)) return 'education';
  if (/design|creative|portfolio|agencia criativa/.test(p)) return 'creative';
  return 'default';
}

// ─── SANITIZE CODE ────────────────────────────────────────────────────────────
function sanitizeCode(code) {
  code = code.trim();
  code = code.replace(/^```[a-zA-Z]*\n/, '');
  code = code.replace(/\n```$/, '');
  code = code.trim();
  code = code.replace(/\u201C/g, '"').replace(/\u201D/g, '"');
  code = code.replace(/\u2018/g, "'").replace(/\u2019/g, "'");
  code = code.replace(/\u2013/g, '-').replace(/\u2014/g, '-');
  code = code.replace(/\u00A0/g, ' ');
  return code;
}

// ─── BASE FILES ───────────────────────────────────────────────────────────────
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

// ─── BUILD PROMPT ─────────────────────────────────────────────────────────────
function buildPrompt(userRequest, currentAppCode, chatHistory) {
  const isModify = !!currentAppCode;

  const rules = [
    'Return ONLY raw TSX code with NO markdown fences, no backticks, no explanations',
    'Start directly with: import React from "react"',
    'Export: export default function App()',
    'Use Tailwind CSS only for all styles',
    'Use lucide-react for icons (already installed)',
    'No external imports besides react and lucide-react',
    'Use only ASCII characters in strings and JSX text',
    'ALL strings must be properly closed',
    'ALL JSX tags must be properly closed'
  ].join('\n- ');

  if (isModify) {
    return [
      'You are a senior React + TypeScript + Tailwind CSS expert.',
      '',
      '!!! IMPORTANT: You are EDITING an existing project. DO NOT create a new project from scratch.',
      'Make ONLY the requested change. Keep all structure, content and style intact.',
      '',
      'RULES:\n- ' + rules,
      '',
      '=== CURRENT App.tsx ===',
      currentAppCode,
      '=== END ===',
      '',
      'USER REQUEST: ' + userRequest,
      '',
      'Return the complete modified App.tsx:'
    ].join('\n');
  }

  // Detect niche and get font/image context
  const niche = detectNiche(userRequest);
  const fonts = FONT_PAIRS[niche] || FONT_PAIRS.default;
  const images = UNSPLASH_IMAGES[niche] || UNSPLASH_IMAGES.default;

  const fontInstruction = [
    'FONTS: Load these Google Fonts in a useEffect by injecting a <link> tag:',
    '  URL: https://fonts.googleapis.com/css2?family=' + fonts.url + '&display=swap',
    '  Heading font: "' + fonts.heading + '" - use with style={{fontFamily: \'"' + fonts.heading + '", serif\'}} on all headings',
    '  Body font: "' + fonts.body + '" - inject on document.body style',
  ].join('\n');

  const imageInstruction = [
    'IMAGES: Use these real Unsplash photos (already hosted, just use the URLs directly in <img> tags):',
    images.map((url, i) => '  Image ' + (i+1) + ': ' + url).join('\n'),
    '  - Use Image 1 as hero background (full width, object-cover)',
    '  - Use other images in gallery, team, or feature sections',
    '  - Always add loading="lazy" and proper alt text',
  ].join('\n');

  return [
    'You are a world-class UI/UX designer and React developer creating agency-quality websites.',
    '',
    fontInstruction,
    '',
    imageInstruction,
    '',
    'DESIGN REQUIREMENTS:',
    '- Hero: full-screen with real background image (overlay gradient for text readability), massive typography',
    '- Sections: alternate bg colors, generous spacing (py-24), smooth hover transitions',
    '- Cards: hover:scale-105 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300',
    '- Stats: text-5xl font-black, make them visually impactful',
    '- Avatars: colored gradient circles with initials, never empty boxes',
    '- Buttons: solid primary + outlined secondary with hover states',
    '- Add subtle section dividers and decorative elements',
    '',
    'RULES:\n- ' + rules,
    '',
    'Create a stunning, agency-quality React app for: ' + userRequest,
    'Return only App.tsx:'
  ].join('\n');
}

// ─── OPENROUTER CALL ──────────────────────────────────────────────────────────
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

// ─── ANTHROPIC VISION ─────────────────────────────────────────────────────────
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

// ─── ROUTES ───────────────────────────────────────────────────────────────────
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

  const visionPrompt = [
    'You are a senior React + TypeScript + Tailwind CSS expert.',
    'Analyze this design and recreate it as a React component.',
    prompt ? 'Additional instructions: ' + prompt : '',
    '',
    'RULES:',
    '- Return ONLY raw TSX code, no markdown fences',
    '- Start with: import React from "react"',
    '- Export: export default function App()',
    '- Use Tailwind CSS only',
    '- Use lucide-react for icons if needed',
    '- ASCII characters only in strings',
    '- Be faithful to the colors, layout and style of the image'
  ].join('\n');

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

  const fullPrompt = 'You are an HTML/CSS/JS expert. Return ONLY complete HTML, no markdown.\n\n' +
    (code ? 'Current code:\n' + code + '\n\nRequest: ' + prompt : prompt);

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
