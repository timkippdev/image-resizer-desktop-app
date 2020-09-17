package main

import (
	"image-resizer/backend"

	"github.com/leaanthony/mewn"
	"github.com/wailsapp/wails"
)

func main() {

	js := mewn.String("./frontend/build/static/js/main.js")
	css := mewn.String("./frontend/build/static/css/main.css")

	resizer := backend.NewResizer()

	app := wails.CreateApp(&wails.AppConfig{
		Height: 620,
		Title:  "Image Resizer",
		JS:     js,
		CSS:    css,
		Colour: "#A9B7B4",
	})

	app.Bind(resizer)

	app.Run()
}
