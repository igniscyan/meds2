package main

import (
	"archive/zip"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	_ "medical-records/migrations"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/data/binding"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/layout"
	"fyne.io/fyne/v2/storage"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
)

var (
	pbApp          *pocketbase.PocketBase
	serverStatus   = binding.NewString()
	logText        = binding.NewString()
	patientCount   = binding.NewString()
	encounterCount = binding.NewString()
	serverRunning  = false
	serverMutex    sync.Mutex
)

// Custom log writer to capture logs for the GUI
type logWriter struct{}

func (w logWriter) Write(p []byte) (n int, err error) {
	currentLog, _ := logText.Get()
	newLog := currentLog + string(p)

	// Keep only the last 1000 lines to prevent memory issues
	lines := strings.Split(newLog, "\n")
	if len(lines) > 1000 {
		lines = lines[len(lines)-1000:]
		newLog = strings.Join(lines, "\n")
	}

	logText.Set(newLog)
	return len(p), nil
}

func main() {
	// Set up custom logger
	log.SetOutput(logWriter{})

	// Initialize status
	serverStatus.Set("Stopped")
	patientCount.Set("0")
	encounterCount.Set("0")

	// Create Fyne app
	a := app.New()
	w := a.NewWindow("Medical Records System")
	w.Resize(fyne.NewSize(800, 600))

	// Create tabs
	tabs := container.NewAppTabs(
		container.NewTabItem("Dashboard", createDashboardTab()),
		container.NewTabItem("Logs", createLogsTab()),
		container.NewTabItem("Settings", createSettingsTab()),
	)

	// Set the content of the window
	w.SetContent(tabs)

	// Start the server in a goroutine
	go func() {
		// Print startup information immediately
		fmt.Println("\n=== MEDS System Information ===")
		fmt.Println("Default credentials for PocketBase - username: user@example.com, password: password123")
		fmt.Println("Default credentials for MEDS Provider users - provider@example.com through provider6@example.com, password: password123")
		fmt.Println("Default credentials for MEDS Pharmacy users - pharmacyuser@example.com through pharmacyuser4@example.com, password: password123")
		fmt.Println("Default credentials for MEDS Admin users - admin@example.com, password: password123")
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
	}()

	// Show the window and run the app
	w.ShowAndRun()
}

func createDashboardTab() fyne.CanvasObject {
	// Status section
	statusLabel := widget.NewLabelWithData(serverStatus)
	startButton := widget.NewButton("Start Server", func() {
		startServer()
	})
	stopButton := widget.NewButton("Stop Server", func() {
		stopServer()
	})

	// Stats section
	patientsLabel := widget.NewLabel("Total Patients:")
	patientsValue := widget.NewLabelWithData(patientCount)
	encountersLabel := widget.NewLabel("Total Encounters:")
	encountersValue := widget.NewLabelWithData(encounterCount)

	// Backup section
	backupButton := widget.NewButton("Backup Database", func() {
		backupDatabase()
	})

	// Layout
	statusBox := container.NewHBox(
		widget.NewLabel("Server Status:"),
		statusLabel,
		layout.NewSpacer(),
		startButton,
		stopButton,
	)

	statsBox := container.NewVBox(
		widget.NewLabel("Database Statistics"),
		container.NewGridWithColumns(2,
			patientsLabel, patientsValue,
			encountersLabel, encountersValue,
		),
	)

	actionsBox := container.NewVBox(
		widget.NewLabel("Actions"),
		backupButton,
	)

	return container.NewVBox(
		statusBox,
		widget.NewSeparator(),
		statsBox,
		widget.NewSeparator(),
		actionsBox,
		layout.NewSpacer(),
	)
}

func createLogsTab() fyne.CanvasObject {
	logEntry := widget.NewMultiLineEntry()
	logEntry.Wrapping = fyne.TextWrapWord
	logEntry.Bind(logText)
	logEntry.Disable() // Make it read-only

	clearButton := widget.NewButtonWithIcon("Clear Logs", theme.ContentClearIcon(), func() {
		logText.Set("")
	})

	return container.NewBorder(nil, container.NewHBox(layout.NewSpacer(), clearButton), nil, nil, container.NewScroll(logEntry))
}

func createSettingsTab() fyne.CanvasObject {
	// User management section (stretch goal)
	userManagementButton := widget.NewButton("Manage Users (Coming Soon)", func() {
		dialog.ShowInformation("Coming Soon", "User management functionality will be available in a future update.", nil)
	})

	// Open admin UI
	adminUIButton := widget.NewButton("Open Admin UI", func() {
		openBrowser("http://localhost:8090/_/")
	})

	// Open main app
	mainAppButton := widget.NewButton("Open Main Application", func() {
		openBrowser("http://localhost:8090")
	})

	return container.NewVBox(
		widget.NewLabel("Application Settings"),
		widget.NewSeparator(),
		adminUIButton,
		mainAppButton,
		widget.NewSeparator(),
		widget.NewLabel("User Management"),
		userManagementButton,
		layout.NewSpacer(),
	)
}

