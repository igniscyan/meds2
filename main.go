package main

import (
	"log"
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

		log.Printf("Server started successfully!")
		log.Printf("Admin UI available at: http://127.0.0.1:8090/_/")
		log.Printf("Main application available at: http://127.0.0.1:8090")
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
