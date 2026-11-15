$ErrorActionPreference = 'Stop'

[array]$key = Get-UninstallRegistryKey -SoftwareName 'SWEEPR Deepblock*'

if ($key.Count -eq 1) {
  $key | ForEach-Object {
    $file = $_.UninstallString -replace '^\s*"?([^"]+\.exe)"?.*$', '$1'
    if (-not (Test-Path $file)) {
      Write-Warning "Uninstaller executable not found at '$file'."
      return
    }
    $packageArgs = @{
      packageName    = $env:ChocolateyPackageName
      fileType       = 'EXE'
      silentArgs     = '--uninstall /S'
      validExitCodes = @(0)
      file           = $file
    }
    Uninstall-ChocolateyPackage @packageArgs
  }
} elseif ($key.Count -eq 0) {
  Write-Warning "$env:ChocolateyPackageName has already been uninstalled by other means."
} elseif ($key.Count -gt 1) {
  Write-Warning "$($key.Count) matches found! Skipping automated uninstall to avoid removing other software."
}
