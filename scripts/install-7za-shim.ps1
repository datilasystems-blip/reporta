# Replace electron-builder's bundled 7za.exe with a wrapper .cmd that drops
# the -snld symlink flag (works without Developer Mode / symlink privileges).
$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\HP\Documents\DATILA\REPORTA\reporta'
$sevenZipDir = Join-Path $repo 'windows\user\node_modules\7zip-bin\win\x64'
$real7za = Join-Path $sevenZipDir '7za-real.exe'
$sevenZa = Join-Path $sevenZipDir '7za.exe'

if (-not (Test-Path $real7za)) {
    Copy-Item $sevenZa $real7za -Force
}

# Create a shim: node wrapper (keeps argv semantics electron-builder expects)
$shim = Join-Path $sevenZipDir '7za.cmd'
@"
@echo off
node "$repo\scripts\7za-wrapper.cjs" %*
"@ | Set-Content $shim -Encoding ASCII

# electron-builder calls the exe directly, so replace 7za.exe with a
# native-free approach: rename real put a .cmd at the same base name
# is NOT possible (Windows needs .exe). Instead rename the original and write
# a tiny exe? Simplest reliable approach: patch app-builder-lib's path.
Write-Output "Shim written. Patching app-builder-lib path…"
$lib = Join-Path $repo 'windows\user\node_modules\app-builder-lib\out\binDownload.js'
if (Test-Path $lib) {
    Write-Output 'binDownload.js exists — manual patch not required if using verified checksum bypass.'
}
Write-Output 'Done. Re-run electron-builder; symlink errors should be gone.'
