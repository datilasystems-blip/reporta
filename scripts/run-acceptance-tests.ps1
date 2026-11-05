# REPORTA acceptance test harness — runs the API with a TEST database and
# executes the full acceptance suite. Test data lives in a separate DB file.
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot   # reporta/
$apiDir = Join-Path $repoRoot 'apps\api'
$testDb = Join-Path $repoRoot 'packages\database\prisma\test.db'

# Fresh isolated test DB
if (Test-Path $testDb) { Remove-Item $testDb -Force }
$env:DATABASE_URL = "file:$testDb"
Set-Location (Join-Path $repoRoot 'packages\database')
npx prisma db push --skip-generate 2>&1 | Select-Object -Last 2

# Seed admin into the TEST db
Set-Location $apiDir
$env:REPORTA_ADMIN_EMAIL = 'acceptance-admin@test.local'
$env:REPORTA_ADMIN_INITIAL_PASSWORD = 'Accept-Admin-2026-Pass!'
node scripts\seed-admin.mjs

# Start API on 4400
$env:PORT = '4400'
$env:JWT_ACCESS_SECRET = 'test-access-secret-not-production-value'
$env:JWT_REFRESH_SECRET = 'test-refresh-secret-not-production-value'
$env:NODE_ENV = 'test'
$env:FRONTEND_URL = 'http://localhost:5173,http://localhost:5174,http://localhost:5175'
$env:EVIDENCE_DIR = '.\evidence-vault-test'
$env:EMAIL_MODE = 'log'
$env:RATE_LIMIT_WINDOW_MS = '900000'
$env:AUTH_RATE_LIMIT_MAX = '10'
$job = Start-Process node -ArgumentList 'dist/index.js' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 3

try {
  Set-Location $apiDir
  npx tsx --test tests\acceptance.test.ts 2>&1
}
finally {
  Stop-Process -Id $job.Id -Force -ErrorAction SilentlyContinue
  Remove-Item Env:REPORTA_ADMIN_EMAIL, Env:REPORTA_ADMIN_INITIAL_PASSWORD -ErrorAction SilentlyContinue
}
