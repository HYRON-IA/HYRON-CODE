import { describe, expect, test } from "bun:test"
import {
  parseLivingPreferences,
  parseLivingSelection,
  isValidLivingPortraitUrl,
  readLivingPortraitLink,
  LIVING_DEFAULTS,
} from "./hyron-living-state"

describe("HYRONCODE — Personalidades Vivas", () => {
  test("preferences default safely, parse toggles and tolerate malformed storage", () => {
    expect(parseLivingPreferences(null)).toEqual(LIVING_DEFAULTS)
    expect(parseLivingPreferences("{")).toEqual(LIVING_DEFAULTS)
    expect(parseLivingPreferences('{"animation":false,"railIndicator":false}')).toEqual({ animation: false, railIndicator: false })
    expect(parseLivingPreferences('{"animation":"off","railIndicator":9}')).toEqual(LIVING_DEFAULTS)
  })
  test("only exposes selected identity if studio is explicitly active", () => {
    expect(parseLivingSelection(null)).toBeUndefined()
    expect(parseLivingSelection('{"active":false,"selected":"SEC-004"}')).toBeUndefined()
    expect(parseLivingSelection('{"active":true,"selected":"SEC-004"}')).toEqual({ id: "SEC-004", customName: undefined })
    expect(parseLivingSelection('{"active":true,"selected":"AR-011"}')).toEqual({ id: "AR-011", customName: undefined })
  })
  test("rejects corrupted records or inappropriate identifiers", () => {
    expect(parseLivingSelection("{")).toBeUndefined()
    expect(parseLivingSelection('{"active":true,"selected":"../../etc/passwd"}')).toBeUndefined()
    expect(parseLivingSelection('{"active":true,"selected":123}')).toBeUndefined()
  })
  test("custom name stays associated only with selected user identity", () => {
    expect(parseLivingSelection(JSON.stringify({ active: true, selected: "USER-test", custom: [
      { id: "USER-other", name: "Outro" }, { id: "USER-test", name: "Meu perfil" },
    ] }))).toEqual({ id: "USER-test", customName: "Meu perfil" })
  })
  test("image URLs are constrained to known asset scheme and HTTPS", () => {
    expect(isValidLivingPortraitUrl("/personalities/portraits/JO-001.png")).toBe(true)
    expect(isValidLivingPortraitUrl("javascript:alert(1)")).toBe(false)
    expect(isValidLivingPortraitUrl("/personalities/portraits/../../a.png")).toBe(false)
    expect(readLivingPortraitLink('{"SEC-004":"https://site.example/a.png"}', "SEC-004")).toBe("https://site.example/a.png")
    expect(readLivingPortraitLink('{"SEC-004":"file:///secret"}', "SEC-004")).toBeUndefined()
  })
})
