$repo = 'C:\Users\HP\Documents\DATILA\REPORTA\reporta'
$outDir = Join-Path $repo 'release\android\user'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
Copy-Item (Join-Path $repo 'android\user\android\app\build\outputs\apk\debug\app-debug.apk') (Join-Path $outDir 'REPORTA-user-debug.apk') -Force
Get-Item (Join-Path $outDir 'REPORTA-user-debug.apk') | Select-Object FullName, Length, LastWriteTime
