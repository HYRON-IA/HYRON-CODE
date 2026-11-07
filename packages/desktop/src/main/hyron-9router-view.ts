import { BrowserWindow, ipcMain, session, WebContentsView, type IpcMainInvokeEvent } from "electron"
import { isRendererUrl } from "./windows/scheme"

// HYRONCODE / 9Router native dashboard. Never grants the webpage Electron/Node privileges.
const CHANNEL = "hyroncode:9router:native:v1"
const STATUS = "hyroncode:9router:native-status:v1"
const PARTITION = "persist:hyroncode-9router-dashboard"
const PORT = "20128"

type Rect = { x: number; y: number; width: number; height: number }
type HyronTheme = {
  bg: string
  bgAlt: string
  surface: string
  surface2: string
  border: string
  text: string
  muted: string
  accent: string
  dark: boolean
}
type Entry = { win: BrowserWindow; view: WebContentsView; origin: string; rect?: Rect; onResize: () => void; onClose: () => void; theme?: HyronTheme; styleKey?: string; styleQueue?: Promise<boolean>; themeTimers?: ReturnType<typeof setTimeout>[]; themeGeneration?: number }

// Never insert unvalidated renderer data as raw CSS.
function validCssColor(value: unknown): value is string {
  return typeof value === "string" && value.length <= 96 &&
    (/^#[a-f0-9]{3,8}$/i.test(value) ||
      /^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\([0-9.%,/\s+\-a-z]*\)$/i.test(value))
}
export function validatedHyronTheme(raw: unknown): HyronTheme | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return
  const obj = raw as Record<string, unknown>
  const names = ["bg", "bgAlt", "surface", "surface2", "border", "text", "muted", "accent"] as const
  if (typeof obj.dark !== "boolean" || !names.every((name) => validCssColor(obj[name]))) return
  return {
    bg: obj.bg as string, bgAlt: obj.bgAlt as string, surface: obj.surface as string,
    surface2: obj.surface2 as string, border: obj.border as string, text: obj.text as string,
    muted: obj.muted as string, accent: obj.accent as string, dark: obj.dark,
  }
}

function themeStyles(p: HyronTheme): string {
  // 9Router consumes CSS variables, but some screens also use explicit
  // light/dark utility classes. Override those tokens without touching
  // semantic warning/error colors, provider logos or page scripts.
  const tokens: Record<string, string> = {
    "--color-bg": p.bg,
    "--color-bg-alt": p.bgAlt,
    "--color-surface": p.surface,
    "--color-surface-2": p.surface2,
    "--color-surface-3": `color-mix(in srgb, ${p.surface2} 85%, ${p.text})`,
    "--color-sidebar": p.surface,
    "--color-border": p.border,
    "--color-border-subtle": `color-mix(in srgb, ${p.border} 68%, transparent)`,
    "--color-text": p.text,
    "--color-text-main": p.text,
    "--color-text-muted": p.muted,
    "--color-text-subtle": p.muted,
    "--color-primary": p.accent,
    "--color-primary-hover": `color-mix(in srgb, ${p.accent} 80%, ${p.text})`,
    "--color-accent": p.accent,
    // Utility classes referencing these explicit tokens bypass dark variables.
    "--color-bg-light": p.bg, "--color-bg-dark": p.bg,
    "--color-surface-light": p.surface, "--color-surface-dark": p.surface,
    "--color-sidebar-light": p.surface, "--color-sidebar-dark": p.surface,
    "--color-border-light": p.border, "--color-border-dark": p.border,
    "--color-text-main-light": p.text, "--color-text-main-dark": p.text,
    "--color-text-muted-light": p.muted, "--color-text-muted-dark": p.muted,
  }
  for (const [level, blend] of [[50, 8], [100, 16], [200, 30], [300, 55], [400, 80], [500, 100], [600, 82], [700, 65], [800, 48], [900, 28]] as const) {
    tokens[`--color-brand-${level}`] = blend === 100 ? p.accent : `color-mix(in srgb, ${p.accent} ${blend}%, ${level > 500 ? p.bg : p.surface})`
  }
  const values = Object.entries(tokens).map(([key, value]) => `${key}: ${value} !important;`).join("\n")
  // Keep the original layout, meaningful warning/error colors and logos intact.
  return `:root, :root.dark, .dark { ${values} color-scheme: ${p.dark ? "dark" : "light"} !important; }
    html, body { background-color: ${p.bg} !important; color: ${p.text} !important; }
    .bg-hero-gradient, .dark .bg-hero-gradient {
      background: linear-gradient(180deg, ${p.bgAlt}, ${p.bg}) !important;
    }
    .bg-primary { background-color: ${p.accent} !important; }
    .text-primary { color: ${p.accent} !important; }
    .border-primary { border-color: ${p.accent} !important; }
    /* Applied only while the HYRONCODE theme is enabled. The small, targeted
       marker below is added to buttons whose rendered text lacks contrast. */
    button[data-hyron9-contrast="dark"],
    button[data-hyron9-contrast="dark"] :is(span:not(:has(svg, img, picture)), strong, small) { color: #101820 !important; }
    button[data-hyron9-contrast="light"],
    button[data-hyron9-contrast="light"] :is(span:not(:has(svg, img, picture)), strong, small) { color: #ffffff !important; }
  `
}

