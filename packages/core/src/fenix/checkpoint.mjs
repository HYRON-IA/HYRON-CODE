// HYRONCODE Fenix — durable local preimages. No network, Git mutations, or external packages.
// This module intentionally uses Node APIs: the Fenix safeguard runs on the desktop's local backend.
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { createHash, randomBytes } from "node:crypto"

const VERSION = 1
const MAX_BYTES = 64 * 1024 * 1024
const MAX_FILES = 500

const digest = (data) => createHash("sha256").update(data).digest("hex")
const projectKey = (root) => digest(Buffer.from(path.resolve(root).toLowerCase())).slice(0, 20)
const defaultStorage = () => path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), ".local", "share"), "HYRONCODE", "fenix", "v1")
const unique = () => new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomBytes(5).toString("hex")
const fileIsInside = (parent, child) => {
  const relative = path.relative(parent, child)
  return relative === "" || (relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative))
}
const clean = (s) => String(s).replace(/[\r\n\t]/g, " ").slice(0, 200)
const storageOf = (project, store) => path.join(path.resolve(store || defaultStorage()), projectKey(project))
const checkedID = (id) => {
  if (!/^\d{4}-\d{2}-\d{2}T[\w-]{10,50}-[a-f0-9]{10}$/.test(id)) throw new Error("ID de checkpoint invalido")
  return id
}

async function fingerprint(file, limit = MAX_BYTES) {
  let info
  try { info = await fs.lstat(file) } catch (error) {
    if (error?.code === "ENOENT") return { exists: false }
    throw error
  }
  if (!info.isFile()) throw new Error(`Fenix nao salva arquivos que nao sejam regulares: ${file}`)
  if (info.size > limit) throw new Error(`Fenix: arquivo acima do limite de ${limit} bytes: ${file}`)
  const bytes = await fs.readFile(file)
  if (bytes.length > limit) throw new Error(`Fenix: arquivo cresceu acima do limite: ${file}`)
  return { exists: true, sha256: digest(bytes), size: bytes.length, mode: info.mode & 0o777, bytes }
}
const publicFingerprint = ({ bytes, ...rest }) => rest
const same = (left, right) => Boolean(left && right && left.exists === right.exists && (!left.exists || left.sha256 === right.sha256))

export async function createCheckpoint({ root, files, operation, sessionID = "", store }) {
  const project = path.resolve(root)
  if (!(await fs.stat(project)).isDirectory()) throw new Error("Raiz do projeto nao e uma pasta")
  const targets = [...new Set(files.map((x) => path.resolve(x)))]
  if (targets.length === 0 || targets.length > MAX_FILES) throw new Error("Fenix: quantidade de arquivos invalida")
  const storage = storageOf(project, store)
  await fs.mkdir(storage, { recursive: true })
  // Atomic directory creation prevents two simultaneous tools from sharing an ID.
  let id, directory
  for (;;) {
    id = unique()
    directory = path.join(storage, id)
    try { await fs.mkdir(directory); break } catch (error) { if (error.code !== "EEXIST") throw error }
  }
  try {
    const entries = []
    for (const [index, target] of targets.entries()) {
      if (fileIsInside(storage, target)) throw new Error("Fenix: destino dentro do proprio armazenamento")
      const snapshot = await fingerprint(target)
      const blob = snapshot.exists ? `${String(index).padStart(4, "0")}.bin` : null
      if (blob) await fs.writeFile(path.join(directory, blob), snapshot.bytes, { flag: "wx", mode: 0o600 })
      entries.push({ path: target, insideProject: fileIsInside(project, target), before: publicFingerprint(snapshot), blob })
    }
    const manifest = {
      version: VERSION, id, project, createdAt: new Date().toISOString(), operation: clean(operation),
      sessionID: clean(sessionID), status: "prepared", entries,
    }
    await atomicManifest(directory, manifest)
    return { id, project, directory, store: storage }
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true }).catch(() => {})
    throw error
  }
}

async function atomicManifest(directory, manifest) {
  const temp = path.join(directory, `manifest-${randomBytes(6).toString("hex")}.tmp`)
  try {
    await fs.writeFile(temp, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 })
    await fs.rename(temp, path.join(directory, "manifest.json"))
  } finally { await fs.rm(temp, { force: true }).catch(() => {}) }
}

export async function finalizeCheckpoint(handle) {
  const manifest = await readCheckpoint({ root: handle.project, id: handle.id, store: path.dirname(handle.store) })
  // readCheckpoint expects a base storage, not a project-specific directory.
  const entries = []
  for (const entry of manifest.entries) {
    const current = await fingerprint(entry.path)
    entries.push({ ...entry, after: publicFingerprint(current) })
  }
  await atomicManifest(handle.directory, { ...manifest, status: "completed", completedAt: new Date().toISOString(), entries })
}

