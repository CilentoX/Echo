// Gera latest.json com a assinatura REAL do build 0.1.10
const fs = require('fs');

const sigContent = fs.readFileSync('release/Echo_0.1.10_x64-setup.exe.sig');
const signatureB64 = sigContent.toString('base64'); // base64 do .sig inteiro

const latest = {
  version: '0.1.10',
  notes: 'Echo v0.1.10: correção de diagnóstico do auto-updater (erro de download/assinatura agora é logado no console para investigação).',
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: signatureB64,
      url: 'https://github.com/CilentoX/Echo/releases/download/v0.1.10/Echo_0.1.10_x64-setup.exe'
    }
  }
};

fs.writeFileSync('release/latest-0.1.10.json', JSON.stringify(latest, null, 2), 'utf8');
console.log('latest-0.1.10.json gerado:');
console.log(JSON.stringify(latest, null, 2).slice(0, 500) + '...');
console.log('signature len (b64):', signatureB64.length);
