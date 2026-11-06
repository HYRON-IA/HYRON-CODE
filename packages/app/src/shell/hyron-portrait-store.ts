/** HYRONCODE - retratos privados armazenados no perfil local do navegador (IndexedDB).
 * Preserva o arquivo original em Blob e cria uma miniatura proporcional para a galeria.
 * Nenhum upload de rede; nada é enviado a um servidor.
 */
const DB_NAME = "hyroncode-personality-portraits-v2"
const DB_VERSION = 1
const ORIGINALS = "originals"
const THUMBNAILS = "thumbnails"
export const MAX_PORTRAIT_BYTES = 15 * 1024 * 1024

let pendingDatabase: Promise<IDBDatabase> | undefined
function database(): Promise<IDBDatabase> {
  if (!pendingDatabase) {
    pendingDatabase = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === "undefined") { reject(new Error("O armazenamento IndexedDB não está disponível.")); return }
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(ORIGINALS)) db.createObjectStore(ORIGINALS)
        if (!db.objectStoreNames.contains(THUMBNAILS)) db.createObjectStore(THUMBNAILS)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error("Falha ao abrir banco de imagens."))
      request.onblocked = () => reject(new Error("Feche outras abas do HYRONCODE e tente novamente."))
    }).catch((error: unknown) => { pendingDatabase = undefined; throw error })
  }
  return pendingDatabase
}

// Os 12 IDs secretos compartilham o mesmo armazenamento local dos demais retratos.
// Não habilita IDs arbitrários (SEC-013, SEC-999, etc.).
export function validPortraitId(id: string): boolean {
  return /^(JO|FI|AN|AR|SÉ)-\d{3}$|^USER-[A-Za-z0-9-]{1,85}$|^SEC-(?:00[1-9]|01[0-2])$/.test(id)
}
export async function storedPortraitIds(): Promise<string[]> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const req = db.transaction(THUMBNAILS, "readonly").objectStore(THUMBNAILS).getAllKeys()
    req.onsuccess = () => resolve(req.result.filter((key): key is string => typeof key === "string" && validPortraitId(key)))
    req.onerror = () => reject(req.error ?? new Error("Falha ao listar retratos."))
  })
}

export async function portraitThumbnail(id: string): Promise<Blob | undefined> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const req = db.transaction(THUMBNAILS, "readonly").objectStore(THUMBNAILS).get(id)
    req.onsuccess = () => resolve(req.result instanceof Blob ? req.result : undefined)
    req.onerror = () => reject(req.error ?? new Error("Falha ao ler miniatura."))
  })
}

async function thumbnail(file: File): Promise<Blob> {
  // O decode detecta arquivos inválidos independentemente da extensão informada.
  const bitmap = await createImageBitmap(file)
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40_000_000) throw new Error("Dimensões inválidas ou imagem excessivamente grande.")
    const scale = Math.min(1, 520 / bitmap.width, 420 / bitmap.height)
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Não foi possível criar miniatura.")
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", 0.86))
    if (!blob) throw new Error("Não foi possível gerar miniatura.")
    return blob
  } finally { bitmap.close() }
}

export async function putPortrait(id: string, file: File): Promise<Blob> {
  if (!validPortraitId(id)) throw new Error("Identificador de personagem inválido.")
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Aceitamos apenas PNG, JPG ou WebP.")
  if (!file.size || file.size > MAX_PORTRAIT_BYTES) throw new Error("A imagem deve ter no máximo 15 MB.")
  const preview = await thumbnail(file)
  const db = await database()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([ORIGINALS, THUMBNAILS], "readwrite")
    tx.objectStore(ORIGINALS).put(file, id)
    tx.objectStore(THUMBNAILS).put(preview, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("Falha ao salvar retrato."))
    tx.onabort = () => reject(tx.error ?? new Error("Salvamento interrompido."))
  })
  return preview
}

export async function deletePortrait(id: string): Promise<void> {
  const db = await database()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([ORIGINALS, THUMBNAILS], "readwrite")
    tx.objectStore(ORIGINALS).delete(id)
    tx.objectStore(THUMBNAILS).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("Falha ao remover retrato."))
    tx.onabort = () => reject(tx.error ?? new Error("Remoção interrompida."))
  })
}

export async function originalPortrait(id: string): Promise<Blob | undefined> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const req = db.transaction(ORIGINALS, "readonly").objectStore(ORIGINALS).get(id)
    req.onsuccess = () => resolve(req.result instanceof Blob ? req.result : undefined)
    req.onerror = () => reject(req.error ?? new Error("Falha ao ler imagem original."))
  })
}
