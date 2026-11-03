import { createSignal, onMount, For, Show } from "solid-js"
import { studioCatalog } from "./hyron-studio-catalog"

const KEY = "hyroncode-studio-personality-v1"
const MAX = 100
const LIMIT = 1500
type Custom = { id: string; name: string; description: string }
type Stored = { active: boolean; selected: string; rude: number; custom: Custom[] }
const empty: Stored = { active: false, selected: "AR-011", rude: 0, custom: [] }
const clamp = (n: unknown) => typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(5, Math.round(n))) : 0
function decode(raw: string | null): Stored {
  if (!raw) return { ...empty, custom: [] }
  try {
    const x = JSON.parse(raw) as Partial<Stored>
    if (!x || typeof x !== "object") return { ...empty, custom: [] }
    const custom = Array.isArray(x.custom) ? x.custom.filter((i): i is Custom => !!i && typeof i.id === "string" && i.id.startsWith("USER-") && typeof i.name === "string" && typeof i.description === "string").slice(0, MAX).map(i => ({ id: i.id.slice(0, 90), name: i.name.slice(0, 80), description: i.description.slice(0, LIMIT) })) : []
    return { active: x.active === true, selected: typeof x.selected === "string" ? x.selected : empty.selected, rude: clamp(x.rude), custom }
  } catch { return { ...empty, custom: [] } }
}
export function readHyronStudioInstruction(): string | undefined {
  if (typeof window === "undefined") return
  let p: Stored
  try { p = decode(localStorage.getItem(KEY)) } catch { return }
  if (!p.active) return
  const item = studioCatalog.find(i => i.id === p.selected)
  const mine = p.custom.find(i => i.id === p.selected)
  if (!item && !mine) return
  const style = item ? `Perfil inspirado em ${item.name} (${item.origin}). Tracos: ${item.description}. Diretriz: ${item.instruction}` : `Personagem original ${mine!.name}. Descricao fornecida pelo usuario: ${mine!.description}`
  const scale = ["formal, sem insultos nem palavroes", "levemente informal, sem palavroes", "deboche amistoso leve", "sarcasmo e broncas bem-humoradas", "linguagem acida e palavroes ocasionais", "linguagem irreverente e palavroes frequentes em contextos descontraidos"][p.rude]
  return `Voce e o assistente HYRONCODE. Adote estilo de comunicacao, sem fingir ser literalmente uma pessoa real ou personagem protegido. ${style}. Nivel de irreverencia ${p.rude}/5: ${scale}. Nao dirija ataques a grupos protegidos, ameacas ou assedio. Separar interpretacao de opiniao factual; nao comprometer veracidade, seguranca, instrucao tecnica ou regras superiores.`.slice(0, 2600)
}
export function HyronPersonalityStudio() {
  const [state, setState] = createSignal<Stored>({ ...empty, custom: [] })
  const [query, setQuery] = createSignal("")
  const [group, setGroup] = createSignal("Todos")
  const [name, setName] = createSignal("")
  const [description, setDescription] = createSignal("")
  const [editing, setEditing] = createSignal("")
  const [message, setMessage] = createSignal("")
  let importer: HTMLInputElement | undefined
  onMount(() => { try { setState(decode(localStorage.getItem(KEY))) } catch { setMessage("Armazenamento indisponivel") } })
  const save = (next: Stored) => {
    try { localStorage.setItem(KEY, JSON.stringify(next)); setState(next); window.dispatchEvent(new Event("hyron-personality-change")); setMessage("Preferencia salva para as proximas mensagens.") }
    catch { setMessage("Falha ao salvar. Verifique o armazenamento local.") }
  }
  const all = () => [...studioCatalog, ...state().custom.map(i => ({ id: i.id, name: i.name, description: i.description, group: "Meus perfis", origin: "Original", instruction: i.description }))]
  const visible = () => all().filter(i => (group() === "Todos" || i.group === group()) && `${i.name} ${i.origin}`.toLocaleLowerCase().includes(query().toLocaleLowerCase())).slice(0, 120)
  const selected = () => all().find(i => i.id === state().selected)
  const draft = () => { const chosen = state().custom.find(i => i.id === state().selected); if (chosen) { setEditing(chosen.id); setName(chosen.name); setDescription(chosen.description) } else { setEditing(""); setName(""); setDescription("") } }
  const storeCustom = () => {
    const n = name().trim().slice(0, 80), d = description().trim().slice(0, LIMIT)
    if (!n || !d) { setMessage("Preencha nome e descricao."); return }
    const current = state().custom
    if (!editing() && current.length >= MAX) { setMessage("Limite de 100 perfis personalizados."); return }
    const id = editing() || `USER-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
    const custom = editing() ? current.map(i => i.id === id ? { id, name: n, description: d } : i) : [...current, { id, name: n, description: d }]
    save({ ...state(), active: true, custom, selected: id }); setEditing(""); setName(""); setDescription("")
  }
  const download = () => {
    const blob = new Blob([JSON.stringify({ format: "hyroncode-studio-profiles", version: 1, profiles: state().custom }, null, 2)], { type: "application/json" })
    const link = document.createElement("a"); const url = URL.createObjectURL(blob); link.href = url; link.download = "HYRONCODE-personalidades.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1500)
  }
  const importProfiles = async (file?: File) => {
    if (!file) return
    if (file.size > 150000) { setMessage("Arquivo muito grande (limite 150 KB)."); return }
    try {
      const data: unknown = JSON.parse(await file.text())
      if (!data || typeof data !== "object") throw Error("Formato invalido")
      const obj = data as { format?: unknown; version?: unknown; profiles?: unknown }
      if (obj.format !== "hyroncode-studio-profiles" || obj.version !== 1 || !Array.isArray(obj.profiles)) throw Error("Formato ou versao incompativel")
      const entries = obj.profiles
      if (entries.length > MAX) throw Error("Numero de perfis invalido")
      const combined = [...state().custom]
      for (const p of entries) {
        if (!p || typeof p.name !== "string" || typeof p.description !== "string" || !p.name.trim() || !p.description.trim()) throw Error("Perfil invalido")
        if (p.name.length > 80 || p.description.length > LIMIT) throw Error("Perfil excede limites")
        if (combined.length >= MAX) throw Error("Limite de 100 perfis personalizados")
        combined.push({ id: `USER-${Date.now().toString(36)}-${combined.length}`, name: p.name, description: p.description })
      }
      save({ ...state(), custom: combined }); setMessage(`${entries.length} perfis importados.`)
    } catch (e) { setMessage(e instanceof Error ? e.message : "Arquivo invalido") }
    if (importer) importer.value = ""
  }
  const field = { padding: "8px", background: "var(--background-base, #102820)", color: "inherit", border: "1px solid var(--border-base, #35564c)", "border-radius": "6px" }
  return <section data-slot="hyron-personality-studio" style={{ padding: "18px", border: "1px solid var(--border-base, #35564c)", "border-radius": "12px", display: "grid", gap: "12px", "margin-top": "16px" }}>
    <div><strong>HYRONCODE — Estudio de Personalidades 0.9.3.5</strong><p style={{ opacity: "0.75", "font-size": "12px" }}>428 personagens, 50 arquetipos e perfis originais. Catalogo local: sem pesquisa automatica de personagens desconhecidos.</p></div>
    <label><input type="checkbox" checked={state().active} onChange={e => save({ ...state(), active: e.currentTarget.checked })} /> Ativar Estudio (substitui o estilo legado enquanto ativo)</label>
    <div style={{ display: "flex", gap: "8px", "flex-wrap": "wrap" }}>
      <input aria-label="Pesquisar personagens" placeholder="Buscar personagem ou obra" value={query()} onInput={e => setQuery(e.currentTarget.value)} style={{ ...field, flex: "1", "min-width": "160px" }} />
      <select aria-label="Categoria" value={group()} onChange={e => setGroup(e.currentTarget.value)} style={field}><For each={["Todos", "Arquétipos", "Jogos", "Filmes", "Animes", "Séries", "Meus perfis"]}>{g => <option value={g}>{g}</option>}</For></select>
    </div>
    <label style={{ display: "grid", gap: "5px" }}>Perfil selecionado
      <select size={6} value={state().selected} onChange={e => save({ ...state(), active: true, selected: e.currentTarget.value })} style={{ ...field, width: "100%" }}>
        <For each={visible()}>{i => <option value={i.id}>{i.name} — {i.origin}</option>}</For>
      </select>
    </label>
    <Show when={selected()}>{i => <div style={{ "font-size": "12px", opacity: "0.85" }}><strong>{i().name}:</strong> {i().description}</div>}</Show>
    <label style={{ display: "grid", gap: "6px" }}>Nivel de ma educacao: {state().rude}/5
      <input type="range" min="0" max="5" step="1" value={state().rude} onInput={e => save({ ...state(), rude: Number(e.currentTarget.value) })} />
    </label>
    <hr style={{ width: "100%", opacity: "0.2" }}/>
    <strong>Crie seu proprio personagem</strong>
    <button type="button" onClick={draft}>Editar perfil selecionado (se for seu) / iniciar novo</button>
    <input aria-label="Nome do novo perfil" placeholder="Nome da personalidade" value={name()} onInput={e => setName(e.currentTarget.value)} maxlength={80} style={field}/>
    <textarea aria-label="Descricao do novo perfil" placeholder="Descreva comportamento, jeito de falar, historia, opinioes ficticias e vocabulario..." rows={4} maxlength={LIMIT} value={description()} onInput={e => setDescription(e.currentTarget.value)} style={field}/>
    <button type="button" onClick={storeCustom}>{editing() ? "Salvar edicao" : "Criar e selecionar perfil"}</button>
    <Show when={state().custom.some(i => i.id === state().selected)}><button type="button" onClick={() => { const id = state().selected; save({ ...state(), selected: "AR-011", custom: state().custom.filter(i => i.id !== id) }); setEditing("") }}>Excluir perfil personalizado selecionado</button></Show>
    <div style={{ display: "flex", gap: "8px", "flex-wrap": "wrap" }}><button type="button" onClick={download}>Exportar meus perfis (JSON)</button><button type="button" onClick={() => importer?.click()}>Importar perfis (JSON)</button><input ref={importer} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={e => { void importProfiles(e.currentTarget.files?.[0]) }}/></div>
    <small aria-live="polite" style={{ opacity: "0.8" }}>{message()}</small>
    <small style={{ opacity: "0.65" }}>O perfil modifica o estilo de respostas futuras; nao treina nem altera os pesos do modelo. As regras tecnicas e de seguranca continuam valendo.</small>
  </section>
}
