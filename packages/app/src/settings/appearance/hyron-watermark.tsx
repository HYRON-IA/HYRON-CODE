/** HYRON-CODE 0.9.2.8 - Controles isolados da marca-d'agua. */
import { createSignal, onMount, onCleanup, Show } from "solid-js"

const KEY = "hyron_code_watermark_v0928"
type Position = "center" | "top" | "bottom"
type Config = { visible: boolean; opacity: number; size: number; position: Position }
const DEFAULT: Config = { visible: true, opacity: 12, size: 260, position: "center" }
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
function normalize(raw: unknown): Config {
  if (!raw || typeof raw !== "object") return { ...DEFAULT }
  const v = raw as Partial<Config>
  return {
    visible: typeof v.visible === "boolean" ? v.visible : DEFAULT.visible,
    opacity: typeof v.opacity === "number" && Number.isFinite(v.opacity) ? clamp(v.opacity, 0, 60) : DEFAULT.opacity,
    size: typeof v.size === "number" && Number.isFinite(v.size) ? clamp(v.size, 120, 500) : DEFAULT.size,
    position: v.position === "top" || v.position === "bottom" ? v.position : "center",
  }
}
function read(): Config {
  try { return normalize(JSON.parse(window.localStorage.getItem(KEY) ?? "null")) }
  catch { return { ...DEFAULT } }
}
export function applyHyronWatermark(config: Config) {
  if (typeof document === "undefined") return
  const el = document.documentElement
  el.style.setProperty("--hyron-watermark-opacity", String(config.visible ? config.opacity / 100 : 0))
  el.style.setProperty("--hyron-watermark-size", `${config.size}px`)
  el.style.setProperty("--hyron-watermark-top", config.position === "top" ? "24%" : config.position === "bottom" ? "72%" : "48%")
  el.dataset.hyronWatermark = config.visible ? "visible" : "hidden"
}
export function restoreHyronWatermark() {
  if (typeof window === "undefined") return
  applyHyronWatermark(read())
}
export function HyronWatermarkSettings() {
  const [value, setValue] = createSignal<Config>(typeof window === "undefined" ? DEFAULT : read())
  const [saved, setSaved] = createSignal("")
  const sync = () => setValue(read())
  const syncProfile = () => { const next = read(); setValue(next); applyHyronWatermark(next) }
  onMount(() => {
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("hyron-appearance-profile-applied", syncProfile) // HYRON-CODE 0.9.2.9 - profiles
    onCleanup(() => { window.removeEventListener("storage", sync); window.removeEventListener("hyron-appearance-profile-applied", syncProfile) })
  })
  const update = (next: Partial<Config>) => {
    const config = normalize({ ...value(), ...next })
    setValue(config)
    applyHyronWatermark(config)
    try {
      window.localStorage.setItem(KEY, JSON.stringify(config))
      setSaved("Configuração salva automaticamente.")
    } catch { setSaved("Não foi possível salvar esta configuração.") }
  }
  return (
    <fieldset class="hyron-watermark-settings" style={{ border: "1px solid var(--v2-border-border-base, #4b6158)", "border-radius": "10px", padding: "12px", "margin-top": "14px", display: "grid", gap: "12px" }}>
      <legend style={{ padding: "0 6px", "font-weight": "600" }}>Marca-d'água das conversas</legend>
      <label style={{ display: "flex", gap: "8px", "align-items": "center" }}>
        <input type="checkbox" checked={value().visible} onChange={(e) => update({ visible: e.currentTarget.checked })} /> Exibir marca-d'água
      </label>
      <Show when={value().visible}>
        <label style={{ display: "grid", gap: "6px" }}>
          Opacidade: {value().opacity}%
          <input aria-label="Opacidade da marca-d'água" type="range" min="0" max="60" step="1" value={value().opacity} onInput={(e) => update({ opacity: Number(e.currentTarget.value) })} />
        </label>
        <label style={{ display: "grid", gap: "6px" }}>
          Tamanho: {value().size}px
          <input aria-label="Tamanho da marca-d'água" type="range" min="120" max="500" step="10" value={value().size} onInput={(e) => update({ size: Number(e.currentTarget.value) })} />
        </label>
        <label style={{ display: "grid", gap: "6px" }}>
          Posição
          <select aria-label="Posição da marca-d'água" value={value().position} onChange={(e) => update({ position: e.currentTarget.value as Position })}>
            <option value="top">Superior</option>
            <option value="center">Central</option>
            <option value="bottom">Inferior</option>
          </select>
        </label>
      </Show>
      <button type="button" style={{ "text-decoration": "underline", "text-align": "left", "font-size": "12px" }} onClick={() => update(DEFAULT)}>Restaurar padrão da marca-d'água</button>
      <small role="status" style={{ opacity: "0.75" }}>{saved()}</small>
    </fieldset>
  )
}
