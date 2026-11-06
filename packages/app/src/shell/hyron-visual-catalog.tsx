import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { studioCatalog } from "@/settings/appearance/hyron-studio-catalog"
import { secretCharactersForQuery, secretCharacterById, isSecretCharacterId } from "@/settings/appearance/hyron-secret-characters"
import { activateHyronStudioProfile } from "@/settings/appearance/hyron-personality-selection"
import { resolveSecretPortrait, hasSecretPortraitOverride } from "./hyron-secret-portrait"
import { HYRON_LIVING_AVATAR_EVENT } from "./hyron-living-state"
import { deletePortrait, originalPortrait, portraitThumbnail, putPortrait, storedPortraitIds } from "./hyron-portrait-store"
import "./hyron-visual-catalog.css"

type Custom = { id: string; name: string; description: string }
type Stored = { active: boolean; selected: string; rude: number; custom: Custom[] }
type Entry = { id: string; name: string; origin: string; group: string; description: string }
const KEY = "hyroncode-studio-personality-v1"
const IMG_KEY = "hyroncode-personality-images-v1" // Mantém as imagens e links de versões anteriores.
const FAV_KEY = "hyroncode-personality-favorites-v1"
const HIDDEN_KEY = "hyroncode-personality-images-hidden-v2"
const PORTRAITS_MANIFEST = "/personalities/portraits/manifest.json"
const PAGE_SIZE = 24
const DEFAULT: Stored = { active: false, selected: "AR-011", rude: 0, custom: [] }

type Portraits = Record<string, string>
function load(): Stored {
  try {
    const obj: unknown = JSON.parse(localStorage.getItem(KEY) || "null")
    if (!obj || typeof obj !== "object") return { ...DEFAULT, custom: [] }
    const s = obj as Partial<Stored>
    return {
      active: s.active === true,
      selected: typeof s.selected === "string" ? s.selected : DEFAULT.selected,
      rude: Math.max(0, Math.min(5, typeof s.rude === "number" && Number.isFinite(s.rude) ? Math.round(s.rude) : 0)),
      custom: Array.isArray(s.custom)
        ? s.custom.filter((x): x is Custom => Boolean(x) && typeof x.id === "string" && x.id.startsWith("USER-") && typeof x.name === "string" && typeof x.description === "string").slice(0, 100)
        : [],
    }
  } catch { return { ...DEFAULT, custom: [] } }
}
function readRecord(key: string): Portraits {
  try {
    const obj: unknown = JSON.parse(localStorage.getItem(key) || "{}")
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {}
    return Object.fromEntries(Object.entries(obj).filter((pair): pair is [string, string] => typeof pair[1] === "string"))
  } catch { return {} }
}
function validAssetUrl(url: string): boolean {
  return /^\/personalities\/portraits\/[^/]+\.(png|jpg|jpeg|webp)$/i.test(url)
}
async function readManifest(): Promise<Portraits> {
  try {
    const response = await fetch(PORTRAITS_MANIFEST, { cache: "no-cache" })
    if (!response.ok) return {}
    const value: unknown = await response.json()
    if (!value || typeof value !== "object" || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter((pair): pair is [string, string] => typeof pair[1] === "string" && validAssetUrl(pair[1])))
  } catch { return {} }
}
const label = (item: Entry) => `${item.id} · ${item.name}`

