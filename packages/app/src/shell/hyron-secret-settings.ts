/** HYRONCODE V1.5 - preferencias do Cofre Zero Meia. Nao altera privilegios nem a IA. */
export const HYRON_SECRET_SETTINGS_KEY = "hyroncode.easter.vault-settings-v1"
export type SecretPhosphor = "green" | "amber" | "cyan"
export type SecretSettings = { phosphor: SecretPhosphor; crt: boolean; reducedMotion: boolean }
export const SECRET_DEFAULTS: Readonly<SecretSettings> = Object.freeze({
  phosphor: "green", crt: false, reducedMotion: false,
})

/** Falhas de armazenamento e dados antigos nunca devem impedir a interface de abrir. */
export function parseSecretSettings(raw: string | null): SecretSettings {
  if (!raw) return { ...SECRET_DEFAULTS }
  try {
    const object: unknown = JSON.parse(raw)
    if (!object || typeof object !== "object" || Array.isArray(object)) return { ...SECRET_DEFAULTS }
    const input = object as Record<string, unknown>
    return {
      phosphor: input.phosphor === "amber" || input.phosphor === "cyan" ? input.phosphor : "green",
      crt: input.crt === true,
      reducedMotion: input.reducedMotion === true,
    }
  } catch {
    return { ...SECRET_DEFAULTS }
  }
}

export function nextSecretSettings(current: SecretSettings, update: Partial<SecretSettings>): SecretSettings {
  return parseSecretSettings(JSON.stringify({ ...current, ...update }))
}

/** Somente atributos visuais com valores previamente validados. */
export function applySecretSettings(root: HTMLElement, config: SecretSettings) {
  root.setAttribute("data-hyroncode-secret-phosphor", config.phosphor)
  if (config.crt) root.setAttribute("data-hyroncode-secret-crt", "on")
  else root.removeAttribute("data-hyroncode-secret-crt")
  if (config.reducedMotion) root.setAttribute("data-hyroncode-secret-reduced", "on")
  else root.removeAttribute("data-hyroncode-secret-reduced")
}

export function clearSecretSettings(root: HTMLElement) {
  root.removeAttribute("data-hyroncode-secret-phosphor")
  root.removeAttribute("data-hyroncode-secret-crt")
  root.removeAttribute("data-hyroncode-secret-reduced")
}
