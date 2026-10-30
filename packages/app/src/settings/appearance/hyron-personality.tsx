import { createSignal, onMount } from "solid-js"

// HYRON-CODE 0.9.3.1: preferences only affect new submitted prompts.
export const HYRON_PERSONALITY_KEY = "hyron-code-personality-v1"
type Mode = "oficial" | "tecnico" | "objetivo" | "personalizado"
type Personality = { enabled: boolean; mode: Mode; custom: string }
const defaults: Personality = { enabled: true, mode: "oficial", custom: "" }
const directives: Record<Exclude<Mode, "personalizado">, string> = {
  oficial: "Adote a identidade conversacional HYRON-CODE: colaborativo, seguro, tecnicamente preciso e com humor pontual. Fale em portugues brasileiro quando o usuario usar portugues. Seja claro, proativo e respeitoso. Nao afirme que executou testes ou alteracoes sem evidencia. Em programacao, priorize codigo correto e verificavel.",
  tecnico: "Priorize explicacoes tecnicas precisas, rastreabilidade, codigos verificaveis e consideracoes de compatibilidade. Evite humor desnecessario e nao alegue testes nao executados.",
  objetivo: "Responda de forma concisa, direta, orientada a acao, sem perder informacoes tecnicas essenciais. Nao invente resultados de execucao.",
}
function parse(raw: string | null): Personality {
  if (!raw) return defaults
  try {
    const item: unknown = JSON.parse(raw)
    if (!item || typeof item !== "object") return defaults
    const value = item as Partial<Personality>
    const mode = value.mode
    return {
      enabled: typeof value.enabled === "boolean" ? value.enabled : true,
      mode: mode === "oficial" || mode === "tecnico" || mode === "objetivo" || mode === "personalizado" ? mode : "oficial",
      custom: typeof value.custom === "string" ? value.custom.slice(0, 1200) : "",
    }
  } catch { return defaults }
}
export function readHyronPersonalityInstruction(): string {
  if (typeof window === "undefined") return ""
  let value = defaults
  try { value = parse(localStorage.getItem(HYRON_PERSONALITY_KEY)) } catch { return "" }
  if (!value.enabled) return ""
  if (value.mode === "personalizado") return value.custom.trim().slice(0, 1200)
  return directives[value.mode]
}

export function HyronPersonalitySettings() {
  const [prefs, setPrefs] = createSignal<Personality>(defaults)
  const [status, setStatus] = createSignal("")
  onMount(() => { try { setPrefs(parse(localStorage.getItem(HYRON_PERSONALITY_KEY))) } catch { setStatus("Armazenamento local indisponivel.") } })
  const update = (change: Partial<Personality>) => {
    const next = { ...prefs(), ...change }
    try { localStorage.setItem(HYRON_PERSONALITY_KEY, JSON.stringify(next)); setPrefs(next); setStatus("Personalidade salva para novas mensagens.") }
    catch { setStatus("Nao foi possivel salvar a personalidade.") }
  }
  return <section data-slot="hyron-personality" style={{ padding: "18px", border: "1px solid var(--border-base, #35564c)", "border-radius": "12px", display: "grid", gap: "12px", "margin-top": "16px" }}>
    <div><strong>Personalidade HYRON-CODE — 0.9.3.1</strong><p style={{ opacity: "0.75", "font-size": "12px", margin: "4px 0 0" }}>Define o estilo das novas respostas. Nao altera conversas anteriores nem substitui as instrucoes dos agentes.</p></div>
    <label style={{ display: "flex", gap: "8px", "align-items": "center" }}><input type="checkbox" checked={prefs().enabled} onChange={e => update({ enabled: e.currentTarget.checked })} />Ativar personalidade nas novas mensagens</label>
    <label style={{ display: "grid", gap: "6px" }}>Perfil de comunicacao
      <select disabled={!prefs().enabled} value={prefs().mode} onChange={e => update({ mode: e.currentTarget.value as Mode })} style={{ padding: "8px", background: "var(--background-base, #102820)", color: "inherit", border: "1px solid var(--border-base, #35564c)", "border-radius": "6px" }}>
        <option value="oficial">Oficial HYRON-CODE</option><option value="tecnico">Tecnico</option><option value="objetivo">Objetivo</option><option value="personalizado">Personalizado</option>
      </select>
    </label>
    {prefs().mode === "personalizado" && <label style={{ display: "grid", gap: "6px" }}>Instrucoes personalizadas (ate 1.200 caracteres)
      <textarea disabled={!prefs().enabled} value={prefs().custom} maxlength={1200} rows={5} onInput={e => update({ custom: e.currentTarget.value })} style={{ padding: "8px", background: "var(--background-base, #102820)", color: "inherit", border: "1px solid var(--border-base, #35564c)", "border-radius": "6px" }} />
    </label>}
    <span aria-live="polite" style={{ "font-size": "12px", opacity: "0.8" }}>{status()}</span>
  </section>
}
