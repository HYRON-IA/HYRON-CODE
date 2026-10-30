import { BrowserWindow, ipcMain, nativeImage } from "electron"

// Fixed, private IPC channel. The renderer is sandboxed and cannot pass a path.
export const HYRON_ICON_CHANNEL = "hyron-code:dynamic-window-icon:v1"

ipcMain.on(HYRON_ICON_CHANNEL, (event, data: unknown) => {
  if (process.platform !== "win32" && process.platform !== "linux") return
  if (typeof data !== "string" || data.length > 600_000) return
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data)) return
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win || win.isDestroyed()) return
  try {
    const icon = nativeImage.createFromDataURL(data)
    const { width, height } = icon.getSize()
    if (icon.isEmpty() || width !== 256 || height !== 256) return
    win.setIcon(icon)
  } catch {
    // Invalid image: preserve existing icon.
  }
})
