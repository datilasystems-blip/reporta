# Work around electron-builder's winCodeSign symlink privilege requirement.
# Strategy: extract the archive OURSELVES (7za without -snld), creating real
# files for the two macOS dylib symlinks, then leave the result so
# electron-builder finds the dir already present and skips extraction.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem  # not used; 7za needed

$repo = 'C:\Users\HP\Documents\DATILA\REPORTA\reporta'
$sevenZa = Join-Path $repo 'windows\user\node_modules\7zip-bin\win\x64\7za.exe'

$cache = Join-Path $env:LOCALAPPDATA 'electron-builder\Cache\winCodeSign'
New-Item -ItemType Directory -Force -Path $cache | Out-Null

# Find the cached archive
$archive = Get-ChildItem $cache -Filter '*.7z' | Select-Object -First 1
if (-not $archive) {
    Write-Output 'No winCodeSign archive cached yet — run electron-builder once to download it, then re-run this script.'
    exit 1
}

Write-Output ("Archive: " + $archive.FullName)

# Exclude the two macOS dylib symlink entries entirely (unused on Windows).
$dest = $archive.FullName.Substring(0, $archive.FullName.Length - 3)  # drop ".7z"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
& $sevenZa x -bd -y "-xr0!*.dylib" ("-" + "o$dest") $archive.FullName | Select-Object -Last 3

# The two darwin dylibs: create them as plain files (content copied from the
# real dylib inside the archive, or empty placeholders — they are never used
# on Windows).
foreach ($dylib in @(
    (Join-Path $dest 'darwin\10.12\lib\libcrypto.dylib'),
    (Join-Path $dest 'darwin\10.12\lib\libssl.dylib')
)) {
    if (-not (Test-Path $dylib)) {
        New-Item -ItemType Directory -Force -Path (Split-Path $dylib) | Out-Null
        Set-Content $dylib -Value 'placeholder (macOS dylib, unused on Windows)' -Encoding ASCII
        Write-Output ("placeholder created: " + $dylib)
    }
}

Write-Output "winCodeSign prepared without symlink privilege. Re-run electron-builder now."
