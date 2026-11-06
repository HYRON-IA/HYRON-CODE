import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  createCheckpoint, finalizeCheckpoint, listCheckpoints, inspectCheckpoint, verifyCheckpoint,
  restoreCheckpoint, checkpointBlob,
} from "./checkpoint.mjs"

const fixture = async (action) => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hyron-fenix-test-"))
  const root = path.join(tmp, "workspace")
  const store = path.join(tmp, "store")
  await fs.mkdir(root)
  try { await action({ root, store, tmp }) } finally { await fs.rm(tmp, { recursive: true, force: true }) }
}

test("creates a durable preimage before a normal edit and recovers it", () => fixture(async ({ root, store }) => {
  const file = path.join(root, "arquivo.txt")
  await fs.writeFile(file, "antes\r\n")
  const checkpoint = await createCheckpoint({ root, files: [file], operation: "edit", sessionID: "teste", store })
  await fs.writeFile(file, "depois\r\n")
  await finalizeCheckpoint(checkpoint)
  assert.equal((await listCheckpoints({ root, store })).length, 1)
  assert.equal((await inspectCheckpoint({ root, id: checkpoint.id, store })).details[0].matchesAfter, true)
  assert.equal((await checkpointBlob({ root, id: checkpoint.id, store, entryIndex: 0 })).toString(), "antes\r\n")
  assert.equal(await verifyCheckpoint({ root, id: checkpoint.id, store }), true)
  const restore = await restoreCheckpoint({ root, id: checkpoint.id, store })
  assert.equal((await fs.readFile(file, "utf8")), "antes\r\n")
  assert.ok(restore.rescueId)
  assert.equal((await listCheckpoints({ root, store })).length, 2)
}))

test("tracks new files and safely removes them during restore", () => fixture(async ({ root, store }) => {
  const file = path.join(root, "novo.txt")
  const checkpoint = await createCheckpoint({ root, files: [file], operation: "write", store })
  await fs.writeFile(file, "novo")
  await finalizeCheckpoint(checkpoint)
  await restoreCheckpoint({ root, id: checkpoint.id, store })
  await assert.rejects(fs.stat(file), { code: "ENOENT" })
}))

test("detects later edits and refuses accidental overwrite", () => fixture(async ({ root, store }) => {
  const file = path.join(root, "a.txt")
  await fs.writeFile(file, "A")
  const checkpoint = await createCheckpoint({ root, files: [file], operation: "patch", store })
  await fs.writeFile(file, "B")
  await finalizeCheckpoint(checkpoint)
  await fs.writeFile(file, "C")
  await assert.rejects(restoreCheckpoint({ root, id: checkpoint.id, store }), /Conflito/)
  assert.equal(await fs.readFile(file, "utf8"), "C")
  const done = await restoreCheckpoint({ root, id: checkpoint.id, store, force: true })
  assert.equal(await fs.readFile(file, "utf8"), "A")
  await restoreCheckpoint({ root, id: done.rescueId, store, force: true })
  assert.equal(await fs.readFile(file, "utf8"), "C")
}))

test("supports multi-file patch including rename and deletion", () => fixture(async ({ root, store }) => {
  const old = path.join(root, "original.txt"), moved = path.join(root, "moved.txt"), deleted = path.join(root, "deleted.txt")
  await fs.writeFile(old, "original")
  await fs.writeFile(deleted, "delete-me")
  const checkpoint = await createCheckpoint({ root, files: [old, moved, deleted], operation: "patch", store })
  await fs.rename(old, moved)
  await fs.unlink(deleted)
  await finalizeCheckpoint(checkpoint)
  await restoreCheckpoint({ root, id: checkpoint.id, store })
  assert.equal(await fs.readFile(old, "utf8"), "original")
  assert.equal(await fs.readFile(deleted, "utf8"), "delete-me")
  await assert.rejects(fs.stat(moved), { code: "ENOENT" })
}))

test("rejects tampered backup blob", () => fixture(async ({ root, store }) => {
  const file = path.join(root, "secret.txt")
  await fs.writeFile(file, "ok")
  const checkpoint = await createCheckpoint({ root, files: [file], operation: "edit", store })
  await fs.writeFile(path.join(checkpoint.directory, "0000.bin"), "tampered")
  await assert.rejects(verifyCheckpoint({ root, id: checkpoint.id, store }), /corrompido/)
}))

test("refuses to checkpoint symlinks", () => fixture(async ({ root, store }) => {
  const file = path.join(root, "real.txt")
  await fs.writeFile(file, "data")
  const link = path.join(root, "link.txt")
  try { await fs.symlink(file, link) } catch (e) { if (e.code === "EPERM") return; throw e }
  await assert.rejects(createCheckpoint({ root, files: [link], operation: "write", store }), /regulares/)
}))
