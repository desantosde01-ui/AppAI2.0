// server.js
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // ✅ CommonJS: use node-fetch@2
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const FONT_PAIRS = {
  barbershop:   { heading: 'Bebas Neue',         body: 'Inter',           url: 'Bebas+Neue|Inter:wght@400;500;600' },
  restaurant:   { heading: 'Cormorant Garamond', body: 'Nunito',          url: 'Cormorant+Garamond:wght@600;700|Nunito:wght@400;600' },
  law:          { heading: 'Playfair Display',   body: 'Lato',            url: 'Playfair+Display:wght@600;700;800|Lato:wght@400;700' },
  tech:         { heading: 'Space Grotesk',      body: 'DM Sans',         url: 'Space+Grotesk:wght@600;700|DM+Sans:wght@400;500' },
  beauty:       { heading: 'Bodoni Moda',        body: 'Jost',            url: 'Bodoni+Moda:wght@600;700|Jost:wght@400;500' },
  fitness:      { heading: 'Barlow Condensed',   body: 'Barlow',          url: 'Barlow+Condensed:wght@700;800|Barlow:wght@400;500' },
  medical:      { heading: 'Merriweather',       body: 'Source Sans 3',   url: 'Merriweather:wght@700|Source+Sans+3:wght@400;600' },
  realestate:   { heading: 'Cormorant',          body: 'Raleway',         url: 'Cormorant:wght@600;700|Raleway:wght@400;500;600' },
  education:    { heading: 'Nunito',             body: 'Open Sans',       url: 'Nunito:wght@700;800|Open+Sans:wght@400;600' },
  creative:     { heading: 'Syne',               body: 'Manrope',         url: 'Syne:wght@700;800|Manrope:wght@400;500' },
  hotel:        { heading: 'Libre Baskerville',  body: 'Mulish',          url: 'Libre+Baskerville:wght@700|Mulish:wght@400;500' },
  automotive:   { heading: 'Rajdhani',           body: 'Roboto',          url: 'Rajdhani:wght@600;700|Roboto:wght@400;500' },
  food:         { heading: 'Satisfy',            body: 'Lato',            url: 'Satisfy|Lato:wght@400;700' },
  construction: { heading: 'Oswald',             body: 'Roboto',          url: 'Oswald:wght@600;700|Roboto:wght@400;500' },
  finance:      { heading: 'Libre Baskerville',  body: 'Source Sans 3',   url: 'Libre+Baskerville:wght@700|Source+Sans+3:wght@400;600' },
  default:      { heading: 'Plus Jakarta Sans',  body: 'Inter',           url: 'Plus+Jakarta+Sans:wght@600;700;800|Inter:wght@400;500;600' },
};

function sanitizeCode(code) {
  code = (code || '').trim();

  // remove fences
  code = code.replace(/^```[a-zA-Z]*\r?\n/gm, '');
  code = code.replace(/^```\r?$/gm, '');
  code = code.replace(/```[a-zA-Z]*\n/g, '');
  code = code.replace(/```/g, '');
  code = code.trim();

  // smart quotes
  code = code.replace(/\u201C/g, '"').replace(/\u201D/g, '"');
  code = code.replace(/\u2018/g, "'").replace(/\u2019/g, "'");
  code = code.replace(/\u2013/g, '-').replace(/\u2014/g, '-');
  code = code.replace(/\u00A0/g, ' ');

  // dedupe import React
  let reactImportFound = false;
  code = code
    .split('\n')
    .filter(function (line) {
      if (/^import React/.test(line.trim())) {
        if (reactImportFound) return false;
        reactImportFound = true;
      }
      return true;
    })
    .join('\n');

  return code;
}

// ─── TOGETHER IMAGE (SD3) ───────────────────────────────────────────────────
async function generateTogetherImage(prompt) {
  try {
    if (!TOGETHER_API_KEY) {
      console.error('Missing TOGETHER_API_KEY');
      return null;
    }

    const response = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + TOGETHER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'stabilityai/stable-diffusion-3',
        prompt: prompt,
        response_format: 'url',
        width: 1024,
        height: 1024,
        steps: 30,
        output_format: 'jpeg',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Together error:', response.status, errText);
      return null;
    }

    const data = await response.json();

    const url = data && data.data && data.data[0] && data.data[0].url ? data.data[0].url : null;
    if (url && typeof url === 'string' && url.startsWith('http')) {
      console.log('Together image URL OK:', url);
      return { url: url, alt: prompt };
    }

    const b64 = data && data.data && data.data[0] && data.data[0].b64_json ? data.data[0].b64_json : null;
    if (b64 && typeof b64 === 'string') {
      console.log('Together image base64 OK (data URI)');
      return { url: 'data:image/jpeg;base64,' + b64, alt: prompt };
    }

    console.error('Together unexpected response:', JSON.stringify(data));
    return null;
  } catch (err) {
    console.error('Together fetch error:', err.message);
    return null;
  }
}

