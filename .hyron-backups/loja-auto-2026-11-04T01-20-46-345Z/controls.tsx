import { createSignal, Show } from "solid-js"
import "./hyron-plugin-controls.css"

const API = "http://127.0.0.1:43187"
const HEADERS = { "Content-Type": "application/json", "X-Hyroncode-Plugin-Store": "1" }

export function HyronPluginControls(props: { name: string; fromNpm: boolean }) {
  const [busy, setBusy] = createSignal(false)
  const [result, setResult] = createSignal("")
  const [ok, setOk] = createSignal<boolean | undefined>()
  const run = async (action: "install" | "remove" | "update") => {
    if (!props.fromNpm || busy()) return
    const message = action === "install"
      ? `Instalar o pacote npm ${props.name} no HYRONCODE? Plugins executam codigo com permissoes do usuario. Confie apenas no autor e revise o pacote antes de prosseguir.`
      : action === "remove"
        ? `Remover ${props.name} da configuracao de plugins do HYRONCODE?`
        : `Atualizar ${props.name} para uma versao disponibilizada pelo publicador?`
    if (!window.confirm(message)) return
    setBusy(true)
    setResult("")
    try {
      const response = await fetch(`${API}/action`, { method: "POST", headers: HEADERS, body: JSON.stringify({ action, package: props.name }) })
      const data = await response.json() as {ok?:boolean; output?:string; error?:string}
      setOk(response.ok && data.ok === true)
      setResult(data.output || data.error || `HTTP ${response.status}`)
    } catch(e) {
      setOk(false)
      setResult(`Instalador local indisponivel. Inicie o HYRONCODE com HYRONCODE-INICIAR-COM-LOJA.bat. Detalhes: ${String(e)}`)
    } finally { setBusy(false) }
  }
  return (
    <div class="hyron-plugin-controls">
      <p>Instalacao nativa no HYRONCODE (somente plugins npm; nao instala VSIX). Confirme a origem do pacote antes de executar.</p>
      <div class="hyron-plugin-buttons">
        <button disabled={busy()} onClick={() => void run("install")}>{busy() ? "Executando..." : "Instalar no HYRONCODE"}</button>
        <button disabled={busy()} onClick={() => void run("update")}>Atualizar</button>
        <button disabled={busy()} onClick={() => void run("remove")}>Remover</button>
      </div>
      <Show when={result()}><pre classList={{"hyron-plugin-success":ok()===true,"hyron-plugin-failure":ok()===false}} role="status">{result()}</pre></Show>
    </div>
  )
}
