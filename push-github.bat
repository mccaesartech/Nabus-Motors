@echo off
setlocal
set "GH=C:\Program Files\GitHub CLI\gh.exe"

if not exist "%GH%" (
  echo GitHub CLI not found. Install it with:
  echo   winget install GitHub.cli
  pause
  exit /b 1
)

cd /d "%~dp0"

echo.
echo === True Goshen Auto - GitHub Setup ===
echo.

"%GH%" auth status >nul 2>&1
if errorlevel 1 (
  echo Step 1: Log in to GitHub ^(follow the prompts^)
  echo.
  "%GH%" auth login
  if errorlevel 1 (
    echo Login failed or was cancelled.
    pause
    exit /b 1
  )
)

echo.
echo Step 2: Create repo and push...
echo.

"%GH%" repo create true-goshen-auto --public --source=. --remote=origin --push
if errorlevel 1 (
  echo.
  echo If the repo already exists, try:
  echo   git remote add origin https://github.com/YOUR_USERNAME/true-goshen-auto.git
  echo   git push -u origin master
)

echo.
echo Done. Connect the repo in Vercel: Settings - Git
echo https://vercel.com/mc-caesar-te-chnology-solutions/true-goshen-auto/settings/git
echo.
pause
