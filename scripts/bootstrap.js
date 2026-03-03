const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');

function fail(message) {
  console.error('\n[BOOT ERROR] ' + message + '\n');
  process.exit(1);
}

function validateServerSource(source) {
  const firstLine = (source.split(/\r?\n/)[0] || '').trim();

  if (/git apply --3way/.test(source) || firstLine.startsWith('(cd "$(git rev-parse --show-toplevel)"')) {
    fail(
      [
        'server.js parece conter um comando de shell colado por engano (git apply) em vez de JavaScript.',
        'Como corrigir:',
        '1) Abra server.js no GitHub/local e remova todo conteúdo que começa com `(cd "$(git rev-parse --show-toplevel)" ...`;',
        '2) Restaure o arquivo para uma versão JavaScript válida;',
        '3) Faça commit/push e redeploy no Railway.',
      ].join('\n')
    );
  }
}

let source = '';
try {
  source = fs.readFileSync(serverPath, 'utf8');
} catch (err) {
  fail('Não foi possível ler server.js: ' + err.message);
}

validateServerSource(source);

try {
  require(serverPath);
} catch (err) {
  if (err instanceof SyntaxError) {
    fail(
      [
        'server.js possui erro de sintaxe JavaScript.',
        'Verifique o arquivo e garanta que ele contenha apenas código Node.js válido.',
        'Detalhe original: ' + err.message,
      ].join('\n')
    );
  }

  throw err;
}
