# Signs Windows executables with SSL.com eSigner via the pinned CodeSignTool.
#
# CodeSignTool takes its credentials as command-line options, so they are visible in the process
# table for the lifetime of each call. There is no supported alternative input -- the vendor's
# properties file carries endpoints only -- so this is accepted deliberately, and is why signing is
# confined to the ephemeral `release-signing` runner rather than run anywhere a second tenant could
# be reading the process list. The values stay masked in the job log because the workflow passes
# them from `secrets.*`.
[CmdletBinding(DefaultParameterSetName = 'BatchSign')]
param(
    [Parameter(Mandatory, ParameterSetName = 'BatchSign')]
    [string] $InputDirectory,

    [Parameter(Mandatory, ParameterSetName = 'BatchSign')]
    [string] $OutputDirectory,

    [Parameter(Mandatory, ParameterSetName = 'Sign')]
    [string] $InputFile,

    [Parameter(Mandatory)]
    [string] $CodeSignToolPath
)

$ErrorActionPreference = 'Stop'
# PowerShell 7.4+ turns a non-zero native exit code into a terminating error while
# $ErrorActionPreference is 'Stop'. That would abort at the `& $java` call itself, before
# CodeSignTool's own output is echoed -- which is the only thing that says why a signature was
# refused. Handle the exit code explicitly instead.
$PSNativeCommandUseErrorActionPreference = $false

$requiredVariables = @('ES_USERNAME', 'ES_PASSWORD', 'CREDENTIAL_ID', 'ES_TOTP_SECRET')
$missing = $requiredVariables | Where-Object { -not [Environment]::GetEnvironmentVariable($_) }
if ($missing.Count -ne 0) {
    throw "Missing eSigner environment variable(s): $($missing -join ', ')."
}
$toolRoot = [IO.Path]::GetFullPath($CodeSignToolPath)
$java = Join-Path $toolRoot 'jdk-11.0.2/bin/java.exe'
$jar = Join-Path $toolRoot 'jar/code_sign_tool-1.3.2.jar'
if (-not (Test-Path -LiteralPath $java -PathType Leaf)) {
    throw "Bundled CodeSignTool Java runtime was not found at '$java'."
}
if (-not (Test-Path -LiteralPath $jar -PathType Leaf)) {
    throw "CodeSignTool jar was not found at '$jar'."
}

function Invoke-CodeSignTool {
    param(
        [Parameter(Mandatory)]
        [string[]] $Arguments
    )

    Push-Location -LiteralPath $toolRoot
    try {
        $output = @(& $java '-Xmx1024M' '-jar' $jar @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }

    $outputText = @($output | ForEach-Object { $_.ToString() })
    $outputText | ForEach-Object { Write-Host $_ }

    if ($exitCode -ne 0) {
        throw "CodeSignTool failed with exit code $exitCode."
    }

    # CodeSignTool has been observed reporting a refusal on stdout while still exiting 0, so the
    # output is screened as well. The patterns match an error only where one is actually reported --
    # at the start of a line, as a Java exception type, or as picocli's usage complaints -- so an
    # incidental "0 errors" in a summary line does not fail a release.
    $failurePatterns = @(
        '(?im)^\s*(error|exception)\b'
        '(?im)^\s*\S*Exception\b'
        '(?i)\berror:\s'
        '(?i)missing required option'
        '(?i)unmatched argument'
    )
    $reportedFailure = @($outputText | Where-Object {
        $line = $_
        $failurePatterns | Where-Object { $line -match $_ }
    })
    if ($reportedFailure.Count -ne 0) {
        throw ("CodeSignTool exited 0 but reported a failure: " +
            ($reportedFailure | Select-Object -First 1))
    }
}

$authenticationArguments = @(
    "-username=$env:ES_USERNAME"
    "-password=$env:ES_PASSWORD"
    "-credential_id=$env:CREDENTIAL_ID"
)

try {
    if ($PSCmdlet.ParameterSetName -eq 'BatchSign') {
        $resolvedInput = [IO.Path]::GetFullPath($InputDirectory)
        $resolvedOutput = [IO.Path]::GetFullPath($OutputDirectory)
        $files = @(Get-ChildItem -LiteralPath $resolvedInput -File)
        if ($files.Count -eq 0) {
            throw "No files were found to sign in '$resolvedInput'."
        }

        # batch_sign cannot request a scan itself, so submit every hash before signing the batch.
        foreach ($file in $files) {
            Invoke-CodeSignTool -Arguments @(
                'scan_code'
                $authenticationArguments
                "-input_file_path=$($file.FullName)"
            )
        }

        New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null
        Invoke-CodeSignTool -Arguments @(
            'batch_sign'
            $authenticationArguments
            "-totp_secret=$env:ES_TOTP_SECRET"
            "-input_dir_path=$resolvedInput"
            "-output_dir_path=$resolvedOutput"
        )
    }
    else {
        $resolvedInput = [IO.Path]::GetFullPath($InputFile)
        if (-not (Test-Path -LiteralPath $resolvedInput -PathType Leaf)) {
            throw "File to sign was not found at '$resolvedInput'."
        }

        Invoke-CodeSignTool -Arguments @(
            'sign'
            $authenticationArguments
            "-totp_secret=$env:ES_TOTP_SECRET"
            "-input_file_path=$resolvedInput"
            '-override=true'
            '-malware_block=true'
        )
    }
}
finally {
    $logsPath = Join-Path $toolRoot 'logs'
    if (Test-Path -LiteralPath $logsPath) {
        Remove-Item -LiteralPath $logsPath -Recurse -Force
    }
}
