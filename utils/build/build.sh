#!/bin/bash

# Unified build script for Medical Records System
# This script detects the OS and runs the appropriate build process

# Exit on error
set -e

# Determine the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Change to project root
cd "$PROJECT_ROOT"

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "Detected macOS - Building for Mac..."
    bash "$SCRIPT_DIR/build_mac.sh"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
    # Windows
    echo "Detected Windows - Building for Windows..."
    cmd.exe /c "$SCRIPT_DIR\\build.bat"
else
    # Linux or other - ask user
    echo "Detected Linux or other OS."
    echo "Which platform would you like to build for?"
    echo "1) Windows"
    echo "2) macOS"
    echo "3) Both"
    read -p "Enter your choice (1-3): " choice
    
    case $choice in
        1)
            echo "Building for Windows..."
            # Check if wine is installed
            if command -v wine &> /dev/null; then
                echo "Using Wine to run Windows build script..."
                wine cmd.exe /c "$SCRIPT_DIR\\build.bat"
            else
                echo "Error: Wine is not installed. Cannot build for Windows on this platform."
                echo "Please install Wine or use a Windows machine to build for Windows."
                exit 1
            fi
            ;;
        2)
            echo "Building for macOS..."
            # Check if this is actually a Mac
            if [[ "$OSTYPE" == "darwin"* ]]; then
                bash "$SCRIPT_DIR/build_mac.sh"
            else
                echo "Error: Cannot build for macOS on this platform."
                echo "Please use a Mac to build for macOS."
                exit 1
            fi
            ;;
        3)
            echo "Building for both Windows and macOS..."
            # Check if wine is installed
            if command -v wine &> /dev/null; then
                echo "Using Wine to run Windows build script..."
                wine cmd.exe /c "$SCRIPT_DIR\\build.bat"
            else
                echo "Error: Wine is not installed. Cannot build for Windows on this platform."
                echo "Please install Wine or use a Windows machine to build for Windows."
                exit 1
            fi
            
            # Check if this is actually a Mac
            if [[ "$OSTYPE" == "darwin"* ]]; then
                bash "$SCRIPT_DIR/build_mac.sh"
            else
                echo "Error: Cannot build for macOS on this platform."
                echo "Please use a Mac to build for macOS."
                exit 1
            fi
            ;;
        *)
            echo "Invalid choice. Exiting."
            exit 1
            ;;
    esac
fi

echo "Build process completed!"
echo "Check the dist directory for the built packages." 