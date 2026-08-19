[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$ArtifactsDirectory,

  [string]$ChecksumsPath
)

$ErrorActionPreference = 'Stop'

function Fail([string]$Message) {
  throw "[release-signature] $Message"
}

$resolvedArtifactsDirectory = Resolve-Path -LiteralPath $ArtifactsDirectory -ErrorAction Stop
if (-not (Test-Path -LiteralPath $resolvedArtifactsDirectory -PathType Container)) {
  Fail "Artifacts directory is not a directory: $ArtifactsDirectory"
}

$signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue
if ($null -eq $signtool) {
  Fail 'signtool.exe was not found. Install the Windows SDK before signing or verifying a Windows release.'
}

$artifacts = Get-ChildItem -LiteralPath $resolvedArtifactsDirectory -Recurse -File |
  Where-Object { $_.Extension -in '.exe', '.msi' } |
  Sort-Object FullName

if ($artifacts.Count -eq 0) {
  Fail "No .exe or .msi installers were found beneath $resolvedArtifactsDirectory"
}

$checksums = New-Object System.Collections.Generic.List[string]
foreach ($artifact in $artifacts) {
  Write-Host "[release-signature] Verifying $($artifact.FullName)"

  $authenticode = Get-AuthenticodeSignature -LiteralPath $artifact.FullName
  if ($authenticode.Status -ne 'Valid') {
    Fail "$($artifact.Name) has Authenticode status '$($authenticode.Status)' instead of 'Valid'."
  }

  & $signtool.Source verify /pa /v $artifact.FullName
  if ($LASTEXITCODE -ne 0) {
    Fail "signtool verification failed for $($artifact.Name) with exit code $LASTEXITCODE."
  }

  $relativePath = [System.IO.Path]::GetRelativePath($resolvedArtifactsDirectory, $artifact.FullName).Replace('\', '/')
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $artifact.FullName).Hash.ToLowerInvariant()
  $checksums.Add("$hash  $relativePath")
}

if ([string]::IsNullOrWhiteSpace($ChecksumsPath)) {
  $ChecksumsPath = Join-Path $resolvedArtifactsDirectory 'SHA256SUMS.txt'
}

$checksums | Set-Content -LiteralPath $ChecksumsPath -Encoding ascii -NoNewline:$false
Write-Host "[release-signature] PASS verified $($artifacts.Count) signed installer(s); checksums=$ChecksumsPath"
