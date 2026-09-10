@echo off
setlocal
cd /d "%~dp0"
set "SOURCE=%~1"
if "%SOURCE%"=="" (
  echo Enter the path to an installed copy, mounted disc, or extracted directory
  echo for a supported legal original release.
  set /p "SOURCE=Original source: "
)
if "%SOURCE%"=="" exit /b 2
"%~dp0Tools\Restoration.Import.exe" import --source "%SOURCE%" --output "%LOCALAPPDATA%\{{APP_DATA_DIRECTORY}}\UserContent"
if errorlevel 1 (
  echo.
  echo Import failed. The original source was not modified and the last verified content pack was preserved.
  pause
  exit /b 1
)
echo.
echo Original resources were imported and verified successfully.
pause
