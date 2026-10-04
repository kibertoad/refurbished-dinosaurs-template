[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Path,
    [Parameter(Mandatory)][ValidatePattern('^[A-Fa-f0-9]{40}$')][string] $ExpectedThumbprint
)
$ErrorActionPreference = 'Stop'
$signature = Get-AuthenticodeSignature -LiteralPath $Path
if ($signature.Status -ne 'Valid' -or -not $signature.TimeStamperCertificate -or
    -not $signature.SignerCertificate -or $signature.SignerCertificate.Thumbprint -ine $ExpectedThumbprint) {
    throw "Invalid, untimestamped or unexpected Windows signature on '$Path'."
}
Write-Host "Verified timestamped Windows signature on $Path"
