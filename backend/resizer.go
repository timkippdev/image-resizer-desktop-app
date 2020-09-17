package backend

import (
	"crypto/sha256"
	"encoding/hex"
	"io/ioutil"
	"os"
	"path/filepath"

	"github.com/disintegration/imaging"
	"github.com/gabriel-vasile/mimetype"
	"github.com/wailsapp/wails"
)

const (
	DirectoryChangedEventName    string = "DirectoryChanged"
	GenericErrorEventName        string = "GenericError"
	ImageResizeStartedEventName  string = "ImageResizeStarted"
	ImageResizeSuccessEventName  string = "ImageResizeSuccess"
	ImageResizeFailedEventName   string = "ImageResizeFailed"
	ResizeBatchStartedEventName  string = "ResizeBatchStarted"
	ResizeBatchFinishedEventName string = "ResizeBatchFinished"
)

var allowedExtensions = []string{
	"image/gif",
	"image/.jpg",
	"image/jpg",
	"image/jpeg",
	"image/png",
}

type directoryChangedEvent struct {
	Path  string      `json:"path"`
	Files []*fileData `json:"files"`
}

type errorEvent struct {
	Message string `json:"message"`
}

type fileData struct {
	Path string `json:"path"`
	Hash string `json:"hash"`
}

type Resizer struct {
	Runtime *wails.Runtime
}

// NewResizer returns an instance of the Resizer
func NewResizer() *Resizer {
	return &Resizer{}
}

// WailsInit sets the Wails runtime
func (r *Resizer) WailsInit(runtime *wails.Runtime) error {
	r.Runtime = runtime
	return nil
}

// ChooseDirectory opens up a directory dialog and fires an event containing the allowed files from the chosen directory
func (r *Resizer) ChooseDirectory() error {
	directory := r.Runtime.Dialog.SelectDirectory()
	if directory == "" {
		return nil
	}

	files, err := r.filterOnlyAllowedFileExtensions(directory)
	if err != nil {
		r.fireEvent(GenericErrorEventName, &errorEvent{
			Message: err.Error(),
		})
		return err
	}

	fileDataList := make([]*fileData, 0)

	for _, file := range files {
		fullFilePath := filepath.Join(directory, file.Name())

		if file.IsDir() {
			continue
		}

		fileHash := generateFileHash(fullFilePath)

		fileDataList = append(fileDataList, &fileData{
			Hash: fileHash,
			Path: fullFilePath,
		})
	}

	r.fireEvent(DirectoryChangedEventName, &directoryChangedEvent{
		Path:  directory,
		Files: fileDataList,
	})

	return nil
}

// ResizeImages resizes all allowed image extensions within a given directory
func (r *Resizer) ResizeImages(inputDir, outputDir string, maxWidth, maxHeight int) error {
	r.fireEvent(ResizeBatchStartedEventName, nil)

	if _, err := os.Stat(outputDir); os.IsNotExist(err) {
		os.Mkdir(outputDir, os.ModePerm)
	}

	files, err := r.filterOnlyAllowedFileExtensions(inputDir)
	if err != nil {
		return err
	}

	// TODO: convert to use wait group or channels to process all files
	// loop through files and perform resize

	for _, file := range files {
		fullFilePath := filepath.Join(inputDir, file.Name())

		if file.IsDir() {
			// r.ResizeImages(fullFilePath, outputDir, maxWidth, maxHeight)
			continue
		}

		fileHash := generateFileHash(fullFilePath)

		r.fireEvent(ImageResizeStartedEventName, fileHash)
		err := resizeImage(file, inputDir, outputDir, maxWidth, maxHeight)
		if err != nil {
			r.fireEvent(ImageResizeFailedEventName, fileHash)
			continue
		}
		r.fireEvent(ImageResizeSuccessEventName, fileHash)
	}

	r.fireEvent(ResizeBatchFinishedEventName, nil)

	return nil
}

func (r *Resizer) filterOnlyAllowedFileExtensions(dir string) ([]os.FileInfo, error) {
	filteredFiles := make([]os.FileInfo, 0)

	files, err := ioutil.ReadDir(dir)
	if err != nil {
		return filteredFiles, err
	}

	for _, file := range files {
		if !file.IsDir() {
			path := filepath.Join(dir, file.Name())
			mime, _ := mimetype.DetectFile(path)
			if mimetype.EqualsAny(mime.String(), allowedExtensions...) {
				filteredFiles = append(filteredFiles, file)
			}
		}
	}

	return filteredFiles, err
}

func (r *Resizer) fireEvent(eventName string, data interface{}) {
	if r.Runtime != nil {
		r.Runtime.Events.Emit(eventName, data)
	}
}

func generateFileHash(filePath string) string {
	hash := sha256.Sum256([]byte(filePath))
	return hex.EncodeToString(hash[:])
}

func resizeImage(file os.FileInfo, inputDir, outputDir string, maxWidth, maxHeight int) error {
	fullFilePath := filepath.Join(inputDir, file.Name())
	src, err := imaging.Open(fullFilePath)
	if err != nil {
		return err
	}

	resizeWidth := 0
	resizeHeight := 0

	if src.Bounds().Dx() > src.Bounds().Dy() {
		// landscape
		resizeWidth = maxWidth
	} else {
		// portrait
		resizeHeight = maxHeight
	}

	src = imaging.Resize(src, resizeWidth, resizeHeight, imaging.Lanczos)

	outputPath := filepath.Join(outputDir, file.Name())

	err = imaging.Save(src, outputPath)
	if err != nil {
		return err
	}

	return nil
}
