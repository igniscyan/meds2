# PowerShell script to build Medical Records System for Windows
# This script can be double-clicked to start the build process

# Get the script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Get-Item $ScriptDir).Parent.Parent.FullName

# Change to project root
Set-Location $ProjectRoot

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "This script requires administrator privileges to build the application."
    Write-Host "Restarting with administrator privileges..."
    
    # Restart the script with administrator privileges
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`"" -Verb RunAs
    exit
}

# Check if InnoSetup is installed
$innoSetupPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $innoSetupPath)) {
    Write-Host "InnoSetup is not installed or not found at the expected location."
    Write-Host "Please install InnoSetup 6 from https://jrsoftware.org/isdl.php"
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit
}

# Check if Go is installed
try {
    $goVersion = & go version
    Write-Host "Found Go: $goVersion"
} catch {
    Write-Host "Go is not installed or not in the PATH."
    Write-Host "Please install Go from https://golang.org/dl/"
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit
}

# Check if Node.js is installed
try {
    $nodeVersion = & node --version
    $npmVersion = & npm --version
    Write-Host "Found Node.js: $nodeVersion"
    Write-Host "Found npm: $npmVersion"
} catch {
    Write-Host "Node.js is not installed or not in the PATH."
    Write-Host "Please install Node.js from https://nodejs.org/"
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit
}

# Run the build script
Write-Host "Starting build process..."
& "$ScriptDir\build.bat"

Write-Host "Build process completed!"
Write-Host "Check the dist directory for the built packages."
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 