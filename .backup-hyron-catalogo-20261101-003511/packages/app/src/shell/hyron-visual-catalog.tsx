import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { studioCatalog } from "@/settings/appearance/hyron-studio-catalog"

type Custom = { id: string; name: string; description: string }
type Stored = { active: boolean; selected: string; rude: number; custom: Custom[] }
type Entry = { id: string; name: string; origin: string; group: string; description: string }
const KEY = "hyroncode-studio-personality-v1"
const IMG_KEY = "hyroncode-personality-images-v1"
const FAV_KEY = "hyroncode-personality-favorites-v1"
// Local portrait manifest: images are imported into public/personalities/portraits.
// No image search, remote fetching, or third-party asset redistribution.
const PORTRAITS_MANIFEST = "/personalities/portraits/manifest.json"
type LocalPortraits = Record<string,string>
function isLocalPortrait(value: string): boolean {
  return /^\/personalities\/portraits\/[^/]+\.(png|jpg|jpeg|webp|svg)$/.test(value)
}
async function loadLocalPortraits(): Promise<LocalPortraits> {
  try {
    const res = await fetch(PORTRAITS_MANIFEST, { cache: "no-cache" })
    if (!res.ok) return {}
    const data: unknown = await res.json()
    if (!data || typeof data !== "object" || Array.isArray(data)) return {}
    return Object.fromEntries(Object.entries(data).filter((entry): entry is [string,string] => typeof entry[1] === "string" && isLocalPortrait(entry[1])))
  } catch { return {} }
}
const PAGE_SIZE = 15
const DEFAULT: Stored = { active: false, selected: "AR-011", rude: 0, custom: [] }
function load(): Stored {
  try {
    const obj: unknown = JSON.parse(localStorage.getItem(KEY) || "null")
    if (!obj || typeof obj !== "object") return { ...DEFAULT, custom: [] }
    const s = obj as Partial<Stored>
    return { active: s.active === true, selected: typeof s.selected === "string" ? s.selected : DEFAULT.selected,
      rude: Math.max(0, Math.min(5, typeof s.rude === "number" && Number.isFinite(s.rude) ? Math.round(s.rude) : 0)),
      custom: Array.isArray(s.custom) ? s.custom.filter((x): x is Custom => Boolean(x) && typeof x.id === "string" && x.id.startsWith("USER-") && typeof x.name === "string" && typeof x.description === "string").slice(0, 100) : [] }
  } catch { return { ...DEFAULT, custom: [] } }
}
function readRecord(key: string): Record<string, string> {
  try { const x: unknown = JSON.parse(localStorage.getItem(key) || "{}"); return x && typeof x === "object" && !Array.isArray(x) ? x as Record<string, string> : {} } catch { return {} }
}
export function HyronVisualCatalog(props: { onClose: () => void }) {
  const [state, setState] = createSignal<Stored>({ ...DEFAULT, custom: [] })
  const [query, setQuery] = createSignal("")
  const [group, setGroup] = createSignal("Todos")
  const [origin, setOrigin] = createSignal("Todas")
  const [onlyFavorites, setOnlyFavorites] = createSignal(false)
  const [page, setPage] = createSignal(1)
  const [current, setCurrent] = createSignal("")
  const [images, setImages] = createSignal<Record<string, string>>({})
  const [localPortraits, setLocalPortraits] = createSignal<LocalPortraits>({})
  const [favorites, setFavorites] = createSignal<Record<string, string>>({})
  const [message, setMessage] = createSignal("")
  const [imageUrl, setImageUrl] = createSignal("")
  let imageFile: HTMLInputElement | undefined
  let searchInput: HTMLInputElement | undefined
  const refresh = () => setState(load())
  onMount(() => {
    refresh(); setImages(readRecord(IMG_KEY)); setFavorites(readRecord(FAV_KEY))
    void loadLocalPortraits().then(setLocalPortraits)
    const sync = () => refresh()
    window.addEventListener("storage", sync)
    window.addEventListener("hyron-personality-change", sync)
    searchInput?.focus()
    onCleanup(() => { window.removeEventListener("storage", sync); window.removeEventListener("hyron-personality-change", sync) })
  })
  const entries = createMemo<Entry[]>(() => [
    ...studioCatalog.map(x => ({ id: x.id, name: x.name, origin: x.origin, group: x.group, description: x.description })),
    ...state().custom.map(x => ({ id: x.id, name: x.name, origin: "Original", group: "Meus perfis", description: x.description })),
  ])
  const origins = createMemo(() => ["Todas", ...Array.from(new Set(entries().filter(e => group() === "Todos" || e.group === group()).map(e => e.origin))).sort((a,b) => a.localeCompare(b, "pt-BR"))])
  const filtered = createMemo(() => entries().filter(e => {
    const needle = query().trim().toLocaleLowerCase("pt-BR")
    return (group() === "Todos" || e.group === group()) && (origin() === "Todas" || e.origin === origin()) &&
      (!onlyFavorites() || favorites()[e.id] === "1") && (!needle || `${e.name} ${e.origin} ${e.description}`.toLocaleLowerCase("pt-BR").includes(needle))
  }))
  const pages = createMemo(() => Math.max(1, Math.ceil(filtered().length / PAGE_SIZE)))
  const currentPage = createMemo(() => Math.min(page(), pages()))
  const visible = createMemo(() => filtered().slice((currentPage()-1)*PAGE_SIZE, currentPage()*PAGE_SIZE))
  const chosen = createMemo(() => entries().find(e => e.id === current()))
  // User-selected portraits take priority; packaged local images are the fallback.
  const portrait = (item: Entry) => images()[item.id] || localPortraits()[item.id] || ""

  const changeGroup = (g: string) => { setGroup(g); setOrigin("Todas"); setPage(1) }
  const save = (next: Stored) => {
    try { localStorage.setItem(KEY, JSON.stringify(next)); setState(next); window.dispatchEvent(new Event("hyron-personality-change")); setMessage("Personalidade ativada para as próximas mensagens.") }
    catch { setMessage("Não foi possível salvar esta personalidade.") }
  }
  const persistRecord = (key: string, record: Record<string, string>, update: (v: Record<string,string>)=>void) => {
    try { localStorage.setItem(key, JSON.stringify(record)); update(record) }
    catch { setMessage("Armazenamento cheio ou indisponível.") }
  }
  const favorite = (id: string) => {
    const next = { ...favorites() }
    if (next[id]) delete next[id]; else next[id] = "1"
    persistRecord(FAV_KEY, next, setFavorites)
  }
  const addImage = (id: string, url: string) => {
    const next = { ...images() }
    if (url) next[id] = url; else delete next[id]
    persistRecord(IMG_KEY, next, setImages)
  }
  const uploadImage = (file?: File) => {
    const id = current()
    if (!file || !id) return
    if (!file.type.startsWith("image/") || file.size > 140_000) { setMessage("Escolha PNG, JPEG ou WebP com até 140 KB."); return }
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === "string") { addImage(id, reader.result); setMessage("Retrato salvo localmente.") } }
    reader.readAsDataURL(file)
    if (imageFile) imageFile.value = ""
  }
  const field = "bg-v2-background-bg-deep border border-v2-border-base rounded-md px-3 py-2 text-v2-text-strong text-sm"
  return <section data-slot="hyron-visual-catalog" role="dialog" aria-modal="true" aria-label="Catálogo visual de personalidades"
      class="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-2 md:p-4" onClick={e => { if (e.target === e.currentTarget) props.onClose() }}>
    <div class="flex flex-col w-[90vw] h-[90vh] max-w-[1500px] min-w-0 min-h-0 overflow-hidden rounded-xl border border-v2-border-base bg-v2-background-bg-deep text-v2-text-strong shadow-2xl">
      <header class="flex shrink-0 items-center justify-between gap-3 border-b border-v2-border-base px-4 py-3">
        <div><h2 class="font-semibold text-lg">HYRONCODE · Catálogo de personalidades</h2><p class="text-xs opacity-70">{filtered().length} resultados · 15 cards por página · {entries().length} perfis disponíveis</p></div>
        <button type="button" onClick={props.onClose} class="rounded-lg px-3 py-2 hover:bg-v2-background-bg-hover" aria-label="Fechar catálogo">✕</button>
      </header>
      <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-v2-border-base p-3">
        <input ref={searchInput} class={`${field} min-w-[130px] flex-1`} value={query()} onInput={e=>{setQuery(e.currentTarget.value);setPage(1)}} placeholder="Buscar nome, franquia ou característica..." aria-label="Buscar no catálogo completo"/>
        <select class={field} value={group()} onChange={e=>changeGroup(e.currentTarget.value)} aria-label="Filtrar categoria">
          <For each={["Todos","Jogos","Filmes","Animes","Séries","Arquétipos","Meus perfis"]}>{g=><option value={g}>{g}</option>}</For>
        </select>
        <select class={`${field} max-w-[200px]`} value={origin()} onChange={e=>{setOrigin(e.currentTarget.value);setPage(1)}} aria-label="Filtrar obra">
          <For each={origins()}>{o=><option value={o}>{o}</option>}</For>
        </select>
        <button type="button" onClick={()=>{setOnlyFavorites(!onlyFavorites());setPage(1)}} aria-pressed={onlyFavorites()} class={`${field} ${onlyFavorites()?"ring-2 ring-emerald-600":""}`}>★ Favoritos</button>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 md:p-4">
        <div class="grid grid-cols-3 gap-2 md:gap-3">
          <For each={visible()}>{item => <div class={`relative min-w-0 overflow-hidden rounded-lg border ${current()===item.id?"border-emerald-500 ring-1 ring-emerald-500":"border-v2-border-base"}`}>
            <button type="button" onClick={()=>{setCurrent(item.id);setImageUrl(images()[item.id]?.startsWith("https://")?images()[item.id]:"")}} aria-pressed={current()===item.id} class="w-full text-left hover:bg-v2-background-bg-hover focus-visible:outline-2 focus-visible:outline-emerald-400">
              <div class="aspect-[4/3] w-full overflow-hidden bg-v2-background-bg-hover flex items-center justify-center">
                <Show when={portrait(item)} fallback={<span class="text-2xl md:text-4xl font-semibold opacity-25">"Retrato ainda nao confirmado"</span>}>
                  <img src={portrait(item)} alt={`Foto de cosplay representando ${item.name}`} loading="lazy" referrerPolicy="no-referrer" class="h-full w-full object-contain object-center" onError={e=>{e.currentTarget.style.display="none"}}/>
                </Show>
              </div>
              <div class="p-2"><div class="font-semibold text-xs md:text-sm truncate" title={item.name}>{item.name}</div><div class="text-[11px] opacity-70 truncate" title={item.origin}>{item.origin}</div></div>
            </button>
            <button type="button" onClick={()=>favorite(item.id)} aria-label={`Favoritar ${item.name}`} aria-pressed={favorites()[item.id]==="1"} class="absolute top-1 right-1 rounded bg-black/60 text-yellow-300 p-1.5">{favorites()[item.id]==="1"?"★":"☆"}</button>
          </div>}</For>
        </div>
        <Show when={!filtered().length}><p class="text-center opacity-70 p-6">Nenhum perfil encontrado. Ajuste os filtros.</p></Show>
        <Show when={chosen()}>{item => <div class="mt-4 rounded-xl border border-v2-border-base p-3 flex flex-col gap-2">
          <div class="flex flex-wrap items-center justify-between gap-2"><strong>{item().name} · {item().origin}</strong><span class="text-xs opacity-70">{item().group}</span></div>
          <p class="text-sm">{item().description}</p>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" onClick={()=>save({...state(),selected:item().id,active:true})} class="rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 text-sm">{state().active&&state().selected===item().id?"Ativa ✓":"Ativar personalidade"}</button>
            <label class="text-xs">Má educação: {state().rude}/5 <input type="range" min="0" max="5" step="1" value={state().rude} onInput={e=>save({...state(),rude:Number(e.currentTarget.value)})}/></label>
            <button type="button" class={`${field}`} onClick={()=>imageFile?.click()}>Adicionar retrato</button>
            <input ref={imageFile} class="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>uploadImage(e.currentTarget.files?.[0])}/>
            <input value={imageUrl()} onInput={e=>setImageUrl(e.currentTarget.value)} placeholder="Ou URL HTTPS da imagem" aria-label="URL HTTPS do retrato" class={`${field} min-w-[170px] flex-1`}/>
            <button type="button" class={field} onClick={()=>{if(imageUrl().trim().startsWith("https://"))addImage(item().id,imageUrl().trim());else setMessage("Informe um endereço HTTPS válido.")}}>Salvar URL</button>
            <Show when={images()[item().id]}><button type="button" class={field} onClick={()=>{addImage(item().id,"");setImageUrl("")}}>Remover retrato</button></Show>
          </div>
        </div>}</Show>
      </div>
      <footer class="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t border-v2-border-base px-4 py-3">
        <p aria-live="polite" class="text-xs opacity-75">{message() || "Imagens locais: use IMPORTAR-RETRATOS.bat para incluir arquivos na pasta do projeto. Fotos adicionadas manualmente têm prioridade."}</p>
        <div class="flex items-center gap-3">
          <button type="button" class={`${field} disabled:opacity-40`} disabled={currentPage()<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>← Anterior</button>
          <span class="text-xs whitespace-nowrap">{currentPage()} / {pages()}</span>
          <button type="button" class={`${field} disabled:opacity-40`} disabled={currentPage()>=pages()} onClick={()=>setPage(p=>Math.min(pages(),p+1))}>Próxima →</button>
        </div>
      </footer>
    </div>
  </section>
}
