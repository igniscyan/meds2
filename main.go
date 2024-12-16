package main

import (
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
	// Configure standard logger to match PocketBase's simple format
	log.SetFlags(log.LstdFlags)

	// Disable PocketBase's default logger for cleaner output
	os.Setenv("PB_LOG_LEVEL", "info")

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
		os.Args = append(os.Args, "serve")
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

		// Log all available network interfaces
		interfaces, err := net.Interfaces()
		if err != nil {
			log.Printf("Warning: Could not get network interfaces: %v", err)
		} else {
			log.Printf("\nAvailable network addresses:")
			for _, iface := range interfaces {
				addrs, err := iface.Addrs()
				if err != nil {
					continue
				}
				for _, addr := range addrs {
					if ipnet, ok := addr.(*net.IPNet); ok {
						if ipnet.IP.To4() != nil && !ipnet.IP.IsLoopback() {
							log.Printf("- http://%s:8090/ (%s)", ipnet.IP.String(), iface.Name)
						}
					}
				}
			}
		}

		log.Printf("\n=== MEDS System Information ===")
		log.Printf("Default credentials - username: user@example.com, password: password123")
		log.Printf("Admin UI: http://127.0.0.1:8090/_/")
		log.Printf("Main application: http://127.0.0.1:8090")
		log.Printf("To kill the server gracefully, press Ctrl+C")
		log.Printf("Data will persist in the ./pb_data directory")
		log.Printf("===============================\n")

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
