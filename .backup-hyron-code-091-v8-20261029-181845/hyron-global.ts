/** HYRON Code 0.9.1 V4 — camada opt-in sobre os tokens do OpenCode. */
export type HyronVisual = {
  theme: "hydra" | "dark" | "light"
  accent: string
  icon: string
  surface: string
  background: "theme" | "solid" | "gradient" | "image"
  color: string
  color2: string
  angle: number
  image?: string
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
    background: p.background === "solid" || p.background === "gradient" || p.background === "image" ? p.background : "theme",
    color: safe(p.color, "#102820"),
    color2: safe(p.color2, "#184b3e"),
    angle: typeof p.angle === "number" && Number.isFinite(p.angle) ? Math.max(0, Math.min(360, Math.round(p.angle))) : 135,
    image: typeof p.image === "string" && /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(p.image) && p.image.length < 900_000 ? p.image : undefined,
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
  // HYRON-V7-SURFACES: camada de superficies isolada do sistema de tokens nativo.
  // A selecao permanece limitada aos paineis conhecidos do OpenCode.
  sheet.textContent += `
  /* HYRON-V7-SURFACES */
  :root[data-hyron-visual] {
    --hyron-code-panel: ${p.surface};
    --hyron-code-panel-text: ${surfaceFg};
  }
  :root[data-hyron-visual] [data-slot="session-side-panel-content"],
  :root[data-hyron-visual] [data-slot="session-bottom-pane"],
  :root[data-hyron-visual] [data-slot="home-sessions-list"] {
    background-color: var(--hyron-code-panel) !important;
    color: var(--hyron-code-panel-text);
  }
  :root[data-hyron-visual] [data-slot="session-chat-panel"] {
    --hyron-session-surface: var(--hyron-code-panel);
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
