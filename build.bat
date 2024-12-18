@echo off
setlocal

echo Cleaning up previous build...
if exist "dist" rd /s /q "dist"
mkdir dist
mkdir dist\package

echo Building React app...
cd frontend
call npm install
call npm run build
cd ..

echo Building Go executable...
go build -o dist\package\medical-records.exe

echo Creating run.bat file...
(
echo @echo off
echo cd /d "%%~dp0"
echo cmd /k medical-records.exe
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
echo 1. Double-click install.bat to start the installation
echo 2. Follow the prompts to complete the installation
echo 3. The application will be installed to Program Files
echo 4. Shortcuts will be created on desktop and start menu
echo.
echo To uninstall:
echo 1. Run uninstall.bat from the installation directory
echo   or
echo 2. Delete the application folder and shortcuts manually
) > dist\package\README.txt

echo Copying installer...
copy install.bat dist\package\

echo Creating ZIP archive...
powershell Compress-Archive -Path dist\package\* -DestinationPath dist\MedicalRecordsSystem.zip -Force

echo Build complete! 
echo.
echo The distributable ZIP file is available at: dist\MedicalRecordsSystem.zip
echo Users just need to:
echo 1. Download and extract the ZIP file
echo 2. Double-click install.bat
echo 3. Follow the prompts
