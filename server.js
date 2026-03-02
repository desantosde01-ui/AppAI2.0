// server.js
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // ✅ CommonJS: use node-fetch@2
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ENV
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));


function getSetupIssues() {
  const issues = [];
  if (!OPENROUTER_API_KEY) {
    issues.push('OPENROUTER_API_KEY ausente');
  }
  return issues;
}

function toFriendlySetupMessage(errorMessage) {
  if ((errorMessage || '').includes('Missing OPENROUTER_API_KEY')) {
    return 'OPENROUTER_API_KEY não configurada. Crie uma chave no OpenRouter e inicie o servidor com a variável de ambiente OPENROUTER_API_KEY definida.';
  }
  return errorMessage;
}

const FONT_PAIRS = {
  barbershop: { heading: 'Bebas Neue', body: 'Inter', url: 'Bebas+Neue|Inter:wght@400;500;600' },
  restaurant: { heading: 'Cormorant Garamond', body: 'Nunito', url: 'Cormorant+Garamond:wght@600;700|Nunito:wght@400;600' },
  law: { heading: 'Playfair Display', body: 'Lato', url: 'Playfair+Display:wght@600;700;800|Lato:wght@400;700' },
  tech: { heading: 'Space Grotesk', body: 'DM Sans', url: 'Space+Grotesk:wght@600;700|DM+Sans:wght@400;500' },
  beauty: { heading: 'Bodoni Moda', body: 'Jost', url: 'Bodoni+Moda:wght@600;700|Jost:wght@400;500' },
  fitness: { heading: 'Barlow Condensed', body: 'Barlow', url: 'Barlow+Condensed:wght@700;800|Barlow:wght@400;500' },
  medical: { heading: 'Merriweather', body: 'Source Sans 3', url: 'Merriweather:wght@700|Source+Sans+3:wght@400;600' },
  realestate: { heading: 'Cormorant', body: 'Raleway', url: 'Cormorant:wght@600;700|Raleway:wght@400;500;600' },
  education: { heading: 'Nunito', body: 'Open Sans', url: 'Nunito:wght@700;800|Open+Sans:wght@400;600' },
  creative: { heading: 'Syne', body: 'Manrope', url: 'Syne:wght@700;800|Manrope:wght@400;500' },
  hotel: { heading: 'Libre Baskerville', body: 'Mulish', url: 'Libre+Baskerville:wght@700|Mulish:wght@400;500' },
  automotive: { heading: 'Rajdhani', body: 'Roboto', url: 'Rajdhani:wght@600;700|Roboto:wght@400;500' },
  food: { heading: 'Satisfy', body: 'Lato', url: 'Satisfy|Lato:wght@400;700' },
  construction: { heading: 'Oswald', body: 'Roboto', url: 'Oswald:wght@600;700|Roboto:wght@400;500' },
  finance: { heading: 'Libre Baskerville', body: 'Source Sans 3', url: 'Libre+Baskerville:wght@700|Source+Sans+3:wght@400;600' },
  default: { heading: 'Plus Jakarta Sans', body: 'Inter', url: 'Plus+Jakarta+Sans:wght@600;700;800|Inter:wght@400;500;600' },
};