// Only inspect COMPUTED CSS colours of buttons; never read text, form values,
// cookies, credentials, network responses or 9Router application state.
// A marker is used instead of overwriting inline styles, so opting out is reversible.
const correctButtonContrast = `(() => {
  const rgb = (value) => {
    const match = String(value).match(/^rgba?\\(\\s*([\\d.]+)[,\\s]+([\\d.]+)[,\\s]+([\\d.]+)(?:[,\\s/]+([\\d.]+))?\\s*\\)$/i)
    return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])] : null
  }
  const lum = (channels) => {
    const c = channels.slice(0, 3).map((n) => {
      const x = n / 255
      return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4
    })
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]
  }
  const ratio = (a, b) => {
    const x = lum(a), y = lum(b)
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05)
  }
  const background = (element) => {
    const layers = []
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      const layer = rgb(getComputedStyle(node).backgroundColor)
      if (layer) layers.push(layer)
      if (layer && layer[3] >= .999) break
    }
    let bg = [22, 22, 22]
    for (const layer of layers.reverse()) {
      const alpha = Math.max(0, Math.min(1, layer[3]))
      bg = bg.map((channel, i) => layer[i] * alpha + channel * (1 - alpha))
    }
    return bg
  }
  let fixed = 0
  for (const button of document.querySelectorAll("button")) {
    button.removeAttribute("data-hyron9-contrast")
    if (button.disabled || !button.isConnected) continue
    const style = getComputedStyle(button)
    if (style.display === "none" || style.visibility === "hidden") continue
    const bg = background(button)
    const candidates = [button, ...button.querySelectorAll("span, strong, small")]
    const faded = candidates.some((part) => {
      const color = rgb(getComputedStyle(part).color)
      return color && ratio(color, bg) < 4.5
    })
    if (!faded) continue
    const mode = ratio([16, 24, 32], bg) >= ratio([255, 255, 255], bg) ? "dark" : "light"
    button.setAttribute("data-hyron9-contrast", mode)
    fixed++
  }
  return fixed
})()`

const clearButtonContrast = `(() => {
  for (const button of document.querySelectorAll('button[data-hyron9-contrast]')) {
    button.removeAttribute('data-hyron9-contrast')
  }
  return true
})()`

const readAppliedColors = `(() => {
  const style = getComputedStyle(document.documentElement)
  return { primary: style.getPropertyValue("--color-primary").trim(), bg: style.getPropertyValue("--color-bg").trim() }
})()`

function sameColorToken(actual: unknown, expected: string): boolean {
  return typeof actual === "string" && actual.replace(/\s+/g, "").toLowerCase() === expected.replace(/\s+/g, "").toLowerCase()
}

export function routerOrigin(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 160) return
  let url: URL
  try { url = new URL(value) } catch { return }
  if (url.protocol !== "http:" || url.port !== PORT || url.username || url.password || url.search || url.hash) return
  if (url.pathname !== "/v1" && url.pathname !== "/v1/") return
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname.toLowerCase())) return
  return url.origin
}

function trusted(event: IpcMainInvokeEvent): BrowserWindow | undefined {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win || win.isDestroyed() || win.webContents !== event.sender || !isRendererUrl(event.sender.getURL())) return
  if (event.senderFrame !== event.sender.mainFrame) return
  return win
}

function allowedPage(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    return url.protocol === "http:" && url.port === PORT &&
      !url.username && !url.password &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname.toLowerCase())
  } catch { return false }
}

