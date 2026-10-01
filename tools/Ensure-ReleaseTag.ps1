[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidatePattern('^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')][string]$Repository,
    [Parameter(Mandatory)][ValidatePattern('^v?[0-9]+\.[0-9]+\.[0-9]+$')][string]$Tag,
    [Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{40}$')][string]$Commit
)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
function Invoke-GitHubJson {
    param([string[]]$Arguments)
    $result = @(& gh api @Arguments 2>&1)
    if ($LASTEXITCODE -ne 0) { throw "GitHub request failed: $($result -join '\n')" }
    return ($result -join "`n") | ConvertFrom-Json
}
$endpoint = "repos/$Repository/git/ref/tags/$Tag"
$lookup = @(& gh api --include $endpoint 2>&1)
$exitCode = $LASTEXITCODE
$body = $lookup -join "`n"
if ($exitCode -eq 0) {
    $start = $body.IndexOf('{')
    if ($start -lt 0) { throw 'Tag lookup returned no JSON object.' }
    $reference = $body.Substring($start) | ConvertFrom-Json
    $object = $reference.object
    if ($object.type -eq 'tag') {
        $annotated = Invoke-GitHubJson -Arguments @("repos/$Repository/git/tags/$($object.sha)")
        $object = $annotated.object
    }
    if ($object.type -ne 'commit' -or $object.sha -ne $Commit) {
        throw "Existing tag '$Tag' does not resolve to prepared commit '$Commit'."
    }
    Write-Host "Reusing tag '$Tag' at '$Commit'."
    return
}
if ($body -notmatch '(?m)^HTTP/\S+ 404(?:\s|$)') {
    throw "Tag lookup failed; refusing to create a tag: $body"
}
$tagObject = Invoke-GitHubJson -Arguments @('--method','POST',"repos/$Repository/git/tags",'-f',"tag=$Tag",'-f',"message=Release $Tag",'-f',"object=$Commit",'-f','type=commit')
if ($tagObject.sha -notmatch '^[a-fA-F0-9]{40}$') { throw 'Tag creation returned no valid object SHA.' }
$reference = Invoke-GitHubJson -Arguments @('--method','POST',"repos/$Repository/git/refs",'-f',"ref=refs/tags/$Tag",'-f',"sha=$($tagObject.sha)")
if ($reference.object.sha -ne $tagObject.sha) { throw 'Created tag reference does not match its tag object.' }
Write-Host "Created tag '$Tag' at '$Commit'."
