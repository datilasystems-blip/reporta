# REPORTA acceptance test harness.
# Runs the API against an isolated TEST database with correct env via a
# temporary .env (PowerShell strips inline $env: assignments, so we write
# the file dotenv reads instead).
$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\HP\Documents\DATILA\REPORTA\reporta'
$api = Join-Path $repo 'apps\api'
$envFile = Join-Path $api '.env'
$envBackup = Join-Path $api '.env.bak'

# Isolated test database
$testDb = Join-Path $repo 'packages\database\prisma\test.db'
if (Test-Path $testDb) { Remove-Item $testDb -Force }

# Back up dev .env, write test .env (this is what dotenv actually loads)
if (Test-Path $envFile) { Copy-Item $envFile $envBackup -Force }
@"
NODE_ENV=test
PORT=4400
DATABASE_URL=file:../packages/database/prisma/test.db
JWT_ACCESS_SECRET=test-access-secret-not-production-value
JWT_REFRESH_SECRET=test-refresh-secret-not-production-value
FRONTEND_URL=http://localhost:5173,http://localhost:5174,http://localhost:5175
PUBLIC_WEB_URL=http://localhost:5173
PUBLIC_ADMIN_URL=http://localhost:5174
PUBLIC_OFFICER_URL=http://localhost:5175
API_PUBLIC_URL=http://localhost:4400
EVIDENCE_DIR=./evidence-vault-test
EMAIL_MODE=log
REPORTA_ADMIN_EMAIL=acceptance-admin@test.local
REPORTA_ADMIN_INITIAL_PASSWORD=Accept-Admin-2026-Pass!
"@ | Set-Content $envFile -Encoding UTF8

$job = $null
try {
  # Push schema to the test DB (run from the database package so the
  # relative SQLite path resolves correctly)
  Push-Location (Join-Path $repo 'packages\database')
  $env:DATABASE_URL = "file:$testDb"
  npx prisma db push --skip-generate 2>&1 | Out-Null
  Pop-Location

  # Seed the test super-admin
  Push-Location $api
  node scripts\seed-admin.mjs
  Pop-Location

  # Start API (dotenv reads the temporary .env)
  Push-Location $api
  $job = Start-Process node -ArgumentList 'dist/index.js' -PassThru -WindowStyle Hidden
  Start-Sleep 3
  Pop-Location

  node (Join-Path $repo 'scripts\healthcheck.mjs')

  # Run acceptance suite (rate-limit skip is keyed off NODE_ENV=test)
  Push-Location $api
  $env:NODE_ENV = 'test'
  $env:TEST_API_URL = 'http://localhost:4400'
  npx tsx --test tests\acceptance.test.ts 2>&1
  Pop-Location
}
finally {
  if ($job) { Stop-Process -Id $job.Id -Force -ErrorAction SilentlyContinue }
  # Restore dev .env
  if (Test-Path $envBackup) {
    Move-Item $envBackup $envFile -Force
  }
}
