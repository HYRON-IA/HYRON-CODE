import { HyronPluginControls } from "./hyron-plugin-controls"
import { For, Show, createSignal, onMount } from "solid-js"
import { ExternalLink } from "@/runtime/platform/external-link"
import "./hyron-extension-store.css"

type Entry = {
  id: string
  name: string
  publisher: string
  description: string
  version?: string
  url: string
  type: "vsix" | "opencode" | "reference"
  source: string
  install?: string
}

type Source = { id: string; label: string; url: string; enabled: boolean }
const STORAGE = "hyroncode.extension-store.sources.v1"
const DEFAULT_SOURCES: Source[] = [
  { id: "openvsx", label: "Open VSX Registry", url: "https://open-vsx.org", enabled: true },
  { id: "npm", label: "npm · plugins OpenCode", url: "https://registry.npmjs.org", enabled: true },
]

const safeHttps = (raw: string): URL | undefined => {
  try {
    const url = new URL(raw)
    if (url.protocol !== "https:" || !!url.username || !!url.password) return
    return url
  } catch {
    return
  }
}

const getSavedSources = (): Source[] => {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE) || "null")
    if (!Array.isArray(data)) return DEFAULT_SOURCES
    const saved = data.filter((x): x is Source =>
      x && typeof x.id === "string" && typeof x.label === "string" &&
      typeof x.url === "string" && typeof x.enabled === "boolean" && !!safeHttps(x.url),
    ).slice(0, 12)
    if (!saved.some((s) => s.id === "openvsx")) saved.unshift(DEFAULT_SOURCES[0])
    if (!saved.some((s) => s.id === "npm")) saved.push(DEFAULT_SOURCES[1])
    return saved
  } catch {
    return DEFAULT_SOURCES
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

// HYRONCODE-NPM-EXACT-V1
// Consultar o nome npm exato antes da pesquisa textual. Pacotes encontrados
// continuam sendo candidatos, NAO plugins garantidamente compativeis.
async function hyronFindExactNpm(source: Source, raw: string): Promise<Entry | undefined> {
  const name = raw.trim()
  const valid = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(name) && !name.includes("..") && name.length < 155
  if (!valid) return
  // A barra de pacotes com escopo precisa ser codificada (%2F).
  const endpoint = new URL(`/${encodeURIComponent(name)}`, source.url)
  try {
    const payload = await fetchJson(endpoint.href) as Record<string, unknown>
    if (payload?.name !== name) return
    const tags = payload["dist-tags"] as Record<string, unknown> | undefined
    const version = String(tags?.latest || "")
    const versions = payload.versions as Record<string, Record<string, unknown>> | undefined
    const current = versions?.[version]
    const description = String(current?.description || payload.description || "Pacote npm; compatibilidade com OpenCode não verificada")
    const maintainer = Array.isArray(payload.maintainers) ? payload.maintainers[0] as Record<string, unknown> | undefined : undefined
    return {
      id: `npm:${name}`, name,
      publisher: String(maintainer?.name || "npm"),
      description, version,
      url: `https://www.npmjs.com/package/${encodeURIComponent(name)}`,
      type: "reference" as const, source: source.label,
    }
  } catch {
    // 404, bloqueios de rede e CORS: deixar a busca aproximada tentar.
    return
  }
}
async function loadSource(source: Source, query: string): Promise<Entry[]> {
  if (source.id === "openvsx") {
    const base = new URL("/api/-/search", source.url)
    base.searchParams.set("query", query)
    base.searchParams.set("size", "20")
    const payload = await fetchJson(base.href) as { extensions?: unknown[] }
    return (payload.extensions || []).slice(0, 20).flatMap((raw) => {
      if (!raw || typeof raw !== "object") return []
      const x = raw as Record<string, unknown>
      const namespace = String(x.namespace || "")
      const name = String(x.name || "")
      if (!namespace || !name) return []
      return [{
        id: `vsix:${namespace}.${name}`,
        name: String(x.displayName || name),
        publisher: namespace,
        description: String(x.description || "Extensão do ecossistema VS Code"),
        version: String(x.version || ""),
        url: `https://open-vsx.org/extension/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`,
        type: "vsix" as const,
        source: source.label,
      }]
    })
  }

  if (source.id === "npm") {
    const exact = await hyronFindExactNpm(source, query)
    if (exact) return [exact]
    const base = new URL("/-/v1/search", source.url)
    base.searchParams.set("text", query)
    base.searchParams.set("size", "20")
    const payload = await fetchJson(base.href) as { objects?: Array<{ package?: Record<string, unknown> }> }
    return (payload.objects || []).slice(0, 20).flatMap((obj) => {
      const p = obj.package
      if (!p || typeof p.name !== "string") return []
      const name = p.name
      // Searching npm does not prove OpenCode compatibility. Keep discovery advisory.
      return [{
        id: `npm:${name}`,
        name,
        publisher: String((p.publisher as Record<string, unknown> | undefined)?.username || "npm"),
        description: String(p.description || "Pacote npm — compatibilidade não verificada"),
        version: String(p.version || ""),
        url: `https://www.npmjs.com/package/${encodeURIComponent(name)}`,
        type: "reference" as const,
        source: source.label,
      }]
    })
  }

  const base = safeHttps(source.url)
  if (!base) throw Error("A fonte precisa usar HTTPS")
  const payload = await fetchJson(base.href) as { extensions?: unknown[] }
  if (!payload || !Array.isArray(payload.extensions)) throw Error("Esperado objeto JSON com extensions[]")
  const term = query.toLowerCase()
  return payload.extensions.slice(0, 150).flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return []
    const p = raw as Record<string, unknown>
    const title = String(p.name || "").trim().slice(0, 100)
    const description = String(p.description || "").slice(0, 300)
    if (!title || !`${title} ${description}`.toLowerCase().includes(term)) return []
    const destination = String(p.url || "")
    if (!safeHttps(destination)) return []
    return [{
      id: `custom:${source.id}:${index}`,
      name: title,
      publisher: String(p.publisher || source.label).slice(0, 100),
      description,
      version: String(p.version || "").slice(0, 60),
      url: destination,
      // Custom sources are discovery-only, never trusted to execute code.
      type: "reference" as const,
      source: source.label,
    }]
  })
}

