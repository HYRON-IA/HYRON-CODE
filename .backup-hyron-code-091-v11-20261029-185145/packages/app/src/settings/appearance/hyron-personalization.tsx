import { applyHyronVisual, normalizeVisual, HYRON_KEY } from "./hyron-global"
import { createSignal, onMount, onCleanup, Show } from "solid-js"
import "./hyron-personalization.css"

/** HYRON Code 0.9.1. Preferências locais, independentes do motor OpenCode. */
type Theme = "hydra" | "dark" | "light"
type Background = "theme" | "solid" | "gradient" | "image"
type Prefs = {
  theme: Theme
  accent: string
  icon: string
  surface: string
  background: Background
  color: string
  color2: string
  angle: number
  image?: string
  chatBackground?: "inherit" | "solid" | "gradient" | "image"
  chatColor?: string
  chatColor2?: string
  chatAngle?: number
  chatImage?: string
  messageColor?: string
}
const KEY = HYRON_KEY
const presets: Record<Theme, Omit<Prefs, "theme" | "background" | "color" | "color2" | "angle"> & { canvas: string }> = {
  hydra: { canvas: "#071310", surface: "#102820", accent: "#78e6cd", icon: "#78e6cd" },
  dark: { canvas: "#101114", surface: "#1b1d23", accent: "#a8b8ff", icon: "#a8b8ff" },
  light: { canvas: "#eff2f5", surface: "#ffffff", accent: "#196e5e", icon: "#196e5e" },
}
const defaults: Prefs = { theme: "hydra", accent: "#78e6cd", icon: "#78e6cd", surface: "#102820", background: "theme", color: "#102820", color2: "#184b3e", angle: 135 }
const valid = (color: unknown): color is string => typeof color === "string" && /^#[a-fA-F0-9]{6}$/.test(color)
function normalize(input: unknown): Prefs {
  const p = input && typeof input === "object" ? input as Partial<Prefs> : {}
  const theme: Theme = p.theme && Object.hasOwn(presets, p.theme) ? p.theme : "hydra"
  const ref = presets[theme]
  return {
    theme,
    accent: valid(p.accent) ? p.accent : ref.accent,
    icon: valid(p.icon) ? p.icon : ref.icon,
    surface: valid(p.surface) ? p.surface : ref.surface,
    background: ["theme", "solid", "gradient", "image"].includes(p.background ?? "") ? p.background! : "theme",
    color: valid(p.color) ? p.color : defaults.color,
    color2: valid(p.color2) ? p.color2 : defaults.color2,
    angle: typeof p.angle === "number" && Number.isFinite(p.angle) ? Math.max(0, Math.min(360, Math.round(p.angle))) : 135,
    image: typeof p.image === "string" && p.image.startsWith("data:image/") && p.image.length < 900_000 ? p.image : undefined,
    chatBackground: p.chatBackground === "solid" || p.chatBackground === "gradient" || p.chatBackground === "image" ? p.chatBackground : "inherit",
    chatColor: valid(p.chatColor) ? p.chatColor : "#102820",
    chatColor2: valid(p.chatColor2) ? p.chatColor2 : "#184b3e",
    chatAngle: typeof p.chatAngle === "number" && Number.isFinite(p.chatAngle) ? Math.max(0, Math.min(360, Math.round(p.chatAngle))) : 135,
    chatImage: typeof p.chatImage === "string" && p.chatImage.startsWith("data:image/") && p.chatImage.length < 900_000 ? p.chatImage : undefined,
    messageColor: valid(p.messageColor) ? p.messageColor : undefined,
  }
}
function background(p: Prefs): string {
  if (p.background === "solid") return p.color
  if (p.background === "gradient") return `linear-gradient(${p.angle}deg, ${p.color}, ${p.color2})`
  if (p.background === "image" && p.image) return `url("${p.image}") center / cover no-repeat`
  return presets[p.theme].canvas
}
function paint(p: Prefs) {
  applyHyronVisual(normalizeVisual(p))
}
export function HyronPersonalization() {
  const [prefs, setPrefs] = createSignal<Prefs>(defaults)
  const [message, setMessage] = createSignal("")
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  onMount(() => {
    try { const saved = localStorage.getItem(KEY); if (saved) setPrefs(normalize(JSON.parse(saved))) }
    catch { setMessage("Preferências anteriores indisponíveis; usando valores padrão.") }
    paint(prefs())
  })
  onCleanup(() => { if (saveTimer) clearTimeout(saveTimer) })
  const update = (change: Partial<Prefs>) => {
    const next = normalize({ ...prefs(), ...change })
    setPrefs(next)
    paint(next)
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(next)); setMessage("Preferências salvas neste navegador.") }
      catch { setMessage("Não foi possível salvar. Reduza a imagem de fundo ou verifique o armazenamento.") }
    }, 250)
  }
  const changeTheme = (theme: Theme) => update({ theme, accent: presets[theme].accent, icon: presets[theme].icon, surface: presets[theme].surface })
  const upload = async (file?: File, target: "global" | "chat" = "global") => {
    if (!file) return
    if (!file.type.startsWith("image/") || file.size > 600_000) { setMessage("Use uma imagem de até 600 KB."); return }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        if (target === "chat") update({ chatImage: reader.result, chatBackground: "image" })
        else update({ image: reader.result, background: "image" })
      }
    }
    reader.onerror = () => setMessage("Falha na leitura da imagem.")
    reader.readAsDataURL(file)
  }
  return <section class="hyron-customizer" aria-label="Personalização visual HYRON Code">
    <div class="hyron-customizer__heading"><strong>Personalização HYRON Code</strong><span>Prévia e preferências locais; layout original preservado.</span></div>
    <div class="hyron-customizer__preview" style={{ "--hy-preview-bg": background(prefs()), "--hy-preview-surface": prefs().surface, "--hy-preview-accent": prefs().accent, "--hy-preview-icon": prefs().icon }}>
      <div class="hyron-customizer__sidebar"><span>◆ HYRON Code</span><small>▸ explorer</small><small>▸ src</small><small>　main.ts</small></div>
      <div class="hyron-customizer__editor"><div>main.ts</div><code>const agent = "HYRON";</code><p>Pronto para programar.</p></div>
    </div>
    <div class="hyron-customizer__controls">
      <label>Tema <select value={prefs().theme} onChange={e => changeTheme(e.currentTarget.value as Theme)}><option value="hydra">Hydra</option><option value="dark">Escuro</option><option value="light">Claro</option></select></label>
      <label>Cor principal <input type="color" value={prefs().accent} onInput={e => update({ accent: e.currentTarget.value })}/></label>
      <label>Cor do ícone <input type="color" value={prefs().icon} onInput={e => update({ icon: e.currentTarget.value })}/></label>
      <label>Superfícies <input type="color" value={prefs().surface} onInput={e => update({ surface: e.currentTarget.value })}/></label>
      <label>Tipo de fundo <select value={prefs().background} onChange={e => update({ background: e.currentTarget.value as Background })}><option value="theme">Tema</option><option value="solid">Sólido</option><option value="gradient">Degradê</option><option value="image">Imagem</option></select></label>
      <Show when={prefs().background === "solid" || prefs().background === "gradient"}><label>Cor de fundo <input type="color" value={prefs().color} onInput={e => update({color:e.currentTarget.value})}/></label></Show>
      <Show when={prefs().background === "gradient"}><label>Segunda cor <input type="color" value={prefs().color2} onInput={e => update({color2:e.currentTarget.value})}/></label><label>Ângulo ({prefs().angle}°) <input type="range" min="0" max="360" step="5" value={prefs().angle} onInput={e => update({angle:Number(e.currentTarget.value)})}/></label></Show>
      <Show when={prefs().background === "image"}><label>Imagem (até 600 KB) <input type="file" accept="image/*" onChange={e => void upload(e.currentTarget.files?.[0])}/></label></Show>
    </div>
    <fieldset class="hyron-customizer__controls" style={{ border: "1px solid var(--v2-border-border-base, #4b6158)", "border-radius": "10px", padding: "12px", "margin-top": "14px" }}>
      <legend style={{ padding: "0 6px", "font-weight": "600" }}>Fundo das conversas e mensagens</legend>
      <label>Fundo da conversa
        <select value={prefs().chatBackground ?? "inherit"} onChange={e => update({ chatBackground: e.currentTarget.value as Prefs["chatBackground"] })}>
          <option value="inherit">Usar fundo do tema</option><option value="solid">Sólido</option><option value="gradient">Degradê</option><option value="image">Imagem</option>
        </select>
      </label>
      <Show when={prefs().chatBackground !== "inherit"}>
        <label>Cor de fundo da conversa <input type="color" value={prefs().chatColor ?? "#102820"} onInput={e => update({ chatColor: e.currentTarget.value })} /></label>
      </Show>
      <Show when={prefs().chatBackground === "gradient"}>
        <label>Segunda cor <input type="color" value={prefs().chatColor2 ?? "#184b3e"} onInput={e => update({ chatColor2: e.currentTarget.value })} /></label>
        <label>Ângulo ({prefs().chatAngle ?? 135}°) <input type="range" min="0" max="360" step="5" value={prefs().chatAngle ?? 135} onInput={e => update({ chatAngle: Number(e.currentTarget.value) })} /></label>
      </Show>
      <Show when={prefs().chatBackground === "image"}>
        <label>Imagem da conversa (até 600 KB) <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => void upload(e.currentTarget.files?.[0], "chat")} /></label>
      </Show>
      <label>Balões do usuário
        <select value={prefs().messageColor ? "custom" : "theme"} onChange={e => update({ messageColor: e.currentTarget.value === "theme" ? undefined : "#253d35" })}>
          <option value="theme">Cores originais</option><option value="custom">Personalizar</option>
        </select>
      </label>
      <Show when={prefs().messageColor}>
        <label>Cor do balão <input type="color" value={prefs().messageColor ?? "#253d35"} onInput={e => update({ messageColor: e.currentTarget.value })} /></label>
      </Show>
    </fieldset>
    <div class="hyron-customizer__footer"><button type="button" onClick={() => {update({...defaults, image:undefined});setMessage("Padrão Hydra restaurado.")}}>Restaurar padrão</button><small role="status">{message()}</small></div>
  </section>
}