function normalizeBounds(value: unknown): Rect | undefined {
  if (!value || typeof value !== "object") return
  const obj = value as Record<string, unknown>
  const [x, y, width, height] = [obj.x, obj.y, obj.width, obj.height]
  if (![x, y, width, height].every((v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 100000)) return
  if ((width as number) < 0 || (height as number) < 0) return
  return { x: x as number, y: y as number, width: width as number, height: height as number }
}

export function registerHyron9RouterView() {
  const entries = new Map<number, Entry>()
  const partition = session.fromPartition(PARTITION)
  partition.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  partition.setPermissionCheckHandler(() => false)

  const report = (win: BrowserWindow, state: string) => {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send(STATUS, state)
  }

  const layout = (entry: Entry) => {
    if (entry.win.isDestroyed()) return
    const rect = entry.rect
    const [maxWidth, maxHeight] = entry.win.getContentSize()
    const zoom = entry.win.webContents.getZoomFactor()
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      entry.view.setVisible(false)
      return
    }
    const x = Math.max(0, Math.min(maxWidth, Math.round(rect.x * zoom)))
    const y = Math.max(0, Math.min(maxHeight, Math.round(rect.y * zoom)))
    const width = Math.max(0, Math.min(maxWidth - x, Math.round(rect.width * zoom)))
    const height = Math.max(0, Math.min(maxHeight - y, Math.round(rect.height * zoom)))
    if (width <= 0 || height <= 0) {
      entry.view.setVisible(false)
      return
    }
    entry.view.setBounds({ x, y, width, height })
    entry.view.setVisible(true)
  }

  // Apply the theme in the dashboard's own document, and verify the
  // computed tokens. An enabled preference is NOT proof that CSS took effect.
  const applyTheme = async (entry: Entry): Promise<boolean> => {
    const contents = entry.view.webContents
    if (contents.isDestroyed()) return false
    if (entry.styleKey) {
      const previous = entry.styleKey
      entry.styleKey = undefined
      await contents.removeInsertedCSS(previous).catch(() => undefined)
    }
    if (!entry.theme) {
      if (!contents.isDestroyed() && !contents.isLoading() && allowedPage(contents.getURL()))
        await contents.executeJavaScript(clearButtonContrast, false).catch(() => undefined)
      report(entry.win, "Tema original do 9Router restaurado.")
      return true
    }
    if (contents.isDestroyed() || contents.isLoading() || !allowedPage(contents.getURL())) {
      report(entry.win, "Aguardando o dashboard terminar de carregar para aplicar o tema.")
      return false
    }
    // Electron 44 is more reliable at removing author-origin inserted styles.
    // The declarations themselves are !important and scoped to this local view.
    const key = await contents.insertCSS(themeStyles(entry.theme), { cssOrigin: "author" })
    if (contents.isDestroyed() || entries.get(entry.win.id) !== entry) {
      if (!contents.isDestroyed()) await contents.removeInsertedCSS(key).catch(() => undefined)
      return false
    }
    entry.styleKey = key
    // Accessibility-only correction of rendered button foreground colours.
    // Runs after style injection and hydration retries; never reads form values.
    await contents.executeJavaScript(correctButtonContrast, false).catch(() => undefined)
    // Constant, read-only script. No cookies, credentials, user input, network
    // or 9Router application objects are accessed.
    const observed = await contents.executeJavaScript(readAppliedColors, false) as { primary?: string; bg?: string }
    const verified = sameColorToken(observed?.primary, entry.theme.accent) && sameColorToken(observed?.bg, entry.theme.bg)
    report(entry.win, verified
      ? "Tema HYRONCODE aplicado aos tokens do 9Router. Logotipos e alertas mantem suas cores."
      : "Tema enviado, mas o 9Router nao confirmou os tokens de cor. Verifique o relatorio e as classes do dashboard.")
    return verified
  }
  const scheduleTheme = (entry: Entry): Promise<boolean> => {
    const queued = (entry.styleQueue ?? Promise.resolve(true)).then(
      () => applyTheme(entry), () => applyTheme(entry),
    ).catch(() => {
      report(entry.win, "Falha ao aplicar o tema. O dashboard original permanece disponivel.")
      return false
    })
    entry.styleQueue = queued
    return queued
  }

  // A SPA do 9Router pode recriar classes/tokens DEPOIS de did-finish-load.
  // Reaplique durante uma janela curta de hidratacao sem depender de um toggle manual.
  // O contador impede que uma tarefa antiga reative o tema apos desligar/fechar.
  const cancelThemeRetries = (entry: Entry) => {
    for (const timer of entry.themeTimers ?? []) clearTimeout(timer)
    entry.themeTimers = []
    entry.themeGeneration = (entry.themeGeneration ?? 0) + 1
  }
  const retryThemeDuringHydration = (entry: Entry) => {
    cancelThemeRetries(entry)
    if (!entry.theme) return
    const generation = entry.themeGeneration
    const delays = [300, 1000, 2200, 4200]
    for (const delay of delays) {
      const timer = setTimeout(() => {
        if (entries.get(entry.win.id) !== entry || entry.themeGeneration !== generation || !entry.theme || entry.view.webContents.isDestroyed()) return
        void scheduleTheme(entry)
      }, delay)
      entry.themeTimers?.push(timer)
    }
  }

  const release = (id: number) => {
    const entry = entries.get(id)
    if (!entry) return
    cancelThemeRetries(entry)
    entries.delete(id)
    if (!entry.win.isDestroyed()) {
      entry.win.removeListener("resize", entry.onResize)
      entry.win.removeListener("closed", entry.onClose)
      entry.win.contentView.removeChildView(entry.view)
    }
    if (!entry.view.webContents.isDestroyed()) entry.view.webContents.close()
  }

  ipcMain.handle(CHANNEL, async (event, request: unknown) => {
    const win = trusted(event)
    if (!win) throw new Error("9Router: janela nao autorizada")
    if (!request || typeof request !== "object") throw new Error("9Router: solicitacao invalida")
    const message = request as Record<string, unknown>
    if (message.action === "close") { release(win.id); return true }
    if (message.action === "layout") {
      const entry = entries.get(win.id)
      if (!entry) return false
      const rect = normalizeBounds(message.rect)
      if (!rect) throw new Error("9Router: posicao invalida")
      entry.rect = rect
      layout(entry)
      return true
    }
    if (message.action === "theme") {
      const entry = entries.get(win.id)
      if (!entry) return false
      if (message.palette !== null) {
        const theme = validatedHyronTheme(message.palette)
        if (!theme) throw new Error("9Router: cores de tema invalidas")
        entry.theme = theme
      } else entry.theme = undefined
      // A cor ja foi solicitada, mas a UI remota pode terminar de hidratar mais tarde.
      // Repetir em intervalos curtos evita depender do botao desligar/ligar.
      retryThemeDuringHydration(entry)
      return await scheduleTheme(entry)
    }
    if (message.action === "reload") {
      const entry = entries.get(win.id)
      if (!entry) return false
      report(win, "Recarregando dashboard...")
      entry.view.webContents.reloadIgnoringCache()
      return true
    }
    if (message.action !== "open") throw new Error("9Router: operacao nao permitida")

    const origin = routerOrigin(message.endpoint)
    if (!origin) throw new Error("9Router: somente o endereco local na porta 20128 e permitido")
    const previous = entries.get(win.id)
    if (previous && previous.origin === origin) { layout(previous); return true }
    release(win.id)

    const view = new WebContentsView({
      webPreferences: {
        partition: PARTITION,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
      },
    })
    view.setVisible(false)
    view.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
    view.webContents.on("will-navigate", (e, url) => {
      if (allowedPage(url)) return
      e.preventDefault()
      report(win, "Navegacao externa bloqueada por seguranca. Use Abrir no navegador para login OAuth.")
    })
    view.webContents.on("will-redirect", (e, url) => {
      if (allowedPage(url)) return
      e.preventDefault()
      report(win, "Redirecionamento externo bloqueado. Use Abrir no navegador para login OAuth.")
    })
    view.webContents.on("did-finish-load", () => {
      report(win, "Dashboard carregado no Electron. A autenticacao e gerenciada pelo 9Router.")
      void scheduleTheme(entry)
      retryThemeDuringHydration(entry)
    })
    // Rotas internas do dashboard podem trocar estilos sem recarregar a pagina.
    view.webContents.on("did-navigate-in-page", () => {
      void scheduleTheme(entry)
      retryThemeDuringHydration(entry)
    })
    view.webContents.on("did-fail-load", (_e, errorCode, description, url, isMainFrame) => {
      if (isMainFrame && errorCode !== -3) report(win, `Falha ao carregar o dashboard (codigo ${errorCode}): ${description}`)
    })
    const entry: Entry = { win, view, origin, onResize: () => layout(entry), onClose: () => release(win.id) }
    entries.set(win.id, entry)
    win.contentView.addChildView(view)
    win.on("resize", entry.onResize)
    win.once("closed", entry.onClose)
    report(win, "Abrindo o dashboard do 9Router...")
    void view.webContents.loadURL(`${origin}/dashboard`).catch(() => {
      report(win, "Falha ao acessar o dashboard. Confirme que o 9Router esta em execucao.")
    })
    return true
  })

  return () => {
    ipcMain.removeHandler(CHANNEL)
    for (const id of [...entries.keys()]) release(id)
  }
}
