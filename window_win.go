//go:build windows

package main

import (
	_ "embed"
	"encoding/binary"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"
	"syscall"
	"unsafe"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed build/windows/icon.ico
var embeddedIconData []byte

// Win32 calls for window style tweaks, dragging, and system tray.
var (
	kernel32                     = syscall.NewLazyDLL("kernel32.dll")
	user32                       = syscall.NewLazyDLL("user32.dll")
	shell32                      = syscall.NewLazyDLL("shell32.dll")
	procGetModuleHandleW         = kernel32.NewProc("GetModuleHandleW")
	procFindWindowW              = user32.NewProc("FindWindowW")
	procGetWindowLongW           = user32.NewProc("GetWindowLongW")
	procSetWindowLongW           = user32.NewProc("SetWindowLongW")
	procSetWindowPos             = user32.NewProc("SetWindowPos")
	procReleaseCapture           = user32.NewProc("ReleaseCapture")
	procSendMessageW             = user32.NewProc("SendMessageW")
	procLoadIconW                = user32.NewProc("LoadIconW")
	procLoadImageW               = user32.NewProc("LoadImageW")
	procCreateIconFromResourceEx   = user32.NewProc("CreateIconFromResourceEx")
	procSetLayeredWindowAttributes = user32.NewProc("SetLayeredWindowAttributes")
	procGetSystemMetrics           = user32.NewProc("GetSystemMetrics")
	procGetDpiForWindow            = user32.NewProc("GetDpiForWindow")
	procGetSystemMetricsForDpi      = user32.NewProc("GetSystemMetricsForDpi")
	procShowWindow                 = user32.NewProc("ShowWindow")
	procSetForegroundWindow        = user32.NewProc("SetForegroundWindow")
	procCallWindowProcW            = user32.NewProc("CallWindowProcW")
	procSetWindowLongPtrW          = user32.NewProc("SetWindowLongPtrW")
	procCreatePopupMenu            = user32.NewProc("CreatePopupMenu")
	procAppendMenuW                = user32.NewProc("AppendMenuW")
	procTrackPopupMenu             = user32.NewProc("TrackPopupMenu")
	procDestroyMenu                = user32.NewProc("DestroyMenu")
	procGetCursorPos               = user32.NewProc("GetCursorPos")
	procPostQuitMessage            = user32.NewProc("PostQuitMessage")

	procShellNotifyIconW = shell32.NewProc("Shell_NotifyIconW")
	procExtractIconExW   = shell32.NewProc("ExtractIconExW")
)

var (
	gwlExStyle  int32 = -20
	gwlpWndProc int32 = -4
)

const (
	wsExToolWindow = 0x00000080
	wsExAppWindow  = 0x00040000
	wsExLayered    = 0x00080000
	lwaAlpha       = 0x00000002

	swpNosize       = 0x0001
	swpNomove       = 0x0002
	swpNozorder     = 0x0004
	swpFrameChanged = 0x0020

	wmNCLButtonDown = 0x00A1
	htCaption       = 2

	nimAdd        = 0x00000000
	nimModify     = 0x00000001
	nimDelete     = 0x00000002
	nimSetVersion = 0x00000004

	nifMessage = 0x00000001
	nifIcon    = 0x00000002
	nifTip     = 0x00000004

	notifyIconVersion4 = 4

	wmApp         = 0x8000
	wmTrayMessage = wmApp + 101
	wmContextMenu = 0x007B

	wmLButtonUp     = 0x0202
	wmLButtonDblClk = 0x0203
	wmRButtonUp     = 0x0205
	ninSelect       = 0x0400
	ninKeySelect    = 0x0401

	swRestore = 9

	tpmRightAlign  = 0x0008
	tpmBottomAlign = 0x0020
	tpmReturnCmd   = 0x0100

	mfString    = 0x0000
	mfSeparator = 0x0800
)

type notifyIconDataW struct {
	cbSize            uint32
	hWnd              uintptr
	uID               uint32
	uFlags            uint32
	uCallbackMessage  uint32
	hIcon             uintptr
	szTip             [128]uint16
	dwState           uint32
	dwStateMask       uint32
	szInfo            [256]uint16
	uTimeoutOrVersion uint32
	szInfoTitle       [64]uint16
	dwInfoFlags       uint32
	guidItem          [16]byte
	hBalloonIcon      uintptr
}

type point struct {
	x int32
	y int32
}

var (
	trayMu         sync.Mutex
	trayInstalled  bool
	traySubclassed bool
	trayHwnd       uintptr
	oldWndProc     uintptr
	globalAppRef   *App
)

func setWindowLongPtr(hwnd uintptr, nIndex int32, newLong uintptr) uintptr {
	if procSetWindowLongPtrW.Find() == nil {
		r, _, _ := procSetWindowLongPtrW.Call(hwnd, uintptr(nIndex), newLong)
		return r
	}
	r, _, _ := procSetWindowLongW.Call(hwnd, uintptr(nIndex), newLong)
	return r
}

func getSystemMetricsDpi(nIndex int32, hwnd uintptr) int32 {
	if procGetDpiForWindow.Find() == nil && procGetSystemMetricsForDpi.Find() == nil {
		dpi, _, _ := procGetDpiForWindow.Call(hwnd)
		if dpi > 0 {
			val, _, _ := procGetSystemMetricsForDpi.Call(uintptr(nIndex), dpi)
			if val > 0 {
				return int32(val)
			}
		}
	}
	val, _, _ := procGetSystemMetrics.Call(uintptr(nIndex))
	return int32(val)
}

func trayWndProcCallback(hwnd uintptr, msg uint32, wParam uintptr, lParam uintptr) uintptr {
	if msg == wmTrayMessage {
		switch lParam {
		case wmLButtonUp, wmLButtonDblClk, ninSelect, ninKeySelect:
			procShowWindow.Call(hwnd, uintptr(swRestore))
			procSetForegroundWindow.Call(hwnd)
			return 0
		case wmRButtonUp, wmContextMenu:
			var pt point
			procGetCursorPos.Call(uintptr(unsafe.Pointer(&pt)))
			hMenu, _, _ := procCreatePopupMenu.Call()
			if hMenu != 0 {
				openText, _ := syscall.UTF16PtrFromString("캘린더 열기")
				exitText, _ := syscall.UTF16PtrFromString("종료")
				procAppendMenuW.Call(hMenu, uintptr(mfString), 1, uintptr(unsafe.Pointer(openText)))
				procAppendMenuW.Call(hMenu, uintptr(mfSeparator), 0, 0)
				procAppendMenuW.Call(hMenu, uintptr(mfString), 2, uintptr(unsafe.Pointer(exitText)))

				procSetForegroundWindow.Call(hwnd)
				cmd, _, _ := procTrackPopupMenu.Call(
					hMenu,
					uintptr(tpmReturnCmd|tpmRightAlign|tpmBottomAlign),
					uintptr(pt.x),
					uintptr(pt.y),
					0,
					hwnd,
					0,
				)
				procDestroyMenu.Call(hMenu)

				if cmd == 1 {
					procShowWindow.Call(hwnd, uintptr(swRestore))
					procSetForegroundWindow.Call(hwnd)
				} else if cmd == 2 {
					if globalAppRef != nil && globalAppRef.ctx != nil {
						wailsruntime.Quit(globalAppRef.ctx)
					} else {
						procPostQuitMessage.Call(0)
					}
				}
			}
			return 0
		}
	}
	if oldWndProc != 0 {
		r, _, _ := procCallWindowProcW.Call(oldWndProc, hwnd, uintptr(msg), wParam, lParam)
		return r
	}
	return 0
}

func loadIconFromBytes(desiredSize int) uintptr {
	if len(embeddedIconData) < 6 {
		return 0
	}
	count := int(binary.LittleEndian.Uint16(embeddedIconData[4:6]))
	var bestOffset, bestSize uint32
	var bestDiff = 9999

	for i := 0; i < count; i++ {
		offset := 6 + i*16
		if offset+16 > len(embeddedIconData) {
			break
		}
		w := int(embeddedIconData[offset])
		if w == 0 {
			w = 256
		}
		imgSize := binary.LittleEndian.Uint32(embeddedIconData[offset+8 : offset+12])
		imgOffset := binary.LittleEndian.Uint32(embeddedIconData[offset+12 : offset+16])

		diff := w - desiredSize
		if diff < 0 {
			diff = -diff
		}
		if diff < bestDiff {
			bestDiff = diff
			bestOffset = imgOffset
			bestSize = imgSize
		}
	}

	if bestSize > 0 && int(bestOffset+bestSize) <= len(embeddedIconData) {
		raw := embeddedIconData[bestOffset : bestOffset+bestSize]
		hIcon, _, _ := procCreateIconFromResourceEx.Call(
			uintptr(unsafe.Pointer(&raw[0])),
			uintptr(len(raw)),
			1, // fIcon = TRUE
			0x00030000,
			uintptr(desiredSize),
			uintptr(desiredSize),
			0, // LR_DEFAULTCOLOR
		)
		if hIcon != 0 {
			return hIcon
		}
	}
	return 0
}

func setTrayIcon(windowTitle string, enable bool) error {
	trayMu.Lock()
	defer trayMu.Unlock()

	titlePtr, err := syscall.UTF16PtrFromString(windowTitle)
	if err != nil {
		return err
	}
	hwnd, _, _ := procFindWindowW.Call(0, uintptr(unsafe.Pointer(titlePtr)))
	if hwnd == 0 {
		return fmt.Errorf("window not found")
	}
	trayHwnd = hwnd

	nid := notifyIconDataW{
		cbSize:           uint32(unsafe.Sizeof(notifyIconDataW{})),
		hWnd:             hwnd,
		uID:              1,
		uFlags:           nifMessage | nifIcon | nifTip,
		uCallbackMessage: wmTrayMessage,
	}

	tip, _ := syscall.UTF16FromString("Bright Calendar")
	copy(nid.szTip[:], tip)

	// Load exact small icon matching system tray DPI metrics
	cxSm := int(getSystemMetricsDpi(49 /* SM_CXSMICON */, hwnd))
	cySm := int(getSystemMetricsDpi(50 /* SM_CYSMICON */, hwnd))
	if cxSm <= 0 {
		cxSm = 24
		cySm = 24
	}

	// 1. Direct pixel-perfect extraction from embedded High-DPI icon bytes
	hIcon := loadIconFromBytes(cxSm)

	// 2. Fallbacks if needed
	if hIcon == 0 {
		hInst, _, _ := procGetModuleHandleW.Call(0)
		for _, id := range []uintptr{3, 1, 101} {
			h, _, _ := procLoadImageW.Call(hInst, id, 1 /* IMAGE_ICON */, uintptr(cxSm), uintptr(cySm), 0)
			if h != 0 {
				hIcon = h
				break
			}
		}
	}
	if hIcon == 0 {
		if exePath, err := os.Executable(); err == nil {
			exePtr, _ := syscall.UTF16PtrFromString(exePath)
			var hSmIcon uintptr
			ret, _, _ := procExtractIconExW.Call(uintptr(unsafe.Pointer(exePtr)), 0, 0, uintptr(unsafe.Pointer(&hSmIcon)), 1)
			if ret > 0 && hSmIcon != 0 {
				hIcon = hSmIcon
			}
		}
	}
	if hIcon == 0 {
		hIcon, _, _ = procSendMessageW.Call(hwnd, 0x007F /* WM_GETICON */, 0 /* ICON_SMALL */, 0)
	}
	if hIcon == 0 {
		hIcon, _, _ = procLoadIconW.Call(0, uintptr(32512) /* IDI_APPLICATION */)
	}
	nid.hIcon = hIcon

	// Also ensure the window itself has crisp ICON_BIG and ICON_SMALL set for Taskbar
	cxBig := int(getSystemMetricsDpi(11 /* SM_CXICON */, hwnd))
	cyBig := int(getSystemMetricsDpi(12 /* SM_CYICON */, hwnd))
	if cxBig <= 0 {
		cxBig = 48
		cyBig = 48
	}
	hBigIcon := loadIconFromBytes(cxBig)
	if hBigIcon == 0 {
		hInst, _, _ := procGetModuleHandleW.Call(0)
		for _, id := range []uintptr{3, 1, 101} {
			h, _, _ := procLoadImageW.Call(hInst, id, 1 /* IMAGE_ICON */, uintptr(cxBig), uintptr(cyBig), 0)
			if h != 0 {
				hBigIcon = h
				break
			}
		}
	}

	if hBigIcon != 0 {
		procSendMessageW.Call(hwnd, 0x0080 /* WM_SETICON */, 1 /* ICON_BIG */, hBigIcon)
	}
	if hIcon != 0 {
		procSendMessageW.Call(hwnd, 0x0080 /* WM_SETICON */, 0 /* ICON_SMALL */, hIcon)
	}

	if enable {
		if !traySubclassed {
			cb := syscall.NewCallback(trayWndProcCallback)
			old := setWindowLongPtr(hwnd, gwlpWndProc, cb)
			if old != 0 {
				oldWndProc = old
				traySubclassed = true
			}
		}
		procShellNotifyIconW.Call(uintptr(nimAdd), uintptr(unsafe.Pointer(&nid)))
		// Enable modern High-DPI tray icon version 4
		verNid := nid
		verNid.uTimeoutOrVersion = notifyIconVersion4
		procShellNotifyIconW.Call(uintptr(nimSetVersion), uintptr(unsafe.Pointer(&verNid)))
		trayInstalled = true
	} else {
		if trayInstalled {
			procShellNotifyIconW.Call(uintptr(nimDelete), uintptr(unsafe.Pointer(&nid)))
			trayInstalled = false
		}
	}
	return nil
}

// launchDetached runs a batch script in a new hidden console window,
// detached from the current process so it survives after we exit.
func launchDetached(batPath string) error {
	cmd := exec.Command("cmd.exe", "/C", batPath)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP | 0x00000008, // DETACHED_PROCESS
		HideWindow:    true,
	}
	return cmd.Start()
}

