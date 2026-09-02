import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const packageJson = JSON.parse(read('package.json'));
const packageLock = JSON.parse(read('package-lock.json'));
const tauriConfig = JSON.parse(read('src-tauri/tauri.conf.json'));
const defaultCapability = JSON.parse(read('src-tauri/capabilities/default.json'));
const cargoToml = read('src-tauri/Cargo.toml');
const cargoLock = read('src-tauri/Cargo.lock');
const expectedVersion = packageJson.version;
const branding = read('src/branding.ts');
const titleBar = read('src/components/TitleBar/TitleBar.tsx');
const portableArtifactName = `RunTelos-${expectedVersion}-portable.exe`;
const checksums = read('SHA256SUMS.txt').trim();

assert(packageLock.version === expectedVersion, 'package.json 与 package-lock.json 顶层版本不一致');
assert(packageLock.packages?.['']?.version === expectedVersion, 'package-lock 根 package 版本不一致');
assert(tauriConfig.version === expectedVersion, 'Tauri 配置版本不一致');
assert(tauriConfig.productName === 'RunTelos', 'Tauri 产品英文名未统一为 RunTelos');
assert(defaultCapability.permissions.includes('global-shortcut:allow-register'), '全局快捷键注册权限未显式启用');
assert(defaultCapability.permissions.includes('global-shortcut:allow-unregister'), '全局快捷键注销权限未显式启用');
assert(branding.includes("chinese: '启动快捷运行'") && branding.includes("english: 'RunTelos'"), '品牌中英文名未统一');
assert(titleBar.includes("import appIconUrl from '../../../src-tauri/icons/64x64.png'"), '标题栏图标必须由 Vite 打包，不能使用根路径引用');
assert(checksums.endsWith(` *${portableArtifactName}`), 'SHA256SUMS.txt 未指向当前版本便携产物');
assert(!checksums.includes('src-tauri/target/'), 'SHA256SUMS.txt 不应指向被忽略的 target 目录');
assert(!existsSync(path.join(root, 'ScriptLauncher-portable.exe')), '根目录仍存在旧版 ScriptLauncher 便携产物');
assert(
  new RegExp(`name = "scriptlauncher"\\r?\\nversion = "${expectedVersion.replaceAll('.', '\\.') }"`).test(cargoLock),
  'Cargo.lock 中的 scriptlauncher 版本不一致',
);
assert(
  new RegExp(`version\\s*=\\s*"${expectedVersion.replaceAll('.', '\\.') }"`).test(cargoToml),
  'Cargo.toml 版本不一致',
);

const requiredFiles = [
  'README.md',
  'README.en.md',
  'LICENSE',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'src/App.tsx',
  'src/components/LaunchHistory/LaunchHistoryDialog.tsx',
  'src/components/Settings/SettingsDialog.tsx',
  'src-tauri/src/history.rs',
  'src-tauri/src/window_state.rs',
  'src/branding.ts',
  'app-icon.png',
  'docs/screenshots/runtelos-0.9.1-main.png',
  'docs/screenshots/runtelos-0.9.1-settings.png',
  'docs/release-notes-v0.9.1.md',
  'scripts/package-portable.ps1',
  'scripts/build-portable.ps1',
  'scripts/verify-release-binary.ps1',
  'docs/security-advisories.md',
];
for (const relativePath of requiredFiles) {
  assert(existsSync(path.join(root, relativePath)), `缺少必需文件：${relativePath}`);
}

const removedLegacyFiles = [
  'src/components/AddDialog.tsx',
  'src/components/ScriptButton.tsx',
  'src/components/ScriptGrid.tsx',
  'src/components/ContextMenu.tsx',
  'src/components/EditDialog.tsx',
  'src/components/SettingsPanel.tsx',
  'src/components/TitleBar.tsx',
  'src/lib/pagination.ts',
];
for (const relativePath of removedLegacyFiles) {
  assert(!existsSync(path.join(root, relativePath)), `旧组件仍存在：${relativePath}`);
}

const forbiddenNames = ['AddDialog', 'ScriptGrid', 'ScriptButton', 'EditDialog', 'SettingsPanel'];
const sourceRoot = path.join(root, 'src');
function scanSource(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'target') continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      scanSource(fullPath);
      continue;
    }
    if (!/\.(ts|tsx|mjs)$/.test(entry.name)) continue;
    const content = readFileSync(fullPath, 'utf8');
    for (const forbiddenName of forbiddenNames) {
      assert(!content.includes(forbiddenName), `源码仍引用旧组件名：${path.relative(root, fullPath)} -> ${forbiddenName}`);
    }
  }
}
scanSource(sourceRoot);

console.log(`Project verification passed (${expectedVersion})`);
