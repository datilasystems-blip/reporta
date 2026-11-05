Set-Location $PSScriptRoot
$api = Join-Path (Split-Path -Parent $PSScriptRoot) 'apps\api'
Set-Location $api

# Seed super admin (idempotent)
$env:DATABASE_URL = ('file:' + (Join-Path (Split-Path -Parent (Split-Path -Parent $api)) 'packages\database\prisma\dev.db'))
$env:REPORTA_ADMIN_EMAIL = 'superadmin@reporta.local'
$env:REPORTA_ADMIN_INITIAL_PASSWORD = 'ChangeMe-First-Login-2026!'
node scripts\seed-admin.mjs
node scripts\seed-admin.mjs   # second run proves idempotency

# Start API on port 4400
$env:PORT = '4400'
$env:JWT_ACCESS_SECRET = 'dev-access-secret-not-for-production'
$env:JWT_REFRESH_SECRET = 'dev-refresh-secret-not-for-production'
$env:NODE_ENV = 'development'
$env:FRONTEND_URL = 'http://localhost:5173,http://localhost:5174,http://localhost:5175'
$env:EVIDENCE_DIR = '.\evidence-vault'
$job = Start-Process node -ArgumentList 'dist/index.js' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 3

Write-Output '=== Health ==='
try { (Invoke-WebRequest -Uri 'http://localhost:4400/health' -UseBasicParsing).Content } catch { Write-Output $_.Exception.Message }
Write-Output '=== Register reporter ==='
try {
  $r = Invoke-WebRequest -Uri 'http://localhost:4400/api/auth/register' -Method Post -Body '{"email":"tester@example.com","password":"TestPass-2026!","name":"Test Reporter"}' -ContentType 'application/json' -UseBasicParsing
  Write-Output ("REGISTER: " + $r.StatusCode + " " + $r.Content.Substring(0,[Math]::Min(160,$r.Content.Length)))
} catch { Write-Output ("REGISTER FAILED: " + $_.Exception.Message) }
Write-Output '=== Login reporter ==='
try {
  $r = Invoke-WebRequest -Uri 'http://localhost:4400/api/auth/login' -Method Post -Body '{"email":"tester@example.com","password":"TestPass-2026!"}' -ContentType 'application/json' -UseBasicParsing
  Write-Output ("LOGIN: " + $r.StatusCode)
} catch { Write-Output ("LOGIN FAILED: " + $_.Exception.Message) }
Write-Output '=== Admin login forbidden from /api/admin without staff role ==='
try {
  $r = Invoke-WebRequest -Uri 'http://localhost:4400/api/auth/login' -Method Post -Body '{"email":"superadmin@reporta.local","password":"ChangeMe-First-Login-2026!"}' -ContentType 'application/json' -UseBasicParsing
  Write-Output ("ADMIN LOGIN: " + $r.StatusCode + " mustChangePassword=" + (($r.Content | ConvertFrom-Json).user.mustChangePassword))
} catch { Write-Output ("ADMIN LOGIN FAILED: " + $_.Exception.Message) }
Stop-Process -Id $job.Id -Force -ErrorAction SilentlyContinue
