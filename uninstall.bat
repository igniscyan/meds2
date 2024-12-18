@echo off
setlocal enabledelayedexpansion

:: Request admin privileges
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo Requesting administrative privileges...
    goto UACPrompt
) else (
    goto gotAdmin
)

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
    pushd "%CD%"
    CD /D "%~dp0"

echo Uninstalling Medical Records System...
echo.

:: Kill any running instances of the application
taskkill /F /IM medical-records.exe 2>nul

:: Archive pb_data if it exists
if exist "%~dp0\pb_data" (
    echo Archiving database data...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "
        $source = '%~dp0pb_data'
        $backupDir = [Environment]::GetFolderPath('MyDocuments') + '\MEDS_BACKUP'
        $timestamp = (Get-Date).ToString('yyyy-MM-dd_HH-mm')
        $dest = Join-Path $backupDir ('archive_' + $timestamp + '.zip')
        
        Write-Host ('Backup directory: ' + $backupDir)
        Write-Host ('Source: ' + $source)
        Write-Host ('Destination: ' + $dest)
        
        if (Test-Path -Path $source) {
            New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
            Compress-Archive -Path $source -DestinationPath $dest -Force
            Write-Host 'Backup completed successfully.'
        } else {
            Write-Error ('Source directory not found: ' + $source)
        }
    "
    
    if exist "%USERPROFILE%\Documents\MEDS_BACKUP\archive_*.zip" (
        echo.
        echo Database backup successfully created in Documents\MEDS_BACKUP
        echo This backup contains all your medical records data.
        echo Please keep this file safe if you wish to preserve your data.
        echo.
        pause
    ) else (
        echo.
        echo Warning: Failed to create backup
        echo Please manually copy the pb_data folder before continuing.
        pause
    )
)

:: Remove shortcuts
if exist "%USERPROFILE%\Desktop\Medical Records System.lnk" del "%USERPROFILE%\Desktop\Medical Records System.lnk"
if exist "%ProgramData%\Microsoft\Windows\Start Menu\Programs\Medical Records System" rmdir /s /q "%ProgramData%\Microsoft\Windows\Start Menu\Programs\Medical Records System"

:: Remove all application files
cd /d "%~dp0"
for /d %%i in ("*") do rmdir /s /q "%%i"
for %%i in ("*") do if /i not "%%~nxi"=="uninstall.bat" del /q "%%i"

:: Finally remove the uninstaller itself
echo.
echo Uninstallation complete.
echo.
echo Press any key to close this window...
pause >nul
(goto) 2>nul & del "%~f0"