/** O mesmo catálogo da aba Aparência e da gaveta lateral de Personalidade. */
export function HyronVisualCatalog(props: { onClose: () => void }) {
  const [state, setState] = createSignal<Stored>({ ...DEFAULT, custom: [] })
  const [query, setQuery] = createSignal("")
  const [group, setGroup] = createSignal("Todos")
  const [origin, setOrigin] = createSignal("Todas")
  const [onlyFavorites, setOnlyFavorites] = createSignal(false)
  const [page, setPage] = createSignal(1)
  const [current, setCurrent] = createSignal("")
  const [legacyImages, setLegacyImages] = createSignal<Portraits>({})
  const [localPortraits, setLocalPortraits] = createSignal<Portraits>({})
  const [hidden, setHidden] = createSignal<Portraits>({})
  const [uploaded, setUploaded] = createSignal<Portraits>({})
  const [thumbnails, setThumbnails] = createSignal<Portraits>({})
  const [broken, setBroken] = createSignal<Portraits>({})
  const [favorites, setFavorites] = createSignal<Portraits>({})
  const [message, setMessage] = createSignal("")
  const [imageUrl, setImageUrl] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  let imageFile: HTMLInputElement | undefined
  let multiFile: HTMLInputElement | undefined
  let searchInput: HTMLInputElement | undefined
  let uploadTarget = ""
  const allocated = new Map<string, string>()
  const pending = new Set<string>()
  let disposed = false

  const refresh = () => setState(load())
  onMount(() => {
    refresh()
    setLegacyImages(readRecord(IMG_KEY))
    setFavorites(readRecord(FAV_KEY))
    setHidden(readRecord(HIDDEN_KEY))
    void readManifest().then(value => { if (!disposed) setLocalPortraits(value) })
    void storedPortraitIds().then(ids => {
      if (!disposed) setUploaded(Object.fromEntries(ids.map(id => [id, "1"])))
    }).catch(error => setMessage(error instanceof Error ? error.message : "Banco de imagens indisponível."))
    const sync = () => { refresh(); setLegacyImages(readRecord(IMG_KEY)); setFavorites(readRecord(FAV_KEY)); setHidden(readRecord(HIDDEN_KEY)) }
    window.addEventListener("storage", sync)
    window.addEventListener("hyron-personality-change", sync)
    searchInput?.focus()
    onCleanup(() => {
      disposed = true
      window.removeEventListener("storage", sync)
      window.removeEventListener("hyron-personality-change", sync)
      for (const url of allocated.values()) URL.revokeObjectURL(url)
      allocated.clear()
    })
  })

  const entries = createMemo<Entry[]>(() => [
    ...secretCharactersForQuery(query()).map(x => ({ id: x.id, name: x.name, origin: x.origin, group: x.group, description: x.description })),
    ...studioCatalog.map(x => ({ id: x.id, name: x.name, origin: x.origin, group: x.group, description: x.description })),
    ...state().custom.map(x => ({ id: x.id, name: x.name, origin: "Original", group: "Meus perfis", description: x.description })),
  ])
  const origins = createMemo(() => ["Todas", ...Array.from(new Set(entries().filter(e => group() === "Todos" || e.group === group()).map(e => e.origin))).sort((a, b) => a.localeCompare(b, "pt-BR"))])
  // Um avatar secreto sempre mantém seu SVG de fábrica como fallback.
  const hasPortrait = (id: string) => isSecretCharacterId(id) || (!hidden()[id] && !broken()[id] && Boolean(uploaded()[id] || legacyImages()[id] || localPortraits()[id]))
  const customSecretPortrait = (id: string) => hasSecretPortraitOverride({ uploaded: Boolean(uploaded()[id]), link: legacyImages()[id] })
  const portrait = (id: string) => {
    if (isSecretCharacterId(id)) return resolveSecretPortrait({
      defaultAvatar: secretCharacterById(id)?.avatar ?? "",
      thumbnail: thumbnails()[id],
      link: legacyImages()[id],
      hidden: Boolean(hidden()[id]),
      broken: Boolean(broken()[id]),
    })
    return hidden()[id] || broken()[id] ? "" : thumbnails()[id] || legacyImages()[id] || localPortraits()[id] || ""
  }
  const filtered = createMemo(() => {
    const needle = query().trim().toLocaleLowerCase("pt-BR")
    return entries().filter(e =>
      isSecretCharacterId(e.id) || (
        (group() === "Todos" || e.group === group()) &&
        (origin() === "Todas" || e.origin === origin()) &&
        (!onlyFavorites() || favorites()[e.id] === "1") &&
        (!needle || `${e.id} ${e.name} ${e.origin} ${e.group} ${e.description}`.toLocaleLowerCase("pt-BR").includes(needle))
      )
    ).sort((a, b) => Number(isSecretCharacterId(b.id)) - Number(isSecretCharacterId(a.id)) || Number(hasPortrait(b.id)) - Number(hasPortrait(a.id)))
  })
  const withImageCount = createMemo(() => filtered().filter(e => hasPortrait(e.id)).length)
  const pages = createMemo(() => Math.max(1, Math.ceil(filtered().length / PAGE_SIZE)))
  const currentPage = createMemo(() => Math.min(page(), pages()))
  const visible = createMemo(() => filtered().slice((currentPage() - 1) * PAGE_SIZE, currentPage() * PAGE_SIZE))
  const visibleWithImages = createMemo(() => visible().filter(e => hasPortrait(e.id)))
  const visibleCompact = createMemo(() => visible().filter(e => !hasPortrait(e.id)))
  const chosen = createMemo(() => entries().find(e => e.id === current()))

  // Busca miniaturas somente para os cartões visíveis: não lê 650 arquivos completos ao abrir.
  createEffect(() => {
    for (const item of visibleWithImages()) {
      const id = item.id
      if (!uploaded()[id] || thumbnails()[id] || pending.has(id)) continue
      pending.add(id)
      void portraitThumbnail(id).then(blob => {
        if (disposed || !blob) return
        const url = URL.createObjectURL(blob)
        const previous = allocated.get(id)
        if (previous) URL.revokeObjectURL(previous)
        allocated.set(id, url)
        setThumbnails(s => ({ ...s, [id]: url }))
      }).catch(() => setMessage(`Não foi possível carregar a miniatura de ${id}.`)).finally(() => pending.delete(id))
    }
  })

  const persist = (key: string, record: Portraits, update: (value: Portraits) => void): boolean => {
    try { localStorage.setItem(key, JSON.stringify(record)); update(record); return true }
    catch { setMessage("Armazenamento local indisponível ou cheio."); return false }
  }
  const changeGroup = (value: string) => { setGroup(value); setOrigin("Todas"); setPage(1) }
  const save = (next: Stored) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
      setState(next)
      window.dispatchEvent(new Event("hyron-personality-change"))
      setMessage("Personalidade selecionada para as próximas mensagens.")
    } catch { setMessage("Não foi possível salvar esta personalidade.") }
  }
  const favorite = (id: string) => {
    const next = { ...favorites() }
    if (next[id]) delete next[id]; else next[id] = "1"
    persist(FAV_KEY, next, setFavorites)
  }
  const choose = (item: Entry) => {
    setCurrent(item.id)
    setImageUrl(legacyImages()[item.id]?.startsWith("https://") ? legacyImages()[item.id] : "")
  }
  // Foto, nome e botoes selecionam o mesmo perfil salvo pelo Estudio.
  // Preserva preferencias/customizacoes mesmo quando a outra interface as alterou.
  const activate = (item: Entry) => {
    choose(item)
    if (!activateHyronStudioProfile(item.id)) {
      setMessage("Falha ao ativar personalidade. Nenhuma preferencia foi sobrescrita.")
      return
    }
    refresh()
    setMessage(`${item.name} ativado(a) para as proximas mensagens.`)
  }
  const selectImage = (id: string) => {
    uploadTarget = id
    setCurrent(id)
    imageFile?.click()
  }
  const install = async (id: string, file: File): Promise<void> => {
    const thumb = await putPortrait(id, file)
    if (disposed) return
    const url = URL.createObjectURL(thumb)
    const old = allocated.get(id)
    if (old) URL.revokeObjectURL(old)
    allocated.set(id, url)
    setThumbnails(s => ({ ...s, [id]: url }))
    setUploaded(s => ({ ...s, [id]: "1" }))
    const next = { ...hidden() }; delete next[id]
    persist(HIDDEN_KEY, next, setHidden)
    setBroken(s => { const result = { ...s }; delete result[id]; return result })
    setPage(1) // O bloco com imagem passa imediatamente para o início.
    window.dispatchEvent(new Event(HYRON_LIVING_AVATAR_EVENT))
  }
  const uploadImage = async (file?: File) => {
    const id = uploadTarget
    if (imageFile) imageFile.value = ""
    if (!file || !id || busy()) return
    setBusy(true)
    try { await install(id, file); setMessage(`${id}: imagem salva. O cartão agora aparece primeiro.`) }
    catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao salvar imagem.") }
    finally { setBusy(false) }
  }
  const bulkUpload = async (files: FileList | null) => {
    const selectedFiles = Array.from(files ?? [])
    if (multiFile) multiFile.value = ""
    if (!selectedFiles.length || busy()) return
    setBusy(true)
    let success = 0
    const errors: string[] = []
    try {
      const allowed = new Set(entries().map(e => e.id))
      for (const file of selectedFiles) {
        const id = file.name.replace(/\.(png|jpe?g|webp)$/i, "").toUpperCase()
        if (!allowed.has(id)) { errors.push(file.name); continue }
        try { await install(id, file); success++ } catch { errors.push(file.name) }
      }
      setMessage(`${success} imagem(ns) importada(s) por código.${errors.length ? ` ${errors.length} ignorada(s): ${errors.slice(0, 3).join(", ")}.` : ""}`)
    } finally { setBusy(false) }
  }
  const removeImage = async (id: string) => {
    if (busy()) return
    setBusy(true)
    try {
      // Remove somente a substituição do usuário; o SVG padrão permanece no app.
      await deletePortrait(id)
      const nextHidden = { ...hidden() }
      if (isSecretCharacterId(id)) delete nextHidden[id]
      else nextHidden[id] = "1"
      // Mantém o comportamento original dos personagens convencionais.
      if (!persist(HIDDEN_KEY, nextHidden, setHidden)) return
      const nextLegacy = { ...legacyImages() }; delete nextLegacy[id]
      if (!persist(IMG_KEY, nextLegacy, setLegacyImages)) return
      setUploaded(s => { const copy = { ...s }; delete copy[id]; return copy })
      const previous = allocated.get(id)
      if (previous) { URL.revokeObjectURL(previous); allocated.delete(id) }
      setThumbnails(s => { const copy = { ...s }; delete copy[id]; return copy })
      setBroken(s => { const copy = { ...s }; delete copy[id]; return copy })
      window.dispatchEvent(new Event(HYRON_LIVING_AVATAR_EVENT))
      if (isSecretCharacterId(id)) {
        setImageUrl("")
        setMessage(`${id}: avatar padrão restaurado. A personalidade não foi alterada.`)
      } else {
        setPage(1) // O bloco sem foto deixa de reservar espaço e vai ao final.
        setMessage(`${id}: imagem removida. Cartão compacto movido para o fim.`)
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao remover imagem.") }
    finally { setBusy(false) }
  }
  const storeUrl = (id: string) => {
    const url = imageUrl().trim()
    if (!/^https:\/\/[^\s]+$/i.test(url)) { setMessage("Informe uma URL HTTPS válida."); return }
    const next = { ...legacyImages(), [id]: url }
    if (!persist(IMG_KEY, next, setLegacyImages)) return
    const nextHidden = { ...hidden() }; delete nextHidden[id]
    persist(HIDDEN_KEY, nextHidden, setHidden)
    setBroken(s => { const copy = { ...s }; delete copy[id]; return copy })
    setPage(1)
    setMessage("Link salvo. A imagem depende da disponibilidade do site externo; prefira importar arquivo.")
  }
  const downloadOriginal = async (id: string) => {
    try {
      const blob = await originalPortrait(id)
      if (!blob) { setMessage("Este retrato não está salvo no banco local. Use o arquivo original da pasta do projeto."); return }
      const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png"
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url; link.download = `${id}.${ext}`; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch { setMessage("Não foi possível exportar a imagem original.") }
  }
  const card = (item: Entry) => <article class="hyron-character-card" classList={{ "has-portrait": hasPortrait(item.id), "is-selected": state().active && state().selected === item.id }}>
    <Show when={hasPortrait(item.id) && portrait(item.id)}>
      <button type="button" class="hyron-character-card__picture" onClick={() => activate(item)} aria-label={`Ativar personalidade ${item.name}`}>
        <img src={portrait(item.id)} alt={`Retrato de ${item.name}`} loading="lazy" referrerPolicy="no-referrer" onError={() => { setBroken(s => ({ ...s, [item.id]: "1" })); setMessage(`Não foi possível carregar a imagem de ${item.id}. Adicione outro arquivo.`) }}/>
      </button>
    </Show>
    <div class="hyron-character-card__body">
      <div class="hyron-character-card__top"><span>{isSecretCharacterId(item.id) ? `✦ SECRETO · ${item.id}` : item.id}</span><button type="button" onClick={() => favorite(item.id)} aria-label={`Favoritar ${item.name}`} aria-pressed={favorites()[item.id] === "1"} class="hyron-character-card__favorite">{favorites()[item.id] === "1" ? "★" : "☆"}</button></div>
      <button type="button" class="hyron-character-card__name" onClick={() => activate(item)} title={`Ativar personalidade ${item.name}`}>{item.name}</button>
      <span class="hyron-character-card__origin" title={item.origin}>{item.origin}</span>
      <p class="hyron-character-card__description" title={item.description}>{item.description || "Descrição não cadastrada."}</p>
      <div class="hyron-character-card__actions">
        <button type="button" class="hyron-character-card__select" aria-pressed={state().active && state().selected === item.id} onClick={() => activate(item)}>{state().active && state().selected === item.id ? "Selecionado ✓" : "Selecionar"}</button>
        <button type="button" disabled={busy()} onClick={() => selectImage(item.id)}>{hasPortrait(item.id) ? "Trocar imagem" : "+ Adicionar imagem"}</button>
        <button type="button" onClick={() => choose(item)}>Detalhes</button>
      </div>
    </div>
  </article>

  return <section data-slot="hyron-visual-catalog" role="dialog" aria-modal="true" aria-label="Catálogo adaptativo de personalidades" class="hyron-character-overlay" onClick={e => { if (e.target === e.currentTarget) props.onClose() }}>
    <div class="hyron-character-modal">
      <header class="hyron-character-header">
        <div><h2>HYRONCODE · Catálogo de personagens</h2><p>{entries().length} perfis · {withImageCount()} com imagem · {filtered().length - withImageCount()} sem imagem · cards adaptativos</p></div>
        <button type="button" onClick={props.onClose} aria-label="Fechar catálogo" class="hyron-character-close">✕</button>
      </header>
      <div class="hyron-character-toolbar">
        <input ref={searchInput} value={query()} onInput={e => { setQuery(e.currentTarget.value); setPage(1) }} placeholder="Pesquisar nome, código JO, franquia..." aria-label="Buscar personagens" />
        <select value={group()} onChange={e => changeGroup(e.currentTarget.value)} aria-label="Filtrar categoria">
          <For each={["Todos", "Jogos", "Filmes", "Animes", "Séries", "Arquétipos", "Meus perfis"]}>{g => <option value={g}>{g}</option>}</For>
        </select>
        <select value={origin()} onChange={e => { setOrigin(e.currentTarget.value); setPage(1) }} aria-label="Filtrar franquia">
          <For each={origins()}>{o => <option value={o}>{o}</option>}</For>
        </select>
        <button type="button" aria-pressed={onlyFavorites()} onClick={() => { setOnlyFavorites(!onlyFavorites()); setPage(1) }}>{onlyFavorites() ? "★ Favoritos" : "☆ Favoritos"}</button>
        <button type="button" disabled={busy()} onClick={() => multiFile?.click()} title="Arquivos com nomes JO-573.png, FI-001.jpg, etc.">Importar vários</button>
        <input ref={multiFile} type="file" accept="image/png,image/jpeg,image/webp" multiple class="hyron-character-hidden" onChange={e => { void bulkUpload(e.currentTarget.files) }}/>
        <input ref={imageFile} type="file" accept="image/png,image/jpeg,image/webp" class="hyron-character-hidden" onChange={e => { void uploadImage(e.currentTarget.files?.[0]) }}/>
      </div>
      <div class="hyron-character-scroll">
        <Show when={visibleWithImages().length > 0}>
          <h3 class="hyron-character-section-title">▧ Com imagem <small>Primeiro na lista</small></h3>
          <div class="hyron-character-grid"><For each={visibleWithImages()}>{card}</For></div>
        </Show>
        <Show when={visibleCompact().length > 0}>
          <h3 class="hyron-character-section-title">▤ Sem imagem <small>Cartões compactos no fim da lista</small></h3>
          <div class="hyron-character-grid hyron-character-grid--compact"><For each={visibleCompact()}>{card}</For></div>
        </Show>
        <Show when={!filtered().length}><p class="hyron-character-empty">Nenhum personagem encontrado. Ajuste a busca e os filtros.</p></Show>
        <Show when={chosen()}>{item => <div class="hyron-character-detail">
          <div class="hyron-character-detail__heading"><div><strong>{label(item())}</strong><span>{item().origin} · {item().group}</span></div><button type="button" onClick={() => setCurrent("")}>Fechar detalhes ✕</button></div>
          <p>{item().description}</p>
          <div class="hyron-character-detail__actions">
            <button type="button" class="hyron-character-accent" onClick={() => activate(item())}>{state().active && state().selected === item().id ? "Personalidade ativa ✓" : "Ativar personalidade"}</button>
            <button type="button" disabled={busy()} onClick={() => selectImage(item().id)}>{hasPortrait(item().id) ? "Trocar imagem" : "+ Adicionar imagem"}</button>
            <Show when={isSecretCharacterId(item().id) ? customSecretPortrait(item().id) : hasPortrait(item().id)}>
              <button type="button" disabled={busy()} onClick={() => { void removeImage(item().id) }}>{isSecretCharacterId(item().id) ? "Restaurar avatar padrão" : "Remover imagem"}</button>
            </Show>
            <Show when={uploaded()[item().id]}><button type="button" onClick={() => { void downloadOriginal(item().id) }}>Baixar original</button></Show>
            <label class="hyron-character-rudeness">Irreverência: {state().rude}/5 <input type="range" min="0" max="5" step="1" value={state().rude} onInput={e => save({ ...state(), rude: Number(e.currentTarget.value) })}/></label>
          </div>
          <Show when={!isSecretCharacterId(item().id)}><div class="hyron-character-url"><input type="url" value={imageUrl()} onInput={e => setImageUrl(e.currentTarget.value)} placeholder="Alternativa: URL HTTPS de imagem" aria-label="Link de imagem"/><button type="button" onClick={() => storeUrl(item().id)}>Salvar link</button></div></Show>
        </div>}</Show>
      </div>
      <footer class="hyron-character-footer">
        <span aria-live="polite">{busy() ? "Processando imagens..." : message() || "Imagens carregadas do computador permanecem no banco local. Sem imagem = cartão compacto no final."}</span>
        <div><button type="button" disabled={currentPage() <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Anterior</button><span>Página {currentPage()} / {pages()}</span><button type="button" disabled={currentPage() >= pages()} onClick={() => setPage(p => Math.min(pages(), p + 1))}>Próxima →</button></div>
      </footer>
    </div>
  </section>
}
