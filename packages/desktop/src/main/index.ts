// Imported first so its evaluation stamps the moment Electron handed control to this module.
import { marks } from "./lifecycle/marks"
import { app } from "electron"
import { existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { acquireApplicationLock, configureApplication } from "./lifecycle/configure"
import { startSidecarProbe } from "./service/sidecar-probe"
import { startHyron9Router } from "./service/hyron-9router-autostart"
import { registerStorageSnapshotHandler } from "./storage/snapshot"
import { createEarlyWindow } from "./windows/early"
import { rendererAssetsServed } from "./windows/protocol"
import { registerRendererScheme } from "./windows/scheme"

// HYRONCODE 9Router factory plugin: expose the preinstalled server module to the
// OpenCode sidecar via its inherited process environment. No user config is overwritten.
function configureBundled9Router(): void {
  if (process.env.HYRONCODE_DISABLE_BUNDLED_9ROUTER === "1") return
  if (process.env.HYRONCODE_9ROUTER_PLUGIN_DIR) return
  const packaged = join(process.resourcesPath, "hyron-9router", "node_modules", "@vheins", "opencode-9router")
  if (existsSync(join(packaged, "server.js"))) {
    process.env.HYRONCODE_9ROUTER_PLUGIN_DIR = packaged
    return
  }
  for (const start of [process.cwd(), app.getAppPath()]) {
    let directory = resolve(start)
    for (let depth = 0; depth < 7; depth++) {
      const candidate = join(directory, "integrations", "9router-preinstalled", "node_modules", "@vheins", "opencode-9router")
      if (existsSync(join(candidate, "server.js"))) {
        process.env.HYRONCODE_9ROUTER_PLUGIN_DIR = candidate
        return
      }
      const parent = dirname(directory)
      if (parent === directory) break
      directory = parent
    }
  }
}

// This module stays small on purpose. Electron holds the ready event until the entry module has
// finished, and the first window should be on screen before the rest of the main process — a few
// hundred milliseconds of module evaluation and layers — loads. Configuration and the scheme must
// precede ready; the window is created the moment ready fires; everything else is imported after.
configureBundled9Router()
configureApplication()

if (acquireApplicationLock()) {
  registerRendererScheme()
  // Window first, then the bundle: starting the import before ready delays ready itself, because the
  // module graph evaluates on the same thread Chromium needs to finish initialising.
  void app.whenReady().then(async () => {
    marks.ready = Date.now()
    registerStorageSnapshotHandler()
    createEarlyWindow()
    marks.window = Date.now()
    startSidecarProbe()
    void startHyron9Router()

    // The window's renderer is already loading. Its HTML and preloaded chunks are served from this
    // thread, so the bundle waits for that burst to be answered (or a cap) before it evaluates.
    if (!process.env.ELECTRON_RENDERER_URL) await rendererAssetsServed({ quietMs: 40, capMs: 400 })
    marks.served = Date.now()

    return import("./desktop")
  })
}