func setTaskbarVisibility(windowTitle string, showOnTaskbar bool) error {
	titlePtr, err := syscall.UTF16PtrFromString(windowTitle)
	if err != nil {
		return err
	}
	hwnd, _, _ := procFindWindowW.Call(0, uintptr(unsafe.Pointer(titlePtr)))
	if hwnd == 0 {
		return fmt.Errorf("window not found")
	}

	// Update window icons so taskbar renders the crisp icon
	cxBig := int(getSystemMetricsDpi(11 /* SM_CXICON */, hwnd))
	cxSm := int(getSystemMetricsDpi(49 /* SM_CXSMICON */, hwnd))
	if cxBig <= 0 {
		cxBig = 48
	}
	if cxSm <= 0 {
		cxSm = 24
	}
	hBigIcon := loadIconFromBytes(cxBig)
	hSmIcon := loadIconFromBytes(cxSm)
	if hBigIcon != 0 {
		procSendMessageW.Call(hwnd, 0x0080 /* WM_SETICON */, 1, hBigIcon)
	}
	if hSmIcon != 0 {
		procSendMessageW.Call(hwnd, 0x0080 /* WM_SETICON */, 0, hSmIcon)
	}

	style, _, _ := procGetWindowLongW.Call(hwnd, uintptr(gwlExStyle))
	var newStyle uintptr
	if showOnTaskbar {
		newStyle = (style &^ wsExToolWindow) | wsExAppWindow
	} else {
		newStyle = (style &^ wsExAppWindow) | wsExToolWindow
	}
	procSetWindowLongW.Call(hwnd, uintptr(gwlExStyle), newStyle)
	procSetWindowPos.Call(
		hwnd,
		0,
		0,
		0,
		0,
		0,
		uintptr(swpNomove|swpNosize|swpNozorder|swpFrameChanged),
	)
	return nil
}

