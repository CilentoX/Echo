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

// O arquivo .sig gerado pelo Tauri/Minisign já é a assinatura base64 oficial.
// NÃO deve ser codificado em base64 novamente!
const signature = fs.readFileSync(sigPath, 'utf8').trim();

const latest = {
  version,
  notes: `Echo v${version}: Executável nativo renomeado para Echo.exe, atalhos corrigidos, limpeza de arquivos legados e auto-updater funcional.`,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: signature,
      url: `https://github.com/CilentoX/Echo/releases/download/v${version}/Echo_${version}_x64-setup.exe`
    }
  }
};

const releaseDir = path.join(__dirname, '..', 'release');
fs.writeFileSync(path.join(releaseDir, `latest-${version}.json`), JSON.stringify(latest, null, 2), 'utf8');
fs.writeFileSync(path.join(releaseDir, 'latest.json'), JSON.stringify(latest, null, 2), 'utf8');

console.log(`[latest.json] Gerado com sucesso para v${version}`);
console.log('Signature snippet:', signature.slice(0, 40) + '...');

// Se o repositório echo-site existir localmente, sincroniza automaticamente
const echoSiteLatest = path.resolve(__dirname, '..', '..', '..', 'echo-site', 'latest.json');
if (fs.existsSync(echoSiteLatest)) {
  fs.writeFileSync(echoSiteLatest, JSON.stringify(latest, null, 2), 'utf8');
  console.log(`[echo-site] Atualizado: ${echoSiteLatest}`);
}
