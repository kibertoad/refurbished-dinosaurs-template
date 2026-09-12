#ifndef MyAppVersion
  #define MyAppVersion "0.1.0"
#endif

#define MyAppName "{{DISPLAY_NAME}}"
#define MyAppGroupName "{{SHORTCUT_NAME}}"
#define MyAppShortcutName "{{SHORTCUT_NAME}}"
#define MyAppPublisher "{{PUBLISHER}}"
#define MyAppExeName "Restoration.Game.exe"
#define PackageRoot "..\..\artifacts\{{PACKAGE_ID}}-win-x64"

[Setup]
AppId={{{APP_ID}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\{{PACKAGE_ID}}
DisableDirPage=no
DefaultGroupName={#MyAppGroupName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
SetupArchitecture=x64
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
OutputDir=..\..\artifacts
OutputBaseFilename={{PACKAGE_ID}}-Setup-{#MyAppVersion}
UninstallDisplayIcon={app}\Game\{#MyAppExeName}
SetupLogging=yes
InfoBeforeFile={#PackageRoot}\NOTICE
LicenseFile={#PackageRoot}\LICENSE

[Files]
Source: "{#PackageRoot}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppShortcutName}"; Filename: "{app}\Game\{#MyAppExeName}"; WorkingDir: "{app}\Game"
Name: "{autodesktop}\{#MyAppShortcutName}"; Filename: "{app}\Game\{#MyAppExeName}"; WorkingDir: "{app}\Game"; Tasks: desktopicon
Name: "{group}\Extract or Manage Original Resources"; Filename: "{app}\Extract Original Resources.bat"; WorkingDir: "{app}"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Run]
Filename: "{app}\Game\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; WorkingDir: "{app}\Game"; Flags: postinstall nowait skipifsilent unchecked

[Code]
var
  SourcePage: TInputDirWizardPage;
  ImportCheckBox: TNewCheckBox;
  ImportOutput: String;
  ImportFailed: Boolean;

function NoImportRequested: Boolean;
begin
  Result := CompareText(ExpandConstant('{param:NOEXTRACT|0}'), '1') = 0;
end;

function SelectedSource: String;
begin
  Result := ExpandConstant('{param:ORIGINAL|}');
  if (Result = '') and Assigned(SourcePage) then Result := SourcePage.Values[0];
end;

procedure InitializeWizard;
begin
  SourcePage := CreateInputDirPage(wpSelectDir,
    'Original game resources',
    'Extract resources from a supported legal copy.',
    'Select the installation, mounted media, or extracted directory for a supported edition. ' +
    'Setup verifies and imports its resources without modifying the original source. Clear the ' +
    'extraction option to install the assetless runtime.', False, '');
  SourcePage.Add('Original source:');
  SourcePage.Values[0] := ExpandConstant('{param:ORIGINAL|}');
  if SourcePage.Values[0] = '' then
    SourcePage.Values[0] := ExpandConstant('{src}');

  ImportCheckBox := TNewCheckBox.Create(SourcePage);
  ImportCheckBox.Parent := SourcePage.Surface;
  ImportCheckBox.Left := SourcePage.Edits[0].Left;
  ImportCheckBox.Top := SourcePage.Edits[0].Top + SourcePage.Edits[0].Height + ScaleY(20);
  ImportCheckBox.Width := SourcePage.SurfaceWidth;
  ImportCheckBox.Caption := 'Extract resources from my legally owned original copy';
  ImportCheckBox.Checked := not NoImportRequested;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Source: String;
begin
  Result := True;
  if (CurPageID <> SourcePage.ID) or not ImportCheckBox.Checked then exit;
  Source := SelectedSource;
  if (Source = '') or not DirExists(Source) then
  begin
    MsgBox('Select an existing original-source directory, or clear the extraction option.', mbError, MB_OK);
    Result := False;
  end;
end;

function ShouldImportOriginal: Boolean;
begin
  if WizardSilent then Result := not NoImportRequested
  else Result := ImportCheckBox.Checked;
end;

procedure ImportLogLine(const S: String; const Error, FirstLine: Boolean);
var
  Line: String;
begin
  Line := Trim(S);
  if Line = '' then exit;
  if Error then Line := 'ERROR: ' + Line;
  Log('Asset Extractor: ' + Line);
  ImportOutput := ImportOutput + Line + #13#10;
  if Length(ImportOutput) > 12000 then
    Delete(ImportOutput, 1, Length(ImportOutput) - 12000);
  WizardForm.StatusLabel.Caption := Line;
end;

function RunResourceImport(const Source: String; var Failure: String): Boolean;
var
  ResultCode: Integer;
  Importer, OutputPath, Parameters: String;
  Started: Boolean;
begin
  Importer := ExpandConstant('{app}\Tools\Restoration.Extractor.exe');
  OutputPath := ExpandConstant('{localappdata}\{{APP_DATA_DIRECTORY}}\UserContent');
  Parameters := 'extract --source "' + Source + '" --output "' + OutputPath + '"';
  ImportOutput := '';
  Failure := '';
  ResultCode := -1;
  WizardForm.StatusLabel.Caption := 'Extracting and verifying original resources...';
  try
    Started := ExecAndLogOutput(Importer, Parameters, ExpandConstant('{app}'), SW_HIDE,
      ewWaitUntilTerminated, ResultCode, @ImportLogLine);
  except
    Started := False;
    Failure := 'The Asset Extractor could not be started: ' + GetExceptionMessage;
  end;
  if not Started and (Failure = '') then
    Failure := 'The Asset Extractor could not be started.';
  if Started and (ResultCode <> 0) then
    Failure := 'Asset extraction failed with error ' + IntToStr(ResultCode) + '.' + #13#10#13#10 +
      ImportOutput;
  if Started and (ResultCode = 0) and not FileExists(OutputPath + '\manifest.json') then
    Failure := 'Asset extraction reported success, but UserContent\manifest.json was not created.';
  Result := Started and (ResultCode = 0) and (Failure = '');
end;

procedure RaiseImportFailure(const Failure: String);
begin
  ImportFailed := True;
  RaiseException(Failure);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Source, Failure: String;
begin
  if (CurStep <> ssPostInstall) or not ShouldImportOriginal then exit;

  Source := SelectedSource;
  while not RunResourceImport(Source, Failure) do
  begin
    if WizardSilent then RaiseImportFailure(Failure);
    if MsgBox(Failure + #13#10#13#10 +
       'Choose Retry to select another supported original source, or Cancel to stop setup.',
       mbError, MB_RETRYCANCEL) <> IDRETRY then
      RaiseImportFailure(Failure);

    repeat
      if not BrowseForFolder('Select a supported original source:', Source, False) then
        RaiseImportFailure('Asset extraction failed and no replacement source was selected.');
      if not DirExists(Source) then
        MsgBox('The selected original-source directory does not exist.', mbError, MB_OK);
    until DirExists(Source);
  end;
  WizardForm.StatusLabel.Caption := 'Original resources extracted and verified.';
end;

function GetCustomSetupExitCode: Integer;
begin
  if ImportFailed then Result := 10
  else Result := 0;
end;
