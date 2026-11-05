# Pre-create the exact winCodeSign cache dir electron-builder requests, by
# copying the already-extracted directory (symlinks become files, which is
# fine — the two macOS dylibs are not needed on Windows).
$ErrorActionPreference = 'Stop'
$cache = Join-Path $env:LOCALAPPDATA 'electron-builder\Cache\winCodeSign'
$extracted = Get-ChildItem $cache -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'windows-10') } | Select-Object -First 1
if (-not $extracted) {
    Write-Output 'No fully extracted winCodeSign dir found.'
    Get-ChildItem $cache | Select-Object Name
    exit 1
}
# electron-builder appends a random suffix per attempt; provide the common
# names it probes by copying the content to any missing numbered dir it asks.
Write-Output ("Reference dir: " + $extracted.FullName)
Get-ChildItem $extracted.FullName | Select-Object Name
