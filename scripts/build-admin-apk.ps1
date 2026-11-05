# Scaffold + build the REPORTA Admin APK
$repo = 'C:\Users\HP\Documents\DATILA\REPORTA\reporta'
$proj = Join-Path $repo 'android\admin'

if (-not (Test-Path (Join-Path $proj 'capacitor.config.json'))) {
    New-Item -ItemType Directory -Force -Path $proj | Out-Null
    @{
        name            = 'reporta-android-admin'
        version         = '1.0.0'
        private         = $true
        devDependencies = @{ '@capacitor/cli' = '^6.1.2' }
        dependencies    = @{ '@capacitor/core' = '^6.1.2'; '@capacitor/android' = '^6.1.2' }
    } | ConvertTo-Json -Depth 3 | Set-Content (Join-Path $proj 'package.json')
    @{
        appId   = 'gh.gov.reporta.admin'
        appName = 'REPORTA Admin'
        webDir  = 'www'
        server  = @{ androidScheme = 'https' }
        android = @{ allowMixedContent = $false }
    } | ConvertTo-Json -Depth 3 | Set-Content (Join-Path $proj 'capacitor.config.json')
    Set-Location $proj
    npm install --no-audit --no-fund 2>&1 | Select-Object -Last 2
}

# Sync the admin build
$www = Join-Path $proj 'www'
if (Test-Path $www) { Remove-Item $www -Recurse -Force }
New-Item -ItemType Directory -Force -Path $www | Out-Null
Copy-Item (Join-Path $repo 'apps\admin\dist\*') $www -Recurse -Force

Set-Location $proj
if (-not (Test-Path (Join-Path $proj 'android\gradlew.bat'))) {
    npx cap add android 2>&1 | Select-Object -Last 4
}
npx cap sync android 2>&1 | Select-Object -Last 4

Set-Location (Join-Path $proj 'android')
.\gradlew.bat assembleDebug --no-daemon 2>&1 | Select-Object -Last 6

$outDir = Join-Path $repo 'release\android\admin'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
Copy-Item (Join-Path $proj 'android\app\build\outputs\apk\debug\app-debug.apk') (Join-Path $outDir 'REPORTA-admin-debug.apk') -Force
Get-Item (Join-Path $outDir 'REPORTA-admin-debug.apk') | Select-Object FullName, Length, LastWriteTime
