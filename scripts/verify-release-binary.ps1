$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$package = Get-Content -Raw (Join-Path $projectRoot 'package.json') | ConvertFrom-Json
$artifactName = "RunTelos-$($package.version)-portable.exe"
$exePath = Join-Path $projectRoot $artifactName

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
if (-not (Test-Path -LiteralPath $exePath)) {
  throw "Release executable not found: $exePath"
}

$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $exePath))

$forbiddenPaths = @(
  $projectRoot.Path,
  [Environment]::GetFolderPath('UserProfile')
)
$decodedBinary = @(
  [Text.Encoding]::UTF8.GetString($bytes),
  [Text.Encoding]::Unicode.GetString($bytes),
  [Text.Encoding]::ASCII.GetString($bytes)
)
foreach ($forbiddenPath in $forbiddenPaths) {
  foreach ($textView in $decodedBinary) {
    if ($textView.IndexOf($forbiddenPath, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
      throw 'Release executable contains a local build path. Build it through npm run build:portable.'
    }
  }
}

$peOffset = [BitConverter]::ToInt32($bytes, 0x3C)
$optionalHeaderOffset = $peOffset + 24
$subsystemOffset = $optionalHeaderOffset + 68
$subsystem = [BitConverter]::ToUInt16($bytes, $subsystemOffset)
if ($subsystem -ne 2) {
  throw "Release executable is not a GUI subsystem binary. Found subsystem: $subsystem"
}

$versionInfo = (Get-Item -LiteralPath $exePath).VersionInfo
if ($versionInfo.ProductName -ne 'RunTelos') {
  throw "Unexpected product name: $($versionInfo.ProductName)"
}
if ($versionInfo.ProductVersion -ne $package.version) {
  throw "Unexpected product version: $($versionInfo.ProductVersion)"
}

$expectedLine = (Get-Content -Raw (Join-Path $projectRoot 'SHA256SUMS.txt')).Trim()
$actualHash = Get-Sha256 $exePath
$actualLine = "$actualHash *$artifactName"
if ($expectedLine -ne $actualLine) {
  throw "SHA256SUMS.txt does not match $artifactName"
}

$sizeMb = [Math]::Round((Get-Item -LiteralPath $exePath).Length / 1MB, 2)
[PSCustomObject]@{
  Path = (Resolve-Path -LiteralPath $exePath).Path
  SizeMB = $sizeMb
  Subsystem = $subsystem
  ProductName = $versionInfo.ProductName
  ProductVersion = $versionInfo.ProductVersion
  LocalBuildPaths = 'none'
  SHA256 = $actualHash
}
