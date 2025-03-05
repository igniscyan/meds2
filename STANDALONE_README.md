# MEDS2 Standalone Executable

This guide explains how to build and use the standalone executable version of MEDS2, which runs without requiring installation or elevated privileges.

## Building the Standalone Executable

### On macOS/Linux:

1. Make the build script executable:
   ```
   chmod +x build_standalone.sh
   ```

2. Run the build script:
   ```
   ./build_standalone.sh
   ```

3. The script will:
   - Build the frontend
   - Create a temporary Go file that embeds the frontend
   - Compile the standalone executable
   - Clean up temporary files

4. When complete, you'll have a `meds2_standalone` executable in the current directory.

### On Windows:

1. Run the build script:
   ```
   build_standalone.bat
   ```

2. The script will:
   - Build the frontend
   - Create a temporary Go file that embeds the frontend
   - Compile the standalone executable
   - Clean up temporary files

3. When complete, you'll have a `meds2_standalone.exe` executable in the current directory.

## Using the Standalone Executable

1. Simply double-click the executable to run it.
2. The application will:
   - Create a `pb_data` folder in the same directory as the executable (if it doesn't exist)
   - Start the PocketBase server on port 8090
   - Automatically open your default web browser to http://127.0.0.1:8090

3. All data will be stored in the `pb_data` folder next to the executable.

## Features

- **No Installation Required**: Just run the executable
- **Self-Contained**: Frontend and backend in a single file
- **No Elevated Privileges**: Runs without admin rights
- **Portable**: Can be moved to any location or computer
- **Auto-Migration**: Database migrations run automatically
- **Browser Integration**: Opens your browser automatically

## Customization

If you need to customize the port or other settings, you can modify the build scripts before running them.

## Troubleshooting

- **Port Conflict**: If port 8090 is already in use, edit the build script to use a different port before building.
- **Database Issues**: If you encounter database problems, delete the `pb_data` folder and restart the application to create a fresh database.
- **Browser Not Opening**: If the browser doesn't open automatically, manually navigate to http://127.0.0.1:8090 in your web browser. 