[CmdletBinding()]
param(
    [string] $ProcessName = '',
    [string] $WindowTitle = '{{ORIGINAL_TITLE}}',
    [string] $Experiment = 'manual',
    [string] $OutputRoot,
    [ValidateRange(1, 30)]
    [int] $BurstCount = 5,
    [ValidateRange(0, 5000)]
    [int] $BurstIntervalMilliseconds = 100,
    [ValidateRange(0, 300)]
    [int] $DelaySeconds = 0,
    [ValidateSet('Sound', 'None')]
    [string] $Acknowledgement = 'Sound',
    [switch] $Once,
    [switch] $HotKey,
    [ValidateRange(1, 1440)]
    [int] $HotKeyTimeoutMinutes = 15,
    [switch] $ListWindows,
    [ValidateRange(1, 60)]
    [int] $CaptureTimeoutSeconds = 10,
    [Parameter(DontShow = $true)]
    [long] $CaptureWorkerWindow,
    [Parameter(DontShow = $true)]
    [string] $CaptureWorkerPath
)

$ErrorActionPreference = 'Stop'
$captureScriptPath = $PSCommandPath

if (-not $IsWindows -and $PSVersionTable.PSEdition -eq 'Core') {
    throw 'Original-window capture is supported only on Windows.'
}

# Checked before any capture, so a missing dependency never costs a posed checkpoint. The capture
# worker only renders frames and does not hash them.
if (-not $CaptureWorkerWindow -and -not $ListWindows) {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        throw 'Node.js is required to hash captured frames (tools/evidence/xxh3.mjs); install it and run pnpm install.'
    }
    $script:nodePath = $node.Source
    $script:xxh3Helper = Join-Path (Split-Path -Parent $PSScriptRoot) 'tools\evidence\xxh3.mjs'
    if (-not (Test-Path -LiteralPath $script:xxh3Helper)) {
        throw "Frame hashing helper not found: $script:xxh3Helper"
    }
    # Hashing the helper itself proves the reader package resolves, which needs pnpm install. Node's
    # stack trace for a missing package is dropped: the message below says what to do. Windows
    # PowerShell turns a native command's redirected stderr into errors, which 'Stop' would make
    # terminating, so the preference is relaxed for this one call.
    $preference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $script:nodePath $script:xxh3Helper $script:xxh3Helper 2>$null | Out-Null }
    finally { $ErrorActionPreference = $preference }
    if ($LASTEXITCODE -ne 0) {
        throw 'Frame hashing does not run; run pnpm install in the repository first.'
    }
}

if (-not $OutputRoot) {
    $repositoryRoot = Split-Path -Parent $PSScriptRoot
    $OutputRoot = Join-Path $repositoryRoot 'reference\original\captures'
}

Add-Type -AssemblyName System.Drawing

