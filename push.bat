@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   TIEN HANH DAY MA NGUON LEN GITHUB (VERCEL DEPLOY)
echo ===================================================
echo.

:: Tu dong tim duong dan cai dat cua Git tren Windows
set "GIT_EXE=git"

if exist "C:\Program Files\Git\cmd\git.exe" (
    set "GIT_EXE=C:\Program Files\Git\cmd\git.exe"
) else if exist "C:\Program Files\Git\bin\git.exe" (
    set "GIT_EXE=C:\Program Files\Git\bin\git.exe"
) else if exist "%LocalAppData%\Programs\Git\cmd\git.exe" (
    set "GIT_EXE=%LocalAppData%\Programs\Git\cmd\git.exe"
)

echo [He thong] Dang su dung Git tai: "!GIT_EXE!"
echo [He thong] Dang chuan bi day cac file thay doi len...
echo.

:: Chay cac lenh Git qua duong dan chinh xac
"!GIT_EXE!" add .
"!GIT_EXE!" commit -m "update code"
"!GIT_EXE!" push origin main

echo.
echo ===================================================
echo  Da day ma nguon len GitHub thanh cong!
echo  Trang web tren Vercel dang duoc cap nhat tu dong.
echo ===================================================
echo.
pause
