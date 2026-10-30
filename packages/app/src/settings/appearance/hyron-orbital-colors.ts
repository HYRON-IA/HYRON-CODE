import logoSvg from "./hyron-code-logo.svg?raw"
import { applyHyronRingOverlays, type HyronRingColors } from "./hyron-ring-overlays"
export type OrbitalColors = HyronRingColors & { sphereTL?: string; sphereTR?: string; sphereBL?: string; sphereBR?: string; sphereCore?: string; snakeEye?: string }
const groups = { sphereTL: "cor-esfera-superior-esquerda", sphereTR: "cor-esfera-superior-direita", sphereBL: "cor-esfera-inferior-esquerda", sphereBR: "cor-esfera-inferior-direita", sphereCore: "cor-nucleo-central", snakeEye: "cor-olho-cobra" } as const
export function renderOrbitalLogo(colors: OrbitalColors): string {
  let svg = logoSvg
  for (const key of Object.keys(groups) as (keyof typeof groups)[]) {
    const color = colors[key]
    if (!color || !/^#[a-fA-F0-9]{6}$/.test(color)) continue
    const id = groups[key]
    const pattern = new RegExp(`(<g id="${id}" opacity=")0("[^>]*>)([\\s\\S]*?)(<\/g>)`)
    svg = svg.replace(pattern, (_match, before: string, after: string, inside: string, close: string) => {
      const colored = inside.replace(/(fill|stroke)="#[a-fA-F0-9]{6}"/g, (_s: string, attribute: string) => `${attribute}="${color}"`)
      return `${before}1${after}${colored}${close}`
    })
  }
  return applyHyronRingOverlays(svg, colors)
}
