/** HYRON-CODE 0.9.2.9 - Perfis locais de aparencia (sem alterar temas nativos). */
import { createSignal, onMount } from "solid-js"

type Profile = { id: string; name: string; visual: Record<string, unknown>; watermark: unknown }
type Props = { getVisual: () => Record<string, unknown>; applyVisual: (value: Record<string, unknown>) => void }
const STORAGE = "hyron_code_appearance_profiles_v0929"
const WATERMARK = "hyron_code_watermark_v0928"
const LIMIT = 8
const MAX_SIZE = 1_900_000
const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v)
function readProfiles(): Profile[] {
  try {
    const content = localStorage.getItem(STORAGE)
    if (!content || content.length > MAX_SIZE) return []
    const parsed: unknown = JSON.parse(content)
    if (!Array.isArray(parsed)) return []
    return parsed.slice(0, LIMIT).filter((p): p is Profile => isObject(p)
      && typeof p.id === "string" && p.id.length < 90
      && typeof p.name === "string" && p.name.length <= 48
      && isObject(p.visual) && (p.visual.theme === "hydra" || p.visual.theme === "dark" || p.visual.theme === "light"))
      .map(p => ({ id: p.id, name: p.name, visual: p.visual, watermark: p.watermark }))
  } catch { return [] }
}
function readWatermark(): unknown {
  try { return JSON.parse(localStorage.getItem(WATERMARK) ?? "null") } catch { return null }
}
export function HyronAppearanceProfiles(props: Props) {
  const [profiles, setProfiles] = createSignal<Profile[]>([])
  const [name, setName] = createSignal("")
  const [selected, setSelected] = createSignal("")
  const [message, setMessage] = createSignal("")
  onMount(() => setProfiles(readProfiles()))
  const persist = (next: Profile[]): boolean => {
    const payload = JSON.stringify(next)
    if (payload.length > MAX_SIZE) { setMessage("Limite de armazenamento de perfis atingido. Reduza as imagens de fundo."); return false }
    try { localStorage.setItem(STORAGE, payload); setProfiles(next); return true }
    catch { setMessage("Nao foi possivel salvar. Verifique o armazenamento local."); return false }
  }
  const create = () => {
    const label = name().trim().replace(/\s+/g, " ").slice(0, 48)
    if (!label) { setMessage("Informe um nome para o perfil."); return }
    if (profiles().length >= LIMIT) { setMessage("Limite de 8 perfis atingido."); return }
    if (profiles().some(p => p.name.toLocaleLowerCase() === label.toLocaleLowerCase())) { setMessage("Ja existe um perfil com este nome."); return }
    const entry: Profile = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: label, visual: { ...props.getVisual() }, watermark: readWatermark() }
    if (persist([...profiles(), entry])) { setSelected(entry.id); setName(""); setMessage(`Perfil '${label}' salvo.`) }
  }
  const current = () => profiles().find(p => p.id === selected())
  const apply = () => {
    const p = current()
    if (!p) { setMessage("Selecione um perfil."); return }
    try {
      // Confirm both writes before publishing the new visual appearance.
      const oldWatermark = localStorage.getItem(WATERMARK)
      try {
        if (p.watermark === null || p.watermark === undefined) localStorage.removeItem(WATERMARK)
        else localStorage.setItem(WATERMARK, JSON.stringify(p.watermark))
        props.applyVisual({ ...p.visual })
      } catch (error) {
        if (oldWatermark === null) localStorage.removeItem(WATERMARK)
        else localStorage.setItem(WATERMARK, oldWatermark)
        throw error
      }
      window.dispatchEvent(new Event("hyron-appearance-profile-applied"))
      setMessage(`Perfil '${p.name}' aplicado.`)
    } catch { setMessage("Nao foi possivel aplicar o perfil. Configuracoes anteriores preservadas quando possivel.") }
  }
  const overwrite = () => {
    const p = current()
    if (!p) { setMessage("Selecione um perfil."); return }
    if (!window.confirm(`Substituir as cores e a marca-d'agua salvas em '${p.name}' pelas configuracoes atuais?`)) return
    const next = profiles().map(item => item.id === p.id ? { ...item, visual: { ...props.getVisual() }, watermark: readWatermark() } : item)
    if (persist(next)) setMessage("Perfil atualizado com a aparencia atual.")
  }
  const rename = () => {
    const p = current()
    if (!p) { setMessage("Selecione um perfil."); return }
    const label = window.prompt("Novo nome do perfil:", p.name)?.trim().replace(/\s+/g, " ").slice(0, 48)
    if (!label) return
    if (profiles().some(item => item.id !== p.id && item.name.toLocaleLowerCase() === label.toLocaleLowerCase())) { setMessage("Nome de perfil ja utilizado."); return }
    if (persist(profiles().map(item => item.id === p.id ? { ...item, name: label } : item))) setMessage("Perfil renomeado.")
  }
  const remove = () => {
    const p = current()
    if (!p) { setMessage("Selecione um perfil."); return }
    if (!window.confirm(`Excluir o perfil '${p.name}'? Sua aparencia atual nao sera modificada.`)) return
    if (persist(profiles().filter(item => item.id !== p.id))) { setSelected(""); setMessage("Perfil excluido.") }
  }
  const buttonStyle = { padding: "7px 10px", border: "1px solid currentColor", "border-radius": "7px", cursor: "pointer" }
  return <fieldset class="hyron-appearance-profiles" style={{ border: "1px solid var(--v2-border-border-base, #4b6158)", "border-radius": "10px", padding: "12px", "margin-top": "14px", display: "grid", gap: "10px" }}>
    <legend style={{ padding: "0 6px", "font-weight": "600" }}>Perfis de aparencia (0.9.2.9)</legend>
    <small>Salve e alterne entre ate 8 conjuntos de tema, cores, fundos, logo orbital e marca-d'agua. Nao altera sessoes nem codigo.</small>
    <label style={{ display: "grid", gap: "5px" }}>Nome do novo perfil
      <input type="text" maxlength="48" value={name()} placeholder="Ex.: HYRON Verde" onInput={e => setName(e.currentTarget.value)} style={{ padding: "7px", border: "1px solid currentColor", "border-radius": "6px", "background-color": "transparent" }}/>
    </label>
    <button type="button" style={buttonStyle} onClick={create}>Salvar aparencia atual como novo perfil</button>
    <label style={{ display: "grid", gap: "5px" }}>Perfil salvo ({profiles().length}/{LIMIT})
      <select value={selected()} onChange={e => setSelected(e.currentTarget.value)} style={{ padding: "7px", border: "1px solid currentColor", "border-radius": "6px", "background-color": "var(--hyron-surface, #102820)" }}>
        <option value="">Selecione...</option>
        {profiles().map(p => <option value={p.id}>{p.name}</option>)}
      </select>
    </label>
    <div style={{ display: "flex", "flex-wrap": "wrap", gap: "8px" }}>
      <button type="button" style={buttonStyle} disabled={!selected()} onClick={apply}>Aplicar perfil</button>
      <button type="button" style={buttonStyle} disabled={!selected()} onClick={overwrite}>Atualizar perfil</button>
      <button type="button" style={buttonStyle} disabled={!selected()} onClick={rename}>Renomear</button>
      <button type="button" style={buttonStyle} disabled={!selected()} onClick={remove}>Excluir</button>
    </div>
    <small role="status" style={{ opacity: "0.8" }}>{message()}</small>
  </fieldset>
}