export async function readCheckpoint({ root, id, store }) {
  const project = path.resolve(root)
  const dir = path.join(storageOf(project, store), checkedID(id))
  const manifest = JSON.parse(await fs.readFile(path.join(dir, "manifest.json"), "utf8"))
  if (manifest.version !== VERSION || manifest.id !== id || manifest.project !== project || !Array.isArray(manifest.entries)) {
    throw new Error("Manifesto Fenix incompativel ou alterado")
  }
  for (const entry of manifest.entries) {
    if (typeof entry.path !== "string" || !path.isAbsolute(entry.path) || typeof entry.before?.exists !== "boolean") {
      throw new Error("Entrada de checkpoint invalida")
    }
    if (entry.before.exists && (!/^\d{4}\.bin$/.test(entry.blob || "") || !/^[a-f0-9]{64}$/.test(entry.before.sha256 || ""))) {
      throw new Error("Blob de checkpoint invalido")
    }
    if (entry.insideProject !== fileIsInside(project, entry.path)) throw new Error("Escopo de checkpoint alterado")
  }
  return manifest
}

export async function listCheckpoints({ root, store }) {
  const dir = storageOf(path.resolve(root), store)
  let names
  try { names = await fs.readdir(dir) } catch (error) { if (error.code === "ENOENT") return []; throw error }
  const records = []
  for (const id of names.sort().reverse()) {
    if (!/^\d{4}-\d{2}-\d{2}T/.test(id)) continue
    try {
      const record = await readCheckpoint({ root, id, store })
      records.push({ id, createdAt: record.createdAt, status: record.status, operation: record.operation, files: record.entries.length })
    } catch { records.push({ id, status: "CORRUPTO", operation: "", files: 0 }) }
  }
  return records
}

export async function inspectCheckpoint({ root, id, store }) {
  const record = await readCheckpoint({ root, id, store })
  const details = []
  for (const entry of record.entries) {
    const now = publicFingerprint(await fingerprint(entry.path))
    details.push({ ...entry, current: now, matchesAfter: Boolean(entry.after && same(now, entry.after)), matchesBefore: same(now, entry.before) })
  }
  return { ...record, details }
}

export async function verifyCheckpoint({ root, id, store }) {
  const record = await readCheckpoint({ root, id, store })
  const directory = path.join(storageOf(root, store), id)
  for (const entry of record.entries) {
    if (!entry.before.exists) continue
    const content = await fs.readFile(path.join(directory, entry.blob))
    if (content.length !== entry.before.size || digest(content) !== entry.before.sha256) {
      throw new Error(`Fenix: backup corrompido em ${entry.path}`)
    }
  }
  return true
}

export async function restoreCheckpoint({ root, id, store, force = false }) {
  const project = path.resolve(root)
  if (!await verifyCheckpoint({ root: project, id, store })) throw new Error("Checkpoint invalido")
  const inspected = await inspectCheckpoint({ root: project, id, store })
  if (inspected.status === "restored") throw new Error("Este checkpoint ja foi restaurado")
  const conflicts = inspected.details.filter((entry) => !entry.matchesBefore && !entry.matchesAfter)
  if (!force && conflicts.length) {
    throw new Error(`Conflito com alteracoes posteriores (${conflicts.length} arquivo(s)). Nao restaurado; use --force somente apos revisar o diff.`)
  }
  // A rescue of the current state always precedes any restore, including forced restores.
  const rescue = await createCheckpoint({
    root: project, files: inspected.entries.map((entry) => entry.path),
    operation: `rescue-before-restore:${id}`, store,
  })
  await finalizeCheckpoint(rescue)
  const directory = path.join(storageOf(project, store), id)
  try {
    for (const entry of inspected.entries) {
      const target = entry.path
      const current = await fingerprint(target)
      if (!force && !same(publicFingerprint(current), entry.after ?? entry.before) && !same(publicFingerprint(current), entry.before)) {
        throw new Error(`Mudanca concorrente em ${target}; restauracao interrompida`)
      }
      if (!entry.before.exists) {
        if (current.exists) await fs.unlink(target)
        continue
      }
      const content = await fs.readFile(path.join(directory, entry.blob))
      await fs.mkdir(path.dirname(target), { recursive: true })
      const temp = `${target}.fenix-restore-${randomBytes(5).toString("hex")}.tmp`
      try {
        await fs.writeFile(temp, content, { flag: "wx", mode: entry.before.mode ?? 0o600 })
        await fs.rename(temp, target)
      } finally { await fs.rm(temp, { force: true }).catch(() => {}) }
    }
    await atomicManifest(directory, { ...inspected, details: undefined, status: "restored", restoredAt: new Date().toISOString(), rescueId: rescue.id })
    return { rescueId: rescue.id, restoredFiles: inspected.entries.length }
  } catch (error) {
    throw new Error(`Restauracao parcial ou nao concluida. Resgate: ${rescue.id}. Motivo: ${error.message}`)
  }
}

export async function checkpointBlob({ root, id, store, entryIndex }) {
  const manifest = await readCheckpoint({ root, id, store })
  const entry = manifest.entries[entryIndex]
  if (!entry) throw new Error("Arquivo nao existe no checkpoint")
  if (!entry.before.exists) return Buffer.alloc(0)
  await verifyCheckpoint({ root, id, store })
  return fs.readFile(path.join(storageOf(root, store), id, entry.blob))
}
