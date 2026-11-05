// Gera latest.json com a assinatura REAL do build 0.1.13
const fs = require('fs');

const sigContent = fs.readFileSync('release/Echo_0.1.13_x64-setup.exe.sig');
const signatureB64 = sigContent.toString('base64'); // base64 do .sig inteiro

const latest = {
  version: '0.1.13',
  notes: 'Echo v0.1.13: Correção de convites e entrada em guildas, VAD (detecção de voz em tempo real estilo Discord com filtro de ruído e histerese), dock com microfone/fone verdes e pulsantes, transmissão de tela fluida sem tela preta.',
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: signatureB64,
      url: 'https://github.com/CilentoX/Echo/releases/download/v0.1.13/Echo_0.1.13_x64-setup.exe'
    }
  }
};

fs.writeFileSync('release/latest-0.1.13.json', JSON.stringify(latest, null, 2), 'utf8');
console.log('latest-0.1.13.json gerado:');
console.log(JSON.stringify(latest, null, 2).slice(0, 500) + '...');
console.log('signature len (b64):', signatureB64.length);
