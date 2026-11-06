export type FenixHandle = { id: string; project: string; directory: string; store: string }
export type FenixArgs = { root: string; files: string[]; operation: string; sessionID?: string; store?: string }
export function createCheckpoint(options: FenixArgs): Promise<FenixHandle>
export function finalizeCheckpoint(handle: FenixHandle): Promise<void>
export function listCheckpoints(options: { root: string; store?: string }): Promise<Array<{ id: string; createdAt?: string; status: string; operation: string; files: number }>>
export function readCheckpoint(options: { root: string; id: string; store?: string }): Promise<any>
export function inspectCheckpoint(options: { root: string; id: string; store?: string }): Promise<any>
export function verifyCheckpoint(options: { root: string; id: string; store?: string }): Promise<boolean>
export function restoreCheckpoint(options: { root: string; id: string; store?: string; force?: boolean }): Promise<{ rescueId: string; restoredFiles: number }>
export function checkpointBlob(options: { root: string; id: string; store?: string; entryIndex: number }): Promise<Buffer>
