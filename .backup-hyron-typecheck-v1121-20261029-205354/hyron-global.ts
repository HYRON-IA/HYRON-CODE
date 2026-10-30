/** HYRON Code 0.9.1 V4 — camada opt-in sobre os tokens do OpenCode. */
export type HyronVisual = {
  theme: "hydra" | "dark" | "light"
  accent: string
  icon: string
  surface: string
  sidebarColor?: string
  settingsColor?: string
  background: "theme" | "solid" | "gradient" | "image"
  color: string
  color2: string
  angle: number
  image?: string
  /** Fundo independente da conversa; vazio mantém o comportamento da V9. */
  chatBackground?: "inherit" | "solid" | "gradient" | "image"
  chatColor?: string
  chatColor2?: string
  chatAngle?: number
  chatImage?: string
  messageColor?: string
}
export const HYRON_KEY = "hyron_code_appearance_v091"
const STYLE_ID = "hyron-code-global-appearance-v4"
const hex = (value: unknown): value is string => typeof value === "string" && /^#[a-f\d]{6}$/i.test(value)
const safe = (value: unknown, fallback: string) => hex(value) ? value : fallback
export function normalizeVisual(raw: unknown): HyronVisual {
  const p = raw && typeof raw === "object" ? raw as Partial<HyronVisual> : {}
  const theme = p.theme === "light" || p.theme === "dark" ? p.theme : "hydra"
  const dark = theme !== "light"
  return {
    theme,
    accent: safe(p.accent, dark ? "#78e6cd" : "#196e5e"),
    icon: safe(p.icon, dark ? "#78e6cd" : "#196e5e"),
    surface: safe(p.surface, dark ? "#102820" : "#ffffff"),
    sidebarColor: hex(p.sidebarColor) ? p.sidebarColor : undefined,
    settingsColor: hex(p.settingsColor) ? p.settingsColor : undefined,
    background: p.background === "solid" || p.background === "gradient" || p.background === "image" ? p.background : "theme",
    color: safe(p.color, "#102820"),
    color2: safe(p.color2, "#184b3e"),
    angle: typeof p.angle === "number" && Number.isFinite(p.angle) ? Math.max(0, Math.min(360, Math.round(p.angle))) : 135,
    image: typeof p.image === "string" && /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(p.image) && p.image.length < 900_000 ? p.image : undefined,
    chatBackground: p.chatBackground === "solid" || p.chatBackground === "gradient" || p.chatBackground === "image" ? p.chatBackground : "inherit",
    chatColor: safe(p.chatColor, "#102820"),
    chatColor2: safe(p.chatColor2, "#184b3e"),
    chatAngle: typeof p.chatAngle === "number" && Number.isFinite(p.chatAngle) ? Math.max(0, Math.min(360, Math.round(p.chatAngle))) : 135,
    chatImage: typeof p.chatImage === "string" && /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(p.chatImage) && p.chatImage.length < 900_000 ? p.chatImage : undefined,
    messageColor: hex(p.messageColor) ? p.messageColor : undefined,
  }
}
const rgb = (color: string) => {
  const n = parseInt(color.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const contrast = (color: string) => {
  const [r,g,b] = rgb(color).map((v) => {
    const x = v / 255
    return x <= 0.04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4
  })
  return r * .2126 + g * .7152 + b * .0722 > .179 ? "#14211d" : "#ffffff"
}
const imageUrl = (image: string) => `url("${image}")`
export function applyHyronVisual(raw: HyronVisual | null) {
  if (typeof document === "undefined") return
  const existing = document.getElementById(STYLE_ID)
  if (!raw) {
    existing?.remove()
    delete document.documentElement.dataset.hyronVisual
    return
  }
  const p = normalizeVisual(raw)
  let sheet = existing as HTMLStyleElement | null
  if (!sheet) {
    sheet = document.createElement("style")
    sheet.id = STYLE_ID
    document.head.appendChild(sheet)
  }
  const foreground = contrast(p.accent)
  const surfaceFg = contrast(p.surface)
  const bg = p.background === "solid" ? p.color
    : p.background === "gradient" ? `linear-gradient(${p.angle}deg, ${p.color}, ${p.color2})`
    : p.background === "image" && p.image ? imageUrl(p.image) : "none"
  const bgColor = p.background === "solid" ? p.color : p.background === "theme" ? (p.theme === "light" ? "#eff2f5" : p.theme === "dark" ? "#101114" : "#071310") : p.color
  // Tokens com !important prevalecem sobre o elemento #oc-theme, que pode ser reescrito quando o esquema muda.
  // Não são alteradas cores de erro/aviso nem tokens sintáticos do editor.
  sheet.textContent = `:root {
    --hyron-code-accent: ${p.accent};
    --hyron-code-icon: ${p.icon};
    --hyron-code-surface: ${p.surface};
    --v2-text-text-accent: ${p.accent} !important;
    --v2-text-text-accent-hover: ${p.accent} !important;
    --v2-icon-icon-accent: ${p.icon} !important;
    --v2-background-bg-accent: ${p.accent} !important;
    --v2-border-border-focus: ${p.accent} !important;
    --v2-text-text-contrast: ${foreground} !important;
    --hyron-code-on-surface: ${surfaceFg};
    --hyron-code-background: ${bgColor};
    --hyron-code-wallpaper: ${bg};
  }
  :root[data-hyron-visual] #root {
    background-color: var(--hyron-code-background);
    background-image: var(--hyron-code-wallpaper);
    background-position: center;
    background-size: cover;
    background-attachment: fixed;
  }
  :root[data-hyron-visual] [data-slot="session-chat-panel"] {
    --hyron-session-surface: ${p.surface};
  }
  :root[data-hyron-visual] [data-slot="session-chat-panel"] [data-slot="session-timeline-scroll"] {
    background-color: color-mix(in srgb, ${p.surface} 85%, transparent);
  }
  `
  // V9: tokens nativos de tema. Evita seletores que pintam listas inteiras.
  // As camadas sao progressivas; controles e paineis preservam suas estruturas.
  sheet.textContent += `
  /* HYRON-V9-NATIVE-TOKENS */
  :root[data-hyron-visual] {
    --hyron-code-panel: ${p.surface};
    --hyron-code-panel-text: ${surfaceFg};
    --v2-background-bg-base: color-mix(in srgb, ${p.surface} 12%, ${bgColor}) !important;
    --v2-background-bg-deep: color-mix(in srgb, ${p.surface} 22%, ${bgColor}) !important;
    --v2-background-bg-layer-01: color-mix(in srgb, ${p.surface} 75%, ${bgColor}) !important;
    --v2-background-bg-layer-02: ${p.surface} !important;
    --v2-background-bg-layer-03: color-mix(in srgb, ${p.surface} 90%, ${surfaceFg} 10%) !important;
    --background-base: color-mix(in srgb, ${p.surface} 12%, ${bgColor}) !important;
    --background-weak: color-mix(in srgb, ${p.surface} 22%, ${bgColor}) !important;
    --background-strong: color-mix(in srgb, ${p.surface} 70%, ${bgColor}) !important;
  }
  `
  // V11.1: o balão usa automaticamente a mesma base cromática do fundo da conversa.
  // A escolha manual messageColor continua tendo precedência.
  const chatBase = p.chatBackground === "inherit" || !p.chatBackground
    ? (p.background === "theme" ? bgColor : p.color)
    : p.chatColor
  const autoBubble = `color-mix(in srgb, ${chatBase} 76%, ${p.theme === "light" ? "#ffffff" : "#ffffff"} 24%)`
  const autoBubbleText = contrast(chatBase)
  // V10: a conversa tem fundo independente; sem escolha explicita, a V9 permanece intacta.
  const chatMode = p.chatBackground ?? "inherit"
  const chatImage = chatMode === "gradient" ? `linear-gradient(${p.chatAngle}deg, ${p.chatColor}, ${p.chatColor2})`
    : chatMode === "image" && p.chatImage ? imageUrl(p.chatImage) : "none"
  {
    sheet.textContent += `
    /* HYRON-V10-CHAT-BACKGROUND */
    :root[data-hyron-visual] [data-slot="session-chat-panel"] {
      ${chatMode !== "inherit" ? `background-color: ${p.chatColor} !important; background-image: ${chatImage} !important; background-position: center !important; background-size: cover !important;` : ""}
    }
    ${chatMode !== "inherit" ? `
    :root[data-hyron-visual] [data-slot="session-chat-panel"] [data-slot="session-timeline-scroll"],
    :root[data-hyron-visual] [data-slot="session-chat-panel"] [data-slot="session-timeline-scroll"] > .scroll-view__viewport,
    :root[data-hyron-visual] [data-slot="session-chat-panel"] [data-slot="session-timeline-visible"] {
      background: transparent !important;
    }
    ` : ""}
    /* HYRON-V11-1-LINKED-BUBBLES: automatic unless an explicit message color exists. */
    :root[data-hyron-visual] [data-slot="session-chat-panel"] [data-component="user-message"] [data-slot="user-message-text"] {
      background-color: ${p.messageColor ?? autoBubble} !important;
      color: ${p.messageColor ? contrast(p.messageColor) : autoBubbleText} !important;
      border-radius: 10px;
    }
    `
  }
  // V11.2: independent colors. Undefined = inherit existing panel tokens.
  // Rules are appended after V9 native tokens and apply only on explicit selection.
  if (p.sidebarColor || p.settingsColor) {
    sheet.textContent += `
    /* HYRON-V11-2-AREA-COLORS */
    ${p.sidebarColor ? `
    :root[data-hyron-visual] [data-slot="vertical-tabs-sidebar"] {
      --v2-background-bg-base: ${p.sidebarColor} !important;
      --v2-background-bg-layer-01: ${p.sidebarColor} !important;
      --v2-background-bg-layer-02: ${p.sidebarColor} !important;
      background-color: ${p.sidebarColor} !important;
    }
    ` : ""}
    ${p.settingsColor ? `
    :root[data-hyron-visual] .settings-screen {
      --v2-background-bg-base: ${p.settingsColor} !important;
      --v2-background-bg-layer-01: ${p.settingsColor} !important;
      background-color: ${p.settingsColor} !important;
    }
    :root[data-hyron-visual] .settings-screen .settings-panel {
      --v2-background-bg-base: ${p.settingsColor} !important;
      background-color: ${p.settingsColor} !important;
    }
    ` : ""}
    `
  }
  document.documentElement.dataset.hyronVisual = p.theme
}
export function restoreHyronVisual() {
  if (typeof window === "undefined") return
  try {
    const value = window.localStorage.getItem(HYRON_KEY)
    if (!value) return
    applyHyronVisual(normalizeVisual(JSON.parse(value)))
  } catch {
    applyHyronVisual(null)
  }
}
