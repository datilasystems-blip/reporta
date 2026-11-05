if ($env:ANDROID_HOME) { Write-Output ("ANDROID_HOME=" + $env:ANDROID_HOME) }
elseif ($env:ANDROID_SDK_ROOT) { Write-Output ("ANDROID_SDK_ROOT=" + $env:ANDROID_SDK_ROOT) }
else {
  $p = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
  Write-Output ("SDK at default path exists: " + (Test-Path $p))
  $java = Get-Command java -ErrorAction SilentlyContinue
  Write-Output ("JAVA: " + $(if ($java) { $java.Source } else { 'not found' }))
}
