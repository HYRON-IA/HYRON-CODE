import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { useSettingsSurface } from "@/settings/surface"
import { useProviders } from "@/providers/catalog/providers"
import { ServerProvider } from "@/runtime/server/current"
import { HYRON_9ROUTER_DEFAULT, hyron9RouterModelIds, normalizeHyron9RouterEndpoint } from "./hyron-9router-logic"
import { readHyron9RouterPalette, type Hyron9RouterPalette } from "./hyron-9router-theme"

// Only non-secret local endpoint preferences are stored here. API keys remain owned by 9Router/OpenCode.
const STORE_KEY = "hyroncode.9router.local-endpoint.v1"
const THEME_KEY = "hyroncode.9router.follow-hyron-theme.v1"
const TUTORIAL_KEY = "hyroncode.9router.visual-guide-completed.v2"
// This value is injected safely from DICA-DO-CRIADOR.txt by the local installer.
const CREATOR_TIP = "Para organizar múltiplas contas nos provedores que permitem isso (exceto Google nesta dica), você pode usar o Proton Mail: ao criar um endereço, utilize um e-mail que já controla como recuperação ou validação, se essa opção estiver disponível. Depois, o novo endereço poderá ser usado como e-mail de recuperação/verificação de outro cadastro. Confira as regras e as limitações de cada serviço antes de criar novas contas."
const title = "Central 9Router — HYRONCODE"
type Tab = "dashboard" | "diagnostic" | "tutorial"
const GUIDE_TITLES = ["Visão geral", "Conectar provedores", "Montar o combo", "Usar no HYRONCODE", "Teste e dica"] as const

type NativeRouter = {
  open: (endpoint: string) => Promise<boolean>
  layout: (rect: { x: number; y: number; width: number; height: number }) => Promise<boolean>
  close: () => Promise<boolean>
  reload: () => Promise<boolean>
  theme: (palette: Hyron9RouterPalette | null) => Promise<boolean>
  onStatus: (callback: (status: string) => void) => () => void
}
const nativeRouter = () => (window as unknown as { electron?: { hyron9Router?: NativeRouter } }).electron?.hyron9Router


// The main shell does not have a Server context: isolate these hooks in a correctly wrapped child.
function Hyron9RouterCatalog() {
  const providers = useProviders(() => undefined)
  const registered = createMemo(() => providers.all().get("9router"))
  const registeredModels = createMemo(() => Object.keys(registered()?.models ?? {}))
  const connected = createMemo(() => providers.connected().some((item) => item.id === "9router"))

  return (
    <Show when={providers.ready()} fallback={<p class="text-sm">Carregando provedores do HYRONCODE...</p>}>
      <p class="text-sm">Provedor <code>9router</code>: <strong>{connected() ? "conectado ao catalogo" : registered() ? "cadastrado, nao conectado" : "nao encontrado"}</strong></p>
      <p class="text-sm">Modelos registrados no HYRONCODE: <strong>{registeredModels().length}</strong></p>
      <Show when={registeredModels().length > 0}>
        <p class="text-xs text-v2-text-muted break-words">{registeredModels().slice(0, 10).join(" · ")}{registeredModels().length > 10 ? " ..." : ""}</p>
      </Show>
    </Show>
  )
}

