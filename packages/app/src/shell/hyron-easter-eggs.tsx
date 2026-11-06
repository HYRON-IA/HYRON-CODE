import { For, Show, createSignal, onCleanup, onMount } from "solid-js"
import { advanceKonami, dispatchHyronEaster, HYRON_EASTER_EVENT, HYRON_RETRO_KEY, KONAMI_KEYS, type HyronEasterAction } from "./hyron-easter-logic"
import { applySecretSettings, clearSecretSettings, nextSecretSettings, parseSecretSettings, HYRON_SECRET_SETTINGS_KEY, SECRET_DEFAULTS, type SecretSettings, type SecretPhosphor } from "./hyron-secret-settings"
import "./hyron-easter-eggs.css"

// Original abstract code rain: no external media, scripts or network access.
const streams = Array.from({ length: 30 }, (_, index) => ({
  id: index,
  chars: Array.from({ length: 23 }, (_, i) => "01HYRON<>#=+*{}"[(i * 7 + index * 3) % 15]).join("\n"),
  left: `${(index + 0.3) * (100 / 30)}%`,
  delay: `${-(index % 11) * 0.63}s`,
  speed: `${5 + (index % 7)}s`,
}))

type Panel = "konami" | "creator" | "logo" | undefined

export function HyronEasterEggs() {
  const [matrix, setMatrix] = createSignal(false)
  const [retro, setRetro] = createSignal(false)
  const [secret, setSecret] = createSignal<SecretSettings>({ ...SECRET_DEFAULTS })
  const [panel, setPanel] = createSignal<Panel>()
  let history: string[] = []

  const applyRetro = (value: boolean) => {
    setRetro(value)
    if (value) document.documentElement.setAttribute("data-hyroncode-retro", "on")
    else document.documentElement.removeAttribute("data-hyroncode-retro")
    try { localStorage.setItem(HYRON_RETRO_KEY, value ? "on" : "off") } catch { /* ephemeral if storage unavailable */ }
  }
  const saveSecret = (next: SecretSettings) => {
    setSecret(next)
    applySecretSettings(document.documentElement, next)
    try { localStorage.setItem(HYRON_SECRET_SETTINGS_KEY, JSON.stringify(next)) } catch { /* optional local settings */ }
  }
  const changeSecret = (update: Partial<SecretSettings>) => saveSecret(nextSecretSettings(secret(), update))
  const resetVault = () => { saveSecret({ ...SECRET_DEFAULTS }); applyRetro(false) }
  const openMatrixFromVault = () => { setPanel(undefined); setMatrix(true) }
  onMount(() => {
    let previous: string | null = null
    try { previous = localStorage.getItem(HYRON_SECRET_SETTINGS_KEY) } catch { /* storage may be disabled */ }
    const initial = parseSecretSettings(previous)
    setSecret(initial)
    applySecretSettings(document.documentElement, initial)
    try { applyRetro(localStorage.getItem(HYRON_RETRO_KEY) === "on") } catch { applyRetro(false) }
    const command = (event: Event) => {
      const value = (event as CustomEvent<HyronEasterAction>).detail
      if (value === "matrix") { setMatrix(current => !current); return }
      if (value === "retro") { applyRetro(!retro()); return }
      if (value === "creator" || value === "konami" || value === "logo") setPanel(value)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (matrix()) { setMatrix(false); return }
        if (panel()) { setPanel(undefined); return }
      }
      if (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      // Never capture arrow keys or letters while a code editor, input, textarea or textbox has focus.
      const target = event.target
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable], [role="textbox"]')) {
        history = []
        return
      }
      const pressed = event.key.length === 1 ? event.key.toLowerCase() : event.key
      if (!KONAMI_KEYS.includes(pressed as (typeof KONAMI_KEYS)[number])) { history = []; return }
      const next = advanceKonami(history, pressed)
      history = next.matched ? [] : next.history
      if (next.matched) dispatchHyronEaster("konami")
    }
    window.addEventListener(HYRON_EASTER_EVENT, command)
    window.addEventListener("keydown", key)
    onCleanup(() => {
      window.removeEventListener(HYRON_EASTER_EVENT, command)
      window.removeEventListener("keydown", key)
      document.documentElement.removeAttribute("data-hyroncode-retro")
      clearSecretSettings(document.documentElement)
    })
  })

  return <div data-slot="hyroncode-easter-root" class="hyroncode-egg-root" aria-live="polite">
    <Show when={retro()}>
      <div data-slot="hyroncode-retro-indicator" class="hyroncode-egg-retro-indicator" role="status">
        TERMINAL RETRÔ ATIVO <button type="button" onClick={() => applyRetro(false)} aria-label="Sair do modo retrô">×</button>
      </div>
    </Show>
    <Show when={matrix()}>
      <div class="hyroncode-egg-matrix" role="dialog" aria-modal="true" aria-label="Chuva de código HYRONCODE">
        <div class="hyroncode-egg-rain" aria-hidden="true"><For each={streams}>{stream =>
          <span class="hyroncode-egg-stream" style={{ left: stream.left, "animation-delay": stream.delay, "animation-duration": stream.speed }}>{stream.chars}</span>
        }</For></div>
        <div class="hyroncode-egg-matrix-head">
          <strong>HYRONCODE // MATRIX</strong>
          <button type="button" onClick={() => setMatrix(false)}>Fechar ✕</button>
        </div>
        <p class="hyroncode-egg-matrix-title">ACESSO À CHUVA DE CÓDIGO</p>
        <p class="hyroncode-egg-matrix-subtitle">Efeito visual local · nenhuma permissão foi alterada.</p>
      </div>
    </Show>
    <Show when={panel()}>{kind =>
      <div class="hyroncode-egg-panel-backdrop" onClick={event => { if (event.target === event.currentTarget) setPanel(undefined) }}>
        <section class="hyroncode-egg-panel" role="dialog" aria-modal="true" aria-label="Segredo HYRONCODE">
          <div class="hyroncode-egg-panel-header"><strong>H.Y.R.O.N. · ARQUIVO SECRETO</strong><button type="button" aria-label="Fechar painel secreto" onClick={() => setPanel(undefined)}>✕</button></div>
          <Show when={kind() === "creator"}>
            <h2>Mensagem do criador</h2>
            <p>O HYRONCODE existe para transformar ideias em código, experimentar com responsabilidade e fazer a criatividade trabalhar junto da engenharia.</p>
            <p><strong>Recruta Zero Meia, SENTA A PUA!</strong> 🐍💚</p>
            <small>Mensagem comemorativa do Easter Egg; não é uma citação histórica.</small>
          </Show>
          <Show when={kind() === "konami"}>
            <div class="hyroncode-egg-vault-status">◉ SEQUÊNCIA RECONHECIDA · ↑ ↑ ↓ ↓ ← → ← → B A</div>
            <h2>COFRE ZERO MEIA</h2>
            <p class="hyroncode-egg-vault-intro">Acesso ao compartimento oculto do HYRONCODE. SENTA A PUA! 🐍💚</p>
            <div class="hyroncode-egg-vault-section">
              <h3>01 / APARÊNCIA CLANDESTINA</h3>
              <p>Escolha o fósforo do terminal secreto:</p>
              <div class="hyroncode-egg-vault-colors" role="group" aria-label="Cor do painel secreto">
                <For each={[{ id: "green", label: "Verde" }, { id: "amber", label: "Âmbar" }, { id: "cyan", label: "Ciano" }] as const}>{choice =>
                  <button type="button" classList={{ active: secret().phosphor === choice.id }} aria-pressed={secret().phosphor === choice.id} onClick={() => changeSecret({ phosphor: choice.id as SecretPhosphor })}>{choice.label}</button>
                }</For>
              </div>
              <label class="hyroncode-egg-vault-option">
                <span><strong>Terminal retrô</strong><small>A mesma opção de /retro.</small></span>
                <input type="checkbox" checked={retro()} onChange={event => applyRetro(event.currentTarget.checked)} />
              </label>
              <label class="hyroncode-egg-vault-option">
                <span><strong>Filtro CRT</strong><small>Linhas discretas de monitor antigo.</small></span>
                <input type="checkbox" checked={secret().crt} onChange={event => changeSecret({ crt: event.currentTarget.checked })} />
              </label>
              <label class="hyroncode-egg-vault-option">
                <span><strong>Reduzir animações</strong><small>Desativa a queda dos caracteres Matrix, inclusive em telas sensíveis a movimento.</small></span>
                <input type="checkbox" checked={secret().reducedMotion} onChange={event => changeSecret({ reducedMotion: event.currentTarget.checked })} />
              </label>
            </div>
            <div class="hyroncode-egg-vault-section">
              <h3>02 / ARQUIVOS RESERVADOS</h3>
              <div class="hyroncode-egg-vault-actions">
                <button type="button" onClick={openMatrixFromVault}>INICIAR MATRIX</button>
                <button type="button" onClick={() => setPanel("creator")}>MENSAGEM DO CRIADOR</button>
                <button type="button" onClick={() => setPanel("logo")}>ARQUIVO DE CURIOSIDADES</button>
              </div>
            </div>
            <div class="hyroncode-egg-vault-footer">
              <span>CONFIGURAÇÃO LOCAL · SEM ACESSO ADMINISTRATIVO</span>
              <button type="button" onClick={resetVault}>Restaurar padrão</button>
            </div>
          </Show>
          <Show when={kind() === "logo"}>
            <h2>Curiosidades do desenvolvimento</h2>
            <ul>
              <li>O HYRONCODE é desenvolvido sobre a base OpenCode 2.2.1.</li>
              <li>O catálogo principal tem 650 perfis planejados.</li>
              <li>Doze personagens secretos possuem perfis independentes.</li>
              <li>Os Easter Eggs não desbloqueiam acesso administrativo.</li>
            </ul>
          </Show>
        </section>
      </div>
    }</Show>
  </div>
}
