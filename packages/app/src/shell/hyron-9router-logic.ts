/** Local-only, unauthenticated diagnostics for 9Router. Never stores API credentials. */
export const HYRON_9ROUTER_DEFAULT = "http://127.0.0.1:20128/v1"

export function normalizeHyron9RouterEndpoint(input: string): string {
  const raw = input.trim()
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error("Informe um endereco HTTP local valido, terminado em /v1.")
  }
  if (url.protocol !== "http:") throw new Error("Somente HTTP local e permitido neste painel.")
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname.toLowerCase())) {
    throw new Error("Use localhost, 127.0.0.1 ou [::1]. Enderecos remotos nao sao aceitos.")
  }
  if (url.username || url.password || url.search || url.hash) throw new Error("O endereco nao pode incluir credenciais ou parametros.")
  if (!url.port || !/^\/(v1)\/?$/.test(url.pathname)) {
    throw new Error("Inclua a porta e o caminho /v1 (ex.: http://127.0.0.1:20128/v1).")
  }
  return `${url.origin}/v1`
}

export function hyron9RouterModelIds(body: unknown): string[] {
  if (!body || typeof body !== "object" || !("data" in body) || !Array.isArray(body.data)) {
    throw new Error("A resposta nao contem a lista OpenAI-compativel data[].")
  }
  const found = new Set<string>()
  for (const item of body.data) {
    if (!item || typeof item !== "object" || !("id" in item) || typeof item.id !== "string") continue
    const id = item.id.trim()
    if (id && id.length <= 200) found.add(id)
  }
  return [...found].sort((a, b) => a.localeCompare(b))
}
