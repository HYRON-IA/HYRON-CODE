import path from "node:path"
import os from "node:os"
import fs from "node:fs/promises"
import { spawnSync } from "node:child_process"
import { createInterface } from "node:readline/promises"
import {
  createCheckpoint, finalizeCheckpoint, listCheckpoints, readCheckpoint, inspectCheckpoint,
  verifyCheckpoint, restoreCheckpoint, checkpointBlob,
} from "../../packages/core/src/fenix/checkpoint.mjs"

const args = process.argv.slice(2)
const at = args.indexOf("--root")
if (at < 0 || !args[at + 1]) { console.error("Uso: node cli.mjs COMANDO --root CAMINHO [ID] [--force]"); process.exit(2) }
const root = path.resolve(args[at + 1])
args.splice(at, 2)
const [command, id] = args
const force = args.includes("--force")
const fmt = (f) => f.exists ? `${f.sha256?.slice(0, 12)} (${f.size} bytes)` : "[arquivo ausente]"

const detail = async (id) => {
  const d = await inspectCheckpoint({ root, id })
  console.log(`\nFENIX ${d.id}\nOperacao: ${d.operation} | Sessao: ${d.sessionID || "—"}\nSituacao: ${d.status} | ${d.createdAt}`)
  for (const file of d.details) {
    const status = file.matchesAfter ? "igual ao POS" : file.matchesBefore ? "igual ao ANTES" : "DIVERGENTE"
    console.log(`\n${file.insideProject ? path.relative(root, file.path) : `[EXTERNO] ${file.path}`}`)
    console.log(`  Antes: ${fmt(file.before)}\n  Depois: ${fmt(file.after || {exists:false})}\n  Atual: ${fmt(file.current)}\n  ${status}`)
  }
  return d
}

async function diff(id) {
  const d = await detail(id)
  await verifyCheckpoint({ root, id })
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hyron-fenix-diff-"))
  try {
    for (const [n, entry] of d.entries.entries()) {
      const before = await checkpointBlob({ root, id, entryIndex: n })
      const after = d.details[n].current.exists ? await fs.readFile(entry.path) : Buffer.alloc(0)
      if (before.includes(0) || after.includes(0)) { console.log(`\n[Binario ou contendo NUL] ${entry.path}`); continue }
      const a = path.join(tmp, `before-${n}.txt`), b = path.join(tmp, `current-${n}.txt`)
      await fs.writeFile(a, before); await fs.writeFile(b, after)
      const result = spawnSync("git", ["-c", "color.ui=false", "diff", "--no-index", "--no-ext-diff", "--", a, b], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, windowsHide: true })
      if (!result.error && result.status <= 1) {
        const content = result.stdout.trim()
        console.log(content || "\n[Sem diferencas de conteudo]")
      } else {
        console.log("\nGit indisponivel; comparacao de hashes exibida acima. Nenhuma alteracao realizada.")
      }
    }
  } finally { await fs.rm(tmp, { recursive: true, force: true }) }
}

async function restore(id, force) {
  const d = await detail(id)
  await verifyCheckpoint({ root, id })
  const conflicts = d.details.filter((f) => !f.matchesBefore && !f.matchesAfter)
  if (conflicts.length && !force) throw new Error(`${conflicts.length} arquivo(s) divergiram apos o checkpoint; execute 'diff' e depois 'restore ID --force' se realmente desejar.`)
  console.log("\nATENCAO: a restauracao modifica arquivos no projeto. Antes disso, Fenix cria checkpoint de resgate.")
  if (d.details.some((f) => !f.insideProject)) console.log("ATENCAO: este checkpoint tambem inclui caminhos EXTERNOS ao projeto.")
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  let confirmation
  try { confirmation = await rl.question('Para confirmar, digite exatamente RESTAURAR: ') } finally { rl.close() }
  if (confirmation !== "RESTAURAR") { console.log("Cancelado, sem alteracoes."); return }
  const result = await restoreCheckpoint({ root, id, force })
  console.log(`\nRestauração aplicada em ${result.restoredFiles} arquivo(s). Resgate anterior: ${result.rescueId}`)
}

try {
  if (command === "list") {
    const history = await listCheckpoints({ root })
    if (!history.length) console.log("Nenhum checkpoint Fenix encontrado para este projeto.")
    for (const record of history.slice(0, 80)) console.log(`${record.id}  ${record.status.padEnd(10)} ${record.operation.padEnd(24)}  ${record.files} arquivo(s)`)
  } else if (command === "show" && id) await detail(id)
  else if (command === "diff" && id) await diff(id)
  else if (command === "verify" && id) { await verifyCheckpoint({ root, id }); console.log("Hashes do checkpoint: OK") }
  else if (command === "restore" && id) await restore(id, force)
  else if (command === "create") {
    const files = args.slice(1).filter((a) => a !== "--force").map((a) => path.resolve(root, a))
    if (!files.length) throw new Error("Para criar checkpoint manual, informe os caminhos dos arquivos apos 'create'.")
    const cp = await createCheckpoint({ root, files, operation: "manual" })
    await finalizeCheckpoint(cp)
    console.log("Checkpoint criado: " + cp.id)
  } else {
    console.log("Comandos: list | show ID | diff ID | verify ID | restore ID [--force] | create arquivo1 arquivo2")
    process.exitCode = 2
  }
} catch (error) { console.error("[ERRO FENIX] " + error.message); process.exitCode = 1 }
