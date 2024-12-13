package main

import (
	"log"
	"os"
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

	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		// serve static files from the frontend/build directory
		e.Router.GET("/*", apis.StaticDirectoryHandler(os.DirFS("frontend/build"), false))

		log.Printf("Server started successfully. Admin UI will be available at http://127.0.0.1:8090/_/")
		return nil
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
