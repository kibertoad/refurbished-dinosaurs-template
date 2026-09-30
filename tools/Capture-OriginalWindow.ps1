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
    [switch] $ListWindows
)

$ErrorActionPreference = 'Stop'

if (-not $IsWindows -and $PSVersionTable.PSEdition -eq 'Core') {
    throw 'Original-window capture is supported only on Windows.'
}

if (-not $OutputRoot) {
    $repositoryRoot = Split-Path -Parent $PSScriptRoot
    $OutputRoot = Join-Path $repositoryRoot 'reference\original\captures'
}

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

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

    [StructLayout(LayoutKind.Sequential)]
    public struct Point
    {
        public int X;
        public int Y;
    }

    public static class NativeMethods
    {
        [DllImport("user32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool GetClientRect(IntPtr window, out Rect rect);

        [DllImport("user32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool ClientToScreen(IntPtr window, ref Point point);

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

function Get-ClientBounds([IntPtr] $Window) {
    $rect = [OriginalWindowCapture.Rect]::new()
    if (-not [OriginalWindowCapture.NativeMethods]::GetClientRect($Window, [ref] $rect)) {
        throw "GetClientRect failed with Win32 error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())."
    }

    $origin = [OriginalWindowCapture.Point]::new()
    if (-not [OriginalWindowCapture.NativeMethods]::ClientToScreen($Window, [ref] $origin)) {
        throw "ClientToScreen failed with Win32 error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())."
    }

    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    if ($width -le 0 -or $height -le 0) {
        throw "The target client area has invalid dimensions ${width}x${height}."
    }

    [pscustomobject]@{ X = $origin.X; Y = $origin.Y; Width = $width; Height = $height }
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

function Save-ScreenFrame([IntPtr] $Window, $Bounds, [string] $Path) {
    $bitmap = [Drawing.Bitmap]::new($Bounds.Width, $Bounds.Height, [Drawing.Imaging.PixelFormat]::Format24bppRgb)
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

function New-Checkpoint([string] $Label) {
    $target = Find-TargetWindow
    if ([OriginalWindowCapture.NativeMethods]::IsIconic($target.Handle)) {
        throw 'The target window is minimized. Restore it before capturing.'
    }

    $bounds = Get-ClientBounds $target.Handle
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
            Save-ScreenFrame $target.Handle $bounds $framePath
            $hash = (Get-FileHash -LiteralPath $framePath -Algorithm SHA256).Hash.ToLowerInvariant()
            $frames.Add([ordered]@{
                file = $fileName
                sha256 = $hash
                capturedAt = [DateTimeOffset]::Now.ToString('o')
            })

            if ($index -lt $BurstCount -and $BurstIntervalMilliseconds -gt 0) {
                Start-Sleep -Milliseconds $BurstIntervalMilliseconds
            }
        }
    }
    catch {
        # A rejected frame fails the whole checkpoint: keep no partial burst.
        Remove-Item -LiteralPath $checkpointDirectory -Recurse -Force -ErrorAction SilentlyContinue
        throw
    }

    $virtualScreen = [Windows.Forms.SystemInformation]::VirtualScreen
    $metadata = [ordered]@{
        schemaVersion = 1
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
            clientBounds = [ordered]@{
                x = $bounds.X
                y = $bounds.Y
                width = $bounds.Width
                height = $bounds.Height
            }
        }
        virtualScreen = [ordered]@{
            x = $virtualScreen.X
            y = $virtualScreen.Y
            width = $virtualScreen.Width
            height = $virtualScreen.Height
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
