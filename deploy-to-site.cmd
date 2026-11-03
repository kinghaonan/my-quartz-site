@echo off
setlocal
rem ============================================================
rem  Publish: Quartz notes -> kinghaonan.github.io/my-quartz-site/
rem  Usage: deploy-to-site.cmd [commit message]
rem
rem  The notes repo (remote "site") publishes its own GitHub
rem  Pages, so this script only validates + pushes. CI on that
rem  repo runs adapt-content + quartz build + deploy-pages.
rem ============================================================
cd /d D:\Quartz

if "%~1"=="" (
  set "MSG=notes update"
) else (
  set "MSG=%~1"
)

echo [1/3] Validating content adapter...
call node scripts\adapt-content.mjs
if errorlevel 1 goto :err

echo [2/3] Staging and committing...
call git add -A content scripts quartz package.json package-lock.json .github
call git commit -m "%MSG%"
if errorlevel 1 echo    (nothing to commit)

echo [3/3] Pushing to site main (CI will build and publish)...
call git push site HEAD:main
if errorlevel 1 goto :err

echo.
echo ============================================================
echo  Pushed. Pages updates in ~2 minutes:
echo    https://kinghaonan.github.io/my-quartz-site/
echo  Check the run if it does not:
echo    https://github.com/kinghaonan/my-quartz-site/actions
echo ============================================================
goto :eof

:err
echo [ERROR] Publish failed, check output above.
exit /b 1
