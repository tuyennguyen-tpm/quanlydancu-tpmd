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

:: Dong bo code moi nhat tu GitHub ve truoc
echo [He thong] Dang kiem tra va dong bo cap nhat moi nhat tu GitHub...
"!GIT_EXE!" pull --rebase origin main

echo.
echo [He thong] Dang dong goi commit va day len GitHub...
"!GIT_EXE!" add .
"!GIT_EXE!" commit -m "update code"
"!GIT_EXE!" push origin main

if !ERRORLEVEL! EQU 0 (
    echo.
    echo ===================================================
    echo  Da day ma nguon len GitHub THANH CONG!
    echo  Trang web tren Vercel dang duoc cap nhat tu dong.
    echo ===================================================
) else (
    echo.
    echo ===================================================
    echo  CO LOI XAY RA KHI DAY LEN GITHUB!
    echo  Vui long kiem tra lai ket noi hoac thong bao loi tren.
    echo ===================================================
)
echo.
pause
