@echo off
setlocal

REM Get the script directory
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%..\..\"

REM Change to project root
cd /d "%PROJECT_ROOT%"

echo Cleaning up previous build...
if exist "dist" rd /s /q "dist"
mkdir dist
mkdir dist\package

echo Building React app...
cd frontend
call npm install
call npm run build
cd ..

echo Installing Fyne dependencies...
go get fyne.io/fyne/v2@latest
go get fyne.io/fyne/v2/app@latest
go get fyne.io/fyne/v2/container@latest
go get fyne.io/fyne/v2/data/binding@latest
go get fyne.io/fyne/v2/dialog@latest
go get fyne.io/fyne/v2/layout@latest
go get fyne.io/fyne/v2/theme@latest
go get fyne.io/fyne/v2/widget@latest
go get fyne.io/fyne/v2/storage@latest

echo Building Go executable with admin manifest...
go build -ldflags="-H windowsgui" -o dist\package\medical-records.exe

echo Creating run.bat file...
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
echo     pushd "%%CD%%"
echo     CD /D "%%~dp0"
echo.
echo :: Set up Ctrl+C handler and run the application
echo :LOOP
echo medical-records.exe
echo.
echo :: Check if the user pressed Ctrl+C or if the program exited
echo if errorlevel 1 ^(
echo     echo.
echo     echo Shutting down gracefully...
echo     timeout /t 2 /nobreak ^>nul
echo     taskkill /F /IM medical-records.exe 2^>nul
echo     exit /b
echo ^)
echo.
echo :: If the program crashed, ask to restart
echo echo.
echo set /p "RESTART=Program stopped. Would you like to restart? (Y/N) "
echo if /i "^!RESTART^!"=="Y" goto LOOP
) > dist\package\run.bat

echo Copying necessary files...
xcopy /E /I /Y frontend\build dist\package\frontend\build
if exist "pb_migrations" xcopy /E /I /Y pb_migrations dist\package\pb_migrations
if exist "pb_data" xcopy /E /I /Y pb_data dist\package\pb_data

echo Creating README file...
(
echo Medical Records System
echo =====================
echo.
echo Installation Instructions:
echo 1. Double-click medical-records.exe to start the application
echo 2. The application will request administrator privileges
echo 3. A dashboard window will appear with controls for the server
echo.
echo Dashboard Features:
echo - Start/Stop the server
echo - View logs
echo - See database statistics
echo - Backup the database
echo - Access the web interface
echo.
echo Access Information:
echo - Main Application: http://[YOUR-IP]:8090
echo - Admin Interface: http://[YOUR-IP]:8090/_/
echo.
echo To find your IP address:
echo 1. Open Command Prompt
echo 2. Type 'ipconfig' and press Enter
echo 3. Look for "IPv4 Address" under your active network adapter
echo 4. Use this IP address in place of [YOUR-IP] above
echo.
echo Default User Accounts:
echo - Admin Pocketbase Interface user: user@example.com
echo - Provider accounts: provider@example.com through provider6@example.com
echo - Pharmacy accounts: pharmacyuser@example.com through pharmacyuser4@example.com
echo - Admin frontend user: admin@example.com
echo - All accounts use password: password123
echo.
echo Admin Account Capabilities:
echo - The admin@example.com account has full access to all functionality
echo - Can access provider and pharmacy views
echo - Can view all reports and analytics
echo.
echo Settings and Reports:
echo - Settings: Manage the priority dropdown, care team dropdown, and imperial or metric units
echo - Reports: Access analytics including:
echo   * Patient visit statistics
echo   * Medication dispensing trends
echo   * Inventory usage and stock levels
) > dist\package\README.txt

echo Creating Windows installer...
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" "%SCRIPT_DIR%installer.iss"

echo Creating ZIP archive...
powershell -Command "& { Import-Module Microsoft.PowerShell.Archive -ErrorAction SilentlyContinue; if (Get-Command Compress-Archive -ErrorAction SilentlyContinue) { Compress-Archive -Path dist\package\* -DestinationPath dist\MedicalRecordsSystem.zip -Force } else { Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('dist\package', 'dist\MedicalRecordsSystem.zip') } }"

echo Build complete! 
echo.
echo The distributable ZIP file is available at: dist\MedicalRecordsSystem.zip
echo The Windows installer is available at: dist\MedicalRecordsSystem_Setup.exe
echo.
echo Users can now:
echo 1. Run the executable directly (it will request admin privileges)
echo 2. Use the installer for a complete installation
echo 3. Use the dashboard to control the application
