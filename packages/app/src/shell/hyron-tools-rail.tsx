import { createSignal, Show, onMount } from "solid-js"
import { useSettingsSurface } from "@/settings/surface"

/** Navigation only; personality opens an independent right overlay. */
export function HyronToolsRail() {
  const settings = useSettingsSurface()
  const [expanded, setExpanded] = createSignal(false)
  onMount(() => {
    try { setExpanded(localStorage.getItem("hyroncode.tools.left.expanded") === "true") } catch { /* optional */ }
  })
  const toggle = () => {
    const next = !expanded()
    setExpanded(next)
    try { localStorage.setItem("hyroncode.tools.left.expanded", String(next)) } catch { /* optional */ }
  }
  return (
    <aside data-slot="hyroncode-tools-left" aria-label="Ferramentas HYRONCODE" class="hidden md:flex shrink-0 flex-col items-start border-e border-v2-border-base bg-v2-background-bg-deep py-3 px-1.5 gap-2" style={{ width: expanded() ? "172px" : "44px", transition: "width 160ms ease" }}>
      <button type="button" onClick={toggle} aria-label={expanded() ? "Recolher ferramentas" : "Expandir ferramentas"} aria-expanded={expanded()} class="h-8 w-full rounded-md text-v2-text-muted hover:bg-v2-background-bg-hover text-sm text-start px-2" title="Ferramentas">☰<Show when={expanded()}><span class="ms-2">Ferramentas</span></Show></button>
      <button type="button" onClick={() => window.dispatchEvent(new Event("hyroncode:toggle-personality-panel"))} class="h-9 w-full rounded-md text-v2-text-strong hover:bg-v2-background-bg-hover text-sm text-start px-2 whitespace-nowrap" title="Personalidade" aria-label="Abrir painel de personalidade">◈<Show when={expanded()}><span class="ms-2">Personalidade</span></Show></button>
      <button type="button" onClick={() => settings.open("appearance")} class="h-9 w-full rounded-md text-v2-text-strong hover:bg-v2-background-bg-hover text-sm text-start px-2 whitespace-nowrap" title="Aparência" aria-label="Abrir aparência">◉<Show when={expanded()}><span class="ms-2">Aparência</span></Show></button>
    </aside>
  )
}
