@echo off
echo Building standalone MEDS2 executable...

REM Build the frontend
echo Building frontend...
cd frontend
call npm run build
cd ..

REM Create a temporary main.go file that embeds the frontend
echo Creating temporary main file...
(
echo package main
echo.
echo import (
echo 	"embed"
echo 	"fmt"
echo 	"io/fs"
echo 	"log"
echo 	"os"
echo 	"os/exec"
echo 	"path/filepath"
echo 	"runtime"
echo 	"time"
echo.
echo 	"github.com/labstack/echo/v5"
echo 	"github.com/pocketbase/pocketbase"
echo 	"github.com/pocketbase/pocketbase/apis"
echo 	"github.com/pocketbase/pocketbase/core"
echo 	"github.com/pocketbase/pocketbase/plugins/migratecmd"
echo ^)
echo.
echo //go:embed all:frontend/build
echo var frontendFiles embed.FS
echo.
echo func main(^) {
echo 	// Get executable directory for storing data
echo 	exePath, err := os.Executable(^)
echo 	if err != nil {
echo 		log.Fatal("Failed to get executable path:", err^)
echo 	}
echo.	
echo 	// Use the same directory as the executable for data storage
echo 	dataDir := filepath.Join(filepath.Dir(exePath^), "pb_data"^)
echo.	
echo 	// Ensure data directory exists
echo 	if err := os.MkdirAll(dataDir, 0755^); err != nil {
echo 		log.Fatal("Failed to create data directory:", err^)
echo 	}
echo.
echo 	// Create PocketBase app with custom data directory
echo 	app := pocketbase.New(^)
echo.	
echo 	// Set data directory
echo 	app.RootCmd.PersistentFlags(^).Set("dir", dataDir^)
echo.	
echo 	// Use a non-privileged port (above 1024^)
echo 	app.RootCmd.PersistentFlags(^).Set("http", "127.0.0.1:8090"^)
echo.
echo 	// Register auto migrations
echo 	migratecmd.MustRegister(app, app.RootCmd^)
echo.
echo 	// Add a hook to serve the frontend assets
echo 	app.OnBeforeServe(^).Add(func(e *core.ServeEvent^) error {
echo 		// Get the embedded frontend
echo 		frontendFS, err := fs.Sub(frontendFiles, "frontend/build"^)
echo 		if err != nil {
echo 			return err
echo 		}
echo.
echo 		// Serve static files for all routes not handled by the API
echo 		e.Router.GET("/*", apis.StaticDirectoryHandler(frontendFS, false^)^)
echo.		
echo 		return nil
echo 	}^)
echo.
echo 	// Open browser on startup
echo 	app.OnBeforeServe(^).Add(func(e *core.ServeEvent^) error {
echo 		// Open browser after a short delay to ensure server is ready
echo 		go func(^) {
echo 			time.Sleep(500 * time.Millisecond^)
echo 			url := "http://127.0.0.1:8090"
echo 			log.Printf("Opening %%s in the default browser...\n", url^)
echo 			openBrowser(url^)
echo 		}(^)
echo 		return nil
echo 	}^)
echo.
echo 	// Start the app
echo 	if err := app.Start(^); err != nil {
echo 		log.Fatal(err^)
echo 	}
echo }
echo.
echo // openBrowser opens the specified URL in the default browser
echo func openBrowser(url string^) {
echo 	var err error
echo.
echo 	switch runtime.GOOS {
echo 	case "linux":
echo 		err = exec.Command("xdg-open", url^).Start(^)
echo 	case "windows":
echo 		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url^).Start(^)
echo 	case "darwin":
echo 		err = exec.Command("open", url^).Start(^)
echo 	default:
echo 		err = fmt.Errorf("unsupported platform"^)
echo 	}
echo.
echo 	if err != nil {
echo 		log.Printf("Error opening browser: %%v\n", err^)
echo 	}
echo }
) > temp_main.go

REM Build the standalone executable
echo Building Go executable...
go build -o meds2_standalone.exe temp_main.go

REM Clean up
echo Cleaning up...
del temp_main.go

echo Build complete! Standalone executable is: meds2_standalone.exe
echo You can run it directly without any installation steps. 