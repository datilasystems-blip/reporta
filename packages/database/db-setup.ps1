Set-Location $PSScriptRoot
$env:DATABASE_URL = 'file:./dev.db'
npx prisma validate 2>&1 | Select-Object -Last 4
npx prisma generate 2>&1 | Select-Object -Last 4
npx prisma db push --skip-generate 2>&1 | Select-Object -Last 6
