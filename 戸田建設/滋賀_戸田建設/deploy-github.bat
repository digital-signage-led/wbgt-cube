@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Pack + Deploy 滋賀_戸田建設 to GitHub Pages

set "SITE_DIR=滋賀_戸田建設"
set "PKG=%~dp0%SITE_DIR%"
set "DEPLOY_ROOT=%~dp0..\_wbgt-cube-deploy"
set "TARGET=%DEPLOY_ROOT%\%SITE_DIR%"

echo.
echo  [1/2] 本番用フォルダを作成: %SITE_DIR%\
echo.

if not exist "%PKG%" mkdir "%PKG%"
if not exist "%PKG%\assets" mkdir "%PKG%\assets"

copy /Y "index-4face.html" "%PKG%\" >nul
copy /Y "index-5face.html" "%PKG%\" >nul
copy /Y "assets\eco-news.json" "%PKG%\assets\" >nul
copy /Y "assets\eco_first.png" "%PKG%\assets\" >nul
copy /Y "assets\toda_lockup_yoko.png" "%PKG%\assets\" >nul
copy /Y "assets\toda_name_yoko.png" "%PKG%\assets\" >nul
copy /Y "assets\toda_mark_tate.png" "%PKG%\assets\" >nul
copy /Y "assets\toda_bct_yoko.png" "%PKG%\assets\" >nul
copy /Y "assets\toda_bct_flow.png" "%PKG%\assets\" >nul
copy /Y "assets\toda_bct_tate.png" "%PKG%\assets\" >nul
copy /Y "assets\toda_logo_stack.png" "%PKG%\assets\" >nul

echo  パッケージ内容:
dir /b "%PKG%"
dir /b "%PKG%\assets"
echo.

if not exist "%DEPLOY_ROOT%\.git" (
    echo  wbgt-cube の作業コピーがありません。
    echo  初回のみ:
    echo    git clone https://github.com/digital-signage-led/wbgt-cube.git "%DEPLOY_ROOT%"
    echo.
    echo  パッケージ %SITE_DIR%\ は作成済みです。clone 後にもう一度この bat を実行してください。
    pause
    exit /b 1
)

echo  [2/2] GitHub Pages へアップロード...
echo.

if not exist "%TARGET%" mkdir "%TARGET%"
xcopy /E /I /Y "%PKG%\*" "%TARGET%\" >nul

pushd "%DEPLOY_ROOT%"
git pull --rebase origin main
git add "%SITE_DIR%"
git diff --staged --quiet
if %errorlevel%==0 (
    echo  変更はありません。
    popd
    pause
    exit /b 0
)
git commit -m "Add 滋賀_戸田建設 signage (4/5-face)"
git push origin main
set "PUSH_ERR=%errorlevel%"
popd

echo.
if %PUSH_ERR%==0 (
    echo  完了。
    echo  5面: https://digital-signage-led.github.io/wbgt-cube/滋賀_戸田建設/index-5face.html?native640=1
    echo  4面: https://digital-signage-led.github.io/wbgt-cube/滋賀_戸田建設/index-4face.html?layout512=1^&native640=1
) else (
    echo  push に失敗しました。Git の認証を確認してください。
)
echo.
pause
