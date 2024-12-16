@echo off
setlocal

echo Cleaning up previous build...
if exist "dist" rd /s /q "dist"
mkdir dist

echo Building React app...
cd frontend
call npm install
call npm run build
cd ..

echo Building Go executable...
go build -o dist\medical-records.exe

echo Copying necessary files...
xcopy /E /I /Y frontend\build dist\frontend\build
if exist "pb_migrations" xcopy /E /I /Y pb_migrations dist\pb_migrations
if exist "pb_data" xcopy /E /I /Y pb_data dist\pb_data

echo Creating README file...
(
echo Medical Records System
echo =====================
echo.
echo To start the application:
echo 1. Double-click medical-records.exe
echo 2. Open http://127.0.0.1:8090 in your web browser
echo.
echo The admin interface is available at http://127.0.0.1:8090/_/
) > dist\README.txt

echo Build complete! Your application is ready in the 'dist' folder.
echo You can now run dist\medical-records.exe
