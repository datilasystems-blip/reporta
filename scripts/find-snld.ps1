$hits = Get-ChildItem 'C:\Users\HP\Documents\DATILA\REPORTA\reporta\windows\user\node_modules' -Recurse -Filter '*.js' -Depth 5 -ErrorAction SilentlyContinue |
Select-String -SimpleMatch 'snld' -List
$hits | Select-Object -First 5 Path, LineNumber
