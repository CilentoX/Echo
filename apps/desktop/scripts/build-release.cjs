// Script mestre de automação de build e release do Echo Desktop
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
const secretKeyPath = path.join(rootDir, 'minisign-secret.key');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = process.argv[2] || pkg.version;

console.log(`\n========================================`);
console.log(`  ECHO BUILD & RELEASE PIPELINE: v${version}`);
console.log(`========================================\n`);

// 1. Sincroniza versões em package.json, tauri.conf.json e Cargo.toml
console.log('1. Sincronizando versões dos arquivos de configuração...');
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
tauriConf.version = version;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');

let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
cargoToml = cargoToml.replace(/^version = ".*"/m, `version = "${version}"`);
fs.writeFileSync(cargoTomlPath, cargoToml, 'utf8');
console.log(`   ✓ package.json, tauri.conf.json e Cargo.toml atualizados para v${version}`);

// 2. Verifica chave privada Minisign
if (!fs.existsSync(secretKeyPath)) {
  console.error(`ERRO: Chave privada Minisign não encontrada em: ${secretKeyPath}`);
  process.exit(1);
}
const privateKeyContent = fs.readFileSync(secretKeyPath, 'utf8').trim();

// 3. Executa verificação de tipos TypeScript
console.log('\n2. Verificando tipagem TypeScript (tsc --noEmit)...');
try {
  execSync('pnpm tsc --noEmit', { cwd: rootDir, stdio: 'inherit' });
  console.log('   ✓ Tipagem TypeScript 100% válida.');
} catch (e) {
  console.error('ERRO: Falha na verificação de tipos TypeScript.');
  process.exit(1);
}

// 4. Executa o build de produção do Tauri com assinatura
console.log('\n3. Compilando binário nativo e instalador NSIS (tauri build)...');
const env = {
  ...process.env,
  TAURI_SIGNING_PRIVATE_KEY: privateKeyContent,
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: '',
};

try {
  execSync('pnpm tauri build', { cwd: rootDir, env, stdio: 'inherit' });
  console.log('   ✓ Build concluído com sucesso.');
} catch (e) {
  console.error('ERRO: Falha durante o tauri build.');
  process.exit(1);
}

// 5. Localiza e copia os artefatos de saída
console.log('\n4. Organizando artefatos na pasta release/...');
const nsisDir = 'C:\\st\\sharestream\\release\\bundle\\nsis';
const installerSrc = path.join(nsisDir, `Echo_${version}_x64-setup.exe`);
const sigSrc = path.join(nsisDir, `Echo_${version}_x64-setup.exe.sig`);

const releaseDir = path.join(rootDir, 'release');
if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });

const installerDst = path.join(releaseDir, `Echo_${version}_x64-setup.exe`);
const sigDst = path.join(releaseDir, `Echo_${version}_x64-setup.exe.sig`);

if (fs.existsSync(installerSrc)) {
  fs.copyFileSync(installerSrc, installerDst);
  console.log(`   ✓ Instalador copiado: ${installerDst}`);
} else {
  console.error(`ERRO: Instalador não encontrado em ${installerSrc}`);
  process.exit(1);
}

if (fs.existsSync(sigSrc)) {
  fs.copyFileSync(sigSrc, sigDst);
  console.log(`   ✓ Assinatura copiada: ${sigDst}`);
} else {
  console.error(`ERRO: Assinatura não encontrada em ${sigSrc}`);
  process.exit(1);
}

const exeSrc = 'C:\\st\\sharestream\\release\\Echo.exe';
const exeDst = path.join(releaseDir, 'Echo.exe');
if (fs.existsSync(exeSrc)) {
  fs.copyFileSync(exeSrc, exeDst);
  console.log(`   ✓ Executável portátil copiado: ${exeDst}`);
}

// 6. Gera o manifesto latest.json
console.log('\n5. Gerando manifesto latest.json e sincronizando com echo-site...');
const notes = process.argv[3] || '';
const notesArg = notes ? ` "${notes}"` : '';
execSync(`node "${path.join(__dirname, 'gen-latest-json.cjs')}" "${version}"${notesArg}`, { cwd: rootDir, stdio: 'inherit' });

console.log(`\n========================================`);
console.log(`  BUILD v${version} CONCLUÍDO COM SUCESSO!`);
console.log(`========================================\n`);

