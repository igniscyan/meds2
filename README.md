# Offline Medical Records System

A standalone medical records system designed for use in remote locations without internet access.

## Features
- Single executable deployment
- Offline-first architecture
- Multi-user support via local network
- Patient management
- Encounter tracking
- Inventory management
- Medication disbursement tracking

## Technical Stack
- Frontend: React with Material-UI
- Backend: Go
- Database: PocketBase

## Getting Started
1. Download the latest release executable
2. Run the executable
3. Access the application at `http://localhost:8080` from the host machine
4. Other users on the network can access via the host machine's IP address

## Development Setup
1. Install Go 1.21+
2. Install Node.js 18+
3. Run `go mod download` to install Go dependencies
4. In the frontend directory, run `npm install` to install frontend dependencies
5. Run `go run main.go` to start the development server
