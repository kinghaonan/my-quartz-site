@echo off
setlocal
rem ============================================================
rem  Deploy: Quartz notes -> personal site /my-quartz-site/
rem  Usage: run D:\Quartz\deploy-to-site.cmd
rem ============================================================
cd /d D:\Quartz

echo [1/4] Adapting content...
call node scripts\adapt-content.mjs
if errorlevel 1 goto :err

echo [2/4] Building Quartz...
call npx quartz build -d content-build
if errorlevel 1 goto :err

echo [3/4] Syncing to personal site public\my-quartz-site...
robocopy public "D:\kinghaonan.github.io\public\my-quartz-site" /MIR /XF CNAME /NFL /NDL /NJH /NJS
if errorlevel 8 goto :err

echo [4/4] Rebuilding personal site (Astro) and syncing deploy dir...
cd /d D:\kinghaonan.github.io
call npm run build
if errorlevel 1 goto :err
robocopy dist . /E /XD image fonts /NFL /NDL /NJH /NJS
if errorlevel 8 goto :err

echo.
echo ============================================================
echo  Done. Local deploy finished.
echo  To publish: cd /d D:\kinghaonan.github.io
echo    git add -A ^&^& git commit -m "quartz update" ^&^& git push
echo ============================================================
goto :eof

:err
echo [ERROR] Deploy failed, check output above.
exit /b 1
