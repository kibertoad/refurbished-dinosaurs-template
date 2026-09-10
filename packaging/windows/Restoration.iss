#ifndef MyAppVersion
  #define MyAppVersion "0.1.0"
#endif
#define MyAppName "{{DISPLAY_NAME}}"
#define MyAppExe "Restoration.Game.exe"

[Setup]
AppId={{{APP_ID}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={autopf}\{{PACKAGE_ID}}
DefaultGroupName={#MyAppName}
OutputDir=..\..\artifacts
OutputBaseFilename={{PACKAGE_ID}}-Setup-{#MyAppVersion}
Compression=lzma2/max
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
WizardStyle=modern
UninstallDisplayIcon={app}\Game\{#MyAppExe}

[Files]
Source: "..\..\artifacts\{{PACKAGE_ID}}-win-x64\Game\*"; DestDir: "{app}\Game"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\artifacts\{{PACKAGE_ID}}-win-x64\Tools\*"; DestDir: "{app}\Tools"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "Import Original Resources.bat"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\Game\{#MyAppExe}"
Name: "{group}\Import or Manage Original Resources"; Filename: "{app}\Import Original Resources.bat"; WorkingDir: "{app}"

[Run]
Filename: "{app}\Game\{#MyAppExe}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent

[Code]
var
  SourcePage: TInputDirWizardPage;

function NoImportRequested: Boolean;
begin
  Result := CompareText(ExpandConstant('{param:NOIMPORT|0}'), '1') = 0;
end;

function SelectedSource(Param: String): String;
begin
  Result := ExpandConstant('{param:ORIGINAL|}');
  if (Result = '') and Assigned(SourcePage) then Result := SourcePage.Values[0];
end;

procedure InitializeWizard;
begin
  SourcePage := CreateInputDirPage(wpSelectDir,
    'Original game resources',
    'Select a supported legal original',
    'Choose the installation, mounted media, or extracted directory for a supported edition. ' +
    'Leave blank to install without importing now. The original source is never modified.', False, '');
  SourcePage.Add('Original source:');
  SourcePage.Values[0] := ExpandConstant('{param:ORIGINAL|}');
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var Source: String;
begin
  Result := True;
  if CurPageID <> SourcePage.ID then Exit;
  Source := SelectedSource('');
  if (Source <> '') and not DirExists(Source) then begin
    MsgBox('The selected original-source directory does not exist.', mbError, MB_OK);
    Result := False;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Source, Params: String;
  ExitCode, Choice: Integer;
begin
  if (CurStep <> ssPostInstall) or NoImportRequested then Exit;
  Source := SelectedSource('');
  if Source = '' then Exit;
  repeat
    Params := 'import --source "' + Source + '" --output "' +
      ExpandConstant('{localappdata}\{{APP_DATA_DIRECTORY}}\UserContent') + '"';
    if Exec(ExpandConstant('{app}\Tools\Restoration.Import.exe'), Params, '', SW_SHOW,
      ewWaitUntilTerminated, ExitCode) and (ExitCode = 0) then Exit;
    Choice := MsgBox('Original-resource import failed. Select Retry after correcting the source, ' +
      'or Cancel to leave the assetless installation in place.', mbError, MB_RETRYCANCEL);
  until Choice = IDCANCEL;
end;
