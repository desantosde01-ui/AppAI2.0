const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DEEPAI_API_KEY = process.env.DEEPAI_API_KEY || '2bdebb88-edf3-4aaf-9ed8-1def7cefa235';

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const FONT_PAIRS = {
  barbershop:   { heading: 'Bebas Neue',         body: 'Inter',           url: 'Bebas+Neue|Inter:wght@400;500;600' },
  restaurant:   { heading: 'Cormorant Garamond',  body: 'Nunito',          url: 'Cormorant+Garamond:wght@600;700|Nunito:wght@400;600' },
  law:          { heading: 'Playfair Display',    body: 'Lato',            url: 'Playfair+Display:wght@600;700;800|Lato:wght@400;700' },
  tech:         { heading: 'Space Grotesk',       body: 'DM Sans',         url: 'Space+Grotesk:wght@600;700|DM+Sans:wght@400;500' },
  beauty:       { heading: 'Bodoni Moda',         body: 'Jost',            url: 'Bodoni+Moda:wght@600;700|Jost:wght@400;500' },
  fitness:      { heading: 'Barlow Condensed',    body: 'Barlow',          url: 'Barlow+Condensed:wght@700;800|Barlow:wght@400;500' },
  medical:      { heading: 'Merriweather',        body: 'Source Sans 3',   url: 'Merriweather:wght@700|Source+Sans+3:wght@400;600' },
  realestate:   { heading: 'Cormorant',           body: 'Raleway',         url: 'Cormorant:wght@600;700|Raleway:wght@400;500;600' },
  education:    { heading: 'Nunito',              body: 'Open Sans',       url: 'Nunito:wght@700;800|Open+Sans:wght@400;600' },
  creative:     { heading: 'Syne',                body: 'Manrope',         url: 'Syne:wght@700;800|Manrope:wght@400;500' },
  hotel:        { heading: 'Libre Baskerville',   body: 'Mulish',          url: 'Libre+Baskerville:wght@700|Mulish:wght@400;500' },
  automotive:   { heading: 'Rajdhani',            body: 'Roboto',          url: 'Rajdhani:wght@600;700|Roboto:wght@400;500' },
  food:         { heading: 'Satisfy',             body: 'Lato',            url: 'Satisfy|Lato:wght@400;700' },
  construction: { heading: 'Oswald',              body: 'Roboto',          url: 'Oswald:wght@600;700|Roboto:wght@400;500' },
  finance:      { heading: 'Libre Baskerville',   body: 'Source Sans 3',   url: 'Libre+Baskerville:wght@700|Source+Sans+3:wght@400;600' },
  default:      { heading: 'Plus Jakarta Sans',   body: 'Inter',           url: 'Plus+Jakarta+Sans:wght@600;700;800|Inter:wght@400;500;600' },
};

function sanitizeCode(code) {
  code = code.trim();
  // Remove ALL markdown code fences anywhere in the code
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
  code = code.split('\n').filter(function(line) {
    if (/^import React/.test(line.trim())) {
      if (reactImportFound) return false;
      reactImportFound = true;
    }
    return true;
  }).join('\n');
  return code;
}

