package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()
	_ = app.loadSettings()

	w := app.settings.WindowWidth
	h := app.settings.WindowHeight
	if w < 500 {
		w = 890
	}
	if h < 400 {
		h = 800
	}

	// Create application with options
	err := wails.Run(&options.App{
		Title:     "calendar widget",
		Width:     w,
		Height:    h,
		MinWidth:  500,
		MinHeight: 400,
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
