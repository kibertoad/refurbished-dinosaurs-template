@echo off
setlocal
cd /d "%~dp0"

set "DOTNET_EXE="
for /f "delims=" %%D in ('where dotnet 2^>nul') do if not defined DOTNET_EXE set "DOTNET_EXE=%%D"
if not defined DOTNET_EXE (
  echo The .NET 10 SDK is required to run {{DISPLAY_NAME}}.
  echo Install the .NET 10 SDK, then run this file again.
  pause
  exit /b 1
)

call "%DOTNET_EXE%" build {{PROJECT_NAME}}.slnx
if errorlevel 1 exit /b 1

if /i "%~1"=="--smoke-test" goto launch
if /i "%~1"=="--platform-smoke-test" goto launch

set "ASSET_PACK=%LOCALAPPDATA%\{{APP_DATA_DIRECTORY}}\UserContent"
if exist "%~dp0UserContent\manifest.json" set "ASSET_PACK=%~dp0UserContent"
call "%DOTNET_EXE%" run --no-build --project src\{{PROJECT_NAME}}.Extractor -- verify-pack --output "%ASSET_PACK%" >nul 2>nul
if not errorlevel 1 goto launch

set "GAME_SOURCE=%{{SOURCE_ENVIRONMENT_VARIABLE}}%"
if not defined GAME_SOURCE (
  echo Verified original resources were not found.
  echo Set {{SOURCE_ENVIRONMENT_VARIABLE}} to your legally owned supported source,
  echo or run "Extract Original Resources.bat" from an installed package.
  pause
  exit /b 1
)

echo Creating the verified local asset pack from "%GAME_SOURCE%"...
call "%DOTNET_EXE%" run --no-build --project src\{{PROJECT_NAME}}.Extractor -- extract --source "%GAME_SOURCE%" --output "%ASSET_PACK%"
if errorlevel 1 (
  pause
  exit /b 1
)

:launch
echo Starting {{DISPLAY_NAME}}...
call "%DOTNET_EXE%" run --no-build --project src\{{PROJECT_NAME}}.Game -- %*
set "GAME_EXIT=%ERRORLEVEL%"
exit /b %GAME_EXIT%
