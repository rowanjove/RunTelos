$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$userProfile = [Environment]::GetFolderPath('UserProfile')
$tauriCli = Join-Path $projectRoot 'node_modules\.bin\tauri.cmd'

if (-not (Test-Path -LiteralPath $tauriCli)) {
  throw 'Tauri CLI is not installed. Run npm ci first.'
}

# Release binaries can otherwise retain absolute source/toolchain paths in
# panic metadata. Remap them to stable, non-personal paths before compiling.
$env:RUSTFLAGS = "--remap-path-prefix=$projectRoot=/workspace --remap-path-prefix=$userProfile=/toolchain"

Push-Location $projectRoot
try {
  & $tauriCli build --no-bundle
  if ($LASTEXITCODE -ne 0) {
    throw "Tauri release build failed with exit code $LASTEXITCODE"
  }
  & (Join-Path $PSScriptRoot 'package-portable.ps1')
} finally {
  Pop-Location
}
