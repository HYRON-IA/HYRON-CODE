import { createSignal, onMount, onCleanup, Show } from "solid-js"
import { HyronPersonalitySettings } from "@/settings/appearance/hyron-personality"
import { HyronPersonalityStudio } from "@/settings/appearance/hyron-personality-studio"
import { HyronVisualCatalog } from "@/shell/hyron-visual-catalog"

export function HyronPersonalityDrawer() {
  const [open, setOpen] = createSignal(false)
  const [catalog, setCatalog] = createSignal(false)
  onMount(() => {
    const toggle = () => setOpen(value => !value)
    const esc = (event: KeyboardEvent) => { if (event.key === "Escape") { if (catalog()) setCatalog(false); else setOpen(false) } }
    window.addEventListener("hyroncode:toggle-personality-panel", toggle)
    window.addEventListener("keydown", esc)
    onCleanup(() => { window.removeEventListener("hyroncode:toggle-personality-panel", toggle); window.removeEventListener("keydown", esc) })
  })
  return <>
    <Show when={open()}>
      <aside data-slot="hyroncode-personality-drawer" aria-label="Painel de personalidade" role="dialog" aria-modal="false"
        class="fixed right-0 bottom-0 z-[80] flex flex-col bg-v2-background-bg-deep text-v2-text-strong border-l border-v2-border-base shadow-2xl"
        style={{ top: "var(--hyroncode-drawer-top, 48px)", width: "min(50vw, 920px)", "min-width": "min(440px, 100vw)", "max-width": "100vw" }}>
        <header class="flex shrink-0 items-center justify-between px-5 py-4 border-b border-v2-border-base">
          <div class="flex flex-col gap-1"><strong>Personalidade · HYRONCODE</strong><span class="text-xs text-v2-text-muted">Configurações rápidas e estúdio</span></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fechar painel de personalidade" class="rounded-md px-3 py-2 hover:bg-v2-background-bg-hover">✕</button>
        </header>
        <div class="px-5 py-3 border-b border-v2-border-base">
          <button type="button" class="w-full rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-medium py-3" onClick={() => setCatalog(true)}>▦ Explorar catálogo visual · 3 × 5</button>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 [&_input]:select-text [&_textarea]:select-text">
          <HyronPersonalitySettings />
          <HyronPersonalityStudio />
        </div>
      </aside>
    </Show>
    <Show when={catalog()}><HyronVisualCatalog onClose={() => setCatalog(false)} /></Show>
  </>
}
