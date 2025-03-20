# Medical Records System

A cross-platform medical records management system built with Go and React.

## Features

- Patient management
- Encounter tracking
- Medication dispensing
- Role-based access control
- Cross-platform support (Windows, macOS, Linux)
- User-friendly dashboard interface

## Quick Start for Users

### Windows
1. Download the latest Windows installer from the releases page
2. Run the installer and follow the prompts
3. Launch the application from the Start menu or desktop shortcut

### macOS
1. Download the latest macOS DMG from the releases page
2. Mount the DMG and drag the application to your Applications folder
3. Launch the application from your Applications folder

## For Developers

### Prerequisites
- Go 1.16 or later
- Node.js 14 or later
- npm 6 or later

### Building from Source

#### Using the Build Scripts
The easiest way to build the application is to use the provided build scripts:

1. Navigate to the `utils/build` directory
2. Run the appropriate build script for your platform:
   - Windows: Double-click `build.ps1`
   - macOS: Run `./build_mac.sh`
   - Linux: Run `./build.sh`

#### Manual Build

1. Build the React frontend:
   ```
   cd frontend
   npm install
   npm run build
   cd ..
   ```

2. Build the Go application:
   ```
   go build -o medical-records
   ```

3. Run the application:
   ```
   ./medical-records
   ```

## Development

### Project Structure
- `frontend/` - React frontend application
- `migrations/` - Database migrations
- `utils/build/` - Build scripts for different platforms
- `main.go` - Main Go application

### Running in Development Mode
1. Start the Go server:
   ```
   go run main.go
   ```

2. In a separate terminal, start the React development server:
   ```
   cd frontend
   npm start
   ```

## License
This project is licensed under the MIT License - see the LICENSE file for details.
