/** HYRON-CODE 0.9.2.5. Non-destructive optional vector color overlays. */
export type HyronRingColors = {
  hyronSnakeBody?: string
  hyronRingOne?: string
  hyronRingTwo?: string
  hyronRingThree?: string
}
const valid = (v: string | undefined) => !!v && /^#[0-9a-fA-F]{6}$/.test(v)
export function applyHyronRingOverlays(svg: string, colors: HyronRingColors): string {
  const shapes: string[] = []
  // Separate editable vector overlays. Source logo remains byte-for-byte unchanged.
  if (valid(colors.hyronRingOne)) shapes.push(`<ellipse id="hyron925-ring-one" cx="627" cy="627" rx="415" ry="185" transform="rotate(-22 627 627)" fill="none" stroke="${colors.hyronRingOne}" stroke-width="24" opacity=".48"/>`)
  if (valid(colors.hyronRingTwo)) shapes.push(`<ellipse id="hyron925-ring-two" cx="627" cy="627" rx="420" ry="185" transform="rotate(20 627 627)" fill="none" stroke="${colors.hyronRingTwo}" stroke-width="24" opacity=".48"/>`)
  if (valid(colors.hyronRingThree)) shapes.push(`<ellipse id="hyron925-ring-three" cx="627" cy="627" rx="168" ry="405" fill="none" stroke="${colors.hyronRingThree}" stroke-width="23" opacity=".48"/>`)
  if (valid(colors.hyronSnakeBody)) shapes.push(`<path id="hyron925-snake-body" d="M 652 1060 C 573 904 575 781 623 646 C 665 520 723 424 830 337" fill="none" stroke="${colors.hyronSnakeBody}" stroke-width="33" stroke-linecap="round" opacity=".38"/>`)
  if (!shapes.length) return svg
  return svg.replace('</svg>', `<g id="hyron925-color-overlays" style="isolation:isolate" pointer-events="none">${shapes.join('')}</g></svg>`)
}
