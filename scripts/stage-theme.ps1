$theme = 'C:\Users\HP\Documents\DATILA\REPORTA\reporta\wordpress\reporta-theme'
$dist = 'C:\Users\HP\Documents\DATILA\REPORTA\reporta\apps\web\dist'
New-Item -ItemType Directory -Force -Path "$theme\assets" | Out-Null
Copy-Item "$dist\assets\*" "$theme\assets" -Force
Get-ChildItem "$dist\assets" | Select-Object Name, Length
Write-Output '--- theme files:'
Get-ChildItem $theme -Recurse -File | Select-Object FullName, Length | Format-Table -AutoSize | Out-String -Width 180
