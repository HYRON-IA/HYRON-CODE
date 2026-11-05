// HYRONCODE 9Router autostart: start only if the local gateway is not already listening.
import { app } from "electron"
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { connect } from "node:net"
import { basename, dirname, join, resolve } from "node:path"

const PORT = 20128
const ROUTER_RELATIVE = join("integrations", "9router", "node_modules", "9router", "app", "custom-server.js")
let launched = false

function routerPath(): string | undefined {
  const override = process.env.HYRONCODE_9ROUTER_ENTRY
  if (override && existsSync(override)) return override
  for (const startingPoint of [process.cwd(), app.getAppPath(), process.resourcesPath]) {
    let directory = resolve(startingPoint)
    for (let depth = 0; depth < 9; depth++) {
      const candidate = join(directory, ROUTER_RELATIVE)
      if (existsSync(candidate)) return candidate
      const parent = dirname(directory)
      if (parent === directory) break
      directory = parent
    }
  }
  return undefined
}

function nodeBinary(): string {
  const configured = process.env.HYRONCODE_9ROUTER_NODE
  if (configured) return configured
  if (basename(process.execPath).toLowerCase() === "node.exe") return process.execPath
  const systemNode = join(process.env.ProgramFiles ?? "C:\\Program Files", "nodejs", "node.exe")
  return existsSync(systemNode) ? systemNode : "node"
}

function portIsListening(): Promise<boolean> {
  return new Promise((resolvePort) => {
    const socket = connect({ host: "127.0.0.1", port: PORT })
    let settled = false
    const done = (result: boolean) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolvePort(result)
    }
    socket.setTimeout(800)
    socket.once("connect", () => done(true))
    socket.once("timeout", () => done(false))
    socket.once("error", () => done(false))
  })
}

export async function startHyron9Router(): Promise<void> {
  if (launched) return
  launched = true
  if (await portIsListening()) return
  const entry = routerPath()
  if (!entry) {
    console.warn("[HYRONCODE 9Router] Entrada nao encontrada; inicializacao ignorada")
    return
  }
  try {
    const child = spawn(nodeBinary(), ["--dns-result-order=ipv4first", "--max-old-space-size=6144", entry], {
      cwd: dirname(entry),
      detached: true,
      windowsHide: true,
      stdio: "ignore",
      env: { ...process.env, PORT: "20128" },
    })
    child.once("error", (error) => console.error("[HYRONCODE 9Router] Erro ao iniciar:", error.message))
    child.unref()
    console.info("[HYRONCODE 9Router] Inicializacao solicitada")
  } catch (error) {
    console.error("[HYRONCODE 9Router] Falha:", error)
  }
}