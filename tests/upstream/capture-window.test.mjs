import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
test('direct capture reads an offscreen synthetic window and rejects invalid or blank results', t => {
  if (process.platform !== 'win32') return t.skip('Windows PrintWindow acceptance');
  const scratch = mkdtempSync(join(tmpdir(), 'window-capture-'));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const runner = join(scratch, 'acceptance.ps1');
  writeFileSync(runner, String.raw`
param($Source, $Output)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$sourceText = Get-Content -LiteralPath $Source -Raw
$native = [regex]::Match($sourceText, "(?s)Add-Type -TypeDefinition @'\r?\n(.*?)\r?\n'@").Groups[1].Value
Add-Type -TypeDefinition $native
$tokens=$null; $errors=$null
$ast=[Management.Automation.Language.Parser]::ParseInput($sourceText,[ref]$tokens,[ref]$errors)
if ($errors.Count) { throw 'Capture helper did not parse' }
$function=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Save-ScreenFrame'}, $true)
Invoke-Expression $function.Extent.Text
Add-Type -ReferencedAssemblies System.Windows.Forms,System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Windows.Forms;
public class CaptureCanvas : Form {
 public bool Uniform;
 public CaptureCanvas(){ClientSize=new Size(32,16);StartPosition=FormStartPosition.Manual;Location=new Point(-10000,-10000);}
 protected override bool ShowWithoutActivation { get { return true; } }
 protected override void OnPaint(PaintEventArgs e) { e.Graphics.Clear(Color.Red); if(!Uniform) e.Graphics.FillRectangle(Brushes.Lime,16,0,16,16); }
 protected override void WndProc(ref Message m) {
  if(m.Msg==0x317 || m.Msg==0x318) {
   using(var g=Graphics.FromHdc(m.WParam)) {
    g.Clear(Color.Red); if(!Uniform) g.FillRectangle(Brushes.Lime,16,0,16,16);
   } m.Result=new IntPtr(1); return;
  } base.WndProc(ref m);
 }
}
'@
$form=[CaptureCanvas]::new()
try {
 $form.Show(); $form.Refresh()
 $handle=$form.Handle
 $bounds=[pscustomobject]@{Width=32;Height=16;X=0;Y=0}
 $path=Join-Path $Output 'valid.png'
 Save-ScreenFrame $handle $bounds $path
 $bitmap=[Drawing.Bitmap]::new($path)
 try {
  if ($bitmap.GetPixel(4,8).ToArgb() -ne [Drawing.Color]::Red.ToArgb() -or
      $bitmap.GetPixel(24,8).ToArgb() -ne [Drawing.Color]::Lime.ToArgb()) {throw 'Captured pixels are not from the target renderer'}
 } finally {$bitmap.Dispose()}
 $form.Uniform=$true
 $form.Refresh()
 try {Save-ScreenFrame $handle $bounds (Join-Path $Output 'blank.png');throw 'Blank result accepted'}
 catch {if($_.Exception.Message -notmatch 'uniform frame'){throw}}
 try {Save-ScreenFrame ([IntPtr]0) $bounds (Join-Path $Output 'invalid.png');throw 'Invalid window accepted'}
 catch {if($_.Exception.Message -notmatch 'does not support direct capture'){throw}}
 if((Test-Path (Join-Path $Output 'blank.png')) -or (Test-Path (Join-Path $Output 'invalid.png'))){throw 'Rejected frame written'}
} finally {$form.Dispose()}
`);
  const result = spawnSync('powershell.exe', ['-NoProfile', '-File', runner,
    resolve(import.meta.dirname, '../../tools/Capture-OriginalWindow.ps1'), scratch], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
