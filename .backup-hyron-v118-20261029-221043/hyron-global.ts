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
  const bg = p.background === "solid" ? "none"
    : p.background === "gradient" ? `linear-gradient(${p.angle}deg, ${p.color}, ${p.color2})`
    : p.background === "image" && p.image ? imageUrl(p.image) : "none"
  const defaultBg = p.theme === "light" ? "#eff2f5" : p.theme === "dark" ? "#101114" : "#071310"
  const bgColor = p.background === "theme" ? defaultBg : p.color
  // V11.7: texto, fundo e superficie possuem responsabilidades distintas.
  // A cor de fundo nao altera tokens 'deep' nem 'layer': esses tokens tambem
  // sao usados pela barra superior e pelos estados dos botoes.
  sheet.textContent = `
  :root[data-hyron-visual] {
    --hyron-code-accent: ${p.accent};
    --hyron-code-icon: ${p.icon};
    --hyron-code-surface: ${p.surface};
    --hyron-code-on-surface: ${surfaceFg};
    --hyron-code-background: ${bgColor};
    --hyron-code-wallpaper: ${bg};
    --v2-text-text-base: ${p.accent} !important;
    --v2-text-text-muted: ${p.accent} !important;
    --v2-text-text-faint: ${p.accent} !important;
    --v2-icon-icon-base: ${p.accent} !important;
    --v2-icon-icon-muted: ${p.accent} !important;
    --v2-icon-icon-faint: ${p.accent} !important;
    --text-base: ${p.accent} !important;
    --text-strong: ${p.accent} !important;
    --text-stronger: ${p.accent} !important;
    --text-weak: ${p.accent} !important;
    --text-weaker: ${p.accent} !important;
    --text-interactive-base: ${p.accent} !important;
    --v2-text-text-accent: ${p.accent} !important;
    --v2-text-text-accent-hover: ${p.accent} !important;
    --v2-icon-icon-accent: ${p.accent} !important;
    --v2-border-border-focus: ${p.accent} !important;
    /* Somente o token da superficie-base de conteudo recebe o fundo geral. */
    --v2-background-bg-base: ${bgColor} !important;
  }
  :root[data-hyron-visual] #root {
    background-color: ${defaultBg};
  }
  /* O painel principal recebe o papel de parede; a moldura e o titulo nao. */
  :root[data-hyron-visual] :is(.settings-screen, [data-slot="session-chat-panel"]) {
    background-color: ${bgColor};
    background-image: ${bg};
    background-position: center;
    background-size: cover;
  }
  /* A cor de paineis nao deve vazar para os botoes e abas. */
  :root[data-hyron-visual] :is([data-slot="session-composer"], [data-slot="composer"], [data-component="card"]) {
    background-color: ${p.surface};
  }
  `
  // V11.1: o balão usa automaticamente a mesma base cromática do fundo da conversa.
  // A escolha manual messageColor continua tendo precedência.
  const chatBase = p.chatBackground === "inherit" || !p.chatBackground
    ? (p.background === "theme" ? bgColor : p.color)
    : (p.chatColor ?? bgColor)
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
  // V11.4: somente o painel de fundo da barra e a tela de ajustes recebem suas cores.
  // Somente uma seleção explícita ativa cada regra; demais áreas herdam o tema.
  if (p.sidebarColor || p.settingsColor) {
    sheet.textContent += `
    /* HYRON-V11-3-ISOLATED-AREA-COLORS */
    ${p.sidebarColor ? `
    /* Somente as duas superficies reais da barra. Nao modificar tokens
       herdados: os botoes e abas devem continuar usando o tema nativo. */
    :root[data-hyron-visual] [data-slot="vertical-tabs-sidebar"] > [data-slot="vertical-tabs-panel"] > [data-slot="vertical-tabs-mount"],
    :root[data-hyron-visual] [data-slot="vertical-tabs-sidebar"] > [data-slot="vertical-tabs-panel"] > [data-slot="vertical-tabs-peek-surface"] {
      background-color: ${p.sidebarColor} !important;
      background-image: none !important;
    }
    ` : ""}
    ${p.settingsColor ? `
    :root[data-hyron-visual] .settings-screen {
      --v2-background-bg-base: ${p.settingsColor} !important;
      --v2-background-bg-deep: ${p.settingsColor} !important;
      --v2-background-bg-layer-01: ${p.settingsColor} !important;
      --v2-background-bg-layer-02: color-mix(in srgb, ${p.settingsColor} 88%, ${contrast(p.settingsColor)} 12%) !important;
      --v2-background-bg-layer-03: color-mix(in srgb, ${p.settingsColor} 82%, ${contrast(p.settingsColor)} 18%) !important;
      background: ${p.settingsColor} !important;
    }
    :root[data-hyron-visual] .settings-screen .settings-tab-header {
      background: ${p.settingsColor} !important;
    }
    ` : ""}
    `
  }
  // V11.5: texto e icones da barra lateral seguem a cor principal.
  // Somente a cor do primeiro plano e alterada; fundo dos botoes,
  // hover e selecao continuam sob controle do tema nativo.
  sheet.textContent += `
  /* HYRON-V11-5-SIDEBAR-FOREGROUND */
  :root[data-hyron-visual] [data-slot="vertical-tabs-mount"] :is(a, button, [role="button"], [data-titlebar-tab-link]),
  :root[data-hyron-visual] [data-slot="vertical-tabs-mount"] :is(a, button, [role="button"], [data-titlebar-tab-link]) :is(span, svg),
  :root[data-hyron-visual] [data-slot="vertical-tabs-mount"] [data-slot="sidebar-header"] :is(span, svg) {
    color: ${p.accent} !important;
  }
  `
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
