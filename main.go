package main

import (
	"fmt"
	"log"
	"net"
	"os"
	"path/filepath"
	"strings"

	_ "medical-records/migrations"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
)

func main() {
	// Print startup information immediately
	fmt.Println("\n=== MEDS System Information ===")
	fmt.Println("Default credentials for PocketBase - username: user@example.com, password: password123")
	fmt.Println("Default credentials for MEDS Provider users - provider@example.com through provider6@example.com, password: password123")
	fmt.Println("Default credentials for MEDS Pharmacy users - pharmacyuser@example.com through pharmacyuser4@example.com, password: password123")
	fmt.Println("Admin UI: http://127.0.0.1:8090/_/")
	fmt.Println("Main application: http://127.0.0.1:8090")

	// Log all available network interfaces
	interfaces, err := net.Interfaces()
	if err != nil {
		fmt.Printf("Warning: Could not get network interfaces: %v\n", err)
	} else {
		fmt.Println("\nAvailable network addresses:")
		for _, iface := range interfaces {
			addrs, err := iface.Addrs()
			if err != nil {
				continue
			}
			for _, addr := range addrs {
				if ipnet, ok := addr.(*net.IPNet); ok {
					if ipnet.IP.To4() != nil && !ipnet.IP.IsLoopback() {
						fmt.Printf("- http://%s:8090/ (%s)\n", ipnet.IP.String(), iface.Name)
					}
				}
			}
		}
	}

	fmt.Println("\nTo kill the server gracefully, press Ctrl+C")
	fmt.Println("Data will persist in the ./pb_data directory")
	fmt.Println("===============================")

	app := pocketbase.New()

	// Check if running with "go run"
	isGoRun := strings.HasPrefix(os.Args[0], os.TempDir())

	// Register the migration command
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		// Enable auto-migration file creation during development
		Automigrate: isGoRun,
	})

	// Set serve as the default command when no command is specified
	if len(os.Args) == 1 {
		os.Args = append(os.Args, "serve", "--http=0.0.0.0:8090")
	}

	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		// Get the executable's directory
		exePath, err := os.Executable()
		if err != nil {
			log.Printf("Warning: Could not determine executable path: %v", err)
			exePath = "."
		}
		exeDir := filepath.Dir(exePath)

		// Determine the frontend build directory
		frontendDir := filepath.Join(exeDir, "frontend", "build")
		if !fileExists(frontendDir) {
			// Fallback to local directory during development
			frontendDir = "frontend/build"
		}

		// Serve static files from the frontend build directory
		e.Router.GET("/*", apis.StaticDirectoryHandler(os.DirFS(frontendDir), true))

		return nil
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