async function getImagesForPrompt(userPrompt) {
  try {
    if (!TOGETHER_API_KEY) return null;

    const promptGeneration =
      'Based on this website request: "' +
      userPrompt +
      '", generate 4 specific English image prompts for AI image generation. Each prompt should describe a professional, high-quality photo relevant to this business. Return ONLY a JSON array of 4 strings, nothing else.';

    const raw = await callOpenRouter(promptGeneration);
    const clean = (raw || '').replace(/```json|```/g, '').trim();

    let prompts;
    try {
      prompts = JSON.parse(clean);
    } catch (e) {
      const topic = (userPrompt || '').slice(0, 60);
      prompts = [
        'professional ' + topic + ' interior photography, high-end, cinematic lighting, ultra realistic',
        topic + ' service close up, premium, shallow depth of field, ultra realistic',
        topic + ' team working, corporate, premium office, ultra realistic',
        topic + ' luxury detail shot, elegant, professional photography, ultra realistic',
      ];
    }

    console.log('Together: generating', prompts.length, 'images...');
    const results = await Promise.all(prompts.slice(0, 4).map(function (p) { return generateTogetherImage(p); }));
    const images = results.filter(Boolean);

    console.log('Together: generated', images.length, 'of', prompts.length);
    return images.length > 0 ? images : null;
  } catch (err) {
    console.error('getImagesForPrompt error:', err.message);
    return null;
  }
}

function getBaseFiles(appCode) {
  return {
    'package.json': JSON.stringify(
      {
        name: 'codeai-project',
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: { dev: 'vite', build: 'tsc && vite build', preview: 'vite preview' },
        dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0', 'lucide-react': '^0.263.1' },
        devDependencies: {
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0',
          '@vitejs/plugin-react': '^4.0.0',
          autoprefixer: '^10.4.14',
          postcss: '^8.4.27',
          tailwindcss: '^3.3.3',
          typescript: '^5.0.2',
          vite: '^4.4.5',
        },
      },
      null,
      2
    ),
    'vite.config.ts':
      "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({ plugins: [react()] })",
    'tsconfig.json': JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          strict: false,
        },
        include: ['src'],
      },
      null,
      2
    ),
    'tsconfig.node.json': JSON.stringify(
      {
        compilerOptions: {
          composite: true,
          skipLibCheck: true,
          module: 'ESNext',
          moduleResolution: 'bundler',
          allowSyntheticDefaultImports: true,
        },
        include: ['vite.config.ts'],
      },
      null,
      2
    ),
    'postcss.config.js': 'export default { plugins: { tailwindcss: {}, autoprefixer: {} } }',
    'tailwind.config.js':
      "export default { content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'], theme: { extend: {} }, plugins: [] }",
    'index.html':
      '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>CodeAI App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>',
    'src/main.tsx':
      "import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)\n",
    'src/index.css':
      '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n* { box-sizing: border-box; }\nbody { margin: 0; }',
    'src/App.tsx': appCode,
  };
}

function buildPrompt(userRequest, currentAppCode, images) {
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
    'ALL JSX tags must be properly closed',
    'NEVER use unsplash.com, picsum.photos, via.placeholder.com or ANY external image provider unless it is exactly one of the provided IMAGE_URL constants',
  ].join('\n- ');

  if (isModify) {
    return [
      'You are a senior React + TypeScript + Tailwind CSS expert.',
      'You are EDITING an existing App.tsx. Make ONLY the requested change.',
      'RULES:\n- ' + rules,
      '=== CURRENT App.tsx ===',
      currentAppCode,
      '=== END ===',
      'USER REQUEST: ' + userRequest,
      'Return the complete modified App.tsx:',
    ].join('\n');
  }

  const p2 = (userRequest || '').toLowerCase();
  let fonts = FONT_PAIRS.default;
  if (/advogad|juridic|law|legal/.test(p2)) fonts = FONT_PAIRS.law;

  const fontInstruction = [
    'FONTS: Load these Google Fonts in a useEffect by injecting a <link> tag:',
    'URL: https://fonts.googleapis.com/css2?family=' + fonts.url + '&display=swap',
    'Heading font: "' + fonts.heading + '"',
    'Body font: "' + fonts.body + '"',
  ].join('\n');

  const imageInstruction =
    images && images.length > 0
      ? [
          'IMAGES: You MUST define these constants at the top and use them for ALL <img> tags.',
          images.map(function (img, i) { return 'const IMAGE_' + (i + 1) + '_URL = "' + img.url + '";'; }).join('\n'),
          'CRITICAL: Use IMAGE_1_URL as hero background image. Use IMAGE_2_URL..IMAGE_4_URL across cards/sections.',
          'FORBIDDEN: Do NOT use any other image URLs.',
        ].join('\n')
      : [
          'IMAGES: None provided. Do NOT use any external image URLs. Use gradient div blocks instead of images.',
        ].join('\n');

  return [
    'You are a world-class UI/UX designer and React developer creating agency-quality websites.',
    fontInstruction,
    imageInstruction,
    'RULES:\n- ' + rules,
    'Create a stunning, agency-quality React app for: ' + userRequest,
    'Return only App.tsx:',
  ].join('\n\n');
}

