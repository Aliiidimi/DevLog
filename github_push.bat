@echo off
title GitHub Baglantisi ve Push
cd /d "C:\Users\darks\.gemini\antigravity\scratch\gamedev-hub"
echo ==========================================================
echo         DevLog - GitHub Deponuza Baglaniyor              
echo ==========================================================
echo.
echo Eger tarayici acilirsa lutfen GitHub hesabinizla 'Authorize' diyerek onaylayin.
echo.
git push -u origin main
echo.
if %errorlevel% equ 0 (
    echo [BASARILI] DevLog basariyla GitHub deponuza gonderildi!
) else (
    echo [HATA] Bir sorun olustu.
)
echo.
echo Devam etmek icin herhangi bir tusa basin...
pause >nul
