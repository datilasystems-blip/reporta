# Start REPORTA: API (:4400) + web (:5173) + admin (:5174) + officer (:5175)
$repo = 'C:\Users\HP\Documents\DATILA\REPORTA\reporta'

# API
$apiEnv = Join-Path $repo 'apps\api\.env'
$envBackup = Join-Path $repo 'apps\api\.env.dev-backup'
if (Test-Path $apiEnv) { Copy-Item $apiEnv $envBackup -Force }
@"
NODE_ENV=development
PORT=4400
DATABASE_URL=file:../../packages/database/prisma/dev.db
JWT_ACCESS_SECRET=dev-access-secret-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production
FRONTEND_URL=http://localhost:5173,http://localhost:5174,http://localhost:5175
PUBLIC_WEB_URL=http://localhost:5173
PUBLIC_ADMIN_URL=http://localhost:5174
PUBLIC_OFFICER_URL=http://localhost:5175
API_PUBLIC_URL=http://localhost:4400
EVIDENCE_DIR=./evidence-vault
EMAIL_MODE=log
"@ | Set-Content $apiEnv -Encoding UTF8

Set-Location (Join-Path $repo 'apps\api')
$api = Start-Process node -ArgumentList 'dist/index.js' -PassThru -WindowStyle Hidden

# Frontends
Set-Location (Join-Path $repo 'apps\web')
$web = Start-Process npx -ArgumentList 'vite', '--port', '5173', '--host' -PassThru -WindowStyle Hidden
Set-Location (Join-Path $repo 'apps\admin')
$admin = Start-Process npx -ArgumentList 'vite', '--port', '5174', '--host' -PassThru -WindowStyle Hidden
Set-Location (Join-Path $repo 'apps\officer')
$officer = Start-Process npx -ArgumentList 'vite', '--port', '5175', '--host' -PassThru -WindowStyle Hidden

Start-Sleep 5
Move-Item $envBackup $apiEnv -Force -ErrorAction SilentlyContinue

Write-Output ""
Write-Output "=============================================="
Write-Output "  REPORTA is running"
Write-Output "=============================================="
Write-Output ""
Write-Output "  Public app      : http://localhost:5173"
Write-Output "  Admin portal    : http://localhost:5174"
Write-Output "  Officer portal  : http://localhost:5175"
Write-Output "  API             : http://localhost:4400"
Write-Output "  API health      : http://localhost:4400/health"
Write-Output ""
Write-Output "  Admin login     : superadmin@reporta.local"
Write-Output "  Initial password: ChangeMe-First-Login-2026!"
Write-Output "  (must change on first sign-in)"
Write-Output ""
Write-Output "  Processes: API=$($api.Id) WEB=$($web.Id) ADMIN=$($admin.Id) OFFICER=$($officer.Id)"
Write-Output "  To stop:   Get-Process node | Stop-Process -Force"
Write-Output "=============================================="