// ─── DEEPAI IMAGE GENERATION ─────────────────────────────────────────────────
async function generateDeepAIImage(prompt) {
  try {
    const formData = new FormData();
    formData.append('text', prompt);

    const response = await fetch('https://api.deepai.org/api/text2img', {
      method: 'POST',
      headers: { 'api-key': DEEPAI_API_KEY },
      body: formData
    });

    if (!response.ok) {
      console.error('DeepAI error status:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.output_url) {
      console.log('DeepAI image generated:', data.output_url);
      return { url: data.output_url, alt: prompt };
    }
    console.error('DeepAI no output_url:', JSON.stringify(data));
    return null;
  } catch (err) {
    console.error('DeepAI error:', err.message);
    return null;
  }
}

async function getImagesForPrompt(userPrompt) {
  try {
    const promptGeneration = 'Based on this website request: "' + userPrompt + '", generate 4 specific English image prompts for AI image generation. Each prompt should describe a professional, high-quality photo relevant to this business. Return ONLY a JSON array of 4 strings, nothing else. Example: ["professional barbershop interior with leather chairs", "barber cutting hair close up", "razor and grooming tools on marble", "stylish man after haircut"]';

    const raw = await callOpenRouter(promptGeneration);
    const clean = raw.replace(/```json|```/g, '').trim();
    let prompts;
    try {
      prompts = JSON.parse(clean);
    } catch(e) {
      const topic = userPrompt.slice(0, 50);
      prompts = [
        'professional ' + topic + ' interior photography',
        topic + ' service close up professional photo',
        topic + ' team working professional',
        topic + ' product or space elegant photography'
      ];
    }

    console.log('Generating', prompts.length, 'images with DeepAI...');
    console.log('Image prompts:', prompts);

    const results = await Promise.all(
      prompts.slice(0, 4).map(function(p) { return generateDeepAIImage(p); })
    );

    const images = results.filter(function(r) { return r !== null; });
    console.log('DeepAI: Generated', images.length, 'of', prompts.length, 'images successfully');
    return images.length > 0 ? images : null;
  } catch (err) {
    console.error('getImagesForPrompt error:', err.message);
    return null;
  }
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

function buildPrompt(userRequest, currentAppCode, chatHistory, images) {
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
    'NEVER use inline style with CSS grid - use Tailwind grid-cols-* classes instead',
    'NEVER use style={{ gridTemplateColumns: ... }} anywhere - forbidden',
    'NEVER use window.innerWidth inside JSX or style props - use Tailwind responsive prefixes (sm: md: lg:) instead',
    'For responsive layouts use Tailwind: className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"',
    'For responsive visibility use Tailwind: className="hidden md:flex" or className="flex md:hidden"',
    'Count every opening { and make sure it has a matching closing }',
    'Count every opening ( and make sure it has a matching closing )'
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

  const p2 = userRequest.toLowerCase();
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
    '  URL: https://fonts.googleapis.com/css2?family=' + fonts.url + '&display=swap',
    '  Heading font: "' + fonts.heading + '" - use with style={{fontFamily: \'"' + fonts.heading + '", serif\'}} on all headings',
    '  Body font: "' + fonts.body + '" - inject on document.body style',
  ].join('\n');

  const imageInstruction = images && images.length > 0 ? [
    'IMAGES: Use these AI-generated images (use the URLs directly in <img> tags):',
    images.map(function(img, i) { return '  Image ' + (i+1) + ': ' + img.url + ' (alt: "' + img.alt + '")'; }).join('\n'),
    '  - Use Image 1 as hero background (full width, object-cover with dark overlay for text readability)',
    '  - Use other images in gallery, team, or feature sections',
    '  - Always add loading="lazy" and proper alt text',
  ].join('\n') : 'IMAGES: Use relevant placeholder images for the content.';

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
    'CRITICAL BUGS TO AVOID:',
    '- Images: ALWAYS use the exact AI-generated image URLs provided above - NEVER use placeholder or random images',
    '- Z-index: hero section must have z-index: 0, all other sections z-index: 0, never let content float over hero',
    '- Parallax: if using parallax effect, use background-attachment: scroll NOT fixed, and wrap in overflow: hidden',
    '- Custom cursor: if adding cursor effect, use mousemove event with NO transition/animation delay on the cursor element itself - cursor must follow mouse instantly with transform: translate(x, y)',
    '- Section containers: always add overflow: hidden to section wrappers that contain animated elements',
    '- Image hover effects: never use position: fixed on images, use transform: scale() instead',
    '',
    'RULES:\n- ' + rules,
    '',
    'Create a stunning, agency-quality React app for: ' + userRequest,
    'Return only App.tsx:'
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
    let images = null;
    if (!currentAppCode) {
      console.log('Generating DeepAI images for:', prompt);
      images = await getImagesForPrompt(prompt);
      console.log('DeepAI result:', images ? images.length + ' images' : 'failed, no images');
    }

    const appCode = await callOpenRouter(buildPrompt(prompt, currentAppCode, chatHistory, images));
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
