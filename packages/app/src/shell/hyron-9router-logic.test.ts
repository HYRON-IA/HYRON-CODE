import { describe, expect, it } from "bun:test"
import { HYRON_9ROUTER_DEFAULT, hyron9RouterModelIds, normalizeHyron9RouterEndpoint } from "./hyron-9router-logic"

describe("HYRONCODE 9Router local diagnostics", () => {
  it("accepts the local default", () => {
    expect(normalizeHyron9RouterEndpoint(HYRON_9ROUTER_DEFAULT)).toBe(HYRON_9ROUTER_DEFAULT)
  })
  it("accepts another loopback port, canonicalizing /v1", () => {
    expect(normalizeHyron9RouterEndpoint("http://localhost:19000/v1/")).toBe("http://localhost:19000/v1")
  })
  it("rejects remote hosts, private networks and https", () => {
    for (const value of ["http://192.168.1.2:20128/v1", "http://example.com:20128/v1", "https://localhost:20128/v1"]) {
      expect(() => normalizeHyron9RouterEndpoint(value)).toThrow()
    }
  })
  it("rejects credentials, wrong path and missing port", () => {
    for (const value of ["http://a:pass@localhost:20128/v1", "http://localhost:20128/dashboard", "http://localhost/v1", "http://localhost:20128/v1?secret=1"]) {
      expect(() => normalizeHyron9RouterEndpoint(value)).toThrow()
    }
  })
  it("parses model IDs and removes duplicates", () => {
    expect(hyron9RouterModelIds({ data: [{ id: "auto" }, { id: "cc/first" }, { id: "auto" }, { name: "missing" }] })).toEqual(["auto", "cc/first"])
  })
  it("rejects invalid model-list responses", () => {
    expect(() => hyron9RouterModelIds({ message: "not a model list" })).toThrow()
  })
})
