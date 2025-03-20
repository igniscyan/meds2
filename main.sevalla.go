package main

import (
	"log"
	"os"
	"path/filepath"

	_ "medical-records/migrations"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
)

func main() {
	app := pocketbase.New()

	// Register migrations
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: false,
	})

	// Serve static files from the React build
	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		// Get the directory where the binary is located
		exePath, err := os.Executable()
		if err != nil {
			log.Printf("Warning: Could not determine executable path: %v", err)
			exePath = "."
		}
		exeDir := filepath.Dir(exePath)

		// Serve the React app from the build directory
		buildDir := filepath.Join(exeDir, "frontend", "build")
		if !fileExists(buildDir) {
			buildDir = "./frontend/build" // fallback for development
		}

		// Serve static files
		e.Router.GET("/*", apis.StaticDirectoryHandler(os.DirFS(buildDir), false))
		return nil
	})

	// Start the server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8090"
	}

	log.Printf("Starting server on port %s...\n", port)
	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
} 