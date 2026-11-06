import { describe, expect, test } from "bun:test"
import { validPortraitId } from "./hyron-portrait-store"
import { hasSecretPortraitOverride, resolveSecretPortrait } from "./hyron-secret-portrait"

describe("HYRONCODE V1.3 — imagens dos personagens secretos", () => {
  test("aceita apenas SEC-001 a SEC-012 sem ampliar outros tipos", () => {
    for (let n = 1; n <= 12; n++) expect(validPortraitId(`SEC-${String(n).padStart(3, "0")}`)).toBe(true)
    for (const id of ["SEC-000", "SEC-013", "SEC-999", "SEC-001/../../x", "sec-004", "AN-XYZ", "USER-"])
      expect(validPortraitId(id)).toBe(false)
    for (const id of ["JO-573", "FI-001", "AN-001", "AR-011", "SÉ-012", "USER-meu-perfil"])
      expect(validPortraitId(id)).toBe(true)
  })
  test("avatar personalizado substitui SVG padrão, inclusive após buscar miniatura no IndexedDB", () => {
    const avatar = "/personalities/secret-avatars/SEC-004.svg"
    expect(resolveSecretPortrait({ defaultAvatar: avatar })).toBe(avatar)
    expect(resolveSecretPortrait({ defaultAvatar: avatar, thumbnail: "blob:miniatura" })).toBe("blob:miniatura")
    expect(resolveSecretPortrait({ defaultAvatar: avatar, link: "https://example.org/myabi.png" })).toBe("https://example.org/myabi.png")
    expect(resolveSecretPortrait({ defaultAvatar: avatar, thumbnail: "blob:miniatura", link: "https://example.org/myabi.png" })).toBe("blob:miniatura")
  })
  test("imagem quebrada, oculta ou restaurada retorna ao avatar original", () => {
    const avatar = "/personalities/secret-avatars/SEC-004.svg"
    expect(resolveSecretPortrait({ defaultAvatar: avatar, thumbnail: "blob:falha", broken: true })).toBe(avatar)
    expect(resolveSecretPortrait({ defaultAvatar: avatar, thumbnail: "blob:oculta", hidden: true })).toBe(avatar)
    expect(hasSecretPortraitOverride({ uploaded: false, link: "" })).toBe(false)
    expect(hasSecretPortraitOverride({ uploaded: true })).toBe(true)
    expect(hasSecretPortraitOverride({ link: "https://example.org/pic.jpg" })).toBe(true)
  })
})
