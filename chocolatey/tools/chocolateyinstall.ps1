$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'EXE'
  url            = 'https://github.com/BenCook1996/sweepr-deepblock/releases/download/v1.2.9/SWEEPRDeepblockSetup.exe'
  softwareName   = 'SWEEPR Deepblock*'
  checksum       = '6A29563C4EB80E7AB87B12FDC33D636D9DA8D898DEEB879DCFEAB1FDD956CD4E'
  checksumType   = 'sha256'
  silentArgs     = '/S'
  validExitCodes = @(0)
}

Install-ChocolateyPackage @packageArgs
