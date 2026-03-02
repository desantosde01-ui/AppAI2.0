diff --git a/server.js b/server.js
index b18bb3f927247363779074e4ca712cc394d16097..db8166b79091de5318bb9d5423758b0ed2fd26cb 100644
--- a/server.js
+++ b/server.js
@@ -1,42 +1,58 @@
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
 
+
+function getSetupIssues() {
+  const issues = [];
+  if (!OPENROUTER_API_KEY) {
+    issues.push('OPENROUTER_API_KEY ausente');
+  }
+  return issues;
+}
+
+function toFriendlySetupMessage(errorMessage) {
+  if ((errorMessage || '').includes('Missing OPENROUTER_API_KEY')) {
+    return 'OPENROUTER_API_KEY não configurada. Crie uma chave no OpenRouter e inicie o servidor com a variável de ambiente OPENROUTER_API_KEY definida.';
+  }
+  return errorMessage;
+}
+
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
@@ -425,84 +441,94 @@ function buildPrompt(userRequest, currentAppCode, images) {
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
-    res.status(500).json({ error: err.message });
+    res.status(500).json({ error: toFriendlySetupMessage(err.message) });
   }
 });
 
+
+app.get('/api/health', (req, res) => {
+  const issues = getSetupIssues();
+  res.json({ ok: issues.length === 0, issues });
+});
+
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
-    res.status(500).json({ error: err.message });
+    res.status(500).json({ error: toFriendlySetupMessage(err.message) });
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
-    res.status(500).json({ error: err.message });
+    res.status(500).json({ error: toFriendlySetupMessage(err.message) });
   }
 });
 
 app.listen(PORT, function () {
+  const issues = getSetupIssues();
   console.log('CodeAI running on port ' + PORT);
+  if (issues.length > 0) {
+    console.warn('Setup pendente:', issues.join(', '));
+  }
 });
