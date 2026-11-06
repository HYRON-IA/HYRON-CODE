import { describe, expect, test } from "bun:test"
import { advanceKonami, advanceLogoClicks, easterChatTrigger, easterUiCommand, KONAMI_KEYS, withHyronEasterPrompt } from "./hyron-easter-logic"

describe("HYRONCODE Easter Eggs V1.4", () => {
  test("accepts only exact UI commands", () => {
    expect(easterUiCommand(" /matrix ")).toBe("matrix")
    expect(easterUiCommand("/retro")).toBe("retro")
    expect(easterUiCommand("/creator")).toBe("creator")
    for (const text of ["/matrix --force", "/retrospect", "console.log('/matrix')", "git /creator"]) expect(easterUiCommand(text)).toBeUndefined()
  })
  test("accepts only dedicated chat phrases", () => {
    expect(easterChatTrigger("SENTA A PUA!")).toBe("senta")
    expect(easterChatTrigger("ativar protocolo zero meia")).toBe("zero-meia")
    for (const text of ["SENTA A PUA com a função", "protocolo zero meia", "// SENTA A PUA", "/matrix"]) expect(easterChatTrigger(text)).toBeUndefined()
  })
  test("preserves current secret character instructions", () => {
    const original = { enabled: true, mode: "personalizado" as const, custom: "SEC-004: Myabi. Somente Myabi, Mya, Yabiyabi e My Myabi." }
    const after = withHyronEasterPrompt(original, "senta a pua")
    expect(after.custom).toContain("SEC-004: Myabi")
    expect(after.custom).toContain("SENTA A PUA")
    expect(after.mode).toBe("personalizado")
    expect(original.custom).toBe("SEC-004: Myabi. Somente Myabi, Mya, Yabiyabi e My Myabi.")
    expect(withHyronEasterPrompt(original, "function x() {} ")).toBe(original)
  })
  test("preserves regular modes and does not mutate storage", () => {
    const original = { enabled: true, mode: "tecnico" as const, custom: "" }
    expect(withHyronEasterPrompt(original, "ativar protocolo zero meia").custom).toContain("Estilo tecnico")
    expect(original.mode).toBe("tecnico")
  })
  test("recognizes Konami keys only in order", () => {
    let history: string[] = []
    for (const key of KONAMI_KEYS.slice(0, -1)) {
      const result = advanceKonami(history, key)
      expect(result.matched).toBe(false)
      history = result.history
    }
    const final = advanceKonami(history, "a")
    expect(final.matched).toBe(true)
    expect(advanceKonami([], "a").matched).toBe(false)
    expect(advanceKonami(history, "z").matched).toBe(false)
  })
  test("requires five rapid logo clicks, not a slow sequence", () => {
    let state = { count: 0, last: 0 }
    for (let n = 1; n <= 5; n++) {
      const result = advanceLogoClicks(state, n * 300)
      expect(result.matched).toBe(n === 5)
      state = result.state
    }
    expect(state.count).toBe(0)
    expect(advanceLogoClicks({ count: 4, last: 0 }, 3000).matched).toBe(false)
  })
})
