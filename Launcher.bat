@echo off
setlocal enabledelayedexpansion

:: VARIABLES
set REPO_DIR=%~dp0
set FRONTEND_BUILD_DIR=%REPO_DIR%pos-frontend\dist
set GIT_REPO_URL=https://Psahu1296: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@github.com/Psahu1296/Bill-App.git

set START_URL=http://localhost:5000

:: SHOW TEMP LOADING SCREEN
start "Loading" powershell -NoProfile -Command ^
  "$wshell = New-Object -ComObject Wscript.Shell; $wshell.Popup('Starting the POS app... Please wait.', 9999, 'POS Loader', 64)"

:: CHECK INTERNET CONNECTIVITY
echo Checking internet connectivity...
ping -n 2 google.com > nul
if errorlevel 1 (
    echo No internet connection. Skipping Git update.
    set HAS_INTERNET=false
) else (
    set HAS_INTERNET=true
)

:: GIT LOGIC
if "%HAS_INTERNET%"=="true" (
    echo.
    echo Pulling latest code from Git...
    cd /d "%REPO_DIR%"

    if exist ".git" (
        git reset --hard
        git pull origin main
    ) else (
        echo Cloning fresh repo...
        rmdir /s /q pos-frontend
        rmdir /s /q pos-backend
        git clone %GIT_REPO_URL% .
    )
)

:: BUILD FRONTEND
echo.
echo Building frontend...
cd /d "%REPO_DIR%\pos-frontend"
call npm install > nul
call npm run build

:: START DOCKER
echo.
echo Starting Docker containers...
cd /d "%REPO_DIR%"
docker-compose up -d

:: WAIT FOR BACKEND TO BOOT
echo.
echo Waiting for backend to start...
timeout /t 8 > nul

:: CLOSE LOADING SCREEN
taskkill /FI "WINDOWTITLE eq POS Loader" > nul 2>&1

:: OPEN IN BROWSER
echo Launching POS in browser...
start "" "%START_URL%"

endlocal
exit
