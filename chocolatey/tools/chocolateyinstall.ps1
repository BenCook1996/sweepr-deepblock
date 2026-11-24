$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'EXE'
  url            = 'https://github.com/BenCook1996/sweepr-deepblock/releases/download/v1.3.0/SWEEPRDeepblockSetup.exe'
  softwareName   = 'SWEEPR Deepblock*'
  checksum       = '24421E3EEF1CBF8F31F245CC646E1467B45CEE87052202DDDC79EF72642E52FC'
  checksumType   = 'sha256'
  silentArgs     = '/S'
  validExitCodes = @(0)
}

Install-ChocolateyPackage @packageArgs
