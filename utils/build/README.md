# Build Scripts for Medical Records System

This directory contains scripts for building the Medical Records System application for different platforms.

## Quick Start

### Windows
1. Double-click `build.ps1` to start the build process with administrator privileges
2. The script will check for required dependencies and build the application
3. The built application will be available in the `dist` directory

### macOS
1. Open Terminal
2. Navigate to this directory
3. Run `./build_mac.sh`
4. The built application will be available in the `dist` directory

### Linux or Other
1. Open Terminal
2. Navigate to this directory
3. Run `./build.sh`
4. Choose which platform to build for
5. The built application will be available in the `dist` directory

## Build Outputs

### Windows
- `dist/MedicalRecordsSystem_Setup.exe` - Windows installer
- `dist/MedicalRecordsSystem.zip` - ZIP archive of the application

### macOS
- `dist/MedicalRecordsSystem.app` - macOS application bundle
- `dist/MedicalRecordsSystem.dmg` - macOS disk image

## Requirements

### Windows Build
- Windows 7 or later
- Go 1.16 or later
- Node.js 14 or later
- InnoSetup 6

### macOS Build
- macOS 10.13 or later
- Go 1.16 or later
- Node.js 14 or later
- create-dmg (installed automatically if missing)

## Notes
- The build process will compile the Go application and build the React frontend
- The application will be bundled with all necessary dependencies
- Users do not need to have Go or Node.js installed to run the built application 