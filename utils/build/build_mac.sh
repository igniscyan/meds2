#!/bin/bash

# Exit on error
set -e

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Change to project root
cd "$PROJECT_ROOT"

echo "Cleaning up previous build..."
rm -rf dist
mkdir -p dist/package

echo "Building React app..."
cd frontend
npm install
npm run build
cd ..

echo "Installing Fyne dependencies..."
go get fyne.io/fyne/v2@latest
go get fyne.io/fyne/v2/app@latest
go get fyne.io/fyne/v2/container@latest
go get fyne.io/fyne/v2/data/binding@latest
go get fyne.io/fyne/v2/dialog@latest
go get fyne.io/fyne/v2/layout@latest
go get fyne.io/fyne/v2/theme@latest
go get fyne.io/fyne/v2/widget@latest
go get fyne.io/fyne/v2/storage@latest

echo "Building Go executable..."
go build -o dist/package/medical-records

echo "Creating Mac .app bundle..."
mkdir -p dist/MedicalRecordsSystem.app/Contents/{MacOS,Resources}

# Copy executable
cp dist/package/medical-records dist/MedicalRecordsSystem.app/Contents/MacOS/

# Create Info.plist
cat > dist/MedicalRecordsSystem.app/Contents/Info.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>medical-records</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>com.example.medicalrecords</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>Medical Records System</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

# Copy resources
mkdir -p dist/MedicalRecordsSystem.app/Contents/Resources/frontend
cp -r frontend/build dist/MedicalRecordsSystem.app/Contents/Resources/frontend/

if [ -d "pb_migrations" ]; then
    mkdir -p dist/MedicalRecordsSystem.app/Contents/Resources/pb_migrations
    cp -r pb_migrations dist/MedicalRecordsSystem.app/Contents/Resources/
fi

# Create README
cat > dist/package/README.txt << EOF
Medical Records System
=====================

Installation Instructions:
1. Drag the Medical Records System app to your Applications folder
2. Double-click to start the application
3. A dashboard window will appear with controls for the server

Dashboard Features:
- Start/Stop the server
- View logs
- See database statistics
- Backup the database
- Access the web interface

Access Information:
- Main Application: http://[YOUR-IP]:8090
- Admin Interface: http://[YOUR-IP]:8090/_/

To find your IP address:
1. Open Terminal
2. Type 'ifconfig' and press Enter
3. Look for "inet" under your active network adapter (en0 for WiFi)
4. Use this IP address in place of [YOUR-IP] above

Default User Accounts:
- Admin Pocketbase Interface user: user@example.com
- Provider accounts: provider@example.com through provider6@example.com
- Pharmacy accounts: pharmacyuser@example.com through pharmacyuser4@example.com
- Admin frontend user: admin@example.com
- All accounts use password: password123

Admin Account Capabilities:
- The admin@example.com account has full access to all functionality
- Can access provider and pharmacy views
- Can view all reports and analytics

Settings and Reports:
- Settings: Manage the priority dropdown, care team dropdown, and imperial or metric units
- Reports: Access analytics including:
  * Patient visit statistics
  * Medication dispensing trends
  * Inventory usage and stock levels
EOF

# Copy README to app bundle
cp dist/package/README.txt dist/MedicalRecordsSystem.app/Contents/Resources/

echo "Creating DMG..."
# Check if create-dmg is installed
if ! command -v create-dmg &> /dev/null; then
    echo "create-dmg not found. Installing..."
    brew install create-dmg
fi

create-dmg \
  --volname "Medical Records System" \
  --volicon "dist/MedicalRecordsSystem.app/Contents/Resources/AppIcon.icns" \
  --window-pos 200 120 \
  --window-size 800 400 \
  --icon-size 100 \
  --icon "MedicalRecordsSystem.app" 200 190 \
  --hide-extension "MedicalRecordsSystem.app" \
  --app-drop-link 600 185 \
  "dist/MedicalRecordsSystem.dmg" \
  "dist/MedicalRecordsSystem.app"

echo "Build complete!"
echo ""
echo "The Mac .app bundle is available at: dist/MedicalRecordsSystem.app"
echo "The Mac DMG installer is available at: dist/MedicalRecordsSystem.dmg"
echo ""
echo "Users can now:"
echo "1. Mount the DMG and drag the app to Applications"
echo "2. Run the app to start the dashboard" 