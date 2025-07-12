@echo off
REM Installation script for Web Recorder Native Messaging Host
REM This script must be run as Administrator

echo Web Recorder Native Messaging Host Installer
echo ============================================
echo.

REM Check for admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script requires administrator privileges.
    echo Please right-click and select "Run as administrator"
    pause
    exit /b 1
)

REM Get the current directory
set INSTALL_DIR=%~dp0
set INSTALL_DIR=%INSTALL_DIR:~0,-1%

echo Installation directory: %INSTALL_DIR%
echo.

REM Create the native messaging manifest
echo Creating native messaging manifest...
set MANIFEST_PATH=%INSTALL_DIR%\com.webrecorder.native.json

REM Escape backslashes for JSON
set ESCAPED_PATH=%INSTALL_DIR:\=\\%

(
echo {
echo   "name": "com.webrecorder.native",
echo   "description": "Native messaging host for Web Recorder Extension",
echo   "path": "%ESCAPED_PATH%\\host.bat",
echo   "type": "stdio",
echo   "allowed_extensions": ["webrecorder@extension"]
echo }
) > "%MANIFEST_PATH%"

echo Manifest created at: %MANIFEST_PATH%
echo.

REM Install for Firefox
echo Installing for Firefox...

REM Current user installation
set FIREFOX_REG_KEY=HKCU\Software\Mozilla\NativeMessagingHosts\com.webrecorder.native
reg add "%FIREFOX_REG_KEY%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1

if %errorLevel% equ 0 (
    echo Successfully installed for current user Firefox
) else (
    echo Warning: Failed to install for current user Firefox
)

REM System-wide installation (optional, requires admin)
set FIREFOX_REG_KEY_SYSTEM=HKLM\Software\Mozilla\NativeMessagingHosts\com.webrecorder.native
reg add "%FIREFOX_REG_KEY_SYSTEM%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1

if %errorLevel% equ 0 (
    echo Successfully installed for system-wide Firefox
) else (
    echo Warning: Failed to install for system-wide Firefox
)

echo.
echo Installation complete!
echo.
echo Next steps:
echo 1. Make sure the extension is installed in Firefox
echo 2. The extension ID in manifest.json must be: webrecorder@extension
echo 3. Test by running: test-client.ps1
echo.
pause