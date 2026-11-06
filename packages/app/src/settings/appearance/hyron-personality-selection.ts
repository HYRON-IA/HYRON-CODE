// HYRONCODE: atualiza a selecao sem recriar o registro e sem apagar preferencias extras.
export const HYRON_STUDIO_STORAGE_KEY = "hyroncode-studio-personality-v1"
export const HYRON_STUDIO_CHANGE_EVENT = "hyron-personality-change"

type SelectionStorage = Pick<Storage, "getItem" | "setItem">
type SelectionEnvironment = { storage: SelectionStorage; notify: () => void }

export function activateHyronStudioProfile(
  id: string,
  environment: SelectionEnvironment = {
    storage: window.localStorage,
    notify: () => window.dispatchEvent(new Event(HYRON_STUDIO_CHANGE_EVENT)),
  },
): boolean {
  if (!id.trim()) return false
  try {
    const raw = environment.storage.getItem(HYRON_STUDIO_STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : { active: false, selected: "AR-011", rude: 0, custom: [] }
    // Não apagar dados do usuario diante de JSON corrompido/inesperado.
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false
    const next = { ...parsed, active: true, selected: id }
    environment.storage.setItem(HYRON_STUDIO_STORAGE_KEY, JSON.stringify(next))
    environment.notify()
    return true
  } catch { return false }
}
