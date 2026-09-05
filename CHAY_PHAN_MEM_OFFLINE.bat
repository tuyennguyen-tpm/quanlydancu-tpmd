@echo off
title Mo Phan Mem Quan Ly TDP Quang Giao (Offline)
cd /d "%~dp0"

echo Dang khoi chay Phan mem Quan ly Dan cu TDP Quang Giao (Offline)...

if exist "dist-electron\win-unpacked\QuanLyDanCuTDPQuangGiao.exe" (
    start "" "dist-electron\win-unpacked\QuanLyDanCuTDPQuangGiao.exe"
    exit /b
)

if exist "QuanLyDanCuTDPQuangGiao_CHAY_NGAY.exe" (
    start "" "QuanLyDanCuTDPQuangGiao_CHAY_NGAY.exe"
    exit /b
)

if exist "dist-electron\QuanLyDanCuTDPQuangGiao_CHAY_NGAY.exe" (
    start "" "dist-electron\QuanLyDanCuTDPQuangGiao_CHAY_NGAY.exe"
    exit /b
)

echo [LOI] Khong tim thay file chay ung dung (.exe).
pause
