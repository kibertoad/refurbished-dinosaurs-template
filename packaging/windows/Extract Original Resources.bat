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
"%~dp0Tools\Restoration.Extractor.exe" extract --source "%SOURCE%" --output "%LOCALAPPDATA%\{{APP_DATA_DIRECTORY}}\UserContent"
if errorlevel 1 (
  echo.
  echo Extraction failed. The original source was not modified and the last verified asset pack was preserved.
  pause
  exit /b 1
)
echo.
echo Original resources were extracted and verified successfully.
pause
