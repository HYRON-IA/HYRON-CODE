import { HYRON_KEY } from "./hyron-global"
import { renderOrbitalLogo, type OrbitalColors } from "./hyron-orbital-colors"

let generation = 0

export function updateHyronDesktopIcon() {
  const bridge = (window as Window & { electron?: { setHyronIcon?: (png: string) => void } }).electron
  if (!bridge?.setHyronIcon) return
  const current = ++generation
  let colors: OrbitalColors = {}
  try {
    const raw = window.localStorage.getItem(HYRON_KEY)
    if (raw) {
      const data: unknown = JSON.parse(raw)
      if (data && typeof data === "object") colors = data as OrbitalColors
    }
  } catch {
    // Retain the original colors when saved preferences are corrupt.
  }

  const svg = renderOrbitalLogo(colors)
  const blob = new Blob([svg], { type: "image/svg+xml" })
  const url = URL.createObjectURL(blob)
  const image = new Image()
  image.onload = () => {
    URL.revokeObjectURL(url)
    if (current !== generation) return
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 256
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(image, 0, 0, 256, 256)
    /* HYRON-CODE 0.9.2.7 - sync visual */
    // Reuse the SAME rendered image already used for the Electron window icon.
    // This only changes a CSS custom property; it does not touch chat content.
    const hyronBrandPng = canvas.toDataURL("image/png")
    document.documentElement.style.setProperty("--hyron-dynamic-brand-image", `url("${hyronBrandPng}")`)
    bridge.setHyronIcon?.(canvas.toDataURL("image/png"))
  }
  image.onerror = () => URL.revokeObjectURL(url)
  image.src = url
}
