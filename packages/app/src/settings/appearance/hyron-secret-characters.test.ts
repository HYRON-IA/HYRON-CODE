import { describe, expect, test } from "bun:test"
import { isSecretCharacterId, normalizeSecretQuery, secretCharacterById, secretCharacters, secretCharactersForQuery, secretCharacterSystemInstruction } from "./hyron-secret-characters"

describe("HYRONCODE — 12 personagens secretos", () => {
  test("exact count and disjoint ids", () => {
    expect(secretCharacters).toHaveLength(12)
    expect(new Set(secretCharacters.map(x => x.id)).size).toBe(12)
    expect(secretCharacters.every(x => x.id.startsWith("SEC-"))).toBe(true)
  })
  test("not leaked by empty or fuzzy search", () => {
    for (const query of ["", " ", "dor", "Ellen Joe", "Jane Doe", "Myab", "Doro Orange", "Farm automática", "Phoebe", "115", "cat"]) {
      expect(secretCharactersForQuery(query)).toHaveLength(0)
    }
  })
  test("exact special unlock aliases", () => {
    for (const name of ["Gugugaga", "Doro Doro", "Dorodoro", "Phoebe Chubi", "Myabi", "Ellen", "Jane", "Catdrone", "Catlumbina", "Speaky", "Nuo Nuo", "NuoNuo", "1155", "Farm"]) {
      expect(secretCharactersForQuery(name)).toHaveLength(1)
      expect(secretCharactersForQuery(`  ${name.toUpperCase()}   `)).toHaveLength(1)
    }
  })
  test("no mixed identities and unique avatars", () => {
    expect(new Set(secretCharacters.map(x => x.avatar)).size).toBe(12)
    for (const item of secretCharacters) {
      expect(secretCharacterById(item.id)?.name).toBe(item.name)
      expect(isSecretCharacterId(item.id)).toBe(true)
      expect(secretCharacterSystemInstruction(item.id)).toContain(item.id)
      expect(secretCharacterSystemInstruction(item.id)).toContain(item.name)
    }
  })
  test("preserves specialized speech and meme rules", () => {
    const i = (id: string) => secretCharacterSystemInstruction(id) ?? ""
    expect(i("SEC-006")).toContain("Jane")
    expect(i("SEC-009")).toContain("좋아요")
    expect(i("SEC-011")).toContain("LATA")
    expect(i("SEC-011")).toContain("SECO, SECO, SECO")
    expect(i("SEC-012")).toContain("Minecraft")
    expect(i("SEC-004")).toContain("Myabi")
    expect(normalizeSecretQuery("  dORO    dORO  ")).toBe("doro doro")
  })
})
