import { describe, test, expect } from "bun:test"
import { applySecretSettings, clearSecretSettings, nextSecretSettings, parseSecretSettings, SECRET_DEFAULTS, HYRON_SECRET_SETTINGS_KEY } from "./hyron-secret-settings"

describe("HYRONCODE Cofre Zero Meia V1.5", () => {
  test("defaults and corrupt storage do not break settings", () => {
    expect(parseSecretSettings(null)).toEqual(SECRET_DEFAULTS)
    expect(parseSecretSettings("<invalid>")).toEqual(SECRET_DEFAULTS)
    expect(parseSecretSettings("[]")).toEqual(SECRET_DEFAULTS)
    expect(parseSecretSettings("null")).toEqual(SECRET_DEFAULTS)
    expect(HYRON_SECRET_SETTINGS_KEY.startsWith("hyroncode.easter.")).toBe(true)
  })
  test("unknown fields, fake privileges, and injected colors are never loaded", () => {
    const config = parseSecretSettings(JSON.stringify({ phosphor: "javascript:alert(1)", crt: "true", reducedMotion: 1, isAdmin: true }))
    expect(config).toEqual(SECRET_DEFAULTS)
    expect(Object.keys(config).sort()).toEqual(["crt", "phosphor", "reducedMotion"])
  })
  test("persists valid visual preferences without changing current object", () => {
    const a = parseSecretSettings(null)
    const b = nextSecretSettings(a, { phosphor: "cyan", crt: true })
    expect(a).toEqual(SECRET_DEFAULTS)
    expect(b).toEqual({ phosphor: "cyan", crt: true, reducedMotion: false })
    expect(parseSecretSettings(JSON.stringify(b))).toEqual(b)
    expect(nextSecretSettings(b, { reducedMotion: true }).reducedMotion).toBe(true)
    expect(nextSecretSettings(b, { phosphor: "amber" }).phosphor).toBe("amber")
  })
  test("modifies only three visual root attributes", () => {
    const attributes = new Map<string,string>()
    const root = {
      setAttribute: (key: string, value: string) => attributes.set(key,value),
      removeAttribute: (key: string) => attributes.delete(key),
    } as unknown as HTMLElement
    applySecretSettings(root, { phosphor: "amber", crt: true, reducedMotion: true })
    expect(attributes.size).toBe(3)
    expect(attributes.get("data-hyroncode-secret-phosphor")).toBe("amber")
    expect(attributes.get("data-hyroncode-secret-crt")).toBe("on")
    expect(attributes.get("data-hyroncode-secret-reduced")).toBe("on")
    applySecretSettings(root, { phosphor: "green", crt: false, reducedMotion: false })
    expect([...attributes.entries()]).toEqual([["data-hyroncode-secret-phosphor", "green"]])
    clearSecretSettings(root)
    expect(attributes.size).toBe(0)
  })
})
