import { createSignal, onCleanup, onMount, type ComponentProps } from "solid-js"
import { colorizeCobraSvg } from "./hyron-cobra"

const PREF_KEY = "hyron_code_appearance_v091"
const DEFAULT_COLORS = { body: "#00cfea", eyes: "#f1cf13", stripes: "#660000", background: "#000000" }
function readColors() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}")
    const valid = (value: unknown, fallback: string) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
    return {
      body: valid(raw.logoBody, DEFAULT_COLORS.body),
      eyes: valid(raw.logoEyes, DEFAULT_COLORS.eyes),
      stripes: valid(raw.logoStripes, DEFAULT_COLORS.stripes),
      background: valid(raw.logoBackground, DEFAULT_COLORS.background),
    }
  } catch { return DEFAULT_COLORS }
}
function useCobra() {
  const make = () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(colorizeCobraSvg(readColors()))}`
  const [src, setSrc] = createSignal("")
  onMount(() => {
    const refresh = () => setSrc(make())
    refresh()
    window.addEventListener("hyron-brand-change", refresh)
    window.addEventListener("storage", refresh)
    onCleanup(() => {
      window.removeEventListener("hyron-brand-change", refresh)
      window.removeEventListener("storage", refresh)
    })
  })
  return src
}
export const Mark = (props: { class?: string }) => {
  const src = useCobra()
  return <svg data-component="logo-mark" classList={{ [props.class ?? ""]: !!props.class }} viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg"><image href={src()} width="16" height="20" preserveAspectRatio="xMidYMid meet" /></svg>
}
export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  const src = useCobra()
  return <svg ref={props.ref} data-component="logo-splash" classList={{ [props.class ?? ""]: !!props.class }} viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg"><image href={src()} width="80" height="100" preserveAspectRatio="xMidYMid meet" /></svg>
}
export const Logo = (props: { class?: string }) => {
  const src = useCobra()
  return <svg data-component="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 234 42" fill="none" classList={{ [props.class ?? ""]: !!props.class }}>
    <image href={src()} x="0" y="0" width="42" height="42" preserveAspectRatio="xMidYMid meet" />
    <text x="50" y="28" font-size="24" font-family="system-ui, sans-serif" font-weight="700" fill="var(--icon-strong-base, currentColor)">HYRON Code</text>
  </svg>
}
