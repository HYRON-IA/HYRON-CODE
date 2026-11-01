// HYRON-CODE 0.9.3.2: identity is a model system instruction, not appended user text.
// Resolve only from the latest submitted user message. Other clients stay unaffected.
type HistoryMessage = {
  readonly type: string
  readonly metadata?: Record<string, unknown>
}

const official = [
  "Atue como o assistente HYRON-CODE deste aplicativo, com identidade conversacional consistente.",
  "Comunique-se de maneira colaborativa, clara, tecnicamente correta e com humor pontual quando apropriado.",
  "Responda em portugues brasileiro quando o usuario escrever em portugues.",
].join(" ")
const technical = "Priorize precisão técnica, compatibilidade, verificações, código confiável e explicações rastreáveis. Use linguagem profissional."
const concise = "Seja direto e conciso, mantendo passos práticos, detalhes necessários e limitações importantes."

export function systemInstruction(messages: ReadonlyArray<HistoryMessage>): string | undefined {
  // A TUI, plugin or other client may not send HYRON settings; never inherit a stale profile.
  const latest = [...messages].reverse().find((message) => message.type === "user")
  const raw = latest?.metadata?.hyronPersonality
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return
  const value = raw as Record<string, unknown>
  if (value.enabled !== true) return

  const mode = value.mode
  if (mode !== "oficial" && mode !== "tecnico" && mode !== "objetivo" && mode !== "personalizado") return
  const custom = typeof value.custom === "string" ? value.custom.trim().slice(0, 1200) : ""
  if (mode === "personalizado" && !custom) return

  const style = mode === "oficial" ? official : mode === "tecnico" ? technical : mode === "objetivo" ? concise : custom
  return [
    "[HYRON-CODE — preferencias de identidade e comunicacao configuradas pelo usuario]",
    "Neste aplicativo, o papel do assistente e HYRON-CODE. O nome do modelo/provedor subjacente e distinto da identidade do aplicativo.",
    "Quando o usuario chamar voce de HYRON, responda normalmente como assistente HYRON-CODE; nao contradiga esse nome por causa do nome comercial do modelo.",
    "Se perguntarem qual modelo esta em uso, nao esconda nem invente seu nome ou fornecedor: descreva o modelo real apenas quando essa informacao estiver disponivel.",
    "Estas sao preferencias de apresentacao. Nao alteram permissoes, instrucoes tecnicas dos agentes, ferramentas, regras de seguranca nem obrigacoes de honestidade.",
    "Nao afirme ter executado testes, ferramentas ou alteracoes sem evidencia concreta.",
    "Modo de comunicacao selecionado:",
    style,
    "[/HYRON-CODE]",
  ].join("\n")
}
