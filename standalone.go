package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	// Import your migrations - adjust the path as needed
	_ "github.com/pocketbase/pocketbase/migrations"
)

//go:embed all:frontend/build
var frontendFiles embed.FS

func main() {
	// Get executable directory for storing data
	exePath, err := os.Executable()
	if err != nil {
		log.Fatal("Failed to get executable path:", err)
	}

	// Use the same directory as the executable for data storage
	dataDir := filepath.Join(filepath.Dir(exePath), "pb_data")

	// Ensure data directory exists
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		log.Fatal("Failed to create data directory:", err)
	}

	// Create PocketBase app with custom data directory
	app := pocketbase.New()

	// Set data directory
	app.RootCmd.PersistentFlags().Set("dir", dataDir)

	// Use a non-privileged port (above 1024)
	app.RootCmd.PersistentFlags().Set("http", "127.0.0.1:8090")

	// Register the migrate command
	migratecmd.MustRegister(app, app.RootCmd, &migratecmd.Options{
		Automigrate: true, // Auto-run migrations on startup
	})

	// Add a hook to serve the frontend assets
	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		// Get the embedded frontend
		frontendFS, err := fs.Sub(frontendFiles, "frontend/build")
		if err != nil {
			return err
		}

		// Serve API under /api prefix
		e.Router.GET("/api/*", func(c echo.Context) error {
			// This will be handled by PocketBase's API handlers
			return nil
		})

		// Serve static files for all other routes
		e.Router.GET("/*", apis.StaticDirectoryHandler(frontendFS, false))

		return nil
	})

	// Open browser on startup
	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		// Open browser after a short delay to ensure server is ready
		go func() {
			time.Sleep(500 * time.Millisecond)
			url := "http://127.0.0.1:8090"
			log.Printf("Opening %s in the default browser...\n", url)
			openBrowser(url)
		}()
		return nil
	})

	// Start the app
	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

// openBrowser opens the specified URL in the default browser
func openBrowser(url string) {
	var err error

	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	default:
		err = fmt.Errorf("unsupported platform")
	}

	if err != nil {
		log.Printf("Error opening browser: %v\n", err)
	}
}