func hideFromTaskbar(windowTitle string) error {
	return setTaskbarVisibility(windowTitle, false)
}

func startWindowDrag(windowTitle string) error {
	titlePtr, err := syscall.UTF16PtrFromString(windowTitle)
	if err != nil {
		return err
	}
	hwnd, _, _ := procFindWindowW.Call(0, uintptr(unsafe.Pointer(titlePtr)))
	if hwnd == 0 {
		return fmt.Errorf("window not found")
	}
	procReleaseCapture.Call()
	procSendMessageW.Call(hwnd, uintptr(wmNCLButtonDown), uintptr(htCaption), 0)
	return nil
}

const (
	htLeft        = 10
	htRight       = 11
	htTop         = 12
	htTopLeft     = 13
	htTopRight    = 14
	htBottom      = 15
	htBottomLeft  = 16
	htBottomRight = 17
)

func startWindowResize(windowTitle string, direction string) error {
	titlePtr, err := syscall.UTF16PtrFromString(windowTitle)
	if err != nil {
		return err
	}
	hwnd, _, _ := procFindWindowW.Call(0, uintptr(unsafe.Pointer(titlePtr)))
	if hwnd == 0 {
		return fmt.Errorf("window not found")
	}
	var htCode uintptr
	switch strings.ToLower(direction) {
	case "top":
		htCode = htTop
	case "bottom":
		htCode = htBottom
	case "left":
		htCode = htLeft
	case "right":
		htCode = htRight
	case "top-left", "topleft":
		htCode = htTopLeft
	case "top-right", "topright":
		htCode = htTopRight
	case "bottom-left", "bottomleft":
		htCode = htBottomLeft
	case "bottom-right", "bottomright":
		htCode = htBottomRight
	default:
		return fmt.Errorf("invalid direction: %s", direction)
	}
	var pt point
	procGetCursorPos.Call(uintptr(unsafe.Pointer(&pt)))
	lParam := uintptr((uint32(pt.y) << 16) | (uint32(pt.x) & 0xFFFF))
	procReleaseCapture.Call()
	procSendMessageW.Call(hwnd, uintptr(wmNCLButtonDown), htCode, lParam)
	return nil
}

func setWindowOpacity(windowTitle string, opacityPercent int) error {
	if opacityPercent < 10 {
		opacityPercent = 10
	}
	if opacityPercent > 100 {
		opacityPercent = 100
	}
	titlePtr, err := syscall.UTF16PtrFromString(windowTitle)
	if err != nil {
		return err
	}
	hwnd, _, _ := procFindWindowW.Call(0, uintptr(unsafe.Pointer(titlePtr)))
	if hwnd == 0 {
		return fmt.Errorf("window not found")
	}
	style, _, _ := procGetWindowLongW.Call(hwnd, uintptr(gwlExStyle))
	newStyle := style | uintptr(wsExLayered)
	procSetWindowLongW.Call(hwnd, uintptr(gwlExStyle), newStyle)
	bAlpha := byte((opacityPercent * 255) / 100)
	procSetLayeredWindowAttributes.Call(hwnd, 0, uintptr(bAlpha), uintptr(lwaAlpha))
	return nil
}
