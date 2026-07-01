@echo off
title Dong goi ung dung thanh file .EXE - TDP Quang Giao
echo ==========================================================
echo    TIEN HANH DONG GOI HE THONG THANH FILE .EXE
echo ==========================================================
echo.

cd /d "%~dp0"

:: Kiem tra node_modules
if not exist "node_modules" (
    echo [HE THONG] Khong tim thay thu muc node_modules. Dang cai dat thu vien...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [LOI] Co loi xay ra khi chay "npm install".
        pause
        exit /b
    )
)

echo [HE THONG] Dang thuc hien build va dong goi electron...
echo Vui long cho trong giay lat, qua trinh nay co the mat tu 1-3 phut...
echo.

call npm run electron:pack

if %errorlevel% neq 0 (
    echo.
    echo [LOI] Co loi xay ra trong qua trinh dong goi!
    pause
    exit /b
)

echo.
echo ==========================================================
echo    DONG GOI THANH CONG!
echo ==========================================================
echo.
echo [KET QUA] File .EXE da duoc tao trong thu muc "dist-electron"
echo.

:: Tim file .exe duoc build ra trong thu muc dist-electron va copy ra ngoai
if exist "dist-electron\QuanLyDanCuTDPQuangGiao 0.0.0.exe" (
    echo [HE THONG] Dang cap nhat file QuanLyDanCuTDPQuangGiao_CHAY_NGAY.exe o thu muc goc...
    copy /y "dist-electron\QuanLyDanCuTDPQuangGiao 0.0.0.exe" "QuanLyDanCuTDPQuangGiao_CHAY_NGAY.exe"
    echo [HE THONG] Da cap nhat xong! Ban co the chay truc tiep file "QuanLyDanCuTDPQuangGiao_CHAY_NGAY.exe" o thu muc goc.
) else (
    echo [LUU Y] Vui long kiem tra file .exe trong thu muc "dist-electron" va copy ra thu muc goc de chay nhe!
)

echo.
pause