// ✅ Sanitiza + BLINDA contra "App already declared" e "return <App/>"
function sanitizeCode(code) {
  code = (code || '').trim();

  // Remove markdown fences
  code = code.replace(/^```[a-zA-Z]*\r?\n/gm, '');
  code = code.replace(/^```\r?$/gm, '');
  code = code.replace(/```[a-zA-Z]*\n/g, '');
  code = code.replace(/```/g, '');
  code = code.trim();

  // Fix smart quotes and special characters
  code = code.replace(/\u201C/g, '"').replace(/\u201D/g, '"');
  code = code.replace(/\u2018/g, "'").replace(/\u2019/g, "'");
  code = code.replace(/\u2013/g, '-').replace(/\u2014/g, '-');
  code = code.replace(/\u00A0/g, ' ');

  // Remove duplicate import React statements - keep only the first one
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

  // 🚫 Remove recursive "return <App />;"
  code = code.replace(/return\s+<App\s*\/>\s*;?/g, 'return null;');

  // 🚫 Garantir apenas 1 "export default function App() { ... }"
  const appFnRegex = /export\s+default\s+function\s+App\s*\(\)\s*{[\s\S]*?}\s*/g;
  const appFns = code.match(appFnRegex);
  if (appFns && appFns.length > 1) {
    // remove todas e coloca só a primeira no final
    code = code.replace(appFnRegex, '');
    code = (code.trim() + '\n\n' + appFns[0].trim() + '\n').trim();
  }

  // 🚫 Se existir "function App() { ... }" e também "export default function App() { ... }", renomeia a interna
  const hasNonExportApp = /(^|\n)\s*function\s+App\s*\(\)\s*{/.test(code);
  const hasExportDefaultApp = /export\s+default\s+function\s+App\s*\(\)\s*{/.test(code);
  if (hasNonExportApp && hasExportDefaultApp) {
    // renomeia a não-exportada para AppInner
    code = code.replace(/(^|\n)\s*function\s+App\s*\(\)\s*{/m, function (m) {
      return m.replace('function App', 'function AppInner');
    });
    // e troca usos diretos de <App /> por <AppInner /> (exceto dentro da export default App)
    code = code.replace(/<App(\s*\/>|[\s>])/g, '<AppInner$1');
  }

  return code;
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenRouter (GPT-4o)
// ─────────────────────────────────────────────────────────────────────────────
async function callOpenRouterText(prompt, opts) {
  if (!OPENROUTER_API_KEY) throw new Error('Missing OPENROUTER_API_KEY');

  const model = (opts && opts.model) || 'openai/gpt-4o';
  const maxTokens = (opts && opts.max_tokens) || 16000;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + OPENROUTER_API_KEY,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
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

async function callOpenRouterVision(base64, mediaType, prompt, opts) {
  if (!OPENROUTER_API_KEY) throw new Error('Missing OPENROUTER_API_KEY');

  const model = (opts && opts.model) || 'openai/gpt-4o';
  const maxTokens = (opts && opts.max_tokens) || 16000;
  const dataUrl = 'data:' + (mediaType || 'image/png') + ';base64,' + base64;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + OPENROUTER_API_KEY,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('OpenRouter error ' + response.status + ': ' + errText);
  }

  const data = await response.json();
  return sanitizeCode(data.choices[0].message.content);
}

// ─────────────────────────────────────────────────────────────────────────────
// Together (imagens)
// ─────────────────────────────────────────────────────────────────────────────
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
        prompt,
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

    const url = data?.data?.[0]?.url;
    if (url && typeof url === 'string' && url.startsWith('http')) {
      console.log('Together image URL OK:', url);
      return { url, alt: prompt };
    }

    const b64 = data?.data?.[0]?.b64_json;
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

    // GPT-4o gera 4 prompts (barato e consistente)
    const promptGen =
      'Create 4 specific English image prompts for AI image generation for this website request:\n' +
      '"' +
      userPrompt +
      '"\n\n' +
      'Rules:\n' +
      '- Return ONLY a JSON array of 4 strings.\n' +
      '- Prompts must be professional, high-end, ultra realistic photography.\n' +
      '- Avoid logos/text in the image.\n' +
      '- Suitable for a premium website hero + sections.\n';

    let prompts;
    try {
      const raw = await callOpenRouterText(promptGen, { model: 'openai/gpt-4o', max_tokens: 1200 });
      const clean = raw.replace(/```json|```/g, '').trim();
      prompts = JSON.parse(clean);
    } catch (e) {
      const topic = (userPrompt || '').slice(0, 60);
      prompts = [
        'premium corporate interior for ' + topic + ', ultra realistic photo, cinematic lighting',
        'professional team at work for ' + topic + ', ultra realistic photo, shallow depth of field',
        'close-up hands reviewing documents for ' + topic + ', ultra realistic photo, premium desk',
        'modern reception or exterior establishing shot for ' + topic + ', ultra realistic photo',
      ];
    }

    console.log('Together: generating images with prompts:', prompts);

    const results = await Promise.all(prompts.slice(0, 4).map(generateTogetherImage));
    const images = results.filter(Boolean);

    console.log('Together: generated', images.length, 'images');
    return images.length > 0 ? images : null;
  } catch (err) {
    console.error('getImagesForPrompt error:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Base project files
// ─────────────────────────────────────────────────────────────────────────────
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
    'Start with: import React from "react"',
    'Declare App ONLY ONCE. Do NOT declare another App component or wrapper.',
    'Export exactly like this at the very end: export default App;',
    'Do NOT write: export default function App() { return <App/> }',
    'Use Tailwind CSS only',
    'Use lucide-react for icons (already installed)',
    'No external imports besides react and lucide-react',
    'Use only ASCII characters in strings and JSX text',
    'ALL strings and JSX tags must be properly closed',
    'NEVER use unsplash.com, picsum.photos, via.placeholder.com, or random image URLs',
  ].join('\n- ');

  if (isModify) {
    return [
      'You are a senior React + TypeScript + Tailwind CSS expert.',
      'You are EDITING an existing project. Make ONLY the requested change. Keep the rest intact.',
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
  if (/barber|barbearia|haircut/.test(p2)) fonts = FONT_PAIRS.barbershop;
  else if (/restauran|food|comida|cafe|pizza/.test(p2)) fonts = FONT_PAIRS.restaurant;
  else if (/advogad|juridic|law|legal/.test(p2)) fonts = FONT_PAIRS.law;
  else if (/tech|software|startup|saas/.test(p2)) fonts = FONT_PAIRS.tech;
  else if (/pilates|yoga|estetica|beleza|spa/.test(p2)) fonts = FONT_PAIRS.beauty;
  else if (/academia|gym|fitness|treino/.test(p2)) fonts = FONT_PAIRS.fitness;
  else if (/medic|clinic|saude|dental/.test(p2)) fonts = FONT_PAIRS.medical;
  else if (/imovel|imobiliaria|casa/.test(p2)) fonts = FONT_PAIRS.realestate;
  else if (/hotel|pousada|resort/.test(p2)) fonts = FONT_PAIRS.hotel;
  else if (/constru|arquitet|engenhei/.test(p2)) fonts = FONT_PAIRS.construction;
  else if (/financ|contabil|investiment/.test(p2)) fonts = FONT_PAIRS.finance;
  else if (/carro|auto|oficina|mecanica/.test(p2)) fonts = FONT_PAIRS.automotive;

  const fontInstruction = [
    'FONTS: Load these Google Fonts in a useEffect by injecting a <link> tag:',
    'URL: https://fonts.googleapis.com/css2?family=' + fonts.url + '&display=swap',
    'Apply body font to document.body.style.fontFamily.',
    'Apply heading font to headings using style={{fontFamily: "...", serif}} (or sans if appropriate).',
  ].join('\n');

  const imageInstruction =
    images && images.length > 0
      ? [
          'IMAGES: Use ONLY these URLs. Define constants and use them in <img src={...}>.',
          images.map((img, i) => `const IMAGE_${i + 1}_URL = "${img.url}";`).join('\n'),
          'Use IMAGE_1_URL as hero background image (img + overlay).',
          'Use IMAGE_2_URL..IMAGE_4_URL across services/gallery/team sections.',
          'FORBIDDEN: Do not use any other image URL.',
          'Always add loading="lazy" on non-hero images.',
        ].join('\n')
      : [
          'IMAGES: No images provided. Do not use external image URLs.',
          'Use gradient divs instead of images.',
        ].join('\n');

  return [
    'You are a world-class UI/UX designer and React developer creating agency-quality websites.',
    fontInstruction,
    imageInstruction,
    'DESIGN REQUIREMENTS:',
    '- Premium hero, strong typography, elegant spacing',
    '- Sections: Services, About, Team, Contact',
    '- Buttons with hover transitions',
    '',
    'IMPORTANT OUTPUT FORMAT:',
    '- Must contain exactly one component: function App() { ... }',
    '- Must end with: export default App;',
    '',
    'RULES:\n- ' + rules,
    '',
    'Create a stunning, agency-quality React app for: ' + userRequest,
    'Return only App.tsx:',
  ].join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  const { prompt, currentAppCode } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });

  try {
    let images = null;

    if (!currentAppCode) {
      console.log('Generating Together images for:', prompt);
      images = await getImagesForPrompt(prompt);
      console.log('Images result:', images ? images.length + ' images' : 'no images');
    }

    const appCode = await callOpenRouterText(buildPrompt(prompt, currentAppCode, images), {
      model: 'openai/gpt-4o',
      max_tokens: 16000,
    });

    const files = getBaseFiles(appCode);
    res.json({ files, appCode, images });
  } catch (err) {
    console.error('/api/generate error:', err.message);
    res.status(500).json({ error: toFriendlySetupMessage(err.message) });
  }
});


app.get('/api/health', (req, res) => {
  const issues = getSetupIssues();
  res.json({ ok: issues.length === 0, issues });
});

// Recriar UI a partir de imagem (GPT-4o Vision via OpenRouter)
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
    '- Declare function App() ONLY ONCE',
    '- End with: export default App;',
    '- Use Tailwind CSS only',
    '- Use lucide-react for icons if needed',
    '- ASCII characters only in strings',
    '- Be faithful to the colors, layout and style of the image',
  ].join('\n');

  try {
    const appCode = await callOpenRouterVision(image, mediaType || 'image/png', visionPrompt, {
      model: 'openai/gpt-4o',
      max_tokens: 16000,
    });
    const files = getBaseFiles(appCode);
    res.json({ files, appCode });
  } catch (err) {
    console.error('/api/image error:', err.message);
    res.status(500).json({ error: toFriendlySetupMessage(err.message) });
  }
});

// HTML helper
app.post('/api/chat', async (req, res) => {
  const { prompt, code } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });

  const fullPrompt =
    'You are an HTML/CSS/JS expert. Return ONLY complete HTML, no markdown.\n\n' +
    (code ? 'Current code:\n' + code + '\n\nRequest: ' + prompt : prompt);

  try {
    const result = await callOpenRouterText(fullPrompt, { model: 'openai/gpt-4o', max_tokens: 8000 });
    res.json({ result: (result || '').replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim() });
  } catch (err) {
    console.error('/api/chat error:', err.message);
    res.status(500).json({ error: toFriendlySetupMessage(err.message) });
  }
});

app.listen(PORT, function () {
  const issues = getSetupIssues();
  console.log('CodeAI running on port ' + PORT);
  if (issues.length > 0) {
    console.warn('Setup pendente:', issues.join(', '));
  }
});
