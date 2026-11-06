/** HYRONCODE — Personalidades Vivas. Apenas UI; nao muda instrucoes da IA. */
export const HYRON_LIVING_SETTINGS_KEY = "hyroncode.living-personalities.v1"
export const HYRON_LIVING_CHANGE_EVENT = "hyroncode:living-personalities-change"
export const HYRON_LIVING_AVATAR_EVENT = "hyroncode:living-avatar-change"
export const HYRON_LIVING_STUDIO_KEY = "hyroncode-studio-personality-v1"

export type LivingPreferences = { animation: boolean; railIndicator: boolean }
export type LivingSelection = { id: string; customName?: string }
export const LIVING_DEFAULTS: Readonly<LivingPreferences> = Object.freeze({ animation: true, railIndicator: true })

export function parseLivingPreferences(raw: string | null): LivingPreferences {
  if (!raw) return { ...LIVING_DEFAULTS }
  try {
    const data: unknown = JSON.parse(raw)
    if (!data || typeof data !== "object" || Array.isArray(data)) return { ...LIVING_DEFAULTS }
    const input = data as Record<string, unknown>
    return {
      animation: typeof input.animation === "boolean" ? input.animation : LIVING_DEFAULTS.animation,
      railIndicator: typeof input.railIndicator === "boolean" ? input.railIndicator : LIVING_DEFAULTS.railIndicator,
    }
  } catch { return { ...LIVING_DEFAULTS } }
}

/** Somente a selecao ja ativa. Nao enumera secretos nem ativa perfis implicitamente. */
export function parseLivingSelection(raw: string | null): LivingSelection | undefined {
  if (!raw) return
  try {
    const data: unknown = JSON.parse(raw)
    if (!data || typeof data !== "object" || Array.isArray(data)) return
    const input = data as Record<string, unknown>
    if (input.active !== true || typeof input.selected !== "string" || !/^[\p{L}0-9-]{1,95}$/u.test(input.selected)) return
    const custom = Array.isArray(input.custom) ? input.custom.find((item: unknown) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false
      const entry = item as Record<string, unknown>
      return entry.id === input.selected && typeof entry.name === "string"
    }) as Record<string, unknown> | undefined : undefined
    return { id: input.selected, customName: typeof custom?.name === "string" ? custom.name.slice(0, 80) : undefined }
  } catch { return }
}

export function isValidLivingPortraitUrl(value: unknown): value is string {
  return typeof value === "string" && /^\/personalities\/portraits\/[\p{L}0-9_-]+\.(?:png|jpg|jpeg|webp)$/iu.test(value)
}

export function readLivingPortraitLink(raw: string | null, id: string): string | undefined {
  if (!raw) return
  try {
    const data: unknown = JSON.parse(raw)
    if (!data || typeof data !== "object" || Array.isArray(data)) return
    const result = (data as Record<string, unknown>)[id]
    return typeof result === "string" && /^https:\/\/[^\s]+$/i.test(result) ? result : undefined
  } catch { return }
}
