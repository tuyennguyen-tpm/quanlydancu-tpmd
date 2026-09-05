@echo off
title Mo Phan Mem Quan Ly TDP Quang Giao (Offline)
cd /d "%~dp0"

echo ==========================================================
echo    KHOI DONG PHAN MEM QUAN LY DAN CU TDP QUANG GIAO
echo ==========================================================
echo.
echo Dang khoi chay ung dung...

:: Kiem tra neu chua build dist thi tu dong build
if not exist "dist\index.html" (
    echo [HE THONG] Dang tao ban chay lan dau...
    call npm run build
)

:: 1. Uu tien khoi chay ung dung Desktop qua Electron
if exist "node_modules\electron\dist\electron.exe" (
    echo [HE THONG] Dang mo cua so ung dung...
    start "" "node_modules\electron\dist\electron.exe" .
    exit /b
)

:: 2. Phuong an du phong: Chay may chu cuc bo va mo trinh duyet
echo [HE THONG] Dang khoi dong may chu noi bo...
start http://localhost:5173
call npm run dev
