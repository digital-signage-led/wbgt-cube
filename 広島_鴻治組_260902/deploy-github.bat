@echo off
cd /d "%~dp0"
title Deploy to GitHub Pages (wbgt-cube)

set "DEPLOY_ROOT=%~dp0..\_wbgt-cube-deploy"
set "TARGET=%DEPLOY_ROOT%\hiroshima_koujigumi_kumano"

if not exist "%DEPLOY_ROOT%\.git" (
    echo.
    echo  wbgt-cube の作業コピーがありません。
    echo  初回のみ次を実行してください:
    echo    git clone https://github.com/digital-signage-led/wbgt-cube.git "%DEPLOY_ROOT%"
    echo.
    pause
    exit /b 1
)

echo.
echo  GitHub Pages へ反映します...
echo.

if not exist "%TARGET%" mkdir "%TARGET%"
copy /Y "index-4face.html" "%TARGET%\"

if exist "assets" (
    if not exist "%TARGET%\assets" mkdir "%TARGET%\assets"
    xcopy /E /I /Y "assets\*" "%TARGET%\assets\"
)

pushd "%DEPLOY_ROOT%"
git pull --rebase origin main
git add hiroshima_koujigumi_kumano\index-4face.html
if exist "hiroshima_koujigumi_kumano\assets" git add hiroshima_koujigumi_kumano\assets\
git diff --staged --quiet
if %errorlevel%==0 (
    echo  変更はありません。
    popd
    pause
    exit /b 0
)
git commit -m "Add koujigumi Kumano 4-face signage"
git push origin main
set "PUSH_ERR=%errorlevel%"
popd

echo.
if %PUSH_ERR%==0 (
    echo  完了。1〜2分後に反映されます:
    echo  https://digital-signage-led.github.io/wbgt-cube/hiroshima_koujigumi_kumano/index-4face.html?layout512=1^&native640=1
) else (
    echo  push に失敗しました。Git の認証を確認してください。
)
echo.
pause
