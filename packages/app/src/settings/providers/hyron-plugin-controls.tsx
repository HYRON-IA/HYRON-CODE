import { createEffect, createSignal, Show } from "solid-js"
import "./hyron-plugin-controls.css"

const API = "http://127.0.0.1:43187"
const HEADERS = { "Content-Type": "application/json", "X-Hyroncode-Plugin-Store": "1" }

type PluginState = "checking" | "installed" | "available" | "offline"
export function HyronPluginControls(props: { name: string; fromNpm: boolean }) {
  const [state, setState] = createSignal<PluginState>("checking")
  const [busy, setBusy] = createSignal(false)
  const [result, setResult] = createSignal("")
  const [ok, setOk] = createSignal<boolean | undefined>()
  let seq = 0
  const refresh = async (name: string) => {
    const ticket = ++seq
    if (!props.fromNpm) return
    setState("checking")
    try {
      const response = await fetch(`${API}/status?package=${encodeURIComponent(name)}`, { headers: { "X-Hyroncode-Plugin-Store": "1" } })
      if (!response.ok) throw Error(`HTTP ${response.status}`)
      const data = await response.json() as { installed?: boolean }
      if (ticket === seq) setState(data.installed ? "installed" : "available")
    } catch {
      if (ticket === seq) setState("offline")
    }
  }
  createEffect(() => { const name = props.name; void refresh(name) })
  const run = async (action: "install" | "remove" | "update") => {
    if (!props.fromNpm || busy()) return
    const message = action === "install"
      ? `Instalar ${props.name}? Este pacote npm pode executar codigo com os privilegios do seu usuario. Verifique o desenvolvedor e a origem antes de continuar.`
      : action === "remove" ? `Remover ${props.name} da configuracao de plugins?`
      : `Verificar e aplicar atualizacao de ${props.name}?`
    if (!window.confirm(message)) return
    setBusy(true)
    setResult("")
    try {
      const response = await fetch(`${API}/action`, { method: "POST", headers: HEADERS, body: JSON.stringify({action, package:props.name}) })
      const data = await response.json() as {ok?:boolean;output?:string;error?:string}
      const success = response.ok && data.ok === true
      setOk(success)
      setResult(data.output || data.error || `HTTP ${response.status}`)
    } catch (error) {
      setOk(false)
      setResult(`Servico da loja indisponivel: ${String(error)}. Reinicie o HYRONCODE com bun run dev:desktop e confira a porta 43187.`)
    } finally { setBusy(false); void refresh(props.name) }
  }
  return <div class="hyron-plugin-controls">
    <p>Plugins npm compatíveis com OpenCode. O catálogo não confirma compatibilidade; o instalador valida o pacote.</p>
    <p role="status">{state() === "checking" ? "Verificando instalação..." : state() === "installed" ? "Configurado no HYRONCODE" : state() === "available" ? "Não instalado" : "Serviço da loja desconectado (porta 43187)"}</p>
    <div class="hyron-plugin-buttons">
      <Show when={state() === "available"}><button disabled={busy()} onClick={() => void run("install")}>{busy() ? "Instalando..." : "Instalar no HYRONCODE"}</button></Show>
      <Show when={state() === "installed"}>
        <button disabled={busy()} onClick={() => void run("update")}>Atualizar</button>
        <button disabled={busy()} onClick={() => void run("remove")}>Remover</button>
      </Show>
      <Show when={state() === "offline"}><button disabled={busy()} onClick={() => void refresh(props.name)}>Reconectar</button></Show>
    </div>
    <Show when={result()}><pre classList={{"hyron-plugin-success":ok()===true,"hyron-plugin-failure":ok()===false}} role="status">{result()}</pre></Show>
  </div>
}
