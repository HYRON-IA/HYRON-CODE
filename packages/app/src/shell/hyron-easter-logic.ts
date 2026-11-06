/** HYRONCODE V1.4: Easter Eggs isolated from the ordinary OpenCode command registry. */
export const HYRON_EASTER_EVENT = "hyroncode:easter-trigger"
export const HYRON_RETRO_KEY = "hyroncode.easter.retro-v1"

export type HyronEasterAction = "matrix" | "retro" | "creator" | "konami" | "logo"
export type HyronEasterChatTrigger = "senta" | "zero-meia"

/** Exact commands only: never hijack a programmer's code or a longer slash command. */
export function easterUiCommand(text: string): HyronEasterAction | undefined {
  const command = text.trim().toLowerCase()
  if (command === "/matrix") return "matrix"
  if (command === "/retro") return "retro"
  if (command === "/creator") return "creator"
}

export function easterChatTrigger(text: string): HyronEasterChatTrigger | undefined {
  const normalized = text.trim().replace(/!+$/u, "").trim().replace(/\s+/gu, " ").toLowerCase()
  if (normalized === "senta a pua") return "senta"
  if (normalized === "ativar protocolo zero meia") return "zero-meia"
}

export type HyronEasterPersonality = {
  enabled: boolean
  mode: "oficial" | "tecnico" | "objetivo" | "personalizado"
  custom: string
}

const special: Record<HyronEasterChatTrigger, string> = {
  senta: "[EASTER EGG HYRONCODE: SENTA A PUA] O usuario digitou exatamente o lema secreto. Responda com uma celebracao breve e criativa do projeto, incluindo 'SENTA A PUA!' se a voz ativa permitir, sem alegar ter executado tarefas. Respeite a personalidade previamente selecionada, sobretudo vocabularios exclusivos de AI Chubis. Nao mude codigo, comandos, ferramentas nem permissoes. [/EASTER EGG]",
  "zero-meia": "[EASTER EGG HYRONCODE: PROTOCOLO ZERO MEIA] O usuario ativou uma mensagem ficcional de boas-vindas ao Protocolo Zero Meia. Responda de forma breve, em clima de operacao secreta. Isto NAO habilita privilegios, ferramentas, acesso administrativo nem muda configuracoes. Respeite a voz ativa e o vocabulario de personagens Chubi. [/EASTER EGG]",
}

/** Keep the real identity and all tool behavior; this extra directive applies to ONE prompt only. */
export function withHyronEasterPrompt(base: HyronEasterPersonality, text: string): HyronEasterPersonality {
  const match = easterChatTrigger(text)
  if (!match) return base
  const style = base.mode === "tecnico" ? "Estilo tecnico: mantenha precisao." :
    base.mode === "objetivo" ? "Estilo objetivo: seja conciso." :
    base.mode === "oficial" ? "Identidade HYRONCODE oficial: colaborativa e clara." : ""
  // The server truncates custom instructions at 6000 chars; preserve up to 5200 of the active profile.
  const preserved = (base.mode === "personalizado" ? base.custom : style).slice(0, 5200)
  return { ...base, enabled: true, mode: "personalizado", custom: [preserved, special[match]].filter(Boolean).join("\n") }
}

export const KONAMI_KEYS = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"] as const

export function advanceKonami(history: readonly string[], key: string): { history: string[]; matched: boolean } {
  const next = [...history, key].slice(-KONAMI_KEYS.length)
  return { history: next, matched: next.length === KONAMI_KEYS.length && next.every((value, i) => value === KONAMI_KEYS[i]) }
}

export type LogoClicks = { count: number; last: number }
export function advanceLogoClicks(previous: LogoClicks, now: number): { state: LogoClicks; matched: boolean } {
  const count = now >= previous.last && now - previous.last <= 1400 ? previous.count + 1 : 1
  return { state: { count: count >= 5 ? 0 : count, last: now }, matched: count >= 5 }
}

export function dispatchHyronEaster(action: HyronEasterAction) {
  window.dispatchEvent(new CustomEvent<HyronEasterAction>(HYRON_EASTER_EVENT, { detail: action }))
}
