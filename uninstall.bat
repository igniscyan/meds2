@echo off
setlocal enabledelayedexpansion

:: Check if running from temp directory
if not "%~dp0"=="%TEMP%\" (
    echo Moving to temporary location...
    copy "%~f0" "%TEMP%\uninstall_meds.bat" >nul
    start "" "%TEMP%\uninstall_meds.bat"
    exit /b
)

echo Starting uninstallation process...
pause

:: Store the Program Files directory path
set "INSTALL_DIR=%ProgramFiles%\Medical Records System"
if not "%PROCESSOR_ARCHITECTURE%" == "x86" (
    set "INSTALL_DIR=%ProgramFiles(x86)%\Medical Records System"
)

:: Request admin privileges if needed
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\elevate.vbs"
    echo UAC.ShellExecute "%~f0", "", "", "runas", 1 >> "%temp%\elevate.vbs"
    call "%temp%\elevate.vbs"
    del "%temp%\elevate.vbs"
    exit /b
)

echo Admin rights confirmed.
echo Press any key to continue...
pause

:: Kill any running instances
echo Stopping any running instances of the application...
taskkill /F /IM medical-records.exe >nul 2>&1

:: Set up backup paths
set "BACKUP_DIR=%USERPROFILE%\Documents\MEDS_BACKUPS"
set "TIMESTAMP=%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"
set "BACKUP_FILE=%BACKUP_DIR%\MEDS_BACKUP_%TIMESTAMP%.zip"

:: Create backup directory
echo Creating backup directory: %BACKUP_DIR%
mkdir "%BACKUP_DIR%" 2>nul

:: Check for pb_data and create backup
if exist "%INSTALL_DIR%\pb_data" (
    echo Found pb_data directory.
    echo Creating backup at: %BACKUP_FILE%
    echo Press any key to start backup...
    pause

    powershell -Command "Write-Host 'Starting backup...'; Compress-Archive -Path '%INSTALL_DIR%\pb_data' -DestinationPath '%BACKUP_FILE%' -Force; Write-Host 'Backup complete'"
    
    if exist "%BACKUP_FILE%" (
        echo.
        echo Backup created successfully at:
        echo %BACKUP_FILE%
        echo.
        echo Press any key to continue with uninstallation...
        pause
    ) else (
        echo.
        echo WARNING: Backup creation failed!
        echo Please manually copy the pb_data folder before proceeding.
        echo Press any key to continue anyway...
        pause
    )
) else (
    echo No pb_data directory found, skipping backup.
    echo Press any key to continue...
    pause
)

echo.
echo Removing shortcuts...
if exist "%USERPROFILE%\Desktop\Medical Records System.lnk" (
    del "%USERPROFILE%\Desktop\Medical Records System.lnk"
    echo Removed desktop shortcut
)

if exist "%ProgramData%\Microsoft\Windows\Start Menu\Programs\Medical Records System" (
    rmdir /s /q "%ProgramData%\Microsoft\Windows\Start Menu\Programs\Medical Records System"
    echo Removed start menu shortcuts
)

echo.
echo Press any key to remove application files...
pause

:: Remove all files and directories from installation directory
cd /d "%INSTALL_DIR%"
for %%F in (*) do (
    del /f /q "%%F" 2>nul
    echo Removed file: %%F
)

for /d %%D in (*) do (
    rmdir /s /q "%%D" 2>nul
    echo Removed directory: %%D
)

:: Go up one level and remove the main directory
cd ..
rmdir /s /q "%INSTALL_DIR%" 2>nul

echo.
echo Uninstallation complete!
if exist "%BACKUP_FILE%" (
    echo.
    echo Your data has been backed up to:
    echo %BACKUP_FILE%
    echo.
    start explorer "%BACKUP_DIR%"
)

echo.
echo Press any key to complete uninstallation...
pause

:: Clean up the temporary uninstaller
del "%~f0"
exit