export function HyronExtensionStore() {
  const [sources, setSources] = createSignal<Source[]>(DEFAULT_SOURCES)
  const [query, setQuery] = createSignal("")
  const [items, setItems] = createSignal<Entry[]>([])
  const [loading, setLoading] = createSignal(false)
  const [errors, setErrors] = createSignal<string[]>([])
  const [sourceLabel, setSourceLabel] = createSignal("")
  const [sourceUrl, setSourceUrl] = createSignal("")
  const [selected, setSelected] = createSignal<Entry>()
  const [mode, setMode] = createSignal<"explore" | "sources">("explore")
  let request = 0

  onMount(() => setSources(getSavedSources()))
  const persist = (value: Source[]) => { setSources(value); localStorage.setItem(STORAGE, JSON.stringify(value)) }

  const search = async () => {
    const q = query().trim()
    if (!q || q.length < 2) { setErrors(["Digite ao menos 2 caracteres para pesquisar."]); return }
    const token = ++request
    setLoading(true)
    setErrors([])
    setItems([])
    setSelected(undefined)
    const active = sources().filter((source) => source.enabled)
    const data = await Promise.all(active.map(async (source) => {
      try { return { entries: await loadSource(source, q), error: "" } }
      catch (error) { return { entries: [] as Entry[], error: `${source.label}: ${error instanceof Error ? error.message : String(error)}` } }
    }))
    if (token !== request) return
    setItems(data.flatMap((p) => p.entries))
    setErrors(data.flatMap((p) => p.error ? [p.error] : []))
    setLoading(false)
  }

  const addSource = () => {
    const label = sourceLabel().trim()
    const url = sourceUrl().trim()
    if (!label || label.length > 80 || !safeHttps(url)) {
      setErrors(["Informe um nome e uma URL HTTPS válida."])
      return
    }
    const existing = sources()
    if (existing.length >= 12 || existing.some((x) => x.url === url)) {
      setErrors(["Limite de 12 fontes ou URL já cadastrada."])
      return
    }
    persist([...existing, {id: `custom-${Date.now()}`, label, url, enabled: true}])
    setSourceLabel("")
    setSourceUrl("")
    setErrors([])
  }

  return (
    <section class="hyron-extension-store" aria-label="HYRONCODE Extension Store">
      <div class="hyron-store-toolbar">
        <div>
          <h3>HYRONCODE Extension Store</h3>
          <p>Loja multifuentes, inspirada no VS Code. Descubra extensões sem executar código de terceiros automaticamente.</p>
        </div>
        <div class="hyron-store-modes">
          <button classList={{ active: mode() === "explore" }} onClick={() => setMode("explore")}>Explorar</button>
          <button classList={{ active: mode() === "sources" }} onClick={() => setMode("sources")}>Fontes</button>
        </div>
      </div>

      <Show when={mode() === "explore"} fallback={
        <div class="hyron-store-sources">
          <p>Adicione catálogos JSON HTTPS (formato: <code>{'{"extensions":[{"name":"...","description":"...","url":"https://..."}]}'}</code>). A loja consulta as fontes habilitadas; ela não instala conteúdo JSON.</p>
          <For each={sources()}>{(source) =>
            <div class="hyron-store-source-row">
              <label><input type="checkbox" checked={source.enabled} onChange={(e) => persist(sources().map((x) => x.id === source.id ? {...x, enabled: e.currentTarget.checked} : x))} /> {source.label}</label>
              <span title={source.url}>{source.url}</span>
              <Show when={source.id.startsWith("custom-")}>
                <button type="button" onClick={() => persist(sources().filter((x) => x.id !== source.id))}>Remover</button>
              </Show>
            </div>
          }</For>
          <div class="hyron-store-add-source">
            <input aria-label="Nome da fonte" placeholder="Nome da fonte" value={sourceLabel()} onInput={(e) => setSourceLabel(e.currentTarget.value)} />
            <input aria-label="URL do catálogo JSON" placeholder="https://exemplo.org/extensoes.json" value={sourceUrl()} onInput={(e) => setSourceUrl(e.currentTarget.value)} />
            <button type="button" onClick={addSource}>Adicionar fonte</button>
          </div>
        </div>
      }>
        <form class="hyron-store-search" onSubmit={(e) => { e.preventDefault(); void search() }}>
          <input aria-label="Pesquisar extensões" placeholder="Pesquisar extensões e plugins..." value={query()} onInput={(e) => setQuery(e.currentTarget.value)} />
          <button type="submit" disabled={loading()}>{loading() ? "Pesquisando..." : "Pesquisar"}</button>
        </form>
        <div class="hyron-store-results">
          <div class="hyron-store-list">
            <For each={items()} fallback={<p class="hyron-store-placeholder">Pesquise em Open VSX, npm ou nas fontes personalizadas. Se a fonte bloquear a consulta pelo navegador, um aviso será exibido.</p>}>
              {(entry) => <button type="button" classList={{"hyron-store-entry": true, selected: selected()?.id === entry.id}} onClick={() => setSelected(entry)}>
                <strong>{entry.name}</strong><span>{entry.publisher} · {entry.source}</span>
                <small>{entry.description}</small>
                <em>{entry.type === "vsix" ? "VSIX · catálogo" : "Compatibilidade a verificar"}</em>
              </button>}
            </For>
          </div>
          <Show when={selected()}>{(entry) => <aside class="hyron-store-detail">
            <h4>{entry().name}</h4><p>{entry().publisher} · {entry().version || "Versão não informada"}</p>
            <p>{entry().description}</p>
            <p class="hyron-store-advisory">{entry().type === "vsix" ? "Extensão VS Code/VSIX: não é executável nativamente no HYRONCODE." : "Resultado de catálogo: o HYRONCODE não confirmou a compatibilidade nem instalou este pacote."}</p>
            <ExternalLink href={entry().url}>Abrir página da extensão</ExternalLink>
          
            <Show when={entry().id.startsWith("npm:")}>
              <HyronPluginControls name={entry().name} fromNpm={true} />
            </Show>
          </aside>}</Show>
        </div>
      </Show>
      <For each={errors()}>{(error) => <p class="hyron-store-error" role="alert">{error}</p>}</For>
      <p class="hyron-store-footnote">Instalação nativa de plugins permanece em Extensões → Plugins. Extensões VSIX ainda não são suportadas. Fontes JSON são apenas índices de descoberta.</p>
    </section>
  )
}
