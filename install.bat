@echo off
setlocal enabledelayedexpansion

:: Set installation directory
set "INSTALL_DIR=%ProgramFiles%\Medical Records System"
if not "%PROCESSOR_ARCHITECTURE%" == "x86" (
    set "INSTALL_DIR=%ProgramFiles(x86)%\Medical Records System"
)

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

:: Show welcome message
cls
echo Medical Records System Installer
echo ==============================
echo.
echo This will install Medical Records System on your computer.
echo.
set /p "CONTINUE=Press Enter to continue or Ctrl+C to cancel..."

:: Create installation directory
echo.
echo Creating installation directory...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: Copy files
echo Copying application files...
xcopy /E /I /Y "frontend" "%INSTALL_DIR%\frontend"
xcopy /E /I /Y "pb_migrations" "%INSTALL_DIR%\pb_migrations"
copy /Y "medical-records.exe" "%INSTALL_DIR%"
copy /Y "README.txt" "%INSTALL_DIR%"

:: Create desktop shortcut
echo Creating desktop shortcut...
set "SHORTCUT=%USERPROFILE%\Desktop\Medical Records System.lnk"
set "VBS_SCRIPT=%TEMP%\CreateShortcut.vbs"

echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS_SCRIPT%"
echo sLinkFile = "%SHORTCUT%" >> "%VBS_SCRIPT%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%VBS_SCRIPT%"
echo oLink.TargetPath = "%INSTALL_DIR%\medical-records.exe" >> "%VBS_SCRIPT%"
echo oLink.WorkingDirectory = "%INSTALL_DIR%" >> "%VBS_SCRIPT%"
echo oLink.Description = "Medical Records System" >> "%VBS_SCRIPT%"
echo oLink.Save >> "%VBS_SCRIPT%"
cscript /nologo "%VBS_SCRIPT%"
del "%VBS_SCRIPT%"

:: Create start menu shortcuts
echo Creating start menu shortcuts...
set "START_MENU=%ProgramData%\Microsoft\Windows\Start Menu\Programs\Medical Records System"
if not exist "%START_MENU%" mkdir "%START_MENU%"

:: Application shortcut
set "SHORTCUT=%START_MENU%\Medical Records System.lnk"
set "VBS_SCRIPT=%TEMP%\CreateShortcut.vbs"

echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS_SCRIPT%"
echo sLinkFile = "%SHORTCUT%" >> "%VBS_SCRIPT%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%VBS_SCRIPT%"
echo oLink.TargetPath = "%INSTALL_DIR%\medical-records.exe" >> "%VBS_SCRIPT%"
echo oLink.WorkingDirectory = "%INSTALL_DIR%" >> "%VBS_SCRIPT%"
echo oLink.Description = "Medical Records System" >> "%VBS_SCRIPT%"
echo oLink.Save >> "%VBS_SCRIPT%"
cscript /nologo "%VBS_SCRIPT%"

:: Uninstaller shortcut
set "SHORTCUT=%START_MENU%\Uninstall Medical Records System.lnk"
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS_SCRIPT%"
echo sLinkFile = "%SHORTCUT%" >> "%VBS_SCRIPT%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%VBS_SCRIPT%"
echo oLink.TargetPath = "%INSTALL_DIR%\uninstall.bat" >> "%VBS_SCRIPT%"
echo oLink.WorkingDirectory = "%INSTALL_DIR%" >> "%VBS_SCRIPT%"
echo oLink.Description = "Uninstall Medical Records System" >> "%VBS_SCRIPT%"
echo oLink.Save >> "%VBS_SCRIPT%"
cscript /nologo "%VBS_SCRIPT%"
del "%VBS_SCRIPT%"

:: Create uninstaller
echo Creating uninstaller...
set "UNINSTALL_SCRIPT=%INSTALL_DIR%\uninstall.bat"
(
echo @echo off
echo setlocal enabledelayedexpansion
echo.
echo :: Request admin privileges
echo ^>nul 2^>^&1 "%%SYSTEMROOT%%\system32\cacls.exe" "%%SYSTEMROOT%%\system32\config\system"
echo if '%%errorlevel%%' NEQ '0' ^(
echo     echo Requesting administrative privileges...
echo     goto UACPrompt
echo ^) else ^(
echo     goto gotAdmin
echo ^)
echo.
echo :UACPrompt
echo     echo Set UAC = CreateObject^("Shell.Application"^) ^> "%%temp%%\getadmin.vbs"
echo     echo UAC.ShellExecute "%%~s0", "", "", "runas", 1 ^>^> "%%temp%%\getadmin.vbs"
echo     "%%temp%%\getadmin.vbs"
echo     exit /B
echo.
echo :gotAdmin
echo     if exist "%%temp%%\getadmin.vbs" ^( del "%%temp%%\getadmin.vbs" ^)
echo.
echo :: Copy uninstaller to temp directory
echo set "TEMP_UNINSTALLER=%%TEMP%%\meds_uninstall_%%RANDOM%%.bat"
echo copy "%%~f0" "%%TEMP_UNINSTALLER%%"
echo start /wait "" "%%TEMP_UNINSTALLER%%" /CONFIRM
echo exit
echo.
echo :CONFIRM
echo if "%%1" neq "/CONFIRM" exit
echo.
echo echo Uninstalling Medical Records System...
echo echo.
echo.
echo :: Kill any running instances of the application
echo taskkill /F /IM medical-records.exe 2^>nul
echo.
echo :: Archive pb_data if it exists
echo if exist "%INSTALL_DIR%\pb_data" ^(
echo     echo Archiving database data...
echo     set "BACKUP_DATE=%%date:~10,4%%-%%date:~4,2%%-%%date:~7,2%%_%%time:~0,2%%-%%time:~3,2%%-%%time:~6,2%%"
echo     set "BACKUP_DATE=^!BACKUP_DATE: =0^!"
echo     set "BACKUP_FILE=%%USERPROFILE%%\Documents\MEDS_DATA_^!BACKUP_DATE^!.zip"
echo     powershell Compress-Archive -Path "%INSTALL_DIR%\pb_data\*" -DestinationPath "^!BACKUP_FILE^!"
echo     echo.
echo     echo Database backup created at: ^!BACKUP_FILE^!
echo     echo This backup contains all your medical records data.
echo     echo Please keep this file safe if you wish to preserve your data.
echo     echo.
echo ^)
echo.
echo :: Remove shortcuts
echo if exist "%%USERPROFILE%%\Desktop\Medical Records System.lnk" del "%%USERPROFILE%%\Desktop\Medical Records System.lnk"
echo if exist "%%ProgramData%%\Microsoft\Windows\Start Menu\Programs\Medical Records System" rmdir /s /q "%%ProgramData%%\Microsoft\Windows\Start Menu\Programs\Medical Records System"
echo.
echo :: Remove installation directory
echo rmdir /s /q "%INSTALL_DIR%"
echo.
echo echo Uninstallation complete.
echo del "%%~f0"
echo pause
) > "%UNINSTALL_SCRIPT%"

:: Installation complete
echo.
echo Installation complete!
echo.
echo The application has been installed to: %INSTALL_DIR%
echo Shortcuts have been created on the desktop and start menu.
echo To uninstall, use "Uninstall Medical Records System" in the Start Menu.
echo.
set /p "LAUNCH=Would you like to launch the application now? (Y/N) "
if /i "%LAUNCH%"=="Y" start "" "%INSTALL_DIR%\medical-records.exe"

pause 