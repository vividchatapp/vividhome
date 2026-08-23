@echo off
setlocal enabledelayedexpansion

:: ============================================================
:: PI-CHAT GATEWAY - Cross-Platform Build Script
:: ============================================================
:: Run this batch file from the project root (or double-click
:: it); it will compile for all supported platforms and place
:: the executables into organized folders under executables/
:: ============================================================

echo.
echo ============================================================
echo  PI-CHAT GATEWAY - Building for all platforms...
echo ============================================================
echo.

:: Get the directory where this batch file is located
set "SCRIPT_DIR=%~dp0"
:: Remove trailing backslash
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

:: Change to the project root (parent of executables folder)
cd /d "%SCRIPT_DIR%\.."

echo Current directory: %cd%
echo.
echo ============================================================
echo.

:: Check if Go is installed
where go >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Go is not installed or not in PATH.
    echo Please install Go from https://go.dev/dl/
    pause
    exit /b 1
)

echo Go version:
go version
echo.

:: Disable CGO for fully static cross-compilation
set CGO_ENABLED=0

:: Create all target directories
echo Creating target directories...
for %%d in (
    "windows_x64"
    "linux_x64"
    "linux_arm64"
    "linux_arm_pi_zero_w"
    "linux_arm_pi3_32"
    "mac_x64"
    "mac_arm64"
) do (
    if not exist "executables\%%~d" mkdir "executables\%%~d"
)
echo Done.
echo.

:: ============================================================
:: Windows Targets
:: ============================================================
echo [1/7] Building for Windows x64...
set GOOS=windows
set GOARCH=amd64
set GOARM=
go build -ldflags="-s -w" -o executables\windows_x64\server.exe .\cmd\server
if %ERRORLEVEL% equ 0 (echo   OK) else (echo   FAILED)
echo.

:: ============================================================
:: Linux Targets
:: ============================================================
echo [2/7] Building for Linux x64...
set GOOS=linux
set GOARCH=amd64
set GOARM=
go build -ldflags="-s -w" -o executables\linux_x64\server .\cmd\server
if %ERRORLEVEL% equ 0 (echo   OK) else (echo   FAILED)
echo.

echo [3/7] Building for Linux ARM64 (e.g. Pi 3/4/5 / Zero 2 W, 64-bit OS)...
set GOOS=linux
set GOARCH=arm64
set GOARM=
go build -ldflags="-s -w" -o executables\linux_arm64\server .\cmd\server
if %ERRORLEVEL% equ 0 (echo   OK) else (echo   FAILED)
echo.

echo [4/7] Building for Raspberry Pi Zero W / Pi 1 (ARMv6)...
set GOOS=linux
set GOARCH=arm
set GOARM=6
go build -ldflags="-s -w" -o executables\linux_arm_pi_zero_w\server .\cmd\server
if %ERRORLEVEL% equ 0 (echo   OK) else (echo   FAILED)
echo.

echo [5/7] Building for Raspberry Pi 2/3/4/5 (32-bit OS, ARMv7)...
set GOOS=linux
set GOARCH=arm
set GOARM=7
go build -ldflags="-s -w" -o executables\linux_arm_pi3_32\server .\cmd\server
if %ERRORLEVEL% equ 0 (echo   OK) else (echo   FAILED)
echo.

:: ============================================================
:: macOS Targets
:: ============================================================
echo [6/7] Building for macOS Intel (x64)...
set GOOS=darwin
set GOARCH=amd64
set GOARM=
go build -ldflags="-s -w" -o executables\mac_x64\server .\cmd\server
if %ERRORLEVEL% equ 0 (echo   OK) else (echo   FAILED)
echo.

echo [7/7] Building for macOS Apple Silicon (M1/M2/M3/M4)...
set GOOS=darwin
set GOARCH=arm64
set GOARM=
go build -ldflags="-s -w" -o executables\mac_arm64\server .\cmd\server
if %ERRORLEVEL% equ 0 (echo   OK) else (echo   FAILED)
echo.

:: ============================================================
:: Summary
:: ============================================================
echo ============================================================
echo  Build complete!
echo ============================================================
echo.
echo Output sizes:
echo.

for %%d in (
    "windows_x64\server.exe"
    "linux_x64\server"
    "linux_arm64\server"
    "linux_arm_pi_zero_w\server"
    "linux_arm_pi3_32\server"
    "mac_x64\server"
    "mac_arm64\server"
) do (
    if exist "executables\%%~d" (
        for %%f in ("executables\%%~d") do (
            set "fname=%%~d"
            set "fsize=%%~zf"
            :: Pad the filename to align columns
            set "fname=!fname!                     "
            echo   !fname:~0,40! !fsize! bytes
        )
    ) else (
        set "fname=%%~d"
        set "fname=!fname!                     "
        echo   !fname:~0,40! [NOT BUILT]
    )
)

echo.
echo ============================================================
echo  All builds completed. Executables are in the executables/
echo  folder, organized by platform.
echo ============================================================
echo.

pause