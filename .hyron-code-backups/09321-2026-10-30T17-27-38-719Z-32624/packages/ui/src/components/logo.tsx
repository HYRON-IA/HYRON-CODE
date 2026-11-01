import { createSignal, onCleanup, onMount, type ComponentProps } from "solid-js"
import { HYRON_CODE_MARK } from "./hyron-code-official-mark"

function useCobra() {
  const make = () => HYRON_CODE_MARK
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
    <text x="50" y="28" font-size="24" font-family="system-ui, sans-serif" font-weight="700" fill="var(--icon-strong-base, currentColor)">HYRON-CODE</text>
  </svg>
}
