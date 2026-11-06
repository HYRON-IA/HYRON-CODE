import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import { studioCatalog } from "@/settings/appearance/hyron-studio-catalog"
import { secretCharacterById } from "@/settings/appearance/hyron-secret-characters"
import { portraitThumbnail } from "./hyron-portrait-store"
import {
  HYRON_LIVING_AVATAR_EVENT,
  HYRON_LIVING_CHANGE_EVENT,
  HYRON_LIVING_SETTINGS_KEY,
  HYRON_LIVING_STUDIO_KEY,
  isValidLivingPortraitUrl,
  LIVING_DEFAULTS,
  parseLivingPreferences,
  parseLivingSelection,
  readLivingPortraitLink,
  type LivingPreferences,
  type LivingSelection,
} from "./hyron-living-state"
import "./hyron-living.css"

const LEGACY_IMAGES = "hyroncode-personality-images-v1"
const PORTRAITS_MANIFEST = "/personalities/portraits/manifest.json"

/** Uma unica fonte de estado para a gaveta e o indicador da barra. */
function livingSignals() {
  const [selection, setSelection] = createSignal<LivingSelection>()
  const [preferences, setPreferences] = createSignal<LivingPreferences>({ ...LIVING_DEFAULTS })
  const [avatarRevision, setAvatarRevision] = createSignal(0)
  const [portrait, setPortrait] = createSignal("")

  onMount(() => {
    const refresh = () => {
      try {
        setSelection(parseLivingSelection(localStorage.getItem(HYRON_LIVING_STUDIO_KEY)))
        const prefs = parseLivingPreferences(localStorage.getItem(HYRON_LIVING_SETTINGS_KEY))
        setPreferences(prefs)
        // CSS usa uma flag para os avatares ativos do catalogo e desta gaveta.
        if (prefs.animation) document.documentElement.setAttribute("data-hyron-living-animation", "on")
        else document.documentElement.removeAttribute("data-hyron-living-animation")
      } catch { /* UI opcional: nunca impedir o chat */ }
    }
    const avatarChanged = () => setAvatarRevision(x => x + 1)
    refresh()
    window.addEventListener("hyron-personality-change", refresh)
    window.addEventListener("storage", refresh)
    window.addEventListener(HYRON_LIVING_CHANGE_EVENT, refresh)
    window.addEventListener(HYRON_LIVING_AVATAR_EVENT, avatarChanged)
    onCleanup(() => {
      window.removeEventListener("hyron-personality-change", refresh)
      window.removeEventListener("storage", refresh)
      window.removeEventListener(HYRON_LIVING_CHANGE_EVENT, refresh)
      window.removeEventListener(HYRON_LIVING_AVATAR_EVENT, avatarChanged)
    })
  })

  const profile = createMemo(() => {
    const current = selection()
    if (!current) return
    const secret = secretCharacterById(current.id)
    const catalog = studioCatalog.find(item => item.id === current.id)
    return {
      id: current.id,
      name: secret?.name ?? catalog?.name ?? current.customName ?? current.id,
      origin: secret?.origin ?? catalog?.origin ?? "Perfil personalizado",
      fallback: secret?.avatar ?? "",
      secret: Boolean(secret),
    }
  })

  createEffect(() => {
    const current = profile()
    avatarRevision()
    if (!current) { setPortrait(""); return }
    const id = current.id
    setPortrait(current.fallback)
    let available = true
    let objectUrl: string | undefined
    let link: string | undefined
    try { link = readLivingPortraitLink(localStorage.getItem(LEGACY_IMAGES), id) } catch { /* sem link */ }
    if (link) setPortrait(link)

    // O IndexedDB tem prioridade sobre o SVG distribuido e sobre links externos.
    void portraitThumbnail(id).then(blob => {
      if (!available || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setPortrait(objectUrl)
    }).catch(() => { /* avatares sao opcionais */ })

    // Fotos convencionais instaladas com o catalogo de 650 perfis.
    if (!current.secret && !link) {
      void fetch(PORTRAITS_MANIFEST, { cache: "no-cache" })
        .then(response => response.ok ? response.json() as Promise<unknown> : undefined)
        .then(value => {
          if (!available || objectUrl || !value || typeof value !== "object" || Array.isArray(value)) return
          const image = (value as Record<string, unknown>)[id]
          if (isValidLivingPortraitUrl(image)) setPortrait(image)
        }).catch(() => { /* o indicador usa iniciais */ })
    }
    onCleanup(() => {
      available = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    })
  })

  const save = (update: Partial<LivingPreferences>) => {
    const next = { ...preferences(), ...update }
    try {
      localStorage.setItem(HYRON_LIVING_SETTINGS_KEY, JSON.stringify(next))
      setPreferences(next)
      window.dispatchEvent(new Event(HYRON_LIVING_CHANGE_EVENT))
    } catch { /* configuracao opcional; falha nao altera o catalogo */ }
  }
  return { profile, preferences, portrait, save }
}

function LivingPortrait(props: { name: string; portrait: string; active?: boolean }) {
  return <span class="hyron-living-portrait" classList={{ "hyron-living-portrait--active": Boolean(props.active) }} aria-hidden="true">
    <span class="hyron-living-initial">{props.name.slice(0, 1).toLocaleUpperCase("pt-BR")}</span>
    <Show when={props.portrait}>
      <img src={props.portrait} alt="" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = "none" }} />
    </Show>
  </span>
}

export function HyronLivingPanel() {
  const living = livingSignals()
  return <section class="hyron-living-panel" aria-label="Personalidades Vivas">
    <div class="hyron-living-panel__heading"><strong>✧ Personalidades Vivas</strong><span>Identidade ativa e presença visual</span></div>
    <Show when={living.profile()} fallback={<p class="hyron-living-muted">Estúdio desativado. Ative uma personalidade no catálogo para ver sua presença aqui.</p>}>
      {item => <div class="hyron-living-identity">
        <LivingPortrait name={item().name} portrait={living.portrait()} active={true}/>
        <div class="hyron-living-identity__text"><strong>{item().name}</strong><small>{item().origin} · {item().id}</small><span role="status">● Perfil ativo nas próximas mensagens</span></div>
      </div>}
    </Show>
    <label><input type="checkbox" checked={living.preferences().animation} onChange={event => living.save({ animation: event.currentTarget.checked })} /> Animar discretamente o retrato ativo</label>
    <label><input type="checkbox" checked={living.preferences().railIndicator} onChange={event => living.save({ railIndicator: event.currentTarget.checked })} /> Mostrar personagem ativo na barra de Ferramentas</label>
    <small class="hyron-living-muted">Somente aparência. Sem alterar modelos, prompts, permissões ou ferramentas. Respeita redução de movimento do sistema e Cofre Zero Meia.</small>
  </section>
}

export function HyronLivingRailIndicator(props: { expanded: boolean; onOpen: () => void }) {
  const living = livingSignals()
  return <Show when={living.preferences().railIndicator && living.profile()}>
    {item => <button type="button" onClick={props.onOpen} class="hyron-living-rail" title={`Personalidade ativa: ${item().name}`} aria-label={`Personalidade ativa: ${item().name}. Abrir painel`}>
      <span class="hyron-living-rail__dot" aria-hidden="true" />
      <Show when={props.expanded}><span class="hyron-living-rail__name">{item().name}</span></Show>
    </button>}
  </Show>
}
