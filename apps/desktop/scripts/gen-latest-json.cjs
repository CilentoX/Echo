// Gera latest.json dinamicamente para o auto-updater
const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const version = process.argv[2] || pkg.version;

const sigPath = path.join(__dirname, '..', 'release', `Echo_${version}_x64-setup.exe.sig`);
if (!fs.existsSync(sigPath)) {
  console.error(`ERRO: Arquivo de assinatura não encontrado: ${sigPath}`);
  process.exit(1);
}

const sigContent = fs.readFileSync(sigPath);
const signatureB64 = sigContent.toString('base64');

const latest = {
  version,
  notes: `Echo v${version}: Correção do listener SSO no login Google (resolvido ERR_SOCKET_NOT_CONNECTED), suporte robusto a leituras assíncronas no loopback e auto-updater.`,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: signatureB64,
      url: `https://github.com/CilentoX/Echo/releases/download/v${version}/Echo_${version}_x64-setup.exe`
    }
  }
};

const releaseDir = path.join(__dirname, '..', 'release');
fs.writeFileSync(path.join(releaseDir, `latest-${version}.json`), JSON.stringify(latest, null, 2), 'utf8');
fs.writeFileSync(path.join(releaseDir, 'latest.json'), JSON.stringify(latest, null, 2), 'utf8');

console.log(`[latest.json] Gerado com sucesso para v${version}`);
console.log('Signature length:', signatureB64.length);

// Se o repositório echo-site existir localmente, atualiza também
const echoSiteLatest = path.resolve(__dirname, '..', '..', '..', 'echo-site', 'latest.json');
if (fs.existsSync(echoSiteLatest)) {
  fs.writeFileSync(echoSiteLatest, JSON.stringify(latest, null, 2), 'utf8');
  console.log(`[echo-site] Atualizado: ${echoSiteLatest}`);
}
