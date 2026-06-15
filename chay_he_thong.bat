@echo off
title Khoi dong Phan mem Quan ly Dan cu - TDP Quang Giao
echo ==========================================================
echo    KHOI DONG HE THONG QUAN LY DAN CU TDP QUANG GIAO
echo ==========================================================
echo.

cd /d "%~dp0"

:: Kiem tra xem da co node_modules chua, neu chua thi tu dong chay npm install
if not exist "node_modules" (
    echo [HE THONG] Khong tim thay thu muc node_modules. Dang tien hanh cai dat thu vien...
    echo [HE THONG] Vui long cho trong giay lat...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [LOI] Co loi xay ra khi chay "npm install".
        echo [HUONG DAN] Hay chac chan ban da cai dat Node.js tu trang: https://nodejs.org/
        pause
        exit /b
    )
)

echo [HE THONG] Dang khoi dong may chu thu nghiem (Vite)...
echo [HE THONG] Sau khi khoi dong xong, hay mo link: http://localhost:5173
echo.
call npm run dev

pause
