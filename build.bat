@echo off
echo Building React app...
cd frontend
call npm run build
cd ..

echo Building Go executable...
go build -o medical-records.exe

echo Build complete! You can now run medical-records.exe
