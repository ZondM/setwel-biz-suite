@echo off
title Setwel Africa - website preview
cd /d "%~dp0"
echo.
echo  ============================================
echo   SETWEL AFRICA - preview the website locally
echo  ============================================
echo.

rem 0. This file must sit next to the "store" folder
if not exist "%~dp0store\index.php" (
  echo  PROBLEM: the "store" folder was not found next to this file.
  echo.
  echo  This file is in:  %~dp0
  echo  Move PREVIEW-WEBSITE.bat into the project folder - the one that contains
  echo  the folders  store, dist  and  docs  - and double-click it there.
  echo.
  pause
  exit /b 1
)

rem 1. Find PHP: already installed, or a portable copy in this folder
set "PHPEXE="
where php >nul 2>nul && set "PHPEXE=php"
if exist "%~dp0php-portable\php.exe" set "PHPEXE=%~dp0php-portable\php.exe"

if "%PHPEXE%"=="" (
  echo  PHP is not on this computer yet. Downloading a portable copy ^(about 30 MB, one time only^)...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; try { Invoke-WebRequest -UseBasicParsing -Uri 'https://windows.php.net/downloads/releases/latest/php-8.3-nts-Win32-vs16-x64-latest.zip' -OutFile '%TEMP%\setwel-php.zip'; Expand-Archive -Force '%TEMP%\setwel-php.zip' '%~dp0php-portable'; exit 0 } catch { Write-Host $_; exit 1 }"
  if exist "%~dp0php-portable\php.exe" (
    set "PHPEXE=%~dp0php-portable\php.exe"
  ) else (
    echo.
    echo  Automatic download failed. Please do this once by hand:
    echo   1. Open https://windows.php.net/download
    echo   2. Under "PHP 8.3", "VS16 x64 Non Thread Safe", click "Zip"
    echo   3. Extract the zip into a folder called  php-portable  next to this file
    echo   4. Double-click PREVIEW-WEBSITE.bat again
    echo.
    pause
    exit /b 1
  )
)

rem 2. Work out where PHP's extensions are
set "PHPDIR="
if exist "%~dp0php-portable\php.exe" set "PHPDIR=%~dp0php-portable\"
if "%PHPDIR%"=="" for /f "delims=" %%P in ('where php') do if not defined PHPDIR set "PHPDIR=%%~dpP"

echo  Starting the website at  http://127.0.0.1:8080
echo.
echo  - The first time, a "Set up your store" page opens:
echo      choose  SQLite , type any name/email/password, tick sample products, click Install.
echo  - Shop:   http://127.0.0.1:8080
echo  - Admin:  http://127.0.0.1:8080/admin
echo  - To STOP the preview, close this black window.
echo  - Nothing here goes onto the internet. It is only on your computer.
echo.
rem Open the browser a few seconds AFTER the server has started
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://127.0.0.1:8080'"
"%PHPEXE%" -n -d "extension_dir=%PHPDIR%ext" -d extension=pdo_sqlite -d extension=sqlite3 -d extension=gd -d extension=zip -d extension=fileinfo -d extension=mbstring -d extension=curl -d extension=openssl -d upload_max_filesize=20M -d post_max_size=40M -S 127.0.0.1:8080 -t store store\index.php
echo.
echo  The preview has stopped. If you see an error message above, take a screenshot
echo  of this window and send it to Claude Code.
pause