function appUsesAllImageUrls(appCode, images) {
  if (!images || images.length === 0) return true;
  const c = appCode || '';
  // garante pelo menos 2 URLs presentes (hero + mais 1)
  let hit = 0;
  for (let i = 0; i < images.length; i++) {
    if (images[i] && images[i].url && c.includes(images[i].url)) hit++;
  }
  return hit >= Math.min(2, images.length);
}

async function forceFixImages(appCode, images) {
  // Segunda passada: "você esqueceu de usar as URLs"
  const fixPrompt = [
    'You are a senior React + TypeScript + Tailwind CSS expert.',
    'TASK: The code below does NOT use the required image URLs. Fix it.',
    'RULES:',
    '- Return ONLY raw TSX (no markdown).',
    '- Keep design/layout/text the same as much as possible.',
    '- Replace ALL <img src="..."> to use the provided URLs.',
    '- FORBIDDEN: Do not use any other image URL.',
    '',
    'REQUIRED IMAGE URLS:',
    images.map(function (img, i) { return 'IMAGE_' + (i + 1) + '_URL=' + img.url; }).join('\n'),
    '',
    '=== CURRENT App.tsx ===',
    appCode,
    '=== END ===',
    '',
    'Return the corrected App.tsx now:',
  ].join('\n');

  return callOpenRouter(fixPrompt);
}

async function callOpenRouter(prompt) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + OPENROUTER_API_KEY,
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-5',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('OpenRouter error ' + response.status + ': ' + errText);
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
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Anthropic error ' + response.status + ': ' + errText);
  }

  const data = await response.json();
  return sanitizeCode(data.content[0].text);
}

app.post('/api/generate', async (req, res) => {
  const { prompt, currentAppCode } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });

  try {
    let images = null;

    if (!currentAppCode) {
      console.log('Generating Together images for:', prompt);
      images = await getImagesForPrompt(prompt);
      console.log('Together images:', images ? images.length : 0);
    }

    let appCode = await callOpenRouter(buildPrompt(prompt, currentAppCode, images));

    // ✅ Garantia: se imagens existem mas TSX nao usa, roda fix
    if (images && images.length > 0 && !appUsesAllImageUrls(appCode, images)) {
      console.log('App.tsx did not include required image URLs. Running fix pass...');
      appCode = await forceFixImages(appCode, images);
    }

    const files = getBaseFiles(appCode);
    res.json({ files, appCode, images });
  } catch (err) {
    console.error('/api/generate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/image', async (req, res) => {
  const { image, mediaType, prompt } = req.body;
  if (!image) return res.status(400).json({ error: 'Image required' });
  if (!ANTHROPIC_API_KEY) return res.status(400).json({ error: 'Missing ANTHROPIC_API_KEY' });

  const visionPrompt = [
    'You are a senior React + TypeScript + Tailwind CSS expert.',
    'Analyze this design and recreate it as a React component.',
    prompt ? 'Additional instructions: ' + prompt : '',
    'RULES: Return ONLY raw TSX. Use Tailwind. Start with import React.',
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

  const fullPrompt =
    'You are an HTML/CSS/JS expert. Return ONLY complete HTML, no markdown.\n\n' +
    (code ? 'Current code:\n' + code + '\n\nRequest: ' + prompt : prompt);

  try {
    const result = await callOpenRouter(fullPrompt);
    res.json({ result: (result || '').replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim() });
  } catch (err) {
    console.error('/api/chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, function () {
  console.log('CodeAI running on port ' + PORT);
});
