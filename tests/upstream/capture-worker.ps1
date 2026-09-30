param($Source, $Output)
$ErrorActionPreference = 'Stop'
$captureScriptPath = $Source
$CaptureTimeoutSeconds = 2
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$text = Get-Content $Source -Raw
$native = [regex]::Match($text, "(?s)Add-Type -TypeDefinition @'\r?\n(.*?)\r?\n'@").Groups[1].Value
Add-Type -TypeDefinition $native
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseInput($text, [ref]$tokens, [ref]$errors)
foreach ($name in @('Get-ClientSize', 'Save-ScreenFrame', 'Save-DirectScreenFrame')) {
    $fn = $ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name}, $true)
    Invoke-Expression $fn.Extent.Text
}
Add-Type -ReferencedAssemblies System.Windows.Forms,System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Windows.Forms; using System.Threading;
public class WorkerCanvas : Form {
 [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr window);
 public static WorkerCanvas Canvas;
 public static ManualResetEvent Ready = new ManualResetEvent(false);
 protected override bool ShowWithoutActivation { get { return true; } }
 protected override void OnPaint(PaintEventArgs e){e.Graphics.Clear(Color.Red);e.Graphics.FillRectangle(Brushes.Lime,ClientSize.Width-8,0,8,ClientSize.Height);e.Graphics.FillRectangle(Brushes.Blue,0,ClientSize.Height-8,8,8);}
 public static void Pause(){var entered=new ManualResetEvent(false);Canvas.BeginInvoke(new Action(()=>{entered.Set();Thread.Sleep(5000);}));entered.WaitOne();}
 public volatile bool Stall;
 public WorkerCanvas(){Text="Synthetic capture test";ClientSize=new Size(320,160);StartPosition=FormStartPosition.Manual;Location=new Point(50,50);}
 public static void Start(){var t=new Thread(()=>{SetThreadDpiAwarenessContext(new IntPtr(-4));Canvas=new WorkerCanvas();Canvas.Show();Ready.Set();Application.Run(Canvas);});t.IsBackground=true;t.SetApartmentState(ApartmentState.STA);t.Start();Ready.WaitOne();}
 protected override void WndProc(ref Message m){
  if(m.Msg==0x317 || m.Msg==0x318){
   if(Stall) Thread.Sleep(5000);
   using(var g=Graphics.FromHdc(m.WParam)){g.Clear(Color.Red);g.FillRectangle(Brushes.Lime,ClientSize.Width-8,0,8,ClientSize.Height);g.FillRectangle(Brushes.Blue,0,ClientSize.Height-8,8,8);}
   m.Result=new IntPtr(1);return;
  }base.WndProc(ref m);
 }
}
'@
[WorkerCanvas]::Start()
$form = [WorkerCanvas]::Canvas
$handle = $form.Handle
$old = [OriginalWindowCapture.NativeMethods]::SetThreadDpiAwarenessContext([IntPtr](-1))
try {
    $size = Get-ClientSize $handle
    if ($size.Width -ne 320 -or $size.Height -ne 160) { throw "Wrong physical dimensions: $size" }
    Write-Host "Target DPI: $([WorkerCanvas]::GetDpiForWindow($handle))"
    [WorkerCanvas]::Pause()
    $baseline = [Diagnostics.Stopwatch]::StartNew()
    Save-DirectScreenFrame $handle $size (Join-Path $Output 'baseline.png')
    if ($baseline.Elapsed.TotalSeconds -lt 4) { throw 'Unbounded PrintWindow did not wait on the target' }
    Write-Host "Synchronous baseline waited $($baseline.Elapsed.TotalSeconds) seconds."
    [WorkerCanvas]::Pause()
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $watch.Restart()
    try { Save-ScreenFrame $handle $size (Join-Path $Output 'hung.png'); throw 'Hung capture accepted' }
    catch { if ($_.Exception.Message -notmatch 'timed out') { throw } }
    if ($watch.Elapsed.TotalSeconds -gt 4) { throw 'Capture timeout did not bound the listener' }
    if (Test-Path (Join-Path $Output 'hung.png')) { throw 'Timed-out capture saved a frame' }
    $form.Stall = $false
    Start-Sleep -Seconds 4
    $CaptureTimeoutSeconds = 10
    $path = Join-Path $Output 'recovered.png'
    Save-ScreenFrame $handle $size $path
    $bitmap = [Drawing.Bitmap]::new($path)
    try {
        if ($bitmap.Width -ne 320 -or $bitmap.Height -ne 160 -or
            $bitmap.GetPixel(319,80).ToArgb() -ne [Drawing.Color]::Lime.ToArgb() -or
            $bitmap.GetPixel(0,159).ToArgb() -ne [Drawing.Color]::Blue.ToArgb()) { throw 'Physical client edges cropped' }
    } finally { $bitmap.Dispose() }
    Write-Host 'Stall bounded; subsequent capture retained both physical client edges.'
} finally { [OriginalWindowCapture.NativeMethods]::SetThreadDpiAwarenessContext($old) | Out-Null }
