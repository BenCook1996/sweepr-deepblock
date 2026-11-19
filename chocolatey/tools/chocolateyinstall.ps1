$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'EXE'
  url            = 'https://github.com/BenCook1996/sweepr-deepblock/releases/download/v1.3.0/SWEEPRDeepblockSetup.exe'
  softwareName   = 'SWEEPR Deepblock*'
  checksum       = '1D03DB50680AE3B41C4C773E9C4D4B8EBCC1D9D27594E57A74468F8B70CE21DA'
  checksumType   = 'sha256'
  silentArgs     = '/S'
  validExitCodes = @(0)
}

Install-ChocolateyPackage @packageArgs