export function Hyron9RouterPanel() {
  const settings = useSettingsSurface()
  const [opened, setOpened] = createSignal(false)
  const [tab, setTab] = createSignal<Tab>("dashboard")
  const [guideStep, setGuideStep] = createSignal(0)
  const [authMode, setAuthMode] = createSignal<"oauth" | "key">("oauth")
  const goGuide = (step: number) => setGuideStep(Math.max(0, Math.min(GUIDE_TITLES.length - 1, step)))
  const finishGuide = () => {
    try { localStorage.setItem(TUTORIAL_KEY, "1") } catch { /* preference optional */ }
    setTab("dashboard")
  }
  const openTab = (next: "dashboard" | "diagnostic") => setTab(next)
  const [endpoint, setEndpoint] = createSignal(HYRON_9ROUTER_DEFAULT)
  const [activeEndpoint, setActiveEndpoint] = createSignal(HYRON_9ROUTER_DEFAULT)
  const [frameStatus, setFrameStatus] = createSignal("A sessao do dashboard e isolada e persistente no Electron.")
  const [busy, setBusy] = createSignal(false)
  const [followHyronTheme, setFollowHyronTheme] = createSignal(true)
  const [status, setStatus] = createSignal("Teste /v1/models sem enviar credenciais.")
  const [discovered, setDiscovered] = createSignal<string[]>([])
  const dashboardUrl = createMemo(() => `${new URL(activeEndpoint()).origin}/dashboard`)
  let operation: AbortController | undefined
  const [nativeHost, setNativeHost] = createSignal<HTMLDivElement>()

  const close = () => {
    setOpened(false)
    operation?.abort()
  }
  const toggle = () => {
    setOpened((value) => !value)
    if (!opened()) operation?.abort()
  }
  const keydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && opened()) close()
  }
  onMount(() => {
    try {
      const stored = localStorage.getItem(STORE_KEY)
      if (stored) {
        const safe = normalizeHyron9RouterEndpoint(stored)
        setEndpoint(safe)
        setActiveEndpoint(safe)
      }
      // Existing users get theme sync by default; false is an explicit opt-out.
      setFollowHyronTheme(localStorage.getItem(THEME_KEY) !== "false")
    } catch { /* An invalid legacy preference never becomes a navigation target. */ }
    // This check must be independent of stored endpoint parsing.
    try { if (localStorage.getItem(TUTORIAL_KEY) !== "1") setTab("tutorial") }
    catch { setTab("tutorial") }
    window.addEventListener("hyroncode:toggle-9router-panel", toggle)
    window.addEventListener("keydown", keydown)
  })
  onCleanup(() => {
    operation?.abort()
    window.removeEventListener("hyroncode:toggle-9router-panel", toggle)
    window.removeEventListener("keydown", keydown)
  })

  const save = () => {
    try {
      const safe = normalizeHyron9RouterEndpoint(endpoint())
      localStorage.setItem(STORE_KEY, safe)
      setEndpoint(safe)
      setActiveEndpoint(safe)
      setStatus("Endereco local salvo. A configuracao de modelos permanece no 9Router e no HYRONCODE.")
      setFrameStatus("Se solicitado, faca login na propria interface do 9Router.")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Endereco invalido")
    }
  }

  const test = async () => {
    let base: string
    try { base = normalizeHyron9RouterEndpoint(endpoint()) }
    catch (error) { setStatus(error instanceof Error ? error.message : "Endereco invalido"); return }
    operation?.abort()
    const controller = new AbortController()
    operation = controller
    setBusy(true)
    setDiscovered([])
    setStatus("Consultando o 9Router local...")
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      // This is a CORS-limited diagnostic only. It does not claim that models are configured.
      const response = await fetch(`${base}/models`, {
        method: "GET", cache: "no-store", signal: controller.signal,
        headers: { Accept: "application/json" }, redirect: "error",
      })
      if (!response.ok) {
        setStatus(response.status === 401 || response.status === 403
          ? `HTTP ${response.status}: autenticacao necessaria. Nenhuma chave foi enviada.`
          : `API retornou HTTP ${response.status}. Verifique o 9Router.`)
        return
      }
      const models = hyron9RouterModelIds(await response.json())
      setDiscovered(models)
      setStatus(models.length
        ? `A API anuncia ${models.length} modelo(s); confirme a ativacao no seletor do chat.`
        : "A API respondeu, mas nao anunciou modelos.")
    } catch (error) {
      setStatus(error instanceof Error && error.name === "AbortError"
        ? "Tempo limite de 8 segundos atingido."
        : "Falha na consulta: a API pode exigir autenticacao, estar offline ou bloquear CORS. Confira o painel acima.")
    } finally {
      clearTimeout(timeout)
      if (operation === controller) { operation = undefined; setBusy(false) }
    }
  }

  const pushTheme = () => {
    const bridge = nativeRouter()
    if (!bridge) return
    const palette = followHyronTheme() ? readHyron9RouterPalette() : null
    void bridge.theme(palette).then((applied) => {
      if (!applied && opened() && tab() === "dashboard")
        setFrameStatus("Tema solicitado; aguardando a pagina carregar ou confirmar as cores.")
    }).catch((error) => {
      setFrameStatus(error instanceof Error ? `Falha na sincronizacao: ${error.message}` : "Falha ao sincronizar o tema.")
    })
  }
  const setThemePreference = () => {
    const next = !followHyronTheme()
    setFollowHyronTheme(next)
    try { localStorage.setItem(THEME_KEY, String(next)) } catch { /* optional preference */ }
    pushTheme()
  }

  // Theme changes in HYRONCODE don't automatically reach the separate Electron WebContentsView.
  // Observe the app theme state while the dashboard is visible, without touching the 9Router session.
  createEffect(() => {
    const bridge = nativeRouter()
    if (!opened() || tab() !== "dashboard" || !bridge) return
    const isFollowing = followHyronTheme()
    let last = ""
    const update = () => {
      const palette = isFollowing ? readHyron9RouterPalette() : null
      const next = JSON.stringify(palette)
      if (next === last) return
      last = next
      pushTheme()
    }
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme", "data-color-scheme"] })
    observer.observe(document.body, { attributes: true, attributeFilter: ["class", "style", "data-theme"] })
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })
    const media = matchMedia("(prefers-color-scheme: dark)")
    media.addEventListener("change", update)
    // Backup for themes that swap stylesheet contents without changing root attributes.
    const interval = window.setInterval(update, 1500)
    queueMicrotask(update)
    onCleanup(() => {
      observer.disconnect()
      media.removeEventListener("change", update)
      window.clearInterval(interval)
    })
  })

  // WebContentsView is owned by Electron's main process, not an iframe in the application renderer.
  // The renderer supplies bounds only; credentials and cookies stay in the isolated Electron session.
  createEffect(() => {
    const bridge = nativeRouter()
    const host = nativeHost()
    const visible = opened() && tab() === "dashboard" && !!host
    const url = activeEndpoint()
    if (!visible || !host || !bridge) return
    let cancelled = false
    const sync = () => {
      if (cancelled || !host.isConnected) return
      const r = host.getBoundingClientRect()
      void bridge.layout({ x: r.x, y: r.y, width: r.width, height: r.height }).catch(() => undefined)
    }
    const observer = new ResizeObserver(sync)
    observer.observe(host)
    window.addEventListener("resize", sync)
    const releaseStatus = bridge.onStatus(setFrameStatus)
    setFrameStatus("Abrindo a pagina nativa do 9Router...")
    void bridge.open(url).then(() => { if (!cancelled) { sync(); pushTheme() } }).catch((error) => {
      if (!cancelled) setFrameStatus(error instanceof Error ? error.message : "Falha ao abrir dashboard nativo.")
    })
    onCleanup(() => {
      cancelled = true
      observer.disconnect()
      window.removeEventListener("resize", sync)
      releaseStatus()
      void bridge.close().catch(() => undefined)
    })
  })

  const showSettings = (name: "providers" | "models") => {
    close()
    settings.open(name)
  }

  const openExternal = () => {
    // Existing native navigation policy opens external URLs in the system browser.
    window.open(dashboardUrl(), "_blank", "noopener,noreferrer")
  }

  return (
    <Show when={opened()}>
      <div data-slot="hyron-9router-overlay" class="fixed inset-0" style={{ "z-index": "2200", background: "rgba(0,0,0,.82)", display: "flex", "align-items": "stretch", padding: "clamp(6px, 1.6vw, 18px)" }}>
        <section role="dialog" aria-modal="true" aria-label={title} class="w-full min-w-0 min-h-0 flex flex-col border border-v2-border-base bg-v2-background-bg-deep text-v2-text-strong" style={{ "border-radius": "12px", overflow: "hidden" }}>
          <header class="flex flex-wrap items-center justify-between gap-2 border-b border-v2-border-base" style={{ padding: "12px 16px" }}>
            <div class="min-w-0">
              <h2 class="text-base font-semibold" style={{ color: "inherit" }}>⬡ 9Router — Configuracao interna</h2>
              <p class="text-xs text-v2-text-muted">Dashboard original do 9Router, integrado nativamente ao Electron</p>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm" aria-pressed={followHyronTheme()} onClick={setThemePreference} title="Alternar entre o tema do HYRONCODE e o visual original do 9Router">{followHyronTheme() ? "Seguir tema HYRONCODE: ligado" : "Tema original do 9Router"}</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm" onClick={() => { openTab("dashboard"); void nativeRouter()?.reload().catch(() => undefined) }}>Recarregar</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm" onClick={openExternal} title="Alternativa se a incorporacao estiver bloqueada">Abrir no navegador</button>
              <button type="button" aria-label="Fechar central 9Router" class="rounded-md border px-3 py-2 text-sm" onClick={close}>✕ Fechar</button>
            </div>
          </header>

          <nav aria-label="Seções do 9Router" class="flex flex-wrap items-center gap-2 border-b border-v2-border-base" style={{ padding: "8px 16px" }}>
            <button type="button" aria-pressed={tab() === "dashboard"} class="rounded-md px-3 py-2 text-sm" classList={{ "bg-v2-background-bg-hover": tab() === "dashboard" }} onClick={() => openTab("dashboard")}>Dashboard 9Router</button>
            <button type="button" aria-pressed={tab() === "diagnostic"} class="rounded-md px-3 py-2 text-sm" classList={{ "bg-v2-background-bg-hover": tab() === "diagnostic" }} onClick={() => openTab("diagnostic")}>Conexao e modelos</button>
            <button type="button" aria-pressed={tab() === "tutorial"} class="rounded-md px-3 py-2 text-sm" classList={{ "bg-v2-background-bg-hover": tab() === "tutorial" }} onClick={() => setTab("tutorial")}>Guia visual</button>
            <span class="text-xs text-v2-text-muted" style={{ "margin-left": "auto" }}>{dashboardUrl()}</span>
          </nav>

          <Show when={tab() === "tutorial"} fallback={
          <Show when={tab() === "dashboard"} fallback={
            <main class="flex-1 min-h-0 overflow-y-auto" style={{ padding: "18px", display: "grid", gap: "16px", "align-content": "start" }}>
              <div class="rounded-lg border border-v2-border-base p-3" style={{ display: "grid", gap: "12px" }}>
                <h3 class="font-semibold">Endereco local do 9Router</h3>
                <label for="hyron-9router-url" class="text-sm">API local (terminada em /v1)</label>
                <input id="hyron-9router-url" class="rounded-md border border-v2-border-base bg-v2-background-bg-base px-3 py-2 text-sm w-full" value={endpoint()} onInput={(e) => setEndpoint(e.currentTarget.value)} spellcheck={false} autocomplete="off" />
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="rounded-md border px-3 py-2 text-sm" onClick={save}>Salvar e aplicar endereco</button>
                  <button type="button" class="rounded-md border px-3 py-2 text-sm" disabled={busy()} onClick={() => void test()}>{busy() ? "Consultando..." : "Testar /v1/models"}</button>
                  <button type="button" class="rounded-md border px-3 py-2 text-sm" onClick={() => setTab("dashboard")}>Voltar ao dashboard</button>
                </div>
                <p role="status" aria-live="polite" class="text-xs text-v2-text-muted">{status()}</p>
              </div>
              <div class="rounded-lg border border-v2-border-base p-3" style={{ display: "grid", gap: "10px" }}>
                <h3 class="font-semibold">Provedor do HYRONCODE</h3>
                <Show when={settings.server()?.connection} keyed fallback={<p class="text-sm">Nenhum servidor HYRONCODE disponivel no momento.</p>}>
                  {(connection) => <ServerProvider conn={connection}><Hyron9RouterCatalog /></ServerProvider>}
                </Show>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="rounded-md border px-3 py-2 text-sm" onClick={() => showSettings("providers")}>Gerenciar provedores</button>
                  <button type="button" class="rounded-md border px-3 py-2 text-sm" onClick={() => showSettings("models")}>Gerenciar modelos</button>
                </div>
                <p class="text-xs text-v2-text-muted">A configuracao de contas e chaves fica no dashboard. A escolha do modelo usado pelo chat continua no seletor nativo do HYRONCODE.</p>
              </div>
              <Show when={discovered().length > 0}>
                <div class="rounded-lg border border-v2-border-base p-3" style={{ display: "grid", gap: "8px" }}>
                  <h3 class="font-semibold text-sm">Modelos anunciados pela API: {discovered().length}</h3>
                  <div class="overflow-y-auto" style={{ "max-height": "160px" }}><For each={discovered()}>{(id) => <p class="py-1 text-xs break-all">{id}</p>}</For></div>
                </div>
              </Show>
            </main>
          }>
            <div class="flex-1 min-h-0 flex flex-col" style={{ background: "#151515" }}>
              <Show when={nativeRouter()} fallback={<div class="flex-1 p-6 text-sm">O painel nativo requer o aplicativo Electron. Abra o HYRONCODE Desktop para configurar o 9Router.</div>}>
                <div
                  data-slot="hyron-9router-native-dashboard"
                  ref={setNativeHost}
                  class="w-full flex-1 min-h-0"
                  style={{ background: "#181818" }}
                  aria-label="Painel nativo do 9Router"
                />
              </Show>
              <p class="text-xs text-v2-text-muted" style={{ padding: "7px 12px" }} role="status">{frameStatus()} A autenticacao, se solicitada, e feita pelo proprio 9Router.</p>
            </div>
          </Show>
          }>
            <main data-slot="hyron-9router-tutorial" class="flex-1 min-h-0 overflow-y-auto" style={{ padding: "clamp(14px, 3vw, 30px)" }}>
              <div style={{ "max-width": "1000px", margin: "0 auto", display: "grid", gap: "18px" }}>
                <header style={{ display: "grid", gap: "8px" }}>
                  <p class="text-xs text-v2-text-muted">GUIA VISUAL · PRIMEIRO USO DO 9ROUTER</p>
                  <h3 class="text-xl font-semibold">Do provedor ao combo, do combo ao HYRONCODE</h3>
                  <p class="text-sm text-v2-text-muted">A extensão já acompanha o aplicativo preparado. Você conecta suas próprias contas, monta um combo no 9Router e escolhe esse combo no HYRONCODE. O guia não solicita senhas nem chaves.</p>
                  <p class="text-xs text-v2-text-muted">Esquemas ilustrativos: os nomes e posições dos botões podem variar conforme a versão do 9Router.</p>
                </header>

                <nav aria-label="Etapas do tutorial visual" class="grid gap-2" style={{ "grid-template-columns": "repeat(5, minmax(0, 1fr))" }}>
                  <For each={GUIDE_TITLES}>{(name, i) =>
                    <button type="button" onClick={() => goGuide(i())} aria-current={guideStep() === i() ? "step" : undefined} class="rounded-md border p-2 text-xs" style={{ "min-height": "62px", "text-align": "left", "border-color": guideStep() === i() ? "#4ade80" : "var(--v2-border-base, #444)", background: guideStep() === i() ? "rgba(74,222,128,.11)" : "transparent" }}>
                      <span style={{ display: "block", opacity: ".7", "margin-bottom": "4px" }}>0{i() + 1}</span>{name}
                    </button>
                  }</For>
                </nav>

                <div role="progressbar" aria-label="Progresso do tutorial" aria-valuemin={1} aria-valuemax={5} aria-valuenow={guideStep() + 1} style={{ height: "5px", background: "rgba(150,150,150,.2)", "border-radius": "8px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(guideStep() + 1) * 20}%`, background: "#4ade80", transition: "width .2s" }} />
                </div>

                <Show when={guideStep() === 0}>
                  <section style={{ display: "grid", gap: "18px" }}>
                    <div>
                      <h4 class="text-lg font-semibold">Como tudo se conecta</h4>
                      <p class="text-sm text-v2-text-muted">O 9Router reúne contas e modelos. O combo é uma rota com modelos em ordem de prioridade; se um modelo falhar em condições previstas pelo gateway, o próximo pode assumir.</p>
                    </div>
                    <div class="rounded-xl border border-v2-border-base p-4" style={{ background: "rgba(80,130,110,.06)", display: "grid", gap: "12px" }} aria-label="Diagrama do fluxo de configuração">
                      <div class="grid gap-2" style={{ "grid-template-columns": "repeat(3, minmax(0, 1fr))" }}>
                        <div class="rounded-lg border border-v2-border-base p-3" style={{ "text-align": "center" }}><div style={{ "font-size": "23px" }}>🔐</div><strong class="text-sm">Provedores</strong><p class="text-xs text-v2-text-muted">Contas e chaves</p></div>
                        <div class="rounded-lg border border-v2-border-base p-3" style={{ "text-align": "center" }}><div style={{ "font-size": "23px" }}>🔀</div><strong class="text-sm">Combo</strong><p class="text-xs text-v2-text-muted">Ordem de modelos</p></div>
                        <div class="rounded-lg border border-v2-border-base p-3" style={{ "text-align": "center" }}><div style={{ "font-size": "23px" }}>⌨️</div><strong class="text-sm">HYRONCODE</strong><p class="text-xs text-v2-text-muted">Modelo no chat</p></div>
                      </div>
                      <p class="text-xs text-v2-text-muted" style={{ "text-align": "center" }}>Provedores → 9Router / Combos → Seletor de modelos do HYRONCODE</p>
                    </div>
                    <p class="text-sm">Primeiro conecte ao menos um provedor; depois crie um combo com modelos disponíveis e selecione-o no aplicativo. Para fallback, conecte mais de um modelo compatível.</p>
                  </section>
                </Show>

                <Show when={guideStep() === 1}>
                  <section style={{ display: "grid", gap: "15px" }}>
                    <div><h4 class="text-lg font-semibold">1. Conectar seus provedores</h4><p class="text-sm text-v2-text-muted">Abra o Dashboard 9Router e procure a seção <strong>Providers</strong>. Conecte uma conta autorizada ou adicione a chave de API do serviço, conforme ele oferecer.</p></div>
                    <div class="flex flex-wrap gap-2" role="group" aria-label="Método de conexão ilustrado">
                      <button type="button" aria-pressed={authMode() === "oauth"} onClick={() => setAuthMode("oauth")} class="rounded-md border px-3 py-2 text-sm" style={{ background: authMode() === "oauth" ? "rgba(74,222,128,.16)" : "transparent" }}>Login / OAuth</button>
                      <button type="button" aria-pressed={authMode() === "key"} onClick={() => setAuthMode("key")} class="rounded-md border px-3 py-2 text-sm" style={{ background: authMode() === "key" ? "rgba(74,222,128,.16)" : "transparent" }}>API Key</button>
                    </div>
                    <div class="rounded-xl border border-v2-border-base" style={{ overflow: "hidden", "max-width": "790px" }} aria-label="Exemplo ilustrado da tela Providers do 9Router">
                      <div class="px-4 py-2 text-xs" style={{ background: "rgba(85,85,85,.2)" }}>9Router / Dashboard / <strong>Providers</strong> <span style={{ float: "right", opacity: ".7" }}>ILUSTRAÇÃO</span></div>
                      <div class="grid" style={{ "grid-template-columns": "130px minmax(0, 1fr)", "min-height": "190px" }}>
                        <div class="p-3 text-xs" style={{ background: "rgba(0,0,0,.14)", display: "grid", gap: "9px", "align-content": "start" }}><span>Dashboard</span><strong style={{ color: "#4ade80" }}>▸ Providers</strong><span>Combos</span><span>Models</span></div>
                        <div class="p-4" style={{ display: "grid", gap: "10px", "align-content": "start" }}>
                          <strong class="text-sm">Gerenciar provedores</strong>
                          <Show when={authMode() === "oauth"} fallback={
                            <><div class="rounded-md border border-v2-border-base p-2 text-sm">Provedor autorizado: <strong>selecione um serviço</strong></div><div class="rounded-md border border-v2-border-base p-2 text-sm" style={{ opacity: ".8" }}>•••••••••••••••• (chave inserida no 9Router)</div><span class="rounded-md px-3 py-2 text-sm" style={{ background: "rgba(74,222,128,.16)", "justify-self": "start" }}>Add API Key / Save</span></>
                          }>
                            <><div class="rounded-md border border-v2-border-base p-2 text-sm">Provedor: <strong>escolha um disponível</strong></div><span class="rounded-md px-3 py-2 text-sm" style={{ background: "rgba(74,222,128,.16)", "justify-self": "start" }}>Connect → Autorizar</span><p class="text-xs text-v2-text-muted">A autenticação acontece no serviço selecionado.</p></>
                          </Show>
                        </div>
                      </div>
                    </div>
                    <p class="text-sm">Depois de autorizar, confirme que a conta aparece como conectada. Não cole chaves nem códigos de autenticação no chat do HYRONCODE. Consulte cotas e condições de uso.</p>
                    <button type="button" class="rounded-md border border-v2-border-base px-4 py-3 text-sm" style={{ "justify-self": "start" }} onClick={() => openTab("dashboard")}>Abrir o Dashboard real</button>
                  </section>
                </Show>

                <Show when={guideStep() === 2}>
                  <section style={{ display: "grid", gap: "15px" }}>
                    <div><h4 class="text-lg font-semibold">2. Criar seu combo</h4><p class="text-sm text-v2-text-muted">No 9Router, vá a <strong>Combos → Create New Combo</strong>. Dê um nome, escolha os modelos já disponíveis na sua conta e coloque-os na ordem de preferência.</p></div>
                    <div class="rounded-xl border border-v2-border-base" style={{ overflow: "hidden", "max-width": "790px" }} aria-label="Exemplo ilustrado de combo e fallback">
                      <div class="px-4 py-2 text-xs" style={{ background: "rgba(85,85,85,.2)" }}>9Router / Dashboard / <strong>Combos</strong> / Create New Combo <span style={{ float: "right", opacity: ".7" }}>ILUSTRAÇÃO</span></div>
                      <div class="p-4" style={{ display: "grid", gap: "12px" }}>
                        <div class="rounded-md border border-v2-border-base p-3 text-sm"><span class="text-v2-text-muted">Nome</span><div style={{ "font-weight": "600" }}>meu-combo</div></div>
                        <div class="text-xs text-v2-text-muted">MODELOS — ordem de prioridade</div>
                        <div class="rounded-md border border-v2-border-base p-3 text-sm">① Modelo principal — tenta primeiro</div>
                        <div class="rounded-md border border-v2-border-base p-3 text-sm" style={{ "margin-left": "16px" }}>↓ Em falhas que permitem fallback</div>
                        <div class="rounded-md border border-v2-border-base p-3 text-sm">② Modelo reserva — tenta depois</div>
                        <span class="rounded-md px-3 py-2 text-sm" style={{ background: "rgba(74,222,128,.16)", "justify-self": "start" }}>Save Combo</span>
                      </div>
                    </div>
                    <p class="text-sm">Use modelos que existam na lista real do 9Router. O combo é identificado pelo nome que você salvou; modelos pagos podem gerar cobrança, mesmo como reserva.</p>
                    <button type="button" class="rounded-md border border-v2-border-base px-4 py-3 text-sm" style={{ "justify-self": "start" }} onClick={() => openTab("dashboard")}>Abrir Combos no Dashboard</button>
                  </section>
                </Show>

                <Show when={guideStep() === 3}>
                  <section style={{ display: "grid", gap: "15px" }}>
                    <div><h4 class="text-lg font-semibold">3. Conectar o combo ao HYRONCODE</h4><p class="text-sm text-v2-text-muted">Volte ao HYRONCODE. Na aba <strong>Conexão e modelos</strong>, confira o endereço da API do 9Router e os modelos disponíveis; depois use o seletor nativo de modelos do chat.</p></div>
                    <div class="rounded-xl border border-v2-border-base p-4" style={{ "max-width": "790px", display: "grid", gap: "12px" }} aria-label="Diagrama do 9Router conectado ao HYRONCODE">
                      <div class="grid gap-3" style={{ "grid-template-columns": "repeat(2, minmax(0, 1fr))" }}>
                        <div class="rounded-md border border-v2-border-base p-3"><p class="text-xs text-v2-text-muted">9ROUTER</p><p class="text-sm font-semibold">Combo: meu-combo</p><p class="text-xs">API local /v1</p></div>
                        <div class="rounded-md border border-v2-border-base p-3" style={{ "border-color": "#4ade80" }}><p class="text-xs text-v2-text-muted">HYRONCODE</p><p class="text-sm font-semibold">Provedor 9Router</p><p class="text-xs">Escolher meu-combo</p></div>
                      </div>
                      <p class="text-xs text-v2-text-muted">Os modelos são descobertos pela integração; a presença do combo depende do gateway estar funcionando, da autenticação e da atualização do catálogo.</p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <button type="button" class="rounded-md border border-v2-border-base px-3 py-3 text-sm" onClick={() => openTab("diagnostic")}>Ver conexão e modelos</button>
                      <button type="button" class="rounded-md border border-v2-border-base px-3 py-3 text-sm" onClick={() => showSettings("models")}>Abrir modelos do HYRONCODE</button>
                    </div>
                    <p class="text-xs text-v2-text-muted">Se o combo não aparecer, confira no Dashboard se ele foi salvo; recarregue a lista de modelos ou reinicie o aplicativo. Um teste HTTP 200 não garante que a conta esteja autenticada para gerar respostas.</p>
                  </section>
                </Show>

                <Show when={guideStep() === 4}>
                  <section style={{ display: "grid", gap: "15px" }}>
                    <div><h4 class="text-lg font-semibold">4. Testar e começar a usar</h4><p class="text-sm text-v2-text-muted">Abra uma conversa nova, selecione o combo criado e envie uma pergunta curta. Verifique se a resposta veio do modelo esperado e se o 9Router registrou a solicitação.</p></div>
                    <div class="rounded-xl border border-v2-border-base p-4" style={{ "max-width": "790px", display: "grid", gap: "10px" }} aria-label="Exemplo de teste de conversa">
                      <p class="text-xs text-v2-text-muted">HYRONCODE / MODELO: 9router / meu-combo</p>
                      <div class="rounded-md border border-v2-border-base p-3 text-sm">Você: Responda apenas: conexão funcionando.</div>
                      <div class="rounded-md border border-v2-border-base p-3 text-sm" style={{ "border-color": "#4ade80" }}>IA: conexão funcionando.</div>
                      <p class="text-xs text-v2-text-muted">A resposta acima é uma simulação visual, não um teste real nem prova de conexão.</p>
                    </div>
                    <aside class="rounded-lg border border-v2-border-base p-4" style={{ background: "rgba(74,222,128,.07)", display: "grid", gap: "10px" }}>
                      <p class="text-sm font-semibold">💡 Dica do Criador</p>
                      <p class="text-sm" style={{ "line-height": "1.7", "white-space": "pre-wrap" }}>{CREATOR_TIP}</p>
                      <p class="text-xs text-v2-text-muted">Dica pessoal, não é orientação oficial do Proton Mail ou dos provedores. Contas adicionais e métodos de verificação dependem das regras de cada serviço; não use cadastros para contornar limites, suspensões ou cotas.</p>
                    </aside>
                    <button type="button" class="rounded-md border px-4 py-3 text-sm font-semibold" style={{ "justify-self": "start", background: "rgba(74,222,128,.13)" }} onClick={finishGuide}>Concluir tutorial e abrir o Dashboard</button>
                  </section>
                </Show>

                <footer class="flex flex-wrap gap-2 items-center" style={{ "padding-top": "8px", "padding-bottom": "12px", "border-top": "1px solid var(--v2-border-base, #444)" }}>
                  <button type="button" disabled={guideStep() === 0} class="rounded-md border border-v2-border-base px-4 py-2 text-sm" onClick={() => goGuide(guideStep() - 1)}>Anterior</button>
                  <button type="button" disabled={guideStep() === GUIDE_TITLES.length - 1} class="rounded-md border border-v2-border-base px-4 py-2 text-sm font-semibold" onClick={() => goGuide(guideStep() + 1)}>Próximo passo</button>
                  <span class="text-xs text-v2-text-muted" style={{ "margin-left": "auto" }}>Etapa {guideStep() + 1} de {GUIDE_TITLES.length} · Volte a este guia pela aba Guia visual</span>
                </footer>
              </div>
            </main>
          </Show>
        </section>
      </div>
    </Show>
  )
}