func startServer() {
	serverMutex.Lock()
	defer serverMutex.Unlock()

	if serverRunning {
		return
	}

	serverRunning = true
	serverStatus.Set("Starting...")

	go func() {
		pbApp = pocketbase.New()

		// Register the migration command
		migratecmd.MustRegister(pbApp, pbApp.RootCmd, migratecmd.Config{
			// Enable auto-migration file creation during development
			Automigrate: false,
		})

		pbApp.OnBeforeServe().Add(func(e *core.ServeEvent) error {
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
				if !fileExists(frontendDir) {
					// Try other common locations
					possibleLocations := []string{
						"../frontend/build",
						"./frontend/build",
						"./build",
						"../build",
					}

					for _, loc := range possibleLocations {
						if fileExists(loc) {
							frontendDir = loc
							break
						}
					}
				}
			}

			log.Printf("Serving frontend from: %s", frontendDir)

			// Serve static files from the frontend build directory
			e.Router.GET("/*", apis.StaticDirectoryHandler(os.DirFS(frontendDir), true))

			serverStatus.Set("Running")

			// Start a goroutine to update stats periodically
			go updateStats()

			return nil
		})

		// Set up the server
		pbApp.RootCmd.SetArgs([]string{"serve", "--http=0.0.0.0:8090"})

		// Start the server
		if err := pbApp.Start(); err != nil {
			log.Printf("Server error: %v", err)
			serverStatus.Set("Error")
			serverRunning = false
		}
	}()
}

func stopServer() {
	serverMutex.Lock()
	defer serverMutex.Unlock()

	if !serverRunning || pbApp == nil {
		return
	}

	serverStatus.Set("Stopping...")

	// Trigger PocketBase termination hooks to shut down the HTTP server.
	err := pbApp.OnTerminate().Trigger(&core.TerminateEvent{
		App: pbApp,
	}, func(e *core.TerminateEvent) error {
		return e.App.ResetBootstrapState()
	})
	if err != nil {
		log.Printf("Server stop error: %v", err)
		serverStatus.Set("Error")
		return
	}

	serverRunning = false
	pbApp = nil
	serverStatus.Set("Stopped")
}

func updateStats() {
	for serverRunning {
		if pbApp != nil && pbApp.Dao() != nil {
			// Get patient count
			patients, err := pbApp.Dao().FindRecordsByExpr("patients")
			if err == nil {
				patientCount.Set(fmt.Sprintf("%d", len(patients)))
			}

			// Get encounter count
			encounters, err := pbApp.Dao().FindRecordsByExpr("encounters")
			if err == nil {
				encounterCount.Set(fmt.Sprintf("%d", len(encounters)))
			}
		}

		// Update every 5 seconds
		time.Sleep(5 * time.Second)
	}
}

func backupDatabase() {
	if !serverRunning {
		dialog.ShowInformation("Error", "Server must be running to backup the database.", nil)
		return
	}

	// Use a file save dialog instead of a progress dialog
	saveDialog := dialog.NewFileSave(func(writer fyne.URIWriteCloser, err error) {
		if err != nil {
			dialog.ShowError(err, nil)
			return
		}
		if writer == nil {
			// User cancelled
			return
		}
		defer writer.Close()

		// Perform backup in a goroutine
		go func() {
			err := zipDir("pb_data", writer)
			if err != nil {
				dialog.ShowError(fmt.Errorf("Backup failed: %v", err), nil)
			} else {
				dialog.ShowInformation("Backup Complete", "Database backup ZIP created successfully.", nil)
			}
		}()
	}, nil)

	// Set filter for zip files
	saveDialog.SetFilter(storage.NewExtensionFileFilter([]string{".zip"}))
	saveDialog.SetFileName("medical_records_backup.zip")
	saveDialog.Show()
}

// zipDir writes all files under srcDir to the provided writer as a zip archive.
func zipDir(srcDir string, out io.Writer) error {
	zipWriter := zip.NewWriter(out)
	defer zipWriter.Close()

	return filepath.WalkDir(srcDir, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			return nil
		}

		relPath, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}

		zipPath := filepath.ToSlash(relPath)
		fileWriter, err := zipWriter.Create(zipPath)
		if err != nil {
			return err
		}

		file, err := os.Open(path)
		if err != nil {
			return err
		}

		_, err = io.Copy(fileWriter, file)
		closeErr := file.Close()
		if err != nil {
			return err
		}
		return closeErr
	})
}

func openBrowser(url string) {
	var err error

	switch runtime.GOOS {
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	default: // "linux", "freebsd", etc.
		err = exec.Command("xdg-open", url).Start()
	}

	if err != nil {
		dialog.ShowError(fmt.Errorf("Failed to open browser: %v", err), nil)
	}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
