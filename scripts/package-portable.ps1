$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$package = Get-Content -Raw (Join-Path $projectRoot 'package.json') | ConvertFrom-Json
$sourcePath = Join-Path $projectRoot 'src-tauri\target\release\scriptlauncher.exe'
$artifactName = "RunTelos-$($package.version)-portable.exe"
$artifactPath = Join-Path $projectRoot $artifactName
$checksumPath = Join-Path $projectRoot 'SHA256SUMS.txt'

function Get-Sha256([string] $Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
      return ([System.BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '')
    } finally {
      $sha.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

if (-not (Test-Path -LiteralPath $sourcePath)) {
  throw "Release executable not found: $sourcePath"
}

Copy-Item -LiteralPath $sourcePath -Destination $artifactPath -Force
$hash = Get-Sha256 $artifactPath
Set-Content -LiteralPath $checksumPath -Value "$hash *$artifactName" -Encoding ascii

[PSCustomObject]@{
  Artifact = $artifactPath
  SHA256 = $hash
  SizeMB = [Math]::Round((Get-Item -LiteralPath $artifactPath).Length / 1MB, 2)
}
