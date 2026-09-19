[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string] $DestinationPath
)

$ErrorActionPreference = 'Stop'

$version = '1.3.2'
$expectedSha256 = '4AFC32E8B7F79BBE1DE7E4E7049AAAD4E0F754357613B9BBEC0E3052F06FD36B'
$archiveName = "CodeSignTool-v$version-windows.zip"
$downloadUri = "https://github.com/SSLcom/CodeSignTool/releases/download/v$version/$archiveName"
$resolvedDestination = [IO.Path]::GetFullPath($DestinationPath)

# A private, per-run staging directory: the download must not land on a predictable path another
# process could have created first, and the archive must not outlive the install.
$staging = Join-Path ([IO.Path]::GetTempPath()) ('codesigntool-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging -Force | Out-Null
$archivePath = Join-Path $staging $archiveName

try {
    # A release build should not be lost to one refused connection.
    Invoke-WebRequest -Uri $downloadUri -OutFile $archivePath -MaximumRetryCount 4 -RetryIntervalSec 5

    $actualSha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
    if ($actualSha256 -ne $expectedSha256) {
        throw "Unexpected SHA-256 for $archiveName. Expected $expectedSha256, got $actualSha256."
    }

    New-Item -ItemType Directory -Path $resolvedDestination -Force | Out-Null
    Expand-Archive -LiteralPath $archivePath -DestinationPath $resolvedDestination -Force

    $requiredFiles = @(
        'jdk-11.0.2/bin/java.exe'
        'jar/code_sign_tool-1.3.2.jar'
    )
    foreach ($relativePath in $requiredFiles) {
        $requiredPath = Join-Path $resolvedDestination $relativePath
        if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
            throw "CodeSignTool archive did not contain '$relativePath'."
        }
    }
}
finally {
    Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
}

$resolvedDestination
