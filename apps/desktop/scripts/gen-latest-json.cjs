// Gera latest.json com a assinatura REAL do build 0.1.12
const fs = require('fs');

const sigContent = fs.readFileSync('release/Echo_0.1.12_x64-setup.exe.sig');
const signatureB64 = sigContent.toString('base64'); // base64 do .sig inteiro

const latest = {
  version: '0.1.12',
  notes: 'Echo v0.1.12: dropdown de membro fecha ao clicar fora, tela de booting mais visível, correções de tela branca em modais, ícones sem weight inválido.',
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: signatureB64,
      url: 'https://github.com/CilentoX/Echo/releases/download/v0.1.12/Echo_0.1.12_x64-setup.exe'
    }
  }
};

fs.writeFileSync('release/latest-0.1.12.json', JSON.stringify(latest, null, 2), 'utf8');
console.log('latest-0.1.12.json gerado:');
console.log(JSON.stringify(latest, null, 2).slice(0, 500) + '...');
console.log('signature len (b64):', signatureB64.length);
