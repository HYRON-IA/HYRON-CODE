import { contextBridge, ipcRenderer, webUtils } from "electron"
import {
  DragCancelEvent,
  IpcTransportPort,
  WindowSnapshotChannel,
  storageSnapshotNames,
  type WindowSnapshot,
} from "../shared/ipc-transport"
import { windowBootstrapFromArguments } from "../shared/window-bootstrap"

ipcRenderer.on(IpcTransportPort, (event) => {
  const port = event.ports[0]

  if (port) window.postMessage(IpcTransportPort, "*", [port])
})

ipcRenderer.on(DragCancelEvent, () => window.dispatchEvent(new Event(DragCancelEvent)))

const bootstrap = windowBootstrapFromArguments(process.argv)

// Asked before the page runs, so the stores the shell reads are hydrated on the first render.
const snapshot: Promise<WindowSnapshot> = ipcRenderer
  .invoke(WindowSnapshotChannel, storageSnapshotNames(bootstrap.id))
  .catch(() => ({ storage: {} }))

contextBridge.exposeInMainWorld("electron", {
  windowID: bootstrap.id,
  bootstrap,
  storageSnapshot: snapshot.then((snapshot) => snapshot.storage),
  plugins: snapshot.then((snapshot) => snapshot.plugins),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  setHyronIcon: (png: string) => ipcRenderer.send("hyron-code:dynamic-window-icon:v1", png),
  hyron9Router: {
    open: (endpoint: string) => ipcRenderer.invoke("hyroncode:9router:native:v1", { action: "open", endpoint }),
    layout: (rect: { x: number; y: number; width: number; height: number }) =>
      ipcRenderer.invoke("hyroncode:9router:native:v1", { action: "layout", rect }),
    reload: () => ipcRenderer.invoke("hyroncode:9router:native:v1", { action: "reload" }),
    theme: (palette: unknown) => ipcRenderer.invoke("hyroncode:9router:native:v1", { action: "theme", palette }),
    close: () => ipcRenderer.invoke("hyroncode:9router:native:v1", { action: "close" }),
    onStatus: (callback: (status: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: string) => callback(status)
      ipcRenderer.on("hyroncode:9router:native-status:v1", listener)
      return () => ipcRenderer.removeListener("hyroncode:9router:native-status:v1", listener)
    },
  },
})