if (-not ('OriginalWindowCapture.NativeMethods' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace OriginalWindowCapture
{
    [StructLayout(LayoutKind.Sequential)]
    public struct Rect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    public static class NativeMethods
    {
        [DllImport("user32.dll", SetLastError = true)]
        public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);

        [DllImport("user32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool GetClientRect(IntPtr window, out Rect rect);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool IsIconic(IntPtr window);

        [DllImport("user32.dll")]
        public static extern short GetAsyncKeyState(int virtualKey);

        [DllImport("user32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool PrintWindow(IntPtr window, IntPtr deviceContext, uint flags);

        // PW_CLIENTONLY | PW_RENDERFULLCONTENT: the client area, including
        // DirectX/OpenGL content that WM_PRINTCLIENT alone renders black.
        public const uint PrintClientFullContent = 0x1 | 0x2;

        // True when every pixel of a locked, top-down bitmap equals the first.
        public static bool IsUniform(IntPtr scan0, int stride, int width, int height, int bytesPerPixel)
        {
            int rowBytes = width * bytesPerPixel;
            byte[] first = new byte[bytesPerPixel];
            byte[] row = new byte[rowBytes];
            Marshal.Copy(scan0, first, 0, bytesPerPixel);
            for (int y = 0; y < height; y++)
            {
                Marshal.Copy(new IntPtr(scan0.ToInt64() + (long)y * stride), row, 0, rowBytes);
                for (int x = 0; x < rowBytes; x++)
                {
                    if (row[x] != first[x % bytesPerPixel]) return false;
                }
            }
            return true;
        }
    }
}
'@
}

function Get-CapturableWindows {
    @(Get-Process -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero -and $_.MainWindowTitle } |
        Sort-Object ProcessName, Id |
        ForEach-Object {
            [pscustomobject]@{
                Id = $_.Id
                ProcessName = $_.ProcessName
                Title = $_.MainWindowTitle
                Handle = $_.MainWindowHandle
            }
        })
}

function Find-TargetWindow {
    $windows = @(Get-CapturableWindows)
    $matches = @($windows | Where-Object {
        ($_.ProcessName -ieq $ProcessName -or $_.ProcessName -like "$ProcessName*") -and
        ($WindowTitle.Length -eq 0 -or $_.Title -like "*$WindowTitle*")
    })

    if ($matches.Count -eq 0) {
        throw "No window matched process '$ProcessName' and title '$WindowTitle'. Use -ListWindows to inspect candidates explicitly."
    }

    if ($matches.Count -gt 1) {
        $descriptions = ($matches | ForEach-Object { "PID $($_.Id): $($_.Title)" }) -join ', '
        throw "More than one window matched: $descriptions. Narrow -ProcessName or -WindowTitle."
    }

    $matches[0]
}

function Get-ClientSize([IntPtr] $Window) {
    # Use physical client pixels, independently of the PowerShell host's DPI mode.
    $previousDpi = [OriginalWindowCapture.NativeMethods]::SetThreadDpiAwarenessContext([IntPtr](-4))
    if ($previousDpi -eq [IntPtr]::Zero) { throw 'Could not enable per-monitor DPI awareness for capture.' }
    try {
        $rect = [OriginalWindowCapture.Rect]::new()
        if (-not [OriginalWindowCapture.NativeMethods]::GetClientRect($Window, [ref] $rect)) {
            throw "GetClientRect failed with Win32 error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())."
        }

        $width = $rect.Right - $rect.Left
        $height = $rect.Bottom - $rect.Top
        if ($width -le 0 -or $height -le 0) {
            throw "The target client area has invalid dimensions ${width}x${height}."
        }

        [pscustomobject]@{ Width = $width; Height = $height }
    }
    finally { [OriginalWindowCapture.NativeMethods]::SetThreadDpiAwarenessContext($previousDpi) | Out-Null }
}

function ConvertTo-SafeName([string] $Value, [string] $Fallback) {
    $safe = [regex]::Replace($Value.Trim(), '[^A-Za-z0-9._-]+', '-')
    $safe = $safe.Trim('-')
    if ($safe) { return $safe }
    $Fallback
}

function Send-CaptureAcknowledgement([bool] $Succeeded) {
    if ($Acknowledgement -eq 'None') { return }

    try {
        if ($Succeeded) {
            [Console]::Beep(1000, 90)
            [Console]::Beep(1400, 110)
        }
        else {
            [Console]::Beep(350, 300)
        }
    }
    catch {
        # An unavailable system speaker must not change the capture outcome.
    }
}

function Save-DirectScreenFrame([IntPtr] $Window, $Size, [string] $Path) {
    $bitmap = [Drawing.Bitmap]::new($Size.Width, $Size.Height, [Drawing.Imaging.PixelFormat]::Format24bppRgb)
    try {
        $graphics = [Drawing.Graphics]::FromImage($bitmap)
        try {
            $deviceContext = $graphics.GetHdc()
            try {
                if (-not [OriginalWindowCapture.NativeMethods]::PrintWindow($Window, $deviceContext, [OriginalWindowCapture.NativeMethods]::PrintClientFullContent)) {
                    throw 'The selected window does not support direct capture. No desktop-copy fallback is permitted.'
                }
            }
            finally { $graphics.ReleaseHdc($deviceContext) }
        }
        finally {
            $graphics.Dispose()
        }

        $pixels = $bitmap.LockBits(
            [Drawing.Rectangle]::new(0, 0, $bitmap.Width, $bitmap.Height),
            [Drawing.Imaging.ImageLockMode]::ReadOnly,
            $bitmap.PixelFormat)
        try {
            $uniform = [OriginalWindowCapture.NativeMethods]::IsUniform($pixels.Scan0, $pixels.Stride, $pixels.Width, $pixels.Height, 3)
        }
        finally { $bitmap.UnlockBits($pixels) }
        if ($uniform) { throw 'Direct capture returned a uniform frame; renderer support and game state are unverified. No frame was saved.' }
        $bitmap.Save($Path, [Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $bitmap.Dispose()
    }
}

function Save-ScreenFrame([IntPtr] $Window, $Size, [string] $Path) {
    # A thread timeout cannot safely release a DC still used by PrintWindow.
    # A disposable process owns all GDI resources and can be killed on timeout.
    $scriptLiteral = $captureScriptPath.Replace("'", "''")
    $Path = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path)
    $pathLiteral = $Path.Replace("'", "''")
    $command = "& '$scriptLiteral' -CaptureWorkerWindow $($Window.ToInt64()) -CaptureWorkerPath '$pathLiteral'"
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = (Get-Process -Id $PID).Path
    $start.Arguments = "-NoProfile -NonInteractive -OutputFormat Text -EncodedCommand $encoded"
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardError = $true
    $worker = [Diagnostics.Process]::Start($start)
    $errors = $worker.StandardError.ReadToEndAsync()
    try {
        if (-not $worker.WaitForExit($CaptureTimeoutSeconds * 1000)) {
            $worker.Kill()
            $worker.WaitForExit()
            Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
            throw "Direct capture timed out after $CaptureTimeoutSeconds seconds; the selected window may be unresponsive."
        }
        if ($worker.ExitCode -ne 0) {
            throw "Direct capture worker failed: $($errors.GetAwaiter().GetResult())"
        }
        $frame = [Drawing.Bitmap]::new($Path)
        try {
            if ($frame.Width -ne $Size.Width -or $frame.Height -ne $Size.Height) {
                throw 'The target client size changed during capture. Retry the checkpoint.'
            }
        }
        finally { $frame.Dispose() }
    }
    finally {
        if (-not $worker.HasExited) { $worker.Kill(); $worker.WaitForExit() }
        $worker.Dispose()
    }
}

if ($CaptureWorkerPath) {
    $previousDpi = [OriginalWindowCapture.NativeMethods]::SetThreadDpiAwarenessContext([IntPtr](-4))
    if ($previousDpi -eq [IntPtr]::Zero) { throw 'Could not enable per-monitor DPI awareness for capture.' }
    try {
        $window = [IntPtr]$CaptureWorkerWindow
        Save-DirectScreenFrame $window (Get-ClientSize $window) $CaptureWorkerPath
    }
    finally { [OriginalWindowCapture.NativeMethods]::SetThreadDpiAwarenessContext($previousDpi) | Out-Null }
    exit 0
}

# Frames are named by xxh3, the hash the documentation standard gives every file, computed by the
# executable reader's sourceXxh3 through tools/evidence/xxh3.mjs (Windows PowerShell has no XXH3).
function Get-FrameXxh3([string[]] $Paths) {
    # Only stdout is read: Windows PowerShell turns a native command's redirected stderr into an
    # error record, which would stop the script before the exit code is checked.
    $output = & $script:nodePath $script:xxh3Helper @Paths
    if ($LASTEXITCODE -ne 0) {
        throw "Frame hashing failed with exit code $LASTEXITCODE; see the xxh3 message above."
    }
    $hashes = @($output | ForEach-Object {
        $line = "$_"
        if ($line -notmatch '^([0-9a-f]{32})  ') { throw "Unexpected xxh3 output: $line" }
        $Matches[1]
    })
    if ($hashes.Count -ne $Paths.Count) {
        throw "Expected $($Paths.Count) frame hashes, got $($hashes.Count)."
    }
    return ,$hashes
}

function New-Checkpoint([string] $Label) {
    $target = Find-TargetWindow
    if ([OriginalWindowCapture.NativeMethods]::IsIconic($target.Handle)) {
        throw 'The target window is minimized. Restore it before capturing.'
    }

    $clientSize = Get-ClientSize $target.Handle
    $safeExperiment = ConvertTo-SafeName $Experiment 'manual'
    $safeLabel = ConvertTo-SafeName $Label 'checkpoint'
    $experimentDirectory = Join-Path $OutputRoot $safeExperiment
    [IO.Directory]::CreateDirectory($experimentDirectory) | Out-Null

    $capturedAt = [DateTimeOffset]::Now
    $checkpointName = '{0}-{1}' -f $capturedAt.ToString('yyyyMMdd-HHmmss-fff'), $safeLabel
    $checkpointDirectory = Join-Path $experimentDirectory $checkpointName
    [IO.Directory]::CreateDirectory($checkpointDirectory) | Out-Null

    $frames = [Collections.Generic.List[object]]::new()
    try {
        for ($index = 1; $index -le $BurstCount; $index++) {
            $fileName = 'frame-{0:D2}.png' -f $index
            $framePath = Join-Path $checkpointDirectory $fileName
            Save-ScreenFrame $target.Handle $clientSize $framePath
            $frames.Add([ordered]@{
                file = $fileName
                xxh3 = $null
                capturedAt = [DateTimeOffset]::Now.ToString('o')
            })

            if ($index -lt $BurstCount -and $BurstIntervalMilliseconds -gt 0) {
                Start-Sleep -Milliseconds $BurstIntervalMilliseconds
            }
        }
        # Hashed once after the burst, so starting Node never lengthens the pause between frames.
        $hashes = Get-FrameXxh3 ($frames | ForEach-Object { Join-Path $checkpointDirectory $_.file })
        for ($index = 0; $index -lt $frames.Count; $index++) {
            $frames[$index].xxh3 = $hashes[$index]
        }
    }
    catch {
        # A rejected frame fails the whole checkpoint: keep no partial burst.
        Remove-Item -LiteralPath $checkpointDirectory -Recurse -Force -ErrorAction SilentlyContinue
        throw
    }

    $metadata = [ordered]@{
        schemaVersion = 3
        experiment = $Experiment
        label = $Label
        capturedAt = $capturedAt.ToString('o')
        captureMethod = 'selected-window-printwindow-client'
        acknowledgement = $Acknowledgement.ToLowerInvariant()
        evidencePolicy = 'Raw burst frames may contain modern-OS rendering glitches; use stable repeated state only.'
        target = [ordered]@{
            processId = $target.Id
            processName = $target.ProcessName
            windowTitle = $target.Title
            clientSize = [ordered]@{
                width = $clientSize.Width
                height = $clientSize.Height
            }
        }
        burst = [ordered]@{
            count = $BurstCount
            intervalMilliseconds = $BurstIntervalMilliseconds
            frames = $frames
        }
    }

    $metadataPath = Join-Path $checkpointDirectory 'checkpoint.json'
    $metadata | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $metadataPath -Encoding utf8
    $indexRecord = [ordered]@{
        capturedAt = $capturedAt.ToString('o')
        experiment = $Experiment
        label = $Label
        directory = $checkpointName
        processId = $target.Id
        frameCount = $BurstCount
    } | ConvertTo-Json -Compress
    Add-Content -LiteralPath (Join-Path $experimentDirectory 'index.jsonl') -Value $indexRecord -Encoding utf8

    Write-Host "Captured '$Label' to $checkpointDirectory"
    Send-CaptureAcknowledgement $true
    $checkpointDirectory
}

if ($ListWindows) {
    Get-CapturableWindows | Format-Table Id, ProcessName, Title -AutoSize
    exit 0
}

if ($Once) {
    if ($DelaySeconds -gt 0) {
        Start-Sleep -Seconds $DelaySeconds
    }
    try {
        New-Checkpoint 'checkpoint' | Out-Null
    }
    catch {
        Send-CaptureAcknowledgement $false
        throw
    }
    exit 0
}

if ($HotKey) {
    $controlKey = 0x11
    $shiftKey = 0x10
    $captureKey = 0x7b
    $deadline = [DateTimeOffset]::Now.AddMinutes($HotKeyTimeoutMinutes)
    $captureNumber = 0
    $wasPressed = $false

    Write-Host "Reference capture hotkey is ready for experiment '$Experiment'."
    Write-Host "Keep the game active and press Ctrl+Shift+F12 to capture. Listener expires at $($deadline.ToString('o'))."
    while ([DateTimeOffset]::Now -lt $deadline) {
        $controlDown = ([OriginalWindowCapture.NativeMethods]::GetAsyncKeyState($controlKey) -band 0x8000) -ne 0
        $shiftDown = ([OriginalWindowCapture.NativeMethods]::GetAsyncKeyState($shiftKey) -band 0x8000) -ne 0
        $captureDown = ([OriginalWindowCapture.NativeMethods]::GetAsyncKeyState($captureKey) -band 0x8000) -ne 0
        $pressed = $controlDown -and $shiftDown -and $captureDown

        if ($pressed -and -not $wasPressed) {
            $captureNumber++
            try {
                New-Checkpoint ('hotkey-{0:D3}' -f $captureNumber) | Out-Null
            }
            catch {
                Send-CaptureAcknowledgement $false
                Write-Warning $_.Exception.Message
            }
        }

        $wasPressed = $pressed
        Start-Sleep -Milliseconds 40
    }

    Write-Host 'Reference capture hotkey listener expired.'
    exit 0
}

Write-Host "Reference capture is ready for experiment '$Experiment'."
Write-Host 'Keep the original game window open and not minimized.'
Write-Host 'Enter a checkpoint label and press Enter. Enter q to stop.'
while ($true) {
    $label = Read-Host 'capture'
    if ($label -eq 'q') { break }
    if (-not $label) { $label = 'checkpoint' }

    try {
        New-Checkpoint $label | Out-Null
    }
    catch {
        Send-CaptureAcknowledgement $false
        Write-Warning $_.Exception.Message
    }
}
