.PHONY: dev build pack pack-windows pack-all

build:
	wails build

dev:
	wails build -d && ./build/image-resizer

pack:
	wails build -p

pack-windows:
	wails build -p -x windows/amd64

pack-all: pack pack-windows