@echo off
REM Batch wrapper for the PowerShell native messaging host
REM This file is called by the browser when launching the native messaging host

REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0

REM Launch the PowerShell host script
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%host.ps1"