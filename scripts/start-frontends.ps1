# Start the three Vite dev servers with proper working directories
$repo = 'C:\Users\HP\Documents\DATILA\REPORTA\reporta'

foreach ($app in @(@{n = 'web'; p = 5173 }, @{n = 'admin'; p = 5174 }, @{n = 'officer'; p = 5175 })) {
    $dir = Join-Path $repo "apps\$($app.n)"
    Set-Location $dir
    if (-not (Test-Path (Join-Path $dir 'node_modules\vite'))) {
        Write-Output "Installing deps for $($app.n)..."
        npm install --no-audit --no-fund 2>&1 | Select-Object -Last 1
    }
    $log = Join-Path $repo "logs\$($app.n).log"
    New-Item -ItemType Directory -Force -Path (Join-Path $repo 'logs') | Out-Null
    Start-Process cmd -ArgumentList "/c npx vite --port $($app.p) --host --strictPort > `"$log`" 2>&1" -WindowStyle Hidden
    Write-Output "Started $($app.n) on port $($app.p) (log: $log)"
}
