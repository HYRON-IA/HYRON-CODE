import { describe, expect, test } from "bun:test"
import { activateHyronStudioProfile, HYRON_STUDIO_STORAGE_KEY } from "./hyron-personality-selection"

function environment(initial?: unknown) {
  const items = new Map<string, string>()
  if (initial !== undefined) items.set(HYRON_STUDIO_STORAGE_KEY, JSON.stringify(initial))
  let events = 0
  const selection = {
    storage: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => { items.set(key, value) },
    },
    notify: () => { events++; expect(items.has(HYRON_STUDIO_STORAGE_KEY)).toBe(true) },
  }
  return { selection, items, events: () => events }
}

describe("HYRONCODE — selecao sincronizada do catalogo visual", () => {
  test("photo click saves active secret and retains favorites/custom data", () => {
    const old = { active: false, selected: "JO-002", rude: 4, custom: [{ id: "USER-1", name: "Perfil", description: "x" }], futureSetting: "preserve" }
    const ctx = environment(old)
    expect(activateHyronStudioProfile("SEC-004", ctx.selection)).toBe(true)
    expect(JSON.parse(ctx.items.get(HYRON_STUDIO_STORAGE_KEY)!)).toEqual({ ...old, active: true, selected: "SEC-004" })
    expect(ctx.events()).toBe(1)
  })
  test("switch from secret to conventional stays functional", () => {
    const ctx = environment({ active: true, selected: "SEC-006", rude: 3, custom: [] })
    expect(activateHyronStudioProfile("JO-001", ctx.selection)).toBe(true)
    expect(JSON.parse(ctx.items.get(HYRON_STUDIO_STORAGE_KEY)!).selected).toBe("JO-001")
    expect(ctx.events()).toBe(1)
  })
  test("first selection uses a compatible default", () => {
    const ctx = environment()
    expect(activateHyronStudioProfile("SEC-001", ctx.selection)).toBe(true)
    expect(JSON.parse(ctx.items.get(HYRON_STUDIO_STORAGE_KEY)!)).toEqual({ active: true, selected: "SEC-001", rude: 0, custom: [] })
  })
  test("invalid stored data is never destroyed", () => {
    const ctx = environment(["unexpected"])
    expect(activateHyronStudioProfile("SEC-002", ctx.selection)).toBe(false)
    expect(JSON.parse(ctx.items.get(HYRON_STUDIO_STORAGE_KEY)!)).toEqual(["unexpected"])
    expect(ctx.events()).toBe(0)
  })
  test("storage failure does not emit an activation event", () => {
    let notified = false
    expect(activateHyronStudioProfile("SEC-002", { storage: { getItem: () => null, setItem: () => { throw Error("quota") } }, notify: () => { notified = true } })).toBe(false)
    expect(notified).toBe(false)
  })
  test("blank profile cannot overwrite selection", () => {
    const ctx = environment({ active: true, selected: "JO-001" })
    expect(activateHyronStudioProfile(" ", ctx.selection)).toBe(false)
    expect(ctx.items.get(HYRON_STUDIO_STORAGE_KEY)).toBe(JSON.stringify({ active: true, selected: "JO-001" }))
  })
})
