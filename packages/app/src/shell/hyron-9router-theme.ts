// HYRONCODE 9Router theme bridge V1.4.
// Reads the colors rendered by the current HYRONCODE theme. Never reads credentials or 9Router DOM.
export type Hyron9RouterPalette = {
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

const validColor = (value: string) =>
  /^#[0-9a-f]{3,8}$/i.test(value) ||
  /^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\([0-9.%,/\s+\-a-z]*\)$/i.test(value)

function color(value: string | undefined, fallback: string): string {
  const result = (value ?? "").trim()
  const transparent = /^rgba\([^)]*[,/]\s*0(?:\.0+)?\s*\)$/i.test(result) ||
    /^rgb\([^)]*\/\s*0(?:\.0+)?\s*\)$/i.test(result)
  return result && validColor(result) && !transparent ? result : fallback
}

function luminance(value: string): number | undefined {
  const match = /^rgba?\(\s*(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)/i.exec(value)
  if (match) {
    const [r, g, b] = match.slice(1, 4).map(Number)
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  }
  const hex = value.match(/^#([0-9a-f]{6})$/i)
  if (!hex) return
  const n = parseInt(hex[1], 16)
  return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
}

export function readHyron9RouterPalette(): Hyron9RouterPalette {
  const rootStyle = getComputedStyle(document.documentElement)
  const bodyStyle = getComputedStyle(document.body)
  const probe = document.createElement("span")
  // Do not interfere with the page layout, focus, accessible tree or pointer events.
  probe.setAttribute("aria-hidden", "true")
  probe.style.cssText = "position:fixed!important;top:-9999px!important;left:-9999px!important;visibility:hidden!important;pointer-events:none!important"
  document.body.appendChild(probe)
  const sample = (className: string, property: "backgroundColor" | "color" | "borderTopColor") => {
    probe.className = className
    return getComputedStyle(probe)[property]
  }
  try {
    const bg = color(sample("bg-v2-background-bg-deep", "backgroundColor"), color(bodyStyle.backgroundColor, "#101414"))
    const bgAlt = color(sample("bg-v2-background-bg-base", "backgroundColor"), bg)
    const surface = color(sample("bg-v2-background-bg-layer-01", "backgroundColor"), bgAlt)
    const surface2 = color(sample("bg-v2-background-bg-layer-02", "backgroundColor"), surface)
    const border = color(sample("border border-v2-border-border-base", "borderTopColor"), "#37554b")
    const text = color(sample("text-v2-text-text-base", "color"), color(bodyStyle.color, "#e7f3ee"))
    const muted = color(sample("text-v2-text-text-muted", "color"), text)
    const themeTokens = ["--color-primary", "--color-accent", "--color-v2-text-link", "--color-v2-text-accent", "--v2-accent"]
    const rootAccent = themeTokens.map((key) => rootStyle.getPropertyValue(key).trim()).find((value) => validColor(value))
    const linkClasses = ["text-v2-text-text-link", "text-v2-text-text-accent", "text-v2-icon-icon-active"]
    const link = linkClasses.map((name) => color(sample(name, "color"), ""))
      .find((value) => value && value !== text && value !== muted)
    // The active UI-theme token is preferred; fall back to the rendered link/accent color.
    const accent = color(rootAccent, link || "#19b58c")
    const brightness = luminance(bg)
    const dark = brightness === undefined
      ? document.documentElement.classList.contains("dark") || matchMedia("(prefers-color-scheme: dark)").matches
      : brightness < 0.52
    return { bg, bgAlt, surface, surface2, border, text, muted, accent, dark }
  } finally {
    probe.remove()
  }
}
