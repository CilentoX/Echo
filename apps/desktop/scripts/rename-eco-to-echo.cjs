// Renomeação Eco → Echo no código-fonte (padrões específicos, sem tocar em "eco" genérico)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');
const REPLACEMENTS = [
  // Constante e identifier
  [/ECO_HOMESERVER_URL/g, 'ECHO_HOMESERVER_URL'],
  // URLs do homeserver (valor real + fixtures)
  [/https:\/\/eco\.litteris\.online/g, 'https://echo.litteris.online'],
  // MXIDs de fixture (testes usam domínio fake)
  [/@nina:eco\.litteris\.online/g, '@nina:echo.litteris.online'],
  // Mock de teste do GoogleLoginScreen
  [/https:\/\/eco\.test/g, 'https://echo.test'],
];

let filesChanged = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    let content = fs.readFileSync(full, 'utf8');
    const original = content;
    for (const [pattern, replacement] of REPLACEMENTS) {
      content = content.replace(pattern, replacement);
    }
    if (content !== original) {
      fs.writeFileSync(full, content);
      filesChanged++;
      console.log('atualizado:', path.relative(ROOT, full));
    }
  }
}
walk(ROOT);
console.log(`\n${filesChanged} arquivo(s) atualizado(s).`);
