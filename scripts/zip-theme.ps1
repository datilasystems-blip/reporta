# Zips the REPORTA theme with forward-slash entry names (WordPress-safe).
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression

$repo = Split-Path -Parent $PSScriptRoot
$src = Join-Path $repo 'wordpress\reporta-theme'
$out = Join-Path $repo 'release\wordpress'
$zip = Join-Path $out 'REPORTA-WordPress-Theme.zip'

New-Item -ItemType Directory -Force -Path $out | Out-Null
if (Test-Path $zip) { Remove-Item $zip -Force }

$z = [System.IO.Compression.ZipFile]::Open($zip, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    Get-ChildItem $src -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($src.Length + 1).Replace('\', '/')
        $entry = $z.CreateEntry("reporta-theme/$rel", [System.IO.Compression.CompressionLevel]::Optimal)
        $stream = $entry.Open()
        $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Dispose()
    }
}
finally { $z.Dispose() }

Write-Output ("ZIP created: $zip (" + [math]::Round((Get-Item $zip).Length / 1KB, 1) + " KB)")
